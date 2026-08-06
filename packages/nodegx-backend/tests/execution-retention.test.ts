/**
 * CWF-013's loose end: nothing trimmed `executions.sqlite`.
 *
 * `ExecutionLogger.runRetentionCleanup()` and `ExecutionStore.cleanupByAge()`
 * were both fully implemented in the shared cloud substrate and neither had a
 * single production caller anywhere in the repo — the whole retention feature
 * was reachable only from its own unit tests. A backend that ran a function
 * every minute kept every record and every step of every run for the life of
 * the data dir, which is the reason CWF-013 capped a single run's Log lines at
 * 200 rather than trust the table.
 *
 * What is asserted here is the trim itself, at real ages against real
 * retention: an old run goes, a recent one stays, the old run's STEPS go with
 * it (the schema's `ON DELETE CASCADE` is only worth anything if the connection
 * actually enforces foreign keys — node:sqlite does, and this proves it rather
 * than assuming it), and `retentionDays: 0` means keep forever.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { ExecutionStore as CloudExecutionStore } from '@cloud-runtime/execution-history/store';
import { BackendService } from '../src/service';
import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { defaultOpsConfig, mergeOpsConfig, validateOpsConfig } from '../src/ops/model';

jest.setTimeout(30000);

const DAY = 86_400_000;

describe('CWF-013 execution history is actually trimmed', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-exec-retention-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  /** Open a history with a fixed retention and hand back its underlying store. */
  function openHistory(retentionDays: number): { history: ExecutionHistory; store: CloudExecutionStore } {
    const history = new ExecutionHistory();
    const status = history.open(dataDir, { getRetentionDays: () => retentionDays });
    if (!status.enabled) throw new Error(`execution history did not open: ${status.error}`);
    const logger = history.createLogger();
    if (!logger) throw new Error('createLogger returned null on an enabled history');
    return { history, store: logger.getStore() };
  }

  /** One finished run, aged `ageMs` in the past, with one step. */
  function seedRun(store: CloudExecutionStore, workflowId: string, ageMs: number): string {
    const startedAt = Date.now() - ageMs;
    const id = store.createExecution({
      workflowId,
      workflowName: workflowId,
      triggerType: 'manual',
      status: 'success',
      startedAt,
      completedAt: startedAt + 5,
      durationMs: 5
    });
    store.addStep({
      executionId: id,
      nodeId: 'n1',
      nodeType: 'noodl.cloud.response',
      stepIndex: 0,
      startedAt,
      completedAt: startedAt + 5,
      status: 'success'
    });
    return id;
  }

  it('deletes runs older than the retention window and keeps recent ones', () => {
    const { history, store } = openHistory(30);
    const old = seedRun(store, 'ancient', 40 * DAY);
    const recent = seedRun(store, 'recent', 2 * DAY);

    expect(history.prune()).toBe(1);

    expect(store.getExecution(old)).toBeNull();
    expect(store.getExecution(recent)).not.toBeNull();
  });

  it('takes the deleted run\'s steps with it (the cascade is enforced, not merely declared)', () => {
    const { history, store } = openHistory(30);
    const old = seedRun(store, 'ancient', 40 * DAY);
    expect(store.getStepsForExecution(old)).toHaveLength(1);

    history.prune();

    // ⚠️ The steps are the bulk of this table — a run's Log lines, its inputs
    // and its outputs all live here. Deleting the parent row and orphaning
    // these would have been a retention policy that trimmed almost nothing.
    expect(store.getStepsForExecution(old)).toHaveLength(0);
  });

  it('keeps everything forever at retentionDays 0', () => {
    const { history, store } = openHistory(0);
    const old = seedRun(store, 'ancient', 4000 * DAY);

    expect(history.prune()).toBe(0);
    expect(store.getExecution(old)).not.toBeNull();
  });

  it('keeps everything when nothing tells it a retention (an embedder that never opted in)', () => {
    const history = new ExecutionHistory();
    history.open(dataDir);
    const logger = history.createLogger();
    if (!logger) throw new Error('createLogger returned null');
    const old = seedRun(logger.getStore(), 'ancient', 4000 * DAY);

    expect(history.prune()).toBe(0);
    expect(logger.getStore().getExecution(old)).not.toBeNull();
  });

  it('is driven by writes, at most hourly — never by a timer this service would have to clear', () => {
    // Seed through a history whose retention is off, so the seeding itself
    // sweeps nothing, then bring up a second one that does have a retention.
    const seeder = openHistory(0);
    seedRun(seeder.store, 'ancient', 40 * DAY);

    const live = new ExecutionHistory();
    live.open(dataDir, { getRetentionDays: () => 30 });
    expect(seeder.store.queryExecutions({ limit: 50 })).toHaveLength(1);

    // Creating a logger IS the write — every execution record on this backend
    // is born there, which is why the sweep hangs off it.
    expect(live.createLogger()).not.toBeNull();
    expect(seeder.store.queryExecutions({ limit: 50 })).toHaveLength(0);

    // ...and the next run, seconds later, must NOT sweep again: a DELETE on
    // every function call is not a retention policy, it is a tax.
    const second = seedRun(seeder.store, 'also-ancient', 40 * DAY);
    expect(live.createLogger()).not.toBeNull();
    expect(seeder.store.getExecution(second)).not.toBeNull();
  });

  // ==========================================================================
  // The knob
  // ==========================================================================

  it('defaults to 30 days and is an ops.json field like every other retention', () => {
    expect(defaultOpsConfig().executions.retentionDays).toBe(30);
    expect(validateOpsConfig({ version: 1, executions: { retentionDays: 7 } })).toEqual([]);
    expect(validateOpsConfig({ version: 1, executions: { retentionDays: -1 } })).toEqual([
      'executions.retentionDays must be a number >= 0 (0 = keep forever)'
    ]);
    expect(validateOpsConfig({ version: 1, executions: { days: 7 } })).toContain('unknown key "days" in executions');
    // An ops.json written before this field existed still loads, with the default.
    expect(mergeOpsConfig({ version: 1, audit: { retentionDays: 5 } }).executions.retentionDays).toBe(30);
  });

  it('prunes once at service start, so a backend stopped for a year comes back trimmed', async () => {
    // Seed the history file the service is about to open, then start the
    // service and let its own startup sweep find it.
    const seeded = openHistory(30);
    const old = seedRun(seeded.store, 'ancient', 400 * DAY);
    const recent = seedRun(seeded.store, 'recent', 1 * DAY);

    fs.writeFileSync(
      path.join(dataDir, 'ops.json'),
      JSON.stringify(mergeOpsConfig({ version: 1, executions: { retentionDays: 30 } }))
    );
    const service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'exec_retention',
      backendName: 'Retention Test'
    });
    await service.start();
    try {
      expect(seeded.store.getExecution(old)).toBeNull();
      expect(seeded.store.getExecution(recent)).not.toBeNull();
    } finally {
      await service.stop();
    }
  });
});
