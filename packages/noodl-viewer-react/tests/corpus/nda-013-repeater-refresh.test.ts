/**
 * NDA-013 corpus — the Repeater's Refresh signal must re-read its source.
 *
 * Richard: "when an array feeding into the repeater is changed, for example filtered or
 * stuff added to it, and not through the standard Noodl node system (maybe in a JS node),
 * the repeater doesn't update, and using the Refresh signal does fuck all."
 *
 * Two bugs sit behind that report. The first — the source collection never notifies on
 * `push` — is defect class A1 and is NDA-002's job (`REACTIVITY-CONTRACT.md`). The second,
 * and this file's subject, is that the escape hatch is broken too: `foreach.tsx`'s
 * `refresh()` rebuilds from `internal.collection`, a private copy the Repeater keeps "so we
 * don't have to refresh all content if the input items collection changes" — and that copy
 * is only resynced from `internal.items` by code paths `push` never reaches. Refresh tears
 * down every item node and rebuilds them from the same stale data: it does not do nothing,
 * it does a full re-render that changes nothing, which is worse.
 *
 * `Array Filter` and `Array Map` are downstream of the same report. Filter turns out to
 * already carry a working manual re-run — its `filter` signal input calls `scheduleFilter`,
 * which reads `this._internal.collection.items` fresh every time, because Filter (unlike
 * the Repeater) never kept a private copy to go stale. It is renamed/duplicated here as
 * `refresh` for naming parity with the rest of the family, not because it was broken.
 * `Array Map` genuinely had no manual trigger at all — `refresh` is new capability there.
 */

/* eslint-env jest */

import type { CollectionLike, ModelLike, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import NoodlRuntime from '@noodl/runtime';
import Model = require('@noodl/runtime/src/model');

import ForEachModule from '../../src/nodes/std-library/data/foreach';
import FilterCollectionModule from '../../src/nodes/std-library/data/filtercollectionnode';
import MapCollectionModule from '../../src/nodes/std-library/data/mapcollectionnode';

/**
 * The Repeater's minimal visual parent.
 *
 * `foreach.tsx` needs exactly three things from `internal.target`: `addChild`,
 * `removeChild`, `getChildren` (see `ForEachItemNode` in that file). A real visual node
 * gets these from `react-component-node.ts`, which needs a live DOM to stand up — the same
 * tradeoff the corpus README documents for F3 ("Columns is a proxy"). This container
 * implements the same three-method contract directly, so the graph harness can wire the
 * Repeater's `nodeModel.parent` (which drives `updateTarget`) without a renderer.
 */
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
      addChild: function (
        this: ContainerInstance,
        child: NodeInstance & { parent?: NodeInstance },
        index?: number
      ) {
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

function repeaterItemIds(graph: CorpusGraph): string[] {
  const repeater = graph.node('repeater') as unknown as {
    _internal: { itemNodes: Array<{ _forEachModel: ModelLike }> };
  };
  return repeater._internal.itemNodes.map((n) => n._forEachModel.getId());
}

async function repeaterGraph(): Promise<CorpusGraph> {
  return createCorpusGraph({
    modules: [ForEachModule, ContainerModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            {
              id: 'container',
              type: 'corpus.Container',
              children: [
                {
                  id: 'repeater',
                  type: 'For Each',
                  parameters: { template: '/Item', templateType: 'explicit' }
                }
              ]
            }
          ],
          connections: []
        },
        // The item template. Deliberately empty — the Repeater's own model bookkeeping
        // (`_forEachModel`) is what this file asserts on, not port mapping.
        { name: '/Item', nodes: [], connections: [] }
      ]
    } as never
  });
}

function filteredCount(graph: CorpusGraph, id: string): number {
  const node = graph.node(id) as unknown as { _internal: { filteredCollection?: CollectionLike } };
  return node._internal.filteredCollection ? node._internal.filteredCollection.size() : 0;
}

function mappedCount(graph: CorpusGraph, id: string): number {
  const node = graph.node(id) as unknown as { _internal: { mappedCollection?: CollectionLike } };
  return node._internal.mappedCollection ? node._internal.mappedCollection.size() : 0;
}

describe('NDA-013: Refresh re-reads the source, across the Array family', () => {
  const savedNoodlRuntimeInstance = (NoodlRuntime as unknown as { instance?: unknown }).instance;

  beforeAll(() => {
    // `foreach.tsx` reads two project settings straight off `NoodlRuntime.instance`
    // (`repeaterDisabledWhenUnmounted`, `repeaterCreateComponentsAsync`) rather than
    // through `NodeContext`. This corpus graph never constructs a `NoodlRuntime` — a real
    // application always has exactly one — so without a stub the first `items` bind throws
    // before it reaches the code under test.
    (NoodlRuntime as unknown as { instance?: unknown }).instance = {
      getProjectSettings: () => ({})
    };
  });

  afterAll(() => {
    (NoodlRuntime as unknown as { instance?: unknown }).instance = savedNoodlRuntimeInstance;
  });

  test('NDA-013: Refresh re-reads items (Repeater)', async () => {
    const graph = await repeaterGraph();

    const items: ModelLike[] = [Model.create({ id: 'r-a' }), Model.create({ id: 'r-b' })];
    graph.node('repeater').setInputValue('items', items);
    await graph.settle();

    expect(repeaterItemIds(graph)).toEqual(['r-a', 'r-b']);

    // Mutate the bound array in place — a `push`, the way a Function node would. `push` is
    // the native method the Collection patch never wrapped (confirmed A1 defect, NDA-002's
    // job): this fires no notification at all, which is exactly the scenario Refresh exists
    // to recover from.
    items.push(Model.create({ id: 'r-c' }));

    // The escape hatch: pulse Refresh.
    graph.node('repeater').setInputValue('refresh', true);
    await graph.settle();

    expect(repeaterItemIds(graph)).toEqual(['r-a', 'r-b', 'r-c']);
  });

  test('NDA-013: Refresh re-reads items (Array Filter)', async () => {
    const graph = await createCorpusGraph({
      modules: [FilterCollectionModule],
      data: {
        components: [{ name: '/root', nodes: [{ id: 'filter', type: 'Filter Collection' }], connections: [] }]
      } as never
    });

    const items: ModelLike[] = [Model.create({ id: 'f-a' }), Model.create({ id: 'f-b' })];
    graph.node('filter').setInputValue('items', items);
    await graph.settle();

    expect(filteredCount(graph, 'filter')).toBe(2);

    items.push(Model.create({ id: 'f-c' }));

    graph.node('filter').setInputValue('refresh', true);
    await graph.settle();

    expect(filteredCount(graph, 'filter')).toBe(3);
  });

  test('NDA-013: Refresh re-reads items (Array Map)', async () => {
    const graph = await createCorpusGraph({
      modules: [MapCollectionModule],
      data: {
        components: [
          {
            name: '/root',
            nodes: [{ id: 'map', type: 'Map Collection', parameters: { mapScript: "map({ id: 'id' })" } }],
            connections: []
          }
        ]
      } as never
    });

    // `mapScript` has to be compiled (it builds `_internal.mapFunc`) before `items` is
    // bound, or the first `scheduleMap` run throws against an undefined map function.
    await graph.settle();

    const items: ModelLike[] = [Model.create({ id: 'm-a' }), Model.create({ id: 'm-b' })];
    graph.node('map').setInputValue('items', items);
    await graph.settle();

    expect(mappedCount(graph, 'map')).toBe(2);

    items.push(Model.create({ id: 'm-c' }));

    graph.node('map').setInputValue('refresh', true);
    await graph.settle();

    expect(mappedCount(graph, 'map')).toBe(3);
  });
});
