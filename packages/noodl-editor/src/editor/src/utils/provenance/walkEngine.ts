/**
 * OBS-002 — the provenance walk engine.
 *
 * A pure computation over two inputs: the **topology** (what should be connected) and the
 * **trace** (what actually fired). Everything the panel renders comes from here; nothing here
 * knows the panel exists. No editor singletons, no `EventDispatcher`, no React, no imports at
 * all — that is a hard constraint, because OBS-004 runs this same code inside an MCP server
 * with no renderer around it, and because the phase-4 lineage panel's bugs were mostly
 * selection-timing races rather than lineage bugs.
 *
 * ⚠️ **THE FAILURE THIS FILE EXISTS TO AVOID.** The retired Data Lineage panel answered this
 * exact question and produced 40+ "upstream" steps for a three-node chain, because it
 * **enumerated ports instead of following wires** — every unconnected input counted as a
 * source, and signal/style/metadata ports were swept in with the data ports. See
 * `dev-docs/future-projects/DETERMINISTIC-LINEAGE-SUBSTRATE.md`. Two rules here keep that from
 * recurring, and both are load-bearing:
 *
 *  1. **Only declared edges are ever followed.** The topology is the runtime's own edge list
 *     (`SessionDictionary.edges`, built off `_outputList[].connections`), so a port with no
 *     wire is not a step — it is nothing. An unconnected port cannot enter the tree because
 *     the tree is built from edges, never from ports.
 *
 *  2. **A hop that fired is a leaf.** In structural mode the walk stops descending the moment
 *     it reaches something that emitted. That is not a display cap — it is the answer. The
 *     ✓/✕ frontier *is* the bug, so expanding past it would be expanding past the thing the
 *     user asked for.
 *
 * And where a trace exists, {@link backwardWalk} does not fan out at all: `cause` names the one
 * edge that actually delivered the value, so the walk is a chain rather than a search. Layer 2
 * therefore **prunes** the tree, it does not merely annotate it.
 *
 * The three annotation layers of the spec map onto the fields of {@link WalkRow}: layer 1 is
 * `currentValue` (needs nothing to have fired), layer 2 is `status`/`event`/`fireCount`, layer
 * 3 is `warnings` (filled by OBS-003 when it lands; the field is here so the row shape does not
 * change under the panel later).
 */

// ---------------------------------------------------------------------------
// Inputs
//
// These mirror `SessionDictionary` and `WireTraceEvent` in noodl-runtime's `tracebuffer.ts`.
// They are re-declared structurally rather than imported because this module must stay
// import-free (see the header); TypeScript's structural typing means a real `WireTraceEvent`
// satisfies `TraceEventLike` with no adapter.
// ---------------------------------------------------------------------------

export interface NodeInfo {
  name: string;
  type: string;
  component: string;
}

export interface EdgeRef {
  node: string;
  port: string;
}

export interface Edge {
  from: EdgeRef;
  to: EdgeRef;
}

export interface Topology {
  nodes: Record<string, NodeInfo>;
  edges: Edge[];
}

export interface TraceEventLike {
  seq: number;
  t: number;
  /** The `seq` of the event that delivered the input being processed when this was emitted. */
  cause: number;
  from: EdgeRef;
  to: EdgeRef;
  value: string;
  kind: 'value' | 'signal';
}

export type PortDirection = 'input' | 'output';

/** A port, addressed unambiguously. See {@link valueKey} for why the direction is not optional. */
export interface PortRef extends EdgeRef {
  direction: PortDirection;
}

/** Current values for ports, keyed by {@link valueKey}. Layer 1; independent of the trace. */
export type PortValues = Record<string, string>;

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Whether this hop carried anything.
 *
 * ⚠️ `unknown` is not a synonym for `never-fired`. With no trace loaded we know nothing about
 * firing, and saying "never fired" there would be a confident wrong answer of exactly the kind
 * that got the last panel retired. It also changes the walk's shape: `never-fired` prunes (a
 * fired hop is a leaf), `unknown` cannot prune and falls back to the depth cap.
 */
export type HopStatus = 'fired' | 'never-fired' | 'unknown';

export interface WalkRow {
  /** Stable identity for React keys and for addressing a row from outside. */
  id: string;
  /** The port this row is about. The root row is the symptom; every other row is an edge source. */
  ref: EdgeRef;
  direction: 'input' | 'output';
  /** `undefined` on the root row, which is a port rather than an edge. */
  edge?: Edge;
  status: HopStatus;
  /** The most recent event on this edge, which is what a collapsed aggregate row shows. */
  event?: TraceEventLike;
  /** How many times this edge fired. `> 1` is the aggregation case — one row, not 100. */
  fireCount: number;
  /** Layer 1. The port's value *right now*, present even when nothing has ever fired. */
  currentValue?: string;
  /** Layer 3 (OBS-003). Node-local invariant violations attached to this row's node. */
  warnings: string[];
  children: WalkRow[];
  /** Why this row has no children despite having upstream edges. */
  truncated?: 'depth' | 'cycle' | 'fired' | 'root';
  depth: number;
}

export interface WalkResult {
  root: WalkRow;
  /** `causal` followed the trace's `cause` chain; `structural` followed declared wires. */
  mode: 'causal' | 'structural';
  /** Total rows produced, so a caller can say "resolved in N rows" without walking it again. */
  rowCount: number;
  /**
   * The frontier: rows whose status is `never-fired` and whose upstream all fired (or which
   * have no upstream at all). **This is the answer to "where did it stop?"** — the panel
   * highlights these rather than making the user scan for the ✓/✕ transition.
   */
  boundary: WalkRow[];
}

export interface WalkOptions {
  /** Depth cap. Only actually reached when there is no trace to prune with. */
  maxDepth?: number;
  /**
   * Per-row cap on how many upstream edges are expanded, so one hub node cannot produce a
   * wall of rows. Rows beyond it are dropped and the parent is marked truncated.
   */
  maxFanOut?: number;
}

const DEFAULT_MAX_DEPTH = 24;
const DEFAULT_MAX_FAN_OUT = 12;

// ---------------------------------------------------------------------------
// Keys and indexes
// ---------------------------------------------------------------------------

/**
 * `node|port`. The delimiter is `|` because node ids are guids and ports are identifiers.
 *
 * Safe for the topology indexes only, where the direction is implied by which map the key is
 * in (`byTarget` holds inputs, `bySource` holds outputs). Anywhere both directions share a
 * namespace, use {@link valueKey} instead.
 */
export function portKey(ref: EdgeRef): string {
  return ref.node + '|' + ref.port;
}

/**
 * `node|port|direction`.
 *
 * ⚠️ **A node's input and output may share a name, and on the nodes that matter most they
 * always do.** `Component Inputs`/`Component Outputs` re-emit `Result` as `Result`, and a
 * `Variable` has both an input and an output called `Value` — so a direction-blind key makes
 * a node's own output look like its own input. That collision silently truncated every walk
 * that crossed a component boundary and every walk through a Variable, which is to say most
 * of them: the cycle guard saw the port it had just come from and stopped one hop in.
 */
export function valueKey(ref: EdgeRef, direction: PortDirection): string {
  return ref.node + '|' + ref.port + '|' + direction;
}

export function edgeKey(edge: Edge): string {
  return portKey(edge.from) + '->' + portKey(edge.to);
}

/**
 * Precomputed lookups over one topology + trace pair.
 *
 * Built once per walk rather than per row: a 300-node project has a few thousand edges, and
 * the backward walk touches a handful of them, so scanning the edge list per row would make
 * an O(rows) walk O(rows × edges) for no reason.
 */
export interface WalkIndex {
  topology: Topology;
  /** Edges arriving at a port, keyed by {@link portKey} of `to`. */
  byTarget: Map<string, Edge[]>;
  /** Edges leaving a port, keyed by {@link portKey} of `from`. */
  bySource: Map<string, Edge[]>;
  /** Input ports of a node that have at least one incoming edge, keyed by node id. */
  connectedInputs: Map<string, string[]>;
  /** Every event on an edge, oldest first, keyed by {@link edgeKey}. */
  eventsByEdge: Map<string, TraceEventLike[]>;
  /** Events by `seq`, for resolving `cause`. */
  bySeq: Map<number, TraceEventLike>;
  /** Direct causal children, keyed by the parent's `seq`. `0` holds the roots. */
  effects: Map<number, TraceEventLike[]>;
  /** False when no trace has been loaded, which is what makes status `unknown`. */
  hasTrace: boolean;
  portValues: PortValues;
}

export function buildIndex(topology: Topology, events: TraceEventLike[], portValues: PortValues = {}): WalkIndex {
  const byTarget = new Map<string, Edge[]>();
  const bySource = new Map<string, Edge[]>();
  const connectedInputs = new Map<string, string[]>();

  for (const edge of topology.edges) {
    const tKey = portKey(edge.to);
    const sKey = portKey(edge.from);

    const arrivals = byTarget.get(tKey);
    if (arrivals) arrivals.push(edge);
    else byTarget.set(tKey, [edge]);

    const departures = bySource.get(sKey);
    if (departures) departures.push(edge);
    else bySource.set(sKey, [edge]);

    let inputs = connectedInputs.get(edge.to.node);
    if (!inputs) {
      inputs = [];
      connectedInputs.set(edge.to.node, inputs);
    }
    if (inputs.indexOf(edge.to.port) === -1) inputs.push(edge.to.port);
  }

  const eventsByEdge = new Map<string, TraceEventLike[]>();
  const bySeq = new Map<number, TraceEventLike>();
  const effects = new Map<number, TraceEventLike[]>();

  for (const event of events) {
    const key = portKey(event.from) + '->' + portKey(event.to);
    const onEdge = eventsByEdge.get(key);
    if (onEdge) onEdge.push(event);
    else eventsByEdge.set(key, [event]);

    bySeq.set(event.seq, event);

    const siblings = effects.get(event.cause);
    if (siblings) siblings.push(event);
    else effects.set(event.cause, [event]);
  }

  return {
    topology,
    byTarget,
    bySource,
    connectedInputs,
    eventsByEdge,
    bySeq,
    effects,
    hasTrace: events.length > 0,
    portValues
  };
}

// ---------------------------------------------------------------------------
// Naming — the dictionary is the only source, so a consumer needs no project access
// ---------------------------------------------------------------------------

export function describeNode(index: WalkIndex, nodeId: string): NodeInfo {
  const info = index.topology.nodes[nodeId];
  if (info) return info;
  // A node in the trace but not the dictionary means the graph changed under a live trace.
  // Rendering the id beats dropping the row: the row is still a real thing that fired.
  return { name: nodeId, type: '', component: '' };
}

/** `Variable "cart".Value` — the row label of the spec's worked example. */
export function labelFor(index: WalkIndex, ref: EdgeRef): string {
  const info = describeNode(index, ref.node);
  const name = info.name || info.type || ref.node;
  return name + '.' + ref.port;
}

// ---------------------------------------------------------------------------
// The backward walk — "why is this empty?"
// ---------------------------------------------------------------------------

/**
 * Walk backwards from a port the user pointed at.
 *
 * Two modes, chosen by the data rather than by the caller:
 *
 * - **causal** — the target port has received at least one traced event, so `cause` names the
 *   exact edge that delivered it. The walk follows that chain and produces one row per hop with
 *   no branching whatsoever. This is the ≤10-rows-on-a-300-node-project case.
 * - **structural** — nothing arrived (which is usually the complaint), so there is no causal
 *   chain to follow and the walk follows declared wires instead, pruning at the first hop that
 *   did fire.
 *
 * Both are the same tree shape, so the panel renders one thing.
 */
export function backwardWalk(index: WalkIndex, target: EdgeRef, options: WalkOptions = {}): WalkResult {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxFanOut = options.maxFanOut ?? DEFAULT_MAX_FAN_OUT;

  const arrivals = index.byTarget.get(portKey(target)) || [];
  const lastArrival = latestEventOnAnyEdge(index, arrivals);

  const root: WalkRow = {
    id: 'root:' + valueKey(target, 'input'),
    ref: target,
    direction: 'input',
    status: statusOf(index, arrivals),
    fireCount: countOn(index, arrivals),
    event: lastArrival,
    currentValue: index.portValues[valueKey(target, 'input')],
    warnings: [],
    children: [],
    depth: 0
  };

  const mode: WalkResult['mode'] = lastArrival ? 'causal' : 'structural';

  if (mode === 'causal') {
    // `lastArrival` is the edge that delivered the value sitting on this port. Everything
    // upstream of it is the cause chain, which is exact and linear.
    appendCauseChain(index, root, lastArrival, maxDepth);
  } else {
    expandStructural(index, root, arrivals, new Set([valueKey(target, 'input')]), 1, maxDepth, maxFanOut);
  }

  const boundary: WalkRow[] = [];
  let rowCount = 0;
  forEachRow(root, (row) => {
    rowCount++;
    if (isBoundary(row)) boundary.push(row);
  });

  return { root, mode, rowCount, boundary };
}

/**
 * A row is on the frontier when it did not fire but everything feeding it did (or nothing
 * feeds it at all). That is the "reached and emitted nothing" node — the answer.
 */
function isBoundary(row: WalkRow): boolean {
  if (row.status !== 'never-fired') return false;
  if (row.children.length === 0) return true;
  return row.children.every((child) => child.status === 'fired');
}

/**
 * Follow `cause` backwards. Each event's cause is a single event, so this is a chain and can
 * never fan out; `cause === 0` means a root — a timer, a DOM event, boot — and terminates it.
 */
function appendCauseChain(index: WalkIndex, parent: WalkRow, event: TraceEventLike, maxDepth: number): void {
  let current: TraceEventLike | undefined = event;
  let row = parent;
  let depth = 1;
  const seen = new Set<number>();

  while (current && depth <= maxDepth) {
    if (seen.has(current.seq)) {
      row.truncated = 'cycle';
      return;
    }
    seen.add(current.seq);

    const edge: Edge = { from: current.from, to: current.to };
    const key = edgeKey(edge);
    const onEdge = index.eventsByEdge.get(key) || [];

    const hop: WalkRow = {
      id: 'hop:' + key + ':' + current.seq,
      ref: current.from,
      direction: 'output',
      edge,
      status: 'fired',
      event: current,
      fireCount: onEdge.length,
      currentValue: index.portValues[valueKey(current.from, 'output')],
      warnings: [],
      children: [],
      depth
    };
    row.children.push(hop);

    if (current.cause === 0) {
      hop.truncated = 'root';
      return;
    }

    const next = index.bySeq.get(current.cause);
    if (!next) {
      // The causing event has aged out of the ring buffer. Say so by leaving the chain open
      // rather than silently presenting a truncated chain as complete.
      hop.truncated = 'depth';
      return;
    }

    row = hop;
    current = next;
    depth++;
  }

  if (current) row.truncated = 'depth';
}

/**
 * Follow declared wires backwards, pruning at the first hop that fired.
 *
 * `visited` is keyed by port, not by node: the same node legitimately appears twice in a walk
 * via two different ports, and collapsing those would hide a real path. It is also the cycle
 * guard — Noodl graphs can contain feedback loops.
 */
function expandStructural(
  index: WalkIndex,
  parent: WalkRow,
  arrivals: Edge[],
  visited: Set<string>,
  depth: number,
  maxDepth: number,
  maxFanOut: number
): void {
  if (arrivals.length === 0) return;
  if (depth > maxDepth) {
    parent.truncated = 'depth';
    return;
  }

  const expanded = arrivals.slice(0, maxFanOut);
  if (expanded.length < arrivals.length) parent.truncated = 'depth';

  for (const edge of expanded) {
    const sourceKey = valueKey(edge.from, 'output');
    const onEdge = index.eventsByEdge.get(edgeKey(edge)) || [];
    const fired = onEdge.length > 0;

    const hop: WalkRow = {
      id: 'hop:' + edgeKey(edge),
      ref: edge.from,
      direction: 'output',
      edge,
      status: index.hasTrace ? (fired ? 'fired' : 'never-fired') : 'unknown',
      event: onEdge.length ? onEdge[onEdge.length - 1] : undefined,
      fireCount: onEdge.length,
      currentValue: index.portValues[sourceKey],
      warnings: [],
      children: [],
      depth
    };
    parent.children.push(hop);

    // ⚠️ The pruning rule. A hop that fired is the end of the story on this branch: the
    // question was where the data stopped, and it did not stop here.
    if (fired) {
      hop.truncated = 'fired';
      continue;
    }

    if (visited.has(sourceKey)) {
      hop.truncated = 'cycle';
      continue;
    }
    const branchVisited = new Set(visited);
    branchVisited.add(sourceKey);

    // From an output port, step *inside* the node to the inputs that feed it. The runtime
    // publishes no node-internal dataflow, so every connected input is a candidate — but
    // only ports with a real incoming wire, which is what keeps this from becoming the port
    // enumeration that sank the last attempt.
    for (const inputPort of index.connectedInputs.get(edge.from.node) || []) {
      const inputRef: EdgeRef = { node: edge.from.node, port: inputPort };
      const inputKey = valueKey(inputRef, 'input');
      if (branchVisited.has(inputKey)) {
        // Coming back to a port already on this path is a feedback loop. Say so on the row
        // rather than dropping the branch silently — a walk that just stops looks identical
        // to a walk that finished.
        hop.truncated = 'cycle';
        continue;
      }
      branchVisited.add(inputKey);

      const feeding = index.byTarget.get(portKey(inputRef)) || [];
      const inputRow: WalkRow = {
        id: 'in:' + inputKey,
        ref: inputRef,
        direction: 'input',
        status: statusOf(index, feeding),
        fireCount: countOn(index, feeding),
        event: latestEventOnAnyEdge(index, feeding),
        currentValue: index.portValues[inputKey],
        warnings: [],
        children: [],
        depth: depth + 1
      };
      hop.children.push(inputRow);

      expandStructural(index, inputRow, feeding, branchVisited, depth + 2, maxDepth, maxFanOut);
    }
  }
}

function statusOf(index: WalkIndex, edges: Edge[]): HopStatus {
  if (!index.hasTrace) return 'unknown';
  for (const edge of edges) {
    const onEdge = index.eventsByEdge.get(edgeKey(edge));
    if (onEdge && onEdge.length) return 'fired';
  }
  return 'never-fired';
}

function countOn(index: WalkIndex, edges: Edge[]): number {
  let total = 0;
  for (const edge of edges) {
    const onEdge = index.eventsByEdge.get(edgeKey(edge));
    if (onEdge) total += onEdge.length;
  }
  return total;
}

function latestEventOnAnyEdge(index: WalkIndex, edges: Edge[]): TraceEventLike | undefined {
  let latest: TraceEventLike | undefined;
  for (const edge of edges) {
    const onEdge = index.eventsByEdge.get(edgeKey(edge));
    if (!onEdge || !onEdge.length) continue;
    const candidate = onEdge[onEdge.length - 1];
    if (!latest || candidate.seq > latest.seq) latest = candidate;
  }
  return latest;
}

/**
 * Depth-first over a walk, parents before children.
 *
 * ⚠️ Deliberately not `forEachRecursive`-shaped: the editor's own recursive helper treats a
 * truthy return from the visitor as "stop", which has caused bugs elsewhere in this codebase.
 * This one ignores the return value entirely.
 */
export function forEachRow(row: WalkRow, visit: (row: WalkRow) => void): void {
  visit(row);
  for (const child of row.children) forEachRow(child, visit);
}

// ---------------------------------------------------------------------------
// The forward walk — "where did my click go?"
// ---------------------------------------------------------------------------

export interface RootEvent {
  event: TraceEventLike;
  /** How many events are in this root's causal tree, including itself. */
  size: number;
}

/**
 * The events with no cause — actual interactions, timers, boot.
 *
 * This is the list the forward panel shows, and it is short by construction: a click produces
 * one root and a cascade of hundreds of descendants, so listing roots rather than events is
 * what keeps the surface a handful of rows instead of the firehose.
 */
export function rootEvents(index: WalkIndex): RootEvent[] {
  const roots = index.effects.get(0) || [];
  return roots.map((event) => ({ event, size: causalTreeSize(index, event) }));
}

function causalTreeSize(index: WalkIndex, event: TraceEventLike): number {
  let total = 0;
  const stack: TraceEventLike[] = [event];
  const seen = new Set<number>();
  while (stack.length) {
    const current = stack.pop() as TraceEventLike;
    if (seen.has(current.seq)) continue;
    seen.add(current.seq);
    total++;
    for (const child of index.effects.get(current.seq) || []) stack.push(child);
  }
  return total;
}

/**
 * Filter-by-cause: everything downstream of one event, as a tree.
 *
 * The spec calls this the filter that matters, and it is a tree walk over an index that
 * OBS-001 already stamps — one click on "add to cart" collapses the whole app's firehose to
 * that chain, with no filtering pass over the buffer at all.
 */
export function forwardWalk(index: WalkIndex, from: TraceEventLike, options: WalkOptions = {}): WalkResult {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxFanOut = options.maxFanOut ?? DEFAULT_MAX_FAN_OUT;

  const build = (event: TraceEventLike, depth: number, seen: Set<number>): WalkRow => {
    const edge: Edge = { from: event.from, to: event.to };
    const key = edgeKey(edge);
    const row: WalkRow = {
      id: 'fwd:' + key + ':' + event.seq,
      ref: event.to,
      direction: 'input',
      edge,
      status: 'fired',
      event,
      fireCount: (index.eventsByEdge.get(key) || []).length,
      currentValue: index.portValues[valueKey(event.to, 'input')],
      warnings: [],
      children: [],
      depth
    };

    if (depth >= maxDepth) {
      row.truncated = 'depth';
      return row;
    }

    const effects = index.effects.get(event.seq) || [];
    const shown = effects.slice(0, maxFanOut);
    if (shown.length < effects.length) row.truncated = 'depth';

    for (const effect of shown) {
      if (seen.has(effect.seq)) {
        row.truncated = 'cycle';
        continue;
      }
      seen.add(effect.seq);
      row.children.push(build(effect, depth + 1, seen));
    }
    return row;
  };

  const root = build(from, 0, new Set([from.seq]));

  let rowCount = 0;
  forEachRow(root, () => rowCount++);

  // The terminus is the answer in a forward walk: it is where the cascade stopped. Rows with
  // no effects are the leaves, and `isBoundary` does not apply because everything here fired.
  const boundary: WalkRow[] = [];
  forEachRow(root, (row) => {
    if (row.children.length === 0) boundary.push(row);
  });

  return { root, mode: 'causal', rowCount, boundary };
}

/**
 * Why a forward walk's terminus is suspicious, checked against the topology rather than guessed.
 *
 * "`Array Push.Do` fired. Its `Items` output has 2 connections. Neither carried a value." The
 * check is: this node was reached, it has outgoing wires, and none of them fired.
 */
export function explainTerminus(index: WalkIndex, row: WalkRow): string | undefined {
  const nodeId = row.ref.node;
  const outgoing: Edge[] = [];
  for (const edge of index.topology.edges) {
    if (edge.from.node === nodeId) outgoing.push(edge);
  }
  if (outgoing.length === 0) return undefined;

  const silent = outgoing.filter((edge) => !(index.eventsByEdge.get(edgeKey(edge)) || []).length);
  if (silent.length === 0) return undefined;

  const info = describeNode(index, nodeId);
  const name = info.name || info.type || nodeId;
  const ports = Array.from(new Set(silent.map((edge) => edge.from.port)));
  const portList = ports.length === 1 ? `Its \`${ports[0]}\` output` : `Its ${ports.length} outputs`;
  const carried = silent.length === outgoing.length ? 'None of them carried a value.' : 'Some carried nothing.';
  return `${name} fired. ${portList} ${silent.length === 1 ? 'has 1 connection' : `has ${silent.length} connections`}. ${carried}`;
}

// ---------------------------------------------------------------------------
// Ports the walk needs current values for (layer 1)
// ---------------------------------------------------------------------------

/**
 * Every port a walk from `target` could show, so the editor can ask the runtime for their
 * current values in **one** round trip instead of one per row.
 *
 * Computed from the topology alone and capped by the same depth budget, so it works before any
 * walk has been rendered and before anything has fired.
 */
export function portsToResolve(index: WalkIndex, target: EdgeRef, options: WalkOptions = {}): PortRef[] {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const out: PortRef[] = [];
  const seen = new Set<string>();

  const push = (ref: EdgeRef, direction: PortDirection) => {
    const key = valueKey(ref, direction);
    if (seen.has(key)) return false;
    seen.add(key);
    out.push({ node: ref.node, port: ref.port, direction });
    return true;
  };

  push(target, 'input');
  const frontier: Array<{ ref: EdgeRef; depth: number }> = [{ ref: target, depth: 0 }];

  while (frontier.length) {
    const { ref, depth } = frontier.shift() as { ref: EdgeRef; depth: number };
    if (depth >= maxDepth) continue;

    for (const edge of index.byTarget.get(portKey(ref)) || []) {
      if (!push(edge.from, 'output')) continue;
      for (const inputPort of index.connectedInputs.get(edge.from.node) || []) {
        const inputRef: EdgeRef = { node: edge.from.node, port: inputPort };
        if (!push(inputRef, 'input')) continue;
        frontier.push({ ref: inputRef, depth: depth + 1 });
      }
    }
  }

  return out;
}
