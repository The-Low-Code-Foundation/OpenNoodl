'use strict';

/**
 * The global observable store (AGENT-003).
 *
 * ## Why this is a layer over `Model`, and not a second state system
 *
 * Noodl already has observable state: `src/model.js` is an id-keyed record that notifies
 * `'change'` with `{ name, value, old }`, and the whole Variable / Set Variable pair is
 * nothing more than a single shared record — the one keyed `'--ndl--global-variables'`.
 * A "global store" built on its own `Map` and its own pub/sub would therefore be a *second*
 * state system competing with the first: values invisible to Function nodes, unreachable
 * from `Noodl.Object`, and with change semantics that only look like Noodl's.
 *
 * So a named store here is one `Model`, keyed `'--ndl--global-store--<name>'`, and every
 * notification path in this file starts at that Model's own `'change'` event. That has a
 * consequence worth stating plainly: a write made *directly* to the Model (from a Function
 * node, say) notifies store subscribers exactly as a `setKey` does. There is one source of
 * truth, and it is the Model.
 *
 * What this layer adds, because `Model` has none of it:
 *
 * - a registry of named stores, with per-store configuration and persistence;
 * - subscriptions filtered to a set of keys, with a *batched* payload — one notification
 *   carrying every key that changed, rather than one notification per key;
 * - snapshot / restore, so state can be captured and put back (AGENT-006);
 * - patches: apply-then-commit-or-roll-back, correct when several are open at once
 *   (AGENT-004);
 * - deletion, which `Model` cannot express at all.
 *
 * ## Notification semantics (the contract wave 2 codes against)
 *
 * - One notification per **commit**. A commit is a single public write, or the close of a
 *   `batch()` / deferred batch, whichever encloses it.
 * - `changedKeys` lists only keys whose value actually differs from what it was when the
 *   commit window opened. A value set to `X` and back again inside one batch reports
 *   nothing, and a commit with no real change fires no notification at all.
 * - Key-filtered subscribers are called only when `changedKeys` intersects their keys.
 * - Subscribers are called in registration order, and the order of `changedKeys` is the
 *   order the writes happened.
 * - A subscriber that writes does not recurse: its write is applied immediately (so a read
 *   straight after it sees the new value) but the resulting notification is queued and
 *   delivered after the current one finishes.
 * - A subscriber added *during* a notification does not receive that notification. One
 *   removed during a notification does not receive it either, even if it had not been
 *   reached yet.
 * - A throwing subscriber is reported through `onError` and does not stop the others.
 */
import type { ModelChangeEvent, ModelLike, ModelModule } from '@noodl/types';

import ModelImport from '../../../model';

const Model = ModelImport as unknown as ModelModule;

/** The prefix that turns a store name into a `Model` id. Part of the public contract. */
const MODEL_ID_PREFIX = '--ndl--global-store--';

/** The prefix under which persisted stores are written to the storage seam. */
const STORAGE_KEY_PREFIX = 'noodl_store_';

/**
 * Marks "this key did not exist".
 *
 * `undefined` cannot do the job: restoring a rolled-back key by writing `undefined` leaves
 * the key present, which is a different state from absent — and it is the difference
 * between an optimistic *addition* being undone and being left behind as a hole.
 */
const ABSENT = Symbol('noodl.globalstore.absent');

export type StoreState = Record<string, unknown>;

/** What a store subscriber is handed. */
export interface StoreChange {
  storeName: string;
  /**
   * The store's **live** state object (the Model's `data`). Read it, do not mutate it —
   * mutating it directly bypasses change detection and no subscriber will hear about it.
   */
  state: StoreState;
  /** A shallow copy of the state as it was before this commit. Safe to keep. */
  previousState: StoreState;
  /** Keys that genuinely changed, in the order they were written. Never empty. */
  changedKeys: string[];
  /** Increments once per commit. Lets a consumer tell "same value again" from "no change". */
  revision: number;
}

export type StoreSubscriber = (change: StoreChange) => void;

/** Something the store could not do, surfaced rather than swallowed. */
export interface StoreError {
  storeName: string;
  /** Where it happened: writing persistence, reading it, cloning state, or in a subscriber. */
  phase: 'persist' | 'load' | 'clone' | 'subscriber';
  message: string;
}

export type StoreErrorListener = (error: StoreError) => void;

export type Unsubscribe = () => void;

/**
 * The minimum a persistence backend must provide — `localStorage`'s shape, narrowed to the
 * three methods used. Injected so the store never reaches for a browser global; the runtime
 * also runs in Node (cloud functions, SSR) where there is none.
 */
export interface StoreStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoreConfig {
  /** Applied to keys the store does not already have. Never overwrites live state. */
  initialState?: StoreState | string;
  persist?: boolean;
  /** Storage key, defaulting to the store name. */
  storageKey?: string;
}

/** A point-in-time copy of a store. Plain data, safe to keep, JSON-serialisable if `byReference` is empty. */
export interface StoreSnapshot {
  storeName: string;
  /** A deep copy. Mutating it does not touch the store. */
  state: StoreState;
  takenAt: number;
  /** The store's revision when the snapshot was taken. */
  revision: number;
  /**
   * Top-level keys whose value could not be copied and is held by reference: Models,
   * Collections, class instances, functions, and anything reached through a cycle.
   * Restoring such a key puts the *same object* back, so a mutation made after the
   * snapshot was taken is not undone. Surface this rather than pretending time travel is
   * total.
   */
  byReference: string[];
}

export type PatchStatus = 'pending' | 'committed' | 'rolledBack';

/** A handle on an applied-but-unconfirmed patch. */
export interface StorePatchHandle {
  readonly id: string;
  readonly storeName: string;
  /** The keys the patch wrote. */
  readonly keys: string[];
  readonly status: PatchStatus;
  readonly appliedAt: number;
}

interface Subscription {
  callback: StoreSubscriber;
  /** `null` means "every key". */
  keys: Set<string> | null;
  cancelled: boolean;
}

interface ChangeWindow {
  /** First value seen for each key in this window; `ABSENT` if the key did not exist. */
  previous: Map<string, unknown>;
  /** Keys that must report as changed even if the value compares equal. */
  forced: Set<string>;
}

interface PatchRecord {
  id: string;
  storeName: string;
  /** Value each key held immediately before this patch wrote it; `ABSENT` if it had none. */
  before: Map<string, unknown>;
  status: PatchStatus;
  appliedAt: number;
}

interface StoreRecord {
  name: string;
  model: ModelLike;
  onModelChange: (event: ModelChangeEvent) => void;
  subscribers: Subscription[];
  errorListeners: StoreErrorListener[];
  revision: number;
  batchDepth: number;
  window: ChangeWindow | null;
  pending: StoreChange[];
  notifying: boolean;
  /** Closes the deferred (microtask) batch, if one is open. */
  deferredClose: (() => void) | null;
  persist: boolean;
  storageKey?: string;
  persistDirty: boolean;
  /** Pending coalesced persist, so a reset can cancel it rather than let it fire late. */
  persistTimer: ReturnType<typeof setTimeout> | null;
  /** Open patches, oldest first. */
  patches: PatchRecord[];
}

// ---------------------------------------------------------------------------
// Cloning
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is StoreState {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-copies plain data and leaves everything else alone.
 *
 * Plain objects, plain arrays, and `Date`s are copied. A Noodl `Collection` is a real
 * `Array` (`collection.js` extends it) so `Array.isArray` says yes to one — hence the
 * `constructor === Array` test, without which snapshotting would silently turn a live
 * Collection into a dead plain array. A `Model` is a Proxy over a class instance, so it
 * fails `isPlainObject` and goes by reference too. Cycles are detected and the repeat
 * visit is kept by reference rather than recursed into.
 */
function cloneValue(value: unknown, seen: WeakSet<object>, byReference: () => void): unknown {
  if (typeof value === 'function') {
    // Not data. It survives a snapshot only because the same function object is put back.
    byReference();
    return value;
  }

  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value as object)) {
    byReference();
    return value;
  }

  if (value instanceof Date) return new Date(value.getTime());

  if (Array.isArray(value)) {
    if (value.constructor !== Array) {
      // A Collection, or some other Array subclass. Copying it would destroy behaviour.
      byReference();
      return value;
    }
    seen.add(value);
    const out = value.map((entry) => cloneValue(entry, seen, byReference));
    seen.delete(value);
    return out;
  }

  if (isPlainObject(value)) {
    seen.add(value);
    const out: StoreState = {};
    for (const key of Object.keys(value)) {
      out[key] = cloneValue(value[key], seen, byReference);
    }
    seen.delete(value);
    return out;
  }

  byReference();
  return value;
}

// ---------------------------------------------------------------------------
// The manager
// ---------------------------------------------------------------------------

export class GlobalStoreManager {
  private stores = new Map<string, StoreRecord>();
  private patchIndex = new Map<string, PatchRecord>();
  private storage: StoreStorage | null | undefined = undefined;
  private patchCounter = 0;

  // -- identity ------------------------------------------------------------

  /** The `Model` id backing a store. Stable, and usable from a Function node. */
  modelIdFor(storeName: string): string {
    return MODEL_ID_PREFIX + this.normalizeName(storeName);
  }

  /** The store's backing `Model`. The escape hatch for code that wants Noodl's own API. */
  getModel(storeName: string): ModelLike {
    return this.ensure(storeName).model;
  }

  getStoreNames(): string[] {
    return Array.from(this.stores.keys());
  }

  /** Increments once per commit; `0` for a store that has never changed. */
  getRevision(storeName: string): number {
    const record = this.stores.get(this.normalizeName(storeName));
    return record ? record.revision : 0;
  }

  // -- reading -------------------------------------------------------------

  /**
   * The store's live state. Do not mutate the returned object — write through `setKey`,
   * `setState` or `replaceState`, or change detection will not see it.
   */
  getState(storeName: string): StoreState {
    return this.ensure(storeName).model.data;
  }

  getKey(storeName: string, key: string): unknown {
    return this.ensure(storeName).model.data[key];
  }

  hasKey(storeName: string, key: string): boolean {
    return key in this.ensure(storeName).model.data;
  }

  // -- writing -------------------------------------------------------------

  /**
   * Sets one key.
   *
   * `merge: true` shallow-merges into the key's existing value when both old and new are
   * plain objects; otherwise the value replaces. `force: true` reports the key as changed
   * even when the value compares equal, which is how a repeated identical write can still
   * drive a signal (the same reason `Set Variable` passes `forceChange` to `Model`).
   */
  setKey(storeName: string, key: string, value: unknown, opts?: { merge?: boolean; force?: boolean }): void {
    if (typeof key !== 'string' || key === '') {
      throw new Error('Global Store: a key is required');
    }

    const record = this.ensure(storeName);

    this.write(record, () => {
      const current = record.model.data[key];
      let next = value;

      if (opts && opts.merge && isPlainObject(current) && isPlainObject(value)) {
        next = Object.assign({}, current, value);
      }

      this.recordPrevious(record, key);
      if (opts && opts.force) this.windowOf(record).forced.add(key);
      record.model.set(key, next, opts && opts.force ? { forceChange: true } : undefined);
    });
  }

  /** Merges `updates` into the store. One notification, however many keys it touches. */
  setState(storeName: string, updates: StoreState): void {
    if (!isPlainObject(updates)) {
      throw new Error('Global Store: setState expects a plain object');
    }

    const record = this.ensure(storeName);

    this.write(record, () => {
      for (const key of Object.keys(updates)) {
        this.recordPrevious(record, key);
        record.model.set(key, updates[key]);
      }
    });
  }

  /**
   * Replaces the store's state wholesale: keys absent from `next` are **deleted**, not left
   * behind. One notification. This is what an undo or a snapshot restore needs — a merge
   * would leave keys the earlier state never had.
   */
  replaceState(storeName: string, next: StoreState): void {
    if (!isPlainObject(next)) {
      throw new Error('Global Store: replaceState expects a plain object');
    }

    const record = this.ensure(storeName);

    this.write(record, () => {
      for (const key of Object.keys(record.model.data)) {
        if (!(key in next)) this.removeKey(record, key);
      }
      for (const key of Object.keys(next)) {
        this.recordPrevious(record, key);
        record.model.set(key, next[key]);
      }
    });
  }

  /** Removes a key entirely. `Model` cannot do this on its own. */
  deleteKey(storeName: string, key: string): void {
    const record = this.ensure(storeName);
    this.write(record, () => this.removeKey(record, key));
  }

  /** Empties the store, and removes its persisted copy if it has one. */
  clearStore(storeName: string): void {
    const record = this.ensure(storeName);

    this.write(record, () => {
      for (const key of Object.keys(record.model.data)) {
        this.removeKey(record, key);
      }
    });

    if (record.persist) {
      const storage = this.resolveStorage();
      if (storage) {
        try {
          storage.removeItem(STORAGE_KEY_PREFIX + (record.storageKey || record.name));
        } catch (error) {
          this.reportError(record, 'persist', error);
        }
      }
    }
  }

  /**
   * Runs `fn` with notifications held, delivering one commit at the end. Nesting is
   * allowed; only the outermost close commits. Exceptions still close the batch.
   */
  batch<T>(storeName: string, fn: () => T): T {
    const record = this.ensure(storeName);
    record.batchDepth++;
    try {
      return fn();
    } finally {
      record.batchDepth--;
      if (record.batchDepth === 0) this.commit(record);
    }
  }

  /**
   * Holds notifications until the end of the current microtask, so several independent
   * writers in the same turn coalesce into one commit.
   *
   * This is what the `Set Global Store` node's `transaction` input uses. It deliberately
   * does *not* work like the phase-3.5 draft, where `transaction: true` meant "skip the
   * notification" — that variant loses the change permanently unless something else
   * happens to write later, which is the kind of silent failure this phase exists to avoid.
   */
  deferNotifications(storeName: string): void {
    const record = this.ensure(storeName);
    if (record.deferredClose) return;

    record.batchDepth++;
    const close = () => {
      if (record.deferredClose !== close) return;
      record.deferredClose = null;
      record.batchDepth--;
      if (record.batchDepth === 0) this.commit(record);
    };
    record.deferredClose = close;
    Promise.resolve().then(close);
  }

  /** Closes every open deferred batch now. Makes the microtask timing testable. */
  flushBatches(): void {
    for (const record of this.stores.values()) {
      if (record.deferredClose) record.deferredClose();
    }
  }

  // -- subscriptions -------------------------------------------------------

  /**
   * Subscribes to a store. `keys` empty or omitted means every key.
   *
   * The returned unsubscribe is idempotent, and takes effect immediately — including in
   * the middle of a notification that has not yet reached this subscriber.
   */
  subscribe(storeName: string, callback: StoreSubscriber, keys?: string[] | null): Unsubscribe {
    if (typeof callback !== 'function') {
      throw new Error('Global Store: subscribe needs a callback');
    }

    const record = this.ensure(storeName);
    const subscription: Subscription = {
      callback,
      keys: keys && keys.length ? new Set(keys) : null,
      cancelled: false
    };

    record.subscribers.push(subscription);

    return () => {
      if (subscription.cancelled) return;
      subscription.cancelled = true;
      const index = record.subscribers.indexOf(subscription);
      if (index !== -1) record.subscribers.splice(index, 1);
    };
  }

  /** How many live subscribers a store has. Exists so leaks can be asserted on. */
  subscriberCount(storeName: string): number {
    const record = this.stores.get(this.normalizeName(storeName));
    return record ? record.subscribers.length : 0;
  }

  /** Listens for what the store could not do. Same idempotent-unsubscribe contract. */
  onError(storeName: string, listener: StoreErrorListener): Unsubscribe {
    const record = this.ensure(storeName);
    record.errorListeners.push(listener);

    let cancelled = false;
    return () => {
      if (cancelled) return;
      cancelled = true;
      const index = record.errorListeners.indexOf(listener);
      if (index !== -1) record.errorListeners.splice(index, 1);
    };
  }

  // -- configuration -------------------------------------------------------

  /**
   * Configures a store, creating it if needed.
   *
   * `initialState` fills in keys the store does not already have; it never overwrites live
   * state, because the node carrying it can mount and unmount many times over an app's
   * life and defaults stomping real values on every remount would be a bug nobody could
   * see. A persisted copy is applied *after* the defaults and wins over them.
   */
  configureStore(storeName: string, config?: StoreConfig): void {
    const record = this.ensure(storeName);

    if (config && config.storageKey !== undefined) {
      record.storageKey = config.storageKey || undefined;
    }

    const initialState = this.coerceState(record, config && config.initialState);

    this.batch(record.name, () => {
      if (initialState) {
        for (const key of Object.keys(initialState)) {
          if (!(key in record.model.data)) {
            this.recordPrevious(record, key);
            record.model.set(key, initialState[key]);
          }
        }
      }

      if (config && config.persist !== undefined) {
        const wasPersisting = record.persist;
        record.persist = !!config.persist;

        if (record.persist && !wasPersisting) {
          const persisted = this.loadPersisted(record);
          if (persisted) {
            for (const key of Object.keys(persisted)) {
              this.recordPrevious(record, key);
              record.model.set(key, persisted[key]);
            }
          }
        }
      }
    });
  }

  // -- snapshots (AGENT-006) ----------------------------------------------

  /**
   * Copies the store's state. Deep for plain data; see {@link StoreSnapshot.byReference}
   * for what cannot be copied and what that costs.
   */
  getSnapshot(storeName: string): StoreSnapshot {
    const record = this.ensure(storeName);
    const state: StoreState = {};
    const byReference: string[] = [];

    for (const key of Object.keys(record.model.data)) {
      let escaped = false;
      state[key] = cloneValue(record.model.data[key], new WeakSet<object>(), () => {
        escaped = true;
      });
      if (escaped) byReference.push(key);
    }

    return {
      storeName: record.name,
      state,
      takenAt: Date.now(),
      revision: record.revision,
      byReference
    };
  }

  /**
   * Puts a snapshot back, as a full replace: keys the snapshot does not have are deleted.
   * One notification. The snapshot is copied on the way in, so the same snapshot can be
   * restored any number of times.
   *
   * `opts.storeName` restores into a different store than the one captured — which is how
   * "duplicate this state" and "restore an exported snapshot into a fresh store" work.
   * Returns the keys that changed.
   */
  restoreSnapshot(snapshot: StoreSnapshot, opts?: { storeName?: string }): string[] {
    if (!snapshot || !isPlainObject(snapshot.state)) {
      throw new Error('Global Store: restoreSnapshot expects a snapshot with a state object');
    }

    const target = (opts && opts.storeName) || snapshot.storeName;
    const record = this.ensure(target);
    const changed: string[] = [];

    const collect: StoreSubscriber = (change) => {
      for (const key of change.changedKeys) changed.push(key);
    };
    const unsubscribe = this.subscribe(record.name, collect);

    try {
      const copy = cloneValue(snapshot.state, new WeakSet<object>(), () => {}) as StoreState;
      this.replaceState(record.name, copy);
    } finally {
      unsubscribe();
    }

    return changed;
  }

  // -- patches (AGENT-004) ------------------------------------------------

  /**
   * Applies a patch that can later be committed or rolled back. One notification.
   *
   * The values each key held are captured first, so a rollback can put them back exactly —
   * including deleting a key the patch introduced, which is why absence is tracked as its
   * own state rather than as `undefined`.
   *
   * **Overlapping patches.** Several may be open on the same key at once, and rolling one
   * back must not clobber a newer one. Rollback therefore only writes live state for keys
   * where this patch is the newest open writer; where a newer patch also touched the key,
   * the older value is handed *to that patch's* captured values instead, so whenever the
   * newer one rolls back it lands on the right value. The upshot, stated as a rule wave 2
   * can rely on: rolling back a patch always removes exactly that patch's effect, and
   * rolling back several in any order leaves the same state as rolling them back newest
   * first.
   */
  applyPatch(storeName: string, patch: StoreState, opts?: { id?: string }): StorePatchHandle {
    if (!isPlainObject(patch)) {
      throw new Error('Global Store: applyPatch expects a plain object');
    }

    const record = this.ensure(storeName);
    const id = (opts && opts.id) || 'patch_' + Date.now().toString(36) + '_' + ++this.patchCounter;

    if (this.patchIndex.has(id)) {
      throw new Error(`Global Store: patch "${id}" is already open`);
    }

    const before = new Map<string, unknown>();
    for (const key of Object.keys(patch)) {
      before.set(key, key in record.model.data ? record.model.data[key] : ABSENT);
    }

    const patchRecord: PatchRecord = {
      id,
      storeName: record.name,
      before,
      status: 'pending',
      appliedAt: Date.now()
    };

    this.write(record, () => {
      for (const key of Object.keys(patch)) {
        this.recordPrevious(record, key);
        record.model.set(key, patch[key]);
      }
    });

    record.patches.push(patchRecord);
    this.patchIndex.set(id, patchRecord);

    return this.toHandle(patchRecord);
  }

  /** Confirms a patch: its values become the truth. `false` if the patch is not open. */
  commitPatch(id: string): boolean {
    const patch = this.patchIndex.get(id);
    if (!patch || patch.status !== 'pending') return false;

    patch.status = 'committed';
    this.forget(patch);
    return true;
  }

  /** Undoes a patch. One notification. `false` if the patch is not open. */
  rollbackPatch(id: string): boolean {
    const patch = this.patchIndex.get(id);
    if (!patch || patch.status !== 'pending') return false;

    const record = this.ensure(patch.storeName);
    const index = record.patches.indexOf(patch);
    const newer = index === -1 ? [] : record.patches.slice(index + 1);

    patch.status = 'rolledBack';
    this.forget(patch);

    this.write(record, () => {
      for (const [key, value] of patch.before) {
        // The newest still-open patch after this one that also wrote this key.
        let successor: PatchRecord | undefined;
        for (const candidate of newer) {
          if (candidate.status === 'pending' && candidate.before.has(key)) successor = candidate;
        }

        if (successor) {
          // Do not touch live state — the successor owns this key. Hand it the older
          // value so its own rollback lands correctly.
          successor.before.set(key, value);
          continue;
        }

        if (value === ABSENT) {
          this.removeKey(record, key);
        } else {
          this.recordPrevious(record, key);
          record.model.set(key, value);
        }
      }
    });

    return true;
  }

  getPatch(id: string): StorePatchHandle | undefined {
    const patch = this.patchIndex.get(id);
    return patch ? this.toHandle(patch) : undefined;
  }

  /** Patches still awaiting commit or rollback, oldest first. */
  getOpenPatches(storeName: string): StorePatchHandle[] {
    const record = this.stores.get(this.normalizeName(storeName));
    if (!record) return [];
    return record.patches.filter((patch) => patch.status === 'pending').map((patch) => this.toHandle(patch));
  }

  // -- platform seams ------------------------------------------------------

  /**
   * Sets the persistence backend. Pass `null` to disable persistence outright.
   *
   * Left unset, the store looks for `localStorage` on the global object the first time it
   * needs it — present in a browser, absent under Node (cloud functions, SSR, tests),
   * where persistence becomes a no-op reported through `onError`.
   */
  setStorage(storage: StoreStorage | null): void {
    this.storage = storage;
  }

  /** Writes every dirty persisted store now, rather than on the next turn. */
  flushPersistence(): void {
    for (const record of this.stores.values()) {
      if (record.persistDirty) this.persistNow(record);
    }
  }

  /**
   * Drops every store, subscriber and open patch, and detaches from the Models.
   *
   * By default the *state* survives, because it lives in the global `Model` registry and
   * something else may still hold the Model — this resets only this layer. Pass
   * `clearState` to empty the records as well, which is what a test between cases wants
   * and what a runtime reload wants. Clearing is silent: subscribers are gone by then.
   */
  reset(opts?: { clearState?: boolean }): void {
    for (const record of this.stores.values()) {
      if (opts && opts.clearState) {
        for (const key of Object.keys(record.model.data)) {
          delete record.model.data[key];
        }
      }
      record.model.off('change', record.onModelChange);
      if (record.persistTimer) {
        clearTimeout(record.persistTimer);
        record.persistTimer = null;
        record.persistDirty = false;
      }
      if (record.deferredClose) {
        record.deferredClose = null;
        record.batchDepth = 0;
      }
      record.subscribers.length = 0;
      record.errorListeners.length = 0;
    }
    this.stores.clear();
    this.patchIndex.clear();
    this.storage = undefined;
  }

  // -- internals -----------------------------------------------------------

  private normalizeName(storeName: string | undefined | null): string {
    return storeName === undefined || storeName === null || storeName === '' ? 'app' : String(storeName);
  }

  private ensure(storeName: string): StoreRecord {
    const name = this.normalizeName(storeName);
    const existing = this.stores.get(name);
    if (existing) return existing;

    const model = Model.get(MODEL_ID_PREFIX + name);

    const record: StoreRecord = {
      name,
      model,
      onModelChange: () => {},
      subscribers: [],
      errorListeners: [],
      revision: 0,
      batchDepth: 0,
      window: null,
      pending: [],
      notifying: false,
      deferredClose: null,
      persist: false,
      storageKey: undefined,
      persistDirty: false,
      persistTimer: null,
      patches: []
    };

    // The single tap on Noodl's own change event. Writes made straight to the Model land
    // here too, which is the point.
    record.onModelChange = (event: ModelChangeEvent) => {
      const window = this.windowOf(record);
      if (!window.previous.has(event.name)) window.previous.set(event.name, event.old);
      if (record.batchDepth === 0) this.commit(record);
    };

    model.on('change', record.onModelChange);
    this.stores.set(name, record);
    return record;
  }

  private windowOf(record: StoreRecord): ChangeWindow {
    if (!record.window) {
      record.window = { previous: new Map(), forced: new Set() };
    }
    return record.window;
  }

  /**
   * Notes what a key held before it is written.
   *
   * Done here rather than left to the Model's `change` event because only the caller knows
   * whether the key existed: `Model` reports `old: undefined` for a brand-new key and for
   * one that genuinely held `undefined`, and the two must not be confused.
   */
  private recordPrevious(record: StoreRecord, key: string): void {
    const window = this.windowOf(record);
    if (window.previous.has(key)) return;
    window.previous.set(key, key in record.model.data ? record.model.data[key] : ABSENT);
  }

  /** Deletes a key and notifies, which `Model` has no API for. */
  private removeKey(record: StoreRecord, key: string): void {
    if (!(key in record.model.data)) return;
    this.recordPrevious(record, key);
    const old = record.model.data[key];
    delete record.model.data[key];
    record.model.notify('change', { name: key, value: undefined, old });
  }

  /**
   * Runs one public write inside a batch, so the commit is attempted exactly once
   * afterwards — including when the Model declines to notify (setting a key that is absent
   * to `undefined` changes nothing by `Model`'s reckoning, but the key now exists).
   */
  private write(record: StoreRecord, fn: () => void): void {
    record.batchDepth++;
    try {
      fn();
    } finally {
      record.batchDepth--;
      if (record.batchDepth === 0) this.commit(record);
    }
  }

  private commit(record: StoreRecord): void {
    const window = record.window;
    record.window = null;
    if (!window) return;

    const data = record.model.data;
    const previousState: StoreState = Object.assign({}, data);
    const changedKeys: string[] = [];

    for (const [key, old] of window.previous) {
      const wasPresent = old !== ABSENT;

      if (wasPresent) previousState[key] = old;
      else delete previousState[key];

      const isPresent = key in data;
      if (window.forced.has(key) || wasPresent !== isPresent || data[key] !== old) {
        changedKeys.push(key);
      }
    }

    if (changedKeys.length === 0) return;

    record.revision++;

    this.notify(record, {
      storeName: record.name,
      state: data,
      previousState,
      changedKeys,
      revision: record.revision
    });

    if (record.persist) this.schedulePersist(record);
  }

  private notify(record: StoreRecord, change: StoreChange): void {
    record.pending.push(change);
    if (record.notifying) return;

    record.notifying = true;
    try {
      while (record.pending.length) {
        const next = record.pending.shift() as StoreChange;
        // Snapshot the list: a subscriber added while this notification is in flight does
        // not receive it, and one removed is skipped via its cancelled flag.
        for (const subscription of record.subscribers.slice()) {
          if (subscription.cancelled) continue;

          const watched = subscription.keys;
          if (watched && !next.changedKeys.some((key) => watched.has(key))) continue;

          try {
            subscription.callback(next);
          } catch (error) {
            this.reportError(record, 'subscriber', error);
          }
        }
      }
    } finally {
      record.notifying = false;
    }
  }

  private toHandle(patch: PatchRecord): StorePatchHandle {
    return {
      id: patch.id,
      storeName: patch.storeName,
      keys: Array.from(patch.before.keys()),
      status: patch.status,
      appliedAt: patch.appliedAt
    };
  }

  private forget(patch: PatchRecord): void {
    this.patchIndex.delete(patch.id);
    const record = this.stores.get(patch.storeName);
    if (!record) return;
    const index = record.patches.indexOf(patch);
    if (index !== -1) record.patches.splice(index, 1);
  }

  private coerceState(record: StoreRecord, value: StoreState | string | undefined): StoreState | undefined {
    if (value === undefined || value === null || value === '') return undefined;

    if (typeof value === 'string') {
      // Object-typed ports arrive as text when the author typed JSON into the editor.
      try {
        const parsed = JSON.parse(value);
        if (!isPlainObject(parsed)) {
          this.reportError(record, 'clone', new Error('initial state must be a JSON object'));
          return undefined;
        }
        return parsed;
      } catch (error) {
        this.reportError(record, 'clone', error);
        return undefined;
      }
    }

    if (!isPlainObject(value)) {
      this.reportError(record, 'clone', new Error('initial state must be an object'));
      return undefined;
    }

    return value;
  }

  private resolveStorage(): StoreStorage | null {
    if (this.storage !== undefined) return this.storage;

    const candidate = (globalThis as { localStorage?: StoreStorage }).localStorage;
    this.storage = candidate && typeof candidate.setItem === 'function' ? candidate : null;
    return this.storage;
  }

  /**
   * Marks the store for persistence on the next turn.
   *
   * Coalesced rather than written per change: a burst of writes — a stream filling a store
   * token by token, say — would otherwise serialise the whole state on every one of them.
   */
  private schedulePersist(record: StoreRecord): void {
    if (record.persistDirty) return;
    record.persistDirty = true;
    record.persistTimer = setTimeout(() => this.persistNow(record), 0);
  }

  private persistNow(record: StoreRecord): void {
    record.persistDirty = false;
    if (record.persistTimer) {
      clearTimeout(record.persistTimer);
      record.persistTimer = null;
    }
    if (!record.persist) return;

    const storage = this.resolveStorage();
    if (!storage) {
      this.reportError(record, 'persist', new Error('no storage available; persistence is disabled'));
      return;
    }

    const snapshot = this.getSnapshot(record.name);

    try {
      storage.setItem(STORAGE_KEY_PREFIX + (record.storageKey || record.name), JSON.stringify(snapshot.state));
    } catch (error) {
      const hint = snapshot.byReference.length
        ? ` (these keys hold values that cannot be serialised: ${snapshot.byReference.join(', ')})`
        : '';
      this.reportError(record, 'persist', new Error(String((error as Error).message || error) + hint));
    }
  }

  private loadPersisted(record: StoreRecord): StoreState | undefined {
    const storage = this.resolveStorage();
    if (!storage) return undefined;

    try {
      const raw = storage.getItem(STORAGE_KEY_PREFIX + (record.storageKey || record.name));
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      if (!isPlainObject(parsed)) {
        this.reportError(record, 'load', new Error('persisted state is not an object; ignoring it'));
        return undefined;
      }
      return parsed;
    } catch (error) {
      this.reportError(record, 'load', error);
      return undefined;
    }
  }

  private reportError(record: StoreRecord, phase: StoreError['phase'], error: unknown): void {
    const storeError: StoreError = {
      storeName: record.name,
      phase,
      message: String((error as Error)?.message || error)
    };

    if (record.errorListeners.length === 0) {
      console.error(`[GlobalStore:${record.name}] ${phase}: ${storeError.message}`);
      return;
    }

    for (const listener of record.errorListeners.slice()) {
      try {
        listener(storeError);
      } catch (nested) {
        console.error(`[GlobalStore:${record.name}] error listener threw:`, nested);
      }
    }
  }
}

/**
 * The one store manager. A singleton for the same reason `Model` is: "global" is the whole
 * point, and a Set node in one component must reach a Subscribe node in another with
 * nothing but a name in common.
 */
export const globalStoreManager = new GlobalStoreManager();

export { MODEL_ID_PREFIX, STORAGE_KEY_PREFIX };
