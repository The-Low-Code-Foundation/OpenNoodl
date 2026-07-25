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

export class ExecutionHistoryManager {
  private store: ExecutionStore | null = null;
  private status: ExecutionHistoryStatus = {
    initialized: false,
    engine: null,
    persistent: false,
    error: null
  };
  private ipcHandlersSetup = false;

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

  /**
   * Register the IPC handlers `useExecutionHistory` / `useExecutionDetail`
   * call. `ipcMain` is injected so this can be exercised in tests without
   * Electron.
   */
  registerIpcHandlers(ipcMain: IpcMainLike): void {
    if (this.ipcHandlersSetup) return;

    ipcMain.handle('execution-history:list', async (_event, query: ExecutionQuery) => {
      return this.list(query || {});
    });

    ipcMain.handle('execution-history:get', async (_event, executionId: string) => {
      return this.get(executionId);
    });

    this.ipcHandlersSetup = true;
  }
}

// Singleton instance — mirrors the `backendManager` pattern in ./local-backend.
export const executionHistoryManager = new ExecutionHistoryManager();
