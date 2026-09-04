import React from 'react';

import Layout from '../../../layout';
import PointerListeners from '../../../pointerlisteners';
import { Noodl } from '../../../types';
import { noodlRootRef } from '../../noodl-root-ref';

export interface CircleProps extends Noodl.ReactProps {
  /** §1 of NOTES-UNOWNED-NODE-WORK.md — stage 1. Absent on every project saved before this
      shipped; `circle.ts`'s port gate reads that as `'circle'`, and so does this component. */
  shape?: 'circle' | 'square' | 'triangle';
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

function shapePoints(shape: 'square' | 'triangle', size: number): Point[] {
  return shape === 'square' ? squarePoints(size) : trianglePoints(size);
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
      const points = shapePoints(shape, this.props.size);

      if (this.props.fillEnabled) {
        fill = <path d={polygonPath(points)} fill={this.props.fillColor} />;
      }

      if (this.props.strokeEnabled) {
        const { strokeColor, strokeWidth } = this.props;
        const inset = insetPolygon(points, strokeWidth / 2);
        stroke = <path d={polygonPath(inset)} stroke={strokeColor} strokeWidth={strokeWidth} fill="transparent" />;
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
