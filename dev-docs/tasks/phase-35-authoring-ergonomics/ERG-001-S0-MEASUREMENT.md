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

**Every authored `Done` is on a component interface, never on a library node's own port.** The
library side is always the internal name — `stored`, `out-Done`, `Closed`. Two consequences:

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
