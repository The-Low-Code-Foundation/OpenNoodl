/**
 * AIX-011 — Plan tools: create_plan / stage_plan_operation / apply_plan /
 * discard_plan. Registered only with --allow-writes.
 *
 * The point is the staging guarantee the per-component tools cannot give: a
 * multi-component change is declared as a plan, each operation's candidate is
 * staged IN MEMORY and validated (against the project *plus* the plan's other
 * staged candidates, so an update may instantiate a component a sibling
 * create provides), and NOTHING touches disk until one `apply_plan` call
 * writes the complete set. Discarding a plan, or never applying it, leaves
 * the project byte-identical — the same structural reject-safety as the
 * editor loop.
 *
 * One plan model, not two: the types, plan validation, ordering, and the
 * cross-operation dependency closure are imported from the editor's
 * `authoring/plan` module (relative import, the `editor-deps` pattern), so
 * the editor orchestrator and these tools cannot drift.
 *
 * Doc operations are first-class and staged exactly like component operations:
 * `stage_plan_operation` takes their `content` (the whole file, the same
 * whole-candidate contract) and `apply_plan` writes it through AIX-009's
 * `write_project_doc` path. The editor's equivalent authors that body with a
 * dedicated turn because its user is a human who did not write it; here the
 * caller IS the agent, so the body is simply another thing it stages — and
 * either way nothing reaches disk until the one apply call.
 */

import * as crypto from 'crypto';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type {
  AuthoringPlan,
  PlanOperation
} from '../../../noodl-editor/src/editor/src/models/AiAssistant/authoring/plan';
import {
  orderPlanOperations,
  planExcludedWith,
  planOperationRequires,
  validatePlan
} from '../../../noodl-editor/src/editor/src/models/AiAssistant/authoring/plan';
import type { Diagnostic, NormProject } from '../editor-deps';
import {
  assertInsideDocs,
  buildComponentRefs,
  diagnosticKey,
  isComponentRef,
  DocPathError,
  formatDiagnosticLine,
  isBlockingForAuthoredOutput,
  normalizeV2Component,
  SCHEMA_IDS,
  SchemaValidator,
  SemanticValidator
} from '../editor-deps';
import type { ConnectionV2 } from '../editor-deps';
import { catalogIndex } from '../catalog';
import { ToolError } from '../errors';
import { automaticRenderDisabled, runRenderReport } from '../render';
import type { ComponentFiles } from '../graph';
import { reconcileHierarchy } from '../graph';
import { deconflictNodeIds, remapNote } from '../project/nodeIds';
import { pathToLegacyName, toPathForm, validateComponentPath } from '../paths';
import { componentIsPage, registerPages, registrationSummary } from '../project/pageRegistration';
import type { ProjectStore } from '../project/ProjectStore';
import { authoredProjectViews, preconditionDiagnostics } from '../validate';
import type { WriteValidation } from '../validate';
import type { WriteValidationSummary } from './responses';
import type { NodeInput } from './author';
import { assembleCreateFiles, assembleSetFiles, ensureIds } from './author';
// AAQ-005: one authoring vocabulary — the same node/connection shapes
// `create_component` takes, rendered from the shared table rather than from a
// second hand-written copy.
import { connectionSchema, nodeSchema } from '../vocabulary';
import { writeProjectDocFile } from './docsTools';
import { guarded, jsonResult } from './util';

// ─── In-memory plan registry (per server process) ─────────────────────────────

interface ServerPlan {
  id: string;
  plan: AuthoringPlan;
  /** Staged candidates by operation id — memory only, never disk. */
  staged: Map<string, ComponentFiles>;
  /** Staged doc bodies by operation id — memory only, never disk. */
  stagedDocs: Map<string, string>;
}

/**
 * A staged doc operation's write, through the same containment and atomic-write
 * path as `write_project_doc`. Not a seam any more: AIX-009 shipped, and a
 * second write path would be a doc-path check spelled twice.
 */
function applyDocOperation(store: ProjectStore, op: PlanOperation, content: string): string {
  return writeProjectDocFile(store, op.target, content).path;
}

let semanticValidator: SemanticValidator | undefined;
function validator(): SemanticValidator {
  if (!semanticValidator) semanticValidator = new SemanticValidator(catalogIndex());
  return semanticValidator;
}

// ─── Validation with the plan overlay ─────────────────────────────────────────

function structuralErrors(files: ComponentFiles): string[] {
  const schemaValidator = new SchemaValidator();
  const failures: string[] = [];
  const checks: Array<[string, string, unknown]> = [
    ['component.json', SCHEMA_IDS.COMPONENT, files.component],
    ['nodes.json', SCHEMA_IDS.NODES, files.nodes],
    ['connections.json', SCHEMA_IDS.CONNECTIONS, files.connections]
  ];
  for (const [file, schemaId, data] of checks) {
    const result = schemaValidator.validate(schemaId as Parameters<SchemaValidator['validate']>[0], data);
    if (!result.valid) {
      failures.push(...result.errors.map((e) => `SCHEMA ${file} ${e.path}: ${e.message}`));
    }
  }
  return failures;
}

/**
 * The store's project with every staged candidate of the plan overlaid — what
 * an operation's candidate is validated against, so a planned sibling create
 * resolves as a component reference before anything exists on disk.
 */
function overlayProject(store: ProjectStore, plan: ServerPlan, extra?: { opId: string; files: ComponentFiles }): NormProject {
  const base = store.buildNormProject();
  const staged = new Map(plan.staged);
  if (extra) staged.set(extra.opId, extra.files);

  const stagedByName = new Map<string, ComponentFiles>();
  for (const [opId, files] of staged) {
    const operation = plan.plan.operations.find((op) => op.id === opId);
    if (!operation) continue;
    stagedByName.set(pathToLegacyName(operation.target), files);
  }

  const components = [
    ...base.components.filter((c) => !stagedByName.has(c.name)),
    ...[...stagedByName.entries()].map(([name, files]) => normalizeV2Component(name, files.nodes, files.connections))
  ];
  const refNames = new Set<string>(components.map((c) => c.name));
  for (const name of stagedByName.keys()) refNames.add(name.replace(/^\//, ''));
  return { components, componentRefs: buildComponentRefs([...refNames]) };
}

/**
 * The plan's staged candidates keyed by legacy name — what the precondition
 * checks must see as "the project", so a page staged in this plan resolves as a
 * navigation target before anything exists on disk.
 *
 * The same overlay `overlayProject` builds for the semantic validator, in the
 * shape the value-level checks need (they read parameters, which the normalized
 * model drops).
 */
function stagedOverlay(plan: ServerPlan, extra?: { opId: string; files: ComponentFiles }): Map<string, ComponentFiles> {
  const staged = new Map(plan.staged);
  if (extra) staged.set(extra.opId, extra.files);

  const byName = new Map<string, ComponentFiles>();
  for (const [opId, files] of staged) {
    const operation = plan.plan.operations.find((op) => op.id === opId);
    if (!operation) continue;
    byName.set(pathToLegacyName(operation.target), files);
  }
  return byName;
}

/**
 * LAS-002 — what one staged candidate's validation yields. `warnings` is the
 * pre-LAS-002 count, kept because it is public API; `diagnostics` is what a
 * caller can actually act on.
 */
interface StagedValidation {
  ok: boolean;
  errors: string[];
  warnings: number;
  /** Non-error diagnostics: warnings and infos, as objects. */
  diagnostics: Diagnostic[];
  summary: WriteValidation['summary'];
}

const EMPTY_SUMMARY: WriteValidation['summary'] = { errors: 0, warnings: 0, infos: 0 };

function summarize(diagnostics: readonly Diagnostic[]): WriteValidation['summary'] {
  return {
    errors: diagnostics.filter((d) => d.severity === 'error').length,
    warnings: diagnostics.filter((d) => d.severity === 'warning').length,
    infos: diagnostics.filter((d) => d.severity === 'info').length
  };
}

/**
 * The `validation` block, in the one shape every authoring door speaks — the
 * same `WriteValidationSummary` `create_component` and `update_component`
 * return, so LAS-007 can key its example attachments on `code` without caring
 * which door produced the diagnostic. Omitted entirely when there is nothing to
 * say: a door that always speaks is a door nobody reads.
 */
function validationBlock(
  diagnostics: readonly Diagnostic[],
  summary: WriteValidation['summary']
): WriteValidationSummary | Record<string, never> {
  if (diagnostics.length === 0) return {};
  return { validation: { summary, diagnostics: [...diagnostics] } };
}

/**
 * Did this operation put anything on a screen?
 *
 * The question decides whether `apply_plan` renders by default, so it errs
 * toward yes: a component that declares visual roots, holds a node the catalog
 * calls visual, or instantiates another project component (whose visual-ness
 * this cannot see from here) counts. A plan that only writes logic or cloud
 * functions renders nothing worth eight seconds.
 */
function wroteSomethingVisual(plan: ServerPlan, operation: PlanOperation): boolean {
  const files = plan.staged.get(operation.id);
  if (!files) return false;
  if (files.nodes.visualRoots && files.nodes.visualRoots.length > 0) return true;
  const catalog = catalogIndex();
  return files.nodes.nodes.some((node) => isComponentRef(node.type) || catalog.getNode(node.type)?.isVisual === true);
}

/**
 * The numeric half of a render report, or a note saying why there is none.
 *
 * A failure here is never a failure of the apply — the plan is already on disk
 * and discarded by the time this runs. So the environment problems that make
 * `render_report` throw (no viewer bundle, no Chrome) come back as a sentence
 * inside the response instead, naming the fix. Anything else is swallowed to a
 * short note for the same reason: "your write succeeded but the optional
 * screenshot tool crashed" must not read like "your write failed".
 */
async function renderSummaryFor(store: ProjectStore): Promise<Record<string, unknown>> {
  try {
    const { report } = await runRenderReport(store.projectDir, { screenshot: 'none' });
    return {
      summary: report.summary,
      findings: report.findings,
      viewports: Object.fromEntries(
        Object.entries(report.viewports).map(([name, v]) => [
          name,
          {
            layoutWidth: v.layoutWidth,
            pageHeight: v.pageHeight,
            texts: v.text.elements,
            images: v.images.total,
            brokenImages: v.images.broken,
            placeholderTexts: v.placeholders.count
          }
        ])
      ),
      note: 'Numbers only. Call render_report for the screenshots — a picture that loads is not a picture of the right thing.'
    };
  } catch (err) {
    return {
      skipped: err instanceof ToolError ? err.message : `The render did not run: ${(err as Error).message}`,
      note: 'The plan was applied. Only the render check was skipped; call render_report to retry it.'
    };
  }
}

/**
 * Validate one staged candidate against the overlay. Same policy as the
 * write-gate — which since AAQ-005 means the *shared* policy: structural first,
 * semantic strict, then the four precondition checks, gated on errors plus the
 * three warnings that block authored output. For updates, only diagnostics this
 * change introduced reject, so a component that already carried strict-mode
 * errors or a pre-existing dead navigation stays editable.
 *
 * ⚠️ This function was the third implementation of that policy, after the editor
 * and `src/validate.ts`, each with its own copy of `diagnosticKey` — the exact
 * three-twins shape BCN-003 taught us to look for, inside the task written to
 * prevent it. It now composes the same pieces the other two do.
 *
 * LAS-002: it also returns the surviving diagnostics as OBJECTS. It used to
 * return `warnings` as a count, and that count was the whole of what
 * `stage_plan_operation` could say — so `repeated-sibling-subtree`, the only
 * architecture gate in the system, reached three separate measured builds as
 * the integer `1`, at the one moment the agent could still have acted on it.
 * The count stays for anything already parsing it; the objects are the point.
 */
function validateStaged(
  store: ProjectStore,
  plan: ServerPlan,
  operation: PlanOperation,
  candidate: ComponentFiles,
  options: { allowUnknownTypes?: boolean }
): StagedValidation {
  const structural = structuralErrors(candidate);
  if (structural.length > 0) {
    // A schema failure means the semantic pass never ran, so there is nothing
    // non-blocking to report — not "no warnings", but "not asked yet".
    return { ok: false, errors: structural, warnings: 0, diagnostics: [], summary: EMPTY_SUMMARY };
  }

  const legacyName = pathToLegacyName(operation.target);
  const project = overlayProject(store, plan, { opId: operation.id, files: candidate });
  const validatorOptions = { strict: !options.allowUnknownTypes };
  const report = validator().validateComponent(project, legacyName, validatorOptions);

  const views = authoredProjectViews(store, stagedOverlay(plan, { opId: operation.id, files: candidate }));
  const diagnostics = [...report.diagnostics, ...preconditionDiagnostics(legacyName, candidate, views)];
  let errors = diagnostics.filter(isBlockingForAuthoredOutput);

  if (operation.kind === 'update' && errors.length > 0) {
    const stored = store.readComponent(operation.target);
    const baseline = stored.files;
    const baselineReport = validator().validateComponent(
      store.buildNormProject({ replace: { key: stored.key, files: baseline } }),
      legacyName,
      validatorOptions
    );
    const baselineViews = authoredProjectViews(store, stagedOverlay(plan, { opId: operation.id, files: baseline }));
    const baselineDiagnostics = [
      ...baselineReport.diagnostics,
      ...preconditionDiagnostics(legacyName, baseline, baselineViews)
    ];
    const preexisting = new Set(baselineDiagnostics.filter(isBlockingForAuthoredOutput).map(diagnosticKey));
    errors = errors.filter((d) => !preexisting.has(diagnosticKey(d)));
  }

  return {
    ok: errors.length === 0,
    errors: errors.map(formatDiagnosticLine),
    warnings: diagnostics.filter((d) => d.severity === 'warning').length,
    // Exactly `successPayload`'s filter in author.ts — the two doors decide
    // "what survives a successful write" the same way or they are two dialects.
    diagnostics: diagnostics.filter((d) => d.severity !== 'error'),
    summary: summarize(diagnostics)
  };
}

// ─── Staging bookkeeping ──────────────────────────────────────────────────────

/** True when this operation has its content in memory, whatever kind it is. */
function isStaged(plan: ServerPlan, op: PlanOperation): boolean {
  return op.kind === 'doc' ? plan.stagedDocs.has(op.id) : plan.staged.has(op.id);
}

function unstagedIds(plan: ServerPlan): string[] {
  return plan.plan.operations.filter((op) => !isStaged(plan, op)).map((op) => op.id);
}

function stagingProgress(plan: ServerPlan): string {
  const total = plan.plan.operations.length;
  const staged = total - unstagedIds(plan).length;
  return `${staged} of ${total} operations staged`;
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerPlanTools(server: McpServer, store: ProjectStore): void {
  const plans = new Map<string, ServerPlan>();

  const mustGetPlan = (planId: string): ServerPlan => {
    const plan = plans.get(planId);
    if (!plan) {
      throw new ToolError('not-found', `No plan "${planId}". Plans live in this server process; create one with create_plan.`);
    }
    return plan;
  };

  server.registerTool(
    'create_plan',
    {
      title: 'Create plan',
      description:
        'Declare a multi-component change as an ordered plan of operations (create/update a component, or ' +
        'update a project doc), each with an intent and NO graph content yet. Nothing is written. Stage each ' +
        'operation\'s graph with stage_plan_operation, then apply_plan writes the complete set at once — the ' +
        'staged all-or-nothing alternative to a sequence of individually committed create_component calls. ' +
        'Plans are validated here: creates must be new, updates must exist, one operation per component.',
      inputSchema: {
        request: z.string().describe('The overall request this plan implements, verbatim'),
        scroll: z
          .enum(['page', 'app'])
          .optional()
          .describe(
            'How the app this plan builds scrolls, for a plan that builds one. "page": the browser scrolls, as ' +
              'on any web page — marketing sites, listings, docs. "app": a fixed shell whose regions scroll ' +
              'individually — dashboards, chat. Applied as the `bodyScroll` project setting, and ONLY when the ' +
              'project has not already set it. ⚠️ The default is unset, which is falsy, which means "app": a ' +
              'plan that builds a scrolling page and does not say so produces one clipped at the viewport with ' +
              'no scrollbar, deployed as well as in preview.'
          ),
        operations: z
          .array(
            z.object({
              // `provision` is accepted so the vocabulary is one across both
              // clients, and refused below with a reason — see the refusal.
              kind: z.enum(['create', 'update', 'doc', 'provision']),
              target: z.string().describe('Component path ("Pages/Checkout"); for doc, a doc path'),
              intent: z.string().describe('One or two sentences: what this operation accomplishes')
            })
          )
          .min(1)
      }
    },
    guarded((args: {
      request: string;
      scroll?: 'page' | 'app';
      operations: Array<{ kind: 'create' | 'update' | 'doc' | 'provision'; target: string; intent: string }>;
    }) => {
      // AAQ-005 — one vocabulary, an honest capability. The editor's plan model
      // has carried `provision` since AIB-007 and this package imports that very
      // module, so silently rejecting the kind at the schema edge told an agent
      // its plan was malformed.
      //
      // AAQ-011/F13 — the capability now exists (`provision_backend`), and the
      // refusal stays anyway, with a different reason. A provision is the one
      // operation that spawns a process and creates a database; `apply_plan`'s
      // contract is that nothing touches disk until one call and that discarding
      // leaves the project byte-identical, and neither is true of a running
      // backend. The editor reaches the same conclusion from the other side:
      // `provisionBackend.ts` puts ONLY the binding in the undo group, because
      // deleting a database on Cmd+Z destroys durable output nobody asked to
      // destroy. So the irreversible step is its own call.
      const provisionOps = args.operations.filter((op) => op.kind === 'provision');
      if (provisionOps.length > 0) {
        throw new ToolError(
          'invalid-argument',
          'A backend is provisioned by its own tool, not inside a plan: call provision_backend first (it ' +
            'creates, starts and binds the backend, and takes the collections you would have put here), then ' +
            'create_plan for the components that use it. A plan is all-or-nothing and discardable; starting a ' +
            'process and creating a database is neither, so it does not belong inside one. Nothing was created.',
          { unsupportedOperations: provisionOps.map((op) => op.target), use: 'provision_backend' }
        );
      }
      const operations: PlanOperation[] = args.operations.map((op, index) => ({
        id: `op-${index + 1}`,
        kind: op.kind,
        // Component targets are normalised to path form ("Pages/Home") so both
        // accepted identifier forms behave identically downstream.
        target: op.kind === 'doc' ? op.target.trim() : toPathForm(op.target.trim()),
        intent: op.intent.trim()
      }));
      const existing = new Set<string>();
      for (const [key, entry] of Object.entries(store.readRegistry().components)) {
        existing.add(pathToLegacyName(key));
        existing.add(pathToLegacyName(entry.path));
      }
      const plan: AuthoringPlan = {
        request: args.request,
        operations,
        ...(args.scroll ? { scroll: args.scroll } : {})
      };
      const errors = validatePlan(plan, { existingComponents: existing });
      for (const op of operations) {
        if (op.kind === 'create') {
          const pathError = validateComponentPath(op.target);
          if (pathError) errors.push(`Operation ${op.id}: ${pathError}`);
        }
        if (op.kind === 'doc') {
          // Checked here rather than at apply: a plan whose doc target escapes
          // docs/ is unexecutable, and finding that out after staging five
          // components is the failure the plan step exists to prevent.
          try {
            assertInsideDocs(op.target);
          } catch (error) {
            errors.push(
              `Operation ${op.id}: ${error instanceof DocPathError ? error.message : String(error)}`
            );
          }
        }
      }
      if (errors.length > 0) {
        throw new ToolError('invalid-argument', 'The plan is not executable — nothing was created.', { errors });
      }

      const ordered = orderPlanOperations(operations);
      const id = crypto.randomUUID();
      plans.set(id, {
        id,
        plan: { ...plan, operations: ordered },
        staged: new Map(),
        stagedDocs: new Map()
      });
      return jsonResult({
        planId: id,
        operations: ordered,
        ...(args.scroll ? { scroll: args.scroll } : {}),
        note:
          'Nothing is written yet. Stage every operation with stage_plan_operation (in the order given — ' +
          'creates first, so updates can instantiate them; docs last, so you write them knowing what the ' +
          'components ended up being), then apply_plan.'
      });
    })
  );

  server.registerTool(
    'stage_plan_operation',
    {
      title: 'Stage plan operation',
      description:
        'Attach one plan operation\'s content: the full graph for a create/update, or the whole file for a ' +
        'doc. Component candidates are validated immediately against the project PLUS the plan\'s other ' +
        'staged operations (so you may instantiate a component a sibling create provides). Staged in memory ' +
        'only — nothing on disk until apply_plan. Restage to replace.',
      inputSchema: {
        plan_id: z.string(),
        operation_id: z.string().describe('The operation id from create_plan (e.g. "op-2")'),
        nodes: z.array(nodeSchema).min(1).optional().describe('Component operations only'),
        connections: z.array(connectionSchema).optional(),
        visual_roots: z.array(z.string()).optional(),
        description: z.string().optional().describe('Summary stored on the component (creates only)'),
        content: z
          .string()
          .optional()
          .describe(
            'Doc operations only: the complete new file. Docs hold intent, decisions, rejected alternatives ' +
              'and external contracts — never a description of the graph, which the editor narrates on demand ' +
              'and which is wrong the moment a node moves.'
          ),
        allow_unknown_types: z.boolean().optional()
      }
    },
    guarded(
      (args: {
        plan_id: string;
        operation_id: string;
        nodes?: NodeInput[];
        connections?: ConnectionV2[];
        visual_roots?: string[];
        description?: string;
        content?: string;
        allow_unknown_types?: boolean;
      }) => {
        const serverPlan = mustGetPlan(args.plan_id);
        const operation = serverPlan.plan.operations.find((op) => op.id === args.operation_id);
        if (!operation) {
          throw new ToolError('not-found', `Plan ${args.plan_id} has no operation "${args.operation_id}".`, {
            operations: serverPlan.plan.operations.map((op) => op.id)
          });
        }
        if (operation.kind === 'doc') {
          if (typeof args.content !== 'string' || !args.content.trim()) {
            throw new ToolError(
              'invalid-argument',
              `Operation ${operation.id} writes ${operation.target}: stage it with "content" (the complete ` +
                'file), not with nodes.'
            );
          }
          serverPlan.stagedDocs.set(operation.id, args.content);
          return jsonResult({
            staged: operation.id,
            target: operation.target,
            bytes: Buffer.byteLength(args.content, 'utf8'),
            progress: stagingProgress(serverPlan),
            remaining: unstagedIds(serverPlan)
          });
        }
        if (!args.nodes || args.nodes.length === 0) {
          throw new ToolError(
            'invalid-argument',
            `Operation ${operation.id} is a ${operation.kind} of ${operation.target}: stage it with "nodes".`
          );
        }

        const reconciled = reconcileHierarchy(ensureIds(args.nodes));
        if (reconciled.errors.length > 0) {
          throw new ToolError('invalid-argument', 'Node hierarchy is inconsistent.', { errors: reconciled.errors });
        }

        const legacyName = pathToLegacyName(operation.target);
        let candidate: ComponentFiles;
        let baseline: ComponentFiles | undefined;
        if (operation.kind === 'create') {
          candidate = assembleCreateFiles({
            path: operation.target,
            legacyName,
            nodes: reconciled.nodes,
            connections: args.connections,
            visualRoots: args.visual_roots,
            description: args.description
          });
        } else {
          baseline = store.readComponent(operation.target).files;
          candidate = assembleSetFiles(baseline, {
            nodes: reconciled.nodes,
            connections: args.connections,
            visualRoots: args.visual_roots
          });
        }

        // AAQ-011/F12 — same allocation rule as the direct doors, and it has to
        // be here rather than at apply: the overlay of the *other* staged
        // operations is part of the project this candidate must not collide
        // with, and by apply time they are all being written together.
        const deconflicted = deconflictNodeIds(
          store,
          legacyName,
          candidate,
          baseline,
          stagedOverlay(serverPlan) // this operation's own previous staging is replaced below
        );
        candidate = deconflicted.files;

        const validation = validateStaged(store, serverPlan, operation, candidate, {
          allowUnknownTypes: args.allow_unknown_types
        });
        if (!validation.ok) {
          throw new ToolError(
            'validation-failed',
            `stage_plan_operation "${operation.target}" rejected — nothing was staged.`,
            { readable: validation.errors }
          );
        }

        serverPlan.staged.set(operation.id, candidate);
        return jsonResult({
          staged: operation.id,
          target: operation.target,
          warnings: validation.warnings,
          // LAS-002 — the words, not the integer. This is the moment the agent
          // can still act: the candidate is in memory and nothing is on disk.
          ...validationBlock(validation.diagnostics, validation.summary),
          ...(deconflicted.remapped.length > 0
            ? { remappedNodeIds: deconflicted.remapped, remapNote: remapNote(deconflicted.remapped) }
            : {}),
          progress: stagingProgress(serverPlan),
          remaining: unstagedIds(serverPlan)
        });
      }
    )
  );

  server.registerTool(
    'apply_plan',
    {
      title: 'Apply plan',
      description:
        'Write every staged operation of the plan to disk — components first, then the docs that record ' +
        'them — after re-validating the complete set together. The all-or-nothing commit. Refuses (writing ' +
        'nothing) when any unskipped operation is unstaged or invalid, or when `skip` breaks a dependency ' +
        '(an operation whose graph instantiates a skipped create must be skipped too — the refusal lists ' +
        'them). Skipping is the explicit partial-apply choice; there is no implicit one.',
      inputSchema: {
        plan_id: z.string(),
        skip: z
          .array(z.string())
          .optional()
          .describe('Operation ids deliberately left out — the explicit partial apply'),
        // LAS-005 §4. Default on for anything visual: the turn that just wrote
        // the page is the turn that can still fix it, and an agent that has to
        // decide to look is an agent that does not.
        render: z
          .enum(['summary', 'off'])
          .optional()
          .describe(
            'summary (the default when the plan wrote anything visual) renders the project and appends the ' +
              'numbers — broken images, dead placeholder texts, one-column grids. Call render_report for the ' +
              'screenshots.'
          )
      }
    },
    guarded(async (args: { plan_id: string; skip?: string[]; render?: 'summary' | 'off' }) => {
      const serverPlan = mustGetPlan(args.plan_id);
      const skip = new Set(args.skip ?? []);

      for (const id of skip) {
        if (!serverPlan.plan.operations.some((op) => op.id === id)) {
          throw new ToolError('invalid-argument', `skip names "${id}", which is not an operation of this plan.`);
        }
      }

      // Everything unskipped must be staged — doc operations included, now
      // that they carry a body.
      const componentOps = serverPlan.plan.operations.filter((op) => op.kind !== 'doc' && !skip.has(op.id));
      const docOps = serverPlan.plan.operations.filter((op) => op.kind === 'doc' && !skip.has(op.id));
      const unstaged = [...componentOps, ...docOps].filter((op) => !isStaged(serverPlan, op));
      if (unstaged.length > 0) {
        throw new ToolError(
          'invalid-argument',
          'Not every operation is staged — stage them all first, or skip them explicitly. Nothing was written.',
          { unstaged: unstaged.map((op) => op.id) }
        );
      }
      if (componentOps.length === 0 && docOps.length === 0) {
        throw new ToolError('invalid-argument', 'Every operation is skipped — nothing to apply.');
      }

      // Skips must be dependency-closed: an applied operation may not
      // instantiate a skipped create.
      const requires = planOperationRequires(
        serverPlan.plan.operations.map((operation) => ({ operation, files: serverPlan.staged.get(operation.id) }))
      );
      const closure = planExcludedWith(requires, skip);
      const mustAlsoSkip = [...closure].filter((id) => !skip.has(id));
      if (mustAlsoSkip.length > 0) {
        throw new ToolError(
          'invalid-argument',
          'skip breaks a dependency: these operations instantiate a skipped create and must be skipped too. ' +
            'Nothing was written.',
          { mustAlsoSkip }
        );
      }

      // Re-validate the exact set being applied, together, before any write.
      const applyPlanView: ServerPlan = {
        id: serverPlan.id,
        plan: { ...serverPlan.plan, operations: serverPlan.plan.operations.filter((op) => !skip.has(op.id)) },
        staged: new Map([...serverPlan.staged].filter(([id]) => !skip.has(id))),
        stagedDocs: new Map([...serverPlan.stagedDocs].filter(([id]) => !skip.has(id)))
      };
      // LAS-002 — collected across the whole applied SET, because that is what
      // an apply writes. A caller who staged five components and reads one
      // aggregate list still needs each entry's `location.component` to know
      // which of the five it is about; the diagnostics carry it.
      const surviving: Diagnostic[] = [];
      for (const op of componentOps) {
        const files = serverPlan.staged.get(op.id);
        if (!files) continue;
        const validation = validateStaged(store, applyPlanView, op, files, {});
        if (!validation.ok) {
          throw new ToolError(
            'validation-failed',
            `Operation ${op.id} ("${op.target}") no longer validates — the project changed since staging. ` +
              'Nothing was written.',
            { readable: validation.errors }
          );
        }
        surviving.push(...validation.diagnostics);
      }

      // Commit: components first, then the docs that record them. Validation
      // was all-or-nothing above; the writes themselves are sequential file
      // operations. Docs last here (and first in the editor, which has an undo
      // group to roll back and therefore optimises for the opposite failure) —
      // a doc that names a component the component write then failed on would
      // be the more misleading leftover of the two.
      const applied: Array<{ operation: string; target: string; revision: string }> = [];
      for (const op of componentOps) {
        const files = serverPlan.staged.get(op.id);
        if (!files) continue;
        const key = op.kind === 'create' ? op.target : store.readComponent(op.target).key;
        const { revision } = store.writeComponent(key, files, {
          expectNew: op.kind === 'create'
        });
        applied.push({ operation: op.id, target: op.target, revision });
      }
      // AAQ-005 — register the pages this plan put into the project, in plan
      // order, after the components are in. Same rule and same shared decision
      // as the editor's apply: creates and updates both count (a page that
      // exists but was never listed is the state the task is about), the first
      // page is the one that becomes home when home is up for grabs, and plan
      // order is the order the caller declared.
      const pages: string[] = [];
      for (const op of componentOps) {
        const files = serverPlan.staged.get(op.id);
        if (!files) continue;
        const legacyName = pathToLegacyName(op.target);
        if (componentIsPage(legacyName, files)) pages.push(legacyName);
      }
      const registration = registerPages(store, pages);

      // AAQ-003, in the same place and for the same reason the editor applies it
      // beside registration: a page that cannot scroll is as unreachable as a
      // page nobody routed. Only when the plan said so, and only when the
      // project has not already decided.
      const settingsWritten =
        serverPlan.plan.scroll !== undefined
          ? store.writeProjectSettings({ bodyScroll: serverPlan.plan.scroll === 'page' })
          : [];

      const docsWritten: Array<{ operation: string; path: string }> = [];
      for (const op of docOps) {
        const content = serverPlan.stagedDocs.get(op.id);
        if (content === undefined) continue;
        docsWritten.push({ operation: op.id, path: applyDocOperation(store, op, content) });
      }

      plans.delete(serverPlan.id);

      // LAS-005 §4 — the loop closed where it costs nothing to close it. The
      // agent that just applied a plan is told, in the same turn, that its grid
      // is one column and five images are broken; without this it has to decide
      // to go and look, and the audit measured that a mid-tier model never does.
      // Screenshots are deliberately NOT here: they belong to `render_report`,
      // which the caller reaches for when the numbers say something is wrong.
      const wantsRender =
        args.render !== 'off' &&
        !automaticRenderDisabled() &&
        componentOps.some((op) => wroteSomethingVisual(serverPlan, op));
      const render = wantsRender ? await renderSummaryFor(store) : undefined;

      return jsonResult({
        applied,
        docs: docsWritten,
        skipped: [...skip],
        ...registrationSummary(registration),
        ...(settingsWritten.length > 0 ? { settings: settingsWritten } : {}),
        ...validationBlock(surviving, summarize(surviving)),
        ...(render ? { render } : {}),
        note: 'Plan applied and discarded. Re-read components with get_component for fresh revisions.'
      });
    })
  );

  server.registerTool(
    'discard_plan',
    {
      title: 'Discard plan',
      description: 'Drop a plan and everything staged on it. Nothing was ever written — discard leaves no trace.',
      inputSchema: { plan_id: z.string() }
    },
    guarded((args: { plan_id: string }) => {
      const serverPlan = mustGetPlan(args.plan_id);
      plans.delete(serverPlan.id);
      return jsonResult({
        discarded: serverPlan.id,
        hadStagedOperations: serverPlan.staged.size + serverPlan.stagedDocs.size
      });
    })
  );
}
