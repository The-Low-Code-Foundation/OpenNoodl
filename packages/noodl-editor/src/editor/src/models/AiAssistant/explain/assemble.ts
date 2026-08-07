/**
 * AIX-004 — Explain Mode: context assembly
 *
 * The quality lever for explanation is context, not prompt wording. A model can
 * only say something specific about a node if it can see the node's parameters,
 * what feeds it, what it feeds, and what its ports mean. It cannot see the whole
 * project — that is both expensive and, past a point, actively worse, because
 * the signal drowns.
 *
 * So assembly is a bounded expansion outward from the selection:
 *
 *   selection → hierarchy (parents and children) → connection neighbours,
 *   depth-limited → the catalog entry for every type that ended up included
 *
 * Everything dropped is counted and named in `bounds`, and ./render passes that
 * to the model so it can hedge rather than confabulate about what it cannot see.
 *
 * Pure: no editor globals, no I/O beyond the bundled catalog. That is what lets
 * the specs run it over the real project corpus.
 *
 * @module AiAssistant/explain/assemble
 */

import { enrichedNode } from '../../../validation/enrichedCatalog';
import type { EnrichedCatalogNode } from '../../../validation/enrichedCatalog';
import { componentPorts, findComponent, isComponentRef } from './graph';
import type {
  ContextBounds,
  ContextComponentShape,
  ContextConnection,
  ContextNode,
  ContextNodeType,
  ContextPort,
  ExplainContext,
  ExplainContextOptions,
  ExplainGraph,
  ExplainScope,
  GraphComponent,
  GraphConnection,
  GraphNode,
  NodeRole
} from './types';

export interface ExplainRequest {
  scope: ExplainScope;
  /** Component the selection lives in — the active component, in the editor. */
  componentName: string;
  /** Selected node ids. Empty for the component scope. */
  nodeIds?: string[];
}

/** Thrown when the request names something the graph does not contain. */
export class ExplainContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExplainContextError';
  }
}

// ── Bounds ────────────────────────────────────────────────────────────────────

/**
 * Defaults differ by scope because the question differs. Explaining one node
 * wants depth — follow the wire two hops so "what actually triggers this" is
 * answerable. Explaining a component wants breadth at shallow detail: every
 * node, fewer parameters each.
 */
const DEFAULTS: Record<ExplainScope, Required<ExplainContextOptions>> = {
  node: { neighbourDepth: 2, maxNodes: 60, maxParametersPerNode: 12, maxParameterChars: 400, maxNodeTypes: 40 },
  subgraph: { neighbourDepth: 1, maxNodes: 80, maxParametersPerNode: 10, maxParameterChars: 300, maxNodeTypes: 40 },
  component: { neighbourDepth: 0, maxNodes: 150, maxParametersPerNode: 6, maxParameterChars: 200, maxNodeTypes: 60 }
};

function resolveOptions(scope: ExplainScope, overrides?: ExplainContextOptions): Required<ExplainContextOptions> {
  return { ...DEFAULTS[scope], ...(overrides ?? {}) };
}

// ── Parameter rendering ───────────────────────────────────────────────────────

/** Values that carry no information worth spending context on. */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function contextParameters(
  node: GraphNode,
  limits: Required<ExplainContextOptions>
): Pick<ContextNode, 'parameters' | 'parametersOmitted'> {
  const entries = Object.entries(node.parameters).filter(([, value]) => !isEmptyValue(value));
  // Stable order so the same graph always produces the same context — a
  // prerequisite for caching and for specs that assert on rendered output.
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const kept = entries.slice(0, limits.maxParametersPerNode);
  const parameters = kept.map(([name, raw]) => {
    const full = stringifyValue(raw);
    if (full.length <= limits.maxParameterChars) return { name, value: full };
    return { name, value: full.slice(0, limits.maxParameterChars) + '…', truncated: true };
  });

  const omitted = entries.length - kept.length;
  return omitted > 0 ? { parameters, parametersOmitted: omitted } : { parameters };
}

// ── Catalog projection ────────────────────────────────────────────────────────

function portType(port: { type?: unknown }): string | undefined {
  const t = port.type;
  if (typeof t === 'string') return t;
  if (t && typeof t === 'object' && typeof (t as { name?: unknown }).name === 'string') {
    return (t as { name: string }).name;
  }
  return undefined;
}

/**
 * Document only the ports this context actually mentions. A `Group` node has
 * around eighty ports; including all of them for every visual node would spend
 * the entire budget on things nobody connected.
 */
function contextPorts(catalogNode: EnrichedCatalogNode | undefined, referenced: Set<string>): ContextPort[] {
  if (!catalogNode) return [];
  const descriptions = catalogNode.enrichment?.ports ?? {};
  const ports: ContextPort[] = [];
  for (const port of [...(catalogNode.inputs ?? []), ...(catalogNode.outputs ?? [])]) {
    if (!referenced.has(port.name)) continue;
    ports.push({
      name: port.name,
      displayName: port.displayName !== port.name ? port.displayName : undefined,
      type: portType(port),
      isSignal: port.isSignal || undefined,
      description: descriptions[port.name]
    });
  }
  return ports;
}

/** Whether a given output port carries a signal, when the catalog can say. */
function isSignalPort(type: string, plug: 'input' | 'output', portName: string): boolean | undefined {
  const node = enrichedNode(type);
  if (!node) return undefined;
  const list = plug === 'output' ? node.outputs : node.inputs;
  const port = (list ?? []).find((p) => p.name === portName);
  return port ? port.isSignal : undefined;
}

// ── Assembly ──────────────────────────────────────────────────────────────────

interface Adjacency {
  /** Connections where this node is the target. */
  incoming: GraphConnection[];
  /** Connections where this node is the source. */
  outgoing: GraphConnection[];
}

function buildAdjacency(component: GraphComponent): Map<string, Adjacency> {
  const map = new Map<string, Adjacency>();
  const entry = (id: string): Adjacency => {
    let a = map.get(id);
    if (!a) map.set(id, (a = { incoming: [], outgoing: [] }));
    return a;
  };
  for (const c of component.connections) {
    entry(c.fromId).outgoing.push(c);
    entry(c.toId).incoming.push(c);
  }
  return map;
}

/** Role precedence when a node is reachable more than one way. */
const ROLE_RANK: Record<NodeRole, number> = {
  selected: 0,
  container: 1,
  upstream: 2,
  downstream: 3,
  peer: 4
};

function componentShape(component: GraphComponent): ContextComponentShape {
  const counts = new Map<string, number>();
  for (const node of component.nodes) counts.set(node.type, (counts.get(node.type) ?? 0) + 1);

  const typeCounts = [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || (a.type < b.type ? -1 : 1));

  const { inputPorts, outputPorts } = componentPorts(component);

  return {
    name: component.name,
    nodeCount: component.nodes.length,
    connectionCount: component.connections.length,
    inputPorts,
    outputPorts,
    typeCounts,
    visualRoots: component.nodes.filter((n) => !n.parent).map((n) => n.id)
  };
}

/**
 * Build the bounded context for one explanation request.
 *
 * Never reads outside `request.componentName`: even when a selected node is an
 * instance of another component, only its interface (via its instance ports) is
 * included, not that component's interior. Whole-project context is not a bound
 * that assembly happens to respect — it is a shape assembly cannot express.
 */
export function assembleContext(
  graph: ExplainGraph,
  request: ExplainRequest,
  overrides?: ExplainContextOptions
): ExplainContext {
  const component = findComponent(graph, request.componentName);
  if (!component) {
    throw new ExplainContextError(`Component "${request.componentName}" is not in this project.`);
  }

  const limits = resolveOptions(request.scope, overrides);
  const nodesById = new Map(component.nodes.map((n) => [n.id, n]));
  const adjacency = buildAdjacency(component);

  const seeds = request.scope === 'component' ? component.nodes.map((n) => n.id) : (request.nodeIds ?? []);
  if (request.scope !== 'component' && seeds.length === 0) {
    throw new ExplainContextError('Nothing is selected to explain.');
  }
  for (const id of seeds) {
    if (!nodesById.has(id)) {
      throw new ExplainContextError(`Node "${id}" is not in component "${component.name}".`);
    }
  }

  const roles = new Map<string, NodeRole>();
  const notes: string[] = [];

  const assign = (id: string, role: NodeRole) => {
    if (!nodesById.has(id)) return;
    const current = roles.get(id);
    if (current === undefined || ROLE_RANK[role] < ROLE_RANK[current]) roles.set(id, role);
  };

  const selectedRole: NodeRole = request.scope === 'component' ? 'peer' : 'selected';
  for (const id of seeds) assign(id, selectedRole);

  // 1. Visual hierarchy. A node's container and contents are part of what it
  //    "does" in a way a connection never captures — a Text inside a Group
  //    inside a Page is positioned by all three.
  if (request.scope !== 'component') {
    for (const id of seeds) {
      let parentId = nodesById.get(id)?.parent;
      while (parentId) {
        assign(parentId, 'container');
        parentId = nodesById.get(parentId)?.parent;
      }
      for (const childId of nodesById.get(id)?.children ?? []) assign(childId, 'container');
    }
  }

  // 2. Connection neighbours, breadth-first to the configured depth. The first
  //    hop fixes the role: anything reached through an incoming connection is
  //    upstream of the selection no matter how the walk continues.
  let frontier: Array<{ id: string; role: NodeRole }> = seeds.map((id) => ({ id, role: selectedRole }));
  for (let depth = 0; depth < limits.neighbourDepth; depth++) {
    const next: Array<{ id: string; role: NodeRole }> = [];
    for (const { id, role } of frontier) {
      const adj = adjacency.get(id);
      if (!adj) continue;
      for (const c of adj.incoming) {
        const inherited: NodeRole = role === 'selected' || role === 'container' ? 'upstream' : role;
        if (!roles.has(c.fromId)) next.push({ id: c.fromId, role: inherited });
        assign(c.fromId, inherited);
      }
      for (const c of adj.outgoing) {
        const inherited: NodeRole = role === 'selected' || role === 'container' ? 'downstream' : role;
        if (!roles.has(c.toId)) next.push({ id: c.toId, role: inherited });
        assign(c.toId, inherited);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  // 3. Trim to the node budget, dropping the least relevant first. Selection and
  //    its containers are never dropped — losing those would make the answer
  //    wrong rather than merely partial.
  const ordered = component.nodes
    .filter((n) => roles.has(n.id))
    .map((n) => ({ node: n, role: roles.get(n.id)! }))
    .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role]);

  let included = ordered;
  let nodesOmitted = component.nodes.length - ordered.length;
  if (ordered.length > limits.maxNodes) {
    included = ordered.slice(0, limits.maxNodes);
    const dropped = ordered.length - included.length;
    nodesOmitted += dropped;
    notes.push(`${dropped} less-related node(s) omitted to stay within the context budget.`);
  }
  if (request.scope === 'component' && nodesOmitted > 0) {
    notes.push(`This component has ${component.nodes.length} nodes; ${nodesOmitted} are not shown.`);
  }

  const includedIds = new Set(included.map((e) => e.node.id));
  // Restore document order for the rendered context: reading a graph top-down
  // matches how it is laid out, and the model's citations come out in an order
  // the user can follow on canvas.
  const inDocumentOrder = component.nodes.filter((n) => includedIds.has(n.id));

  // 4. Connections between included nodes, plus a count of those lost at the
  //    boundary so the model knows the subgraph is a cut, not the whole story.
  const connections: ContextConnection[] = [];
  let connectionsOmitted = 0;
  for (const c of component.connections) {
    const bothIn = includedIds.has(c.fromId) && includedIds.has(c.toId);
    if (!bothIn) {
      if (includedIds.has(c.fromId) || includedIds.has(c.toId)) connectionsOmitted++;
      continue;
    }
    const fromNode = nodesById.get(c.fromId)!;
    connections.push({ ...c, isSignal: isSignalPort(fromNode.type, 'output', c.fromProperty) });
  }
  if (connectionsOmitted > 0) {
    notes.push(`${connectionsOmitted} connection(s) cross the edge of this context.`);
  }

  // 5. Node records.
  const nodes: ContextNode[] = inDocumentOrder.map((node) => {
    const catalogNode = enrichedNode(node.type);
    const displayName = catalogNode?.displayName ?? node.type;
    const record: ContextNode = {
      id: node.id,
      type: node.type,
      displayName,
      // A label identical to the display name is the type name again, not
      // information — `NodeGraphNode.label` falls back to a type-derived label.
      label: node.label && node.label !== displayName ? node.label : undefined,
      role: roles.get(node.id)!,
      comment: node.comment,
      ...contextParameters(node, limits)
    };
    if (isComponentRef(node.type)) record.isComponentInstance = true;
    return record;
  });

  // 6. Type documentation, once per distinct type, with only the ports this
  //    context references.
  const referencedPorts = new Map<string, Set<string>>();
  const reference = (type: string, port: string) => {
    let set = referencedPorts.get(type);
    if (!set) referencedPorts.set(type, (set = new Set()));
    set.add(port);
  };
  for (const node of inDocumentOrder) {
    for (const name of Object.keys(node.parameters)) {
      if (!isEmptyValue(node.parameters[name])) reference(node.type, name);
    }
  }
  for (const c of connections) {
    reference(nodesById.get(c.fromId)!.type, c.fromProperty);
    reference(nodesById.get(c.toId)!.type, c.toProperty);
  }

  const distinctTypes: string[] = [];
  for (const node of inDocumentOrder) if (!distinctTypes.includes(node.type)) distinctTypes.push(node.type);

  const typeBudget = distinctTypes.slice(0, limits.maxNodeTypes);
  if (distinctTypes.length > typeBudget.length) {
    notes.push(`${distinctTypes.length - typeBudget.length} node type description(s) omitted.`);
  }

  const nodeTypes: ContextNodeType[] = typeBudget.map((type) => {
    const catalogNode = enrichedNode(type);
    if (!catalogNode) {
      return {
        typeName: type,
        displayName: type,
        ports: [],
        // Component instances are not "unknown" — they are defined elsewhere in
        // this project, and saying so is more useful than saying nothing.
        unknown: !isComponentRef(type)
      };
    }
    const e = catalogNode.enrichment;
    return {
      typeName: type,
      displayName: catalogNode.displayName,
      category: catalogNode.category,
      isVisual: catalogNode.isVisual || undefined,
      summary: e?.summary,
      description: e?.description,
      whenToUse: e?.whenToUse,
      runtimeBehavior: e?.runtimeBehavior,
      ports: contextPorts(catalogNode, referencedPorts.get(type) ?? new Set())
    };
  });

  const bounds: ContextBounds = {
    nodesOmitted,
    connectionsOmitted,
    truncated: nodesOmitted > 0 || connectionsOmitted > 0 || notes.length > 0,
    notes
  };

  return {
    scope: request.scope,
    component: componentShape(component),
    selectedIds: request.scope === 'component' ? [] : seeds,
    nodes,
    connections,
    nodeTypes,
    bounds,
    stats: {
      nodeCount: nodes.length,
      connectionCount: connections.length,
      nodeTypeCount: nodeTypes.length,
      renderedChars: 0 // filled in by render()
    }
  };
}
