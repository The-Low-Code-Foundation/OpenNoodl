import { useCallback, useEffect, useState } from 'react';

import type { ExecutionWithSteps } from '@noodl-viewer-cloud/execution-history';

export interface UseExecutionDetailResult {
  execution: ExecutionWithSteps | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches a single execution with all its steps via IPC.
 */
export function useExecutionDetail(executionId: string | null): UseExecutionDetailResult {
  const [execution, setExecution] = useState<ExecutionWithSteps | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!executionId) {
      setExecution(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('execution-history:get', executionId);

      if (result && result.error) {
        setError(result.error);
        setExecution(null);
      } else {
        setExecution(result || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load execution detail');
      setExecution(null);
    } finally {
      setLoading(false);
    }
  }, [executionId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { execution, loading, error };
}
