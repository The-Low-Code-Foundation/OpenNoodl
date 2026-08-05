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
import { formatDiagnosticLine, inferComponentType } from '../editor-deps';
import { ToolError } from '../errors';
import type { ComponentFiles, UpdateOperation } from '../graph';
import { applyOperations, reconcileHierarchy } from '../graph';
import { pathToLegacyName, validateComponentPath } from '../paths';
import { componentIsPage, registerPages, registrationSummary } from '../project/pageRegistration';
import type { ProjectStore } from '../project/ProjectStore';
import type { WriteValidation } from '../validate';
import { validateCandidate, validateDeletion } from '../validate';
import { CREATE_COMPONENT_SHAPE, connectionSchema, nodeSchema, portSchema } from '../vocabulary';
import type {
  CreateComponentResponse,
  DeletionRefusalDetails,
  ValidationFailureDetails,
  DeleteComponentResponse,
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
        x: z.number().optional(),
        y: z.number().optional(),
        variant: z.string().optional(),
        parent: z.string().nullable().optional().describe('Reparent; null detaches from the visual tree')
      })
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
  const nodes: NodesV2File = {
    $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
    componentId,
    version: 1,
    nodes: args.nodes,
    ...(args.visualRoots?.length ? { visualRoots: args.visualRoots } : {})
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
  set: { nodes: NodeV2[]; connections?: ConnectionV2[]; visualRoots?: string[] }
): ComponentFiles {
  const candidate: ComponentFiles = JSON.parse(JSON.stringify(baseline));
  candidate.nodes.nodes = set.nodes;
  if (set.visualRoots !== undefined) {
    if (set.visualRoots.length > 0) candidate.nodes.visualRoots = set.visualRoots;
    else delete candidate.nodes.visualRoots;
  }
  if (set.connections !== undefined) {
    candidate.connections.connections = set.connections;
  }
  candidate.component.modified = new Date().toISOString();
  candidate.component.modifiedBy = 'noodl-mcp';
  backfillIds(candidate);
  return candidate;
}

function normalizeOperations(operations: OperationInput[]): UpdateOperation[] {
  return operations.map((op) =>
    op.op === 'add_node' && !op.node.id ? { ...op, node: { ...op.node, id: crypto.randomUUID() } } : op
  ) as UpdateOperation[];
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

function rejectWith(validation: WriteValidation, intent: string): never {
  const lines = [
    ...validation.newErrors.map(formatDiagnosticLine),
    ...(validation.structural ?? []).flatMap((f) => f.errors.map((e) => `SCHEMA ${f.file} ${e.path}: ${e.message}`))
  ];
  const details: ValidationFailureDetails = {
    readable: lines,
    structural: validation.structural,
    newErrors: validation.newErrors,
    allDiagnostics: validation.diagnostics
  };
  throw new ToolError('validation-failed', `${intent} rejected — nothing was written.`, { ...details });
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

export function registerAuthorTools(server: McpServer, store: ProjectStore): void {
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
        const pathError = validateComponentPath(args.path);
        if (pathError) throw new ToolError('invalid-argument', pathError);
        if (store.resolve(args.path)) {
          throw new ToolError('already-exists', `Component "${args.path}" already exists. Use update_component.`);
        }

        const legacyName = pathToLegacyName(args.path);
        const reconciled = reconcileHierarchy(ensureIds(args.nodes));
        if (reconciled.errors.length > 0) {
          throw new ToolError('invalid-argument', 'Node hierarchy is inconsistent.', { errors: reconciled.errors });
        }

        const candidate = assembleCreateFiles({
          path: args.path,
          legacyName,
          type: args.type,
          nodes: reconciled.nodes,
          connections: args.connections,
          visualRoots: args.visual_roots,
          description: args.description
        });

        const validation = validateCandidate(store, args.path, candidate, undefined, {
          allowUnknownTypes: args.allow_unknown_types
        });
        if (!validation.ok) rejectWith(validation, `create_component "${args.path}"`);

        const { revision } = store.writeComponent(args.path, candidate, { expectNew: true });
        // AAQ-005: a page component is not a page until a Router lists it. The
        // editor's apply has done this since AAQ-001; this door did not, so
        // every page Claude Code created was unreachable. After the write, so
        // "is the current start page still an empty placeholder" is asked of the
        // project as it now stands.
        const registration = componentIsPage(legacyName, candidate)
          ? registerPages(store, [legacyName])
          : undefined;
        const payload: CreateComponentResponse = {
          created: args.path,
          legacyName,
          type: candidate.component.type,
          revision,
          registry: 'updated',
          ...registrationSummary(registration),
          ...successPayload(validation)
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
        if (!args.set === !args.operations) {
          throw new ToolError('invalid-argument', 'Provide exactly one of `set` or `operations`.');
        }
        const stored = store.readComponent(args.path);
        const baseline = stored.files;
        let candidate: ComponentFiles;
        let applied: string[] | undefined;

        if (args.set) {
          const reconciled = reconcileHierarchy(ensureIds(args.set.nodes));
          if (reconciled.errors.length > 0) {
            throw new ToolError('invalid-argument', 'Node hierarchy is inconsistent.', { errors: reconciled.errors });
          }
          candidate = assembleSetFiles(baseline, {
            nodes: reconciled.nodes,
            connections: args.set.connections,
            visualRoots: args.set.visual_roots
          });
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
        }
        candidate.component.modified = new Date().toISOString();
        candidate.component.modifiedBy = 'noodl-mcp';
        backfillIds(candidate);

        const validation = validateCandidate(store, stored.key, candidate, baseline, {
          allowUnknownTypes: args.allow_unknown_types
        });
        if (!validation.ok) rejectWith(validation, `update_component "${stored.key}"`);

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
          ...successPayload(validation)
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
