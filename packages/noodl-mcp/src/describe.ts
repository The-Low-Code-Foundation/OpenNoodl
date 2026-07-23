/**
 * explain_component — a structured, summarisation-ready description of a
 * component's graph: the visual tree, the logic nodes, and the data flow, with
 * catalog display names instead of raw type strings where possible.
 */

import { catalogIndex } from './catalog';
import { isComponentRef, refToPath } from './editor-deps';
import type { NodeV2 } from './editor-deps';
import type { ComponentFiles } from './graph';

export interface VisualTreeNode {
  id: string;
  type: string;
  displayType?: string;
  label?: string;
  /** Small selection of scalar parameters that shape what the node shows. */
  parameters?: Record<string, unknown>;
  children?: VisualTreeNode[];
}

export interface FlowEdge {
  from: string;
  to: string;
}

export interface ComponentDescription {
  path: string;
  legacyName: string;
  type: string;
  description?: string;
  ports?: { inputs?: unknown[]; outputs?: unknown[] };
  /** Visual hierarchy — the trees rooted at parentless visual nodes. */
  visualTree: VisualTreeNode[];
  /** Non-visual nodes (logic, data, events), flat. */
  logicNodes: Array<{ id: string; type: string; displayType?: string; label?: string; parameters?: Record<string, unknown> }>;
  /** Data/signal flow in readable endpoint notation. */
  dataFlow: FlowEdge[];
  /** Other project components this component instantiates. */
  componentRefs: string[];
  stats: { nodes: number; connections: number };
}

const MAX_PARAMS_SHOWN = 6;

function pickParameters(node: NodeV2): Record<string, unknown> | undefined {
  if (!node.parameters) return undefined;
  const entries = Object.entries(node.parameters).filter(
    ([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
  );
  if (entries.length === 0) return undefined;
  const shown = entries.slice(0, MAX_PARAMS_SHOWN);
  const out: Record<string, unknown> = Object.fromEntries(shown);
  if (entries.length > shown.length) out['…'] = `${entries.length - shown.length} more`;
  return out;
}

function displayType(type: string): string | undefined {
  if (isComponentRef(type)) return `component: ${refToPath(type)}`;
  const node = catalogIndex().getNode(type);
  return node && node.displayName !== type ? node.displayName : undefined;
}

function isVisualType(type: string): boolean {
  if (isComponentRef(type)) return true; // component instances mount into the tree
  return catalogIndex().getNode(type)?.isVisual ?? false;
}

function endpoint(node: NodeV2 | undefined, id: string, property: string): string {
  if (!node) return `${id}.${property}`;
  const name = node.label ?? displayType(node.type) ?? node.type;
  return `${name} [${id}].${property}`;
}

export function describeComponent(key: string, files: ComponentFiles): ComponentDescription {
  const nodes = files.nodes.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const buildTree = (node: NodeV2): VisualTreeNode => {
    const t: VisualTreeNode = { id: node.id, type: node.type };
    const dt = displayType(node.type);
    if (dt) t.displayType = dt;
    if (node.label) t.label = node.label;
    const params = pickParameters(node);
    if (params) t.parameters = params;
    const children = (node.children ?? [])
      .map((id) => byId.get(id))
      .filter((c): c is NodeV2 => c !== undefined)
      .map(buildTree);
    if (children.length > 0) t.children = children;
    return t;
  };

  const visualRootNodes = nodes.filter((n) => n.parent === undefined && isVisualType(n.type));
  const inTree = new Set<string>();
  const markTree = (n: NodeV2) => {
    inTree.add(n.id);
    for (const id of n.children ?? []) {
      const c = byId.get(id);
      if (c) markTree(c);
    }
  };
  visualRootNodes.forEach(markTree);

  const logicNodes = nodes
    .filter((n) => !inTree.has(n.id))
    .map((n) => {
      const row: ComponentDescription['logicNodes'][number] = { id: n.id, type: n.type };
      const dt = displayType(n.type);
      if (dt) row.displayType = dt;
      if (n.label) row.label = n.label;
      const params = pickParameters(n);
      if (params) row.parameters = params;
      return row;
    });

  const dataFlow: FlowEdge[] = files.connections.connections.map((c) => ({
    from: endpoint(byId.get(c.fromId), c.fromId, c.fromProperty),
    to: endpoint(byId.get(c.toId), c.toId, c.toProperty)
  }));

  const componentRefs = [
    ...new Set(nodes.filter((n) => isComponentRef(n.type)).map((n) => refToPath(n.type)))
  ].sort();

  const description: ComponentDescription = {
    path: key,
    legacyName: files.component.path ?? '/' + key,
    type: files.component.type,
    visualTree: visualRootNodes.map(buildTree),
    logicNodes,
    dataFlow,
    componentRefs,
    stats: { nodes: nodes.length, connections: files.connections.connections.length }
  };
  if (files.component.description) description.description = files.component.description;
  if (files.component.ports) description.ports = files.component.ports;
  return description;
}
