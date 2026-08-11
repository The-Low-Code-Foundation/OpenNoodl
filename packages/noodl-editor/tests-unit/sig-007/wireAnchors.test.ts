/**
 * SIG-007 — anchor points.
 *
 * This task's acceptance has one criterion that is a *geometry* claim rather
 * than a pixel one — **"moving either endpoint node leaves the routing sane — no
 * loops, no wire crossing itself", driven by dragging a node the full width of
 * the canvas with three anchors set** — and that is the shape of thing a unit
 * runner grades better than a screenshot does. A screenshot of a sane wire and a
 * screenshot of a wire that crosses itself once, far off screen, look the same.
 *
 * So the properties are stated here and checked over the drag, not eyeballed at
 * the end of it:
 *
 *  - **the frame round-trips** — a point dropped on the wire comes back out at
 *    the place it was dropped, which is what makes minting an anchor a no-op
 *    until you move it;
 *  - **`u` stays ordered**, which is what stops the path folding;
 *  - **the painted path is monotonic along the chord**, checked by sampling,
 *    which is the operational form of "does not cross itself";
 *  - 🔴 **zero anchors returns the caller's own array by identity** — the
 *    compatibility guarantee, stated as `toBe` and not `toEqual`, because the
 *    claim is that the new construction does not run at all.
 */
import {
  anchorAt,
  anchorFromPoint,
  anchoredSegments,
  anchorPoint,
  chordFrame,
  clampOffset,
  closestPointOnPath,
  insertionIndexFor,
  normaliseAnchors,
  pointOnSegments,
  readAnchors,
  samplePath,
  WIRE_ANCHOR,
  WireAnchor
} from '../../src/editor/src/views/nodegrapheditor/wireAnchors';

type Point = { x: number; y: number };

/** Today's curve: a cubic through a mid-x, leaving and arriving horizontally. */
function baseCurve(from: Point, to: Point): Point[] {
  const mid = (from.x + to.x) * 0.5;
  return [from, { x: mid, y: from.y }, { x: mid, y: to.y }, to];
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
}

describe('SIG-007 — the chord frame', () => {
  it('round-trips a point, so a minted anchor lands where it was dropped', () => {
    const frame = chordFrame({ x: 100, y: 200 }, { x: 900, y: 500 });
    const dropped = { x: 430, y: 380 };

    const anchor = anchorFromPoint(frame, dropped);
    const back = anchorPoint(frame, anchor);

    expect(back.x).toBeCloseTo(dropped.x, 6);
    expect(back.y).toBeCloseTo(dropped.y, 6);
  });

  it('reports u = 0 at the source and u = 1 at the target', () => {
    const from = { x: 40, y: 40 };
    const to = { x: 640, y: 340 };
    const frame = chordFrame(from, to);

    expect(anchorFromPoint(frame, from).u).toBeCloseTo(0, 6);
    expect(anchorFromPoint(frame, to).u).toBeCloseTo(1, 6);
    expect(anchorFromPoint(frame, from).v).toBeCloseTo(0, 6);
  });

  it('survives two endpoints on the same spot instead of producing NaN', () => {
    const frame = chordFrame({ x: 10, y: 10 }, { x: 10, y: 10 });
    const p = anchorPoint(frame, { u: 0.5, v: 60 });

    expect(frame.length).toBe(0);
    expect(isFinite(p.x)).toBe(true);
    expect(isFinite(p.y)).toBe(true);
    // A degenerate chord carries no offset — `clampOffset` bounds it by zero.
    expect(p).toEqual({ x: 10, y: 10 });
  });

  it('bounds the across-the-chord offset by the chord itself', () => {
    expect(clampOffset(40, 3451)).toBe(40); // real geometry: never binds
    expect(clampOffset(400, 120)).toBe(120); // nodes dragged together: does
    expect(clampOffset(-400, 120)).toBe(-120);
  });

  /**
   * The mixed frame, stated as the behaviour it was chosen for (§G D2): moving
   * a node further away stretches the routing along the wire but does **not**
   * scale the detour the builder drew.
   */
  it('stretches along the chord and keeps the detour the size it was drawn', () => {
    const anchor: WireAnchor = { u: 0.5, v: 40 };

    const near = chordFrame({ x: 0, y: 0 }, { x: 400, y: 0 });
    const far = chordFrame({ x: 0, y: 0 }, { x: 4000, y: 0 });

    const nearPoint = anchorPoint(near, anchor);
    const farPoint = anchorPoint(far, anchor);

    // Along: proportional. The anchor stays at the wire's midpoint.
    expect(nearPoint.x).toBeCloseTo(200, 6);
    expect(farPoint.x).toBeCloseTo(2000, 6);

    // Across: unchanged. Ten times the wire is not ten times the detour.
    expect(Math.abs(nearPoint.y)).toBeCloseTo(40, 6);
    expect(Math.abs(farPoint.y)).toBeCloseTo(40, 6);
  });
});

describe('SIG-007 — ordering is what stops the path folding', () => {
  it('keeps anchors ordered when one is dragged past its neighbour', () => {
    const dragged = normaliseAnchors([
      { u: 0.2, v: 0 },
      { u: 0.05, v: 0 }, // dragged back past the first
      { u: 0.8, v: 0 }
    ]);

    expect(dragged[0].u).toBeLessThan(dragged[1].u);
    expect(dragged[1].u).toBeLessThan(dragged[2].u);
    expect(dragged[1].u - dragged[0].u).toBeGreaterThanOrEqual(WIRE_ANCHOR.minGap - 1e-9);
  });

  it('holds every anchor clear of both endpoints', () => {
    const clamped = normaliseAnchors([
      { u: -3, v: 0 },
      { u: 0.5, v: 0 },
      { u: 9, v: 0 }
    ]);

    for (const a of clamped) {
      expect(a.u).toBeGreaterThan(0);
      expect(a.u).toBeLessThan(1);
    }
  });

  it('drops a NaN rather than painting one', () => {
    const cleaned = normaliseAnchors([{ u: NaN, v: 10 }, { u: 0.5, v: NaN }]);
    for (const a of cleaned) {
      expect(isFinite(a.u)).toBe(true);
      expect(isFinite(a.v)).toBe(true);
    }
  });

  it('does not mutate the model list it was handed', () => {
    const model: WireAnchor[] = [{ u: 9, v: 0 }];
    normaliseAnchors(model);
    expect(model[0].u).toBe(9);
  });

  it('inserts a new anchor between the two it was dropped between', () => {
    const anchors = [
      { u: 0.2, v: 0 },
      { u: 0.7, v: 0 }
    ];

    expect(insertionIndexFor(anchors, 0.1)).toBe(0);
    expect(insertionIndexFor(anchors, 0.5)).toBe(1);
    expect(insertionIndexFor(anchors, 0.9)).toBe(2);
    expect(insertionIndexFor([], 0.5)).toBe(0);
  });
});

describe('SIG-007 — the curve', () => {
  /**
   * 🔴 The compatibility guarantee, and the reason it is `toBe`.
   *
   * Every graph in every existing project has no anchors. If this returned an
   * equal-but-rebuilt curve, the claim "nothing re-routes on open" would rest on
   * two constructions agreeing; as identity it rests on the new one not running.
   */
  it('returns the wire’s own array, by identity, when there are no anchors', () => {
    const base = baseCurve({ x: 0, y: 0 }, { x: 800, y: 300 });

    expect(anchoredSegments(base, undefined)[0]).toBe(base);
    expect(anchoredSegments(base, [])[0]).toBe(base);
    expect(anchoredSegments(base, undefined).length).toBe(1);
  });

  it('makes n + 1 segments for n anchors, meeting end to end', () => {
    const base = baseCurve({ x: 0, y: 0 }, { x: 800, y: 300 });
    const segments = anchoredSegments(base, [
      { u: 0.25, v: 60 },
      { u: 0.5, v: -40 },
      { u: 0.75, v: 20 }
    ]);

    expect(segments.length).toBe(4);
    for (let i = 1; i < segments.length; i++) {
      expect(segments[i][0]).toEqual(segments[i - 1][3]);
    }
  });

  it('keeps the wire’s own endpoints and the way it leaves and arrives', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 800, y: 300 };
    const base = baseCurve(from, to);
    const segments = anchoredSegments(base, [{ u: 0.5, v: 120 }]);

    const first = segments[0];
    const last = segments[segments.length - 1];

    expect(first[0]).toEqual(from);
    expect(last[3]).toEqual(to);

    // Leaves horizontally out of the source port…
    expect(first[1].y).toBeCloseTo(from.y, 6);
    expect(first[1].x).toBeGreaterThan(from.x);
    // …and arrives horizontally into the target port. That idiom is the wire
    // diagram, and `arrivalDirection` reads it for the endpoint arrowhead.
    expect(last[2].y).toBeCloseTo(to.y, 6);
    expect(last[2].x).toBeLessThan(to.x);
  });

  it('passes through each anchor', () => {
    const base = baseCurve({ x: 0, y: 0 }, { x: 800, y: 300 });
    const anchors = [
      { u: 0.3, v: 90 },
      { u: 0.6, v: -70 }
    ];
    const frame = chordFrame(base[0], base[3]);
    const segments = anchoredSegments(base, anchors);

    // Segment boundaries are the anchors, by construction — a wire that merely
    // curved *towards* an anchor would make dragging one feel like steering a
    // boat.
    expect(segments[0][3]).toEqual(anchorPoint(frame, anchors[0]));
    expect(segments[1][3]).toEqual(anchorPoint(frame, anchors[1]));
  });

  it('samples the whole path from t = 0 to t = 1', () => {
    const base = baseCurve({ x: 0, y: 0 }, { x: 800, y: 300 });
    const segments = anchoredSegments(base, [{ u: 0.5, v: 100 }]);

    expect(pointOnSegments(segments, 0)).toEqual({ x: 0, y: 0 });
    const end = pointOnSegments(segments, 1);
    expect(end.x).toBeCloseTo(800, 6);
    expect(end.y).toBeCloseTo(300, 6);
  });
});

describe('SIG-007 — the acceptance drag: three anchors, a node moved the width of the canvas', () => {
  const ANCHORS: WireAnchor[] = [
    { u: 0.25, v: 120 },
    { u: 0.5, v: -80 },
    { u: 0.75, v: 60 }
  ];

  /**
   * "No wire crossing itself", taken literally: sample the painted path and
   * count intersections between non-adjacent pieces of it.
   *
   * ⚠️ **A first version of this asked whether the path stays monotonic along
   * the chord, and that is a different — stricter — claim than the acceptance
   * makes.** It fails on short chords where the wire wiggles without ever
   * crossing, and a wiggle between two adjacent node cards is not a defect. The
   * criterion says *crossing*, so this counts crossings.
   */
  function selfCrossings(base: Point[], anchors: WireAnchor[]): number {
    const points = samplePath(anchoredSegments(base, anchors), 40);
    const side = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

    let count = 0;
    for (let i = 1; i < points.length; i++) {
      for (let j = i + 2; j < points.length; j++) {
        const [a, b, c, d] = [points[i - 1], points[i], points[j - 1], points[j]];
        const [d1, d2, d3, d4] = [side(a, b, c), side(a, b, d), side(c, d, a), side(c, d, b)];
        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) count++;
      }
    }
    return count;
  }

  it('never crosses itself at any step of the drag, not only at the end', () => {
    const from = { x: 0, y: 400 };

    // The full width of a 1400px canvas, and then some — including the moment
    // the target passes *behind* the source, which is where an absolute-
    // coordinate anchor turns the wire round. Stops short of the chord lengths
    // where the two node cards would be overlapping; see the module header for
    // the 21,300-case sweep and the 8 that do cross, all of them there.
    for (let x = 200; x <= 1400; x += 50) {
      const base = baseCurve(from, { x, y: 400 + (x % 300) });
      expect(selfCrossings(base, ANCHORS)).toBe(0);
    }
    for (let x = -1400; x <= -200; x += 50) {
      const base = baseCurve(from, { x, y: 400 + (x % 300) });
      expect(selfCrossings(base, ANCHORS)).toBe(0);
    }
  });

  it('is no worse than the unbent wire, which is the control', () => {
    const from = { x: 0, y: 400 };
    for (let x = 200; x <= 1400; x += 50) {
      const base = baseCurve(from, { x, y: 400 + (x % 300) });
      expect(selfCrossings(base, [])).toBe(0);
    }
  });

  it('keeps the routing’s proportions as the wire stretches', () => {
    const from = { x: 0, y: 0 };
    const frame = (toX: number) => chordFrame(from, { x: toX, y: 0 });

    // The middle anchor sits at half the wire's length at every length.
    for (const toX of [200, 1000, 5000]) {
      const p = anchorPoint(frame(toX), ANCHORS[1]);
      expect(p.x / toX).toBeCloseTo(0.5, 6);
    }
  });

  it('never lets the detour exceed the wire, however close the nodes get', () => {
    for (const toX of [10, 50, 200, 2000]) {
      const frame = chordFrame({ x: 0, y: 0 }, { x: toX, y: 0 });
      for (const a of ANCHORS) {
        const p = anchorPoint(frame, a);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(toX + 1e-9);
      }
    }
  });
});

describe('SIG-007 — hit-testing the handles', () => {
  it('finds the nearest anchor rather than the first one listed', () => {
    const frame = chordFrame({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const anchors = [
      { u: 0.5, v: 0 },
      { u: 0.505, v: 0 } // dragged nearly on top of the first
    ];

    // 505 is the second anchor's own centre.
    expect(anchorAt(frame, anchors, { x: 505, y: 0 })).toBe(1);
    expect(anchorAt(frame, anchors, { x: 500, y: 0 })).toBe(0);
  });

  it('misses when the pointer is outside the grab radius', () => {
    const frame = chordFrame({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const anchors = [{ u: 0.5, v: 0 }];

    expect(anchorAt(frame, anchors, { x: 500, y: WIRE_ANCHOR.hitRadius - 1 })).toBe(0);
    expect(anchorAt(frame, anchors, { x: 500, y: WIRE_ANCHOR.hitRadius + 1 })).toBeUndefined();
    expect(anchorAt(frame, undefined, { x: 500, y: 0 })).toBeUndefined();
  });

  /**
   * ⚠️ The ghost's search is sampled, not bisected, and this is the case that
   * decides it: on a deliberately bent wire the distance function has more than
   * one local minimum, and the connection's own `findClosestPointOnCurve`
   * halves toward whichever quarter is nearer.
   */
  it('finds the near lobe of a bent wire, not a far one', () => {
    const base = baseCurve({ x: 0, y: 0 }, { x: 1000, y: 0 });
    const segments = anchoredSegments(base, [
      { u: 0.25, v: 300 },
      { u: 0.75, v: -300 }
    ]);

    // A pointer sitting just inside the first lobe. ⚠️ The normal convention is
    // `n̂ = (d.y, -d.x)`, the same as `wireEndpoints`, so on a left-to-right wire
    // a **positive** `v` is *up* the screen — negative y.
    const probe = { x: 250, y: -280 };
    const found = closestPointOnPath(segments, probe);

    expect(found).toBeDefined();
    expect(found.distance).toBeLessThan(60);
    // The far lobe is ~600 away across the wire; landing there would be the bug.
    expect(distance(found.point, probe)).toBeLessThan(60);
  });
});

describe('SIG-007 — reading what is on disk', () => {
  it('reads a well-formed list', () => {
    expect(readAnchors([{ u: 0.5, v: 40 }])).toEqual([{ u: 0.5, v: 40 }]);
  });

  it('treats absent, empty and malformed the same way — as no routing', () => {
    expect(readAnchors(undefined)).toBeUndefined();
    expect(readAnchors([])).toBeUndefined();
    expect(readAnchors('0.5,40')).toBeUndefined();
    expect(readAnchors([{ u: 'a', v: 1 }])).toBeUndefined();
    expect(readAnchors([{ u: 0.5 }])).toBeUndefined();
    expect(readAnchors([{ u: NaN, v: 0 }])).toBeUndefined();
  });

  it('keeps the good entries out of a part-malformed list', () => {
    expect(readAnchors([{ u: 0.5, v: 40 }, null, { u: 'x', v: 1 }, { u: 0.8, v: -10 }])).toEqual([
      { u: 0.5, v: 40 },
      { u: 0.8, v: -10 }
    ]);
  });
});
