/**
 * HighlightedConnection - Renders a highlight along a connection path
 *
 * Displays visual highlight effect along canvas connection paths with support for
 * different styles (solid, glow, pulse) and custom colors.
 */

import classNames from 'classnames';
import React, { useMemo } from 'react';

import type { ConnectionRef } from '../../../services/HighlightManager/types';
import css from './HighlightedConnection.module.scss';

export interface HighlightedConnectionProps {
  /** Connection being highlighted */
  connection: ConnectionRef;

  /** Source node position and dimensions */
  fromBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Target node position and dimensions */
  toBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Highlight color */
  color: string;

  /** Visual style */
  style: 'solid' | 'glow' | 'pulse';
}

/**
 * HighlightedConnection component
 *
 * Renders an SVG path from the source node's right edge to the target node's left edge,
 * using a bezier curve similar to the actual connection rendering.
 */
export function HighlightedConnection({ connection, fromBounds, toBounds, color, style }: HighlightedConnectionProps) {
  // Calculate connection path
  const pathData = useMemo(() => {
    // Start point: right edge of source node
    const x1 = fromBounds.x + fromBounds.width;
    const y1 = fromBounds.y + fromBounds.height / 2;

    // End point: left edge of target node
    const x2 = toBounds.x;
    const y2 = toBounds.y + toBounds.height / 2;

    // Bezier control points for smooth curve
    const dx = Math.abs(x2 - x1);
    const curve = Math.min(dx * 0.5, 100); // Max curve of 100px

    const cx1 = x1 + curve;
    const cy1 = y1;
    const cx2 = x2 - curve;
    const cy2 = y2;

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  }, [fromBounds, toBounds]);

  // Calculate SVG viewBox to encompass the path
  const viewBox = useMemo(() => {
    const x1 = fromBounds.x + fromBounds.width;
    const y1 = fromBounds.y + fromBounds.height / 2;
    const x2 = toBounds.x;
    const y2 = toBounds.y + toBounds.height / 2;

    const minX = Math.min(x1, x2) - 20; // Add padding for glow
    const minY = Math.min(y1, y2) - 20;
    const maxX = Math.max(x1, x2) + 20;
    const maxY = Math.max(y1, y2) + 20;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }, [fromBounds, toBounds]);

  // SVG filter IDs must be unique per instance
  const filterId = useMemo(() => `highlight-glow-${connection.fromNodeId}-${connection.toNodeId}`, [connection]);

  return (
    <svg
      className={classNames(css.highlightedConnection, css[style])}
      style={{
        left: `${viewBox.x}px`,
        top: `${viewBox.y}px`,
        width: `${viewBox.width}px`,
        height: `${viewBox.height}px`
      }}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      xmlns="http://www.w3.org/2000/svg"
      data-connection={`${connection.fromNodeId}:${connection.fromPort}-${connection.toNodeId}:${connection.toPort}`}
    >
      {/* Define glow filter for glow style */}
      {style === 'glow' && (
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
          </filter>
        </defs>
      )}

      {/* Render the connection path */}
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={style === 'solid' ? 3 : 4}
        strokeLinecap="round"
        filter={style === 'glow' ? `url(#${filterId})` : undefined}
      />

      {/* Additional path for pulse effect (renders on top with animation) */}
      {style === 'pulse' && (
        <path d={pathData} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" className={css.pulsePath} />
      )}
    </svg>
  );
}
