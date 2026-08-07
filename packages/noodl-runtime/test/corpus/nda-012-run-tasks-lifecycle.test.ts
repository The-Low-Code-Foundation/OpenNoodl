/**
 * NDA-012 — `Run Tasks`, the run lifecycle.
 *
 * ⚠️ **This node was audited under NDA-009 and that audit did not cover this.** NDA-009 §1–§4
 * are about the *template contract* — the three port names Run Tasks matches by string — and
 * their rows live in `nda-009-run-tasks-contract.test.ts` and `nda-009-run-tasks-template.test.ts`.
 * Nothing anywhere exercised starting, aborting or finishing a run, and five defects were
 * sitting in the eighty lines between `run` and `checkDone`.
 *
 * Two of them **permanently disabled the node**, silently, with no signal and no error:
 *
 * | | Measured before |
 * |---|---|
 * | `Abort` with nothing in flight | `state=aborted` for ever; every later `Do` did nothing |
 * | `Stop On Failure` after one failure | `state=running` for ever; every later `Do` did nothing |
 * | `Max Running Tasks = 0` | silent hang — no signals, no errors, no tasks |
 * | `Do` with no template | nothing at all; editor warning only |
 * | Empty `Items` list | `success` but no `done` |
 *
 * The two wedges are the sharper class: an author pressing their own `Abort` button, or ticking
 * the node's own `Stop On Failure` option, is not doing anything wrong — and either one killed
 * the node for the life of the page.
 *
 * ---
 *
 * ⚠️ **ERG-001 renamed two of this node's ports, and the rows below are the record of it.**
 * `done` became `completed` and `success` became `done`, in that order — the reverse collides
 * `success` onto a `done` that still exists. Every `['success', 'done']` here is now
 * `['done', 'completed']`; every `['failure', 'done']` is `['failure', 'completed']`.
 *
 * Three rows changed by more than a rename, and each is a contract repair rather than a
 * relabelling:
 *
 * - **RT-1** — `Abort` with nothing in flight emitted *nothing*. It now reports `Unchanged`,
 *   and a second row records what an *honoured* abort reports.
 * - **RT-2** — `aborted` now precedes the outcome, because the outcome is the last thing an
 *   action does.
 * - **RT-3's third row** — a `Do` landing mid-run emitted nothing. It now reports `Unchanged`.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import ComponentInputs = require('../../src/nodes/componentinputs');
import ComponentOutputs = require('../../src/nodes/componentoutputs');
import RunTasksNode = require('../../src/nodes/std-library/runtasks');

interface StarterInstance extends NodeInstance {
  start(): void;
  abort(): void;
  setItems(items: unknown[] | null): void;
}

/** Emits a list, a `go` pulse and a `stop` pulse, so a row can drive `Do` and `Abort`. */
function starterModule(items: unknown[]): NodeModule {
  return {
    node: {
      name: 'corpus.Starter',
      category: 'Corpus',
      initialize: function (this: NodeInstance) {
        this._internal.items = items;
      },
      outputs: {
        items: {
          type: 'array',
          getter: function (this: NodeInstance) {
            return this._internal.items;
          }
        },
        go: { type: 'signal' },
        stop: { type: 'signal' }
      },
      methods: {
        start(this: NodeInstance) {
          this.flagOutputDirty('items');
          this.sendSignalOnOutput('go');
        },
        abort(this: NodeInstance) {
          this.sendSignalOnOutput('stop');
        },
        setItems(this: NodeInstance, value: unknown[] | null) {
          this._internal.items = value;
          this.flagOutputDirty('items');
        }
      }
    }
  };
}

/**
 * A Run Tasks node over `items`, with the smallest template that can finish: the start input
 * wired straight to a completion output. `failing` chooses which completion port that is, which
 * is how a row makes every task fail without needing conditional logic inside the template.
 */
async function buildGraph(options: {
  items: unknown[];
  parameters?: Record<string, unknown>;
  failing?: boolean;
}): Promise<CorpusGraph> {
  const completionPort = options.failing ? 'Failure' : 'Success';
  return createCorpusGraph({
    modules: [starterModule(options.items), RunTasksNode as unknown as NodeModule, ComponentInputs, ComponentOutputs],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'starter', type: 'corpus.Starter' },
            {
              id: 'runner',
              type: 'RunTasks',
              parameters: { taskTemplate: '/Task', ...(options.parameters || {}) }
            }
          ],
          connections: [
            { sourceId: 'starter', sourcePort: 'items', targetId: 'runner', targetPort: 'items' },
            { sourceId: 'starter', sourcePort: 'go', targetId: 'runner', targetPort: 'run' },
            { sourceId: 'starter', sourcePort: 'stop', targetId: 'runner', targetPort: 'abort' }
          ]
        },
        {
          name: '/Task',
          ports: [
            { name: 'Do', plug: 'input', type: 'signal' },
            { name: completionPort, plug: 'output', type: 'signal' }
          ],
          nodes: [
            { id: 'task-in', type: 'Component Inputs', ports: [{ name: 'Do', plug: 'output', type: 'signal' }] },
            {
              id: 'task-out',
              type: 'Component Outputs',
              ports: [{ name: completionPort, plug: 'input', type: 'signal' }]
            }
          ],
          connections: [{ sourceId: 'task-in', sourcePort: 'Do', targetId: 'task-out', targetPort: completionPort }]
        }
      ]
    } as never
  });
}

/** The node's own run state. Read directly because it is what "wedged" actually means. */
function stateOf(graph: CorpusGraph): string {
  return (graph.node('runner') as unknown as { _internal: { state: string } })._internal.state;
}

describe('RT-1 — Abort with nothing in flight', () => {
  it('does not wedge the node, and a later Do still runs', async () => {
    const graph = await buildGraph({ items: [{ id: 'a' }] });
    await graph.settle(3);

    // An author's Abort button, pressed when nothing is running. Before the fix this set
    // `state = 'aborted'` unconditionally, and nothing but a completing *task* ever cleared it.
    graph.node<StarterInstance>('starter').abort();
    await graph.settle(8);

    expect(stateOf(graph)).toBe('idle');
    // Nothing was running, so nothing ended — and still no `Aborted`, which would report on a
    // run that never began.
    //
    // ⚠️ ERG-001 changed this row from `[]`. `Abort` is this node's second action port and it
    // emitted nothing on this path, which is the contract's headline dead-chain class: an
    // author who wired "when the Abort has been handled, re-enable the button" got no pulse
    // precisely when there was nothing to abort. `Unchanged` is what that branch means — the
    // action was valid and the post-condition already held.
    expect(graph.signalsFor('runner')).toEqual(['unchanged', 'completed']);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(10);

    // Before the NDA-012 fix: `state=aborted`, signals still `[]`. The node was dead for the
    // life of the page, having reported nothing.
    expect(graph.signalsFor('runner')).toEqual(['unchanged', 'completed', 'done', 'completed']);
    expect(stateOf(graph)).toBe('idle');
  });

  it('and an Abort that is honoured reports Done, for its own invocation', async () => {
    const graph = await buildGraph({ items: [{ id: 'a' }, { id: 'b' }], parameters: { maxRunningTasks: 1 } });
    await graph.settle(3);

    // Abort while the run is genuinely under way. The run ends on the next `checkDone`, and
    // *two* invocations settle at that moment: the `Do` that started the run, and the `Abort`
    // that stopped it.
    graph.node<StarterInstance>('starter').start();
    await graph.settle(1);
    graph.node<StarterInstance>('starter').abort();
    await graph.settle(12);

    // ⚠️ The design decision, recorded as a row rather than as prose. An author-requested abort
    // is **not** a `Failure`: the run did its work and stopped when it was told to, which is the
    // graph doing exactly what it was asked. Folding it into `Failure` is the collapse Rule 1
    // exists to stop. `Aborted` is what distinguishes it from an ordinary completion, and it
    // fires first so a graph reading it has it when the outcome lands.
    //
    // ⚠️ `Completed` therefore appears **twice** — once for `Do`'s token, once for `Abort`'s.
    // Two action ports were invoked, so that is two invocations, and "exactly one outcome" is
    // per invocation.
    expect(graph.signalsFor('runner')).toEqual(['aborted', 'done', 'completed', 'done', 'completed']);
    expect(stateOf(graph)).toBe('idle');
  });
});

describe('RT-2 — Stop On Failure', () => {
  it('ends the run and leaves the node usable', async () => {
    const graph = await buildGraph({
      items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      parameters: { stopOnFailure: true, maxRunningTasks: 1 },
      failing: true
    });
    await graph.settle(3);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(12);

    // The completion signal is the NDA-012 addition. `failure` and `aborted` were already sent
    // — but without returning to idle, so the node's own option disabled it after the first
    // failure.
    //
    // ⚠️ ERG-001 reordered this: `aborted` now comes *first*. The outcome is the last thing an
    // action does, so that a graph reading "how did it end" already has the answer when the
    // pulse lands. This is not an author-requested abort — the option caught a failure — so
    // the outcome stays `Failure`.
    expect(graph.signalsFor('runner')).toEqual(['aborted', 'failure', 'completed']);
    expect(stateOf(graph)).toBe('idle');
  });

  it('and a second Do runs again rather than doing nothing', async () => {
    const graph = await buildGraph({
      items: [{ id: 'a' }, { id: 'b' }],
      parameters: { stopOnFailure: true, maxRunningTasks: 1 },
      failing: true
    });
    await graph.settle(3);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(12);
    graph.node<StarterInstance>('starter').start();
    await graph.settle(12);

    // Before the fix the second run produced nothing at all — the whole point of the row.
    expect(graph.signalsFor('runner')).toEqual([
      'aborted',
      'failure',
      'completed',
      'aborted',
      'failure',
      'completed'
    ]);
    expect(stateOf(graph)).toBe('idle');
  });
});

describe('RT-3 — a run that could never start says so at runtime', () => {
  it('reports an absent template on the error bus, not only to the editor', async () => {
    const graph = await buildGraph({ items: [{ id: 'a' }], parameters: { taskTemplate: undefined } });
    await graph.settle(3);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(8);

    // B2: measured before as `signals=[], errors=[]` — in a deployed app the node did nothing
    // and told nobody, because `editorConnection.sendWarning` was the only report.
    expect(graph.signalsFor('runner')).toEqual(['failure', 'completed']);
    expect(graph.errors.map((e) => e.code)).toEqual(['run-tasks/no-template']);
  });

  it('reports a concurrency of zero rather than hanging for ever', async () => {
    const graph = await buildGraph({
      items: [{ id: 'a' }, { id: 'b' }],
      parameters: { maxRunningTasks: 0 }
    });
    await graph.settle(3);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(10);

    // `Math.min(0, n)` started no tasks, so nothing would ever arrive to complete the run:
    // measured `state=running`, no signals, no errors, for ever. The node's own comment on
    // `startTask` names the principle — a hang is the worst available outcome, because it is
    // the only one downstream cannot react to.
    expect(graph.signalsFor('runner')).toEqual(['failure', 'completed']);
    expect(graph.errors.map((e) => e.code)).toEqual(['run-tasks/invalid-concurrency']);
    expect(stateOf(graph)).toBe('idle');
  });

  it('a Do while a run is genuinely in progress reports Unchanged rather than nothing', async () => {
    const graph = await buildGraph({ items: [{ id: 'a' }, { id: 'b' }], parameters: { maxRunningTasks: 1 } });
    await graph.settle(3);

    // Two pulses in the same settle window; the second finds the first still running.
    //
    // ⚠️ They do **not** coalesce, despite `scheduleRun`'s `hasScheduledRun` guard, because
    // `sendSignalOnOutput` flushes the scheduled operation before the second pulse is sent.
    // Measured, after a session predicted the opposite from reading the guard: the received
    // order is `unchanged` *first*, which is only possible if the second `Do` reached `run()`
    // as a separate call and found `state === 'running'`.
    graph.node<StarterInstance>('starter').start();
    graph.node<StarterInstance>('starter').start();
    await graph.settle(12);

    // ⚠️ Deliberately *not* a `failure`. The first run has not failed and will send its own
    // completion; reporting failure here would describe a run that is fine.
    //
    // ⚠️ ERG-001 — before this pass the branch emitted **nothing at all**: the last silent path
    // out of an action on this node, and the contract's headline dead-chain class. `Unchanged`
    // is what it means — the action was valid and the post-condition ("a run is in progress")
    // already held. The error-bus raise stays alongside it, because a `Do` that starts no run is
    // still usually a sequencing mistake worth seeing in a deployed app; the difference is that
    // an author can now see it on the canvas too.
    expect(graph.signalsFor('runner')).toEqual(['unchanged', 'completed', 'done', 'completed']);
    expect(graph.errors.map((e) => e.code)).toEqual(['run-tasks/already-running']);
    expect(stateOf(graph)).toBe('idle');
  });
});

describe('RT-4 — an empty Items list is a completed run', () => {
  it('sends the completion signals, and the outcome is Done', async () => {
    const graph = await buildGraph({ items: [] });
    await graph.settle(3);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(8);

    // The empty list is the *common* case — a query that matched nothing hands this node `[]`.
    // Before the NDA-012 fix the completion signal never fired, so a graph wired "when Done, do
    // the next thing" stopped dead precisely when there was no work to do.
    //
    // ⚠️ ERG-001 — **`Done`, never `Unchanged`**, and this row is the guard on that. The
    // contract's wording ("the post-condition already held") invites the `Unchanged` reading
    // and it is wrong here: an empty list is a run that completed, not a run that found nothing
    // to change. `For Each`'s and `Pattern Extractor`'s exemptions are recorded for this exact
    // shape, and taking the other reading would silently re-open the defect §B3 closed.
    expect(graph.signalsFor('runner')).toEqual(['done', 'completed']);
    expect(stateOf(graph)).toBe('idle');
  });
});

describe('RT-5 — G1, null on Items clears rather than abstaining', () => {
  it('does not silently re-run the previous list', async () => {
    const graph = await buildGraph({ items: [{ id: 'a' }, { id: 'b' }] });
    await graph.settle(3);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(10);
    expect(graph.signalsFor('runner')).toEqual(['done', 'completed']);

    // The source clears. `undefined` never crosses a connection (`node.ts:635` drops it in
    // `sendValue`), so `null` is the reachable spelling of "there is nothing to run".
    graph.node<StarterInstance>('starter').setItems(null);
    await graph.settle(4);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(10);

    // Before the fix the setter returned on any falsy value, so `_internal.items` still held
    // the old array and this second Do silently re-ran both tasks.
    expect(graph.signalsFor('runner')).toEqual(['done', 'completed', 'failure', 'completed']);
    expect(graph.errors.map((e) => e.code)).toEqual(['run-tasks/no-items']);
  });

  it('control: an empty array is still a real, completed run', async () => {
    const graph = await buildGraph({ items: [{ id: 'a' }] });
    await graph.settle(3);

    // `[]` is truthy and means "no work", which is different from "no list". It must not be
    // caught by the null clear.
    graph.node<StarterInstance>('starter').setItems([]);
    await graph.settle(4);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(8);

    expect(graph.signalsFor('runner')).toEqual(['done', 'completed']);
    expect(graph.errors).toEqual([]);
  });
});
