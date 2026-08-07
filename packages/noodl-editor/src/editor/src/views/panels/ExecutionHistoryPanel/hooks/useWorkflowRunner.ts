import { ipcInvoke } from '@noodl-utils/ipc';
import { useCallback, useEffect, useState } from 'react';

/**
 * WFA-002: run and cancel a WF-001 workflow definition from the editor.
 *
 * `/admin/workflow-defs/:id/run` and `/admin/workflow-runs/:id/cancel` shipped
 * with WF-001 and both worked; nothing in the editor called them, so testing a
 * change meant a round trip through `curl`. That friction is what this phase
 * exists to remove.
 */

export interface RunnableWorkflow {
  backendId: string;
  backendName: string;
  /** The workflow definition id — also the execution's `workflowId`. */
  id: string;
  name: string;
  stepCount: number;
}

export interface UseWorkflowRunnerResult {
  workflows: RunnableWorkflow[];
  /** Backends that are running but could not be asked, by name. */
  unreachable: string[];
  loading: boolean;
  /** Refresh the definition list (a backend may have started since). */
  refresh: () => void;
  /**
   * Runs it. Resolves with the new execution id, or `null` when the run outlived
   * the backend request's ceiling and is still going — which is not a failure.
   * Throws only when the backend actually refused the run.
   */
  run: (workflow: RunnableWorkflow, payload: Record<string, unknown>) => Promise<string | null>;
  cancel: (backendId: string, executionId: string) => Promise<void>;
}

interface BackendWorkflowDefs {
  backendId: string;
  backendName: string;
  workflows: { id: string; name?: string; steps?: unknown[] }[];
  error?: string;
}

export function useWorkflowRunner(): UseWorkflowRunnerResult {
  const [workflows, setWorkflows] = useState<RunnableWorkflow[]>([]);
  const [unreachable, setUnreachable] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ipcInvoke<BackendWorkflowDefs[]>('backend:list-workflow-defs');
      const rows: RunnableWorkflow[] = [];
      const dead: string[] = [];
      for (const backend of result || []) {
        if (backend.error) dead.push(backend.backendName);
        for (const def of backend.workflows || []) {
          rows.push({
            backendId: backend.backendId,
            backendName: backend.backendName,
            id: def.id,
            name: def.name || def.id,
            stepCount: def.steps?.length ?? 0
          });
        }
      }
      setWorkflows(rows);
      setUnreachable(dead);
    } catch {
      // No running backend at all — `backend:list-workflow-defs` returns an
      // empty list rather than throwing, so this is a genuinely broken channel.
      setWorkflows([]);
      setUnreachable([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = useCallback(async (workflow: RunnableWorkflow, payload: Record<string, unknown>) => {
    const result = await ipcInvoke<{ stillRunning?: boolean; run?: { executionId?: string }; error?: string }>(
      'backend:run-workflow-def',
      workflow.backendId,
      workflow.id,
      payload
    );
    if (result?.stillRunning) return null;
    const executionId = result?.run?.executionId;
    if (!executionId) {
      throw new Error(result?.error || 'The backend accepted the run but returned no execution id.');
    }
    return executionId;
  }, []);

  const cancel = useCallback(async (backendId: string, executionId: string) => {
    await ipcInvoke('backend:cancel-workflow-run', backendId, executionId);
  }, []);

  return { workflows, unreachable, loading, refresh, run, cancel };
}
