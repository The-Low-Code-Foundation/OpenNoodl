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
 * Doc operations may appear in a plan (they are first-class in the model) but
 * cannot yet be applied here: their write path is AIX-009's reviewed
 * project-docs pipeline. `apply_plan` refuses a plan containing an unskipped
 * doc operation, loudly — the AIX-009 merge wires `applyDocOperation` below.
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
  buildComponentRefs,
  formatDiagnosticLine,
  normalizeV2Component,
  SCHEMA_IDS,
  SchemaValidator,
  SemanticValidator
} from '../editor-deps';
import type { ConnectionV2 } from '../editor-deps';
import { catalogIndex } from '../catalog';
import { ToolError } from '../errors';
import type { ComponentFiles } from '../graph';
import { reconcileHierarchy } from '../graph';
import { pathToLegacyName, toPathForm, validateComponentPath } from '../paths';
import type { ProjectStore } from '../project/ProjectStore';
import type { NodeInput } from './author';
import { assembleCreateFiles, assembleSetFiles, connectionSchema, ensureIds, nodeSchema } from './author';
import { guarded, jsonResult } from './util';

// ─── In-memory plan registry (per server process) ─────────────────────────────

interface ServerPlan {
  id: string;
  plan: AuthoringPlan;
  /** Staged candidates by operation id — memory only, never disk. */
  staged: Map<string, ComponentFiles>;
}

/**
 * ── AIX-009 MERGE SEAM (MCP side) ────────────────────────────────────────────
 * When AIX-009's docs write path exists, implement this to write a doc
 * operation through `write_project_doc`'s pipeline and flip `apply_plan`'s
 * refusal below. Until then it is deliberately undefined — a doc operation
 * can be planned but not applied, and the refusal says why.
 */
const applyDocOperation: ((store: ProjectStore, op: PlanOperation) => void) | undefined = undefined;

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

function diagnosticKey(d: Diagnostic): string {
  const l = d.location;
  return JSON.stringify([d.code, l.nodeId, l.port, l.plug, l.connection, d.message]);
}

/**
 * Validate one staged candidate against the overlay. Same policy as the
 * write-gate: structural first, semantic strict; for updates only NEW errors
 * (relative to the on-disk baseline) reject, so a component that already
 * carried strict-mode errors stays editable.
 */
function validateStaged(
  store: ProjectStore,
  plan: ServerPlan,
  operation: PlanOperation,
  candidate: ComponentFiles,
  options: { allowUnknownTypes?: boolean }
): { ok: boolean; errors: string[]; warnings: number } {
  const structural = structuralErrors(candidate);
  if (structural.length > 0) return { ok: false, errors: structural, warnings: 0 };

  const legacyName = pathToLegacyName(operation.target);
  const project = overlayProject(store, plan, { opId: operation.id, files: candidate });
  const validatorOptions = { strict: !options.allowUnknownTypes };
  const report = validator().validateComponent(project, legacyName, validatorOptions);
  let errors = report.diagnostics.filter((d) => d.severity === 'error');

  if (operation.kind === 'update' && errors.length > 0) {
    const baseline = store.readComponent(operation.target).files;
    const baselineReport = validator().validateComponent(
      store.buildNormProject({ replace: { key: store.readComponent(operation.target).key, files: baseline } }),
      legacyName,
      validatorOptions
    );
    const preexisting = new Set(
      baselineReport.diagnostics.filter((d) => d.severity === 'error').map(diagnosticKey)
    );
    errors = errors.filter((d) => !preexisting.has(diagnosticKey(d)));
  }

  return {
    ok: errors.length === 0,
    errors: errors.map(formatDiagnosticLine),
    warnings: report.summary.warnings
  };
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
        operations: z
          .array(
            z.object({
              kind: z.enum(['create', 'update', 'doc']),
              target: z.string().describe('Component path ("Pages/Checkout"); for doc, a doc path'),
              intent: z.string().describe('One or two sentences: what this operation accomplishes')
            })
          )
          .min(1)
      }
    },
    guarded((args: { request: string; operations: Array<{ kind: 'create' | 'update' | 'doc'; target: string; intent: string }> }) => {
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
      const plan: AuthoringPlan = { request: args.request, operations };
      const errors = validatePlan(plan, { existingComponents: existing });
      for (const op of operations) {
        if (op.kind === 'create') {
          const pathError = validateComponentPath(op.target);
          if (pathError) errors.push(`Operation ${op.id}: ${pathError}`);
        }
      }
      if (errors.length > 0) {
        throw new ToolError('invalid-argument', 'The plan is not executable — nothing was created.', { errors });
      }

      const ordered = orderPlanOperations(operations);
      const id = crypto.randomUUID();
      plans.set(id, { id, plan: { request: args.request, operations: ordered }, staged: new Map() });
      return jsonResult({
        planId: id,
        operations: ordered,
        note:
          'Nothing is written yet. Stage each create/update with stage_plan_operation (in the order given — ' +
          'creates first, so updates can instantiate them), then apply_plan.'
      });
    })
  );

  server.registerTool(
    'stage_plan_operation',
    {
      title: 'Stage plan operation',
      description:
        'Attach the full graph for one plan operation. Validated immediately against the project PLUS the ' +
        'plan\'s other staged operations (so you may instantiate a component a sibling create provides). ' +
        'Staged in memory only — nothing on disk until apply_plan. Restage to replace.',
      inputSchema: {
        plan_id: z.string(),
        operation_id: z.string().describe('The operation id from create_plan (e.g. "op-2")'),
        nodes: z.array(nodeSchema).min(1),
        connections: z.array(connectionSchema).optional(),
        visual_roots: z.array(z.string()).optional(),
        description: z.string().optional().describe('Summary stored on the component (creates only)'),
        allow_unknown_types: z.boolean().optional()
      }
    },
    guarded(
      (args: {
        plan_id: string;
        operation_id: string;
        nodes: NodeInput[];
        connections?: ConnectionV2[];
        visual_roots?: string[];
        description?: string;
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
          throw new ToolError(
            'invalid-argument',
            'Doc operations carry no graph. They are written through the project-docs path at apply time ' +
              '(not yet available — see apply_plan).'
          );
        }

        const reconciled = reconcileHierarchy(ensureIds(args.nodes));
        if (reconciled.errors.length > 0) {
          throw new ToolError('invalid-argument', 'Node hierarchy is inconsistent.', { errors: reconciled.errors });
        }

        let candidate: ComponentFiles;
        if (operation.kind === 'create') {
          candidate = assembleCreateFiles({
            path: operation.target,
            legacyName: pathToLegacyName(operation.target),
            nodes: reconciled.nodes,
            connections: args.connections,
            visualRoots: args.visual_roots,
            description: args.description
          });
        } else {
          const baseline = store.readComponent(operation.target).files;
          candidate = assembleSetFiles(baseline, {
            nodes: reconciled.nodes,
            connections: args.connections,
            visualRoots: args.visual_roots
          });
        }

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
        const componentOps = serverPlan.plan.operations.filter((op) => op.kind !== 'doc');
        return jsonResult({
          staged: operation.id,
          target: operation.target,
          warnings: validation.warnings,
          progress: `${serverPlan.staged.size} of ${componentOps.length} component operations staged`,
          remaining: componentOps.filter((op) => !serverPlan.staged.has(op.id)).map((op) => op.id)
        });
      }
    )
  );

  server.registerTool(
    'apply_plan',
    {
      title: 'Apply plan',
      description:
        'Write every staged operation of the plan to disk, in plan order, after re-validating the complete ' +
        'set together — the all-or-nothing commit. Refuses (writing nothing) when any unskipped component ' +
        'operation is unstaged or invalid, when a doc operation is not explicitly skipped (their write path ' +
        'is not available yet), or when `skip` breaks a dependency (an operation whose graph instantiates a ' +
        'skipped create must be skipped too — the refusal lists them). Skipping is the explicit partial-apply ' +
        'choice; there is no implicit one.',
      inputSchema: {
        plan_id: z.string(),
        skip: z
          .array(z.string())
          .optional()
          .describe('Operation ids deliberately left out — the explicit partial apply')
      }
    },
    guarded((args: { plan_id: string; skip?: string[] }) => {
      const serverPlan = mustGetPlan(args.plan_id);
      const skip = new Set(args.skip ?? []);

      for (const id of skip) {
        if (!serverPlan.plan.operations.some((op) => op.id === id)) {
          throw new ToolError('invalid-argument', `skip names "${id}", which is not an operation of this plan.`);
        }
      }

      // Doc operations: plannable, not yet appliable — the AIX-009 seam.
      if (!applyDocOperation) {
        const docs = serverPlan.plan.operations.filter((op) => op.kind === 'doc' && !skip.has(op.id));
        if (docs.length > 0) {
          throw new ToolError(
            'invalid-argument',
            `This plan contains doc operation(s) [${docs.map((d) => d.id).join(', ')}] but the project-docs ` +
              'write path (AIX-009) is not available in this build. Pass their ids in `skip` to apply the ' +
              'component operations without them. Nothing was written.'
          );
        }
      }

      // Everything unskipped must be staged.
      const componentOps = serverPlan.plan.operations.filter((op) => op.kind !== 'doc' && !skip.has(op.id));
      const unstaged = componentOps.filter((op) => !serverPlan.staged.has(op.id));
      if (unstaged.length > 0) {
        throw new ToolError(
          'invalid-argument',
          'Not every operation is staged — stage them all first, or skip them explicitly. Nothing was written.',
          { unstaged: unstaged.map((op) => op.id) }
        );
      }
      if (componentOps.length === 0) {
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
        staged: new Map([...serverPlan.staged].filter(([id]) => !skip.has(id)))
      };
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
      }

      // Commit: writes in plan order. Validation was all-or-nothing above;
      // the writes themselves are sequential file operations.
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

      plans.delete(serverPlan.id);
      return jsonResult({
        applied,
        skipped: [...skip],
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
      return jsonResult({ discarded: serverPlan.id, hadStagedOperations: serverPlan.staged.size });
    })
  );
}
