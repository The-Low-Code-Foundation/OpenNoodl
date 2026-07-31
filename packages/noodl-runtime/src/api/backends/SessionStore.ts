/**
 * `SessionStore` — where a signed-in session lives, and the only thing that
 * knows the key it lives under.
 *
 * Before BCN-006 there were **four** copies of this read, each spelling the key
 * out by hand:
 *
 * | Site | What it did |
 * |---|---|
 * | `userservice.ts` (×8) | read, write and `delete` `Parse/<appId>/currentUser` |
 * | `ParseWireAdapter.readStoredCurrentUser` | read it for the session header |
 * | `cloudfunction.ts` / `cloudfunction2.ts` | read it for the session header |
 * | `api/cloudfunctions.ts` | read it for the session header |
 *
 * BCN-006's spec names only one of those — `cloudstore.js:80`, which BCN-002 had
 * already moved into the adapter. The other three are the ones that actually
 * matter, because each is a separate opinion about who is signed in and each
 * would have had to be found again by whoever added the fifth.
 *
 * ## Property access, not `getItem`
 *
 * Every read and write below is `storage[key]`, `storage[key] = value`,
 * `delete storage[key]` — not `getItem`/`setItem`/`removeItem`. That is what the
 * code being replaced did, it is what `Storage` supports, and it is what lets a
 * plain object stand in for storage in a test. Switching to the method form
 * would be a tidy-up that changes what counts as a valid stub.
 *
 * ## Absent storage is not an error
 *
 * `typeof localStorage === 'undefined'` during a server render and inside the
 * cloud runtime. A store with no storage reads `undefined`, swallows writes and
 * never subscribes to anything — which is the SSR declaration in
 * BCN-006-LIFECYCLE-DESIGN §6 made concrete: *a server render always sees a
 * logged-out user.*
 *
 * @module api/backends/SessionStore
 */

import type { AuthSession } from '@noodl/backend-contract';

/**
 * Storage as this file uses it: a bag of strings addressed by property.
 *
 * `Storage` satisfies it, and so does `{}`. Deliberately not `Storage` — the
 * existing suites stub `globalThis.localStorage = {}` and a method-based
 * interface would silently require them all to grow three methods.
 */
export interface SessionStorageLike {
  [key: string]: unknown;
}

/** The half of `window` this file needs: cross-tab `storage` notifications. */
export interface SessionBroadcaster {
  addEventListener(type: 'storage', listener: (event: StorageChange) => void): void;
  removeEventListener(type: 'storage', listener: (event: StorageChange) => void): void;
}

/**
 * A `storage` event, narrowed to what is read.
 *
 * `key === null` means the whole store was cleared, which every listener has to
 * treat as "my key may have changed too".
 */
export interface StorageChange {
  key: string | null;
  newValue?: string | null;
}

/** A stored session. Its user fields are the backend's, not ours. */
export type StoredSession = AuthSession;

export interface SessionStoreOptions {
  /**
   * The storage key. **Per backend**, and for the Parse family it must stay
   * `Parse/<appId>/currentUser` exactly — a key that changes shape signs every
   * existing user out on upgrade, silently, and they will read it as a bug in
   * the login form.
   */
  key: string;
  /** Defaults to the ambient `localStorage`, or nothing when there is none. */
  storage?: SessionStorageLike | null;
  /** Defaults to the ambient `window`, or nothing when there is none. */
  broadcaster?: SessionBroadcaster | null;
  /** How long a refresh lock is honoured before another tab may take it. */
  lockTtlMs?: number;
  now?: () => number;
  /** Identifies this tab in the refresh lock. Generated when not supplied. */
  tabId?: string;
}

function ambientStorage(): SessionStorageLike | undefined {
  // A bare `typeof` guard, and it has to stay bare: webpack's DefinePlugin
  // substitutes identifiers, and `globalThis.localStorage` is not a
  // substitution site. Same rule as the runtime globals in `ParseWireAdapter`.
  if (typeof localStorage === 'undefined') return undefined;
  return localStorage as unknown as SessionStorageLike;
}

function ambientBroadcaster(): SessionBroadcaster | undefined {
  if (typeof window === 'undefined' || !window || typeof window.addEventListener !== 'function') return undefined;
  return window as unknown as SessionBroadcaster;
}

let _tabCounter = 0;

export class SessionStore {
  readonly key: string;
  /** `<key>.refresh-lock`. Beside the session so one store owns both names. */
  readonly lockKey: string;
  readonly tabId: string;

  /**
   * How long a refresh lock is honoured. Public because it is also how long a
   * *follower* waits before concluding the leader tab has gone away — the two
   * are the same number by definition, and reading it beats declaring it twice.
   */
  readonly lockTtlMs: number;

  /** `undefined` means "whatever `localStorage` is *now*" — see {@link storage}. */
  private readonly injectedStorage?: SessionStorageLike | null;
  private readonly injectedBroadcaster?: SessionBroadcaster | null;
  private readonly now: () => number;

  constructor(options: SessionStoreOptions) {
    this.key = options.key;
    this.lockKey = options.key + '.refresh-lock';
    this.injectedStorage = options.storage;
    this.injectedBroadcaster = options.broadcaster;
    this.lockTtlMs = options.lockTtlMs !== undefined ? options.lockTtlMs : 10000;
    this.now = options.now || Date.now;
    this.tabId = options.tabId || 'tab-' + ++_tabCounter + '-' + Math.random().toString(36).slice(2);
  }

  /**
   * Resolved per access, not captured at construction.
   *
   * The code this replaced was a bare `localStorage[key]` evaluated on every
   * request, so a page (or a suite) that swapped the global took effect
   * immediately. Capturing it once would look identical until something did —
   * and something does: `parse-wire-adapter.test.ts` replaces
   * `globalThis.localStorage` between cases, and caching broke it. Found by
   * running the suite that was not this task's.
   */
  private get storage(): SessionStorageLike | undefined {
    if (this.injectedStorage !== undefined) return this.injectedStorage || undefined;
    return ambientStorage();
  }

  private get broadcaster(): SessionBroadcaster | undefined {
    if (this.injectedBroadcaster !== undefined) return this.injectedBroadcaster || undefined;
    return ambientBroadcaster();
  }

  /** False under SSR and in the cloud runtime. Nothing here throws when it is. */
  get available(): boolean {
    return this.storage !== undefined;
  }

  // ── The session ──────────────────────────────────────────────────────────

  /** The stored text, or `undefined`. */
  readRaw(): string | undefined {
    const storage = this.storage;
    if (!storage) return undefined;
    const value = storage[this.key];
    return value === undefined || value === null ? undefined : String(value);
  }

  /**
   * The stored session, or `undefined` when there is none *or it will not
   * parse*.
   *
   * Unparseable is treated as absent rather than raised, which is what all four
   * of the replaced call sites did — a corrupt entry must not stop an app from
   * loading, and the user can always sign in again.
   */
  read(): StoredSession | undefined {
    const raw = this.readRaw();
    if (raw === undefined) return undefined;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch (e) {
      return undefined;
    }
  }

  write(session: StoredSession): void {
    const storage = this.storage;
    if (!storage) return;
    storage[this.key] = JSON.stringify(session);
  }

  clear(): void {
    const storage = this.storage;
    if (!storage) return;
    delete storage[this.key];
  }

  /**
   * Read and write any key in the same storage, with the same absent-storage
   * tolerance.
   *
   * Here for Parse's installation id, which lives beside the session under
   * `Parse/<appId>/installationId` and is the only other thing `userservice.ts`
   * kept in local storage. It is not session state, so it gets no method of its
   * own — but it does need the SSR guard, and duplicating that guard is how the
   * four copies above happened in the first place.
   */
  readKey(key: string): string | undefined {
    const storage = this.storage;
    if (!storage) return undefined;
    const value = storage[key];
    return value === undefined || value === null ? undefined : String(value);
  }

  writeKey(key: string, value: string): void {
    const storage = this.storage;
    if (!storage) return;
    storage[key] = value;
  }

  // ── Cross-tab ────────────────────────────────────────────────────────────

  /**
   * Hear about session changes made by **other** tabs.
   *
   * The `storage` event fires only in tabs that did not make the change, which
   * is exactly the semantics wanted and is why this is preferred to
   * `BroadcastChannel`: no echo to filter out, no availability question, and it
   * comes free with the storage already in use.
   *
   * Returns an unsubscribe function. Returns a no-op one when there is no
   * broadcaster, so callers never branch.
   */
  onExternalChange(handler: (session: StoredSession | undefined) => void): () => void {
    const broadcaster = this.broadcaster;
    if (!broadcaster) return () => {};

    const listener = (event: StorageChange) => {
      // A null key is `storage.clear()` — everything changed, including this.
      if (event && event.key !== null && event.key !== this.key) return;
      handler(this.read());
    };

    broadcaster.addEventListener('storage', listener);
    return () => broadcaster.removeEventListener('storage', listener);
  }

  /**
   * Try to become the tab that refreshes.
   *
   * Read, write, **read back**. `localStorage` writes are serialised per origin,
   * so in the racing case both tabs write and both read back and exactly one
   * sees its own id — and the loser discovers that *before issuing any request*,
   * because the whole sequence is synchronous with no `await` in it. That is
   * what keeps the cost of a lost race at one tab doing nothing rather than two
   * tabs spending the same rotating refresh token.
   *
   * It is not a mutex and BCN-006-LIFECYCLE-DESIGN §5 does not claim it is. The
   * residual risk is a same-millisecond interleaving across processes on an
   * implementation that does not serialise writes; the cost if it happens is one
   * wasted refresh, and the follower's wait-then-adopt behaviour means the user
   * still ends up with the session the winner wrote.
   *
   * **The lock expires.** A tab closed mid-refresh must not hold it forever —
   * that would be worse than having no lock at all.
   */
  tryAcquireRefreshLock(): boolean {
    const storage = this.storage;
    if (!storage) return false;

    const now = this.now();
    const existing = this.readLock();
    if (existing && existing.owner !== this.tabId && existing.expiresAt > now) return false;

    storage[this.lockKey] = JSON.stringify({ owner: this.tabId, expiresAt: now + this.lockTtlMs });

    const confirmed = this.readLock();
    return confirmed !== undefined && confirmed.owner === this.tabId;
  }

  /** Release only our own lock — never one another tab has since taken. */
  releaseRefreshLock(): void {
    const storage = this.storage;
    if (!storage) return;
    const existing = this.readLock();
    if (existing && existing.owner !== this.tabId) return;
    delete storage[this.lockKey];
  }

  private readLock(): { owner: string; expiresAt: number } | undefined {
    const raw = this.readKey(this.lockKey);
    if (raw === undefined) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.owner !== 'string' || typeof parsed.expiresAt !== 'number') return undefined;
      return parsed;
    } catch (e) {
      return undefined;
    }
  }
}

/**
 * The Parse family's session key, in one place.
 *
 * `Parse/<appId>/currentUser`, unchanged and unchangeable: it is what every
 * deployed NodeGX app has already written into its users' browsers, and a
 * different key is a silent mass logout on upgrade.
 */
export function parseSessionKey(appId: string | undefined): string {
  return 'Parse/' + appId + '/currentUser';
}

/** Beside the session, and equally unchangeable for the same reason. */
export function parseInstallationIdKey(appId: string | undefined): string {
  return 'Parse/' + appId + '/installationId';
}

const _parseStores = new Map<string, SessionStore>();

/**
 * **One** store per Parse application id, shared by everything that reads the
 * session.
 *
 * The sharing is the point, and BCN-006's own traps list says why: until the
 * data path and the auth path read the same thing, they are two opinions about
 * who is logged in. They are now one object — the data wire, the auth wire and
 * all three cloud-function call sites resolve to the same `SessionStore` for a
 * given app, so a login is visible everywhere on the next request with nothing
 * having to be told.
 *
 * Cached rather than constructed per call because the refresh lock's `tabId` has
 * to be stable: a fresh store per request would be a fresh tab identity per
 * request, and the lock would never recognise itself.
 */
export function parseSessionStore(appId: string | undefined): SessionStore {
  const cacheKey = String(appId);
  let store = _parseStores.get(cacheKey);
  if (store === undefined) {
    store = new SessionStore({ key: parseSessionKey(appId) });
    _parseStores.set(cacheKey, store);
  }
  return store;
}
