# BLD-001 — One thread, one composer

**Status:** 📋 not started · **Track A** · ⭐ **the frame — start here** · closes **D1**

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

- [ ] Every state in the mockup renders inside one component with one composer; `AuthoringScope` no
      longer exists in the tree (`grep -r AuthoringScope` returns nothing).
- [ ] A component build, a multi-component plan and a docs run all appear as turns in the same
      thread, in the order they happened.
- [ ] The agent's first sentence names the intent, and the override changes it without losing the
      typed request.
- [ ] Switching away from the Build panel and back does not lose a run (the AIB-003 property, still
      held — now by construction rather than by two stores compensating).
- [ ] Jest/jasmine: the turn mapper is pinned for all three producers. ⚠️ Editor specs are
      **jasmine, not jest** — see the AIX-011 note.

## Register

| # | Finding | State |
|---|---|---|
| | | |
