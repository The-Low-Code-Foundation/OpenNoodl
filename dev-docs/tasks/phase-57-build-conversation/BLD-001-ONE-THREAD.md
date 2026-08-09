# BLD-001 — One thread, one composer

**Status:** 🟢 **built and committed 2026-08-09** (`a93720b3`, plus `02c3072c` for the composer's
Enter binding) · 🟠 **driven 2026-08-09** — B1 closed, and the drive found **B9: the thread resets on
every successful send**, which is D1's own promise · **Track A** · ⭐ **the frame** ·
closes **D1** *(not yet — see B9)*

## The defect, measured

The panel is three applications wearing one panel. `AuthoringScope` is a three-value union
([AiAuthoringPanel.tsx:74](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L74))
selected by a segmented control
([:449-468](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L449)),
and a three-way ternary switches whole subtrees
([:471-479](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L471)).

Each branch has its own start button, its own stop button, its own state and its own result
treatment. Nothing tells a user that *"add a basket popup"* is one branch and *"wire checkout into
the app"* is another — **and the choice is demanded before they have typed a word**, which is the
moment they know least.

The panel already pays for this three times over:

- `ProjectReviewStore` and `PlanSessionStore` both exist *because* the conditional render destroyed
  state on a tab click — AIB-003's module note calls it out explicitly
  ([PlanSessionStore.ts:5-12](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanSessionStore.ts#L5)).
  The stores are the right fix and stay; the tab that made them necessary does not.
- F20 and POL-007 both spent layout work on the tab row fitting at 400px
  ([AiAuthoringPanel.module.scss:111-130](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.module.scss#L111)).
- The review banner sets a one-shot request that *another* piece of state consumes to pick the
  opening tab ([:164-182](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L164))
  — three `useRef`/`useState` pairs whose only job is deciding which of three apps opens.

## Build

1. **`BuildThread` — the one component.** Header (thread identity + actions), scrolling turn list,
   composer. Rendered in every state; nothing is conditional at this level. Takes a `width` variant
   (`panel` | `expanded`) so BLD-009 has nothing to reimplement.
2. **The turn is the unit.** A `Turn` is `{ id, request, activities, outcome? }`. `AuthoringActivity`
   ([AuthoringSession.ts:241-249](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/AuthoringSession.ts#L241))
   is the right vocabulary and mostly survives — BLD-002 extends it, this task does not.
3. **Intent inference replaces the tabs.** On send, decide `component` | `plan` | `docs` and **state
   it in the agent's first sentence** with a one-click override — *"I'll build this as one
   component"* / *"this touches 4 components — here's the plan first"* / *"I'll ask you some
   questions first"*.
   - ⚠️ **Verify first:** the plan path already begins with a `PlanningSession` that produces a plan
     for approval. Check whether its opening turn can carry the classification, or whether a
     cheap pre-classification call is needed. **Prefer reusing the planning turn** — an extra
     round-trip on every message is a real cost, and phase 55 owns model behaviour, not this task.
   - Q1 (README) is open. Ship inferred-with-override; do **not** build a mode selector "just in
     case" — that is the defect with a new skin.
4. **The three existing sessions become three turn producers**, not three views. `AuthoringSession`,
   `PlanningSession`/`PlanRun` and the project review run keep their current interfaces; the thread
   subscribes and maps their state into turns. **No authoring logic moves.**
5. **Delete the scope tabs, the `AuthoringScope` type and the banner-driven opening-tab state.** The
   review banner becomes an ordinary suggestion chip in the empty state.
6. **The experimental flag moves to the panel header**, out of the turn list, where it stops
   competing with the task.

## What must NOT change

- `acceptAuthoredComponent` / `updateAuthoredComponent` / `applyAuthoredPlan` remain the only code
  that touches a `ProjectModel`. This task moves presentation only.
- `PlanSessionStore` and `ProjectReviewStore` keep their durability guarantees. The thread is a
  *view* of them; it does not become their owner.

## Acceptance

- [x] Every state in the mockup renders inside one component with one composer; `AuthoringScope` no
      longer exists in the tree — `grep -r AuthoringScope` returns **two prose mentions and no
      declaration**, both explaining what replaced it.
- [ ] ❌ A component build, a multi-component plan and a docs run all appear as turns in the same
      thread, in the order they happened. Built as `composeThread(history, pending, component, plan,
      docs)`; pinned offline (`composeThread` keeps order and lets at most one turn claim to be
      running). **The drive falsified this.** `composeThread` does keep order — but the *plan* group
      it is handed is derived from the one live session, and nothing retires the previous one into
      `history`. Three sends, one turn on screen. **B9.**
- [x] The agent's first sentence names the intent, and the override changes it without losing the
      typed request. The request is not lost **by construction**: the override re-routes the *plan*,
      and `plan.request` is the user's verbatim words, so there is no copy that could go missing.
- [x] ✅ Switching away from the Build panel and back does not lose a run (the AIB-003 property).
      **Driven** 2026-08-09: `SidebarModel.instance.switch('components')` then back to
      `'ai-authoring'` — the plan, its two operations and the `Author plan (2)` control all survived,
      as did the request turn. The stores are still the owners; the panel is still a subscriber.
- [x] Jest/jasmine: the turn mapper is pinned for all three producers. **37 specs**,
      `tests-unit/bld-001/`. ⚠️ These are **jest**, not jasmine, and deliberately: the mapping is
      pure, and `tests-unit/` runs it in plain Node where the jasmine bundle needs a real Electron
      renderer. The AIX-011 note applies to specs that touch the DOM; nothing here does.

## What was built

**Pure half** — `src/editor/src/models/AiAssistant/thread/` (`types`, `intent`, `turns`), no React,
no `ProjectModel`, no singleton. **React half** — `views/panels/AiAuthoringPanel/thread/`
(`BuildThread`, `ThreadBody`). The panel is the host: it plans, routes, and hands the two existing
views their live objects as *outcome cards*.

**The intent is decided from the planning turn**, as step 3 asked to prefer. The check step 3 called
for came back with a second reason that is stronger than the cost argument: **one composer needs a
target from somewhere.** `AuthoringSession` cannot start without a `componentPath`, which the old
component scope got from a text field the user typed a path into by hand — a typo silently created
a second component. A plan operation carries `target`. So routing every request through planning is
not only how the intent is inferred, it is what makes a single composer possible at all; and it buys
the LAS-006 declared inputs, which the old single-component path never had.

## Register

| # | Finding | State |
|---|---|---|
| **B1** | ⚠️ **Nothing here has been driven in a real editor.** Every claim above is `tsc` + 37 jest specs + 2582 jasmine specs, and this task changes what happens on screen in every state of the panel. Three things specifically have no offline check: the two embedded views rendering flat inside the thread's scroller, the sticky header/composer grid at 400px, and the send→plan→route round trip against a real provider. | ✅ **closed 2026-08-09** — all three driven, see below. It was worth the trip: the drive found **B9**, which no gate could. |
| **B2** | **Every send now costs a planning turn**, including one that turns out to be a single component. Argued in `thread/intent.ts`: it is on the `plan` role (LAS-009 — the step a mid-tier model does well and the one safest to point at a cheap model) and it buys the target and the declared ports. **The cost is real and unmeasured.** | **accepted, unmeasured** — measure it in BLD-010 |
| **B3** | The Docs panel's banner calls `requestReview()` and the old panel consumed it to open the review tab *and start it*. With no tabs, nothing consumed it — the button would have silently done nothing. It now **prefills the composer** rather than running: with the tabs gone, "the click is the start" would be a build kicked off by a panel switch, which is the thing this task removes. | **fixed in flight** |
| **B4** | `ProjectReviewView.startImmediately` lost its only caller. Kept, with the reason written on it, because BLD-009's second host may want it. **An inert prop is debt** — if nothing wants it by BLD-009, delete it. | **filed** |
| **B5** | The preview document still renders its own Accept/Reject bar (D2), and it is now the *second* copy alongside the one on the outcome card. This task moved the panel's half onto the card; **BLD-003 owns making exactly one surface own them at a time.** Do not count controls until BLD-003 lands. | **filed — BLD-003** |
| **B6** | ⚠️ **The thread made the AIX-012 launcher handover circular, and it would have lost a plan silently.** `ProjectAuthoringView` took the pending scope plan into the store in its own initialiser. Inside the thread it mounts as the outcome card of a *plan turn* — and a plan turn exists only when the store already holds a plan. A project created from the launcher's scoping conversation would have opened to an empty thread, with the agreed plan consumed by nobody and no error anywhere. Found by re-reading, not by a gate: `tsc` is clean either way, and no spec covers a handover between two components' mount order. **Fixed** — one `adoptScopePlan`, called by the panel first and by the view as a fallback, with the store's own content as the idempotence guard. | **fixed in flight** |
| **B7** | The plan view renders its own applied summary (with the backend endpoint, the registered pages and the settings written — AIB-007/AAQ-001/AAQ-003) *and* `planTurns` emits a `plan-applied` outcome whose fallback renders a shorter version of the same sentence. Both would have been on screen: **the duplicated-message defect this phase is measured on, reintroduced by a rendering detail rather than by a control.** **Fixed** — the live view attaches to the *last* plan turn, `plan-applied` included, which suppresses the fallback. | **fixed in flight** |

| **B9** | 🔴 ⚠️ **The thread resets on every successful send — D1's own promise, and the phase's exit test.** Driven: three requests sent through a scripted planning provider, `chatStream` called **3 times**, and the thread held **only the third**. `turns` is `composeThread(history, pending, <derived from the ONE live session>)`, and `history` is appended in exactly three places — the component accept path, the component discard path, and `send`'s *declined*/*failed* branches ([AiAuthoringPanel.tsx:358-364](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L358)). The **success** path never retires the live turns, so `routePlan` replaces the plan session and the previous turn evaporates. The declined/failed branches are the tell that accumulation was intended and the success path was simply missed. **Not fixed here, deliberately:** a fix must also clear two traps, and rushing it reintroduces the exact defect B7 is about. (1) `freezeTurns` only strips `busy`, so frozen turns keep their `plan-*` ids, and `lastPlanTurnId` picks the last one — freeze without re-prefixing and the *live* plan view mounts on a **historical** turn. (2) `showPlan` is `route === 'plan' \|\| Boolean(planSession.plan)`, so if a later request routes to `component` while the store still holds the old plan, the frozen copy and the live derivation are **both** on screen — the duplicated message this phase is measured on. | **open — fix before D1 is claimed closed.** Natural owner is **BLD-006** (it owns thread persistence and the switcher), but the reset is not a persistence bug: it is the thread failing within one live session |
| **B8** | ⚠️ **`onEnter` is two different keystrokes behind one prop name.** `TextArea.onEnter` fires on **Shift+Enter** ([TextArea.tsx:96](../../../packages/noodl-core-ui/src/components/inputs/TextArea/TextArea.tsx#L96)); `TextInput.onEnter` fires on **plain Enter** ([TextInput.tsx:286](../../../packages/noodl-core-ui/src/components/inputs/TextInput/TextInput.tsx#L286)). The thread's composer is a `TextArea` and the refine field is a `TextInput`, so **the two composers on this one panel do not answer to the same key** — and nothing in the type system says so. Shift+Enter is right for the main composer (it is multi-line by design; plain Enter must make a newline), so this is documented rather than changed. **BLD-002 or BLD-010 should decide whether one panel may have two Enter contracts.** | **filed** — ✅ **driven 2026-08-09**: a real `Input.dispatchKeyEvent` with the Shift modifier took the provider calls 3→4 and cleared the composer, so the binding this entry describes does work. ⚠️ **And the reason it exists is a correction worth keeping.** The binding was added after noticing `BuildThreadProps.canSend` documented "disables Send and Enter alike" while the `TextArea` had no key handler at all — but the justification written with it ("the composer this replaced bound the same one") was **wrong**. The `onEnter={refine}` found by grepping the pre-refactor panel belonged to the **refine `TextInput`** — a different control, answering **plain Enter**. The old *description* field was a `TextArea` with no `onEnter` at all, so this was a **gap, never a regression**. *One grep hit for a prop name is not evidence about the control you are actually editing, when two controls share the prop name and not its meaning.* |

**B6 and B7 are the reusable pair.** Both are the same shape: a refactor that moves *when* a
component mounts changes the meaning of code that was correct about *what* it renders. Neither is
visible to a type system, neither is covered by a spec, and both were found by asking "who mounts
this, and when?" rather than by running anything.

## The drive — 2026-08-09

Project `ai-test`, dev stack via `dev:debug`, panel opened with
`SidebarModel.instance.switch('ai-authoring')`. No provider is configured (`AiClient.apiKey` absent),
so the seam is the [[aix-003-scripted-session-and-readonly-defect]] one — `isConfigured → true` and
`chatStream` replaced with a scripted `submit_plan` of two `create` operations. ⚠️ **That recipe's
existing asset replays `submit_component`, which this task's panel no longer starts first**; the
patch here scripts the *planning* turn instead, and throws loudly on any non-planning request rather
than returning something the session would misread.

| Claim | Result |
|---|---|
| The two embedded views render **flat** in the thread's scroller | ✅ Exactly **one** scroll container in the turn region (`ScrollArea-module__Root`, 488/488). The embedded `ProjectAuthoringView` brought no nested scroller and no lost padding. |
| Header / list / composer grid at panel width | ✅ 60 + 488 + 123 = 671 ≈ **670** thread height, content width **364**. The composer holds its size and the list absorbs the remainder — the POL-007 arrangement behaves. |
| send → plan → route round trip | ✅ First time any provider has answered this path. The request became a turn, `decideIntent`'s plan branch produced *"This touches 2 components — here's the plan first. Nothing is built until you approve it."*, and the plan card mounted as that turn's outcome. |
| Composer clears and re-disables after send | ✅ |
| Controls on screen | One `Send`, one `Author plan (2)`, one `Discard plan`, one `Drop` per operation. **No duplicate control** — but do not read this as the ≤4 measurement, which B5 defers to BLD-003. |
| Panel switch away and back | ✅ Plan, operations, control and request turn all survive (AIB-003). |
| Shift+Enter sends | ✅ **after the B8 binding** — the composer answered no key before it. |
| **Turns accumulate across sends** | ❌ **B9.** Three sends, `chatStream` called three times, **one** turn on screen. |

**What the drive was worth.** Six claims confirmed, two defects found — and neither defect was
reachable by anything offline. `tsc` was clean, all 37 jest specs green and the jasmine suite green
with B8 dead and B9 live. **The specs grade the pure model, and both defects live in the seam between
that model and the panel that hosts it** — which is precisely the half the OBS-002 split makes
untestable in plain Node. That is the trade the split buys, and it means *the frame's own promise is
exactly what the frame's specs cannot check.*
