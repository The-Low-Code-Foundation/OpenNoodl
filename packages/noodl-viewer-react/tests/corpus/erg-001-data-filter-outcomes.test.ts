/**
 * ERG-001 §4 — the outcome contract on the three remaining single-verb Data nodes that live in
 * `noodl-viewer-react`: `Array Filter`, `Array Map` and `Set Variable`.
 *
 * `Array Filter`'s documented twin **`Filter Records` (`FilterDBModels`) is a `noodl-runtime`
 * source** and its rows are in `packages/noodl-runtime/test/corpus/erg-001-filter-records-
 * outcomes.test.ts`. NDA-004 §2 called them twins and read both; they are built in one commit for
 * the reason `outcome.ts`'s docstring gives — doing half of a documented pair manufactures the
 * divergence the contract exists to stop.
 *
 * | Node | Action ports | Shape |
 * |---|---|---|
 * | `Filter Collection` — Array Filter | `Filter`, `Refresh` | `done` **added** · `completed`; existing `failure` kept |
 * | `Map Collection` — Array Map | `Refresh` | `done` **added** · `completed`; existing `failure` kept |
 * | `Set Variable` — Set Variable | `Do` | `completed` **added** to the `done`/`failure` it already had |
 *
 * ## ⚠️ `Filtered` / `Changed` is **added beside**, not renamed to `Done`
 *
 * The next-session prompt laid these three out as "all rename `modified` → `done`". **Reading the
 * source says otherwise, and the source wins.**
 *
 * `modified` is not this node's outcome — it is a *value-level* announcement that "Items is up to
 * date", and on all three nodes it fires from paths no author invoked:
 *
 * - **Array Filter** — the `items` setter, the `enabled` setter, any `filter…` panel setting
 *   arriving, and the bound collection's own `change` callback (each gated on a Run On Value
 *   Change box that is **ticked by default**).
 * - **Array Map** — the `items` and `mapScript` setters, ungated; and the bound collection's
 *   `change` callback.
 *
 * Rename it and `Done` fires on the boot path every time an array binds, while `Completed` — which
 * only an invocation may emit — does not. `Done` and `Completed` counts would diverge on a node
 * doing nothing wrong, which is Rule 2 broken in the one place its whole value lies.
 *
 * This is `For Each`'s answer, in the same directory: *"`Items Rendered` is not this invocation's
 * `Done` and could not be made into one … it is a list-level announcement and it is the right one;
 * it is simply not tied to any `Refresh`."* It is also the `Fetched`-is-not-`Done` question, which
 * the phase has now answered the same way six times. The cost — two ports that co-fire on the port
 * path — is recorded rather than hidden, exactly as it was on `Array`.
 *
 * **`Set Variable` is genuinely different and keeps its rename-free `done`:** `scheduleStore` is
 * reached from the `Do` port and from nothing else, so its `Done` already means what the contract
 * means. It needed `Completed` and the routing through `reportOutcome`, and nothing else.
 *
 * ## No `Unchanged` on any of the three
 *
 * A filter and a map rebuild a **fresh** collection unconditionally — `Collection.create(...)`
 * every run — so there is no post-condition that can already hold; "the same records came back"
 * is a result, not a no-op, and `Filter Records`' own port description already says the node fires
 * "including when the same records come back". `Set Variable` writes with `forceChange: true`
 * deliberately, so storing the identical value is still a change every Variable node hears about.
 * §5 must not be taught to expect a port on any of the three.
 *
 * ## What reverting reddens — predicted before running, then measured
 *
 * | Revert | Predicted | Actual |
 * |---|---|---|
 * | the `Filter`/`Refresh` token minted in `scheduleFilter` rather than at the ports | 5 | **10 — wrong** |
 * | Array Filter's token minted *inside* the `collectionChangedScheduled` guard | 1 | **1, that row** |
 * | Array Map's token minted in `scheduleMap` rather than at `Refresh` | 4 | **8 — wrong, same cause** |
 * | `reportFailure` settling the tokens *after* its message dedup returns | 1 | **2 — wrong, and sharper** |
 * | Set Variable's token minted in the `name` setter | 3 | **2 — wrong, and instructively** |
 * | Set Variable reporting `done` before `variablesModel.set` | **0** — no row can see it | **0** |
 *
 * ⚠️ **Four of the six predictions were wrong, and three of them the same way.** Moving a mint into
 * the scheduler reddens far more than the rows written to state "only the port mints", because
 * *every* row that binds `Items` and then pulses gets a second outcome it did not assert. That is
 * `For Each`'s recorded miss, twice more: the claim is load-bearing across the whole file rather
 * than in the two or three rows about it. The prediction was made per-row when it should have been
 * made per-fixture.
 *
 * ⚠️ **The dedup revert reddens two, not one.** The extra is the *first* pulse's row: the boot
 * binding has already announced the same message, so the pulse's failure is a repeat and its
 * outcome is swallowed too. The dedup does not merely lose the second identical failure — it loses
 * the first one that follows any value-driven run with the same message.
 *
 * ⚠️ **The Set Variable mint reddens the two counting rows and NOT the boot control**, which is the
 * opposite of what was predicted. A token minted in a setter is never settled, so nothing is
 * reported and a silence row cannot see it; what catches it is the next invocation draining the
 * stale token and reporting twice. Third measurement of that lesson in this phase.
 *
 * The last row is an honest non-discrimination rather than a quietly dropped one: nothing here
 * observes the write and the signal in the same frame, so "the outcome is the last thing an action
 * does" is correctness-by-construction on this node.
 */

/* eslint-env jest */

import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import type { CollectionLike, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import FilterCollectionModule = require('@noodl/runtime/src/nodes/std-library/data/filtercollectionnode');
import MapCollectionModule = require('@noodl/runtime/src/nodes/std-library/data/mapcollectionnode');
import SetVariableModule = require('@noodl/runtime/src/nodes/std-library/data/setvariablenode');

/**
 * The terminal outcomes a node reported.
 *
 * ⚠️ `failure` is the one signal name these nodes use for **both** an outcome and a value-level
 * announcement — the ungated "this pattern will not compile" path emits it with no token — so a
 * row about a *pulse's* failure has to read from a mark taken before the pulse. {@link mark} and
 * the `from` argument are what make that possible; a first draft asserted over the whole log and
 * counted the boot announcement as a second outcome.
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
function freshArray(items: Array<Record<string, unknown>>): CollectionLike {
  const id = 'erg-filter-array-' + ++arrayCounter;
  const collection = Collection.get(id) as CollectionLike;
  collection.set(
    items.map((data, i) => {
      const model = Model.get(id + '-item-' + i);
      for (const key in data) model.set(key, data[key]);
      return model;
    })
  );
  return collection;
}

async function graphWith(
  module: unknown,
  type: string,
  parameters: Record<string, unknown> = {}
): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [module as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'node', type, parameters }], connections: [] }]
    } as never
  });
  await graph.settle(3);
  return graph;
}

// =================================================================================================
// Array Filter
// =================================================================================================

describe('ERG-001 §4: Array Filter', () => {
  test('a Filter reports Done then Completed, beside the existing Filtered', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection');
    graph.node('node').setInputValue('items', freshArray([{ n: 1 }, { n: 2 }]));
    await graph.settle(3);

    pulse(graph, 'node', 'filter');
    await graph.settle(3);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
    expect(signals.lastIndexOf('done')).toBeGreaterThan(signals.lastIndexOf('modified'));
  });

  test('Refresh is the same invocation and reports the same way', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection');
    graph.node('node').setInputValue('items', freshArray([{ n: 1 }]));
    await graph.settle(3);

    pulse(graph, 'node', 'refresh');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
  });

  /**
   * ⚠️ The claim "only the port mints" rests on, and the row a mint moved into `scheduleFilter`
   * would redden. An array binding is a value arrival: it re-filters and says `Filtered`, and
   * nobody invoked anything.
   */
  test('an array arriving on Items announces Filtered and reports no outcome', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection');
    graph.node('node').setInputValue('items', freshArray([{ n: 1 }]));
    await graph.settle(4);

    expect(graph.signalsFor('node')).toEqual(['modified']);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });

  test('the Enabled setter re-filters and reports no outcome', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection');
    graph.node('node').setInputValue('items', freshArray([{ n: 1 }]));
    await graph.settle(3);

    graph.node('node').setInputValue('enabled', false);
    await graph.settle(3);

    expect(countOf(graph, 'node', 'modified')).toBe(2);
    expect(outcomesOf(graph, 'node')).toEqual([]);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });

  test('the bound array changing re-filters and reports no outcome', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection');
    const collection = freshArray([{ n: 1 }]);
    graph.node('node').setInputValue('items', collection);
    await graph.settle(3);

    collection.add(Model.get('erg-filter-extra'));
    await graph.settle(4);

    expect(countOf(graph, 'node', 'modified')).toBe(2);
    expect(outcomesOf(graph, 'node')).toEqual([]);
  });

  /**
   * ⚠️ The counting row. `collectionChangedScheduled` drops the second pulse's *work*, which is
   * deliberate and is how "set the fields, then press Filter" batches — but two presses are two
   * invocations and Rule 1 is about each of them. A token minted inside that guard is invisible
   * to every silence row: it is never settled, so nothing is reported at all.
   */
  test('two Filter pulses in one pass coalesce into one run and still report two outcomes', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection');
    graph.node('node').setInputValue('items', freshArray([{ n: 1 }]));
    await graph.settle(3);

    pulse(graph, 'node', 'filter');
    pulse(graph, 'node', 'filter');
    await graph.settle(3);

    expect(countOf(graph, 'node', 'modified')).toBe(2);
    expect(outcomesOf(graph, 'node')).toEqual(['done', 'done']);
    expect(countOf(graph, 'node', 'completed')).toBe(2);
  });

  test('a Filter with nothing on Items reports Failure then Completed', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection');
    pulse(graph, 'node', 'filter');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['array-filter/no-items']);
  });

  test('a Filter whose pattern will not compile reports Failure then Completed', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection', {
      filterFilter: 'name',
      'filterFilterOp-name': 'regex',
      'filterFilterValue-name': '['
    });
    graph.node('node').setInputValue('items', freshArray([{ name: 'alice' }]));
    await graph.settle(3);

    // ⚠️ The binding above already ran the filter and *announced* the failure, ungated. The mark
    // is what separates that announcement from this pulse's outcome.
    const before = mark(graph, 'node');
    pulse(graph, 'node', 'filter');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', before)).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed', before)).toBe(1);
    // One raise, not two — the console dedup is untouched by the outcome.
    expect(graph.errors.map((e) => e.code)).toEqual(['array-filter/filter-failed']);
  });

  /**
   * ⚠️ The other half of "only the port mints", on the failure side.
   *
   * A pattern that cannot compile is wrong whenever it arrives, so `reportFailure` is deliberately
   * ungated — it announces on value-arrival runs too. That announcement is not an outcome, and
   * this row is what stops the ungated path from being routed through `reportOutcome`.
   */
  test('a pattern that will not compile on a value-arrival run announces Failure and reports no outcome', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection', {
      filterFilter: 'name',
      'filterFilterOp-name': 'regex',
      'filterFilterValue-name': '['
    });
    graph.node('node').setInputValue('items', freshArray([{ name: 'alice' }]));
    await graph.settle(4);

    expect(graph.signalsFor('node')).toEqual(['failure']);
    expect(graph.signalsFor('node')).not.toContain('completed');
    expect(graph.errors.map((e) => e.code)).toEqual(['array-filter/filter-failed']);
  });

  /**
   * ⚠️ The dedup row. `reportFailure` swallows a *repeat* of the same message so a `regex` typed
   * one keystroke at a time does not produce a raise per keystroke — but an invocation that is
   * not settled is a dead chain, and Rule 1 is per invocation rather than per message. The
   * announcement is deduped; the outcome is not.
   */
  test('a second Filter with the same broken pattern still reports its own Failure', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection', {
      filterFilter: 'name',
      'filterFilterOp-name': 'regex',
      'filterFilterValue-name': '['
    });
    graph.node('node').setInputValue('items', freshArray([{ name: 'alice' }]));
    await graph.settle(3);

    const before = mark(graph, 'node');
    pulse(graph, 'node', 'filter');
    await graph.settle(3);
    pulse(graph, 'node', 'filter');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', before)).toEqual(['failure', 'failure']);
    expect(countOf(graph, 'node', 'completed', before)).toBe(2);
    // One raise across all three runs — the console dedup is untouched.
    expect(graph.errors.map((e) => e.code)).toEqual(['array-filter/filter-failed']);
  });

  test('(pinned control) has Done, Failure and Completed and no Unchanged', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection');
    const node = graph.node('node');
    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('completed')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    // A filter rebuilds a fresh collection every run; there is no no-op it can decline into.
    expect(node.hasOutput('unchanged')).toBe(false);
    // ⚠️ `not.toContain` passes vacuously once a port is gone; `modified` is *kept* here, so the
    // assertion is that it is still declared rather than that it is absent.
    expect(node.hasOutput('modified')).toBe(true);
  });

  test('(pinned control) booting with parameters reports nothing at all', async () => {
    const graph = await graphWith(FilterCollectionModule, 'Filter Collection', { enabled: true });
    await graph.settle(4);

    expect(graph.signalsFor('node')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });
});

// =================================================================================================
// Array Map
// =================================================================================================

/**
 * ⚠️ `mapScript` is passed as a **parameter** on every row that needs a working script.
 * `default: defaultMapCode` is a *declared* default and a declared default never runs its setter
 * (FINDINGS **A-D1**), so `mapFunc` is `undefined` on a node nobody has touched — which is a real
 * pre-existing defect, filed rather than fixed here, and a trap for any row that assumes the
 * default script compiled.
 */
const WORKING_MAP = { mapScript: "map({ label: 'name' })" };

describe('ERG-001 §4: Array Map', () => {
  test('a Refresh reports Done then Completed, beside the existing Changed', async () => {
    const graph = await graphWith(MapCollectionModule, 'Map Collection', WORKING_MAP);
    graph.node('node').setInputValue('items', freshArray([{ name: 'alice' }]));
    await graph.settle(3);

    pulse(graph, 'node', 'refresh');
    await graph.settle(3);

    const signals = graph.signalsFor('node');
    expect(outcomesOf(graph, 'node')).toEqual(['done']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
  });

  test('an array arriving on Items announces Changed and reports no outcome', async () => {
    const graph = await graphWith(MapCollectionModule, 'Map Collection', WORKING_MAP);
    graph.node('node').setInputValue('items', freshArray([{ name: 'alice' }]));
    await graph.settle(4);

    expect(graph.signalsFor('node')).toEqual(['modified']);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });

  test('the Script setter re-maps and reports no outcome', async () => {
    const graph = await graphWith(MapCollectionModule, 'Map Collection', WORKING_MAP);
    graph.node('node').setInputValue('items', freshArray([{ name: 'alice' }]));
    await graph.settle(3);

    graph.node('node').setInputValue('mapScript', "map({ other: 'name' })");
    await graph.settle(3);

    expect(countOf(graph, 'node', 'modified')).toBe(2);
    expect(outcomesOf(graph, 'node')).toEqual([]);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });

  test('two Refresh pulses in one pass coalesce into one run and still report two outcomes', async () => {
    const graph = await graphWith(MapCollectionModule, 'Map Collection', WORKING_MAP);
    graph.node('node').setInputValue('items', freshArray([{ name: 'alice' }]));
    await graph.settle(3);

    pulse(graph, 'node', 'refresh');
    pulse(graph, 'node', 'refresh');
    await graph.settle(3);

    expect(countOf(graph, 'node', 'modified')).toBe(2);
    expect(outcomesOf(graph, 'node')).toEqual(['done', 'done']);
    expect(countOf(graph, 'node', 'completed')).toBe(2);
  });

  test('a Refresh with nothing on Items reports Failure then Completed', async () => {
    const graph = await graphWith(MapCollectionModule, 'Map Collection', WORKING_MAP);
    pulse(graph, 'node', 'refresh');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node')).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed')).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['array-map/no-items']);
  });

  test('a Refresh whose script will not compile reports Failure then Completed', async () => {
    const graph = await graphWith(MapCollectionModule, 'Map Collection', { mapScript: 'map({' });
    graph.node('node').setInputValue('items', freshArray([{ name: 'alice' }]));
    await graph.settle(3);

    // ⚠️ As above: the binding already announced this failure ungated.
    const before = mark(graph, 'node');
    pulse(graph, 'node', 'refresh');
    await graph.settle(3);

    expect(outcomesOf(graph, 'node', before)).toEqual(['failure']);
    expect(countOf(graph, 'node', 'completed', before)).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['array-map/script-failed']);
  });

  test('a script that will not compile on a value-arrival run announces Failure and reports no outcome', async () => {
    const graph = await graphWith(MapCollectionModule, 'Map Collection', { mapScript: 'map({' });
    graph.node('node').setInputValue('items', freshArray([{ name: 'alice' }]));
    await graph.settle(4);

    expect(graph.signalsFor('node')).toEqual(['failure']);
    expect(graph.signalsFor('node')).not.toContain('completed');
  });

  test('(pinned control) has Done, Failure and Completed and no Unchanged', async () => {
    const graph = await graphWith(MapCollectionModule, 'Map Collection');
    const node = graph.node('node');
    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('completed')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    expect(node.hasOutput('unchanged')).toBe(false);
    expect(node.hasOutput('modified')).toBe(true);
  });

  test('(pinned control) booting with a script reports nothing at all', async () => {
    const graph = await graphWith(MapCollectionModule, 'Map Collection', WORKING_MAP);
    await graph.settle(4);

    expect(graph.signalsFor('node')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });
});

// =================================================================================================
// Set Variable
// =================================================================================================

/**
 * ⚠️ The node id below is `setvar`, not `set`: `Collection` patches `Array.prototype.set` as a
 * read-only property, so a node id of `'set'` fails graph construction several frames away from
 * anything a row wrote. `nda-004-item7.test.ts` records the same trap.
 */
async function setVariableGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [SetVariableModule as unknown as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'setvar', type: 'Set Variable', parameters }], connections: [] }]
    } as never
  });
  await graph.settle(3);
  return graph;
}

describe('ERG-001 §4: Set Variable', () => {
  test('a Do with a Name reports Done then Completed', async () => {
    const graph = await setVariableGraph({ name: 'erg-greeting' });
    graph.node('setvar').setInputValue('value', 'hello');
    await graph.settle(2);

    pulse(graph, 'setvar', 'do');
    await graph.settle(3);

    const signals = graph.signalsFor('setvar');
    expect(outcomesOf(graph, 'setvar')).toEqual(['done']);
    expect(countOf(graph, 'setvar', 'completed')).toBe(1);
    expect(signals.lastIndexOf('completed')).toBeGreaterThan(signals.lastIndexOf('done'));
  });

  test('a Do with no Name reports Failure then Completed, with the reason on the channel', async () => {
    const graph = await setVariableGraph({});
    pulse(graph, 'setvar', 'do');
    await graph.settle(3);

    expect(outcomesOf(graph, 'setvar')).toEqual(['failure']);
    expect(countOf(graph, 'setvar', 'completed')).toBe(1);
    expect(graph.errors.map((e) => e.code)).toEqual(['set-variable/no-name']);
    expect(graph.node('setvar').getOutput('error').value).toMatch(/variable name/);
  });

  test('two Do pulses in one pass coalesce into one write and still report two outcomes', async () => {
    const graph = await setVariableGraph({ name: 'erg-greeting-2' });
    graph.node('setvar').setInputValue('value', 'hello');
    await graph.settle(2);

    pulse(graph, 'setvar', 'do');
    pulse(graph, 'setvar', 'do');
    await graph.settle(3);

    expect(outcomesOf(graph, 'setvar')).toEqual(['done', 'done']);
    expect(countOf(graph, 'setvar', 'completed')).toBe(2);
  });

  test('a Value arriving on its own reports nothing and writes nothing', async () => {
    const graph = await setVariableGraph({ name: 'erg-greeting-3' });
    graph.node('setvar').setInputValue('value', 'hello');
    await graph.settle(4);

    expect(graph.signalsFor('setvar')).toEqual([]);
  });

  test('(pinned control) has Done, Failure and Completed and no Unchanged', async () => {
    const graph = await setVariableGraph({});
    const node = graph.node('setvar');
    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('completed')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    // `forceChange: true` is deliberate: storing the identical value still notifies every
    // Variable node reading it, so there is no no-op to declare.
    expect(node.hasOutput('unchanged')).toBe(false);
  });

  /**
   * ⚠️ The boot control, and it is load-bearing. A `name` **parameter** applied at boot runs the
   * `name` setter — NDA-017's "a saved project applies a parameter before the port exists" by a
   * second road, and the exact revert that reddened the equivalent control on `Variable` last
   * session. A mint moved into that setter reports `Done` before anything was invoked.
   */
  test('(pinned control) booting with a Name parameter reports nothing at all', async () => {
    const graph = await setVariableGraph({ name: 'erg-greeting-4', setWith: 'string' });
    await graph.settle(4);

    expect(graph.signalsFor('setvar')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });
});
