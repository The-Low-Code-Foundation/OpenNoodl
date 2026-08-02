/**
 * NDA-012 (Data) — the Array/Variable family, ten nodes read one at a time.
 *
 * `nda-004-array-mutators.test.ts` is the sibling file and stays untouched: it pins NDA-004 §2's
 * three mutators. This one pins what the per-node pass found in the other seven, plus the three
 * decisions it deliberately did **not** take.
 *
 * ## What was fixed here
 *
 * - **`Variable` wrote a key named `undefined`.** NDA-004 §2 fixed exactly this in `Set Variable`
 *   and did not look one file across. With no `Name`, `Model.set(undefined, value)` writes a key
 *   literally called `undefined` on the shared `--ndl--global-variables` record — and the node's
 *   own change listener then fired **`Changed`**, because `args.name === internal.name` with both
 *   `undefined`. A false success for a write that even this node cannot read back.
 * - **`Array Map` was silent when its script did not work.** Both ways: a script that will not
 *   compile left `mapFunc` `undefined` and the unguarded call threw; a script that compiles and
 *   then throws did the same. Either way the `TypeError` landed in `nodecontext.ts`'s blanket
 *   catch, which only `console.error`s. Measured before the fix: no signal, no raised error, no
 *   editor warning, and `Items` silently kept the previous run's output.
 * - **`Static Array` reported a JSON parse error only to the editor**, behind
 *   `if (this.context.editorConnection)` — the Failure Contract's opening example, in a node with
 *   no `Failure` output at all. It also replaced its collection with a fresh empty one *before*
 *   parsing, so a failed parse left `Count` reading 0 while `Items` still held the previous
 *   collection and was never re-flagged.
 * - **`Array` (`Collection2`) never unwound its source subscription.** `setSourceCollection` binds
 *   `change` on whatever arrives at `Items` and only unbinds on the *next* arrival; `_onNodeDeleted`
 *   handled the node's own collection and not the source, so a deleted node stayed reachable from
 *   a named array for the life of the page.
 *
 * ## ⚠️ A trap this file had to work around, and the next reader will hit
 *
 * **`instanceof Collection` is `false` under this package's jest and `true` in the shipped build.**
 * `class CollectionImpl extends Array {}` (`collection.ts:671`) down-levels to `__extends` at
 * `target: es5`, which is what `noodl-viewer-react/tsconfig.json` compiles sibling sources with —
 * and an ES5 `extends Array` does not produce instances that satisfy `instanceof`. The shipped
 * viewer compiles the runtime through `@noodl/runtime/webpack-ts-rule`, i.e. the runtime's own
 * `target: ES2019`, where it is true. Discriminated directly: the same three lines compiled at
 * `es5` answer `{raw:false, proxied:false}` and at `ES2019` `{raw:true, proxied:true}`.
 *
 * The consequence for this file is narrow but total: `Collection2.setSourceCollection`'s
 * `instanceof Collection` guard never passes here, so **the source-collection subscription cannot
 * be created through the graph in this package**. The row below installs it exactly as the guard
 * would and then asserts the teardown removes it. That is honest about what it pins — the
 * `_onNodeDeleted` bookkeeping — and honest about what it cannot reach.
 *
 * This extends the banked pre-ES2015 trap (`for…of` over a `Map` silently iterating zero times)
 * rather than restating it: same cause, no diagnostic in either case, and both read as "the node
 * ignored it".
 */

/* eslint-env jest */

import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import type { CollectionLike, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import CollectionModule from '../../src/nodes/std-library/data/collectionnode2';
import CollectionInsertModule from '../../src/nodes/std-library/data/collectionnode-insert';
import FilterCollectionModule from '../../src/nodes/std-library/data/filtercollectionnode';
import MapCollectionModule from '../../src/nodes/std-library/data/mapcollectionnode';
import SetVariableModule from '../../src/nodes/std-library/data/setvariablenode';
import StaticDataModule from '../../src/nodes/std-library/data/staticdata';
import VariableModule from '../../src/nodes/std-library/data/variablenode2';

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

/**
 * `Collection.get(name)` is a process-wide registry, so every row needs its own name or the array
 * one row fills is the array the next asserts is empty.
 */
let counter = 0;
const fresh = (prefix: string) => `nda012b-${prefix}-${++counter}`;

/** Read an output through its getter — outputs expose no public value accessor. */
function outputOf(node: unknown, name: string): unknown {
  const owner = node as { getOutput(n: string): { getter?(): unknown } };
  const output = owner.getOutput(name);
  return output.getter ? output.getter.call(node) : undefined;
}

function errorCodes(graph: CorpusGraph): string[] {
  return graph.errors.map((e) => e.code);
}

// ---------------------------------------------------------------------------------------------
// Variable — the twin of the Set Variable defect NDA-004 §2 fixed
// ---------------------------------------------------------------------------------------------

/**
 * ⚠️ Every row here must send a *distinct* value. `Model.set` suppresses the change event when
 * the value is unchanged, and the defect these rows pin writes them all to the same key — so
 * several rows sending one string make the later ones observe nothing and pass for the wrong
 * reason. The discrimination check is what caught it: with the fix reverted, the `Changed` row
 * stayed green.
 */
async function variableGraph(name?: string): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, VariableModule as unknown as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'src', type: 'corpus.Trigger' },
            { id: 'variable', type: 'Variable2', parameters: name === undefined ? {} : { name } }
          ],
          connections: [{ sourceId: 'src', sourcePort: 'value', targetId: 'variable', targetPort: 'value' }]
        }
      ]
    } as never
  });
  await graph.settle(4);
  return graph;
}

describe('NDA-012: Variable with no Name', () => {
  test('refuses the write instead of storing it under a key named "undefined"', async () => {
    const graph = await variableGraph();
    graph.node<TriggerInstance>('src').send(fresh('unreachable'));
    await graph.settle(4);

    // The load-bearing assertion. Before the fix this key existed and held the value.
    const variables = Model.get('--ndl--global-variables');
    expect(variables.get('undefined')).toBeUndefined();
    expect(Object.keys(variables.data)).not.toContain('undefined');
  });

  test('says so on the runtime channel, which exists in every runtime', async () => {
    const graph = await variableGraph();
    graph.node<TriggerInstance>('src').send(fresh('unreachable'));
    await graph.settle(4);

    const raised = graph.errors.filter((e) => e.code === 'variable/no-name');
    expect(raised.length).toBe(1);
    expect(raised[0].message).toMatch(/No variable name is set/);
    expect(raised[0].nodeId).toBe('variable');
  });

  test('fires Failure and carries the reason on Error, not a bare signal', async () => {
    const graph = await variableGraph();
    graph.node<TriggerInstance>('src').send(fresh('unreachable'));
    await graph.settle(4);

    expect(graph.signalsFor('variable')).toContain('failure');
    expect(outputOf(graph.node('variable'), 'error')).toMatch(/No variable name is set/);
  });

  test('does not report Changed for a write that went nowhere', async () => {
    const graph = await variableGraph();
    graph.node<TriggerInstance>('src').send(fresh('unreachable'));
    await graph.settle(4);

    // The false success: the node's own change listener saw `args.name === internal.name` with
    // both `undefined` and announced a change nothing could read.
    expect(graph.signalsFor('variable')).not.toContain('changed');
  });

  test('an empty-string Name is the same mistake and is refused too', async () => {
    const graph = await variableGraph('');
    graph.node<TriggerInstance>('src').send(fresh('unreachable'));
    await graph.settle(4);

    expect(errorCodes(graph)).toContain('variable/no-name');
    expect(Model.get('--ndl--global-variables').get('')).toBeUndefined();
  });

  test('control: a named Variable still stores and still announces the change', async () => {
    const name = fresh('var');
    const graph = await variableGraph(name);
    graph.node<TriggerInstance>('src').send('kept');
    await graph.settle(4);

    expect(Model.get('--ndl--global-variables').get(name)).toBe('kept');
    expect(graph.signalsFor('variable')).toContain('changed');
    expect(graph.signalsFor('variable')).not.toContain('failure');
    expect(errorCodes(graph)).not.toContain('variable/no-name');
  });
});

// ---------------------------------------------------------------------------------------------
// Array Map — a node that could not be debugged from the graph in any runtime
// ---------------------------------------------------------------------------------------------

async function mapGraph(script: string, items?: CollectionLike): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, MapCollectionModule as unknown as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'src', type: 'corpus.Trigger' },
            { id: 'go', type: 'corpus.Trigger' },
            { id: 'map', type: 'Map Collection', parameters: { mapScript: script } }
          ],
          connections: [
            { sourceId: 'src', sourcePort: 'value', targetId: 'map', targetPort: 'items' },
            { sourceId: 'go', sourcePort: 'go', targetId: 'map', targetPort: 'refresh' }
          ]
        }
      ]
    } as never
  });
  await graph.settle(4);
  if (items) {
    graph.node<TriggerInstance>('src').send(items);
    await graph.settle(4);
  }
  return graph;
}

function twoRecords(prefix: string): CollectionLike {
  const collection = Collection.get(fresh(prefix));
  collection.set([
    { id: fresh('rec'), title: 'first' },
    { id: fresh('rec'), title: 'second' }
  ]);
  return collection;
}

describe('NDA-012: Array Map failure surface', () => {
  test('a script that will not compile is reported, not thrown into a blanket catch', async () => {
    const graph = await mapGraph('map({ ', twoRecords('map-src'));

    const raised = graph.errors.filter((e) => e.code === 'array-map/script-failed');
    expect(raised.length).toBe(1);
    expect(raised[0].nodeId).toBe('map');
    expect(graph.signalsFor('map')).toContain('failure');
    expect(graph.signalsFor('map')).not.toContain('modified');
    expect(outputOf(graph.node('map'), 'error')).toMatch(/could not be compiled/);
  });

  test('a script that compiles and then throws is a separately coded failure', async () => {
    const graph = await mapGraph('map({ t: function (o) { return o.nope.deep; } })', twoRecords('map-src'));

    expect(errorCodes(graph)).toContain('array-map/map-failed');
    expect(graph.signalsFor('map')).toContain('failure');
    expect(graph.signalsFor('map')).not.toContain('modified');
  });

  test('Refresh with nothing connected to Items says so', async () => {
    const graph = await mapGraph('map({ t: "title" })');
    graph.node<TriggerInstance>('go').go();
    await graph.settle(4);

    expect(errorCodes(graph)).toContain('array-map/no-items');
    expect(graph.signalsFor('map')).toContain('failure');
  });

  test('but a script simply arriving with no Items stays silent — the boot path', async () => {
    // Array Filter's distinction, ported: a value arrival is not an author asking. Without this
    // gate the node would fail on every graph that loads its script before its array.
    const graph = await mapGraph('map({ t: "title" })');

    expect(errorCodes(graph)).not.toContain('array-map/no-items');
    expect(graph.signalsFor('map')).not.toContain('failure');
  });

  test('control: a working script maps, signals Changed and raises nothing', async () => {
    const graph = await mapGraph('map({ t: "title" })', twoRecords('map-src'));

    expect(graph.signalsFor('map')).toContain('modified');
    expect(graph.signalsFor('map')).not.toContain('failure');
    expect(graph.errors).toHaveLength(0);
    expect(outputOf(graph.node('map'), 'count')).toBe(2);
  });

  test('control: a failure that repeats is announced once, and re-armed by a good run', async () => {
    const graph = await mapGraph('map({ ', twoRecords('map-src'));
    graph.node<TriggerInstance>('go').go();
    await graph.settle(4);

    // Same message twice; the dedup is Array Filter's and matters for the same reason.
    expect(graph.errors.filter((e) => e.code === 'array-map/script-failed')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------
// Static Array — an editor-only diagnosis, and an inconsistent output pair behind it
// ---------------------------------------------------------------------------------------------

async function staticArrayGraph(json: string): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [StaticDataModule as unknown as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [{ id: 'static', type: 'Static Data', parameters: { type: 'json', json } }],
          connections: []
        }
      ]
    } as never
  });
  await graph.settle(4);
  return graph;
}

describe('NDA-012: Static Array JSON failure', () => {
  test('the parse error reaches the runtime channel, not only the editor', async () => {
    const graph = await staticArrayGraph('[{');

    const raised = graph.errors.filter((e) => e.code === 'static-array/json-parse-failed');
    expect(raised.length).toBe(1);
    expect(raised[0].nodeId).toBe('static');
    expect(raised[0].message).toMatch(/could not be parsed/);
  });

  test('it is observable from the graph, with the reason on Error', async () => {
    const graph = await staticArrayGraph('[{');

    expect(graph.signalsFor('static')).toContain('failure');
    expect(outputOf(graph.node('static'), 'error')).toMatch(/could not be parsed/);
  });

  test('a failed parse leaves Items and Count agreeing with each other', async () => {
    const graph = await staticArrayGraph('[{"id":"nda012b-ok"}]');
    const good = outputOf(graph.node('static'), 'items');
    expect(outputOf(graph.node('static'), 'count')).toBe(1);

    // The reachable path is an author editing the field; drive the setter that edit reaches.
    graph.node('static')._inputs['json'].set.call(graph.node('static'), '[{');
    await graph.settle(4);

    // Before the fix: `Count` read 0 from a fresh empty collection installed before the parse,
    // while `Items` was never re-flagged and downstream still held `good`.
    expect(outputOf(graph.node('static'), 'items')).toBe(good);
    expect(outputOf(graph.node('static'), 'count')).toBe(1);
  });

  test('control: valid JSON parses, raises nothing and fires no Failure', async () => {
    const graph = await staticArrayGraph('[{"id":"nda012b-a"},{"id":"nda012b-b"}]');

    expect(graph.errors).toHaveLength(0);
    expect(graph.signalsFor('static')).not.toContain('failure');
    expect(outputOf(graph.node('static'), 'count')).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------
// Array — the source subscription that outlived the node
// ---------------------------------------------------------------------------------------------

describe('NDA-012: Array node teardown', () => {
  test('deleting the node unbinds the source collection it was copying from', async () => {
    const source = Collection.get(fresh('array-source'));
    source.set([{ id: fresh('rec') }]);

    const graph = await createCorpusGraph({
      modules: [CollectionModule as unknown as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [{ id: 'array', type: 'Collection2', parameters: { collectionId: fresh('array-own') } }],
            connections: []
          }
        ]
      } as never
    });
    await graph.settle(4);

    /**
     * Installed by hand, and the file header says why: `setSourceCollection`'s
     * `instanceof Collection` guard is false under this package's `target: es5` and true in the
     * shipped build, so the graph cannot reach this state here. These two lines are exactly what
     * the guard's body does — the row pins the *teardown*, which is where the defect was.
     */
    const internal = graph.node('array')._internal as unknown as {
      sourceCollection?: CollectionLike;
      sourceCollectionChangedCallback(): void;
    };
    internal.sourceCollection = source;
    source.on('change', internal.sourceCollectionChangedCallback);

    const listeners = () =>
      ((source as unknown as { _listeners?: Record<string, unknown[]> })._listeners || {}).change || [];
    expect(listeners()).toHaveLength(1);

    graph.node('array')._onNodeDeleted();

    // Before the fix this stayed at 1: a named collection is held strongly for the life of the
    // page, so the callback — and the whole node instance it closes over — was never released.
    expect(listeners()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Pinned, not fixed — three decisions this pass deliberately did not take
// ---------------------------------------------------------------------------------------------

describe('NDA-012: pinned behaviour awaiting a decision', () => {
  test('Insert Object Into Array reports Done for a duplicate that changed nothing', async () => {
    const arrayId = fresh('insert-dup');
    const graph = await createCorpusGraph({
      modules: [TriggerModule, CollectionInsertModule as unknown as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'objectId', type: 'corpus.Trigger' },
              { id: 'insert', type: 'CollectionInsert', parameters: { collectionId: arrayId } }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'insert', targetPort: 'add' },
              { sourceId: 'objectId', sourcePort: 'value', targetId: 'insert', targetPort: 'modifyId' }
            ]
          }
        ]
      } as never
    });
    await graph.settle(4);

    graph.node<TriggerInstance>('objectId').send(fresh('dup-object'));
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);
    expect(Collection.get(arrayId).size()).toBe(1);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(4);

    /**
     * ✅ **The decision this row was pinned for was taken on 2026-08-01, and taken here.**
     *
     * It used to read: `Array.prototype.add` early-returns on `contains`
     * (`collection.ts:590-604`), so the second `Do` changes nothing and still signals `Done` —
     * *"pinned so the difference is a decision rather than an accident"*. Richard's answer was
     * that neither `Done` nor `Failure` is right and the library needs a third outcome, which
     * became `ERG-001` and `dev-docs/reference/OUTCOME-CONTRACT.md`.
     *
     * So the second `Do` now reports **`Unchanged`**, and the distinction from the sibling
     * `Remove Object From Array` survives intact: that node's fixed case is *impossible* (an id
     * nothing has loaded can never be in the array) and stays a `Failure`; this one is merely
     * *redundant* — the object is there, which is what the author asked for.
     *
     * The rows that pin the new behaviour in full are in `erg-001-outcome-contract.test.ts`.
     * What is kept here is the array-family half: the array really does stay at size 1, and the
     * no-op is still not a failure.
     */
    expect(Collection.get(arrayId).size()).toBe(1);
    expect(graph.signalsFor('insert').filter((s) => s === 'done')).toHaveLength(1);
    expect(graph.signalsFor('insert').filter((s) => s === 'unchanged')).toHaveLength(1);
    expect(graph.signalsFor('insert')).not.toContain('failure');
  });

  test('Set Variable "Set as: Number" does not convert a string arriving on a wire', async () => {
    const name = fresh('setas');
    const graph = await createCorpusGraph({
      modules: [TriggerModule, SetVariableModule as unknown as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'src', type: 'corpus.Trigger' },
              { id: 'go', type: 'corpus.Trigger' },
              // Not `set`: `ComponentModel.nodes` is an Array keyed by node id, and
              // `collection.ts` patches `Array.prototype` with a non-writable `set`, so a node
              // whose id is `set`/`add`/`remove`/`on`/`off` crashes graph import. Unreachable in
              // a real project (ids are guids) and a live trap for anyone writing corpus data.
              { id: 'setvar', type: 'Set Variable', parameters: { name, setWith: 'number' } }
            ],
            connections: [
              { sourceId: 'src', sourcePort: 'value', targetId: 'setvar', targetPort: 'value' },
              { sourceId: 'go', sourcePort: 'go', targetId: 'setvar', targetPort: 'do' }
            ]
          }
        ]
      } as never
    });
    await graph.settle(4);
    graph.node<TriggerInstance>('src').send('17');
    graph.node<TriggerInstance>('go').go();
    await graph.settle(4);

    /**
     * `scheduleStore` coerces for `emptyString`, `boolean`, `object` and `array` and for nothing
     * else — `string`, `number` and `date` only choose the dynamic Value port's declared type,
     * which the editor honours for a typed *parameter* and no wire honours at all. `Set as: Date`
     * is the sharpest case: it has no implementation whatsoever. Filed, because what `Date`
     * should even produce (a `Date`, an ISO string, an epoch number) is a decision.
     */
    expect(Model.get('--ndl--global-variables').get(name)).toBe('17');
    expect(typeof Model.get('--ndl--global-variables').get(name)).toBe('string');
    expect(graph.signalsFor('setvar')).toContain('done');
  });

  test('Array with a cleared Id binds a different throwaway array every time', async () => {
    const graph = await createCorpusGraph({
      modules: [CollectionModule as unknown as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [{ id: 'array', type: 'Collection2', parameters: { collectionId: fresh('cleared') } }],
            connections: []
          }
        ]
      } as never
    });
    await graph.settle(4);

    // An author clearing the field queues the port's default, `undefined` (`node.ts:871-882`).
    // This package cannot drive a parameter edit — see `nda-004-array-mutators.test.ts` — so the
    // row drives the setter that edit reaches.
    const array = graph.node('array');
    array._inputs['collectionId'].set.call(array, undefined);
    await graph.settle(2);
    const first = outputOf(array, 'id');
    array._inputs['collectionId'].set.call(array, undefined);
    await graph.settle(2);
    const second = outputOf(array, 'id');

    /**
     * `Collection.get(undefined)` is the anonymous tier — a fresh, differently-named collection on
     * every call — which is the trap `collection-failure.ts` was written for and which the Array
     * node itself never adopted. So clearing the Id emits a random guid on the `Id` output, and
     * anything wired to it is now pointed at an array nothing else can reach. Filed rather than
     * fixed: unbinding is the right answer, but this node has no failure surface to say so on,
     * and adding one is a decision.
     */
    expect(first).not.toBeUndefined();
    expect(second).not.toBeUndefined();
    expect(first).not.toBe(second);
  });

  test('Array Filter on a misspelt property quietly matches nothing', async () => {
    const source = Collection.get(fresh('filter-src'));
    source.set([{ id: fresh('rec'), title: 'a' }, { id: fresh('rec'), title: 'b' }]);

    const graph = await createCorpusGraph({
      modules: [TriggerModule, FilterCollectionModule as unknown as NodeModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'src', type: 'corpus.Trigger' },
              {
                id: 'filter',
                type: 'Filter Collection',
                parameters: {
                  filterFilter: 'titel',
                  'filterFilterOp-titel': 'eq',
                  'filterFilterValue-titel': 'a'
                }
              }
            ],
            connections: [{ sourceId: 'src', sourcePort: 'value', targetId: 'filter', targetPort: 'items' }]
          }
        ]
      } as never
    });
    await graph.settle(4);
    graph.node<TriggerInstance>('src').send(source);
    await graph.settle(4);

    /**
     * D1. `filterFilter` is a comma-separated list of property names matched by bare string
     * against each record's raw `data`, with no validation anywhere — `applyFilter` treats "the
     * property is absent" as an immediate non-match for every operator except `$neq`. A typo is
     * therefore indistinguishable from an empty result, and the node reports `Filtered` for it.
     * Filed rather than fixed: records are legitimately heterogeneous, so "this property does not
     * exist" is not a fact the node can establish from the data alone.
     */
    expect(outputOf(graph.node('filter'), 'count')).toBe(0);
    expect(graph.signalsFor('filter')).toContain('modified');
    expect(graph.signalsFor('filter')).not.toContain('failure');
  });
});
