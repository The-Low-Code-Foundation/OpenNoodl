import React, { useCallback, useState } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';

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
    /* PNL-005: shared chrome. The hand-rolled 12/16px bar with its own 13px/600
       title is gone; Refresh is an action-slot icon button rather than a `↻`
       glyph in a bare `<button>`. */
    <BasePanel
      title="Execution History"
      isFill
      UNSAFE_content_style={{ paddingInline: 0, paddingTop: 0 }}
      headerSlot={
        <Tooltip content="Refresh" showAfterMs={300}>
          <IconButton
            variant={IconButtonVariant.Transparent}
            icon={IconName.Refresh}
            onClick={refresh}
            testId="execution-history-refresh"
          />
        </Tooltip>
      }
    >
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
    </BasePanel>
  );
}
