/**
 * BCN-006 — the token lifecycle, driven by injected timers.
 *
 * This is the suite the task exists for. Parse tokens never expire, so every
 * property below is new machinery with no precedent in this repo, and every one
 * of them fails in a way that does not show up in "does login work":
 *
 * - a refresh that fires on the 401 works with one request and breaks with two;
 * - two parallel refreshes of a rotating token log the user out at random;
 * - a refresh loop that treats dropped wifi as a rejection logs people out on
 *   trains;
 * - two tabs are the classic way to invalidate a session by accident.
 *
 * The clock, the timers, the storage and the refresh transport are all injected,
 * which is the `byob-realtime.ts` precedent — the whole lifecycle is exercised
 * with no network and no real time passing.
 *
 * **What it cannot establish** is stated in the design doc §10 and worth
 * repeating: no backend in the product refreshes anything yet. A real token
 * expiring with the app open is BCN-006 step 8's live pass, against a backend
 * configured with a short TTL, and this suite is not a substitute for it.
 */

import { SessionStore } from '../../src/api/backends/SessionStore';
import type { SessionBroadcaster, StorageChange, StoredSession } from '../../src/api/backends/SessionStore';
import {
  TokenLifecycleController,
  classifyRefreshFailure,
  isBrowserTab,
  validateTokenLifecycle
} from '../../src/api/backends/TokenLifecycle';
import type { TokenLifecycleControllerOptions } from '../../src/api/backends/TokenLifecycle';

// ── The harness ────────────────────────────────────────────────────────────

/** Injected timers and clock. Nothing here uses jest's fake timers. */
class FakeTimers {
  now = 1_000_000;
  private seq = 0;
  private pending = new Map<number, { at: number; fn: () => void }>();

  setTimeout = (fn: () => void, delay: number): unknown => {
    const id = ++this.seq;
    this.pending.set(id, { at: this.now + delay, fn });
    return id;
  };

  clearTimeout = (handle: unknown): void => {
    this.pending.delete(handle as number);
  };

  /** Every delay currently armed, for asserting on the schedule itself. */
  get delays(): number[] {
    return Array.from(this.pending.values()).map((t) => t.at - this.now);
  }

  get count(): number {
    return this.pending.size;
  }

  /** Run everything due within `ms`, including anything armed along the way. */
  advance(ms: number): void {
    const target = this.now + ms;
    for (;;) {
      let nextId: number | undefined;
      let nextAt = Infinity;
      for (const [id, t] of this.pending) {
        if (t.at <= target && t.at < nextAt) {
          nextAt = t.at;
          nextId = id;
        }
      }
      if (nextId === undefined) break;
      const t = this.pending.get(nextId)!;
      this.pending.delete(nextId);
      this.now = Math.max(this.now, t.at);
      t.fn();
    }
    this.now = target;
  }
}

class FakeBroadcaster implements SessionBroadcaster {
  listeners: ((event: StorageChange) => void)[] = [];
  addEventListener(_t: 'storage', l: (event: StorageChange) => void) {
    this.listeners.push(l);
  }
  removeEventListener(_t: 'storage', l: (event: StorageChange) => void) {
    this.listeners = this.listeners.filter((x) => x !== l);
  }
  fire(event: StorageChange) {
    for (const l of this.listeners.slice()) l(event);
  }
}

/** Let promise callbacks run. `performRefresh` is a promise, so its resolution is a tick away. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

const REFRESH = { kind: 'refresh' as const, accessTtlSeconds: 900, refreshEndpoint: '/auth/refresh', refreshBeforeExpirySeconds: 60 };

interface Rig {
  timers: FakeTimers;
  storage: Record<string, unknown>;
  broadcaster: FakeBroadcaster;
  store: SessionStore;
  controller: TokenLifecycleController;
  refreshCalls: StoredSession[];
  resolveRefresh: (session: StoredSession) => void;
  rejectRefresh: (err: unknown) => void;
  lost: string[];
  refreshed: StoredSession[];
  clearedElsewhere: number;
}

function makeRig(overrides: Partial<TokenLifecycleControllerOptions> & { session?: StoredSession | null } = {}): Rig {
  const timers = new FakeTimers();
  const storage: Record<string, unknown> = {};
  const broadcaster = new FakeBroadcaster();
  const store = new SessionStore({
    key: 'Parse/app/currentUser',
    storage,
    broadcaster,
    tabId: 'tab-a',
    now: () => timers.now,
    lockTtlMs: 10000
  });

  const session = overrides.session === undefined ? { objectId: 'u1', sessionToken: 'access-1', refreshToken: 'rt-1' } : overrides.session;
  if (session) store.write(session);

  const refreshCalls: StoredSession[] = [];
  let resolveRefresh: (s: StoredSession) => void = () => {};
  let rejectRefresh: (e: unknown) => void = () => {};
  const lost: string[] = [];
  const refreshed: StoredSession[] = [];
  let clearedElsewhere = 0;

  const controller = new TokenLifecycleController(
    Object.assign(
      {
        lifecycle: REFRESH,
        store,
        performRefresh: (s: StoredSession) => {
          refreshCalls.push(s);
          return new Promise<StoredSession>((resolve, reject) => {
            resolveRefresh = resolve;
            rejectRefresh = reject;
          });
        },
        onSessionRefreshed: (s: StoredSession) => refreshed.push(s),
        onSessionLost: (reason: string) => lost.push(reason),
        onSessionClearedElsewhere: () => {
          clearedElsewhere++;
        },
        now: () => timers.now,
        setTimeoutImpl: timers.setTimeout,
        clearTimeoutImpl: timers.clearTimeout,
        // These suites run under jest's node environment, where there is no
        // `window` — so the real check would refuse to start and every case
        // below would pass by doing nothing. Injected, and the check itself is
        // tested separately.
        isBrowserTab: () => true
      },
      overrides
    ) as TokenLifecycleControllerOptions
  );

  const rig: Rig = {
    timers,
    storage,
    broadcaster,
    store,
    controller,
    refreshCalls,
    resolveRefresh: (s) => resolveRefresh(s),
    rejectRefresh: (e) => rejectRefresh(e),
    lost,
    refreshed,
    get clearedElsewhere() {
      return clearedElsewhere;
    }
  } as Rig;
  return rig;
}

// ── Eternal: the only lifecycle wired live in this pass ────────────────────

describe('an eternal lifecycle does nothing at all', () => {
  test('arms no timer and subscribes to no storage event', () => {
    const rig = makeRig({ lifecycle: { kind: 'eternal' } });
    rig.controller.start();
    expect(rig.timers.count).toBe(0);
    expect(rig.broadcaster.listeners).toHaveLength(0);
    // Not an optimisation. Cross-tab logout propagation on Parse would be a
    // genuine improvement and a genuine *change*, and a behaviour change
    // smuggled into a no-behaviour-change move destroys the only signal it
    // produces.
  });

  test('the gate is a synchronous pass-through', () => {
    const rig = makeRig({ lifecycle: { kind: 'eternal' } });
    rig.controller.start();

    let called = false;
    let seen: StoredSession | undefined;
    rig.controller.withSession((session) => {
      called = true;
      seen = session;
    });

    // Synchronously, in the same tick — this is what lets `_makeRequest` stay
    // the synchronous function it has always been. A promise here would reorder
    // the callbacks twenty-five nodes see.
    expect(called).toBe(true);
    expect(seen && seen.sessionToken).toBe('access-1');
  });

  test('with no session, the gate still calls back synchronously', () => {
    const rig = makeRig({ lifecycle: { kind: 'eternal' }, session: null });
    rig.controller.start();
    let seen: unknown = 'not called';
    rig.controller.withSession((s) => (seen = s));
    expect(seen).toBeUndefined();
  });
});

// ── Scheduling ─────────────────────────────────────────────────────────────

describe('scheduling ahead of expiry', () => {
  test('stamps an expiry from the declared TTL when the backend stated none', () => {
    const rig = makeRig();
    rig.controller.start();
    expect((rig.store.read() as StoredSession).expiresAt).toBe(rig.timers.now + 900_000);
    // Persisted rather than recomputed per read: a deadline recalculated from
    // `now` every time it is checked never actually arrives.
  });

  test("the backend's own expiry wins over the declared TTL", () => {
    const rig = makeRig({ session: { sessionToken: 'a', refreshToken: 'r', expiresAt: 1_000_000 + 60_000 } });
    rig.controller.start();
    expect((rig.store.read() as StoredSession).expiresAt).toBe(1_060_000);
    // Every one of these backends lets an administrator change the TTL, so a
    // declared value that overrode the token's own would be wrong on exactly
    // the instances configured deliberately.
  });

  test('the timer is set for expiry minus the margin, not for expiry', () => {
    const rig = makeRig();
    rig.controller.start();
    expect(rig.timers.delays).toEqual([900_000 - 60_000]);
  });

  test('refresh fires from the timer, with no request having failed first', () => {
    const rig = makeRig();
    rig.controller.start();
    expect(rig.refreshCalls).toHaveLength(0);
    rig.timers.advance(840_000);
    expect(rig.refreshCalls).toHaveLength(1);
    // A 401 was never the trigger. Reacting to one means a user-visible request
    // has already failed.
  });

  test('a delay beyond setTimeout’s 32-bit ceiling is clamped and re-armed', () => {
    const rig = makeRig({
      lifecycle: { kind: 'refresh', accessTtlSeconds: 60 * 24 * 3600, refreshEndpoint: '/r', refreshBeforeExpirySeconds: 60 }
    });
    rig.controller.start();

    // 2147483647 ms is ~24.8 days. A larger delay overflows and fires
    // IMMEDIATELY — a refresh storm rather than an error.
    expect(rig.timers.delays).toEqual([2147483647]);
    rig.timers.advance(2147483647);
    expect(rig.refreshCalls).toHaveLength(0);
    expect(rig.timers.delays[0]).toBeGreaterThan(0);
  });

  test('a timer that fires early re-arms instead of refreshing', () => {
    const rig = makeRig();
    rig.controller.start();

    // A sleeping laptop fires late and a clock change fires early, so the
    // decision is always made against the clock rather than the timer.
    rig.timers.now -= 100_000;
    rig.timers.advance(840_000);
    expect(rig.refreshCalls).toHaveLength(0);
    expect(rig.timers.count).toBe(1);
  });

  test('a session with no token schedules nothing', () => {
    const rig = makeRig({ session: { objectId: 'u1' } });
    rig.controller.start();
    expect(rig.timers.count).toBe(0);
  });
});

// ── The request gate ───────────────────────────────────────────────────────

describe('the request gate', () => {
  test('a fresh token calls back synchronously and starts nothing', () => {
    const rig = makeRig();
    rig.controller.start();
    let seen: StoredSession | undefined;
    rig.controller.withSession((s) => (seen = s));
    expect(seen!.sessionToken).toBe('access-1');
    expect(rig.refreshCalls).toHaveLength(0);
  });

  test('inside the margin the request does NOT wait — it goes out with the token it has', () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.now += 850_000; // inside the 60s margin, token still valid

    let seen: StoredSession | undefined;
    rig.controller.withSession((s) => (seen = s));

    expect(seen!.sessionToken).toBe('access-1'); // synchronously, with the old token
    expect(rig.refreshCalls).toHaveLength(1); // and the refresh started behind it
    expect(rig.controller.queuedCount).toBe(0);
    // Only the *refresh* token rotates; the access token is good until expiry.
    // Holding the request back would add latency to buy nothing.
  });

  test('an expired token queues the caller until the refresh lands', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.now += 900_001;

    let seen: StoredSession | undefined | 'never' = 'never';
    rig.controller.withSession((s) => (seen = s));

    expect(seen).toBe('never');
    expect(rig.controller.queuedCount).toBe(1);

    rig.resolveRefresh({ sessionToken: 'access-2', refreshToken: 'rt-2' });
    await settle();

    expect((seen as unknown as StoredSession).sessionToken).toBe('access-2');
    expect(rig.controller.queuedCount).toBe(0);
  });
});

// ── Single-flight ──────────────────────────────────────────────────────────

describe('single-flight', () => {
  test('ten simultaneous expired requests produce ONE refresh', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.now += 900_001;

    const seen: (StoredSession | undefined)[] = [];
    for (let i = 0; i < 10; i++) rig.controller.withSession((s) => seen.push(s));

    expect(rig.refreshCalls).toHaveLength(1);
    expect(rig.controller.queuedCount).toBe(10);

    rig.resolveRefresh({ sessionToken: 'access-2', refreshToken: 'rt-2' });
    await settle();

    expect(seen).toHaveLength(10);
    expect(seen.every((s) => s!.sessionToken === 'access-2')).toBe(true);
    // With a rotating refresh token, ten parallel refreshes would not merely
    // waste nine requests — nine of them present a token the first has already
    // spent, and the honest reading of the rejection is "this session is over".
  });

  test('the scheduled refresh and a gated request do not race into two rotations', () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(840_000); // the scheduled refresh fires
    expect(rig.refreshCalls).toHaveLength(1);

    rig.timers.now += 61_000; // now past expiry, with the refresh still in flight
    rig.controller.withSession(() => {});
    expect(rig.refreshCalls).toHaveLength(1);
  });

  test('a new refresh may start once the previous one has settled', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(840_000);
    rig.resolveRefresh({ sessionToken: 'access-2', refreshToken: 'rt-2', expiresAt: rig.timers.now + 900_000 });
    await settle();

    rig.timers.advance(840_000);
    expect(rig.refreshCalls).toHaveLength(2);
    expect(rig.refreshCalls[1].sessionToken).toBe('access-2');
  });
});

// ── Failure ────────────────────────────────────────────────────────────────

describe('classifying a failure', () => {
  test('a 4xx is the backend rejecting the session', () => {
    expect(classifyRefreshFailure({ status: 400 })).toBe('rejected');
    expect(classifyRefreshFailure({ status: 401 })).toBe('rejected');
    expect(classifyRefreshFailure({ status: 403 })).toBe('rejected');
    expect(classifyRefreshFailure({ status: 404 })).toBe('rejected');
  });

  test('408 and 429 are 4xx that mean "ask again", not "you are not who you say"', () => {
    expect(classifyRefreshFailure({ status: 408 })).toBe('undelivered');
    expect(classifyRefreshFailure({ status: 429 })).toBe('undelivered');
  });

  test('5xx, status 0 and no status at all are failures of delivery', () => {
    expect(classifyRefreshFailure({ status: 500 })).toBe('undelivered');
    expect(classifyRefreshFailure({ status: 0 })).toBe('undelivered');
    expect(classifyRefreshFailure({ message: 'Failed to fetch' })).toBe('undelivered');
    expect(classifyRefreshFailure(undefined)).toBe('undelivered');
  });

  test('an explicit `fatal` always wins over the status', () => {
    expect(classifyRefreshFailure({ status: 500, fatal: true })).toBe('rejected');
    expect(classifyRefreshFailure({ status: 401, fatal: false })).toBe('undelivered');
  });
});

describe('a rejected refresh is a logout', () => {
  test('the session is cleared, the queue fails, and `sessionLost` carries the reason', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.now += 900_001;

    let seenSession: StoredSession | undefined = { sessionToken: 'placeholder' };
    let seenError: string | undefined;
    rig.controller.withSession((s, e) => {
      seenSession = s;
      seenError = e;
    });

    rig.rejectRefresh({ status: 401, error: 'Invalid refresh token' });
    await settle();

    expect(rig.store.read()).toBeUndefined();
    expect(seenSession).toBeUndefined();
    expect(seenError).toBe('Invalid refresh token');
    expect(rig.lost).toEqual(['Invalid refresh token']);
    // Surfaced through the `User` node's existing `sessionLost` output. No new
    // port, no new concept for a builder to learn.
  });

  test('a session with no refresh token cannot be renewed and says so at once', () => {
    const rig = makeRig({ session: { sessionToken: 'a', expiresAt: 1_000_000 - 1 } });
    rig.controller.start();
    rig.controller.withSession(() => {});
    expect(rig.refreshCalls).toHaveLength(0);
    expect(rig.lost).toEqual(['This sign-in cannot be renewed. Please sign in again.']);
  });
});

describe('a network failure is NOT a logout', () => {
  test('retries with backoff while the access token is still valid', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(840_000); // the scheduled refresh, 60s before expiry

    rig.rejectRefresh({ message: 'Failed to fetch' });
    await settle();

    expect(rig.lost).toEqual([]);
    expect(rig.timers.delays).toEqual([1000]);

    rig.timers.advance(1000);
    rig.rejectRefresh({ message: 'Failed to fetch' });
    await settle();
    expect(rig.timers.delays).toEqual([2000]);
    expect(rig.lost).toEqual([]);
    // The margin exists to absorb exactly this. A user in a lift has a
    // perfectly valid access token in hand.
  });

  test('anyone waiting is released with the token they already have', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.now += 850_000; // inside the margin
    rig.controller.withSession(() => {});
    expect(rig.refreshCalls).toHaveLength(1);

    // A caller that arrived after expiry and queued.
    rig.timers.now += 51_000;
    let seen: StoredSession | undefined | 'never' = 'never';
    rig.controller.withSession((s) => (seen = s));
    expect(seen).toBe('never');

    rig.timers.now -= 51_000; // still inside the validity window
    rig.rejectRefresh({ message: 'offline' });
    await settle();

    expect((seen as unknown as StoredSession).sessionToken).toBe('access-1');
    expect(rig.lost).toEqual([]);
  });

  test('once the token has run out and the backend is still unreachable, it IS a logout — with a different sentence', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(840_000);

    rig.timers.now += 61_000; // past expiry
    rig.rejectRefresh({ message: 'Failed to fetch' });
    await settle();

    expect(rig.lost).toEqual(['Your session could not be renewed: Failed to fetch']);
    expect(rig.store.read()).toBeUndefined();
    // "could not be reached" and "was rejected" are different sentences and a
    // user can act on the difference.
  });

  test('the retry budget is finite', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(840_000);

    for (let i = 0; i < 6; i++) {
      rig.rejectRefresh({ message: 'offline' });
      await settle();
      if (rig.timers.count > 0) rig.timers.advance(60_000);
    }

    expect(rig.lost).toHaveLength(1);
  });
});

describe('a successful refresh', () => {
  test('stores the new token, re-arms, and tells nobody', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(840_000);

    rig.resolveRefresh({ sessionToken: 'access-2', refreshToken: 'rt-2', expiresAt: rig.timers.now + 900_000 });
    await settle();

    const stored = rig.store.read() as StoredSession;
    expect(stored.sessionToken).toBe('access-2');
    expect(stored.objectId).toBe('u1'); // the user's own fields survive
    expect(rig.timers.delays).toEqual([840_000]);
    expect(rig.refreshed).toHaveLength(1);
    // `onSessionRefreshed` is bookkeeping. No node event fires: `sessionGained`
    // is what graphs wire re-fetches to, and raising it every TTL would make a
    // project re-query its backend on a timer forever.
  });

  test('falls back to the declared TTL when the refreshed session states no expiry', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(840_000);
    rig.resolveRefresh({ sessionToken: 'access-2', refreshToken: 'rt-2' });
    await settle();
    expect((rig.store.read() as StoredSession).expiresAt).toBe(rig.timers.now + 900_000);
  });
});

// ── Cross-tab ──────────────────────────────────────────────────────────────

describe('two tabs', () => {
  test('a tab that loses the lock does not refresh — it waits', () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(839_999);

    // Another tab takes the lock a moment before our refresh is due.
    rig.storage['Parse/app/currentUser.refresh-lock'] = JSON.stringify({
      owner: 'tab-b',
      expiresAt: rig.timers.now + 10_000
    });
    rig.timers.advance(1);

    expect(rig.refreshCalls).toHaveLength(0);
    expect(rig.timers.delays).toEqual([10_000]);
    // Two in-flight refreshes of a rotating token invalidate each other, and the
    // symptom is a user randomly logged out — intermittent, unreproducible, and
    // blamed on the backend.
  });

  test('the follower adopts the session the winner wrote', () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(839_999);
    rig.storage['Parse/app/currentUser.refresh-lock'] = JSON.stringify({
      owner: 'tab-b',
      expiresAt: rig.timers.now + 10_000
    });
    rig.timers.advance(1);

    // The winner writes, and the `storage` event fires in *this* tab only
    // because it was not the one that wrote.
    rig.store.write({ objectId: 'u1', sessionToken: 'access-2', refreshToken: 'rt-2', expiresAt: rig.timers.now + 900_000 });
    rig.broadcaster.fire({ key: 'Parse/app/currentUser' });

    let seen: StoredSession | undefined;
    rig.controller.withSession((s) => (seen = s));
    expect(seen!.sessionToken).toBe('access-2');
    expect(rig.refreshCalls).toHaveLength(0);
  });

  test('a follower whose leader vanished tries again rather than waiting forever', () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(839_999);
    rig.storage['Parse/app/currentUser.refresh-lock'] = JSON.stringify({
      owner: 'tab-b',
      expiresAt: rig.timers.now + 5_000
    });
    rig.timers.advance(1);
    expect(rig.refreshCalls).toHaveLength(0);

    // The lock has expired by the time the follower looks again.
    rig.timers.advance(10_000);
    expect(rig.refreshCalls).toHaveLength(1);
  });

  test('signing out in another tab propagates, for free', () => {
    const rig = makeRig();
    rig.controller.start();
    rig.store.clear();
    rig.broadcaster.fire({ key: 'Parse/app/currentUser' });
    expect(rig.clearedElsewhere).toBe(1);
    expect(rig.timers.count).toBe(0);
  });

  test('the lock is released once the refresh settles', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(840_000);
    expect(rig.storage['Parse/app/currentUser.refresh-lock']).toBeDefined();

    rig.resolveRefresh({ sessionToken: 'access-2', refreshToken: 'rt-2' });
    await settle();
    expect(rig.storage['Parse/app/currentUser.refresh-lock']).toBeUndefined();
  });
});

// ── SSR, and the declared lifecycle ────────────────────────────────────────

describe('SSR and the cloud runtime', () => {
  test('with no storage, nothing is armed and the gate yields no session', () => {
    const timers = new FakeTimers();
    const store = new SessionStore({ key: 'k', storage: null, broadcaster: null });
    const controller = new TokenLifecycleController({
      lifecycle: REFRESH,
      store,
      performRefresh: () => Promise.reject(new Error('must not be called')),
      now: () => timers.now,
      setTimeoutImpl: timers.setTimeout,
      clearTimeoutImpl: timers.clearTimeout,
      isBrowserTab: () => true
    });
    controller.start();

    expect(timers.count).toBe(0);
    let seen: unknown = 'not called';
    controller.withSession((s) => (seen = s));
    expect(seen).toBeUndefined();
  });

  test('⚠️ a server render HAS storage, and must still arm nothing', () => {
    // The trap this exists for: RUN-002's SSR harness installs a `localStorage`
    // mock (`static/ssr/runtime-globals.js`) so the runtime's bracket-access
    // reads work during a render. An "is there storage" check therefore
    // concludes *browser* on a server, and BCN-004's Directus adapter would have
    // armed a fifteen-minute timer holding a refresh token once per render, in a
    // long-lived Node process.
    const rig = makeRig({ isBrowserTab: () => false });
    rig.controller.start();

    expect(rig.store.read()).toBeDefined(); // storage works
    expect(rig.timers.count).toBe(0); // and nothing is scheduled against it
    expect(rig.broadcaster.listeners).toHaveLength(0);
  });

  test('nor may a request start one', () => {
    const rig = makeRig({ isBrowserTab: () => false });
    rig.controller.start();
    rig.timers.now += 900_001;
    rig.controller.withSession(() => {});
    expect(rig.refreshCalls).toHaveLength(0);
  });

  test('the real check refuses a Node environment, which is what a server render is', () => {
    // No `window` here, and the SSR harness installs none either — which is the
    // honest signal, unlike storage.
    expect(isBrowserTab()).toBe(false);
  });

  test('the real check refuses the cloud runtime even when a window exists', () => {
    (globalThis as unknown as { window: unknown }).window = { addEventListener() {} };
    try {
      expect(isBrowserTab()).toBe(true);
      (globalThis as unknown as { _noodl_cloud_runtime_version: string })._noodl_cloud_runtime_version = '1';
      // Each cloud-runtime request has its own scope and its session arrives
      // *with* the request, already validated. There is nothing to schedule for.
      expect(isBrowserTab()).toBe(false);
    } finally {
      delete (globalThis as unknown as { _noodl_cloud_runtime_version?: string })._noodl_cloud_runtime_version;
      delete (globalThis as unknown as { window?: unknown }).window;
    }
  });
});

describe('a declared lifecycle is validated before it is armed', () => {
  test('accepts a well-formed declaration', () => {
    expect(validateTokenLifecycle({ kind: 'eternal' })).toBeUndefined();
    expect(validateTokenLifecycle(REFRESH)).toBeUndefined();
  });

  test('refuses the four things a person can get wrong in a form', () => {
    expect(validateTokenLifecycle(undefined)).toMatch(/No token lifecycle/);
    expect(validateTokenLifecycle({ ...REFRESH, accessTtlSeconds: 0 })).toMatch(/greater than zero/);
    expect(validateTokenLifecycle({ ...REFRESH, refreshBeforeExpirySeconds: -1 })).toMatch(/cannot be negative/);
    expect(validateTokenLifecycle({ ...REFRESH, refreshBeforeExpirySeconds: 900 })).toMatch(/shorter than/);
    expect(validateTokenLifecycle({ ...REFRESH, refreshEndpoint: '' })).toMatch(/address to send/);
  });

  test('an invalid declaration degrades to eternal and reports once, rather than refusing to connect', () => {
    const reported: string[] = [];
    const rig = makeRig({
      lifecycle: { kind: 'refresh', accessTtlSeconds: 60, refreshEndpoint: '', refreshBeforeExpirySeconds: 10 },
      onInvalidLifecycle: (reason: string) => reported.push(reason)
    });
    rig.controller.start();

    expect(rig.controller.lifecycle.kind).toBe('eternal');
    expect(rig.controller.lifecycleError).toMatch(/address to send/);
    expect(reported).toHaveLength(1);
    expect(rig.timers.count).toBe(0);
    // A refresh loop against an endpoint that may not exist produces background
    // 404s on every custom backend that never needed one — the loudest possible
    // failure for the least possible reason.
  });
});

describe('an adapter that declared refresh and supplied no transport', () => {
  test('does not log the user out over its own omission', () => {
    const rig = makeRig({ performRefresh: undefined });
    rig.controller.start();
    rig.timers.advance(840_000);
    expect(rig.lost).toEqual([]);
    expect(rig.store.read()).toBeDefined();
  });
});

describe('stop()', () => {
  test('clears the timer, drops the queue and releases the lock', async () => {
    const rig = makeRig();
    rig.controller.start();
    rig.timers.advance(840_000);
    expect(rig.storage['Parse/app/currentUser.refresh-lock']).toBeDefined();

    rig.controller.stop();
    expect(rig.timers.count).toBe(0);
    expect(rig.storage['Parse/app/currentUser.refresh-lock']).toBeUndefined();
    expect(rig.broadcaster.listeners).toHaveLength(0);
  });
});
