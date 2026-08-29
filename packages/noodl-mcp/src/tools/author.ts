/**
 * Authoring tools: create_component, update_component, delete_component.
 * Registered only when the server runs with --allow-writes.
 *
 * Write policy (docs/DESIGN.md): structural + semantic validation runs before
 * anything touches disk; new errors reject the write with full diagnostics;
 * warnings are written and reported. Optimistic concurrency via `if_revision`
 * plus on-disk drift detection.
 */

import * as crypto from 'crypto';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import type { ComponentV2File, ConnectionsV2File, ConnectionV2, NodesV2File, NodeV2 } from '../editor-deps';
import {
  foldNodeComment,
  formatDiagnosticLine,
  inferComponentType,
  layoutAuthoredNodes,
  positionsUnchangedFrom
} from '../editor-deps';
import { ToolError } from '../errors';
import type { ComponentFiles, UpdateOperation } from '../graph';
import { applyOperations, reconcileHierarchy } from '../graph';
import { pathToLegacyName, toPathForm, validateComponentPath } from '../paths';
import { withAuthoredScriptPorts } from '../scriptPorts';
import { componentIsPage, registerPages, registrationSummary } from '../project/pageRegistration';
import type { NodeIdRemap } from '../project/nodeIds';
import { deconflictNodeIds, remapNote } from '../project/nodeIds';
import type { ProjectBinding } from '../project/ProjectBinding';
import type { ProjectStore } from '../project/ProjectStore';
import type { ExampleBudget } from './attachments';
import { examplesBlock } from './attachments';
import type { ToolDisclosure } from './disclosure';
import { backendRevealPayload } from './disclosure';
import type { PlanRegistry } from './planTools';
import type { WriteValidation } from '../validate';
import { validateCandidate, validateDeletion } from '../validate';
import { CREATE_COMPONENT_SHAPE, NODE_COMMENT_ARG, connectionSchema, nodeSchema, portSchema } from '../vocabulary';
import type { VisualTypePredicate } from '../visualRoots';
import { catalogVisualPredicate, makeProjectVisualPredicate, resolveVisualRoots } from '../visualRoots';
import type {
  CreateComponentResponse,
  DeletionRefusalDetails,
  ValidationFailureDetails,
  DeleteComponentResponse,
  NodeIdRemapSummary,
  UpdateComponentResponse,
  WriteValidationSummary
} from './responses';
import { guarded, jsonResult } from './util';

// ─── Zod shapes ───────────────────────────────────────────────────────────────
// AAQ-005: the node/port/connection shapes are no longer written here. They are
// rendered from the one authoring vocabulary in `../vocabulary` — the same table
// the editor's `submit_component` renders as JSON Schema — because the two
// hand-written copies had drifted: this one accepted `children` and `variant`
// that the editor did not, and never declared `plug` on an instance port at all.
// A staged plan operation carries the same payload as create_component /
// update_component: one vocabulary, whichever door it arrives through.

const operationSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add_node'), node: nodeSchema, index: z.number().optional().describe('Insertion index among the parent\'s children') }),
  z.object({
    op: z.literal('update_node'),
    id: z.string(),
    set: z
      .object({
        label: z.string().optional(),
        // LEG-001. The delta door needs it too: adding one sentence to one node
        // of a 60-node page is exactly the change nobody will resend a whole
        // graph for, and a field zod does not name is a field zod **strips** —
        // silently, which is how `update_node.set.children` lost a hero in P58.
        // Same words as the vocabulary row, from the vocabulary row.
        comment: NODE_COMMENT_ARG,
        x: z.number().optional(),
        y: z.number().optional(),
        variant: z.string().optional(),
        parent: z.string().nullable().optional().describe('Reparent; null detaches from the visual tree')
      })
      // AWP-002 A19 — strict, so an unnamed key is a refusal and not a silent
      // strip. The comment above says a field zod does not name is a field zod
      // strips; what it did not say is that the strip is *reported as applied*.
      // `set: {children: [...]}` returned `applied: ["update_node band"]` with
      // 0 errors and 0 warnings and changed nothing, which is how P58's re-replay
      // lost its hero with every instrument green.
      //
      // Deliberately a refusal rather than an implementation: `children` is
      // reconciled from `parent` by design (`AUTHORED_NODE_FIELDS` — double
      // bookkeeping is the consistency an LLM gets wrong), so making this door
      // accept it would re-introduce the disagreement the vocabulary removed.
      // An agent that reaches for it gets told the supported spelling instead of
      // being told it worked.
      .strict()
      .optional(),
    parameters: z.record(z.unknown()).optional().describe('Shallow-merged into existing parameters'),
    unset_parameters: z.array(z.string()).optional(),
    ports: z.array(portSchema).optional()
  }),
  z.object({ op: z.literal('remove_node'), id: z.string().describe('Removes the node, its subtree and attached connections') }),
  z.object({ op: z.literal('add_connection'), connection: connectionSchema }),
  z.object({ op: z.literal('remove_connection'), connection: connectionSchema }),
  z.object({ op: z.literal('set_visual_roots'), visualRoots: z.array(z.string()) }),
  z.object({
    op: z.literal('set_ports'),
    inputs: z.array(portSchema).optional(),
    outputs: z.array(portSchema).optional()
  }),
  z.object({
    op: z.literal('set_component_info'),
    description: z.string().optional(),
    displayName: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional()
  })
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** What agents may send: a NodeV2 whose id we generate when omitted. */
export type NodeInput = Omit<NodeV2, 'id'> & { id?: string };
type OperationInput =
  | Exclude<UpdateOperation, { op: 'add_node' }>
  | { op: 'add_node'; node: NodeInput; index?: number };

export function ensureIds(nodes: NodeInput[]): NodeV2[] {
  return nodes.map((n) => ({ ...n, id: n.id ?? crypto.randomUUID() }) as NodeV2);
}

/**
 * LEG-001 — the two things every authored node needs before it is a stored node:
 * an id, and its flat `comment` folded into `metadata.comment`.
 *
 * One funnel, because the mapping must not be door-dependent: `create_component`,
 * `update_component`'s `set` branch and a staged plan operation all arrive here,
 * and a node whose comment reached disk through one door but sat as a dead
 * top-level key through another would be worse than not offering the field.
 * `add_node` is folded in `normalizeOperations` and `update_node.set` in
 * `graph.ts`, which are the two paths that do not carry a whole node list.
 */
export function normalizeAuthoredNodes(nodes: NodeInput[]): NodeV2[] {
  return ensureIds(nodes).map((n) => foldNodeComment(n));
}

/**
 * AWP-001 — the visual predicate with the project in hand.
 *
 * A node's type is either a catalog type or the legacyName of a component in
 * this project. An instance draws exactly when the component it points at has
 * visual roots of its own, so a page whose top-level node is `/Components/NavBar`
 * needs the project to answer at all — the catalog has never heard of it.
 */
export function projectVisualPredicate(store: ProjectStore): VisualTypePredicate {
  return makeProjectVisualPredicate((legacyName) => {
    if (!store.resolve(legacyName)) return undefined;
    return store.readComponent(legacyName).files.nodes.nodes ?? [];
  });
}

/**
 * AWP-001 §2 — what the write actually decided about rendering, for the result.
 *
 * `derived` distinguishes "we computed this" from "you asked for this", which is
 * the difference between teaching the model the concept and merely echoing it.
 */
function visualRootsPayload(candidate: ComponentFiles, explicit: string[] | undefined) {
  const visualRoots = candidate.nodes.visualRoots;
  if (!visualRoots?.length) return {};
  return { visualRoots, ...(explicit === undefined ? { visualRootsDerived: true } : {}) };
}

/**
 * Assemble the three v2 files for a brand-new component — the exact shape
 * `create_component` writes. Shared with the plan tools (AIX-011) so a staged
 * plan create and a direct create can never drift. Hierarchy must already be
 * reconciled.
 */
export function assembleCreateFiles(args: {
  path: string;
  legacyName: string;
  type?: 'page' | 'visual' | 'logic' | 'cloud';
  nodes: NodeV2[];
  connections?: ConnectionV2[];
  visualRoots?: string[];
  description?: string;
  modifiedBy?: string;
  /** AWP-001 — how to tell a drawing node from a logic one. Defaults to the
   * catalog alone, which answers `false` for a component instance; pass
   * `projectVisualPredicate(store)` to resolve those too. */
  isVisualType?: VisualTypePredicate;
}): ComponentFiles {
  const now = new Date().toISOString();
  const componentId = crypto.randomUUID();
  const component: ComponentV2File = {
    $schema: 'https://opennoodl.dev/schemas/component-v2.json',
    id: componentId,
    name: args.path.split('/').pop() ?? args.path,
    path: args.legacyName,
    type: args.type ?? inferComponentType(args.legacyName),
    created: now,
    modified: now,
    modifiedBy: args.modifiedBy ?? 'noodl-mcp',
    ...(args.description ? { description: args.description } : {})
  };
  // AWP-001/F43 — derive rather than require. This was
  // `...(args.visualRoots?.length ? { visualRoots: args.visualRoots } : {})`:
  // absent in, absent out, and a component with no `visualRoots` renders nothing
  // because the runtime draws a component instance from `componentModel.roots`.
  // The editor cannot produce such a file — it derives the field on every
  // serialize — so only an agent could, and one did.
  const isVisual = args.isVisualType ?? catalogVisualPredicate;
  const resolved = resolveVisualRoots(args.nodes, args.visualRoots, isVisual);
  // FIX-014 — fill the position gaps the model left and separate exact
  // collisions. Everything here is model-emitted this turn, so nothing is
  // locked; a node the model positioned is still never moved.
  const laidOut = layoutAuthoredNodes(args.nodes, isVisual, { connections: args.connections ?? [] });
  const nodes: NodesV2File = {
    $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
    componentId,
    version: 1,
    // DEF-011 — persist the ports each Function node's script declares, so the
    // graph on disk can run where no editor derives them (deployed backend,
    // headless render). Author-sent ports win by (plug, name).
    nodes: withAuthoredScriptPorts(laidOut),
    ...(resolved.visualRoots ? { visualRoots: resolved.visualRoots } : {})
  };
  const connections: ConnectionsV2File = {
    $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
    componentId,
    version: 1,
    connections: args.connections ?? []
  };
  return { component, nodes, connections };
}

/**
 * Assemble an update candidate from a full graph replacement over a baseline —
 * the exact shape `update_component`'s `set` branch writes. Shared with the
 * plan tools (AIX-011). Hierarchy must already be reconciled.
 */
export function assembleSetFiles(
  baseline: ComponentFiles,
  set: { nodes: NodeV2[]; connections?: ConnectionV2[]; visualRoots?: string[] },
  isVisualType: VisualTypePredicate = catalogVisualPredicate
): ComponentFiles {
  const candidate: ComponentFiles = JSON.parse(JSON.stringify(baseline));
  // FIX-014 — the gap-fill-and-collide-only pass, with the ruling's second
  // half made mechanical: a position resubmitted exactly as the baseline had
  // it is a hand arrangement carried through, locked against even the
  // collision nudge, so `update_component` on a hand-arranged component
  // repositions nothing unless the caller changed a coordinate itself.
  candidate.nodes.nodes = withAuthoredScriptPorts(
    layoutAuthoredNodes(set.nodes, isVisualType, {
      connections: set.connections ?? baseline.connections.connections ?? [],
      lockedIds: positionsUnchangedFrom(set.nodes, baseline.nodes.nodes ?? [])
    })
  );
  // AWP-001 — always recompute unless the caller said otherwise. Leaving the
  // baseline's list in place was the second half of F43: `set` replaces the whole
  // graph, so the inherited ids can name nodes that no longer exist. Re-deriving
  // is also what the editor does — `getVisualRootIds()` runs on every save — so a
  // deliberate subset never survived an editor save either.
  const resolved = resolveVisualRoots(set.nodes, set.visualRoots, isVisualType);
  if (resolved.visualRoots) candidate.nodes.visualRoots = resolved.visualRoots;
  else delete candidate.nodes.visualRoots;
  if (set.connections !== undefined) {
    candidate.connections.connections = carryConnectionPresentation(
      baseline.connections.connections ?? [],
      set.connections
    );
  }
  candidate.component.modified = new Date().toISOString();
  candidate.component.modifiedBy = 'noodl-mcp';
  backfillIds(candidate);
  return candidate;
}

/**
 * Fields a connection has on disk that the authoring vocabulary deliberately
 * does not offer — carried over from the baseline instead of being stripped.
 *
 * 🔴 **SIG-007 R3.** `connectionSchema` is a plain `z.object` over exactly four
 * fields, and zod's default is *strip*, not reject. So an external agent doing
 * read-modify-write — read the component, change one parameter, hand the graph
 * back — returned it with every wire label and every hand-drawn route silently
 * gone, and nothing anywhere errored. Same shape as `update_node.set.children`
 * (P58), one object over.
 *
 * ⚠️ **The four-field rule is kept, not widened.** `vocabulary.ts` argues it and
 * `vocabularyParity.test.ts` pins it, and both are still right: an agent has no
 * business *authoring* where a wire bends, and describing an anchor array in
 * every tool schema is paid on every call by a surface already measured at 27k
 * tokens a turn. This is the other half of the answer the same file names for
 * nodes — *"the editor solves the same problem the other way, by carrying those
 * fields over from the base node; see `CARRIED_NODE_FIELDS`"*. Now connections
 * do too.
 *
 * Matched on the four endpoints, which is the connection's identity everywhere
 * else in this file. A wire the caller re-pointed is a different wire and
 * correctly inherits nothing.
 */
const CARRIED_CONNECTION_FIELDS = ['label', 'labelT', 'route'] as const;

export function carryConnectionPresentation(
  baseline: readonly ConnectionV2[],
  incoming: readonly ConnectionV2[]
): ConnectionV2[] {
  if (!baseline.length) return incoming as ConnectionV2[];

  const previous = new Map<string, ConnectionV2>();
  for (const c of baseline) previous.set(`${c.fromId} ${c.fromProperty} ${c.toId} ${c.toProperty}`, c);

  return incoming.map((c) => {
    const was = previous.get(`${c.fromId} ${c.fromProperty} ${c.toId} ${c.toProperty}`);
    if (!was) return c;

    let out = c;
    for (const field of CARRIED_CONNECTION_FIELDS) {
      // Only when the caller said nothing. An agent that *did* send a label is
      // setting it, and one that sent `null` is not saying nothing either — but
      // zod has already stripped anything it does not know, so "absent" here
      // genuinely means the schema dropped it or the caller omitted it, and both
      // want the baseline's value back.
      if (out[field] === undefined && was[field] !== undefined) {
        out = { ...out, [field]: was[field] };
      }
    }
    return out;
  });
}

function normalizeOperations(operations: OperationInput[]): UpdateOperation[] {
  return operations.map((op) => {
    if (op.op !== 'add_node') return op;
    // LEG-001 — the same fold `normalizeAuthoredNodes` does for a whole graph.
    // `add_node` carries one node through a different door; a comment written
    // here has to land in the same place.
    const node = foldNodeComment(op.node.id ? op.node : { ...op.node, id: crypto.randomUUID() });
    return { ...op, node };
  }) as UpdateOperation[];
}

/**
 * Legacy projects may carry id-less components; the v2 exporter then emits
 * component.json without `id` and nodes/connections without `componentId`,
 * which fails the structural schema. Backfill missing ids on write so such
 * components are editable (Gate G1 finding) — the caller's payload is never
 * at fault here.
 */
function backfillIds(files: ComponentFiles): void {
  if (!files.component.id) files.component.id = crypto.randomUUID();
  if (!files.nodes.componentId) files.nodes.componentId = files.component.id;
  if (!files.connections.componentId) files.connections.componentId = files.component.id;
}

function rejectWith(validation: WriteValidation, intent: string, budget: ExampleBudget): never {
  const lines = [
    ...validation.newErrors.map(formatDiagnosticLine),
    ...(validation.structural ?? []).flatMap((f) => f.errors.map((e) => `SCHEMA ${f.file} ${e.path}: ${e.message}`))
  ];
  const details: ValidationFailureDetails = {
    readable: lines,
    structural: validation.structural,
    newErrors: validation.newErrors,
    allDiagnostics: validation.diagnostics,
    // LAS-007 — the recipe, in the rejection. Keyed on the errors that caused
    // the refusal, not on every diagnostic in the candidate: the attachment
    // answers "what do I do about this", and a warning nobody was refused for
    // is not that question.
    ...examplesBlock(budget.attach(validation.newErrors))
  };
  throw new ToolError('validation-failed', `${intent} rejected — nothing was written.`, { ...details });
}

/** AAQ-011/F12 — the remap block, present only when ids actually moved. */
function remapPayload(remapped: readonly NodeIdRemap[]): NodeIdRemapSummary {
  if (remapped.length === 0) return {};
  return { remappedNodeIds: [...remapped], remapNote: remapNote(remapped) };
}

function successPayload(validation: WriteValidation): WriteValidationSummary {
  const nonErrors = validation.diagnostics.filter((d) => d.severity !== 'error');
  return {
    validation: {
      summary: validation.summary,
      ...(nonErrors.length > 0 ? { diagnostics: nonErrors } : {}),
      ...(validation.preexistingErrors.length > 0
        ? {
            preexistingErrors: validation.preexistingErrors,
            note: 'These errors existed before this change and did not block the write.'
          }
        : {})
    }
  };
}

// ─── Registration ─────────────────────────────────────────────────────────────

/**
 * LAS-006 §4 — the line a page written without a plan gets, once, in its own
 * success payload. Deliberately about the *next* page rather than this one: the
 * component is already written and correct, and telling someone to undo a
 * successful write is how advice gets ignored.
 */
const PAGE_WITHOUT_PLAN_ADVISORY =
  'You built this page without a plan. That is fine for one page — but a page assembled top-to-bottom in one ' +
  'call is how a 66-node graph happens, and nothing in it can be reused or varied. For the next one, call ' +
  'create_plan first: one operation per section and per repeated card, each declaring the `inputs` its ' +
  'instances will set. The page operation then places them.';

export function registerAuthorTools(
  server: McpServer,
  binding: ProjectBinding,
  plans: PlanRegistry,
  examples: ExampleBudget,
  // AWP-006. Optional so the four existing call sites in the suite that build a
  // registration directly keep working; when absent nothing is deferred, which
  // is the same posture `--all-tools` gives.
  disclosure?: ToolDisclosure
): void {
  // Rendered from the shared vocabulary (AAQ-005), so the two doors describe a
  // node with one set of words and `update_component` cannot drift from
  // `create_component`.
  const allowUnknownArg = CREATE_COMPONENT_SHAPE.allow_unknown_types;

  server.registerTool(
    'create_component',
    {
      title: 'Create component',
      description:
        'Create a new component from nodes + connections. The write is validated first (schemas, node types, ' +
        'ports, connection endpoints); any error rejects it with actionable diagnostics and nothing is written. ' +
        'Node hierarchy may be given via `parent` fields, `children` arrays, or both. To use the new component ' +
        'from another graph, add a node whose type is the returned legacyName. ' +
        'Node ids must be unique across the whole project: any id you send that is already used elsewhere is ' +
        'reallocated (and the graph rewired to match) — see `remappedNodeIds` in the response and use those ids ' +
        'from then on. ' +
        'If the component is a page (its path is under Pages/, or its graph has a `Page` node) it is also ' +
        'registered in the project router — returned as `registeredPages`, and a no-op if already listed.',
      inputSchema: CREATE_COMPONENT_SHAPE
    },
    guarded(
      (args: {
        path: string;
        type?: 'page' | 'visual' | 'logic' | 'cloud';
        nodes: NodeInput[];
        connections?: ConnectionV2[];
        visual_roots?: string[];
        description?: string;
        allow_unknown_types?: boolean;
      }) => {
        const store = binding.require();
        // SB-001 — normalise before validating, the same door discipline
        // `create_plan` has always had (`planTools.ts` runs every target through
        // `toPathForm`). Before this, "#__cloud__/X" passed validation verbatim
        // and became a registry key the editor's `legacyNameToPath` would never
        // mint — the next editor save wrote to "__cloud__/X" and orphaned the
        // MCP-made directory.
        const path = toPathForm(args.path);
        const pathError = validateComponentPath(path);
        if (pathError) throw new ToolError('invalid-argument', pathError);
        if (store.resolve(path)) {
          throw new ToolError('already-exists', `Component "${path}" already exists. Use update_component.`);
        }

        const legacyName = pathToLegacyName(path);
        // SB-001 — a component's runtime is its path; a `type` that disagrees
        // writes metadata whose destiny is the other bundle. Rejected rather
        // than silently corrected, with the repair in the message.
        const isCloudPath = legacyName.startsWith('/#__cloud__/');
        if (args.type === 'cloud' && !isCloudPath) {
          throw new ToolError(
            'invalid-argument',
            `type "cloud" needs a path under "#__cloud__/" — "${path}" would ship in the browser bundle. ` +
              `Create it as "#__cloud__/${path}" (or drop the type to make a browser component).`
          );
        }
        if (args.type && args.type !== 'cloud' && isCloudPath) {
          throw new ToolError(
            'invalid-argument',
            `"${path}" is under "#__cloud__/", which makes it a cloud component — type "${args.type}" ` +
              'contradicts that. Drop the type or pass "cloud".'
          );
        }
        const reconciled = reconcileHierarchy(normalizeAuthoredNodes(args.nodes));
        if (reconciled.errors.length > 0) {
          throw new ToolError('invalid-argument', 'Node hierarchy is inconsistent.', { errors: reconciled.errors });
        }

        const assembled = assembleCreateFiles({
          path,
          legacyName,
          type: args.type,
          nodes: reconciled.nodes,
          connections: args.connections,
          visualRoots: args.visual_roots,
          description: args.description,
          isVisualType: projectVisualPredicate(store)
        });

        // AAQ-011/F12: before validating, move any id this project already uses
        // elsewhere. The write gate is component-scoped and cannot see a
        // project-wide collision, so the fix is to make one unreachable rather
        // than to detect one. See `project/nodeIds.ts`.
        const { files: candidate, remapped } = deconflictNodeIds(store, legacyName, assembled);

        const validation = validateCandidate(store, path, candidate, undefined, {
          allowUnknownTypes: args.allow_unknown_types
        });
        if (!validation.ok) rejectWith(validation, `create_component "${path}"`, examples);

        const { revision } = store.writeComponent(path, candidate, { expectNew: true });
        // AAQ-005: a page component is not a page until a Router lists it. The
        // editor's apply has done this since AAQ-001; this door did not, so
        // every page Claude Code created was unreachable. After the write, so
        // "is the current start page still an empty placeholder" is asked of the
        // project as it now stands.
        const isPage = componentIsPage(legacyName, candidate);
        const registration = isPage ? registerPages(store, [legacyName]) : undefined;
        const payload: CreateComponentResponse = {
          created: path,
          legacyName,
          type: candidate.component.type,
          revision,
          registry: 'updated',
          ...registrationSummary(registration),
          ...remapPayload(remapped),
          ...successPayload(validation),
          // AWP-006 — after the write, because a rejected candidate is not
          // evidence that anybody intends to build a data app.
          ...backendRevealPayload(disclosure?.revealForNodes(candidate.nodes.nodes) ?? []),
          ...visualRootsPayload(candidate, args.visual_roots),
          // LAS-006 §4 — one line, on the door a page most often comes through
          // without a plan. Advisory and not a refusal: the bag-of-nodes door
          // stays open by decision (primitive-only, no ceremony for a two-node
          // fix), and LAS-011 measures whether one line was enough before
          // anything harder is considered. Silent for anyone who did use a plan.
          ...(isPage && !plans.hasPlans() ? { planAdvisory: PAGE_WITHOUT_PLAN_ADVISORY } : {})
        };
        return jsonResult(payload);
      }
    )
  );

  server.registerTool(
    'update_component',
    {
      title: 'Update component',
      description:
        'Change one component, either with `set` (full replacement of nodes/connections/visualRoots) or with a ' +
        'batch of `operations` (add/update/remove nodes, add/remove connections, set ports/info) — one call, one ' +
        'reviewable change. Validated before writing; new errors reject the whole batch and nothing is written. ' +
        'A node id this call introduces that is already used elsewhere in the project is reallocated and ' +
        'reported as `remappedNodeIds`; ids the component already had are never touched. ' +
        'Pass the `revision` from get_component as `if_revision` to fail cleanly if the component changed since ' +
        'you read it.',
      inputSchema: {
        path: z.string().describe('Component path or legacy name'),
        set: z
          .object({
            nodes: z.array(nodeSchema),
            connections: z.array(connectionSchema).optional(),
            visual_roots: z.array(z.string()).optional()
          })
          .optional()
          .describe('Full graph replacement'),
        operations: z.array(operationSchema).min(1).optional().describe('Batched delta operations, applied in order'),
        if_revision: z.string().optional().describe('Expected current revision (from get_component)'),
        allow_unknown_types: allowUnknownArg
      }
    },
    guarded(
      (args: {
        path: string;
        set?: { nodes: NodeInput[]; connections?: ConnectionV2[]; visual_roots?: string[] };
        operations?: OperationInput[];
        if_revision?: string;
        allow_unknown_types?: boolean;
      }) => {
        const store = binding.require();
        if (!args.set === !args.operations) {
          throw new ToolError('invalid-argument', 'Provide exactly one of `set` or `operations`.');
        }
        const stored = store.readComponent(args.path);
        const baseline = stored.files;
        let candidate: ComponentFiles;
        let applied: string[] | undefined;

        if (args.set) {
          const reconciled = reconcileHierarchy(normalizeAuthoredNodes(args.set.nodes));
          if (reconciled.errors.length > 0) {
            throw new ToolError('invalid-argument', 'Node hierarchy is inconsistent.', { errors: reconciled.errors });
          }
          candidate = assembleSetFiles(
            baseline,
            { nodes: reconciled.nodes, connections: args.set.connections, visualRoots: args.set.visual_roots },
            projectVisualPredicate(store)
          );
        } else {
          const result = applyOperations(baseline, normalizeOperations(args.operations!));
          if (result.errors.length > 0) {
            throw new ToolError('invalid-argument', 'Operation batch failed — nothing was written.', {
              errors: result.errors,
              appliedBeforeFailure: result.applied
            });
          }
          candidate = result.files;
          applied = result.applied;
          // AWP-002 A20 — the operations door has to re-derive too.
          //
          // AWP-001 gave `assembleSetFiles` an unconditional recompute and the
          // `operations` branch was not in its scope, so `add_node` left the
          // baseline's `visualRoots` untouched: a parentless visual node added
          // here was neither parented nor a root, and therefore could never
          // draw. That is F43's exact failure mode surviving on the door the
          // 2026-08-10 re-replay used twenty times — and `visualRootsPayload`
          // then reported `visualRootsDerived: true` over the stale array,
          // which is the reporting field saying the thing is fine.
          //
          // `explicit` is undefined here by construction: a batch has no
          // `visual_roots` argument, so this door only ever derives.
          const opRoots = resolveVisualRoots(
            candidate.nodes.nodes,
            undefined,
            projectVisualPredicate(store)
          );
          if (opRoots.visualRoots) candidate.nodes.visualRoots = opRoots.visualRoots;
          else delete candidate.nodes.visualRoots;
          // FIX-014 — an `add_node` without x/y used to land at the origin.
          // Every baseline position the batch did not change is locked (a
          // hand-arranged component is not this door's to tidy); only the
          // nodes this batch added or explicitly repositioned participate.
          candidate.nodes.nodes = layoutAuthoredNodes(candidate.nodes.nodes, projectVisualPredicate(store), {
            connections: candidate.connections.connections ?? [],
            lockedIds: positionsUnchangedFrom(candidate.nodes.nodes, baseline.nodes.nodes ?? [])
          });
        }
        candidate.component.modified = new Date().toISOString();
        candidate.component.modifiedBy = 'noodl-mcp';
        backfillIds(candidate);

        // AAQ-011/F12. `baseline` is passed so ids the component *already* had
        // are never touched — a pre-existing collision is not this write's doing,
        // and the gate's rule is "don't make it worse", not "fix everything".
        const deconflicted = deconflictNodeIds(store, stored.legacyName, candidate, baseline);
        candidate = deconflicted.files;
        const remapped = deconflicted.remapped;

        const validation = validateCandidate(store, stored.key, candidate, baseline, {
          allowUnknownTypes: args.allow_unknown_types
        });
        if (!validation.ok) rejectWith(validation, `update_component "${stored.key}"`, examples);

        const { revision } = store.writeComponent(stored.key, candidate, { ifRevision: args.if_revision });
        // Updates register too, exactly as the editor's apply does: a page that
        // exists but was never listed is the state this task is about, and
        // re-listing one already listed is a no-op.
        const registration = componentIsPage(stored.legacyName, candidate)
          ? registerPages(store, [stored.legacyName])
          : undefined;
        const payload: UpdateComponentResponse = {
          updated: stored.key,
          revision,
          ...(applied ? { applied } : {}),
          ...registrationSummary(registration),
          ...remapPayload(remapped),
          ...successPayload(validation),
          ...backendRevealPayload(disclosure?.revealForNodes(candidate.nodes.nodes) ?? []),
          ...visualRootsPayload(candidate, args.set?.visual_roots)
        };
        return jsonResult(payload);
      }
    )
  );

  server.registerTool(
    'delete_component',
    {
      title: 'Delete component',
      description:
        'Delete a component (its three files and registry entry; nested component directories beneath it are ' +
        'untouched). Refuses when other components instantiate it, unless `force` is set — the refusal lists ' +
        'every usage so they can be removed first.',
      inputSchema: {
        path: z.string().describe('Component path or legacy name'),
        force: z.boolean().optional().describe('Delete even when the component is still referenced')
      }
    },
    guarded((args: { path: string; force?: boolean }) => {
      const store = binding.require();
      const stored = store.readComponent(args.path);
      const usages = store.findUsages(stored.key);
      if (usages.length > 0 && !args.force) {
        const refusal: DeletionRefusalDetails = { usages };
        throw new ToolError(
          'validation-failed',
          `"${stored.key}" is instantiated by other components. Remove those nodes first, or pass force: true.`,
          { ...refusal }
        );
      }
      const brokenRefs = usages.length > 0 ? validateDeletion(store, stored.key) : [];
      const { removed } = store.deleteComponent(stored.key);
      const payload: DeleteComponentResponse = {
        deleted: stored.key,
        removedFiles: removed,
        registry: 'updated',
        ...(brokenRefs.length > 0 ? { brokenReferences: brokenRefs, note: 'force-deleted while still referenced' } : {})
      };
      return jsonResult(payload);
    })
  );
}
