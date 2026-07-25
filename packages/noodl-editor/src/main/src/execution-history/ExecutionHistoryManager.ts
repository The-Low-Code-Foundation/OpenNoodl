/**
 * ExecutionHistoryManager — WF-006
 *
 * Owns the single `ExecutionStore` backing the editor's execution history:
 * one per app run, shared by every function/workflow execution and by the
 * IPC handlers the Execution History Panel's hooks call
 * (`execution-history:list`, `execution-history:get`).
 *
 * A fresh `ExecutionLogger` is created per execution via `createLogger()`
 * rather than one shared instance being reused: `ExecutionLogger` keeps
 * single-execution state internally (`currentExecutionId`, `stepIndex`), so
 * sharing one logger across concurrent function calls would let a second
 * call's `startExecution()` clobber the first call's in-flight state before
 * it completes. Loggers are cheap (a handful of fields); the store — and the
 * database handle it wraps — is the only thing that needs to be shared.
 *
 * Engine-agnostic by construction: WF-001's future workflow engine gets
 * observability by calling `executionHistoryManager.createLogger()` too,
 * without touching this file, the IPC handlers, or the panel again.
 */

import { ExecutionLogger, ExecutionStore } from '@noodl-viewer-cloud/execution-history';
import type {
  ExecutionQuery,
  ExecutionWithSteps,
  LoggerConfig,
  WorkflowExecution
} from '@noodl-viewer-cloud/execution-history';

import { defaultExecutionHistoryDbPath, openExecutionHistoryEngine, type ExecutionHistoryEngineKind } from './engine';

function safeLog(...args: unknown[]): void {
  try {
    // eslint-disable-next-line no-console
    console.log('[ExecutionHistory]', ...args);
  } catch {
    // Ignore EPIPE errors, matching the rest of local-backend.
  }
}

export interface ExecutionHistoryStatus {
  initialized: boolean;
  engine: ExecutionHistoryEngineKind | null;
  /** false for the in-memory fallback — data does not survive a restart. */
  persistent: boolean;
  error: string | null;
}

/** Minimal shape of `ipcMain` this module needs — lets tests inject a fake. */
export interface IpcMainLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handle(channel: string, listener: (event: any, ...args: any[]) => unknown): void;
}

export type ListResult = WorkflowExecution[] | { error: string };
export type GetResult = ExecutionWithSteps | null | { error: string };

/** A running backend service whose execution store we can read over HTTP. */
export interface RemoteExecutionSource {
  id: string;
  name: string;
  endpoint: string;
}

const REMOTE_FETCH_TIMEOUT_MS = 2000;

export class ExecutionHistoryManager {
  private store: ExecutionStore | null = null;
  private status: ExecutionHistoryStatus = {
    initialized: false,
    engine: null,
    persistent: false,
    error: null
  };
  private ipcHandlersSetup = false;
  private remoteSources: (() => RemoteExecutionSource[]) | null = null;

  /**
   * WF-004: executions happen inside `nodegx-backend` child processes, each
   * owning its own store. The panel's IPC keeps working by merging those
   * stores (over HTTP) with the editor-local one. The provider is injected by
   * main.js (from BackendManager) to avoid a module cycle.
   */
  setRemoteSources(provider: () => RemoteExecutionSource[]): void {
    this.remoteSources = provider;
  }

  /**
   * Open the database and initialize the schema. Idempotent — safe to call
   * more than once. Never throws: failures are captured in `getStatus()` so
   * callers (the IPC handlers) can report them instead of the app crashing
   * over an observability nicety.
   */
  init(dbPath: string = defaultExecutionHistoryDbPath()): ExecutionHistoryStatus {
    if (this.status.initialized) return this.status;

    try {
      const { db, kind, persistent, nodeSqliteError } = openExecutionHistoryEngine(dbPath);
      const store = new ExecutionStore(db);
      store.initSchema();

      this.store = store;
      this.status = { initialized: true, engine: kind, persistent, error: null };

      if (kind === 'node:sqlite') {
        safeLog(`Using node:sqlite — execution history persists at ${dbPath}.`);
      } else {
        safeLog(
          'node:sqlite unavailable' +
            (nodeSqliteError ? ` (${nodeSqliteError})` : '') +
            ' — falling back to an in-memory store. ' +
            'Execution history will NOT persist across restarts. ' +
            'Durable storage is WF-004 territory.'
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      safeLog('Failed to initialize execution history store:', message);
      this.store = null;
      this.status = { initialized: false, engine: null, persistent: false, error: message };
    }

    return this.status;
  }

  getStatus(): ExecutionHistoryStatus {
    return this.status;
  }

  /**
   * Create a logger for a single execution, or `null` if the store never
   * initialized (callers should treat this as "logging unavailable" and
   * proceed without it — a missing history entry must never block a real
   * function execution).
   */
  createLogger(config?: Partial<LoggerConfig>): ExecutionLogger | null {
    if (!this.store) return null;
    return new ExecutionLogger(this.store, config);
  }

  list(query: ExecutionQuery): ListResult {
    if (!this.store) {
      return { error: this.unavailableMessage() };
    }
    try {
      return this.store.queryExecutions(query);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  get(executionId: string): GetResult {
    if (!this.store) {
      return { error: this.unavailableMessage() };
    }
    try {
      return this.store.getExecutionWithSteps(executionId);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  private unavailableMessage(): string {
    return this.status.error
      ? `Execution history is unavailable: ${this.status.error}`
      : 'Execution history is unavailable: the store has not been initialized.';
  }

  // ==========================================================================
  // Remote (child-process) stores — WF-004
  // ==========================================================================

  private async fetchRemoteList(source: RemoteExecutionSource, query: ExecutionQuery): Promise<WorkflowExecution[]> {
    try {
      const params = new URLSearchParams();
      if (query.workflowId) params.set('workflowId', query.workflowId);
      if (query.status) params.set('status', query.status);
      if (query.triggerType) params.set('triggerType', query.triggerType);
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      const res = await fetch(`${source.endpoint}/executions?${params}`, {
        signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS)
      });
      if (!res.ok) return [];
      return (await res.json()) as WorkflowExecution[];
    } catch {
      // A briefly-unreachable backend must not break the whole panel; its
      // entries just don't appear until the next refresh.
      return [];
    }
  }

  private async fetchRemoteGet(source: RemoteExecutionSource, executionId: string): Promise<ExecutionWithSteps | null> {
    try {
      const res = await fetch(`${source.endpoint}/executions/${encodeURIComponent(executionId)}`, {
        signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS)
      });
      if (!res.ok) return null;
      return (await res.json()) as ExecutionWithSteps;
    } catch {
      return null;
    }
  }

  /**
   * Local list merged with every running backend's store, newest-first,
   * re-limited. Serves the same IPC channel/shape as before WF-004.
   */
  async listMerged(query: ExecutionQuery): Promise<ListResult> {
    const local = this.store ? this.list(query) : [];
    const localRows = Array.isArray(local) ? local : [];

    const sources = this.remoteSources ? this.remoteSources() : [];
    const remoteRows = (await Promise.all(sources.map((s) => this.fetchRemoteList(s, query)))).flat();

    if (!this.store && sources.length === 0) {
      // Nothing local AND nothing to merge — keep the original honest error.
      return this.list(query);
    }

    const merged = [...localRows, ...remoteRows].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    const limit = query.limit ?? 100;
    return merged.slice(0, limit);
  }

  /** Local store first, then each running backend. */
  async getMerged(executionId: string): Promise<GetResult> {
    if (this.store) {
      const local = this.get(executionId);
      if (local && !('error' in (local as object))) return local;
    }
    const sources = this.remoteSources ? this.remoteSources() : [];
    for (const source of sources) {
      const remote = await this.fetchRemoteGet(source, executionId);
      if (remote) return remote;
    }
    return this.store ? null : this.get(executionId);
  }

  /**
   * Register the IPC handlers `useExecutionHistory` / `useExecutionDetail`
   * call. `ipcMain` is injected so this can be exercised in tests without
   * Electron.
   */
  registerIpcHandlers(ipcMain: IpcMainLike): void {
    if (this.ipcHandlersSetup) return;

    ipcMain.handle('execution-history:list', async (_event, query: ExecutionQuery) => {
      return this.listMerged(query || {});
    });

    ipcMain.handle('execution-history:get', async (_event, executionId: string) => {
      return this.getMerged(executionId);
    });

    this.ipcHandlersSetup = true;
  }
}

// Singleton instance — mirrors the `backendManager` pattern in ./local-backend.
export const executionHistoryManager = new ExecutionHistoryManager();
