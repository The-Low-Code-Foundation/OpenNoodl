/**
 * FIX-014 — the layout pass for AI-authored nodes.
 *
 * There is no layout algorithm anywhere else in the product: `x`/`y` are
 * whatever the model typed, copied verbatim, and omitted values become
 * `undefined` — which the canvas draws stacked at the origin. This module is
 * the one pass both producers of the project format run over an authored
 * graph, shared the same way `prompts/traps` and `pageRegistration` are: a
 * pure module in the editor, re-exported to `noodl-mcp` through
 * `editor-deps.ts`, so the two doors cannot drift.
 *
 * ## The ruling (2026-08-14): model-supplied `x`/`y` is AUTHORITATIVE
 *
 * The pass fills gaps and resolves collisions ONLY:
 *
 *  - A node whose `x` and `y` are both present is never assigned a position.
 *    The single exception is two nodes emitted at *identical* coordinates —
 *    the first occupant keeps the spot, later ones are stepped down by
 *    `COLLISION_STEP` — because a perfect overlap is unreadable and no
 *    arrangement can have meant it. ⚠️ This breaks the *tie*; it does not
 *    promise the nodes no longer touch. The pass is never given node sizes.
 *  - A node named in `lockedIds` — the caller's record of positions that
 *    predate this write, i.e. a human's arrangement — is never touched at
 *    all, not even to separate a collision. It still occupies its coordinates
 *    and still anchors the columns. This is what makes `update_component` on
 *    a hand-arranged component reposition nothing unless explicitly asked.
 *  - A node missing either coordinate is a gap, and gaps get the two-column
 *    layout: the visual tree flows down a left column, indented by hierarchy
 *    depth; logic nodes sit in a right column beside the visual node they
 *    feed.
 *
 * ## Open calls, decided here
 *
 *  - **Logic column offset:** `maxVisualX + LOGIC_COLUMN_GUTTER`, not a fixed
 *    x — a fixed column collides with any visual arrangement wider than the
 *    constant, and the whole point of the pass is to respect what is already
 *    placed. When no visual node has an `x` at all (an all-logic component),
 *    the "right column" IS the left column: logic flows down from the top.
 *  - **Comments do not participate.** Canvas annotations live in
 *    `nodes.json`'s separate `comments` array, are not `NodeV2`s, are not
 *    submit-expressible in either client, and are carried verbatim from the
 *    base — this pass never sees them and never moves them.
 *  - **Tree membership beats the predicate.** A node whose type the catalog
 *    has never heard of (a component instance) but which carries a `parent`
 *    or `children` is in the visual tree — containment is a visual-only
 *    concept in this format, and the catalog predicate answers `false` for
 *    every instance by construction (`catalogVisualPredicate`).
 *  - **Half-positioned is unpositioned.** A node with `x` but no `y` (or the
 *    reverse) would draw at the origin on the missing axis; it gets both
 *    coordinates assigned.
 *
 * Deterministic, and never mutates its input: nodes are returned as copies,
 * in the same order they arrived.
 *
 * @module AiAssistant/authoring/layout
 */

import type { NodeV2 } from '../../../schemas';

/** The two endpoints are all the pass reads; either client's connection shape satisfies it. */
export interface LayoutConnectionLike {
  fromId: string;
  toId: string;
}

export interface LayoutAuthoredNodesOptions {
  /** Used to order the logic column: a logic node sits beside the first node it feeds. */
  connections?: readonly LayoutConnectionLike[];
  /**
   * Node ids whose positions predate this write — a human's (or an earlier
   * turn's) arrangement. Never assigned, never nudged; still occupy their
   * coordinates. Compute with {@link positionsUnchangedFrom}.
   */
  lockedIds?: ReadonlySet<string>;
}

/** Where the visual column starts. */
export const VISUAL_COLUMN_X = 40;
export const VISUAL_COLUMN_TOP = 40;
/** Horizontal indent per level of visual-tree depth. */
export const HIERARCHY_INDENT_X = 60;
/** Vertical distance between consecutively placed nodes. */
export const ROW_SPACING = 120;
/** Gap between the widest visual x and the logic column. */
export const LOGIC_COLUMN_GUTTER = 250;
/**
 * Step used to separate two nodes emitted at identical coordinates.
 *
 * `ROW_SPACING`, not a smaller nudge: this pass is size-blind by design, so the
 * step is the only lever it has over visual clearance. Measured node heights on
 * a real canvas run 64–190px, which is why the original 40 left "separated"
 * nodes visibly overlapping. 120 clears the common case; it cannot *guarantee*
 * clearance, because a 190px node still overlaps at 120. See the promise stated
 * at the collision block below — the pass breaks exact ties, it does not
 * guarantee non-overlap.
 *
 * 🔴 **The floor is not decoration.** `ROW_SPACING` and this constant have
 * different jobs — one is layout *rhythm*, this one is *clearance* — and they
 * are equal today only by coincidence of value. Tightening rows for density
 * (120 → 100 is a plausible visual tweak) would otherwise silently cut
 * clearance and re-open the defect this constant was raised to close. Whatever
 * happens to `ROW_SPACING`, this may not fall below `COLLISION_STEP_FLOOR`.
 */
export const COLLISION_STEP_FLOOR = 120;
export const COLLISION_STEP = Math.max(ROW_SPACING, COLLISION_STEP_FLOOR);

const hasPosition = (n: NodeV2): boolean => n.x !== undefined && n.y !== undefined;

/**
 * The ids whose submitted position is exactly the baseline's — positions this
 * write did not touch, which the ruling says the pass must not either. A node
 * absent from the baseline, or whose position changed, or whose baseline
 * position was never set (nobody arranged it), is not locked.
 */
export function positionsUnchangedFrom(nodes: readonly NodeV2[], baseline: readonly NodeV2[]): Set<string> {
  const before = new Map(baseline.map((n) => [n.id, n]));
  const locked = new Set<string>();
  for (const node of nodes) {
    const was = before.get(node.id);
    if (was && hasPosition(was) && was.x === node.x && was.y === node.y) locked.add(node.id);
  }
  return locked;
}

/**
 * Fill the position gaps in an authored graph and separate exact collisions.
 * See the module header for what it never does.
 *
 * @param nodes        The reconciled node list (children arrays consistent with `parent`).
 * @param isVisual     Does a node of this type draw? `catalogVisualPredicate` on the MCP
 *                     side, `CatalogNode.isVisual` on the editor's.
 * @returns Copies of the nodes, same order, with every node positioned.
 */
export function layoutAuthoredNodes(
  nodes: readonly NodeV2[],
  isVisual: (typeName: string) => boolean,
  options: LayoutAuthoredNodesOptions = {}
): NodeV2[] {
  const out = nodes.map((n) => ({ ...n }));
  const locked = options.lockedIds ?? new Set<string>();
  const connections = options.connections ?? [];
  const byId = new Map(out.map((n) => [n.id, n]));

  const inVisualTree = (n: NodeV2): boolean =>
    isVisual(n.type) || n.parent !== undefined || (n.children?.length ?? 0) > 0;

  // ── The visual column: depth-first, in tree order ─────────────────────────
  // Children arrays are authoritative for order (both doors reconcile them
  // before this runs); a parent-declared child missing from the array is
  // appended defensively rather than dropped.
  const childIdsOf = (n: NodeV2): string[] => {
    const listed = n.children ?? [];
    const declared = out.filter((c) => c.parent === n.id && !listed.includes(c.id)).map((c) => c.id);
    return [...listed, ...declared];
  };

  let cursorY = VISUAL_COLUMN_TOP;
  const visited = new Set<string>();
  const placeVisual = (n: NodeV2, depth: number): void => {
    if (visited.has(n.id)) return; // cycle guard; reconciliation reports these
    visited.add(n.id);
    if (hasPosition(n) || locked.has(n.id)) {
      // Authoritative — never assigned. It still advances the flow, so a
      // partially positioned tree fills its gaps below the placed part.
      if (n.y !== undefined) cursorY = Math.max(cursorY, n.y + ROW_SPACING);
    } else {
      n.x = VISUAL_COLUMN_X + depth * HIERARCHY_INDENT_X;
      n.y = cursorY;
      cursorY += ROW_SPACING;
    }
    for (const childId of childIdsOf(n)) {
      const child = byId.get(childId);
      if (child) placeVisual(child, depth + 1);
    }
  };
  for (const n of out) {
    if (inVisualTree(n) && n.parent === undefined) placeVisual(n, 0);
  }
  // Orphaned visual nodes (parent id unknown — reconciliation already errored)
  // still get a spot rather than the origin.
  for (const n of out) {
    if (inVisualTree(n) && !visited.has(n.id)) placeVisual(n, 0);
  }

  // ── The logic column: beside the visual node each one feeds ───────────────
  const maxVisualX = out
    .filter((n) => inVisualTree(n) && n.x !== undefined)
    .reduce<number | undefined>((max, n) => (max === undefined || n.x! > max ? n.x : max), undefined);
  const logicX = maxVisualX !== undefined ? maxVisualX + LOGIC_COLUMN_GUTTER : VISUAL_COLUMN_X;

  // A logic node's anchor is the y of the first node it feeds (first
  // connection out of it, in connection order, whose target has a y by now) —
  // failing that, the first node feeding it.
  const anchorYOf = (n: NodeV2): number | undefined => {
    for (const c of connections) {
      if (c.fromId !== n.id) continue;
      const target = byId.get(c.toId);
      if (target && target.id !== n.id && target.y !== undefined) return target.y;
    }
    for (const c of connections) {
      if (c.toId !== n.id) continue;
      const source = byId.get(c.fromId);
      if (source && source.id !== n.id && source.y !== undefined) return source.y;
    }
    return undefined;
  };

  const unplacedLogic = out.filter((n) => !inVisualTree(n) && !hasPosition(n) && !locked.has(n.id));
  const anchors = new Map(unplacedLogic.map((n) => [n.id, anchorYOf(n)]));
  // Stable sort: anchored nodes by their anchor, unanchored ones after, both
  // preserving submission order among ties.
  const sorted = [...unplacedLogic].sort(
    (a, b) => (anchors.get(a.id) ?? Number.POSITIVE_INFINITY) - (anchors.get(b.id) ?? Number.POSITIVE_INFINITY)
  );
  let logicCursorY = VISUAL_COLUMN_TOP;
  for (const n of sorted) {
    const anchor = anchors.get(n.id);
    const y = Math.max(anchor ?? logicCursorY, logicCursorY);
    n.x = logicX;
    n.y = y;
    logicCursorY = y + ROW_SPACING;
  }

  // ── Collision separation — the one thing applied to positioned nodes too ──
  // Exact coordinate ties only. The first occupant keeps the spot; later ones
  // step down by COLLISION_STEP until the exact pair is free. That is the whole
  // promise: an exact tie is broken, non-overlap is NOT guaranteed — the pass is
  // never given node sizes, so it cannot know when two nodes have stopped
  // touching. Locked nodes claim theirs first and never move —
  // two locked nodes sharing a coordinate are a pre-existing arrangement and
  // stay exactly where they are.
  const keyOf = (n: NodeV2) => `${n.x},${n.y}`;
  const occupied = new Set<string>();
  for (const n of out) {
    if (locked.has(n.id) && hasPosition(n)) occupied.add(keyOf(n));
  }
  for (const n of out) {
    if (locked.has(n.id) || !hasPosition(n)) continue;
    while (occupied.has(keyOf(n))) n.y = n.y! + COLLISION_STEP;
    occupied.add(keyOf(n));
  }

  return out;
}
