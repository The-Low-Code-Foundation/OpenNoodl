/**
 * NDA-004 §3 — the Repeater says when its items exist.
 *
 * The Repeater was one of the ten nodes that take a signal and emit none, and the one whose
 * silence cost the most. Item creation is queued, and with `repeaterCreateComponentsAsync`
 * it is deliberately spread across frames to protect the frame rate — so "the list is built
 * now" was a fact the runtime held and the author could not read. Every list-then-scroll,
 * list-then-measure and list-then-focus interaction was a guessed `Delay`.
 *
 * The signal fires when the operation queue drains, not when `refresh()` returns: `refresh()`
 * returning means the work was *queued*, and under chunked creation those are different
 * moments by several frames.
 */

/* eslint-env jest */

import type { ModelLike, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../noodl-runtime/test/corpus/graph-harness';

import NoodlRuntime from '@noodl/runtime';
import Model = require('@noodl/runtime/src/model');

import ForEachModule from '../src/nodes/std-library/data/foreach';

interface ContainerInstance extends NodeInstance {
  _children: Array<NodeInstance & { parent?: NodeInstance }>;
}

/** The Repeater's minimal visual parent — the same three-method contract `nda-013` uses. */
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
                { id: 'repeater', type: 'For Each', parameters: { template: '/Item', templateType: 'explicit' } }
              ]
            }
          ],
          connections: []
        },
        { name: '/Item', nodes: [], connections: [] }
      ]
    } as never
  });
}

describe('NDA-004 §3: Repeater — Items Rendered', () => {
  const savedNoodlRuntimeInstance = (NoodlRuntime as unknown as { instance?: unknown }).instance;

  beforeAll(() => {
    // `foreach.tsx` reads project settings straight off `NoodlRuntime.instance`; a corpus
    // graph never constructs one. Same stub as `nda-013-repeater-refresh`.
    (NoodlRuntime as unknown as { instance?: unknown }).instance = { getProjectSettings: () => ({}) };
  });

  afterAll(() => {
    (NoodlRuntime as unknown as { instance?: unknown }).instance = savedNoodlRuntimeInstance;
  });

  test('fires once the items for a fresh list exist', async () => {
    const graph = await repeaterGraph();

    expect(graph.signalsFor('repeater')).toEqual([]);

    graph.node('repeater').setInputValue('items', [Model.create({ id: 'a' }), Model.create({ id: 'b' })]);
    await graph.settle();

    expect(graph.signalsFor('repeater')).toEqual(['itemsRendered']);
  });

  test('fires again after a Refresh rebuild', async () => {
    const graph = await repeaterGraph();

    const items: ModelLike[] = [Model.create({ id: 'a' })];
    graph.node('repeater').setInputValue('items', items);
    await graph.settle();
    expect(graph.signalsFor('repeater')).toEqual(['itemsRendered']);

    items.push(Model.create({ id: 'b' }));
    graph.node('repeater').setInputValue('refresh', true);
    await graph.settle();

    expect(graph.signalsFor('repeater')).toEqual(['itemsRendered', 'itemsRendered']);
  });

  /**
   * A completion signal that fires when nothing completed is worse than none at all — an
   * author cannot tell "the list is ready" from "the Repeater was poked".
   */
  test('does not fire for a drain that had no work to do', async () => {
    const graph = await repeaterGraph();

    graph.node('repeater').setInputValue('items', [Model.create({ id: 'a' })]);
    await graph.settle();
    const afterFirstBuild = graph.signalsFor('repeater').length;

    // An empty settle: nothing queued, nothing built.
    await graph.settle();

    expect(graph.signalsFor('repeater').length).toBe(afterFirstBuild);
  });
});
