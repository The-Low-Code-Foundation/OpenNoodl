/**
 * Execution history for the standalone service (WF-004 second half, on the
 * WF-006 substrate).
 *
 * The store/logger classes are the same ones WF-006 shipped in
 * `noodl-viewer-cloud/src/execution-history` — bundled into this service by
 * the esbuild step (`@cloud-runtime` alias), so the editor and the service
 * agree on schema and record shapes by construction. Each service process
 * (one backend) owns `<dataDir>/executions.sqlite`; the editor reads it over
 * HTTP (`/executions`, `/executions/:id`), never by opening the file.
 *
 * `node:sqlite` is effectively guaranteed here (`engines.node >= 22.13`), but
 * if it is somehow unavailable the history is DISABLED with a loud status —
 * a missing history entry must never block a real function execution
 * (WF-006 policy), and we do not silently fall back to memory.
 *
 * @module nodegx-backend/execution/ExecutionStore
 */

import * as fs from 'fs';
import * as path from 'path';

// Bundled from noodl-viewer-cloud/src/execution-history by esbuild
// (test-time: jest moduleNameMapper). Untyped on purpose — the classes carry
// their own types where they live; this package treats them as a black box.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const executionHistory = require('@cloud-runtime/execution-history');

export interface ExecutionHistoryStatus {
  enabled: boolean;
  dbPath: string | null;
  error: string | null;
}

export interface ExecutionListQuery {
  workflowId?: string;
  status?: string;
  triggerType?: string;
  limit?: number;
  offset?: number;
  startedAfter?: number;
  startedBefore?: number;
}

export class ExecutionHistory {
  private store: unknown | null = null;
  private status: ExecutionHistoryStatus = { enabled: false, dbPath: null, error: null };

  /** Open (or create) `<dataDir>/executions.sqlite` and init the schema. */
  open(dataDir: string): ExecutionHistoryStatus {
    const dbPath = path.join(dataDir, 'executions.sqlite');
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath);
      const store = new executionHistory.ExecutionStore(db);
      store.initSchema();
      this.store = store;
      this.status = { enabled: true, dbPath, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.store = null;
      this.status = { enabled: false, dbPath, error: message };
    }
    return this.status;
  }

  getStatus(): ExecutionHistoryStatus {
    return this.status;
  }

  /**
   * A fresh logger per execution (WF-006: `ExecutionLogger` keeps
   * single-execution state, so sharing one across concurrent calls would
   * clobber in-flight state). Null when history is disabled.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createLogger(): any | null {
    if (!this.store) return null;
    return new executionHistory.ExecutionLogger(this.store);
  }

  list(query: ExecutionListQuery): unknown[] {
    if (!this.store) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.store as any).queryExecutions({
      workflowId: query.workflowId,
      status: query.status,
      triggerType: query.triggerType,
      limit: query.limit,
      offset: query.offset,
      startedAfter: query.startedAfter,
      startedBefore: query.startedBefore
    });
  }

  get(executionId: string): unknown | null {
    if (!this.store) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.store as any).getExecutionWithSteps(executionId);
  }

  /**
   * Mark an execution failed+interrupted (WF-001 durability recovery). A record
   * left `running` at service start means the run did not survive the restart;
   * this is how it becomes a LOUD failure instead of a phantom "running forever"
   * — never a silent half-run.
   */
  markInterrupted(executionId: string, message: string): void {
    if (!this.store || !executionId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = this.store as any;
    const existing = store.getExecution(executionId) as { metadata?: Record<string, unknown> } | null;
    const now = Date.now();
    store.updateExecution(executionId, {
      status: 'error',
      completedAt: now,
      errorMessage: message,
      metadata: { ...(existing?.metadata || {}), interrupted: true }
    });
  }

  /**
   * Merge extra fields into an execution's metadata WITHOUT changing its status
   * (WF-001 uses it to stamp the precise engine disposition — cancelled vs
   * timeout vs unrouted-halt — that the store's success|error status alone can't
   * express). No-op when history is disabled.
   */
  stampMetadata(executionId: string, patch: Record<string, unknown>): void {
    if (!this.store || !executionId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = this.store as any;
    const existing = store.getExecution(executionId) as { metadata?: Record<string, unknown> } | null;
    store.updateExecution(executionId, { metadata: { ...(existing?.metadata || {}), ...patch } });
  }
}
