import React from 'react';

import Layout from '../../../layout';
import PointerListeners from '../../../pointerlisteners';
import { Noodl } from '../../../types';
import { noodlRootRef } from '../../noodl-root-ref';

export interface CircleProps extends Noodl.ReactProps {
  /** §1 of NOTES-UNOWNED-NODE-WORK.md — stage 1. Absent on every project saved before this
      shipped; `circle.ts`'s port gate reads that as `'circle'`, and so does this component. */
  shape?: 'circle' | 'square' | 'triangle' | 'polygon' | 'star';
  /** Sides of a Polygon, or points of a Star. Ignored by every other shape. */
  points?: number;
  /** Corner rounding in pixels for the straight-edged shapes. Ignored by Circle. */
  cornerRadius?: number;
  size: number;
  startAngle: number;
  endAngle: number;

  fillEnabled: boolean;
  fillColor: Noodl.Color;

  strokeEnabled: boolean;
  strokeColor: Noodl.Color;
  strokeWidth: number;
  strokeLineCap: 'butt' | 'round';

  dom;
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function filledArc(x, y, radius, startAngle, endAngle) {
  if (endAngle % 360 === startAngle % 360) {
    endAngle -= 0.0001;
  }

  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);

  const arcSweep = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    arcSweep,
    0,
    end.x,
    end.y,
    'L',
    x,
    y,
    'L',
    start.x,
    start.y
  ].join(' ');
}

function arc(x, y, radius, startAngle, endAngle) {
  if (endAngle % 360 === startAngle % 360) {
    endAngle -= 0.0001;
  }

  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);

  const arcSweep = endAngle - startAngle <= 180 ? '0' : '1';

  return ['M', start.x, start.y, 'A', radius, radius, 0, arcSweep, 0, end.x, end.y].join(' ');
}

// ── §1 stage 1: the two straight-edged shapes ────────────────────────────────────────────────
//
// Square and Triangle have no arc, so they get their own path builders rather than a special
// case bent into `filledArc`/`arc` above — those two stay exactly as they were, which is what
// keeps every saved Circle (no `shape` parameter at all) rendering byte-identically.

interface Point {
  x: number;
  y: number;
}

/** Corners of the box, clockwise from top-left — screen coordinates, y grows downward. */
function squarePoints(size: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size }
  ];
}

/** An upward-pointing triangle inscribed in the box — apex, then clockwise. */
function trianglePoints(size: number): Point[] {
  return [
    { x: size / 2, y: 0 },
    { x: size, y: size },
    { x: 0, y: size }
  ];
}

function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
  const denom = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / denom;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

/**
 * Moves every edge of a convex, clockwise-wound polygon inward by `distance`, perpendicular to
 * itself, and returns the new vertices — `filledArc`/`arc`'s "render the stroke inside" trick,
 * generalised past a circle. `squarePoints` and `trianglePoints` are both wound this way; a
 * shape wound the other way would offset outward instead.
 */
function insetPolygon(points: Point[], distance: number): Point[] {
  if (distance === 0) return points;
  const n = points.length;

  const edges = points.map((p, i) => {
    const q = points[(i + 1) % n];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * distance;
    const ny = (dx / len) * distance;
    return { p: { x: p.x + nx, y: p.y + ny }, q: { x: q.x + nx, y: q.y + ny } };
  });

  // ⚠️ Falls back to the ORIGINAL vertex, never to `NaN`, if two edges end up parallel — a
  // degenerate `size`/`strokeWidth` combination should draw something rather than throw.
  return points.map((original, i) => {
    const prev = edges[(i - 1 + n) % n];
    const curr = edges[i];
    return lineIntersection(prev.p, prev.q, curr.p, curr.q) ?? original;
  });
}

function polygonPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
}

// ── §1 stage 2: the point-driven shapes, and rounded corners ─────────────────────────────────
//
// Polygon and Star are the same construction as Square and Triangle — vertices inscribed in the
// size × size box, wound clockwise in screen coordinates — so they reach `insetPolygon` and
// `polygonPath` unchanged. Nothing above this line moves.

/** Where a vertex sits on the inscribed circle: clockwise from the top, screen coordinates. */
function vertexAt(size: number, angleFromTop: number, radiusScale = 1): Point {
  const c = size / 2;
  const r = (size / 2) * radiusScale;
  const a = angleFromTop - Math.PI / 2;
  return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
}

/** A regular n-gon inscribed in the box, first vertex at the top, wound clockwise. */
function polygonPoints(size: number, sides: number): Point[] {
  const n = Math.max(3, Math.round(sides));
  return Array.from({ length: n }, (_, i) => vertexAt(size, (i * 2 * Math.PI) / n));
}

/**
 * How deep a star's inner vertices sit, as a fraction of the outer radius.
 *
 * `cos(2π/n) / cos(π/n)` is the ratio at which the two edges meeting at an outer point are
 * **collinear with the edges of the neighbouring points** — the classic star-polygon look. It
 * gives 0.382 for five (the pentagram everyone pictures) and 0.577 for six (the Star of David),
 * both of which are the values those stars are actually drawn with.
 *
 * ⚠️ **It goes to zero at four points and negative at three**, where a star with collinear edges
 * does not exist. Clamping to 0.2 there draws a recognisable spiky shape instead of a degenerate
 * one; the alternative was refusing to draw, which teaches an author that the port is broken.
 */
function starInnerRatio(points: number): number {
  const ratio = Math.cos((2 * Math.PI) / points) / Math.cos(Math.PI / points);
  return Math.max(0.2, Math.min(0.9, ratio));
}

/** An n-pointed star: outer and inner vertices alternating, wound clockwise from the top. */
function starPoints(size: number, points: number): Point[] {
  const n = Math.max(3, Math.round(points));
  const inner = starInnerRatio(n);
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    out.push(vertexAt(size, (i * 2 * Math.PI) / n));
    out.push(vertexAt(size, ((i + 0.5) * 2 * Math.PI) / n, inner));
  }
  return out;
}

function unit(from: Point, to: Point): { x: number; y: number; len: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, len };
}

/**
 * The same outline as {@link polygonPath}, with each corner replaced by a circular arc of
 * `radius` that is tangent to both of its edges.
 *
 * The trim length along each edge is `radius / tan(θ/2)` for interior angle θ, which is what makes
 * the arc tangent rather than merely nearby. 🔴 **It is clamped to half of the shorter adjacent
 * edge and the radius recomputed from the clamped length** — without that, a corner radius larger
 * than the shape eats past the next corner and the path crosses itself. An author dragging the
 * value up therefore sees it stop at the roundest the shape can be, rather than tearing.
 *
 * ⚠️ **The sweep flag is per corner, not per shape, because a Star has reflex corners.** The
 * cross product of the incoming and outgoing edges says which way this corner turns; using one
 * flag for the whole outline would bulge every inner vertex of a star the wrong way.
 */
function roundedPolygonPath(points: Point[], radius: number): string {
  if (!(radius > 0)) return polygonPath(points);

  const n = points.length;
  const parts: string[] = [];
  let start: Point | null = null;

  for (let i = 0; i < n; i++) {
    const curr = points[i];
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];

    const v1 = unit(curr, prev);
    const v2 = unit(curr, next);

    const cos = Math.max(-1, Math.min(1, v1.x * v2.x + v1.y * v2.y));
    const theta = Math.acos(cos);
    const half = Math.tan(theta / 2);

    // Collinear (nothing to round) or a fold back on itself (no tangent circle exists).
    if (!isFinite(half) || half <= 1e-6 || theta >= Math.PI - 1e-6) {
      if (start === null) {
        start = curr;
        parts.push(`M ${curr.x} ${curr.y}`);
      } else {
        parts.push(`L ${curr.x} ${curr.y}`);
      }
      continue;
    }

    const trim = Math.min(radius / half, v1.len / 2, v2.len / 2);
    const r = trim * half;
    const p1 = { x: curr.x + v1.x * trim, y: curr.y + v1.y * trim };
    const p2 = { x: curr.x + v2.x * trim, y: curr.y + v2.y * trim };

    // Clockwise in screen coordinates (y down) is a positive cross product, and a positive
    // cross product is SVG sweep 1. A star's inner vertices turn the other way and get 0.
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
    const sweep = cross > 0 ? 1 : 0;

    if (start === null) {
      start = p1;
      parts.push(`M ${p1.x} ${p1.y}`);
    } else {
      parts.push(`L ${p1.x} ${p1.y}`);
    }
    parts.push(`A ${r} ${r} 0 0 ${sweep} ${p2.x} ${p2.y}`);
  }

  return parts.join(' ') + ' Z';
}

export type StraightShape = 'square' | 'triangle' | 'polygon' | 'star';

function shapePoints(shape: StraightShape, size: number, points: number): Point[] {
  switch (shape) {
    case 'square':
      return squarePoints(size);
    case 'triangle':
      return trianglePoints(size);
    case 'polygon':
      return polygonPoints(size, points);
    default:
      return starPoints(size, points);
  }
}

export class Circle extends React.Component<CircleProps> {
  constructor(props: CircleProps) {
    super(props);
  }

  render() {
    //SVG can only do strokes centered on a path, and we want to render it inside.
    //We'll do it manually by adding another path on top of the filled shape

    let fill;
    let stroke;

    // ⚠️ `|| 'circle'` rather than a `circle.ts` default only: a connection can deliver
    // `undefined` (Empty-Value Contract), and every project saved before this shipped has no
    // `shape` parameter at all — both read as `'circle'`, matching the port gate's own
    // `shape NOT SET` clause.
    const shape = this.props.shape || 'circle';
    const r = this.props.size / 2;
    const { startAngle, endAngle } = this.props;

    if (shape === 'circle') {
      if (this.props.fillEnabled) {
        fill = <path d={filledArc(r, r, r, startAngle, endAngle)} fill={this.props.fillColor} />;
      }

      if (this.props.strokeEnabled) {
        const { strokeColor, strokeWidth, strokeLineCap } = this.props;
        const strokeRadius = r - this.props.strokeWidth / 2;
        const path = arc(r, r, strokeRadius, startAngle, endAngle);
        stroke = (
          <path
            d={path}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap={strokeLineCap}
          />
        );
      }
    } else {
      // ⚠️ Defaults live here as well as on the port for the Empty-Value Contract reason `shape`
      // does: a connection can deliver `undefined`, and a project saved before stage 2 has neither
      // parameter. 5 points is a pentagon and a five-pointed star, which is what those two words
      // draw in anybody's head.
      const pointCount = Math.max(3, Math.round(this.props.points ?? 5));
      const cornerRadius = Math.max(0, this.props.cornerRadius ?? 0);
      const points = shapePoints(shape, this.props.size, pointCount);

      if (this.props.fillEnabled) {
        fill = <path d={roundedPolygonPath(points, cornerRadius)} fill={this.props.fillColor} />;
      }

      if (this.props.strokeEnabled) {
        const { strokeColor, strokeWidth } = this.props;
        const inset = insetPolygon(points, strokeWidth / 2);
        // 🔴 The inner path's corners are `strokeWidth / 2` LESS round, not equally round. Insetting
        // a rounded outline by d shrinks every corner arc by d — keeping the radius would make the
        // stroke visibly thicker at the corners than along the edges, which is the artefact the
        // straight-edged inset was written to avoid in the first place.
        stroke = (
          <path
            d={roundedPolygonPath(inset, Math.max(0, cornerRadius - strokeWidth / 2))}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
        );
      }
    }

    const style = { ...this.props.style };
    Layout.size(style, this.props);
    Layout.align(style, this.props);

    if (style.opacity === 0) {
      style.pointerEvents = 'none';
    }

    //the SVG element lack some properties like offsetLeft, offsetTop that the drag node depends on.
    //Let's wrap it in a div to make it work properly
    return (
      <div
        ref={noodlRootRef(this.props.noodlNode)}
        className={this.props.className}
        {...this.props.dom}
        {...PointerListeners(this.props)}
        style={style}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width={this.props.size} height={this.props.size}>
          {fill}
          {stroke}
        </svg>
      </div>
    );
  }
}
