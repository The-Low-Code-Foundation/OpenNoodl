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

import { NormComponent, NormConnection, NormNode, NormProject, buildComponentRefs } from './model';

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

function instancePortNames(node: LegacyNodeLike): string[] {
  const names: string[] = [];
  for (const p of node.ports ?? []) if (p && typeof p.name === 'string') names.push(p.name);
  for (const p of node.dynamicports ?? []) if (p && typeof p.name === 'string') names.push(p.name);
  return names;
}

/** Flatten a legacy component's nested root tree into flat NormNodes. */
function flatten(roots: LegacyNodeLike[]): NormNode[] {
  const out: NormNode[] = [];
  function visit(node: LegacyNodeLike, parentId?: string): void {
    const childIds = (node.children ?? []).map((c) => c.id);
    out.push({
      id: node.id,
      type: node.type,
      label: node.label,
      parent: parentId,
      children: childIds,
      instancePorts: instancePortNames(node)
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
export function normalizeV2Component(name: string, nodesFile: any, connectionsFile: any): NormComponent {
  const nodes: NormNode[] = (nodesFile?.nodes ?? []).map((n: any) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    parent: n.parent,
    children: Array.isArray(n.children) ? n.children : [],
    instancePorts: instancePortNames(n)
  }));
  const connections: NormConnection[] = (connectionsFile?.connections ?? []).map((c: any) => ({
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
