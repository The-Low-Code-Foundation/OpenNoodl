# ERG-001 §0 — the ground, measured

**Measured:** 2026-08-02, at `53434356`, on branch `cline-dev`.
**Derived from:** `packages/noodl-types/src/node-catalog.json` (151 nodes) and the runtime sources it
was generated from — **not** from any register or handover, per §0's instruction.
**Status:** §0 complete. This table is `ERG-001`'s scope. Nothing should be built before reading it.

Reproduce with the scripts in this session's scratchpad, or re-derive: an *action* is a catalog node
with at least one `isSignal: true` **input**, excluding `isDeprecated`.

---

## §0.1 — The actions

**98 catalog nodes have a signal input. 82 are live; 16 are deprecated** and out of scope by
Richard's 2026-08-01 no-revivals decision. One live action is outside the node picker (`Page`,
authored as a page component's root), and it stays in scope because it is authored through a
specialised flow rather than hidden.

| Category | Live actions | | Category | Live actions |
|---|---|---|---|---|
| Data | 34 | | Navigation | 7 |
| Cloud Services | 11 | | Component Utilities | 4 |
| Visual | 9 | | Variables | 4 |
| CustomCode | 3 | | Cloud, Logic, Utilities | 2 each |
| Animation, Events, Math, String Manipulation | 1 each | | | |

**⚠️ 45 of the 82 are dynamic-port nodes.** That is more than half, and it matters twice: the
`graph-harness` does not call a module's `setup`, so corpus rows for those nodes do not see the
real port set; and §5's `description` channel does not exist for ports that arrive via
`sendDynamicPorts` (FINDINGS **SR-ii**).

The full 82-row table is at the end of this document, with each node's signal inputs and the signal
outputs it has **today**.

---

## §0.2 — The collision sweep

§0's second item, and the one the contract flagged as the cost that might already be being paid.
**It is being paid, in two different ways, and neither is what NDA-004 §3 predicted.**

### Result 1 — `Unchanged` is free. `Done` and `Completed` are not.

Sweeping every static port on all 151 nodes (inputs and outputs, by `name` **and** `displayName`,
case-insensitive):

| Reserved name | Static collisions |
|---|---|
| `Unchanged` | **none, anywhere** |
| `Done` | **8 live nodes**, all outputs, all display-only |
| `Completed` | **2 live nodes**, output `name` *and* `displayName` |

### Result 2 — ⚠️ the eight `Done` ports have **four different internal names**

The display name is uniform and the wire name is not. This is the single most consequential thing
§0 found, because a project file stores the **internal** name:

| Internal name | Nodes |
|---|---|
| `modified` | `CollectionClear`, `CollectionInsert`, `CollectionRemove` |
| `created` | `CollectionNew`, `NewModel` |
| `stored` | `SetModelProperties`, `net.noodl.SetComponentObjectProperties`, `net.noodl.SetParentComponentObjectProperties` |
| `done` | `RunTasks`, `Set Variable` |

An author reading the canvas sees one port called "Done" on all eight. A validator, the AI authoring
loop, and the workflow canvas see four. **§1 has to decide this and it is not a free rename** — see
"What §1 must decide" below.

### Result 3 — ⚠️ both live `Completed` ports mean the **opposite** of the contract's `Completed`

This is the SR-ix class, confirmed by reading the code rather than the port list:

- **`net.noodl.GlobalStore.Set`** — `globalstoresetnode.ts:178` sends `completed` inside the `try`;
  the `catch` and the no-key guard both route to `reportFailure`, which sends `failure` instead
  (`:190-195`). `Completed` and `Failure` are **mutually exclusive**. The contract requires
  `Completed` to fire after *all three* outcomes.
- **`net.noodl.ActionDispatcher`** — `actiondispatchernode.ts:80-96`: `onCompleted` sends
  `completed`, `onFailed` sends `failed`. Same exclusivity, plus a different granularity: it is
  per-*action*, not per-invocation of the node's own `Dispatch` input.

Adopting the reserved name on these two nodes silently changes the meaning of a wire an author has
already drawn. **Neither can simply be renamed into the contract.**

### Result 4 — the dynamic and user-authored surface is nearly all insulated by prefixes

Checked mechanism by mechanism, in source, because "user-authored" was the half NDA-004 §3 got wrong:

| Mechanism | Naming | Can collide? |
|---|---|---|
| Function node (`JavaScriptFunction`) | `out-` prefix (`simplejavascript.ts:108`) | **No** — and the file's own comment at `:203-204` already says so |
| `net.noodl.HTTP` response mappings | `out-` prefix (`httpnode.ts:541`) | **No** |
| `CloudFunction2` | `out-` prefix (`cloudfunction2.ts:184`) | **No** |
| Object / Record / property nodes | `prop-` prefix (`modelnode2.ts:399`) | **No** |
| `Show Popup` close results | `closeAction-` prefix (`showpopup.ts:255`) | **No** |
| `Logic Builder` | **verbatim block names** | **Yes — but already guarded.** `RESERVED_OUTPUTS = ['error','success','failure']` (`logic-builder.ts:79`) drops a colliding name and raises `logic-builder/reserved-port-name`. Adding three strings extends a mechanism that exists |
| `States` | **verbatim value names** (`states.ts:243` → `:331-340`) | **Yes, and unguarded.** `registerOutputIfNeeded` opens with `if (this.hasOutput(name)) return;` — so a States node with a value called `done` would silently lose its value output to the contract's signal. Same failure shape as SR-ix |
| `Event Receiver` | verbatim payload names, same `hasOutput` skip | Yes — but it has no signal input, so it is not an action and gains no ports |

### Result 5 — what authors have actually written, swept across every project in the repo

202 JSON files (`project-examples/`, `dev-docs/qa-fixtures/`, `library/`, every editor test fixture,
the phase-16 probe corpus). Connections whose `fromProperty`/`toProperty` is `Done`, `Completed` or
`Unchanged`:

```
xano              JavaScriptFunction.out-Done  ->  Component Outputs.Done
email-verification JavaScriptFunction.out-Done ->  Component Outputs.Done
supabase          SetModelProperties.stored    ->  Component Outputs.Done
loading-spinner   NavigationShowPopup.Closed   ->  Component Outputs.Done
supabase          <component>.Done             ->  <component>.Do, RouterNavigate.navigate, Condition.eval
```

⚠️ **This sweep had a blind spot, and the editor gate found it.** It looked for the names being
*reserved* and not for the names being *renamed away from*. `packages/noodl-editor/tests/testfs/`
`git-repo-utf8/project.json` wires `CollectionInsert.modified` five times, and nothing here saw it
because `modified` was not on the list of strings being searched for. The semantic validator's
false-positive corpus caught it on the first `test:ci` after the rename — which is the check
working, but the lesson generalises to §4: **before renaming a port, sweep for the old name too.**
A rename has two sides and §0 only swept one.

Otherwise: **every authored `Done` is on a component interface, never on a library node's own
port.** The library side is always the internal name — `stored`, `out-Done`, `Closed`. Two
consequences:

1. The reserved names are safe to add to library nodes today. The sweep is **not** empty, but
   nothing it found blocks the addition.
2. `Done` is demonstrably the name authors reach for on a component's public interface, which is
   `ERG-005`'s territory. If component interfaces ever inherit the contract, this is where the
   collision lands — and `library/prefabs/` ships four examples of it.

---

## §0.3 — Classification

§0's third item, with its warning honoured: **nothing below is derived from a port name.** Each
verdict cites the code that produces it.

### The load-bearing column is `Unchanged`

`Completed` is universal, so it needs no per-node analysis. `Failure` is where NDA-004 §2 put it.
The question that actually requires reading 82 nodes is *which actions can legitimately no-op* — and
because today a no-op is expressed as **silence**, the register below is simultaneously the list of
places a signal chain currently dies.

### Confirmed `Unchanged` cases — read in source

| Node | The no-op path | What happens today |
|---|---|---|
| `CollectionInsert` — Insert Object Into Array | `Array.prototype.add` early-returns on `contains` (`collection.ts:594`) | Fires **`Done`**. The contract's §2 reference case, and the lie Richard named |
| `CollectionRemove` — Remove Object From Array | `Array.prototype.remove` is `if (idx !== -1) …` (`collection.ts:611`) — an object that exists but is not in *this* array | Fires **`Done`**. ⚠️ **This is a third path the spec's §2 note does not cover.** DA-vi's failure verdict covers the *unloaded id* case (`Model.get` mints on read, so it is impossible). A loaded object that simply is not a member is redundant, not impossible — `Unchanged` |
| `Counter` — Increase / Decrease | `counter.ts:45-47`, `:59-61` — at `limitsMax` / `limitsMin`, bare `return` | **Silence** |
| `Switch` — On / Off | `switch.ts:35-37`, `:48-50` — already in that state, bare `return` | **Silence** |
| `net.noodl.controls.checkbox` — Check / Uncheck | `checkbox.ts:77`, `:92` — already checked/unchecked, bare `return` | **Silence** |
| `Timer` — Start | `timer.ts:53-55` — `if (_isRunning === false) start()`, so a Start on a running timer does nothing | **Silence** |
| `net.noodl.WebSocket` — Disconnect | `websocket.ts:340-341` — `if (connection) …`, so disconnecting when never connected | **Silence** |
| `net.noodl.SSE` — Disconnect | `sse.ts:592-595` — identical shape | **Silence** |
| `net.noodl.StateHistory.Undo` — Undo / Redo / Jump To | `undonode.ts:217-221`, `report()`: *"`null` means the history had nowhere to go. That is an ordinary end-stop, so no signal and no error"* | **Silence, deliberately.** ⚠️ The comment even names the workaround it forces on authors — poll `canUndo`/`canRedo` first. This is the clearest single argument for the contract in the library |
| `RouterNavigate` — Navigate | `router.tsx:401-410` — `shallowObjectsEqual(currentPageSnapshot, target)` → bare `return`, calling **neither** `hasNavigated` nor `hasFailed` | **Silence.** This is the contract's own named exception ("a no-op re-selection of the current page") and it is currently the silent case, not the documented one |

### The precedent already in the library — ⚠️ read this before designing §1

**The Variables nodes have already built two-thirds of this contract under different names**, and
nobody wrote it down. `variablebase.ts`:

- `stored` fires **unconditionally** from the `Set` handler (`:158-162`), including on the path
  where `setValueTo` abstains — this is exactly the contract's universal **`Completed`**.
- `changed` fires **only** when the value actually differs (`:224-232`) — this is **`Done`**.
- The no-change case is expressed as the *absence* of `changed` — this is the **`Unchanged`** gap,
  in the one family that had already thought about it.

Four nodes (`Boolean`, `Number`, `String`, `Color`) plus `Set Variable` and `Variable2` ship this
shape today. §1 should treat it as the reference implementation of the *mechanism* — and note that
its port names (`stored` for universal-completion, `changed` for did-something) are a third naming
scheme on top of the four in §0.2 Result 2.

### Actions with no legitimate no-op

The remaining actions are network calls, allocations, dispatches and renders — operations that by
construction do work when they run (`Upload File`, `CloudFunction2`, the six `net.noodl.user.*`
nodes, the DB CRUD family, `Unique Id`, `Event Sender`, `net.noodl.HTTP`, `Open File Picker`,
`noodl.cloud.*`). They need `Completed` and keep their existing `Failure`; they get no `Unchanged`
port, per the contract's "a node that cannot be a no-op gets no `Unchanged` port".

**⚠️ This is the one column of §0 stated by class rather than node-by-node.** Each of these was read
at its signal-input entry point; the delegate bodies of the async ones were not read exhaustively.
Anyone extending the `Unchanged` set should re-read the specific node rather than trusting this
paragraph — that is the mistake §0 exists to prevent.

### Actions that emit nothing at all today

From the catalog, confirmed against source. These are the `Completed`-only cases, and **DV-viii's
seven Visual nodes are here** — `ERG-001` owns them, as `NEXT-SESSION-PROMPT.md` reserved:

| Node | Signal input | Emits |
|---|---|---|
| `Router` — Page Router | Reset | nothing (`router.tsx` has **zero** `sendSignalOnOutput`) |
| `Page Stack` — Component Stack | Reset | nothing (`navigation-stack.tsx`, same) |
| `Video` | Play / Pause / Reset / Restart | nothing (`video.ts`, same) |
| `Drag` | two `Do` inputs (snap X, snap Y) | nothing (`drag.ts`, same) |
| `net.noodl.controls.textinput` — Text Input | Set / Clear / Focus / Blur | nothing terminal |
| `Group` | Focus / Scroll To Element / Scroll To Index | scroll failures raise on the error channel (`group.ts:102`, `:121`) but **no signal** |
| `net.noodl.controls.checkbox` — Checkbox | Check / Uncheck | nothing terminal |
| `Page` | Page Ready | an internal `SSR_PageReady` event only (`page.ts:93`) |
| `net.noodl.StateHistory` — State History | Clear History | nothing (`statehistorynode.ts:177-181`) |
| `For Each` — Repeater | Refresh | `Items Rendered` exists but is not tied to the `Refresh` invocation |
| `For Each Actions` — Repeater Item | Remove Completed | `foreachactions.ts:44` — an optional callback, invoked or not, either way silent |

---

## What §1 must decide

§0's job is to surface these, not settle them. Three are genuine decisions, not implementation
detail:

1. **The `Done` wire name.** Four internal names for one display name. Options: (a) rename all four
   to `done` and sweep the in-repo corpora — tractable, `library/prefabs/supabase` is the only
   shipped wire that breaks (`SetModelProperties.stored`), and the fresh-start decision of
   2026-07-30 says legacy projects are not a constraint; (b) key the contract on `displayName` —
   rejected on sight, it makes the contract unreadable to the validator and the AI loop, which is
   most of why it exists; (c) add `done` alongside, leaving two "Done" ports on eight nodes —
   unacceptable. **Recommend (a)**, with the corpus sweep as part of the same commit.
2. **`GlobalStore.Set` and `ActionDispatcher`'s existing `Completed`.** Both currently mean
   "succeeded". Renaming them to `Done` and minting a true universal `Completed` is the honest fix
   and it changes the meaning of existing wires — the same call as (1), on two nodes where the
   change is semantic rather than cosmetic.
3. **`States`' unguarded verbatim output names.** Needs the `Logic Builder` treatment
   (`RESERVED_OUTPUTS` + a reported collision) *before* the reserved names land, or a project with a
   state value called "done" loses an output silently.

## Corpus rows to write before any port is added

Per §0.4 — each red now, with a green control beside it. The discrimination standard is to predict
which rows a revert reddens *before* running it.

| Row | Red now because | Control that must stay green |
|---|---|---|
| Duplicate `Insert Object Into Array` emits `Unchanged`, not `Done` | fires `Done` | a first insert still emits `Done` |
| …and still emits `Completed` | no such port | — |
| `Counter` at `limitsMax` emits `Unchanged` | silent | below the limit still emits `Count Changed` |
| `Switch` `On` when already on emits `Unchanged` | silent | a real flip still emits `Switched` |
| `Undo` at the start of history emits `Unchanged` | silent, by design | a real undo still emits `Undone` |
| `Navigate` to the current page emits `Unchanged` | silent | a real navigation still emits `Navigated` |
| `Video.Play` emits `Completed` | node has no signal outputs at all | — |
| `Router.Reset` emits `Completed` | same | the RT-1/RT-2/RT-3 rows in `nda-012-page-router-reset.test.ts` stay green |
| A `States` node with a value named `done` still exposes that value output | passes now; must not regress | the contract's `Done` on other nodes still registers |

⚠️ **`graph-harness` does not call a module's `setup`.** 45 of the 82 actions are dynamic-port
nodes; any row that depends on the real port set needs the port registered another way. Three
phase-30 findings lived in exactly this gap.

---

## The 82 live actions

Generated from the catalog. `Dyn` marks a node whose real port set is not fully static.

<!-- BEGIN GENERATED TABLE -->

### Animation

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `States` — States | Toggle | Failure (`failure`), State Changed (`stateChanged`) | ⚠️ |

### Cloud Services

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `CloudFunction2` — Cloud Function | Call | Failure (`failure`), Success (`success`) | ⚠️ |
| `net.noodl.user.LogIn` — Log In | Do | Failure (`failure`), Success (`success`) |  |
| `net.noodl.user.LogOut` — Log Out | Do | Failure (`failure`), Success (`success`) |  |
| `DbModel2` — Record | Fetch | Changed (`changed`), Failure (`failure`), Fetched (`fetched`) | ⚠️ |
| `net.noodl.user.RequestMagicLink` — Request Magic Link | Do | Failure (`failure`), Success (`success`) |  |
| `net.noodl.user.SetUserProperties` — Set User Properties | Do | Failure (`failure`), Success (`success`) | ⚠️ |
| `Sign File URL` — Sign File URL | Sign | Failure (`failure`), Success (`success`) | ⚠️ |
| `net.noodl.user.SignInWith` — Sign In With | Do | Failure (`failure`), Success (`success`) |  |
| `net.noodl.user.SignUp` — Sign Up | Do | Failure (`failure`), Success (`success`) | ⚠️ |
| `Upload File` — Upload File | Upload | Failure (`failure`), Progress Changed (`progressChanged`), Success (`success`) | ⚠️ |
| `net.noodl.user.User` — User | Fetch | Changed (`changed`), Failure (`failure`), Fetched (`fetched`) | ⚠️ |

### Cloud

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `noodl.cloud.response` — Response | Send | Failure (`failure`), Sent (`sent`) | ⚠️ |
| `noodl.cloud.sendemail` — Send Email | Do | Failed (`failed`), Sent (`sent`) |  |

### Component Utilities

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `net.noodl.ComponentObject` — Component Object | Fetch | Changed (`changed`), Fetched (`fetched`) | ⚠️ |
| `net.noodl.ParentComponentObject` — Parent Component Object | Fetch | Changed (`changed`), Failure (`failure`), Fetched (`fetched`) | ⚠️ |
| `net.noodl.SetComponentObjectProperties` — Set Component Object Properties | Do | Done (`stored`) | ⚠️ |
| `net.noodl.SetParentComponentObjectProperties` — Set Parent Component Object Properties | Do | Failure (`failure`), Done (`stored`) | ⚠️ |

### CustomCode

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `Expression` — Expression | Run | Failure (`failure`), On False (`isFalseEv`), On True (`isTrueEv`) | ⚠️ |
| `JavaScriptFunction` — Function | Run | Failure (`failure`), Success (`success`) | ⚠️ |
| `Logic Builder` — Logic Builder | Run | Failure (`failure`), Success (`success`) | ⚠️ |

### Data

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `net.noodl.ActionDispatcher` — Action Dispatcher | Cancel All, Dispatch | Cancelled (`cancelled`), Completed (`completed`), Dispatched (`dispatched`), Failed (`failed`), Idle (`idle`), Refused (`refused`) |  |
| `net.noodl.ActionHandler` — Action Handler | Complete, Fail | Failure (`failure`), Trigger (`trigger`) |  |
| `AddDbModelRelation` — Add Record Relation | Do | Failure (`failure`), Success (`relationAdded`) | ⚠️ |
| `Collection2` — Array | Fetch | Changed (`changed`), Fetched (`fetched`) |  |
| `Filter Collection` — Array Filter | Filter, Refresh | Failure (`failure`), Filtered (`modified`) | ⚠️ |
| `Map Collection` — Array Map | Refresh | Failure (`failure`), Changed (`modified`) |  |
| `CollectionClear` — Clear Array | Do | Failure (`failure`), Done (`modified`) |  |
| `CollectionNew` — Create New Array | Do | Done (`created`) |  |
| `NewModel` — Create New Object | Do | Done (`created`) | ⚠️ |
| `NewDbModelProperties` — Create Record | Do | Success (`created`), Failure (`failure`) | ⚠️ |
| `DeleteDbModelProperties` — Delete Record | Do | Success (`deleted`), Failure (`failure`) | ⚠️ |
| `FilterDBModels` — Filter Records | Filter | Failure (`failure`), Filtered (`modified`) | ⚠️ |
| `net.noodl.HTTP` — HTTP Request | Cancel, Fetch | Canceled (`canceled`), Failure (`failure`), Success (`success`) | ⚠️ |
| `CollectionInsert` — Insert Object Into Array | Do | Failure (`failure`), Done (`modified`) |  |
| `net.noodl.JSONStreamParser` — JSON Stream Parser | Clear, Parse | Cleared (`cleared`), Failure (`failure`), Success (`success`) |  |
| `Model2` — Object | Fetch | Changed (`changed`), Fetched (`fetched`) | ⚠️ |
| `net.noodl.OptimisticUpdate` — Optimistic Update | Apply, Commit, Rollback | Applied (`applied`), Committed (`committed`), Failure (`failure`), Rolled Back (`rolledBack`), Timed Out (`timedOut`) |  |
| `net.noodl.PatternExtractor` — Pattern Extractor | Extract | Failure (`failure`), Found (`found`), Not Found (`notFound`) |  |
| `CollectionRemove` — Remove Object From Array | Do | Failure (`failure`), Done (`modified`) |  |
| `RemoveDbModelRelation` — Remove Record Relation | Do | Failure (`failure`), Success (`relationRemoved`) | ⚠️ |
| `For Each Actions` — Repeater Item | Remove Completed | Added (`added`), Try Remove (`tryRemove`) |  |
| `RunTasks` — Run Tasks | Abort, Do | Aborted (`aborted`), Done (`done`), Failure (`failure`), Success (`success`) |  |
| `net.noodl.SSE` — Server-Sent Events | Connect, Disconnect | On Close (`onClose`), On Error (`onError`), On Message (`onMessage`), On Open (`onOpen`) |  |
| `net.noodl.GlobalStore.Set` — Set Global Store | Set | Completed (`completed`), Failure (`failure`) |  |
| `SetModelProperties` — Set Object Properties | Do | Failure (`failure`), Done (`stored`) | ⚠️ |
| `Set Variable` — Set Variable | Do | Done (`done`), Failure (`failure`) | ⚠️ |
| `net.noodl.StateHistory` — State History | Clear History | History Changed (`historyChanged`) |  |
| `net.noodl.StateSnapshot` — State Snapshot | Restore, Save | Failure (`failure`), Restored (`restored`), Saved (`saved`) |  |
| `net.noodl.StreamBuffer` — Stream Buffer | Add, Clear, Flush | Cleared (`cleared`), Failure (`failure`), Flushed (`flushed`), Overflowed (`overflowed`) |  |
| `net.noodl.TextAccumulator` — Text Accumulator | Add, Clear | Changed (`changed`), Cleared (`cleared`), Failure (`failure`), Message Received (`messageReceived`), Overflowed (`overflowed`) |  |
| `net.noodl.StateHistory.Undo` — Undo / Redo | Jump To, Redo, Undo | Failure (`failure`), Jumped (`jumped`), Redone (`redone`), Undone (`undone`) |  |
| `SetDbModelProperties` — Update Record | Do | Failure (`failure`), Success (`stored`) | ⚠️ |
| `Variable2` — Variable | Fetch | Changed (`changed`), Failure (`failure`), Fetched (`fetched`) |  |
| `net.noodl.WebSocket` — WebSocket | Connect, Disconnect, Send | On Close (`onClose`), On Error (`onError`), On Message (`onMessage`), On Message Sent (`onMessageSent`), On Open (`onOpen`), On Reconnect (`onReconnect`) |  |

### Events

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `Event Sender` — Send Event | Send | Failure (`failure`), Sent (`sent`) | ⚠️ |

### Logic

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `Condition` — Condition | Evaluate | On False (`onfalse`), On True (`ontrue`) |  |
| `Switch` — Switch | Flip, Off, On | Switched (`switched`), Switched To Off (`switchedToOff`), Switched To On (`switchedToOn`) |  |

### Math

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `Counter` — Counter | Decrease Count, Increase Count, Reset To Start | Count Changed (`countChanged`) |  |

### Navigation

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `NavigationClosePopup` — Close Popup | Close | Failure (`failure`), Closed (`success`) | ⚠️ |
| `net.noodl.externallink` — External Link | Do | Failure (`failure`), Success (`success`) |  |
| `RouterNavigate` — Navigate | Navigate | Failure (`failure`), Navigated (`navigated`) | ⚠️ |
| `PageStackNavigateToPath` — Navigate To Path | Navigate | Failure (`failure`), Success (`success`) | ⚠️ |
| `PageStackNavigateBack` — Pop Component Stack | Navigate | Failure (`failure`), Popped (`success`) | ⚠️ |
| `PageStackNavigate` — Push Component To Stack | Navigate | Failure (`failure`), Navigated (`navigated`) | ⚠️ |
| `NavigationShowPopup` — Show Popup | Show | Closed (`Closed`), Dismissed (`Dismissed`), Failure (`failure`) | ⚠️ |

### String Manipulation

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `Unique Id` — Unique Id | New | Generated (`generated`) |  |

### Utilities

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `Timer` — Delay | Restart, Start, Stop | Finished (`timerFinished`), Started (`timerStarted`) |  |
| `Open File Picker` — Open File Picker | Open | Cancelled (`cancelled`), Failure (`failure`), Success (`success`) |  |

### Variables

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `Boolean` — Boolean | Set | Changed (`changed`), Stored (`stored`) |  |
| `Color` — Color | Set | Changed (`changed`), Stored (`stored`) |  |
| `Number` — Number | Set | Changed (`changed`), Stored (`stored`) |  |
| `String` — String | Set | Changed (`changed`), Stored (`stored`) |  |

### Visual

| Node | Signal inputs | Signal outputs today | Dyn |
|---|---|---|---|
| `net.noodl.controls.checkbox` — Checkbox | Check, Uncheck | Did Mount (`didMount`), Hover End (`hoverEnd`), Hover Start (`hoverStart`), Blurred (`onBlur`), Changed (`onChange`), Focused (`onFocus`), Pointer Down (`pointerDown`), Pointer Up (`pointerUp`), Will Unmount (`willUnmount`) | ⚠️ |
| `Page Stack` — Component Stack | Reset | Did Mount (`didMount`), Will Unmount (`willUnmount`) | ⚠️ |
| `Drag` — Drag | Do | Did Mount (`didMount`), Drag Moved (`onDrag`), Drag Started (`onStart`), Drag Ended (`onStop`), Will Unmount (`willUnmount`) |  |
| `Group` — Group | Focus, Scroll To Element - Do, Scroll To Index - Do | Did Mount (`didMount`), Focus Lost (`focusLost`), Focused (`focused`), Hover End (`hoverEnd`), Hover Start (`hoverStart`), Click (`onClick`), Scroll End (`onScrollEnd`), Scroll Start (`onScrollStart`), Pointer Down (`pointerDown`), Pointer Enter (`pointerEnter`), Pointer Up (`pointerUp`), Will Unmount (`willUnmount`) | ⚠️ |
| `Page` — Page | Page Ready | Did Mount (`didMount`), Will Unmount (`willUnmount`) | ⚠️ |
| `Router` — Page Router | Reset | Did Mount (`didMount`), Will Unmount (`willUnmount`) | ⚠️ |
| `For Each` — Repeater | Refresh | Items Rendered (`itemsRendered`) | ⚠️ |
| `net.noodl.controls.textinput` — Text Input | Blur, Clear, Focus, Set | Did Mount (`didMount`), Hover End (`hoverEnd`), Hover Start (`hoverStart`), Blurred (`onBlur`), On Enter (`onEnter`), Focused (`onFocus`), Pointer Down (`pointerDown`), Pointer Up (`pointerUp`), Text Changed (`textChanged`), Will Unmount (`willUnmount`) | ⚠️ |
| `Video` — Video | Pause, Play, Reset, Restart | Did Mount (`didMount`), Hover End (`hoverEnd`), Hover Start (`hoverStart`), On Can Play (`onCanPlay`), Click (`onClick`), On Pause (`onPause`), On Play (`onPlay`), Playback Failure (`onPlaybackFailure`), Pointer Down (`pointerDown`), Pointer Enter (`pointerEnter`), Pointer Up (`pointerUp`), Will Unmount (`willUnmount`) | ⚠️ |

<!-- END GENERATED TABLE -->

---

## §1 / §2 — built 2026-08-02

Commits `503941c6` (§1), `9b73b29f` (§2), `689d3176` (the States guard).

**Richard's two decisions, taken 2026-08-02** on the questions this document raised:

1. **Unify the `Done` wire name on `done`**, sweeping the repo. Applied to the Array family here;
   `SetModelProperties`/`net.noodl.Set*ComponentObjectProperties` (`stored`) and `NewModel`
   (`created`) belong to §4, and `library/prefabs/supabase` is the one shipped wire that breaks
   when they move.
2. **Rename `GlobalStore.Set` and `ActionDispatcher`'s existing `Completed` to `Done`** and mint
   the real universal `Completed`. Not yet applied — those two are §4.

### What exists now

- `packages/noodl-runtime/src/outcome.ts` — `outcomeOutputs()`, the declaration side.
- `Node.prototype.beginOutcome()` / `reportOutcome()` — the emit side, so all three runtimes get
  it. The **token**, not the node, carries "has this invocation reported yet", which is what makes
  NV-iii's latched-first-result class unrepresentable and what survives an async action.
- The Array family (`CollectionInsert`, `CollectionRemove`, `CollectionClear`, `CollectionNew`)
  adopted in full, with `done` replacing `modified`/`created`.
- `States` reserves `done`/`unchanged`/`completed` (plus its own `failure`/`stateChanged`) and
  reports a collision, closing §0.2 Result 4's one unguarded surface **before** §4 needs it.
- 14 new corpus rows in `erg-001-outcome-contract.test.ts`, 5 in the States file.

### The discrimination check, predicted then run

| Revert | Predicted | Actual |
|---|---|---|
| Insert always reports `done` | 3 red | **3 red, the same three** |
| drop the `Completed` emit | 11 red / 3 green | 12 red / 2 green |

⚠️ The second was **not** a clean prediction miss: the revert I wrote replaced the
`if (this.hasOutput(COMPLETED_PORT))` condition with `if (false)`, which also switched **on** the
`outcome/missing-completed` raise in the `else` branch. That reddened one extra row — the one
asserting `Unchanged` raises nothing — which is the guard doing its job rather than a row pinning
the wrong thing. Recorded because the phase's standard is to predict before running, and a
prediction that misses deserves the reason.

### Still owed on ERG-001

- **§3** `Treat Unchanged as` — not started.
- **§4** the per-node sweep, which is the bulk. §0's table is its scope.
- **§5** the validator's dead-end check, and `description` coverage for §4's new ports.
- **Live QA.** ⚠️ The viewer bundles under `packages/noodl-editor/src/external/` are **untracked
  build artifacts that nothing rebuilds as part of a test run**, so a deployed app keeps the old
  ports until `npm run build --prefix packages/noodl-viewer-react` runs. Run here on 2026-08-02;
  `viewer/`, `deploy/` and `ssr/noodl.deploy.js` now carry `reportOutcome` and no longer contain
  `sendSignalOnOutput('modified')`.

  ⚠️ **And a trap for whoever checks this next.** `src/external/` also holds
  **`viewer 3/`, `deploy 2/` and `ssr 3/`** — stale duplicates dated 2025-12-06 that no build
  writes to and that `.gitignore` covers along with the rest of `src/external`. Grepping them for
  the new port names says the rebuild failed when it succeeded. The live paths are the unsuffixed
  ones.

### Live QA — run 2026-08-02, editor surface ✅, runtime behaviour ⏳

Driven headlessly against the running editor (`bcn010-live`), after
`npm run build --prefix packages/noodl-viewer-react`.

**What was established, and could not have been by a corpus row:**

| Claim | Evidence |
|---|---|
| The editor's node library carries the contract's ports | `NodeLibraryData` → `CollectionInsert` outputs are `done "Done"`, `completed "Completed"`, `unchanged "Unchanged"`, `failure "Failure"`, `error "Error"` — all `signal` but `error` |
| An **author** can see them before placing the node | The node picker's KEY PORTS panel lists `Done` / `Completed` / `Unchanged` as OUT, "6 of 8" |
| They survive onto the canvas | Node placed through the real picker; its model reports `["Done","Completed","Unchanged","Failure","Error"]` |
| The shipped bundles carry the change | `external/viewer/`, `external/deploy/`, `external/ssr/` all contain `reportOutcome` and no `sendSignalOnOutput('modified')` |

No `[renderer:exception]` and no `outcome/*` error in `.logs/dev.log` for the session.

⏳ **Still owed — success criterion 8 in full.** The criterion asks for *"one graph in the running
editor where a duplicate insert continues through `Completed` and stops at `Done`"*. What is above
is the **editor** half; the running-preview half — wiring `Completed` and watching a second `Do`
pulse it while `Done` stays quiet — was not built. The behaviour itself is pinned by 14 corpus rows
over the real node definitions in a real `NodeContext`, including the ordering and the
per-invocation reset, so this is a gap in the *consequence* claim, not the *mechanism* one — which
is the distinction DV-ii insists on, and the reason it is recorded as owed rather than met.


---

## §4 — built 2026-08-02

Commits `a6a56ed2` → `7c93ce64`. **20 of §0's 82 actions now satisfy the contract** (the four
Array nodes from §2, plus the sixteen below). The register of what remains is at the end.

### The rename is finished (Build 1)

All six nodes from the next-session table, and Richard's two 2026-08-02 decisions are both
applied:

| Node | Was | Is |
|---|---|---|
| `NewModel` | `created` | `done` |
| `SetModelProperties` | `stored` | `done` |
| `net.noodl.SetComponentObjectProperties` | `stored` | `done` |
| `net.noodl.SetParentComponentObjectProperties` | `stored` | `done` |
| `net.noodl.GlobalStore.Set` | `completed` (meant "succeeded") | `done` + a real universal `completed` |
| `net.noodl.ActionDispatcher` | `completed` (per action) | `actionCompleted` + the contract's four |

**⚠️ The `ActionDispatcher` decision, in the open as the prompt asked.** Richard's decision was
"rename the `Completed`-that-means-`Done` to `Done`". On this node that would have replaced one
lie with another, because its `completed` is **per action** and one `Dispatch` of an array of
five produces five of them, minutes apart, long after the invocation ended. So the port keeps
its meaning under a name that says which granularity it is — `actionCompleted` / "Action
Completed" — and the contract's ports are minted beside it. `actionCompleted` rather than
`actionDone` because `Completed` is the word authors already know for this port and a third word
for one fact would be its own cost. The node now reads:

```
Dispatched / Action Completed / Failed / Refused     per action
Done / Unchanged / Failure / Completed               per invocation of Dispatch or Cancel All
```

`Dispatch` is `Done` when anything at all was admitted — a partial admission counts, and the
refused members are on `Refused` with their reason — and `Failure` when nothing was. `Cancel All`
is `Done` when it dropped something and `Unchanged` when there was nothing to drop, a path that
opened `if (!internal.dispatcher) return;`.

### ⚠️ §0.2 Result 5's blind spot, measured properly

The prompt was right that a rename has two sides. Re-swept for the names being *renamed away
from*: **21 wires across 12 files**, where §0 Result 5 listed one. §0's sweep script also read
`sourceId`/`sourcePort` when the on-disk keys are `fromId`/`fromProperty`, so its first
corrected run still reported zero — worth knowing, because a sweep that returns nothing looks
identical whether it is clean or broken.

| Where | Wires |
|---|---|
| `library/prefabs/` (filters, form, multi-choice ×2, pagination, selection-pills, stripe, supabase, tab-bar) | 9 |
| `docs/node-catalog/examples/agent-server-driven-actions.json` | 1 |
| `packages/noodl-editor/tests/testfs/git-repo-utf8/project.json` | 10 |

All migrated as **text, anchored on each source node's id**, so a node type outside the six keeps
its own `stored`/`created`/`completed` (the Variables family's `stored` is untouched). The diff
is 21 lines; `json.dump` was not used.

### DV-viii — five of nine Visual nodes (Build 2a)

`Video`, `Drag`, `Group`, `Checkbox`, `Text Input`. One mechanism, because they share one:
`outcomeOnInnerComponent` wraps `withInnerComponent` and reports from *inside* the queued
action, so `Done` lands after the element has the action. A component that declines returns a
reason string — the shape Group's scroll actions already used — and that becomes `Failure`.

⚠️ The queue's 16-deep cap was the last path on which a Visual action could end in silence. A
discarded entry now reports `Failure` (`visual/action-dropped`).

### §0.3's `Unchanged` register — four of eight (Build 2b)

`Counter` at its limits, `Switch` already in state, `Timer.Start` on a running timer (and
`Stop` with nothing running), `Undo`/`Redo` at the end of history. `Checkbox` was closed with
Build 2a.

Two things found while adopting it:

- **`Undo`'s `setError` deduped the signal, not just the string.** A second identical failure was
  silent — a per-node latch on a per-invocation fact, NV-iii's shape in a different node. The
  signal and the raise moved into `reportOutcome`; the dedupe now guards only the `Error` value.
- **One token per queued action, not per drain.** `Undo` coalesces a frame's presses into one
  scheduled run. Coalescing the work is right; coalescing the outcomes loses invocations.

### The discrimination check, predicted then run — four times, all exact

| Revert | Predicted | Actual |
|---|---|---|
| Checkbox's `Unchanged` back to a bare `return` | 2 red, control green | **2 red** |
| Video back to `withInnerComponent` | 6 red, ports row + cap control green | **6 red** |

(§1/§2's two are recorded above.)

### Live QA — criterion 8 **met in full**, 2026-08-02

The running-preview half that §1/§2 recorded as owed. Built in the running editor against
`bcn010-live`: a real `Button`, an `Object` supplying a fixed id so the second press is a genuine
duplicate, a `CollectionInsert`, and two `Counter`s feeding two `Text` nodes — one behind `Done`,
one behind `Completed`.

| Clicks | Done counter | Completed counter |
|---|---|---|
| 1 | 1 | 1 |
| 2 | **1** | **2** |
| 3 | **1** | **3** |

The duplicate insert continued through `Completed` and stopped at `Done`, in the real app, from
real clicks. No `[renderer:exception]` and no `outcome/*` error in `.logs/dev.log`.

⚠️ Two things worth knowing for the next person driving this:

- The editor **accepted both wires** from `CollectionInsert.done` and `.completed` through the
  real `addConnection` path, which is independent evidence that the ports reached the editor's
  node library as connectable ports and not just as catalog rows.
- `project.setRootComponent(undefined)` throws (`projectmodel.ts:163` dereferences `.graph`), so
  `bcn010-live` was left with `/App` as its home component. Harmless — it is a scratch QA project
  outside the repo, and it previously showed the "no HOME component" error page.

### What remains of §0's 82 — the honest register

**20 done.** The four Array nodes (§2), the six of Build 1, the five Visual, plus `Counter`,
`Switch`, `Timer`, `Undo / Redo` and `Checkbox` — Checkbox counted once.

Still owed, in the order the next slice should take them:

| Remaining | Why it was not done here |
|---|---|
| `Router` and `Page Stack` — `Reset` | `resetAsync` is async through an `asyncQueue`, and `reset()` is *also* called on mount by `RouterHandler`/`navigation-handler`, which is not an invocation of the `Reset` input. The token has to travel and the mount path must report nothing. Real design, not a sweep. |
| `RouterNavigate` — `Navigate` to the current page | §0.3's entry, and entangled with the Router work above (`router.tsx:401-410`). |
| `Page` — `Page Ready`, `State History` — `Clear History` | Small; grouped with the navigation slice because they share the file set. |
| `net.noodl.WebSocket`, `net.noodl.SSE` — `Disconnect` | §0.3 lists only the disconnect-when-not-connected path, but Rule 1 covers *every* action and these nodes' `Connect`/`Send` are async with outcomes that need designing. Adopting one input and not the others is exactly the per-node divergence `outcome.ts` warns about. |
| `For Each` / `For Each Actions` | §0's "emits nothing at all" table, not yet read. |
| the other ~57 actions | The bulk of §4, by category. |
| **§3** `Treat Unchanged as` | Not started. ⚠️ A declared `default` does not run its setter — FINDINGS **A-D1**. |
| **§5** the validator's dead-end check | Not started. `description` is present on every port added here. |

⚠️ **`GlobalStore.Set` has an unmeasured `Unchanged` candidate.** `setKey` ends in `Model.set`
without `forceChange`, which does not notify when the value compares equal — so re-writing a key
with the value it already holds is a real no-op of exactly the shape §0.3 collects. Not added:
`setKey` returns `void`, detecting it means changing that signature and reasoning about `merge`,
and §0.3 never measured this node. Deriving the verdict from the shape of the code is the mistake
§0.3 exists to prevent.

⚠️ **`Counter`'s `Reset` guard reads `this.currentValue` and has never fired** (PLAT-003 NOTES
§25). Left verbatim: repairing it changes when `Count Changed` fires, which is a behaviour change
dressed as a rename.

### Gates — measured before and after

| Gate | Before | After |
|---|---|---|
| `noodl-runtime` jest | 94 suites, 1767 passing, 13 skipped | **96 suites, 1789 passing, 13 skipped** |
| `noodl-viewer-react` jest | 51 suites, 598 passing | **52 suites, 627 passing** |
| `typecheck:runtime` | pass | pass |
| viewer-react `tsc` | pass | pass |
| `typecheck:cloud` | pass | pass |
| `catalog:check` | pass | pass |
| `catalog:merge:check` | pass | pass |
| `cloud-library:check` | pass | pass |
| editor `test:ci` | 2007 specs, 0 failures | **2007 specs, 0 failures** |

0 failures and no new warnings throughout. 45 corpus rows added across four files.

---

## §4, the navigation slice — built 2026-08-02

Commits `46be4922` (the build) and `4c276139` (the catalogs). **27 of §0's 82 actions now satisfy
the contract**, up from 20.

The slice was scoped at five nodes and shipped seven. `PageStackNavigate` and
`PageStackNavigateBack` were pulled in because the `Done` rename could not honestly stop at one
node of a family — see "the rename, and why it had to be all three" below.

### The seven, and the shape each got

| Node | Signal input | Ports |
|---|---|---|
| `Router` — Page Router | `Reset` | `done` · `unchanged` · `failure` ×4 · `completed` |
| `Page Stack` — Component Stack | `Reset` | `done` · `failure` ×2 · `completed` — **no `Unchanged`** |
| `RouterNavigate` — Navigate | `Navigate` | `done` (was `navigated`) · `unchanged` · `failure` · `completed` |
| `PageStackNavigate` — Push Component To Stack | `Navigate` | same four (`done` was `navigated`) |
| `PageStackNavigateBack` — Pop Component Stack | `Navigate` | same four (`done` was `success`) |
| `Page` | `Page Ready` | `done` · `completed` |
| `net.noodl.StateHistory` | `Clear History` | `done` · `unchanged` · `completed` — **no `Failure`** |

### The three hard things about `Reset`, and how each was answered

1. **`reset()` is called on mount.** `router-handler.ts:83` and `navigation-handler.ts:90,106`
   call it so the start page is created, and that is not the author's `Reset` port. The token is
   **optional** and is minted only in the input handler, so the mount path reports nothing —
   while still raising the NDA-012 diagnosis, which is the only time an unconfigured Router is
   ever seen. `_reportReset` is the one place that branch lives, on both nodes.
2. **It is async through an `ASyncQueue`.** The token rides `scheduleReset` → `reset` →
   `resetAsync` and survives `await createNode`. This is the case `beginOutcome`'s token shape
   was designed for and the first one to actually need it.
3. **Four raise-and-return paths already existed.** Each now passes its code *through*
   `reportOutcome`; the separate `raiseRuntimeError` is gone. A corpus row asserts
   `raises.map(r => r[0])` **equals** one code, not contains it, because the failure mode here is
   two events for one drop.

⚠️ **`Done` versus `Unchanged` on a Router `Reset` is decided by the parameters.** The
already-showing branch updates the Page Inputs when the params differ, and that is a real change,
so it reports `Done`; identical params report `Unchanged`. Folding both into `Unchanged` would
have been the `Insert Object Into Array` lie with the sign flipped.

### ⚠️ Three measured corrections to what the specs said

**1. §0.3's `RouterNavigate` row cites the wrong method.** It records "`Navigate` to the current
page" against `router.tsx:401-410` — which is **`resetAsync`**, not `navigateAsync`. Measured:
`_navigateInCurrentWindow` had *no* already-showing check at all. Re-selecting the page already
on screen did not return silently; it **destroyed the page component and built a fresh one**,
losing its state on a click that should have done nothing. That is NDA-008 §2's Component Stack
finding, unfixed on the Router side. The check is added here, with params part of the question so
`/product/{id}` navigated to twice with different ids still rebuilds.

**2. NDA-008 §2's no-op branch was already reporting the wrong thing.** It called `hasNavigated`
and said so out loud — "swallowing the completion callback here would turn a re-selected tab into
a dead button". Right instinct, and with two callbacks available it was the best answer; it is
also `Insert Object Into Array`'s lie in a second node. Both copies (`navigateAsync` and
`replaceAsync`) now call `hasUnchanged`.

**3. The prompt's expectation that `catalog:merge:check` catches a rename is wrong.** It passed
with `routernavigate.json` and `pagestacknavigate.json` still describing a `navigated` port the
nodes no longer had. An enrichment `ports` entry naming a port that does not exist is accepted
silently. The enrichment sweep has to be done by hand — recorded in `4c276139`.

### The rename, and why it had to be all three

§0.2 Result 2 found eight ports displaying "Done" under four wire names. The navigation family
carried a fifth and a sixth: `navigated` on both Navigate nodes and `success` (displaying
"Popped") on the Pop node. Richard's 2026-08-02 decision — unify on `done` — applies to a family
or to none of it, so renaming `RouterNavigate` alone would have manufactured exactly the
per-node divergence `outcome.ts`'s docstring exists to prevent. That is why the slice grew from
five nodes to seven.

⚠️ **`Done` is present on the navigating path rather than absent.** The next-session prompt said
to leave it off and emit only on the paths that do not navigate. That was a fair reading of the
contract's exception, and it was not taken, for one reason: Rule 2 says `Completed` is "the one
port with no exemption", and a `Completed` that is silent on the *most common* path — a
successful navigation from a nav bar **outside** the Router, where the node demonstrably
survives — defeats the rule's entire value. The terminality is documented in `done`'s
description instead of being expressed as a missing port.

**The two-sided sweep found one wire**, in `packages/noodl-editor/tests/testfs/git-repo-utf8/`.
⚠️ The sweep script was sanity-checked against Build 1's 19 already-migrated wires before its
answer was believed, because §0's own sweep returned zero from a broken query and a clean sweep
looks identical to a broken one.

### Two deliberate omissions, both the contract being followed rather than skipped

- **`Page Stack` gets no `Unchanged`.** `resetAsync` tears every child down and rebuilds
  unconditionally; a reset landing on the component already showing still destroys and recreates
  it. "A node that cannot be a no-op gets no `Unchanged` port" — and §5's dead-end check would
  be right to complain about a port that can never fire.
- **`State History` gets no `Failure`, and a pinned control is what established that.** The first
  version of this adoption minted one for the untracked-store path; NDA-004's *"(pinned control)
  State History deliberately has no Failure port"* reddened, and its comment had predicted
  exactly this — *"this row is what stops a later mechanical sweep finishing the family off"*.
  It is right: this node **is** the tracker for its own store name, so `not-tracking` is only
  reachable as a one-frame attach race, and raising at an author whose graph is correct is what
  the contract says trains people to ignore the port. It reports `Unchanged`.

### ⚠️ One deliberate behaviour change

A **Pop at the root of the stack is `Unchanged`**, where NDA-008 §3 made it a `Failure` with a
code and a message. Build 2b made `Undo` at the beginning of history `Unchanged` on the
contract's reasoning that "a `Failure` that fires on a graph working exactly as written is how
authors are trained to ignore the port", and a Back button on the root component is that graph.
`StackBackResult` gained an `{ok: false, unchanged: true}` arm to carry it. The
transition-in-progress case stays a `Failure` — a dropped tap is not something the author asked
for.

### Also changed: `stateHistoryManager.clearHistory` returns a result

It was `void`, and `if (!record) return` collapsed three outcomes into one silence. This is the
same shape as the note §4 left open against `GlobalStore.Set`, and it was safe to take here for
the reason that note gives for *not* taking it there: the manager is internal to this pair of
nodes and every caller is in the repo.

### The discrimination check, predicted then run — four times, all exact

| Revert | Predicted | Actual |
|---|---|---|
| `Router`'s `Reset` input mints no token | 1 red — the input→token row only; every other Router row calls `resetAsync` directly | **1 red, that row** |
| `Router`'s already-showing branch back to a bare `return` | 2 red — the `Unchanged` row and the params-`Done` row | **2 red, those two** |
| `_navigateInCurrentWindow`'s already-showing check removed | 1 red — the re-selection row; the different-params control stays green | **1 red, that row** |
| `back()`'s root case back to a coded failure | 1 red — the stack-shape row only; the node-side rows feed the shape directly | **1 red, that row** |

43 corpus rows added across two new files (`erg-001-navigation-outcomes.test.ts`,
`erg-001-state-history-clear.test.ts`); `nda-004-navigation-failure.test.ts` and
`mute-node-completion.test.ts` updated for the rename and the extra pulse.

### Live QA — the mount-path claim, which no corpus row can make

Navigation is the one family where a corpus row cannot see the consequence, because the point is
that the page goes away. Driven headlessly against `bcn010-live` after
`npm run build --prefix packages/noodl-viewer-react`; all three shipped bundles (`external/viewer`,
`external/deploy`, `external/ssr`) carry `reportOutcome` and no longer contain
`sendSignalOnOutput('navigated')`.

**The editor surface**, straight off `NodeLibraryData`:

```
Router                 -> [done, completed, unchanged, failure]
Page Stack             -> [done, completed, failure]           <- no unchanged, as designed
RouterNavigate         -> [done, completed, unchanged, failure]
PageStackNavigate      -> [done, completed, unchanged, failure]
PageStackNavigateBack  -> [done, completed, unchanged, failure]
Page                   -> [done, completed]
net.noodl.StateHistory -> [done, completed, unchanged]         <- no failure, as designed
```

Every wire was accepted through the real `addConnection`, which is independent evidence the ports
reached the editor's node library as **connectable** ports and not merely as catalog rows.

**The running preview** — a real `Page Router` over `/PageA` and `/PageB`, a real `Navigate`, a
real `Button`, and counters behind `Done` / `Unchanged` / `Completed` living *outside* the Router
so they survive the navigation. Real clicks:

| | page | Done | Unchanged | Completed | raw clicks |
|---|---|---|---|---|---|
| **boot** | PAGE A | **0** | **0** | **0** | 0 |
| click 1 | PAGE B | 1 | 0 | 1 | 1 |
| click 2 | PAGE B | **1** | 1 | 2 | 2 |
| click 3 | PAGE B | **1** | 2 | 3 | 3 |

The boot row is the one that matters: the mount reset built PAGE A and reported **nothing**. And
the `Reset` port, on the same app:

| | page | Reset `Done` | Reset `Unchanged` |
|---|---|---|---|
| boot | PAGE A | 0 | 0 |
| press RESET | PAGE A | 0 | 1 |
| press RESET | PAGE A | 0 | 2 |
| press GO B | PAGE B | 0 | 2 |
| press RESET | **PAGE A** | **1** | 2 |

The same button reports `Unchanged` twice and then `Done` when the reset genuinely rebuilds —
the discrimination the contract exists for, over a URL round-trip no corpus row could stage. No
`[renderer:exception]` and no `outcome/*`, `router/*` or `navigate/*` error in `.logs/dev.log`.

⚠️ **Two traps for whoever drives this next.**

- **A root component renders one visual root tree.** Five sibling visual roots put only the first
  on screen, silently. Everything visual has to hang off one `Group`.
- **`removeConnectionsForNode` is per node, so rebuilding half a rig leaves the other half's
  wires behind.** Three duplicate wires made one click look like two invocations, and the first
  reading of the table above was doubled across the board. A raw click-counter wired straight off
  the Button is what separated "the node reports twice" from "the rig has two wires" — worth
  building before believing any count.

### Gates — measured before and after

| Gate | Before | After |
|---|---|---|
| `noodl-runtime` jest | 96 suites, 1789 passing, 13 skipped | **97 suites, 1795 passing, 13 skipped** |
| `noodl-viewer-react` jest | 52 suites, 627 passing | **53 suites, 664 passing** |
| `typecheck:runtime` | pass | pass |
| viewer-react `tsc` | pass | pass |
| `typecheck:cloud` | pass | pass |
| `catalog:check` | pass | pass |
| `catalog:merge:check` | pass | pass |
| `cloud-library:check` | pass | pass |
| editor `test:ci` | 2007 specs, 0 failures | **2007 specs, 0 failures** |

0 failures and no new warnings throughout.

### What remains of §0's 82 — the register, updated

**27 done.** The 20 of the previous builds, plus `Router`, `Page Stack`, `RouterNavigate`,
`PageStackNavigate`, `PageStackNavigateBack`, `Page` and `net.noodl.StateHistory`.

**Both of the two named debts the contract was written to answer are now closed**: DV-viii's
Visual table and §0.3's `Unchanged` register have no navigation entries left. What is left of §4
is a sweep with no design in it.

| Remaining | Note |
|---|---|
| `net.noodl.WebSocket`, `net.noodl.SSE` | §0.3 names only the disconnect-when-not-connected path, but Rule 1 covers every action, so `Connect` and `Send` need deciding at the same time. ⚠️ Both async. |
| `For Each` / `For Each Actions` | §0's "emits nothing at all" table, still not read. |
| the other ~53 actions | The bulk of §4, by category. Disjoint file sets per worker; catalog and enrichment merged centrally. |
| **§3** `Treat Unchanged as` | Not started. ⚠️ A declared `default` does not run its setter — FINDINGS **A-D1**. |
| **§5** the validator's dead-end check | Not started. `description` is present on every port added here. ⚠️ It must not flag `Page Stack`'s missing `Unchanged` or `State History`'s missing `Failure` — both are the contract's exemptions, not gaps. |

Still open and still unmeasured, carried forward verbatim from the previous build:

⚠️ **`GlobalStore.Set` has an unmeasured `Unchanged` candidate.** `setKey` ends in `Model.set`
without `forceChange`, so re-writing a key with the value it already holds is a real no-op.
Adding it means changing `setKey`'s `void` return and reasoning about `merge`. §0.3 never
measured this node; deriving the verdict from the shape of the code is what that section exists
to prevent.

⚠️ **`Counter`'s `Reset` guard reads `this.currentValue` and has never fired** (PLAT-003 NOTES
§25). Left verbatim: repairing it changes when `Count Changed` fires, which is a behaviour change
dressed as a rename.

---

## §4, the long tail — three builds, 2026-08-02

Commits `537b14aa` + `58c2dfb5` (streaming), `f3a4a1a9` (Repeater), `fcf52c14` (Variables).
**34 of §0's 82 actions now satisfy the contract, up from 30.**

⚠️ **The previous entry's "27" was an arithmetic slip.** Its own enumeration — four Array
nodes, six of Build 1, five Visual, `Counter`/`Switch`/`Timer`/`Undo`, seven navigation — lands
on 26, with `Checkbox` counted twice in the prose. Every number in this section is **measured**
against `packages/noodl-types/src/node-catalog.json` (a node counts as adopted when it publishes
`completed`) rather than counted from prose; the script is eight lines and worth re-deriving
rather than trusting a running total.

### The eight nodes, and the shape each got

| Node | Signal inputs | Ports |
|---|---|---|
| `net.noodl.WebSocket` | `Connect`, `Disconnect`, `Send` | `done` · `unchanged` · `failure` ×5 · `completed` |
| `net.noodl.SSE` | `Connect`, `Disconnect` | `done` · `unchanged` · `failure` · `completed` |
| `For Each` — Repeater | `Refresh` | `done` · `failure` ×3 · `completed` — **no `Unchanged`** |
| `For Each Actions` — Repeater Item | `Remove Completed` | `done` · `unchanged` · `completed` — **no `Failure`** |
| `String` · `Number` · `Boolean` · `Color` | `Set` | `done` · `unchanged` · `completed` — **no `Failure`**, and `Stored` removed |

### Build 1 — the streaming pair, and why `Connect` settles late

§0.3 measured one path here (`Disconnect` when nothing is connected) but Rule 1 covers every
action, so `Connect` and `Send` were decided at the same time.

`Connect` is async and reuses the navigation slice's token shape: `pendingConnect` is
**optional**, minted only in the input handler, so auto-connect and the url-change rebuild report
nothing. It settles at the **first terminal state** — `open` → `Done`, `error` → `Failure` —
which means a first attempt that drops and a retry that then opens is **one `Done`**, not a
`Failure` followed by a `Done`. The alternative would end an author's chain dead on a connection
that is, in the end, open, which is the class this contract closes. A `Connect` superseded by a
later `Connect`, a `Disconnect` or a url change is `Unchanged`, not `Failure` — the author asked
for it.

⚠️ **The one honest cost, recorded rather than hidden:** a `Connect` that retries for ever
(`Auto Reconnect` on with an unlimited retry budget) stays pending and reports nothing until it
opens, gives up, or is superseded. `Max Retries` and `Auto Reconnect` are what bound it.

`Send` needed the connection to say *why* a value did not reach the socket, so
`WebSocketConnection.send` returns a named result instead of a boolean.

- **queued → `Done`.** The postcondition of `Send` is "the value is owed to the wire", and a
  queued message is owed. `Queue Size` and `On Message Sent` distinguish "accepted" from
  "written".
- **policy `Drop` → `Unchanged`.** The author configured it; a `Failure` firing on a graph
  working exactly as written is how authors are trained to ignore the port.
- **five refusals → `Failure`,** each with its own code.

`SseConnection.disconnect` and `WebSocketConnection.disconnect` likewise return whether they
closed anything — the step `stateHistoryManager.clearHistory` took in the navigation slice, safe
for the same reason: both classes are internal to their node and every caller is in the repo.

### Build 2 — the Repeater, and a defect found by building it

⚠️ **`Items Rendered` could not be made into `Refresh`'s `Done`.** It fires whenever the
operation queue drains having done work, which includes a collection `add` and the initial bind.
It is a list-level announcement, and it is the right one; it is simply not tied to any
invocation. `Refresh` reports at the end of `refresh()`'s own async body instead.

⚠️ **No `Unchanged` on the Repeater, and the empty list is the reason.** The tempting
`Unchanged` is "you refreshed a list that was empty and still is" — and taking it would put the
*common* empty case on a different wire from the common non-empty one, which is `Run Tasks`'
defect with the sign flipped. `Page Stack`'s exemption, for the same reason. `refresh()`'s one
combined early return is split in three so each refusal names itself (`repeater/no-template`,
`repeater/no-items`, `repeater/no-target`).

`For Each Actions` **never cleared its `removeCompletedCallback`**, so a second
`Remove Completed` called the Repeater's callback again — NV-iii's latch, in the node whose whole
job is a one-shot handshake.

⚠️ **FILED, NOT FIXED — measured, not inferred.** `Items Rendered` fires with **zero item nodes
existing** after a `Refresh`. `_queueOperation` is handed `() => { this.refresh(); }`, whose block
body drops the promise, so `_runQueueOperations`' `await op()` returns immediately and the queue
drains while the rebuild is still awaiting `addItem` per item. Probed directly:

```
[{"signal":"itemsRendered","items":0},{"signal":"done","items":3},{"signal":"completed","items":3}]
```

That is the defect NDA-004 §3 added the port to prevent, still live on one of the two paths into
a rebuild. A corpus row pins the measured ordering; repairing it changes *when* an existing
signal fires, which is a behaviour change and was not this slice's to make. **The one-character
fix is `() => this.refresh()`**, and `Done` is honest about the same moment until someone takes it.

### Build 3 — the Variables family, and the first port that already *was* `Completed`

The node had computed the answer since NDA-002 §3 — `setValueTo`'s `changed` guard — and thrown
it away by returning `void`.

⚠️ **`Stored` is removed rather than renamed.** It fired after every `Set` whatever happened,
which is exactly what Rule 2 promises, so it is the one port in the library whose meaning was
already `Completed`. §0.2 Result 3 found the mirror image twice — a `Completed` that meant
"succeeded" — and those had to be renamed because adopting the reserved name in place would have
inverted a wire an author had drawn. Here the name fits, so keeping both would have shipped two
ports that always fire together. Renaming it to `done` would have been the other lie, because
`done` must mean "changed something".

The two-sided sweep found **no wire to `stored` on any of these four**. The four hits are on the
deprecated `Variable` node — a different type — inside 2020 merge-algorithm golden fixtures,
which are not live graphs and must not be edited.

⚠️ **With `Value` left ticked under Run On Value Change (the default), a `Set` can only ever
report `Unchanged`,** because NDA-017 §2 made `Set` additive and `Value` has already stored by
the time it fires. That is measured as its own corpus row rather than designed around, and it is
what the live run below shows.

### ⚠️ Three corrections to the recipe, all found the hard way

**1. `m.addConnection` accepting a wire proves nothing.** The previous entry recorded it as
"independent evidence the ports reached the editor's node library as connectable". It is not:
the first live rig wired `Counter.increaseCount` and `Counter.count`, **neither of which exists**
(the real names are `increase` and `currentCount`), and `addConnection` accepted all of them
silently. The rig then read as "the node reports nothing" when the truth was "the wires go
nowhere". **The raw counter wired straight off the Button is what caught it** — it read 0 after
four clicks, which no node-side defect could explain. Check port names against `NodeLibraryData`
before believing a rig.

**2. A rename must be swept in *source*, not only in project files — and that is how this one
got half-done.** The `stored` sweep read every `.json` in the repo, found the four hits were on a
deprecated node in 2020 merge fixtures, and concluded it was safe. It was not: **five SUB-006
validator specs build their graphs inline in TypeScript** and wired `stored` as the source port
of a `Boolean`/`Number`. The editor gate went to **5 failures** and only the final full run
caught it (`9b4cf2bd`). Four rigs asserting "0 errors" got 1, and the AI-fixability rig found the
*output's* `NonexistentPort` diagnostic before the input's and read the wrong alternatives list.
⚠️ **An intermediate `test:ci` run had been captured with `tail -4`, which cut off the Jasmine
summary line — so the gate looked green when it had never been read.** Capture the summary, not
the tail.

**3. `catalog:merge:check` still does not catch a stale enrichment entry, and this session hit it
twice.** All four Variables enrichment files described the removed `stored` port and every check
passed. Worse, the *inverse* also passes: an `unchanged` entry written for a port `For Each`
deliberately does not have reached `node-catalog-enriched.json` and had to be removed by hand.
**Grep `docs/node-catalog/enrichment/` against the real port set, in both directions.**

### The discrimination check — twelve reverts, eleven exact

| Revert | Predicted | Actual |
|---|---|---|
| WS `Disconnect` reports `done` unconditionally | 2 | **2, those two** |
| WS `Connect` token minted on the auto-connect path too | 7 | **7, those seven** |
| WS connect token settled at the first *attempt* failure | 1 | **1, that row** |
| WS `Send` reports `done` for a policy drop | 1 | **1, that row** |
| SSE `doDisconnect` always claims it closed something | 2 | **2, those two** |
| Repeater `Refresh` token minted in `scheduleRefresh` | 2 | **7 — wrong, see below** |
| Repeater no-items branch reports `done` | 1 | **1, that row** |
| `Remove Completed` does not clear the callback | 1 | **1, that row** |
| empty rebuild reports `unchanged` | 2 | **2, those two** |
| Variable `Set` reports `done` unconditionally | 9 | **9** |
| Variable `setValueTo` ignores `hasBeenSet` | 3 | **3** |
| Variable token moved from `Set` into `setValueTo` | 6 | **6** |

⚠️ **The one miss is recorded rather than tidied away.** Moving the Repeater's mint into
`scheduleRefresh` reddens seven rows, not two, because *every* setter on that node schedules a
refresh: a row that binds `Items` and then pulses `Refresh` gets two outcomes where it asserted
one. The claim "only the port mints" is therefore load-bearing across the whole file, not just in
the two rows written to state it — a stronger result than the prediction expected, which is why
the miss is worth more than a corrected prediction would have been.

### Live QA — the rig, and the two things no corpus row can show

Driven headlessly against `bcn010-live` after `npm run build --prefix packages/noodl-viewer-react`.
All three shipped bundles (`external/viewer`, `external/deploy`, `external/ssr`) carry
`reportOutcome` and the new failure codes.

**The editor surface**, straight off `NodeLibraryData` — `stored` gone from all four Variables:

```
net.noodl.WebSocket -> [done, completed, unchanged, failure]
net.noodl.SSE       -> [done, completed, unchanged, failure]
For Each            -> [itemsRendered, done, completed, failure]   <- no unchanged, as designed
For Each Actions    -> [done, completed, unchanged]                <- no failure, as designed
String/Number/Boolean/Color -> [changed, done, completed, unchanged]   stored? false
```

**The running preview** — a real `String` Variable with `Value` unticked under Run On Value
Change, `Set` wired to a real Button, counters on `Done` / `Unchanged` / `Completed` and a raw
click counter wired straight off the Button. Real clicks:

| | raw clicks | Done | Unchanged | Completed |
|---|---|---|---|---|
| **boot** | 0 | **0** | **0** | **0** |
| clicks 1–4, same value | 4 | **0** | **4** | 4 |
| change `Value`, no click | 4 | 0 | 4 | **4** |
| click 5, new value | 5 | **1** | 4 | **5** |

Three claims a corpus row cannot make. The boot row: nothing reported before any invocation. The
value-change row: writing `Value` with the checkbox unticked reports **nothing at all** — the
mount-path rule, live. And the same button reports `Unchanged` four times then `Done` when the
value genuinely differs, which is the discrimination the contract exists for. **`Completed`
equals the raw click count on every row** — Rule 2, proved live.

And the Repeater, with no `Items` bound:

| REFRESH click | Done | Failure | Completed |
|---|---|---|---|
| 1 | 0 | **1** | 1 |
| 2 | 0 | **2** | 2 |

No `[renderer:exception]` and no `outcome/*`, `repeater/*`, `websocket/*` or `sse/*` error in
`.logs/dev.log`.

⚠️ **One thing the live run did *not* confirm:** that the failure *code* reaches the editor's
warnings panel. The panel was closed and no `WarningsModel` handle was reachable from the
renderer; in the editor the error bus routes to the editor subscriber rather than the console, so
`.logs/dev.log` is silent by design. The corpus rows assert the codes on the error bus directly,
which is the FAILURE-CONTRACT's own observable — but the panel rendering is unverified for these
four codes.

### Noise, measured rather than asserted

`noodl-runtime`'s jest emitted **242** `console.error` blocks before this session and **250**
after: eight new lines, each one the NDA-004 channel carrying a `Failure` that a row explicitly
asserts (`websocket/connect-failed` ×3, `sse/connect-failed` ×2, `websocket/not-connected`,
`websocket/nothing-to-send`, `websocket/queue-full`). That is the contract working, not stray
noise, and it is stated as a delta rather than as "no new noise".

### Gates — measured before and after

| Gate | Before | After |
|---|---|---|
| `noodl-runtime` jest | 97 suites, 1795 passing, 13 skipped | **99 suites, 1843 passing, 13 skipped** |
| `noodl-viewer-react` jest | 53 suites, 664 passing | **54 suites, 678 passing** |
| `typecheck:runtime` | pass | pass |
| viewer-react `tsc` | pass | pass |
| `typecheck:cloud` | pass | pass |
| `catalog:check` | pass | pass |
| `catalog:merge:check` | pass | pass |
| `cloud-library:check` | pass | pass |
| editor `test:ci` | 2007 specs, 0 failures | **2007 specs, 0 failures** (5 failures first — see correction 2) |

62 corpus rows added across three files.

⚠️ **The `noodl-runtime` "after" figure is this slice's own work, measured at `fcf52c14`.** A
re-run now reports **100 suites, 1859 passing**, because the concurrent phase-36 session merged
`OBS-001`'s trace substrate (`193419fc`) into this branch in between. Attribute before you
compare — two sessions commit to `cline-dev` from this checkout.

### What remains of §0's 82 — measured

**34 done. 48 remain**, and there is still no design in most of them.

| Remaining | Count | Note |
|---|---|---|
| **Cloud Services** | 11 | Every one already has `Success`/`Failure`; mostly a rename to `done` plus a real `completed`. `Record`/`User` also carry `Changed`/`Fetched`, which are value-level events like `Items Rendered` — do not fold them in. |
| **Data** | 20 | The largest block. `HTTP Request`, `Optimistic Update`, `Stream Buffer`, `Text Accumulator` and `Run Tasks` are multi-action; the rest are single-action renames. |
| **CustomCode** | 3 | ⚠️ `Logic Builder` registers block names verbatim — FINDINGS **SR-ix**, the collision is live and silent. Read NDA-004 §3 before touching it. |
| **Cloud** | 2 | `Response`, `Send Email`. |
| **Component Utilities** | 2 | `Component Object`, `Parent Component Object` — `Fetch`. |
| **Navigation** | 4 | `Close Popup`, `External Link`, `Navigate To Path`, `Show Popup`. ⚠️ `Close Popup` is NV-iii's original latch. |
| **Animation / Events / Logic / String / Utilities** | 6 | `States`, `Send Event`, `Condition`, `Unique Id`, `Open File Picker`. ⚠️ `Condition` has no completion path at all today. |
| **§3** `Treat Unchanged as` | — | Not started. The Variables family is now the obvious first home: it already carries `Treat empty as` in exactly this shape. ⚠️ A declared `default` does not run its setter — FINDINGS **A-D1**. |
| **§5** the validator's dead-end check | — | Not started. ⚠️ It must not flag `Page Stack`'s and `For Each`'s missing `Unchanged`, or `State History`'s, `For Each Actions`' and the Variables' missing `Failure` — all are the contract's exemptions, each recorded with its reasoning and each with a corpus row asserting the port is **absent**. |

Still open and still unmeasured, carried forward verbatim:

⚠️ **`GlobalStore.Set` has an unmeasured `Unchanged` candidate.** `setKey` ends in `Model.set`
without `forceChange`, so re-writing a key with the value it already holds is a real no-op.
Adding it means changing `setKey`'s `void` return and reasoning about `merge`. §0.3 never
measured this node; deriving the verdict from the shape of the code is what that section exists
to prevent. ⚠️ Note that this session took exactly that step **three** times —
`WebSocketConnection.send`/`.disconnect`, `SseConnection.disconnect`, `setValueTo` — and it was
safe every time for the reason the note gives for *not* taking it there: each class is internal
to one node and every caller is in the repo. `setKey` is not.

⚠️ **`Counter`'s `Reset` guard reads `this.currentValue` and has never fired** (PLAT-003 NOTES
§25). Left verbatim: repairing it changes when `Count Changed` fires.

---

## §4, Cloud Services — built 2026-08-02

Commit `d6dda7bf`. **45 of §0's 82 actions now satisfy the contract, up from 34** — measured with
the script at the bottom of the next-session prompt, against
`packages/noodl-types/src/node-catalog.json`, not counted from prose.

The whole category in one build, because it is one family and §0.2 Result 2's divergence is
manufactured by doing half of one.

### The eleven, and the shape each got

| Node | Action | Shape |
|---|---|---|
| `CloudFunction2` | `Call` | `success`→`done` · `failure` · `completed` (group stays `Signals`) |
| `net.noodl.user.LogIn` | `Do` | `success`→`done` · `failure` · `completed` |
| `net.noodl.user.LogOut` | `Do` (port is named `login`) | same |
| `net.noodl.user.SignUp` | `Do` | same |
| `net.noodl.user.RequestMagicLink` | `Do` | same |
| `net.noodl.user.SetUserProperties` | `Do` | same |
| `Sign File URL` | `Sign` | same |
| `Upload File` | `Upload` | same; `Progress Changed` untouched |
| `net.noodl.user.SignInWith` | `Do` | same — ⚠️ two roles, below |
| `DbModel2` — Record | `Fetch` | `done` **added** · `failure` · `completed`; `Fetched`/`Changed` untouched |
| `net.noodl.user.User` | `Fetch` | same as Record |

**No `Unchanged` on any of the eleven**, and each absence is measured rather than argued. The
tempting one was `Log Out` — "signing out when nobody is signed in" looks like a no-op — but
`ParseAuthAdapter.logOut` POSTs `/logout` unconditionally and clears the session only on the
response. There is no local branch that could report `Unchanged` without changing what the node
does, and a port that can never fire is what §5's dead-end check exists to complain about.

### ⚠️ Why `Fetched` is not the rename, and the cost of that recorded

`Fetched` and `Changed` are value-level announcements, the relationship `Items Rendered` has to
the Repeater's `Refresh`. On `Record` this is **measurable rather than argued**: `setModel` fires
`Fetched` straight from the **`Id` input setter**, where there is no invocation at all — folding it
in would report `Done` for a value binding.

⚠️ **On `User` the two co-fire, and that is a real cost rather than a hidden one.** `User` has no
bind path, so `fetched` and `done` always arrive together today — the "two ports that always fire
together" the Variables slice removed `Stored` to avoid. Keeping both was still the call: `Record`
and `User` are documented twins, and splitting the family so one says `Fetched` and the other
`Done` for the same author gesture is the per-node divergence `outcome.ts`'s docstring exists to
prevent. The co-firing is a property of `User` having one path, not of the ports meaning the same
thing. A corpus row asserts it, including the order.

### ⚠️ One defect fixed, not merely adopted — a dead chain, measured

`ParseAuthAdapter.setUserProperties` wrapped its entire body in `if (_cu !== undefined)` **with no
`else`**, so `Set User Properties` with nobody signed in called **neither** `success` nor `error`.
The node could not report anything and the graph stopped, with no diagnosis anywhere — the
contract's headline class, and the node's own `Do` description had it written down as intended
behaviour ("does nothing at all while nobody is signed in").

`RestAuthAdapter.setUserProperties` has always answered `'Nobody is signed in.'` on that path, so
the fix is the REST twin's sentence verbatim rather than an invention, and it is strictly additive:
no caller can regress on a path that used to call nothing at all. The `Do` description now says
the node fails there.

### ⚠️ `Sign In With` — the one node the contract's real exception applies to

Its own docblock already said it is two things, and the contract splits them:

- **The launcher.** `Do` hands over and `signInWithProvider` sets `window.location.href`; the
  document is replaced, so an accepted handover **reports nothing**. Both refusals (no backend, no
  provider) are raised *synchronously before* `location` is touched, so the token is still open for
  them and they do report.
- **The receiver.** The answer arrives on a *later page load*, in a fresh graph, and
  `applyReturn` mints its own token. ⚠️ This is the one place in the phase where something other
  than a port opens an invocation. It is not the rule's target: "only the port mints" exists to stop
  setter and mount paths *duplicating* a port's outcome, and here there is no port invocation in
  this graph to duplicate — the `Do` that started it ran on a page that no longer exists.
- ⚠️ `inProgress` is a **state**, not a terminal outcome, and mints nothing. A token there would
  still be open when the real answer arrived; a corpus row reads the absence of the resulting
  `outcome/duplicate`.

The navigation slice deliberately kept `Done` on *its* navigating path, and the difference is worth
stating: a `Navigate` in a nav bar **outside** the Router demonstrably survives, so a silent
`Completed` there would have defeated Rule 2. Nothing survives a cross-origin redirect.

### `reportOutcomes`, and why the coalescing guards needed it

Eight of the eleven defer through a `scheduleXxx` boolean that drops the **second** pulse in an
update pass. That is deliberate — it is how "set the fields, then press Do" batches — but it must
not drop the second pulse's *outcome*: two invocations are two invocations.
`foreach.tsx`'s `pendingRefreshOutcomes` is the precedent, and eight more copies of it is the
divergence `outcome.ts` exists to prevent, so the drain is one exported helper. Each node still owns
its own array and takes it into a local **before** the async work starts, so a second `Do` arriving
mid-flight owns its own batch rather than being settled by the first request's answer.

⚠️ **The arrays are created lazily in the `schedule` method, not in `initialize`.** Several suites
build these nodes as a bag of bound methods and never call `initialize`; an eager field is
`undefined` exactly where the first invocation reads it. `record-backend-routing.test.ts` found
this within a minute of the first full run.

### ⚠️ Two corrections to what the phase had recorded

**1. `catalog:merge:check` *does* catch a stale enrichment entry — on a static node.** The standing
note says it does not, full stop. Measured: it flagged four of them by name
(`port note for unknown port "success" on static node`) and was **silent on three more** —
`cloudfunction2`, `setuserproperties`, `signup` — because those are dynamic-port nodes. The note is
right about the gap and wrong about its extent. **The hand sweep is still required, and it is
required specifically for dynamic-port nodes**, which is 86 of 151.

**2. A rename has three places to sweep, and the third one bites differently each time.** Last
session it was inline-TypeScript specs. Here the JSON sweep found **25 wires**, of which 22 were
multi-line connection objects and **one was a single-line one** that the first rewriter silently
skipped — a clean-looking run that had missed a file. The remaining two were in the *generated*
`node-catalog-enriched.json` and regenerated away. ⚠️ The sweep was sanity-checked against six
`Upload File` → `cloudFile` wires known to exist before any zero was believed.

⚠️ Also swept: `docs/node-catalog/examples/user-signup-and-profile.json`'s **prose**, which named
`success` twice in an author-facing description, and `library/prefabs/{oauth2,totp,stripe}` — the
shipped prefab library, 14 wires, which no earlier slice had had to touch.

### The discrimination check — six reverts, four exact

| Revert | Predicted | Actual |
|---|---|---|
| `Record` mints a token in `setModelID` too | 1 — the successful-`Fetch` row, **not** the binding row | **1, that row** |
| `Sign File URL`'s `cloudStore()` opens its own token | **0** | **0** |
| `Set User Properties` mints *after* the coalescing guard | 1 — the two-pulses row | **1, that row** |
| the adapter's new `else` removed | 1 — the adapter row | **1, that row** |
| `Sign In With`'s launcher reports `done` on handover | 1 — the handover-is-silent row | **2 — wrong, see below** |
| `Upload File`'s `progressChanged` through `reportOutcome` | 2 | **1 — wrong, see below** |

⚠️ **Both misses are recorded with the reasoning intact rather than rewritten to match.**

- **The handover revert reddens the *refusal* row too**, which is a stronger result than predicted:
  the corpus settles `signInWithProvider`'s error callback by hand, *after* the handover would have
  reported, so reporting `done` optimistically does not merely add a wrong signal — it spends the
  token and turns every **asynchronous** refusal into an `outcome/duplicate`. The exception is
  load-bearing for the failure path, not just for the success path.
- **The progress revert reddens one row, not two.** The prediction assumed the stored-file row also
  drives progress; it does not — each row has its own stub, and only the progress row calls
  `onUploadProgress`. The wrong half of the prediction was about the *test*, not the product.

⚠️ **The first prediction is the one worth keeping.** Minting in `setModelID` does **not** redden
"binding Id reports no outcome" — the row written to catch exactly that — because a token minted in
a setter is never *settled*, so nothing is reported and the row stays green. What catches it is the
*next* `Fetch`, which drains both tokens and reports `Done` twice. A row that asserts silence cannot
detect a mint; only a row that asserts a later count can.

### Live QA — the rig, and the two things no corpus row can show

Driven headlessly against `bcn010-live` after `npm run build --prefix packages/noodl-viewer-react`.
All three shipped bundles (`external/viewer`, `external/deploy`, `external/ssr`) carry
`reportOutcome` and the new failure codes.

**The editor surface**, straight off `NodeLibraryData` — every one of the eleven:

```
CloudFunction2 / LogIn / LogOut / RequestMagicLink /
SetUserProperties / Sign File URL / SignInWith / SignUp  -> [done, completed, failure]
Upload File                                              -> [done, completed, failure, progressChanged]
DbModel2, net.noodl.user.User                            -> [fetched, changed, done, completed, failure]
```

`success` is gone from all nine that had it; `fetched`/`changed` and `progressChanged` are intact.

**The running preview** — a real `Cloud Function` with no function set, `Call` wired to a real
Button, counters on `Done`/`Failure`/`Completed` and a raw click counter wired straight off the
Button:

| | raw clicks | Done | Failure | Completed |
|---|---|---|---|---|
| **boot** | 0 | **0** | **0** | **0** |
| clicks 1–4 | 4 | 0 | **4** | **4** |

The boot row: nothing reported before any invocation. **`Completed` equals the raw click count**,
which is Rule 2 proved live, and `Done` stays 0 while the action genuinely cannot succeed.

### ⚠️ The warnings panel — the item left open last session, now closed

Last session recorded that whether a failure *code* reaches the editor's warnings panel was
unverified. It does. The topbar chip read **4** after four failures, and opening it shows:

```
No cloud services defined in this project.
At node Cloud Function in component erg001-cloud
```

So the message and its provenance render; the **code** is the key the panel is filed under rather
than something it displays, which is what `createEditorWarningSubscriber` always did. And
`.logs/dev.log` stayed silent, by design — in the editor the bus routes to the editor subscriber
rather than the console, which is why the corpus asserts codes on the bus directly.

### Noise, measured rather than asserted

Counted as `[noodl]` raise lines rather than `console.error` blocks, because the block count double-
counts jest's source echo:

| Suite | Total raises | From this slice's new rows |
|---|---|---|
| `noodl-runtime` | 118 | **5** |
| `noodl-viewer-react` | 195 | **10** |

All fifteen are NDA-004 failures a row explicitly asserts: `sign-file-url/sign-failed` ×2,
`record/storage-op-failed`, `user/fetch-failed`, `user/set-properties-failed`,
`cloud-function/call-failed` ×2, `upload-file/upload-failed` ×2, `user/sign-in-with-failed` ×2,
`user/log-in-failed`, `user/log-out-failed`, `user/sign-up-failed`,
`user/request-magic-link-failed`. No existing path's raise count moved: `setError` used to raise
once and now reports once through `reportOutcome`, with the same code.

### Gates — measured before and after

| Gate | Before | After |
|---|---|---|
| `noodl-runtime` jest | 100 suites, 1859 passing, 13 skipped | **102 suites, 1891 passing, 13 skipped** |
| `noodl-viewer-react` jest | 54 suites, 678 passing | **55 suites, 720 passing** |
| `typecheck:runtime` | pass | pass |
| viewer-react `tsc` | pass | pass |
| `typecheck:cloud` | pass | pass |
| `catalog:check` | pass | pass |
| `catalog:merge:check` | pass | pass |
| `cloud-library:check` | pass | pass |
| editor `test:ci` | 2007 specs, 0 failures | **2007 specs, 0 failures** |

64 corpus rows across two new files. Four existing harnesses gained the **real**
`beginOutcome`/`reportOutcome` rather than doubles — including a `hasOutput` backed by the
definition's declared outputs, so `outcome/missing-port` stays a live check rather than being
answered `true` for a port that does not exist.

⚠️ **`cloudfunction2.test.ts`'s `expect(...).not.toContain('success')` became an exact-array
assertion.** The negative form passes *vacuously* the moment the port stops existing — the trap
this phase was already caught by once, found here by looking for it rather than by a red gate.

⚠️ Two rows in that file poked `doCall` directly, which is the deferred half; they now drive
`scheduleCall`, the method the `Call` port actually reaches. Poking the inner method ran the work
with **no invocation behind it**, which is precisely the state a node must never report from — the
test was asserting against a state the product cannot be in.

### What remains of §0's 82 — measured

**45 done. 37 remain.**

| Remaining | Count | Note |
|---|---|---|
| **Data** | 20 | The largest block and now the obvious next one. `HTTP Request`, `Optimistic Update`, `Stream Buffer`, `Text Accumulator` and `Run Tasks` are multi-action; the rest are single-action renames. ⚠️ `Run Tasks` is the node the contract's own problem statement is about. |
| **CustomCode** | 3 | ⚠️ `Logic Builder` registers block names verbatim — FINDINGS **SR-ix**, the collision is live and silent. Read NDA-004 §3 first. |
| **Cloud** | 2 | `Response`, `Send Email`. |
| **Component Utilities** | 2 | `Component Object`, `Parent Component Object` — `Fetch`. ⚠️ Same `Fetched`-is-not-`Done` question the Record/User twins just answered. |
| **Navigation** | 4 | `Close Popup`, `External Link`, `Navigate To Path`, `Show Popup`. ⚠️ `Close Popup` is NV-iii's original latch. |
| **Animation / Events / Logic / String / Utilities** | 6 | `States`, `Send Event`, `Condition`, `Unique Id`, `Open File Picker`. ⚠️ `Condition` has no completion path at all today. ⚠️ `Open File Picker`'s `success` is referenced by `upload-file`'s enrichment prose and by two `docs/node-catalog/examples` graphs — sweep those when it is renamed. |
| **§3** `Treat Unchanged as` | — | Not started. Variables family first. ⚠️ A declared `default` does not run its setter — FINDINGS **A-D1**. |
| **§5** the validator's dead-end check | — | Not started. ⚠️ Must not flag the contract's exemptions. The **absent-`Unchanged`** list grew by eleven this slice: `Page Stack`, `For Each`, and now every Cloud Services action. Absent `Failure`: `net.noodl.StateHistory`, `For Each Actions`, all four Variables. |

Still open and still unmeasured, carried forward verbatim:

⚠️ **`GlobalStore.Set` has an unmeasured `Unchanged` candidate** — see the previous section. This
slice took the "change an internal collaborator's return type" step **once more**
(`ParseAuthAdapter.setUserProperties`, adding an `else`) and it was safe for a *different* reason
than the ones before it: not that every caller is in the repo, but that the branch called **nothing
at all** before, so no caller could regress. That is a stronger licence than the earlier three had,
and worth separating from them.

⚠️ **`Counter`'s `Reset` guard reads `this.currentValue` and has never fired** (PLAT-003 NOTES
§25). Left verbatim.

⚠️ **`Items Rendered` fires with zero item nodes existing after a `Refresh`** — filed, not fixed,
last session. Still live. The one-character fix is `() => this.refresh()`.

---

## §4, Data — two builds, 2026-08-02

Commits `67d2c339` (+ `3ba66cf9`) and `ba2a815f`. **53 of §0's 82 actions now satisfy the
contract, up from 45** — measured with the script at the bottom of the next-session prompt against
`packages/noodl-types/src/node-catalog.json`, not counted from prose.

### ⚠️ A correction to the previous register's arithmetic

The Cloud Services register said **Data 20** and put six nodes in an
"Animation / Events / Logic / String / Utilities" bucket while naming only five. Measured: **Data
was 21** and that bucket is **5**. The node the register dropped is **`Variable2` — Variable**,
which appeared in neither of the two Data builds the prompt laid out. It is done now, in build 1b,
because it is one of the three `Fetch` twins; but the class of mistake is the one this phase keeps
finding, and it is why the register is generated from the catalog rather than maintained by hand.

### Build 1a — the Record CRUD family, five nodes and **one** funnel

| Node | Action | Old wire | Shape |
|---|---|---|---|
| `NewDbModelProperties` — Create Record | `Do` | `created` | `done` · `failure` · `completed` |
| `SetDbModelProperties` — Update Record | `Do` | `stored` | same, on **both** `Store to` branches |
| `DeleteDbModelProperties` — Delete Record | `Do` | `deleted` | same |
| `AddDbModelRelation` — Add Record Relation | `Do` | `relationAdded` | same |
| `RemoveDbModelRelation` — Remove Record Relation | `Do` | `relationRemoved` | same |

Four of §0.2 Result 2's four spellings of one displayed "Done" are here, which is why the family is
one commit: doing half of it manufactures the divergence the finding is about.

⚠️ **The opposite shape to Cloud Services.** There, eleven nodes each owned their own funnel and the
work was eleven times. Here `dbmodelcrudbase.setError` is *one* funnel reached from four places —
the verb's own error callback, `checkWarningsBeforeCloudOp`, `cloudStoreForScope`, and the relation
nodes' `validateInputs` — and every one of them now settles the **caller's** tokens. The ports are
declared once in `addBaseInfo`; only the `Done` sentence differs, and it arrives as an option
because `addBaseInfo` runs *last* and would clobber anything a node declared for itself.
`pendingOutcomes` / `takeOutcomes` are on the base for the same reason: five copies of
`foreach.tsx`'s array is exactly the divergence `outcome.ts` exists to prevent.

⚠️ **No `Unchanged` on any of the five.** The closest call is **Remove Record Relation**, whose own
description says it succeeds "when the relation was not there to begin with" — the duplicate-insert
shape the contract's problem statement opens with. The backend answers identically either way, so
the node has nothing to tell them apart with, and a port that can never fire is what §5 exists to
complain about. `Update Record`'s `Local only` branch calls `Model.set`, which *does* suppress an
identical value but reports nothing back; recorded as an unmeasured candidate beside
`GlobalStore.Set` rather than given a port that would be guessing.

### Build 1b — the three `Fetch` twins, and Object's dead end

| Node | Action | Shape |
|---|---|---|
| `Collection2` — Array | `Fetch` | `done` **added** · `completed`; no `Failure` |
| `Model2` — Object | `Fetch` | `done` **added** · **`failure` added** · `completed` |
| `Variable2` — Variable | `Fetch` | `done` **added** · `completed`; the existing `Failure` is *not* this port's |

**`Fetched` is added-beside rather than renamed on all three** — the Record/User answer applied a
second time. On **Object** and **Variable** it is *measured*: `fetched` fires inside `setModelID` /
`setVariableName`, which are the `Id` and `Name` **input setters**. ⚠️ On **Array** it is not — its
`fetched` is reached only by the port, so the two always co-fire. **That cost is recorded rather
than hidden**, and it is precisely the cost `User` carries against `Record`: splitting a family of
documented twins so one says `Fetched` where the others say `Done` for the identical author gesture
is the per-node divergence the contract exists to stop.

⚠️ **Object had a real dead end and it is fixed, not merely adopted.** `setModelID` returns early
for `undefined` / `null` / `''` and the file's own comment defends that — *"`Fetched` is not sent on
this path: nothing was fetched"* — which was right as far as it went and left `Fetch` with a blank
`Id` emitting **nothing at all**. NDA-012 had already measured those spellings arriving from a
cleared Text Input. The check is **repeated in `scheduleSetModel` rather than moved into
`setModelID`**, deliberately: a blank `Id` *arriving* is not a failure of anything — nobody asked
for anything — while pressing `Fetch` with nothing to fetch is a request the node cannot honour.
Two rows hold that line apart. New code `object/fetch-failed`; this node had no error channel at
all before, and the Record family's `record/storage-op-failed` names a *backend* operation this node
never performs.

⚠️ **Variable's `Failure` belongs to the `Value` input setter, not to `Fetch`**, and its description
now says so. A setter is not an invocation: it reports no outcome and fires no `Completed`. A row
pins that, because the alternative reading — route the setter through `reportOutcome` — announces a
completion for work nobody asked for.

### The discrimination check — twelve reverts, eight exact

**Build 1a**

| Revert | Predicted | Actual |
|---|---|---|
| `setError` bypasses `reportOutcome` | 6 | **5 — wrong, see below** |
| `scheduleStore` mints *after* the `hasScheduledStore` guard | 1 | **1, that row** |
| `storageInsert` mints inside the deferral | 1 | **1, that row** |
| the base declares an `unchanged` port | 5 | **5, the five pinned controls** |
| `checkWarningsBeforeCloudOp` mints its own token | **0** | **0** |
| local `Update` reports `Done` before writing the values | **0** | **0** |

⚠️ **The `setError` miss is the one worth keeping.** The survivor was *"a refused delete reports
Failure with the family code, **then Completed**"* — a row whose **name** claims the assertion its
body never made. A title is not an assertion; the revert is what found it. With the assertion added
(`3ba66cf9`), it reddens six.

The two predicted-zero rows are recorded as honest non-discriminations rather than quietly dropped:
a token that is minted and then simply *dropped* is unobservable, because `reportOutcome`'s
duplicate guard keys on the token, not the node. Passing the caller's tokens into
`checkWarningsBeforeCloudOp` and `cloudStore` is therefore correctness-by-construction that no row
can currently see. Likewise no row asserts value-before-signal on `Update Record`.

**Build 1b**

| Revert | Predicted | Actual |
|---|---|---|
| Object's empty-Id branch returns silently again | 1 row (2 `test.each` cases) | **2, that row's two cases** |
| Object mints in `setModelID` too | 2 — binding-is-silent + two-pulses | **3 — wrong, and instructively** |
| Object mints inside the guard | 1 | **1, that row** |
| Array mints inside the guard | 1 | **1, that row** |
| Variable's `Value`-setter refusal routed through `reportOutcome` | 1 | **1, that row** |
| Variable mints in `setVariableName` | 1 | **3 — wrong, and more strongly** |

⚠️ **Both misses under-predicted, and both say something the prediction did not.**

- **Object minting in `setModelID` reddens the successful-`Fetch` row, the *blank*-Id failure row
  and the two-pulses row — and leaves the binding-is-silent row GREEN.** That is the Cloud Services
  lesson confirmed a second time and sharper: *a token minted in a setter is never settled, so
  nothing is reported and a silence row cannot see it.* What catches it is the next invocation
  draining the stale token and reporting twice. It also discriminates *within* a `test.each`: the
  `unset` case never touches the setter and stays green, the `blank` case does and reddens.
- **Variable minting in `setVariableName` reddens the boot control.** A `name` **parameter** applied
  at boot runs the setter, so the node reports `Done` before anything has been invoked — the
  boot-path false positive NDA-004 §2 warns about, and NDA-017's "a saved project applies a
  parameter before the port exists" by a second road. A pinned control caught it.

### The rename sweep — measured, and two files deliberately left

Build 1a renamed five wire names; build 1b renamed nothing (it is purely additive).

- **8 wires** in `docs/node-catalog/{acceptance,examples}`, rewritten by a rewriter that handles
  both formattings; the sweep was sanity-checked against known-existing wires before any zero was
  believed. `node-catalog-enriched.json`'s copies regenerated away.
- **Author-facing prose** in four `examples` descriptions and one `acceptance` description named the
  old ports in sentences; all five rewritten.
- **All five enrichment files** rewritten by hand — ⚠️ every one of these nodes is *dynamic*, which
  is precisely the case `catalog:merge:check` is blind to. The gate passed before the sweep and
  would have gone on passing.
- ⚠️ **Deliberately left:** `packages/noodl-editor/tests/testfs/{git-repo-utf8,merge-tests,…}` (7
  wires) and `dev-docs/tasks/phase-15-…/measurements/live/…` (2). The first are **git**-merge
  fixtures whose JSON is payload rather than contract — nothing runs them through a runtime, and
  rewriting content inside a checked-in test repo risks the golden comparisons they exist for. The
  second is a historical measurement record of what was measured at the time.
- **No hits at all** in `library/prefabs/*` for these five names, checked rather than assumed.

### Noise, measured rather than asserted

| Suite | Before | After | From these builds |
|---|---|---|---|
| `noodl-runtime` | 118 | **127** | 9 |
| `noodl-viewer-react` | 195 | **196** | 1 |

Seven `record/storage-op-failed`, two `object/fetch-failed`, one `variable/no-name`. Every one is a
raise a row explicitly asserts, and no existing path's raise count moved.

### Two test-harness repairs, both the traps the phase already names

- ⚠️ `nda-004-record-failure-channel.test.ts` read `expect(...).not.toContain('stored')` — which
  passes **vacuously** the moment the port stops existing, and this rename *is* that moment. It is
  now an exact-array assertion plus an explicit `hasOutput('stored') === false`.
- ⚠️ `nda-012-data-record-family.test.ts` answered `hasOutput: () => false` flatly, which turns
  every outcome into a spurious `outcome/missing-port`. It now carries the real
  `beginOutcome`/`reportOutcome` and a `hasOutput` backed by the definition's declared outputs —
  the fourth harness in the phase to need this and the same fix each time.

### Gates — measured before and after

| Gate | Before | After |
|---|---|---|
| `noodl-runtime` jest | 102 suites, 1891 passing, 13 skipped | **104 suites, 1925 passing, 13 skipped** |
| `noodl-viewer-react` jest | 55 suites, 720 passing | **57 suites, 753 passing** |
| `typecheck:runtime` | pass | pass |
| viewer-react `tsc` | pass | pass |
| `typecheck:cloud` | pass | pass |
| `catalog:check` | pass | pass |
| `catalog:merge:check` | pass | pass |
| `cloud-library:check` | pass | pass |
| editor `test:ci` | 2007 specs, 0 failures | **2007 specs, 0 failures** |

⚠️ **Live QA is owed for these two builds and was BLOCKED, not skipped.** An editor was already
listening on `8574` for the whole session — the concurrent phase-36 (`OBS-00x`) work, whose
`nodegx-observe` build drives a live agent against the running app. The standing rule is one editor
at a time, and building a rig means mutating whatever project that editor has open, so neither
launching a second nor attaching to theirs was available. Nothing in either build has been verified
in the running editor or preview; every claim above is corpus-level.

**What is still unverified, specifically**, and what the rig would show that no row can:

1. The real port set off `NodeLibraryData` for all eight nodes — the corpus reads the *definition*,
   the editor reads what the node library actually published.
2. `Completed` counting equal to raw clicks on a real Button, which is Rule 2 proved live.
3. **Object's new `Failure`** on a `Fetch` with a blank `Id` reaching the warnings chip. This is the
   only genuinely *new* failure path in either build and the only one whose editor-side provenance
   has never been seen.

The Cloud Services slice's rig recipe applies unchanged. ⚠️ Check `lsof -i :8574` before assuming it
is available.

### What remains of §0's 82 — measured

**53 done. 29 remain.** Per-category counts below are derived from the catalog by the same
script, one category at a time — not counted from this document's prose, which is how the previous
register lost a node.

| Remaining | Count | Note |
|---|---|---|
| **Data** | 13 | `net.noodl.ActionHandler`, `Filter Collection`, `Map Collection`, `FilterDBModels`, `net.noodl.HTTP`, `JSONStreamParser`, `OptimisticUpdate`, `PatternExtractor`, `RunTasks`, `Set Variable`, `StateSnapshot`, `StreamBuffer`, `TextAccumulator`. `Set Variable` is the only single-action rename left in the category. |
| **CustomCode** | 3 | ⚠️ `Logic Builder` registers block names verbatim — FINDINGS **SR-ix**. |
| **Cloud** | 2 | `Response`, `Send Email`. |
| **Component Utilities** | 2 | `Component Object`, `Parent Component Object` — ⚠️ the `Fetched`-is-not-`Done` question, now answered **three** times the same way. |
| **Navigation** | 4 | ⚠️ `Close Popup` is NV-iii's original latch. |
| **Animation / Events / Logic / String / Utilities** | 5 | `States`, `Send Event`, `Condition`, `Unique Id`, `Open File Picker`. ⚠️ `Condition` has no completion path at all today; `Open File Picker`'s `success` is referenced by `upload-file`'s enrichment prose and by two `examples` graphs. |
| **§3** `Treat Unchanged as` | — | Not started. |
| **§5** the validator's dead-end check | — | Not started. ⚠️ The **absent-`Unchanged`** list grew by eight: all five Record CRUD nodes and all three `Fetch` twins. Absent **`Failure`**: add `Collection2` and `Variable2`'s `Fetch` to the existing list. |

Carried forward unchanged: `GlobalStore.Set`'s unmeasured `Unchanged` candidate; `Counter`'s
`Reset` guard that has never fired; `Items Rendered` firing with zero item nodes after a `Refresh`
(the one-character fix is `() => this.refresh()`).
