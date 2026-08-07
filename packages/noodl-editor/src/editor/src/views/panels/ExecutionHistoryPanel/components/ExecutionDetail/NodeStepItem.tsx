import React, { useState } from 'react';

import type { ExecutionStep } from '@noodl-viewer-cloud/execution-history';

import styles from './NodeStepItem.module.scss';
import type { StepAnnotation } from './stepAnnotations';

interface Props {
  step: ExecutionStep;
  index: number;
  annotation: StepAnnotation;
}

/**
 * WFA-002: a skipped step genuinely has no duration; a step that completed in
 * under a millisecond has one, and it is 0. Those used to render identically
 * (see `store.ts` `nullableNumber`), which made "the charge step did not run"
 * indistinguishable from "the charge step ran instantly".
 */
function formatDuration(step: ExecutionStep): string {
  if (step.status === 'skipped') return '—';
  const ms = step.durationMs;
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
 *
 * Expandable to show input/output data. `skipped` steps are rendered rather
 * than hidden — "the charge step did not run because the condition was false"
 * is the single most useful thing to know when debugging a branch, and the
 * engine records it deliberately.
 */
export function NodeStepItem({ step, index, annotation }: Props) {
  const isError = step.status === 'error';
  // A failure is worth seeing without a click; everything else stays closed so
  // a 20-step run is still readable.
  const [expanded, setExpanded] = useState(isError);

  const receivedError = annotation.receivedError;
  const hasData = Boolean(step.inputData || step.outputData || step.errorMessage);

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
          {/* The name gets the whole first line. The panel is narrow, and the
              meta cluster used to squeeze it to "Char…" on exactly the rows a
              user cares about most. */}
          <span className={styles.NodeName}>{step.nodeName || step.nodeId}</span>
          <span className={styles.NodeType}>
            {step.nodeType}
            {step.nodeName && step.nodeName !== step.nodeId && (
              // The step id is what the canvas overlay keys on, so it belongs on
              // the row rather than only inside the input JSON.
              <span className={styles.NodeId}>{step.nodeId}</span>
            )}
            {annotation.attempts !== undefined && (
              <span className={styles.Chip} title="Attempts made by this retry step">
                {annotation.attempts} {annotation.attempts === 1 ? 'attempt' : 'attempts'}
              </span>
            )}
          </span>
        </div>
        <div className={styles.StepMeta}>
          <span className={styles.Duration}>{formatDuration(step)}</span>
          <span className={styles.Status} data-status={step.status}>
            {step.status}
          </span>
          <div className={styles.StatusDot} data-status={step.status} />
        </div>
        {hasData && <span className={styles.ExpandIcon}>{expanded ? '▲' : '▼'}</span>}
      </div>

      {/* The error routing, stated in words. Always visible — this is the link
          between a failure and whatever caught it, and it should not need a
          click and two JSON blobs to find. */}
      {(annotation.handledBy || annotation.unhandled || receivedError) && (
        <div className={styles.Routing}>
          {annotation.handledBy && (
            <span className={styles.RoutingHandled}>Error routed to {annotation.handledBy.join(', ')}</span>
          )}
          {annotation.unhandled && (
            <span className={styles.RoutingUnhandled}>Error not routed — the workflow halted here</span>
          )}
          {receivedError && (
            <span className={styles.RoutingReceived}>Received the error from {receivedError.fromLabel}</span>
          )}
        </div>
      )}

      {step.status === 'skipped' && (
        <div className={styles.Routing}>
          <span className={styles.RoutingSkipped}>Not reached — no incoming edge was taken</span>
        </div>
      )}

      {expanded && hasData && (
        <div className={styles.Body}>
          {step.errorMessage && (
            <div className={styles.ErrorSection}>
              <span className={styles.SectionLabel}>Error</span>
              <pre className={styles.Pre}>{step.errorMessage}</pre>
            </div>
          )}
          {receivedError && (
            <div className={styles.ErrorSection}>
              <span className={styles.SectionLabel}>Received error (previous.error)</span>
              <pre className={styles.Pre}>{safeStringify(receivedError.error)}</pre>
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
