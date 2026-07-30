/**
 * NDA-004 §2, register ⏳ item 7 — Filter Records, which is Array Filter's twin.
 *
 * The register grouped them, and the phase's own warning is that a grouping predicts where to
 * read next and nothing about what the read will find. So this one was read rather than assumed:
 * same six trigger paths (the `Filter` signal, and — only when `filter` is not wired — the `items`
 * setter, the `enabled` setter, the visual filter and sorting setters, each filter parameter, and
 * the source collection's change callback), the same `isInputConnected('filter') === false` guard
 * on every value-arrival one, and the same bare `if (!this._internal.collection) return;`.
 *
 * It is genuinely the same defect, so it gets the same fix: a flag recording whether an author
 * asked for this run, because a raise in the scheduler would otherwise fire while the graph boots.
 * That is the Object node's trap, and it is what kept both of these ⏳ when their siblings were
 * decided.
 *
 * The second failure is the same shape too, in the same position: `convertVisualFilter` /
 * `matchesQuery` throwing out of a *scheduled callback* into `nodecontext.ts`'s blanket catch — a
 * console line with no code and no provenance, and the rest of the node's update pass abandoned.
 * Unlike "no records yet" it is not gated on the trigger, because a filter that cannot be applied
 * is wrong whenever it arrives.
 */

/* eslint-env jest */

/**
 * `initialize` does `CloudStore.instance.on('save', …)` to re-filter when a record is written,
 * and `CloudStore.instance` is a lazy singleton that reads project metadata off
 * `NoodlRuntime.instance` — absent here, so the node throws before it exists. Stubbed rather than
 * stood up: the rows are about the filter's own failure paths, not about cloud writes.
 */
jest.mock('../../src/api/cloudstore', () => ({
  instance: {
    on() {
      /* 'save'; nothing here emits it */
    },
    off() {
      /* symmetry */
    }
  }
}));

import type { CollectionLike, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import Collection = require('../../src/collection');
import Model = require('../../src/model');
import FilterDbModelsModule = require('../../src/nodes/std-library/data/filterdbmodelsnode');

interface TriggerInstance extends NodeInstance {
  go(): void;
  send(value: unknown): void;
}

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

let arrayCounter = 0;

/** `Collection.get(name)` is a process-wide registry, so every row needs its own name. */
function freshRecords(rows: Array<Record<string, unknown>>): CollectionLike {
  const id = 'corpus-filter-records-' + ++arrayCounter;
  const collection = (Collection as { get(id: string): CollectionLike }).get(id);
  collection.set(
    rows.map((data, i) => {
      const model = (Model as { get(id: string): { set(k: string, v: unknown): void } }).get(id + '-row-' + i);
      for (const key in data) model.set(key, data[key]);
      return model;
    }) as never
  );
  return collection;
}

async function filterGraph(options: {
  wireFilter?: boolean;
  parameters?: Record<string, unknown>;
}): Promise<CorpusGraph> {
  const connections: Array<Record<string, string>> = [
    { sourceId: 'trigger', sourcePort: 'value', targetId: 'records', targetPort: 'items' }
  ];
  if (options.wireFilter !== false) {
    connections.push({ sourceId: 'trigger', sourcePort: 'go', targetId: 'records', targetPort: 'filter' });
  }

  const graph = await createCorpusGraph({
    modules: [TriggerModule, FilterDbModelsModule as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'records', type: 'FilterDBModels', parameters: options.parameters || {} }
          ],
          connections
        }
      ]
    } as never
  });

  await graph.settle(3);

  /**
   * Not decoration. Two of the controls below assert `signalsFor('records')` is empty and
   * `errors` is empty — and `signalsFor` on an id that does not exist returns `[]`, so a node
   * that failed to construct made them **pass vacuously**. That is exactly what happened while
   * this file was being written, and it is the harness fact 1 problem in a different disguise:
   * an assertion that cannot tell "silent" from "absent".
   */
  expect(() => graph.node('records')).not.toThrow();

  return graph;
}

describe('NDA-004 §2: Filter Records', () => {
  test('a Do with no records fires Failure instead of doing nothing quietly', async () => {
    const graph = await filterGraph({});
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.signalsFor('records')).toContain('failure');
    // Not even `Filtered` fired, so a graph sequenced off this node stopped dead.
    expect(graph.signalsFor('records')).not.toContain('modified');
    expect(graph.errors.map((e) => e.code)).toEqual(['filter-records/no-items']);
    expect(graph.node('records').getOutput('error').value).toMatch(/Items/);
  });

  /**
   * ✅ The control the ⏳ deferral was about, and the reason the flag exists.
   *
   * With nothing wired to `Filter`, the node recomputes on every value arrival — `enabled` as a
   * parameter runs its setter at construction, before any records exist. Without the gate this is
   * a `Failure` on a graph that has done nothing wrong yet, which the contract calls worse than
   * having no port at all.
   */
  test('(pinned control) booting with no records and no Do raises nothing', async () => {
    const graph = await filterGraph({ wireFilter: false, parameters: { enabled: true } });
    await graph.settle(4);

    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('records')).toEqual([]);
  });

  // ✅ Pinned control. `null` from an upstream Query Records that has not fetched yet reaches the
  // setter where `undefined` would not (`Node.sendValue` drops only `undefined`).
  test('(pinned control) an upstream query that is still null raises nothing', async () => {
    const graph = await filterGraph({ wireFilter: false });

    graph.node<TriggerInstance>('trigger').send(null);
    await graph.settle(4);

    expect(graph.errors).toEqual([]);
    expect(graph.signalsFor('records')).toEqual([]);
  });

  // ✅ Pinned control. The happy path still works and still says Filtered.
  test('(pinned control) a Do with records filters, says Filtered, and raises nothing', async () => {
    const graph = await filterGraph({});
    graph.node<TriggerInstance>('trigger').send(freshRecords([{ n: 1 }, { n: 2 }]));
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    expect(graph.signalsFor('records')).toEqual(['modified']);
    expect(graph.errors).toEqual([]);
    expect(graph.node('records').getOutput('count').value).toBe(2);
  });

  /**
   * `signalsFor` records a port name *before* delegating, and `sendSignalOnOutput` on a name the
   * node lacks only logs — so deleting the `failure` output leaves every row above green.
   */
  test('the ports exist on the node, not just in the signal log', async () => {
    const graph = await filterGraph({});
    const node = graph.node('records');

    expect(node.hasOutput('modified')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    expect(node.hasOutput('error')).toBe(true);
  });
});
