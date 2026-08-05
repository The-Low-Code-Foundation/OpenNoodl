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

import { NodeGraphContextTmp } from '../../../contexts/NodeGraphContext/NodeGraphContext';
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

  /**
   * POL-009: a pin belongs to ONE canvas — the one it was made on.
   *
   * Two events used to set this state and clear it, and nothing else touched it.
   * The overlay is mounted over the canvas generally rather than over a
   * particular graph, so navigating to another component left the header and the
   * step timeline sitting over a graph the run has nothing to do with. The
   * comment further down this file already said a pin over the wrong graph
   * "looks exactly like a broken canvas" — the reasoning was written down and
   * the guard was never built.
   *
   * Hide rather than clear. Richard's words were "stays visible … until you
   * click unpin", which is a complaint about visibility, not about the pin's
   * lifetime: navigating away and back should bring it back, and the Unpin
   * button stays the only thing that ends a pin.
   *
   * The identity is a component `fullName` — the same rule and the same
   * comparison `explainTarget.ts` uses for a remembered selection, for the same
   * reason.
   *
   * FH-012: it comes from the PIN EVENT when the emitter knows which canvas the
   * run belongs to, and only falls back to "whatever was open at pin time" when
   * it does not. POL-009 slice 2 asked for exactly this and shipped the
   * fallback alone, so pinning workflow B's run while A was open tagged the pin
   * as A's: it rendered over A, where no step resolves, and disappeared on
   * opening B — pinned to the wrong canvas and invisible where it belonged.
   *
   * The fallback is not dead code. A cloud function CALL records no steps and
   * has no canvas of its own (`WorkflowRunner.run` logs `workflowId =
   * functionName`), and the Workflows panel's run-&-pin is already standing on
   * the right canvas; both emit without an identity and both want the canvas in
   * front of the user.
   */
  const [pinnedComponentName, setPinnedComponentName] = useState<string | null>(null);
  const [activeComponentName, setActiveComponentName] = useState<string | null>(
    () => NodeGraphContextTmp.nodeGraph?.activeComponent?.fullName ?? null
  );

  useEventListener(EventDispatcher.instance, 'activeComponentChanged', () => {
    setActiveComponentName(NodeGraphContextTmp.nodeGraph?.activeComponent?.fullName ?? null);
  });

  // Listen for pin requests from ExecutionHistoryPanel
  useEventListener(
    EventDispatcher.instance,
    'execution:pinToCanvas',
    (data: { execution: ExecutionWithSteps; componentName?: string | null }) => {
      setPinnedExecution(data.execution);
      setPinnedComponentName(data.componentName ?? NodeGraphContextTmp.nodeGraph?.activeComponent?.fullName ?? null);
      setSelectedNodeId(null);
      // Start at the last step so all completed steps are visible
      setCurrentStepIndex(data.execution.steps.length > 0 ? data.execution.steps.length - 1 : 0);
    }
  );

  // Listen for unpin requests
  useEventListener(EventDispatcher.instance, 'execution:unpinFromCanvas', () => {
    setPinnedExecution(null);
    setPinnedComponentName(null);
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

  /**
   * POL-009: not this canvas — render nothing, keep the pin.
   *
   * Deliberately a render-time comparison of two strings rather than an effect:
   * this component re-renders on every pan and zoom (see below), so the check
   * has to be free, and clearing state in an effect would make the pin's
   * lifetime depend on navigation, which is exactly what this task rejects.
   *
   * `selectedNodeId` and `currentStepIndex` ride along untouched, so coming back
   * restores the step the user was on rather than resetting to the end.
   */
  if (pinnedComponentName !== activeComponentName) return null;

  /**
   * WFA-002: `getNodeBounds` resolves against the CURRENTLY OPEN graph, and the
   * overlay used to render nothing for a step it could not place — no badge, no
   * message, just a header and a timeline over an untouched canvas. Pinning a
   * workflow run while a browser component is open looks exactly like a broken
   * overlay. So count what resolved and say so.
   *
   * Deliberately computed in render rather than memoised on the execution: the
   * open graph changes underneath us (this component re-renders on every pan,
   * zoom and graph switch), and a stale "nothing matches" would be its own lie.
   *
   * POL-009 slice 3 — kept, not deleted. The component guard above removes the
   * "pinned on a different canvas" case this was written for, but not the case
   * it now covers alone: the run's own canvas, edited since the run, so a step's
   * `nodeId` no longer exists. That is a different and still-reachable
   * condition, and it is one where saying "3 of its 5 steps are not on this
   * canvas" is more useful than silence.
   */
  const totalSteps = pinnedExecution.steps.length;
  const resolvedCount = pinnedExecution.steps.filter((step) => getNodeBounds(step.nodeId)).length;
  const unresolvedCount = totalSteps - resolvedCount;

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

      {/* ── Resolution honesty (WFA-002) ──
          None resolved: the overlay has nothing to draw and must say why.
          Some resolved: a partial overlay that silently drops half the steps is
          worse than one that admits it. */}
      {/* A run with no step records at all. WFA-002 found live that this is the
          case for EVERY cloud function call: `ExecutionLogger.startNode` is
          called only by the WF-001 workflow engine, so a function's graph nodes
          are never recorded individually. Saying "none of its 0 steps matched"
          would blame the open graph for missing data that was never written. */}
      {totalSteps === 0 && (
        <div className={styles.notice} data-severity="none">
          <span className={styles.noticeTitle}>This run recorded no steps</span>
          <span className={styles.noticeBody}>
            <strong>{pinnedExecution.workflowName}</strong> ran, but no per-step data was recorded, so there is nothing
            to place on the canvas. Only workflow runs record steps today — a cloud function call records the call
            itself, not its individual nodes.
          </span>
        </div>
      )}

      {totalSteps > 0 && resolvedCount === 0 && (
        <div className={styles.notice} data-severity="none">
          <span className={styles.noticeTitle}>Nothing to show on this graph</span>
          <span className={styles.noticeBody}>
            This execution ran on <strong>{pinnedExecution.workflowName}</strong>. None of its {totalSteps}{' '}
            {totalSteps === 1 ? 'step' : 'steps'} matches a node in the graph you have open, so there is nowhere to put
            the badges. Open that function or workflow, or use the panel&rsquo;s step list to read the run.
          </span>
        </div>
      )}

      {resolvedCount > 0 && unresolvedCount > 0 && (
        <div className={styles.notice} data-severity="partial">
          <span className={styles.noticeBody}>
            Showing {resolvedCount} of {totalSteps} steps — {unresolvedCount} {unresolvedCount === 1 ? 'is' : 'are'} not
            in this graph.
          </span>
        </div>
      )}

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
