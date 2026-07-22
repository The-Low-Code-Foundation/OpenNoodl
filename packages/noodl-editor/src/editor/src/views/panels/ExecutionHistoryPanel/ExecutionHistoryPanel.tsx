import React, { useCallback, useState } from 'react';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import { ExecutionDetail } from './components/ExecutionDetail/ExecutionDetail';
import { ExecutionFilters } from './components/ExecutionFilters/ExecutionFilters';
import { ExecutionList } from './components/ExecutionList/ExecutionList';
import styles from './ExecutionHistoryPanel.module.scss';
import { useExecutionDetail } from './hooks/useExecutionDetail';
import { type ExecutionFilters as FiltersState, useExecutionHistory } from './hooks/useExecutionHistory';

/**
 * CF11-006/007: Execution History Panel
 *
 * Sidebar panel showing workflow execution history.
 * Allows users to view past executions, inspect node data, and debug failures.
 *
 * Registered in router.setup.ts at order 8.8 (between backend-services and app-setup).
 *
 * CF11-007: "Pin to Canvas" button in ExecutionDetail fetches the full execution
 * (with steps) and emits 'execution:pinToCanvas' via EventDispatcher so the
 * ExecutionOverlay mounted in nodegrapheditor.ts can pick it up.
 */
export function ExecutionHistoryPanel() {
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersState>({
    status: undefined,
    startDate: undefined,
    endDate: undefined
  });

  const { executions, loading, error, refresh } = useExecutionHistory(filters);

  // CF11-007: fetch full execution (with steps) and pin it to the canvas overlay
  const { execution: detailExecution } = useExecutionDetail(selectedExecutionId);

  const handlePinToCanvas = useCallback(
    (executionId: string) => {
      // detailExecution is already loaded by useExecutionDetail above
      if (detailExecution && detailExecution.id === executionId) {
        EventDispatcher.instance.emit('execution:pinToCanvas', { execution: detailExecution });
      }
    },
    [detailExecution]
  );

  return (
    <div className={styles.Panel}>
      <div className={styles.Header}>
        <span className={styles.Title}>Execution History</span>
        <button className={styles.RefreshButton} onClick={refresh} title="Refresh" aria-label="Refresh">
          ↻
        </button>
      </div>

      {!selectedExecutionId && <ExecutionFilters filters={filters} onChange={setFilters} />}

      <div className={styles.Body}>
        {selectedExecutionId ? (
          <ExecutionDetail
            executionId={selectedExecutionId}
            onBack={() => setSelectedExecutionId(null)}
            onPinToCanvas={handlePinToCanvas}
          />
        ) : (
          <ExecutionList executions={executions} loading={loading} error={error} onSelect={setSelectedExecutionId} />
        )}
      </div>
    </div>
  );
}
