/**
 * ERG-001 §4 — the outcome contract on the Repeater family.
 *
 * §0's "emits nothing at all" table lists both of these and neither had been read. Reading
 * them first is what this file records, because two of the four things the source turned out
 * to say contradict the obvious design.
 *
 * ## `For Each` (Repeater) — `Refresh`
 *
 * ⚠️ **`Items Rendered` is not this invocation's `Done`, and could not be made into one.** It
 * fires from `_signalItemsRendered` whenever the operation queue drains having done work —
 * which includes a single `add` from a collection `change` event, a bind, and a template
 * change. It is a *list-level* announcement and it is the right one; it is simply not tied to
 * any `Refresh`. So `Refresh` gets its own outcome, reported at the end of `refresh()`'s own
 * async body, which is the moment that rebuild finished.
 *
 * ⚠️ **No `Unchanged`, and the empty list is the reason.** `Refresh` tears every item node
 * down and rebuilds from the current `Items` unconditionally; there is no state in which it
 * declines to act. The tempting `Unchanged` is "you refreshed a list that was empty and still
 * is" — and taking it would put the *common* empty case on a different wire from the common
 * non-empty one, which is `Run Tasks`' defect (`Done` on one of four terminal paths, so an
 * empty list stopped a graph dead) reintroduced with the sign flipped. Same exemption
 * `Page Stack` took in the navigation slice, for the same reason.
 *
 * ## `For Each Actions` (Repeater Item) — `Remove Completed`
 *
 * `foreachactions.ts:44` was `this._internal.removeCompletedCallback && this._internal.…()` —
 * silent whether or not there was a handshake to complete. It also **never cleared the
 * callback**, so a second `Remove Completed` called it again: NV-iii's latch, in the node whose
 * whole job is a one-shot handshake. Clearing it is what makes the second pulse honestly
 * `Unchanged` rather than a second `Done`.
 *
 * ## What reverting reddens — predicted before running, then measured
 *
 * | Revert | Predicted | Actual |
 * |---|---|---|
 * | the `Refresh` token minted in `scheduleRefresh` rather than at the port | the two "reports nothing" rows | **7 red** — see below |
 * | `refresh()`'s no-items branch reporting `done` | the no-items row only | 1 red, that row |
 * | `Remove Completed` not clearing the callback | the second-pulse row only | 1 red, that row |
 * | an empty rebuild reporting `unchanged` | the empty-list row and the port-surface row | 2 red, those two |
 *
 * ⚠️ **The first prediction was wrong and is left here rather than tidied away.** Moving the
 * mint into `scheduleRefresh` reddens seven rows, not two, because *every* setter on this node
 * schedules a refresh: a row that binds `Items` and then pulses `Refresh` gets two outcomes
 * where it asserted one, so almost every Refresh row fails rather than just the two asserting
 * silence. The claim "only the port mints" is therefore load-bearing across the whole file, not
 * just in the two rows written to state it — which is a stronger result than the prediction
 * expected, and the reason to record the miss instead of rewriting the prediction to match.
 * (The one Refresh row that survives is the collection-change row, which never pulses the port.)
 */

/* eslint-env jest */

import type { ModelLike, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import NoodlRuntime from '@noodl/runtime';
import Model = require('@noodl/runtime/src/model');

import ForEachModule from '../../src/nodes/std-library/data/foreach';
import ForEachActionsModule from '../../src/nodes/std-library/data/foreachactions';

// =================================================================================================
// Harness — the Repeater's minimal visual parent, as nda-013-repeater-refresh.test.ts builds it.
// `foreach.tsx` needs exactly `addChild` / `removeChild` / `getChildren` from `internal.target`.
// =================================================================================================

interface ContainerInstance extends NodeInstance {
  _children: Array<NodeInstance & { parent?: NodeInstance }>;
}

const ContainerModule: NodeModule = {
  node: {
    name: 'corpus.Container',
    category: 'Corpus',
    initialize: function (this: ContainerInstance) {
      this._children = [];
    },
    methods: {
      addChild: function (this: ContainerInstance, child: NodeInstance & { parent?: NodeInstance }, index?: number) {
        if (index === undefined || index >= this._children.length) {
          this._children.push(child);
        } else {
          this._children.splice(index, 0, child);
        }
        child.parent = this;
      },
      removeChild: function (this: ContainerInstance, child: NodeInstance & { parent?: NodeInstance }) {
        const idx = this._children.indexOf(child);
        if (idx !== -1) this._children.splice(idx, 1);
        child.parent = undefined;
      },
      getChildren: function (this: ContainerInstance) {
        return this._children;
      }
    }
  }
};

/**
 * A wire target with a real input.
 *
 * ⚠️ `getOutput('tryRemove').hasConnections()` is what puts the Repeater Item into the waiting
 * state, and a connection to a port the target does not declare is never made — so a sink
 * without this input made the handshake silently take the *no-connections* branch, and the row
 * asserting `Done` read as the node reporting the wrong outcome.
 */
const SinkModule: NodeModule = {
  node: {
    name: 'corpus.Sink',
    category: 'Corpus',
    inputs: {
      noop: {
        type: { name: 'signal', allowConnectionsOnly: true },
        valueChangedToTrue: function () {
          /* the wire existing is the whole point; nothing has to happen at this end */
        }
      }
    },
    outputs: {}
  }
};

interface RepeaterOptions {
  /** Omit to leave the Repeater unparented, which is the no-target case. */
  parented?: boolean;
  parameters?: Record<string, unknown>;
}

async function repeaterGraph(options: RepeaterOptions = {}): Promise<CorpusGraph> {
  const parameters = options.parameters || { template: '/Item', templateType: 'explicit' };
  const repeaterNode = { id: 'repeater', type: 'For Each', parameters };

  return createCorpusGraph({
    modules: [ForEachModule, ContainerModule],
    data: {
      components: [
        {
          name: '/root',
          nodes:
            options.parented === false
              ? [repeaterNode]
              : [{ id: 'container', type: 'corpus.Container', children: [repeaterNode] }],
          connections: []
        },
        { name: '/Item', nodes: [], connections: [] }
      ]
    } as never
  });
}

/** Fires an edge-triggered input, resetting the edge first so a second call does something. */
function pulse(graph: CorpusGraph, id: string, port: string): void {
  graph.node(id).setInputValue(port, false);
  graph.node(id).setInputValue(port, true);
}

function outcomesOf(graph: CorpusGraph, id: string): string[] {
  return graph.signalsFor(id).filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(graph: CorpusGraph, id: string, name: string): number {
  return graph.signalsFor(id).filter((s) => s === name).length;
}

const savedNoodlRuntimeInstance = (NoodlRuntime as unknown as { instance?: unknown }).instance;

beforeAll(() => {
  // `foreach.tsx` reads two project settings straight off `NoodlRuntime.instance` rather than
  // through `NodeContext`, and this corpus graph never constructs one.
  (NoodlRuntime as unknown as { instance?: unknown }).instance = { getProjectSettings: () => ({}) };
});

afterAll(() => {
  (NoodlRuntime as unknown as { instance?: unknown }).instance = savedNoodlRuntimeInstance;
});

// =================================================================================================
// For Each — the port surface
// =================================================================================================

describe('ERG-001 §4: Repeater port surface', () => {
  it('publishes Done, Failure and Completed — and deliberately no Unchanged', async () => {
    const graph = await repeaterGraph();
    const repeater = graph.node('repeater');

    expect(repeater.hasOutput('done')).toBe(true);
    expect(repeater.hasOutput('failure')).toBe(true);
    expect(repeater.hasOutput('completed')).toBe(true);

    // (pinned control) The exemption, not a gap. `Refresh` tears down and rebuilds
    // unconditionally, so there is no state in which it declines to act — and an `Unchanged`
    // that can never fire is exactly what §5's dead-end check should complain about. ⚠️ If this
    // row reddens, read the comment above it before "finishing the family off".
    expect(repeater.hasOutput('unchanged')).toBe(false);

    // The list-level announcement is untouched: it means something else and keeps its name.
    expect(repeater.hasOutput('itemsRendered')).toBe(true);
  });
});

// =================================================================================================
// For Each — Refresh
// =================================================================================================

describe('ERG-001 §4: Repeater Refresh', () => {
  it('reports Done once the rebuild has finished, then Completed', async () => {
    const graph = await repeaterGraph();
    graph.node('repeater').setInputValue('items', [Model.create({ id: 'a' }), Model.create({ id: 'b' })]);
    await graph.settle();

    pulse(graph, 'repeater', 'refresh');
    await graph.settle();

    const signals = graph.signalsFor('repeater');
    expect(outcomesOf(graph, 'repeater')).toEqual(['done']);
    expect(countOf(graph, 'repeater', 'completed')).toBe(1);
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
  });

  it('reports Done for a Refresh of an empty list, not a separate outcome', async () => {
    const graph = await repeaterGraph();
    graph.node('repeater').setInputValue('items', []);
    await graph.settle();

    pulse(graph, 'repeater', 'refresh');
    await graph.settle();

    // `Run Tasks`' lesson, kept: the empty list is the common case, and putting it on a
    // different wire from the non-empty one is what stopped graphs dead.
    expect(outcomesOf(graph, 'repeater')).toEqual(['done']);
  });

  it('reports Failure with its own code when no Items are bound', async () => {
    const graph = await repeaterGraph();
    await graph.settle();

    // ⚠️ Scoped to the invocation rather than to the whole graph: binding `Items` and setting
    // `Template` raise their own diagnoses on the same channel, and folding those in would make
    // this row pass for the wrong reason. Still `equals` one code, not `contains` — the failure
    // mode being pinned is two events for one refusal.
    const raisedBefore = graph.errors.length;
    pulse(graph, 'repeater', 'refresh');
    await graph.settle();

    expect(outcomesOf(graph, 'repeater')).toEqual(['failure']);
    expect(graph.errors.slice(raisedBefore).map((e) => e.code)).toEqual(['repeater/no-items']);
    expect(countOf(graph, 'repeater', 'completed')).toBe(1);
  });

  it('reports Failure with its own code when no Template is set', async () => {
    const graph = await repeaterGraph({ parameters: {} });
    graph.node('repeater').setInputValue('items', [Model.create({ id: 'a' })]);
    await graph.settle();

    const raisedBefore = graph.errors.length;
    pulse(graph, 'repeater', 'refresh');
    await graph.settle();

    expect(outcomesOf(graph, 'repeater')).toEqual(['failure']);
    expect(graph.errors.slice(raisedBefore).map((e) => e.code)).toEqual(['repeater/no-template']);
  });

  it('reports Failure with its own code when the Repeater has nothing to render into', async () => {
    const graph = await repeaterGraph({ parented: false });
    graph.node('repeater').setInputValue('items', [Model.create({ id: 'a' })]);
    await graph.settle();

    const raisedBefore = graph.errors.length;
    pulse(graph, 'repeater', 'refresh');
    await graph.settle();

    expect(outcomesOf(graph, 'repeater')).toEqual(['failure']);
    expect(graph.errors.slice(raisedBefore).map((e) => e.code)).toEqual(['repeater/no-target']);
  });

  it('gives two Refreshes in one frame two outcomes, though they coalesce into one rebuild', async () => {
    const graph = await repeaterGraph();
    graph.node('repeater').setInputValue('items', [Model.create({ id: 'a' })]);
    await graph.settle();

    pulse(graph, 'repeater', 'refresh');
    pulse(graph, 'repeater', 'refresh');
    await graph.settle();

    // Undo's lesson from Build 2b: one press is one invocation even when a frame's presses
    // coalesce into one piece of work.
    expect(outcomesOf(graph, 'repeater')).toEqual(['done', 'done']);
    expect(countOf(graph, 'repeater', 'completed')).toBe(2);
  });

  it('reports nothing when binding Items rebuilds the list', async () => {
    const graph = await repeaterGraph();
    graph.node('repeater').setInputValue('items', [Model.create({ id: 'a' })]);
    await graph.settle();

    // The mount-path rule. Every setter on this node schedules a refresh; none of them is an
    // invocation of the `Refresh` port, so none of them mints a token.
    expect(outcomesOf(graph, 'repeater')).toEqual([]);
    expect(graph.signalsFor('repeater')).not.toContain('completed');
  });

  /**
   * ⚠️ **A defect found by building this, measured rather than inferred, and deliberately not
   * fixed here.**
   *
   * `Items Rendered` promises "once every item component exists and has been added" — NDA-004
   * §3 added it precisely so that list-then-scroll and list-then-measure stopped being a
   * guessed Delay. On the `Refresh` path it does not keep that promise: `_queueOperation` is
   * handed `() => { this.refresh(); }`, whose block body drops the promise, so
   * `_runQueueOperations`' `await op()` returns immediately and the queue drains — firing
   * `Items Rendered` — while the rebuild is still awaiting `addItem` per item.
   *
   * This row pins the measured behaviour rather than the intended one, because repairing it
   * changes *when* an existing signal fires, which is a behaviour change and not this slice's
   * to make. `Done` is honest about the same moment and is the answer for anything sequencing
   * off a `Refresh` until the ordering is fixed. The one-character fix is `() => this.refresh()`.
   */
  it('(filed, not fixed) fires Items Rendered before a Refresh\'s items exist, while Done waits for them', async () => {
    const graph = await repeaterGraph();
    const repeater = graph.node<NodeInstance & { _internal: { itemNodes?: unknown[] } }>('repeater');
    graph.node('repeater').setInputValue('items', [Model.create({ id: 'a' })]);
    await graph.settle();

    const observed: Array<{ signal: string; items: number }> = [];
    const original = repeater.sendSignalOnOutput.bind(repeater);
    repeater.sendSignalOnOutput = (name: string) => {
      observed.push({ signal: name, items: (repeater._internal.itemNodes || []).length });
      original(name);
    };

    pulse(graph, 'repeater', 'refresh');
    await graph.settle();

    expect(observed).toEqual([
      { signal: 'itemsRendered', items: 0 },
      { signal: 'done', items: 1 },
      { signal: 'completed', items: 1 }
    ]);
  });

  it('reports nothing when a collection change re-renders — Items Rendered is not the outcome', async () => {
    const graph = await repeaterGraph();
    const items: ModelLike[] = [Model.create({ id: 'a' })];
    graph.node('repeater').setInputValue('items', items);
    await graph.settle();

    const before = graph.signalsFor('repeater').length;
    (items as unknown as { push(m: ModelLike): void }).push(Model.create({ id: 'b' }));
    graph.node('repeater').setInputValue('items', items.slice());
    await graph.settle();

    const after = graph.signalsFor('repeater').slice(before);
    // `itemsRendered` is free to fire — it is the list-level announcement and it means
    // something else. What must not appear is an outcome, because no invocation happened.
    expect(after.filter((s) => s === 'done' || s === 'unchanged' || s === 'failure')).toEqual([]);
    expect(after).not.toContain('completed');
  });
});

// =================================================================================================
// For Each Actions — Remove Completed
// =================================================================================================

interface ForEachActionsTestNode extends NodeInstance {
  tryRemove(callback: () => void): void;
}

async function repeaterItemGraph(): Promise<CorpusGraph> {
  return createCorpusGraph({
    modules: [ForEachActionsModule, SinkModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'item', type: 'For Each Actions' },
            { id: 'sink', type: 'corpus.Sink' }
          ],
          // `tryRemove` is a handshake only when it has connections — with none, the Repeater
          // is never told to wait. The wire is what puts this node into the waiting state.
          connections: [{ sourceId: 'item', sourcePort: 'tryRemove', targetId: 'sink', targetPort: 'noop' }]
        }
      ]
    } as never
  });
}

describe('ERG-001 §4: Repeater Item Remove Completed', () => {
  it('publishes Done, Unchanged and Completed — and no Failure, because it cannot fail', async () => {
    const graph = await repeaterItemGraph();
    const item = graph.node('item');

    expect(item.hasOutput('done')).toBe(true);
    expect(item.hasOutput('unchanged')).toBe(true);
    expect(item.hasOutput('completed')).toBe(true);
    // (pinned control) Pulsing `Remove Completed` outside a removal handshake is a no-op an
    // author may perfectly well have written on purpose, not an error.
    expect(item.hasOutput('failure')).toBe(false);
  });

  it('reports Done and releases the removal when the Repeater is waiting', async () => {
    const graph = await repeaterItemGraph();
    const item = graph.node<ForEachActionsTestNode>('item');

    let released = false;
    item.tryRemove(() => {
      released = true;
    });
    await graph.settle(2);

    pulse(graph, 'item', 'removeCompleted');
    await graph.settle(2);

    expect(released).toBe(true);
    expect(outcomesOf(graph, 'item')).toEqual(['done']);
    const signals = graph.signalsFor('item');
    expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
  });

  it('reports Unchanged when nothing was waiting to be completed', async () => {
    const graph = await repeaterItemGraph();
    await graph.settle(2);

    pulse(graph, 'item', 'removeCompleted');
    await graph.settle(2);

    // The line §0 names: silent whether or not there was a handshake to complete.
    expect(outcomesOf(graph, 'item')).toEqual(['unchanged']);
    expect(countOf(graph, 'item', 'completed')).toBe(1);
    expect(graph.errors).toEqual([]);
  });

  it('reports Unchanged for a second Remove Completed, and does not call the callback twice', async () => {
    const graph = await repeaterItemGraph();
    const item = graph.node<ForEachActionsTestNode>('item');

    let releases = 0;
    item.tryRemove(() => {
      releases++;
    });
    await graph.settle(2);

    pulse(graph, 'item', 'removeCompleted');
    pulse(graph, 'item', 'removeCompleted');
    await graph.settle(2);

    // NV-iii, in the node whose whole job is a one-shot handshake: the callback was never
    // cleared, so the second pulse called it again and reported the same thing twice.
    expect(releases).toBe(1);
    expect(outcomesOf(graph, 'item')).toEqual(['done', 'unchanged']);
  });
});
