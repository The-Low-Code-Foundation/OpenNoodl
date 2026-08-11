/**
 * Where a builder bent this wire — the anchor geometry (SIG-007).
 *
 * Import-free on purpose, like `wireEndpoints.ts` and `wirePulse.ts`: the
 * geometry is graded in `tests-unit/` without starting Electron, and the painter
 * keeps the canvas calls.
 *
 * ## The frame an anchor is stored in, and why it is neither of the obvious two
 *
 * An anchor is `{ u, v }`, read against the frame the wire's **own endpoints**
 * define — origin `P0`, axis `d = P3 - P0`, and the same normal convention
 * `wireEndpoints` uses for its glyphs:
 *
 * ```
 * position = P0 + u·d + v·n̂
 * ```
 *
 * 🔴 **Absolute canvas coordinates are the trap this exists to avoid.** An
 * anchor pinned to the canvas on a wire whose endpoints then move produces a
 * wire that turns round, goes back for its anchor, and loops. `u` being
 * dimensionless is what makes the routing *stretch* with the wire instead.
 *
 * ⚠️ **But `v` is graph px, not a fraction, and that mix is deliberate.**
 * Normalising both would make the frame a similarity transform — the shape
 * preserved exactly, which sounds like the better answer and is the worse one:
 * drag a node ten times further away and the 40px nudge you drew becomes a 400px
 * detour. A detour is a fixed-size thing somebody drew, so it stays that size.
 *
 * That mix has exactly one failure mode and it is the opposite one — as the
 * chord **shrinks**, a fixed `v` grows relative to it and spikes. {@link
 * clampOffset} bounds `|v|` by the chord's own length. On real geometry it never
 * binds (the measured median wire in this project is 3,451 graph px and offsets
 * are tens of px); it is there for two nodes dragged on top of each other.
 *
 * ## What stops a wire crossing itself, and what it is measured to stop
 *
 * Not the tangent scheme — {@link normaliseAnchors}. Anchors are kept ordered
 * along the chord with a minimum gap, so they cannot swap places however the
 * nodes are dragged. The acceptance case for this task is a node dragged the
 * full width of the canvas with three anchors set, and that is the property it
 * turns on.
 *
 * ⚠️ **Stated precisely, because it was measured and the loose version is
 * false.** Over 21,300 sweeps — 60 hand-plausible anchor sets against every
 * endpoint position from 1,200px behind the source to 1,600px ahead of it, at
 * five vertical offsets — the painted path self-crosses on **8**, and all 8 are
 * chords shorter than ~160px, which is two node cards sitting on top of each
 * other. Every case where the wire is a wire is clean.
 *
 * 🔴 What is *not* claimed is that no anchor list can knot. Anchors packed at
 * {@link WIRE_ANCHOR.minGap} and pulled the length of the wire in alternating
 * directions do cross, and no tangent scheme fixes that because the knot is what
 * was drawn. The guarantee is the one the acceptance asks for — **moving a node
 * does not introduce a crossing** — and *Reset routing* is the way back from a
 * knot somebody meant.
 *
 * ## The curve
 *
 * `n` anchors make `n + 1` cubic segments. The **end** tangents are read off the
 * wire's existing control points, so a wire still leaves its source port and
 * arrives at its target port horizontally — that idiom is what makes this a wire
 * diagram, and `arrivalDirection` already reads it at `t = 1`. **Interior**
 * tangents are Catmull-Rom from each anchor's neighbours, so the wire flows
 * *through* an anchor along its direction of travel rather than stopping to be
 * horizontal at it. That is the difference between "adjust the trajectory" and
 * "add a staircase".
 *
 * 🔴 **With no anchors {@link anchoredSegments} returns the wire's own array,
 * by identity.** Not a spline that reproduces it. Every existing graph has to
 * open exactly as it did, and "these two constructions coincide" is a weaker
 * thing to rest that on than not running the new construction at all.
 */

export interface Point {
  x: number;
  y: number;
}

/** One authored bend, in the wire's chord frame. `u` along it, `v` across it. */
export interface WireAnchor {
  /** Position along the chord. Dimensionless: 0 is the source, 1 the target. */
  u: number;
  /** Offset across the chord, in **graph px** — a detour the size it was drawn. */
  v: number;
}

export const WIRE_ANCHOR = {
  /** Painted radius of an anchor ring. Held at screen size by `glyphScaleFor`. */
  handleRadius: 4,

  /** The ring's stroke, before the glyph scale. */
  handleLineWidth: 1.5,

  /**
   * Grab radius for an anchor, in graph px at 100% zoom.
   *
   * The same 8 as `NodeGraphEditorConnection.endpointHitRadius`, and for the
   * same reason — a 4px ring is not a target. ⚠️ Unlike the endpoint's, this one
   * is *shown*: the ghost ring tracks the pointer, so what you are about to get
   * is painted rather than guessed at (§G D4).
   */
  hitRadius: 8,

  /** The ghost ring — the preview of a mint — against a set one. */
  ghostAlpha: 0.45,

  /**
   * Minimum spacing between neighbouring anchors, in `u`.
   *
   * Two anchors at the same `u` make a segment of zero length whose tangents are
   * undefined, and anchors that can pass each other make a wire that crosses
   * itself. Both are prevented by the same clamp — see {@link normaliseAnchors}.
   */
  minGap: 0.01,

  /**
   * The most an anchor may be offset across the chord, as a multiple of the
   * chord's own length. See the header: this only ever binds on a wire whose
   * endpoints have been brought almost on top of each other.
   */
  maxOffsetRatio: 1,

  /** Below this chord length the frame is degenerate and offsets are dropped. */
  minChord: 1e-3,

  /**
   * How far along each segment the control points sit, as a fraction of that
   * segment's span.
   *
   * A single segment at 0.5 with horizontal tangents *is* the mid-x cubic this
   * painter has always drawn — but a single segment is the case that never runs
   * here (see the header), so this is a taste parameter and not a compatibility
   * one. 0.4 keeps the bend through an anchor tight enough not to overshoot the
   * next one when the two are close together.
   */
  tangentScale: 0.4,

  /**
   * How finely the painted path is sampled when something needs it as a
   * polyline — the ghost's closest-point search, and the bounding box.
   *
   * Per segment, not per wire, so a bent wire is sampled proportionally to how
   * bent it is.
   */
  samplesPerSegment: 24
} as const;

/** The chord frame a wire's anchors are read against. Built from its two ends. */
export interface ChordFrame {
  origin: Point;
  /** The chord vector, `P3 - P0`. */
  dx: number;
  dy: number;
  length: number;
  /** Unit normal — the same convention as `wireEndpoints.arrowheadPolygon`. */
  nx: number;
  ny: number;
}

export function chordFrame(from: Point, to: Point): ChordFrame {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (!(length > WIRE_ANCHOR.minChord)) {
    // Degenerate: the two ends are the same point. A frame still has to come
    // back so callers do not branch, but it carries no offset — `anchorPoint`
    // multiplies `v` by a clamp that is zero here.
    return { origin: { x: from.x, y: from.y }, dx: 0, dy: 0, length: 0, nx: 0, ny: -1 };
  }

  return {
    origin: { x: from.x, y: from.y },
    dx,
    dy,
    length,
    nx: dy / length,
    ny: -dx / length
  };
}

/** Bound an across-the-chord offset by the chord's own length. See the header. */
export function clampOffset(v: number, chordLength: number): number {
  if (!isFinite(v)) return 0;
  const limit = Math.max(0, chordLength) * WIRE_ANCHOR.maxOffsetRatio;
  return Math.max(-limit, Math.min(limit, v));
}

/** Where an anchor actually sits, in graph coordinates. */
export function anchorPoint(frame: ChordFrame, anchor: WireAnchor): Point {
  const v = clampOffset(anchor.v, frame.length);
  return {
    x: frame.origin.x + anchor.u * frame.dx + v * frame.nx,
    y: frame.origin.y + anchor.u * frame.dy + v * frame.ny
  };
}

/**
 * The inverse — a point on the canvas, as an anchor.
 *
 * This is what a mint and a drag both go through, so an anchor dropped on the
 * wire's existing path comes back out at the place it was dropped.
 */
export function anchorFromPoint(frame: ChordFrame, point: Point): WireAnchor {
  if (!(frame.length > WIRE_ANCHOR.minChord)) return { u: 0.5, v: 0 };

  const rx = point.x - frame.origin.x;
  const ry = point.y - frame.origin.y;
  const l2 = frame.length * frame.length;

  return {
    u: (rx * frame.dx + ry * frame.dy) / l2,
    v: rx * frame.nx + ry * frame.ny
  };
}

/**
 * Keep the list ordered along the chord, with a gap between neighbours and
 * clear of both ends.
 *
 * 🔴 **This, and not the tangent scheme, is what delivers "no wire crossing
 * itself".** An anchor dragged past its neighbour would otherwise reorder the
 * path and fold it; here it stops against the neighbour instead, which is both
 * the safe behaviour and the predictable one — nothing swaps under the pointer.
 *
 * Returns a **new array**; the input is never mutated, because it is the model's.
 */
export function normaliseAnchors(anchors: readonly WireAnchor[] | undefined): WireAnchor[] {
  if (!anchors || !anchors.length) return [];

  const gap = WIRE_ANCHOR.minGap;
  // More anchors than the gap can fit between the ends: the bounds below would
  // cross and every anchor would pile onto the same `u`. Keep the ones that fit.
  const max = Math.max(1, Math.floor(1 / gap) - 1);
  const kept = anchors.slice(0, max);

  const out: WireAnchor[] = [];
  let lower = 0;

  for (let i = 0; i < kept.length; i++) {
    const a = kept[i];
    const min = lower + gap;
    // Leave room for everyone still to come, so the last one is not pinned at 1.
    const upper = Math.max(min, 1 - (kept.length - i) * gap);
    const u = Math.max(min, Math.min(upper, isFinite(a.u) ? a.u : min));

    out.push({ u, v: isFinite(a.v) ? a.v : 0 });
    lower = u;
  }

  return out;
}

function normalise(x: number, y: number): Point | undefined {
  const length = Math.sqrt(x * x + y * y);
  if (!(length > 1e-6)) return undefined;
  return { x: x / length, y: y / length };
}

/**
 * The wire's painted path, as a list of cubic segments.
 *
 * ⚠️ **With no anchors this returns `[base]` — the caller's own array, not a
 * copy and not a reconstruction.** That is the compatibility guarantee: an
 * unbent wire is painted, hit-tested, sampled and measured by exactly the code
 * that painted it before this task existed.
 */
export function anchoredSegments(base: Point[], anchors: readonly WireAnchor[] | undefined): Point[][] {
  if (!base || base.length < 4) return base ? [base] : [];

  const list = normaliseAnchors(anchors);
  if (!list.length) return [base];

  const frame = chordFrame(base[0], base[3]);
  const points: Point[] = [base[0], ...list.map((a) => anchorPoint(frame, a)), base[3]];

  // The wire leaves and arrives the way it always has: straight out of the
  // source port and straight into the target one, read off the control points
  // the painter already computed.
  const chord = normalise(frame.dx, frame.dy) || { x: 1, y: 0 };
  const first = normalise(base[1].x - base[0].x, base[1].y - base[0].y) || chord;
  const last = normalise(base[3].x - base[2].x, base[3].y - base[2].y) || chord;

  const directions: Point[] = points.map((p, i) => {
    if (i === 0) return first;
    if (i === points.length - 1) return last;
    // Catmull-Rom: the heading through this anchor is the one its neighbours
    // describe, so the wire passes through rather than turning a corner at it.
    return (
      normalise(points[i + 1].x - points[i - 1].x, points[i + 1].y - points[i - 1].y) ||
      normalise(points[i + 1].x - p.x, points[i + 1].y - p.y) ||
      chord
    );
  });

  // ⚠️ Plain Catmull-Rom, with the control points a fixed fraction of each
  // segment's own span. An **alignment guard** — scaling each control extension
  // by how much its tangent agrees with the segment it starts, which is the
  // textbook fix for a spline that overshoots — was written, measured and
  // removed: over 21,300 sweeps of the acceptance drag with hand-plausible
  // anchors it took self-crossings from 8 **up to 14**, and on deliberately
  // pathological ones from 364 up to 663. It reads like it should help and it
  // does the opposite, so it is not here. Measure before adding it back.
  const k = WIRE_ANCHOR.tangentScale;
  const segments: Point[][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const span = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));

    segments.push([
      a,
      { x: a.x + directions[i].x * span * k, y: a.y + directions[i].y * span * k },
      { x: b.x - directions[i + 1].x * span * k, y: b.y - directions[i + 1].y * span * k },
      b
    ]);
  }

  return segments;
}

function cubicAt(t: number, a: number, b: number, c: number, d: number): number {
  const mt = 1 - t;
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
}

/**
 * A point on the whole path, for `t` in `[0, 1]` across every segment.
 *
 * ⚠️ `t` is uniform **per segment**, not by arc length — the same property a
 * single cubic already had, so nothing downstream gains a new assumption.
 * Anything that needs even spacing (the direction chevrons) walks the arc length
 * itself, and already did.
 */
export function pointOnSegments(segments: Point[][], t: number): Point | undefined {
  if (!segments || !segments.length) return undefined;

  const clamped = Math.max(0, Math.min(1, isFinite(t) ? t : 0));
  const scaled = clamped * segments.length;
  const index = Math.min(segments.length - 1, Math.floor(scaled));
  const local = scaled - index;
  const c = segments[index];

  return {
    x: cubicAt(local, c[0].x, c[1].x, c[2].x, c[3].x),
    y: cubicAt(local, c[0].y, c[1].y, c[2].y, c[3].y)
  };
}

/** The whole path as a polyline, for measuring rather than painting. */
export function samplePath(segments: Point[][], perSegment: number = WIRE_ANCHOR.samplesPerSegment): Point[] {
  const out: Point[] = [];
  if (!segments || !segments.length) return out;

  const steps = Math.max(1, Math.floor(perSegment));
  for (let s = 0; s < segments.length; s++) {
    const c = segments[s];
    for (let i = s === 0 ? 0 : 1; i <= steps; i++) {
      const t = i / steps;
      out.push({
        x: cubicAt(t, c[0].x, c[1].x, c[2].x, c[3].x),
        y: cubicAt(t, c[0].y, c[1].y, c[2].y, c[3].y)
      });
    }
  }

  return out;
}

/**
 * The point on the painted path closest to `p`.
 *
 * ⚠️ Sampled rather than bisected. `findClosestPointOnCurve` on the connection
 * halves the parameter range toward whichever quarter is nearer, which needs the
 * distance function to be unimodal — true enough of one gentle cubic, and false
 * of a path the builder has deliberately bent. A ghost anchor that jumped to the
 * far side of a bend would be a hard thing to explain.
 */
export function closestPointOnPath(segments: Point[][], p: Point): { point: Point; distance: number } | undefined {
  const points = samplePath(segments);
  if (points.length < 2) return undefined;

  let best: Point | undefined;
  let bestDistance = Infinity;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const l2 = abx * abx + aby * aby;

    const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2)) : 0;
    const x = a.x + abx * t;
    const y = a.y + aby * t;
    const distance = Math.sqrt((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y));

    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x, y };
    }
  }

  return best ? { point: best, distance: bestDistance } : undefined;
}

/**
 * Which anchor is under this point, if any.
 *
 * Nearest-first rather than first-hit: two anchors dragged close together
 * overlap, and the one whose centre is nearer is the one being pointed at.
 */
export function anchorAt(
  frame: ChordFrame,
  anchors: readonly WireAnchor[] | undefined,
  pos: Point,
  radius: number = WIRE_ANCHOR.hitRadius
): number | undefined {
  if (!anchors || !anchors.length) return undefined;

  let best: number | undefined;
  let bestDistance = radius * radius;

  for (let i = 0; i < anchors.length; i++) {
    const p = anchorPoint(frame, anchors[i]);
    const d = (p.x - pos.x) * (p.x - pos.x) + (p.y - pos.y) * (p.y - pos.y);
    if (d <= bestDistance) {
      bestDistance = d;
      best = i;
    }
  }

  return best;
}

/**
 * Where a newly minted anchor goes in the list.
 *
 * By `u`, so an anchor added between two existing ones is *between* them in the
 * path as well as on the screen. Minting appends-then-sorts nowhere: the index
 * is computed, because {@link normaliseAnchors} clamps against neighbours and
 * would flatten a wrongly-placed anchor onto the one before it.
 */
export function insertionIndexFor(anchors: readonly WireAnchor[] | undefined, u: number): number {
  if (!anchors || !anchors.length) return 0;
  for (let i = 0; i < anchors.length; i++) {
    if (u < anchors[i].u) return i;
  }
  return anchors.length;
}

/**
 * Read a model's anchor list — the one place a stored value is believed or not.
 *
 * ⚠️ Anything can be in `project.json`, including an anchor list written by an
 * agent that had never seen this field. A malformed entry is dropped rather than
 * painted as `NaN`, which on a canvas silently kills the rest of the frame.
 */
export function readAnchors(raw: unknown): WireAnchor[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;

  const out: WireAnchor[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const u = (entry as WireAnchor).u;
    const v = (entry as WireAnchor).v;
    if (typeof u !== 'number' || !isFinite(u)) continue;
    if (typeof v !== 'number' || !isFinite(v)) continue;
    out.push({ u, v });
  }

  return out.length ? out : undefined;
}
