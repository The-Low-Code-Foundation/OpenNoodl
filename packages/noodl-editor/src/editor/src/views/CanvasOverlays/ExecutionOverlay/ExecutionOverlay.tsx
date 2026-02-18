/**
 * ExecutionOverlay
 *
 * React component that renders execution visualization over the canvas.
 * Follows the HighlightOverlay pattern:
 *   - A transform container (canvas-space) holds the node badges and data popup
 *   - Header and timeline are fixed-position (outside the transform container)
 *
 * Lifecycle:
 *   - Mounted by ExecutionOverlayLayer class into #execution-overlay-layer
 *   - Receives viewport updates via re-render on every pan/zoom
 *   - Listens to 'execution:pinToCanvas' EventDispatcher event
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useMemo, useState } from 'react';

import type { ExecutionStep, ExecutionWithSteps } from '@noodl-viewer-cloud/execution-history';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import { ExecutionDataPopup } from './ExecutionDataPopup';
import { ExecutionNodeBadge, type NodeBounds } from './ExecutionNodeBadge';
import styles from './ExecutionOverlay.module.scss';
import { ExecutionTimeline } from './ExecutionTimeline';

export interface ExecutionOverlayProps {
  /** Current canvas viewport — applied as CSS transform to the badge container */
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };

  /**
   * Callback to get a node's canvas-space bounds by ID.
   * Returns null if the node isn't in the current graph.
   */
  getNodeBounds: (nodeId: string) => NodeBounds | null;
}

/**
 * ExecutionOverlay component
 *
 * Renders:
 *   1. Header bar (fixed) — workflow name, status, close button
 *   2. Transform container — node badges positioned in canvas-space
 *   3. Data popup (canvas-space) — shown when a badge is clicked
 *   4. Timeline scrubber (fixed) — step navigation
 */
export function ExecutionOverlay({ viewport, getNodeBounds }: ExecutionOverlayProps) {
  const [pinnedExecution, setPinnedExecution] = useState<ExecutionWithSteps | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Listen for pin requests from ExecutionHistoryPanel
  useEventListener(EventDispatcher.instance, 'execution:pinToCanvas', (data: { execution: ExecutionWithSteps }) => {
    setPinnedExecution(data.execution);
    setSelectedNodeId(null);
    // Start at the last step so all completed steps are visible
    setCurrentStepIndex(data.execution.steps.length > 0 ? data.execution.steps.length - 1 : 0);
  });

  // Listen for unpin requests
  useEventListener(EventDispatcher.instance, 'execution:unpinFromCanvas', () => {
    setPinnedExecution(null);
    setSelectedNodeId(null);
  });

  // Build a map of nodeId → step for steps up to and including currentStepIndex.
  // Later steps for the same node overwrite earlier ones (last-write-wins).
  const nodeStepMap = useMemo<Map<string, ExecutionStep>>(() => {
    if (!pinnedExecution) return new Map();

    const map = new Map<string, ExecutionStep>();
    for (const step of pinnedExecution.steps) {
      if (step.stepIndex <= currentStepIndex) {
        map.set(step.nodeId, step);
      }
    }
    return map;
  }, [pinnedExecution, currentStepIndex]);

  const selectedStep = selectedNodeId ? nodeStepMap.get(selectedNodeId) ?? null : null;
  const selectedBounds = selectedNodeId ? getNodeBounds(selectedNodeId) : null;

  if (!pinnedExecution) return null;

  const containerTransform = `scale(${viewport.zoom}) translate(${viewport.x}px, ${viewport.y}px)`;

  const handleClose = () => {
    setPinnedExecution(null);
    setSelectedNodeId(null);
  };

  const handleBadgeClick = (nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  };

  const handleStepChange = (index: number) => {
    setCurrentStepIndex(index);
    // Clear popup if the selected node is no longer visible at the new step
    if (selectedNodeId) {
      const step = pinnedExecution.steps.find((s) => s.nodeId === selectedNodeId && s.stepIndex <= index);
      if (!step) setSelectedNodeId(null);
    }
  };

  return (
    <div className={styles.overlay}>
      {/* ── Fixed header ── */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>{pinnedExecution.workflowName}</span>
        <span className={styles.headerStatus} data-status={pinnedExecution.status}>
          {pinnedExecution.status}
        </span>
        <button className={styles.closeButton} onClick={handleClose}>
          Unpin
        </button>
      </div>

      {/* ── Canvas-space transform container ── */}
      <div className={styles.transformContainer} style={{ transform: containerTransform, transformOrigin: '0 0' }}>
        {Array.from(nodeStepMap.entries()).map(([nodeId, step]) => {
          const bounds = getNodeBounds(nodeId);
          if (!bounds) return null;

          return (
            <ExecutionNodeBadge
              key={nodeId}
              nodeId={nodeId}
              step={step}
              bounds={bounds}
              selected={nodeId === selectedNodeId}
              onClick={() => handleBadgeClick(nodeId)}
            />
          );
        })}

        {/* Data popup — rendered in canvas-space so it follows the node */}
        {selectedStep && selectedBounds && (
          <ExecutionDataPopup step={selectedStep} bounds={selectedBounds} onClose={() => setSelectedNodeId(null)} />
        )}
      </div>

      {/* ── Fixed timeline scrubber ── */}
      <ExecutionTimeline
        steps={pinnedExecution.steps}
        currentIndex={currentStepIndex}
        onIndexChange={handleStepChange}
      />
    </div>
  );
}
