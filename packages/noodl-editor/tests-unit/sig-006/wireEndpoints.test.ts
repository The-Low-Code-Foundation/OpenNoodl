/**
 * SIG-006 — which way does this wire go.
 *
 * The endpoint vocabulary has one job — to be *distinguishable* — and the
 * acceptance states it as a measurement in greyscale at 50% zoom rather than as
 * an impression. Two of the three things that decides are properties of the
 * polygons themselves, so they are graded here instead of only on pixels:
 *
 *  - **fill ratio**, the share of the bounding box that is painted. A circle is
 *    π/4 ≈ 0.79; a triangle and a diamond are 0.5. That is what survives being
 *    stripped of colour.
 *  - **centroid offset**, which separates the triangle from the diamond: an
 *    arrowhead's mass sits behind its tip, a diamond's is centred.
 *
 * The third — that they still differ at 50% zoom — is `glyphScaleFor`, and it is
 * the reason no choice of shape could have passed before: everything painted
 * after `CanvasRenderer` scales the context is in graph units, so a 9px glyph
 * was 4.5 screen px at half zoom.
 */
import {
  arrivalDirection,
  arrowheadPolygon,
  diamondPolygon,
  glyphForPlugIcon,
  glyphScaleFor,
  loopedAge,
  HOVER_MARK_CYCLE_MS,
  WIRE_ENDPOINT
} from '../../src/editor/src/views/nodegrapheditor/wireEndpoints';
import { travellingHeadRange, WIRE_PULSE } from '../../src/editor/src/views/nodegrapheditor/wirePulse';

type Point = { x: number; y: number };

/** Area of a simple polygon, by the shoelace formula. */
function area(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function bbox(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return { width, height, area: width * height };
}

/** How far the polygon's centroid sits from its bounding box's centre, in x. */
function centroidOffsetX(points: Point[]): number {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const xs = points.map((p) => p.x);
  return cx - (Math.min(...xs) + Math.max(...xs)) / 2;
}

describe('glyphForPlugIcon — one mapping, so the two painters cannot disagree', () => {
  it('gives each direction its own silhouette', () => {
    expect(glyphForPlugIcon('from')).toBe('circle');
    expect(glyphForPlugIcon('to')).toBe('arrowhead');
  });

  it("gives 'both' a shape of its own rather than folding it into the arrow", () => {
    // The defect this closes: the painter branched on
    // `icon === 'to' || icon === 'both'`, so an arrowhead did not actually mean
    // "it arrives here" — and it was wrong on exactly the ports where direction
    // is hardest to read.
    expect(glyphForPlugIcon('both')).toBe('diamond');
    expect(glyphForPlugIcon('both')).not.toBe(glyphForPlugIcon('to'));
  });

  it('paints nothing for a plug with no direction', () => {
    expect(glyphForPlugIcon(undefined)).toBeUndefined();
    expect(glyphForPlugIcon('')).toBeUndefined();
  });
});

describe('the three glyphs are separable without colour', () => {
  const centre = { x: 100, y: 50 };
  const head = arrowheadPolygon(centre, { x: 1, y: 0 });
  const dia = diamondPolygon(centre);
  // The circle is not a polygon; its fill ratio is the constant it always is.
  const CIRCLE_FILL = Math.PI / 4;

  it('separates the circle from the arrowhead on fill ratio', () => {
    const headFill = area(head) / bbox(head).area;
    expect(headFill).toBeCloseTo(0.5, 2);
    expect(CIRCLE_FILL - headFill).toBeGreaterThan(0.25);
  });

  it('separates the circle from the diamond on fill ratio', () => {
    const diamondFill = area(dia) / bbox(dia).area;
    expect(diamondFill).toBeCloseTo(0.5, 2);
    expect(CIRCLE_FILL - diamondFill).toBeGreaterThan(0.25);
  });

  it('separates the arrowhead from the diamond on where their mass sits', () => {
    // Same fill ratio, so this is the measurement that tells them apart.
    expect(Math.abs(centroidOffsetX(dia))).toBeCloseTo(0, 6);
    expect(Math.abs(centroidOffsetX(head))).toBeGreaterThan(1);
  });

  it('does not repeat the old 7px-disc-vs-8px-triangle mistake', () => {
    // The pair this replaced differed by one pixel of extent. Whatever else
    // changes, the arrowhead must not collapse back onto the circle's size.
    const circleExtent = WIRE_ENDPOINT.sourceRadius * 2;
    expect(bbox(head).width).toBeGreaterThan(circleExtent * 1.4);
    expect(bbox(head).height).toBeGreaterThan(circleExtent * 1.4);
  });
});

describe('arrowheadPolygon', () => {
  it('puts the tip on the endpoint, so the wire and the port anchor agree', () => {
    const tip = { x: 200, y: 80 };
    const [point] = arrowheadPolygon(tip, { x: 1, y: 0 });
    expect(point).toEqual(tip);
  });

  it('points the way the wire arrives, whichever side that is', () => {
    const tip = { x: 200, y: 80 };
    const rightwards = arrowheadPolygon(tip, { x: 1, y: 0 });
    const leftwards = arrowheadPolygon(tip, { x: -1, y: 0 });
    // The base sits behind the tip, on the side the wire came from.
    expect(rightwards[1].x).toBeLessThan(tip.x);
    expect(leftwards[1].x).toBeGreaterThan(tip.x);
  });

  it('survives an unnormalised direction', () => {
    const tip = { x: 0, y: 0 };
    const long = arrowheadPolygon(tip, { x: 40, y: 0 });
    const unit = arrowheadPolygon(tip, { x: 1, y: 0 });
    expect(long).toEqual(unit);
  });
});

describe('arrivalDirection', () => {
  it('reads the tangent at the end, not the chord', () => {
    // The curves this painter builds keep P2 and P3 on the same y, so a wire
    // arriving at a node to the right arrives travelling right — even when the
    // two nodes are at very different heights.
    const curve = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 300 },
      { x: 100, y: 300 }
    ];
    const d = arrivalDirection(curve);
    expect(d.x).toBeCloseTo(1, 6);
    expect(d.y).toBeCloseTo(0, 6);
  });

  it('falls back to the chord when the last control point is the end point', () => {
    const curve = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 0 }
    ];
    expect(arrivalDirection(curve).x).toBeCloseTo(1, 6);
  });

  it('never returns NaN for a degenerate or missing curve', () => {
    for (const curve of [undefined, [], [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 5 }]]) {
      const d = arrivalDirection(curve as Point[] | undefined);
      expect(Number.isFinite(d.x)).toBe(true);
      expect(Number.isFinite(d.y)).toBe(true);
    }
  });
});

describe('glyphScaleFor — why the glyphs survive zooming out', () => {
  it('changes nothing at 100% zoom or above', () => {
    expect(glyphScaleFor(1)).toBe(1);
    expect(glyphScaleFor(2)).toBe(1);
  });

  it('holds the glyph at its screen size as the graph shrinks', () => {
    // This is the acceptance, as arithmetic: at 50% zoom a glyph painted in
    // graph units would be half its screen size, and the pair would be back to
    // being one pixel apart.
    expect(WIRE_ENDPOINT.arrowLength * glyphScaleFor(0.5) * 0.5).toBeCloseTo(WIRE_ENDPOINT.arrowLength, 6);
    expect(WIRE_ENDPOINT.sourceRadius * glyphScaleFor(0.75) * 0.75).toBeCloseTo(WIRE_ENDPOINT.sourceRadius, 6);
  });

  it('lets them recede again below the floor, where the grid has already gone', () => {
    const floor = WIRE_ENDPOINT.minGlyphScale;
    expect(glyphScaleFor(floor / 4)).toBe(glyphScaleFor(floor));
    // i.e. at a quarter of the floor the glyph really is a quarter of the size.
    expect(WIRE_ENDPOINT.arrowLength * glyphScaleFor(0.1) * 0.1).toBeLessThan(WIRE_ENDPOINT.arrowLength);
  });

  it('does not divide by a nonsense scale', () => {
    expect(glyphScaleFor(0)).toBe(1);
    expect(glyphScaleFor(-1)).toBe(1);
    expect(glyphScaleFor(NaN)).toBe(1);
  });
});

describe('loopedAge — the hover mark repeats, using SIG-005 and not a second implementation', () => {
  it('folds an age into one cycle', () => {
    expect(loopedAge(0)).toBe(0);
    expect(loopedAge(HOVER_MARK_CYCLE_MS + 120)).toBeCloseTo(120, 6);
  });

  it('leaves the wire alone between passes', () => {
    // The cycle is longer than the crossing, so the mark reads as repeated
    // strokes in one direction rather than an unbroken stream.
    expect(HOVER_MARK_CYCLE_MS).toBeGreaterThan(WIRE_PULSE.travelMs);
    const resting = travellingHeadRange(loopedAge(WIRE_PULSE.travelMs + 200));
    expect(resting.to).toBe(1);
  });

  it('always restarts at the source, so a hover never catches the bead mid-flight', () => {
    const justEntered = travellingHeadRange(loopedAge(0));
    expect(justEntered.to).toBe(0);
    expect(justEntered.from).toBe(0);
  });

  it('treats a negative age as not yet started', () => {
    expect(loopedAge(-500)).toBe(0);
  });
});
