/**
 * How a square wire is routed, and what a builder may move (SIG-007).
 *
 * Import-free on purpose, like `wireEndpoints.ts` and `wirePulse.ts`: the
 * geometry is graded in `tests-unit/` without starting Electron, and the painter
 * keeps the canvas calls.
 *
 * ## The route is a list of *runs*, not a list of points
 *
 * 🔴 **This replaced a point-based model, and the reason is a gesture.** The
 * first build stored anchors as free points the wire passed through, which works
 * for a curve and is wrong for right angles: grab the middle of a vertical run
 * and your instinct is that the run *moves sideways*, not that a new point
 * appears and splits it in two. A point model has nowhere to write "this run is
 * now 40px further left", because the run's position is derived from its two
 * neighbours rather than stored.
 *
 * So a square wire is stored as the positions of its runs. It leaves the source
 * port horizontally and arrives at the target port horizontally — both fixed by
 * the ports — and alternates between them:
 *
 * ```
 *   P0 ──────┐ xs[0]          route = { xs: [x…], ys: [y…] }
 *            │                        xs.length === ys.length + 1
 *     ys[0]  └──────┐ xs[1]
 *                   └────────▶ P3
 * ```
 *
 * ⚠️ **`xs` is always one longer than `ys`.** The first and last runs are
 * horizontal and belong to the ports, so every route starts and ends on a
 * vertical — which is why a wire with no routing at all is `{ xs: [mid], ys: [] }`
 * and comes out as today's four-point path exactly.
 *
 * ## Why `xs` is a fraction and `ys` is graph px
 *
 * The same asymmetry as anything else that has to survive a node being dragged.
 * `xs` is a fraction of the horizontal gap between the two ports, so moving a
 * node sideways **stretches** the route and keeps its proportions. `ys` is an
 * offset in graph px from the source port's row, because the vertical position
 * of a run is a detour somebody drew and should stay the size they drew it.
 *
 * ⚠️ **Neither is clamped to `[0, 1]`.** The editor's `'inline'` layout already
 * routes wires *outside* the gap between their ports — out to the left of both
 * nodes — so a legitimate `xs` is routinely negative. Clamping it was a real
 * defect in the point model: it threw a run the builder had just grabbed to the
 * far end of the wire.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * A square wire's route.
 *
 * `xs[i]` is a fraction of the horizontal gap between the ports; `ys[j]` is an
 * offset in graph px from the source port's row. Runs alternate
 * `xs[0], ys[0], xs[1], ys[1], … xs[n]`.
 */
export interface WireRoute {
  xs: number[];
  ys: number[];
}

export const WIRE_ROUTE = {
  /** Painted half-width of a corner handle. Held at screen size by `glyphScaleFor`. */
  handleRadius: 4,

  /** The handle's stroke, before the glyph scale. */
  handleLineWidth: 1.5,

  /**
   * Grab radius for a corner, in graph px at 100% zoom.
   *
   * The same 8 as `NodeGraphEditorConnection.endpointHitRadius`. A corner is
   * asked about **before** the run it sits on, so the two gestures never fight:
   * near a corner you move the corner, along a run you move the run.
   */
  cornerHitRadius: 8,

  /** How close to a run counts as grabbing it. Matches the wire's hit stroke. */
  runHitRadius: 10,

  /** A ghost run — the preview of where a drag would put it. */
  ghostAlpha: 0.45,

  /**
   * Corner rounding, in graph px.
   *
   * ⚠️ Not zero. A true right angle aliases badly on a zooming canvas and reads
   * as brittle. Clamped per corner to half the shorter of its two runs, so a
   * tight elbow tightens rather than the arc wandering off the route.
   */
  cornerRadius: 10,

  /** Runs shorter than this are not offered as drag targets — they are corners. */
  minRun: 6,

  /** Half-width of the "+" that adds a corner to a run. */
  addMarkRadius: 5,

  /**
   * A run has to be at least this long before it offers a "+".
   *
   * ⚠️ Much larger than {@link minRun}. A run you can *drag* only has to be
   * aimable; a run that offers a **new control** has to have somewhere to put it
   * that is not already occupied by the two corners at its ends. Below this the
   * "+" would sit on top of them and every click would be a coin toss.
   */
  minRunForAdd: 44,

  /** How faint the "+" is against a corner handle, which is a committed thing. */
  addMarkAlpha: 0.55,

  /** Below this the horizontal gap is degenerate and `xs` is read as px. */
  minSpan: 1
} as const;

/**
 * Where the "add a corner" marks go — the midpoint of every run long enough to
 * take one.
 *
 * 🔴 **This exists because the gesture had no affordance at all.** Adding was
 * only on the right-click menu, which is a fine *place* for it and a hopeless
 * way to *find* it: shown the working feature, the first thing reported was
 * "there's no way to add an anchor that I can see". A control nobody can see is
 * not a control. The marks appear on hover, with the corner handles, and vanish
 * with them.
 */
export function addMarks(points: Point[], route: WireRoute): { point: Point; run: number }[] {
  const out: { point: Point; run: number }[] = [];
  if (!points || points.length < 2) return out;

  for (let run = 1; run < points.length - 1; run++) {
    if (!runCoordinate(route, run)) continue;
    const a = points[run];
    const b = points[run + 1];
    if (!a || !b) continue;
    if (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) < WIRE_ROUTE.minRunForAdd) continue;
    out.push({ point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, run });
  }

  return out;
}

/** Which "+" is under this point, if any. */
export function addMarkAt(
  points: Point[],
  route: WireRoute,
  pos: Point,
  radius: number = WIRE_ROUTE.addMarkRadius + 3
): number | undefined {
  for (const mark of addMarks(points, route)) {
    if (Math.abs(mark.point.x - pos.x) <= radius && Math.abs(mark.point.y - pos.y) <= radius) return mark.run;
  }
  return undefined;
}



/** The horizontal gap `xs` is a fraction of. Never zero, so nothing divides by it. */
function spanFor(base: Point[]): number {
  const span = base[3].x - base[0].x;
  return Math.abs(span) < WIRE_ROUTE.minSpan ? WIRE_ROUTE.minSpan : span;
}

/**
 * The route a wire has when nobody has touched it.
 *
 * ⚠️ Read off the wire's **own control points**, not recomputed as a midpoint.
 * `NodeGraphEditorConnection` builds three different layouts, and the
 * `'inline'` one puts its vertical out to the left of both nodes rather than
 * between them. Recomputing would quietly straighten every one of those.
 */
export function defaultRoute(base: Point[]): WireRoute {
  return { xs: [(base[1].x - base[0].x) / spanFor(base)], ys: [] };
}

/** Is this a usable route for a wire with these endpoints? */
export function isValidRoute(route: WireRoute | undefined): route is WireRoute {
  return (
    !!route &&
    Array.isArray(route.xs) &&
    Array.isArray(route.ys) &&
    route.xs.length === route.ys.length + 1 &&
    route.xs.length >= 1 &&
    route.xs.every((v) => typeof v === 'number' && isFinite(v)) &&
    route.ys.every((v) => typeof v === 'number' && isFinite(v))
  );
}

/**
 * Read a route off a model, believing nothing.
 *
 * ⚠️ Anything can be in `project.json`, including a route written by an agent
 * that had never seen this field. A malformed one is dropped rather than painted
 * as `NaN`, which on a canvas silently kills the rest of the frame.
 */
export function readRoute(raw: unknown): WireRoute | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as WireRoute;
  if (!isValidRoute(candidate)) return undefined;
  return { xs: candidate.xs.slice(), ys: candidate.ys.slice() };
}

/**
 * The corner points the wire is drawn through.
 *
 * `[P0, (x0, fy), (x0, y0), (x1, y0), … (xn, ty), P3]` — every consecutive pair
 * shares exactly one coordinate, which is what makes the path orthogonal by
 * construction rather than by correction.
 */
export function routePoints(base: Point[], route?: WireRoute): Point[] {
  if (!base || base.length < 4) return base ? base.slice() : [];

  const r = isValidRoute(route) ? route : defaultRoute(base);
  const span = spanFor(base);
  const x = (i: number) => base[0].x + r.xs[i] * span;
  const y = (j: number) => base[0].y + r.ys[j];

  const points: Point[] = [{ x: base[0].x, y: base[0].y }];
  for (let i = 0; i < r.xs.length; i++) {
    const rowY = i === 0 ? base[0].y : y(i - 1);
    points.push({ x: x(i), y: rowY });
    const nextY = i === r.xs.length - 1 ? base[3].y : y(i);
    points.push({ x: x(i), y: nextY });
  }
  points.push({ x: base[3].x, y: base[3].y });

  return points;
}

/**
 * Which stored coordinate a run corresponds to, or `undefined` if the run
 * belongs to a port and cannot be moved.
 *
 * Runs are indexed as the gaps between {@link routePoints}: run `0` is the
 * horizontal out of the source and run `2n` the horizontal into the target, and
 * both are fixed — a wire has to meet its ports where its ports are.
 */
export function runCoordinate(
  route: WireRoute,
  runIndex: number
): { axis: 'x' | 'y'; index: number } | undefined {
  const last = 2 * route.xs.length;
  if (runIndex <= 0 || runIndex >= last) return undefined;
  return runIndex % 2 === 1
    ? { axis: 'x', index: (runIndex - 1) / 2 }
    : { axis: 'y', index: runIndex / 2 - 1 };
}

/** Distance from a point to a segment, and where on it the foot lands. */
function distanceToSegment(a: Point, b: Point, p: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2)) : 0;
  const dx = a.x + abx * t - p.x;
  const dy = a.y + aby * t - p.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Which **movable** run is under this point.
 *
 * ⚠️ Skips the two port runs and anything shorter than {@link WIRE_ROUTE.minRun}
 * — a 3px jog is a corner wearing a run's clothes, and offering it as a drag
 * target means the thing you grab is not the thing you were pointing at.
 */
export function runAt(
  points: Point[],
  route: WireRoute,
  pos: Point,
  radius: number = WIRE_ROUTE.runHitRadius
): number | undefined {
  let best: number | undefined;
  let bestDistance = radius;

  for (let run = 1; run < points.length - 1; run++) {
    if (!runCoordinate(route, run)) continue;
    const a = points[run];
    const b = points[run + 1];
    if (!a || !b) continue;
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (length < WIRE_ROUTE.minRun) continue;

    const d = distanceToSegment(a, b, pos);
    if (d <= bestDistance) {
      bestDistance = d;
      best = run;
    }
  }

  return best;
}

/**
 * Which corner is under this point.
 *
 * Corners are the interior vertices of {@link routePoints}. Nearest-first, so
 * two corners dragged close together resolve to the one being pointed at.
 */
export function cornerAt(
  points: Point[],
  pos: Point,
  radius: number = WIRE_ROUTE.cornerHitRadius
): number | undefined {
  let best: number | undefined;
  let bestDistance = radius * radius;

  for (let i = 1; i < points.length - 1; i++) {
    const d = (points[i].x - pos.x) * (points[i].x - pos.x) + (points[i].y - pos.y) * (points[i].y - pos.y);
    if (d <= bestDistance) {
      bestDistance = d;
      best = i;
    }
  }

  return best;
}

/** Move one run onto the axis position under the pointer. */
export function moveRun(base: Point[], route: WireRoute, runIndex: number, pos: Point): WireRoute {
  const target = runCoordinate(route, runIndex);
  if (!target) return route;

  const next: WireRoute = { xs: route.xs.slice(), ys: route.ys.slice() };
  if (target.axis === 'x') next.xs[target.index] = (pos.x - base[0].x) / spanFor(base);
  else next.ys[target.index] = pos.y - base[0].y;
  return next;
}

/**
 * Move one corner.
 *
 * A corner is where a vertical and a horizontal run meet, so moving it writes to
 * **both** — which is the same thing as dragging each of its two runs. ⚠️ The
 * first and last corners sit on a port's row, and that row is not ours to move:
 * they slide along it and no further.
 */
export function moveCorner(base: Point[], route: WireRoute, cornerIndex: number, pos: Point): WireRoute {
  const before = runCoordinate(route, cornerIndex - 1);
  const after = runCoordinate(route, cornerIndex);

  let next = route;
  if (before) next = moveRun(base, next, cornerIndex - 1, pos);
  if (after) next = moveRun(base, next, cornerIndex, pos);
  return next;
}

/**
 * Split a run in two, adding a corner pair — the "add an anchor" gesture.
 *
 * ⚠️ **The wire does not move.** Splitting a vertical run inserts a second
 * vertical at the same `x` with a horizontal joining them at the click point, so
 * the path is pixel-identical and what you have gained is two runs you can drag
 * independently. An add that visibly bent the wire would be doing two things at
 * once, and only one of them was asked for.
 */
export function splitRun(base: Point[], route: WireRoute, runIndex: number, at: Point): WireRoute {
  const target = runCoordinate(route, runIndex);
  if (!target) return route;

  const next: WireRoute = { xs: route.xs.slice(), ys: route.ys.slice() };
  const span = spanFor(base);

  if (target.axis === 'x') {
    // A vertical run: a new vertical at the same x, joined by a horizontal at
    // the pointer's row.
    next.xs.splice(target.index + 1, 0, next.xs[target.index]);
    next.ys.splice(target.index, 0, at.y - base[0].y);
  } else {
    // A horizontal run: a new horizontal at the same y, joined by a vertical at
    // the pointer's column.
    next.ys.splice(target.index + 1, 0, next.ys[target.index]);
    next.xs.splice(target.index + 1, 0, (at.x - base[0].x) / span);
  }

  return next;
}

/**
 * Remove the corner pair a run was split from — the "delete an anchor" gesture.
 *
 * Takes a **corner** and drops the run on each side of it back into one, which
 * is the exact inverse of {@link splitRun}. Refuses when the route is already
 * the single vertical every wire starts with: there is nothing left to remove,
 * and a wire must keep one run to turn on.
 */
export function removeCorner(route: WireRoute, cornerIndex: number): WireRoute {
  if (route.xs.length <= 1) return route;

  const target = runCoordinate(route, cornerIndex);
  const previous = runCoordinate(route, cornerIndex - 1);
  const next: WireRoute = { xs: route.xs.slice(), ys: route.ys.slice() };

  // Drop the horizontal that this corner introduced, and the vertical it joined.
  if (target && target.axis === 'y') {
    next.ys.splice(target.index, 1);
    next.xs.splice(target.index + 1, 1);
  } else if (previous && previous.axis === 'y') {
    next.ys.splice(previous.index, 1);
    next.xs.splice(previous.index + 1, 1);
  } else if (target && target.axis === 'x' && next.ys.length) {
    next.ys.splice(Math.min(target.index, next.ys.length - 1), 1);
    next.xs.splice(Math.min(target.index + 1, next.xs.length - 1), 1);
  }

  return isValidRoute(next) ? next : route;
}

/** Is this the route a wire has when nobody has touched it? */
export function isDefaultRoute(base: Point[], route: WireRoute | undefined): boolean {
  if (!isValidRoute(route)) return true;
  if (route.xs.length !== 1) return false;
  return Math.abs(route.xs[0] - defaultRoute(base).xs[0]) < 1e-6;
}

/** Cumulative arc length at each vertex of a polyline. */
function arcLengths(points: Point[]): number[] {
  const at = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    at.push(at[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return at;
}

/**
 * A point at `t` along the route, **by arc length**.
 *
 * ⚠️ Arc length, not vertex index. A square route's runs are wildly uneven — a
 * long horizontal and a 4px jog are one vertex apart — so stepping by index
 * would make the hover bead crawl the long side and jump the short one, and put
 * the wire label somewhere nobody asked for.
 */
export function pointOnRoute(points: Point[], t: number): Point | undefined {
  if (!points || !points.length) return undefined;
  if (points.length === 1) return points[0];

  const at = arcLengths(points);
  const total = at[at.length - 1];
  if (!(total > 0)) return points[0];

  const target = Math.max(0, Math.min(1, isFinite(t) ? t : 0)) * total;
  for (let i = 1; i < points.length; i++) {
    if (at[i] < target) continue;
    const span = at[i] - at[i - 1];
    const u = span > 1e-9 ? (target - at[i - 1]) / span : 0;
    return {
      x: points[i - 1].x + (points[i].x - points[i - 1].x) * u,
      y: points[i - 1].y + (points[i].y - points[i - 1].y) * u
    };
  }
  return points[points.length - 1];
}

/**
 * How much to round each corner, clamped so a fillet can never eat more than
 * half of either run it sits between.
 *
 * Without the clamp, `arcTo` on a corner tighter than the radius draws an arc
 * that leaves the route entirely — the wire visibly departs from its own path at
 * exactly the places a builder was most deliberate about.
 */
export function cornerRadiusAt(points: Point[], index: number, radius: number = WIRE_ROUTE.cornerRadius): number {
  if (index <= 0 || index >= points.length - 1) return 0;
  const a = points[index - 1];
  const b = points[index];
  const c = points[index + 1];
  const back = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  const fwd = Math.abs(c.x - b.x) + Math.abs(c.y - b.y);
  return Math.max(0, Math.min(radius, back * 0.5, fwd * 0.5));
}
