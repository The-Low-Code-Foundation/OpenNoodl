/**
 * WF-006: correctness test for the in-memory fallback engine.
 *
 * Unlike execution-history.test.ts's ad hoc `MockDatabase` (which special-
 * cases just enough SQL shapes to make its own assertions pass),
 * `InMemorySqliteFallback` is meant to be a real, generically-correct stand-in
 * for `ExecutionStore`'s fixed SQL grammar — it's what real users get when
 * `node:sqlite` isn't available. This test runs the same store operations a
 * production `ExecutionStore` performs and checks the results, not just that
 * nothing threw.
 */
import { ExecutionStore } from '@noodl-viewer-cloud/execution-history';

import { InMemorySqliteFallback } from '../../src/main/src/execution-history/InMemorySqliteFallback';

describe('InMemorySqliteFallback (via a real ExecutionStore)', () => {
  let db: InMemorySqliteFallback;
  let store: ExecutionStore;

  beforeEach(() => {
    db = new InMemorySqliteFallback();
    store = new ExecutionStore(db);
  });

  it('creates an execution and reads it back with all fields intact', () => {
    const now = Date.now();
    const id = store.createExecution({
      workflowId: 'wf-1',
      workflowName: 'My Function',
      triggerType: 'webhook',
      triggerData: { path: '/functions/myFunc' },
      status: 'running',
      startedAt: now,
      metadata: { backendId: 'backend_1' }
    });

    expect(id).toMatch(/^exec_/);

    const exec = store.getExecution(id);
    expect(exec).not.toBeNull();
    expect(exec?.workflowId).toBe('wf-1');
    expect(exec?.workflowName).toBe('My Function');
    expect(exec?.triggerType).toBe('webhook');
    expect(exec?.status).toBe('running');
    expect(exec?.startedAt).toBe(now);
    expect(exec?.triggerData).toEqual({ path: '/functions/myFunc' });
    expect(exec?.metadata).toEqual({ backendId: 'backend_1' });
  });

  it('updates only the fields passed, leaving the rest untouched', () => {
    const id = store.createExecution({
      workflowId: 'wf-2',
      workflowName: 'Update Me',
      triggerType: 'manual',
      status: 'running',
      startedAt: Date.now()
    });

    store.updateExecution(id, { status: 'success', completedAt: 12345, durationMs: 42 });

    const exec = store.getExecution(id);
    expect(exec?.status).toBe('success');
    expect(exec?.completedAt).toBe(12345);
    expect(exec?.durationMs).toBe(42);
    expect(exec?.workflowName).toBe('Update Me'); // untouched
  });

  it('records an error message and stack on a failed execution', () => {
    const id = store.createExecution({
      workflowId: 'wf-err',
      workflowName: 'Fails',
      triggerType: 'webhook',
      status: 'running',
      startedAt: Date.now()
    });

    store.updateExecution(id, {
      status: 'error',
      completedAt: Date.now(),
      errorMessage: 'boom',
      errorStack: 'Error: boom\n    at somewhere'
    });

    const exec = store.getExecution(id);
    expect(exec?.status).toBe('error');
    expect(exec?.errorMessage).toBe('boom');
    expect(exec?.errorStack).toContain('at somewhere');
  });

  it('adds steps and returns them in step order', () => {
    const execId = store.createExecution({
      workflowId: 'wf-steps',
      workflowName: 'Steps',
      triggerType: 'manual',
      status: 'running',
      startedAt: Date.now()
    });

    store.addStep({
      executionId: execId,
      nodeId: 'node-2',
      nodeType: 'type-b',
      stepIndex: 1,
      startedAt: Date.now(),
      status: 'success'
    });
    store.addStep({
      executionId: execId,
      nodeId: 'node-1',
      nodeType: 'type-a',
      stepIndex: 0,
      startedAt: Date.now(),
      status: 'success'
    });

    const steps = store.getStepsForExecution(execId);
    expect(steps.map((s) => s.nodeId)).toEqual(['node-1', 'node-2']);
  });

  it('getExecutionWithSteps returns the execution plus its steps, or null', () => {
    const execId = store.createExecution({
      workflowId: 'wf-with-steps',
      workflowName: 'With Steps',
      triggerType: 'manual',
      status: 'running',
      startedAt: Date.now()
    });
    store.addStep({
      executionId: execId,
      nodeId: 'node-1',
      nodeType: 'type-a',
      stepIndex: 0,
      startedAt: Date.now(),
      status: 'success'
    });

    const withSteps = store.getExecutionWithSteps(execId);
    expect(withSteps?.id).toBe(execId);
    expect(withSteps?.steps).toHaveLength(1);

    expect(store.getExecutionWithSteps('does-not-exist')).toBeNull();
  });

  describe('queryExecutions', () => {
    beforeEach(() => {
      store.createExecution({
        workflowId: 'wf-a',
        workflowName: 'A',
        triggerType: 'webhook',
        status: 'success',
        startedAt: 1000
      });
      store.createExecution({
        workflowId: 'wf-a',
        workflowName: 'A',
        triggerType: 'webhook',
        status: 'error',
        startedAt: 2000
      });
      store.createExecution({
        workflowId: 'wf-b',
        workflowName: 'B',
        triggerType: 'manual',
        status: 'success',
        startedAt: 3000
      });
    });

    it('returns everything, newest first, by default', () => {
      const results = store.queryExecutions();
      expect(results).toHaveLength(3);
      expect(results.map((r) => r.startedAt)).toEqual([3000, 2000, 1000]);
    });

    it('filters by workflowId', () => {
      const results = store.queryExecutions({ workflowId: 'wf-a' });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.workflowId === 'wf-a')).toBe(true);
    });

    it('filters by status', () => {
      const results = store.queryExecutions({ status: 'error' });
      expect(results).toHaveLength(1);
      expect(results[0].workflowId).toBe('wf-a');
    });

    it('filters by a startedAfter/startedBefore range', () => {
      const results = store.queryExecutions({ startedAfter: 1500, startedBefore: 2500 });
      expect(results).toHaveLength(1);
      expect(results[0].startedAt).toBe(2000);
    });

    it('respects limit and offset', () => {
      const page1 = store.queryExecutions({ limit: 2, offset: 0 });
      const page2 = store.queryExecutions({ limit: 2, offset: 2 });
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(1);
      expect([...page1, ...page2].map((r) => r.startedAt)).toEqual([3000, 2000, 1000]);
    });

    it('orders ascending when asked', () => {
      const results = store.queryExecutions({ orderBy: 'started_at', orderDir: 'asc' });
      expect(results.map((r) => r.startedAt)).toEqual([1000, 2000, 3000]);
    });
  });

  it('deleteExecution cascades to its steps', () => {
    const execId = store.createExecution({
      workflowId: 'wf-cascade',
      workflowName: 'Cascade',
      triggerType: 'manual',
      status: 'success',
      startedAt: Date.now()
    });
    store.addStep({
      executionId: execId,
      nodeId: 'node-1',
      nodeType: 'type-a',
      stepIndex: 0,
      startedAt: Date.now(),
      status: 'success'
    });

    expect(db._debugCounts()).toEqual({ executions: 1, steps: 1 });

    store.deleteExecution(execId);

    expect(db._debugCounts()).toEqual({ executions: 0, steps: 0 });
    expect(store.getExecution(execId)).toBeNull();
  });

  it('getStats aggregates counts and durations correctly', () => {
    const id1 = store.createExecution({
      workflowId: 'wf-stats',
      workflowName: 'Stats',
      triggerType: 'manual',
      status: 'success',
      startedAt: 1000
    });
    store.updateExecution(id1, { durationMs: 100 });

    const id2 = store.createExecution({
      workflowId: 'wf-stats',
      workflowName: 'Stats',
      triggerType: 'manual',
      status: 'error',
      startedAt: 2000
    });
    store.updateExecution(id2, { durationMs: 300 });

    const stats = store.getStats();
    expect(stats.totalExecutions).toBe(2);
    expect(stats.successCount).toBe(1);
    expect(stats.errorCount).toBe(1);
    expect(stats.avgDurationMs).toBe(200);
    expect(stats.minDurationMs).toBe(100);
    expect(stats.maxDurationMs).toBe(300);
  });
});
