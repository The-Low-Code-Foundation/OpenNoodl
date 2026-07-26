/**
 * WF-001 engine semantics suite — the tests that back every claim in
 * WF-001-SEMANTICS.md, section by section: ORDERING, ERROR ROUTING,
 * CANCELLATION, TIMEOUTS, DURABILITY (interrupted recovery), CONCURRENCY.
 *
 * The engine is exercised in ISOLATION with a deterministic mock StepExecutor
 * over a real ExecutionHistory (node:sqlite), so the semantics are proven
 * without CloudRunner. The FunctionStepExecutor + real functions are covered by
 * workflow-http.test.ts.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { WorkflowEngine, validateWorkflowDefinition } from '../src/workflow/WorkflowEngine';
import type { StepExecutor, StepExecContext } from '../src/workflow/StepExecutor';
import type { WorkflowDefinition, WorkflowStep } from '../src/workflow/types';

jest.setTimeout(15000);

// ---- helpers ---------------------------------------------------------------

type Behavior = (ctx: StepExecContext) => Promise<Record<string, unknown>>;

class MockExecutor implements StepExecutor {
  calls: string[] = [];
  behaviors: Record<string, Behavior> = {};
  async execute(ctx: StepExecContext): Promise<Record<string, unknown>> {
    this.calls.push(ctx.step.id);
    const b = this.behaviors[ctx.step.id];
    if (b) return b(ctx);
    return { ok: true, step: ctx.step.id };
  }
}

function step(id: string, extra: Partial<WorkflowStep> = {}): WorkflowStep {
  return { id, kind: 'call-function', ref: `fn_${id}`, ...extra };
}

function def(steps: WorkflowStep[], entry: string, extra: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    version: 1,
    id: 'wf_test',
    name: 'Test',
    entry,
    concurrency: 1,
    steps,
    createdAt: '2026-07-26T00:00:00.000Z',
    updatedAt: '2026-07-26T00:00:00.000Z',
    ...extra
  };
}

function makeEngine(): { engine: WorkflowEngine; exec: MockExecutor; history: ExecutionHistory; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf001-engine-'));
  const history = new ExecutionHistory();
  const status = history.open(dir);
  expect(status.enabled).toBe(true);
  const exec = new MockExecutor();
  const engine = new WorkflowEngine({ executions: history, executor: exec, backendId: 'b1', backendName: 'B1' });
  return { engine, exec, history, dir };
}

function stepsOf(history: ExecutionHistory, executionId: string): { nodeId: string; status: string }[] {
  const rec = history.get(executionId) as { steps: { nodeId: string; status: string; stepIndex: number }[] };
  return [...rec.steps].sort((a, b) => a.stepIndex - b.stepIndex).map((s) => ({ nodeId: s.nodeId, status: s.status }));
}

// ---- ORDERING --------------------------------------------------------------

describe('WF-001 ordering', () => {
  it('runs a linear chain in dependency order and records each step', async () => {
    const { engine, exec, history, dir } = makeEngine();
    try {
      const d = def([step('a', { next: ['b'] }), step('b', { next: ['c'] }), step('c')], 'a');
      const res = await engine.run(d, { trigger: { type: 'manual' } });
      expect(exec.calls).toEqual(['a', 'b', 'c']);
      expect(res.status).toBe('success');
      expect(res.stepsRun).toBe(3);
      expect(stepsOf(history, res.executionId)).toEqual([
        { nodeId: 'a', status: 'success' },
        { nodeId: 'b', status: 'success' },
        { nodeId: 'c', status: 'success' }
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes the upstream step output to the next step as `previous`', async () => {
    const { engine, exec, history, dir } = makeEngine();
    try {
      exec.behaviors['a'] = async () => ({ token: 'xyz' });
      let seen: unknown;
      exec.behaviors['b'] = async (ctx) => {
        seen = ctx.input.previous;
        return { done: true };
      };
      const d = def([step('a', { next: ['b'] }), step('b')], 'a');
      await engine.run(d, { trigger: { type: 'manual' }, payload: { start: 1 } });
      expect(seen).toEqual({ token: 'xyz' });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips a branch whose incoming edge was not taken', async () => {
    const { engine, exec, history, dir } = makeEngine();
    try {
      // entry a → on success b; on error err. Success path must skip err.
      const d = def([step('a', { next: ['b'], onError: ['err'] }), step('b'), step('err')], 'a');
      const res = await engine.run(d, { trigger: { type: 'manual' } });
      expect(exec.calls).toEqual(['a', 'b']);
      expect(res.stepsSkipped).toBe(1);
      const steps = stepsOf(history, res.executionId);
      expect(steps.find((s) => s.nodeId === 'err')!.status).toBe('skipped');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- ERROR ROUTING ---------------------------------------------------------

describe('WF-001 error routing', () => {
  it('routes a failure along onError and the workflow can still succeed', async () => {
    const { engine, exec, history, dir } = makeEngine();
    try {
      exec.behaviors['a'] = async () => {
        throw new Error('boom');
      };
      const d = def([step('a', { next: ['ok'], onError: ['handler'] }), step('ok'), step('handler')], 'a');
      const res = await engine.run(d, { trigger: { type: 'manual' } });
      expect(exec.calls).toEqual(['a', 'handler']);
      expect(res.status).toBe('success');
      expect(res.unroutedError).toBe(false);
      const steps = stepsOf(history, res.executionId);
      expect(steps.find((s) => s.nodeId === 'a')!.status).toBe('error'); // the failure is recorded loudly
      expect(steps.find((s) => s.nodeId === 'handler')!.status).toBe('success');
      expect(steps.find((s) => s.nodeId === 'ok')!.status).toBe('skipped'); // success edge not taken
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('halts the workflow cleanly on an UNROUTED failure and records it failed', async () => {
    const { engine, exec, history, dir } = makeEngine();
    try {
      exec.behaviors['b'] = async () => {
        throw new Error('kaboom');
      };
      const d = def([step('a', { next: ['b'] }), step('b', { next: ['c'] }), step('c')], 'a');
      const res = await engine.run(d, { trigger: { type: 'manual' } });
      expect(exec.calls).toEqual(['a', 'b']); // c never runs
      expect(res.status).toBe('error');
      expect(res.unroutedError).toBe(true);
      const rec = history.get(res.executionId) as { status: string; metadata: Record<string, unknown> };
      expect(rec.status).toBe('error');
      expect(rec.metadata.unroutedError).toBe(true);
      const steps = stepsOf(history, res.executionId);
      expect(steps.find((s) => s.nodeId === 'b')!.status).toBe('error');
      expect(steps.find((s) => s.nodeId === 'c')!.status).toBe('skipped');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- TIMEOUTS --------------------------------------------------------------

describe('WF-001 timeouts', () => {
  it('enforces a per-step timeout and treats the timeout as a step failure', async () => {
    const { engine, exec, history, dir } = makeEngine();
    try {
      exec.behaviors['slow'] = () => new Promise(() => {}); // never resolves
      const d = def([step('slow', { timeoutMs: 60, onError: ['recover'] }), step('recover')], 'slow');
      const res = await engine.run(d, { trigger: { type: 'manual' } });
      expect(res.status).toBe('success'); // routed to recover
      const steps = stepsOf(history, res.executionId);
      expect(steps.find((s) => s.nodeId === 'slow')!.status).toBe('error');
      const rec = history.get(res.executionId) as { steps: { nodeId: string; errorMessage?: string }[] };
      expect(rec.steps.find((s) => s.nodeId === 'slow')!.errorMessage).toMatch(/timed out/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('enforces a per-workflow timeout, aborting the run loudly', async () => {
    const { engine, exec, history, dir } = makeEngine();
    try {
      exec.behaviors['a'] = () => new Promise(() => {});
      const d = def([step('a')], 'a', { timeoutMs: 60 });
      const res = await engine.run(d, { trigger: { type: 'manual' } });
      expect(res.status).toBe('error');
      expect(res.timedOut).toBe(true);
      const rec = history.get(res.executionId) as { status: string; metadata: Record<string, unknown> };
      expect(rec.status).toBe('error');
      expect(rec.metadata.timedOut).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- CANCELLATION ----------------------------------------------------------

describe('WF-001 cancellation', () => {
  it('cancels an in-flight run promptly and records it cancelled with the tail skipped', async () => {
    const { engine, exec, history, dir } = makeEngine();
    try {
      let started = false;
      exec.behaviors['hang'] = () =>
        new Promise(() => {
          started = true;
        });
      const d = def([step('hang', { next: ['after'] }), step('after')], 'hang');
      const runPromise = engine.run(d, { trigger: { type: 'manual' } });

      // Wait for the run's record to exist, then cancel it by execution id
      // (exactly what the editor does from the running-executions list).
      let executionId = '';
      for (let i = 0; i < 100 && !executionId; i++) {
        const running = history.list({ status: 'running', limit: 10 }) as { id: string }[];
        if (running.length) executionId = running[0].id;
        else await new Promise((r) => setTimeout(r, 10));
      }
      expect(executionId).toBeTruthy();
      expect(started).toBe(true);
      expect(engine.cancel(executionId)).toBe(true);

      const res = await runPromise;
      expect(res.status).toBe('cancelled');
      const rec = history.get(res.executionId) as { status: string; metadata: Record<string, unknown> };
      expect(rec.metadata.cancelled).toBe(true);
      const steps = stepsOf(history, res.executionId);
      expect(steps.find((s) => s.nodeId === 'after')!.status).toBe('skipped');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('cancel() returns false for an unknown / finished run', async () => {
    const { engine, dir } = makeEngine();
    try {
      expect(engine.cancel('nope')).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- CONCURRENCY -----------------------------------------------------------

describe('WF-001 concurrency', () => {
  it('serializes runs beyond the per-workflow cap (cap=1 => no overlap)', async () => {
    const { engine, exec, dir } = makeEngine();
    try {
      let concurrent = 0;
      let maxConcurrent = 0;
      exec.behaviors['a'] = async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 40));
        concurrent--;
        return { ok: true };
      };
      const d = def([step('a')], 'a', { concurrency: 1 });
      await Promise.all([engine.run(d, { trigger: { type: 'manual' } }), engine.run(d, { trigger: { type: 'manual' } })]);
      expect(maxConcurrent).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('allows overlap up to the cap (cap=2 => two at once)', async () => {
    const { engine, exec, dir } = makeEngine();
    try {
      let concurrent = 0;
      let maxConcurrent = 0;
      exec.behaviors['a'] = async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 40));
        concurrent--;
        return { ok: true };
      };
      const d = def([step('a')], 'a', { concurrency: 2 });
      await Promise.all([
        engine.run(d, { trigger: { type: 'manual' } }),
        engine.run(d, { trigger: { type: 'manual' } }),
        engine.run(d, { trigger: { type: 'manual' } })
      ]);
      expect(maxConcurrent).toBe(2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- DURABILITY (interrupted recovery) -------------------------------------

describe('WF-001 durability / interrupted recovery', () => {
  it('marks executions left `running` at startup as failed+interrupted', async () => {
    const { engine, history, dir } = makeEngine();
    try {
      // Simulate a run that was in flight when the process died: a `running`
      // record with no completion.
      const logger = history.createLogger();
      const id = logger.startExecution({
        workflowId: 'wf_test',
        workflowName: 'Test',
        triggerType: 'manual',
        metadata: { kind: 'workflow', backendId: 'b1' }
      });
      // (never completed)
      const before = history.get(id) as { status: string };
      expect(before.status).toBe('running');

      const recovered = engine.recoverInterrupted();
      expect(recovered).toBe(1);
      const after = history.get(id) as { status: string; metadata: Record<string, unknown> };
      expect(after.status).toBe('error');
      expect(after.metadata.interrupted).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not touch another backend\'s in-flight records', async () => {
    const { engine, history, dir } = makeEngine();
    try {
      const logger = history.createLogger();
      const id = logger.startExecution({
        workflowId: 'wf_other',
        workflowName: 'Other',
        triggerType: 'manual',
        metadata: { kind: 'workflow', backendId: 'someone-else' }
      });
      expect(engine.recoverInterrupted()).toBe(0);
      const after = history.get(id) as { status: string };
      expect(after.status).toBe('running');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---- VALIDATION ------------------------------------------------------------

describe('WF-001 definition validation', () => {
  it('accepts a valid DAG', () => {
    expect(validateWorkflowDefinition(def([step('a', { next: ['b'] }), step('b')], 'a'))).toEqual([]);
  });
  it('rejects a cycle', () => {
    const d = def([step('a', { next: ['b'] }), step('b', { next: ['a'] })], 'a');
    expect(validateWorkflowDefinition(d).some((e) => /cycle/.test(e))).toBe(true);
  });
  it('rejects a dangling edge target', () => {
    const d = def([step('a', { next: ['ghost'] })], 'a');
    expect(validateWorkflowDefinition(d).some((e) => /does not exist/.test(e))).toBe(true);
  });
  it('rejects an entry that is not a step', () => {
    const d = def([step('a')], 'missing');
    expect(validateWorkflowDefinition(d).some((e) => /entry/.test(e))).toBe(true);
  });
});
