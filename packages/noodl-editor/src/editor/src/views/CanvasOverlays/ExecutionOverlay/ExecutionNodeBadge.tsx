/**
 * ExecutionNodeBadge
 *
 * Renders a status badge at a node's position in canvas-space.
 * The parent container's CSS transform handles pan/zoom automatically —
 * we just position using raw canvas coordinates (node.global.x / y).
 */

import React from 'react';

import type { ExecutionStep } from '@noodl-viewer-cloud/execution-history';

import styles from './ExecutionNodeBadge.module.scss';

/** Node bounds in canvas-space (from NodeGraphEditor.getNodeBounds) */
export interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExecutionNodeBadgeProps {
  nodeId: string;
  step: ExecutionStep;
  bounds: NodeBounds;
  selected: boolean;
  onClick: () => void;
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusIcon(status: ExecutionStep['status']): string {
  switch (status) {
    case 'success':
      return '✓';
    case 'error':
      return '✗';
    case 'running':
      return '…';
    case 'skipped':
      return '–';
    default:
      return '?';
  }
}

/**
 * ExecutionNodeBadge component
 *
 * Positioned just to the right of the node's right edge, vertically centred.
 * Uses canvas-space coordinates — the parent transform container handles scaling.
 */
export function ExecutionNodeBadge({ nodeId, step, bounds, selected, onClick }: ExecutionNodeBadgeProps) {
  const duration = formatDuration(step.durationMs);

  // Position: right edge of node + 4px gap, vertically centred
  const left = bounds.x + bounds.width + 4;
  const top = bounds.y + bounds.height / 2 - 10; // ~10px = half badge height

  return (
    <div
      className={styles.badge}
      data-status={step.status}
      data-selected={String(selected)}
      data-node-id={nodeId}
      style={{ left, top }}
      onClick={onClick}
      title={step.nodeName || step.nodeType}
    >
      <span className={styles.icon}>{statusIcon(step.status)}</span>
      {duration && <span className={styles.duration}>{duration}</span>}
    </div>
  );
}
