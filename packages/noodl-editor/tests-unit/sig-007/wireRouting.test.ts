/**
 * SIG-007 — square wire routing.
 *
 * The point-based model this replaced was wrong about a *gesture*, not about
 * geometry: grab the middle of a vertical run and it should move sideways, not
 * split. A run's position has to be a stored number for that to be possible, so
 * these specs are mostly about the two directions of one mapping — route to
 * points, and a pointer back to a route — and about the invariant that keeps the
 * path orthogonal without anyone correcting it.
 */
import {
  addMarkAt,
  addMarks,
  cornerAt,
  cornerRadiusAt,
  defaultRoute,
  isDefaultRoute,
  isValidRoute,
  moveCorner,
  moveRun,
  pointOnRoute,
  readRoute,
  removeCorner,
  routePoints,
  runAt,
  runCoordinate,
  splitRun,
  WireRoute,
  WIRE_ROUTE
} from '../../src/editor/src/views/nodegrapheditor/wireRouting';

type Point = { x: number; y: number };

/** The painter's `'left'` layout: out of the source, through a mid-x, into the target. */
function baseCurve(from: Point, to: Point): Point[] {
  const mid = (from.x + to.x) * 0.5;
  return [from, { x: mid, y: from.y }, { x: mid, y: to.y }, to];
}

const FROM = { x: 100, y: 200 };
const TO = { x: 900, y: 500 };
const BASE = baseCurve(FROM, TO);

/** Every consecutive pair of corners must share exactly one coordinate. */
function isOrthogonal(points: Point[]): boolean {
  for (let i = 1; i < points.length; i++) {
    const sameX = Math.abs(points[i].x - points[i - 1].x) < 1e-6;
    const sameY = Math.abs(points[i].y - points[i - 1].y) < 1e-6;
    if (!sameX && !sameY) return false;
  }
  return true;
}

describe('SIG-007 — the untouched route is today’s wire', () => {
  it('reproduces the painter’s own control points exactly', () => {
    const points = routePoints(BASE, defaultRoute(BASE));
    expect(points).toEqual([BASE[0], BASE[1], BASE[2], BASE[3]]);
  });

  it('keeps the `inline` layout’s hook, which is not a midpoint', () => {
    // The painter routes an inline wire out to the LEFT of both nodes.
    const from = { x: 400, y: 100 };
    const to = { x: 380, y: 400 };
    const dx = Math.min(from.x, to.x) - (50 + Math.abs(to.y - from.y) * 0.2);
    const base = [from, { x: dx, y: from.y }, { x: dx, y: to.y }, to];

    const points = routePoints(base, defaultRoute(base));
    expect(points[1].x).toBeCloseTo(dx, 6);
    // ⚠️ And the stored fraction is far OUTSIDE `[0, 1]` — 6.5 here, because
    // the span is negative and the hook is left of both nodes. Clamping it to
    // `[0, 1]` was a real defect in the point model, and the sign is not the
    // tell: which way it escapes depends on which node is to the right.
    const fraction = defaultRoute(base).xs[0];
    expect(fraction < 0 || fraction > 1).toBe(true);
  });

  it('treats an absent or malformed route as untouched', () => {
    expect(routePoints(BASE, undefined)).toEqual(routePoints(BASE, defaultRoute(BASE)));
    expect(readRoute(undefined)).toBeUndefined();
    expect(readRoute({ xs: [0.5], ys: [0] })).toBeUndefined(); // xs must be ys+1
    expect(readRoute({ xs: [NaN], ys: [] })).toBeUndefined();
    expect(readRoute('0.5')).toBeUndefined();
    expect(readRoute({ xs: [0.5], ys: [] })).toEqual({ xs: [0.5], ys: [] });
  });
});

describe('SIG-007 — the path is orthogonal by construction', () => {
  const route: WireRoute = { xs: [0.3, 0.7], ys: [90] };

  it('shares exactly one coordinate between every pair of corners', () => {
    expect(isOrthogonal(routePoints(BASE, route))).toBe(true);
  });

  it('meets both ports where the ports are', () => {
    const points = routePoints(BASE, route);
    expect(points[0]).toEqual(FROM);
    expect(points[points.length - 1]).toEqual(TO);
    // Leaves and arrives horizontally — what the endpoint arrowhead reads.
    expect(points[1].y).toBeCloseTo(FROM.y, 6);
    expect(points[points.length - 2].y).toBeCloseTo(TO.y, 6);
  });

  it('stays orthogonal however the route grows', () => {
    let r = defaultRoute(BASE);
    for (let i = 0; i < 5; i++) {
      const points = routePoints(BASE, r);
      const run = runAt(points, r, pointOnRoute(points, 0.5)) ?? 1;
      r = splitRun(BASE, r, run, pointOnRoute(points, 0.5));
      expect(isValidRoute(r)).toBe(true);
      expect(isOrthogonal(routePoints(BASE, r))).toBe(true);
    }
  });
});

describe('SIG-007 — a run moves, it does not split', () => {
  it('names the movable runs and refuses the two that belong to the ports', () => {
    const route: WireRoute = { xs: [0.5], ys: [] };
    // Points: P0, (x0,fy), (x0,ty), P3 → runs 0,1,2.
    expect(runCoordinate(route, 0)).toBeUndefined(); // out of the source port
    expect(runCoordinate(route, 1)).toEqual({ axis: 'x', index: 0 });
    expect(runCoordinate(route, 2)).toBeUndefined(); // into the target port
  });

  it('moves a vertical run sideways and nothing else', () => {
    const route: WireRoute = { xs: [0.5], ys: [] };
    const before = routePoints(BASE, route);
    const moved = moveRun(BASE, route, 1, { x: 300, y: 999 });
    const after = routePoints(BASE, moved);

    expect(after[1].x).toBeCloseTo(300, 6);
    expect(after[2].x).toBeCloseTo(300, 6);
    // The pointer's y is ignored — a vertical run has one degree of freedom.
    expect(after[1].y).toBeCloseTo(before[1].y, 6);
    expect(after[2].y).toBeCloseTo(before[2].y, 6);
    expect(after[0]).toEqual(FROM);
    expect(after[after.length - 1]).toEqual(TO);
  });

  it('moves a horizontal run up and down and nothing else', () => {
    const route: WireRoute = { xs: [0.3, 0.7], ys: [90] };
    const points = routePoints(BASE, route);
    const horizontal = points.findIndex((_p, i) => runCoordinate(route, i)?.axis === 'y');

    const moved = moveRun(BASE, route, horizontal, { x: 999, y: 420 });
    const after = routePoints(BASE, moved);

    expect(after[horizontal].y).toBeCloseTo(420, 6);
    expect(after[horizontal + 1].y).toBeCloseTo(420, 6);
    expect(after[horizontal].x).toBeCloseTo(points[horizontal].x, 6);
  });

  it('finds the run under the pointer, and skips the port runs', () => {
    const route: WireRoute = { xs: [0.5], ys: [] };
    const points = routePoints(BASE, route);
    const midOfVertical = { x: points[1].x, y: (points[1].y + points[2].y) / 2 };

    expect(runAt(points, route, midOfVertical)).toBe(1);
    // On the horizontal out of the source — real wire, but not movable.
    expect(runAt(points, route, { x: (points[0].x + points[1].x) / 2, y: points[0].y })).toBeUndefined();
    expect(runAt(points, route, { x: midOfVertical.x, y: midOfVertical.y + 400 })).toBeUndefined();
  });

  /**
   * ⚠️ A run shorter than `minRun` is a corner wearing a run's clothes. Offering
   * it as a drag target means the thing you grab is not the thing you were
   * pointing at.
   */
  it('does not offer a run too short to aim at', () => {
    const route: WireRoute = { xs: [0.5, 0.5 + 1e-4], ys: [90] };
    const points = routePoints(BASE, route);
    const shortRun = points.findIndex((_p, i) => runCoordinate(route, i)?.axis === 'y');
    const middle = { x: (points[shortRun].x + points[shortRun + 1].x) / 2, y: points[shortRun].y };

    const hit = runAt(points, route, middle);
    expect(hit === shortRun).toBe(false);
  });
});

describe('SIG-007 — a corner is where two runs meet', () => {
  const route: WireRoute = { xs: [0.3, 0.7], ys: [90] };

  it('is asked about before the run it sits on', () => {
    const points = routePoints(BASE, route);
    expect(cornerAt(points, points[2])).toBe(2);
    expect(cornerAt(points, { x: points[2].x + WIRE_ROUTE.cornerHitRadius + 1, y: points[2].y })).not.toBe(2);
  });

  it('moves both of its runs at once', () => {
    const points = routePoints(BASE, route);
    const target = { x: 500, y: 350 };
    const moved = moveCorner(BASE, route, 2, target);
    const after = routePoints(BASE, moved);

    expect(after[2].x).toBeCloseTo(target.x, 6);
    expect(after[2].y).toBeCloseTo(target.y, 6);
    expect(isOrthogonal(after)).toBe(true);
  });

  /**
   * The first and last corners sit on a port's row, and that row is not ours to
   * move — they slide along it and no further.
   */
  it('slides a port-row corner along the row and no further', () => {
    const points = routePoints(BASE, route);
    const moved = moveCorner(BASE, route, 1, { x: 250, y: 999 });
    const after = routePoints(BASE, moved);

    expect(after[1].x).toBeCloseTo(250, 6);
    expect(after[1].y).toBeCloseTo(FROM.y, 6);
    expect(after[0]).toEqual(FROM);
  });
});

describe('SIG-007 — adding and removing a corner', () => {
  it('adds two runs without moving the wire one pixel', () => {
    const route = defaultRoute(BASE);
    const points = routePoints(BASE, route);
    const on = pointOnRoute(points, 0.5);

    const split = splitRun(BASE, route, runAt(points, route, on), on);
    const after = routePoints(BASE, split);

    expect(split.xs.length).toBe(2);
    expect(split.ys.length).toBe(1);
    // 🔴 The path is unchanged — the gain is two runs you can drag, not a bend.
    const sampled = (pts: Point[]) => [0, 0.25, 0.5, 0.75, 1].map((t) => pointOnRoute(pts, t));
    sampled(after).forEach((p, i) => {
      expect(p.x).toBeCloseTo(sampled(points)[i].x, 4);
      expect(p.y).toBeCloseTo(sampled(points)[i].y, 4);
    });
  });

  it('removes a corner and comes back to where it started', () => {
    const route = defaultRoute(BASE);
    const points = routePoints(BASE, route);
    const on = pointOnRoute(points, 0.5);
    const split = splitRun(BASE, route, runAt(points, route, on), on);

    const back = removeCorner(split, 2);
    expect(back.xs.length).toBe(1);
    expect(back.ys.length).toBe(0);
    expect(isDefaultRoute(BASE, back)).toBe(true);
  });

  it('refuses to remove the last run — a wire has to turn somewhere', () => {
    const route = defaultRoute(BASE);
    expect(removeCorner(route, 1)).toEqual(route);
  });
});

describe('SIG-007 — walking the route', () => {
  it('samples by arc length, not by vertex', () => {
    // A long horizontal and a short vertical: by vertex, t=0.5 would land at the
    // corner; by length it is most of the way along the long run.
    const route: WireRoute = { xs: [0.98], ys: [] };
    const points = routePoints(BASE, route);
    const half = pointOnRoute(points, 0.5);

    expect(half.y).toBeCloseTo(FROM.y, 6);
    expect(half.x).toBeGreaterThan(FROM.x + (TO.x - FROM.x) * 0.3);
  });

  it('starts and ends on the ports', () => {
    const points = routePoints(BASE, { xs: [0.3, 0.7], ys: [90] });
    expect(pointOnRoute(points, 0)).toEqual(FROM);
    expect(pointOnRoute(points, 1)).toEqual(TO);
  });

  it('never lets a fillet eat more than half of either run', () => {
    const route: WireRoute = { xs: [0.5, 0.502], ys: [210] };
    const points = routePoints(BASE, route);
    for (let i = 1; i < points.length - 1; i++) {
      const back = Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
      const fwd = Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y);
      expect(cornerRadiusAt(points, i)).toBeLessThanOrEqual(Math.min(back, fwd) / 2 + 1e-9);
    }
  });
});

describe('SIG-007 — the "+" that adds a corner', () => {
  it('offers one per movable run, at its midpoint', () => {
    const route = defaultRoute(BASE);
    const points = routePoints(BASE, route);
    const marks = addMarks(points, route);

    // One movable run on an untouched wire: the vertical.
    expect(marks.length).toBe(1);
    expect(marks[0].run).toBe(1);
    expect(marks[0].point.x).toBeCloseTo(points[1].x, 6);
    expect(marks[0].point.y).toBeCloseTo((points[1].y + points[2].y) / 2, 6);
  });

  it('offers none on the runs that belong to the ports', () => {
    const route = defaultRoute(BASE);
    const marks = addMarks(routePoints(BASE, route), route);
    for (const mark of marks) expect(runCoordinate(route, mark.run)).toBeDefined();
  });

  /**
   * ⚠️ A short run has nowhere to put a "+" that is not already occupied by the
   * two corners at its ends, so every click there would be a coin toss.
   */
  it('offers none on a run too short to hold one', () => {
    const route: WireRoute = { xs: [0.5, 0.5 + 1e-4], ys: [90] };
    const points = routePoints(BASE, route);
    const marks = addMarks(points, route);
    const shortRun = points.findIndex((_p, i) => runCoordinate(route, i)?.axis === 'y');
    expect(marks.some((m) => m.run === shortRun)).toBe(false);
  });

  it('is hit-testable where it is painted, and not far from it', () => {
    const route = defaultRoute(BASE);
    const points = routePoints(BASE, route);
    const mark = addMarks(points, route)[0];

    expect(addMarkAt(points, route, mark.point)).toBe(mark.run);
    expect(addMarkAt(points, route, { x: mark.point.x, y: mark.point.y + 40 })).toBeUndefined();
  });

  /** Clicking it splits that run — the whole point of the mark. */
  it('names a run `splitRun` accepts', () => {
    const route = defaultRoute(BASE);
    const points = routePoints(BASE, route);
    const mark = addMarks(points, route)[0];

    const split = splitRun(BASE, route, mark.run, mark.point);
    expect(split.xs.length).toBe(2);
    expect(split.ys.length).toBe(1);
    expect(isValidRoute(split)).toBe(true);
  });
});
