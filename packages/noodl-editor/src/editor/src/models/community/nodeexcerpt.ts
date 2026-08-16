/**
 * UNI-011 AC2 — the redacted graph excerpt.
 *
 * *"an optional **redacted graph excerpt** (types and wiring; every string, parameter and record
 * replaced)"*. This module is the half that decides what a stranger on a public forum learns
 * about the project the question came from. There is no unsend.
 *
 * ## The rule, and why it is an allow-list rather than a filter
 *
 * ALPHA-007's redactor states the governing distinction in its own header, and it is the right
 * one: *"the allow-list is the real one … the regex redactor is only the second line, for free
 * text."* A regex pass over a graph excerpt would be the wrong instrument entirely — it can only
 * remove the secret shapes somebody thought of, and a component named after a client is not a
 * secret *shape*, it is an ordinary string in an ordinary place.
 *
 * So this module never walks-and-filters. **Every string it emits is chosen from a set the
 * editor owns:**
 *
 * | field | drawn from |
 * |---|---|
 * | `ref` | generated here — `n1`, `n2`, … Never a node id |
 * | `type` | a **resolved library type name**, or one of {@link TYPE_COMPONENT}, {@link TYPE_UNKNOWN} |
 * | `fromPort` / `toPort` | a port the **library** declares for that resolved type, or {@link PORT_HIDDEN} |
 *
 * ⚠️ That is a weaker-sounding property than `postbody.ts`'s *"`Block[]` has no field that could
 * hold markup"*, and it is deliberately stated in the form that can be **checked** rather than
 * argued: collect every string in the output and assert each one is in the closed vocabulary.
 * `tests-unit/uni-011/nodeexcerpt.test.ts` does exactly that, which catches a leak nobody thought
 * to write a secret for — where a search for known secrets can only ever catch the ones on the
 * list.
 *
 * ## The two places a user's own words get into a graph's *structure*
 *
 * 1. 🔴 **A node's type name.** A component instance carries the component's full path as its
 *    type (`/Acme Legal Client Portal/Invoice Row`), and in the v2 format that path *is* the file
 *    path. ALPHA-007 already found this and already solved it — {@link bucketTypeName} is
 *    imported rather than reimplemented, because two copies of a privacy vocabulary is the
 *    failure this phase has already paid for once elsewhere.
 *
 * 2. 🔴 **A port name, which nothing in this codebase had to handle before.** ALPHA-007's payload
 *    is a *histogram* — counts by bucketed type, no wiring — so no port name has ever left this
 *    editor. Wiring is exactly what AC2 adds, and
 *    [`NodeGraphNode.getPorts()`](../nodegraphmodel/NodeGraphNode.ts) is
 *    `type.ports` ++ `this.ports` ++ `this.dynamicports`: the last two are user-authored by
 *    definition, and the *first* is user-authored too whenever the type is a component instance,
 *    because a component's ports are whatever its `Component Inputs` node declares.
 *
 *    Hence the rule below, which composes with (1) rather than sitting beside it: **a port name
 *    survives only when its node's type survived** — a node bucketed to `<component>` or
 *    `<unknown>` publishes no port names at all.
 *
 * ⚠️ **One source of truth, on purpose.** The library is passed as a single map from type name to
 * declared ports, and the resolved-type set is its `keys`. Passing a `Set<string>` of known types
 * *and* a separate port table would be two vocabularies that can disagree — and a port table that
 * knows about a type the type-set does not is precisely the disagreement that publishes a name.
 *
 * Pure: no imports from the editor's models, no I/O, no singletons. `nodequestion.ts` composes,
 * and the caller reads the running editor.
 *
 * @module models/community/nodeexcerpt
 */

import { TYPE_COMPONENT, TYPE_UNKNOWN, bucketTypeName } from '../../utils/report/diagnostics';

export { TYPE_COMPONENT, TYPE_UNKNOWN };

/** Bumped when a reader of a posted excerpt would misread the new shape. */
export const EXCERPT_SCHEMA = 1;

/**
 * A port name that did not clear the allow-list.
 *
 * One sentinel for every hidden port rather than a numbered family: `<port>` twice on the same
 * node says "two ports, both of them yours", which is the whole of what a reader is entitled to.
 * Numbering them would re-introduce a correlatable identifier for nothing.
 */
export const PORT_HIDDEN = '<port>';

/** The node the question is about, when its own type did not clear the allow-list. */
export const REF_PREFIX = 'n';

export interface ExcerptNodeInput {
  id: string;
  typename?: string;
}

export interface ExcerptConnectionInput {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

/**
 * The library, as one table: resolved type name → the ports **the library declares** for it.
 *
 * 🔴 Instance ports (`node.ports`) and dynamic ports (`node.dynamicports`) must not be in here.
 * They are per-instance and user-authored; this table is per-*type* and ours.
 */
export type LibraryPorts = ReadonlyMap<string, ReadonlySet<string>>;

export interface ExcerptOptions {
  /**
   * Omit or pass `null` when the node library has not finished loading. 🔴 **`null` is not
   * "allow everything"** — with no library there is no way to tell our type name from the user's,
   * so every type buckets to `<unknown>` and no port name survives. An excerpt of shape with no
   * names is a poor excerpt; one that guesses is a leak.
   */
  library?: LibraryPorts | null;
  /**
   * How many nodes may appear. The excerpt is a neighbourhood, not a graph.
   *
   * ⚠️ Whatever is dropped is **counted in `omitted`** rather than silently truncated — a reader
   * who cannot see that ten nodes were cut reads the excerpt as the whole story.
   */
  maxNodes?: number;
}

const DEFAULT_MAX_NODES = 24;

export interface ExcerptNode {
  /** `n1`, `n2`, … Positional, generated here, never the project's node id. */
  ref: string;
  /** A resolved library type name, or `<component>` / `<unknown>`. */
  type: string;
  /** Present, and true, on the one node the question is about. */
  focus?: true;
}

export interface ExcerptConnection {
  from: string;
  fromPort: string;
  to: string;
  toPort: string;
}

export interface GraphExcerpt {
  schema: number;
  nodes: ExcerptNode[];
  connections: ExcerptConnection[];
  /** What the cap removed. Zeroes are still reported, so a reader never has to infer them. */
  omitted: { nodes: number; connections: number };
}

/**
 * Whether a port name may be published, given the bucket its node's type landed in.
 *
 * The two conditions are one rule, not two checks that happen to both be here: the port table is
 * keyed by type, so asking it about a type that did not survive is asking the wrong question.
 * `<component>` and `<unknown>` are the two answers that mean *"this name is the user's"*, and a
 * component's ports are the user's for the same reason its name is.
 */
function bucketPortName(bucketedType: string, port: string, library?: LibraryPorts | null): string {
  if (!library) return PORT_HIDDEN;
  if (bucketedType === TYPE_COMPONENT || bucketedType === TYPE_UNKNOWN) return PORT_HIDDEN;
  const declared = library.get(bucketedType);
  if (!declared || !declared.has(port)) return PORT_HIDDEN;
  return port;
}

/**
 * The neighbourhood of `focusId`: the node itself, plus every node one wire away.
 *
 * Radius 1 because the question is about *this* node. A wider excerpt is a larger disclosure
 * bought with information the reader did not ask for, and the composer already says which
 * component the node is in — as a count, never as a name.
 */
function neighbourhood(
  focusId: string,
  connections: readonly ExcerptConnectionInput[],
  byId: ReadonlyMap<string, ExcerptNodeInput>
): string[] {
  const picked: string[] = [];
  const seen = new Set<string>();

  const take = (id: string) => {
    if (seen.has(id) || !byId.has(id)) return;
    seen.add(id);
    picked.push(id);
  };

  take(focusId);
  // Connection order, so the same graph always produces the same excerpt. An excerpt whose node
  // numbering moved between two runs would make two postings of the same question look different.
  for (const connection of connections) {
    if (connection.fromId === focusId) take(connection.toId);
    else if (connection.toId === focusId) take(connection.fromId);
  }

  return picked;
}

/**
 * Build the excerpt.
 *
 * Returns `null` when the focus node is not in `nodes` — an excerpt with no focus is not a
 * smaller excerpt, it is a different thing, and a composer that received one would caption it
 * wrongly.
 */
export function buildGraphExcerpt(
  focusId: string,
  nodes: readonly ExcerptNodeInput[],
  connections: readonly ExcerptConnectionInput[],
  options: ExcerptOptions = {}
): GraphExcerpt | null {
  const byId = new Map<string, ExcerptNodeInput>();
  for (const node of nodes) if (node && node.id) byId.set(node.id, node);
  if (!byId.has(focusId)) return null;

  const library = options.library ?? null;
  // The resolved-type set IS the port table's key set. Two structures here is two vocabularies.
  //
  // 🔴 An EMPTY SET, never `null`, when there is no library — and the difference is the whole of
  // this line. `bucketTypeName(name, null)` returns the type name **verbatim**: ALPHA-007's own
  // header names that branch and accepts it (*"omit to skip the check … the library has not
  // finished loading"*), which is a defensible call for a GitHub issue the user deliberately
  // filed about a bug in our editor. It is not defensible here. The branch is reachable — the
  // node library arrives asynchronously, which `NodeGraphNode.getPorts()` documents at length —
  // and an unresolved type name can be a node from the user's own private module. An empty set
  // is the strict reading of the same helper: everything the library cannot vouch for becomes
  // `<unknown>`. ⚠️ Do not "simplify" this back to `null`; it reads like the same thing.
  const knownTypes = library ? new Set(library.keys()) : new Set<string>();

  const maxNodes = Math.max(1, options.maxNodes ?? DEFAULT_MAX_NODES);
  const selected = neighbourhood(focusId, connections, byId);
  const kept = selected.slice(0, maxNodes);
  const keptSet = new Set(kept);

  const refById = new Map<string, string>();
  const excerptNodes: ExcerptNode[] = kept.map((id, index) => {
    const ref = `${REF_PREFIX}${index + 1}`;
    refById.set(id, ref);
    const node: ExcerptNode = { ref, type: bucketTypeName(byId.get(id)?.typename, knownTypes) };
    if (id === focusId) node.focus = true;
    return node;
  });

  const bucketFor = new Map<string, string>();
  for (let index = 0; index < kept.length; index++) bucketFor.set(kept[index], excerptNodes[index].type);

  const excerptConnections: ExcerptConnection[] = [];
  let omittedConnections = 0;
  for (const connection of connections) {
    if (!keptSet.has(connection.fromId) || !keptSet.has(connection.toId)) {
      // Only count a wire as omitted when it touched the neighbourhood at all; the rest of the
      // graph's wiring was never in scope and reporting it as "omitted" would overstate the cut.
      if (keptSet.has(connection.fromId) || keptSet.has(connection.toId)) omittedConnections++;
      continue;
    }
    excerptConnections.push({
      from: refById.get(connection.fromId) as string,
      fromPort: bucketPortName(bucketFor.get(connection.fromId) as string, connection.fromProperty, library),
      to: refById.get(connection.toId) as string,
      toPort: bucketPortName(bucketFor.get(connection.toId) as string, connection.toProperty, library)
    });
  }

  return {
    schema: EXCERPT_SCHEMA,
    nodes: excerptNodes,
    connections: excerptConnections,
    omitted: { nodes: selected.length - kept.length, connections: omittedConnections }
  };
}

/**
 * The excerpt as the text that actually gets posted.
 *
 * ⚠️ **This is the string the composer shows AND the string it sends** — not a rendering of the
 * model beside a separate serialisation of it. AC2 requires that *"what it will send is shown
 * before it sends"*, and two code paths that agree today are the shape that stops agreeing.
 */
export function formatGraphExcerpt(excerpt: GraphExcerpt): string {
  const lines: string[] = [];
  for (const node of excerpt.nodes) {
    lines.push(`${node.ref}: ${node.type}${node.focus ? '   <- this node' : ''}`);
  }
  if (excerpt.connections.length) {
    lines.push('');
    for (const connection of excerpt.connections) {
      lines.push(`${connection.from}.${connection.fromPort} -> ${connection.to}.${connection.toPort}`);
    }
  }
  if (excerpt.omitted.nodes || excerpt.omitted.connections) {
    lines.push('');
    lines.push(`(${excerpt.omitted.nodes} more nodes and ${excerpt.omitted.connections} more wires not shown)`);
  }
  return lines.join('\n');
}

/**
 * Every string the excerpt publishes, for a caller that wants to check the vocabulary.
 *
 * Exported because the property this module claims is *"every string is drawn from a set the
 * editor owns"*, and a claim about every string wants an enumeration of them rather than a reader
 * who trusts the field list above to still be complete.
 */
export function excerptStrings(excerpt: GraphExcerpt): string[] {
  const out: string[] = [];
  for (const node of excerpt.nodes) out.push(node.ref, node.type);
  for (const connection of excerpt.connections) {
    out.push(connection.from, connection.fromPort, connection.to, connection.toPort);
  }
  return out;
}
