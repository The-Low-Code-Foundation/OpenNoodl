import React from 'react';

import type { WorkflowExecution } from '@noodl-viewer-cloud/execution-history';

import type { ExecutionSourceStatus } from '../../../../../../../main/src/execution-history/ExecutionHistoryManager';
import { ExecutionItem } from './ExecutionItem';
import styles from './ExecutionList.module.scss';

interface Props {
  executions: WorkflowExecution[];
  sources: ExecutionSourceStatus[];
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
}

function names(sources: ExecutionSourceStatus[]): string {
  return sources.map((s) => s.name).join(', ');
}

/**
 * Scrollable list of executions.
 *
 * WFA-002: the three ways this list can be empty are three different situations
 * and each now says which it is. They used to share one "No executions yet" —
 * and one of them ("the backend that had your runs cannot be read") is a fault
 * the user needs to know about, not an absence.
 */
export function ExecutionList({ executions, sources, loading, error, onSelect }: Props) {
  const backends = sources.filter((s) => s.kind === 'backend');
  const unreachable = backends.filter((s) => !s.reachable);
  const showSource = backends.length > 1;

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
    if (backends.length === 0) {
      return (
        <div className={styles.Empty}>
          <span className={styles.EmptyTitle}>No backend is running</span>
          <span className={styles.EmptyHint}>
            Start one from the Backend Services panel. Cloud function calls and workflow runs appear here as they
            happen.
          </span>
        </div>
      );
    }

    if (unreachable.length === backends.length) {
      return (
        <div className={styles.Error}>
          <span>
            {names(backends)} {backends.length === 1 ? 'is' : 'are'} running but could not be read:{' '}
            {unreachable[0].error || 'no response'}.
          </span>
        </div>
      );
    }

    return (
      <div className={styles.Empty}>
        <span className={styles.EmptyTitle}>No runs yet</span>
        <span className={styles.EmptyHint}>
          {names(backends.filter((s) => s.reachable))} {backends.length === 1 ? 'is' : 'are'} running and has recorded
          nothing. Call a cloud function, fire a trigger, or run a workflow from here.
        </span>
      </div>
    );
  }

  return (
    <>
      {unreachable.length > 0 && (
        <div className={styles.Notice}>
          {unreachable.length} of {backends.length} backends could not be read ({names(unreachable)}) — this list is
          incomplete.
        </div>
      )}
      <div className={styles.List}>
        {executions.map((execution) => (
          <ExecutionItem
            key={execution.id}
            execution={execution}
            showSource={showSource}
            onSelect={() => onSelect(execution.id)}
          />
        ))}
      </div>
    </>
  );
}
