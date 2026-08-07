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

import { logger } from '../ops/logger';
import type { SqlDatabase } from './IdempotencyStore';

// Bundled from noodl-viewer-cloud/src/execution-history by esbuild (test-time:
// jest moduleNameMapper), so the CONSTRUCTION stays a runtime `require` — this
// package must not pull the cloud runtime into its own module graph.
//
// The TYPES, however, are right there and were being thrown away: until
// PLAT-004 this facade held `store: unknown` and cast `as any` at all five call
// sites, and `list()`/`get()` handed `unknown` on to the HTTP routes and the
// specs, which cast again. The classes do carry their own types where they
// live — which is an argument for importing them, not for re-deriving them.
// `import type` is erased at compile time, so the runtime black box is intact
// and the field names are now checked on both sides.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const executionHistory = require('@cloud-runtime/execution-history');

import type { ExecutionLogger as CloudExecutionLogger } from '@cloud-runtime/execution-history/ExecutionLogger';
import type { ExecutionStore as CloudExecutionStore } from '@cloud-runtime/execution-history/store';
import type {
  ExecutionWithSteps,
  WorkflowExecution
} from '@cloud-runtime/execution-history/types';

export type { ExecutionWithSteps, WorkflowExecution };

export interface ExecutionHistoryStatus {
  enabled: boolean;
  dbPath: string | null;
  error: string | null;
}

export interface ExecutionHistoryOpenOptions {
  /**
   * Live retention window, read on every prune so `PUT /admin/ops` takes effect
   * without a restart — same late-binding as `AuditLog`'s `getConfig`.
   * Omitted (older embedders, specs that only read) = keep forever.
   */
  getRetentionDays?: () => number;
}

/** How often a write may trigger a prune. Matches `AuditLog`'s hourly floor. */
const PRUNE_INTERVAL_MS = 3_600_000;

export interface ExecutionListQuery {
  workflowId?: string;
  status?: string;
  triggerType?: string;
  limit?: number;
  offset?: number;
  startedAfter?: number;
  startedBefore?: number;
}

/** A retention pass some other table rides on this one's clock. See `registerSweep`. */
interface RegisteredSweep {
  name: string;
  run: () => number;
}

export class ExecutionHistory {
  private store: CloudExecutionStore | null = null;
  private db: SqlDatabase | null = null;
  private status: ExecutionHistoryStatus = { enabled: false, dbPath: null, error: null };
  private getRetentionDays: (() => number) | null = null;
  private lastPrune = 0;
  private sweeps: RegisteredSweep[] = [];

  /** Open (or create) `<dataDir>/executions.sqlite` and init the schema. */
  open(dataDir: string, options: ExecutionHistoryOpenOptions = {}): ExecutionHistoryStatus {
    this.getRetentionDays = options.getRetentionDays || null;
    const dbPath = path.join(dataDir, 'executions.sqlite');
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath);
      const store = new executionHistory.ExecutionStore(db);
      store.initSchema();
      this.store = store;
      this.db = db as SqlDatabase;
      this.status = { enabled: true, dbPath, error: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.store = null;
      this.db = null;
      this.status = { enabled: false, dbPath, error: message };
    }
    return this.status;
  }

  getStatus(): ExecutionHistoryStatus {
    return this.status;
  }

  /**
   * The open handle, for a table that lives beside the execution history in the
   * same file (CWF-016's idempotency keys).
   *
   * One file and ONE connection is the point: a second `DatabaseSync` on the
   * same path is a second writer contending for a lock nobody has a plan for,
   * and a second file is a second thing to back up and to forget to back up.
   * `null` when history is disabled — which is the honest answer, because a
   * table needs the same sqlite the history needed.
   */
  getDatabase(): SqlDatabase | null {
    return this.db;
  }

  /**
   * Ride this store's retention clock.
   *
   * The alternative was a fourth timer, and `maybePrune`'s note below is the
   * whole argument against one. A sweep registered here runs on the same
   * write-driven hourly pass, is wrapped so a failure cannot take a function run
   * with it, and — unlike the execution cleanup — runs whatever
   * `executions.retentionDays` says, because `retentionDays: 0` means "keep
   * every execution forever" and must not be read as "keep every idempotency
   * key forever" too.
   */
  registerSweep(name: string, run: () => number): void {
    this.sweeps.push({ name, run });
  }

  /**
   * A fresh logger per execution (WF-006: `ExecutionLogger` keeps
   * single-execution state, so sharing one across concurrent calls would
   * clobber in-flight state). Null when history is disabled.
   */
  createLogger(): CloudExecutionLogger | null {
    if (!this.store) return null;
    // Every execution record on this backend is born here, so this is the one
    // place a write-driven prune can sit and be sure of seeing traffic.
    this.maybePrune();
    return new executionHistory.ExecutionLogger(this.store);
  }

  // ==========================================================================
  // Retention
  // ==========================================================================

  /**
   * Drop executions older than the retention window. Returns the number of
   * execution records deleted; their steps go with them via the schema's
   * `ON DELETE CASCADE` (node:sqlite enables foreign keys by default, which is
   * the reason this can be one DELETE rather than two).
   *
   * ⚠️ **Nothing trimmed this table until CWF-013's loose end was closed.**
   * `ExecutionLogger.runRetentionCleanup()` and `ExecutionStore.cleanupByAge()`
   * were both fully written in the shared cloud substrate and neither had a
   * production caller anywhere in the repo, so `executions.sqlite` grew without
   * bound for the life of a backend. This method is that caller. It reaches
   * `cleanupByAge` directly rather than through `runRetentionCleanup()` on
   * purpose: the logger's retention comes from its own per-instance config
   * default, and the number an operator actually edits lives in
   * `ops.json` — routing through a second, unset default would have been a
   * retention policy that quietly disagreed with the file.
   *
   * `retentionDays: 0` (or no retention callback at all) = keep forever.
   *
   * Deliberately takes no `now`: the cutoff is computed inside `cleanupByAge`
   * from its own clock, so a `now` parameter here would look like it moved the
   * window and would move nothing. `AuditLog.prune(now)` really does take one —
   * they are not the same shape, and pretending they were is how a spec ends up
   * asserting against a knob that is not connected.
   */
  prune(): number {
    this.lastPrune = Date.now();
    const removed = this.pruneExecutions();
    // Registered sweeps run whatever the execution retention says — see
    // `registerSweep`. Each is isolated so one broken table cannot stop another.
    for (const sweep of this.sweeps) {
      try {
        const swept = sweep.run();
        if (swept > 0) logger.info(`${sweep.name}.pruned`, { removed: swept });
      } catch (e) {
        logger.warn(`${sweep.name}.prune-failed`, { error: e instanceof Error ? e.message : String(e) });
      }
    }
    return removed;
  }

  private pruneExecutions(): number {
    if (!this.store || !this.getRetentionDays) return 0;
    try {
      // Inside the try on purpose: the callback reads live service state, and a
      // record written while the service is tearing down must not throw here.
      const retentionDays = this.getRetentionDays();
      if (!retentionDays || retentionDays <= 0) return 0;
      const removed = this.store.cleanupByAge(retentionDays * 86_400_000);
      if (removed > 0) logger.info('executions.pruned', { removed, retentionDays });
      return removed;
    } catch (e) {
      // A retention sweep that fails must never take a function run with it.
      logger.warn('executions.prune-failed', { error: e instanceof Error ? e.message : String(e) });
      return 0;
    }
  }

  /**
   * Prune at most hourly, driven by writes rather than a timer.
   *
   * This is `AuditLog.maybePrune`'s pattern, and it is deliberately the same
   * one: the service already runs a trigger scheduler, a backup scheduler and a
   * realtime heartbeat, and a fourth timer whose entire job is a once-a-day
   * DELETE would be a fourth thing to remember to clear at shutdown. There is a
   * live example of why that matters in this package — `server.close()` already
   * hangs on an open SSE stream — so a retention sweep that cannot possibly
   * hold the process open is worth more than a punctual one. The startup prune
   * covers the backend that is stopped for a year and comes back.
   */
  private maybePrune(): void {
    if (!this.getRetentionDays && this.sweeps.length === 0) return;
    if (Date.now() - this.lastPrune < PRUNE_INTERVAL_MS) return;
    this.prune();
  }

  list(query: ExecutionListQuery): WorkflowExecution[] {
    if (!this.store) return [];
    return this.store.queryExecutions({
      workflowId: query.workflowId,
      status: query.status as WorkflowExecution['status'] | undefined,
      triggerType: query.triggerType as WorkflowExecution['triggerType'] | undefined,
      limit: query.limit,
      offset: query.offset,
      startedAfter: query.startedAfter,
      startedBefore: query.startedBefore
    });
  }

  get(executionId: string): ExecutionWithSteps | null {
    if (!this.store) return null;
    return this.store.getExecutionWithSteps(executionId);
  }

  /**
   * Mark an execution failed+interrupted (WF-001 durability recovery). A record
   * left `running` at service start means the run did not survive the restart;
   * this is how it becomes a LOUD failure instead of a phantom "running forever"
   * — never a silent half-run.
   */
  markInterrupted(executionId: string, message: string): void {
    if (!this.store || !executionId) return;
    const store = this.store;
    const existing = store.getExecution(executionId);
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
    const store = this.store;
    const existing = store.getExecution(executionId);
    store.updateExecution(executionId, { metadata: { ...(existing?.metadata || {}), ...patch } });
  }
}
