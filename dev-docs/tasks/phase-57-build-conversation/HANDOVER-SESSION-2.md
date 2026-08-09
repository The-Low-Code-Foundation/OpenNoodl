# Phase 57 — handover after session 2 (2026-08-09)

**What ran:** **BLD-001 ⭐, the frame.** The Build panel is now one thread of turns with one
composer. `AuthoringScope`, the three scope tabs and the banner-driven opening-tab state are gone.
Phase 57 is **3 of 16 built**; ⚠️ **none of the three has ever been driven in a real editor**, and
that is now the phase's single largest debt.

**The one thing worth carrying:** step 3 of the task told me to *check* whether the planning turn
could carry the intent classification before reaching for a separate call, and to prefer reusing it.
It can — and the check came back with a **second reason that is stronger than the cost argument it
was asked about**:

> **One composer needs a target from somewhere.**

`AuthoringSession` cannot start without a `componentPath`. The old component scope got it from a
text field the user typed `Pages/Customers` into by hand, where a typo silently created a second
component instead of revising the one they meant. A plan operation carries `target`. So routing
every request through `PlanningSession` is not merely *how* the intent is inferred — **it is what
makes a single composer possible at all**, and it also buys the LAS-006 declared inputs (`inputs`,
`repeats`) that the old single-component path never had and whose absence is the single most common
way an AI-built page renders identical placeholder chrome.

The generalisable form: *a task's stated reason for a design choice is not always its best reason.
The instruction here was "prefer reusing the planning turn (cost)"; the load-bearing reason turned
out to be a data dependency nobody had written down.*

## What is on the branch

| Commit | What |
|---|---|
| (this session) | BLD-001 — one thread, one composer; the intent comes from the planning turn |
| (this session) | Task/README/TASKS status, this file |

## What was built

**Two halves, and the split is the reusable decision.**

**Pure** — `packages/noodl-editor/src/editor/src/models/AiAssistant/thread/`:

| File | What |
|---|---|
| `types.ts` | `Turn = { id, request?, intent?, activities, outcome?, busy? }`, `BuildIntent`, `TurnOutcome` |
| `intent.ts` | `classifyPlan`, `decideIntent` (the agent's first sentence + the one override), `summarisePlan` |
| `turns.ts` | `componentTurns` · `planTurns` · `docsTurns` · `composeThread` · `freezeTurns` · `acceptedTurn` · `sessionNote` |

No React, no `ProjectModel`, no editor singleton — the OBS-002 boundary, for the OBS-002 reason.
**37 jest specs in `tests-unit/bld-001/`**, running in plain Node.

⚠️ **These are jest, not jasmine, and that is deliberate** — do not "fix" it. The AIX-011
jasmine-not-jest note is about specs that touch the DOM or an editor singleton. This mapping touches
neither, and `tests-unit/` runs it without needing a real Electron renderer to start.

**React** — `views/panels/AiAuthoringPanel/thread/`: `BuildThread.tsx` (header / scrolling turn list
/ composer, plus `ActivityRow`, moved here from the panel) and `ThreadBody.tsx`.

`AiAuthoringPanel.tsx` is now the **host**: it plans, routes, and hands `ProjectAuthoringView` and
`ProjectReviewView` their live objects as **outcome cards** (`isEmbedded`). Neither view's logic
moved; each lost its own composer and its own `ScrollArea`, and nothing else.

## The turn boundary was already in the code

`componentTurns` splits `AuthoringSessionState.activities` on `{ kind: 'user' }`. That is not a
heuristic. `AuthoringSession` pushes exactly one at the top of `run()` and one at the top of
`refine()`, and nothing else does — **the feed has been carrying its own turn boundaries the whole
time and never needed a parallel structure to record them.** Worth checking for before inventing
one: the shape you need is often already being written by something that had a different reason to
write it.

The one non-obvious call in the mapper, pinned by spec: **a staged candidate hangs off the LAST
turn, not the turn that produced it.** `state.staged` outlives a failed refinement, so attributing
it to its producing round would put a live Accept button halfway up a scrolled thread with a newer,
failed round below it.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **86 suites, 1162 tests, all passing** |
| `test:ci` | **`Jasmine: …`** — see below |

**The counts reconcile:** `test:main` `84 / 1125 → 86 / 1162` = +2 suites / +37 tests, which is
exactly `tests-unit/bld-001/intent.test.ts` (14) and `turns.test.ts` (23). Nothing else moved.

⚠️ **A `test:ci` run piped through `tail -40` is not a verdict.** The first run of this session was,
and the captured output held five `FAILED:` names, no `Jasmine:` line and no summary — which reads
exactly like the "a sibling `dev:stop` swept the suite" signature in
[[no-concurrent-session-on-opennoodl]] and is not that at all. **The pipe ate the summary.** Redirect
to a file (`> log 2>&1`) and grep it; never tail a suite you intend to read a verdict from.

## Two defects the refactor created, and how they were found

Both are in BLD-001's register (**B6**, **B7**), both were fixed in flight, and they are the same
shape — which is why they are worth carrying:

> **Moving *when* a component mounts changes the meaning of code that was correct about *what* it
> renders.**

- **B6 — the launcher handover went circular and would have lost a plan in silence.**
  `ProjectAuthoringView` took the AIX-012 pending scope plan into `PlanSessionStore` in its own
  initialiser. That was sound while a tab click mounted it. Inside the thread it mounts as the
  outcome card of a *plan turn* — and a plan turn exists only when the store already holds a plan.
  A project created from the launcher's scoping conversation would have opened to an empty thread
  with the agreed plan consumed by nobody.
- **B7 — the applied summary would have rendered twice**, once from the embedded view (with the
  backend endpoint and registered pages) and once from the turn's fallback outcome. The duplicated
  message this phase is measured on, reintroduced by a rendering detail rather than by a control.

**Neither is reachable by any gate this repo has.** `tsc` is clean either way; no spec covers the
mount order of two components; and the jasmine suite has no panel specs at all. Both were found by
asking *"who mounts this, and when?"* — which is the question worth asking of every component a
refactor re-parents, before trusting a green board.

## ⚠️ Nothing here has been driven

This is BLD-001's register **B1**, restated because it is the first thing the next session should
fix. Everything above is `tsc` + 37 jest specs + the jasmine suite. **BLD-001 changes what is on
screen in every state of the panel**, and three things have no offline check at all:

1. The two embedded views rendering **flat** inside the thread's scroller (`ThreadBody` returns a
   fragment when `isEmbedded`). A nested scroller would eat the wheel event; a missing wrapper would
   lose the padding both views assumed.
2. The header / list / composer **grid at 400px** — the composer is `flex: 0 0 auto` under a
   `min-height: 0` list, and that arrangement is exactly what POL-007 spent a page of commentary on
   the last time.
3. The **send → plan → route** round trip against a real provider. No provider has ever answered
   this code path.

**Register B2 is the one with a cost attached:** every send now spends a planning turn, including
one that turns out to be a single component. The argument is written in `thread/intent.ts` and I
believe it, but **it is unmeasured**, and it is the kind of claim that should be measured before it
is defended.

## What to do next

1. ⭐ **Drive it.** One editor session pays BLD-001's B1, BLD-007's criterion 1 and BLD-012's
   live-turn claim together — all three are the same authoring loop, and BLD-012's is the one with
   a bill attached to getting it wrong (*"no symptom except the bill"*). Read
   [[editor-cdp-driving-traps]] and [[occluded-electron-clamps-timers]] first; the editor is a
   **queue**, so poll if another session has it.
2. **BLD-003, then BLD-002.** BLD-003 is now urgent in a way it was not this morning: the panel's
   Accept/Discard moved onto the outcome card, so the preview document's copy is the *second* one on
   screen. **Do not count live controls until BLD-003 lands** — the ≤4 measurement will read wrong.
   BLD-002 then owns the five treatments, and the type-scale fix for D4. ⚠️ Both must keep the README
   correction: **contrast is not the legibility problem.** No colour tokens.
3. **BLD-005** is smaller than it looks and is now nearly free: `BuildThread` already has a header
   row *outside* the scroll area, which is the thing `runHeadline` needed and did not have. Most of
   what is left is the honest estimate.
4. **Phase 58 (AWP) is at 3 of 6**, entirely `noodl-mcp` + `scripts/devtools` — no webpack rebuild,
   no editor. Still the natural parallel track to anything in here that needs the editor.

## Concurrency

⚠️ **A second session was live throughout.** It is working in
`dev-docs/tasks/phase-46-verification/` and it committed `6e8432db` mid-session. Territory is
disjoint (mine: `dev-docs/tasks/phase-57-build-conversation/` + `packages/noodl-editor/**`), every
commit here used `git commit -- <explicit paths>`, and nothing of theirs was swept. **Re-check
`git status` immediately before every commit** — "clean at the start" is not a finding that stays
true, and this checkout has now proved it three sessions running.

## Fixture and worktrees

No fixture touched, no project opened, no worktree created — this session worked directly in the
main checkout because BLD-001 is a single-surface refactor with no parallel sibling. The two
scratchpad worktrees from session 1 are still merged and still removable.
