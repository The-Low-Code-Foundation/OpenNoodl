# Node Register — all 156 catalogued nodes

Generated from `packages/noodl-types/src/node-catalog.json` (catalogFormatVersion 1.1.0).
Regenerate with `node scripts/node-audit/register.js` — hand-written `Verdict` cells are preserved.

The smell columns are *machine-derivable*, not verdicts.

- **Fail?** — has a signal input and signal outputs, but no failure/error output: the node can go wrong and say nothing.
- **Mute?** — has a signal input and no signal output at all: nothing downstream can sequence off it.
- **Doc%** — share of ports carrying a `description`, i.e. what the property panel and the AI authoring loop can read.

| # | Node | Category | Ports (in/out) | Fail? | Mute? | Doc% | SSR | Runtimes | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Animate To Value | Animation | 4/2 |  |  | 0% | partial | browser |  |
| 2 | Animation _(deprecated)_ | Animation | 13/2 | ⚠️ |  | 0% | partial | browser |  |
| 3 | States | Animation | 4/4 |  |  | 0% | partial | browser | ✅ NDA-004 §2 — `Failure`/`Error`, `states/unknown-state`. A name not in the list animated **every value to 0**, adopted the bogus name on the `State` output and fired `stateChanged`; no `reached-` port exists for it, so the transition read as successful. The guard refuses to move as well as reporting, and fires only for a *truthy* unknown name |
| 4 | Transition _(deprecated)_ | Animation | 6/2 | ⚠️ |  | 0% | partial | browser |  |
| 5 | Request | Cloud | 2/3 |  |  | 0% | — | cloud |  |
| 6 | Response | Cloud | 4/3 |  |  | 0% | — | cloud | ✅ NDA-004 §3 — `Sent`/`Failure`/`Error`. `response/no-request-in-scope` (the callback was never installed — previously a `TypeError` out of an input setter) and `response/already-sent` (the second answer, previously discarded in silence). `Sent` fires *before* delivery because delivering tears the request scope down synchronously |
| 7 | Send Email | Cloud | 7/3 |  |  | 40% | — | cloud |  |
| 8 | Aggregate Records | Cloud Services | 1/3 |  |  | 100% | — | cloud | ⚠️ NDA-012 (Cloud Services) — **6 defects, the worst node in the category and the one no earlier sweep opened.** Two are FIXED here: it wrote `_internal.err` against a getter reading `_internal.error` (third live instance of PLAT-003 §23.4/§27.3) and raised nothing on the error channel (B-iv). It is the only Cloud Services node in `noodl-viewer-cloud`, which both sweeps missed. Open: `getAggregates` throws when an aggregate name has no property set; an unset list aggregates nothing and still fires `Success`; `validateAggNames` checks only spaces; the class/aggregates warnings are editor-only. Rows C1–C5 |
| 9 | Cloud File | Cloud Services | 1/2 |  |  | 100% | safe | browser, cloud | ⚠️ NDA-012 — 1 shared defect: `null` cannot clear `Cloud File`, so a cleared port keeps the previous file (`cloudfilenode.ts:51-54`). Otherwise the simplest node in the category and clean |
| 10 | Cloud Function _(deprecated)_ | Cloud Services | 3/3 |  |  | 100% | safe | browser | ⚠️ NDA-012 — 3 defects, all “the failure has no reason”: a `Failure` signal with **no reason port anywhere on the graph** (the message reaches only the inspector and one `console.log`), and a call that *succeeds* returning nothing fires `Failure`. A data point for the deprecated-five question: worse than its replacement, unlike `Number Blend`. — also: ✅ NDA-004 §2 / FINDINGS B-iv, `cloud-function/call-failed` |
| 11 | Cloud Function | Cloud Services | 1/3 |  |  | 100% | safe | browser | ⚠️ NDA-012 — 2 defects: “No function specified” is editor-only and `doCall` has no guard after it, so a deployed app POSTs to `/functions/undefined`; and `resultsValues` is never cleared between calls, so a shorter second result leaves the first call's values on those outputs and still fires `Success`. — also: ✅ NDA-004 §2 / FINDINGS B-iv, `cloud-function/call-failed` |
| 12 | Config | Cloud Services | 0/0 |  |  | 100% | safe | browser, cloud | ⚠️ NDA-012 — 3 defects, and the sharpest in the category: a config fetch that fails once **can never succeed again** (`configservice.ts:118-131`; `clearCache()` clears the other field), and the node has **no failure surface of any kind** — no `Failure`, no `Error`, no raise, a `.then` with no `.catch`. Also the only node in the library whose Doc% cannot be measured: `0/0` static ports, all three real ports pushed from `setup`. Rows M1–M4 (`test.failing`) |
| 13 | Log In | Cloud Services | 3/3 |  |  | 100% | safe | browser | ✅ NDA-012 — no defects. — also: ✅ NDA-004 §2 / FINDINGS B-iv — ports were always right, diagnosis was editor-only. Raises `user/log-in-failed`; ten sibling auth nodes moved in the same batch, each with its own `user/<operation>-failed` |
| 14 | Log Out | Cloud Services | 1/3 |  |  | 100% | safe | browser | ✅ NDA-012 — no defects. Its `Do` port is internally named `login` and the comment says why (persisted in every project that uses it) |
| 15 | Model _(deprecated)_ | Cloud Services | 8/9 |  |  | 100% | safe | browser | ⚠️ NDA-012 — 1 shared defect (`setModelID` hands a possibly-absent id to the create-on-read tier). The healthiest deprecated node here, and **better sequenced than its replacement**: every one of its six actions has its own completion signal |
| 16 | Query Collection _(deprecated)_ | Cloud Services | 0/8 |  |  | 100% | safe | browser | ⚠️ NDA-012 — 1 defect, the phase's **fourth signal-before-value**: pulses `Modified` and *then* flags the counts the pulse is about (`dbcollectionnode.ts:211-216`). Its replacement deleted the signal rather than moving one line |
| 17 | Query Records | Cloud Services | 0/7 |  |  | 100% | safe | browser, cloud | ⚠️ NDA-012 — 3 defects: a change made by *another* node updates `Count`/`First Record Id`/`Is Empty` and not `Items`, while the node's own patch path flags `Items` three times with a comment saying why; an unparseable Javascript filter dereferences `undefined` rather than failing the query; two reports remain editor-only. — also: ✅ NDA-004 §2 / FINDINGS B-iv, `query-records/query-failed` |
| 18 | Record | Cloud Services | 4/5 |  |  | 100% | safe | browser, cloud | ⚠️ NDA-012 — 1 defect: `typeof null === 'object'`, so a cleared `Id` reaches `Model.create(null)` and binds the node to a fresh throwaway record whose generated id it reports. Third instance of the create-on-read trap. — also: 🔵 NDA-004 §2 — `scheduleStore` is dead code; `setModel`'s guard is the class-F path, already reported by `foreachitem.ts` |
| 19 | Request Magic Link | Cloud Services | 3/3 |  |  | 100% | partial | browser | ⚠️ NDA-012 — 2 defects, both reachability: **it cannot be added to a graph** (absent from `nodelibraryexport.ts`'s picker index, which lists four deprecated auth nodes instead), and it has no `docs` URL. FINDINGS **CS-i** — this corrects last session's dismissal of it as picker-exempt. Behaviourally the cleanest of the auth nodes |
| 20 | Request Password Reset _(deprecated)_ | Cloud Services | 2/3 |  |  | 100% | safe | browser | ✅ NDA-012 — no defects. Deprecated and **still in the picker**, while its modern replacement is not |
| 21 | Reset Password _(deprecated)_ | Cloud Services | 4/3 |  |  | 100% | safe | browser | ⚠️ NDA-012 — 2 defects, both class D: the outcome is decided by `if (response.indexOf('Invalid Link'))` — truthy exactly when the phrase is *absent* — and the unreachable branch below it reports “Failed to verify email” |
| 22 | Send Email Verification _(deprecated)_ | Cloud Services | 2/3 |  |  | 100% | safe | browser | ✅ NDA-012 — no defects |
| 23 | Set User Properties | Cloud Services | 3/3 |  |  | 100% | safe | browser, cloud | ⚠️ NDA-012 — 1 defect and it is the family's most consequential: triggered while signed out it calls **neither** callback, so `Do` yields no `Success`, no `Failure`, no `Error` and no console line, forever, and re-arms (`userservice.ts:327-354`). FINDINGS **CS-v** |
| 24 | Sign File URL | Cloud Services | 2/7 |  |  | 100% | safe | browser, cloud | ⚠️ NDA-012 — 1 shared defect (`null` cannot clear `File`, and with none ever set the node says “No file specified” to an author who did wire something). Otherwise the **reference node for this category** — the only one that distinguishes “the request never left” from “the backend refused” on a port. — also: ✅ NDA-004 §2 / FINDINGS B-iv, `sign-file-url/sign-failed` |
| 25 | Sign In With | Cloud Services | 3/5 |  |  | 100% | partial | browser | ⚠️ NDA-012 — 3 defects: **it cannot be added to a graph**, it has no `docs` URL (FINDINGS **CS-i**), and it subscribes to `UserService` in `initialize` with no `_onNodeDeleted`. The best-reasoned node in the category and the least reachable |
| 26 | Sign Up | Cloud Services | 4/3 |  |  | 100% | safe | browser | ✅ NDA-012 — no defects. 🔵 The local session is written from the request merged over the response, so a column the backend rewrites on insert reads stale until a `Fetch` |
| 27 | Upload File | Cloud Services | 3/9 |  |  | 100% | safe | browser | ⚠️ NDA-012 — 1 shared defect: its `File` input is typed `*` and accepts anything including `null`, the *opposite* of its two `cloudfile` siblings' silent rejection; neither is right and they should agree. — also: ✅ NDA-004 §2 / FINDINGS B-iv, `upload-file/upload-failed` |
| 28 | User | Cloud Services | 1/8 |  |  | 100% | partial | browser, cloud | ⚠️ NDA-012 — 1 defect: four `UserService` subscriptions in `initialize`, none removed on delete — `setMaxListeners(100000)` in the service constructor is the workaround already in place. 🔵 Its `loggedIn`/`loggedOut`/`sessionLost` signals are pushed from `setup`, so three of its most-used ports are invisible to the catalog and the validator even though it reads 100% |
| 29 | Verify Email _(deprecated)_ | Cloud Services | 3/3 |  |  | 100% | safe | browser | ⚠️ NDA-012 — 2 defects, both class D: `if (response.indexOf('Invalid Verification Link'))` is truthy when the phrase is *absent*, and the request interpolates username and token into a query string unencoded forty lines above a method that encodes both of its interpolations |
| 30 | Component Inputs | Component Utilities | 0/0 |  |  | 100% | safe | browser, cloud |  |
| 31 | Component Object _(deprecated)_ | Component Utilities | 3/3 | ⚠️ |  | 0% | safe | browser | 🔵 NDA-004 §2 — no walk to miss (its record is its own component's) and no `Do` (`scheduleStore` runs off a `value-…` setter). Fails both halves of the test |
| 32 | Component Object | Component Utilities | 2/2 | ⚠️ |  | 0% | safe | browser | 🔵 NDA-004 §2 — no walk to miss (its record is its own component's) and no `Do` (`scheduleStore` runs off a `value-…` setter). Fails both halves of the test |
| 33 | Component Outputs | Component Utilities | 0/0 |  |  | 100% | safe | browser, cloud |  |
| 34 | Parent Component Object _(deprecated)_ | Component Utilities | 3/3 | ⚠️ |  | 0% | safe | browser | ✅ NDA-004 §2 — `Failure`/`Error` on the existing `reportMiss`, so they inherit its two guards (never before the deferred first resolution, never twice for one miss). NDA-015 had given it the raise but nothing to wire |
| 35 | Parent Component Object | Component Utilities | 3/4 |  |  | 0% | safe | browser | ✅ NDA-004 §2 — `Failure`/`Error` on the existing `reportMiss`, so they inherit its two guards (never before the deferred first resolution, never twice for one miss). NDA-015 had given it the raise but nothing to wire |
| 36 | Set Component Object Properties | Component Utilities | 2/1 | ⚠️ |  | 0% | safe | browser | 🔵 NDA-004 §2 — writes to `componentState<own instance id>`, which always exists. Shares a file with row 37 and gets the opposite verdict; a corpus row pins the *absence* of the port |
| 37 | Set Parent Component Object Properties | Component Utilities | 3/3 |  |  | 0% | safe | browser | ✅ NDA-004 §2 — **it reported `Done` for a write that went nowhere.** The walk returned `undefined` and the base handed it to `Model.get`, whose `undefined` branch mints a fresh anonymous record per store. Also gains BINDING-CONTRACT §(a)'s explicit target, the last ⚠️ in that doc's table |
| 38 | CSS Definition | CustomCode | 1/0 |  |  | 0% | safe | browser |  |
| 39 | Expression | CustomCode | 2/10 |  |  | 0% | safe | browser, cloud | ✅ NDA-004 §2 — `Failure`/`Error`. Two modes: `expression/compile-failed` (the syntax error was reported *as a TypeError about `.apply`*, and only in the editor) and `expression/threw`. Both returned **`0`**, which `Is True`/`Is False` branch on happily — a plausible value, not a visibly broken one. Deduped by message, re-armed by the next good evaluation. ⬜ **NDA-017** (class G) — with `Run` connected the value setters go passive and `Run` evaluates whatever is in scope, so an async input that hasn't landed yields the previous cycle's answer; the same `0` seed that makes `Failure` safe here is what makes the not-yet-arrived case plausible |
| 40 | Function | CustomCode | 4/3 |  |  | 0% | partial | browser, cloud | ✅ NDA-004 §3 — Success/Failure/Error added; built-ins are collision-free because author outputs are all `out-`prefixed |
| 41 | Logic Builder | CustomCode | 3/1 |  | ⚠️ | 0% | safe | browser, cloud | ⏳ NDA-004 §3 pending — file is mid-rewrite by another workstream; do not touch until that lands |
| 42 | Script | CustomCode | 5/0 |  |  | 0% | partial | browser |  |
| 43 | Action Dispatcher | Data | 12/21 |  |  | 27% | safe | browser, cloud |  |
| 44 | Action Handler | Data | 8/6 |  |  | 36% | safe | browser, cloud |  |
| 45 | Add Record Relation | Data | 5/4 |  |  | 11% | safe | browser, cloud | ✅ NDA-004 §2 — `validateInputs` returned early with no editor connection, so **deployed it validated nothing** and the caller then hit two bare `return`s. Now returns the verdict and the caller fails through `setError` |
| 46 | Array _(deprecated)_ | Data | 9/8 | ⚠️ |  | 0% | safe | browser | 🔵 NDA-004 §2 — its `Id` input is a value arriving, not a `Do`; a `Failure` would fire on the boot path. Its only action, `Fetch`, yields the node's own array, which is a legitimate result. The Object node's answer |
| 47 | Array | Data | 3/6 | ⚠️ |  | 11% | safe | browser | 🔵 NDA-004 §2 — its `Id` input is a value arriving, not a `Do`; a `Failure` would fire on the boot path. Its only action, `Fetch`, yields the node's own array, which is a legitimate result. The Object node's answer |
| 48 | Array Filter | Data | 4/6 |  |  | 0% | safe | browser | ✅ NDA-004 §2 — `Failure`/`Error` and **two** failures where the triage predicted one. `array-filter/no-items` (a `Do` with nothing on Items) is gated on a `filterRequested` flag, because five of the scheduler's six callers are value arrivals; `array-filter/filter-failed` is not, because a `RegExp` built from the author's `Value` port threw out of a scheduled callback whenever it arrived. The trigger distinction the register asked for was **already in the source** as `isInputConnected('filter')` |
| 49 | Array Map | Data | 3/3 | ⚠️ |  | 0% | safe | browser |  |
| 50 | Clear Array | Data | 2/3 |  |  | 0% | safe | browser | ✅ NDA-004 §2 — `Failure`/`Error`, `clear-array/no-array`. Had **no guard at all**: `collection.set([])` on `undefined` threw a `TypeError` out of a scheduled callback |
| 51 | Create New Array | Data | 2/2 | ⚠️ |  | 0% | safe | browser | 🔵 NDA-004 §2 — builds its own collection (`Collection.get()` with no name), so it cannot fail to find one. Correctly carries no `Failure`, and a corpus row pins the absence |
| 52 | Create New Object | Data | 2/2 | ⚠️ |  | 0% | safe | browser, cloud | 🔵 NDA-004 §2 — builds its own object, so it cannot fail to find one. Correctly gets neither `addFailure` nor `repeaterComponent` |
| 53 | Create New Record | Data | 3/4 |  |  | 0% | safe | browser, cloud |  |
| 54 | Create Record | Data | 1/6 |  |  | 0% | safe | browser |  |
| 55 | Delete Record | Data | 4/4 |  |  | 13% | safe | browser, cloud |  |
| 56 | Delete Record | Data | 1/4 |  |  | 0% | safe | browser |  |
| 57 | Filter Records | Data | 3/6 |  |  | 0% | safe | browser, cloud | ✅ NDA-004 §2 — Array Filter's twin, read rather than assumed to be one: same six trigger paths, same guard, same bare return. `filter-records/no-items` and `filter-records/filter-failed` |
| 58 | Global Store | Data | 4/6 |  |  | 0% | safe | browser, cloud |  |
| 59 | HTTP Request | Data | 3/7 |  |  | 0% | safe | browser |  |
| 60 | Insert Object Into Array | Data | 3/3 |  |  | 0% | safe | browser | ✅ NDA-004 §2 — `Failure`/`Error`, `insert-into-array/no-array` and `/no-object-id`. Both branches were `sendWarning` + bare `return` behind an editor-only guard |
| 61 | JSON Stream Parser | Data | 5/10 |  |  | 7% | safe | browser, cloud |  |
| 62 | Object _(deprecated)_ | Data | 6/5 | ⚠️ |  | 0% | safe | browser | 🔵 NDA-004 §2 — **read and deliberately left silent.** Its `scheduleStore` has the same shape as Set Object Properties' but no `Do`: it is reached from any value arriving at a `prop-…` port, so failing would fire on the ordinary boot path. Values are retained and written when an object arrives |
| 63 | Object | Data | 5/3 | ⚠️ |  | 0% | safe | browser, cloud | 🔵 NDA-004 §2 — **read and deliberately left silent.** Its `scheduleStore` has the same shape as Set Object Properties' but no `Do`: it is reached from any value arriving at a `prop-…` port, so failing would fire on the ordinary boot path. Values are retained and written when an object arrives |
| 64 | Optimistic Update | Data | 10/12 |  |  | 18% | safe | browser, cloud |  |
| 65 | Pattern Extractor | Data | 5/10 |  |  | 13% | safe | browser, cloud |  |
| 66 | Query Data | Data | 1/8 |  |  | 0% | safe | browser |  |
| 67 | Remove Object From Array | Data | 3/3 |  |  | 0% | safe | browser | ✅ NDA-004 §2 — `Failure`/`Error`, `remove-from-array/no-array` and `/no-object-id`. Two bare `return`s: no diagnosis in any runtime, including the editor |
| 68 | Remove Record Relation | Data | 5/4 |  |  | 11% | safe | browser, cloud | ✅ NDA-004 §2 — twin of Add Record Relation |
| 69 | Repeater Item | Data | 1/3 | ⚠️ |  | 0% | safe | browser | ✅ NDA-004 §2 / NDA-015 — the **sixth** hand-rolled `_forEachModel` read, missed by the sweep that converged the other five. Now uses `resolveForEachItem`, so it takes the scope chain (a Repeater Item nested one component deep resolves) and raises `repeater-item/no-item-in-scope` once instead of handing out an undefined Item Id for ever |
| 70 | REST _(deprecated)_ | Data | 6/3 |  |  | 0% | safe | browser, cloud |  |
| 71 | Run Tasks | Data | 10/4 |  |  | 0% | safe | browser, cloud | ✅ NDA-004 — raises `run-tasks/no-completion-output` and ends the run instead of hanging (corpus F1/F1′). NDA-009 §1 still owes the editor-time check |
| 72 | Server-Sent Events | Data | 17/17 |  |  | 18% | client-only | browser, cloud |  |
| 73 | Set Global Store | Data | 6/2 |  |  | 0% | safe | browser, cloud |  |
| 74 | Set Object Properties | Data | 5/4 |  |  | 0% | safe | browser, cloud | ✅ NDA-004 §2 — `Failure`/`Error` and `set-object-properties/no-object`. `Do` with no object bound wrote nothing and said nothing. Raises in `explicit` mode only; in `foreach` mode `foreachitem.ts` already raised the precise reason, and the graph surface fires either way |
| 75 | Set Record Properties | Data | 7/4 |  |  | 9% | safe | browser, cloud | ✅ NDA-004 §2 — the two branches of `Store Type` disagreed: `cloud` answered a missing Id with `setError`, `local` returned silently. Same node, same author mistake, and whether they heard about it depended on an enum |
| 76 | Set Variable | Data | 3/3 |  |  | 0% | safe | browser | ✅ NDA-004 §2 — **it reported `Done` for a write nothing could read.** `Model.set(undefined, value)` neither throws nor no-ops: it writes a key literally named `undefined` on the shared variables record. Third confirmed instance of the false-success shape, reached by not filling in a field. `set-variable/no-name`, empty string included; refuses to write as well as reporting |
| 77 | State History | Data | 6/8 | ⚠️ |  | 29% | safe | browser, cloud | 🔵 NDA-004 §2 — its `storeName` setter normalises absent/empty to `'app'`, so there is no target it can fail to find. Its one action always has a real store name and `historyChanged` is a notification, not an action completion. **Two ✅ siblings in the same family** (rows 78, 84); a corpus row pins the absence of the port |
| 78 | State Snapshot | Data | 5/7 |  |  | 8% | safe | browser, cloud | ✅ NDA-004 §2 / FINDINGS B-iv — had *no* channel and *no* `Failure` port: an author could wire `Saved` and had nothing to sequence off a failure, only an `Error` string to poll. `state-snapshot/operation-failed`, guarded on a defined message because `setError(undefined)` is how every success path clears |
| 79 | Static Array | Data | 3/2 |  |  | 0% | safe | browser |  |
| 80 | Stream Buffer | Data | 7/10 |  |  | 18% | partial | browser, cloud | ✅ NDA-004 §2 — `Add` with nothing on `Data` returned bare. `stream-buffer/no-data`. `Flush`/`Clear` on an empty buffer deliberately do **not** report: a timed flush with nothing to send is a legitimate empty result, Open File Picker's `Cancelled` question answered the other way |
| 81 | Subscribe To Changes | Data | 0/11 |  |  | 0% | client-only | browser | ✅ NDA-004 §2 / FINDINGS B-iv — `console.warn` and **no `Failure` port**. Survives deployment, unlike the editor channel, but unstructured, no code, invisible to `On App Error`. Now `subscribe-to-changes/realtime-failed` plus the port |
| 82 | Subscribe to Store | Data | 2/4 |  |  | 17% | safe | browser, cloud |  |
| 83 | Text Accumulator | Data | 6/13 |  |  | 16% | safe | browser, cloud |  |
| 84 | Undo / Redo | Data | 5/7 |  |  | 0% | safe | browser, cloud | ✅ NDA-004 §2 / FINDINGS B-iv — twin of row 78. `undo/operation-failed`. Four existing test assertions read `expect(signals).toEqual([])` while being named "reports an out-of-range jump"; they encoded the defect, not the claim |
| 85 | Update Record | Data | 1/5 |  |  | 0% | safe | browser |  |
| 86 | Variable _(deprecated)_ | Data | 4/5 | ⚠️ |  | 0% | safe | browser |  |
| 87 | Variable | Data | 3/4 | ⚠️ |  | 0% | safe | browser |  |
| 88 | WebSocket | Data | 18/18 |  |  | 31% | client-only | browser, cloud |  |
| 89 | Receive Event | Events | 3/1 |  |  | 100% | safe | browser | ✅ **FIXED 2026-07-30 (NDA-012 Events).** `handleEvent` flags the payload outputs dirty *before* pulsing `Received`, so a node acting on the signal reads this event's data rather than the previous one — the whole point of a node that carries a payload with a signal. Corpus row inverted, not deleted; restoring the statement order reddens it while the wiring control stays green. ⚠️ `Signal To Index` still has the shape and is deliberately unfixed |
| 90 | Send Event | Events | 4/3 |  |  | 100% | safe | browser | ✅ NDA-004 — `Sent`/`Failure`; empty channel name reported rather than dispatched into the void |
| 91 | Color Blend | Interpolation | 1/1 |  |  | 100% | safe | browser |  |
| 92 | Number Blend _(deprecated)_ | Interpolation | 2/1 |  |  | 100% | safe | browser |  |
| 93 | Script Downloader _(deprecated)_ | Javascript | 2/1 | ⚠️ |  | 100% | client-only | browser |  |
| 94 | And | Logic | 0/1 |  |  | 100% | safe | browser, cloud |  |
| 95 | Condition | Logic | 2/4 | ⚠️ |  | 100% | safe | browser, cloud |  |
| 96 | Inverter | Logic | 1/1 |  |  | 100% | safe | browser, cloud |  |
| 97 | Or | Logic | 0/1 |  |  | 100% | safe | browser, cloud |  |
| 98 | Signal To Index _(deprecated)_ | Logic | 0/2 |  |  | 100% | safe | browser |  |
| 99 | Switch | Logic | 4/4 | ⚠️ |  | 100% | safe | browser |  |
| 100 | Value Changed | Logic | 1/1 |  |  | 100% | safe | browser |  |
| 101 | Counter | Math | 7/2 | ⚠️ |  | 100% | safe | browser, cloud |  |
| 102 | Number Remapper | Math | 6/1 |  |  | 100% | safe | browser | ✅ **FIXED 2026-07-30 (NDA-012 Math).** Both input endpoints defaulted to `0` — the degenerate branch — so every freshly dropped node reported `Output Minimum` for every input, the Expression-returns-`0` shape sitting in the default configuration. `initialize` now uses an input maximum of 1, so an unconfigured node passes its input through 0..1. Reporting instead would fire on the boot path of a graph still being built. ⚠️ The fix is in `initialize`, not the port `default` — a declared default does not run its setter at construction |
| 103 | Close Popup | Navigation | 4/3 |  |  | 0% | safe | browser | ✅ NDA-004 §2 — `Closed`/`Failure`/`Error`; no-popup-in-scope now reported. Targeting stays NDA-010 §2 / NDA-015 |
| 104 | External Link | Navigation | 3/3 |  |  | 0% | safe | browser | ✅ NDA-004 — `Success`/`Failure`/`Error`; catches the popup-blocker case that made the button look dead |
| 105 | Navigate | Navigation | 2/3 |  |  | 0% | safe | browser | ✅ NDA-004 §2 — `Failure`/`Error`. `navigate/no-target-page` and `navigate/page-not-found`; the latter replaces a bare `return` that carried `//TODO: send error to editor`. The editor adapter's health warning is the edit-time half and does not travel |
| 106 | Navigate To Path | Navigation | 4/3 |  |  | 0% | safe | browser | ✅ NDA-004 — `Success`/`Failure`/`Error`; the `path === undefined` return is no longer silent |
| 107 | Page Inputs | Navigation | 2/0 |  |  | 0% | safe | browser |  |
| 108 | Pop Component Stack | Navigation | 3/3 |  |  | 0% | safe | browser | ✅ NDA-004 §3 — done in NDA-008 §3 (`0db1d770`), not pending: `Popped`/`Failure`/`Error` and `reportFailure` raising on the bus (`navigate-back.ts:63-80,133-138`). **This row said ⏳ until 2026-07-30** — the work landed under another task's commit and nobody came back to the register. A `void` return from `backCallback` counts as success on purpose |
| 109 | Push Component To Stack | Navigation | 3/3 |  |  | 0% | safe | browser | ✅ NDA-004 §2 — `Failure`/`Error` for five drops: three guards in `navigateAsync` and the same three copied into `replaceAsync`. Reported via a `hasFailed` callback because the stack's `asyncQueue` outlives the caller's frame; the *node* owns the port, NDA-008 §3's decision for `back()` |
| 110 | Show Popup | Navigation | 3/4 |  |  | 0% | safe | browser | ✅ NDA-004 §2 — every outcome it had was a *later* one, so a popup that never opened looked like one the user had not finished with. `show-popup/no-target`, and `show-popup/target-failed` for the **unhandled promise rejection**: `showPopup` is `async` and `getComponentModel` throws for an unregistered name, which the node dropped. Residual: a runtime with no popup host resolves successfully having done nothing |
| 111 | Device Orientation _(deprecated)_ | Sensors | 0/3 |  |  | 100% | client-only | browser |  |
| 112 | String Format | String Manipulation | 1/1 |  |  | 100% | safe | browser, cloud |  |
| 113 | Substring | String Manipulation | 3/1 |  |  | 100% | safe | browser, cloud |  |
| 114 | Unique Id | String Manipulation | 1/2 | ⚠️ |  | 100% | safe | browser, cloud | ✅ NDA-004 §3 — `Generated` |
| 115 | Boolean To String | Utilities | 3/2 |  |  | 0% | safe | browser, cloud |  |
| 116 | Date To String | Utilities | 2/3 |  |  | 0% | safe | browser, cloud |  |
| 117 | Delay | Utilities | 5/2 | ⚠️ |  | 0% | partial | browser |  |
| 118 | Globals _(deprecated)_ | Utilities | 0/0 |  |  | 100% | safe | browser |  |
| 119 | Index To String _(deprecated)_ | Utilities | 1/2 |  |  | 0% | safe | browser |  |
| 120 | On App Error | Utilities | 1/7 |  |  | 100% | safe | browser, cloud |  |
| 121 | Open File Picker | Utilities | 3/9 |  |  | 0% | client-only | browser | ✅ NDA-004 §2 — `Cancelled` (a completion signal, deliberately **not** raised: declining a dialog is a legitimate empty result) plus `Failure`/`Error` for `click()` being refused, `open-file-picker/open-failed`. A `change` with an empty `FileList` fired `Success` with all five outputs `undefined`. No read error exists — the node never reads the file |
| 122 | Screen Resolution | Utilities | 0/3 |  |  | 0% | client-only | browser |  |
| 123 | String Mapper | Utilities | 2/1 |  |  | 0% | safe | browser, cloud |  |
| 124 | Boolean | Variables | 3/3 | ⚠️ |  | 50% | safe | browser, cloud |  |
| 125 | Color | Variables | 3/3 | ⚠️ |  | 50% | safe | browser |  |
| 126 | Number | Variables | 3/3 | ⚠️ |  | 50% | safe | browser, cloud |  |
| 127 | String | Variables | 3/4 | ⚠️ |  | 57% | safe | browser, cloud |  |
| 128 | Button _(deprecated)_ | Visual | 48/21 |  |  | 42% | safe | browser |  |
| 129 | Button | Visual | 79/20 |  |  | 53% | safe | browser |  |
| 130 | Checkbox _(deprecated)_ | Visual | 39/21 |  |  | 45% | safe | browser |  |
| 131 | Checkbox | Visual | 76/20 | ⚠️ |  | 48% | safe | browser |  |
| 132 | Circle | Visual | 33/14 |  |  | 77% | safe | browser |  |
| 133 | Columns | Visual | 16/9 |  |  | 40% | safe | browser |  |
| 134 | Component Children | Visual | 0/0 |  |  | 100% | safe | browser |  |
| 135 | Component Stack | Visual | 9/11 | ⚠️ |  | 50% | partial | browser |  |
| 136 | Drag | Visual | 16/16 | ⚠️ |  | 31% | safe | browser |  |
| 137 | Dropdown | Visual | 91/20 |  |  | 48% | safe | browser |  |
| 138 | Field Set _(deprecated)_ | Visual | 33/9 |  |  | 88% | safe | browser |  |
| 139 | Form _(deprecated)_ | Visual | 33/10 |  |  | 86% | safe | browser |  |
| 140 | Group | Visual | 85/20 | ⚠️ |  | 52% | safe | browser |  |
| 141 | Icon | Visual | 30/8 |  |  | 92% | safe | browser |  |
| 142 | Image | Visual | 62/16 |  |  | 64% | safe | browser |  |
| 143 | Label _(deprecated)_ | Visual | 57/9 |  |  | 50% | safe | browser |  |
| 144 | Options _(deprecated)_ | Visual | 52/21 |  |  | 51% | safe | browser |  |
| 145 | Page | Visual | 23/9 | ⚠️ |  | 44% | safe | browser |  |
| 146 | Page Router | Visual | 9/11 | ⚠️ |  | 50% | safe | browser |  |
| 147 | Radio Button _(deprecated)_ | Visual | 39/20 |  |  | 46% | safe | browser |  |
| 148 | Radio Button | Visual | 76/19 |  |  | 48% | safe | browser |  |
| 149 | Radio Button Group | Visual | 33/11 |  |  | 84% | safe | browser |  |
| 150 | Range _(deprecated)_ | Visual | 40/22 |  |  | 44% | safe | browser |  |
| 151 | Repeater | Visual | 5/2 | ⚠️ |  | 0% | safe | browser | ✅ NDA-004 §3 — `Items Rendered`, fired when the operation queue drains (not when `refresh()` returns) |
| 152 | Slider | Visual | 92/21 |  |  | 27% | safe | browser |  |
| 153 | Text | Visual | 43/14 |  |  | 75% | safe | browser |  |
| 154 | Text Input _(deprecated)_ | Visual | 55/21 | ⚠️ |  | 49% | safe | browser |  |
| 155 | Text Input | Visual | 97/21 | ⚠️ |  | 45% | safe | browser |  |
| 156 | Video | Visual | 66/23 |  |  | 47% | safe | browser | ✅ NDA-004 §2 — `Playback Failure`/`Error`. `play()`'s rejected promise was dropped at all three sites (`video/play-rejected`), and the element's `error` event had no listener (`video/media-error`). `AbortError` is deliberately **not** reported — a `Pause` superseding a `Play` rejects on a correct graph |
