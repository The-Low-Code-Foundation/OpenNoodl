# AGENT-006 — State History & Time Travel (as built)

Part of AIX-005 (Agentic UI Nodes). Implements
`dev-docs/tasks/phase-3.5-realtime-agentic-ui/AGENT-006-state-history-task.md`, reviewed
against current reality per AIX-005 step 1. Every departure from that spec is in §7.

**This is wave 2**, built on AGENT-003's store. It codes against the §3 contract in
`AGENT-003.md` and does not reach around it, with one recorded exception (§3.4 below).

Its own spec marks it **LOW priority / nice-to-have, 1–2 days**. It was kept to that: a
bounded, honest, tested undo/redo with time travel and named checkpoints. No debugging UI,
no branching history, no history persistence.

---

## 1. What was built

| File | What it is |
|------|------------|
| `packages/noodl-runtime/src/nodes/std-library/agent/statehistory.ts` | `StateHistoryManager`. Not a node. |
| `packages/noodl-runtime/src/nodes/std-library/agent/statehistorynode.ts` | `net.noodl.StateHistory` |
| `packages/noodl-runtime/src/nodes/std-library/agent/undonode.ts` | `net.noodl.StateHistory.Undo` |
| `packages/noodl-runtime/src/nodes/std-library/agent/statesnapshotnode.ts` | `net.noodl.StateSnapshot` |
| `packages/noodl-runtime/test/statehistory.test.ts` | 84 specs |

Registered as three lines appended to the array in `packages/noodl-runtime/noodl-runtime.js`.
Catalog regenerated: 143 node types (140 + 3), `catalog:check` clean.

Zero new dependencies. `packages/noodl-runtime/package.json` untouched.

---

## 2. The central decision: no second copy of the truth

A history entry **is** an AGENT-003 `StoreSnapshot`. Capture is `globalStoreManager.getSnapshot`;
restore is `globalStoreManager.restoreSnapshot` (full-store case) or ordinary store writes
inside one `globalStoreManager.batch` (key-filtered case). There is no parallel snapshot
mechanism, no second notification path, and no state owned here that the store does not
already own.

The consequence worth stating: **an undo is an ordinary store commit.** Every `Subscribe to
Store` node, every `Global Store` node and every AGENT-004 patch sees it exactly as it sees
any other write. Nothing has to know that time travel exists.

### The invariant everything rests on

**`entries[currentIndex]` always describes the live state.** Recording appends and advances;
undo/redo/jump write the target entry back; resuming after a pause records a fresh entry if
the state drifted; trimming never drops the entry `currentIndex` points at. Every one of those
is a spec in the suite.

### This is not AGENT-004's rollback, and was not unified with it

A patch rollback removes one in-flight optimistic change; an undo walks the whole store back
to an earlier point. They are different mechanisms over the same store and are left that way,
as instructed. The interaction, stated so nobody is surprised: **a patch apply and a patch
rollback each look like an ordinary commit from here, so each records its own history entry.**
An author combining optimistic updates with undo will see both in the timeline. Not verified
against the real AGENT-004 nodes — they were being written in a parallel worktree.

---

## 3. The four things that are easy to get subtly wrong

### 3.1 History bounds — an unbounded history is a leak

`maxHistory` (default **50**, as the spec says) bounds the entry count. Each entry pins a deep
copy of the store, so this is a real memory bound and not a tidiness setting.

Trimming drops **oldest first, and never the entry `currentIndex` points at**. If the bound is
still exceeded after that — only possible when the author *lowers* `maxHistory` while sitting
on an undo, so the current entry is the oldest — the **redo tail** is dropped instead. Losing a
future is recoverable; losing the present breaks the invariant.

The spec's `recordStateChange` only increments `currentIndex` in the *else* branch of its
overflow check. That happens to come out right when you are at the end of the history and
wrong otherwise. Replaced with `currentIndex = entries.length - 1` after trimming, which is
correct by construction rather than by accident.

`maxHistory` is clamped to a floor of **2**: a history of one entry cannot undo anything, so a
smaller value is a mistake rather than a request. Lowering the bound trims immediately rather
than waiting for the next write.

### 3.2 The redo stack — a new write discards it

`push` truncates `entries` to `currentIndex + 1` before appending. Those futures no longer
follow from the present, and keeping them reachable would let "redo" jump to a state that
never existed on the current branch. Tested both ways: discarded by a new write, preserved
across an undo→redo with nothing in between.

### 3.3 Re-entrant restore — the non-termination bug

A restore that recorded itself would make every undo push a new undoable entry, and undo would
never terminate. Restores run under a per-history `restoring` flag and the recorder returns
early.

Two details that matter:

- The flag is cleared in a **`finally`**. A throwing store subscriber must not leave the
  recorder muted for the rest of the app's life. Tested.
- The flag also covers **writes other subscribers make during the restore notification**.
  AGENT-003 queues a re-entrant write's notification and drains the queue inside the *same
  synchronous* `notify()` call, which is still inside `restoreSnapshot`, which is still inside
  the flag's scope. Tested with a mirroring subscriber. (If AGENT-003 ever made that delivery
  asynchronous, this guarantee would break — flagging it because it is a load-bearing
  assumption about somebody else's code.)

There is a `terminates: undoing repeatedly reaches the start and stops` spec with a runaway
guard, because that is the failure this whole section exists to prevent.

### 3.4 Coalescing — one undo step per intent, not per keystroke

`coalesceMs` (default **0**, off). When set, a change **to the same key set** arriving within
that many milliseconds of the entry on top folds into it instead of pushing a new one. Typing
into a field is then one undo step.

- **No timer is started.** It is a timestamp comparison at record time, so there is nothing to
  leak, nothing to flush and no open handle in tests.
- The window **slides** (the absorbed entry's timestamp is updated), so a continuous burst
  stays one step — the behaviour every text editor has.
- Three guards, each with a spec:
  - never coalesce into the **initial / cleared** baseline entry, or undo could not reach the
    start;
  - never coalesce when `currentIndex` is not at the end (mid-time-travel);
  - never coalesce into **the entry an undo just landed on** (a `coalesceBarrier` flag set by
    every navigation). Without this, typing immediately after an undo would absorb into — and
    silently destroy — the state you had just undone to.
- Key-set equality is required, so a write to a *different* key always starts a new step.

The clock is injectable (`setClock`) and defaults to `Date.now`. Both routes are tested: the
injected clock for the fine-grained cases, and Jest fake timers against the real `Date.now`
default for one end-to-end case.

---

## 4. How the by-reference limitation reaches the app author

AGENT-003 keeps Models, Collections, class instances, functions and anything reached through a
cycle **by reference** in a snapshot, and lists their top-level keys in `snapshot.byReference`.
Undoing such a key puts the *same live object* back, so mutations made to it since the snapshot
are not undone. This feature cannot fix that, so it says so, in four places:

1. **`fullyRestorable` (boolean) and `byReferenceKeys` (string) on all three nodes.** On State
   History they describe the whole history (the union across every entry, deduplicated and
   sorted); on Undo/Redo they describe **the restore that just happened**; on State Snapshot
   they describe the snapshot the node is holding. `fullyRestorable` exists next to the string
   because a graph branching on "was that complete?" should not have to compare against `""`.
2. **Per-entry, in the `history` output.** Each entry carries `partial: boolean` and
   `byReference: string`, so a timeline UI can mark the entries that will not fully restore.
3. **In the node inspector.** `getInspectInfo` on State History prints, in words: *"Undo cannot
   fully restore these keys — they hold live objects (Collection, Model, function) that a
   snapshot can only keep by reference: …"*. The Snapshot node prints the equivalent.
4. **In the port tooltips** for the inputs that lead there.

There is a spec (`puts the same live object back rather than a dead copy`) that asserts the
cost directly: after an undo, the key still holds the *same* `Collection` instance, and
`Collection.instanceOf` still says yes. That is the honest behaviour — the alternative,
snapshotting it into a dead plain array, is the exact bug AGENT-003's `constructor === Array`
test exists to prevent, and it would be far worse.

---

## 5. Node reference

All three: category `Data`, colour `data` (the UIX-005 token, per AGENT-003 §6.11).

### `net.noodl.StateHistory` — "State History"

| Plug | Port | Type | Group |
|------|------|------|-------|
| in | `storeName` | string (default `'app'`) | Store |
| in | `trackKeys` | string, comma-separated; blank = whole store | Config |
| in | `maxHistory` | number (default `50`, floor 2) | Config |
| in | `coalesceMs` | number (default `0` = off) | Config |
| in | `enabled` | boolean (default `true`) | Config |
| in | `clearHistory` | signal | Actions |
| out | `historySize` | number | Status |
| out | `currentIndex` | number | Status |
| out | `canUndo` | boolean | Status |
| out | `canRedo` | boolean | Status |
| out | `fullyRestorable` | boolean | Status |
| out | `byReferenceKeys` | string | Status |
| out | `history` | array | Data |
| out | `historyChanged` | signal | Events |

`usePortAsLabel: 'storeName'`. Two of these on one store **share** one history and one store
subscription (reference counted), so deleting one does not wipe the other's undo stack.

### `net.noodl.StateHistory.Undo` — "Undo / Redo"

| Plug | Port | Type | Group |
|------|------|------|-------|
| in | `storeName` | string (default `'app'`) | Store |
| in | `targetIndex` | number (default `0`) | Jump |
| in | `undo` | signal | Actions |
| in | `redo` | signal | Actions |
| in | `jumpTo` | signal | Actions |
| out | `undone` | signal | Events |
| out | `redone` | signal | Events |
| out | `jumped` | signal | Events |
| out | `fullyRestorable` | boolean | Status |
| out | `byReferenceKeys` | string | Status |
| out | `error` | string | Events |

`usePortAsLabel: 'storeName'`. Owns nothing; drives the history a State History node created,
found by store name.

**Undo at the beginning and redo at the end are no-ops, not errors** — nothing fires, and
`canUndo`/`canRedo` are how a graph asks in advance. `error` is reserved for the two genuine
author mistakes: a `targetIndex` outside the history, and driving a store **nothing is
tracking** (which would otherwise be a button that looks wired and silently does nothing).

### `net.noodl.StateSnapshot` — "State Snapshot"

| Plug | Port | Type | Group |
|------|------|------|-------|
| in | `storeName` | string (default `'app'`) | Store |
| in | `snapshotName` | string | Snapshot |
| in | `snapshotData` | object | Snapshot |
| in | `save` | signal | Actions |
| in | `restore` | signal | Actions |
| out | `snapshot` | object | Data |
| out | `fullyRestorable` | boolean | Status |
| out | `byReferenceKeys` | string | Status |
| out | `saved` | signal | Events |
| out | `restored` | signal | Events |
| out | `error` | string | Events |

`usePortAsLabel: 'snapshotName'`. `snapshotData`, when wired, wins over `snapshotName` — that
is the import path.

**Saving a checkpoint does not touch the undo stack; restoring one is an ordinary write and is
therefore itself undoable.** That asymmetry is deliberate: restoring the wrong checkpoint is
precisely the mistake undo exists for. Tested.

---

## 6. Manager API (for anyone building on this)

```ts
import { stateHistoryManager } from '.../agent/statehistory';

attach(storeName, options, onChanged): Unsubscribe   // refcounted; last one out frees the entries
configure(storeName, options): void
setEnabled(storeName, enabled): void
undo(storeName) / redo(storeName): HistoryNavigation | null
jumpTo(storeName, index): HistoryNavigation | null
clearHistory(storeName): void
isTracking(storeName): boolean
getHistoryInfo(storeName): HistoryInfo | null

saveNamedSnapshot(name, storeName): StoreSnapshot
restoreNamedSnapshot(name, { storeName? }?): StoreSnapshot   // throws if unknown
restoreSnapshotData(data, { storeName? }?): StoreSnapshot    // accepts a JSON string too
getNamedSnapshot(name) / getSnapshotNames() / deleteNamedSnapshot(name)

setClock(fn | null)   // test seam, defaults to Date.now
reset()               // tests must call this alongside globalStoreManager.reset()
```

`HistoryNavigation` is `{ index, canUndo, canRedo, byReferenceKeys }`. `null` from
`undo`/`redo`/`jumpTo` means "nowhere to go" or "not tracked" — the caller decides which of
those is worth reporting, and the Undo node reports only the second.

---

## 7. Deviations from the phase-3.5 spec, with reasoning

**7.1 Location and language.** Spec: `src/nodes/std-library/data/*.js`. Built:
`src/nodes/std-library/agent/*.ts`, matching AGENT-003 and the shared AIX-005 convention.

**7.2 Entries are AGENT-003 `StoreSnapshot`s, not `JSON.parse(JSON.stringify(state))`.** The
spec deep-clones through JSON in five places. That silently destroys everything JSON cannot
represent — a `Date` becomes a string, a `Collection` becomes a plain array, a Model becomes
its own guts, a function vanishes, and a cyclic state **throws**. `getSnapshot` handles all of
those correctly and, crucially, *tells you* which keys it could not copy. Using it is both more
correct and the only way §4 could exist at all.

**7.3 Restore uses `restoreSnapshot`, not `setState`.** The spec restores with
`globalStoreManager.setState(storeName, entry.state)`. In the built store that **merges**
(AGENT-003 §6.4), so undoing a change that *added* a key would leave the key behind — the
single most visible undo bug there is. `restoreSnapshot` is a full replace. Tested
(`deletes keys an undo should not have`).

**7.4 One store extension, disclosed.** `cloneStoreValue` is now exported from
`globalstore.ts` — a two-line wrapper around the existing private `cloneValue`, additive, no
behaviour change (AGENT-003's 75 specs still pass unchanged). It is needed by the key-filtered
restore path, which writes individual keys and so cannot rely on `restoreSnapshot`'s copy-in;
without it the history would hand the application its own entry objects to mutate, and the past
would change under you. Tested (`hands out a copy, so the app cannot mutate the past`). This is
the only change made to anything AGENT-003 owns.

**7.5 `trackKeys` restores only the tracked keys.** The spec filters the *subscription* by
`trackKeys` but restores the whole state, so a history of one key would revert every other key
in the store on undo. Built: with `trackKeys` set, entries hold a snapshot projected to those
keys (`byReference` projected with it), and restore writes exactly those keys — deleting the
ones the entry did not have — inside one `batch`, so the store still emits a single
notification. Untracked keys are never touched, and never suffer an identity change.

**7.6 Changing `trackKeys` clears the history.** Its existing entries were projected to the old
key set and restoring one would write the wrong shape. Keeping them would be worse than
starting again.

**7.7 `enabled: false` pauses; it does not delete.** The spec's `stopTracking` throws the whole
history away. An author toggling a checkbox labelled "Enabled" next to an explicit "Clear
History" action did not ask for that. Pausing keeps the entries, and **resuming records a fresh
entry if the state drifted while paused** — otherwise `entries[currentIndex]` would no longer
describe live state and the next undo would restore something that never immediately preceded
it.

**7.8 Tracking is reference counted.** The spec's `trackStore` early-returns if already
tracking and its `stopTracking` deletes unconditionally, so with two State History nodes on one
store, deleting either would wipe the other's history. Built: `attach` counts, and the record
(and its snapshots) is released by the last detach.

**7.9 `history` outputs entry *descriptors*, not states.** Each is
`{ index, timestamp, description, changedKeys, isCurrent, partial, byReference }` — the shape
the spec's own `getHistoryInfo` returns, and what a Repeater-driven timeline actually needs.
Putting whole states on a graph port would be a memory and serialisation hazard for no benefit.
`changedKeys` and `byReference` are comma-separated strings for the reason AGENT-003 gives in
its §6.9. The port type is `array` and the value is a plain JS array, which the Repeater
accepts (`foreach.tsx` documents `items` as "may be a plain array").

**7.10 `stateChanged` renamed `historyChanged`.** On a *history* node, "state changed" is
ambiguous — this fires when the history changes, which includes navigating without any state
change. `Subscribe to Store` is the node for state changes.

**7.11 `net.noodl.StateHistory.Undo` displays as "Undo / Redo".** The spec's display name
"Undo" understates a node that also redoes and jumps, and reads badly in a picker.

**7.12 The Snapshot node reports errors instead of throwing.** The spec's `restoreSnapshot`
throws on an unknown name. Thrown from inside a signal handler in this runtime that takes the
frame down over a mistyped checkpoint name. Reported on `error` instead — the same line
AGENT-003 took with its Set node's missing key.

**7.13 `error` output added to the Undo node; `targetIndex` no longer silently ignored.** The
spec's `jumpTo` returns `null` for an out-of-range index and nothing tells the author. Per
AIX-005's legibility premise, that and "nothing is tracking this store" are reported.

**7.14 All node actions are deferred with `scheduleAfterInputsHaveUpdated`.** As AGENT-003 §6.8
found: `targetIndex` and the `jumpTo` signal arrive in one frame in no guaranteed order, so
acting from the signal setter would jump to whatever index was left over. The same applies to
`snapshotName` / `snapshotData` / `save` / `restore`, and to the History node's five
configuration inputs (which attach **once** per frame rather than five times).

**7.15 Colour token, not the spec's literal `'blue'`.** Per UIX-001/UIX-005 and AGENT-003 §6.11.

**7.16 No `docs` URL.** `docs.noodl.net/nodes/data/state-history` does not exist. Omitted rather
than shipping a dead link.

**7.17 `exportHistory` / `importHistory` not built.** The spec sketches both on the manager but
declares no ports for either, and its `importHistory` restores state from an entry without
touching the subscription it just tore down. The two cases an author actually has are covered
without them: the `history` output *is* the export of the timeline, and the Snapshot node's
`snapshot` output → `snapshotData` input round-trips a state through JSON (tested). Importing a
whole foreign timeline is a debugging feature with real hazards and no port, and this task is
LOW priority — cut deliberately.

**7.18 Deferred from the spec's "future enhancements":** diff viewer, branching history,
selective undo, history persistence, collaborative undo. None was in scope.

---

## 8. Verification

- `npx tsc --noEmit` in `packages/noodl-runtime` — **clean**.
- `npx jest` in `packages/noodl-runtime` — **25 suites, 543 specs, all passing** (84 new;
  459 → 543).
- **AGENT-003's 75 store specs pass unchanged** (`npx jest test/globalstore.test.ts` →
  75 passed), which is the regression check that matters given §7.4.
- `npm run catalog:check` at the repo root — up to date, **143 node types**.
- Prettier applied to every new and changed file.

### What the 84 specs cover

Recording (per-commit, batched, no-op writes, key naming) · undo/redo walking and key deletion ·
end-stops · notification count (one per restore) · **re-entrancy** (no self-record, termination
with a runaway guard, subscriber-write during restore, throwing subscriber) · **redo stack**
(discarded by a write, preserved across undo→redo) · **bounds** (drop oldest, keep the current
entry, trim on lowering, drop the redo tail mid-travel, clamp, the 50 default) · **coalescing**
(off by default, folding, lapsing, different keys, never the baseline, never after a
navigation, real `Date.now` via fake timers) · jump/scrub · clear/pause/resume incl. the drift
case · `trackKeys` (filtered recording, filtered restore, copy-on-restore, clear on change) ·
**by-reference** (Collection, Model, function, complete-when-plain, same-object-back, union
across history, projection) · sharing and teardown (shared subscription, refcount, idempotent
detach, store isolation) · named snapshots (save/restore, repeat restore, undo interaction,
errors, cross-store, JSON round trip, validation, listing) · and all three nodes end to end.

---

## 9. Gaps and things not verified

- **Never run in the real editor or viewer.** Everything is verified by the Node-environment
  Jest suite. No node here has been placed on a canvas, and the port groups, labels, inspector
  output and the `array`-typed `history` port driving a real Repeater have not been looked at
  by a human. Same gap AGENT-003 declares, and it is the largest one.
- **`inNodePicker` is `false`** for all three, exactly as for AGENT-003's three. That is
  inherited from how these runtime-only definitions register, not something introduced here,
  but it means an author cannot currently find any of the six agent nodes in the picker. Worth
  someone owning across the whole AIX-005 set.
- **No user-facing documentation.** The spec asks for `docs/nodes/data/state-history.md`. Not
  written; the `docs` port URL is omitted accordingly.
- **No enrichment entries.** `catalog:check` is clean; `catalog:merge:check --require-coverage`
  was not run, so the three new types have no SUB-005 enrichment.
- **Interaction with AGENT-004 and AGENT-005 is reasoned about, not tested.** Both were being
  written in parallel worktrees. §2 states what I believe happens (a patch apply/rollback each
  record an entry); nobody has run the two together.
- **Performance unmeasured.** The spec's checklist mentions large states and rapid changes.
  Each entry is a deep copy, so a 1 MB state with `maxHistory: 50` is ~50 MB — bounded and
  predictable, but the deep copy per commit is the cost, and it has not been profiled.
  `trackKeys` is the mitigation and is also unprofiled.
- **The re-entrancy guarantee in §3.3 depends on AGENT-003 delivering queued notifications
  synchronously.** True today and tested today; it would break silently if that changed.
- **`sameState` (used only to decide whether resuming needs an entry) compares with `===` then
  `JSON.stringify`.** That is good enough for its one job and deliberately cheap, but it would
  report "drifted" for two structurally equal objects with different key order.
- **A history is process-global**, like the store and like `Model`. Two `NoodlRuntime`
  instances in one process share it. Consistent with AGENT-003, worth knowing.

---

## 10. A parallel-worktree trap worth recording

Mid-task, `npx tsc --noEmit` in `packages/noodl-runtime` started failing with four errors in
`src/node.ts` / `src/nodedefinition.ts` — files nothing in this task touches. Cause: **an agent
worktree has no `node_modules` of its own, so `@noodl/types` resolves up the directory tree
into the *main checkout's* `packages/noodl-types`**, which a parallel agent had just edited
(`src/runtime/node-definition.d.ts`, `NodeContextLike` vs `RuntimeNodeContext`). A worktree's
type-check is therefore not hermetic: it silently grades your code against somebody else's
uncommitted work.

Fixed locally by symlinking `<worktree>/node_modules/@noodl/types → ../../packages/noodl-types`
(and `@noodl/runtime` likewise); `tsc` is clean again, and both runs above were made with that
in place. The symlink is under `node_modules` and so is gitignored — **any future worktree will
need it created again.**

Two consequences for whoever reads this next:

1. All verification in §8 is against this worktree's own `noodl-types` (cline-dev tip at
   `a77e32a`).
2. Whatever change is sitting in the main checkout's `node-definition.d.ts` currently makes
   `packages/noodl-runtime` fail to type-check *as a whole*, independent of this task. If that
   change is heading for `cline-dev`, it needs fixing there — it is not something this branch
   introduced or can fix.
