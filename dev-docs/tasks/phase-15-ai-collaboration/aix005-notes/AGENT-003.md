# AGENT-003 — Global State Store (as built)

Part of AIX-005 (Agentic UI Nodes). Implements
`dev-docs/tasks/phase-3.5-realtime-agentic-ui/AGENT-003-global-state-store-task.md`, reviewed
against current reality per AIX-005 step 1. Every departure from that spec is recorded in
§6 with reasoning.

**This is wave 1.** AGENT-004 (optimistic updates), AGENT-005 (action dispatcher) and
AGENT-006 (state history / time travel) will be written by other agents against the API in
§3. That section is the contract; treat it as the interface, not as a description of an
implementation you may reach around.

---

## 1. What was built

| File | What it is |
|------|------------|
| `packages/noodl-runtime/src/nodes/std-library/agent/globalstore.ts` | The store manager. Not a node. |
| `packages/noodl-runtime/src/nodes/std-library/agent/globalstorenode.ts` | `net.noodl.GlobalStore` |
| `packages/noodl-runtime/src/nodes/std-library/agent/globalstoresetnode.ts` | `net.noodl.GlobalStore.Set` |
| `packages/noodl-runtime/src/nodes/std-library/agent/globalstoresubscribenode.ts` | `net.noodl.GlobalStore.Subscribe` |
| `packages/noodl-runtime/test/globalstore.test.ts` | 75 specs |

Registered as three lines appended to the array in `packages/noodl-runtime/noodl-runtime.js`.
Catalog regenerated (`npm run catalog:generate`); 140 node types, `catalog:check` clean.

Zero new dependencies. `packages/noodl-runtime/package.json` untouched.

---

## 2. The central decision: this is a layer over `Model`, not a second state system

The phase-3.5 spec sketches a `GlobalStoreManager` holding `Map<string, object>` with its own
pub/sub. That would have been a second state system standing beside the one Noodl already
has, and worse, standing beside the one Noodl already uses *for exactly this purpose* —
Variables are nothing but a single shared `Model`, the one keyed `'--ndl--global-variables'`
(`packages/noodl-viewer-react/src/nodes/std-library/data/variablenode2.ts:55`).

So **a named store is one `Model`**, keyed `'--ndl--global-store--<name>'`, and every
notification path starts at that Model's own `'change'` event. The store manager taps
`model.on('change', …)` once per store and fans out from there.

What this buys, none of which the spec's design would have had:

- A write made **directly to the Model** — from a Function node doing
  `Noodl.Object.get('--ndl--global-store--app')` — notifies store subscribers exactly as
  `setKey` does. There is one source of truth. (Tested: *"notifies subscribers when the
  backing Model is written directly"*.)
- `Model`'s own change semantics are reused rather than re-invented: a write of an identical
  value does not notify, `{ forceChange: true }` makes it notify anyway.
- The editor's value inspector, `Noodl.Object`, and anything else that already understands a
  Model understands a store.

`Collection` was **not** used. A store is a keyed record, not an ordered list, and
`collection.js` patches `Array.prototype` in ways that are load-bearing and best left alone.
Collections stored *as values* inside a store are handled — see the by-reference rule in §3.4.

What `Model` could not do, and this layer adds:

- named-store registry, configuration, persistence;
- key-filtered subscriptions with a **batched** payload (one notification listing every key
  that changed, instead of one notification per key);
- **deletion** — `Model` has no delete at all;
- snapshot/restore (AGENT-006);
- patches: apply-then-commit-or-roll-back (AGENT-004).

---

## 3. Public API contract — what wave 2 codes against

```ts
import { globalStoreManager } from '../agent/globalstore';
```

The singleton is exported as `globalStoreManager`; the class `GlobalStoreManager` is exported
too, but the nodes all use the singleton and so should you — "global" is the point.

### 3.1 Reading

| Call | Returns |
|------|---------|
| `getState(storeName)` | The **live** state object. Read only — mutating it bypasses change detection. |
| `getKey(storeName, key)` | The value. |
| `hasKey(storeName, key)` | Whether the key exists (distinct from holding `undefined`). |
| `getRevision(storeName)` | Increments once per commit; `0` if never changed. |
| `getStoreNames()` | Names of stores this layer knows about. |
| `getModel(storeName)` | The backing `ModelLike`. Escape hatch. |
| `modelIdFor(storeName)` | `'--ndl--global-store--' + name`. Stable, part of the contract. |
| `subscriberCount(storeName)` | Live subscriber count. Exists so leaks can be asserted on. |

An unknown store name creates the store, empty. There is no "does this store exist" question
to answer first — same as `Model.get`. A blank/`undefined`/`null` name normalises to `'app'`.

### 3.2 Writing

| Call | Semantics |
|------|-----------|
| `setKey(name, key, value, { merge?, force? })` | One key. `merge` shallow-merges when both old and new are plain objects. `force` reports a change even if the value compares equal. Throws if `key` is empty. |
| `setState(name, updates)` | **Merges** `updates` in. One notification however many keys. |
| `replaceState(name, next)` | **Replaces**: keys absent from `next` are deleted. One notification. This is what undo/restore needs. |
| `deleteKey(name, key)` | Removes the key. |
| `clearStore(name)` | Empties it and removes its persisted copy. |
| `batch(name, fn)` | Holds notifications for the duration; one commit at the outermost close. Nestable. Commits even if `fn` throws. Returns `fn`'s value. |
| `deferNotifications(name)` | Holds notifications until the end of the current microtask, so independent callers in one turn coalesce. |
| `flushBatches()` | Closes every open deferred batch now. Makes timing testable. |

### 3.3 Subscriptions

```ts
subscribe(storeName, (change: StoreChange) => void, keys?: string[] | null): Unsubscribe
onError(storeName, (error: StoreError) => void): Unsubscribe

interface StoreChange {
  storeName: string;
  state: StoreState;          // live; read, do not mutate
  previousState: StoreState;  // shallow copy taken before this commit; safe to keep
  changedKeys: string[];      // never empty, in write order
  revision: number;
}

interface StoreError {
  storeName: string;
  phase: 'persist' | 'load' | 'clone' | 'subscriber';
  message: string;
}
```

`keys` empty or omitted means every key. Both unsubscribes are **idempotent**.

The semantics, stated so nobody has to read the implementation to find out:

1. **One notification per commit.** A commit is a single public write, or the close of the
   `batch()` / deferred batch enclosing it.
2. `changedKeys` lists only keys whose value genuinely differs from what it was when the
   commit window opened. Set `X` then back to the original inside one batch → **no
   notification at all**. `force: true` overrides this per key.
3. A key-filtered subscriber is called only when `changedKeys` intersects its keys.
4. Subscribers are called in **registration order**.
5. **Re-entrancy is queued, not recursive.** A subscriber that writes gets its write applied
   immediately (a read straight after sees the new value), but the resulting notification is
   queued and delivered after the current one drains. Notification depth never exceeds 1.
6. A subscriber **added** during a notification does not receive that notification. One
   **removed** during a notification does not receive it either, even if it had not been
   reached yet.
7. A **throwing subscriber is isolated**: reported through `onError` (phase `'subscriber'`)
   and the remaining subscribers still run. With no `onError` listener registered it goes to
   `console.error`.

### 3.4 Snapshots — for AGENT-006

```ts
getSnapshot(storeName): StoreSnapshot
restoreSnapshot(snapshot, { storeName? }?): string[]   // returns the keys that changed

interface StoreSnapshot {
  storeName: string;
  state: StoreState;      // deep copy
  takenAt: number;
  revision: number;
  byReference: string[];  // keys that could NOT be copied
}
```

- The copy is deep for plain objects, plain arrays and `Date`s.
- **`byReference` is the honest part.** A `Model`, a `Collection` (which is a real `Array`
  subclass, so `Array.isArray` is not the test — `constructor === Array` is), a class
  instance, a function, or anything reached through a cycle is kept **by reference** and its
  top-level key is listed. Restoring such a key puts the *same object* back, so mutations
  made to it after the snapshot are not undone. AGENT-006 should surface this rather than
  claim total time travel — a history entry with a non-empty `byReference` is only partly
  restorable, and the user deserves to be told which keys.
- Cycles do not hang; the repeat visit is by-reference.
- `restoreSnapshot` is a **full replace** (keys absent from the snapshot are deleted), one
  notification, and it copies the snapshot on the way in — the **same snapshot can be
  restored any number of times**, which linear undo/redo needs.
- `opts.storeName` restores into a different store than the one captured.
- A snapshot with no `state` object throws.

There is a spec in the suite (*"supports undo built the way AGENT-006 will build it"*) that
builds a four-entry history with `subscribe` + `getSnapshot` and walks back through it. It is
not a test of AGENT-006; it is a test that the primitives promised to AGENT-006 are enough.

### 3.5 Patches — for AGENT-004

```ts
applyPatch(storeName, patch: StoreState, { id? }?): StorePatchHandle
commitPatch(id): boolean      // false if the patch is not open
rollbackPatch(id): boolean    // false if the patch is not open
getPatch(id): StorePatchHandle | undefined
getOpenPatches(storeName): StorePatchHandle[]   // oldest first

interface StorePatchHandle {
  readonly id: string; readonly storeName: string;
  readonly keys: string[];
  readonly status: 'pending' | 'committed' | 'rolledBack';
  readonly appliedAt: number;
}
```

- `applyPatch` writes every key in one notification and captures what each key held first,
  **including absence** — a key the patch introduced is *deleted* on rollback, not set to
  `undefined`. That distinction is why absence is tracked as its own state internally.
- `commitPatch` keeps the values and closes the patch. `rollbackPatch` restores in one
  notification.
- Reusing an open id throws. An unknown id, or a second commit/rollback, returns `false`.
- **Overlapping patches.** Several may be open on the same key. Rollback writes live state
  only where this patch is the newest open writer of a key; where a newer patch also touched
  the key, the older value is handed to *that patch's* captured values instead. The rule
  AGENT-004 may rely on: **rolling back a patch removes exactly that patch's effect, and
  rolling several back in any order leaves the same state as rolling them back newest
  first.** Tested for two patches in both orders, three patches out of order, and
  commit-older-then-roll-back-newer.
- **Timeouts are deliberately not here.** The spec's `OptimisticUpdateManager` owns the
  30-second auto-rollback timer; that is a node concern and keeping timers out of the store
  keeps it testable and free of open handles. AGENT-004 should call `rollbackPatch(id)` from
  its own timer.

### 3.6 Platform seams and lifecycle

| Call | Purpose |
|------|---------|
| `setStorage(storage \| null)` | Injects the persistence backend. `null` disables it. Unset, it looks for `globalThis.localStorage` on first need. |
| `flushPersistence()` | Writes dirty persisted stores now instead of on the next turn. |
| `configureStore(name, { initialState?, persist?, storageKey? })` | See §6.5. |
| `reset({ clearState? })` | Drops every store, subscriber, open patch and pending timer in this layer. `clearState` also empties the backing Models. |

`reset()` without `clearState` leaves the state in the global `Model` registry, because
something else may still hold that Model. **Tests must use `reset({ clearState: true })`** or
one case's keys become the next one's starting conditions — this suite does it in `afterEach`.

### 3.7 What AGENT-005's action dispatcher needs

The spec's dispatcher calls `globalStoreManager.setKey(storeName, key, value)`. That exists
with exactly that signature. For a `DELETE_STORE_KEY` action use `deleteKey`; for a
multi-key action use `setState` (merge) or `batch` (several writes, one notification).

---

## 4. Node reference

All three: category `Data`, colour `data` (the UIX-005 token, not the spec's literal
`'purple'`).

### `net.noodl.GlobalStore` — "Global Store"

| Plug | Port | Type | Group |
|------|------|------|-------|
| in | `storeName` | string (default `'app'`) | Store |
| in | `initialState` | object (JSON text accepted) | Store |
| in | `persist` | boolean (default `false`) | Store |
| in | `storageKey` | string | Store |
| out | `state` | object | Data |
| out | `changedKeys` | string (comma-separated) | Data |
| out | `stateChanged` | signal | Events |
| out | `ready` | signal | Events |
| out | `error` | string | Events |
| out | `storeId` | string | Info |

`storeId` is the **Model id** (`--ndl--global-store--<name>`), so it can be pasted straight
into a Function node. `usePortAsLabel: 'storeName'`.

### `net.noodl.GlobalStore.Set` — "Set Global Store"

| Plug | Port | Type | Group |
|------|------|------|-------|
| in | `storeName` | string (default `'app'`) | Store |
| in | `key` | string | Update |
| in | `value` | `*` | Update |
| in | `merge` | boolean (default `false`) | Update |
| in | `transaction` | boolean (default `false`), displayed "Batch With Others" | Update |
| in | `set` | signal | Actions |
| out | `completed` | signal | Events |
| out | `error` | string | Events |

`usePortAsLabel: 'key'`.

### `net.noodl.GlobalStore.Subscribe` — "Subscribe to Store"

| Plug | Port | Type | Group |
|------|------|------|-------|
| in | `storeName` | string (default `'app'`) | Store |
| in | `keys` | string, comma-separated; blank = all | Subscribe |
| out | `value` | `*` | Data |
| out | `previousValue` | `*` | Data |
| out | `changedKeys` | string | Data |
| out | `changed` | signal | Events |

`value` projection: one watched key → that key's bare value; several → an object of just
those keys; none → the whole state. `usePortAsLabel: 'keys'`.

---

## 5. Subscription and teardown cases tested

75 specs in `packages/noodl-runtime/test/globalstore.test.ts`.

**No duplicate notifications** — one per write; a batch of three writes collapses to one
notification carrying all three keys; nested batches commit once; two `transaction: true` Set
nodes coalesce into one.

**No missed notifications** — writes straight to the backing Model notify; a batch whose body
throws still commits; a deferred batch closes on its own at end of turn as well as via
`flushBatches()`; setting an absent key to `undefined` notifies (the key now exists) even
though `Model` itself stays silent.

**No spurious notifications** — an unchanged value does not notify; a batch that ends where it
started does not notify; a key-filtered subscriber ignores other keys.

**Deterministic ordering** — subscribers fire in registration order; `changedKeys` is in write
order; a re-entrant write is queued and arrives after, at depth 1, with the value already
readable inside the first notification.

**No leaked subscribers** — unsubscribe stops delivery and is idempotent; a subscriber
unsubscribed mid-notification by an earlier one is skipped; a subscriber added
mid-notification does not get that notification; `subscriberCount` returns to 0 after
`_onNodeDeleted` on both the Global Store node and the Subscribe node; changing `storeName` or
`keys` moves the subscription rather than adding one (count stays 1, old store returns to 0);
after deletion, a store write produces no signal on the dead node.

**Errors surfaced, not swallowed** — a throwing subscriber is isolated and reported; a Set node
with no key reports `"Key is required"` on `error` and does not emit `completed`; the error
clears on the next successful write; missing storage, unparseable persisted state, bad
`initialState` JSON and an unserialisable value each raise a typed `StoreError`, and the
unserialisable case names the offending keys.

**Patches / snapshots** — see §3.4 and §3.5.

---

## 6. Deviations from the phase-3.5 spec, with reasoning

**6.1 Location and language.** Spec: `src/nodes/std-library/data/*.js`. Built:
`src/nodes/std-library/agent/*.ts`. `agent/` is the shared AIX-005 convention across all
three parallel agents; TypeScript because PLAT-003 typed this package and new runtime code is
expected to be typed.

**6.2 Backed by `Model` rather than a private `Map`.** §2. The spec's design would have been a
second state system; a January-2026 spec could not know that PLAT-003 would end up documenting
`Model` as the runtime's observable record, or that Variables are already exactly this pattern.

**6.3 `transaction` means "batch", not "do not notify".** The spec's `setKey(..., {transaction:
true})` skips the notification entirely, with nothing that ever delivers it — the change is
lost until something else happens to write. That is precisely the silent failure AIX-005 exists
to eliminate. Replaced with `deferNotifications`: notifications are held to the end of the
microtask and then delivered as one commit, so batching still works and nothing is dropped.
The node port keeps the name `transaction` (display name "Batch With Others") for continuity.

**6.4 `setState`'s `merge` flag split into two named calls.** A boolean whose `false` value
silently destroys the rest of the state is a footgun. `setState` merges; `replaceState`
replaces. AGENT-006's `setState(storeName, entry.state)` should become
`replaceState(...)` or, better, `restoreSnapshot(...)`.

**6.5 `initialState` fills gaps rather than seeding once.** The spec applies initial state only
when the store is first created. Built: `configureStore` applies `initialState` to keys the
store does **not already have**, on every call, and never overwrites a live value. The node
holding it can mount and unmount many times over an app's life, and defaults stomping live
values on remount is a bug nobody could see. A persisted copy is applied after the defaults
and wins over them — which is what every persistence library does and what the spec's
replace-the-whole-store load would have got wrong when combined with `initialState`.

**6.6 Persistence is behind an injected seam and is coalesced.** The spec calls `localStorage`
directly. The runtime also runs under Node (cloud functions, SSR, tests) where there is none.
`setStorage()` injects; unset, `globalThis.localStorage` is looked up lazily; absent, persistence
is a no-op **reported through `onError`** rather than silently skipped. Writes are coalesced to
the next turn so a token-by-token stream does not serialise the whole state per token
(`flushPersistence()` forces). The spec's `persistStore` also referenced `this.storeMeta`
before any constructor created it — it would have thrown on the first write.

**6.7 Bugs in the spec's node code, fixed.** The Set node had no `set` functions on
`storeName`/`key`/`value`/`merge`/`transaction`, so `this._internal.*` was never populated and
the node could not have worked. Its `merge` option was accepted and then ignored by `setKey`.
The Subscribe node's `previousValue` read `this._internal.value`, which nothing ever assigned.
All three are implemented properly here.

**6.8 Writes are deferred with `scheduleAfterInputsHaveUpdated`.** The spec writes straight from
the signal setter. In this runtime `key`, `value` and the `set` signal all arrive in one frame
in no guaranteed order, so that reads whichever landed first. Both the Set node and the two
subscribing nodes now defer their work to the end of the frame, the same pattern `Set Variable`
uses (`setvariablenode.ts:100`). This also makes attaching idempotent when several inputs arrive
together — one `ready`, one subscription.

**6.9 Ports added.** `changedKeys` on the Global Store and Subscribe nodes, and `error` on the
Global Store node. Both serve AIX-005's stated premise that behaviour must be legible as graph
outputs. `changedKeys` is a comma-separated **string**, not an `array` port — an `array` port in
Noodl means a Collection, and handing an author a comma-separated string feeds straight into
String Format and conditions.

**6.10 `storeId` outputs the Model id, not the store name.** The spec says "unique store
identifier" and returns the name. The Model id is genuinely unique and is directly usable from
a Function node; the name is already on the `storeName` input.

**6.11 Colour token, not a literal.** `color: 'data'` rather than `'purple'` / `'orange'` /
`'blue'`, per UIX-001/UIX-005. Wave 2 should do the same.

**6.12 No `docs` URL.** The spec points at `docs.noodl.net/nodes/data/global-store`, which does
not exist. Omitted rather than shipping a dead link. User docs were not written — see §7.

**6.13 Deferred from the spec's goal list:** computed/derived values, and middleware. Both are
listed there as "future enhancements" in one place and goals in another; neither is needed by
AGENT-004/005/006 and both are cheap to add later on top of `subscribe`.

---

## 7. Gaps and things not verified

- **Never run in the real editor or viewer.** Everything here is verified by the Node-environment
  Jest suite. The nodes have not been placed on a canvas, and the port groups, labels and
  inspector output have not been looked at by a human. That is the largest single gap.
- **No user-facing documentation.** The spec asks for `docs/nodes/data/global-store.md`. Not
  written; the `docs` port URL is omitted accordingly.
- **No example project.** AIX-005 step 7 wants an agent-chat example; that is umbrella-level work
  spanning all three parallel agents.
- **No key deletion from the graph.** The store has `deleteKey`, but no node port exposes it —
  the spec's three-node set has no delete and I kept the surface small. AGENT-005's dispatcher is
  the natural home for a `DELETE_STORE_KEY` action; a `delete` signal on the Set node would also
  be a one-line addition if an author asks for it.
- **Enriched catalog not regenerated.** `npm run catalog:check` is clean;
  `catalog:merge:check --require-coverage` was not run, so the three new types have no enrichment
  entries (SUB-005) yet.
- **Persistence tested only against an injected in-memory storage.** The real `localStorage`
  path, quota-exceeded behaviour and cross-reload survival are untested.
- **Performance untested.** The spec's checklist mentions 100+ subscribers, >1MB states and 100+
  updates/second. None of that was measured. The design should be fine — subscriber dispatch is a
  linear walk with a `Set` membership test, and snapshots are the only deep operation — but "should
  be fine" is not a measurement.
- **A store is process-global**, like `Model` itself. Two `NoodlRuntime` instances in one process
  (editor preview alongside something else) share stores. That matches how Variables already
  behave, so it is consistent rather than surprising, but it is worth knowing.
- **External direct-Model writes cannot report key absence.** A write made straight to the Model
  reports `old: undefined` for a brand-new key, and this layer cannot tell that from a key that
  held `undefined`. It only matters for a patch's rollback, and patches always write through
  `applyPatch`, which captures absence correctly.

---

## 8. Verification

- `npx tsc --noEmit` in `packages/noodl-runtime` — clean.
- `npx jest` in `packages/noodl-runtime` — **24 suites, 459 specs, all passing** (75 of them new).
- `npm run catalog:check` at the repo root — up to date, 140 node types.
- Prettier applied to all five new/changed files.
