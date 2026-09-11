/**
 * F50 — a plain array reaching a Repeater must render each element exactly once.
 *
 * Found while building the `ui-footer-columns` recipe (phase 54, DSG-003): a four-column
 * footer authored with 19 texts rendered 31, and `catalog:examples`, `catalog:tokens` and
 * `render:report` were all green while it happened. The doubled rows are real DOM; nothing
 * in the repo could see them.
 *
 * The route is the *documented* one — an array of plain objects wired straight into `items`,
 * which is what every example and every AI-authored page does.
 *
 * `Collection.set` turns each plain object into a Model via `Model.create`, and `Model.create`
 * with no `id` reaches `Model.get(undefined)`, which mints a *fresh* anonymous guid every call.
 * So the same array converted twice yields two disjoint sets of ids and the diff by `getId()`
 * matches nothing — every record is removed and re-added on every pass.
 *
 * That is wasteful on its own, but what makes it *draw twice* is that a Repeater has more than
 * one pass in flight. Binding `items` schedules `scheduleCopyItems`, and the `template` and
 * `templateType` setters each schedule a `refresh()`. `refresh()` iterates the collection
 * across `await`s while the coalesced copy pass sets the same array again underneath it; with
 * churning ids the two passes see disjoint records, so neither one's removals cancel the
 * other's additions and both sets of rows end up attached.
 *
 * None of it is visible on the Model route the rest of the corpus uses, because explicit ids
 * make the second conversion a no-op and the two passes agree.
 *
 * The fix is at the identity seam: a collection remembers which Model it minted for a given
 * source object, so converting the same array twice is stable and the diff means what it says.
 */

/* eslint-env jest */

import type { ModelLike, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

import NoodlRuntime from '@noodl/runtime';

import ForEachModule from '../../src/nodes/std-library/data/foreach';

/** The Repeater's minimal visual parent — the same three-method contract as NDA-013's. */
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

function itemNodeCount(graph: CorpusGraph): number {
  const repeater = graph.node('repeater') as unknown as {
    _internal: { itemNodes: Array<{ _forEachModel: ModelLike }> };
  };
  return repeater._internal.itemNodes.length;
}

/** What the container actually holds, which is what the DOM would show. */
function renderedItemCount(graph: CorpusGraph): number {
  const container = graph.node('container') as unknown as ContainerInstance;
  return container._children.filter((c) => (c as { _forEachModel?: ModelLike })._forEachModel !== undefined).length;
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

describe('F50: a plain array renders one item per element', () => {
  const savedNoodlRuntimeInstance = (NoodlRuntime as unknown as { instance?: unknown }).instance;

  beforeAll(() => {
    (NoodlRuntime as unknown as { instance?: unknown }).instance = { getProjectSettings: () => ({}) };
  });

  afterAll(() => {
    (NoodlRuntime as unknown as { instance?: unknown }).instance = savedNoodlRuntimeInstance;
  });

  test('plain objects with no id render once each', async () => {
    const graph = await repeaterGraph();

    const rows = [{ label: 'Products' }, { label: 'Company' }, { label: 'Legal' }];
    graph.node('repeater').setInputValue('items', rows);
    await graph.settle();

    expect(itemNodeCount(graph)).toBe(3);
    expect(renderedItemCount(graph)).toBe(3);
  });

  test('a Refresh after a plain-array bind does not double the list', async () => {
    const graph = await repeaterGraph();

    const rows = [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }];
    graph.node('repeater').setInputValue('items', rows);

    // Deliberately no settle in between: Refresh lands while the first bind's `add`
    // operations are still queued, which is the window the leftover ops survive.
    graph.node('repeater').setInputValue('refresh', true);
    await graph.settle();

    expect(itemNodeCount(graph)).toBe(4);
    expect(renderedItemCount(graph)).toBe(4);
  });

  test('re-binding an equal plain array replaces rather than appends', async () => {
    const graph = await repeaterGraph();

    graph.node('repeater').setInputValue('items', [{ label: 'a' }, { label: 'b' }]);
    await graph.settle();
    expect(itemNodeCount(graph)).toBe(2);

    // A fresh array with the same contents — what a Function node returning a literal
    // does on every re-evaluation.
    graph.node('repeater').setInputValue('items', [{ label: 'a' }, { label: 'b' }]);
    await graph.settle();

    expect(itemNodeCount(graph)).toBe(2);
    expect(renderedItemCount(graph)).toBe(2);
  });
});
