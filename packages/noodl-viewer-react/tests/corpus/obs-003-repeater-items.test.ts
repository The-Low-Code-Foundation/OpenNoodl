/**
 * OBS-003 — `repeater/items-not-a-collection`.
 *
 * See `dev-docs/reference/DIAGNOSTICS-CONTRACT.md`. A diagnostic rather than a raised failure,
 * because it is a **predicate**: the wrong value sits on the port until the author rewires it,
 * and `Items` is not an action, so there is no invocation to attribute a failure to.
 *
 * ## Why the check earns its place
 *
 * `Collection.set` neither throws nor complains. It reads `src.length` and indexes
 * (`collection.ts:485-505`), so anything without a `length` — a number, a plain object, a
 * Model — produces an empty list in silence. The graph looks wired, the node looks fine, and
 * nothing anywhere says the value was the wrong shape.
 *
 * The single record is the case worth naming on its own: wiring a `Record` where a query or
 * collection belongs is an ordinary mistake, and "an object" would be true and useless to an
 * author staring at a node whose output is plainly a record.
 *
 * ## ⚠️ What this check does *not* cover, established by a failing row
 *
 * **A string never reaches the setter.** `Items` is an `array`-typed port, so
 * `Node.setInputValue` (node.ts:360-383) `eval`s any string arriving at it — the declared
 * string→array typecast — and substitutes `[]` when that throws, raising `invalid-array-items`
 * itself. The first version of this check claimed a string would render "one item per
 * character", which cannot happen, and would have duplicated an existing warning. The rows
 * below pin the real division of labour.
 *
 * ## The line the check must not cross
 *
 * ⚠️ **Empty is not a problem, deliberately.** `DC-iii` and Richard's 2026-08-01 decision are that
 * a Repeater handed `null`, `undefined` or `[]` *clears* — that is the intended way to empty a
 * list. A check that fired on it would be exactly the noise that gets the Problems panel ignored,
 * so the rows below pin the silence as hard as they pin the firing.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | the `setDiagnostic` call in the `items` setter | the three firing rows |
 * | the `value == null` early return in `itemsProblem` | the null/undefined silent rows only |
 * | the `Collection.instanceOf` clause | the bound-collection silent row only |
 * | the `Model.instanceOf` branch | the single-record row only |
 * | clearing (returning a message unconditionally) | the un-rings row only |
 * | interpolating the value into the key | the one-key row only |
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import Collection from '../../../noodl-runtime/src/collection';
import Model from '../../../noodl-runtime/src/model';
import ForEachModule from '../../src/nodes/std-library/data/foreach';

const ITEMS_KEY = 'repeater/items-not-a-collection';

/** One settable value output, wired into the Repeater's `Items` input. */
const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: {
      value: {
        type: '*',
        getter: function (this: NodeInstance) {
          return this._internal.value;
        }
      }
    },
    methods: {
      send(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      }
    }
  }
};

interface TriggerInstance extends NodeInstance {
  send(value: unknown): void;
}

async function repeaterGraph(): Promise<CorpusGraph> {
  return createCorpusGraph({
    modules: [ForEachModule as unknown as NodeModule, TriggerModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'repeater', type: 'For Each' }
          ],
          connections: [
            { sourceId: 'trigger', sourcePort: 'value', targetId: 'repeater', targetPort: 'items' }
          ]
        }
      ]
    } as never
  });
}

/** Send a value down the wire into `Items` and let the frame settle. */
function sendItems(graph: CorpusGraph, value: unknown): void {
  graph.node<TriggerInstance>('trigger').send(value);
  graph.update();
}

/**
 * The message the editor would be showing.
 *
 * ⚠️ **Latest, not first.** The recording connection keeps a *log* of every `sendWarning`, where
 * the editor keeps a *store*: `WarningsModel.setWarning` assigns into `w[ref.key]`, so one key
 * holds one warning and a re-send replaces it. Reading the first entry here would assert on a
 * message the author stopped seeing several frames ago.
 */
function itemsWarning(graph: CorpusGraph): string | undefined {
  const live = graph.editorConnection.warnings.filter((w) => w.nodeId === 'repeater' && w.key === ITEMS_KEY);
  return live.length ? live[live.length - 1].message : undefined;
}

describe('OBS-003: Items received something that cannot be repeated over', () => {
  test('A number names the type and the consequence', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, 42);

    // The consequence, not just the type. "expects an array" alone leaves an author who is
    // looking at an empty list with no way to connect the two.
    expect(itemsWarning(graph)).toContain('a number (42)');
    expect(itemsWarning(graph)).toContain('Nothing will render');
  });

  test('A plain object — the REST-response-wired-straight-in case — is named', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, { items: [1, 2, 3] });

    expect(itemsWarning(graph)).toContain('an object');
    expect(itemsWarning(graph)).toContain('no length');
  });

  test('A single record says so, rather than calling it an object', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, Model.create({ title: 'one row' }));

    const message = itemsWarning(graph);
    expect(message).toContain('a single record');
    // Actionable: it names the two things that would work.
    expect(message).toContain('query or collection');
  });

  test('A boolean is caught too — the check is on shape, not on a list of known-bad types', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, true);

    expect(itemsWarning(graph)).toContain('a boolean (true)');
  });
});

describe('OBS-003: what the array typecast handles instead', () => {
  /**
   * ⚠️ The division of labour, pinned. A string at an `array` port is `eval`ed by
   * `Node.setInputValue` before any node code runs, so this diagnostic must stay silent or the
   * node would carry two warnings for one mistake — the duplication the contract forbids.
   */
  test('A string raises the existing invalid-array warning, and not this diagnostic', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, 'abc');

    expect(itemsWarning(graph)).toBeUndefined();
    expect(graph.editorConnection.warnings.map((w) => w.key)).toContain('invalid-array-items');
  });

  test('A string that parses as an array is simply the typecast working, and raises nothing', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, '[{"a":1}]');

    expect(itemsWarning(graph)).toBeUndefined();
    expect(graph.editorConnection.warnings).toEqual([]);
  });
});

describe('OBS-003: Items received something legitimate', () => {
  test('An array raises nothing', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, [{ a: 1 }, { a: 2 }]);

    expect(itemsWarning(graph)).toBeUndefined();
  });

  test('An empty array raises nothing', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, []);

    expect(itemsWarning(graph)).toBeUndefined();
  });

  test('A Collection raises nothing', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, Collection.get('obs-003-corpus'));

    expect(itemsWarning(graph)).toBeUndefined();
  });

  // ⚠️ The rows the DC-iii decision depends on. Clearing a Repeater is the *intended* use of
  // an empty value, and a diagnostic that fired here would make the panel worth ignoring.
  test.each([[null], [undefined]])('%p — the intended way to clear a list — raises nothing', async (value) => {
    const graph = await repeaterGraph();

    sendItems(graph, [{ a: 1 }]);
    sendItems(graph, value);

    expect(itemsWarning(graph)).toBeUndefined();
  });
});

describe('OBS-003: the diagnostic is a predicate, not an event', () => {
  test('Rewiring Items to a real array un-rings the node', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, 42);
    expect(itemsWarning(graph)).toBeDefined();

    sendItems(graph, [{ a: 1 }]);

    expect(itemsWarning(graph)).toBeUndefined();
    expect(graph.editorConnection.cleared).toContainEqual({ nodeId: 'repeater', key: ITEMS_KEY });
  });

  test('A different bad value re-sends the same key, so the node keeps one warning', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, { a: 1 });
    sendItems(graph, 42);

    const sent = graph.editorConnection.warnings.filter((w) => w.nodeId === 'repeater' && w.key === ITEMS_KEY);

    // Two *sends* — the harness logs them — but both under one key, which is what decides how
    // many entries the author sees: `WarningsModel.setWarning` assigns into `w[key]`, so the
    // second replaces the first. A key that varied with the value would leave both on the node
    // for ever, which is why the contract forbids interpolating a value into a key.
    expect(sent).toHaveLength(2);
    expect(new Set(sent.map((w) => w.key)).size).toBe(1);
    expect(itemsWarning(graph)).toContain('a number (42)');
  });

  test('Nothing is raised on the error bus — a bad Items is not a failure', async () => {
    const graph = await repeaterGraph();

    sendItems(graph, 42);

    expect(graph.errors.filter((e) => e.code === ITEMS_KEY)).toEqual([]);
  });
});
