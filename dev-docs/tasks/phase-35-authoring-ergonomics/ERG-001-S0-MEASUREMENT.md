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
