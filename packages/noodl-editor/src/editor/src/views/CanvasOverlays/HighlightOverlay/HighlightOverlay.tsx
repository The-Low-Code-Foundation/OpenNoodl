/**
 * HighlightOverlay - Main overlay component for canvas highlights
 *
 * Renders persistent, multi-channel highlights over the node graph canvas.
 * Uses the canvas overlay pattern with CSS transform for coordinate mapping.
 *
 * Features:
 * - Subscribes to HighlightManager events via useEventListener
 * - Renders node and connection highlights
 * - Supports multiple visual styles (glow, pulse, solid)
 * - Handles viewport transformations automatically via CSS
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useState, useEffect } from 'react';

import { HighlightManager, type HighlightInfo } from '../../../services/HighlightManager';
import { BoundaryIndicator } from './BoundaryIndicator';
import { HighlightedConnection } from './HighlightedConnection';
import { HighlightedNode } from './HighlightedNode';
import css from './HighlightOverlay.module.scss';

export interface HighlightOverlayProps {
  /** Canvas viewport transformation */
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };

  /** Get node screen coordinates by ID */
  getNodeBounds?: (nodeId: string) => {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

/**
 * HighlightOverlay component
 *
 * @example
 * ```tsx
 * <HighlightOverlay
 *   viewport={{ x: 0, y: 0, zoom: 1.0 }}
 *   getNodeBounds={(id) => nodeEditor.getNodeBounds(id)}
 * />
 * ```
 */
export function HighlightOverlay({ viewport, getNodeBounds }: HighlightOverlayProps) {
  const [highlights, setHighlights] = useState<HighlightInfo[]>([]);

  // Subscribe to HighlightManager events using Phase 0 pattern
  useEventListener(HighlightManager.instance, 'highlightAdded', () => {
    setHighlights(HighlightManager.instance.getHighlights());
  });

  useEventListener(HighlightManager.instance, 'highlightRemoved', () => {
    setHighlights(HighlightManager.instance.getHighlights());
  });

  useEventListener(HighlightManager.instance, 'highlightUpdated', () => {
    setHighlights(HighlightManager.instance.getHighlights());
  });

  useEventListener(HighlightManager.instance, 'channelCleared', () => {
    setHighlights(HighlightManager.instance.getHighlights());
  });

  useEventListener(HighlightManager.instance, 'allCleared', () => {
    setHighlights([]);
  });

  // Initial load
  useEffect(() => {
    setHighlights(HighlightManager.instance.getHighlights());
  }, []);

  // Apply viewport transformation to the container
  // CRITICAL: Transform order must be scale THEN translate to match canvas rendering
  // Canvas does: ctx.scale() then ctx.translate() then draws at node.global coords
  // CSS transforms apply right-to-left, so "scale() translate()" = scale(translate(point))
  // This computes: scale * (pan + nodePos) which matches the canvas
  const containerStyle: React.CSSProperties = {
    transform: `scale(${viewport.zoom}) translate(${viewport.x}px, ${viewport.y}px)`,
    transformOrigin: '0 0'
  };

  return (
    <div className={css.highlightOverlay}>
      <div className={css.highlightContainer} style={containerStyle}>
        {highlights.map((highlight) => (
          <React.Fragment key={highlight.id}>
            {/* Render node highlights */}
            {highlight.nodeIds.map((nodeId) => {
              const bounds = getNodeBounds?.(nodeId);
              if (!bounds) return null;

              return (
                <HighlightedNode
                  key={`${highlight.id}-${nodeId}`}
                  nodeId={nodeId}
                  bounds={bounds}
                  color={highlight.options.color || '#FFFFFF'}
                  style={highlight.options.style || 'solid'}
                  label={highlight.options.label}
                />
              );
            })}

            {/* Render connection highlights */}
            {highlight.connections.map((connection, index) => {
              const fromBounds = getNodeBounds?.(connection.fromNodeId);
              const toBounds = getNodeBounds?.(connection.toNodeId);

              if (!fromBounds || !toBounds) return null;

              return (
                <HighlightedConnection
                  key={`${highlight.id}-conn-${index}`}
                  connection={connection}
                  fromBounds={fromBounds}
                  toBounds={toBounds}
                  color={highlight.options.color || '#FFFFFF'}
                  style={highlight.options.style || 'solid'}
                />
              );
            })}

            {/* Render boundary indicators for cross-component paths */}
            {/* TODO: Get boundaries from HighlightManager state once detection is implemented */}
            {/* For now, this will render when componentBoundaries are added to highlights */}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
