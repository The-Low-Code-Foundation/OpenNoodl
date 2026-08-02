/**
 * ERG-001 §4 — the outcome contract on `Filter Records` (`FilterDBModels`).
 *
 * This is **`Array Filter`'s documented twin** — NDA-004 §2 called them so and read both — and the
 * two are adopted in one commit. Its sibling's rows are in
 * `packages/noodl-viewer-react/tests/corpus/erg-001-data-filter-outcomes.test.ts`, which carries
 * the family's reasoning in full; only what is specific to this node is repeated here.
 *
 * | Action ports | Shape |
 * |---|---|
 * | `Filter` | `done` **added** · `completed`; existing `failure` kept |
 *
 * ## ⚠️ `Filtered` is added beside, not renamed to `Done`
 *
 * `modified` is a value-level announcement, not this invocation's outcome: it fires from the
 * `items` setter, the `enabled` setter, the visual filter and sorting setters, each `fp-` filter
 * parameter, the bound collection's `change` callback and the cloud store's `save` event — every
 * one of them ticked by default under Run On Value Change. Renaming it would fire `Done` on the
 * boot path while `Completed`, which only an invocation may emit, stayed silent. That is Rule 2
 * broken in the one place its whole value lies. `For Each`'s `Items Rendered` decision, a sixth
 * time.
 *
 * The node's own `Filtered` description already says it fires "including when the same records
 * come back" — a result, not a no-op — which is why there is **no `Unchanged`** here either: the
 * filter builds a fresh `Collection.create(...)` every run and has no post-condition that can
 * already hold.
 *
 * ## What reverting reddens — predicted before running, then measured
 *
 * | Revert | Predicted | Actual |
 * |---|---|---|
 * | the token minted in `scheduleFilter` rather than at the `Filter` port | the three "reports nothing" rows | **3, those rows** |
 * | the token minted *inside* the `collectionChangedScheduled` guard | the two-pulses row only | **1, that row** |
 * | `reportFailure` settling the tokens after its message dedup returns | the repeated-failure row only | **1, that row** |
 */

/* eslint-env jest */

/**
 * `initialize` subscribes to `CloudStore.instance`, a lazy singleton that reads project metadata
 * off `NoodlRuntime.instance` — absent here, so the node throws before it exists. Stubbed exactly
 * as `nda-004-filter-records.test.ts` stubs it; these rows are about the filter's own paths.
 */
jest.mock('../../src/api/cloudstore', () => ({
  instance: {
    on() {
      /* 'save'; nothing here emits it */
    },
    off() {
      /* symmetry */
    }
  },
  forBackend() {
    return undefined;
  },
  invalidateCollections() {
    /* the editor half; unreachable without `setup` */
  }
}));

import type { CollectionLike, ModelLike, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import Collection = require('../../src/collection');
import Model = require('../../src/model');
import FilterDbModelsModule = require('../../src/nodes/std-library/data/filterdbmodelsnode');

/**
 * ⚠️ `failure` is the one name this node uses for **both** an outcome and a value-level
 * announcement — the ungated "this filter cannot be built" path emits it with no token — so a row
 * about a *pulse's* failure reads from a mark taken before the pulse. Its twin's file records the
 * same trap; a first draft asserted over the whole log and counted the binding's announcement as a
 * second outcome.
 */
function outcomesOf(graph: CorpusGraph, id: string, from = 0): string[] {
  return graph
    .signalsFor(id)
    .slice(from)
    .filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(graph: CorpusGraph, id: string, signal: string, from = 0): number {
  return graph
    .signalsFor(id)
    .slice(from)
    .filter((s) => s === signal).length;
}

/** How many signals a node has already sent — the cut point for the two helpers above. */
function mark(graph: CorpusGraph, id: string): number {
  return graph.signalsFor(id).length;
}

function pulse(graph: CorpusGraph, id: string, port: string): void {
  const node = graph.node(id);
  node.setInputValue(port, false);
  node.setInputValue(port, true);
}

/** `Collection.get(name)` is a process-wide registry, so every row needs its own name. */
let arrayCounter = 0;
function freshRecords(rows: Array<Record<string, unknown>>): CollectionLike {
  const id = 'erg-filter-records-' + ++arrayCounter;
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

async function filterGraph(parameters: Record<string, unknown> = {}): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [FilterDbModelsModule as unknown as NodeModule],
    data: {
      components: [
        { name: '/root', nodes: [{ id: 'records', type: 'FilterDBModels', parameters }], connections: [] }
      ]
    } as never
  });
  await graph.settle(3);
  return graph;
}

/**
 * A visual filter that cannot be applied.
 *
 * ⚠️ **Most malformed filters do not throw — they are dropped.** An unknown operator, an
 * unresolved `input` port and a missing `property` all return `null` from `visualQueryToNeutral`,
 * which the Parse family's optional-filter-port behaviour requires: an unconnected filter port
 * means "do not filter by this", and every graph relies on it. A first draft of these rows used a
 * bogus operator and filtered nothing at all, quietly reporting `Done`.
 *
 * A `related to` rule with no `relationProperty` is one that genuinely reaches
 * `FilterTranslationError` — `walk.ts` refuses a `relatedTo` with no key — so the throw lands
 * where the node's `try` is, out of a *scheduled callback*.
 */
const BROKEN_FILTER = {
  visualFilter: { combinator: 'and', rules: [{ operator: 'related to', value: 'some-record-id' }] }
};

describe('ERG-001 §4: Filter Records', () => {
  test('a Filter reports Done then Completed, beside the existing Filtered', async () => {
    const graph = await filterGraph();
    graph.node('records').setInputValue('items', freshRecords([{ n: 1 }, { n: 2 }]));
    await graph.settle(3);

    pulse(graph, 'records', 'filter');
    await graph.settle(3);

    const signals = graph.signalsFor('records');
    expect(outcomesOf(graph, 'records')).toEqual(['done']);
    expect(countOf(graph, 'records', 'completed')).toBe(1);
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
    expect(signals.lastIndexOf('done')).toBeGreaterThan(signals.lastIndexOf('modified'));
  });

  test('records arriving on Items announce Filtered and report no outcome', async () => {
    const graph = await filterGraph();
    graph.node('records').setInputValue('items', freshRecords([{ n: 1 }]));
    await graph.settle(4);

    expect(graph.signalsFor('records')).toEqual(['modified']);
    expect(graph.signalsFor('records')).not.toContain('completed');
  });

  test('the Enabled setter re-filters and reports no outcome', async () => {
    const graph = await filterGraph();
    graph.node('records').setInputValue('items', freshRecords([{ n: 1 }]));
    await graph.settle(3);

    graph.node('records').setInputValue('enabled', false);
    await graph.settle(3);

    expect(countOf(graph, 'records', 'modified')).toBe(2);
    expect(outcomesOf(graph, 'records')).toEqual([]);
    expect(graph.signalsFor('records')).not.toContain('completed');
  });

  test('the bound records changing re-filter and report no outcome', async () => {
    const graph = await filterGraph();
    const collection = freshRecords([{ n: 1 }]);
    graph.node('records').setInputValue('items', collection);
    await graph.settle(3);

    collection.add((Model as { get(id: string): ModelLike }).get('erg-filter-records-extra'));
    await graph.settle(4);

    expect(countOf(graph, 'records', 'modified')).toBe(2);
    expect(outcomesOf(graph, 'records')).toEqual([]);
  });

  test('two Filter pulses in one pass coalesce into one run and still report two outcomes', async () => {
    const graph = await filterGraph();
    graph.node('records').setInputValue('items', freshRecords([{ n: 1 }]));
    await graph.settle(3);

    pulse(graph, 'records', 'filter');
    pulse(graph, 'records', 'filter');
    await graph.settle(3);

    expect(countOf(graph, 'records', 'modified')).toBe(2);
    expect(outcomesOf(graph, 'records')).toEqual(['done', 'done']);
    expect(countOf(graph, 'records', 'completed')).toBe(2);
  });

  test('a Filter with nothing on Items reports Failure then Completed', async () => {
    const graph = await filterGraph();
    pulse(graph, 'records', 'filter');
    await graph.settle(3);

    expect(outcomesOf(graph, 'records')).toEqual(['failure']);
    expect(countOf(graph, 'records', 'completed')).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['filter-records/no-items']);
  });

  test('a Filter whose filter cannot be built reports Failure then Completed', async () => {
    const graph = await filterGraph(BROKEN_FILTER);
    graph.node('records').setInputValue('items', freshRecords([{ name: 'alice' }]));
    await graph.settle(3);

    // ⚠️ The binding above already ran the filter and *announced* the failure, ungated.
    const before = mark(graph, 'records');
    pulse(graph, 'records', 'filter');
    await graph.settle(3);

    expect(outcomesOf(graph, 'records', before)).toEqual(['failure']);
    expect(countOf(graph, 'records', 'completed', before)).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['filter-records/filter-failed']);
  });

  /** ⚠️ The other half of "only the port mints" — the ungated failure path is an announcement. */
  test('a filter that cannot be built on a value-arrival run announces Failure and reports no outcome', async () => {
    const graph = await filterGraph(BROKEN_FILTER);
    graph.node('records').setInputValue('items', freshRecords([{ name: 'alice' }]));
    await graph.settle(4);

    expect(graph.signalsFor('records')).toEqual(['failure']);
    expect(graph.signalsFor('records')).not.toContain('completed');
  });

  /** ⚠️ The announcement is deduped by message; the outcome is per invocation and is not. */
  test('a second Filter with the same broken filter still reports its own Failure', async () => {
    const graph = await filterGraph(BROKEN_FILTER);
    graph.node('records').setInputValue('items', freshRecords([{ name: 'alice' }]));
    await graph.settle(3);

    const before = mark(graph, 'records');
    pulse(graph, 'records', 'filter');
    await graph.settle(3);
    pulse(graph, 'records', 'filter');
    await graph.settle(3);

    expect(outcomesOf(graph, 'records', before)).toEqual(['failure', 'failure']);
    expect(countOf(graph, 'records', 'completed', before)).toBe(2);
    // One raise across all three runs — the console dedup is untouched.
    expect(graph.errors.map((e) => e.code)).toEqual(['filter-records/filter-failed']);
  });

  test('(pinned control) has Done, Failure and Completed and no Unchanged', async () => {
    const graph = await filterGraph();
    const node = graph.node('records');
    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('completed')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    expect(node.hasOutput('unchanged')).toBe(false);
    expect(node.hasOutput('modified')).toBe(true);
  });

  test('(pinned control) booting with parameters reports nothing at all', async () => {
    const graph = await filterGraph({ enabled: true });
    await graph.settle(4);

    expect(graph.signalsFor('records')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });
});
