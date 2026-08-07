/**
 * TopologyEdge Component
 *
 * Renders a connection arrow between two component nodes.
 */

import React from 'react';

import { TopologyEdge as TopologyEdgeType, TopologyNode } from '../utils/topologyTypes';
import css from './TopologyEdge.module.scss';

export interface TopologyEdgeProps {
  edge: TopologyEdgeType;
  fromNode: TopologyNode | undefined;
  toNode: TopologyNode | undefined;
}

/**
 * Calculates SVG path for an edge between two nodes.
 */
function calculateEdgePath(
  fromNode: TopologyNode,
  toNode: TopologyNode
): { path: string; arrowX: number; arrowY: number; arrowAngle: number } {
  if (
    !fromNode ||
    !toNode ||
    fromNode.x === undefined ||
    fromNode.y === undefined ||
    toNode.x === undefined ||
    toNode.y === undefined ||
    !fromNode.width ||
    !fromNode.height ||
    !toNode.width ||
    !toNode.height
  ) {
    return { path: '', arrowX: 0, arrowY: 0, arrowAngle: 0 };
  }

  // Calculate center points of nodes
  const fromX = fromNode.x + fromNode.width / 2;
  const fromY = fromNode.y + fromNode.height; // Bottom of source node
  const toX = toNode.x + toNode.width / 2;
  const toY = toNode.y; // Top of target node

  // Create a simple curved path
  const midY = (fromY + toY) / 2;

  const path = `M ${fromX} ${fromY} 
                C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;

  // Arrow points at the target node
  const arrowX = toX;
  const arrowY = toY;
  const arrowAngle = 90; // Pointing down into the node

  return { path, arrowX, arrowY, arrowAngle };
}

export function TopologyEdge({ edge, fromNode, toNode }: TopologyEdgeProps) {
  if (!fromNode || !toNode) {
    return null;
  }

  const { path } = calculateEdgePath(fromNode, toNode);

  if (!path) {
    return null;
  }

  return (
    <g className={css['TopologyEdge']}>
      {/* Connection path */}
      <path className={css['TopologyEdge__path']} d={path} fill="none" markerEnd="url(#topology-arrow)" />

      {/* Arrow marker (defined once in defs, referenced here) */}
      {/* Edge count label (if multiple instances) */}
      {edge.count > 1 && (
        <text
          className={css['TopologyEdge__count']}
          x={(fromNode.x + fromNode.width / 2 + toNode.x + toNode.width / 2) / 2}
          y={(fromNode.y + fromNode.height + toNode.y) / 2}
          textAnchor="middle"
          fontSize={10}
        >
          ×{edge.count}
        </text>
      )}
    </g>
  );
}

/**
 * Arrow marker definition (should be added to SVG defs once).
 */
export function TopologyEdgeMarkerDef() {
  return (
    <defs>
      <marker id="topology-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--theme-color-border-default)" />
      </marker>
    </defs>
  );
}
