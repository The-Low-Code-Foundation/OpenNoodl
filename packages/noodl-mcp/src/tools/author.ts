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
import type { ProjectStore } from '../project/ProjectStore';
import type { WriteValidation } from '../validate';
import { validateCandidate, validateDeletion } from '../validate';
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

const portSchema = z
  .object({ name: z.string() })
  .passthrough()
  .describe('Port definition; `name` required, other fields (type, displayName, plug, group…) pass through');

const nodeSchema = z
  .object({
    id: z.string().optional().describe('Unique node id; generated when omitted (but required to wire connections)'),
    type: z.string().describe('Catalog typeName ("Group") or a component legacyName ("/Pages/Home") to instantiate it'),
    label: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    parent: z.string().optional().describe('Id of the parent node in the visual tree'),
    children: z.array(z.string()).optional().describe('Child ids in render order (kept consistent with parent fields)'),
    parameters: z.record(z.unknown()).optional().describe('Static input values, keyed by port name'),
    variant: z.string().optional(),
    ports: z.array(portSchema).optional().describe('Instance ports (component inputs/outputs nodes etc.)')
  })
  .passthrough();

const connectionSchema = z.object({
  fromId: z.string(),
  fromProperty: z.string().describe('Output port name on the source node'),
  toId: z.string(),
  toProperty: z.string().describe('Input port name on the target node')
});

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
type NodeInput = Omit<NodeV2, 'id'> & { id?: string };
type OperationInput =
  | Exclude<UpdateOperation, { op: 'add_node' }>
  | { op: 'add_node'; node: NodeInput; index?: number };

function ensureIds(nodes: NodeInput[]): NodeV2[] {
  return nodes.map((n) => ({ ...n, id: n.id ?? crypto.randomUUID() }) as NodeV2);
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
  const allowUnknownArg = z
    .boolean()
    .optional()
    .describe('Permit node types the catalog does not know (module-provided nodes). Default: unknown types reject the write.');

  server.registerTool(
    'create_component',
    {
      title: 'Create component',
      description:
        'Create a new component from nodes + connections. The write is validated first (schemas, node types, ' +
        'ports, connection endpoints); any error rejects it with actionable diagnostics and nothing is written. ' +
        'Node hierarchy may be given via `parent` fields, `children` arrays, or both. To use the new component ' +
        'from another graph, add a node whose type is the returned legacyName.',
      inputSchema: {
        path: z.string().describe('New component path, e.g. "Pages/Settings" (parent path segments need not exist)'),
        type: z
          .enum(['page', 'visual', 'logic', 'cloud'])
          .optional()
          .describe('Component type; inferred from the path when omitted ("Pages/…" → page)'),
        nodes: z.array(nodeSchema).min(1),
        connections: z.array(connectionSchema).optional(),
        visual_roots: z.array(z.string()).optional().describe('Canvas root node ids (optional)'),
        description: z.string().optional().describe('Human/agent-facing summary stored on the component'),
        allow_unknown_types: allowUnknownArg
      }
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

        const now = new Date().toISOString();
        const componentId = crypto.randomUUID();
        const component: ComponentV2File = {
          $schema: 'https://opennoodl.dev/schemas/component-v2.json',
          id: componentId,
          name: args.path.split('/').pop() ?? args.path,
          path: legacyName,
          type: args.type ?? inferComponentType(legacyName),
          created: now,
          modified: now,
          modifiedBy: 'noodl-mcp',
          ...(args.description ? { description: args.description } : {})
        };
        const nodes: NodesV2File = {
          $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
          componentId,
          version: 1,
          nodes: reconciled.nodes,
          ...(args.visual_roots?.length ? { visualRoots: args.visual_roots } : {})
        };
        const connections: ConnectionsV2File = {
          $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
          componentId,
          version: 1,
          connections: args.connections ?? []
        };
        const candidate: ComponentFiles = { component, nodes, connections };

        const validation = validateCandidate(store, args.path, candidate, undefined, {
          allowUnknownTypes: args.allow_unknown_types
        });
        if (!validation.ok) rejectWith(validation, `create_component "${args.path}"`);

        const { revision } = store.writeComponent(args.path, candidate, { expectNew: true });
        const payload: CreateComponentResponse = {
          created: args.path,
          legacyName,
          type: component.type,
          revision,
          registry: 'updated',
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
          candidate = JSON.parse(JSON.stringify(baseline));
          candidate.nodes.nodes = reconciled.nodes;
          if (args.set.visual_roots !== undefined) {
            if (args.set.visual_roots.length > 0) candidate.nodes.visualRoots = args.set.visual_roots;
            else delete candidate.nodes.visualRoots;
          }
          if (args.set.connections !== undefined) {
            candidate.connections.connections = args.set.connections;
          }
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
        const payload: UpdateComponentResponse = {
          updated: stored.key,
          revision,
          ...(applied ? { applied } : {}),
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
