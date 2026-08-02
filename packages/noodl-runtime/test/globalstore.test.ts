/**
 * AGENT-003 — the global observable store, its snapshot/patch primitives, and the three
 * nodes over it.
 *
 * The subscription semantics get the most attention here on purpose. A store is easy to
 * make work and hard to make *correct*: the failures that matter are a notification
 * delivered twice, one not delivered at all, a subscriber that outlives the node that
 * registered it, and an ordering that happens to hold today. Each of those has a test
 * below, and the snapshot/patch tests exist because AGENT-006 and AGENT-004 are going to
 * be written against them by somebody who was not here.
 */

import type { ModelLike, ModelModule, NodeInstance } from '@noodl/types';

import ModelImport from '../src/model';
import {
  globalStoreManager,
  MODEL_ID_PREFIX,
  StoreChange,
  StoreError,
  StoreSnapshot,
  StoreStorage
} from '../src/nodes/std-library/agent/globalstore';

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import GlobalStoreNodeModule = require('../src/nodes/std-library/agent/globalstorenode');
import SetGlobalStoreModule = require('../src/nodes/std-library/agent/globalstoresetnode');
import SubscribeToStoreModule = require('../src/nodes/std-library/agent/globalstoresubscribenode');

const Model = ModelImport as unknown as ModelModule;

const store = globalStoreManager;

/** Records every notification a subscriber receives, keeping the payload usable afterwards. */
function recorder() {
  const calls: {
    changedKeys: string[];
    state: Record<string, unknown>;
    previousState: Record<string, unknown>;
    revision: number;
  }[] = [];
  const fn = (change: StoreChange) => {
    calls.push({
      changedKeys: change.changedKeys.slice(),
      state: Object.assign({}, change.state),
      previousState: Object.assign({}, change.previousState),
      revision: change.revision
    });
  };
  return { calls, fn };
}

/** An in-memory {@link StoreStorage}, so persistence can be tested without a browser. */
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => (items.has(key) ? (items.get(key) as string) : null),
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key)
  } as StoreStorage & { items: Map<string, string> };
}

afterEach(() => {
  // The state itself lives in the global Model registry, so clearing it is not optional if
  // one test's keys are not to become the next one's starting conditions.
  store.reset({ clearState: true });
});

// ---------------------------------------------------------------------------
// Reading and writing
// ---------------------------------------------------------------------------

describe('store basics', () => {
  it('creates a store on first use, empty', () => {
    expect(store.getState('app')).toEqual({});
    expect(store.getStoreNames()).toEqual(['app']);
    expect(store.getRevision('app')).toBe(0);
  });

  it('defaults an unnamed store to "app"', () => {
    store.setKey('', 'a', 1);
    expect(store.getKey('app', 'a')).toBe(1);
  });

  it('reads and writes keys', () => {
    store.setKey('app', 'count', 1);
    expect(store.getKey('app', 'count')).toBe(1);
    expect(store.getState('app')).toEqual({ count: 1 });
    expect(store.hasKey('app', 'count')).toBe(true);
    expect(store.hasKey('app', 'nope')).toBe(false);
  });

  it('rejects a write with no key', () => {
    expect(() => store.setKey('app', '', 1)).toThrow('a key is required');
  });

  it('keeps named stores independent', () => {
    store.setKey('a', 'x', 1);
    store.setKey('b', 'x', 2);
    expect(store.getKey('a', 'x')).toBe(1);
    expect(store.getKey('b', 'x')).toBe(2);
  });

  it('is backed by one Model per store, reachable by a stable id', () => {
    store.setKey('session', 'user', 'ada');

    const id = store.modelIdFor('session');
    expect(id).toBe(MODEL_ID_PREFIX + 'session');
    expect(store.getModel('session')).toBe(Model.get(id));
    expect((Model.get(id) as ModelLike).get('user')).toBe('ada');
  });

  it('merges an object into a key when asked, and replaces otherwise', () => {
    store.setKey('app', 'user', { name: 'ada' });

    store.setKey('app', 'user', { age: 36 }, { merge: true });
    expect(store.getKey('app', 'user')).toEqual({ name: 'ada', age: 36 });

    store.setKey('app', 'user', { age: 37 });
    expect(store.getKey('app', 'user')).toEqual({ age: 37 });
  });

  it('deletes a key entirely, which Model alone cannot express', () => {
    store.setKey('app', 'a', 1);
    store.deleteKey('app', 'a');

    expect(store.hasKey('app', 'a')).toBe(false);
    expect(Object.keys(store.getState('app'))).toEqual([]);
  });

  it('distinguishes a key set to undefined from an absent key', () => {
    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    store.setKey('app', 'a', undefined);

    expect(store.hasKey('app', 'a')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].changedKeys).toEqual(['a']);
  });

  it('merges with setState and replaces with replaceState', () => {
    store.setState('app', { a: 1, b: 2 });
    store.setState('app', { b: 3 });
    expect(store.getState('app')).toEqual({ a: 1, b: 3 });

    store.replaceState('app', { c: 9 });
    expect(store.getState('app')).toEqual({ c: 9 });
  });

  it('empties a store on clear', () => {
    store.setState('app', { a: 1, b: 2 });
    store.clearStore('app');
    expect(store.getState('app')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Subscription semantics
// ---------------------------------------------------------------------------

describe('subscription semantics', () => {
  it('notifies once per write, with the changed key and both states', () => {
    store.setKey('app', 'count', 1);

    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    store.setKey('app', 'count', 2);

    expect(calls).toHaveLength(1);
    expect(calls[0].changedKeys).toEqual(['count']);
    expect(calls[0].state).toEqual({ count: 2 });
    expect(calls[0].previousState).toEqual({ count: 1 });
    expect(calls[0].revision).toBe(2);
  });

  it('does not notify when the value did not actually change', () => {
    store.setKey('app', 'count', 1);

    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    store.setKey('app', 'count', 1);

    expect(calls).toHaveLength(0);
    expect(store.getRevision('app')).toBe(1);
  });

  it('notifies for an identical value when the write is forced', () => {
    store.setKey('app', 'count', 1);

    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    store.setKey('app', 'count', 1, { force: true });

    expect(calls).toHaveLength(1);
    expect(calls[0].changedKeys).toEqual(['count']);
  });

  it('reports a deletion as a change, with the old value in previousState', () => {
    store.setKey('app', 'a', 1);

    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    store.deleteKey('app', 'a');

    expect(calls).toHaveLength(1);
    expect(calls[0].changedKeys).toEqual(['a']);
    expect(calls[0].previousState).toEqual({ a: 1 });
    expect(calls[0].state).toEqual({});
  });

  it('only calls a key-filtered subscriber when one of its keys changed', () => {
    const watched = recorder();
    const all = recorder();

    store.subscribe('app', watched.fn, ['count']);
    store.subscribe('app', all.fn);

    store.setKey('app', 'other', 1);
    expect(watched.calls).toHaveLength(0);
    expect(all.calls).toHaveLength(1);

    store.setKey('app', 'count', 1);
    expect(watched.calls).toHaveLength(1);
    expect(all.calls).toHaveLength(2);
  });

  it('treats an empty key list as "every key"', () => {
    const { calls, fn } = recorder();
    store.subscribe('app', fn, []);

    store.setKey('app', 'anything', 1);
    expect(calls).toHaveLength(1);
  });

  it('collapses a batch into one notification carrying every changed key', () => {
    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    store.batch('app', () => {
      store.setKey('app', 'a', 1);
      store.setKey('app', 'b', 2);
      store.setKey('app', 'c', 3);
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].changedKeys).toEqual(['a', 'b', 'c']);
    expect(calls[0].revision).toBe(1);
  });

  it('reports nothing when a batch ends where it started', () => {
    store.setKey('app', 'a', 1);

    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    store.batch('app', () => {
      store.setKey('app', 'a', 2);
      store.setKey('app', 'a', 1);
    });

    expect(calls).toHaveLength(0);
  });

  it('commits once for nested batches', () => {
    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    store.batch('app', () => {
      store.setKey('app', 'a', 1);
      store.batch('app', () => {
        store.setKey('app', 'b', 2);
      });
      expect(calls).toHaveLength(0);
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].changedKeys).toEqual(['a', 'b']);
  });

  it('still commits when the batch body throws', () => {
    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    expect(() =>
      store.batch('app', () => {
        store.setKey('app', 'a', 1);
        throw new Error('boom');
      })
    ).toThrow('boom');

    expect(calls).toHaveLength(1);
    expect(store.getKey('app', 'a')).toBe(1);
  });

  it('coalesces deferred writes from independent callers into one notification', () => {
    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    store.deferNotifications('app');
    store.setKey('app', 'a', 1);
    store.deferNotifications('app');
    store.setKey('app', 'b', 2);

    expect(calls).toHaveLength(0);

    store.flushBatches();

    expect(calls).toHaveLength(1);
    expect(calls[0].changedKeys).toEqual(['a', 'b']);
  });

  it('closes a deferred batch on its own at the end of the turn', async () => {
    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    store.deferNotifications('app');
    store.setKey('app', 'a', 1);
    expect(calls).toHaveLength(0);

    await Promise.resolve();

    expect(calls).toHaveLength(1);
  });

  it('calls subscribers in registration order', () => {
    const order: string[] = [];
    store.subscribe('app', () => order.push('first'));
    store.subscribe('app', () => order.push('second'));
    store.subscribe('app', () => order.push('third'));

    store.setKey('app', 'a', 1);

    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('stops notifying after unsubscribe, and unsubscribing twice is harmless', () => {
    const { calls, fn } = recorder();
    const unsubscribe = store.subscribe('app', fn);

    store.setKey('app', 'a', 1);
    unsubscribe();
    unsubscribe();
    store.setKey('app', 'a', 2);

    expect(calls).toHaveLength(1);
    expect(store.subscriberCount('app')).toBe(0);
  });

  it('skips a subscriber unsubscribed by an earlier one mid-notification', () => {
    const later = recorder();
    let unsubscribeLater: () => void = () => {};

    store.subscribe('app', () => unsubscribeLater());
    unsubscribeLater = store.subscribe('app', later.fn);

    store.setKey('app', 'a', 1);

    expect(later.calls).toHaveLength(0);
  });

  it('does not deliver the in-flight notification to a subscriber added during it', () => {
    const added = recorder();

    store.subscribe('app', () => {
      if (store.subscriberCount('app') === 1) store.subscribe('app', added.fn);
    });

    store.setKey('app', 'a', 1);
    expect(added.calls).toHaveLength(0);

    store.setKey('app', 'a', 2);
    expect(added.calls).toHaveLength(1);
  });

  it('isolates a throwing subscriber and reports it', () => {
    const errors: StoreError[] = [];
    store.onError('app', (error) => errors.push(error));

    const after = recorder();
    store.subscribe('app', () => {
      throw new Error('subscriber blew up');
    });
    store.subscribe('app', after.fn);

    expect(() => store.setKey('app', 'a', 1)).not.toThrow();

    expect(after.calls).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].phase).toBe('subscriber');
    expect(errors[0].message).toContain('subscriber blew up');
  });

  it('queues rather than recurses when a subscriber writes, and the write is visible at once', () => {
    const seen: { key: string; depth: number; cascadeValue: unknown }[] = [];
    let depth = 0;

    store.subscribe('app', (change) => {
      depth++;
      seen.push({
        key: change.changedKeys.join(','),
        depth,
        cascadeValue: store.getKey('app', 'cascade')
      });

      if (change.changedKeys.includes('trigger')) {
        store.setKey('app', 'cascade', 'written');
        // The write is applied immediately, even though its notification is queued.
        expect(store.getKey('app', 'cascade')).toBe('written');
      }
      depth--;
    });

    store.setKey('app', 'trigger', 1);

    expect(seen.map((entry) => entry.key)).toEqual(['trigger', 'cascade']);
    // Depth 1 both times: the second notification was drained by the first loop, not
    // delivered from inside it.
    expect(seen.map((entry) => entry.depth)).toEqual([1, 1]);
  });

  it('notifies subscribers when the backing Model is written directly', () => {
    // The claim being tested: this is one state system, not two sitting side by side.
    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    store.getModel('app').set('fromModel', 42);

    expect(calls).toHaveLength(1);
    expect(calls[0].changedKeys).toEqual(['fromModel']);
    expect(store.getKey('app', 'fromModel')).toBe(42);
  });

  it('keeps subscribers of different stores apart', () => {
    const a = recorder();
    const b = recorder();
    store.subscribe('a', a.fn);
    store.subscribe('b', b.fn);

    store.setKey('a', 'x', 1);

    expect(a.calls).toHaveLength(1);
    expect(b.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Snapshots (AGENT-006)
// ---------------------------------------------------------------------------

describe('snapshots', () => {
  it('copies plain data deeply in both directions', () => {
    store.setState('app', { nested: { list: [1, 2] }, when: new Date(0) });

    const snapshot = store.getSnapshot('app');

    (snapshot.state.nested as { list: number[] }).list.push(3);
    expect((store.getKey('app', 'nested') as { list: number[] }).list).toEqual([1, 2]);

    (store.getKey('app', 'nested') as { list: number[] }).list.push(4);
    expect((snapshot.state.nested as { list: number[] }).list).toEqual([1, 2, 3]);

    expect(snapshot.state.when).toBeInstanceOf(Date);
    expect(snapshot.byReference).toEqual([]);
    expect(snapshot.revision).toBe(store.getRevision('app'));
  });

  it('names the keys it could only copy by reference', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;

    store.setState('app', {
      plain: { a: 1 },
      model: Model.create({ name: 'ada' }),
      fn: () => 1,
      cyclic
    });

    const snapshot = store.getSnapshot('app');

    expect(snapshot.byReference.sort()).toEqual(['cyclic', 'fn', 'model']);
    expect(snapshot.state.plain).toEqual({ a: 1 });
  });

  it('restores as a full replace, in one notification, and can be replayed', () => {
    store.setState('app', { a: 1, b: 2 });
    const snapshot = store.getSnapshot('app');

    store.setState('app', { a: 9, c: 3 });

    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    const changed = store.restoreSnapshot(snapshot);

    expect(store.getState('app')).toEqual({ a: 1, b: 2 });
    expect(calls).toHaveLength(1);
    expect(changed.sort()).toEqual(['a', 'c']);

    // The snapshot survives being used: time travel means going back more than once.
    store.setKey('app', 'a', 100);
    store.restoreSnapshot(snapshot);
    expect(store.getState('app')).toEqual({ a: 1, b: 2 });
  });

  it('restores into a different store when told to', () => {
    store.setState('source', { a: 1 });
    const snapshot = store.getSnapshot('source');

    store.restoreSnapshot(snapshot, { storeName: 'target' });

    expect(store.getState('target')).toEqual({ a: 1 });
    expect(store.getState('source')).toEqual({ a: 1 });
  });

  it('rejects a snapshot with no state', () => {
    expect(() => store.restoreSnapshot({} as StoreSnapshot)).toThrow('expects a snapshot');
  });

  it('supports undo built the way AGENT-006 will build it', () => {
    // Not a test of AGENT-006 — a test that the primitives it was promised are enough.
    const history: StoreSnapshot[] = [store.getSnapshot('doc')];
    store.subscribe('doc', () => history.push(store.getSnapshot('doc')));

    store.setKey('doc', 'title', 'first');
    store.setKey('doc', 'title', 'second');
    store.setKey('doc', 'extra', true);

    expect(history).toHaveLength(4);

    store.restoreSnapshot(history[2]);
    expect(store.getState('doc')).toEqual({ title: 'second' });

    store.restoreSnapshot(history[1]);
    expect(store.getState('doc')).toEqual({ title: 'first' });

    store.restoreSnapshot(history[0]);
    expect(store.getState('doc')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Patches (AGENT-004)
// ---------------------------------------------------------------------------

describe('patches', () => {
  it('applies in one notification and reports itself as open', () => {
    store.setKey('app', 'status', 'pending');

    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    const patch = store.applyPatch('app', { status: 'accepted', spinner: false });

    expect(store.getState('app')).toEqual({ status: 'accepted', spinner: false });
    expect(calls).toHaveLength(1);
    expect(calls[0].changedKeys).toEqual(['status', 'spinner']);
    expect(patch.status).toBe('pending');
    expect(store.getOpenPatches('app').map((p) => p.id)).toEqual([patch.id]);
  });

  it('keeps the value on commit and closes the patch', () => {
    store.setKey('app', 'status', 'pending');
    const patch = store.applyPatch('app', { status: 'accepted' });

    expect(store.commitPatch(patch.id)).toBe(true);
    expect(store.getKey('app', 'status')).toBe('accepted');
    expect(store.getOpenPatches('app')).toEqual([]);
    expect(store.getPatch(patch.id)).toBeUndefined();
  });

  it('restores the previous value on rollback, in one notification', () => {
    store.setKey('app', 'status', 'pending');
    const patch = store.applyPatch('app', { status: 'accepted' });

    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    expect(store.rollbackPatch(patch.id)).toBe(true);

    expect(store.getKey('app', 'status')).toBe('pending');
    expect(calls).toHaveLength(1);
    expect(calls[0].changedKeys).toEqual(['status']);
  });

  it('deletes a key the patch introduced rather than leaving undefined behind', () => {
    const patch = store.applyPatch('app', { draft: 'hello' });
    expect(store.hasKey('app', 'draft')).toBe(true);

    store.rollbackPatch(patch.id);

    expect(store.hasKey('app', 'draft')).toBe(false);
    expect(store.getState('app')).toEqual({});
  });

  it('ignores an unknown patch and a second commit or rollback', () => {
    expect(store.commitPatch('nope')).toBe(false);
    expect(store.rollbackPatch('nope')).toBe(false);

    const patch = store.applyPatch('app', { a: 1 });
    expect(store.rollbackPatch(patch.id)).toBe(true);
    expect(store.rollbackPatch(patch.id)).toBe(false);
    expect(store.commitPatch(patch.id)).toBe(false);
  });

  it('refuses to reuse an open patch id', () => {
    store.applyPatch('app', { a: 1 }, { id: 'tx-1' });
    expect(() => store.applyPatch('app', { a: 2 }, { id: 'tx-1' })).toThrow('already open');
  });

  it('lands on the original value however two overlapping patches unwind', () => {
    for (const order of [
      ['older', 'newer'],
      ['newer', 'older']
    ]) {
      store.reset({ clearState: true });
      store.setKey('app', 'count', 0);

      const older = store.applyPatch('app', { count: 1 });
      const newer = store.applyPatch('app', { count: 2 });
      expect(store.getKey('app', 'count')).toBe(2);

      for (const which of order) {
        store.rollbackPatch(which === 'older' ? older.id : newer.id);
      }

      expect(store.getKey('app', 'count')).toBe(0);
    }
  });

  it('leaves a newer patch alone when an older one rolls back under it', () => {
    store.setKey('app', 'count', 0);

    const older = store.applyPatch('app', { count: 1 });
    store.applyPatch('app', { count: 2 });

    store.rollbackPatch(older.id);

    // The newer patch is still the truth on screen — the older rollback must not have
    // dragged the value back to 0 while a request for `2` is still in flight.
    expect(store.getKey('app', 'count')).toBe(2);
  });

  it('rolls a newer patch back onto a committed older one', () => {
    store.setKey('app', 'count', 0);

    const older = store.applyPatch('app', { count: 1 });
    const newer = store.applyPatch('app', { count: 2 });

    store.commitPatch(older.id);
    store.rollbackPatch(newer.id);

    expect(store.getKey('app', 'count')).toBe(1);
  });

  it('unwinds three patches on one key in any order', () => {
    store.setKey('app', 'count', 0);

    const first = store.applyPatch('app', { count: 1 });
    const second = store.applyPatch('app', { count: 2 });
    const third = store.applyPatch('app', { count: 3 });

    store.rollbackPatch(second.id);
    expect(store.getKey('app', 'count')).toBe(3);

    store.rollbackPatch(third.id);
    expect(store.getKey('app', 'count')).toBe(1);

    store.rollbackPatch(first.id);
    expect(store.getKey('app', 'count')).toBe(0);
  });

  it('keeps patches on different keys and stores independent', () => {
    store.setState('app', { a: 1, b: 2 });
    const patchA = store.applyPatch('app', { a: 10 });
    store.applyPatch('app', { b: 20 });
    const patchOther = store.applyPatch('other', { a: 99 });

    store.rollbackPatch(patchA.id);

    expect(store.getState('app')).toEqual({ a: 1, b: 20 });
    expect(store.getKey('other', 'a')).toBe(99);
    expect(store.getOpenPatches('other').map((p) => p.id)).toEqual([patchOther.id]);
  });

  it('rejects a patch that is not an object', () => {
    expect(() => store.applyPatch('app', 'nope' as never)).toThrow('plain object');
  });
});

// ---------------------------------------------------------------------------
// Configuration and persistence
// ---------------------------------------------------------------------------

describe('configuration and persistence', () => {
  it('fills in missing keys from initialState without overwriting live values', () => {
    store.setKey('app', 'count', 7);

    store.configureStore('app', { initialState: { count: 0, name: 'anon' } });

    expect(store.getState('app')).toEqual({ count: 7, name: 'anon' });
  });

  it('accepts initialState as JSON text, and reports text that is not JSON', () => {
    const errors: StoreError[] = [];
    store.onError('app', (error) => errors.push(error));

    store.configureStore('app', { initialState: '{"a":1}' });
    expect(store.getState('app')).toEqual({ a: 1 });

    store.configureStore('app', { initialState: 'not json' });
    expect(errors).toHaveLength(1);
    expect(errors[0].phase).toBe('clone');
  });

  it('writes to the storage seam once for a burst of changes', () => {
    const storage = memoryStorage();
    store.setStorage(storage);

    store.configureStore('drafts', { persist: true, storageKey: 'user-drafts' });
    store.setKey('drafts', 'a', 1);
    store.setKey('drafts', 'b', 2);

    expect(storage.items.size).toBe(0);

    store.flushPersistence();

    expect(JSON.parse(storage.items.get('noodl_store_user-drafts') as string)).toEqual({ a: 1, b: 2 });
  });

  it('loads a persisted store, letting it win over initialState', () => {
    const storage = memoryStorage();
    storage.setItem('noodl_store_session', JSON.stringify({ user: 'ada' }));
    store.setStorage(storage);

    store.configureStore('session', { initialState: { user: null, theme: 'dark' }, persist: true });

    expect(store.getState('session')).toEqual({ user: 'ada', theme: 'dark' });
  });

  it('says so, rather than failing quietly, when there is no storage', () => {
    const errors: StoreError[] = [];
    store.setStorage(null);
    store.onError('app', (error) => errors.push(error));

    store.configureStore('app', { persist: true });
    store.setKey('app', 'a', 1);
    store.flushPersistence();

    expect(errors).toHaveLength(1);
    expect(errors[0].phase).toBe('persist');
    expect(errors[0].message).toContain('no storage');
  });

  it('reports a value it could not serialise, and names the keys to blame', () => {
    const storage = memoryStorage();
    store.setStorage(storage);

    const errors: StoreError[] = [];
    store.onError('app', (error) => errors.push(error));

    store.configureStore('app', { persist: true });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    store.setKey('app', 'loop', cyclic);
    store.flushPersistence();

    expect(errors).toHaveLength(1);
    expect(errors[0].phase).toBe('persist');
    expect(errors[0].message).toContain('loop');
  });

  it('removes the persisted copy when the store is cleared', () => {
    const storage = memoryStorage();
    store.setStorage(storage);

    store.configureStore('app', { persist: true });
    store.setKey('app', 'a', 1);
    store.flushPersistence();
    expect(storage.items.size).toBe(1);

    store.clearStore('app');
    expect(storage.items.size).toBe(0);
  });

  it('drops an error listener on unsubscribe', () => {
    const errors: StoreError[] = [];
    const off = store.onError('app', (error) => errors.push(error));
    off();
    off();

    store.subscribe('app', () => {
      throw new Error('ignored');
    });

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    store.setKey('app', 'a', 1);
    spy.mockRestore();

    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// The nodes
// ---------------------------------------------------------------------------

interface Probe {
  node: NodeInstance;
  signals: string[];
}

function createContext() {
  const context = new NodeContext();
  context.nodeRegister.register(NodeDefinition.defineNode(GlobalStoreNodeModule.node));
  context.nodeRegister.register(NodeDefinition.defineNode(SetGlobalStoreModule.node));
  context.nodeRegister.register(NodeDefinition.defineNode(SubscribeToStoreModule.node));
  return context;
}

let nextNodeId = 0;

/** Creates a node and records the signals it emits, which is how a graph would see them. */
function createNode(context: InstanceType<typeof NodeContext>, type: string): Probe {
  const node = context.nodeRegister.createNode(type, 'node-' + ++nextNodeId) as NodeInstance;
  const signals: string[] = [];
  const original = node.sendSignalOnOutput.bind(node);
  node.sendSignalOnOutput = (name: string) => {
    signals.push(name);
    original(name);
  };
  return { node, signals };
}

function output(node: NodeInstance, name: string): unknown {
  return node.getOutput(name).value;
}

describe('Global Store node', () => {
  it('attaches, reports the store id, and signals ready', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.GlobalStore');

    node.setInputValue('storeName', 'session');
    node.setInputValue('initialState', { user: null });
    node.update();

    expect(signals).toContain('ready');
    expect(output(node, 'storeId')).toBe(MODEL_ID_PREFIX + 'session');
    expect(output(node, 'state')).toEqual({ user: null });
  });

  it('attaches once for several inputs arriving in the same frame', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.GlobalStore');

    node.setInputValue('storeName', 'session');
    node.setInputValue('persist', false);
    node.setInputValue('storageKey', 'ignored');
    node.update();

    expect(signals.filter((name) => name === 'ready')).toHaveLength(1);
    expect(store.subscriberCount('session')).toBe(1);
  });

  it('signals stateChanged and names the keys', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.GlobalStore');

    node.setInputValue('storeName', 'app');
    node.update();
    signals.length = 0;

    store.setState('app', { a: 1, b: 2 });

    expect(signals).toEqual(['stateChanged']);
    expect(output(node, 'changedKeys')).toBe('a,b');
    expect(output(node, 'state')).toEqual({ a: 1, b: 2 });
  });

  it('surfaces a store error on its error output', () => {
    const context = createContext();
    store.setStorage(null);

    const { node } = createNode(context, 'net.noodl.GlobalStore');
    node.setInputValue('storeName', 'app');
    node.setInputValue('persist', true);
    node.update();

    store.setKey('app', 'a', 1);
    store.flushPersistence();

    expect(String(output(node, 'error'))).toContain('no storage');
  });

  it('moves its subscription when the store name changes, without leaving one behind', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.GlobalStore');

    node.setInputValue('storeName', 'first');
    node.update();
    expect(store.subscriberCount('first')).toBe(1);

    node.setInputValue('storeName', 'second');
    node.update();

    expect(store.subscriberCount('first')).toBe(0);
    expect(store.subscriberCount('second')).toBe(1);
  });

  it('releases its subscription when deleted', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.GlobalStore');

    node.setInputValue('storeName', 'app');
    node.update();
    expect(store.subscriberCount('app')).toBe(1);

    (node as unknown as { _onNodeDeleted(): void })._onNodeDeleted();
    signals.length = 0;

    expect(store.subscriberCount('app')).toBe(0);

    store.setKey('app', 'a', 1);
    expect(signals).toEqual([]);
  });
});

describe('Set Global Store node', () => {
  it('writes the key and value that arrived in the same frame as the signal', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.GlobalStore.Set');

    node.setInputValue('storeName', 'app');
    node.setInputValue('set', true);
    node.setInputValue('key', 'count');
    node.setInputValue('value', 5);
    node.update();

    expect(store.getKey('app', 'count')).toBe(5);
    // ERG-001 §4 renamed this port: `completed` meant "the write happened", which is `done`.
    expect(signals).toContain('done');
    expect(output(node, 'error')).toBeUndefined();
  });

  it('reports a missing key instead of writing nothing quietly', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.GlobalStore.Set');

    node.setInputValue('value', 5);
    node.setInputValue('set', true);
    node.update();

    expect(output(node, 'error')).toBe('Key is required');
    // ⚠️ This row's meaning changed with ERG-001 §4, and the change is the point. It used to
    // pin `Completed` as *absent* on a failed write — the mutual exclusivity §0.2 Result 3
    // measured. The success signal is `done` now and is still absent; `completed` is the
    // universal one and must now be *present*, which is what the contract bought.
    expect(signals).not.toContain('done');
    expect(signals).toContain('completed');
    expect(store.getState('app')).toEqual({});
  });

  it('clears a previous error once a write succeeds', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.GlobalStore.Set');

    node.setInputValue('set', true);
    node.update();
    expect(output(node, 'error')).toBe('Key is required');

    node.setInputValue('key', 'a');
    node.setInputValue('value', 1);
    node.setInputValue('set', false);
    node.setInputValue('set', true);
    node.update();

    expect(output(node, 'error')).toBeUndefined();
    expect(store.getKey('app', 'a')).toBe(1);
  });

  it('merges into an object key when merge is on', () => {
    const context = createContext();
    store.setKey('app', 'user', { name: 'ada' });

    const { node } = createNode(context, 'net.noodl.GlobalStore.Set');
    node.setInputValue('key', 'user');
    node.setInputValue('merge', true);
    node.setInputValue('value', { age: 36 });
    node.setInputValue('set', true);
    node.update();

    expect(store.getKey('app', 'user')).toEqual({ name: 'ada', age: 36 });
  });

  it('coalesces two batching Set nodes into one notification', () => {
    const context = createContext();
    const { calls, fn } = recorder();
    store.subscribe('app', fn);

    for (const [key, value] of [
      ['a', 1],
      ['b', 2]
    ] as [string, number][]) {
      const { node } = createNode(context, 'net.noodl.GlobalStore.Set');
      node.setInputValue('transaction', true);
      node.setInputValue('key', key);
      node.setInputValue('value', value);
      node.setInputValue('set', true);
      node.update();
    }

    expect(calls).toHaveLength(0);
    store.flushBatches();

    expect(calls).toHaveLength(1);
    expect(calls[0].changedKeys).toEqual(['a', 'b']);
  });
});

describe('Subscribe to Store node', () => {
  it('projects a single watched key to its bare value', () => {
    const context = createContext();
    store.setKey('app', 'count', 3);

    const { node, signals } = createNode(context, 'net.noodl.GlobalStore.Subscribe');
    node.setInputValue('keys', 'count');
    node.update();

    expect(output(node, 'value')).toBe(3);

    store.setKey('app', 'count', 4);

    expect(signals).toEqual(['changed']);
    expect(output(node, 'value')).toBe(4);
    expect(output(node, 'previousValue')).toBe(3);
    expect(output(node, 'changedKeys')).toBe('count');
  });

  it('projects several watched keys to an object of just those keys', () => {
    const context = createContext();
    store.setState('app', { a: 1, b: 2, c: 3 });

    const { node } = createNode(context, 'net.noodl.GlobalStore.Subscribe');
    node.setInputValue('keys', 'a, b');
    node.update();

    expect(output(node, 'value')).toEqual({ a: 1, b: 2 });

    store.setKey('app', 'b', 9);
    expect(output(node, 'value')).toEqual({ a: 1, b: 9 });
    expect(output(node, 'previousValue')).toEqual({ a: 1, b: 2 });
  });

  it('watches the whole store when no keys are named', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.GlobalStore.Subscribe');
    node.setInputValue('keys', '');
    node.update();

    store.setKey('app', 'anything', 1);

    expect(signals).toEqual(['changed']);
    expect(output(node, 'value')).toEqual({ anything: 1 });
  });

  it('stays quiet for keys it does not watch', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.GlobalStore.Subscribe');
    node.setInputValue('keys', 'count');
    node.update();

    store.setKey('app', 'other', 1);
    expect(signals).toEqual([]);

    store.setKey('app', 'count', 1);
    expect(signals).toEqual(['changed']);
  });

  it('resubscribes when its keys change, without leaving a subscriber behind', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.GlobalStore.Subscribe');

    node.setInputValue('keys', 'a');
    node.update();
    node.setInputValue('keys', 'b');
    node.update();

    expect(store.subscriberCount('app')).toBe(1);

    store.setKey('app', 'a', 1);
    expect(signals).toEqual([]);

    store.setKey('app', 'b', 1);
    expect(signals).toEqual(['changed']);
  });

  it('releases its subscription when deleted', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.GlobalStore.Subscribe');
    node.setInputValue('keys', 'count');
    node.update();

    (node as unknown as { _onNodeDeleted(): void })._onNodeDeleted();
    signals.length = 0;

    expect(store.subscriberCount('app')).toBe(0);
    store.setKey('app', 'count', 1);
    expect(signals).toEqual([]);
  });

  it('carries a write from a Set node in one component to a Subscribe node in another', () => {
    // The whole point of the feature, end to end and with nothing wired between the two.
    const context = createContext();

    const subscriber = createNode(context, 'net.noodl.GlobalStore.Subscribe');
    subscriber.node.setInputValue('storeName', 'agenda');
    subscriber.node.setInputValue('keys', 'timeline');
    subscriber.node.update();

    const setter = createNode(context, 'net.noodl.GlobalStore.Set');
    setter.node.setInputValue('storeName', 'agenda');
    setter.node.setInputValue('key', 'timeline');
    setter.node.setInputValue('value', ['session-1']);
    setter.node.setInputValue('set', true);
    setter.node.update();

    expect(subscriber.signals).toEqual(['changed']);
    expect(output(subscriber.node, 'value')).toEqual(['session-1']);
  });
});
