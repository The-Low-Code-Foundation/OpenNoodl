# AGENT-004 — Optimistic Update (as built)

Part of AIX-005 (Agentic UI Nodes). Implements
`dev-docs/tasks/phase-3.5-realtime-agentic-ui/AGENT-004-optimistic-updates-task.md`, reviewed
against current reality per AIX-005 step 1. Every departure from that spec is recorded in §6
with reasoning.

**Wave 2, built on AGENT-003.** The store's patch primitives (`AGENT-003.md` §3.5) are used
as the contract says; **the store was not modified**, and its 75 specs still pass unchanged.

---

## 1. What was built

| File | What it is |
|------|------------|
| `packages/noodl-runtime/src/nodes/std-library/agent/optimisticupdatenode.ts` | `net.noodl.OptimisticUpdate` |
| `packages/noodl-runtime/test/optimisticupdate.test.ts` | 39 specs |

One line appended to the array in `packages/noodl-runtime/noodl-runtime.js`. Catalog
regenerated (`npm run catalog:generate`); 141 node types, `catalog:check` clean.

Zero new dependencies. `packages/noodl-runtime/package.json` untouched. No second module: the
spec's `optimisticmanager.js` is not here, and §6.2 says why.

---

## 2. The central decision: the store already is the transaction manager

The spec's `OptimisticUpdateManager` keeps `previousValue` per transaction and, on failure,
writes it back with `setKey`. That is a second rollback mechanism standing beside the one
AGENT-003 built, and it is wrong in three ways that only show up in the cases optimistic
updates exist for:

1. **A key the update introduced.** `setKey(key, previousValue)` where `previousValue` was
   `undefined` leaves the key *present*, holding `undefined`. The store tracks absence as its
   own state and deletes it. (Tested: *"deletes a key the update introduced rather than
   leaving it holding undefined"*.)
2. **Two updates open on one key.** Rolling the older one back with a plain write clobbers the
   newer one's optimistic value. The store's newest-open-writer rule handles it: the live value
   does not move, and the older value is handed to the newer patch so *its* rollback lands
   correctly. (Tested: *"keeps two nodes updating one key from clobbering each other on
   rollback"*, both orders.)
3. **Notification shape.** `applyPatch` and `rollbackPatch` are one commit each, so a
   subscriber sees one `stateChanged`, not two.

So this node calls `applyPatch` / `commitPatch` / `rollbackPatch` / `getOpenPatches` and owns
only the three things the store deliberately does not:

- **the timer** — AGENT-003 §3.5 leaves auto-rollback to the node on purpose, and this is the
  seam it left; one `setTimeout` per open update, cleared on every exit path including
  disposal;
- **which patch a bare `commit`/`rollback` signal means** (§4.2);
- **whether rolling back is still the right thing to do** (§3).

Nothing in the store needed extending. `getOpenPatches` returning handles with `keys` on them
is what makes §3 possible without reaching into the store's internals.

---

## 3. The rollback that races a newer write

A rollback restores what the key held *before the update*. That is only correct while nothing
else has touched the key in the meantime — and in the applications this node is for, something
else touching the key is the normal case, not the exotic one: a realtime push lands, a sibling
component writes, the user acts again.

There are two distinct races, and only one of them is the store's problem.

**A newer open patch on the same key.** The store solves this itself (§2.2). The node must
*not* interfere, so `isSuperseded` returns `false` whenever `getOpenPatches` shows a
later-applied open patch touching the key, and the store's ordering rule takes over.

**A plain write to the same key.** The store cannot see this coming — a plain write is not a
patch, and it has no way to know the write was meant to win. So the node checks: if the key no
longer holds the value this update applied (by identity, the same test the store's own change
detection uses), the update is **superseded**. Its patch is closed with `commitPatch` — closed,
not restored — the newer value stands, and `error` says so:

> `Server said no. The value changed after the update was applied, so it was left as it is.`

The transaction still resolves as **rolled back**: `rolledBack` fires, `isRolledBack` goes
true. The request really did fail and the author's failure branch must still run; what changed
is that the *value* was left alone. This is what Apollo and React Query both do with a stale
rollback, and the alternative — quietly reverting on top of somebody else's write — destroys
data invisibly, which is the exact failure AIX-005 exists to prevent.

Deleting the key counts as supersession too. Writing the identical value back does not: the
value the update put there is still there, so a normal rollback happens.

The same rule applies to a timeout and to disposal, not just to the `rollback` signal.

---

## 4. Node reference

### `net.noodl.OptimisticUpdate` — "Optimistic Update"

Category `Data`, colour `data` (the UIX-005 token, not the spec's literal `'orange'`).
`usePortAsLabel: 'key'`.

#### Inputs

| Port | Type | Group | Notes |
|------|------|-------|-------|
| `storeName` | string, default `'app'` | Store | Blank normalises to `app`, as in AGENT-003 |
| `key` | string | Store | Required; a blank one is reported on `error` |
| `optimisticValue` | `*` | Update | |
| `errorMessage` | string | Update | Reason reported on `error` when this update rolls back. Wire the server's error here |
| `transactionId` | string | Transaction | Blank = generate on apply, resolve the oldest on commit/rollback |
| `timeout` | number, default `30000` | Config | `0` or negative disables the deadline |
| `onDispose` | enum `rollback` \| `commit`, default `rollback`, shown "When Removed" | Config | §5 |
| `apply` | signal | Actions | |
| `commit` | signal | Actions | |
| `rollback` | signal | Actions | |

#### Outputs

| Port | Type | Group | Notes |
|------|------|-------|-------|
| `value` | `*` | Data | The **live** store key, not a remembered copy — see §4.3 |
| `previousValue` | `*` | Data | What the key held before the most recent apply; `undefined` if it had none |
| `isPending` | boolean | Status | At least one update open on this node |
| `pendingCount` | number | Status | How many |
| `isCommitted` | boolean | Status | The most recent resolution succeeded |
| `isRolledBack` | boolean | Status | The most recent resolution failed |
| `transactionId` | string | Info | Id of the most recent apply. Carry it through the request |
| `applied` | signal | Events | |
| `committed` | signal | Events | |
| `rolledBack` | signal | Events | Fires for a timeout too |
| `timedOut` | signal | Events | After `rolledBack`, as the spec has it |
| `error` | string | Events | |

`transactionId` is deliberately both an input and an output — the output is what `applied`
hands you, the input is what you hand back. Verified to register as two distinct ports.

### 4.1 Everything is deferred to the end of the frame

`apply`, `commit` and `rollback` all go through `scheduleAfterInputsHaveUpdated`, the same
pattern as `Set Global Store` and for the same reason: `key`, `optimisticValue`,
`transactionId` and the signal arrive in one frame in no guaranteed order, so acting from the
signal setter reads whichever landed first. It matters more here than on the Set node —
applying with a stale `transactionId` opens a patch the response can never resolve. Tested by
setting the signal *first* and the data after.

Two pulses of the same signal in one frame collapse to one action, as on the Set node.

### 4.2 Which update a bare signal resolves

An explicit `transactionId` wins; that is how out-of-order responses are handled — carry the
id from `applied` through the request and hand it back. With no id, the **oldest** open update
resolves: first in, first answered, which is what a queue of requests against one endpoint
actually does, and with one update in flight (the common case) oldest and newest are the same
thing. An id naming nothing open is reported on `error` and resolves nothing.

### 4.3 `value` is live

The node subscribes to its one key, so `value` reflects writes made by anything — which is
exactly the situation in which the update is *not* safe to undo. The subscription moves when
`storeName` or `key` changes (asserted: the count on the old store returns to zero) and is
released in `_onNodeDeleted`.

---

## 5. Disposal with an update still open

An update in flight when the node dies cannot be resolved by the graph any more — the node
that would have received `commit` is gone. Leaving the patch open leaks it, and its timer, into
a store that outlives the component. So it is resolved at disposal, and **which way is a real
judgement call**, which is why `onDispose` exists rather than a silent policy:

- **`rollback` (default).** An optimistic value that nothing can ever confirm has no business
  outliving the thing that showed it, and the store is shared — other components are reading
  it.
- **`commit`.** Right for fire-and-forget actions the user navigates away from on purpose
  (send a message, then leave the screen): the request is probably going to succeed, and the
  value shown was the user's intent.

Either way the §3 supersede check still applies, timers are cleared, the subscription is
released, and **no signals are sent** — there is nobody left to hear them, and firing on a
dead node is how phantom graph activity happens. All five of those are asserted, including
`jest.getTimerCount() === 0` after disposal.

---

## 6. Deviations from the phase-3.5 spec, with reasoning

**6.1 Location, language, colour.** Spec: `src/nodes/std-library/data/*.js`, `color: 'orange'`.
Built: `src/nodes/std-library/agent/optimisticupdatenode.ts`, `color: 'data'`. Same reasoning as
AGENT-003 §6.1 and §6.11 — the shared AIX-005 convention, PLAT-003's typing, UIX-001/005 tokens.

**6.2 No `OptimisticUpdateManager`.** §2. The spec's manager is a parallel rollback mechanism
with three defects the store's patches do not have. What remains genuinely per-node —
the timer, the optimistic value, the store/key captured at apply time — lives in `_internal`,
because it is per-node. Consequence, stated as a non-feature: **one node cannot commit an
update another node applied.** Nothing in the spec's examples needs it, and supporting it would
mean giving up the supersede check (the second node does not know what value the first
applied). A `transactionId` naming an update this node did not apply is reported on `error`.

**6.3 Several updates in flight, not one.** The spec's node keeps a single
`this._internal.transactionId` and overwrites it on the second apply — orphaning the first,
whose timer then fires and rolls back over the second. That directly contradicts its own goals
5 ("queue multiple optimistic updates") and 6 ("handle race conditions, out-of-order
responses"), which are not satisfiable with one slot. Built with a list, plus a `pendingCount`
output so a queue is legible rather than merely functional.

**6.4 The `variableName` input is dropped.** The spec offers three targets: a store key, a
Variable, or node-internal. Variables are a *different* `Model` (`--ndl--global-variables`,
`noodl-viewer-react/src/nodes/std-library/data/variablenode2.ts`), and the store's patch
primitives are store-only, so supporting them would mean either building the parallel rollback
mechanism §2 exists to avoid, or extending `GlobalStoreManager` to adopt an arbitrary Model id.
Neither is worth it for a node whose whole point is shared state: `storeName` defaults to
`'app'`, so the minimum configuration is one string in `key`.
**If Variable support is wanted later, the clean route is a store extension** —
`configureStore(name, { modelId })` — not a second rollback path. Flagging it because
**AGENT-006 plausibly wants the same thing** (time travel over Variables, not just stores);
that is a shared store change and should be decided once, not twice.

**6.5 Node-internal-only mode is dropped too.** Same reasoning: without a target there is
nothing to roll back but an output, which is a second mechanism for no gain. A key is required
and its absence is reported on `error`, the way `Set Global Store` reports a missing key.

**6.6 A superseded rollback keeps the newer value.** §3. The spec restores unconditionally.
This is the single biggest behavioural deviation and the one most likely to matter in a real
app.

**6.7 `console.warn` replaced by the `error` output, everywhere.** The spec warns to the console
on commit-without-apply, rollback-without-apply and unknown transaction. AIX-005's premise is
that an app builder who cannot step through code must be able to see what happened, so all
three land on `error` and emit no signal. Same line AGENT-003 held on its `transaction` flag.

**6.8 Ports added.** `pendingCount` (§6.3), `errorMessage` (the spec has no way to attach the
server's reason to a rollback, so `error` could only ever have been generic), `onDispose` (§5),
and `transactionId` as an *output* (the spec has it only as an input, so a generated id could
never leave the node and out-of-order handling was unreachable).

**6.9 `timeout: 0` disables the deadline.** The spec's `if (transaction.timeout > 0)` implies it
but nothing documents it, and `0` reaching `options.timeout || 30000` would have become 30 s
anyway. Made explicit, documented in the tooltip, tested.

**6.10 Signals are deferred (`scheduleAfterInputsHaveUpdated`).** §4.1. Same deviation, and same
reasoning, as AGENT-003 §6.8.

**6.11 No `docs` URL.** `docs.noodl.net/nodes/data/optimistic-update` does not exist. Omitted
rather than shipping a dead link. See §8 on the user docs the spec asks for.

**6.12 Deferred from the spec's "future enhancements":** retry logic, conflict resolution, an
offline queue, animation hooks, batch commits. None is needed by the pattern; `error` +
`rolledBack` is enough for an author to wire their own retry today.

**Bugs in the spec's sample code, not reproduced** (AGENT-003 found three of its own):
`doApply` sets `this._internal.currentValue` but `value`'s getter is the only reader and
`isCommitted`/`isRolledBack`/`error` are never initialised, so all three read `undefined`
rather than `false` until the first resolution; `_onNodeDeleted` is declared inside `methods`
without chaining `Node.prototype._onNodeDeleted`, which in this runtime leaks the node's model
listeners; and `doRollback` re-detects a timeout by string-matching `'Request timed out'`
against the error text, so any author passing that exact string as a server error would get a
spurious `timedOut` signal.

---

## 7. What was tested

39 specs in `packages/noodl-runtime/test/optimisticupdate.test.ts`. Jest fake timers throughout;
`store.reset({ clearState: true })` runs *before* `jest.clearAllTimers()` in `afterEach`, on
purpose — a node that failed to clear a timer would otherwise be hidden by the teardown.

The four failure paths the task named:

- **Timeout** — fires at the deadline and not before (4999 ms / 5000 ms), defaults to 30 s,
  `rolledBack` then `timedOut`, `error` is `'Request timed out'`, patch closed; does not fire
  after a commit; a commit *after* it becomes a reported no-op rather than a second resolution;
  each in-flight update gets its own independent deadline; `0` disables it for ten minutes of
  simulated time.
- **Server rejection** — value restored, `errorMessage` surfaced verbatim, a generic reason when
  none is wired, absence restored as absence, patch closed.
- **A rollback racing a newer write** — a plain write supersedes (value kept, reason explains
  it, `rolledBack` still fires); a deletion supersedes; an identical re-write does *not*; a
  newer open patch does *not* (the store's rule takes over, and both orders land correctly);
  the same rule on the timeout path.
- **Disposal with an open patch** — rolls back by default, keeps the value under
  `onDispose: 'commit'`, cancels the deadline (`getTimerCount() === 0`), resolves *every* open
  update rather than the first, releases the subscription (`subscriberCount` back to 0), sends
  no signals, and does not undo a value that moved on while the node was dying.

Plus: apply/commit/rollback happy paths and every status output; inputs arriving after the
signal in the same frame; a missing key; a duplicate transaction id; oldest-first resolution;
out-of-order resolution by id; an unknown id; error clearing; a named store; the `value` output
following external writes and moving its subscription; subscribing once for several inputs in
one frame; end-to-end against a `Global Store` node (one `stateChanged` per commit, correct
`changedKeys`); and 50 apply/commit cycles leaving no open patches, no timers and one
subscriber.

**A trap for whoever writes the next node test.** `Node.update` allows 100 passes per
`context.updateIteration` before it declares a cyclic loop and stops updating the node
*permanently*. A test that calls `node.update()` in a loop without advancing
`context.updateIteration` silently stops working partway through and fails for a reason that
has nothing to do with the node — this cost real time here. The `tick()` helper in the suite
bumps the iteration, the way a real frame does.

---

## 8. Gaps and things not verified

- **Never run in the real editor or viewer.** Everything is verified by the Node-environment
  Jest suite. The node has not been placed on a canvas; the port groups, the enum's labels and
  the inspector text have not been looked at by a human. Same gap AGENT-003 has, and still the
  largest one.
- **The node is not in the editor's add-node picker, and neither are AGENT-003's.** The curated
  index is `coreNodes` in `packages/noodl-runtime/src/nodelibraryexport.js:404`; all four
  `agent/` types are absent from it, which is why the catalog records
  `inNodePicker: false` for every one of them. **An author therefore cannot place any of these
  nodes from the picker.** Not fixed here on purpose: it wants one new subcategory covering the
  whole AIX-005 family, which is an umbrella-level edit that three parallel agents would
  conflict on. It should be done once, after the wave merges.
- **No user-facing documentation.** The spec asks for `docs/nodes/data/optimistic-update.md`.
  Not written; the `docs` port URL is omitted accordingly.
- **Enriched catalog not regenerated.** `npm run catalog:check` is clean;
  `catalog:merge:check --require-coverage` was not run, so the new type has no SUB-005
  enrichment entry.
- **No example project.** AIX-005 step 7 is umbrella-level work across all the wave's agents.
- **Supersede detection is by identity.** An equal-but-distinct object written over the
  optimistic value reads as supersession. That matches the store's own change detection and errs
  towards *not* destroying a write, which is the safe direction, but an author mutating an
  object in place and writing it back would see the opposite (no supersession detected, because
  the reference is unchanged) — mutating store values in place is already unsupported, but it
  will bite differently here.
- **Timers are the platform `setTimeout`, not an injected seam.** The task brief allows it and
  fake timers cover it, so there is nothing to override in tests; but a runtime that wanted a
  frame-driven deadline (`context.timerScheduler`) would have to change this node.
- **Never run against a real network.** Every "server" in the suite is a signal pulse. Retry,
  reconnection and offline behaviour are untested because they are unbuilt (§6.12).
- **Performance unmeasured.** 50 sequential cycles pass; nothing was measured at scale, and a
  list of 200 rows each holding one of these nodes means 200 store subscriptions. That should
  be fine — the store's dispatch is a linear walk with a `Set` test — but it is not a
  measurement.

---

## 9. Verification

- `npx tsc --noEmit` in `packages/noodl-runtime` — clean.
- `npx jest` in `packages/noodl-runtime` — **25 suites, 498 specs, all passing** (39 new;
  459 before).
- AGENT-003's `test/globalstore.test.ts` — **75 of 75 still passing**, and the store file is
  unmodified (`git status` shows no change to `globalstore.ts`).
- `npm run catalog:check` at the repo root — up to date, 141 node types.
- Prettier applied to both new files.

**A trap, if you are verifying this from a parallel worktree.** This worktree has no
`node_modules` of its own, so `@noodl/types` resolves *upwards* to the main checkout's hoisted
symlink — meaning `tsc` compiles the runtime against whatever `packages/noodl-types` looks like
in the **main checkout**, not in the worktree. Mid-task that copy gained a required
`NodeContextLike.updateDirtyNodes`, and `tsc` started failing in `src/node.ts` and
`src/nodedefinition.ts` — files nothing here touches. Confirmed pre-existing by moving both new
files out and re-running (same errors), and resolved for verification with a worktree-local
`node_modules/@noodl/types -> ../../packages/noodl-types` symlink, after which `tsc --noEmit` is
clean. Worth knowing before someone attributes those errors to a node.
