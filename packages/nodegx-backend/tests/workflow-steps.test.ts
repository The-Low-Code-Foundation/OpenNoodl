/**
 * WF-002 Series-1 step kinds, run through the REAL WorkflowEngine and the REAL
 * CompositeStepExecutor over a real ExecutionHistory (node:sqlite).
 *
 * Only the cloud-function invocation is stubbed (a fake WorkflowRunner), so
 * everything WF-001 owns — topological ordering, edge taking, error routing,
 * skip recording, cancellation, timeouts, execution records — is exercised for
 * real. Unit-testing the executors in isolation would prove far less: the
 * interesting behaviour of a routing step IS which edges the engine then takes.
 *
 * The genuine end-to-end over CloudRunner and HTTP is workflow-steps-http.test.ts.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { WorkflowEngine, validateWorkflowDefinition } from '../src/workflow/WorkflowEngine';
import { CompositeStepExecutor } from '../src/workflow/steps/CompositeStepExecutor';
import type { WorkflowRunner } from '../src/workflow/WorkflowRunner';
import type { WorkflowDefinition, WorkflowStep } from '../src/workflow/types';

jest.setTimeout(20000);

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

type FunctionImpl = (input: Record<string, unknown>, callIndex: number) => unknown;

class FakeRunner {
  readonly calls: { name: string; input: Record<string, unknown> }[] = [];
  private readonly impls = new Map<string, FunctionImpl>();
  private readonly counts = new Map<string, number>();

  define(name: string, impl: FunctionImpl): this {
    this.impls.set(name, impl);
    return this;
  }

  hasFunction(name: string): boolean {
    return this.impls.has(name);
  }

  async invokeFunction(name: string, request: { body?: string }): Promise<{ statusCode: number; body: string }> {
    const input = JSON.parse(request.body || '{}') as Record<string, unknown>;
    this.calls.push({ name, input });
    const n = (this.counts.get(name) || 0) + 1;
    this.counts.set(name, n);
    const impl = this.impls.get(name);
    if (!impl) return { statusCode: 404, body: JSON.stringify({ error: 'no such function' }) };
    const result = impl(input, n);
    if (result instanceof Error) {
      const status = Number((result as Error & { statusCode?: number }).statusCode) || 500;
      return { statusCode: status, body: JSON.stringify({ error: result.message }) };
    }
    return { statusCode: 200, body: JSON.stringify(result ?? {}) };
  }
}

interface Harness {
  engine: WorkflowEngine;
  runner: FakeRunner;
  history: ExecutionHistory;
  dir: string;
}

const tempDirs: string[] = [];

function makeHarness(): Harness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf002-'));
  tempDirs.push(dir);
  const history = new ExecutionHistory();
  expect(history.open(dir).enabled).toBe(true);
  const runner = new FakeRunner();
  const executor = new CompositeStepExecutor({ getRunner: () => runner as unknown as WorkflowRunner });
  const engine = new WorkflowEngine({ executions: history, executor, backendId: 'b1', backendName: 'B1' });
  return { engine, runner, history, dir };
}

afterAll(() => {
  for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
});

function def(steps: WorkflowStep[], entry: string, extra: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  const d: WorkflowDefinition = {
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
  // Every fixture must be a definition the registry would actually accept —
  // otherwise a test could pass on a workflow no user could ever save.
  expect(validateWorkflowDefinition(d)).toEqual([]);
  return d;
}

function fn(id: string, ref: string, extra: Partial<WorkflowStep> = {}): WorkflowStep {
  return { id, kind: 'call-function', ref, ...extra };
}

function stepStatuses(history: ExecutionHistory, executionId: string): Record<string, string> {
  const rec = history.get(executionId) as { steps: { nodeId: string; status: string }[] };
  return Object.fromEntries(rec.steps.map((s) => [s.nodeId, s.status]));
}

// ---------------------------------------------------------------------------
// CF11-001 — branch
// ---------------------------------------------------------------------------

describe('WF-002 branch (CF11-001 IF)', () => {
  it('takes the ontrue route and records the onfalse branch skipped', async () => {
    const { engine, runner, history } = makeHarness();
    runner.define('yes', () => ({ went: 'true' })).define('no', () => ({ went: 'false' }));

    const d = def(
      [
        {
          id: 'gate',
          kind: 'branch',
          params: { condition: { left: { $path: 'total' }, op: 'gt', right: 100 } },
          routes: { ontrue: ['yes'], onfalse: ['no'] }
        },
        fn('yes', 'yes'),
        fn('no', 'no')
      ],
      'gate'
    );

    const res = await engine.run(d, { trigger: { type: 'manual' }, payload: { total: 120 } });
    expect(res.status).toBe('success');
    expect(runner.calls.map((c) => c.name)).toEqual(['yes']);
    expect(stepStatuses(history, res.executionId)).toEqual({ gate: 'success', yes: 'success', no: 'skipped' });
  });

  it('takes the onfalse route when the condition is false', async () => {
    const { engine, runner } = makeHarness();
    runner.define('yes', () => ({})).define('no', () => ({}));
    const d = def(
      [
        {
          id: 'gate',
          kind: 'branch',
          params: { condition: { left: { $path: 'previous.status' }, op: 'eq', right: 'paid' } },
          routes: { ontrue: ['yes'], onfalse: ['no'] }
        },
        fn('yes', 'yes'),
        fn('no', 'no')
      ],
      'gate'
    );
    const res = await engine.run(d, { trigger: { type: 'manual' }, payload: { previous: { status: 'void' } } });
    expect(res.status).toBe('success');
    expect(runner.calls.map((c) => c.name)).toEqual(['no']);
  });

  it('reports `result`/`isfalse` like the client Condition node', async () => {
    const { engine, runner } = makeHarness();
    runner.define('sink', (input) => ({ seen: input.previous }));
    const d = def(
      [
        {
          id: 'gate',
          kind: 'branch',
          params: { condition: { left: 1, op: 'eq', right: 1 } },
          routes: { ontrue: ['sink'] }
        },
        fn('sink', 'sink')
      ],
      'gate'
    );
    await engine.run(d, { trigger: { type: 'manual' } });
    expect(runner.calls[0].input.previous).toEqual({ result: true, isfalse: false });
  });

  it('an inevaluable condition is a LOUD step failure, routed like any other', async () => {
    const { engine, runner, history } = makeHarness();
    runner.define('handler', () => ({})).define('yes', () => ({}));
    const d = def(
      [
        {
          id: 'gate',
          kind: 'branch',
          // `missing` resolves to undefined, which cannot be ordered against 5.
          params: { condition: { left: { $path: 'missing' }, op: 'gt', right: 5 } },
          routes: { ontrue: ['yes'] },
          onError: ['handler']
        },
        fn('yes', 'yes'),
        fn('handler', 'handler')
      ],
      'gate'
    );
    const res = await engine.run(d, { trigger: { type: 'manual' } });
    expect(res.status).toBe('success'); // routed, so the run can still succeed
    expect(stepStatuses(history, res.executionId)).toEqual({
      gate: 'error',
      yes: 'skipped',
      handler: 'success'
    });
    expect((runner.calls[0].input.previous as { error: { message: string } }).error.message).toMatch(
      /Cannot order-compare/
    );
  });
});

// ---------------------------------------------------------------------------
// CF11-001 — switch
// ---------------------------------------------------------------------------

describe('WF-002 switch (CF11-001)', () => {
  const build = (cases: unknown[], routes: Record<string, string[]>): WorkflowStep => ({
    id: 'sw',
    kind: 'switch',
    params: { value: { $path: 'status' }, cases },
    routes
  });

  it('routes to the matching case label and skips the others', async () => {
    const { engine, runner, history } = makeHarness();
    runner.define('a', () => ({})).define('b', () => ({})).define('d', () => ({}));
    const d = def(
      [
        build(
          [
            { label: 'paid', equals: 'paid' },
            { label: 'refunded', equals: 'refunded' }
          ],
          { paid: ['a'], refunded: ['b'], default: ['d'] }
        ),
        fn('a', 'a'),
        fn('b', 'b'),
        fn('d', 'd')
      ],
      'sw'
    );
    const res = await engine.run(d, { trigger: { type: 'manual' }, payload: { status: 'refunded' } });
    expect(runner.calls.map((c) => c.name)).toEqual(['b']);
    expect(stepStatuses(history, res.executionId)).toEqual({ sw: 'success', a: 'skipped', b: 'success', d: 'skipped' });
  });

  it('falls through to `default` when nothing matches', async () => {
    const { engine, runner } = makeHarness();
    runner.define('a', () => ({})).define('d', () => ({}));
    const d = def([build([{ label: 'paid', equals: 'paid' }], { paid: ['a'], default: ['d'] }), fn('a', 'a'), fn('d', 'd')], 'sw');
    await engine.run(d, { trigger: { type: 'manual' }, payload: { status: 'void' } });
    expect(runner.calls.map((c) => c.name)).toEqual(['d']);
  });

  it('supports condition cases, first match winning', async () => {
    const { engine, runner } = makeHarness();
    runner.define('big', () => ({})).define('small', () => ({}));
    const d = def(
      [
        {
          id: 'sw',
          kind: 'switch',
          params: {
            cases: [
              { label: 'big', when: { left: { $path: 'total' }, op: 'gte', right: 100 } },
              { label: 'small', when: { left: { $path: 'total' }, op: 'gte', right: 0 } }
            ]
          },
          routes: { big: ['big'], small: ['small'] }
        },
        fn('big', 'big'),
        fn('small', 'small')
      ],
      'sw'
    );
    await engine.run(d, { trigger: { type: 'manual' }, payload: { total: 150 } });
    expect(runner.calls.map((c) => c.name)).toEqual(['big']);
  });
});

// ---------------------------------------------------------------------------
// CF11-001 — for-each
// ---------------------------------------------------------------------------

describe('WF-002 for-each (CF11-001)', () => {
  it('invokes the function per item with item/index and collects results in order', async () => {
    const { engine, runner } = makeHarness();
    runner.define('bill', (input) => ({ charged: (input.item as { id: number }).id, at: input.index }));
    runner.define('after', (input) => ({ got: input.previous }));

    const d = def(
      [
        { id: 'each', kind: 'for-each', ref: 'bill', params: { items: { $path: 'lines' } }, next: ['after'] },
        fn('after', 'after')
      ],
      'each'
    );
    const res = await engine.run(d, {
      trigger: { type: 'manual' },
      payload: { lines: [{ id: 1 }, { id: 2 }, { id: 3 }] }
    });

    expect(res.status).toBe('success');
    const previous = runner.calls.at(-1)!.input.previous as { results: unknown[]; count: number; failed: number };
    expect(previous.count).toBe(3);
    expect(previous.failed).toBe(0);
    expect(previous.results).toEqual([
      { charged: 1, at: 0 },
      { charged: 2, at: 1 },
      { charged: 3, at: 2 }
    ]);
  });

  it('takes the `empty` route for an empty list and `nonempty` otherwise', async () => {
    for (const [lines, expected] of [
      [[], 'wasEmpty'],
      [[{ id: 1 }], 'hadItems']
    ] as const) {
      const { engine, runner } = makeHarness();
      runner.define('bill', () => ({})).define('wasEmpty', () => ({})).define('hadItems', () => ({}));
      const d = def(
        [
          {
            id: 'each',
            kind: 'for-each',
            ref: 'bill',
            params: { items: { $path: 'lines' } },
            routes: { empty: ['wasEmpty'], nonempty: ['hadItems'] }
          },
          fn('wasEmpty', 'wasEmpty'),
          fn('hadItems', 'hadItems')
        ],
        'each'
      );
      await engine.run(d, { trigger: { type: 'manual' }, payload: { lines } });
      expect(runner.calls.map((c) => c.name)).toContain(expected);
    }
  });

  it('fails the step when items does not resolve to an array (a wiring bug, not "no items")', async () => {
    const { engine, runner } = makeHarness();
    runner.define('bill', () => ({}));
    const d = def([{ id: 'each', kind: 'for-each', ref: 'bill', params: { items: { $path: 'nope' } } }], 'each');
    const res = await engine.run(d, { trigger: { type: 'manual' } });
    expect(res.status).toBe('error');
    expect(res.unroutedError).toBe(true);
    expect(runner.calls).toHaveLength(0);
  });

  it('refuses to run past maxIterations rather than truncating', async () => {
    const { engine, runner } = makeHarness();
    runner.define('bill', () => ({}));
    const d = def(
      [{ id: 'each', kind: 'for-each', ref: 'bill', params: { items: { $path: 'lines' }, maxIterations: 2 } }],
      'each'
    );
    const res = await engine.run(d, { trigger: { type: 'manual' }, payload: { lines: [1, 2, 3] } });
    expect(res.status).toBe('error');
    expect(runner.calls).toHaveLength(0); // nothing was charged before failing
  });

  it('fails fast by default, and collects errors when continueOnError is set', async () => {
    const boom = (): Error => Object.assign(new Error('nope'), { statusCode: 500 });

    const strict = makeHarness();
    strict.runner.define('bill', (_i, n) => (n === 2 ? boom() : { ok: true }));
    const d1 = def([{ id: 'each', kind: 'for-each', ref: 'bill', params: { items: { $path: 'l' } } }], 'each');
    const r1 = await strict.engine.run(d1, { trigger: { type: 'manual' }, payload: { l: [1, 2, 3] } });
    expect(r1.status).toBe('error');
    expect(strict.runner.calls).toHaveLength(2); // stopped at the failure

    const lenient = makeHarness();
    lenient.runner.define('bill', (_i, n) => (n === 2 ? boom() : { ok: true }));
    lenient.runner.define('after', (input) => ({ got: input.previous }));
    const d2 = def(
      [
        {
          id: 'each',
          kind: 'for-each',
          ref: 'bill',
          params: { items: { $path: 'l' }, continueOnError: true },
          next: ['after']
        },
        fn('after', 'after')
      ],
      'each'
    );
    const r2 = await lenient.engine.run(d2, { trigger: { type: 'manual' }, payload: { l: [1, 2, 3] } });
    expect(r2.status).toBe('success');
    const out = lenient.runner.calls.at(-1)!.input.previous as { failed: number; errors: { index: number }[] };
    expect(out.failed).toBe(1);
    expect(out.errors[0].index).toBe(1); // the ORIGINAL index, not a shifted one
  });

  it('filters items, keeping original indices, and counts what it skipped', async () => {
    const { engine, runner } = makeHarness();
    runner.define('bill', (input) => ({ idx: input.index }));
    runner.define('after', (input) => ({ got: input.previous }));
    const d = def(
      [
        {
          id: 'each',
          kind: 'for-each',
          ref: 'bill',
          params: { items: { $path: 'l' }, filter: { left: { $path: 'item.keep' }, op: 'truthy' } },
          next: ['after']
        },
        fn('after', 'after')
      ],
      'each'
    );
    await engine.run(d, {
      trigger: { type: 'manual' },
      payload: { l: [{ keep: false }, { keep: true }, { keep: false }, { keep: true }] }
    });
    const out = runner.calls.at(-1)!.input.previous as { count: number; skipped: number; results: { idx: number }[] };
    expect(out).toMatchObject({ count: 2, skipped: 2 });
    expect(out.results.map((r) => r.idx)).toEqual([1, 3]);
  });
});

// ---------------------------------------------------------------------------
// CF11-001 — merge
// ---------------------------------------------------------------------------

describe('WF-002 merge (CF11-001)', () => {
  const twoBranches = (mergeParams: Record<string, unknown>): WorkflowDefinition =>
    def(
      [
        {
          id: 'sw',
          kind: 'switch',
          params: { value: { $path: 'status' }, cases: [{ label: 'a', equals: 'a' }] },
          routes: { a: ['left'], default: ['right'] }
        },
        fn('left', 'left', { next: ['join'] }),
        fn('right', 'right', { next: ['join'] }),
        { id: 'join', kind: 'merge', params: mergeParams, next: ['done'] },
        fn('done', 'done')
      ],
      'sw'
    );

  it('mode "any" merges whichever branch actually ran', async () => {
    const { engine, runner } = makeHarness();
    runner.define('left', () => ({ side: 'left' })).define('right', () => ({ side: 'right' }));
    runner.define('done', (input) => ({ got: input.previous }));
    const res = await engine.run(twoBranches({ mode: 'any' }), {
      trigger: { type: 'manual' },
      payload: { status: 'a' }
    });
    expect(res.status).toBe('success');
    const previous = runner.calls.at(-1)!.input.previous as {
      merged: Record<string, unknown>;
      sources: string[];
      missing: string[];
    };
    expect(previous.sources).toEqual(['left']);
    expect(previous.missing).toEqual(['right']);
    expect(previous.merged).toEqual({ left: { side: 'left' } });
  });

  it('mode "all" FAILS loudly when a declared source never arrived', async () => {
    const { engine, runner } = makeHarness();
    runner.define('left', () => ({})).define('right', () => ({})).define('done', () => ({}));
    const res = await engine.run(twoBranches({ mode: 'all' }), {
      trigger: { type: 'manual' },
      payload: { status: 'a' }
    });
    expect(res.status).toBe('error');
    expect(res.error).toMatch(/no error route/);
    expect(runner.calls.map((c) => c.name)).not.toContain('done');
  });

  it('merges converging branches with each strategy', async () => {
    for (const [strategy, expected] of [
      ['object', { one: { v: 1 }, two: { v: 2 } }],
      ['array', [{ v: 1 }, { v: 2 }]],
      ['shallow', { v: 2 }]
    ] as const) {
      const { engine, runner } = makeHarness();
      runner.define('one', () => ({ v: 1 })).define('two', () => ({ v: 2 }));
      runner.define('done', (input) => ({ got: input.previous }));
      const d = def(
        [
          fn('one', 'one', { next: ['two'] }),
          fn('two', 'two', { next: ['join'] }),
          { id: 'join', kind: 'merge', params: { strategy, sources: ['one', 'two'], mode: 'any' }, next: ['done'] },
          fn('done', 'done')
        ],
        'one'
      );
      // `one` reaches `join` only via `two` here, so declare sources explicitly.
      d.steps[0].next = ['two', 'join'];
      await engine.run(d, { trigger: { type: 'manual' } });
      const previous = runner.calls.at(-1)!.input.previous as { merged: unknown };
      expect(previous.merged).toEqual(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// CF11-002 — retry / stop, and the error data that makes catch branches work
// ---------------------------------------------------------------------------

describe('WF-002 retry (CF11-002)', () => {
  it('retries with backoff until the function succeeds', async () => {
    const { engine, runner } = makeHarness();
    runner.define('flaky', (_i, n) => (n < 3 ? Object.assign(new Error('503'), { statusCode: 503 }) : { ok: true }));
    runner.define('after', (input) => ({ got: input.previous }));
    const d = def(
      [
        { id: 'r', kind: 'retry', ref: 'flaky', params: { maxAttempts: 3, delayMs: 5 }, next: ['after'] },
        fn('after', 'after')
      ],
      'r'
    );
    const res = await engine.run(d, { trigger: { type: 'manual' } });
    expect(res.status).toBe('success');
    expect(runner.calls.filter((c) => c.name === 'flaky')).toHaveLength(3);
    expect(runner.calls.at(-1)!.input.previous).toEqual({ ok: true, attempts: 3, retried: true });
  });

  it('exhausting attempts is a normal step failure, so onError routing applies', async () => {
    const { engine, runner, history } = makeHarness();
    runner.define('always', () => Object.assign(new Error('down'), { statusCode: 500 }));
    runner.define('alert', (input) => ({ got: input.previous }));
    const d = def(
      [
        { id: 'r', kind: 'retry', ref: 'always', params: { maxAttempts: 2, delayMs: 1 }, onError: ['alert'] },
        fn('alert', 'alert')
      ],
      'r'
    );
    const res = await engine.run(d, { trigger: { type: 'manual' } });
    expect(res.status).toBe('success');
    expect(stepStatuses(history, res.executionId)).toEqual({ r: 'error', alert: 'success' });
    const err = (runner.calls.at(-1)!.input.previous as { error: { message: string } }).error;
    expect(err.message).toMatch(/failed after 2 attempt/);
  });

  it('retryOnStatus makes a non-retryable failure fail immediately', async () => {
    const { engine, runner } = makeHarness();
    runner.define('bad', () => Object.assign(new Error('bad request'), { statusCode: 400 }));
    const d = def(
      [{ id: 'r', kind: 'retry', ref: 'bad', params: { maxAttempts: 5, delayMs: 1, retryOnStatus: [503, 429] } }],
      'r'
    );
    const res = await engine.run(d, { trigger: { type: 'manual' } });
    expect(res.status).toBe('error');
    expect(runner.calls).toHaveLength(1); // did not burn the retry budget on a 400
  });
});

describe('WF-002 stop (CF11-002)', () => {
  it('isError true fails the step with the message and routes it', async () => {
    const { engine, runner, history } = makeHarness();
    runner.define('alert', (input) => ({ got: input.previous }));
    const d = def(
      [
        { id: 'guard', kind: 'stop', params: { message: 'Order has no lines' }, onError: ['alert'] },
        fn('alert', 'alert')
      ],
      'guard'
    );
    const res = await engine.run(d, { trigger: { type: 'manual' } });
    expect(stepStatuses(history, res.executionId)).toEqual({ guard: 'error', alert: 'success' });
    expect((runner.calls[0].input.previous as { error: { message: string } }).error.message).toBe(
      'Order has no lines'
    );
  });

  it('isError false succeeds but takes NO edges — the tail is recorded skipped', async () => {
    const { engine, runner, history } = makeHarness();
    runner.define('never', () => ({}));
    const d = def(
      [
        { id: 'quiet', kind: 'stop', params: { isError: false }, next: ['never'] },
        fn('never', 'never')
      ],
      'quiet'
    );
    const res = await engine.run(d, { trigger: { type: 'manual' } });
    expect(res.status).toBe('success');
    expect(runner.calls).toHaveLength(0);
    expect(stepStatuses(history, res.executionId)).toEqual({ quiet: 'success', never: 'skipped' });
  });
});

describe('WF-002 error data reaches catch branches (the engine fix CF11-002 needed)', () => {
  it('an onError handler receives previous.error with message, name and statusCode', async () => {
    const { engine, runner } = makeHarness();
    runner.define('boom', () => Object.assign(new Error('teapot'), { statusCode: 418 }));
    runner.define('catcher', (input) => ({ got: input.previous }));
    const d = def([fn('boom', 'boom', { onError: ['catcher'] }), fn('catcher', 'catcher')], 'boom');
    await engine.run(d, { trigger: { type: 'manual' } });
    expect(runner.calls.at(-1)!.input.previous).toEqual({
      error: {
        message: 'Function "boom" returned HTTP 418',
        name: 'StepExecutionError',
        statusCode: 418,
        step: 'boom'
      }
    });
  });
});

// ---------------------------------------------------------------------------
// CF11-003 — wait / wait-until
// ---------------------------------------------------------------------------

describe('WF-002 wait (CF11-003)', () => {
  it('waits the configured duration, converting units', async () => {
    const { engine, runner } = makeHarness();
    runner.define('after', (input) => ({ got: input.previous }));
    const d = def(
      [{ id: 'w', kind: 'wait', params: { duration: 60, unit: 'milliseconds' }, next: ['after'] }, fn('after', 'after')],
      'w'
    );
    const started = Date.now();
    const res = await engine.run(d, { trigger: { type: 'manual' } });
    expect(res.status).toBe('success');
    expect(Date.now() - started).toBeGreaterThanOrEqual(50);
    expect((runner.calls[0].input.previous as { waitedMs: number }).waitedMs).toBeGreaterThanOrEqual(50);
  });

  it('cancellation ends a wait PROMPTLY rather than sleeping it out', async () => {
    const { engine, runner, history } = makeHarness();
    runner.define('after', () => ({}));
    const d = def(
      [
        { id: 'w', kind: 'wait', params: { duration: 30, unit: 'seconds' }, next: ['after'] },
        fn('after', 'after')
      ],
      'w'
    );
    const started = Date.now();
    const running = engine.run(d, { trigger: { type: 'manual' } });
    // Give the run a tick to register and enter the wait, then cancel it.
    await new Promise((r) => setTimeout(r, 60));
    const rec = history.list({ status: 'running', limit: 10 }) as { id: string }[];
    expect(rec.length).toBe(1);
    expect(engine.cancel(rec[0].id)).toBe(true);
    const res = await running;
    expect(Date.now() - started).toBeLessThan(3000); // NOT 30s
    expect(res.status).toBe('cancelled');
    expect(runner.calls).toHaveLength(0);
  });

  it('a per-step timeout interrupts a wait and is routed as a step failure', async () => {
    const { engine, runner } = makeHarness();
    runner.define('alert', (input) => ({ got: input.previous }));
    const d = def(
      [
        { id: 'w', kind: 'wait', params: { duration: 10, unit: 'seconds' }, timeoutMs: 80, onError: ['alert'] },
        fn('alert', 'alert')
      ],
      'w'
    );
    const res = await engine.run(d, { trigger: { type: 'manual' } });
    expect(res.status).toBe('success');
    expect((runner.calls[0].input.previous as { error: { message: string } }).error.message).toMatch(/timed out/);
  });

  it('rejects a wait beyond the 24h cap at WRITE time', () => {
    const errors = validateWorkflowDefinition({
      version: 1,
      id: 'x',
      entry: 'w',
      concurrency: 1,
      steps: [{ id: 'w', kind: 'wait', params: { duration: 25, unit: 'hours' } }],
      createdAt: '',
      updatedAt: ''
    });
    expect(errors.join('\n')).toMatch(/exceeds the .* cap — use a schedule trigger/);
  });
});

describe('WF-002 wait-until (CF11-003)', () => {
  it('takes `skipped` immediately when the target has already passed', async () => {
    const { engine, runner } = makeHarness();
    runner.define('late', () => ({})).define('ontime', () => ({}));
    const d = def(
      [
        {
          id: 'w',
          kind: 'wait-until',
          params: { target: '2020-01-01T00:00:00.000Z' },
          routes: { done: ['ontime'], skipped: ['late'] }
        },
        fn('ontime', 'ontime'),
        fn('late', 'late')
      ],
      'w'
    );
    const started = Date.now();
    const res = await engine.run(d, { trigger: { type: 'manual' } });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(res.status).toBe('success');
    expect(runner.calls.map((c) => c.name)).toEqual(['late']);
  });

  it('waits until a near-future target and takes `done`', async () => {
    const { engine, runner } = makeHarness();
    runner.define('ontime', (input) => ({ got: input.previous }));
    const d = def(
      [
        {
          id: 'w',
          kind: 'wait-until',
          params: { target: { $path: 'when' } },
          routes: { done: ['ontime'] }
        },
        fn('ontime', 'ontime')
      ],
      'w'
    );
    const res = await engine.run(d, {
      trigger: { type: 'manual' },
      payload: { when: new Date(Date.now() + 80).toISOString() }
    });
    expect(res.status).toBe('success');
    expect((runner.calls[0].input.previous as { skipped: boolean }).skipped).toBe(false);
  });

  it('an unparseable target FAILS rather than degrading to a zero wait', async () => {
    const { engine } = makeHarness();
    const d = def([{ id: 'w', kind: 'wait-until', params: { target: 'next tuesday-ish' } }], 'w');
    const res = await engine.run(d, { trigger: { type: 'manual' } });
    expect(res.status).toBe('error');
    expect(res.unroutedError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Validation — what the registry will and will not accept
// ---------------------------------------------------------------------------

describe('WF-002 write-time validation', () => {
  const check = (steps: WorkflowStep[], entry = steps[0].id): string[] =>
    validateWorkflowDefinition({
      version: 1,
      id: 'x',
      entry,
      concurrency: 1,
      steps,
      createdAt: '',
      updatedAt: ''
    });

  it('rejects an unknown kind, naming the known ones', () => {
    expect(check([{ id: 'a', kind: 'teleport' as never }])[0]).toMatch(/unknown kind "teleport".*wait-until/s);
  });

  it('rejects a dangling or cyclic ROUTE target, like next/onError', () => {
    expect(
      check([{ id: 'a', kind: 'branch', params: { condition: { left: 1, op: 'truthy' } }, routes: { ontrue: ['ghost'] } }])
    ).toContain('step "a": route "ontrue" target "ghost" does not exist');

    const cyclic = check([
      { id: 'a', kind: 'branch', params: { condition: { left: 1, op: 'truthy' } }, routes: { ontrue: ['b'] } },
      fn('b', 'b', { next: ['a'] })
    ]);
    expect(cyclic.join()).toMatch(/cycle/);
  });

  it('rejects ref on a kind that does not invoke a function, and its absence where it is needed', () => {
    expect(check([{ id: 'a', kind: 'wait', ref: 'x', params: { duration: 1 } }])[0]).toMatch(/remove "ref"/);
    expect(check([{ id: 'a', kind: 'retry' }])[0]).toMatch(/needs a ref/);
  });

  it('rejects switch cases that are ambiguous, duplicated, or named `default`', () => {
    const errs = check([
      {
        id: 'a',
        kind: 'switch',
        params: {
          cases: [
            { label: 'x', equals: 1, when: { left: 1, op: 'truthy' } },
            { label: 'x', equals: 2 },
            { label: 'default', equals: 3 }
          ]
        }
      }
    ]).join('\n');
    expect(errs).toMatch(/exactly one of "equals" or "when"/);
    expect(errs).toMatch(/duplicate case label "x"/);
    expect(errs).toMatch(/"default" is reserved/);
  });

  it('rejects a route on a kind that has none, and an unknown route name', () => {
    expect(check([{ id: 'a', kind: 'merge', routes: { whatever: [] } }])[0]).toMatch(/has no routes/);
    expect(
      check([{ id: 'a', kind: 'branch', params: { condition: { left: 1, op: 'truthy' } }, routes: { maybe: [] } }])[0]
    ).toMatch(/must be "ontrue" or "onfalse"/);
  });

  it('rejects a stop step that can never take its `next` edge', () => {
    expect(
      check([{ id: 'a', kind: 'stop', next: ['b'] }, fn('b', 'b')])[0]
    ).toMatch(/can never take "next"/);
  });
});
