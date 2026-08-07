/**
 * ExecutionDataPopup
 *
 * Floating popup showing input/output data for a selected node step.
 * Positioned in canvas-space (parent container handles transform).
 */

import React from 'react';

import type { ExecutionStep } from '@noodl-viewer-cloud/execution-history';

import styles from './ExecutionDataPopup.module.scss';
import type { NodeBounds } from './ExecutionNodeBadge';

export interface ExecutionDataPopupProps {
  step: ExecutionStep;
  bounds: NodeBounds;
  onClose: () => void;
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * ExecutionDataPopup component
 *
 * Appears to the right of the node (or left if near the right edge).
 * Shows input data, output data, error message, and timing metadata.
 */
export function ExecutionDataPopup({ step, bounds, onClose }: ExecutionDataPopupProps) {
  // Position popup to the right of the node badge area
  const left = bounds.x + bounds.width + 60; // after the badge
  const top = bounds.y;

  const title = step.nodeName || step.nodeType || 'Node';

  return (
    <div className={styles.popup} style={{ left, top }}>
      <div className={styles.popupHeader}>
        <span className={styles.popupTitle} title={title}>
          {title}
        </span>
        <span className={styles.popupStatus} data-status={step.status}>
          {step.status}
        </span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className={styles.popupContent}>
        {step.inputData && Object.keys(step.inputData).length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Input</span>
            <pre className={styles.dataPre}>{JSON.stringify(step.inputData, null, 2)}</pre>
          </div>
        )}

        {step.outputData && Object.keys(step.outputData).length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Output</span>
            <pre className={styles.dataPre}>{JSON.stringify(step.outputData, null, 2)}</pre>
          </div>
        )}

        {step.errorMessage && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Error</span>
            <pre className={styles.errorPre}>{step.errorMessage}</pre>
          </div>
        )}

        <div className={styles.meta}>
          <span className={styles.metaRow}>Duration: {formatDuration(step.durationMs)}</span>
          <span className={styles.metaRow}>Started: {formatTime(step.startedAt)}</span>
          <span className={styles.metaRow}>Step: {step.stepIndex + 1}</span>
        </div>
      </div>
    </div>
  );
}
