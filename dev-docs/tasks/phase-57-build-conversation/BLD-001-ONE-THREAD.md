# BLD-001 — One thread, one composer

**Status:** ✅ **built, driven and closed 2026-08-09** — `a93720b3` (the frame), `02c3072c` (the
composer's Enter binding), `458e189f` (**B9 + B10**) · **Track A** · ⭐ **the frame** ·
**closes D1**

The first drive closed B1 and found **B9 — the thread reset on every successful send**, which is
D1's own promise. B9 is fixed and re-driven from an empty thread; **B10**, a duplicate Accept on
retired turns, was found while fixing it and is fixed and driven too. Every acceptance box is
ticked. Still open and owned elsewhere: **B2** (the planning turn's cost, unmeasured — BLD-010),
**B4** (an inert prop — BLD-009), **B5** (the preview document's second Accept bar — BLD-003),
**B8** (two Enter contracts on one panel — BLD-002/010).

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
- [x] ✅ A component build, a multi-component plan and a docs run all appear as turns in the same
      thread, in the order they happened. **The first drive falsified this** — `composeThread` did
      keep order, but the *plan* group it was handed came from the one live session and nothing
      retired the previous one into `history`, so three sends left one turn (**B9**). Closed by
      `retireLive`, and re-driven from an empty thread: three sends, three provider calls, three
      turns, in order. ⚠️ Driven with **three plan runs plus two component builds**, not with a docs
      run — the docs producer needs a review provider the drive did not script, and `docsTurns` is
      the same shape through the same `liveTurns`. **BLD-010 owns the mixed-producer pass.**
- [x] The agent's first sentence names the intent, and the override changes it without losing the
      typed request. The request is not lost **by construction**: the override re-routes the *plan*,
      and `plan.request` is the user's verbatim words, so there is no copy that could go missing.
- [x] ✅ Switching away from the Build panel and back does not lose a run (the AIB-003 property).
      **Driven** 2026-08-09: `SidebarModel.instance.switch('components')` then back to
      `'ai-authoring'` — the plan, its two operations and the `Author plan (2)` control all survived,
      as did the request turn. The stores are still the owners; the panel is still a subscriber.
- [x] Jest/jasmine: the turn mapper is pinned for all three producers. **45 specs**,
      `tests-unit/bld-001/` (37 for the frame, **+8 for `liveTurns` / `retireLive`** — including the
      three-sends simulation that reproduces B9 and the id predicate that closes trap 1). ⚠️ These are **jest**, not jasmine, and deliberately: the mapping is
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
| **B5** | The preview document still renders its own Accept/Reject bar (D2), and it is now the *second* copy alongside the one on the outcome card. This task moved the panel's half onto the card; **BLD-003 owns making exactly one surface own them at a time.** Do not count controls until BLD-003 lands. | **filed — BLD-003** · ⚠️ **measured 2026-08-09** while driving B10: with a candidate staged there are **2 Accept and 2 Review changes** on screen — one pair in `BuildThread-module__Turn`, one in `AuthoringPreviewDocument-module__Topbar`. ⚠️ **And the two copies disagree on wording:** the thread says **Discard**, the preview still says **Reject** — the D3 correction (red means danger; nothing has been written) landed on one surface only. BLD-003 owns both halves |
| **B6** | ⚠️ **The thread made the AIX-012 launcher handover circular, and it would have lost a plan silently.** `ProjectAuthoringView` took the pending scope plan into the store in its own initialiser. Inside the thread it mounts as the outcome card of a *plan turn* — and a plan turn exists only when the store already holds a plan. A project created from the launcher's scoping conversation would have opened to an empty thread, with the agreed plan consumed by nobody and no error anywhere. Found by re-reading, not by a gate: `tsc` is clean either way, and no spec covers a handover between two components' mount order. **Fixed** — one `adoptScopePlan`, called by the panel first and by the view as a fallback, with the store's own content as the idempotence guard. | **fixed in flight** |
| **B7** | The plan view renders its own applied summary (with the backend endpoint, the registered pages and the settings written — AIB-007/AAQ-001/AAQ-003) *and* `planTurns` emits a `plan-applied` outcome whose fallback renders a shorter version of the same sentence. Both would have been on screen: **the duplicated-message defect this phase is measured on, reintroduced by a rendering detail rather than by a control.** **Fixed** — the live view attaches to the *last* plan turn, `plan-applied` included, which suppresses the fallback. | **fixed in flight** |
| **B9** | ⚠️ **The thread reset on every successful send — D1's own promise, and the phase's exit test.** Driven: three requests sent through a scripted planning provider, `chatStream` called **3 times**, and the thread held **only the third**. `turns` is `composeThread(history, pending, <derived from the ONE live session>)`, and `history` is appended in exactly three places — the component accept path, the component discard path, and `send`'s *declined*/*failed* branches ([AiAuthoringPanel.tsx:358-364](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L358)). The **success** path never retires the live turns, so `routePlan` replaces the plan session and the previous turn evaporates. The declined/failed branches are the tell that accumulation was intended and the success path was simply missed. **Not fixed here, deliberately:** a fix must also clear two traps, and rushing it reintroduces the exact defect B7 is about. (1) `freezeTurns` only strips `busy`, so frozen turns keep their `plan-*` ids, and `lastPlanTurnId` picks the last one — freeze without re-prefixing and the *live* plan view mounts on a **historical** turn. (2) `showPlan` is `route === 'plan' \|\| Boolean(planSession.plan)`, so if a later request routes to `component` while the store still holds the old plan, the frozen copy and the live derivation are **both** on screen — the duplicated message this phase is measured on. | ✅ **fixed and driven 2026-08-09** (`458e189f`) — see *The B9 fix* below. Both traps are closed **by construction**, not by care: the id prefix *is* the liveness, and retiring is a pair (freeze the record, release what produced it) |
| **B10** | ⚠️ **A retired turn kept the Accept card — a duplicate control the accept path already had, before B9 existed.** `renderOutcome` matched `turn.outcome?.kind === 'staged-component' && canDecide`, and neither half is turn-specific: a frozen turn keeps the `staged-component` outcome it had when it was frozen (it should — what it built is worth reading), and `canDecide` is a *session-wide* flag. So the moment a second build staged, the historical turn rendered a second Accept/Review/Discard card beside the live one. **Found by writing B9's fix, not by driving B9** — re-prefixing ids made the question "what else keys off a turn's identity?" unavoidable, and this was the answer. Fixed by matching the live id (`component-`), the same convention the `plan-` and `docs-run` branches already used. | ✅ **fixed and driven 2026-08-09** — two builds with an accept between them: the frozen `history-3-component-0` turn carries no Accept, the live `component-0` carries one. |
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
| **Turns accumulate across sends** | ❌ **B9.** Three sends, `chatStream` called three times, **one** turn on screen. ✅ **re-driven after the fix** — three turns, in order. |

**What the drive was worth.** Six claims confirmed, two defects found — and neither defect was
reachable by anything offline. `tsc` was clean, all 37 jest specs green and the jasmine suite green
with B8 dead and B9 live. **The specs grade the pure model, and both defects live in the seam between
that model and the panel that hosts it** — which is precisely the half the OBS-002 split makes
untestable in plain Node. That is the trade the split buys, and it means *the frame's own promise is
exactly what the frame's specs cannot check.*

## The B9 fix — 2026-08-09 (`458e189f`)

**The contract was not new; it had gone missing.** The pre-BLD-001 panel opened `startPlanning` with
`reset()`, commented *"planning a new request is the user saying they are done with the previous
one"*. The refactor kept every *other* path that retires a session — accept, discard, declined,
failed — and dropped the one on the success path. So the semantics were right all along and the
record was the thing that never existed: `reset()` destroyed the previous request, it did not keep
it. **What is new is that the conversation survives the retire.**

### One derivation, read twice

`liveTurns(sources, idPrefix?)` is the whole mechanism. The panel's `turns` memo calls it with no
prefix; `retireLive` calls it with `history-N`. Because it is *one* function, the two readings cannot
drift — and drift is what both traps were made of.

**The prefix is the liveness.** With no prefix the ids are `component-…`, `plan-…`, `docs-run`, and
those exact strings are what `renderOutcome` matches to decide where to mount a live control. With a
prefix, **none of those matches can fire**. Trap 1 (a frozen `plan-*` id capturing `lastPlanTurnId`,
so the live plan editor mounts on a historical turn) is not guarded against — it is unreachable.

**Retiring is a pair.** Freeze the record, then release what produced it: dispose the session, clear
`PlanSessionStore`, clear `ProjectReviewStore`. Trap 2 (the frozen copy and the live derivation on
screen together) is closed by the second half. ⚠️ Doing only the first half is worse than doing
neither — it *is* the duplicated message the phase is measured on.

### Three things worth carrying

⚠️ **Releasing a source destroys authored output, and AIB-003 says only the user may.** `store.discard`
disposes the run *and removes the sidecar from disk*. Sending a new request is the user saying so —
that is the pre-existing contract — but the release is **guarded on there having been something
live**, and that guard is not an optimisation: a saved build from a previous launch is restored
asynchronously, so an unguarded discard on a first send would delete a build that had not finished
coming back yet.

**Nothing can be retired mid-flight,** which removes the whole class of "released a running session"
bugs: `canSend` is false while anything is busy, so what is being released has always finished.

**Retiring *before* the planning call makes the thread's order an invariant** rather than a race:
history is always older than the pending turn, which is always older than whatever is live. Retiring
on success only would have left a declined note sitting *above* the older live turn it followed.

### The drive — three sends, from an empty thread

⚠️ **The first attempt measured the previous attempt.** An aborted run left a plan live in
`PlanSessionStore` (durable by design) and turns in the panel's `history` (not durable), and the
re-run inherited both — four turns where three were expected, with the first request twice. **The
reset that works is not obvious:** switching sidebar panels does *not* clear it, because
`PlanSessionStore`'s own module note is literally true — **sidebar panels are hidden, not
unmounted**, so `history` survives the switch. Only a restart gives an empty thread.

*A drive that starts from whatever the last drive left is measuring two runs at once. Assert the
starting state, do not assume it.*

| Claim | Result |
|---|---|
| Starts empty | ✅ asserted, 0 turns, after an editor restart |
| Three sends → three provider calls | ✅ `chatStream` called 3×, each seeing its own request |
| Three turns, in the order they happened | ✅ `history-0-plan-proposed` → `history-1-plan-proposed` → `plan-proposed` |
| Retired turns carry the record, not the control | ✅ 3 lines each (request + sentence + one-line plan summary) vs **13** for the live turn |
| One live control set | ✅ exactly one `Author plan` / `Discard plan` pair, on `plan-proposed` |
| A retired turn grows no second Accept (**B10**) | ✅ two component builds with an accept between them: `history-3-component-0` has none, live `component-0` has one |
| Panel switch away and back | ✅ all three turns preserved |

⚠️ The Accept count **on screen** is still 2 — the second pair is `AuthoringPreviewDocument`'s
topbar, which is **B5**, and it is not this fix's. The thread's own count is 1.

**Fixture:** the drive accepted one component into `ai-test` and it was reverted (`git checkout --
project.json`). The editor's own `.nodegx/` line in that project's `.gitignore` was left — it is the
editor's behaviour on open, not drive litter.
