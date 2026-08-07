/**
 * FolderEdge Component
 *
 * Renders a connection between two folders with:
 * - Gradient coloring (source folder color → target folder color)
 * - Variable thickness based on traffic
 * - Opacity based on connection strength
 */

import React from 'react';

import { getFolderColor } from '../utils/folderColors';
import { FolderConnection, FolderNode } from '../utils/topologyTypes';
import css from './FolderEdge.module.scss';

interface FolderEdgeProps {
  connection: FolderConnection;
  fromFolder: FolderNode;
  toFolder: FolderNode;
}

/**
 * Calculates stroke width based on connection count.
 * Range: 1-4px
 */
function getStrokeWidth(count: number): number {
  if (count >= 30) return 4;
  if (count >= 20) return 3;
  if (count >= 10) return 2;
  return 1;
}

/**
 * Calculates opacity based on connection count.
 * Range: 0.3-0.7
 */
function getOpacity(count: number): number {
  const baseOpacity = 0.3;
  const maxOpacity = 0.7;
  const normalized = Math.min(count / 50, 1); // Normalize to 0-1
  return baseOpacity + normalized * (maxOpacity - baseOpacity);
}

/**
 * Renders a connection line between two folder nodes with gradient coloring.
 */
export function FolderEdge({ connection, fromFolder, toFolder }: FolderEdgeProps) {
  if (
    !fromFolder.x ||
    !fromFolder.y ||
    !fromFolder.width ||
    !fromFolder.height ||
    !toFolder.x ||
    !toFolder.y ||
    !toFolder.width ||
    !toFolder.height
  ) {
    return null;
  }

  // Calculate connection points (center of each node)
  const x1 = fromFolder.x + fromFolder.width / 2;
  const y1 = fromFolder.y + fromFolder.height;
  const x2 = toFolder.x + toFolder.width / 2;
  const y2 = toFolder.y;

  const strokeWidth = getStrokeWidth(connection.count);
  const opacity = getOpacity(connection.count);

  // Get colors for gradient (source folder → target folder)
  const fromColor = getFolderColor(fromFolder.type);
  const toColor = getFolderColor(toFolder.type);

  // Create unique gradient ID based on folder IDs
  const gradientId = `folder-edge-${fromFolder.id}-${toFolder.id}`;

  return (
    <g>
      {/* Define gradient */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={fromColor} stopOpacity={opacity} />
          <stop offset="100%" stopColor={toColor} stopOpacity={opacity} />
        </linearGradient>
      </defs>

      {/* Render line with gradient */}
      <line
        className={css['FolderEdge']}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        strokeWidth={strokeWidth}
        stroke={`url(#${gradientId})`}
      />
    </g>
  );
}
