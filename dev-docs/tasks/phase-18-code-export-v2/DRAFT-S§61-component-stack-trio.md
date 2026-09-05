## §61 Tier 2.8 row 11 — the component-stack trio: `Component Stack`, `Push Component To Stack`, `Pop Component Stack` — a push is a call, a pop is its return (session 86, 2026-09-05)

Type ids `Page Stack` (display *Component Stack*), `PageStackNavigate` (*Push Component To Stack*), `PageStackNavigateBack`
(*Pop Component Stack*) — the eleventh row of §50's list, the one §16 re-tiered behind its container. All three are in the
picker population (`inNodePicker`, none deprecated), so the floor moves **105 → 108**.

### §61.0 Design — what the three are on disk, and what they become

**The port sets, read off the catalog and the three runtime files** (`navigation-stack.tsx`, `navigate.ts`, `navigate-back.ts`,
`navigation-handler.ts`):

| node | inputs | outputs |
|---|---|---|
| `Page Stack` | `name` (string, default `Main`), `useRoutes` (boolean, default false), `clip` (boolean, default true), `pages` (proplist `{id,label}[]`), per page `pageComp-<id>` (component) and — only with `useRoutes` — `pagePath-<id>`, `startPage` (enum of page ids, default `pages[0].id`), `reset` (signal), the visual style ports | `topPageName` (string, boots `''`), `stackDepth` (number, boots 0), `done`, `failure`, `completed`, the visual outputs |
| `PageStackNavigate` | `stack` (string, default `Main`), `mode` (enum push/replace, default push), `navigate` (signal), `target` (enum of the stack's page ids, default `pages[0].id`), `transition` (enum, default Push / None per mode) + `tr-*`, `pm-<input>` per Component Input of the target | `done`, `unchanged`, `failure`, `completed`, `error`, `backAction-<a>` (signal) per back action any Pop in the target declares, `backResult-<k>` (`*`) per result any Pop declares |
| `PageStackNavigateBack` | `navigate` (signal), `results` (stringlist, edit-only), `backActions` (stringlist, edit-only), `result-<k>` (`*`) per result, `backAction-<a>` (signal) per back action | `done`, `unchanged`, `failure`, `completed`, `error` |

**What the runtime does with them.** A stack REGISTERS by name in a module-level singleton (`NavigationHandler.instance._pageStacks`,
keyed `name || 'Main'`, an ARRAY per name) when its React component mounts, and registration RESETS it (the start page is created
then; before that the stack is empty, `topPageName` `''`, depth 0 — the runtime paints an empty stack first too, `resetAsync` runs
through the async queue). A push is `NavigationHandler.navigate(name, args)`: every stack under that name gets it; with NONE registered
the push is QUEUED and replayed on the next registration (which resets first). `navigateAsync`: refuses (via `hasFailed`) on an empty
Components list, a transition in progress, or a target not in the list; answers `hasUnchanged` when the top entry already shows that
page with shallow-identical params (`_isAlreadyShowing`); otherwise creates the component, sets each `params[k]` on its Component
Inputs (`content.setInputValue`), installs `back` as the callback of every `PageStackNavigateBack` in the pushed component's OWN scope
(`getNodesWithType`, NOT recursive — a Pop one component below never receives it), pushes `{ page, params, backCallback }`, writes the
two outputs, syncs the url ONLY if `useRoutes`, starts the transition, and calls `hasNavigated` — synchronously, before the transition
ends. `replaceAsync` is the same with `stack = [entry]`, the no-op only at depth 1, and NO back callback installed. `back(args)`:
depth ≤ 1 → `{ ok:false, unchanged:true }`; transitioning → failure `pop-component-stack/transition-in-progress`; else invokes the
top entry's `backCallback(action, results)`, writes the outputs for the entry below, animates, pops. The pusher's callback stores
`results`, flags every `backResult-<k>` dirty and THEN sends the `backAction-<a>` signal. The Pop's `navigate`: reads and CLEARS the
pending back action, then no callback → failure `pop-component-stack/no-stack-in-scope` ("No Component Stack to pop — this node only
works inside a component that a Component Stack pushed"), else `done`/`unchanged`/`failure` by the result. Both nodes' `reportFailure`
sets `lastError` (the `Error` output), and `reportOutcome(…, 'failure')` raises the code on the NDA-004 channel before the pulse.
`reset` (the input) → `scheduleReset` → `resetAsync`: tears everything down, rebuilds the start page, reports `done`; failure only
with no components or an unresolvable start page. The mount-path reset reports nothing.

**The design — one lib, a visual role, two actions, one reserved prop.**

- **`src/lib/pageStack.ts`** (`src/emit/pageStackLib.ts`): `navigation-handler.ts` transcribed — a MODULE-LEVEL registry
  `Record<name, PageStackStore[]>` plus the navigation queue, `pushComponent(name, args)` / `replaceComponent(name, args)` with the
  runtime's callback shape (`hasNavigated` / `hasUnchanged` / `hasFailed` / `backCallback`); a `PageStackStore` class with
  `navigate` / `replace` / `back` / `reset` transcribed from `navigation-stack.tsx` minus the transition and the url (`_isAlreadyShowing`
  verbatim, the three failure codes and sentences verbatim, `from: null` on replace, no back handle on reset/replace);
  `usePageStack({ name, pages, startPage })` — one store per mount (`useState(() => new …)`), a version counter for re-render,
  register in an effect (which resets — the runtime's `didMount`), deregister in its cleanup; returns `{ top, topPageName,
  stackDepth, reset }`; `popComponent(handle, args): StackBackResult` — `navigate-back.ts`'s `navigate` with the no-callback failure;
  the `PageStackEntryHandle` type. **Why a module-level registry and not React context:** the runtime resolves a pusher to its stack
  BY NAME through a singleton, and a pusher legitimately sits outside the stack's subtree (a tab bar beside the stack, a button in
  the page that hosts it); context reaches descendants only and would refuse the tab bar, the row's whole second use case. Nesting
  costs nothing: two stacks are two names. **Why the Pop reaches its stack through a PROP and not context:** the runtime hands the
  callback to the Pop nodes in the pushed component's own scope only (`getNodesWithType`, non-recursive) — a prop the stack row
  passes to the component it shows is exactly that reach, and a component placed elsewhere or shown by `Reset`/`Replace` gets no
  prop and answers the runtime's own `no-stack-in-scope` failure.
- **The `Page Stack` is a visual role `'stack'`** (a `StyleRole` too: the runtime's `defaultCss` — `width:100%; flex:1 1 100%;
  position:relative; display:flex; flex-direction:column; overflow:hidden` unless `clip` is authored false — becomes its class).
  Its hook line prints beside the other hooks; the row renders THE TOP ENTRY ONLY, one `&&` line per page:
  `{wizard.top?.pageId === 'details' && <StepDetails key={wizard.top.key} {...(wizard.top.params as StepDetailsProps)} pageStackEntry={wizard.top.handle} />}`
  (`key` is the entry's — every push creates a fresh instance in the runtime; the spread only where the target declares props;
  `pageStackEntry` only where the target's plan keeps a Pop). `topPageName` / `stackDepth` reads are `stack-out { local, field }`
  off the handle, in both contexts (a handler closes over the latest render, which is what the getter answers). `reset` wired →
  action `stack-reset { local, then }`: `wizard.reset();` then the Done chain.
- **The pusher** is action `stack-push { stack, mode, target, params, backResults?, backActions, then, unchangedThen }`, printed as
  the runtime's own call:
  ```
  pushComponent('Main', {
    target: 'details',
    params: { email: emailText },
    backCallback: (action, results) => {
      setIntroBackResults(results);
      if (action === 'confirm') { … }
    },
    hasNavigated: () => { … },
    hasUnchanged: () => { … }
  });
  ```
  A `pm-<port>` value is the authored literal or the wire (handler context; `String(x ?? '')` where an untyped source lands on a
  string input, the untyped-Variable rule; a type the target does not declare is refused by name); the prop key is the target's
  own identifier for the port. `backResult-<k>` reads: inside a `backAction-*` chain → `results.<k>` (the runtime flags the
  outputs dirty BEFORE sending the signal, and a React state read there would be the stale closure); anywhere else → one row per
  pusher `useState<Record<string, unknown>>({})`, allocated by a read, typed `unknown` (the port is `*`), folded at a text sink as
  an untyped Variable is. `replaceComponent(…)` for Replace mode — no callback, as the runtime installs none.
- **The Pop** is action `stack-pop { backAction?, results, local, then, failThen }`, always the block form (the Failure arm raises
  `pop-component-stack/no-stack-in-scope` on the channel, §54's rule):
  ```
  const popResult = popComponent(pageStackEntry, { backAction: 'confirm', results: { email } });
  if (popResult.ok) { … } else if ('code' in popResult) { raiseAppError({ code: 'pop-component-stack/no-stack-in-scope', … }); … }
  ```
  (`'code' in` is the runtime's own discriminant: an end-stop answers `unchanged`, never a code.)
  ```
  ```
  The host component's interface grows the reserved prop `pageStackEntry?: PageStackEntryHandle` (a declared port of that name
  refuses, Close Popup's `onClose` rule). A `result-<k>` value is read where the setter stored it — the render expression the
  handler closes over. `Error` is read inside the Failure arm as `<local>.message`.
- **Cross-component facts are indexed once from the IR** (`popupTargetLegacies`' shape): every `Page Stack` in the project, by name,
  with its pages resolved to components and its own refusal (if any) — so a pusher in any component knows its stack, and a Pop
  knows whether any stack lists its host.

**Refused by name** (every sentence predicted here, graded by mutation in §D of the spec):

- `Page Stack` (the whole node, as a visual refusal — nothing renders where it sat, marker + note):
  `its Use Routes is ticked — the stack then writes the browser url (history.pushState) and reads its start component back from it, which this slice does not translate; untick it, or route the pages` ·
  `its Name is wired — a pusher finds its stack by name statically, and a name that arrives on a wire has no pusher this export can bind` ·
  `its Components list is wired — the pages it can show are its structure` ·
  `its Components list is empty — the runtime reports component-stack/no-components at mount and shows nothing` ·
  `its component "<label>" names no component — the runtime cannot show it (component-stack/component-not-found)` ·
  `its component "<label>" is <legacy>, which exports no component` ·
  `its component "<label>" is <legacy>, a routed page — a Component Stack shows components; a page has a url of its own` ·
  `its Start Page is wired — which component the stack starts on is its structure` ·
  `its Start Page "<id>" is not in its Components list — the runtime reports component-stack/component-not-found at mount` ·
  `its Completed output is consumed — it fires after every outcome, and this slice emits the outcome arms rather than a join beneath them` ·
  a `Failure` wire is DROPPED with a note (dead: the two mount failures are excluded statically by the gates above) ·
  a `Done` wire with `Reset` unwired is dropped with a note (the mount-path reset reports nothing).
- Pusher: `its Stack is wired — which Component Stack it pushes onto is a runtime value; this slice binds a pusher to a stack by its authored name` ·
  `no Component Stack in the project is named "<name>" — the runtime queues the push until one mounts, and none ever will` ·
  `it pushes onto the Component Stack "<name>", which did not translate — <reason>` ·
  `two Component Stacks are named "<name>" and show different components for "<target>" — the pusher's parameters are minted from one of them` ·
  `its Mode is wired — push and replace are two different calls` · `its Target Page is wired — which component it pushes is a runtime value` ·
  `its Target Page "<id>" is not in the Components list of the stack "<name>" — the runtime reports push-component-stack/component-not-found` ·
  `its Transition is wired — the export switches components without animation, and a wire choosing one would be a wire into nothing` (same for `tr-*`) ·
  `its "<port>" parameter is fed a <given> where <legacy> declares "<port>" as <declared>` ·
  `its "<port>" parameter is fed a logic truth value — only a boolean input takes one` ·
  `its Back Action "<a>" is wired, but in Replace mode the stack installs no back callback (navigation-stack.tsx replaceAsync) — the chain would never fire` (and the same for a `backResult-*` read) ·
  `its Back Action "<a>" is not one the target's Pop Component Stack declares` · `its Back Result "<k>" is not one the target's Pop Component Stack declares` ·
  `its Done|Unchanged output is consumed as a value — a pulse carries nothing to read` ·
  `its Completed output is consumed — …` (UUID's sentence) ·
  `its Error is read, and with a literal Target inside the stack's Components list none of the pusher's three failures can fire (no components, component not found, still animating) — the row would be a string nothing ever writes` ·
  a `Failure` wire is dropped with a note (dead for the same reason) · the sweep: `its Navigate is never fired by a translatable trigger`.
  A `pm-<port>` naming no input on the target is DROPPED with a note (the runtime's `setInputValue` on an undeclared input is a no-op).
  An authored non-default Transition is NOTED, not refused: `its Transition "<x>" is authored — the export switches without animation`.
- Pop: `no Component Stack lists <legacy> among its Components, so nothing ever pushes it — its Navigate answers Failure ("No Component Stack to pop") every time` ·
  `a declared port already claims the reserved prop "pageStackEntry" — rename the port` ·
  `its Unchanged output is consumed — it fires when the stack is already at its first component, which a pushed component's Pop cannot reach (only a pushed component receives the back callback; the start component's Pop answers Failure instead)` ·
  `its Completed output is consumed — …` · `its Error is read outside its Failure chain — this slice reads the message only inside the arm that writes it` ·
  `its Done|Failure output is consumed as a value — a pulse carries nothing to read` · the sweep: `its Navigate is never fired by a translatable trigger`.

**Recorded divergences (not refused):** no transition — the runtime animates every push (`Push` by default) and keeps both components
mounted until the animation ends; the export switches in one render. The stack does not survive a page navigation any more than the
runtime's does (the registry entry is removed on unmount). The Pop's `transition-in-progress` failure cannot occur.

**What this deliberately does not do:** `useRoutes` (the url is a Router's), transitions, a Pop nested one component below the pushed
one (the runtime does not reach it either), a read of a backResult typed by its feed (the port is `*`; `unknown` is the honest type).

### §61.1 What is emitted

- **`src/lib/pageStack.ts`** (`src/emit/pageStackLib.ts`, new): `PageStackStore` (`navigation-stack.tsx`'s `navigate` / `replace` /
  `back` / `reset` minus the transition and the url — `_isAlreadyShowing` verbatim, the three failure codes and sentences verbatim,
  no way back on a replaced or reset entry), the module-level registry with the navigation queue and `settledOnce` (`navigate.ts`'s
  `settle`: one press reports once across same-named stacks), `pushComponent` / `replaceComponent` / `popComponent`, and
  `usePageStack({ name, pages, startPage })` — the store once per mount, registration in the effect (which resets, so the first
  render shows nothing, as the runtime's does until its async queue has built the start component), deregistration in the cleanup.
- **The stack's host** (`Home.tsx`): one hook line per rendered stack in walk order; the row `<div className={styles.wizard}>`
  with one `&&` line per page — `{wizard.top?.pageId === 'details' && <StepDetails key={wizard.top.key}
  {...(wizard.top.params as StepDetailsProps)} pageStackEntry={wizard.top.handle} />}` (the spread only where the target declares
  props, the reserved prop only where its plan keeps a Pop); `{wizard.topPageName}` / `{wizard.stackDepth}` bare; Reset as
  `onClick={() => wizard.reset()}`; the class `width: 100%; flex: 1 1 100%; position: relative; display: flex; flex-direction:
  column; overflow: hidden` (the runtime's `defaultCss`, `clip` unticked drops the last).
- **The pusher's host** (`StepIntro.tsx`): `pushComponent('Main', { target: 'details', params: { email: draftEmail.get() },
  backCallback: (action, pushDetailsResults) => { setPushDetailsBackResults(pushDetailsResults); if (action === 'confirm') {
  confirmedEmail.set(pushDetailsResults.email); } } })`; the row `useState<Record<string, unknown>>({})`; the render read
  `{String(pushDetailsBackResults.email ?? '')}`. Replace mode: `replaceComponent('Tabs', { target: 'overview' })`, no callback.
  Done / Unchanged chains print as `hasNavigated: () => …` / `hasUnchanged: () => …`.
- **The pushed component** (`StepDetails.tsx`): `pageStackEntry?: PageStackEntryHandle` on the interface after the declared ports;
  per trigger port `const popResult = popComponent(pageStackEntry, { backAction: 'confirm', results: { email } }); if (!popResult.ok
  && 'code' in popResult) { raiseAppError({ code: 'pop-component-stack/no-stack-in-scope', … }); }` — with a Done chain the
  `if (popResult.ok) { … } else if ('code' in popResult) { … }` form, the Failure arm reading Error as `popResult.message`.
- **plan.ts**: `PAGE_STACK_TYPE` / `STACK_PUSH_TYPE` / `STACK_POP_TYPE` / `PAGE_STACK_OUTPUTS` / `PAGE_STACK_ENTRY_PROP`;
  `indexPageStacks(ir)` (module-level, cached per IR — every stack by node, by name, and by the components it lists, with its
  refusal decided from the IR alone); `renderRole` → `'stack'`, refused whole in `roleOf` by the index's sentence; `PageStackPlan`
  on `ComponentPlan.pageStacks`, `popsStack`; `StackPushAction` / `StackPopAction` / `StackResetAction`; `ValueExpr` `stack-out`
  and `stack-back-result`; `StateVarPlan.origin` `stack-back`; `stackPlanOf`, `stackBackStateOf`, `pushTargetOf`,
  `compileStackPush` / `compileStackPop` / `compileStackReset`; the `resolveExpr` branches (a Pop's Error reuses `outcome-error`
  with a local); `TRIGGER_PORTS` + `isTriggerWire` (the Pop per port, the stack's Reset); `OWN_CHAIN_OUTPUTS` + the `backAction-`
  prefix; the per-port compile loop; the five expression switches and five action walkers; Pass 4c's whitelist (`isStackRead`,
  the Pop's Error included) and a wire note carrying a stack-family read's own sentence where Pass 6 would say "step 5"; the
  never-fired sweep (the Pop over every trigger port it has); the pathway predicate (a push or pop is a navigation).
- **component.ts**: `TAGS.stack`, `renderStack`, the hook line beside the others, the three prints, `errorCodeOf`,
  `RAISING_ACTION_KINDS`, `collectExprUse` / `hookExprSources` / `maybeUndefined` / `exprCode` / `effectDeps` /
  `chainReadsChainLocal` / `actionExprsOf` / `deepActions` / `actionIsStatement` / `actionTakesNoTerminator` / `blockBody`, the
  import earned from the calls, the hook and the reserved prop's type; `requireInstance` now MERGES symbols (`withProps` imports
  the page's `Props` beside the symbol without clobbering an ordinary instance's line); `declaresPropsInterface`; the untyped
  fold for `stack-back-result` with its `noSourceReason`; `pageStackLib` on `EmittedComponent`. **style.ts**: `StyleRole`
  `'stack'`, the `defaultCss` branch, `CONTENT_PARAMS['Page Stack']`, the `pageComp-`/`pagePath-` skip. **emitApp.ts**: the file.
- **Ledger**: three rows `translated` with notes; floor **105 → 108**; eight pins moved (`animation-pair`, `browser-utilities`,
  `filter-records`, `object-store`, `on-app-error`, `run-tasks`, `script`, `streaming-trio`).

### §61.2 The fixture — `tests/fixtures/wizard-desk`

`App`: the Router alone. `Pages/Home`: a tab bar (two buttons → two pushers in Replace mode onto a stack "Tabs" showing
`TabOverview` / `TabSettings`), a wizard stack "Main" (intro → `StepIntro`, details → `StepDetails`, start intro), three Texts
(Top Component Name, Stack Depth, the Variable `confirmedEmail`), a "Start over" button → Reset. `Components/StepIntro`: a text
input → Variable `draftEmail` (the write-through rule), a Next button → push details with `pm-email` ← the Variable, `backAction-confirm`
→ Set Variable `confirmedEmail` ← `backResult-email`, a Text ← `backResult-email`. `Components/StepDetails`: Component Inputs
(`email: string`) shown in a Text, Confirm / Cancel → the Pop's two back actions with `result-email` ← the input. **The reverted
arm** (`probe-reverted.log`, 2a2dd4fa): the two stacks `visual child of shell with no deterministic generator (Page Stack)`, the
four pushers and the Pop `logic node (…)`, the Set Variable silenced with the value-side sentence, 15 refusals, verdict null,
21 files — every node predicted. **Built**: 0 refusals, 23 files, the real `tsc` clean.

### §61.3 The gates and the arms

```
packages/nodegx-export: tsc --noEmit 0 · component-stack-trio.test.ts 50/50
  §A the fixture whole + the real ts.Program (11) · §B the lib under a hook harness (12: the empty first paint, push, back,
  no way back, _isAlreadyShowing, replace, the end-stop, the queue, the fan-out + settle, the failure sentences by id and label,
  reset + deregister, the Main default) · §D refusals by mutation, each sentence exact (16 rows, 30 sentences) · §E the shapes a
  wire changes, typechecked as one real program (5) · §F findings (3) · §G the runtime files pinned (3)
component-stack-pair.test.ts 11/11 — the three `deferred` pins flipped to positive rows, the instrument rows kept, one row added
  (the Pop is reached non-recursively; only the push path installs the callback — counted over CALL expressions, see §61.4)
neighbours, one at a time, green: unreported-deferrals 7, in-code-markers 57 (was 54: the fixture joined the corpus control), logic 29,
  typecheck-emitted 37 (was 34: the fixture is typechecked there too), cascade 83, visual-roots 13, navigate-to-path 79,
  browser-utilities 55
whole package jest ONCE: 72 files (72 on disk = 71 + this spec), 2512 rows, exit 0, alone on the box at load 5.3
export-ledger:check OK — 176 types · picker 108/127 (85.0%), floor 108, --check exit 0
arms 15/15 KILLED, every arm compiled, sources restored md5-identical after each (mut.py, mut-summary.txt): M1 _isAlreadyShowing
  inverted — 2 · M2 back() never fires the callback — 1 · M3 replace installs a way back — 1 · M4 the settle guard — 1 · M5 the
  queue dropped — 3 · M6 the end-stop off by one — 1 · M7 the Replace-mode back-action refusal — 1 · M8 the typing gate (first cut
  `|| true` did NOT compile — TS7027, re-cut as `given = declared`) — 1 · M9 the attached check — 2 · M10 the Pop's discriminant
  swapped — 2 (the emitted app's tsc among them) · M11 clip default lost — 1 · M12 the empty list accepted — 1 · M13 the reserved
  prop passed to every page — 3 · M14 the Pop's Error off the whitelist — 1 · M15 reset reuses the start key — 1
NOT run (the orchestrator's, after merging): editor tsc, editor test:ci, any drive.
```

### §61.4 What building it found

1. 🔴 **The fixture's first wire was to a port that does not exist.** I wired the text input's `text` output; the value port is
   `onTextChanged` (display "Value", `isSignal: false`) — §59.4's trap #8 again, read off the display name instead of the catalog.
   Pinned (F1). And its live text is not readable from a button's handler either (the brief's own trap: it rides a Variable) — the
   built probe's first refusal was `the action reads values that only exist in another handler`, and the fixture took the
   utility-desk shape.
2. 🔴 **A row nothing writes printed.** The pusher COMPILED (so `compiledOf` answered an action) and was refused at ATTACH, while
   the Text's render read had already allocated the back-results row — `useState<Record<string, unknown>>({})` in a file whose
   push had been dropped. §59.5's order (the attach registry fills after every sink compiles) is now the read's question: a
   render read (Pass 4c) asks `attachedStackPushes`; a sibling handler's read compiled earlier takes the id nodes' "never fired"
   sentence (E5, the named residual). Pinned (F2); an arm (M9).
3. 🔴 **A render read refused in Pass 4c loses its sentence.** Pass 6 names every unconsumed wire "has no deterministic
   translation in step 5", and the stack family's reads (a Pop's Error outside its Failure arm, a Back Result while nothing fires
   the push) had nowhere else to put theirs once the source node was attached or already dispositioned. They now file a wire note
   (the dead-Failure drops' shape). Three rows went red on it (D13, D14, F2).
4. 🔴 **"Adding a readable output is never one edit"** (§14's warning, paid again): the Pop's Error into a rendered sink never
   reached `resolveExpr` because Pass 4c's whitelist admitted the stack's outputs and the pusher's Back Results, not it. One line;
   pinned (D13); an arm (M14).
5. 🔴 **The grep the pair spec warns about, reached for in the pair spec.** `countText(…, '_setBackCallback(')` reads 2: the
   interface type the call is made through DECLARES the method. The file's own AST counter counts call expressions — 1. Both are
   now asserted, side by side.
6. ⚠️ **A `Set Variable` takes its value from a wire.** My first `addSetVariable` authored a literal `value`, and eleven refusals
   followed — none the row's. The helper wires a Variable read now, and E1–E3 assert `lastTab.set(confirmedEmail.get())` — the
   handler's `.get()` form, §59.4 #5, met on the way.
7. ⚠️ **The ledger stores `—` and `§` raw.** `json.dump(…, ensure_ascii=True)` (the brief's note for a ledger that HAD escapes)
   rewrote 110 lines; `ensure_ascii=False` made the diff 11/11.
8. ⚠️ The first mutation cut (`|| true`) did not compile — an unreachable `else` is TS7027 here — and "0 total" is not a kill; re-cut
   at the value level, one red.

### §61.5 What this leaves (owner NONE unless named)

- **No transition.** The runtime animates every push (`Push` by default) and keeps both components mounted until the animation
  ends; the export switches in one render. Recorded in the ledger note and per node where an author chose one (D16). Owner NONE.
- **A Back Result read from a SIBLING handler** compiled before the attach pass is refused with "never fired" even when the push
  is fired by a button — §59.5's residual, the same shape, pinned as a fact (E5). Owner NONE.
- **`useRoutes`** refuses the whole stack by name; translating it is a url story the Router owns. Owner NONE.
- **A Pop nested one component below the pushed one** answers the runtime's own `no-stack-in-scope` failure — faithful, because
  the runtime reaches the Pop non-recursively (pinned in the pair spec). Not a residual; noted so nobody "fixes" it.
- **Two same-named stacks showing different components** for a target refuse the pusher; the runtime fans out and mints the
  `pm-` ports from the first. Owner NONE.
- Not driven in a browser this session (the brief forbids drives from a slice agent); the orchestrator's drive is owed — the
  wizard (push → confirm → the Variable shows the email; Start over) and the tab bar (replace → the same tab twice is Unchanged).
