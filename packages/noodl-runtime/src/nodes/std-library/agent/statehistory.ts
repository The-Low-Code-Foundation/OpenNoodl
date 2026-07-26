'use strict';

/**
 * State history — undo, redo and time travel over a global store (AGENT-006).
 *
 * ## What this is, and what it deliberately is not
 *
 * This is a *linear* history of snapshots taken from AGENT-003's store. It owns no state of
 * its own: every entry is a {@link StoreSnapshot} produced by `globalStoreManager.getSnapshot`,
 * and every restore goes back through `restoreSnapshot` (or, for a key-filtered history, back
 * through the store's ordinary writes inside one `batch`). There is no second copy of the
 * truth here, and no second notification path — a node watching the store sees an undo
 * exactly as it sees any other write, which is the point.
 *
 * It is also *not* AGENT-004's rollback. A patch rollback removes one in-flight optimistic
 * change; an undo walks the whole store back to an earlier point. They operate on the same
 * store and they are not the same mechanism, so they are not unified. A patch apply and a
 * patch rollback each look like an ordinary commit from here, and each therefore records a
 * history entry.
 *
 * ## The invariant everything else depends on
 *
 * **`entries[currentIndex]` always describes the live state.** Every operation here either
 * maintains that or repairs it:
 *
 * - recording appends the post-change snapshot and moves `currentIndex` to it;
 * - undo/redo/jump write the target entry's state into the store;
 * - re-enabling after a pause records a fresh entry if the state drifted while paused;
 * - trimming for `maxHistory` never drops the entry `currentIndex` points at.
 *
 * ## The four things that are easy to get subtly wrong
 *
 * 1. **Unbounded history is a memory leak.** `maxHistory` (default 50, floor 2) bounds it,
 *    and the oldest entries are dropped first — never the current one.
 * 2. **A new write after an undo must discard the redo stack.** Otherwise "redo" would jump
 *    to a future that no longer follows from the present.
 * 3. **A restore must not record itself.** If it did, undo would push a new entry, which
 *    would be undoable, for ever. Restores run under a `restoring` flag and the recorder
 *    returns early. The flag covers re-entrant writes made by other subscribers during the
 *    restore notification too, because AGENT-003 drains its queued notifications inside the
 *    same synchronous call.
 * 4. **One undo step should match one user intent, not one keystroke.** `coalesceMs` folds
 *    successive writes of the *same keys* inside a sliding time window into the entry that
 *    is already on top. It is time-comparison only — no timer is started, so there is
 *    nothing to leak and nothing to flush.
 *
 * ## The honest limit
 *
 * A snapshot cannot copy a `Model`, a `Collection`, a class instance or a function; AGENT-003
 * keeps those by reference and lists their top-level keys in `snapshot.byReference`. Undoing
 * such a key puts the *same object* back, so mutations made to it since are not undone. That
 * is surfaced all the way out to the graph — see `fullyRestorable` and `byReferenceKeys` on
 * every node in this set — rather than hidden behind a claim of total time travel.
 */
import {
  cloneStoreValue,
  globalStoreManager,
  StoreChange,
  StoreSnapshot,
  StoreState,
  Unsubscribe
} from './globalstore';

/** Default bound on a history, as the phase-3.5 spec asks for. */
const DEFAULT_MAX_HISTORY = 50;

/**
 * A history of one entry cannot undo anything, so a `maxHistory` below this is almost
 * certainly a mistake rather than a request. Clamped rather than obeyed.
 */
const MIN_MAX_HISTORY = 2;

/** Why an entry exists. `initial` and `reset` are baselines and are never coalesced into. */
export type HistoryEntrySource = 'initial' | 'change' | 'reset';

export interface HistoryEntry {
  /** The store's state *after* the change this entry records. */
  snapshot: StoreSnapshot;
  timestamp: number;
  /** Keys that changed to produce this entry. Empty for a baseline. */
  changedKeys: string[];
  description: string;
  source: HistoryEntrySource;
}

/** One entry as the graph sees it. Deliberately without the state — see the notes. */
export interface HistoryEntryInfo {
  index: number;
  timestamp: number;
  description: string;
  /** Comma-separated, for the same reason AGENT-003's `changedKeys` port is a string. */
  changedKeys: string;
  isCurrent: boolean;
  /** True when restoring this entry cannot fully restore it. */
  partial: boolean;
  /** Comma-separated keys this entry holds by reference. */
  byReference: string;
}

export interface HistoryInfo {
  storeName: string;
  size: number;
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  enabled: boolean;
  /** Every key any entry could only capture by reference, deduplicated and sorted. */
  byReferenceKeys: string[];
  entries: HistoryEntryInfo[];
}

/** What a navigation did, for the node that asked for it. */
export interface HistoryNavigation {
  index: number;
  canUndo: boolean;
  canRedo: boolean;
  /** Keys the restored entry could only hold by reference; empty means a complete restore. */
  byReferenceKeys: string[];
}

export interface HistoryOptions {
  maxHistory?: number;
  /** Keys to track. Empty means the whole store. Changing this clears the history. */
  trackKeys?: string[];
  /** Sliding window in ms within which same-key writes fold into one undo step. 0 = off. */
  coalesceMs?: number;
  enabled?: boolean;
}

interface HistoryRecord {
  storeName: string;
  entries: HistoryEntry[];
  currentIndex: number;
  maxHistory: number;
  trackKeys: string[];
  trackSet: Set<string> | null;
  coalesceMs: number;
  enabled: boolean;
  /** True while this layer is writing to the store; the recorder ignores those writes. */
  restoring: boolean;
  /** Set by any navigation, so the next write cannot coalesce into the entry it landed on. */
  coalesceBarrier: boolean;
  unsubscribe: Unsubscribe | null;
  listeners: (() => void)[];
  /** How many nodes are attached. The record dies with the last one. */
  refs: number;
}

function sameKeys(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  for (const key of b) if (!set.has(key)) return false;
  return true;
}

function normalizeName(storeName: string | undefined | null): string {
  return storeName === undefined || storeName === null || storeName === '' ? 'app' : String(storeName);
}

export class StateHistoryManager {
  private histories = new Map<string, HistoryRecord>();
  private snapshots = new Map<string, StoreSnapshot>();

  /**
   * The clock, injected so coalescing can be tested without waiting.
   *
   * It defaults to `Date.now`, which Jest's modern fake timers also control — both routes
   * are exercised by the suite.
   */
  private now: () => number = () => Date.now();

  setClock(clock: (() => number) | null): void {
    this.now = clock || (() => Date.now());
  }

  // -- attaching -----------------------------------------------------------

  /**
   * Starts (or joins) tracking of a store, and registers a listener for history changes.
   *
   * Attaching is **reference counted**: two State History nodes pointing at one store share
   * one history and one store subscription, and the history survives until the last of them
   * goes away. Without that, deleting one of two trackers would silently wipe the other's
   * undo stack.
   *
   * The returned function detaches. It is idempotent.
   */
  attach(storeName: string, options: HistoryOptions, onChanged: () => void): Unsubscribe {
    const name = normalizeName(storeName);
    let record = this.histories.get(name);

    if (!record) {
      record = this.create(name, options);
      this.histories.set(name, record);
    } else {
      this.configure(name, options);
    }

    record.refs++;
    record.listeners.push(onChanged);

    let detached = false;
    const target = record;
    return () => {
      if (detached) return;
      detached = true;

      const index = target.listeners.indexOf(onChanged);
      if (index !== -1) target.listeners.splice(index, 1);

      target.refs--;
      if (target.refs <= 0) this.dispose(target);
    };
  }

  /** Applies new options to a live history. Whether the history survives depends on which. */
  configure(storeName: string, options: HistoryOptions): void {
    const record = this.histories.get(normalizeName(storeName));
    if (!record) return;

    if (options.maxHistory !== undefined) {
      record.maxHistory = Math.max(MIN_MAX_HISTORY, Math.floor(options.maxHistory) || DEFAULT_MAX_HISTORY);
      this.trim(record);
    }

    if (options.coalesceMs !== undefined) {
      record.coalesceMs = Math.max(0, Number(options.coalesceMs) || 0);
    }

    if (options.trackKeys !== undefined && !sameKeys(record.trackKeys, options.trackKeys)) {
      // A history of a different set of keys is a different history: its entries were
      // projected to the old keys and restoring one would write the wrong shape. Resubscribe
      // and start again rather than keep entries that no longer mean what they say.
      record.trackKeys = options.trackKeys.slice();
      record.trackSet = record.trackKeys.length ? new Set(record.trackKeys) : null;
      this.resubscribe(record);
      this.resetEntries(record, 'initial', 'Initial state');
      this.notifyChanged(record);
      return;
    }

    if (options.enabled !== undefined) this.setEnabled(record.storeName, options.enabled);
  }

  /**
   * Pauses or resumes recording.
   *
   * Pausing keeps the history — an author flipping "Enabled" off is asking for the recorder
   * to stop, not for their undo stack to be thrown away. Resuming records a fresh entry if
   * the state drifted while paused, because otherwise `entries[currentIndex]` would no
   * longer describe live state and the next undo would restore something that never
   * immediately preceded it.
   */
  setEnabled(storeName: string, enabled: boolean): void {
    const record = this.histories.get(normalizeName(storeName));
    if (!record || record.enabled === !!enabled) return;

    record.enabled = !!enabled;

    if (record.enabled) {
      const current = record.entries[record.currentIndex];
      const snapshot = this.capture(record);
      if (!current || !this.sameState(current.snapshot.state, snapshot.state)) {
        this.push(record, {
          snapshot,
          timestamp: this.now(),
          changedKeys: [],
          description: 'Resumed',
          source: 'change'
        });
      }
    }

    this.notifyChanged(record);
  }

  // -- navigation ----------------------------------------------------------

  /** Steps back one entry. `null` when there is nothing to go back to. */
  undo(storeName: string): HistoryNavigation | null {
    const record = this.histories.get(normalizeName(storeName));
    if (!record || record.currentIndex <= 0) return null;
    return this.goTo(record, record.currentIndex - 1);
  }

  /** Steps forward one entry. `null` when there is nothing to go forward to. */
  redo(storeName: string): HistoryNavigation | null {
    const record = this.histories.get(normalizeName(storeName));
    if (!record || record.currentIndex >= record.entries.length - 1) return null;
    return this.goTo(record, record.currentIndex + 1);
  }

  /** Jumps to an absolute index. `null` for an out-of-range index or an untracked store. */
  jumpTo(storeName: string, index: number): HistoryNavigation | null {
    const record = this.histories.get(normalizeName(storeName));
    if (!record) return null;
    if (!Number.isFinite(index)) return null;

    const target = Math.floor(index);
    if (target < 0 || target >= record.entries.length) return null;

    return this.goTo(record, target);
  }

  /** Throws the history away and starts again from the live state. */
  clearHistory(storeName: string): void {
    const record = this.histories.get(normalizeName(storeName));
    if (!record) return;

    this.resetEntries(record, 'reset', 'Cleared');
    this.notifyChanged(record);
  }

  isTracking(storeName: string): boolean {
    return this.histories.has(normalizeName(storeName));
  }

  /** Everything a node needs to draw the history. `null` when the store is not tracked. */
  getHistoryInfo(storeName: string): HistoryInfo | null {
    const record = this.histories.get(normalizeName(storeName));
    if (!record) return null;

    const byReference = new Set<string>();
    for (const entry of record.entries) {
      for (const key of entry.snapshot.byReference) byReference.add(key);
    }

    return {
      storeName: record.storeName,
      size: record.entries.length,
      currentIndex: record.currentIndex,
      canUndo: record.currentIndex > 0,
      canRedo: record.currentIndex < record.entries.length - 1,
      enabled: record.enabled,
      byReferenceKeys: Array.from(byReference).sort(),
      entries: record.entries.map((entry, index) => ({
        index,
        timestamp: entry.timestamp,
        description: entry.description,
        changedKeys: entry.changedKeys.join(','),
        isCurrent: index === record.currentIndex,
        partial: entry.snapshot.byReference.length > 0,
        byReference: entry.snapshot.byReference.join(',')
      }))
    };
  }

  // -- named snapshots -----------------------------------------------------

  /**
   * Saves the store's current state under a name.
   *
   * Named snapshots are the checkpoint mechanism, and are deliberately separate from the
   * history: saving one does not touch the undo stack, and restoring one *is* an ordinary
   * write, so it lands in the history as an undoable step. Restoring a checkpoint you did
   * not mean to restore is exactly the mistake undo exists for.
   */
  saveNamedSnapshot(name: string, storeName: string): StoreSnapshot {
    if (typeof name !== 'string' || name === '') {
      throw new Error('State Snapshot: a snapshot name is required');
    }

    const snapshot = globalStoreManager.getSnapshot(normalizeName(storeName));
    this.snapshots.set(name, snapshot);
    return snapshot;
  }

  getNamedSnapshot(name: string): StoreSnapshot | undefined {
    return this.snapshots.get(name);
  }

  getSnapshotNames(): string[] {
    return Array.from(this.snapshots.keys());
  }

  deleteNamedSnapshot(name: string): boolean {
    return this.snapshots.delete(name);
  }

  /** Restores a saved snapshot. Throws when there is no snapshot by that name. */
  restoreNamedSnapshot(name: string, opts?: { storeName?: string }): StoreSnapshot {
    const snapshot = this.snapshots.get(name);
    if (!snapshot) {
      throw new Error(`State Snapshot: no snapshot named "${name}"`);
    }

    globalStoreManager.restoreSnapshot(snapshot, {
      storeName: (opts && opts.storeName) || snapshot.storeName
    });
    return snapshot;
  }

  /**
   * Restores snapshot data that came from outside — a `snapshot` output routed back in, or
   * JSON read off disk. Validated here rather than trusted, because this is the one entry
   * point whose input the author can type.
   */
  restoreSnapshotData(data: unknown, opts?: { storeName?: string }): StoreSnapshot {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;

    if (!parsed || typeof parsed !== 'object' || typeof (parsed as StoreSnapshot).state !== 'object') {
      throw new Error('State Snapshot: snapshot data must be an object with a "state" object');
    }

    const candidate = parsed as StoreSnapshot;
    const snapshot: StoreSnapshot = {
      storeName: normalizeName((opts && opts.storeName) || candidate.storeName),
      state: candidate.state as StoreState,
      takenAt: typeof candidate.takenAt === 'number' ? candidate.takenAt : this.now(),
      revision: typeof candidate.revision === 'number' ? candidate.revision : 0,
      byReference: Array.isArray(candidate.byReference) ? candidate.byReference : []
    };

    globalStoreManager.restoreSnapshot(snapshot, { storeName: snapshot.storeName });
    return snapshot;
  }

  // -- lifecycle -----------------------------------------------------------

  /** Drops every history and named snapshot, releasing the states they pinned. */
  reset(): void {
    for (const record of this.histories.values()) {
      if (record.unsubscribe) record.unsubscribe();
      record.unsubscribe = null;
      record.listeners.length = 0;
      record.entries.length = 0;
    }
    this.histories.clear();
    this.snapshots.clear();
    this.now = () => Date.now();
  }

  // -- internals -----------------------------------------------------------

  private create(storeName: string, options: HistoryOptions): HistoryRecord {
    const trackKeys = options.trackKeys ? options.trackKeys.slice() : [];

    const record: HistoryRecord = {
      storeName,
      entries: [],
      currentIndex: -1,
      maxHistory: Math.max(
        MIN_MAX_HISTORY,
        Math.floor(options.maxHistory ?? DEFAULT_MAX_HISTORY) || DEFAULT_MAX_HISTORY
      ),
      trackKeys,
      trackSet: trackKeys.length ? new Set(trackKeys) : null,
      coalesceMs: Math.max(0, Number(options.coalesceMs) || 0),
      enabled: options.enabled === undefined ? true : !!options.enabled,
      restoring: false,
      coalesceBarrier: true,
      unsubscribe: null,
      listeners: [],
      refs: 0
    };

    this.resetEntries(record, 'initial', 'Initial state');
    this.resubscribe(record);
    return record;
  }

  private dispose(record: HistoryRecord): void {
    if (record.unsubscribe) record.unsubscribe();
    record.unsubscribe = null;
    record.listeners.length = 0;
    // Release the snapshots rather than leave them pinned by a map nobody reads again.
    record.entries.length = 0;
    record.currentIndex = -1;
    this.histories.delete(record.storeName);
  }

  private resubscribe(record: HistoryRecord): void {
    if (record.unsubscribe) record.unsubscribe();
    record.unsubscribe = globalStoreManager.subscribe(
      record.storeName,
      (change: StoreChange) => this.record(record, change),
      record.trackKeys
    );
  }

  private resetEntries(record: HistoryRecord, source: HistoryEntrySource, description: string): void {
    record.entries = [
      {
        snapshot: this.capture(record),
        timestamp: this.now(),
        changedKeys: [],
        description,
        source
      }
    ];
    record.currentIndex = 0;
    record.coalesceBarrier = true;
  }

  /**
   * Takes the snapshot an entry holds.
   *
   * With `trackKeys` set the snapshot is projected down to those keys, so a history of one
   * key in a large store costs one key. `byReference` is projected with it, so the honesty
   * flag stays accurate rather than reporting keys this history does not hold.
   */
  private capture(record: HistoryRecord): StoreSnapshot {
    const snapshot = globalStoreManager.getSnapshot(record.storeName);
    const tracked = record.trackSet;
    if (!tracked) return snapshot;

    const state: StoreState = {};
    for (const key of Object.keys(snapshot.state)) {
      if (tracked.has(key)) state[key] = snapshot.state[key];
    }

    return {
      storeName: snapshot.storeName,
      state,
      takenAt: snapshot.takenAt,
      revision: snapshot.revision,
      byReference: snapshot.byReference.filter((key) => tracked.has(key))
    };
  }

  private record(record: HistoryRecord, change: StoreChange): void {
    // The two reasons not to record: the author turned it off, and this write *is* an undo.
    // The second is not an optimisation — recording a restore makes undo non-terminating.
    if (!record.enabled || record.restoring) return;

    const now = this.now();
    const top = record.entries[record.currentIndex];

    const canCoalesce =
      record.coalesceMs > 0 &&
      !record.coalesceBarrier &&
      record.currentIndex > 0 &&
      record.currentIndex === record.entries.length - 1 &&
      top !== undefined &&
      top.source === 'change' &&
      now - top.timestamp <= record.coalesceMs &&
      sameKeys(top.changedKeys, change.changedKeys);

    if (canCoalesce) {
      // One user intent, one undo step: the entry on top absorbs this write instead of a
      // new one appearing per keystroke. Sliding, so a continuous burst stays one step.
      top.snapshot = this.capture(record);
      top.timestamp = now;
      this.notifyChanged(record);
      return;
    }

    this.push(record, {
      snapshot: this.capture(record),
      timestamp: now,
      changedKeys: change.changedKeys.slice(),
      description: 'Changed: ' + change.changedKeys.join(', '),
      source: 'change'
    });
  }

  private push(record: HistoryRecord, entry: HistoryEntry): void {
    // A new change after an undo makes the redo stack unreachable: those states no longer
    // follow from the present. Truncate before appending.
    if (record.currentIndex < record.entries.length - 1) {
      record.entries.length = record.currentIndex + 1;
    }

    record.entries.push(entry);
    record.currentIndex = record.entries.length - 1;
    record.coalesceBarrier = false;

    this.trim(record);
    this.notifyChanged(record);
  }

  /**
   * Enforces `maxHistory`.
   *
   * Oldest first, and **never the entry `currentIndex` points at** — dropping that would
   * break the invariant that it describes live state. If the bound is still exceeded after
   * that (only possible when the current entry is the oldest, i.e. the author shrank the
   * bound while sitting on an undo), the *redo* tail is dropped instead: losing a future is
   * recoverable, losing the present is not.
   */
  private trim(record: HistoryRecord): void {
    while (record.entries.length > record.maxHistory && record.currentIndex > 0) {
      record.entries.shift();
      record.currentIndex--;
    }
    while (record.entries.length > record.maxHistory && record.entries.length - 1 > record.currentIndex) {
      record.entries.pop();
    }
  }

  private goTo(record: HistoryRecord, index: number): HistoryNavigation {
    const entry = record.entries[index];

    record.restoring = true;
    try {
      this.restore(record, entry);
    } finally {
      // In a `finally` because a throwing subscriber must not leave the recorder muted for
      // the rest of the app's life.
      record.restoring = false;
    }

    record.currentIndex = index;
    record.coalesceBarrier = true;
    this.notifyChanged(record);

    return {
      index,
      canUndo: record.currentIndex > 0,
      canRedo: record.currentIndex < record.entries.length - 1,
      byReferenceKeys: entry.snapshot.byReference.slice()
    };
  }

  private restore(record: HistoryRecord, entry: HistoryEntry): void {
    if (!record.trackSet) {
      // The whole store: AGENT-003's own full-replace restore, which copies the snapshot in
      // and so can be replayed any number of times.
      globalStoreManager.restoreSnapshot(entry.snapshot, { storeName: record.storeName });
      return;
    }

    // Key-filtered: a full replace would delete every untracked key, which the author never
    // asked to be part of this history. Write the tracked keys and only those, in one batch
    // so the store still emits a single notification. The values are copied on the way out
    // for the same reason `restoreSnapshot` copies: without it the app would be handed the
    // history's own objects and could mutate the past.
    const tracked = record.trackSet;
    globalStoreManager.batch(record.storeName, () => {
      for (const key of tracked) {
        if (key in entry.snapshot.state) {
          globalStoreManager.setKey(record.storeName, key, cloneStoreValue(entry.snapshot.state[key]));
        } else {
          globalStoreManager.deleteKey(record.storeName, key);
        }
      }
    });
  }

  /** Shallow identity comparison, enough to tell "the state drifted while paused". */
  private sameState(a: StoreState, b: StoreState): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!(key in b)) return false;
      if (a[key] !== b[key] && JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false;
    }
    return true;
  }

  private notifyChanged(record: HistoryRecord): void {
    for (const listener of record.listeners.slice()) {
      try {
        listener();
      } catch (error) {
        // One node's bad reaction must not stop the others being told, and must not leave
        // `restoring` set — this runs outside that flag's scope.
        console.error(`[StateHistory:${record.storeName}] listener threw:`, error);
      }
    }
  }
}

/**
 * The one history manager, for the same reason the store is a singleton: an Undo node in a
 * button component must reach the State History node in another with nothing but a store
 * name in common.
 */
export const stateHistoryManager = new StateHistoryManager();
