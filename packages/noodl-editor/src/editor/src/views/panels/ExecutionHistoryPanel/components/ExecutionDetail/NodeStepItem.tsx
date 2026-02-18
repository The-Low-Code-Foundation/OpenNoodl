import React, { useState } from 'react';

import type { ExecutionStep } from '@noodl-viewer-cloud/execution-history';

import styles from './NodeStepItem.module.scss';

interface Props {
  step: ExecutionStep;
  index: number;
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

/**
 * Single node step row in the execution detail view.
 * Expandable to show input/output data.
 */
export function NodeStepItem({ step, index }: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasData = step.inputData || step.outputData || step.errorMessage;

  return (
    <div className={styles.Step} data-status={step.status} data-expanded={expanded}>
      <div
        className={styles.Header}
        onClick={() => hasData && setExpanded((v) => !v)}
        role={hasData ? 'button' : undefined}
        tabIndex={hasData ? 0 : undefined}
        onKeyDown={(e) => hasData && e.key === 'Enter' && setExpanded((v) => !v)}
      >
        <span className={styles.Index}>{index + 1}</span>
        <div className={styles.StepInfo}>
          <span className={styles.NodeName}>{step.nodeName || step.nodeId}</span>
          <span className={styles.NodeType}>{step.nodeType}</span>
        </div>
        <div className={styles.StepMeta}>
          <span className={styles.Duration}>{formatDuration(step.durationMs)}</span>
          <div className={styles.StatusDot} data-status={step.status} />
        </div>
        {hasData && <span className={styles.ExpandIcon}>{expanded ? '▲' : '▼'}</span>}
      </div>

      {expanded && hasData && (
        <div className={styles.Body}>
          {step.errorMessage && (
            <div className={styles.ErrorSection}>
              <span className={styles.SectionLabel}>Error</span>
              <pre className={styles.Pre}>{step.errorMessage}</pre>
            </div>
          )}
          {step.inputData && (
            <div className={styles.DataSection}>
              <span className={styles.SectionLabel}>Input</span>
              <pre className={styles.Pre}>{safeStringify(step.inputData)}</pre>
            </div>
          )}
          {step.outputData && (
            <div className={styles.DataSection}>
              <span className={styles.SectionLabel}>Output</span>
              <pre className={styles.Pre}>{safeStringify(step.outputData)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
