/**
 * NDA-001 corpus — empty-value row E7 (defect class A2).
 *
 * The Array node's `items` setter opens with `if (value === undefined) return;`
 * (`collectionnode2.ts:112`), so a write carrying nothing is ignored outright. That is the
 * *third* of the four layers that each decided independently what "empty" means, and it is
 * the one that already behaves the way NDA-003 is expected to define — `undefined` means "no
 * opinion, leave it alone".
 *
 * It is pinned rather than fixed: whatever NDA-003 writes down, this node must keep doing
 * this, and the pin is what makes a change to it deliberate.
 *
 * NDA-003 §2 added the sibling case below: `null` is a real value and clears the collection,
 * which the guard above never distinguished from `undefined` before this task's fix.
 */

/* eslint-env jest */

// `test.failing`, declared for the @types/jest this monorepo resolves. See the module.
import '../../../noodl-runtime/test/corpus/expected-failure';

import type { CollectionLike, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import CollectionNode2 from '../../src/nodes/std-library/data/collectionnode2';

import Collection = require('@noodl/runtime/src/collection');
import Model = require('@noodl/runtime/src/model');

/** The Array node's private view of its source collection. */
function collectionOf(graph: CorpusGraph, id: string): CollectionLike | undefined {
  return (graph.node(id) as unknown as { _internal: { collection?: CollectionLike } })._internal.collection;
}

async function arrayNode(collectionId: string): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules: [CollectionNode2 as unknown as NodeModule],
    data: {
      components: [
        {
          name: '/root',
          nodes: [{ id: 'array', type: 'Collection2', parameters: { collectionId } }],
          connections: []
        }
      ]
    } as never
  });
  graph.frame();
  return graph;
}

describe('NDA-001 E7: the Array node and an empty items write', () => {
  // ✅ Pinned.
  test('E7: an Array node fed undefined items leaves its collection alone', async () => {
    const graph = await arrayNode('corpus-e7');

    const source = Collection.get('corpus-e7');
    await source.add(Model.create({ id: 'one' }));
    await source.add(Model.create({ id: 'two' }));
    graph.frame();

    expect(collectionOf(graph, 'array').size()).toBe(2);

    graph.node('array').setInputValue('items', undefined);
    graph.frame();

    expect(collectionOf(graph, 'array').size()).toBe(2);
  });

  // ✅ Pinned alongside it: the guard must stay a guard, not a general refusal to accept
  // input. A real collection still lands.
  test('E7 (pinned): a real items write is still accepted', async () => {
    const graph = await arrayNode('corpus-e7-real');

    const replacement = Collection.create([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    graph.node('array').setInputValue('items', replacement);
    await graph.settle(2);

    expect(collectionOf(graph, 'array').size()).toBe(3);
  });

  // NDA-003 §2: `collectionnode2.ts:112`'s guard was `undefined`-only; `null` fell into the
  // same "ignore it" hole even though the contract says it should clear. Not a corpus row of
  // its own (E7 is undefined-only), but the sibling behaviour the task's own site-by-site
  // table calls out — pinned here so it cannot regress silently.
  test('E7 (null): an Array node fed null items clears its collection', async () => {
    const graph = await arrayNode('corpus-e7-null');

    const source = Collection.get('corpus-e7-null');
    await source.add(Model.create({ id: 'one' }));
    await source.add(Model.create({ id: 'two' }));
    graph.frame();

    expect(collectionOf(graph, 'array').size()).toBe(2);

    graph.node('array').setInputValue('items', null);
    await graph.settle(2);

    expect(collectionOf(graph, 'array').size()).toBe(0);
  });
});
