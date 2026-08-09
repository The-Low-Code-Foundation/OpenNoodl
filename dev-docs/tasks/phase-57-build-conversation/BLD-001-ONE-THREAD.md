# BLD-001 — One thread, one composer

**Status:** 🟢 **built and merged 2026-08-09** · ⚠️ **never driven** (register **B1**) · **Track A** ·
⭐ **the frame** · closes **D1**

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
- [x] A component build, a multi-component plan and a docs run all appear as turns in the same
      thread, in the order they happened. Built as `composeThread(history, pending, component, plan,
      docs)`; pinned offline (`composeThread` keeps order and lets at most one turn claim to be
      running). ⚠️ **Not driven** — see B1.
- [x] The agent's first sentence names the intent, and the override changes it without losing the
      typed request. The request is not lost **by construction**: the override re-routes the *plan*,
      and `plan.request` is the user's verbatim words, so there is no copy that could go missing.
- [ ] Switching away from the Build panel and back does not lose a run (the AIB-003 property).
      Unchanged in mechanism — both stores are still the owners and the panel is still a subscriber
      — but it is a **live** property and has not been driven. B1.
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
| **B1** | ⚠️ **Nothing here has been driven in a real editor.** Every claim above is `tsc` + 37 jest specs + 2582 jasmine specs, and this task changes what happens on screen in every state of the panel. Three things specifically have no offline check: the two embedded views rendering flat inside the thread's scroller, the sticky header/composer grid at 400px, and the send→plan→route round trip against a real provider. | **open** — the whole of BLD-010, arriving early for this task |
| **B2** | **Every send now costs a planning turn**, including one that turns out to be a single component. Argued in `thread/intent.ts`: it is on the `plan` role (LAS-009 — the step a mid-tier model does well and the one safest to point at a cheap model) and it buys the target and the declared ports. **The cost is real and unmeasured.** | **accepted, unmeasured** — measure it in BLD-010 |
| **B3** | The Docs panel's banner calls `requestReview()` and the old panel consumed it to open the review tab *and start it*. With no tabs, nothing consumed it — the button would have silently done nothing. It now **prefills the composer** rather than running: with the tabs gone, "the click is the start" would be a build kicked off by a panel switch, which is the thing this task removes. | **fixed in flight** |
| **B4** | `ProjectReviewView.startImmediately` lost its only caller. Kept, with the reason written on it, because BLD-009's second host may want it. **An inert prop is debt** — if nothing wants it by BLD-009, delete it. | **filed** |
| **B5** | The preview document still renders its own Accept/Reject bar (D2), and it is now the *second* copy alongside the one on the outcome card. This task moved the panel's half onto the card; **BLD-003 owns making exactly one surface own them at a time.** Do not count controls until BLD-003 lands. | **filed — BLD-003** |
| **B6** | ⚠️ **The thread made the AIX-012 launcher handover circular, and it would have lost a plan silently.** `ProjectAuthoringView` took the pending scope plan into the store in its own initialiser. Inside the thread it mounts as the outcome card of a *plan turn* — and a plan turn exists only when the store already holds a plan. A project created from the launcher's scoping conversation would have opened to an empty thread, with the agreed plan consumed by nobody and no error anywhere. Found by re-reading, not by a gate: `tsc` is clean either way, and no spec covers a handover between two components' mount order. **Fixed** — one `adoptScopePlan`, called by the panel first and by the view as a fallback, with the store's own content as the idempotence guard. | **fixed in flight** |
| **B7** | The plan view renders its own applied summary (with the backend endpoint, the registered pages and the settings written — AIB-007/AAQ-001/AAQ-003) *and* `planTurns` emits a `plan-applied` outcome whose fallback renders a shorter version of the same sentence. Both would have been on screen: **the duplicated-message defect this phase is measured on, reintroduced by a rendering detail rather than by a control.** **Fixed** — the live view attaches to the *last* plan turn, `plan-applied` included, which suppresses the fallback. | **fixed in flight** |

**B6 and B7 are the reusable pair.** Both are the same shape: a refactor that moves *when* a
component mounts changes the meaning of code that was correct about *what* it renders. Neither is
visible to a type system, neither is covered by a spec, and both were found by asking "who mounts
this, and when?" rather than by running anything.
