/**
 * HUD-002 — the thing that lights up.
 *
 * Positioned in canvas-space; the parent transform container handles pan and zoom, exactly as
 * `ExecutionNodeBadge` does. Two differences from that badge, and both are deliberate:
 *
 * - **It is not clickable.** The canvas is Canvas2D and has no port hit-testing, so every
 *   gesture over a node — drag, marquee, right-click "Why is this empty?" — is the canvas's.
 *   A badge with `pointer-events: all` sitting beside a node during a recording would eat
 *   those gestures at exactly the moment the user is trying to reproduce a bug. Making the
 *   badge a click target is HUD-003's job, and it arrives with somewhere for the click to go.
 * - **It fades.** Opacity comes from the age the fold stamped, not from a CSS animation, so
 *   a badge that is re-fired while fading snaps back to full without restarting anything.
 */

import React from 'react';

import type { NodeBounds } from '../ExecutionOverlay';
import styles from './RecordingNodeBadge.module.scss';

export interface RecordingNodeBadgeProps {
  nodeId: string;
  /** How many events touched this node. One badge saying `40×`, never forty badges. */
  count: number;
  /** 0…1, from `badgeOpacity`. */
  opacity: number;
  bounds: NodeBounds;
}

export function RecordingNodeBadge({ nodeId, count, opacity, bounds }: RecordingNodeBadgeProps) {
  // Right edge of the node + a 4px gap, vertically centred — the same anchor the execution
  // badge uses, so a node carrying both does not stack two badges on one pixel.
  const left = bounds.x + bounds.width + 4;
  const top = bounds.y + bounds.height / 2 - 10;

  return (
    <div className={styles.Badge} data-node-id={nodeId} style={{ left, top, opacity }}>
      {count}×
    </div>
  );
}
