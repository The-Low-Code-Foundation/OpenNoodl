import { useCallback, useEffect, useState } from 'react';

import type { ExecutionQuery, ExecutionStatus, WorkflowExecution } from '@noodl-viewer-cloud/execution-history';

// Type-only: the main process owns the IPC contract, so the panel reads it from
// there rather than keeping a second copy that can drift. `import type` is
// erased, so nothing from the main process is pulled into the renderer bundle —
// and the manager module (not `index.ts`) is the target deliberately, because
// `index.ts` imports `electron`.
import type {
  ExecutionListResult,
  ExecutionSourceStatus
} from '../../../../../../main/src/execution-history/ExecutionHistoryManager';

export interface ExecutionFilters {
  status?: ExecutionStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface UseExecutionHistoryResult {
  executions: WorkflowExecution[];
  /**
   * Which stores answered this list (WFA-002). The panel needs it to tell "no
   * backend running" from "backend running, nothing has run yet" from "the
   * backend that had the runs is unreachable" — three states that all used to
   * render as the same empty list.
   */
  sources: ExecutionSourceStatus[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches execution history from the editor's merged store via IPC: the
 * editor-local store plus every running `nodegx-backend` child process.
 */
export function useExecutionHistory(filters: ExecutionFilters): UseExecutionHistoryResult {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [sources, setSources] = useState<ExecutionSourceStatus[]>([]);
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

      const result: ExecutionListResult = await ipcRenderer.invoke('execution-history:list', query);

      setSources(result?.sources || []);
      setExecutions(result?.executions || []);
      // An `error` here means there was nothing to ask at all — not that a
      // single source failed, which is reported per-source instead.
      setError(result?.error || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load execution history');
      setExecutions([]);
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.startDate, filters.endDate]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { executions, sources, loading, error, refresh: fetch };
}
