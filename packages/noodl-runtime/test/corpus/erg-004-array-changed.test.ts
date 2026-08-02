/**
 * ERG-004 §2 and §3 — `Array Changed`.
 *
 * Same discipline as `erg-004-object-changed.test.ts`, and for the same two reasons: the rows
 * observe through a **connected receiver**, because only a downstream node sees a value at the
 * moment its signal arrives; and every class is driven **twice**, because NV-ii's second half
 * says a single drive cannot distinguish "the previous value" from "no value at all".
 *
 * §3's lifecycle rows are the ones this file exists for. `Dropdown` — the near-exact precedent,
 * a node subscribing to a collection's `change` — left two listeners behind on a re-send and
 * never removed one on delete: three defects in an eleven-line setter. This node subscribes to
 * *n + 1* things, so it is that hazard multiplied by the length of the array, and the four
 * unsubscribe cases the spec names each get a row, plus the 100-cycle baseline check.
 */

/* eslint-env jest */

import type { NodeInstance } from '@noodl/types';

import { createGraph, type TestGraph, type TestNode } from '../helpers/node-harness';

import Collection = require('../../src/collection');
import Model = require('../../src/model');

/* eslint-disable @typescript-eslint/no-var-requires */
const ArrayChangedModule = require('../../../noodl-viewer-react/src/nodes/std-library/arraychanged').default;
/* eslint-enable @typescript-eslint/no-var-requires */

const ARRAY_CHANGED = 'net.noodl.ArrayChanged';

interface Observation {
  signal: string;
  index: unknown;
  item: unknown;
  key: unknown;
  count: unknown;
}

function recorderModule(observations: Observation[]) {
  function record(signal: string) {
    return function (this: NodeInstance) {
      observations.push({
        signal,
        index: this._internal.index,
        item: this._internal.item,
        key: this._internal.key,
        count: this._internal.count
      });
    };
  }

  const valuePort = (name: string) => ({
    type: '*',
    set: function (this: NodeInstance, v: unknown) {
      this._internal[name] = v;
    }
  });

  return {
    node: {
      name: 'test.ArrayRecorder',
      category: 'Test',
      initialize: function (this: NodeInstance) {
        this._internal.index = undefined;
        this._internal.item = undefined;
        this._internal.key = undefined;
        this._internal.count = undefined;
      },
      inputs: {
        index: valuePort('index'),
        item: valuePort('item'),
        key: valuePort('key'),
        count: valuePort('count'),
        onItemAdded: { valueChangedToTrue: record('itemAdded') },
        onItemRemoved: { valueChangedToTrue: record('itemRemoved') },
        onItemChanged: { valueChangedToTrue: record('itemChanged') },
        onArrayReplaced: { valueChangedToTrue: record('arrayReplaced') }
      }
    }
  };
}

interface Probe {
  graph: TestGraph;
  node: TestNode;
  seen: Observation[];
  watch(value: unknown): void;
  settle(): void;
  destroy(): void;
  /** How many members the node currently holds subscriptions for. */
  watchedCount(): number;
}

function makeProbe(): Probe {
  const seen: Observation[] = [];
  const graph = createGraph(ArrayChangedModule, recorderModule(seen));

  const node = graph.make(ARRAY_CHANGED, 'ac');
  const recorder = graph.make('test.ArrayRecorder', 'rec');

  recorder.connectInput('index', node, 'index');
  recorder.connectInput('item', node, 'item');
  recorder.connectInput('key', node, 'key');
  recorder.connectInput('count', node, 'count');
  recorder.connectInput('onItemAdded', node, 'itemAdded');
  recorder.connectInput('onItemRemoved', node, 'itemRemoved');
  recorder.connectInput('onItemChanged', node, 'itemChanged');
  recorder.connectInput('onArrayReplaced', node, 'arrayReplaced');

  return {
    graph,
    node,
    seen,
    watch: (value: unknown) => node.setInputValue('array', value),
    settle: () => recorder.update(),
    destroy: () => node._onNodeDeleted(),
    watchedCount: () => (node._internal as { watched: unknown[] }).watched.length
  };
}

/** `change` listeners registered on a Model — the leak, counted at the source. */
function listenerCount(model: unknown): number {
  const listeners = (model as { listeners?: Record<string, unknown[]> }).listeners;
  if (!listeners || !listeners.change) return 0;
  return listeners.change.length;
}

/** `add`/`remove`/`change` listeners registered on a collection. */
function arrayListenerCount(array: unknown): number {
  const listeners = (array as { _listeners?: Record<string, unknown[]> })._listeners;
  if (!listeners) return 0;
  return ['add', 'remove', 'change'].reduce((total, event) => total + (listeners[event] || []).length, 0);
}

function collectionOf(count: number) {
  const collection = Collection.create();
  for (let i = 0; i < count; i++) collection.add(Model.create());
  return collection;
}

// ---------------------------------------------------------------------------
// AC-1 / AC-2 — §2: add and remove, with index and item, driven twice.
// ---------------------------------------------------------------------------

describe('AC-1 — Item Added, driven twice', () => {
  it('reports the index and the item for each of two adds, and keeps Count current', () => {
    const p = makeProbe();
    const collection = Collection.create();
    p.watch(collection);
    p.settle();
    p.seen.length = 0;

    const first = Model.create();
    const second = Model.create();
    collection.add(first);
    p.settle();
    collection.add(second);
    p.settle();

    expect(p.seen).toEqual([
      { signal: 'itemAdded', index: 0, item: first, key: null, count: 1 },
      { signal: 'itemAdded', index: 1, item: second, key: null, count: 2 }
    ]);
  });
});

describe('AC-2 — Item Removed, driven twice', () => {
  it('reports the index the item occupied, for each of two removals', () => {
    const p = makeProbe();
    const collection = Collection.create();
    const first = Model.create();
    const second = Model.create();
    collection.add(first);
    collection.add(second);
    p.watch(collection);
    p.settle();
    p.seen.length = 0;

    collection.remove(second);
    p.settle();
    collection.remove(first);
    p.settle();

    expect(p.seen).toEqual([
      { signal: 'itemRemoved', index: 1, item: second, key: null, count: 1 },
      { signal: 'itemRemoved', index: 0, item: first, key: null, count: 0 }
    ]);
  });
});

describe('AC-3 — Array Replaced, driven twice', () => {
  it('fires for each different Array and reports the new Count', () => {
    const p = makeProbe();
    const first = collectionOf(2);
    const second = collectionOf(3);

    p.watch(first);
    p.settle();
    p.watch(second);
    p.settle();

    expect(p.seen).toEqual([
      { signal: 'arrayReplaced', index: null, item: null, key: null, count: 2 },
      { signal: 'arrayReplaced', index: null, item: null, key: null, count: 3 }
    ]);
  });

  it('re-sending the same Array reports nothing', () => {
    const p = makeProbe();
    const collection = collectionOf(2);
    p.watch(collection);
    p.settle();
    p.seen.length = 0;

    p.watch(collection);
    p.settle();

    expect(p.seen).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-4 — the §0 decision, made visible on the node.
// ---------------------------------------------------------------------------

describe('AC-4 — a wholesale set reports per-item detail, not one opaque Replaced', () => {
  // This is the spec premise that measurement overturned. `Collection.set` runs its diff
  // inside `withBatch`, so the node sees every arrival and departure individually — which is
  // why `Collection.notify('change')` was not enriched. See ERG-004-NOTES.md §0.
  it('replacing the contents in place reports the item that left and the one that arrived', () => {
    const p = makeProbe();
    const collection = Collection.create();
    collection.set([{ id: 'a' }, { id: 'b' }]);
    p.watch(collection);
    p.settle();
    p.seen.length = 0;

    collection.set([{ id: 'b' }, { id: 'c' }]);
    p.settle();

    const signals = p.seen.map((o) => o.signal);
    expect(signals).toContain('itemRemoved');
    expect(signals).toContain('itemAdded');
    // Not an Array Replaced: the identity of the collection never changed.
    expect(signals).not.toContain('arrayReplaced');
  });

  it('a reorder sends no signal but keeps Count accurate', () => {
    // `sort`/`reverse` emit `change` alone (S0-C). The node reports no signal for it and says
    // so on the Count port; the repair path exists so Count cannot go stale.
    const p = makeProbe();
    const collection = collectionOf(3);
    p.watch(collection);
    p.settle();
    p.seen.length = 0;

    collection.reverse();
    p.settle();

    expect(p.seen).toEqual([]);
    expect(p.node.getOutput('count').value).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// AC-5 — §3: Item Changed.
// ---------------------------------------------------------------------------

describe('AC-5 — Item Changed, driven twice', () => {
  it('fires for an in-place edit of an object inside the array, naming the key', () => {
    const p = makeProbe();
    const collection = Collection.create();
    const first = Model.create();
    const second = Model.create();
    collection.add(first);
    collection.add(second);
    p.watch(collection);
    p.settle();
    p.seen.length = 0;

    first.set('name', 'Ada');
    p.settle();
    second.set('city', 'London');
    p.settle();

    expect(p.seen).toEqual([
      { signal: 'itemChanged', index: 0, item: first, key: 'name', count: 2 },
      { signal: 'itemChanged', index: 1, item: second, key: 'city', count: 2 }
    ]);
  });

  it('an item added after the array was bound is watched too', () => {
    const p = makeProbe();
    const collection = Collection.create();
    p.watch(collection);

    const late = Model.create();
    collection.add(late);
    p.settle();
    p.seen.length = 0;

    late.set('name', 'Grace');
    p.settle();

    expect(p.seen).toEqual([{ signal: 'itemChanged', index: 0, item: late, key: 'name', count: 1 }]);
  });
});

// ---------------------------------------------------------------------------
// AC-6 — §3's four unsubscribe cases, one row each, plus the baseline check.
// ---------------------------------------------------------------------------

describe('AC-6 — the per-item subscriptions do not leak', () => {
  it('case 1: an item removed from the array stops being watched', () => {
    const p = makeProbe();
    const collection = Collection.create();
    const item = Model.create();
    collection.add(item);
    p.watch(collection);
    expect(listenerCount(item)).toBe(1);

    collection.remove(item);

    expect(listenerCount(item)).toBe(0);
    expect(p.watchedCount()).toBe(0);

    // …and it really is silent, not merely uncounted.
    p.settle();
    p.seen.length = 0;
    item.set('name', 'Ada');
    p.settle();
    expect(p.seen).toEqual([]);
  });

  it('case 2: replacing the array releases every member of the old one', () => {
    const p = makeProbe();
    const first = collectionOf(3);
    const second = collectionOf(2);
    const oldMembers = [first[0], first[1], first[2]];

    p.watch(first);
    expect(oldMembers.map(listenerCount)).toEqual([1, 1, 1]);

    p.watch(second);

    expect(oldMembers.map(listenerCount)).toEqual([0, 0, 0]);
    expect(arrayListenerCount(first)).toBe(0);
    expect(p.watchedCount()).toBe(2);
  });

  it('case 3: clearing the input with null releases everything', () => {
    const p = makeProbe();
    const collection = collectionOf(3);
    const members = [collection[0], collection[1], collection[2]];

    p.watch(collection);
    p.watch(null);

    expect(members.map(listenerCount)).toEqual([0, 0, 0]);
    expect(arrayListenerCount(collection)).toBe(0);
    expect(p.watchedCount()).toBe(0);
  });

  it('case 4: deleting the node releases the array and every member', () => {
    const p = makeProbe();
    const collection = collectionOf(3);
    const members = [collection[0], collection[1], collection[2]];

    p.watch(collection);
    p.destroy();

    expect(members.map(listenerCount)).toEqual([0, 0, 0]);
    expect(arrayListenerCount(collection)).toBe(0);
  });

  it('the control: deleting a never-populated node does not throw', () => {
    const p = makeProbe();
    expect(() => p.destroy()).not.toThrow();
  });

  it('re-sending the same array does not accumulate listeners', () => {
    // Dropdown's second defect, which cost it two `change` listeners per re-send.
    const p = makeProbe();
    const collection = collectionOf(2);

    p.watch(collection);
    p.watch(collection);
    p.watch(collection);

    expect(arrayListenerCount(collection)).toBe(3); // add, remove, change — one each
    expect(listenerCount(collection[0])).toBe(1);
    expect(p.watchedCount()).toBe(2);
  });

  it('100 add/remove cycles return the listener count to baseline', () => {
    const p = makeProbe();
    const collection = Collection.create();
    p.watch(collection);

    const baselineArray = arrayListenerCount(collection);
    const baselineWatched = p.watchedCount();
    expect(baselineWatched).toBe(0);

    const items = [];
    for (let i = 0; i < 100; i++) {
      const item = Model.create();
      items.push(item);
      collection.add(item);
      collection.remove(item);
    }

    expect(p.watchedCount()).toBe(baselineWatched);
    expect(arrayListenerCount(collection)).toBe(baselineArray);
    expect(items.map(listenerCount)).toEqual(new Array(100).fill(0));
  });

  it('100 items added then all removed also returns to baseline', () => {
    // The other order: everything watched at once, then drained. `_unwatchItem` splices a
    // parallel array, which is exactly where an off-by-one would hide.
    const p = makeProbe();
    const collection = Collection.create();
    p.watch(collection);

    const items = [];
    for (let i = 0; i < 100; i++) {
      const item = Model.create();
      items.push(item);
      collection.add(item);
    }
    expect(p.watchedCount()).toBe(100);
    expect(items.map(listenerCount)).toEqual(new Array(100).fill(1));

    for (let i = 0; i < 100; i++) collection.remove(items[i]);

    expect(p.watchedCount()).toBe(0);
    expect(items.map(listenerCount)).toEqual(new Array(100).fill(0));
  });
});

// ---------------------------------------------------------------------------
// AC-7 — inputs that would crash a duck-typed implementation.
// ---------------------------------------------------------------------------

describe('AC-7 — inputs that are not watchable arrays', () => {
  it('null on a never-populated node does not throw', () => {
    const p = makeProbe();
    expect(() => p.watch(null)).not.toThrow();
  });

  it('undefined abstains and leaves the current array bound', () => {
    const p = makeProbe();
    const collection = collectionOf(1);
    p.watch(collection);
    p.settle();
    p.seen.length = 0;

    p.watch(undefined);
    p.settle();
    expect(p.seen).toEqual([]);

    collection.add(Model.create());
    p.settle();
    expect(p.seen.map((o) => o.signal)).toEqual(['itemAdded']);
  });

  it('a plain array is watched, and plain-object members simply cannot be', () => {
    const p = makeProbe();
    const array: unknown[] = [];
    p.watch(array);
    p.settle();
    p.seen.length = 0;

    // ⚠️ Measured, because the obvious spelling is the one that does nothing. `push` on a
    // **bare** array is silent: the nine mutator wrappers live on the collection Proxy
    // (`collection.ts:356-428`), and a raw array never goes through it, so `push` is the
    // native method. `add` is different — it is an `Array.prototype` patch (`:590`) and
    // notifies on any array. `array.items.push(x)` notifies too, because `items` returns the
    // Proxy, which is NDA-002's corpus row R4.
    const ignored = { name: 'Ada' };
    (array as { push(v: unknown): void }).push(ignored);
    p.settle();
    expect(p.seen).toEqual([]);

    const plain = { name: 'Grace' };
    expect(() => (array as unknown as { add(v: unknown): void }).add(plain)).not.toThrow();
    p.settle();

    expect(p.seen.map((o) => o.signal)).toEqual(['itemAdded']);
    // …and nothing was subscribed to, because a plain object broadcasts nothing.
    expect(p.watchedCount()).toBe(0);
  });
});
