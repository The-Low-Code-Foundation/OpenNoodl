/**
 * NDA-012 (Visual), `DC-iii` — the Repeater clears when its Items go empty.
 *
 * `foreach.tsx:212` was `if (!value) return;`, the truthiness test `DC-iii` warns against by
 * name. A query that came back `null` left the previous list on screen: the graph had moved on
 * and the page had not, which is the most misleading thing a Repeater can do.
 *
 * ✅ **Decided by Richard 2026-08-01: it clears.** Empty array, `null`, anything falsy. *"a
 * repeater should absolutely clear itself… We're not catering to existing projects anymore."*
 * So there is no dual path and no back-compat branch to test.
 *
 * ⚠️ **The guard had two halves and removing one would have proved nothing.** `scheduleCopyItems`
 * bailed on `items === undefined` as well, so the row for `undefined` is what catches a
 * half-done fix. Both halves are pinned below.
 *
 * ⚠️ **This diverges deliberately from `EMPTY-VALUE-CONTRACT.md`**, whose table has `undefined`
 * abstaining at a port input. Richard's decision was "anything falsy"; the divergence is
 * recorded on the port's own `description`, which is the mechanism the contract provides.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import NoodlRuntime from '@noodl/runtime';
import Model = require('@noodl/runtime/src/model');

import ForEachModule from '../../src/nodes/std-library/data/foreach';

// The Repeater reads `repeaterDisabledWhenUnmounted` and `repeaterCreateComponentsAsync` off
// `NoodlRuntime.instance`, which a corpus graph never constructs. Same shim as NDA-015's file.
const savedNoodlRuntimeInstance = (NoodlRuntime as unknown as { instance?: unknown }).instance;
beforeAll(() => {
  (NoodlRuntime as unknown as { instance?: unknown }).instance = { getProjectSettings: () => ({}) };
});
afterAll(() => {
  (NoodlRuntime as unknown as { instance?: unknown }).instance = savedNoodlRuntimeInstance;
});

/** The Repeater's minimal visual parent — the same three-method contract NDA-015's file uses. */
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
        if (index === undefined || index >= this._children.length) this._children.push(child);
        else this._children.splice(index, 0, child);
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

interface ForEachProbe extends NodeInstance {
  _internal: { itemNodes: unknown[] };
}

/** One Repeater in a container, rendering `/Item` per record. */
async function repeaterGraph(): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [ForEachModule, ContainerModule],
    rootComponent: '/root',
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            {
              id: 'root-container',
              type: 'corpus.Container',
              children: [
                { id: 'repeater', type: 'For Each', parameters: { template: '/Item', templateType: 'explicit' } }
              ]
            }
          ],
          connections: []
        },
        {
          name: '/Item',
          nodes: [{ id: 'item-container', type: 'corpus.Container' }],
          connections: []
        }
      ]
    } as never
  });

  return graph;
}

/** How many item components the Repeater currently has mounted. */
const itemCount = (graph: CorpusGraph) => graph.node<ForEachProbe>('repeater')._internal.itemNodes.length;

async function send(graph: CorpusGraph, value: unknown) {
  graph.node('repeater').setInputValue('items', value);
  await graph.settle(8);
}

describe('RC-1 — an empty Items clears the rendered list', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty array', []],
    ['false', false],
    ['zero', 0]
  ])('%s clears the previously rendered items', async (_label, empty) => {
    const graph = await repeaterGraph();

    await send(graph, [Model.create({ id: 'a' }), Model.create({ id: 'b' }), Model.create({ id: 'c' })]);
    expect(itemCount(graph)).toBe(3);

    await send(graph, empty);

    // Before the fix `null`, `false` and `0` were swallowed by `if (!value) return;` and
    // `undefined` was swallowed a second time by `scheduleCopyItems`, so this stayed at 3 —
    // a list on screen that no longer corresponded to anything in the graph.
    expect(itemCount(graph)).toBe(0);
  }, 30000);

  it('a cleared Repeater renders again when items come back', async () => {
    const graph = await repeaterGraph();

    await send(graph, [Model.create({ id: 'a' }), Model.create({ id: 'b' })]);
    await send(graph, null);
    expect(itemCount(graph)).toBe(0);

    await send(graph, [Model.create({ id: 'c' })]);

    expect(itemCount(graph)).toBe(1);
  }, 30000);
});

describe('RC-2 — the controls: everything that is not empty still behaves as it did', () => {
  it('a populated list renders one item per record', async () => {
    const graph = await repeaterGraph();

    await send(graph, [Model.create({ id: 'a' }), Model.create({ id: 'b' })]);

    expect(itemCount(graph)).toBe(2);
  }, 30000);

  it('re-sending the identical collection is not a change and does not rebuild', async () => {
    const graph = await repeaterGraph();
    const items = [Model.create({ id: 'a' }), Model.create({ id: 'b' })];

    await send(graph, items);
    const before = graph.node<ForEachProbe>('repeater')._internal.itemNodes.slice();

    await send(graph, items);

    // Same node instances, not rebuilt ones: the identity guard in the setter is still there.
    expect(graph.node<ForEachProbe>('repeater')._internal.itemNodes).toEqual(before);
  }, 30000);

  it('a shorter list removes only the surplus items', async () => {
    const graph = await repeaterGraph();

    await send(graph, [Model.create({ id: 'a' }), Model.create({ id: 'b' }), Model.create({ id: 'c' })]);
    await send(graph, [Model.create({ id: 'a' })]);

    expect(itemCount(graph)).toBe(1);
  }, 30000);
});

describe('RC-3 — clearing announces itself, so a graph waiting on the list stays live', () => {
  // NDA-004 §3 gave the Repeater `Items Rendered` and recorded that list-then-scroll had until
  // then been a guessed `Delay`. Clearing queues one `remove` operation per item, so the queue
  // does work and the signal fires — the same wire serves "the list is now empty".
  it('clearing a non-empty list fires Items Rendered', async () => {
    const graph = await repeaterGraph();
    await send(graph, [Model.create({ id: 'a' }), Model.create({ id: 'b' })]);

    const before = graph.signalsFor('repeater').filter((s) => s === 'itemsRendered').length;
    await send(graph, null);
    const after = graph.signalsFor('repeater').filter((s) => s === 'itemsRendered').length;

    expect(after).toBeGreaterThan(before);
  }, 30000);

  // ⚠️ Deliberately pinned as-is rather than fixed. Clearing a list that is *already* empty
  // queues nothing, so `didWork` is false and nothing is announced. That is the `Run Tasks`
  // empty-list shape and `OUTCOME-CONTRACT.md` / phase 35 `ERG-001` owns it; fixing it here
  // would mean choosing a signalling rule that contract is about to choose library-wide.
  it('clearing an already-empty list announces nothing (ERG-001 owns this)', async () => {
    const graph = await repeaterGraph();
    await send(graph, []);

    const before = graph.signalsFor('repeater').filter((s) => s === 'itemsRendered').length;
    await send(graph, null);
    const after = graph.signalsFor('repeater').filter((s) => s === 'itemsRendered').length;

    expect(after).toBe(before);
  }, 30000);
});
