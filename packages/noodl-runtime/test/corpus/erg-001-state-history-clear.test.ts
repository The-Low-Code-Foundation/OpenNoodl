/**
 * ERG-001 §4 — `State History`'s `Clear History`, §0.3's "emits nothing at all" table.
 *
 * > | `net.noodl.StateHistory` — State History | Clear History | nothing (`statehistorynode.ts:177-181`) |
 *
 * The handler deferred to `stateHistoryManager.clearHistory`, which returns `void` and whose
 * first line is `if (!record) return;`. So three quite different things — the history was thrown
 * away, there was nothing to throw away, or no history is being tracked at all — were one
 * silence, and a graph wiring "clear, then refresh the list" had nothing to wire.
 *
 * ⚠️ **`clearHistory`'s signature had to change**, which is the same shape as the note §4 left
 * open against `GlobalStore.Set`: a `void` return cannot carry an outcome. Here the change is
 * safe to make because the manager is internal to this pair of nodes and every caller is in the
 * repo — which is exactly what was *not* established for `setKey`.
 *
 * ⚠️ **Two of those three are the same outcome, and a pinned control is what established it.**
 * The first version of this adoption gave the untracked-store path a `Failure`; NDA-004's
 * "(pinned control) State History deliberately has no Failure port" reddened, and it was right —
 * see the untracked row below.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | `clearHistory` back to `void` + an unconditional `done` | the two `Unchanged` rows and the second-clear row; the real-clear row stays green |
 * | drop the `unchanged` branch only | the baseline and second-clear rows; the untracked row stays green, because it takes the `not-tracking` path |
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import StateHistoryNode = require('../../src/nodes/std-library/agent/statehistorynode');
import SetGlobalStoreNode = require('../../src/nodes/std-library/agent/globalstoresetnode');

import { globalStoreManager } from '../../src/nodes/std-library/agent/globalstore';
import { stateHistoryManager } from '../../src/nodes/std-library/agent/statehistory';

interface TriggerInstance extends NodeInstance {
  go(): void;
}

const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: { go: { type: 'signal' } },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      }
    }
  }
};

beforeEach(() => {
  globalStoreManager.reset({ clearState: true });
  stateHistoryManager.reset();
});

/**
 * A tracker on `app` with `entries` recorded writes behind it, and a `Clear History` wire.
 *
 * `storeName` is deliberately the parameter and not a wire: FINDINGS **A-D1** — a declared
 * `default` never runs its setter, and `nodeScopeDidInitialize` is what makes this node attach
 * without one.
 */
async function historyGraph(entries: number, storeName = 'app'): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, StateHistoryNode as unknown as NodeModule, SetGlobalStoreNode as unknown as NodeModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'target', type: 'net.noodl.StateHistory', parameters: { storeName } }
          ],
          connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'target', targetPort: 'clearHistory' }]
        }
      ]
    } as never
  });

  await graph.settle(4);
  for (let i = 0; i < entries; i++) {
    globalStoreManager.setKey(storeName, 'k', i + 1);
    await graph.settle(2);
  }
  return graph;
}

function outcomesOf(graph: CorpusGraph): string[] {
  return graph.signalsFor('target').filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

describe('ERG-001 §4: State History — Clear History', () => {
  test('the node declares Done, Unchanged and Completed — and no Failure it cannot reach', async () => {
    const graph = await historyGraph(0);
    const node = graph.node('target');

    for (const port of ['done', 'unchanged', 'completed']) {
      expect(node.hasOutput(port)).toBe(true);
    }
    // ⚠️ NDA-004 measured this node as 🔵 — its `storeName` setter normalises, so there is no
    // target it can be asked for and fail to find — and left a pinned control in
    // `statehistory.test.ts` saying so. That control caught the first version of this adoption,
    // which had minted a `Failure` for the untracked-store path. See the row below.
    expect(node.hasOutput('failure')).toBe(false);
  });

  test('clearing a history that has entries reports Done, then Completed', async () => {
    const graph = await historyGraph(3);
    expect(graph.node('target').getOutput('historySize').value).toBeGreaterThan(1);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    expect(outcomesOf(graph)).toEqual(['done']);
    expect(graph.signalsFor('target')).toContain('completed');
    expect(graph.node('target').getOutput('historySize').value).toBe(1);
    expect(graph.errors).toEqual([]);
  });

  test('clearing a history that is already just its baseline is Unchanged', async () => {
    const graph = await historyGraph(0);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    // Nothing was thrown away, because there was nothing to throw away. Not a failure — the
    // author asked for an empty history and has one.
    expect(outcomesOf(graph)).toEqual(['unchanged']);
    expect(graph.signalsFor('target')).toContain('completed');
    expect(graph.errors).toEqual([]);
  });

  test('a second Clear straight after a real one is Unchanged', async () => {
    const graph = await historyGraph(2);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    expect(outcomesOf(graph)).toEqual(['done', 'unchanged']);
  });

  /**
   * ⚠️ The row NDA-004's pinned control corrected.
   *
   * A store nothing is tracking is only reachable as a one-frame race — a `Clear History`
   * landing in the same frame as a `Store Name` change, before `setupTracking` has run — because
   * this node *is* the tracker for its own store name. Nothing was thrown away and nothing is
   * wrong with the graph, so it is `Unchanged`, and it raises nothing.
   */
  test('clearing a store nothing is tracking is Unchanged, not a Failure at a correct graph', async () => {
    const graph = await historyGraph(0);

    stateHistoryManager.reset();

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    expect(outcomesOf(graph)).toEqual(['unchanged']);
    expect(graph.signalsFor('target')).toContain('completed');
    expect(graph.errors).toEqual([]);
  });

  test('(control) an untouched tracker fires nothing at all — the trigger is an author Do', async () => {
    const graph = await historyGraph(3);

    expect(graph.signalsFor('target').filter((s) => s !== 'historyChanged')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });
});
