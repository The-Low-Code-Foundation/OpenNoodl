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
 * The along-the-wire direction chevrons (SIG-006 R3).
 *
 * ## Why these are off by default, and what the numbers were
 *
 * SIG-006's first criterion asked for direction on a wire whose ends are **both
 * off screen**, without hovering. An endpoint glyph is at the endpoint, so that
 * needs a mark in the middle — and R3 refused to guess at it, because the task's
 * own constraints argue that a mark on every wire is what the endpoint dots were
 * kept small to avoid.
 *
 * Measured **in the running editor, on the real curves**, over the five densest
 * components of a real 9,245-wire project (`Erleah-2`), by sliding a 1400×900
 * viewport across each graph:
 *
 * | | median viewport | worst |
 * |---|---:|---:|
 * | wires visible | 22–27 | 45 |
 * | …of those, with **both ends off screen** | **1–3** | 30 |
 * | chevrons this paints | **5–14** | 46 |
 * | share of the off-screen-ended wires it answers | **74–93%** | |
 *
 * 🔴 **Both halves of R3's argument were overestimates, and the live numbers
 * corrected them in opposite directions.** A first pass modelled wires as
 * straight lines between node *origins* and put the cost at 38 marks a viewport
 * and the need at 40 wires in 54. On the real curves it is ~10 marks and ~2
 * wires in 25 — the model overcounted the density it feared by about 3.5×, and
 * overcounted the need by more. ⚠️ **Node positions are not wire geometry**: the
 * curve leaves and arrives horizontally and routes through a mid-x, so its
 * length and its intersection with a viewport are both quite different from the
 * chord. Anything reasoning about wire density has to sample `pointOnCurve`.
 *
 * 🔴 **A single mid-wire chevron is still not the cheap win it looks like.** It
 * would satisfy the acceptance criterion's letter — you can capture one — while
 * answering well under half the wires that need it, because a long wire's
 * *middle* is usually off screen too. A cue readable from *any* slice of a wire
 * has to **repeat** at a spacing smaller than a viewport, and repeating is the
 * whole cost. Those are the same requirement, which is why there is no free
 * version of this.
 *
 * ## So why is it still off by default
 *
 * Not density — that turned out affordable. **Redundancy.** At a normal viewport
 * an end is visible on ~92% of the wires on screen, and those already state
 * their direction with a circle and an arrowhead; hover answers the rest, one
 * wire at a time, with a mark that travels. A permanent third statement earns
 * its place only on graphs like the one measured here, and the person who owns
 * such a graph is the one who can price it. That is the same call CAN-001 made
 * for wire labels — hover by default, always-on as a setting — in this painter,
 * for the same reason.
 */
export const DIRECTION_CHEVRON = {
  /**
   * Distance between chevrons, in **screen** px. See the table above.
   *
   * ⚠️ Screen, not graph — and unlike {@link glyphScaleFor} this has **no
   * floor**. A glyph stops growing at 0.5 zoom so it does not become the only
   * thing left when the ground grid has gone; spacing must keep growing past
   * that, or zooming out multiplies the marks on screen until the graph is a
   * hatch pattern.
   *
   * ⚠️ What this actually produces is *not* a constant marks-per-screen — it
   * **thins out** as you zoom away, because the graph-space spacing grows with
   * `1 / scale` and a wire has to be at least one spacing long to carry
   * anything. Measured on the component above, at a fixed pan:
   *
   * | zoom | wires on screen | chevrons |
   * |---:|---:|---:|
   * | 100% | 41 | **22** |
   * | 50% | 51 | **15** |
   * | 25% | 96 | **6** |
   *
   * That is the right way round rather than a flaw: zooming out brings the
   * *ends* of wires on screen, which is where the endpoint glyphs answer, so
   * the along-the-wire cue recedes exactly as the thing it substitutes for
   * arrives.
   */
  spacing: 500,

  /** Tip-to-base length of one chevron, along the wire. */
  length: 5,

  /** Half the chevron's span across the wire. */
  halfWidth: 4,

  /**
   * How much of each end of the wire to leave alone, in screen px.
   *
   * The endpoint glyphs already answer there, and the curve is doing its hook
   * into the node card, so a chevron placed inside this reads as a smudge on
   * the arrowhead rather than as a second statement of the same fact.
   */
  endClearance: 24,

  /**
   * How finely the curve is sampled before the marks are spaced along it.
   *
   * These wires are long — the median in the measured component is 3,451 graph
   * px — and the arc length has to be walked to place anything by distance. 48
   * is enough that the hooks at each end do not alias into a straight line,
   * and it is only paid on wires that are on screen, and only while the setting
   * is on.
   */
  samples: 48
} as const;

/**
 * Where the chevrons go along a sampled wire, and which way each one points.
 *
 * Placed by **arc length**, not by bezier `t`: `t` is not uniform along a cubic,
 * and these wires are long and mostly straight with a hook at each end, so
 * spacing by `t` would bunch the marks into the hooks — the one place
 * {@link DIRECTION_CHEVRON.endClearance} exists to keep them out of.
 *
 * The usable span is divided into `n` equal segments and a mark placed at the
 * **middle** of each, rather than stepping from one end. That makes the run
 * symmetric, keeps every mark clear of both ends, and — the point — gives a
 * wire shorter than one spacing **no marks at all**, because a wire you can see
 * the ends of is already answered.
 */
export function chevronPlacements(
  points: Point[],
  spacing: number = DIRECTION_CHEVRON.spacing,
  endClearance: number = DIRECTION_CHEVRON.endClearance
): { point: Point; direction: Point }[] {
  if (!points || points.length < 2 || !(spacing > 0)) return [];

  // Cumulative arc length at each sample.
  const at: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const d = delta(points[i], points[i - 1]);
    at.push(at[i - 1] + Math.sqrt(d.x * d.x + d.y * d.y));
  }

  const total = at[at.length - 1];
  const clearance = Math.max(0, endClearance);
  const usable = total - clearance * 2;
  const count = Math.floor(usable / spacing);
  if (count < 1) return [];

  const step = usable / count;
  const out: { point: Point; direction: Point }[] = [];
  for (let i = 0; i < count; i++) {
    const placement = pointAtArcLength(points, at, clearance + (i + 0.5) * step);
    if (placement) out.push(placement);
  }
  return out;
}

/** Walk a sampled polyline to a given arc length, and report the heading there. */
function pointAtArcLength(points: Point[], at: number[], target: number): { point: Point; direction: Point } | undefined {
  for (let i = 1; i < points.length; i++) {
    if (at[i] < target) continue;

    const span = at[i] - at[i - 1];
    const u = span > 1e-6 ? (target - at[i - 1]) / span : 0;
    const direction = normalise(delta(points[i], points[i - 1]));
    if (!direction) continue;

    return {
      point: {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * u,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * u
      },
      direction
    };
  }
  return undefined;
}

/**
 * One chevron, as an **open** three-point polyline: back corner, tip, back
 * corner.
 *
 * ⚠️ Open and stroked, where the target glyph is a closed filled triangle. A
 * mid-wire mark that looked like the endpoint arrowhead would say the wire
 * *ends* there, which on a wire whose real ends are off screen is exactly the
 * wrong thing to say — so the two marks differ in fill as well as in size, the
 * same property the endpoint vocabulary is separated on. It is also simply less
 * ink, which is the whole argument at 38 marks a screen.
 */
export function chevronPolyline(
  point: Point,
  direction: Point,
  length: number = DIRECTION_CHEVRON.length,
  halfWidth: number = DIRECTION_CHEVRON.halfWidth
): Point[] {
  const d = normalise(direction) || { x: 1, y: 0 };
  const n = { x: d.y, y: -d.x };
  const back = { x: point.x - d.x * length, y: point.y - d.y * length };
  return [
    { x: back.x + n.x * halfWidth, y: back.y + n.y * halfWidth },
    { x: point.x, y: point.y },
    { x: back.x - n.x * halfWidth, y: back.y - n.y * halfWidth }
  ];
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
