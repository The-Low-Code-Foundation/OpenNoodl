/**
 * §1 of `dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/NOTES-UNOWNED-NODE-WORK.md` —
 * **stage 2**: `points` (Polygon and Star) and `cornerRadius`.
 *
 * 🔴 **The expected coordinates below are derived from trigonometry, not from the component.** A
 * pentagon's vertices and a pentagram's inner radius are values with an answer outside this repo,
 * so they are written out as the numbers they are. Asserting `polygonPoints(size, 5)` against a
 * second call to `polygonPoints` would pass on any formula at all, including a wrong one.
 *
 * ⚠️ **`nat-shape-001` still owns Circle, Square and Triangle**, and stage 2 must not move them.
 * The regression arm at the bottom is here rather than there because it is stage 2's claim: a
 * `cornerRadius` of 0, and a Circle carrying a stale `cornerRadius`, must both render exactly what
 * they rendered before this shipped.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Circle, type CircleProps } from '../src/components/visual/Circle';

type AnyProps = Partial<CircleProps> & Record<string, unknown>;

function render(overrides: AnyProps = {}): string {
  const props: AnyProps = {
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
  return renderToStaticMarkup(React.createElement(Circle as never, props as never));
}

function paths(html: string): string[] {
  const found: string[] = [];
  const re = /<path[^>]*\sd="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) found.push(m[1]);
  return found;
}

/** Every coordinate pair a path's `M`/`L` commands land on, in order. */
function vertices(d: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const re = /([ML])\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) out.push({ x: Number(m[2]), y: Number(m[3]) });
  return out;
}

/** Every arc in a path: its radius and its sweep flag. */
function arcs(d: string): { r: number; sweep: number; x: number; y: number }[] {
  const out: { r: number; sweep: number; x: number; y: number }[] = [];
  const re = /A\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+0\s+0\s+([01])\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    out.push({ r: Number(m[1]), sweep: Number(m[3]), x: Number(m[4]), y: Number(m[5]) });
  }
  return out;
}

function near(actual: number, expected: number, msg: string) {
  expect({ [msg]: Math.round(actual * 1e4) / 1e4 }).toEqual({ [msg]: Math.round(expected * 1e4) / 1e4 });
}

// ── Polygon ──────────────────────────────────────────────────────────────────────────────────

describe('NAT-SHAPE-003 §1 — Polygon draws `points` sides', () => {
  it('draws a diamond at 4 points — the one polygon whose vertices are exact integers', () => {
    // A 4-gon inscribed in a 100 box, first vertex at the top, clockwise: top, right, bottom,
    // left. Every coordinate is 0, 50 or 100, so a wrong radius or a wrong starting angle cannot
    // hide behind rounding.
    const v = vertices(paths(render({ shape: 'polygon', points: 4 }))[0]);
    expect(v).toHaveLength(4);
    // ⚠️ Compared to four decimals, not for equality: `cos(π)` is -0.9999999999999999 in IEEE
    // doubles, so the left vertex arrives as y = 50.00000000000001. Demanding exactness here
    // would be asserting a property of the float, not of the polygon.
    const expected = [
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 50, y: 100 },
      { x: 0, y: 50 }
    ];
    expected.forEach((e, i) => {
      near(v[i].x, e.x, `v${i}.x`);
      near(v[i].y, e.y, `v${i}.y`);
    });
  });

  it('draws six sides at 6 points, and the second vertex is where 60° puts it', () => {
    const v = vertices(paths(render({ shape: 'polygon', points: 6 }))[0]);
    expect(v).toHaveLength(6);
    // 60° clockwise from the top of a radius-50 circle centred at (50,50):
    // x = 50 + 50·cos(-30°) = 50 + 43.30127, y = 50 + 50·sin(-30°) = 25.
    near(v[1].x, 93.30127, 'x');
    near(v[1].y, 25, 'y');
  });

  it('🔴 clamps below three, where a polygon stops existing', () => {
    // Two "sides" is a line and zero is a crash. The floor draws a triangle rather than refusing.
    expect(vertices(paths(render({ shape: 'polygon', points: 2 }))[0])).toHaveLength(3);
    expect(vertices(paths(render({ shape: 'polygon', points: 0 }))[0])).toHaveLength(3);
  });

  it('defaults to five when the port delivers nothing — the Empty-Value Contract case', () => {
    // A wire can deliver `undefined`, and a project saved before stage 2 has no parameter at all.
    expect(vertices(paths(render({ shape: 'polygon', points: undefined }))[0])).toHaveLength(5);
  });
});

// ── Star ─────────────────────────────────────────────────────────────────────────────────────

describe('NAT-SHAPE-003 §2 — Star alternates outer and inner vertices', () => {
  it('draws ten vertices for five points, the first one at the top', () => {
    const v = vertices(paths(render({ shape: 'star', points: 5 }))[0]);
    expect(v).toHaveLength(10);
    expect(v[0]).toEqual({ x: 50, y: 0 });
  });

  it('🔴 puts the first inner vertex where the pentagram has it', () => {
    // The classic ratio: cos(72°)/cos(36°) = 0.3819660, so the inner radius is 19.09830.
    // The first inner vertex sits 36° clockwise from the top:
    //   x = 50 + 19.0983006·cos(-54°) = 50 + 11.2256994 = 61.2256994
    //   y = 50 + 19.0983006·sin(-54°) = 50 − 15.4508497 = 34.5491503
    const v = vertices(paths(render({ shape: 'star', points: 5 }))[0]);
    near(v[1].x, 61.2256994, 'x');
    near(v[1].y, 34.54915, 'y');
  });

  it('gives six points the Star of David ratio', () => {
    // cos(60°)/cos(30°) = 0.5/0.8660254 = 0.5773503 → inner radius 28.86751.
    // First inner vertex is 30° clockwise from the top: x = 50 + 28.86751·cos(-60°) = 64.43376.
    const v = vertices(paths(render({ shape: 'star', points: 6 }))[0]);
    expect(v).toHaveLength(12);
    near(v[1].x, 64.43376, 'x');
  });

  it('⚠️ clamps the ratio where a collinear-edged star does not exist', () => {
    // cos(2π/n)/cos(π/n) is 0 at four points and negative at three. Both must still draw a shape
    // with a real inner radius rather than a degenerate one collapsed onto the centre.
    for (const points of [3, 4]) {
      const v = vertices(paths(render({ shape: 'star', points }))[0]);
      expect(v).toHaveLength(points * 2);
      const inner = v[1];
      const r = Math.hypot(inner.x - 50, inner.y - 50);
      expect(r).toBeGreaterThan(1);
    }
  });
});

// ── Corner radius ────────────────────────────────────────────────────────────────────────────

describe('NAT-SHAPE-003 §3 — cornerRadius rounds the corners', () => {
  it('🔴 trims a square corner by exactly the radius, and arcs between the two trim points', () => {
    // Interior angle 90°, so the tangent length is r/tan(45°) = r. At the top-left vertex (0,0),
    // coming from (0,100) and going to (100,0), that is an arc of radius 20 from (0,20) to (20,0).
    const d = paths(render({ shape: 'square', cornerRadius: 20 }))[0];
    const a = arcs(d);
    expect(a).toHaveLength(4);
    // The path opens on the first trim point rather than on the vertex. ⚠️ Compared numerically:
    // `tan(π/4)` is 0.9999999999999999, so the trim arrives as 20.000000000000004.
    const opening = vertices(d)[0];
    near(opening.x, 0, 'opening x');
    near(opening.y, 20, 'opening y');
    near(a[0].r, 20, 'r');
    near(a[0].x, 20, 'arc end x');
    near(a[0].y, 0, 'arc end y');
  });

  it('winds a convex corner with sweep 1', () => {
    // Clockwise in screen coordinates. Every corner of a square is convex, so every flag is 1.
    expect(arcs(paths(render({ shape: 'square', cornerRadius: 20 }))[0]).map((x) => x.sweep)).toEqual([1, 1, 1, 1]);
  });

  it('🔴 uses sweep 0 at a star’s reflex corners — a single flag would bulge them backwards', () => {
    const a = arcs(paths(render({ shape: 'star', points: 5, cornerRadius: 5 }))[0]);
    expect(a).toHaveLength(10);
    // Five outer points turn one way, five inner vertices the other.
    expect(a.filter((x) => x.sweep === 1)).toHaveLength(5);
    expect(a.filter((x) => x.sweep === 0)).toHaveLength(5);
  });

  it('🔴 stops at the roundest the shape can be rather than tearing', () => {
    // 999 on a 100 square: the trim is clamped to half the edge, 50, so the radius is 50 — a
    // circle inscribed in the square. Unclamped, the trim would run past the next corner and the
    // outline would cross itself.
    const a = arcs(paths(render({ shape: 'square', cornerRadius: 999 }))[0]);
    expect(a).toHaveLength(4);
    for (const one of a) near(one.r, 50, 'clamped r');
  });

  it('makes the stroke’s corners `strokeWidth / 2` less round than the fill’s', () => {
    // Insetting a rounded outline by d shrinks every corner arc by d. Equal radii would draw a
    // stroke visibly thicker at the corners than along the edges.
    const [fill, stroke] = paths(
      render({ shape: 'square', cornerRadius: 20, strokeEnabled: true, strokeWidth: 10 })
    );
    near(arcs(fill)[0].r, 20, 'fill r');
    near(arcs(stroke)[0].r, 15, 'stroke r');
  });

  it('⚠️ never emits a negative radius when the stroke is wider than the corner', () => {
    const [, stroke] = paths(render({ shape: 'square', cornerRadius: 2, strokeEnabled: true, strokeWidth: 40 }));
    expect(arcs(stroke).every((a) => a.r >= 0)).toBe(true);
  });
});

// ── The regression arm ───────────────────────────────────────────────────────────────────────

describe('NAT-SHAPE-003 §4 — stage 2 moves nothing that already worked', () => {
  it('🔴 a cornerRadius of 0 draws the stage-1 outline, with no arcs at all', () => {
    for (const shape of ['square', 'triangle'] as const) {
      const withZero = paths(render({ shape, cornerRadius: 0 }))[0];
      const withNothing = paths(render({ shape }))[0];
      expect(withZero).toBe(withNothing);
      expect(arcs(withZero)).toHaveLength(0);
    }
  });

  it('🔴 a Circle carrying a stale cornerRadius renders byte-identically to one without', () => {
    // The port is gated off for Circle, but a parameter set on a Square and then switched back
    // stays on the node. It must reach nothing.
    expect(render({ shape: 'circle', cornerRadius: 40, points: 9 })).toBe(render({ shape: 'circle' }));
  });

  it('🔴 an unset shape still renders a circle, stale stage-2 parameters and all', () => {
    // Every project saved before stage 1 is in this state.
    expect(render({ shape: undefined, cornerRadius: 40, points: 9 })).toBe(render({ shape: 'circle' }));
  });
});

// ── Stage 3: the custom source ───────────────────────────────────────────────────────────────

describe('NAT-SHAPE-003 §5 — the `svg` shape draws the author’s own markup', () => {
  it('renders the source instead of a generated path', () => {
    const html = render({ shape: 'svg', svgSource: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>' });
    // ⚠️ Verbatim, not re-serialised: `dangerouslySetInnerHTML` inserts the string as written,
    // so a self-closing tag stays self-closing rather than becoming `<rect …></rect>`.
    expect(html).toContain('<rect width="10" height="10"/>');
    // The node's own arc/polygon output must not be there as well.
    expect(paths(html)).toHaveLength(0);
  });

  it('🔴 a script in the source does not reach the DOM — the consequence, not the mechanism', () => {
    // `nat-shape-004` grades the sanitiser as a function. This grades the thing that matters:
    // that the component actually routes the source through it. A component that forgot to call
    // it would leave that file green and this one red.
    const html = render({ shape: 'svg', svgSource: '<svg><script>alert(1)</script><circle r="5"/></svg>' });
    expect(html).not.toContain('alert');
    expect(html).toContain('<circle r="5"/>');
  });

  it('🔴 an event handler and a remote reference are gone too', () => {
    const html = render({
      shape: 'svg',
      svgSource: '<svg><a href="javascript:alert(1)"><circle onclick="alert(2)" r="5"/></a><use xlink:href="https://evil.test/x#a"/></svg>'
    });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('evil.test');
  });

  it('strips root width/height so the drawing fills the Size box', () => {
    const html = render({ shape: 'svg', size: 200, svgSource: '<svg width="24" height="24"><circle r="5"/></svg>' });
    expect(html).not.toContain('width="24"');
    expect(html).not.toContain('height="24"');
  });

  it('renders nothing rather than "undefined" when the port delivers nothing', () => {
    // The Empty-Value Contract: a wire can deliver `undefined`, and a node switched to `svg`
    // before anything was typed has no parameter at all.
    for (const svgSource of [undefined, '']) {
      const html = render({ shape: 'svg', svgSource });
      expect(html).not.toContain('undefined');
      expect(paths(html)).toHaveLength(0);
    }
  });

  it('🔴 ignores svgSource entirely for every other shape', () => {
    // A source left behind by switching away must not leak into a Circle or a Square.
    expect(render({ shape: 'circle', svgSource: '<svg><rect id="leak"/></svg>' })).toBe(render({ shape: 'circle' }));
    expect(render({ shape: 'square', svgSource: '<svg><rect id="leak"/></svg>' })).toBe(render({ shape: 'square' }));
  });
});
