/**
 * NDA-012 (Visual) — `Dropdown`'s `Items` setter, which held three defects in eleven lines.
 *
 * `options.ts:57-67` before this fix:
 *
 * ```js
 * if (this._internal.items !== newValue && this._internal.items !== undefined) {
 *   this._internal.items.off('change', this._itemsChanged);
 * }
 * this._internal.items = newValue;
 * this._internal.items.on('change', this._itemsChanged);
 * ```
 *
 * - **`Items = null` threw.** The `.on` ran unconditionally, so a query that came back empty
 *   took the node down with a `TypeError`.
 * - **A re-sent collection left two `change` listeners.** The `off` was conditional on the two
 *   differing, so re-sending the *same* collection skipped it — and the `on` ran anyway.
 * - **The listener was never removed on delete.** Check `H1`.
 *
 * ⚠️ **`on`/`off` are installed on `Array.prototype`** by `collection.ts:643-669`, so a plain
 * array has them too and only a non-array (`null`, a string) throws. That is why the defect
 * needed a `null`, not merely a non-Collection, to show up.
 *
 * ⚠️ **These rows use the real graph harness rather than a hand-built instance.** A Dropdown's
 * `initialize` is the whole chained `NodeSharedPortDefinitions` stack — borders, padding, text
 * styles, control events — and it reaches a dozen methods a bag-of-fakes does not have. The
 * router test's hand-built shape does not transfer to a node with this many mixins.
 *
 * Every row observes the listener *behaviourally*, by mutating the collection and counting
 * re-renders, rather than by reaching into `_listeners`: the count is what the defect costs.
 */

/* eslint-env jest */

import Collection from '@noodl/runtime/src/collection';
import type { CollectionLike, NodeInstance } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

// The node modules reach `Noodl.deployed` at import time to decide whether to build editor
// tooltips, so it has to exist before the `require` below.
(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

/* eslint-disable @typescript-eslint/no-var-requires */
const OptionsModule = require('../../src/nodes/controls/options').default;
/* eslint-enable @typescript-eslint/no-var-requires */

interface DropdownProbe {
  graph: CorpusGraph;
  node: NodeInstance;
  /** How many times the node has re-rendered. Reset it before the line under test. */
  renders: () => number;
  resetRenders: () => void;
  setItems: (value: unknown) => void;
  /** Deletes the node through its scope, as the editor and the Repeater both do. */
  destroy: () => void;
}

/** The two instance members these rows drive that `NodeInstance` does not publish. */
interface DrivableNode {
  setInputValue(name: string, value: unknown): void;
  nodeScope: { deleteNode(node: unknown): void };
  props: Record<string, unknown>;
  forceUpdate(): void;
}

async function makeDropdown(): Promise<DropdownProbe> {
  const graph = await createCorpusGraph({
    modules: [OptionsModule as never],
    data: {
      components: [
        {
          name: '/root',
          nodes: [{ id: 'dropdown', type: OptionsModule.node.name, parameters: {} }]
        }
      ]
    } as never
  });

  // The text-style ports resolve through the project's style sheet; without it their setters
  // throw, and the throw rather than the behaviour becomes what the row measures.
  (graph.context as unknown as { styles: unknown }).styles = {
    getTextStyle: () => ({}),
    resolveColor: (c: unknown) => c
  };
  graph.update();

  const node = graph.node('dropdown') as unknown as NodeInstance;
  const drivable = node as unknown as DrivableNode;

  // `forceUpdate` is the node's own re-render call and is what `_itemsChanged` does; counting it
  // is how a surplus `change` listener becomes visible.
  // ⚠️ `forceUpdate` is a non-writable `Node.prototype` property, so a plain assignment throws.
  // An own property defined on the instance shadows it, and `_itemsChanged` closes over the
  // instance, so the listener finds the counter.
  let renders = 0;
  const original = drivable.forceUpdate;
  Object.defineProperty(node, 'forceUpdate', {
    configurable: true,
    writable: true,
    value: function patched() {
      renders++;
      return original.call(node);
    }
  });

  return {
    graph,
    node,
    renders: () => renders,
    resetRenders: () => {
      renders = 0;
    },
    setItems: (value: unknown) => drivable.setInputValue('items', value),
    destroy: () => drivable.nodeScope.deleteNode(node)
  };
}

/** A real Collection, so `on`/`off`/`set` are the runtime's own and not a fake. */
function collectionOf(...labels: string[]): CollectionLike {
  const collection = Collection.create();
  collection.set(labels.map((l) => ({ Label: l, Value: l.toLowerCase() })));
  return collection;
}

/** The node's own view of what it will hand the React component. */
const itemsProp = (d: DropdownProbe) => (d.node as unknown as DrivableNode).props.items;

describe('DD-1 — an empty Items clears the options instead of throwing', () => {
  // EMPTY-VALUE-CONTRACT: `null` clears. A Dropdown with nothing to offer offers nothing, which
  // `Select` already renders correctly — it tests `!props.items` (`Select.tsx:58`, `:115`).
  it('null clears the options and does not throw', async () => {
    const d = await makeDropdown();
    d.setItems(collectionOf('Ada', 'Grace'));
    expect(itemsProp(d)).toBeDefined();

    expect(() => d.setItems(null)).not.toThrow();

    expect(itemsProp(d)).toBeNull();
  }, 30000);

  it('null on a never-populated Dropdown does not throw either', async () => {
    const d = await makeDropdown();

    expect(() => d.setItems(null)).not.toThrow();

    expect(itemsProp(d)).toBeNull();
  }, 30000);

  // `undefined` is the other half of the contract and it is *not* the same as `null`: an
  // upstream that has produced no value yet has no opinion, so the options already showing stay.
  it('undefined abstains and leaves the current options alone', async () => {
    const d = await makeDropdown();
    const items = collectionOf('Ada', 'Grace');
    d.setItems(items);

    d.setItems(undefined);

    expect(itemsProp(d)).toBe(items);
  }, 30000);

  // The control: a populated collection binds and renders exactly as before.
  it('the control: a collection is stored, passed to the component and rendered', async () => {
    const d = await makeDropdown();
    const items = collectionOf('Ada', 'Grace');

    d.resetRenders();
    d.setItems(items);

    expect(itemsProp(d)).toBe(items);
    expect(d.renders()).toBe(1);
  }, 30000);
});

describe('DD-2 — a re-sent collection does not accumulate change listeners', () => {
  it('the same collection sent three times still re-renders once per change', async () => {
    const d = await makeDropdown();
    const items = collectionOf('Ada');

    d.setItems(items);
    d.setItems(items);
    d.setItems(items);

    // One mutation, one re-render. Before the fix each re-send added a listener, so this was 3.
    d.resetRenders();
    items.set([{ Label: 'Grace', Value: 'grace' }]);
    expect(d.renders()).toBe(1);
  }, 30000);

  it('the control: a different collection unsubscribes the previous one', async () => {
    const d = await makeDropdown();
    const first = collectionOf('Ada');
    const second = collectionOf('Grace');

    d.setItems(first);
    d.setItems(second);

    // The old collection is no longer this node's business.
    d.resetRenders();
    first.set([{ Label: 'Ada Lovelace', Value: 'ada' }]);
    expect(d.renders()).toBe(0);

    // …and the new one is.
    second.set([{ Label: 'Grace Hopper', Value: 'grace' }]);
    expect(d.renders()).toBe(1);
  }, 30000);

  it('the control: re-sending the same collection still re-renders, as it always did', async () => {
    const d = await makeDropdown();
    const items = collectionOf('Ada');
    d.setItems(items);

    d.resetRenders();
    d.setItems(items);

    expect(d.renders()).toBe(1);
  }, 30000);
});

describe('DD-3 — the change listener is removed when the node is deleted', () => {
  // Check H1. Nothing removed it, so a deleted Dropdown went on re-rendering whenever its
  // collection changed — and the collection is typically a shared query result that outlives it.
  it('a deleted Dropdown stops re-rendering on collection changes', async () => {
    const d = await makeDropdown();
    const items = collectionOf('Ada');
    d.setItems(items);

    d.destroy();

    d.resetRenders();
    items.set([{ Label: 'Grace', Value: 'grace' }]);
    expect(d.renders()).toBe(0);
  }, 30000);

  // The control: deleting a Dropdown that never received a collection must not throw on the way
  // out — the same `null`/`undefined` hole as DD-1, one method over.
  it('the control: deleting a never-populated Dropdown does not throw', async () => {
    const d = await makeDropdown();

    expect(() => d.destroy()).not.toThrow();
  }, 30000);

  it('the control: deleting after an empty Items does not throw', async () => {
    const d = await makeDropdown();
    d.setItems(null);

    expect(() => d.destroy()).not.toThrow();
  }, 30000);
});
