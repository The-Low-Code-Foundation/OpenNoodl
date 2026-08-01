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
    // Nothing was running, so nothing ended: an `Aborted` here would report on a run that
    // never began.
    expect(graph.signalsFor('runner')).toEqual([]);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(10);

    // Before the fix: `state=aborted`, signals still `[]`. The node was dead for the life of
    // the page, having reported nothing.
    expect(graph.signalsFor('runner')).toEqual(['success', 'done']);
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

    // `done` is the addition. `failure` and `aborted` were already sent — but without returning
    // to idle, so the node's own option disabled it after the first failure.
    expect(graph.signalsFor('runner')).toEqual(['failure', 'aborted', 'done']);
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
    expect(graph.signalsFor('runner')).toEqual(['failure', 'aborted', 'done', 'failure', 'aborted', 'done']);
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
    expect(graph.signalsFor('runner')).toEqual(['failure', 'done']);
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
    expect(graph.signalsFor('runner')).toEqual(['failure', 'done']);
    expect(graph.errors.map((e) => e.code)).toEqual(['run-tasks/invalid-concurrency']);
    expect(stateOf(graph)).toBe('idle');
  });

  it('control: a Do while a run is genuinely in progress is reported but sends no signal', async () => {
    const graph = await buildGraph({ items: [{ id: 'a' }, { id: 'b' }], parameters: { maxRunningTasks: 1 } });
    await graph.settle(3);

    // Two pulses in the same settle window; the second finds the first still running.
    graph.node<StarterInstance>('starter').start();
    graph.node<StarterInstance>('starter').start();
    await graph.settle(12);

    // ⚠️ Deliberately *not* a `failure`. The first run has not failed and will send its own
    // completion; reporting failure here would describe a run that is fine.
    expect(graph.signalsFor('runner')).not.toContain('failure');
    expect(stateOf(graph)).toBe('idle');
  });
});

describe('RT-4 — an empty Items list is a completed run', () => {
  it('sends Done as well as Success', async () => {
    const graph = await buildGraph({ items: [] });
    await graph.settle(3);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(8);

    // The empty list is the *common* case — a query that matched nothing hands this node `[]`.
    // Before the fix `done` never fired, so a graph wired "when Done, do the next thing"
    // stopped dead precisely when there was no work to do.
    expect(graph.signalsFor('runner')).toEqual(['success', 'done']);
    expect(stateOf(graph)).toBe('idle');
  });
});

describe('RT-5 — G1, null on Items clears rather than abstaining', () => {
  it('does not silently re-run the previous list', async () => {
    const graph = await buildGraph({ items: [{ id: 'a' }, { id: 'b' }] });
    await graph.settle(3);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(10);
    expect(graph.signalsFor('runner')).toEqual(['success', 'done']);

    // The source clears. `undefined` never crosses a connection (`node.ts:635` drops it in
    // `sendValue`), so `null` is the reachable spelling of "there is nothing to run".
    graph.node<StarterInstance>('starter').setItems(null);
    await graph.settle(4);

    graph.node<StarterInstance>('starter').start();
    await graph.settle(10);

    // Before the fix the setter returned on any falsy value, so `_internal.items` still held
    // the old array and this second Do silently re-ran both tasks.
    expect(graph.signalsFor('runner')).toEqual(['success', 'done', 'failure', 'done']);
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

    expect(graph.signalsFor('runner')).toEqual(['success', 'done']);
    expect(graph.errors).toEqual([]);
  });
});
