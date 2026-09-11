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
import { componentPorts, findComponent, isComponentRef, isInterfaceNodeType } from './graph';
import type {
  ContextBounds,
  ContextComponentShape,
  ContextConnection,
  ContextNestedComponent,
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
  node: {
    neighbourDepth: 2,
    maxNodes: 60,
    maxParametersPerNode: 12,
    maxParameterChars: 400,
    maxNodeTypes: 40,
    maxNestedComponents: 3,
    maxNestedNodes: 40
  },
  subgraph: {
    neighbourDepth: 1,
    maxNodes: 80,
    maxParametersPerNode: 10,
    maxParameterChars: 300,
    maxNodeTypes: 40,
    // A selection of many nodes can hold many instances; read fewer of them,
    // less deeply, so one question about a group cannot pull in half a project.
    maxNestedComponents: 2,
    maxNestedNodes: 25
  },
  // Component scope has no selection, so nothing is ever a candidate. Zero says
  // so outright rather than leaving it to that coincidence.
  component: {
    neighbourDepth: 0,
    maxNodes: 150,
    maxParametersPerNode: 6,
    maxParameterChars: 200,
    maxNodeTypes: 60,
    maxNestedComponents: 0,
    maxNestedNodes: 0
  }
};

/**
 * An interior is *evidence about* the selected instance, not the thing being
 * explained, so its parameters are read at the component scope's breadth-first
 * settings however generous the outer scope is.
 */
const NESTED_PARAMETER_LIMITS = { maxParametersPerNode: 6, maxParameterChars: 200 };

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

/**
 * One node as the model sees it. Shared by the component's own slice and by the
 * interiors read for FIX-001 §1c so an interior node is described in exactly the
 * same terms as a top-level one — the section it sits in is what says where it
 * lives, not a different rendering of the node itself.
 */
function contextNode(node: GraphNode, role: NodeRole, limits: Required<ExplainContextOptions>): ContextNode {
  const catalogNode = enrichedNode(node.type);
  const displayName = catalogNode?.displayName ?? node.type;
  const record: ContextNode = {
    id: node.id,
    type: node.type,
    displayName,
    // A label identical to the display name is the type name again, not
    // information — `NodeGraphNode.label` falls back to a type-derived label.
    label: node.label && node.label !== displayName ? node.label : undefined,
    role,
    comment: node.comment,
    ...contextParameters(node, limits)
  };
  if (isComponentRef(node.type)) record.isComponentInstance = true;
  return record;
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
    // Verbatim, or absent. Assembly truncates parameter values because they can
    // be a whole script body; an author's one or two sentences about their own
    // component are the last thing worth spending the budget cutting.
    ...(component.description ? { description: component.description } : {}),
    nodeCount: component.nodes.length,
    connectionCount: component.connections.length,
    inputPorts,
    outputPorts,
    typeCounts,
    visualRoots: component.nodes.filter((n) => !n.parent).map((n) => n.id)
  };
}

// ── FIX-001 §1c — reading inside a selected component instance ────────────────

/** One interior, plus what it contributes to the shared type documentation. */
interface NestedRead {
  section: ContextNestedComponent;
  /** Distinct types used inside, in first-use order. */
  types: string[];
  /** Ports the interior references, as [type, port] — merged into the one type block. */
  portRefs: Array<[string, string]>;
  note?: string;
}

/**
 * Read one component's interior, bounded.
 *
 * Interface nodes (`Component Inputs`, `Component Outputs`) survive the bound
 * first and everything else follows in document order — see
 * {@link isInterfaceNodeType}. What is *kept* is still emitted in document
 * order, so the reading order of the graph is preserved either way.
 */
function readInterior(
  target: GraphComponent,
  instanceIds: string[],
  limits: Required<ExplainContextOptions>
): NestedRead {
  const nestedLimits: Required<ExplainContextOptions> = { ...limits, ...NESTED_PARAMETER_LIMITS };

  const byPriority = [
    ...target.nodes.filter((n) => isInterfaceNodeType(n.type)),
    ...target.nodes.filter((n) => !isInterfaceNodeType(n.type))
  ];
  const keptIds = new Set(byPriority.slice(0, limits.maxNestedNodes).map((n) => n.id));
  const kept = target.nodes.filter((n) => keptIds.has(n.id));

  const nodesById = new Map(target.nodes.map((n) => [n.id, n]));
  const connections: ContextConnection[] = [];
  for (const c of target.connections) {
    if (!keptIds.has(c.fromId) || !keptIds.has(c.toId)) continue;
    const fromNode = nodesById.get(c.fromId);
    if (!fromNode) continue;
    connections.push({ ...c, isSignal: isSignalPort(fromNode.type, 'output', c.fromProperty) });
  }

  const portRefs: Array<[string, string]> = [];
  const types: string[] = [];
  for (const node of kept) {
    if (!types.includes(node.type)) types.push(node.type);
    for (const name of Object.keys(node.parameters)) {
      if (!isEmptyValue(node.parameters[name])) portRefs.push([node.type, name]);
    }
  }
  for (const c of connections) {
    portRefs.push([nodesById.get(c.fromId)!.type, c.fromProperty]);
    portRefs.push([nodesById.get(c.toId)!.type, c.toProperty]);
  }

  const { inputPorts, outputPorts } = componentPorts(target);
  const nodesOmitted = target.nodes.length - kept.length;

  return {
    section: {
      name: target.name,
      ...(target.description ? { description: target.description } : {}),
      instanceIds,
      inputPorts,
      outputPorts,
      nodeCount: target.nodes.length,
      nodes: kept.map((n) => contextNode(n, 'peer', nestedLimits)),
      connections,
      nodesOmitted
    },
    types,
    portRefs,
    ...(nodesOmitted > 0
      ? {
          note:
            `Inside ${target.name}: ${nodesOmitted} of its ${target.nodes.length} node(s) were not read.`
        }
      : {})
  };
}

/**
 * Every interior worth reading for this request.
 *
 * **Selected instances only.** A neighbour that happens to be an instance is in
 * the context because of the wire it sits on, and reading its interior too
 * would make the size of an explanation depend on what the selection happens to
 * be next to.
 *
 * A component the graph does not contain is skipped **silently**. Assembly
 * cannot tell "this project has no such component" from "the caller handed me
 * one component" — the ExplainPanel passes the whole project, the MCP and review
 * assemblers pass what they have — and a bounds note claiming something was
 * withheld would be a guess about the caller. The instance itself is still in
 * the context, and the prompt already requires the model to say when an answer
 * needs something outside the slice.
 */
function assembleNested(
  graph: ExplainGraph,
  parent: GraphComponent,
  selected: GraphNode[],
  limits: Required<ExplainContextOptions>
): { nested: ContextNestedComponent[]; reads: NestedRead[]; notes: string[] } {
  if (limits.maxNestedComponents <= 0 || limits.maxNestedNodes <= 0) {
    return { nested: [], reads: [], notes: [] };
  }

  const candidates = new Map<string, { component: GraphComponent; instanceIds: string[] }>();
  for (const node of selected) {
    if (!isComponentRef(node.type)) continue;
    const target = findComponent(graph, node.type);
    if (!target) continue;
    // A component placed inside itself would read its own interior back. One
    // level deep makes that harmless rather than infinite, but it is still a
    // duplicate of what the reader already has.
    if (target.name === parent.name) continue;
    const entry = candidates.get(target.name);
    if (entry) entry.instanceIds.push(node.id);
    else candidates.set(target.name, { component: target, instanceIds: [node.id] });
  }

  const notes: string[] = [];
  const all = [...candidates.values()];
  const within = all.slice(0, limits.maxNestedComponents);
  if (all.length > within.length) {
    notes.push(
      `${all.length - within.length} further selected component instance(s) were not read from the inside.`
    );
  }

  const reads = within.map((entry) => readInterior(entry.component, entry.instanceIds, limits));
  for (const read of reads) if (read.note) notes.push(read.note);

  return { nested: reads.map((r) => r.section), reads, notes };
}

/**
 * Build the bounded context for one explanation request.
 *
 * `context.nodes` never holds a node from another component. What FIX-001 §1c
 * added is a *separate* section: when a selected node is an instance of another
 * component, that component's interior is read once, bounded, and reported in
 * `context.nested` — where it keeps its own owner, its own bound, and its own
 * meaning for every rule the outer slice already had.
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
  const nodes: ContextNode[] = inDocumentOrder.map((node) => contextNode(node, roles.get(node.id)!, limits));

  // 5b. FIX-001 §1c — the interior of each selected component instance, read
  //     once per component and kept apart from the slice above.
  //
  //     Never at component scope, whatever the bound says: `seeds` there is
  //     *every* node, so an override would open every instance in the component
  //     and the rendered section would announce them as "what the reader
  //     selected" — which at component scope is nothing.
  const nested =
    request.scope === 'component'
      ? { nested: [], reads: [], notes: [] }
      : assembleNested(
          graph,
          component,
          seeds.map((id) => nodesById.get(id)!),
          limits
        );
  notes.push(...nested.notes);

  // 6. Type documentation, once per distinct type, with only the ports this
  //    context references — across the slice *and* every interior read, because
  //    a `Group` documented once for the parent and again for each interior is
  //    how AIX-010 measured 63% of a context going to duplicated port docs.
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
  for (const read of nested.reads) for (const [type, port] of read.portRefs) reference(type, port);

  // The slice's own types first, so a type budget that bites drops interior
  // documentation before it drops documentation for what the user selected.
  const distinctTypes: string[] = [];
  for (const node of inDocumentOrder) if (!distinctTypes.includes(node.type)) distinctTypes.push(node.type);
  for (const read of nested.reads) {
    for (const type of read.types) if (!distinctTypes.includes(type)) distinctTypes.push(type);
  }

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

  const nestedNodeCount = nested.nested.reduce((sum, n) => sum + n.nodes.length, 0);

  return {
    scope: request.scope,
    component: componentShape(component),
    selectedIds: request.scope === 'component' ? [] : seeds,
    nodes,
    connections,
    nodeTypes,
    // Absent, not empty: a caller that reads `context.nested` should be able to
    // tell "nothing was selected that has an interior" from "here are none",
    // and every existing spec that compares whole contexts stays byte-identical.
    ...(nested.nested.length ? { nested: nested.nested } : {}),
    bounds,
    stats: {
      nodeCount: nodes.length,
      connectionCount: connections.length,
      nodeTypeCount: nodeTypes.length,
      ...(nestedNodeCount > 0 ? { nestedNodeCount } : {}),
      renderedChars: 0 // filled in by render()
    }
  };
}
