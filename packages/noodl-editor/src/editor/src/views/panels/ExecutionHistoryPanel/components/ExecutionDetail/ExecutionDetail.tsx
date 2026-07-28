import React, { useMemo, useState } from 'react';

import styles from './ExecutionDetail.module.scss';
import { NodeStepList } from './NodeStepList';
import { useExecutionDetail } from '../../hooks/useExecutionDetail';

interface Props {
  executionId: string;
  onBack: () => void;
  /** Hook for CF11-007 canvas overlay integration */
  onPinToCanvas?: (executionId: string) => void;
  /** WFA-002: cancel an in-flight run. Absent when nothing can cancel it. */
  onCancel?: (backendId: string, executionId: string) => Promise<void>;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * `4 succeeded · 1 failed · 1 skipped` — the shape of the run in one line.
 *
 * Structurally typed rather than importing `ExecutionStep`: the `core-ui`
 * typecheck project reaches this file but does not carry the
 * `@noodl-viewer-cloud/*` path alias, and only `status` is read here.
 */
function summariseSteps(steps: { status: string }[]): string {
  const counts: Record<string, number> = { success: 0, error: 0, skipped: 0, running: 0 };
  for (const step of steps) counts[step.status] = (counts[step.status] ?? 0) + 1;
  const parts: string[] = [];
  if (counts.success) parts.push(`${counts.success} succeeded`);
  if (counts.error) parts.push(`${counts.error} failed`);
  if (counts.skipped) parts.push(`${counts.skipped} skipped`);
  if (counts.running) parts.push(`${counts.running} running`);
  return parts.join(' · ') || 'no steps';
}

/**
 * Detailed view of a single execution — a workflow run or a cloud function call.
 * Shows summary, error info, trigger data, and per-step records.
 */
export function ExecutionDetail({ executionId, onBack, onPinToCanvas, onCancel }: Props) {
  const { execution, loading, error, refresh } = useExecutionDetail(executionId);
  const [cancelState, setCancelState] = useState<'idle' | 'cancelling' | string>('idle');

  const steps = execution?.steps ?? [];
  const stepSummary = useMemo(() => summariseSteps(steps), [steps]);

  if (loading) {
    return (
      <div className={styles.Loading}>
        <span>Loading execution...</span>
      </div>
    );
  }

  // WFA-002: a record that cannot be found is not automatically an error. History
  // lives in the backend that ran it, so the honest reading of "not found" is
  // "no running source has it" — most often because that backend was stopped.
  if (!execution) {
    return (
      <div className={styles.Missing}>
        <button className={styles.BackButton} onClick={onBack}>
          ← Back
        </button>
        <span className={styles.MissingTitle}>This run is no longer available</span>
        <span className={styles.MissingHint}>
          {error ||
            'Execution records live in the backend that ran them. No running backend has this one — the backend that did may have been stopped.'}
        </span>
      </div>
    );
  }

  const sourceName = execution.metadata?.sourceName as string | undefined;
  const backendId = execution.metadata?.backendId as string | undefined;
  const triggerData = execution.triggerData as Record<string, unknown> | undefined;
  const triggerHeaders = triggerData?.headers as Record<string, unknown> | undefined;
  const triggerRest = triggerData ? { ...triggerData } : undefined;
  if (triggerRest) delete triggerRest.headers;

  const canCancel = execution.status === 'running' && Boolean(onCancel) && Boolean(backendId);

  return (
    <div className={styles.Detail}>
      <div className={styles.Header}>
        <button className={styles.BackButton} onClick={onBack}>
          ← Back
        </button>
        <span className={styles.Title}>{execution.workflowName}</span>
        {canCancel && (
          <button
            className={styles.CancelButton}
            disabled={cancelState === 'cancelling'}
            onClick={async () => {
              setCancelState('cancelling');
              try {
                await onCancel(backendId, executionId);
                // Cancellation is cooperative — the engine aborts the step's
                // wait and finalises the record. Re-read it, or this view keeps
                // saying `running` for a run that has already stopped.
                refresh();
                setCancelState('idle');
              } catch (e) {
                setCancelState(e instanceof Error ? e.message : String(e));
              }
            }}
          >
            {cancelState === 'cancelling' ? 'Cancelling…' : 'Cancel'}
          </button>
        )}
        {onPinToCanvas && (
          <button className={styles.PinButton} onClick={() => onPinToCanvas(executionId)} title="Pin to canvas">
            Pin
          </button>
        )}
      </div>

      <div className={styles.Content}>
        {cancelState !== 'idle' && cancelState !== 'cancelling' && (
          <div className={styles.InlineError}>{cancelState}</div>
        )}

        <section className={styles.Summary}>
          <div className={styles.SummaryRow}>
            <span className={styles.Label}>Status</span>
            <span className={styles.StatusBadge} data-status={execution.status}>
              {execution.status}
            </span>
          </div>
          <div className={styles.SummaryRow}>
            <span className={styles.Label}>Started</span>
            <span className={styles.Value}>{formatTime(execution.startedAt)}</span>
          </div>
          <div className={styles.SummaryRow}>
            <span className={styles.Label}>Duration</span>
            <span className={styles.Value}>{formatDuration(execution.durationMs)}</span>
          </div>
          <div className={styles.SummaryRow}>
            <span className={styles.Label}>Trigger</span>
            <span className={styles.Value}>{execution.triggerType}</span>
          </div>
          {/* Which store served this record. Two backends running the same-named
              workflow produce records identical apart from where they came from. */}
          {sourceName && (
            <div className={styles.SummaryRow}>
              <span className={styles.Label}>Ran on</span>
              <span className={styles.Value}>{sourceName}</span>
            </div>
          )}
          <div className={styles.SummaryRow}>
            <span className={styles.Label}>Steps</span>
            <span className={styles.Value}>{stepSummary}</span>
          </div>
        </section>

        {execution.errorMessage && (
          <section className={styles.Section}>
            <h4 className={styles.SectionTitle}>Error</h4>
            <pre className={styles.ErrorPre}>{execution.errorMessage}</pre>
            {execution.errorStack && (
              <details className={styles.StackDetails}>
                <summary>Stack trace</summary>
                <pre className={styles.StackPre}>{execution.errorStack}</pre>
              </details>
            )}
          </section>
        )}

        {triggerRest && Object.keys(triggerRest).length > 0 && (
          <section className={styles.Section}>
            <h4 className={styles.SectionTitle}>Trigger Data</h4>
            <pre className={styles.DataPre}>{JSON.stringify(triggerRest, null, 2)}</pre>
          </section>
        )}

        {/* Request headers are scrubbed before storage (`scrub.ts` redacts
            authorization, cookie, x-api-key and friends), but they are still a
            wall of noise, so they stay folded rather than sitting in every
            screenshot of this panel. */}
        {triggerHeaders && Object.keys(triggerHeaders).length > 0 && (
          <section className={styles.Section}>
            <details className={styles.StackDetails}>
              <summary>Request headers ({Object.keys(triggerHeaders).length})</summary>
              <pre className={styles.DataPre}>{JSON.stringify(triggerHeaders, null, 2)}</pre>
            </details>
          </section>
        )}

        <section className={styles.Section}>
          <h4 className={styles.SectionTitle}>
            Node Steps
            <span className={styles.StepCount}>{steps.length}</span>
          </h4>
          <NodeStepList steps={steps} />
        </section>
      </div>
    </div>
  );
}
