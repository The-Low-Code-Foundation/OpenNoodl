/**
 * NDA-004 §2, register ⏳ item 7 — five nodes grouped only by "nobody has read these yet".
 *
 * They turned out to have four different answers, which is the grouping lesson again: a ⏳ bucket
 * says where to spend the next read and nothing about what the read will find.
 *
 * | Node | Verdict |
 * |---|---|
 * | **Set Variable** | ✅ and the phase's worst shape — `Model.set(undefined, value)` wrote a key literally named `undefined` on the shared variables record and fired **`Done`** |
 * | **Stream Buffer** | ✅ — `Add` with nothing on `Data` returned bare |
 * | **Filter Records** | ✅ — Array Filter's twin, read rather than assumed to be one |
 * | **State History** | 🔵 — its `storeName` setter normalises absent/empty to `'app'`, so there is no target it can fail to find |
 * | **Repeater Item** | ✅ via NDA-015's resolver, which it was the **sixth** site never converged onto |
 *
 * ## Set Variable is the one worth reading the code for
 *
 * `Model.set(undefined, value)` neither throws nor no-ops. It writes `data[undefined]`, notifies a
 * change whose `name` is `undefined`, and returns — so no Variable node anywhere can ever read the
 * value, and the node reports `Done`. That is the third confirmed instance of the false-success
 * shape (after `Model.get(undefined)` in Set Parent Component Object Properties and
 * `Collection.get(undefined)` in the Array mutators), and this time it is reached by simply not
 * filling in a field on one of the simplest nodes in the library.
 *
 * ## Repeater Item was the sixth hand-rolled `_forEachModel` read
 *
 * NDA-015 found five, converged them on `resolveForEachItem`, and recorded "one implementation
 * now". It missed the node *named after the mechanism*. Converging it changes two things: the
 * lookup becomes the **scope chain** rather than a direct `componentOwner` read, so a Repeater Item
 * nested one component deep inside a template resolves instead of silently returning `undefined`;
 * and a node that is not inside a template at all now says so once instead of handing out an
 * `undefined` Item Id for ever.
 */

/* eslint-env jest */

import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import ForEachActionsModule from '../../src/nodes/std-library/data/foreachactions';
import SetVariableModule = require('@noodl/runtime/src/nodes/std-library/data/setvariablenode');

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

// ---------------------------------------------------------------------------------------------
// Set Variable
// ---------------------------------------------------------------------------------------------

/**
 * The node id is `setvar`, not `set`, and that is not cosmetic. `ComponentModel.addNode` does
 * `this.nodes[node.id] = node`, and `Collection` patches `Array.prototype.set` as a **read-only**
 * property — so an id of `'set'` fails graph construction with
 * `Cannot assign to read only property 'set' of object '[object Array]'`, several frames away
 * from anything this file wrote. Any id colliding with a patched Array member will do the same.
 */
async function setVariableGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [TriggerModule, SetVariableModule as unknown as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'trigger', type: 'corpus.Trigger' },
            { id: 'setvar', type: 'Set Variable', parameters }
          ],
          connections: [
            { sourceId: 'trigger', sourcePort: 'go', targetId: 'setvar', targetPort: 'do' },
            { sourceId: 'trigger', sourcePort: 'value', targetId: 'setvar', targetPort: 'value' }
          ]
        }
      ]
    } as never
  });
  await graph.settle(3);
  return graph;
}

/** The shared record every Variable / Set Variable pair reads and writes. */
function variables() {
  return Model.get('--ndl--global-variables');
}

describe('NDA-004 §2: Set Variable', () => {
  test('a Do with no Name fires Failure instead of reporting Done for a write nothing can read', async () => {
    const graph = await setVariableGraph({});
    graph.node<TriggerInstance>('trigger').send('a-value');
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.signalsFor('setvar')).toContain('failure');
    // `Done` is the assertion that matters. Before the fix this was the *only* signal, so every
    // downstream branch was told the store had succeeded.
    expect(graph.signalsFor('setvar')).not.toContain('done');
  });

  test('and it does not write the key named "undefined" onto the shared record', async () => {
    const graph = await setVariableGraph({});
    graph.node<TriggerInstance>('trigger').send('a-value');
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    // The mechanism of the damage, not just the report — the States lesson: a fix that only
    // reports can leave the damage in place. `data[undefined]` was a real key on the record every
    // Variable node in the project shares.
    expect(variables().data['undefined']).toBeUndefined();
  });

  test('the diagnosis reaches the runtime channel and says why it matters', async () => {
    const graph = await setVariableGraph({});
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    const raised = graph.errors.filter((e) => e.code === 'set-variable/no-name');
    expect(raised).toHaveLength(1);
    expect(raised[0].message).toMatch(/Variable node can read/);
    expect(graph.node('setvar').getOutput('error').value).toMatch(/Variable node can read/);
  });

  test('an empty Name is the same mistake, not a different one', async () => {
    const graph = await setVariableGraph({ name: '' });
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    // `usePortAsLabel: 'name'` means an unnamed node shows no label either way, and no Variable
    // node can read a key with no name.
    expect(graph.errors.map((e) => e.code)).toEqual(['set-variable/no-name']);
  });

  // ✅ Pinned control.
  test('(pinned control) a Do with a Name stores, says Done, and raises nothing', async () => {
    const graph = await setVariableGraph({ name: 'corpus-greeting' });
    graph.node<TriggerInstance>('trigger').send('hello');
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    // ERG-001 §4 added `completed` after the existing `done`. The row's claim is unchanged.
    expect(graph.signalsFor('setvar')).toEqual(['done', 'completed']);
    expect(graph.errors).toEqual([]);
    expect(variables().get('corpus-greeting')).toBe('hello');
  });

  // ✅ Pinned control. The trigger is an author `Do`, so nothing may fire before it is pressed.
  test('(pinned control) booting and receiving a value raise nothing on their own', async () => {
    const graph = await setVariableGraph({});
    graph.node<TriggerInstance>('trigger').send('a-value');
    await graph.settle(4);

    expect(graph.signalsFor('setvar')).toEqual([]);
    expect(graph.errors).toEqual([]);
  });

  test('the ports exist on the node, not just in the signal log', async () => {
    const graph = await setVariableGraph({ name: 'x' });
    const node = graph.node('setvar');

    expect(node.hasOutput('done')).toBe(true);
    expect(node.hasOutput('failure')).toBe(true);
    expect(node.hasOutput('error')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
// Repeater Item
// ---------------------------------------------------------------------------------------------

/**
 * A Repeater Item on its own, with no Repeater above it — the whole point.
 *
 * The corpus's Repeater rows live in `nda-015-repeater-item-binding.test.ts`; what is new here is
 * the *absence* case, which used to hand back `undefined` with no report of any kind.
 */
async function repeaterItemGraph(): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [ForEachActionsModule as unknown as NodeModule],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'item', type: 'For Each Actions' }], connections: [] }]
    } as never
  });
  await graph.settle(2);
  return graph;
}

describe('NDA-004 §2 / NDA-015: Repeater Item outside a Repeater', () => {
  test('says so instead of handing out an undefined Item Id for ever', async () => {
    const graph = await repeaterItemGraph();

    // Reading the port is what resolves; the node does nothing until asked.
    expect(graph.node('item').getOutput('itemId').value).toBeUndefined();
    await graph.settle(2);

    const raised = graph.errors.filter((e) => e.code === 'repeater-item/no-item-in-scope');
    expect(raised.length).toBeGreaterThanOrEqual(1);
    expect(raised[0].message).toMatch(/not inside a Repeater or Run Tasks template/);
  });

  test('and says it once, however many times the port is read', async () => {
    const graph = await repeaterItemGraph();

    for (let i = 0; i < 5; i++) graph.node('item').getOutput('itemId').value;
    await graph.settle(2);

    // `miss`'s per-node dedup. Without it a bound-to-nothing Item Id output would raise on every
    // read, which for a value port means every frame something looks at it.
    expect(graph.errors.filter((e) => e.code === 'repeater-item/no-item-in-scope')).toHaveLength(1);
  });
});

/**
 * **State History's 🔵 row is not here.** It lives in `noodl-runtime/test/statehistory.test.ts`,
 * with the rest of that node family and the store manager it needs — importing it into this
 * package means a `require` of an `export =` module under a different jest's options, which is
 * the same class of cross-package problem as the user/auth split.
 */
