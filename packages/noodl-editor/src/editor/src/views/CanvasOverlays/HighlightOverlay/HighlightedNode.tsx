/**
 * HighlightedNode - Renders a highlight around a node
 *
 * Displays visual highlight effect around canvas nodes with support for
 * different styles (solid, glow, pulse) and custom colors.
 */

import classNames from 'classnames';
import React from 'react';

import css from './HighlightedNode.module.scss';

export interface HighlightedNodeProps {
  /** Node ID being highlighted */
  nodeId: string;

  /** Node position and dimensions */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Highlight color */
  color: string;

  /** Visual style */
  style: 'solid' | 'glow' | 'pulse';

  /** Optional label */
  label?: string;
}

/**
 * HighlightedNode component
 */
export function HighlightedNode({ nodeId, bounds, color, style, label }: HighlightedNodeProps) {
  const highlightStyle: React.CSSProperties = {
    left: `${bounds.x}px`,
    top: `${bounds.y}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    borderColor: color,
    boxShadow:
      style === 'glow' ? `0 0 20px ${color}, 0 0 10px ${color}` : style === 'pulse' ? `0 0 15px ${color}` : undefined
  };

  return (
    <div className={classNames(css.highlightedNode, css[style])} style={highlightStyle} data-node-id={nodeId}>
      {label && <div className={css.label}>{label}</div>}
    </div>
  );
}
