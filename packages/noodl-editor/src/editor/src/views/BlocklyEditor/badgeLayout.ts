/**
 * VFN-013 — where a value badge goes once you know the block it belongs to is *inside*
 * another block.
 *
 * ## The report, and the one line that caused it
 *
 * > *"The values that show during the run in the blockly editor are hard to see, covered a bit
 * > by blocks I think?"*
 *
 * `BlockValueBadges` anchored every badge at `x = -(width + 6)` — **outside the block's own
 * left edge**. LGC-003 §5.1 argues for that anchor and the argument is right *for a top-level
 * block*: its left edge has empty canvas beside it, the badge hangs where the block's wire
 * would have left from, and the run reads left-to-right along the data path.
 *
 * 🔴 **A nested block has no empty canvas there.** Its left edge is *inside the body of the
 * block it is plugged into*, so "just outside my left edge" is "on top of my parent" — and
 * nested is the common case, because that is what an expression is. The anchor was never
 * wrong; its assumption was.
 *
 * ## What this module is
 *
 * The placement decision, as arithmetic over rectangles and nothing else. No DOM, no Blockly,
 * no colours — so it is graded in the plain-Node runner against fixtures whose geometry is
 * written down, including a **negative control** that runs the same overlap test against
 * {@link legacyBadgeAnchor} and requires it to report today's collision. A placement test that
 * cannot see today's bug proves nothing about tomorrow's fix.
 *
 * ## The rule
 *
 * 1. **Not nested → the old anchor, unchanged.** First candidate, and on any real program it
 *    is free, so a top-level statement's badge does not move by one pixel. (VFN-013 criterion 2.)
 * 2. **Nested → above the block's own top-left**, climbing a badge-row at a time until the box
 *    is clear. `x` is the block's own left edge and never less, so a badge can no longer be
 *    pushed off-canvas by a block sitting near the workspace's left edge (criterion 4), and
 *    the value still sits *at* the thing it is the value of.
 * 3. **A badge already placed is an obstacle like any other**, which is what keeps the three
 *    badges of `[a] × [b]` from landing on each other: the outer one takes the row above, the
 *    operand whose left edge it shares climbs one more.
 *
 * ⚠️ **What counts as an obstacle is a block's *own* box — not the box of everything plugged
 * into it.** Blockly's `getBoundingRectangleWithoutChildren()` is exactly that measurement, and
 * it is why a badge may sit above a nested block without being pushed clear of the whole
 * statement: the statement's own fields are to the *left* of the socket, so the space directly
 * above the socket belongs to nobody. Feeding whole-block boxes in here instead would still
 * produce a legal layout, just a taller one.
 *
 * @module BlocklyEditor
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One block's own painted box, in workspace units.
 *
 * `surroundId` is the block whose *body* this block's left edge sits inside — Blockly's
 * `getSurroundParent()`, which is precisely the question this module asks. A statement block
 * in a top-level stack has none (the previous block in the stack is a neighbour, not a
 * container, and the canvas to its left is empty); a value block plugged into an input has
 * one, and so does a statement inside a C-shaped block.
 */
export interface BlockBox extends Rect {
  id: string;
  surroundId: string | null;
}

/** A badge that wants a home. Size only — where it goes is this module's answer. */
export interface BadgeRequest {
  blockId: string;
  width: number;
  height: number;
}

export interface BadgePlacement extends Rect {
  blockId: string;
  /** Offset from the block's own origin, which is the coordinate system the SVG group is in. */
  dx: number;
  dy: number;
  nested: boolean;
  /** Which candidate was taken. `0` is the preferred one; higher means it had to climb. */
  row: number;
}

/** The gap between a badge and the left edge it hangs off. LGC-003's original number. */
export const BADGE_GUTTER = 6;

/** Vertical breathing room between a badge and whatever it sits above or below. */
export const BADGE_ROW_GAP = 3;

/** How far a badge may climb before it stops trying and takes its preferred spot anyway. */
export const MAX_ROWS_ABOVE = 4;

/** And how far it may fall, once climbing has failed. */
export const MAX_ROWS_BELOW = 2;

/**
 * The anchor as it was before VFN-013 — `BlockValueBadges.ts:207-210`, verbatim.
 *
 * 🔴 **Exported for the negative control, and it must stay exported.** The spec proves the new
 * layout by running its overlap test against *this* on a nested fixture and requiring an
 * overlap to be reported. A copy of the formula in the spec file would drift away from the
 * thing it is supposed to catch; this is the formula itself.
 */
export function legacyBadgeAnchor(box: Rect, badgeWidth: number): { x: number; y: number } {
  return { x: box.x - (badgeWidth + BADGE_GUTTER), y: box.y };
}

/** Do two boxes share area? Touching edges do not count — a badge may abut a block. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Is this block's left edge inside another block's body? */
export function isNested(box: BlockBox): boolean {
  return box.surroundId !== null && box.surroundId !== undefined;
}

/**
 * How many blocks this one is inside.
 *
 * Used only to order the placement pass — shallowest first, so an outer badge takes the row
 * nearest its block and the operand that shares its left edge is the one that climbs. Guarded
 * against a malformed chain rather than trusting the caller: this runs inside a paint.
 */
export function nestingDepth(id: string, byId: Map<string, BlockBox>): number {
  let depth = 0;
  let current = byId.get(id);
  const seen = new Set<string>([id]);

  while (current && current.surroundId) {
    if (seen.has(current.surroundId)) break;
    seen.add(current.surroundId);
    current = byId.get(current.surroundId);
    if (!current) break;
    depth++;
  }

  return depth;
}

/**
 * Where each badge goes, in workspace coordinates.
 *
 * Deterministic: the same blocks and the same requests always produce the same map, because
 * the pass order is (depth, x, y, id) and every candidate list is fixed. A layout that moved
 * when nothing moved would strobe on the frame clock.
 *
 * A request naming a block that is not in `blocks` is dropped rather than guessed at — the
 * same silent skip `BlockValueBadgeLayer.paint` already makes for a probe id with no block,
 * and for the same reason (LGC-007 inlines a definition's body, ids and all).
 */
export function layoutBadges(blocks: BlockBox[], requests: BadgeRequest[]): Map<string, BadgePlacement> {
  const byId = new Map<string, BlockBox>();
  for (const block of blocks) byId.set(block.id, block);

  const pending = requests
    .map((request) => ({ request, box: byId.get(request.blockId) }))
    .filter((entry): entry is { request: BadgeRequest; box: BlockBox } => !!entry.box)
    .map((entry) => ({ ...entry, depth: nestingDepth(entry.box.id, byId) }))
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.box.x !== b.box.x) return a.box.x - b.box.x;
      if (a.box.y !== b.box.y) return a.box.y - b.box.y;
      return a.box.id < b.box.id ? -1 : a.box.id > b.box.id ? 1 : 0;
    });

  const placements = new Map<string, BadgePlacement>();
  const placedBoxes: Rect[] = [];

  for (const { request, box } of pending) {
    const nested = isNested(box);
    const candidates = candidatesFor(box, request, nested);

    let chosen = 0;
    for (let index = 0; index < candidates.length; index++) {
      const candidate = { ...candidates[index], width: request.width, height: request.height };
      if (isClear(candidate, box.id, blocks, placedBoxes)) {
        chosen = index;
        break;
      }
    }

    const at = candidates[chosen];
    const rect: Rect = { x: at.x, y: at.y, width: request.width, height: request.height };
    placedBoxes.push(rect);
    placements.set(request.blockId, {
      blockId: request.blockId,
      ...rect,
      dx: rect.x - box.x,
      dy: rect.y - box.y,
      nested,
      row: chosen
    });
  }

  return placements;
}

/**
 * The positions a badge will try, best first.
 *
 * ⚠️ The block's *own* box is never a candidate. A badge painted over the block it belongs to
 * covers that block's own field — which is the half of the report about the `21` sitting on the
 * multiply block's operand — so "on top of my own block" is not a fallback, it is the failure.
 */
function candidatesFor(box: BlockBox, request: BadgeRequest, nested: boolean): { x: number; y: number }[] {
  const step = request.height + BADGE_ROW_GAP;
  const candidates: { x: number; y: number }[] = [];

  // Top-level: the LGC-003 §5.1 anchor, first. On any real program the canvas there is empty,
  // so this is the one that gets taken and nothing about a top-level badge changes.
  if (!nested) candidates.push(legacyBadgeAnchor(box, request.width));

  const above = (row: number) => ({ x: box.x, y: box.y - step * row });
  const below = (row: number) => ({ x: box.x, y: box.y + box.height + BADGE_ROW_GAP + step * row });

  /**
   * ⚠️ **Above and below are interleaved, and that is a measurement rather than a taste.**
   *
   * Climbing straight up worked on a single statement and fell apart on two: in a stack, the
   * row above a nested block is the *previous statement*, and its own badges are up there too,
   * so the second statement's operands climbed four rows — 76px, far enough from their blocks to
   * be unreadable. `badge-layout.spec.ts`'s two-statement case is the fixture that showed it.
   * Trying the near side below before the far side above keeps a badge within one row of its
   * block in every fixture here.
   */
  candidates.push(above(1));
  if (MAX_ROWS_BELOW > 0) candidates.push(below(0));
  candidates.push(above(2));
  if (MAX_ROWS_BELOW > 1) candidates.push(below(1));
  for (let row = 3; row <= MAX_ROWS_ABOVE; row++) candidates.push(above(row));
  for (let row = 2; row < MAX_ROWS_BELOW; row++) candidates.push(below(row));

  return candidates;
}

function isClear(candidate: Rect, ownerId: string, blocks: BlockBox[], placed: Rect[]): boolean {
  for (const block of blocks) {
    if (block.id === ownerId) continue;
    if (rectsOverlap(candidate, block)) return false;
  }
  for (const badge of placed) {
    if (rectsOverlap(candidate, badge)) return false;
  }
  return true;
}
