/**
 * §1 of `dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/NOTES-UNOWNED-NODE-WORK.md` —
 * stage 1: Circle grows a `shape` port with three values, Square and Triangle join the arc math.
 *
 * `filledArc`/`arc` (the circle path builders) are untouched by this change — see the diff — so
 * this file does not re-verify circle rendering byte-for-byte; it verifies the two new shapes and
 * that an absent/`'circle'` `shape` still reaches the SAME two functions.
 *
 * The stroke is meant to render INSIDE the shape, exactly as `arc()`'s comment says the circle's
 * does — so `Square`/`Triangle`'s stroke path is an INSET copy of the fill path, offset inward by
 * `strokeWidth / 2` perpendicular to every edge. The triangle's expected numbers below are hand
 * -derived (line-offset + intersection, size 100, strokeWidth 20) so the assertions do not just
 * restate the implementation's own formula back at it.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Circle, type CircleProps } from '../src/components/visual/Circle';

type AnyProps = Partial<CircleProps> & Record<string, unknown>;

function circleProps(overrides: AnyProps = {}): AnyProps {
  return {
    id: 'shape-test',
    size: 100,
    startAngle: 0,
    endAngle: 360,
    fillEnabled: true,
    fillColor: 'red',
    strokeEnabled: false,
    strokeColor: 'black',
    strokeWidth: 10,
    strokeLineCap: 'butt',
    style: {},
    dom: {},
    ...overrides
  };
}

function render(overrides: AnyProps = {}): string {
  return renderToStaticMarkup(React.createElement(Circle as never, circleProps(overrides) as never));
}

/** Every `<path d="…">` in the markup, in document order. */
function paths(html: string): string[] {
  const found: string[] = [];
  const re = /<path[^>]*\sd="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) found.push(m[1]);
  return found;
}

/** The numbers in a path string, in order — `M 0 0 L 100 0 …` → `[0, 0, 100, 0, …]`. */
function numbers(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

describe('an absent or explicit "circle" shape reaches the untouched arc math', () => {
  it('draws one `A` (arc) command for a full circle, fill only', () => {
    const html = render({ shape: undefined, fillEnabled: true, strokeEnabled: false });
    expect(paths(html)).toHaveLength(1);
    expect(paths(html)[0]).toContain('A');
  });

  it('`shape: "circle"` explicitly draws the identical command shape', () => {
    const withUndefined = render({ shape: undefined });
    const withExplicit = render({ shape: 'circle' });
    expect(withExplicit).toBe(withUndefined);
  });

  it('draws a second `A` path for the stroke when it is on', () => {
    const html = render({ strokeEnabled: true });
    expect(paths(html)).toHaveLength(2);
    expect(paths(html)[1]).toContain('A');
  });
});

describe('Square', () => {
  it('fills the whole size × size box, corner to corner', () => {
    const html = render({ shape: 'square', size: 100, fillEnabled: true, strokeEnabled: false });
    const fill = paths(html)[0];
    expect(fill).not.toContain('A');
    expect(numbers(fill)).toEqual([0, 0, 100, 0, 100, 100, 0, 100]);
  });

  it('🔴 strokes INSIDE the box — inset by strokeWidth / 2 on every side, `arc()`s own rule', () => {
    const html = render({ shape: 'square', size: 100, fillEnabled: false, strokeEnabled: true, strokeWidth: 20 });
    const stroke = paths(html)[0];
    expect(numbers(stroke)).toEqual([10, 10, 90, 10, 90, 90, 10, 90]);
  });

  it('a thicker stroke insets further, never past the shrink a bigger width demands', () => {
    const thin = numbers(paths(render({ shape: 'square', size: 100, fillEnabled: false, strokeEnabled: true, strokeWidth: 10 }))[0]);
    const thick = numbers(paths(render({ shape: 'square', size: 100, fillEnabled: false, strokeEnabled: true, strokeWidth: 40 }))[0]);
    // First vertex's x and y both move further from the corner as the stroke grows.
    expect(thick[0]).toBeGreaterThan(thin[0]);
    expect(thick[1]).toBeGreaterThan(thin[1]);
  });

  it('carries the fill colour and the stroke colour/width the same way a circle does', () => {
    const html = render({ shape: 'square', fillEnabled: true, fillColor: '#123456', strokeEnabled: true, strokeColor: '#abcdef', strokeWidth: 7 });
    expect(html).toContain('fill="#123456"');
    expect(html).toContain('stroke="#abcdef"');
    expect(html).toContain('stroke-width="7"');
  });
});

describe('Triangle', () => {
  it('fills an upward-pointing triangle inscribed in the box: apex, bottom-right, bottom-left', () => {
    const html = render({ shape: 'triangle', size: 100, fillEnabled: true, strokeEnabled: false });
    const fill = paths(html)[0];
    expect(fill).not.toContain('A');
    expect(numbers(fill)).toEqual([50, 0, 100, 100, 0, 100]);
  });

  it('🔴 strokes INSIDE the triangle — hand-derived inset, size 100 / strokeWidth 20', () => {
    // Derivation in the module header. A' = (50, 100 − 50/√5), B' and C' both land on
    // y = 100 − 10, one √5 unit in from each base corner.
    const html = render({ shape: 'triangle', size: 100, fillEnabled: false, strokeEnabled: true, strokeWidth: 20 });
    const points = numbers(paths(html)[0]);
    expect(points).toHaveLength(6);
    const [ax, ay, bx, by, cx, cy] = points;
    expect(ax).toBeCloseTo(50, 2);
    expect(ay).toBeCloseTo(22.3607, 2);
    expect(bx).toBeCloseTo(83.8197, 2);
    expect(by).toBeCloseTo(90, 2);
    expect(cx).toBeCloseTo(16.1803, 2);
    expect(cy).toBeCloseTo(90, 2);
  });

  it('draws no fill when Fill is off, matching the circle and the square', () => {
    const html = render({ shape: 'triangle', fillEnabled: false, strokeEnabled: false });
    expect(paths(html)).toHaveLength(0);
  });
});

describe('an unrecognised or missing shape value still draws something', () => {
  it('an empty-string shape (a cleared connection) falls back to circle, never to a blank SVG', () => {
    const html = render({ shape: '' as never, fillEnabled: true, strokeEnabled: false });
    expect(paths(html)).toHaveLength(1);
    expect(paths(html)[0]).toContain('A');
  });
});
