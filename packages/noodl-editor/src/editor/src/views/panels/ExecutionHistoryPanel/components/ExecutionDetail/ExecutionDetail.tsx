import React from 'react';

import styles from './ExecutionDetail.module.scss';
import { NodeStepList } from './NodeStepList';
import { useExecutionDetail } from '../../hooks/useExecutionDetail';

interface Props {
  executionId: string;
  onBack: () => void;
  /** Hook for CF11-007 canvas overlay integration */
  onPinToCanvas?: (executionId: string) => void;
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
 * Detailed view of a single workflow execution.
 * Shows summary, error info, trigger data, and per-node steps.
 */
export function ExecutionDetail({ executionId, onBack, onPinToCanvas }: Props) {
  const { execution, loading, error } = useExecutionDetail(executionId);

  if (loading) {
    return (
      <div className={styles.Loading}>
        <span>Loading execution...</span>
      </div>
    );
  }

  if (error || !execution) {
    return (
      <div className={styles.Error}>
        <span>{error || 'Execution not found'}</span>
      </div>
    );
  }

  return (
    <div className={styles.Detail}>
      <div className={styles.Header}>
        <button className={styles.BackButton} onClick={onBack}>
          ← Back
        </button>
        <span className={styles.Title}>{execution.workflowName}</span>
        {onPinToCanvas && (
          <button className={styles.PinButton} onClick={() => onPinToCanvas(executionId)} title="Pin to canvas">
            Pin
          </button>
        )}
      </div>

      <div className={styles.Content}>
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

        {execution.triggerData && Object.keys(execution.triggerData).length > 0 && (
          <section className={styles.Section}>
            <h4 className={styles.SectionTitle}>Trigger Data</h4>
            <pre className={styles.DataPre}>{JSON.stringify(execution.triggerData, null, 2)}</pre>
          </section>
        )}

        <section className={styles.Section}>
          <h4 className={styles.SectionTitle}>
            Node Steps
            <span className={styles.StepCount}>{execution.steps?.length ?? 0}</span>
          </h4>
          <NodeStepList steps={execution.steps ?? []} />
        </section>
      </div>
    </div>
  );
}
