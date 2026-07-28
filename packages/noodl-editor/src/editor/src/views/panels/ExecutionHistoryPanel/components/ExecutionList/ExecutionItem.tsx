import React from 'react';

import type { WorkflowExecution } from '@noodl-viewer-cloud/execution-history';

import styles from './ExecutionItem.module.scss';

interface Props {
  execution: WorkflowExecution;
  /** Show which store served the row — only useful with more than one source. */
  showSource?: boolean;
  onSelect: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatDuration(ms?: number): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Single row in the execution history list.
 */
export function ExecutionItem({ execution, showSource, onSelect }: Props) {
  const sourceName = execution.metadata?.sourceName as string | undefined;

  return (
    <div
      className={styles.Item}
      data-status={execution.status}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <div className={styles.StatusDot} data-status={execution.status} />
      <div className={styles.Info}>
        <span className={styles.Name}>{execution.workflowName}</span>
        <span className={styles.Time}>
          {formatRelativeTime(execution.startedAt)}
          {showSource && sourceName && <span className={styles.Source}> · {sourceName}</span>}
        </span>
      </div>
      <div className={styles.Meta}>
        <span className={styles.Duration}>{formatDuration(execution.durationMs)}</span>
        <span className={styles.Trigger}>{execution.triggerType}</span>
      </div>
    </div>
  );
}
