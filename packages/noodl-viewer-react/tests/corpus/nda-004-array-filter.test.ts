/**
 * NDA-004 §2 — Array Filter, the Array family's mixed case.
 *
 * Its five siblings were decided in batch 3 and this one was deliberately left ⏳, because the
 * question the family poses — *is the trigger an author `Do`, or a value arriving?* — has both
 * answers here. `scheduleFilter` is reached six ways: the `Filter` and `Refresh` signals, and,
 * only when `filter` is not wired, the `items` setter, the `enabled` setter, any `filter…`
 * setting arriving, and the source collection's own change callback. A raise in the scheduler
 * fires on the ordinary boot path — the Object node's trap, in a node that also has a real `Do`.
 *
 * The distinction turned out to exist already, in inverted form: every value-arrival path is
 * guarded by `isInputConnected('filter') === false`. What was missing was a record of *which*
 * kind of run the deferred callback is running, which is all `filterRequested` is.
 *
 * ## Two failures, and the triage predicted one
 *
 * The register's entry was about the scheduler's `if (!this._internal.collection) return;`. It is
 * real: `Filter` on a node with nothing on `Items` did nothing, said nothing, and did not even
 * fire `Filtered`, so a graph waiting on it stopped dead with no explanation.
 *
 * The second is the more damaging and nobody predicted it. `applyFilter` builds a `RegExp` from
 * the author's `Value` port **per item**, so a malformed pattern — a bare `[`, a stray `(` —
 * throws out of a *scheduled callback*. `nodecontext.ts`'s blanket catch turns that into a
 * console line with no code and no provenance, and abandons the rest of the node's update pass.
 * That is Clear Array's shape (an uncaught `TypeError` from an ordinary authoring mistake),
 * reachable here from a typo in a text field — and the `Value` port is connectable, so a wire
 * can deliver one too.
 *
 * The two are gated differently on purpose. "No array yet" is a state the graph passes through on
 * its way to working, so it reports only when an author asked. A pattern that cannot compile is
 * wrong whenever it arrives, and is never such a state.
 */

/* eslint-env jest */

import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import FilterCollectionModule = require('@noodl/runtime/src/nodes/std-library/data/filtercollectionnode');

interface TriggerInstance extends NodeInstance {
  go(): void;
  send(value: unknown): void;
}

/** A `Do` pulse and one settable value output, the corpus's usual pair. */
const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: {
      go: { type: 'signal' },
      value: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.value;
        }
      }
    },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      },
      send(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      }
    }
  }
};

/** `Collection.get(name)` is a process-wide registry, so every row needs its own name. */
let arrayCounter = 0;
function freshArray(items: Array<Record<string, unknown>>): { id: string; collection: ReturnType<typeof Collection.get> } {
  const id = 'corpus-filter-array-' + ++arrayCounter;
  const collection = Collection.get(id);
  collection.set(
    items.map((data, i) => {
      const model = Model.get(id + '-item-' + i);
      // `Model.get` takes an id only; the data goes on afterwards, which is also how
      // `applyFilter` reads it — off `m.data`, not through the accessors.
      for (const key in data) model.set(key, data[key]);
      return model;
    })
  );
  return { id, collection };
}

/**
 * An Array Filter wired to a Trigger.
 *
 * `wireFilter` is the axis that matters: with the `Filter` signal connected, every value-arrival
 * path stops scheduling, and the node's only runs are the ones an author asked for. Without it,
 * the node recomputes on every arrival — which is the boot path the guard exists to stay quiet on.
 */
async function filterGraph(options: {
  wireFilter?: boolean;
  parameters?: Record<string, unknown>;
}): Promise<CorpusGraph> {
  const connections: Array<Record<string, string>> = [
    { sourceId: 'trigger', sourcePort: 'value', targetId: 'filter', targetPort: 'items' }
  ];
  if (options.wireFilter !== false) {
    connections.push({ sourceId: 'trigger', sourcePort: 'go', targetId: 'filter', targetPort: 'filter' });
  }

  const graph = await createCorpusGraph({
    modules: [TriggerModule, FilterCollectionModule as unknown as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'filter', type: 'Filter Collection', parameters: options.parameters || {} }
          ],
          connections
        }
      ]
    } as never
  });

  await graph.settle(3);
  return graph;
}

describe('NDA-004 §2: Array Filter — a Do with nothing to filter', () => {
  test('fires Failure instead of doing nothing quietly', async () => {
    const graph = await filterGraph({});
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.signalsFor('filter')).toContain('failure');
    // Not even `Filtered` fired, so a graph sequenced off this node stopped dead.
    expect(graph.signalsFor('filter')).not.toContain('modified');
  });

  test('the diagnosis reaches the runtime channel and names the input', async () => {
    const graph = await filterGraph({});
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    const raised = graph.errors.filter((e) => e.code === 'array-filter/no-items');
    expect(raised).toHaveLength(1);
    expect(raised[0].message).toMatch(/Items/);
    expect(graph.node('filter').getOutput('error').value).toMatch(/Items/);
  });

  /**
   * ✅ The control the whole ⏳ deferral was about.
   *
   * Nothing is wired to `Filter` here, so the node recomputes on every value arrival — which is
   * exactly the boot path. The scheduler reaches its `!collection` branch on the `enabled`
   * default alone, and must be silent there. Without the `requested` gate this is a `Failure` on
   * a graph that has done nothing wrong yet.
   */
  test('(pinned control) booting with no array and no Do raises nothing', async () => {
    // `enabled` as a *parameter*, so its setter runs at construction and schedules a run before
    // anything has arrived on `Items`. A first draft of this control set no parameters at all and
    // stayed green with the gate removed — the scheduler was simply never reached, so the row
    // pinned nothing. This is the boot path the deferral was about, reproduced rather than
    // assumed.
    const graph = await filterGraph({ wireFilter: false, parameters: { enabled: true } });
    await graph.settle(4);

    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('filter')).toEqual([]);
  });

  /**
   * ✅ The other half of the same control, and the one an author actually hits.
   *
   * An upstream node that has nothing yet — a Query Records before its first fetch — sends
   * `null` down the wire, and `null` reaches the setter where `undefined` would not
   * (`Node.sendValue` drops only `undefined`). That unbinds the collection and schedules a run,
   * with no author having asked for anything.
   */
  test('(pinned control) an upstream array that is still null raises nothing', async () => {
    const graph = await filterGraph({ wireFilter: false });

    graph.node<TriggerInstance>('trigger').send(null);
    await graph.settle(4);

    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('filter')).toEqual([]);
  });

  // ✅ Pinned control. An array arriving is not a request either.
  test('(pinned control) an array arriving on Items filters and raises nothing', async () => {
    const graph = await filterGraph({ wireFilter: false });
    const { collection } = freshArray([{ n: 1 }, { n: 2 }]);

    graph.node<TriggerInstance>('trigger').send(collection);
    await graph.settle(4);

    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('filter')).toEqual(['modified']);
    expect(graph.node('filter').getOutput('count').value).toBe(2);
  });

  // ✅ Pinned control. The happy path with the Do wired: still works, still says Filtered.
  test('(pinned control) a Do with an array filters, says Filtered, and raises nothing', async () => {
    const graph = await filterGraph({
      parameters: { filterFilter: 'n', 'filterFilterOp-n': 'gt', 'filterFilterValue-n': 1 }
    });
    const { collection } = freshArray([{ n: 1 }, { n: 2 }, { n: 3 }]);

    graph.node<TriggerInstance>('trigger').send(collection);
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    // ERG-001 §4 added `done` and `completed` after the existing `Filtered`, in that order and
    // after the values are flagged. The row's claim is unchanged.
    expect(graph.signalsFor('filter')).toEqual(['modified', 'done', 'completed']);
    expect(graph.errors).toEqual([]);
    expect(graph.node('filter').getOutput('count').value).toBe(2);
  });
});

describe('NDA-004 §2: Array Filter — a pattern that cannot compile', () => {
  const BAD_REGEX = { filterFilter: 'name', 'filterFilterOp-name': 'regex', 'filterFilterValue-name': '[' };

  test('reports instead of throwing out of a scheduled callback', async () => {
    const graph = await filterGraph({ parameters: BAD_REGEX });
    const { collection } = freshArray([{ name: 'alice' }]);

    graph.node<TriggerInstance>('trigger').send(collection);
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    expect(graph.signalsFor('filter')).toContain('failure');
    expect(graph.signalsFor('filter')).not.toContain('modified');

    // The structure of the report is the claim, not "it did not crash": `nodecontext.ts` already
    // swallows every throw out of an input setter, so "no exception escaped" would pass with the
    // fix removed. A code, a message and a node id are what did not exist before.
    const raised = graph.errors.filter((e) => e.code === 'array-filter/filter-failed');
    expect(raised).toHaveLength(1);
    expect(raised[0].nodeId).toBe('filter');
    expect(raised[0].message).toMatch(/could not be applied/);
    expect(graph.node('filter').getOutput('error').value).toMatch(/could not be applied/);
  });

  /**
   * The second gate, and the difference from the first failure. A malformed pattern is wrong
   * whenever it arrives — it is never a state the graph passes through on its way to working —
   * so unlike "no array yet" this one does not wait to be asked.
   */
  test('reports on a value-arrival run too, with no Do wired at all', async () => {
    const graph = await filterGraph({ wireFilter: false, parameters: BAD_REGEX });
    const { collection } = freshArray([{ name: 'alice' }]);

    graph.node<TriggerInstance>('trigger').send(collection);
    await graph.settle(4);

    expect(graph.errors.map((e) => e.code)).toEqual(['array-filter/filter-failed']);
  });

  // ✅ Pinned control. A pattern that does compile still filters.
  test('(pinned control) a valid pattern filters and raises nothing', async () => {
    const graph = await filterGraph({
      parameters: { filterFilter: 'name', 'filterFilterOp-name': 'regex', 'filterFilterValue-name': '^a' }
    });
    const { collection } = freshArray([{ name: 'alice' }, { name: 'bob' }]);

    graph.node<TriggerInstance>('trigger').send(collection);
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    expect(graph.errors).toEqual([]);
    expect(graph.node('filter').getOutput('count').value).toBe(1);
  });
});

describe('NDA-004 §2: Array Filter — the ports', () => {
  /**
   * `signalsFor` records a port name *before* delegating, and `sendSignalOnOutput` on a name the
   * node lacks only logs — so deleting the `failure` output leaves every row above green.
   */
  test('the ports exist on the node, not just in the signal log', async () => {
    const graph = await filterGraph({});
    const node = graph.node('filter');

    expect(node.hasOutput('modified')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    expect(node.hasOutput('error')).toBe(true);
  });
});
