/**
 * useLocalBackends
 *
 * React hook for managing local SQLite backends via IPC.
 * Provides state and actions for the BYOB local backend system.
 *
 * @module BackendServicesPanel/hooks/useLocalBackends
 * @since 1.2.0
 */

import { useCallback, useEffect, useState } from 'react';

import { CloudFunctionDeployer } from '../../../../services/CloudFunctionDeployer';

/** Backend metadata as stored in config.json */
export interface LocalBackendMetadata {
  id: string;
  name: string;
  createdAt: string;
  port: number;
  projectIds: string[];
}

/** How a running (or last-attempted) backend is persisting data */
export interface PersistenceStatus {
  /** 'unknown' before a start attempt, then the resolved mode */
  mode: 'unknown' | 'persistent' | 'ephemeral' | 'failed';
  persistent: boolean;
  ephemeral: boolean;
  /** Present when mode === 'failed' or the native engine could not load */
  error?: { code?: string; message: string } | null;
}

/** Extended backend info with runtime status */
export interface LocalBackendInfo extends LocalBackendMetadata {
  running: boolean;
  endpoint?: string;
  /** Data-persistence status (persistent vs. ephemeral vs. failed) */
  persistence?: PersistenceStatus;
}

/** Hook return type */
export interface UseLocalBackendsReturn {
  /** List of all local backends */
  backends: LocalBackendInfo[];
  /** Whether initial loading is in progress */
  isLoading: boolean;
  /** Whether an operation is in progress */
  isOperating: boolean;
  /** Any error message */
  error: string | null;
  /** Refresh the backends list */
  refresh: () => Promise<void>;
  /** Create a new backend */
  createBackend: (name: string) => Promise<LocalBackendMetadata | null>;
  /** Delete a backend */
  deleteBackend: (id: string) => Promise<boolean>;
  /** Start a backend. Pass `{ ephemeral: true }` to opt into non-persisting mode. */
  startBackend: (id: string, options?: { ephemeral?: boolean }) => Promise<boolean>;
  /** Stop a backend */
  stopBackend: (id: string) => Promise<boolean>;
  /** Export schema */
  exportSchema: (id: string, format: 'postgres' | 'supabase' | 'json') => Promise<string | null>;
  /** WFA-001: push the project's cloud functions to this backend now. */
  deployCloudFunctions: (id: string) => Promise<boolean>;
}

/**
 * Invoke IPC handler with error handling
 * Uses window.require('electron').ipcRenderer like GitHubOAuthService
 */
async function invokeIPC<T>(channel: string, ...args: unknown[]): Promise<T | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { ipcRenderer } = (window as any).require('electron');
    if (ipcRenderer?.invoke) {
      return await ipcRenderer.invoke(channel, ...args);
    }
    console.warn('[useLocalBackends] ipcRenderer not available');
    return null;
  } catch (error) {
    console.error(`[useLocalBackends] IPC error (${channel}):`, error);
    throw error;
  }
}

/**
 * Hook for managing local backends
 */
export function useLocalBackends(): UseLocalBackendsReturn {
  const [backends, setBackends] = useState<LocalBackendInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOperating, setIsOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all backends and their statuses
  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await invokeIPC<LocalBackendMetadata[]>('backend:list');
      if (!list) {
        setBackends([]);
        return;
      }

      // Get status for each backend
      const backendsWithStatus: LocalBackendInfo[] = await Promise.all(
        list.map(async (backend) => {
          const status = await invokeIPC<{
            running: boolean;
            port?: number;
            persistence?: PersistenceStatus;
          }>('backend:status', backend.id);
          return {
            ...backend,
            running: status?.running ?? false,
            endpoint: status?.running && status?.port ? `http://localhost:${status.port}` : undefined,
            persistence: status?.persistence
          };
        })
      );

      setBackends(backendsWithStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch backends';
      setError(message);
      console.error('[useLocalBackends] refresh error:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  // Create a new backend
  const createBackend = useCallback(
    async (name: string): Promise<LocalBackendMetadata | null> => {
      setIsOperating(true);
      setError(null);
      try {
        const result = await invokeIPC<LocalBackendMetadata>('backend:create', name);
        await refresh();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create backend';
        setError(message);
        return null;
      } finally {
        setIsOperating(false);
      }
    },
    [refresh]
  );

  // Delete a backend
  const deleteBackend = useCallback(
    async (id: string): Promise<boolean> => {
      setIsOperating(true);
      setError(null);
      try {
        await invokeIPC<{ deleted: boolean }>('backend:delete', id);
        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete backend';
        setError(message);
        return false;
      } finally {
        setIsOperating(false);
      }
    },
    [refresh]
  );

  // Start a backend
  const startBackend = useCallback(
    async (id: string, options?: { ephemeral?: boolean }): Promise<boolean> => {
      setIsOperating(true);
      setError(null);
      try {
        await invokeIPC<{ running: boolean }>('backend:start', id, options ?? {});

        /**
         * WFA-001 (finding F6): a backend loads `*.workflow.json` from its data
         * directory at start, so without this it comes up with whatever the last
         * session left — usually nothing — regardless of what the open project
         * contains. Awaited so the card's function list is already right by the
         * time the button stops saying "Processing…".
         */
        await CloudFunctionDeployer.onBackendStarted(id);

        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start backend';
        setError(message);
        // Refresh so the card can reflect the recorded persistence failure
        // (mode: 'failed') rather than staying on a stale "stopped" badge.
        await refresh().catch(() => undefined);
        return false;
      } finally {
        setIsOperating(false);
      }
    },
    [refresh]
  );

  // Stop a backend
  const stopBackend = useCallback(
    async (id: string): Promise<boolean> => {
      setIsOperating(true);
      setError(null);
      try {
        await invokeIPC<{ running: boolean }>('backend:stop', id);
        await refresh();
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to stop backend';
        setError(message);
        return false;
      } finally {
        setIsOperating(false);
      }
    },
    [refresh]
  );

  // Export schema
  const exportSchema = useCallback(
    async (id: string, format: 'postgres' | 'supabase' | 'json'): Promise<string | null> => {
      setIsOperating(true);
      setError(null);
      try {
        const result = await invokeIPC<string>('backend:export-schema', id, format);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to export schema';
        setError(message);
        return null;
      } finally {
        setIsOperating(false);
      }
    },
    []
  );

  const deployCloudFunctions = useCallback(async (id: string): Promise<boolean> => {
    setIsOperating(true);
    try {
      return await CloudFunctionDeployer.pushToBackend(id, { force: true });
    } finally {
      setIsOperating(false);
    }
  }, []);

  return {
    backends,
    isLoading,
    isOperating,
    error,
    refresh,
    createBackend,
    deleteBackend,
    startBackend,
    stopBackend,
    exportSchema,
    deployCloudFunctions
  };
}
