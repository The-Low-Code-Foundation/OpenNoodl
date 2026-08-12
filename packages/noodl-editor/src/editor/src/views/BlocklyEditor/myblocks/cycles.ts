/**
 * The cycle guard (LGC-007 §3).
 *
 * ⚠️ **The failure this prevents is not an error message.** If A uses B and B uses A, the
 * inliner recurses until the stack goes, inside a 300 ms debounce tick on the renderer
 * thread. What the user sees is the workspace freezing at random, with no console entry that
 * points anywhere near a saved block. That is why this file is small, pure, and has more
 * tests than anything else in the feature.
 *
 * §3 requires the check in **two** places and says why: a definition can be edited after a
 * reference to it was created, so a graph that was acyclic when the call block was dropped can
 * become cyclic later without anything touching the referencing program.
 *
 * - **At save** — `findCycle` over the graph the store *would* have, via `withEdges`. Any
 *   cycle a save can create must pass through the definition being saved (it is the only one
 *   whose out-edges changed), so checking from that one node is sufficient as well as cheap.
 * - **At generate** — `expandWorkspace` keeps the same colouring on its expansion stack, so a
 *   cycle that reached the store some other way (a hand-edited project file, an imported
 *   library, a shelf written by an older build) terminates with a named error instead of a
 *   hang.
 *
 * A cycle is not the only way to hang the inliner; an acyclic definition graph can still
 * expand exponentially. That backstop lives with the inliner, in `expand.ts`.
 *
 * @module BlocklyEditor/myblocks
 */

/**
 * The definition graph, as the guard needs to see it.
 *
 * `edgesOf` returns `undefined` for an id the shelf does not hold — a dangling reference,
 * which is a different fault from a cycle and is reported separately by
 * `findMissingReferences`. The cycle walk treats it as a leaf, so a broken reference cannot
 * mask a cycle elsewhere in the graph.
 */
export interface DefinitionGraph {
  edgesOf(id: string): string[] | undefined;
  nameOf(id: string): string;
}

export class MyBlocksCycleError extends Error {
  /** The cycle, first node repeated at the end: `['a', 'b', 'a']`. */
  readonly path: string[];

  constructor(message: string, path: string[]) {
    super(message);
    this.name = 'MyBlocksCycleError';
    this.path = path;
  }
}

export class MyBlocksMissingDefinitionError extends Error {
  readonly missingId: string;

  constructor(message: string, missingId: string) {
    super(message);
    this.name = 'MyBlocksMissingDefinitionError';
    this.missingId = missingId;
  }
}

/**
 * A read-only view of `graph` in which `id` has the given edges instead of its stored ones.
 *
 * This is what makes the save-time check honest: it asks "would the graph *after* this write
 * contain a cycle", not "does the graph before it". A definition that does not exist yet is
 * covered by the same overlay, because `edgesOf` answers for it and `nameOf` falls through.
 */
export function withEdges(graph: DefinitionGraph, id: string, edges: string[], name?: string): DefinitionGraph {
  return {
    edgesOf(queried: string) {
      return queried === id ? edges : graph.edgesOf(queried);
    },
    nameOf(queried: string) {
      if (queried === id && name !== undefined) return name;
      return graph.nameOf(queried);
    }
  };
}

/**
 * Find a cycle reachable from `startId`, or `null`.
 *
 * Standard three-colour DFS: a node on the current path (grey) that is reached again closes a
 * cycle; a node already fully explored (black) cannot start one and is skipped. The black set
 * is what keeps a wide acyclic graph — the diamond A→B, A→C, B→D, C→D — linear instead of
 * exponential, and it is also the thing a naive implementation gets wrong in the other
 * direction by treating any second visit as a cycle.
 *
 * The returned path starts and ends with the same id, so `describeCycle` can render it
 * without the caller reconstructing the closing edge.
 */
export function findCycle(startId: string, graph: DefinitionGraph): string[] | null {
  const onPath = new Set<string>();
  const finished = new Set<string>();
  const path: string[] = [];

  function visit(id: string): string[] | null {
    if (onPath.has(id)) {
      // Close the cycle at the first occurrence of `id` on the current path.
      const from = path.indexOf(id);
      return path.slice(from).concat(id);
    }
    if (finished.has(id)) return null;

    onPath.add(id);
    path.push(id);

    const edges = graph.edgesOf(id) || [];
    for (const next of edges) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }

    path.pop();
    onPath.delete(id);
    finished.add(id);
    return null;
  }

  return visit(startId);
}

/** `"Total → Subtotal → Total"`, with display names, for a message a builder can act on. */
export function describeCycle(path: string[], graph: DefinitionGraph): string {
  return path.map((id) => graph.nameOf(id)).join(' → ');
}

/**
 * Throw if saving `id` with `edges` would make the graph cyclic.
 *
 * The message names the cycle, which acceptance asks for explicitly. Note that the *first*
 * node in the reported path is not necessarily `id`: if A → B → C → B, the cycle is B → C → B
 * and saying so is more useful than saying it starts at A.
 */
export function assertAcyclic(id: string, edges: string[], graph: DefinitionGraph, name?: string): void {
  const overlaid = withEdges(graph, id, edges, name);
  const cycle = findCycle(id, overlaid);
  if (!cycle) return;

  throw new MyBlocksCycleError(
    `"${overlaid.nameOf(id)}" cannot be saved: it would end up using itself. The loop is ${describeCycle(
      cycle,
      overlaid
    )}.`,
    cycle
  );
}

/**
 * Every id reachable from `startId` that the graph does not hold.
 *
 * A dangling reference is what §4 says must never be left behind by a delete. This finds the
 * ones that got there anyway — an imported library missing a dependency, a project file
 * merged badly — so the generate path can name them instead of emitting silence.
 */
export function findMissingReferences(startId: string, graph: DefinitionGraph): string[] {
  const missing: string[] = [];
  const seen = new Set<string>();

  function visit(id: string): void {
    if (seen.has(id)) return;
    seen.add(id);

    const edges = graph.edgesOf(id);
    if (edges === undefined) {
      missing.push(id);
      return;
    }
    for (const next of edges) visit(next);
  }

  const rootEdges = graph.edgesOf(startId);
  if (rootEdges === undefined) return [startId];
  seen.add(startId);
  for (const next of rootEdges) visit(next);

  return missing;
}
