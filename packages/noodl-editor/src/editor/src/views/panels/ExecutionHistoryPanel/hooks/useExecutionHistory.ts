import { useCallback, useEffect, useState } from 'react';

import type { ExecutionQuery, ExecutionStatus, WorkflowExecution } from '@noodl-viewer-cloud/execution-history';

export interface ExecutionFilters {
  status?: ExecutionStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface UseExecutionHistoryResult {
  executions: WorkflowExecution[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches execution history from the backend server via IPC.
 * The backend server (TASK-007B) exposes a REST API on localhost.
 */
export function useExecutionHistory(filters: ExecutionFilters): UseExecutionHistoryResult {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { ipcRenderer } = (window as any).require('electron');

      const query: ExecutionQuery = {
        status: filters.status,
        startedAfter: filters.startDate?.getTime(),
        startedBefore: filters.endDate?.getTime(),
        limit: 100,
        orderBy: 'started_at',
        orderDir: 'desc'
      };

      const result = await ipcRenderer.invoke('execution-history:list', query);

      if (result && result.error) {
        setError(result.error);
        setExecutions([]);
      } else {
        setExecutions(result || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load execution history');
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.startDate, filters.endDate]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { executions, loading, error, refresh: fetch };
}
