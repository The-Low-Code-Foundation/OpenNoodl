import React, { useState } from 'react';

import { ExecutionDetail } from './components/ExecutionDetail/ExecutionDetail';
import { ExecutionFilters } from './components/ExecutionFilters/ExecutionFilters';
import { ExecutionList } from './components/ExecutionList/ExecutionList';
import styles from './ExecutionHistoryPanel.module.scss';
import { type ExecutionFilters as FiltersState, useExecutionHistory } from './hooks/useExecutionHistory';

/**
 * CF11-006: Execution History Panel
 *
 * Sidebar panel showing workflow execution history.
 * Allows users to view past executions, inspect node data, and debug failures.
 *
 * Registered in router.setup.ts at order 8.8 (between backend-services and app-setup).
 * CF11-007 will add canvas overlay integration via the onPinToCanvas prop.
 */
export function ExecutionHistoryPanel() {
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersState>({
    status: undefined,
    startDate: undefined,
    endDate: undefined
  });

  const { executions, loading, error, refresh } = useExecutionHistory(filters);

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
            // onPinToCanvas will be wired in CF11-007
          />
        ) : (
          <ExecutionList executions={executions} loading={loading} error={error} onSelect={setSelectedExecutionId} />
        )}
      </div>
    </div>
  );
}
