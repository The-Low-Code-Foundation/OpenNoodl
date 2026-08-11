/**
 * Which way does this wire go — the endpoint vocabulary (SIG-006).
 *
 * Import-free on purpose, like `wirePulse.ts` and `portCopy.ts`: the geometry is
 * graded in `tests-unit/` without starting Electron, and the painters keep the
 * canvas calls.
 *
 * ## One vocabulary, three glyphs, two places
 *
 * A wire's direction is stated twice — once on the **wire's own ends**, and once
 * on the **node**, where wires converge and the ends are stacked on top of each
 * other. Both read from this module, so they cannot drift apart:
 *
 * - **circle — it leaves here.** The source.
 * - **arrowhead — it arrives here.** The target.
 * - **diamond — both.** A port that is the source of one wire and the target of
 *   another, on the same side of the same node.
 *
 * ⚠️ The third one is a decision, not an inheritance. Before SIG-006 a `'both'`
 * port painted an **arrow**, because the painter's branch read
 * `leftIcon === 'to' || leftIcon === 'both'` — so "arrow" did not actually mean
 * "input", and the one glyph a builder could have trusted was lying on exactly
 * the ports where direction is least obvious. A port that both emits and
 * receives is a *third fact*; it gets a third silhouette rather than being
 * folded into one of the other two.
 *
 * ## Why these shapes, and not a colour or a size
 *
 * Wire colour already carries four meanings — type, health, debug pulse and diff
 * annotation — and `NodeGraphEditorConnection` explicitly refused to make
 * selection a fifth, using stroke weight instead. So direction goes in shape.
 *
 * The old pair could not work: a **7px disc** against an **8px triangle**, in the
 * same colour, differ by one pixel of extent. The acceptance for this task is a
 * *greyscale* screenshot at *50% zoom*, which strips colour and halves size, so
 * the shapes have to differ in something that survives both. They differ in
 * **fill ratio** — the proportion of their bounding box that is painted:
 *
 * | glyph | fill of bbox | bbox aspect | centroid offset along the wire |
 * |---|---:|---:|---:|
 * | circle  | **0.79** (π/4) | 1.00 | 0 |
 * | arrowhead | **0.50** | ~0.9 | **non-zero** — the mass sits behind the tip |
 * | diamond | **0.50** | 1.00 | 0 |
 *
 * Circle against arrowhead separates on fill; arrowhead against diamond
 * separates on centroid offset; circle against diamond separates on fill again.
 * All three are measurable on composited pixels rather than argued about.
 *
 * ⚠️ **And they are painted at a constant *screen* size** — see
 * {@link glyphScaleFor}. Halving the zoom used to halve the glyphs, which is
 * what made "distinguishable at 50%" unreachable no matter which shapes were
 * chosen.
 */

export interface Point {
  x: number;
  y: number;
}

export const WIRE_ENDPOINT = {
  /** Painted radius of the source circle on the wire. Unchanged from the mock. */
  sourceRadius: 3,

  /** The source circle on a highlighted wire, where it doubles as a grab handle. */
  sourceHandleRadius: 4,

  /** Tip-to-base length of the target arrowhead, along the wire. */
  arrowLength: 9,

  /** Half the arrowhead's base, across the wire. */
  arrowHalfWidth: 5,

  /** The same pair on a highlighted wire. */
  arrowLengthHighlighted: 11,
  arrowHalfWidthHighlighted: 6,

  /** Half-diagonal of the `'both'` diamond, on the node. */
  diamondRadius: 4.5,

  /**
   * Below this zoom the glyphs shrink with everything else again.
   *
   * The ground dot grid already stops at 0.4 (`CanvasRenderer`), because below
   * that the detail collapses into noise; holding endpoint glyphs at full screen
   * size past that point would leave them as the only thing not receding, and on
   * a dense graph that reads as a field of specks rather than as direction.
   */
  minGlyphScale: 0.5
} as const;

/**
 * How much to inflate a glyph so it holds its *screen* size as the graph zooms.
 *
 * The canvas is scaled once, in `CanvasRenderer.paint`, and everything painted
 * after it is in graph units — so a 9px arrowhead is 4.5 screen px at 50% zoom,
 * which is the whole reason the old glyph pair failed the zoom test. Dividing by
 * the scale cancels that, down to {@link WIRE_ENDPOINT.minGlyphScale}.
 *
 * Returns 1 at 100% zoom and above, so nothing changes where nothing was wrong.
 */
export function glyphScaleFor(scale: number, floor: number = WIRE_ENDPOINT.minGlyphScale): number {
  if (!(scale > 0)) return 1;
  if (scale >= 1) return 1;
  return 1 / Math.max(scale, floor);
}

/**
 * The unit vector a wire arrives along, for orienting the target arrowhead.
 *
 * Taken from the last control point to the end point, which is the cubic's true
 * tangent at `t = 1`. Every curve this painter builds keeps `P2` and `P3` on the
 * same `y`, so in practice this is horizontal — but a wire being re-routed
 * (CAN-003) is an elbow built from the cursor, and SIG-007 may bend it further,
 * so it is derived rather than assumed.
 *
 * Falls back to the chord, and then to "rightwards", so a degenerate curve
 * yields a glyph pointing somewhere sane instead of `NaN`.
 */
export function arrivalDirection(curve: Point[] | undefined): Point {
  const fallback = { x: 1, y: 0 };
  if (!curve || curve.length < 4) return fallback;
  return normalise(delta(curve[3], curve[2])) || normalise(delta(curve[3], curve[0])) || fallback;
}

function delta(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function normalise(v: Point): Point | undefined {
  const length = Math.sqrt(v.x * v.x + v.y * v.y);
  if (!(length > 1e-6)) return undefined;
  return { x: v.x / length, y: v.y / length };
}

/**
 * The target arrowhead, as a closed triangle: tip first, then the two base
 * corners.
 *
 * The tip sits *on* the endpoint rather than short of it, so the wire's stated
 * arrival point and the node's port anchor are the same place — the drag line
 * has always drawn it this way, and one of this task's jobs is to make the
 * in-flight wire and the committed wire agree.
 */
export function arrowheadPolygon(
  tip: Point,
  direction: Point,
  length: number = WIRE_ENDPOINT.arrowLength,
  halfWidth: number = WIRE_ENDPOINT.arrowHalfWidth
): Point[] {
  const d = normalise(direction) || { x: 1, y: 0 };
  // The normal, for the base corners.
  const n = { x: d.y, y: -d.x };
  const base = { x: tip.x - d.x * length, y: tip.y - d.y * length };
  return [
    { x: tip.x, y: tip.y },
    { x: base.x + n.x * halfWidth, y: base.y + n.y * halfWidth },
    { x: base.x - n.x * halfWidth, y: base.y - n.y * halfWidth }
  ];
}

/**
 * The `'both'` diamond, as a closed quad, from its centre.
 *
 * Axis-aligned rather than oriented along the wire: a both-ways port has no one
 * direction to align to, and that is precisely what it is saying.
 */
export function diamondPolygon(centre: Point, radius: number = WIRE_ENDPOINT.diamondRadius): Point[] {
  return [
    { x: centre.x, y: centre.y - radius },
    { x: centre.x + radius, y: centre.y },
    { x: centre.x, y: centre.y + radius },
    { x: centre.x - radius, y: centre.y }
  ];
}

/**
 * How long one pass of the hover mark takes, end to end, including the pause.
 *
 * SIG-005's `travelMs` is 420 — the time the bead takes to cross — and it clamps
 * at the target rather than looping, because a runtime pulse is *one moment* and
 * has one position. A hover is a question being asked continuously, so the mark
 * repeats: it crosses, then the wire is left alone for the remainder of the
 * cycle, which is what makes it read as repeated strokes in one direction rather
 * than a stream with no beginning.
 */
export const HOVER_MARK_CYCLE_MS = 900;

/**
 * Fold a hover's age into one cycle, so SIG-005's `travellingHeadRange` can be
 * reused verbatim.
 *
 * ⚠️ This is deliberately *not* a second travelling-mark implementation — that is
 * the exact failure the 005-before-006 ordering existed to prevent. It is an age
 * transform, and the geometry still comes from `wirePulse.ts`.
 */
export function loopedAge(ageMs: number, cycleMs: number = HOVER_MARK_CYCLE_MS): number {
  if (!(cycleMs > 0)) return Math.max(0, ageMs);
  const age = Math.max(0, ageMs);
  return age % cycleMs;
}

/**
 * Which glyph a node-side plug gets, from the `leftIcon`/`rightIcon` the layout
 * computed.
 *
 * One function so that the node painter cannot re-derive the mapping and get
 * `'both'` wrong again.
 */
export function glyphForPlugIcon(icon: string | undefined): 'circle' | 'arrowhead' | 'diamond' | undefined {
  if (icon === 'from') return 'circle';
  if (icon === 'to') return 'arrowhead';
  if (icon === 'both') return 'diamond';
  return undefined;
}
