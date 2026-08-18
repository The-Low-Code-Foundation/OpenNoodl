/**
 * SUB-006 — Semantic Validator: legacy / in-memory adapter
 *
 * Converts a legacy monolithic project (the shape `ProjectModel.toJSON()`
 * produces, and what a v1 project.json is on disk) into the normalized model.
 * This is the path the editor service uses: `ProjectModel.instance.toJSON()`
 * is exactly a `LegacyProjectLike`.
 *
 * Pure — no filesystem, no editor globals.
 *
 * @module noodl-editor/validation/normalize
 */

import type { ConnectionsV2File, NodesV2File } from '../schemas';
import {
  MALFORMED_NODE_TYPE,
  MalformedNodeReason,
  NormComponent,
  NormConnection,
  NormNode,
  NormProject,
  buildComponentRefs
} from './model';

// A structural subset of the legacy project shape we depend on. Kept local so
// this module has no hard dependency on the editor's model classes.
interface LegacyPortLike {
  name?: string;
}
interface LegacyNodeLike {
  id: string;
  type: string;
  label?: string;
  children?: LegacyNodeLike[];
  ports?: LegacyPortLike[];
  dynamicports?: LegacyPortLike[];
  /** Carried through for LIB-006's `legacyImport` marker; see NormNode.metadata. */
  metadata?: Record<string, unknown>;
  /** D13 — carried so the CLI gate can check parameter values. */
  parameters?: Record<string, unknown> | null;
}
interface LegacyConnectionLike {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}
interface LegacyGraphLike {
  roots?: LegacyNodeLike[];
  connections?: LegacyConnectionLike[];
}
interface LegacyComponentLike {
  name: string;
  graph?: LegacyGraphLike;
}
export interface LegacyProjectLike {
  components?: LegacyComponentLike[];
}

/**
 * Only the two port bags are read, so that is all the parameter asks for — the
 * legacy and v2 node shapes agree there and nowhere else (v2 `children` is a
 * list of ids, legacy's is a list of nodes).
 */
function instancePortNames(node: { ports?: LegacyPortLike[]; dynamicports?: LegacyPortLike[] }): string[] {
  const names: string[] = [];
  for (const p of node.ports ?? []) if (p && typeof p.name === 'string') names.push(p.name);
  for (const p of node.dynamicports ?? []) if (p && typeof p.name === 'string') names.push(p.name);
  return names;
}

/**
 * D13 — parameters cross into the normalized model here, on both node shapes.
 *
 * Returns a spread-able object rather than a value so a node that sets nothing
 * carries **no `parameters` key at all**, not an empty one. `checkParameterValues`
 * reads `if (!parameters) continue` and treats "nothing set" as "nothing to
 * check and nothing skipped" — an `{}` would take the same branch today, but the
 * distinction is the one the whole check is built on and it should not depend on
 * a falsy-empty-object accident.
 *
 * ⚠️ A non-object (a string, an array, `null`) is dropped rather than passed on:
 * the checker iterates `Object.entries`, and handing it an array would produce
 * diagnostics named `"0"`, `"1"`. `malformed-node` owns reporting a node whose
 * shape is wrong.
 */
function normalizedParameters(raw: unknown): { parameters?: Record<string, unknown> } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const parameters = raw as Record<string, unknown>;
  return Object.keys(parameters).length > 0 ? { parameters } : {};
}

/**
 * FIX-023 — the one place a node's `type` crosses from "whatever was on disk"
 * into the normalized model's `type: string` promise.
 *
 * The guard belongs here, at the boundary, rather than at the call sites: there
 * are twenty `isComponentRef(node.type)` calls across the editor and the MCP
 * server and exactly two of them were guarded, because whoever hit this before
 * patched the line they were standing on. Every rule downstream of this
 * function now gets a real string, and the substitution is *recorded* rather
 * than silent — `malformed-node` reports it, naming the node and the component.
 *
 * Returns the reasons alongside the value so a caller writes one spread rather
 * than branching twice.
 */
function normalizedType(raw: unknown): { type: string; malformed?: MalformedNodeReason[] } {
  if (typeof raw === 'string' && raw.length > 0) return { type: raw };
  return { type: MALFORMED_NODE_TYPE, malformed: ['missing-type'] };
}

/** Flatten a legacy component's nested root tree into flat NormNodes. */
function flatten(roots: LegacyNodeLike[]): NormNode[] {
  const out: NormNode[] = [];
  function visit(node: LegacyNodeLike, parentId?: string): void {
    const childIds = (node.children ?? []).map((c) => c.id);
    out.push({
      id: node.id,
      ...normalizedType(node.type),
      label: node.label,
      parent: parentId,
      children: childIds,
      instancePorts: instancePortNames(node),
      ...normalizedParameters(node.parameters),
      metadata: node.metadata
    });
    for (const child of node.children ?? []) visit(child, node.id);
  }
  for (const root of roots) visit(root, undefined);
  return out;
}

/**
 * Normalise one v2 component (already-flat nodes.json + connections.json).
 * Lives here (not in ./loadV2Project) because it is pure: consumers that hold
 * v2 files in memory — the MCP server's write-gate, and AIX-002's authoring
 * loop validating a candidate before anything exists on disk — must be able to
 * use it from the renderer, where the fs-importing loader is off-limits.
 */
export function normalizeV2Component(
  name: string,
  nodesFile: Partial<NodesV2File> | null | undefined,
  connectionsFile: Partial<ConnectionsV2File> | null | undefined
): NormComponent {
  const nodes: NormNode[] = (nodesFile?.nodes ?? []).map((n) => ({
    id: n.id,
    ...normalizedType(n.type),
    label: n.label,
    parent: n.parent,
    children: Array.isArray(n.children) ? n.children : [],
    instancePorts: instancePortNames(n),
    ...normalizedParameters((n as { parameters?: Record<string, unknown> | null }).parameters),
    metadata: (n as { metadata?: Record<string, unknown> }).metadata
  }));
  const connections: NormConnection[] = (connectionsFile?.connections ?? []).map((c) => ({
    fromId: c.fromId,
    fromProperty: c.fromProperty,
    toId: c.toId,
    toProperty: c.toProperty
  }));
  return { name, nodes, connections };
}

/** Convert a legacy / in-memory project object into the normalized model. */
export function fromLegacyProject(project: LegacyProjectLike): NormProject {
  const components: NormComponent[] = [];
  for (const comp of project.components ?? []) {
    const graph = comp.graph ?? {};
    const connections: NormConnection[] = (graph.connections ?? []).map((c) => ({
      fromId: c.fromId,
      fromProperty: c.fromProperty,
      toId: c.toId,
      toProperty: c.toProperty
    }));
    components.push({
      name: comp.name,
      nodes: flatten(graph.roots ?? []),
      connections
    });
  }
  return {
    components,
    componentRefs: buildComponentRefs(components.map((c) => c.name))
  };
}
