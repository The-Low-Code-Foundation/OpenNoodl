# AGENT-005 — Action Dispatcher (as built)

Part of AIX-005 (Agentic UI Nodes). Implements
`dev-docs/tasks/phase-3.5-realtime-agentic-ui/AGENT-005-action-dispatcher-task.md`, reviewed
against current reality per AIX-005 step 1. Every departure from that spec is recorded in §7
with reasoning, and there are a lot of them, because the spec's design is a remote-control
hole and could not be implemented as written.

Built on AGENT-003's store (`globalstore.ts`, contract in `AGENT-003.md` §3) and consumed by
AGENT-001/002's transports. No transport is opened here; the node takes whatever a stream
node already delivered.

---

## 1. What was built

| File | What it is |
|------|------------|
| `packages/noodl-runtime/src/nodes/std-library/agent/action-dispatcher.ts` | `ActionRegistry` (the allow-list) + `ActionDispatcher` (one queue per node) + the built-in vocabulary. Not a node. |
| `packages/noodl-runtime/src/nodes/std-library/agent/actiondispatchernode.ts` | `net.noodl.ActionDispatcher` |
| `packages/noodl-runtime/src/nodes/std-library/agent/actionhandlernode.ts` | `net.noodl.ActionHandler` |
| `packages/noodl-runtime/test/action-dispatcher.test.ts` | 72 specs |
| `docs/node-catalog/enrichment/net.noodl.actiondispatcher.json` | SUB-005 entry |
| `docs/node-catalog/enrichment/net.noodl.actionhandler.json` | SUB-005 entry |
| `docs/node-catalog/examples/agent-server-driven-actions.json` | validated example graph, demonstrates both nodes |

Registered in **both** places: two lines appended to the array in
`packages/noodl-runtime/noodl-runtime.js`, and a new `Agent Actions` subcategory under
*Read & Write Data* in `packages/noodl-runtime/src/nodelibraryexport.js` (without the second,
a node generates as `inNodePicker: false` and is unreachable — the defect AGENT-003 shipped).

Zero new dependencies. `packages/noodl-runtime/package.json` untouched. No DOM, no `window`,
no `fetch`: all of it is framework-neutral runtime code and **nothing had to cross into
`noodl-viewer-react`** (see §2).

---

## 2. The central decision: the vocabulary is closed, and rendering is not our business

The spec ships a dispatcher with an always-on built-in vocabulary that includes `FETCH`
(arbitrary HTTP to a server-supplied URL, from the browser, with the user's cookies),
`TRIGGER_SIGNAL` (dispatch any `window` CustomEvent by name), `SHOW_TOAST`,
`HIGHLIGHT_ELEMENT`, `SCROLL_TO`, `NAVIGATE` and `NAVIGATE_BACK`. Anything that can get a
message into the dispatcher can do all of those. That is remote code execution by
configuration, and it is the *default* rather than an opt-in.

What was built instead, in one sentence: **a dispatcher can execute exactly two things — a
built-in the app author enabled by name, and an action type an `Action Handler` node in the
graph registered — and everything else is refused with a reason on a graph output.**

Two consequences worth stating:

- **The registry *is* the permission list.** There is no second table of allowed actions to
  keep in step with the graph. If the wire is not on the canvas, the server cannot cause it.
  Built-in names are reserved unconditionally, so whether a name is a built-in never depends
  on the order two nodes happened to initialise in.
- **The view-layer actions were not implemented at all, and did not need to be.** Every one
  of them is an `Action Handler` wired to the node that already does that job — `trigger` →
  `Navigate`, `trigger` → a Group's `scrollToElement.do`, and so on. This is both safer (the
  capability is a visible wire) and the reason nothing had to be written in
  `noodl-viewer-react`.

### What an action can and cannot reach — stated plainly

**Can reach:**

1. The four built-in store actions — `SET_STORE`, `MERGE_STORE`, `DELETE_STORE_KEY`,
   `CLEAR_STORE` — **only** when the author listed that exact name in the dispatcher's
   `builtIns` input, which is **empty by default**. They write only the store named on the
   dispatcher node (a `storeName` inside the incoming action is ignored), and only keys the
   dispatcher's `allowedKeys` permits (blank = any key of that store). `CLEAR_STORE` is
   refused outright whenever `allowedKeys` is non-empty, since clearing would remove the keys
   the allow-list exists to protect.
2. Whatever the author wired downstream of an `Action Handler`'s `trigger`. This is
   open-ended by design and **includes navigation**: a handler wired to a `Navigate` node
   means a remote server can navigate the app, and a handler wired to a delete means a remote
   server can delete. That is a real capability with a real risk. It is granted one action
   type at a time, visibly, by the app author — not implicitly by this node.

**Cannot reach, at all:**

- The network. There is no `FETCH` built-in and no way to add one from a message.
- The DOM, `window`, `document`, custom DOM events, `eval`, or any function named in a
  message. The runtime module imports nothing but the store.
- Any store other than the one configured on the dispatcher node.
- Any action type that is not registered or is a disabled built-in — including one whose
  handler was unregistered or whose `enabled` input is false.
- The queue's own configuration. Nothing in a message changes the rate limit, the queue
  bound, the allow-list, the timeouts or the channel.

**Residual risk that is inherent rather than a defect:** a hostile or looping server can
still (a) flood the queue — bounded by `maxQueueSize`, default 100, and `rateLimit`, default
off; (b) cause any action the author *did* register, as often as it likes; (c) stall a flow
for `waitForHandler` ms per unhandled action by sending types nothing handles. All three are
visible on outputs (`queueSize`, `refusedCount`, `waitingFor`) and all three are bounded by
inputs the author controls. Authorisation *of the sender* is not attempted here and should
not be: the transport carries the auth, and a token in the app is not a secret.

---

## 3. The two nodes

Both: category `Data`, colour `data` (the UIX-005 token, not the spec's literal `'purple'`).

### `net.noodl.ActionDispatcher` — "Action Dispatcher"

`usePortAsLabel: 'channel'`.

| Plug | Port | Type | Group | Default |
|------|------|------|-------|---------|
| in | `channel` | string | Dispatcher | `'default'` |
| in | `action` | `*` (object, array, or JSON text) | Action | — |
| in | `builtIns` | string, comma-separated | Built-in Actions | `''` (none) |
| in | `storeName` | string | Built-in Actions | `'app'` |
| in | `allowedKeys` | string, comma-separated | Built-in Actions | `''` (any) |
| in | `handlerTimeout` | number ms, 0 = never | Delivery | `30000` |
| in | `waitForHandler` | number ms, 0 = refuse at once | Delivery | `2000` |
| in | `maxQueueSize` | number, 0 = unbounded | Delivery | `100` |
| in | `rateLimit` | number, 0 = off | Delivery | `0` |
| in | `rateLimitWindow` | number ms | Delivery | `60000` |
| in | `dispatch` | signal | Actions | — |
| in | `cancel` | signal | Actions | — |
| out | `actionType` | string | Data | |
| out | `actionId` | string | Data | |
| out | `payload` | `*` | Data | |
| out | `result` | `*` | Data | |
| out | `dispatched` | signal | Events | |
| out | `completed` | signal | Events | |
| out | `failed` | signal | Events | |
| out | `idle` | signal | Events | |
| out | `cancelled` | signal | Events | |
| out | `refused` | signal | Refusals | |
| out | `refusedType` | string | Refusals | |
| out | `refusalReason` | string | Refusals | |
| out | `refusalMessage` | string | Refusals | |
| out | `lastError` | string | Status | |
| out | `queueSize` | number | Status | |
| out | `isExecuting` | boolean | Status | |
| out | `waitingFor` | string | Status | |
| out | `completedCount` | number | Status | |
| out | `failedCount` | number | Status | |
| out | `refusedCount` | number | Status | |
| out | `cancelledCount` | number | Status | |

12 inputs, 21 outputs; both sets pinned by an assertion in the suite.

### `net.noodl.ActionHandler` — "Action Handler"

`usePortAsLabel: 'actionType'`.

| Plug | Port | Type | Group | Default |
|------|------|------|-------|---------|
| in | `channel` | string | Handler | `'default'` |
| in | `actionType` | string | Handler | `''` |
| in | `enabled` | boolean | Handler | `true` |
| in | `autoComplete` | boolean | Completion | `true` |
| in | `result` | `*` | Completion | — |
| in | `errorMessage` | string | Completion | `''` |
| in | `complete` | signal | Actions | — |
| in | `fail` | signal | Actions | — |
| out | `trigger` | signal | Events | |
| out | `payload` | `*` | Data | |
| out | `actionId` | string | Data | |
| out | `registered` | boolean | Status | |
| out | `triggeredCount` | number | Status | |
| out | `error` | string | Status | |

8 inputs, 6 outputs.

### The action envelope

```jsonc
{ "type": "OPEN_SESSION",      // required, non-empty string; the whole allow-list check
  "id": "srv-42",              // optional; else a generated id, for acking back
  "payload": { … } }           // optional
```

`payload` output = the action's `payload` if that **key is present**, else its `data` if
present, else the whole action object (so `{type, sessionId}` hands over an object carrying
`sessionId`). Presence, not truthiness — see §7.4.

An **array** of actions is admitted as an ordered batch. A **string** is parsed as JSON
first, so a stream's `raw` output works as well as its parsed `data`.

### The refusal vocabulary

| `refusalReason` | Means |
|---|---|
| `invalid` | Unparseable, not an object, no `type`, or a built-in missing a field it needs. |
| `unknown` | Well-formed, but nothing in this graph handles it (after the wait window). |
| `not-allowed` | Recognised but unauthorised: a disabled built-in, a key outside `allowedKeys`, `CLEAR_STORE` under an allow-list. |
| `rate-limited` | Over `rateLimit` in the window. Refused, not delayed. |
| `queue-full` | Over `maxQueueSize`. The **newest** is refused so accepted actions keep their order. |

Every one of these fires `refused` with `refusedType` / `refusalReason` /
`refusalMessage` set **before** the signal, and none of them fires `dispatched` — a refused
action is never announced as having started.

---

## 4. Ordering, late arrivals, and disposal — the three questions the brief asked

**Ordering.** One queue per dispatcher **node** (deliberately not per channel: two
dispatchers sharing a channel share the registry but keep separate queues, so there is never
a question of whose outputs report an action's fate). Actions execute strictly one at a time
in arrival order. Several handlers registered for one type run sequentially in registration
order and the action completes when the last one does.

The dispatch signal acts **immediately**, not through `scheduleAfterInputsHaveUpdated` — the
one place this family's house style is deliberately broken, see §7.2.

**Actions arriving before their target exists.** The head of the queue *parks* for up to
`waitForHandler` ms (default 2000) waiting for a matching registration, rather than being
refused on a mount race that an author would only see intermittently. While parked,
`waitingFor` names the type. If a handler registers, the action runs at once; if the window
expires, it is refused as `unknown` and the queue moves on. Because ordering is a promise the
dispatcher makes, **everything behind a parked action waits too** — that is the trade, it is
bounded, and it is visible. `waitForHandler: 0` opts out.

**Disposal.** Three cases, each tested:

- *Dispatcher node deleted* — queued actions are **discarded, not executed**: the outputs
  that would have reported them are going away, and running UI actions into a component the
  user has navigated away from is worse than dropping them. Nothing is emitted (there is
  nothing left to emit to); what matters is that no timer and no registry listener survives,
  which is asserted with `jest.getTimerCount()`.
- *Handler node deleted mid-action* — that action **fails** with "was removed before it
  completed", so the queue behind it is not stalled for the full `handlerTimeout`.
- *`cancel` signal, node still alive* — the observable version: the queue is dropped, the
  count appears on `cancelledCount`, `cancelled` fires, and the dispatcher stays usable. A
  late completion from the abandoned handler is ignored.

---

## 5. Failure paths tested

72 specs in `packages/noodl-runtime/test/action-dispatcher.test.ts`.

**Refusals — reported *and* not executed.** Unregistered type; disabled built-in
(distinguished from `unknown`); key outside `allowedKeys` for both `SET_STORE` and
`DELETE_STORE_KEY`; `CLEAR_STORE` under an allow-list; a store name the message tried to
choose being ignored; a handler trying to claim a reserved built-in name; a wrong channel.
Each asserts the store was not touched, not merely that something was logged.

**Malformed input** (table-driven): `undefined`, `null`, whitespace, unparseable JSON, a bare
number, no `type`, non-string `type`, empty array — plus a built-in missing its required
field. A bad member of an array is refused on its own and the good members still run.

**Ordering.** Five rapid dispatches in order; an array as an ordered flow; an async handler
blocking the next action; several handlers in registration order with one completion; and a
stack-depth check proving a hundred synchronous actions do not recurse.

**Late arrival.** Parked then handled; parked then expired; the queue behind a parked action
held; `waitForHandler: 0` refusing at once; and the same three through the real nodes.

**Bounds.** `queue-full` refusing the newest; the rate-limit window sliding; unbounded at 0.

**Failure.** Handler timeout (queue continues, no timer left); `handlerTimeout: 0` leaving no
timer; a handler that throws; an explicit `fail`; later handlers not running after a failure;
a store write that throws surfacing as `failed` rather than `refused`; a double completion
ignored; and a **throwing output hook not stopping the queue**.

**Disposal.** All three cases in §4, with `jest.getTimerCount()` at 0 and the registry back
to 0 handlers.

**Node-level.** Port-set assertions for both nodes; the real store written through the
dispatcher node; refusal outputs; a misspelt built-in name reported on `lastError`; two
actions in one frame **not** coalescing; `autoComplete: false` gating the next step; `complete`
with nothing in flight reported.

`npx jest` in `packages/noodl-runtime`: **31 suites, 768 specs, all passing** (696 baseline
+ 72 new). `npx tsc --noEmit`: clean. Prettier applied.

---

## 6. Catalog

- `npm run catalog:generate` → 148 node types, both new types present with
  `inNodePicker: true`.
- `npm run catalog:merge` → clean (145/148 documented, 46 examples).
- `npm run catalog:examples` → 46/46 validate clean in strict mode, including the new
  `agent-server-driven-actions` graph.
- `npm run catalog:check` → committed catalog up to date.
- `npm run catalog:merge:check --require-coverage` still fails, on AGENT-003's three
  `net.noodl.GlobalStore*` types having no enrichment entry. Pre-existing and owned there.

### One pre-existing breakage this work exposed, and what was done about it

The committed structural catalog listed two node types — `net.noodl.user.RequestMagicLink`
and `net.noodl.user.SignInWith` — that **exist nowhere in the source tree** (no file in the
repo mentions either name outside the catalog artifacts and their own enrichment entries).
They were already absent from source at `663cd2c`; the catalog had simply never been
regenerated without them. A truthful `catalog:generate` therefore drops them, which turned
their two enrichment files into dangling entries and made `catalog:merge` fail with
"typeName … is not in the structural catalog".

**Resolution: the two orphan enrichment files were deleted** —
`docs/node-catalog/enrichment/net.noodl.user.requestmagiclink.json` and
`net.noodl.user.signinwith.json`. They document nodes that do not exist, and leaving them
would have left `catalog:merge` failing for everyone. If those nodes are meant to come back,
restore both files from `git show HEAD~1:<path>` alongside the node sources. Flagging it
because it is a deletion outside this task's territory, made to keep a gate green rather than
because AGENT-005 needed it.

---

## 7. Deviations from the phase-3.5 spec, with reasoning

**7.1 The built-in vocabulary was cut from ~11 actions to 4, and made opt-in.** §2. The spec's
`FETCH`, `TRIGGER_SIGNAL`, `SHOW_TOAST`, `HIGHLIGHT_ELEMENT`, `SCROLL_TO`, `OPEN_VIEW`,
`NAVIGATE`, `NAVIGATE_BACK`, `SET_VARIABLE` and `CUSTOM` are all gone. `FETCH` because a
client fetching a server-chosen URL with ambient credentials is a CSRF/exfiltration
primitive, not a UI action. `TRIGGER_SIGNAL` because "dispatch the `window` event named in
this message" is an open vocabulary wearing a closed one's clothes. The rest because they are
view-layer work that an `Action Handler` expresses better — and expressing them as handlers is
what kept every line of this in the framework-neutral runtime. `SET_VARIABLE` is
`SET_STORE` against the store AGENT-003 built; `CUSTOM` with a `handler` name field is the
open-vocabulary hole in its purest form and is replaced by registration. Kept and added:
`SET_STORE`, plus `MERGE_STORE` (the spec's multi-key case), `DELETE_STORE_KEY` and
`CLEAR_STORE` — the first of which closes the gap AGENT-003 recorded (`deleteKey` existed
with no node exposing it).

**7.2 The `dispatch` signal is not deferred with `scheduleAfterInputsHaveUpdated`.** Every
other node in this family defers, and for good reason. Here it would be a bug: a stream can
deliver several messages in one frame, and a coalesced schedule would run the *last* action
and silently drop the rest — precisely the ordering failure this node exists to prevent. It
is safe to act on the signal because `flagOutputDirty` queues a value onto the connected
input *before* `sendSignalOnOutput` fires, so this pulse's action has already landed. Text
Accumulator's `add` makes the same choice for the same reason. Registration on the *handler*
node **is** deferred, since `channel`/`actionType`/`enabled` arrive as separate writes.

**7.3 The queue belongs to the dispatcher node, not to a global singleton.** The spec's
`actionDispatcherManager` holds one process-wide queue, so two dispatcher nodes interleave
into it and `queueSize` / `isExecuting` on either node describe the other's work as much as
their own. Only the *registry* needs to be global (a handler in one component must be
findable from another with nothing but a name in common); the queue does not, and per-node
queues make the outputs mean something. A `channel` input scopes the registry, the same way
`storeName` scopes a store.

**7.4 Bugs in the spec's sample code, fixed.**

- `builtInHandlers` is declared as a **class field after the methods that use it**. With
  `dispatch` being called on an instance this is survivable, but `this.builtInHandlers` is
  consulted for *every* action type, so an unrecognised type silently ran no built-in, fell
  through to "no custom handlers either", and returned `{ completed: true }` — **an unknown
  action reported success**. That is the single worst behaviour in the spec and is why
  refusal is a first-class outcome here.
- `processQueue()` is called from `dispatch()` *after* `this.isExecuting = false`, and calls
  `dispatch(action, { queueWhenBusy: true })`, which re-enters and recurses one frame per
  queued action. A hundred-step flow is a hundred nested `await`s deep, and any queued action
  that itself queues never terminates cleanly. Replaced with a flat pump loop guarded against
  re-entrancy (there is a stack-depth test).
- `dispatch()` sets `isExecuting = true` *before* pushing to history and *never* resets it on
  the queued path, so the first queued action leaves the manager permanently "executing".
- `this.actionHistory[this.actionHistory.length - 1]` is used to find the entry to update, but
  a handler that dispatches re-entrantly appends a newer entry first, so the wrong entry gets
  the result. History is not kept in this implementation at all — see 7.7.
- `payload` resolution is `action.data || action`, which mistakes a falsy payload (`0`, `''`,
  `false`, `null`) for an absent one and hands the handler the whole envelope instead.
  Presence is tested here, not truthiness (there is a test).
- The `timeout` input is declared, plumbed into `dispatch(action, { timeout })` — and then
  never read by anything. Implemented properly as `handlerTimeout`, per handler, with the
  action failing and the queue continuing.
- The Register Handler node's `complete` input is documented in the spec's port table as an
  **output** ("Signal back to dispatcher when done") and implemented as an input. It is an
  input here, and `trigger`'s completion protocol is documented rather than implied.
- `RegisterActionHandlerNode` puts `_onNodeDeleted` inside `methods`, where the runtime never
  calls it as a lifecycle hook — the handler would have outlived its node. Both nodes here
  override `_onNodeDeleted` properly and call `Node.prototype._onNodeDeleted` first
  (`packages/noodl-runtime/src/node.ts:698`).
- Its `actionType` setter unregisters and then calls `registerHandler()`, which unregisters
  *again* — harmless only because the unregister closure happens to be idempotent-ish.
- `registerHandler`'s unregister closure indexes `this.handlers.get(actionType)` without
  checking for `undefined`; after the list is emptied and deleted, a second call throws.

**7.5 Registration is automatic, and there is no `register` signal.** The spec has both a
`register` signal and registration-on-`actionType`-set. A signal-gated allow-list means an
action arriving before the author remembered to wire the pulse is refused, and the refusal
looks like a server bug rather than a missing wire. Replaced by deferred automatic
registration plus an `enabled` boolean for deliberately turning a handler off — which
unregisters, so the action is *refused visibly* rather than quietly ignored.

**7.6 `autoComplete` defaults to true.** The spec's handler resolves its promise only when the
`complete` signal arrives, so an author who does not wire it stalls the whole queue for the
timeout with no indication why. Default here: the action is complete once `trigger` has been
sent and everything wired to it has run synchronously — which is what most handlers want, and
preserves *dispatch* ordering regardless. Set `autoComplete: false` for a step a later step
must wait for.

**7.7 No action history, and no `getHistory`.** The spec lists action history as a goal. It is
a second, weaker copy of what AGENT-006 is building for the store, and an unbounded array
that grows for the life of the app is exactly the leak the spec's own performance checklist
warns about. `completedCount` / `failedCount` / `refusedCount` / `lastError` /
`refusalMessage` are on outputs, which is what an author debugging a graph actually needs;
`getInspectInfo` shows the last action and the last refusal.

**7.8 Rate limiting is per dispatcher node, not per user.** The spec's `rateLimiter.check(userId)`
has no user to check on the client. A sliding window per dispatcher, default off, with excess
**refused rather than delayed** — delaying would silently reorder a flow relative to the
server's intent.

**7.9 No `docs` URL.** The spec points at `docs.noodl.net/nodes/events/action-dispatcher`,
which does not exist. Omitted rather than shipping a dead link. The enrichment entries carry
the documentation instead.

**7.10 Category `Data`, not `Events`; colour token, not `'purple'`.** Consistent with the rest
of the `agent/` family and with UIX-001/UIX-005. The picker subcategory is `Agent Actions`
under *Read & Write Data*, next to `Streaming` and `App State`.

**7.11 "Sandboxing" is not claimed.** The spec's security section says "custom handlers run in
a controlled context — they can't access arbitrary code." Nothing here sandboxes anything: a
handler runs whatever the author wired, with full graph privileges. The safety property is
different and, I think, stronger — the *set* of things a server can trigger is closed and
visible — and §2 states it in those terms rather than implying an isolation boundary that does
not exist.

---

## 8. Gaps and things not verified

- **Never run in the real editor or viewer.** Everything here is verified by the
  Node-environment Jest suite. Neither node has been placed on a canvas; the port groups,
  labels, tooltips and inspector output have not been looked at by a human, and the example
  graph has been validated by the SUB-006 validator but never opened. Largest single gap, and
  the same one AGENT-001/003 recorded.
- **Never driven by a real backend.** No live stream has ever sent an action into this. The
  SSE→dispatcher wiring is asserted only as far as "the ports line up and the catalog example
  validates".
- **No user-facing documentation.** The spec asks for `docs/nodes/events/action-dispatcher.md`.
  Not written; the enrichment entries are the documentation.
- **`waitForHandler`'s parked-action listener is bound to the channel that was current when it
  parked.** Changing the dispatcher's `channel` while an action is parked leaves it waiting on
  the old channel until the window expires. Not tested, judged not worth code — but it is a
  real (if silly) edge.
- **A parked action is invoked synchronously from inside `registry.register`**, i.e. from
  within the handler node's own `scheduleAfterInputsHaveUpdated` callback. That is
  deterministic and tested, but it does mean a handler's `trigger` can fire during its own
  registration frame. No problem was found; it has not been exercised in a real graph.
- **Only the head of the queue can park.** By design (ordering), but it means one unhandled
  type stalls a flow for up to `waitForHandler` ms. Visible on `waitingFor`; the alternative
  (skipping ahead) would break the ordering guarantee.
- **Performance unmeasured.** The 100-action stack-depth test says the loop is flat, and 200
  queued actions are exercised, but throughput, a very long-lived dispatcher, and many
  handlers on one type were not profiled.
- **The registry is process-global**, like `Model` and the store. Two `NoodlRuntime`
  instances in one process share handlers. Consistent with how stores and Variables already
  behave, but worth knowing.
- **No integration with AGENT-004/006.** Optimistic updates and state history were being
  built in parallel; nothing here reaches into their nodes, and no combined test exists. A
  `ROLLBACK` or `UNDO` built-in would be the natural join and was deliberately not invented.
- **Rate limiting uses `Date.now()` via an injectable `nowImpl`**, defaulting to the real
  clock. Verified only under jest fake timers.
