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
  /**
   * The backend's admin credential (BAK-003), when the provider can supply it.
   *
   * ⚠️ `GET /executions` and `GET /executions/:id` are `access: { kind: 'admin' }`
   * routes — they just do not start with `admin/`, which is why FH-024's CORS
   * suppression had to be decided from the route table rather than the path.
   * Until FH-024 they answered anyway, because dev-open relaxed every admin gate
   * on loopback and the editor's own backends are dev-open. FH-024 (b) removed
   * that relaxation, and these two fetches were the only admin calls in the
   * editor that did not already go through `ServiceSupervisor.request` — so the
   * whole Execution History panel started answering "running but could not be
   * read: HTTP 401".
   *
   * Optional because a source that genuinely has no credential (a test double,
   * a backend whose secrets.json is unreadable) must still be *asked* and still
   * be reported unreachable rather than silently skipped.
   */
  adminToken?: string | null;
}

/**
 * WFA-002: where a list's rows came from, per source. Without this the panel
 * cannot tell "no backend is running" from "a backend is running and has no
 * runs" from "the backend that had the runs just died" — three states that all
 * rendered as one empty list, and one of which is a bug.
 */
export interface ExecutionSourceStatus {
  /** `local` for the editor-local store, otherwise the backend id. */
  id: string;
  name: string;
  kind: 'local' | 'backend';
  /** false when the source could not be read for this list. */
  reachable: boolean;
  /** Rows this source contributed. */
  count: number;
  /** Why it was unreachable, when known. */
  error?: string;
}

/**
 * The `execution-history:list` payload. An object rather than the bare array it
 * used to be, because a bare array cannot say which sources answered.
 */
export interface ExecutionListResult {
  executions: WorkflowExecution[];
  sources: ExecutionSourceStatus[];
  /** Set only when there is nothing to report at all (no store, no backends). */
  error?: string;
}

const REMOTE_FETCH_TIMEOUT_MS = 2000;

/**
 * The bearer header for a remote source, or nothing at all when it has no
 * credential. `undefined` rather than `{}` so the request is byte-identical to
 * the one this module has always sent when there is no token to send.
 */
function authHeaders(source: RemoteExecutionSource): Record<string, string> | undefined {
  return source.adminToken ? { authorization: `Bearer ${source.adminToken}` } : undefined;
}

/** The editor's own store, as a source alongside the running backends. */
const LOCAL_SOURCE_ID = 'local';
const LOCAL_SOURCE_NAME = 'Editor';

/**
 * Record which source served a row. Two backends running the same-named
 * function produce records that are identical apart from where they came from,
 * so the panel needs to be able to say. Written under `metadata` (an existing
 * open field) rather than as new top-level columns, and deliberately NOT
 * overwriting the backend's own `metadata.backendId` — that is what the backend
 * called itself; this is which source answered.
 */
function stampSource<T extends WorkflowExecution>(row: T, sourceId: string, sourceName: string): T {
  return { ...row, metadata: { ...(row.metadata || {}), sourceId, sourceName } };
}

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

  private async fetchRemoteList(
    source: RemoteExecutionSource,
    query: ExecutionQuery
  ): Promise<{ rows: WorkflowExecution[]; reachable: boolean; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (query.workflowId) params.set('workflowId', query.workflowId);
      if (query.status) params.set('status', query.status);
      if (query.triggerType) params.set('triggerType', query.triggerType);
      if (query.limit !== undefined) params.set('limit', String(query.limit));
      const res = await fetch(`${source.endpoint}/executions?${params}`, {
        headers: authHeaders(source),
        signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS)
      });
      if (!res.ok) return { rows: [], reachable: false, error: `HTTP ${res.status}` };
      const rows = (await res.json()) as WorkflowExecution[];
      return { rows: rows.map((row) => stampSource(row, source.id, source.name)), reachable: true };
    } catch (e) {
      // A briefly-unreachable backend must not break the whole panel; its
      // entries just don't appear until the next refresh — but it is REPORTED
      // (WFA-002), because "one backend is unreachable" and "no history" are
      // different things and used to look identical.
      return { rows: [], reachable: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async fetchRemoteGet(source: RemoteExecutionSource, executionId: string): Promise<ExecutionWithSteps | null> {
    try {
      const res = await fetch(`${source.endpoint}/executions/${encodeURIComponent(executionId)}`, {
        headers: authHeaders(source),
        signal: AbortSignal.timeout(REMOTE_FETCH_TIMEOUT_MS)
      });
      if (!res.ok) return null;
      const row = (await res.json()) as ExecutionWithSteps;
      return stampSource(row, source.id, source.name);
    } catch {
      return null;
    }
  }

  /**
   * Local list merged with every running backend's store, newest-first,
   * re-limited — plus which sources answered (WFA-002).
   */
  async listMerged(query: ExecutionQuery): Promise<ExecutionListResult> {
    const remotes = this.remoteSources ? this.remoteSources() : [];
    const sources: ExecutionSourceStatus[] = [];

    let rows: WorkflowExecution[] = [];

    if (this.store) {
      const local = this.list(query);
      const localRows = Array.isArray(local)
        ? local.map((row) => stampSource(row, LOCAL_SOURCE_ID, LOCAL_SOURCE_NAME))
        : [];
      rows = rows.concat(localRows);
      sources.push({
        id: LOCAL_SOURCE_ID,
        name: LOCAL_SOURCE_NAME,
        kind: 'local',
        reachable: Array.isArray(local),
        count: localRows.length,
        ...(Array.isArray(local) ? {} : { error: local.error })
      });
    } else {
      sources.push({
        id: LOCAL_SOURCE_ID,
        name: LOCAL_SOURCE_NAME,
        kind: 'local',
        reachable: false,
        count: 0,
        error: this.unavailableMessage()
      });
    }

    const fetched = await Promise.all(remotes.map((s) => this.fetchRemoteList(s, query)));
    remotes.forEach((source, i) => {
      const { rows: remoteRows, reachable, error } = fetched[i];
      rows = rows.concat(remoteRows);
      sources.push({
        id: source.id,
        name: source.name,
        kind: 'backend',
        reachable,
        count: remoteRows.length,
        ...(error ? { error } : {})
      });
    });

    if (!this.store && remotes.length === 0) {
      // Nothing local AND nothing to merge — keep the original honest error.
      return { executions: [], sources, error: this.unavailableMessage() };
    }

    const merged = rows.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    const limit = query.limit ?? 100;
    return { executions: merged.slice(0, limit), sources };
  }

  /** Local store first, then each running backend. */
  async getMerged(executionId: string): Promise<GetResult> {
    if (this.store) {
      const local = this.get(executionId);
      if (local && !('error' in (local as object))) {
        return stampSource(local as ExecutionWithSteps, LOCAL_SOURCE_ID, LOCAL_SOURCE_NAME);
      }
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
