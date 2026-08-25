/**
 * FB-016 scope 4 — where the transform-origin crosshair puts its point, graded without a renderer.
 *
 * The same constraint as `fb-016-box-model-overlay.test.ts`: jsdom has no layout engine, so every
 * rect it reports is zero and a spec that built an element and asked where the crosshair went
 * would pass on a box of zeroes whatever the code did. The geometry is fed in instead, and what is
 * graded is the arithmetic and the wording.
 *
 * 🔴 **The rows that matter here are the ones where the naive answer and the right answer
 * differ.** Resolving `50%` against `getBoundingClientRect()` is correct for every unrotated
 * element and wrong for exactly the elements this feature exists to explain, so a suite made only
 * of unrotated arms would pass on the bug. Two arms below are built to disagree with the naive
 * reading — `an origin at the corner of a rotated square` and `a zoomed page` — and they are
 * marked as the discriminators they are.
 */

import type { ComputedReader, RectLike } from '../src/box-model-overlay';
import {
  IDENTITY,
  crosshairArms,
  describeOrigin,
  nudgeClear,
  originInElement,
  parseTransformMatrix,
  readOriginDeclaration,
  resolveOriginAxis,
  resolveOriginPoint,
  splitOrigin,
  type OriginInput
} from '../src/transform-origin-crosshair';

function style(declarations: Record<string, string>): ComputedReader {
  return { getPropertyValue: (property: string) => declarations[property] || '' };
}

const NOTHING = style({});

/** 45°, to the precision a browser writes into a computed `matrix(...)`. */
const ROT45 = 'matrix(0.707107, 0.707107, -0.707107, 0.707107, 0, 0)';

function input(over: Partial<OriginInput>): OriginInput {
  return {
    rect: { x: 0, y: 0, width: 100, height: 100 },
    layout: { width: 100, height: 100 },
    computed: NOTHING,
    specified: NOTHING,
    ...over
  };
}

describe('reading one axis of a transform-origin', () => {
  it('takes a pixel length as it stands', () => {
    expect(resolveOriginAxis('24px', 200)).toBe(24);
  });

  it('resolves a percentage against the extent it is given', () => {
    expect(resolveOriginAxis('25%', 200)).toBe(50);
  });

  it('reads the keywords as the percentages they are', () => {
    expect(resolveOriginAxis('left', 200)).toBe(0);
    expect(resolveOriginAxis('center', 200)).toBe(100);
    expect(resolveOriginAxis('right', 200)).toBe(200);
    expect(resolveOriginAxis('top', 80)).toBe(0);
    expect(resolveOriginAxis('bottom', 80)).toBe(80);
  });

  it('allows a negative and an over-100% origin, which are both legal and both the hard cases', () => {
    expect(resolveOriginAxis('-20px', 200)).toBe(-20);
    expect(resolveOriginAxis('150%', 200)).toBe(300);
  });

  it('answers null rather than a number for something it cannot read', () => {
    expect(resolveOriginAxis('inherit', 200)).toBeNull();
    expect(resolveOriginAxis('', 200)).toBeNull();
  });
});

describe('splitting a declaration into x and y', () => {
  it('takes a plain pair in the order written', () => {
    expect(splitOrigin('10px 20px')).toEqual({ x: '10px', y: '20px' });
  });

  it('🔴 puts a swapped keyword pair back in x, y order — `top left` is legal CSS', () => {
    expect(splitOrigin('top left')).toEqual({ x: 'left', y: 'top' });
    expect(splitOrigin('bottom right')).toEqual({ x: 'right', y: 'bottom' });
  });

  it('control — the same two words the other way round are not swapped', () => {
    expect(splitOrigin('left top')).toEqual({ x: 'left', y: 'top' });
  });

  it('centres the other axis when only one value is given', () => {
    expect(splitOrigin('30px')).toEqual({ x: '30px', y: 'center' });
    expect(splitOrigin('bottom')).toEqual({ x: 'center', y: 'bottom' });
  });

  it('drops the z offset, which a crosshair on a flat surface has nothing to say about', () => {
    expect(splitOrigin('10px 20px 5px')).toEqual({ x: '10px', y: '20px' });
  });

  it('answers null for an empty declaration', () => {
    expect(splitOrigin('   ')).toBeNull();
  });
});

describe('which declaration gets read', () => {
  it('🔴 prefers the specified value, because that is where a percentage still says %', () => {
    const read = readOriginDeclaration(
      input({
        specified: style({ 'transform-origin': '50% 50%' }),
        computed: style({ 'transform-origin': '180px 30px' })
      })
    );
    expect(read).toEqual({ value: '50% 50%', isDefault: false });
  });

  it('falls back to the computed value when the author set nothing inline and it is not the centre', () => {
    // 100×100 box, so the centre is (50, 50) — this is not it, and something must have set it.
    const read = readOriginDeclaration(input({ computed: style({ 'transform-origin': '180px 30px' }) }));
    expect(read).toEqual({ value: '180px 30px', isDefault: false });
  });

  it("🔴 THE DRIVE'S FINDING — a computed pair that IS the centre is reported as the default", () => {
    // On the running fixture the untouched element computed to `180px 30px` on a 360×60 box, and
    // the label printed those pixels: two numbers the author never typed, in units they never
    // chose, with nothing saying it was simply the centre. `getComputedStyle` cannot say where a
    // declaration came from, so this is settled by value — and an origin that resolves to the
    // centre behaves as the default whoever wrote it.
    const read = readOriginDeclaration(
      input({
        layout: { width: 360, height: 60 },
        rect: { x: 20, y: 20, width: 360, height: 60 },
        computed: style({ 'transform-origin': '180px 30px' })
      })
    );
    expect(read).toEqual({ value: '50% 50%', isDefault: true });
  });

  it('control — one pixel off the centre is NOT called the default, so the test is on the value', () => {
    const read = readOriginDeclaration(
      input({
        layout: { width: 360, height: 60 },
        computed: style({ 'transform-origin': '200px 30px' })
      })
    );
    expect(read).toEqual({ value: '200px 30px', isDefault: false });
  });

  it('an inline declaration still wins even when it happens to be the centre', () => {
    // The author wrote this one, so it is reported in their words and not relabelled.
    const read = readOriginDeclaration(
      input({
        layout: { width: 360, height: 60 },
        specified: style({ 'transform-origin': '50% 50%' }),
        computed: style({ 'transform-origin': '180px 30px' })
      })
    );
    expect(read).toEqual({ value: '50% 50%', isDefault: false });
  });

  it('names CSS’s own default when neither says anything, and says that it is the default', () => {
    expect(readOriginDeclaration(input({}))).toEqual({ value: '50% 50%', isDefault: true });
  });
});

describe('the origin in the element’s own coordinates', () => {
  it('🔴 resolves a percentage against the LAYOUT size, not the rect', () => {
    // The discriminator: the two sizes are deliberately different, which is what a transformed
    // element (or a zoomed page) actually reports. Resolving against the rect would give 200.
    const local = originInElement(
      input({
        rect: { x: 0, y: 0, width: 400, height: 400 },
        layout: { width: 100, height: 100 },
        specified: style({ 'transform-origin': '50% 50%' })
      })
    );
    expect(local).toEqual({ x: 50, y: 50 });
  });

  it('control — when layout and rect agree, so does the naive reading, so the row above is the one doing the work', () => {
    const local = originInElement(input({ specified: style({ 'transform-origin': '50% 50%' }) }));
    expect(local).toEqual({ x: 50, y: 50 });
  });

  it('answers null when the declaration cannot be read at all', () => {
    expect(originInElement(input({ specified: style({ 'transform-origin': 'inherit' }) }))).toBeNull();
  });
});

describe('parsing the transform matrix', () => {
  it('reads `none` and an unset transform as the identity', () => {
    expect(parseTransformMatrix('none')).toEqual(IDENTITY);
    expect(parseTransformMatrix('')).toEqual(IDENTITY);
  });

  it('reads a 2D matrix in the order the browser writes it', () => {
    expect(parseTransformMatrix('matrix(2, 0, 0, 3, 10, 20)')).toEqual({ a: 2, b: 0, c: 0, d: 3, e: 10, f: 20 });
  });

  it('projects a matrix3d onto its 2D part', () => {
    const flat = 'matrix3d(2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1)';
    expect(parseTransformMatrix(flat)).toEqual({ a: 2, b: 0, c: 0, d: 3, e: 10, f: 20 });
  });

  it('falls back to the identity rather than to NaN for something it cannot parse', () => {
    expect(parseTransformMatrix('rotate(45deg)')).toEqual(IDENTITY);
    expect(parseTransformMatrix('matrix(a, b, c, d, e, f)')).toEqual(IDENTITY);
  });
});

describe('where the origin lands on screen', () => {
  it('is the rect corner plus the local offset when nothing is transformed', () => {
    const point = resolveOriginPoint(
      input({
        rect: { x: 40, y: 60, width: 100, height: 100 },
        specified: style({ 'transform-origin': '25% 75%' })
      })
    );
    expect(point).toEqual({ x: 65, y: 135 });
  });

  it('🔴 THE DISCRIMINATOR — an origin at the corner of a square rotated 45°', () => {
    // A 100×100 box rotated 45° about its own top-left corner reports a 141.42-wide bounding box,
    // and that corner ends up at the TOP-CENTRE of the diamond — not at the box's top-left, which
    // is where `rect.x + 0%` would put it. The two answers differ by 70.71px, so this row fails
    // on the naive implementation and passes on the right one.
    const point = resolveOriginPoint(
      input({
        rect: { x: 0, y: 0, width: 141.42, height: 141.42 },
        layout: { width: 100, height: 100 },
        computed: style({ transform: ROT45 }),
        specified: style({ 'transform-origin': '0% 0%' })
      })
    );
    expect(point.x).toBeCloseTo(70.71, 1);
    expect(point.y).toBeCloseTo(0, 1);
  });

  it('control — the same rotation about the centre, where the naive answer happens to be right', () => {
    // Worth stating out loud: the centre of a centred rotation is the centre of its own bounding
    // box, so this arm agrees with the naive reading and proves nothing on its own. It is here so
    // the row above cannot be read as "rotation moves the point somewhere arbitrary".
    const point = resolveOriginPoint(
      input({
        rect: { x: 0, y: 0, width: 141.42, height: 141.42 },
        layout: { width: 100, height: 100 },
        computed: style({ transform: ROT45 }),
        specified: style({ 'transform-origin': '50% 50%' })
      })
    );
    expect(point.x).toBeCloseTo(70.71, 1);
    expect(point.y).toBeCloseTo(70.71, 1);
  });

  it('🔴 THE SECOND DISCRIMINATOR — a PIXEL origin on a zoomed page', () => {
    // `document.body.style.zoom` is what the editor sets on the preview: the rect doubles and
    // `offsetWidth` does not, so a layout pixel is two screen pixels.
    //
    // ⚠️ **It has to be a pixel origin, and finding that out is why this row is worded the way it
    // is.** The first version of this arm used `50% 50%` and passed against a deliberately naive
    // implementation — a percentage of the rect and the same percentage of the layout box are the
    // same fraction of the same element, so zoom cancels and the two readings agree. A length
    // does not cancel: 24 layout px is 48 screen px, and only one of the two answers says so.
    const point = resolveOriginPoint(
      input({
        rect: { x: 0, y: 0, width: 400, height: 200 },
        layout: { width: 200, height: 100 },
        specified: style({ 'transform-origin': '24px 10px' })
      })
    );
    expect(point).toEqual({ x: 48, y: 20 });
  });

  it('a percentage on a zoomed page lands in the same place either way, and is here to say so', () => {
    // The arm that does NOT discriminate, kept and labelled rather than deleted: it is true, and
    // leaving it unlabelled next to the row above would misrepresent what that row proves.
    const point = resolveOriginPoint(
      input({
        rect: { x: 0, y: 0, width: 400, height: 200 },
        layout: { width: 200, height: 100 },
        specified: style({ 'transform-origin': '50% 50%' })
      })
    );
    expect(point).toEqual({ x: 200, y: 100 });
  });

  it('places an origin that sits outside the element outside it on screen too', () => {
    const point = resolveOriginPoint(
      input({
        rect: { x: 10, y: 10, width: 100, height: 100 },
        specified: style({ 'transform-origin': '150% -20px' })
      })
    );
    expect(point).toEqual({ x: 160, y: -10 });
  });

  it('answers null rather than NaN when the declaration cannot be read', () => {
    expect(resolveOriginPoint(input({ specified: style({ 'transform-origin': 'inherit' }) }))).toBeNull();
  });

  it('survives a zero-height element without dividing by it', () => {
    const point = resolveOriginPoint(
      input({
        rect: { x: 5, y: 5, width: 100, height: 0 },
        layout: { width: 100, height: 0 },
        specified: style({ 'transform-origin': '50% 50%' })
      })
    );
    expect(point).toEqual({ x: 55, y: 5 });
  });
});

describe('the arms', () => {
  const rect: RectLike = { x: 100, y: 100, width: 200, height: 100 };

  it('span the element with an overhang on each side when the point is inside it', () => {
    const arms = crosshairArms(rect, { x: 200, y: 150 }, 16);
    expect(arms.horizontal).toEqual({ x: 84, y: 150, width: 232, height: 0 });
    expect(arms.vertical).toEqual({ x: 200, y: 84, width: 0, height: 132 });
  });

  it('🔴 reach the point when it is outside the element, which is the case that needs them', () => {
    // `transform-origin: 150%` is legal and is exactly the value whose effect is hardest to
    // picture. An arm that stopped at the element's edge would stop short of what it points at.
    const arms = crosshairArms(rect, { x: 400, y: 150 }, 16);
    expect(arms.horizontal.x).toBe(84);
    expect(arms.horizontal.x + arms.horizontal.width).toBe(416);
  });

  it('cross exactly at the point', () => {
    const arms = crosshairArms(rect, { x: 137, y: 162 }, 16);
    expect(arms.horizontal.y).toBe(162);
    expect(arms.vertical.x).toBe(137);
  });
});

describe('what the label says', () => {
  it('🔴 names the declaration the author wrote AND the pixels it resolved to', () => {
    // The two halves answer different questions and neither is sufficient: `50%` is the thing the
    // author can change, `180px` is the thing that happened, and *a percentage of what* is the
    // ambiguity the whole scope exists to remove.
    const lines = describeOrigin(
      input({
        layout: { width: 360, height: 60 },
        rect: { x: 20, y: 20, width: 360, height: 60 },
        specified: style({ 'transform-origin': '50% 50%' }),
        computed: style({ 'transform-origin': '180px 30px' })
      })
    );
    expect(lines[0]).toBe('transform-origin: 50% 50%');
    expect(lines[1]).toBe('180px, 30px from the element’s top left');
  });

  it('says so when it is reporting CSS’s default rather than something the author set', () => {
    expect(describeOrigin(input({}))[0]).toBe('transform-origin: 50% 50% (default)');
  });

  it("🔴 THE DRIVE'S SECOND FINDING — does not print the pixels twice", () => {
    // The label read `transform-origin: 180px 30px` and then `180px, 30px from the element's top
    // left`. Two lines, one fact — and worst in the case where the author knows least. A pixel
    // pair is already resolved; there is nothing for a second line to add.
    const lines = describeOrigin(
      input({
        layout: { width: 360, height: 60 },
        computed: style({ 'transform-origin': '200px 30px' })
      })
    );
    expect(lines).toEqual(['transform-origin: 200px 30px']);
  });

  it('control — a percentage DOES get the second line, which is the case that needs it', () => {
    const lines = describeOrigin(
      input({
        layout: { width: 360, height: 60 },
        specified: style({ 'transform-origin': '25% 50%' })
      })
    );
    expect(lines).toEqual(['transform-origin: 25% 50%', '90px, 30px from the element’s top left']);
  });

  it('the untouched element now reads as the default, with the pixels it resolves to', () => {
    // The fixture's own case, end to end: nothing set, 360×60, computed `180px 30px`.
    const lines = describeOrigin(
      input({
        layout: { width: 360, height: 60 },
        computed: style({ 'transform-origin': '180px 30px' })
      })
    );
    expect(lines).toEqual(['transform-origin: 50% 50% (default)', '180px, 30px from the element’s top left']);
  });

  it('adds a line when the origin is beyond the element’s own edge', () => {
    const lines = describeOrigin(input({ specified: style({ 'transform-origin': '150% 50%' }) }));
    expect(lines[2]).toBe('outside the element — it rotates and scales about a point beyond its own edge');
  });

  it('control — an origin inside the element gets no such line, so the row above is reading position', () => {
    expect(describeOrigin(input({ specified: style({ 'transform-origin': '50% 50%' }) }))).toHaveLength(2);
  });

  it('says nothing at all rather than something wrong when the declaration is unreadable', () => {
    expect(describeOrigin(input({ specified: style({ 'transform-origin': 'inherit' }) }))).toEqual([]);
  });
});

describe('keeping the label off the box chip', () => {
  const VIEWPORT = { width: 1000, height: 800 };
  const SIZE = { width: 200, height: 40 };

  it('leaves a label that is already clear exactly where it was', () => {
    const spot = { x: 100, y: 100 };
    expect(nudgeClear(spot, SIZE, { x: 500, y: 500, width: 300, height: 100 }, VIEWPORT)).toEqual(spot);
  });

  it('does nothing when there is no chip on screen — preview mode draws no box model', () => {
    const spot = { x: 100, y: 100 };
    expect(nudgeClear(spot, SIZE, null, VIEWPORT)).toEqual(spot);
  });

  it('🔴 THE SCREENSHOT’S FINDING — drops the label below a chip it would have covered', () => {
    // The label landed on the fact chip and hid `width`, `height` and half the alignment
    // sentence. Both were describing the same element and neither could be read.
    const spot = { x: 100, y: 110 };
    const chip = { x: 80, y: 100, width: 300, height: 120 };
    expect(nudgeClear(spot, SIZE, chip, VIEWPORT)).toEqual({ x: 100, y: 228 });
  });

  it('goes above instead when there is no room below', () => {
    const spot = { x: 100, y: 700 };
    const chip = { x: 80, y: 690, width: 300, height: 100 };
    expect(nudgeClear(spot, SIZE, chip, VIEWPORT)).toEqual({ x: 100, y: 642 });
  });

  it('moves sideways when neither above nor below fits, rather than staying on top of it', () => {
    const tall = { x: 300, y: 0, width: 300, height: 800 };
    const spot = { x: 320, y: 400 };
    expect(nudgeClear(spot, SIZE, tall, VIEWPORT)).toEqual({ x: 92, y: 400 });
  });

  it('control — a horizontal miss is not an overlap, so the label does not move for a chip beside it', () => {
    // Same vertical band, no horizontal overlap: the naive test of "same rows" would move this one.
    const spot = { x: 100, y: 110 };
    const chip = { x: 400, y: 100, width: 300, height: 120 };
    expect(nudgeClear(spot, SIZE, chip, VIEWPORT)).toEqual(spot);
  });
});
