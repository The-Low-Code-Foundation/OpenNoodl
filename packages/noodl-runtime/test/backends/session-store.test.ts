/**
 * BCN-006 — `SessionStore`, the one thing that knows where a session lives.
 *
 * Four call sites spelled `Parse/<appId>/currentUser` out by hand before this,
 * so the tests that matter most are the boring ones: the key is what it always
 * was, and a store with no storage behind it does not throw.
 */

import { SessionStore, parseInstallationIdKey, parseSessionKey } from '../../src/api/backends/SessionStore';
import type { SessionBroadcaster, StorageChange } from '../../src/api/backends/SessionStore';

class FakeBroadcaster implements SessionBroadcaster {
  listeners: ((event: StorageChange) => void)[] = [];
  addEventListener(_type: 'storage', listener: (event: StorageChange) => void) {
    this.listeners.push(listener);
  }
  removeEventListener(_type: 'storage', listener: (event: StorageChange) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
  fire(event: StorageChange) {
    for (const l of this.listeners.slice()) l(event);
  }
}

function makeStore(overrides: Record<string, unknown> = {}) {
  const storage: Record<string, unknown> = {};
  const broadcaster = new FakeBroadcaster();
  const store = new SessionStore(
    Object.assign({ key: 'Parse/app/currentUser', storage, broadcaster, tabId: 'tab-a' }, overrides) as never
  );
  return { store, storage, broadcaster };
}

describe('the storage key', () => {
  test('is the one every deployed app already wrote — a changed key is a silent mass logout', () => {
    expect(parseSessionKey('my-app')).toBe('Parse/my-app/currentUser');
    expect(parseInstallationIdKey('my-app')).toBe('Parse/my-app/installationId');
  });
});

describe('reading and writing', () => {
  test('round-trips a session', () => {
    const { store, storage } = makeStore();
    store.write({ objectId: 'u1', sessionToken: 'r:tok' });
    expect(storage['Parse/app/currentUser']).toBe(JSON.stringify({ objectId: 'u1', sessionToken: 'r:tok' }));
    expect(store.read()).toEqual({ objectId: 'u1', sessionToken: 'r:tok' });
  });

  test('an unparseable entry reads as absent rather than raising', () => {
    const { store, storage } = makeStore();
    storage['Parse/app/currentUser'] = '{not json';
    expect(store.read()).toBeUndefined();
    // A corrupt entry must not stop an app from loading. All four replaced call
    // sites swallowed this and so does the one that replaced them.
    expect(store.readRaw()).toBe('{not json');
  });

  test('clear removes the entry', () => {
    const { store, storage } = makeStore();
    store.write({ sessionToken: 't' });
    store.clear();
    expect('Parse/app/currentUser' in storage).toBe(false);
    expect(store.read()).toBeUndefined();
  });

  test('property access, not getItem — a plain object is a valid store', () => {
    // Every existing suite stubs `globalThis.localStorage = {}`. A method-based
    // interface would have quietly required all of them to grow three methods.
    const storage = {} as Record<string, unknown>;
    const store = new SessionStore({ key: 'k', storage, broadcaster: null });
    store.write({ sessionToken: 'x' });
    expect(storage.k).toBe('{"sessionToken":"x"}');
  });
});

describe('with no storage at all — SSR and the cloud runtime', () => {
  test('reads undefined, swallows writes, and never throws', () => {
    const store = new SessionStore({ key: 'k', storage: null, broadcaster: null });
    expect(store.available).toBe(false);
    expect(store.read()).toBeUndefined();
    expect(() => store.write({ sessionToken: 't' })).not.toThrow();
    expect(() => store.clear()).not.toThrow();
    expect(store.read()).toBeUndefined();
    // A server render always sees a logged-out user — the design's §6, made
    // concrete rather than asserted.
  });

  test('subscribing returns a no-op unsubscribe rather than failing', () => {
    const store = new SessionStore({ key: 'k', storage: null, broadcaster: null });
    const off = store.onExternalChange(() => {
      throw new Error('should never fire');
    });
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
  });

  test('the refresh lock cannot be taken, so nothing schedules against it', () => {
    const store = new SessionStore({ key: 'k', storage: null, broadcaster: null });
    expect(store.tryAcquireRefreshLock()).toBe(false);
  });
});

describe('cross-tab notification', () => {
  test('fires for this key and ignores every other', () => {
    const { store, storage, broadcaster } = makeStore();
    const heard: unknown[] = [];
    store.onExternalChange((session) => heard.push(session));

    broadcaster.fire({ key: 'something/else' });
    expect(heard).toHaveLength(0);

    storage['Parse/app/currentUser'] = JSON.stringify({ sessionToken: 'new' });
    broadcaster.fire({ key: 'Parse/app/currentUser' });
    expect(heard).toEqual([{ sessionToken: 'new' }]);
  });

  test('a null key means the whole store was cleared, which includes ours', () => {
    const { store, broadcaster } = makeStore();
    const heard: unknown[] = [];
    store.onExternalChange((session) => heard.push(session));
    broadcaster.fire({ key: null });
    expect(heard).toEqual([undefined]);
  });

  test('unsubscribing stops delivery', () => {
    const { store, broadcaster } = makeStore();
    const heard: unknown[] = [];
    const off = store.onExternalChange((s) => heard.push(s));
    off();
    broadcaster.fire({ key: 'Parse/app/currentUser' });
    expect(heard).toHaveLength(0);
  });
});

describe('the refresh lock', () => {
  test('one tab takes it and the other does not', () => {
    const storage: Record<string, unknown> = {};
    const a = new SessionStore({ key: 'k', storage, broadcaster: null, tabId: 'a' });
    const b = new SessionStore({ key: 'k', storage, broadcaster: null, tabId: 'b' });

    expect(a.tryAcquireRefreshLock()).toBe(true);
    expect(b.tryAcquireRefreshLock()).toBe(false);
    // Two tabs refreshing a rotating refresh token invalidate each other, and
    // the user is logged out at random. This is the whole point of the lock.
  });

  test('the holder may re-take its own lock', () => {
    const storage: Record<string, unknown> = {};
    const a = new SessionStore({ key: 'k', storage, broadcaster: null, tabId: 'a' });
    expect(a.tryAcquireRefreshLock()).toBe(true);
    expect(a.tryAcquireRefreshLock()).toBe(true);
  });

  test('a stale lock is takeable — a tab closed mid-refresh must not hold it forever', () => {
    const storage: Record<string, unknown> = {};
    let now = 1000;
    const a = new SessionStore({ key: 'k', storage, broadcaster: null, tabId: 'a', now: () => now, lockTtlMs: 5000 });
    const b = new SessionStore({ key: 'k', storage, broadcaster: null, tabId: 'b', now: () => now, lockTtlMs: 5000 });

    expect(a.tryAcquireRefreshLock()).toBe(true);
    now += 4999;
    expect(b.tryAcquireRefreshLock()).toBe(false);
    now += 2;
    expect(b.tryAcquireRefreshLock()).toBe(true);
  });

  test('releasing never takes away a lock another tab has since acquired', () => {
    const storage: Record<string, unknown> = {};
    let now = 1000;
    const a = new SessionStore({ key: 'k', storage, broadcaster: null, tabId: 'a', now: () => now, lockTtlMs: 5000 });
    const b = new SessionStore({ key: 'k', storage, broadcaster: null, tabId: 'b', now: () => now, lockTtlMs: 5000 });

    a.tryAcquireRefreshLock();
    now += 6000;
    b.tryAcquireRefreshLock();

    a.releaseRefreshLock();
    expect(b.tryAcquireRefreshLock()).toBe(true);
    expect(storage['k.refresh-lock']).toBeDefined();
  });

  test('a corrupt lock entry is treated as no lock', () => {
    const storage: Record<string, unknown> = { 'k.refresh-lock': 'nonsense' };
    const a = new SessionStore({ key: 'k', storage, broadcaster: null, tabId: 'a' });
    expect(a.tryAcquireRefreshLock()).toBe(true);
  });
});
