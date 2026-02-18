import React from 'react';

import type { WorkflowExecution } from '@noodl-viewer-cloud/execution-history';

import { ExecutionItem } from './ExecutionItem';
import styles from './ExecutionList.module.scss';

interface Props {
  executions: WorkflowExecution[];
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
}

/**
 * Scrollable list of workflow executions.
 */
export function ExecutionList({ executions, loading, error, onSelect }: Props) {
  if (loading) {
    return (
      <div className={styles.Loading}>
        <span>Loading executions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.Error}>
        <span>{error}</span>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className={styles.Empty}>
        <span className={styles.EmptyTitle}>No executions yet</span>
        <span className={styles.EmptyHint}>Workflow runs will appear here</span>
      </div>
    );
  }

  return (
    <div className={styles.List}>
      {executions.map((execution) => (
        <ExecutionItem key={execution.id} execution={execution} onSelect={() => onSelect(execution.id)} />
      ))}
    </div>
  );
}
