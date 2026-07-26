'use strict';

/**
 * AGENT-006 — state history, undo/redo, time travel and named snapshots.
 *
 * The cases that carry the weight here are the four ways a history goes subtly wrong:
 * an unbounded history (a leak), a redo stack that survives a new write (a future that no
 * longer follows from the present), a restore that records itself (undo never terminates),
 * and one undo step per keystroke (undo that does not match intent). Each has its own
 * describe block, and so does the by-reference limitation, which is the one thing this
 * feature cannot do and must therefore say out loud.
 */
import type { CollectionModule, ModelModule, NodeInstance } from '@noodl/types';

import CollectionImport from '../src/collection';
import ModelImport from '../src/model';
import { globalStoreManager } from '../src/nodes/std-library/agent/globalstore';
import { stateHistoryManager } from '../src/nodes/std-library/agent/statehistory';

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

import GlobalStoreNodeModule = require('../src/nodes/std-library/agent/globalstorenode');
import SetGlobalStoreModule = require('../src/nodes/std-library/agent/globalstoresetnode');
import StateHistoryNodeModule = require('../src/nodes/std-library/agent/statehistorynode');
import StateSnapshotNodeModule = require('../src/nodes/std-library/agent/statesnapshotnode');
import UndoNodeModule = require('../src/nodes/std-library/agent/undonode');

const Model = ModelImport as unknown as ModelModule;
const Collection = CollectionImport as unknown as CollectionModule;

const store = globalStoreManager;
const history = stateHistoryManager;

/** Attaches a history with no node in the way, and returns the detach. */
function track(storeName: string, options: Parameters<typeof history.attach>[1] = {}) {
  return history.attach(storeName, options, () => {});
}

function info(storeName: string) {
  const result = history.getHistoryInfo(storeName);
  if (!result) throw new Error(`not tracking ${storeName}`);
  return result;
}

afterEach(() => {
  history.reset();
  store.reset({ clearState: true });
});

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

describe('recording', () => {
  it('starts with one entry describing the state at the moment tracking began', () => {
    store.setKey('app', 'title', 'start');
    track('app');

    const h = info('app');
    expect(h.size).toBe(1);
    expect(h.currentIndex).toBe(0);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.entries[0].description).toBe('Initial state');
  });

  it('records one entry per commit, naming the keys', () => {
    track('app');

    store.setKey('app', 'a', 1);
    store.setState('app', { b: 2, c: 3 });

    const h = info('app');
    expect(h.size).toBe(3);
    expect(h.currentIndex).toBe(2);
    expect(h.entries[1].changedKeys).toBe('a');
    expect(h.entries[2].changedKeys).toBe('b,c');
    expect(h.entries[2].description).toBe('Changed: b, c');
  });

  it('records nothing for a write that changed nothing', () => {
    track('app');
    store.setKey('app', 'a', 1);
    store.setKey('app', 'a', 1);

    expect(info('app').size).toBe(2);
  });

  it('records a batch of writes as one entry', () => {
    track('app');

    store.batch('app', () => {
      store.setKey('app', 'a', 1);
      store.setKey('app', 'b', 2);
      store.setKey('app', 'c', 3);
    });

    expect(info('app').size).toBe(2);
    expect(info('app').entries[1].changedKeys).toBe('a,b,c');
  });

  it('marks exactly one entry as current', () => {
    track('app');
    store.setKey('app', 'a', 1);
    store.setKey('app', 'a', 2);

    expect(
      info('app')
        .entries.filter((entry) => entry.isCurrent)
        .map((entry) => entry.index)
    ).toEqual([2]);
  });
});

// ---------------------------------------------------------------------------
// Undo / redo
// ---------------------------------------------------------------------------

describe('undo and redo', () => {
  it('walks back and forward through the states', () => {
    track('app');
    store.setKey('app', 'title', 'first');
    store.setKey('app', 'title', 'second');
    store.setKey('app', 'extra', true);

    expect(store.getState('app')).toEqual({ title: 'second', extra: true });

    history.undo('app');
    expect(store.getState('app')).toEqual({ title: 'second' });

    history.undo('app');
    expect(store.getState('app')).toEqual({ title: 'first' });

    history.undo('app');
    expect(store.getState('app')).toEqual({});
    expect(info('app').canUndo).toBe(false);

    history.redo('app');
    expect(store.getState('app')).toEqual({ title: 'first' });

    history.redo('app');
    history.redo('app');
    expect(store.getState('app')).toEqual({ title: 'second', extra: true });
    expect(info('app').canRedo).toBe(false);
  });

  it('deletes keys an undo should not have, rather than leaving them behind', () => {
    track('app');
    store.setKey('app', 'a', 1);
    store.setKey('app', 'b', 2);

    history.undo('app');

    expect(store.hasKey('app', 'b')).toBe(false);
  });

  it('is a no-op at either end, and says so', () => {
    track('app');

    expect(history.undo('app')).toBeNull();
    expect(history.redo('app')).toBeNull();

    store.setKey('app', 'a', 1);
    expect(history.redo('app')).toBeNull();
    expect(history.undo('app')).not.toBeNull();
    expect(history.undo('app')).toBeNull();
  });

  it('returns null for a store nothing is tracking', () => {
    expect(history.undo('nope')).toBeNull();
    expect(history.redo('nope')).toBeNull();
    expect(history.jumpTo('nope', 0)).toBeNull();
    expect(history.getHistoryInfo('nope')).toBeNull();
    expect(history.isTracking('nope')).toBe(false);
  });

  it('notifies ordinary store subscribers, because an undo is just another write', () => {
    track('app');
    store.setKey('app', 'a', 1);

    const seen: string[][] = [];
    store.subscribe('app', (change) => seen.push(change.changedKeys.slice()));

    history.undo('app');

    expect(seen).toEqual([['a']]);
  });

  it('restores in one notification however many keys move', () => {
    track('app');
    store.batch('app', () => {
      store.setKey('app', 'a', 1);
      store.setKey('app', 'b', 2);
      store.setKey('app', 'c', 3);
    });

    let notifications = 0;
    store.subscribe('app', () => notifications++);

    history.undo('app');

    expect(notifications).toBe(1);
    expect(store.getState('app')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// The re-entrancy trap: a restore must not record itself
// ---------------------------------------------------------------------------

describe('re-entrant restore', () => {
  it('does not record the undo as a new entry', () => {
    track('app');
    store.setKey('app', 'a', 1);
    store.setKey('app', 'a', 2);

    const before = info('app').size;
    history.undo('app');

    expect(info('app').size).toBe(before);
    expect(info('app').currentIndex).toBe(1);
  });

  it('terminates: undoing repeatedly reaches the start and stops', () => {
    track('app');
    for (let i = 0; i < 5; i++) store.setKey('app', 'n', i);

    let steps = 0;
    while (history.undo('app') !== null) {
      steps++;
      if (steps > 20) throw new Error('undo did not terminate');
    }

    expect(steps).toBe(5);
    expect(store.getState('app')).toEqual({});
  });

  it('does not record a write another subscriber makes during the restore notification', () => {
    track('app');
    store.setKey('app', 'a', 1);
    store.setKey('app', 'a', 2);

    // A subscriber that writes back. AGENT-003 queues the resulting notification and drains
    // it inside the same synchronous call, so it is still inside the restoring window.
    const unsubscribe = store.subscribe('app', (change) => {
      if (change.changedKeys.includes('a') && store.getKey('app', 'mirror') !== store.getKey('app', 'a')) {
        store.setKey('app', 'mirror', store.getKey('app', 'a'));
      }
    });

    const before = info('app').size;
    history.undo('app');
    unsubscribe();

    expect(info('app').size).toBe(before);
  });

  it('clears the restoring flag even when a subscriber throws', () => {
    track('app');
    store.setKey('app', 'a', 1);

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribe = store.subscribe('app', () => {
      throw new Error('boom');
    });

    history.undo('app');
    unsubscribe();
    spy.mockRestore();

    // Recording still works afterwards.
    store.setKey('app', 'b', 9);
    expect(info('app').entries[info('app').currentIndex].changedKeys).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// The redo stack
// ---------------------------------------------------------------------------

describe('the redo stack', () => {
  it('is discarded by a new write, because those futures no longer follow', () => {
    track('app');
    store.setKey('app', 'a', 1);
    store.setKey('app', 'a', 2);
    store.setKey('app', 'a', 3);

    history.undo('app');
    history.undo('app');
    expect(info('app').canRedo).toBe(true);

    store.setKey('app', 'a', 99);

    const h = info('app');
    expect(h.canRedo).toBe(false);
    expect(h.size).toBe(3);
    expect(h.currentIndex).toBe(2);

    history.undo('app');
    expect(store.getKey('app', 'a')).toBe(1);
  });

  it('survives an undo followed by a redo with nothing in between', () => {
    track('app');
    store.setKey('app', 'a', 1);

    history.undo('app');
    history.redo('app');

    expect(store.getKey('app', 'a')).toBe(1);
    expect(info('app').canRedo).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

describe('history bounds', () => {
  it('drops the oldest entries once the bound is reached', () => {
    track('app', { maxHistory: 3 });

    for (let i = 1; i <= 5; i++) store.setKey('app', 'n', i);

    const h = info('app');
    expect(h.size).toBe(3);
    expect(h.currentIndex).toBe(2);

    history.undo('app');
    history.undo('app');
    expect(store.getKey('app', 'n')).toBe(3);
    expect(info('app').canUndo).toBe(false);
  });

  it('keeps the entry that describes live state, whichever gets dropped', () => {
    track('app', { maxHistory: 4 });
    for (let i = 1; i <= 10; i++) store.setKey('app', 'n', i);

    const h = info('app');
    expect(h.entries[h.currentIndex].isCurrent).toBe(true);
    expect(store.getKey('app', 'n')).toBe(10);

    history.undo('app');
    expect(store.getKey('app', 'n')).toBe(9);
  });

  it('trims immediately when the bound is lowered', () => {
    const detach = track('app', { maxHistory: 20 });
    for (let i = 1; i <= 10; i++) store.setKey('app', 'n', i);
    expect(info('app').size).toBe(11);

    history.configure('app', { maxHistory: 3 });

    expect(info('app').size).toBe(3);
    expect(store.getKey('app', 'n')).toBe(10);
    detach();
  });

  it('drops the redo tail rather than the present when the bound is lowered mid-travel', () => {
    track('app', { maxHistory: 20 });
    for (let i = 1; i <= 5; i++) store.setKey('app', 'n', i);
    while (history.undo('app') !== null) {
      /* walk to the very start */
    }
    expect(info('app').currentIndex).toBe(0);

    history.configure('app', { maxHistory: 2 });

    const h = info('app');
    expect(h.size).toBe(2);
    expect(h.currentIndex).toBe(0);
    // Live state still matches the entry we are sitting on.
    expect(store.getState('app')).toEqual({});
  });

  it('clamps a bound too small to undo anything', () => {
    track('app', { maxHistory: 1 });
    store.setKey('app', 'a', 1);

    expect(info('app').size).toBe(2);
    expect(info('app').canUndo).toBe(true);
  });

  it('defaults to 50 entries', () => {
    track('app');
    for (let i = 0; i < 80; i++) store.setKey('app', 'n', i);
    expect(info('app').size).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Coalescing
// ---------------------------------------------------------------------------

describe('coalescing', () => {
  it('is off by default: every change is its own undo step', () => {
    track('app');
    store.setKey('app', 'draft', 'a');
    store.setKey('app', 'draft', 'ab');
    store.setKey('app', 'draft', 'abc');

    expect(info('app').size).toBe(4);
  });

  it('folds same-key writes inside the window into one step', () => {
    let clock = 1000;
    history.setClock(() => clock);
    track('app', { coalesceMs: 500 });

    store.setKey('app', 'draft', 'a');
    clock += 50;
    store.setKey('app', 'draft', 'ab');
    clock += 50;
    store.setKey('app', 'draft', 'abc');

    expect(info('app').size).toBe(2);

    history.undo('app');
    expect(store.hasKey('app', 'draft')).toBe(false);
  });

  it('starts a new step once the window lapses', () => {
    let clock = 1000;
    history.setClock(() => clock);
    track('app', { coalesceMs: 500 });

    store.setKey('app', 'draft', 'a');
    clock += 100;
    store.setKey('app', 'draft', 'ab');
    clock += 5000;
    store.setKey('app', 'draft', 'abc');

    expect(info('app').size).toBe(3);

    history.undo('app');
    expect(store.getKey('app', 'draft')).toBe('ab');
  });

  it('does not fold writes to different keys', () => {
    let clock = 1000;
    history.setClock(() => clock);
    track('app', { coalesceMs: 500 });

    store.setKey('app', 'first', 'a');
    clock += 10;
    store.setKey('app', 'second', 'b');

    expect(info('app').size).toBe(3);
  });

  it('never folds into the initial entry, so undo can always reach the start', () => {
    let clock = 1000;
    history.setClock(() => clock);
    store.setKey('app', 'draft', '');
    track('app', { coalesceMs: 500 });

    store.setKey('app', 'draft', 'a');
    clock += 10;
    store.setKey('app', 'draft', 'ab');

    expect(info('app').size).toBe(2);
    history.undo('app');
    expect(store.getKey('app', 'draft')).toBe('');
  });

  it('never folds into the entry an undo just landed on', () => {
    let clock = 1000;
    history.setClock(() => clock);
    track('app', { coalesceMs: 500 });

    store.setKey('app', 'draft', 'a');
    clock += 1000;
    store.setKey('app', 'draft', 'ab');

    history.undo('app');
    expect(store.getKey('app', 'draft')).toBe('a');

    // Typing straight after the undo must not absorb into — and destroy — the entry that
    // holds "a"; it must branch from it.
    clock += 10;
    store.setKey('app', 'draft', 'aX');

    expect(store.getKey('app', 'draft')).toBe('aX');
    history.undo('app');
    expect(store.getKey('app', 'draft')).toBe('a');
  });

  it('works against the real Date.now, through jest fake timers', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-07-26T00:00:00Z'));
      track('app', { coalesceMs: 300 });

      store.setKey('app', 'draft', 'a');
      jest.advanceTimersByTime(50);
      store.setKey('app', 'draft', 'ab');
      expect(info('app').size).toBe(2);

      jest.advanceTimersByTime(1000);
      store.setKey('app', 'draft', 'abc');
      expect(info('app').size).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// Jump / time travel
// ---------------------------------------------------------------------------

describe('jumpTo', () => {
  it('moves to an absolute index', () => {
    track('app');
    store.setKey('app', 'n', 1);
    store.setKey('app', 'n', 2);
    store.setKey('app', 'n', 3);

    const result = history.jumpTo('app', 1);

    expect(result).not.toBeNull();
    expect(store.getKey('app', 'n')).toBe(1);
    expect(info('app').currentIndex).toBe(1);
    expect(info('app').canRedo).toBe(true);
  });

  it('refuses an index outside the history', () => {
    track('app');
    store.setKey('app', 'n', 1);

    expect(history.jumpTo('app', -1)).toBeNull();
    expect(history.jumpTo('app', 5)).toBeNull();
    expect(history.jumpTo('app', NaN)).toBeNull();
    expect(store.getKey('app', 'n')).toBe(1);
  });

  it('can be scrubbed back and forth without drift', () => {
    track('app');
    for (let i = 1; i <= 4; i++) store.setKey('app', 'n', i);

    for (const index of [0, 4, 2, 1, 3, 0, 4]) {
      history.jumpTo('app', index);
      expect(store.getKey('app', 'n')).toBe(index === 0 ? undefined : index);
    }
  });
});

// ---------------------------------------------------------------------------
// Clear, pause, resume
// ---------------------------------------------------------------------------

describe('clear, pause and resume', () => {
  it('clears back to a single entry holding the live state', () => {
    track('app');
    store.setKey('app', 'a', 1);
    store.setKey('app', 'b', 2);

    history.clearHistory('app');

    const h = info('app');
    expect(h.size).toBe(1);
    expect(h.currentIndex).toBe(0);
    expect(h.canUndo).toBe(false);
    expect(store.getState('app')).toEqual({ a: 1, b: 2 });
  });

  it('records nothing while paused, and keeps what it already had', () => {
    track('app');
    store.setKey('app', 'a', 1);

    history.setEnabled('app', false);
    store.setKey('app', 'a', 2);
    store.setKey('app', 'a', 3);

    expect(info('app').size).toBe(2);
    expect(info('app').enabled).toBe(false);
  });

  it('records a fresh entry on resume when the state drifted while paused', () => {
    track('app');
    store.setKey('app', 'a', 1);

    history.setEnabled('app', false);
    store.setKey('app', 'a', 99);
    history.setEnabled('app', true);

    // The invariant: the current entry describes live state, so an undo goes to the state
    // as it was when recording stopped, not to something that never immediately preceded it.
    expect(info('app').size).toBe(3);
    history.undo('app');
    expect(store.getKey('app', 'a')).toBe(1);
  });

  it('records nothing on resume when nothing drifted', () => {
    track('app');
    store.setKey('app', 'a', 1);

    history.setEnabled('app', false);
    history.setEnabled('app', true);

    expect(info('app').size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// trackKeys
// ---------------------------------------------------------------------------

describe('tracked keys', () => {
  it('records only the keys it was told to', () => {
    track('app', { trackKeys: ['a'] });

    store.setKey('app', 'a', 1);
    store.setKey('app', 'b', 2);

    expect(info('app').size).toBe(2);
    expect(info('app').entries[1].changedKeys).toBe('a');
  });

  it('undoes only the tracked keys, leaving the rest of the store alone', () => {
    track('app', { trackKeys: ['a'] });

    store.setKey('app', 'a', 1);
    store.setKey('app', 'b', 'untouched');

    history.undo('app');

    expect(store.hasKey('app', 'a')).toBe(false);
    expect(store.getKey('app', 'b')).toBe('untouched');
  });

  it('hands out a copy, so the app cannot mutate the past', () => {
    track('app', { trackKeys: ['doc'] });

    store.setKey('app', 'doc', { title: 'one' });
    store.setKey('app', 'doc', { title: 'two' });

    history.undo('app');
    (store.getKey('app', 'doc') as { title: string }).title = 'vandalised';

    history.redo('app');
    history.undo('app');
    expect(store.getKey('app', 'doc')).toEqual({ title: 'one' });
  });

  it('clears the history when the tracked keys change, because it means something else now', () => {
    track('app', { trackKeys: ['a'] });
    store.setKey('app', 'a', 1);
    expect(info('app').size).toBe(2);

    history.configure('app', { trackKeys: ['b'] });

    expect(info('app').size).toBe(1);
    store.setKey('app', 'a', 2);
    expect(info('app').size).toBe(1);
    store.setKey('app', 'b', 1);
    expect(info('app').size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// The by-reference limitation
// ---------------------------------------------------------------------------

describe('the by-reference limitation', () => {
  it('reports keys holding a Collection, which is an Array subclass and not plain data', () => {
    track('app');

    const collection = Collection.get('history-test-collection');
    store.setKey('app', 'items', collection);

    const h = info('app');
    expect(h.byReferenceKeys).toEqual(['items']);
    expect(h.entries[h.currentIndex].partial).toBe(true);
    expect(h.entries[h.currentIndex].byReference).toBe('items');
  });

  it('reports keys holding a Model', () => {
    track('app');
    store.setKey('app', 'user', Model.get('history-test-model'));
    expect(info('app').byReferenceKeys).toEqual(['user']);
  });

  it('reports keys holding a function', () => {
    track('app');
    store.setKey('app', 'callback', () => 1);
    expect(info('app').byReferenceKeys).toEqual(['callback']);
  });

  it('says the history is complete when everything in it is plain data', () => {
    track('app');
    store.setKey('app', 'a', { nested: [1, 2, { deep: true }] });
    store.setKey('app', 'when', new Date(0));

    expect(info('app').byReferenceKeys).toEqual([]);
    expect(info('app').entries.every((entry) => entry.partial === false)).toBe(true);
  });

  it('puts the same live object back rather than a dead copy — the cost the flag warns about', () => {
    track('app');
    const collection = Collection.get('history-test-live');
    store.setKey('app', 'items', collection);
    store.setKey('app', 'other', 1);

    history.undo('app');

    // Restored by reference: still the Collection, not a plain array of its contents.
    expect(store.getKey('app', 'items')).toBe(collection);
    expect(Collection.instanceOf(store.getKey('app', 'items'))).toBe(true);
  });

  it('reports the union across the whole history, not only the current entry', () => {
    track('app');
    store.setKey('app', 'fn', () => 1);
    store.deleteKey('app', 'fn');
    store.setKey('app', 'model', Model.get('history-test-union'));

    expect(info('app').byReferenceKeys).toEqual(['fn', 'model']);
    expect(history.getHistoryInfo('app')?.entries[info('app').currentIndex].byReference).toBe('model');
  });

  it('projects the flag down to the tracked keys', () => {
    track('app', { trackKeys: ['plain'] });
    store.setKey('app', 'ignored', () => 1);
    store.setKey('app', 'plain', 1);

    expect(info('app').byReferenceKeys).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Sharing and teardown
// ---------------------------------------------------------------------------

describe('sharing and teardown', () => {
  it('shares one history and one store subscription between two trackers', () => {
    const first = track('app');
    const second = track('app');

    expect(store.subscriberCount('app')).toBe(1);

    store.setKey('app', 'a', 1);
    expect(info('app').size).toBe(2);

    // Losing one tracker must not wipe the other's undo stack.
    first();
    expect(history.isTracking('app')).toBe(true);
    expect(info('app').size).toBe(2);

    second();
    expect(history.isTracking('app')).toBe(false);
  });

  it('releases the store subscription and the snapshots when the last tracker goes', () => {
    const detach = track('app');
    for (let i = 0; i < 5; i++) store.setKey('app', 'n', i);

    detach();

    expect(store.subscriberCount('app')).toBe(0);
    expect(history.getHistoryInfo('app')).toBeNull();

    store.setKey('app', 'n', 99);
    expect(history.getHistoryInfo('app')).toBeNull();
  });

  it('detaching twice is harmless', () => {
    const detach = track('app');
    detach();
    detach();
    expect(history.isTracking('app')).toBe(false);
  });

  it('keeps histories of different stores apart', () => {
    track('a');
    track('b');

    store.setKey('a', 'x', 1);

    expect(info('a').size).toBe(2);
    expect(info('b').size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Named snapshots
// ---------------------------------------------------------------------------

describe('named snapshots', () => {
  it('saves and restores a checkpoint', () => {
    store.setState('app', { a: 1, b: 2 });
    history.saveNamedSnapshot('checkpoint', 'app');

    store.setState('app', { a: 99 });
    store.deleteKey('app', 'b');

    history.restoreNamedSnapshot('checkpoint');

    expect(store.getState('app')).toEqual({ a: 1, b: 2 });
  });

  it('can be restored any number of times', () => {
    store.setKey('app', 'a', 1);
    history.saveNamedSnapshot('c', 'app');

    for (let i = 0; i < 3; i++) {
      store.setKey('app', 'a', i + 10);
      history.restoreNamedSnapshot('c');
      expect(store.getKey('app', 'a')).toBe(1);
    }
  });

  it('does not disturb the undo stack when saved, and is undoable when restored', () => {
    track('app');
    store.setKey('app', 'a', 1);
    history.saveNamedSnapshot('c', 'app');
    expect(info('app').size).toBe(2);

    store.setKey('app', 'a', 2);
    history.restoreNamedSnapshot('c');

    // Restoring a checkpoint is an ordinary write, so it is itself undoable.
    expect(store.getKey('app', 'a')).toBe(1);
    expect(info('app').size).toBe(4);
    history.undo('app');
    expect(store.getKey('app', 'a')).toBe(2);
  });

  it('refuses an unnamed snapshot and an unknown name', () => {
    expect(() => history.saveNamedSnapshot('', 'app')).toThrow('name is required');
    expect(() => history.restoreNamedSnapshot('nope')).toThrow('no snapshot named');
  });

  it('restores into another store when asked', () => {
    store.setKey('source', 'a', 1);
    history.saveNamedSnapshot('c', 'source');

    history.restoreNamedSnapshot('c', { storeName: 'target' });

    expect(store.getState('target')).toEqual({ a: 1 });
    expect(store.getState('source')).toEqual({ a: 1 });
  });

  it('round-trips through JSON, which is the export/import path', () => {
    store.setState('app', { a: 1, nested: { b: [1, 2] } });
    const saved = history.saveNamedSnapshot('c', 'app');

    const exported = JSON.stringify(saved);
    store.clearStore('app');
    expect(store.getState('app')).toEqual({});

    history.restoreSnapshotData(exported);

    expect(store.getState('app')).toEqual({ a: 1, nested: { b: [1, 2] } });
  });

  it('rejects snapshot data that is not a snapshot', () => {
    expect(() => history.restoreSnapshotData({ nope: true })).toThrow('must be an object with a "state" object');
    expect(() => history.restoreSnapshotData(null)).toThrow();
  });

  it('lists and deletes snapshots', () => {
    history.saveNamedSnapshot('one', 'app');
    history.saveNamedSnapshot('two', 'app');

    expect(history.getSnapshotNames()).toEqual(['one', 'two']);
    expect(history.deleteNamedSnapshot('one')).toBe(true);
    expect(history.deleteNamedSnapshot('one')).toBe(false);
    expect(history.getSnapshotNames()).toEqual(['two']);
    expect(history.getNamedSnapshot('two')).toBeDefined();
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
  context.nodeRegister.register(NodeDefinition.defineNode(StateHistoryNodeModule.node));
  context.nodeRegister.register(NodeDefinition.defineNode(UndoNodeModule.node));
  context.nodeRegister.register(NodeDefinition.defineNode(StateSnapshotNodeModule.node));
  return context;
}

let nextNodeId = 0;

function createNode(context: InstanceType<typeof NodeContext>, type: string): Probe {
  const node = context.nodeRegister.createNode(type, 'history-node-' + ++nextNodeId) as NodeInstance;
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

function deleteNode(node: NodeInstance) {
  (node as unknown as { _onNodeDeleted(): void })._onNodeDeleted();
}

describe('State History node', () => {
  it('tracks and reports its status', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.StateHistory');

    node.setInputValue('storeName', 'app');
    node.update();

    expect(output(node, 'historySize')).toBe(1);
    expect(output(node, 'canUndo')).toBe(false);

    store.setKey('app', 'a', 1);

    expect(signals).toContain('historyChanged');
    expect(output(node, 'historySize')).toBe(2);
    expect(output(node, 'currentIndex')).toBe(1);
    expect(output(node, 'canUndo')).toBe(true);
    expect(output(node, 'canRedo')).toBe(false);
  });

  it('attaches once for several inputs arriving in the same frame', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.StateHistory');

    node.setInputValue('storeName', 'app');
    node.setInputValue('maxHistory', 10);
    node.setInputValue('coalesceMs', 0);
    node.update();

    expect(store.subscriberCount('app')).toBe(1);
    expect(info('app').size).toBe(1);
  });

  it('keeps its history when an unrelated input changes', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.StateHistory');

    node.setInputValue('storeName', 'app');
    node.update();
    store.setKey('app', 'a', 1);
    expect(output(node, 'historySize')).toBe(2);

    node.setInputValue('maxHistory', 10);
    node.update();

    expect(output(node, 'historySize')).toBe(2);
  });

  it('exposes the entries as an array a Repeater can draw', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.StateHistory');

    node.setInputValue('storeName', 'app');
    node.update();
    store.setKey('app', 'a', 1);

    const entries = output(node, 'history') as { index: number; description: string }[];
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.map((entry) => entry.description)).toEqual(['Initial state', 'Changed: a']);
  });

  it('surfaces the by-reference caveat on the graph', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.StateHistory');

    node.setInputValue('storeName', 'app');
    node.update();

    expect(output(node, 'fullyRestorable')).toBe(true);
    expect(output(node, 'byReferenceKeys')).toBe('');

    store.setKey('app', 'items', Collection.get('history-node-collection'));

    expect(output(node, 'fullyRestorable')).toBe(false);
    expect(output(node, 'byReferenceKeys')).toBe('items');
  });

  it('names the caveat in the inspector too', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.StateHistory');
    node.setInputValue('storeName', 'app');
    node.update();
    store.setKey('app', 'fn', () => 1);

    const inspect = (node as unknown as { getInspectInfo(): { value: string }[] }).getInspectInfo();
    expect(JSON.stringify(inspect)).toContain('Undo cannot fully restore');
    expect(JSON.stringify(inspect)).toContain('fn');
  });

  it('clears its history on the Clear History signal', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.StateHistory');

    node.setInputValue('storeName', 'app');
    node.update();
    store.setKey('app', 'a', 1);
    store.setKey('app', 'a', 2);
    expect(output(node, 'historySize')).toBe(3);

    node.setInputValue('clearHistory', true);
    node.update();

    expect(output(node, 'historySize')).toBe(1);
  });

  it('pauses on Enabled = false and keeps what it had', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.StateHistory');

    node.setInputValue('storeName', 'app');
    node.update();
    store.setKey('app', 'a', 1);

    node.setInputValue('enabled', false);
    node.update();
    store.setKey('app', 'a', 2);

    expect(output(node, 'historySize')).toBe(2);
  });

  it('moves its tracking when the store name changes', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.StateHistory');

    node.setInputValue('storeName', 'first');
    node.update();
    expect(store.subscriberCount('first')).toBe(1);

    node.setInputValue('storeName', 'second');
    node.update();

    expect(history.isTracking('first')).toBe(false);
    expect(store.subscriberCount('first')).toBe(0);
    expect(store.subscriberCount('second')).toBe(1);
  });

  it('releases its history and its snapshots when deleted', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.StateHistory');

    node.setInputValue('storeName', 'app');
    node.update();
    for (let i = 0; i < 5; i++) store.setKey('app', 'n', i);
    expect(store.subscriberCount('app')).toBe(1);

    deleteNode(node);
    signals.length = 0;

    expect(store.subscriberCount('app')).toBe(0);
    expect(history.isTracking('app')).toBe(false);

    store.setKey('app', 'n', 99);
    expect(signals).toEqual([]);
  });
});

describe('Undo / Redo node', () => {
  function tracked(context: InstanceType<typeof NodeContext>, storeName = 'app') {
    const { node } = createNode(context, 'net.noodl.StateHistory');
    node.setInputValue('storeName', storeName);
    node.update();
    return node;
  }

  it('undoes and redoes, signalling each', () => {
    const context = createContext();
    tracked(context);
    store.setKey('app', 'a', 1);

    const { node, signals } = createNode(context, 'net.noodl.StateHistory.Undo');
    node.setInputValue('storeName', 'app');
    node.setInputValue('undo', true);
    node.update();

    expect(signals).toEqual(['undone']);
    expect(store.hasKey('app', 'a')).toBe(false);

    signals.length = 0;
    node.setInputValue('redo', true);
    node.update();

    expect(signals).toEqual(['redone']);
    expect(store.getKey('app', 'a')).toBe(1);
  });

  it('jumps to the index that arrived in the same frame as the signal', () => {
    const context = createContext();
    tracked(context);
    store.setKey('app', 'n', 1);
    store.setKey('app', 'n', 2);
    store.setKey('app', 'n', 3);

    const { node, signals } = createNode(context, 'net.noodl.StateHistory.Undo');
    node.setInputValue('storeName', 'app');
    node.setInputValue('jumpTo', true);
    node.setInputValue('targetIndex', 1);
    node.update();

    expect(signals).toEqual(['jumped']);
    expect(store.getKey('app', 'n')).toBe(1);
  });

  it('emits nothing at the ends of the history', () => {
    const context = createContext();
    tracked(context);

    const { node, signals } = createNode(context, 'net.noodl.StateHistory.Undo');
    node.setInputValue('storeName', 'app');
    node.setInputValue('undo', true);
    node.update();

    expect(signals).toEqual([]);
    expect(output(node, 'error')).toBeUndefined();
  });

  it('reports an out-of-range jump rather than doing nothing quietly', () => {
    const context = createContext();
    tracked(context);

    const { node, signals } = createNode(context, 'net.noodl.StateHistory.Undo');
    node.setInputValue('storeName', 'app');
    node.setInputValue('jumpTo', true);
    node.setInputValue('targetIndex', 42);
    node.update();

    expect(signals).toEqual([]);
    expect(String(output(node, 'error'))).toContain('outside the history');
  });

  it('reports a store nothing is tracking', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.StateHistory.Undo');

    node.setInputValue('storeName', 'untracked');
    node.setInputValue('undo', true);
    node.update();

    expect(signals).toEqual([]);
    expect(String(output(node, 'error'))).toContain('No State History node is tracking');
  });

  it('clears the error once something works', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.StateHistory.Undo');

    node.setInputValue('storeName', 'app');
    node.setInputValue('undo', true);
    node.update();
    expect(output(node, 'error')).toBeDefined();

    tracked(context);
    store.setKey('app', 'a', 1);

    // Signal inputs are edge-triggered, so a repeat action is false-then-true.
    node.setInputValue('undo', false);
    node.setInputValue('undo', true);
    node.update();

    expect(output(node, 'error')).toBeUndefined();
  });

  it('reports whether the restore it just made was complete', () => {
    const context = createContext();
    tracked(context);
    store.setKey('app', 'items', Collection.get('undo-node-collection'));
    store.setKey('app', 'other', 1);

    const { node } = createNode(context, 'net.noodl.StateHistory.Undo');
    node.setInputValue('storeName', 'app');
    node.setInputValue('undo', true);
    node.update();

    // The entry it landed on holds a Collection, which no snapshot can copy.
    expect(output(node, 'fullyRestorable')).toBe(false);
    expect(output(node, 'byReferenceKeys')).toBe('items');

    // Stepping back again lands on the empty initial state, which is complete.
    node.setInputValue('undo', false);
    node.setInputValue('undo', true);
    node.update();

    expect(output(node, 'fullyRestorable')).toBe(true);
    expect(output(node, 'byReferenceKeys')).toBe('');
  });

  it('drives a history a different node created, with only the store name in common', () => {
    const context = createContext();
    tracked(context, 'shared');
    store.setKey('shared', 'a', 1);

    const { node } = createNode(context, 'net.noodl.StateHistory.Undo');
    node.setInputValue('storeName', 'shared');
    node.setInputValue('undo', true);
    node.update();

    expect(store.hasKey('shared', 'a')).toBe(false);
  });
});

describe('State Snapshot node', () => {
  it('saves and restores by name', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.StateSnapshot');

    store.setState('app', { a: 1 });

    node.setInputValue('storeName', 'app');
    node.setInputValue('snapshotName', 'checkpoint');
    node.setInputValue('save', true);
    node.update();

    expect(signals).toEqual(['saved']);
    expect((output(node, 'snapshot') as { state: unknown }).state).toEqual({ a: 1 });

    store.setState('app', { a: 99 });
    signals.length = 0;

    node.setInputValue('restore', true);
    node.update();

    expect(signals).toEqual(['restored']);
    expect(store.getState('app')).toEqual({ a: 1 });
  });

  it('restores explicit snapshot data in preference to the name', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.StateSnapshot');

    node.setInputValue('storeName', 'app');
    node.setInputValue('snapshotData', {
      storeName: 'app',
      state: { imported: true },
      takenAt: 0,
      revision: 0,
      byReference: []
    });
    node.setInputValue('restore', true);
    node.update();

    expect(store.getState('app')).toEqual({ imported: true });
  });

  it('reports a missing snapshot rather than throwing out of the frame', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.StateSnapshot');

    node.setInputValue('storeName', 'app');
    node.setInputValue('snapshotName', 'nope');
    node.setInputValue('restore', true);
    node.update();

    expect(signals).toEqual([]);
    expect(String(output(node, 'error'))).toContain('no snapshot named');
  });

  it('reports a save with no name', () => {
    const context = createContext();
    const { node, signals } = createNode(context, 'net.noodl.StateSnapshot');

    node.setInputValue('storeName', 'app');
    node.setInputValue('save', true);
    node.update();

    expect(signals).toEqual([]);
    expect(String(output(node, 'error'))).toContain('name is required');
  });

  it('surfaces the by-reference caveat for the snapshot it holds', () => {
    const context = createContext();
    const { node } = createNode(context, 'net.noodl.StateSnapshot');

    store.setKey('app', 'user', Model.get('snapshot-node-model'));

    node.setInputValue('storeName', 'app');
    node.setInputValue('snapshotName', 'c');
    node.setInputValue('save', true);
    node.update();

    expect(output(node, 'fullyRestorable')).toBe(false);
    expect(output(node, 'byReferenceKeys')).toBe('user');
  });

  it('leaves a tracked history able to undo the restore', () => {
    const context = createContext();
    const historyNode = createNode(context, 'net.noodl.StateHistory').node;
    historyNode.setInputValue('storeName', 'app');
    historyNode.update();

    store.setKey('app', 'a', 1);

    const { node } = createNode(context, 'net.noodl.StateSnapshot');
    node.setInputValue('storeName', 'app');
    node.setInputValue('snapshotName', 'c');
    node.setInputValue('save', true);
    node.update();

    store.setKey('app', 'a', 2);

    node.setInputValue('restore', true);
    node.update();
    expect(store.getKey('app', 'a')).toBe(1);

    history.undo('app');
    expect(store.getKey('app', 'a')).toBe(2);
  });
});
