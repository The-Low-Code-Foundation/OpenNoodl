# NDA-012 Data — Worker A notes (the AIX-005 agent family, 15 nodes)

Branch `wt-nda012a`. Territory: `packages/noodl-runtime/src/nodes/std-library/agent/**` and
`packages/noodl-runtime/test/corpus/nda-012-data-agent-family.test.ts`.

**Nothing had ever read these fifteen.** They carry the two largest port counts in the category
(`WebSocket` 36, `Server-Sent Events` 34) and they are the only nodes in Data that own a socket, a
reconnect policy or a timer.

The worksheet rows in §4 are in `audit/data.md`'s format and are the orchestrator's to merge. **I did
not touch `audit/data.md`, `PROGRESS.md`, `FINDINGS.md`, `NODE-REGISTER.md` or the catalog.**

---

## 1. Stale premises

### 1.1 The worksheet's `B1` pre-fill cannot see this category's actual failure gap ⚠️

`scripts/node-audit/worksheets.js:55` derives `hasFailure` by matching `/fail|error/i` against output
**names**:

```js
hasFailure: outs.some((p) => /fail|error/i.test(p.name) || /fail|error/i.test(p.displayName || '')),
```

A **string** output called `Error` satisfies it. The Failure Contract's requirement is a *signal* —
something an author can sequence off. Four of my fifteen ended a signal input on a string `Error` and
nothing else, and **all four are pre-filled `✅ has one`**: `Set Global Store`, `Optimistic Update`,
`Action Handler`, `Text Accumulator`. So are `Global Store` and `Subscribe to Store`, which have no
action input at all and read `n/a` on the other axis.

This is not local to my territory. **Any category audited from that column alone under-reports B1**,
and the phase has now audited fifteen of seventeen. Worth a re-derivation: the honest predicate is
"an output of `type: 'signal'` whose name matches `/fail|error/i`", and it is a two-line change.

### 1.2 "It declares a `default`, therefore it behaves as configured" is false in this runtime ⚠️

This is the batch's headline stale premise and it is **not in FINDINGS at all**. `registerInput`
writes a declared `default` straight into `_inputValues` and never calls the setter
(`node.ts:116-118`), and `NodeScope.setNodeParameters` queues only the keys the *model* carries
(`nodescope.ts:148-157`). An author who accepts a default writes no parameter, so **no setter runs**.

Three of my nodes did their entire job from a setter's side effect and every one of their inputs had
a usable default. They were therefore **inert until something was authored** — see D1. It is
invisible from the canvas: the property panel shows `app`, and `Global Store`'s `State` output reads
correctly on its first evaluation because its getter goes straight to the manager. Only the
*reactions* were missing.

⚠️ **This generalises well past my fifteen.** The predicate is "a node whose real work is a setter
side effect *and* whose ports all carry defaults". A grep for `nodeScopeDidInitialize` across the two
runtime packages returns nine call sites, all in `noodl-viewer-react`; nothing in `noodl-runtime`'s
own std-library used the hook before this change. That is worth a sweep of its own and it is bigger
than a per-node pass should decide.

### 1.3 The brief's SR-vi framing was pointed at the wrong layer

The brief says *"`sse-connection.ts` and `websocket-connection.ts` are shared helpers"* and warns
about a timer leak in them. **They are not shared** — `sse-connection.ts` is used by exactly one node
and `websocket-connection.ts` by exactly one other, and the two have no code in common. Both
`dispose()` implementations are correct: the reconnect timer, the heartbeat timer and the socket all
go, and `WebSocketConnection.dispose` even counts the abandoned queue into `droppedCount`. **H1 on
the two socket nodes is the best work in the category**, and I pinned it with rows rather than
finding anything.

The SR-vi *shape* did land here — but one layer up, at `sse.ts` vs `websocket.ts`, and it is a
reconnect policy rather than a timer. See D2. The lesson survives; the file names did not.

### 1.4 "H1 is your highest-yield check" was half right

H1 produced **one filing and no fixes**. The yield came from A1 (4 sites) and B1 (5 sites). Worth
recording because the brief's prediction was specific and testable, and it was wrong in a way that is
explained by 1.3: this family was written with teardown in mind and without the reactivity contract
in mind.

### 1.5 A count that does not resolve

`audit/data.md`'s header says **41 nodes**; FINDINGS' Record-family section says **Data is 41 in the
catalog, 37 in scope**. My fifteen are in both. Flagging it only so the orchestrator's arithmetic
starts from the right denominator.

---

## 2. Deviations, with reasoning

1. **I edited three test files outside my declared exclusive one**:
   `packages/noodl-runtime/test/optimisticupdate.test.ts`, `test/agent-stream-nodes.test.ts`,
   `test/action-dispatcher.test.ts`. All three are the existing suites for **my own** nodes and no
   other worker owns them. Six assertions in `optimisticupdate.test.ts` read
   `expect(signals).toEqual([])` on exactly the paths D4 is about — **they pinned the defect** — and
   two "declares the documented ports" lists needed the new `failure` port. Each edit carries a
   comment naming NDA-012.

2. **I ran `npx prettier --write` over the agent directory.** It reformatted two files I had not
   otherwise touched (`sse-connection.ts`, `websocket-connection.ts`) because the repo's prettier
   version disagrees with whatever last formatted them — pre-existing drift, nothing to do with this
   pass. Both reverted with `git checkout --`; the final diff touches only files I changed on
   purpose.

3. **`State Snapshot`'s H1 leak is filed, not fixed** (L1), and the corpus row **pins today's
   behaviour** rather than asserting the fix. Releasing a named snapshot on unmount would break the
   documented cross-component use ("save here, restore there"), which is a design decision.

4. **No live editor.** The batch allows one editor at a time and every claim here was reachable
   headlessly through the corpus harness, which stands up a real `NodeContext` and `NodeScope` from
   imported editor data. See §3 for what that does *not* cover.

5. **No enrichment files** under `docs/node-catalog/enrichment/`. The C1 work went into `description`
   fields, which is where the catalog, the validator and the AI loop read from; enrichment would be a
   second copy of the same sentences.

---

## 3. Could not verify

- **No real server was involved.** The SSE row asserts on *which URL was requested* through an
  injected `fetchImpl` that never resolves. Nothing here was driven against a live SSE or WebSocket
  endpoint, so the transports themselves are as unverified as they were before this pass.
- **The `nodeScopeDidInitialize` fix is not live-verified in the editor.** In particular I did **not**
  read the *variant* path: `NodeScope.setNodeParameters` branches to `node.setVariant(variant)`
  (`nodescope.ts:131-133`) and applies parameters differently there. My rows only exercise the
  non-variant branch.
- **SSR behaviour of the D1 fix is unconfirmed.** `SSE` and `WebSocket` are `client-only` and
  `nodedefinition.ts:221-222` noops `nodeScopeDidInitialize` for inert nodes, so they are unaffected.
  But the three store nodes are `safe`, so `Global Store` will now configure and fire `Ready` during
  a server render where before it did nothing. I believe that is correct — the store is plain
  client-neutral state and `persist` already reports "no storage available" under Node — but I did
  not run an SSR render.
- **The catalog is not regenerated** (orchestrator owns it). The 271 new `description`s and the four
  new `failure` ports are **invisible to every measurement** until it is: `NODE-REGISTER.md` will
  keep reporting the old C1 percentages, and the semantic validator and AI loop will not see the new
  sentences. This is the single thing most worth doing after the merge.
- **`Action Dispatcher`'s vocabulary, queue and rate limiter were read, not driven by me.**
  `test/action-dispatcher.test.ts` covers them (156 passing tests) and I leaned on it rather than
  re-deriving. My rows for that node touch only the failure and lifecycle surfaces.
- **No live QA of the new `Failure` ports in the property panel / on the canvas.**
- **`WebSocket`'s heartbeat dead-connection detection** is covered by the existing suite with a fake
  clock; I did not add to it and did not observe a real half-open TCP connection.

---

## 4. Worksheet rows

Format matches `audit/data.md`. Sources are all under
`packages/noodl-runtime/src/nodes/std-library/agent/`.

---

### Action Dispatcher  `net.noodl.ActionDispatcher`

12 inputs / 21 outputs · 2 signal in / 6 signal out · docs 27% → **100%** · SSR `safe` · browser, cloud · **no docs URL**

Source: `actiondispatchernode.ts`, over `action-dispatcher.ts` (the queue, the registry, the closed
vocabulary) · Docs: **none**

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | Every option object is read live on use, not copied at construction (`action-dispatcher.ts:256-260`), so a rate limit or allow-list edited mid-stream takes effect on the next action. |
| A2 |  | n/a | Nothing is cached to re-read; `Dispatch` is the only trigger. |
| A3 |  | ✅ | **Deliberately does not defer.** `doDispatch` acts on the signal because a stream can deliver several messages in one frame and a coalesced schedule would run the last and drop the rest — documented at `actiondispatchernode.ts:491-502`. |
| G1 |  | ✅ | `payloadOf` and `builtInFieldOf` test **presence**, not truthiness, so `{ value: 0 }` and `{ value: null }` are values (`action-dispatcher.ts:354-381`). The phase-3.5 draft's `action.data \|\| action` is called out in the comment. |
| B1 | ✅ has one | ⚠️ **L7** | `Refused`/`Failed` cover every action. But an unknown name typed into `Enabled Built-ins` writes `lastError` and fires **nothing** (`actiondispatchernode.ts:245-248`) — the one path where the node tells the author their configuration is wrong. Filed: it is an input setter, so a signal there would be on the boot path. |
| B2 |  | ✅ | Everything reaches graph outputs; no `editorConnection` in the file. |
| B3 | ✅ | ⚠️ **L6** | `Dispatch` → `Dispatched`/`Completed`/`Failed`/`Refused`. `Cancel All` is the gap: it returns bare when no dispatcher has been built (`doCancel:510`) and fires `Cancelled` when one has but the queue is empty. **The same state, two answers.** Filed. |
| C1 | ⚠️ **27%** (9/33) | ✅ **fixed** | 33 descriptions written. The 27% was the tooltip-flattening fallback, not real coverage. |
| D1 |  | ✅ | The vocabulary is closed and matched against `BUILT_IN_ACTIONS` and the registry; an unknown type is refused with a reason. Unknown built-in *names* are filtered out of the allow-list rather than trusted. |
| E1 | ✅ no dead-end types | ✅ | `payload`/`result` are `'*'`, which is honest for a server-supplied envelope. |
| F1 |  | ✅ | `Channel` names the registry explicitly; `Store Name` names the only store a built-in may write, and a store named *inside a message* is ignored by design. |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` → `dispose()`, which clears every entry timer and the registry listener. Pinned by a row. |

**Verdict:** ⚠️ 2 defects (both **filed**: L6, L7) · C1 fixed

---

### Action Handler  `net.noodl.ActionHandler`

8 inputs / 6 → **7** outputs · 2 signal in / 1 → **2** signal out · docs 36% → **100%** · SSR `safe` · browser, cloud · **no docs URL**

Source: `actionhandlernode.ts` · Docs: **none**

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | `channel`/`actionType`/`enabled` all re-register through one deferred `scheduleSetup`. |
| A2 |  | n/a | Nothing cached. There is deliberately no `Register` signal (`:233-239`). |
| A3 |  | ✅ | Values are flagged before `trigger` is sent (`:281-284`), so a graph wired `payload → value`, `trigger → set` sees *this* action's payload. |
| G1 |  | ✅ | Blank `actionType` is refused rather than registered as `''`. |
| B1 | ✅ has one | ⚠️ **D4, fixed** | `Complete`/`Fail` with nothing in flight set the `error` string and **nothing else** — no signal, no runtime raise. The pre-fill reads `✅` because a *string* port called `Error` matches the check (see §1.1). Fixed: `Failure` signal + `raiseRuntimeError('action-handler/operation-failed')`, plus a raise on the two registration errors (no signal there — it is the boot path). |
| B2 |  | ⚠️ **D4, fixed** | Before the fix the only runtime channel was a string an author had to poll; nothing reached `On App Error`. |
| B3 | ✅ | ⚠️ **D4, fixed** | Both signal inputs could be pulsed and terminate in silence. |
| C1 | ⚠️ **36%** (5/14) | ✅ **fixed** | 15 descriptions (14 + the new `Failure`). |
| D1 |  | ✅ | `actionType` is matched exactly and reserved built-in names are refused at registration (`action-dispatcher.ts:157-159`), unconditionally, so whether a name is a built-in never depends on initialisation order. |
| E1 | ✅ no dead-end types | ✅ | `payload`/`result` are `'*'`. |
| F1 |  | ✅ | `Channel` is the explicit binding to a dispatcher; there is no implicit resolution. |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` unregisters **and fails an action it was mid-way through**, so the dispatcher's queue is not stalled for the handler timeout by a component the user navigated away from. Pinned by a row. |

**Verdict:** ⚠️ 1 defect (D4, **fixed**) · C1 fixed

---

### Global Store  `net.noodl.GlobalStore`

4 inputs / 6 outputs · 0 signal in / 2 signal out · docs 0% → **100%** · SSR `safe` · browser, cloud · **no docs URL**

Source: `globalstorenode.ts`, over `globalstore.ts` (shared with `Set Global Store` and
`Subscribe to Store`) · Docs: **none**

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ⚠️ **D1, fixed** | **The node did nothing at all unless an input was authored.** All four inputs have defaults, and a declared `default` never runs its setter (`node.ts:116-118`, `nodescope.ts:148-157`), so `scheduleSetup` was never called: no `configureStore`, no subscription, no `Ready`, and `State Changed` could not fire. Invisible from the canvas because the `State` getter reads the manager directly and so *looked* right. Fixed with `nodeScopeDidInitialize`. |
| A2 |  | n/a | No refresh input; the store is the source. |
| A3 |  | ✅ | `globalstore.ts` commits once per public write or per batch close and reports only keys that genuinely differ; a value set to `X` and back inside one batch reports nothing. |
| G1 |  | ✅ | `null` is stored as `null` (corpus row); absence is a distinct state from `undefined` throughout, carried by the `ABSENT` symbol (`globalstore.ts:68`). |
| B1 | n/a — no action input | ✅ | No action input. `Error` reports what the store could not do, prefixed by phase. |
| B2 |  | ✅ | The error path is a graph output; the manager falls back to `console.error` only when nobody is listening. |
| B3 | n/a | n/a | No signal inputs. |
| C1 | ⚠️ **0%** (0/10) | ✅ **fixed** | 10 descriptions. |
| D1 |  | ✅ | `storeName` is a name, not a contract; `initialState` accepts an object or JSON text and reports a parse failure through `onError` rather than swallowing it. |
| E1 | ⚠️ 2 object/array ports: `initialState`, `state` | 🔵 | Both are genuinely the whole store. `Store Id` is the documented escape hatch — it names the backing `Model` so a Function node can reach the same state through `Noodl.Object` rather than through an unconnectable `object` port. |
| F1 |  | ✅ | The store is named, never implicit. |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` → `teardown()` drops both subscriptions. Pinned by a row. ⚠️ The row only passed *after* D1 was fixed — before it, the node had no subscription to leak. |

**Verdict:** ⚠️ 1 defect (D1, **fixed**) · C1 fixed · 🔵 E1 by design, documented

---

### Set Global Store  `net.noodl.GlobalStore.Set`

6 inputs / 2 → **3** outputs · 1 signal in / 1 → **2** signal out · docs 0% → **100%** · SSR `safe` · browser, cloud · **no docs URL**

Source: `globalstoresetnode.ts`, over `globalstore.ts` · Docs: **none**

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | The write goes through the Model that *is* the store, so a subscriber hears it exactly as it hears a write made from a Function node. There is one source of truth (`globalstore.ts:3-19`). |
| A2 |  | n/a | `Set` is the only trigger. |
| A3 |  | ✅ | Deferred with `scheduleAfterInputsHaveUpdated`, so `key`, `value` and the pulse arriving in one frame are read together — the `Set Variable` pattern. `Batch With Others` coalesces across *nodes* without losing the change (the phase-3.5 draft's "skip the notification" variant is called out at `globalstore.ts:434-442`). |
| G1 |  | ✅ | `null` is written as `null`, verified by a corpus row. |
| B1 | ✅ has one | ⚠️ **D4, fixed** | `Set` with no `Key` set the `error` string and stopped. `Completed` did not fire, `Failure` did not exist, and nothing reached the runtime error bus. Pre-filled `✅` for the reason in §1.1. Fixed: `Failure` + `raiseRuntimeError('global-store/set-failed')`. |
| B2 |  | ⚠️ **D4, fixed** | Same fix; nothing reached `On App Error` before it. |
| B3 | ✅ | ⚠️ **D4, fixed** | `Set` had one terminating signal on success and none on failure. |
| C1 | ⚠️ **0%** (0/8) | ✅ **fixed** | 9 descriptions (8 + the new `Failure`). |
| D1 |  | ✅ | `key` is a key, not a parsed contract. |
| E1 | ✅ no dead-end types | ✅ | `value` is `'*'`, which is right for a store that holds anything. |
| F1 |  | ✅ | The store is named. |
| H1 | declares `safe` | ✅ | Owns no subscription, no timer and no open work. |

**Verdict:** ⚠️ 1 defect (D4, **fixed**) · C1 fixed

---

### Subscribe to Store  `net.noodl.GlobalStore.Subscribe`

2 inputs / 4 outputs · 0 signal in / 1 signal out · docs 17% → **100%** · SSR `safe` · browser, cloud · **no docs URL**

Source: `globalstoresubscribenode.ts`, over `globalstore.ts` · Docs: **none**

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ⚠️ **D1, fixed** | Same shape as `Global Store`, own file: `storeName` has a default and `keys` is legitimately blank, so a node left entirely on its defaults never subscribed and `Changed` could not fire. **The node whose only job is to react reacted to nothing.** Fixed with `nodeScopeDidInitialize`; corpus row. |
| A2 |  | n/a | No refresh input. |
| A3 |  | ✅ | Key-filtered subscribers are called only when `changedKeys` intersects their keys, and `previousValue` is computed inside the notification because `previousState` exists only for its duration (`:142-144`). |
| G1 |  | ✅ | A single watched key yields that key's value, including `null`; several yield an object of just those keys; none yields the whole state. |
| B1 | n/a — no action input | n/a | No action input, and a subscription has nothing to fail at. |
| B2 |  | n/a | |
| B3 | n/a | n/a | |
| C1 | ⚠️ **17%** (1/6) | ✅ **fixed** | 6 descriptions. |
| D1 |  | ✅ | `keys` is split on `,` and trimmed; blank, whitespace and stray commas all mean "everything" rather than a key called `''`. |
| E1 | ✅ no dead-end types | ✅ | `value`/`previousValue` are `'*'`; the single-key projection is what makes them connectable in the common case. |
| F1 |  | ✅ | The store is named. |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` → `teardown()`. Pinned by a row, which — like `Global Store`'s — only became meaningful once D1 was fixed. |

**Verdict:** ⚠️ 1 defect (D1, **fixed**) · C1 fixed

---

### JSON Stream Parser  `net.noodl.JSONStreamParser`

5 inputs / 10 outputs · 2 signal in / 3 signal out · docs 7% → **100%** · SSR `safe` · browser, cloud

Source: `json-stream-parser.ts`, over `stream-parsers.ts` (`scanJsonValues`, `splitDelimited`,
`tryParseJson`) · Docs: [link](https://docs.noodl.net/nodes/data/json-stream-parser)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | Every `Parse` flags `isComplete`/`pendingCharacters`, and the value outputs when anything completed. |
| A2 |  | n/a | `Parse` is the re-run. |
| A3 |  | ✅ | Several values in one chunk all reach `Values`, with `Parsed` holding the last — corpus row. `scanJsonValues` is a real scanner (string state, escapes, depth), not the phase-3.5 draft's `JSON.parse(buffer + ']')`, so a chunk boundary inside a string is handled. |
| G1 |  | ✅ | `undefined`/`null` on `chunk` become `''`, and `''` is a documented no-op rather than a parse attempt. |
| B1 | ✅ has one | ⚠️ **L4** | Has a real `Failure` signal and it fires per bad line and on the `Max Pending` give-up. The gap is one step earlier: **`Parse` before any chunk has ever arrived returns bare** (`:199`) — no signal, no error. `Stream Buffer` got exactly this fixed in NDA-004 §2 with a `hasPendingData` flag and a named message; this sibling has no such flag. Filed, not fixed: distinguishing "never wired" from "legitimately empty" needs the same flag and `Parse` is genuinely no-op-able on a keep-alive frame. |
| B2 |  | ✅ | `Failure` + `Error` + `Error Count` are all graph outputs. ⚠️ No `raiseRuntimeError`, deliberately: it fires per malformed line, and a raise per line on a bad stream would flood `On App Error`. Recorded rather than changed. |
| B3 | ✅ | ⚠️ **L4** | `Clear` → `Cleared` ✅. `Parse` → `Success`/`Failure`, except the L4 path. |
| C1 | ⚠️ **7%** (1/15) | ✅ **fixed** | 15 descriptions. Two of them carry facts that were only in code comments: that `Pending Characters` staying non-zero means `Format` does not match the stream, and that `Chunk` is **retained between pulses** (L8). |
| D1 |  | ✅ | `format` is an enum, not a bare string. |
| E1 | ⚠️ 1 object/array port: `values` | 🔵 | `Values` is genuinely an array of parsed values; `Parsed` is the connectable single-value companion. |
| F1 |  | n/a | Targets nothing. |
| H1 | declares `safe` | ✅ | Holds only a string buffer, bounded by `Max Pending`, and no timer or subscription. |

**Verdict:** ⚠️ 1 defect (L4, **filed**) · C1 fixed · 🔵 E1, and the deliberate absence of a runtime
raise, both documented

---

### Optimistic Update  `net.noodl.OptimisticUpdate`

10 inputs / 12 → **13** outputs · 3 signal in / 4 → **5** signal out · docs 18% → **100%** · SSR `safe` · browser, cloud · **no docs URL**

Source: `optimisticupdatenode.ts`, over `globalstore.ts`'s patch API · Docs: **none**

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | Subscribes to the one key it targets so `Value` follows writes made by *anything*, not only by this node — which is exactly the case where a rollback is unsafe (`:366-370`). |
| A2 |  | n/a | The three action signals are the triggers. |
| A3 |  | ✅ | All three defer, so `key`, `optimisticValue` and `transactionId` are read together with the pulse. Applying with a stale `transactionId` would open a patch the response could never resolve. |
| G1 |  | ✅ | Absence is tracked as its own state (`ABSENT`), so rolling back a key the update *introduced* deletes it rather than leaving a hole holding `undefined`. |
| B1 | ✅ has one | ⚠️ **D4, fixed** | Three refusals ended on the `error` string alone: `Apply` with no `Key`, `Apply` with an id already open, and `Commit`/`Rollback` naming an update that is not in flight. Fixed with `Failure` + `raiseRuntimeError('optimistic-update/operation-failed')`. **Deliberately not fired by a rollback** — a rollback has `Rolled Back` (and `Timed Out`) already, and double-reporting would train authors to ignore it. |
| B2 |  | ⚠️ **D4, fixed** | Nothing reached the runtime error bus before. |
| B3 | ✅ | ⚠️ **D4, fixed** | All three signal inputs could terminate in silence. Six assertions in `test/optimisticupdate.test.ts` had **pinned** that silence as correct; they now expect `['failure']`. |
| C1 | ⚠️ **18%** (4/22) | ✅ **fixed** | 23 descriptions (22 + the new `Failure`). |
| D1 |  | ✅ | `transactionId` is an opaque id, matched by equality against open transactions and reported when it does not match. |
| E1 | ✅ no dead-end types | ✅ | `value`/`previousValue`/`optimisticValue` are `'*'`. |
| F1 |  | ✅ | Store and key are both named; `Transaction Id` makes the implicit "oldest open update" resolution explicit when several are in flight, and the resolution rule is documented on the port. |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` clears every per-transaction timer and resolves every open patch by the `When Removed` policy, with the supersede check still applied and no signals sent. A patch left open would leak into a store that outlives the component. |

**Verdict:** ⚠️ 1 defect (D4, **fixed**) · C1 fixed

---

### Pattern Extractor  `net.noodl.PatternExtractor`

5 inputs / 10 outputs · 1 signal in / 3 signal out · docs 13% → **100%** · SSR `safe` · browser, cloud

Source: `pattern-extractor.ts`, over `stream-parsers.ts` (`extractPattern`) · Docs:
[link](https://docs.noodl.net/nodes/data/pattern-extractor)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | n/a | Holds no state between extractions beyond the last result. |
| A2 |  | ✅ | `Extract` re-reads `Text`, `Pattern` and `Flags` every time; nothing is compiled once and cached. |
| A3 |  | ✅ | One `Extract`, one result, one signal. |
| G1 |  | ✅ | `undefined`/`null` on `text` become `''`, which matches nothing rather than throwing. |
| B1 | ✅ has one | ⚠️ **D3, fixed** | **A blank `Pattern` fired `Not Found`.** `extractPattern`'s first line was `if (!pattern) return empty`, and `empty` is `{ ok: true, match: null }` — indistinguishable from a pattern that ran and matched nothing. The node's own docstring forbids exactly this, ten lines below the call: *"An unusable pattern is distinct from 'no match': one is a bug to fix, the other is a normal outcome, and collapsing them hides broken patterns."* A blank pattern is the state every one of these nodes is in the moment it is dropped on the canvas, so `Extract` on an unconfigured node produced what looked like data. Fixed in `stream-parsers.ts`; four corpus rows, two of them controls. |
| B2 |  | ✅ | `Failure` + `Error` are graph outputs; nothing is editor-only. |
| B3 | ✅ | ✅ | `Extract` → `Found` \| `Not Found` \| `Failure`, and after D3 the three partition correctly. |
| C1 | ⚠️ **13%** (2/15) | ✅ **fixed** | 15 descriptions. |
| D1 |  | ✅ | The pattern is compiled inside a `try` and an invalid regex is a first-class `ok: false`, never a throw — a graph has nowhere to catch one. A user-supplied `g` is stripped so `Extract All` remains the only switch. |
| E1 | ⚠️ 3 object/array ports: `groups`, `matches`, `namedGroups` | 🔵 | Mitigated by design: `First Group` is the connectable string companion for the common one-group case, and `Match` for the common one-match case. |
| F1 |  | n/a | Targets nothing. |
| H1 | declares `safe` | ✅ | No timer, no subscription, no retained buffer. ⚠️ A catastrophically backtracking pattern is still the author's problem and the docstring says so — the platform regex engine cannot be bounded from here. |

**Verdict:** ⚠️ 1 defect (D3, **fixed**) · C1 fixed · 🔵 E1 by design, documented

---

### Server-Sent Events  `net.noodl.SSE`

17 inputs / 17 outputs · 2 signal in / 4 signal out · docs 18% → **100%** · SSR `client-only` · browser, cloud

Source: `sse.ts`, over `sse-connection.ts` (state machine, two transports, dedupe) and
`stream-parsers.ts` (`parseSseChunk`, `textForPath`) · Docs:
[link](https://docs.noodl.net/nodes/data/sse)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ⚠️ **D2, fixed** | **The node did not follow a `URL` change.** `scheduleAutoConnect` returned early whenever a live connection existed, and `SseConnectionOptions.url` is a copy taken at construction — so a URL arriving from a page parameter, a variable or a Function node left the stream on the *old* endpoint for the life of the node, silently. `websocket.ts`'s `rebuild()` has always handled this and says why in the file next door: *"Silently landing on `idle` after a url change is exactly the invisible failure this node is supposed to prevent."* **FINDINGS SR-vi's shape, one file over, at the node layer rather than in a helper.** Fixed with an identity check on `connectedUrl`; two corpus rows, one of them the control that a same-value write must *not* reopen the stream (reopening an agent stream re-issues the prompt). |
| A2 |  | ✅ | `Connect` tears down and reopens, resetting the retry budget deliberately. |
| A3 |  | ✅ | Values are flagged before `On Message` (`:534-546`), so an accumulator wired `text → chunk`, `onMessage → add` sees the chunk before the signal that consumes it. `parseSseChunk` keeps partial events in `rest` and re-parses them, and the fetch transport dispatches an unterminated tail at EOF rather than discarding it as the spec allows — real servers just close, and the last event is usually the interesting one. |
| G1 |  | ✅ | `Text` is the guaranteed-string output: `Raw` with no path, the field at the path when one is set, and `''` for anything non-primitive rather than `[object Object]`. Every consumer in this family already treats `''` as "nothing arrived". |
| B1 | ✅ has one | ⚠️ **L5** | `Last Error`, `On Error`, `Retry Count` and `Delivery Semantics` are a strong failure surface — `deliverySemantics` in particular is derived from what the server *actually sent* rather than from configuration. One filing: the fetch transport calls `onOpen()` **before** checking for a readable body (`sse-connection.ts:519-526`), so `Connected` goes true and `On Open` fires for a connection that then fails fatally with "this environment cannot stream fetch responses". A transient DA-vi — "connected" claimed for something that never carried a byte. |
| B2 |  | ✅ | Every diagnosis is a graph output; no `editorConnection` in either file. |
| B3 | ✅ | ✅ | `Connect` → `On Open` \| `On Error` \| `On Close`; `error` is treated as terminal and also fires `On Close`, so a Close handler runs whether the stream stopped cleanly or not. ⚠️ `Disconnect` on an already-closed stream is silent, which is correct (disconnecting twice must not emit twice). |
| C1 | ⚠️ **18%** (6/34) | ✅ **fixed** | 34 descriptions. |
| D1 |  | ✅ | `transport` and `method` are enums; `textPath` is parsed by `splitPath` and resolved by `valueAtPath`, which evaluates nothing and returns `undefined` for `__proto__`/`constructor`/`prototype` — a path can itself arrive over a connection. |
| E1 | ⚠️ 1 object/array port: `headers` | 🔵 | An input, and headers genuinely are a map; a Function node or an object literal is the intended source. |
| F1 |  | ✅ | The endpoint is named. Transport selection is implicit under `Auto` but is **visible** — `getInspectInfo` reports the resolved `transportKind`. |
| H1 | declares `client-only` | ✅ | `_onNodeDeleted` → `dispose()`: reconnect timer cleared, `AbortController` fired so an in-flight request is really cancelled, reader cancelled with its rejection swallowed. `client-only` is honest — a live stream would leak one connection per server render. |

**Verdict:** ⚠️ 2 defects (D2 **fixed**, L5 **filed**) · C1 fixed · 🔵 E1 by design

---

### State History  `net.noodl.StateHistory`

6 inputs / 8 outputs · 1 signal in / 1 signal out · docs 29% → **100%** · SSR `safe` · browser, cloud · **no docs URL**

Source: `statehistorynode.ts`, over `statehistory.ts` (shared with `Undo / Redo` and
`State Snapshot`) · Docs: **none**

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ⚠️ **D1, fixed** | Same shape as `Global Store`, third file: every input has a default, so a tracker dropped and left alone never attached and recorded nothing. **The symptom appeared one node over** — an `Undo / Redo` node reporting *"No State History node is tracking store 'app'"* with the tracker sitting on the canvas beside it. Fixed with `nodeScopeDidInitialize`; corpus row, plus a second row that only turned green as a consequence. |
| A2 |  | ✅ | `Clear History` re-baselines from live state. |
| A3 |  | ⚠️ **D5, fixed** | `StateHistoryManager.configure` returned early out of the `trackKeys` branch, **past the `enabled` line below it** (`statehistory.ts:230-242`). The node hands every option in one object from one deferred pass, so a pass that changed `Track Keys` and `Enabled` together silently dropped the pause. Fixed by applying `enabled` first; corpus row. |
| G1 |  | ✅ | A key absent from a restored entry is **deleted**, not written as `undefined` — which is why `replaceState` exists rather than a merge. |
| B1 | ⚠️ **none** | 🔵 | Correct as pre-filled and correct as designed: `Clear History` is the only action and clearing cannot fail. The failure surface for this family lives on `Undo / Redo` and `State Snapshot`, which is where the operations are. |
| B2 |  | n/a | Nothing to report. |
| B3 | ✅ | ✅ | `Clear History` → `History Changed`, via the manager's listener. |
| C1 | ⚠️ **29%** (4/14) | ✅ **fixed** | 14 descriptions. |
| D1 |  | ✅ | `trackKeys` is split and trimmed; blank means the whole store. |
| E1 | ⚠️ 1 object/array port: `history` | 🔵 | `History` deliberately carries **no state** — index, timestamp, description, changed keys, and the by-reference flags. Handing the states out would let a graph mutate the past. |
| F1 |  | ✅ | The store is named; attachment is reference-counted so two trackers on one store share one history rather than one silently wiping the other's. |
| H1 | declares `safe` | ✅ | `_onNodeDeleted` → `teardown()` drops this node's reference; the last one out releases the snapshots and the store subscription. Pinned by a row. |

**Verdict:** ⚠️ 2 defects (D1, D5 — both **fixed**) · C1 fixed · 🔵 B1 and E1 by design

---

### State Snapshot  `net.noodl.StateSnapshot`

5 inputs / 7 outputs · 2 signal in / 3 signal out · docs 8% → **100%** · SSR `safe` · browser, cloud · **no docs URL**

Source: `statesnapshotnode.ts`, over `statehistory.ts` · Docs: **none**

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | A restore is an **ordinary write**, so it lands in the history and can itself be undone — which is what an author who restored the wrong checkpoint wants. |
| A2 |  | ✅ | `Save` re-reads live state every time. |
| A3 |  | ✅ | Both actions are queued and run in the order their signals arrived, at end of frame. |
| G1 |  | ✅ | `snapshotData` treats `undefined`, `null` and `''` alike as "restore by name", and validates rather than trusting — it is the one entry point whose input an author can type. |
| B1 | ✅ has one | ✅ | Already remediated by NDA-004 §2: `Failure` signal, `Error` string, and `raiseRuntimeError('state-snapshot/operation-failed')`. A malformed JSON string reaches the catch rather than taking the frame down. |
| B2 |  | ✅ | The raise is the runtime channel; `editorConnection` is not the only path. |
| B3 | ✅ | ✅ | `Save` → `Saved` \| `Failure`; `Restore` → `Restored` \| `Failure`. |
| C1 | ⚠️ **8%** (1/12) | ✅ **fixed** | 12 descriptions. |
| D1 |  | ✅ | `snapshotName` is a name; a blank one is refused with a sentence. |
| E1 | ⚠️ 2 object/array ports: `snapshotData`, `snapshot` | 🔵 | Deliberate and load-bearing: `Snapshot` is plain JSON-shaped data precisely so it can be routed to a file and back into `Snapshot Data`, which is the export/import path with no extra ports. |
| F1 |  | ✅ | Both the store and the checkpoint are named. Explicit `Snapshot Data` wins over the name, which is documented on the port. |
| H1 | declares `safe` | ⚠️ **L1** | **A named snapshot is never released.** It holds a deep copy of the whole store in a module-global map that nothing reference-counts — unlike the history beside it, which is. A component that saves a checkpoint on mount retains one per mount for the life of the page. `deleteNamedSnapshot` exists on the manager and **nothing calls it**; the node has no `Delete` verb, so an author cannot release one either. **Filed, not fixed**: dropping snapshots on unmount would break the documented "save here, restore there" use, and the missing verb is the part worth deciding. Pinned by a row that asserts today's behaviour. |

**Verdict:** ⚠️ 1 defect (L1, **filed**) · C1 fixed · 🔵 E1 by design

---

### Stream Buffer  `net.noodl.StreamBuffer`

7 inputs / 10 outputs · 3 signal in / 4 signal out · docs 18% → **100%** · SSR `partial` · browser, cloud

Source: `stream-buffer.ts` · Docs: [link](https://docs.noodl.net/nodes/data/stream-buffer)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | Every path that changes the buffer flags `buffer`/`bufferSize`. |
| A2 |  | ✅ | Changing `Flush Interval` re-arms rather than leaving a timer running at the old period (`:107-110`). |
| A3 |  | ✅ | `doFlush` hands over the live array and installs a fresh one, so a downstream node never sees `Flushed Data` mutate under it on the next `Add`. |
| G1 |  | ✅ | `Data` is `'*'` and any value including `null` is buffered; the "nothing has arrived" case is a **separate flag**, not a value test. |
| B1 | ✅ has one | ✅ | Already remediated by NDA-004 §2: `Failure` + `Error` + `raiseRuntimeError`, and the docstring records what deliberately does *not* raise (`Flush`/`Clear` on an empty buffer, which are legitimate empty results). **This node is the reference implementation for the class D4 fixes.** |
| B2 |  | ✅ | `raiseRuntimeError` reaches `On App Error` in a deployed build. |
| B3 | ✅ | ✅ | `Add` → `Flushed`/`Overflowed`/`Failure`; `Flush` → `Flushed`; `Clear` → `Cleared`. |
| C1 | ⚠️ **18%** (3/17) | ✅ **fixed** | 17 descriptions, including that `Data` is retained between pulses of `Add` — which the code comments state and the ports did not. |
| D1 |  | ✅ | No string contracts. |
| E1 | ⚠️ 2 object/array ports: `buffer`, `flushedData` | 🔵 | Both are genuinely batches. `Buffer Size` is the connectable scalar companion. |
| F1 |  | n/a | Targets nothing. |
| H1 | declares `partial` | ✅ | `_onNodeDeleted` stops the timer and drops both arrays, and the timer functions are injectable so a test can *prove* no timer survives. `partial` is honest: manual and size-based flushes work under SSR, interval flushing needs a running clock. Pinned by a row. |

**Verdict:** ✅ clean — the only node of the fifteen with no defect on any check · C1 fixed · 🔵 E1 by
design

---

### Text Accumulator  `net.noodl.TextAccumulator`

6 inputs / 13 → **14** outputs · 2 signal in / 4 → **5** signal out · docs 16% → **100%** · SSR `safe` · browser, cloud

Source: `text-accumulator.ts`, over `stream-parsers.ts` (`splitDelimited`, `truncateHead`,
`utf8ByteLength`) · Docs: [link](https://docs.noodl.net/nodes/data/text-accumulator)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | Every append flags the text, count and byte outputs. |
| A2 |  | n/a | `Add` is the trigger. |
| A3 |  | 🔵 **L8** | An empty chunk is a deliberate no-op so a keep-alive frame does not fire `Changed`. But `pendingChunk` is **retained between pulses**, so a second `Add` with no new chunk appends the same text again. `Stream Buffer` documents identical semantics for `Data`; these two did not, and now do (C1). Recorded as by-design rather than changed: "add the current chunk" is a defensible reading and changing it would break a graph that pulses `Add` from two sources. |
| G1 |  | ✅ | `undefined` and `null` both blank the pending chunk rather than appending `"null"`; numbers and booleans are accepted as text, which a counter wired to a log accumulator wants. |
| B1 | ✅ has one | ⚠️ **D4, fixed** | A non-text chunk reached the `error` string and an **editor warning**, and nothing else — and since the refused chunk is blanked and a blank chunk is a no-op, the following `Add` returned in silence too. The `[object Object]` this replaced went through a whole live run unnoticed. Fixed: `Failure` signal + `raiseRuntimeError('text-accumulator/chunk-not-text')`, **keeping** the editor warning, because an author who has just mis-wired a port has not wired anything to `Failure` either. |
| B2 |  | ⚠️ **D4, fixed** | This was the clearest B2 in my fifteen: `editorConnection.sendWarning` is editor-only, and the `error` string was the only thing a deployed build had. |
| B3 | ✅ | ⚠️ **D4, fixed** | `Add` after a refused chunk terminated in silence. |
| C1 | ⚠️ **16%** (3/19) | ✅ **fixed** | 20 descriptions (19 + the new `Failure`). |
| D1 |  | ✅ | `delimiter` is a literal separator, not a parsed contract. |
| E1 | ⚠️ 1 object/array port: `messages` | 🔵 | `Last Message` and `Accumulated` are the connectable string companions; `Messages` is genuinely a list. |
| F1 |  | n/a | Targets nothing. |
| H1 | declares `safe` | ✅ | Holds only strings and an array, both bounded by `Max Length` and `Max Messages`, with the discards counted rather than hidden. No timer, no subscription. |

**Verdict:** ⚠️ 1 defect (D4, **fixed**) · C1 fixed · 🔵 A3/L8 and E1 by design, both now documented on
the ports

---

### Undo / Redo  `net.noodl.StateHistory.Undo`

5 inputs / 7 outputs · 3 signal in / 4 signal out · docs 0% → **100%** · SSR `safe` · browser, cloud · **no docs URL**

Source: `undonode.ts`, over `statehistory.ts` · Docs: **none**

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | An undo goes back through the store's ordinary writes, so a node watching the store sees it exactly as it sees any other change. There is no second notification path. |
| A2 |  | n/a | The three action signals are the triggers. |
| A3 |  | ✅ | Actions are **queued in arrival order** and run at end of frame, so `targetIndex` and the `Jump To` pulse are read together. |
| G1 |  | ✅ | `undefined` from the manager means "nowhere to go", which is a documented end-stop and not an error. |
| B1 | ✅ has one | ✅ | Already remediated by NDA-004 §2, and the docstring records that the finding predicted one defect and there were two — no raise *and* no `Failure` port. `setError(undefined)` is a **clear**, guarded so the new port does not fire on every success. |
| B2 |  | ✅ | `raiseRuntimeError('undo/operation-failed')`. |
| B3 | ✅ | 🔵 | `Undo`/`Redo` at the end-stops fire **nothing at all**, deliberately: `Can Undo`/`Can Redo` on the State History node are how a graph asks in advance, and a `Failure` for reaching the end of a history would be noise. `Jump To` outside the history *is* reported, because that is a graph that computed a wrong number. Corpus row pins the distinction. |
| C1 | ⚠️ **0%** (0/12) | ✅ **fixed** | 12 descriptions. |
| D1 |  | ✅ | `storeName` is a name; a store nothing is tracking is reported rather than silently ignored. |
| E1 | ✅ no dead-end types | ✅ | `byReferenceKeys` is a comma-separated string rather than an array, for exactly this reason. |
| F1 |  | ✅ | The store is named, and driving a store nothing tracks is an explicit error — *"a silent no-op here is the worst outcome: the button appears wired and does nothing"*. |
| H1 | declares `safe` | ✅ | Owns nothing. It drives a history it did not create and does not hold. |

**Verdict:** ✅ clean · C1 fixed · 🔵 B3 by design, documented

---

### WebSocket  `net.noodl.WebSocket`

18 inputs / 18 outputs · 3 signal in / 6 signal out · docs 31% → **100%** · SSR `client-only` · browser, cloud

Source: `websocket.ts`, over `websocket-connection.ts` (state machine, backoff, heartbeat, send
queue) · Docs: [link](https://docs.noodl.net/nodes/data/websocket)

| Check | Pre-filled | Verdict | Note |
|---|---|---|---|
| A1 |  | ✅ | **The reference implementation for D2.** `rebuild()` distinguishes identity (`url`, `protocols`) from tuning and rebuilds only for the first, and drops the old connection rather than re-pointing it because retry count, queue, latency and close code all describe a *particular* session. `applyConfig` pushes tuning onto a live connection without disturbing it. |
| A2 |  | ✅ | `Connect` reopens and resets the retry budget; `configure` applies a new heartbeat interval immediately rather than after the current one elapses. |
| A3 |  | ✅ | Queued sends flush **inside** the open handler before control returns to the graph, so a queued message can never overtake one sent after the connection came back. Ordering is FIFO by construction, and the file states the delivery semantics it can and cannot honestly promise. |
| G1 |  | ⚠️ **L2** | `send()` refuses `undefined` **and `null`** with *"Nothing to send: the Message input is empty"* (`websocket-connection.ts:538-543`). `undefined` abstaining is right. `null` is a **valid JSON message** — `JSON.stringify(null)` is `"null"` — and the Empty-Value Contract says `null` is a value, not an absence. Filed rather than fixed: it changes what an existing graph sends, and the refusal is at least loud. |
| B1 | ✅ has one | ✅ | The strongest failure surface in the category: `Last Error`, `On Error`, `Dropped`, `Close Code`, `Close Reason`, and a give-up message that names *which* of the three reasons applied. Nothing that fails to reach the wire is invisible — it is queued, or counted. |
| B2 |  | ✅ | Every diagnosis is a graph output. |
| B3 | ✅ | 🔵 **L3** | `Connect` → `On Open`/`On Error`/`On Close`; `Disconnect` → `On Close`, guarded so a second disconnect does not emit twice. `Send` is the documented exception: under `When Disconnected = Drop` it increments `Dropped` and fires **nothing**. Recorded as by-design — it is the requested behaviour and the count is on the canvas — but it is a signal input that can terminate in silence, and an author reading only the port list would not expect it. |
| C1 | ⚠️ **31%** (11/36) | ✅ **fixed** | 36 descriptions. Several carry facts that were only in the state machine's comments: that `On Reconnect` exists because RFC 6455 has no resume, that a heartbeat is application data rather than a protocol ping, and that `Max Queue Size: 0` can grow without bound. |
| D1 |  | ✅ | The URL is validated against `^wss?://` before a socket is constructed, with the offending value in the message; `messageType` and `whenDisconnected` are enums. |
| E1 | ✅ no dead-end types | ✅ | `message`/`received` are `'*'`; `Received Raw` and `Received Is Binary` are the connectable companions. |
| F1 |  | ✅ | The endpoint is named. |
| H1 | declares `client-only` | ✅ | `_onNodeDeleted` → `dispose()`: socket closed and detached, reconnect timer and heartbeat timer both cleared, the abandoned queue **counted** into `droppedCount` rather than vanishing. It also guards `_internal` being empty, because `initialize` is skipped for client-only nodes on the SSR server. `_handleSocketDown` is tagged per socket so browser error-then-close cannot run the reconnect decision twice. |

**Verdict:** ⚠️ 2 defects (L2, L3 — both **filed**) · C1 fixed

---

## 5. Gate numbers

Full `packages/noodl-runtime` suite, run with a minimal custom reporter — the bare run dies in
`@jest/reporters/getResultHeader` (`Cannot find module 'terminal-link'`) and reports a meaningless
"1 of 23". `dist-types` built first.

| | Suites | Tests | Failed | Skipped |
|---|---|---|---|---|
| **Before** (HEAD, my diff reversed and the new file held aside) | 90/91 passed | 1683/1696 | **0** | 13 |
| **After** | 91/92 passed | 1712/1725 | **0** | 13 |

Δ **+29 tests, +1 suite** — the new corpus file. Zero failures on either side.

Command:

```
(cd packages/noodl-runtime && npx jest --reporters=<minimal-reporter>)
(cd packages/noodl-runtime && npx jest test/corpus/nda-012-data-agent-family.test.ts)   # 29/29
```

**Typecheck:** `npm run typecheck` in `packages/noodl-runtime` — **clean before, clean after**.

**Discrimination:** every one of the ten fixes was reverted in turn, the mutation `grep`-confirmed to
have landed in the patched file, the suite re-run, and the fix restored. Each reddened **only** its
own rows plus the strictly-downstream ones noted below:

| Mutation | Rows reddened |
|---|---|
| `Global Store` hook | 4 — its three A1 rows + the H1 subscriber-count row |
| `Subscribe to Store` hook | 2 — its A1 row + the shared H1 subscriber-count row |
| `State History` hook | 3 — its A1 row, its H1 row, and the `Undo / Redo` end-stop row |
| SSE URL identity | 1 |
| blank pattern | 2 — the unit row and the graph row |
| `Set Global Store` failure | 1 |
| `Optimistic Update` failure | 2 |
| `Action Handler` failure | 1 |
| `Text Accumulator` failure | 1 |
| `configure` ordering | 1 |

The H1 rows going red under the A1 mutations is the correct downstream: a node that never attached
has no subscription to leak, so the leak assertion cannot discriminate until D1 is fixed. Worth
saying out loud — **an H1 row can pass for the wrong reason on an inert node.**

---

## 6. Defect tally

**18 distinct defects across 15 nodes.** Following the phase's shared-shape rule (FINDINGS SR-vi
counted four independent Animation files as one defect with four sites), a shape repeated across
files is one defect with N sites.

| # | Defect | Sites | Nodes affected | Status |
|---|---|---|---|---|
| **D1** | Inert until an input is authored — a declared `default` never runs its setter | 3 | Global Store, Subscribe to Store, State History | **fixed** |
| **D2** | SSE does not follow a `URL` change (SR-vi shape, at the node layer) | 1 | Server-Sent Events | **fixed** |
| **D3** | A blank pattern reported as "not found" rather than as unusable | 1 (`stream-parsers.ts`) | Pattern Extractor | **fixed** |
| **D4** | A refusal with no `Failure` signal and no runtime raise | 4 | Set Global Store, Optimistic Update, Action Handler, Text Accumulator | **fixed** |
| **D5** | `configure()` drops `Enabled` in a pass that changed `Track Keys` | 1 (`statehistory.ts`) | State History | **fixed** |
| **C1** | No `description` on any port | 15 | all 15 | **fixed** (271 written) |
| **L1** | Named snapshots are never released, and nothing can release one | 1 (`statehistory.ts`) | State Snapshot | filed |
| **L2** | `null` refused as an empty message | 1 (`websocket-connection.ts`) | WebSocket | filed |
| **L3** | `When Disconnected = Drop` ends a `Send` in silence | 1 | WebSocket | filed |
| **L4** | `Parse` before any chunk ever arrived is silent (the NDA-004 §2 fix its sibling got) | 1 | JSON Stream Parser | filed |
| **L5** | `On Open` fires before the readable-body check | 1 (`sse-connection.ts`) | Server-Sent Events | filed |
| **L6** | `Cancel All` answers the same state two ways | 1 | Action Dispatcher | filed |
| **L7** | An unknown built-in name reports on no channel that carries a signal | 1 | Action Dispatcher | filed |
| **L8** | `Chunk` retained between pulses, undocumented (documented now) | 2 | Text Accumulator, JSON Stream Parser | filed (🔵) |

**Counted three ways, because the phase has been bitten by conflating them:**

- **Distinct defects: 13 behavioural + 1 documentation = 14.** (D1–D5, L1–L8, C1.)
- **Sites: 34.** (3+1+1+4+1+15+1+1+1+1+1+1+1+2)
- **Per-node usage count — the number a naive sum of the worksheet rows produces: 19.**
  Action Dispatcher 2, Action Handler 1, Global Store 1, Set Global Store 1, Subscribe to Store 1,
  JSON Stream Parser 1(+L8), Optimistic Update 1, Pattern Extractor 1, Server-Sent Events 2,
  State History 2, State Snapshot 1, Stream Buffer 0, Text Accumulator 1(+L8), Undo / Redo 0,
  WebSocket 2. **Report 14, not 19, and never 34.**

**Fixed vs filed: 6 fixed (D1–D5 + C1, 25 sites), 8 filed (L1–L8, 9 sites).**

**Find rate: 14 distinct defects / 15 nodes = 0.93 per node** — the lowest of any category so far
(the running average was 1.41–1.88), and, as with Component Utilities' 0.63, **the reason is on the
record rather than inferred**: this family is the newest code in the library, written after the
Failure Contract existed, with a state machine per transport and injectable seams throughout. Three
of its nodes had already been through NDA-004 §2. **Two nodes came out completely clean** —
`Stream Buffer` and `Undo / Redo` — which is two of the three clean sheets the phase has produced.

⚠️ **Do not read that as exhaustion.** Counted by *sites* it is 34/15 = 2.27, the highest in the
phase, because the two dominant shapes each repeat across three and four files. And the single
highest-impact finding — D1, three nodes that did nothing at all — was invisible to every automated
check the phase runs, including the validator, the catalog and the worksheet pre-fill.

---

## 7. What the orchestrator must act on

1. **Regenerate the catalog.** 271 new `description`s and four new `failure` ports are invisible to
   `NODE-REGISTER.md`, the semantic validator and the AI authoring loop until `catalog:generate`
   runs. Data's C1 numbers will not move otherwise.
2. **Fix `worksheets.js`'s B1 pre-fill** (§1.1). It has mis-stamped `✅ has one` onto every node whose
   only failure surface is a string, across fifteen categories.
3. **Consider a sweep for §1.2.** "A node whose real work is a setter side effect and all of whose
   ports have defaults" is a mechanical predicate, and it found three dead nodes in fifteen.
4. **Three test files outside my declared territory were edited** (§2.1) — all sibling suites for my
   own nodes, all with NDA-012 comments. Flagging for the merge.
5. **L1's real question is a missing verb**, not a leak: `State Snapshot` has no way to delete a
   checkpoint, and `deleteNamedSnapshot` exists with no caller.
