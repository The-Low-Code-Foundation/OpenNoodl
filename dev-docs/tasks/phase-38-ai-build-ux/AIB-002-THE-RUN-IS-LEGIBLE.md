# AIB-002 — The run is legible

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | 🔴 Critical — alpha blocker |
| **Difficulty** | 🟡 Medium |
| **Recommended executor** | 🟠 Opus |
| **Prerequisites** | none; land with [AIB-004](AIB-004-ONE-VOCABULARY-AND-A-REAL-PREVIEW.md) |

## Objective

While a plan is building, the user can see what it is doing, how far along it is, what it has cost —
and can review and act on each operation the moment that operation finishes, without waiting for the
rest.

## What happened

> *"the steps to build took a REALLY long time and there's very little animation to show wtf it's
> doing. You can't review any of the three steps it wanted to take after each one was built, you had
> to wait the really long time until everything was built."*

## The mechanism, verified

**The run is strictly serial, twice over.**
[`PlanRun.run()`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L268)
iterates component operations in a `for…of` with `await session.run()` inside. Then a **second**
sequential pass ([line 348](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L348))
runs the doc operations. Richard's plan was 3 components + docs — six serial model sessions, each
with its own multi-turn repair loop.

The second pass is deliberate and the reasoning is sound (a doc turn should see the finished work).
The component pass being serial is *not* argued for anywhere. Operations that don't depend on each
other have no reason to wait.

**Per-operation review is gated on the whole run.**
[`ProjectAuthoringView.tsx:468`](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L468):

```tsx
{done && op.status === 'staged' && (
  <><PrimaryButton label="Review" …/><PrimaryButton label={isExcluded ? 'Restore' : 'Exclude'} …/></>
)}
```

`done` is `runState.phase === 'done' || 'cancelled'` — the *entire* run. But the candidate is in
`filesById` the instant that operation stages, and `filesFor(id)` will return it. **The data is
already there and the UI refuses to show it.** Deleting `done &&` is most of this task.

**Cost is computed and never displayed.**
`PlanRunState.costUsd` is accumulated across every session
([PlanRun.ts:314](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L314))
and appears nowhere in `ProjectAuthoringView`. A grep for `costUsd` in the views directory returns
nothing.

**The activity feed is the active session only, and unlabelled.**
[Line 497](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L497):
`{runState.busy && runState.session && …}` — one flat list of `ActivityRow`s with no indication of
which operation they belong to, replaced wholesale when the next operation starts. There is no
elapsed time anywhere, and no "operation 2 of 3".

## Scope

### Slice 1 — review as it lands (the one-line half)

Change the gate from `done && op.status === 'staged'` to `op.status === 'staged'`.

Then handle what that exposes: reviewing an operation while a later one is authoring means
`setOperationFiles` can be called mid-run. It already guards on `status === 'staged'` and throws
otherwise, which is right. Confirm that the working-copy graph handed to *subsequent* sessions
reflects a mid-run edit — currently `workingGraph` is built from `outcome.files` at stage time
([line 325](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L325)),
so a user's partial-accept during the run will **not** be seen by later operations. Either rebuild
the working entry from `filesById` at the point each session starts, or say plainly in the UI that
edits apply to the plan, not to what the remaining operations see. Prefer the former.

### Slice 2 — per-operation progress

Each operation row shows, live:

- its own state — queued / authoring / staged / failed — which it already has;
- **elapsed time** while authoring, and final duration once staged;
- **its own** activity feed, under its own row, not a global one;
- attempt count when the repair loop is iterating (*"validating — attempt 2"*), which is the honest
  answer to "wtf is it doing" and is the single most reassuring thing on the screen during a long
  authoring turn.

`PlanOperationState` gains `startedAt`/`endedAt` and the session state is stored per operation
rather than only for the active one. Both are small additions to a class that already publishes on
every change.

### Slice 3 — the run header

Above the operation list, while running: **"Building 2 of 3 · 4m 12s · $0.38"**, and a Stop button
that already exists. On completion the same line becomes the total.

Showing cost during an alpha where every user brings their own key is not optional — it is the only
feedback loop they have on what a plan costs before they commit to one.

### Slice 4 — parallelism (decide, then do)

Component operations that do not depend on one another can author concurrently. Dependencies are
already computable: `planOperationRequires` derives edges over staged candidates, and the plan's
own operation order is available before the run.

**Decide:** run independent operations concurrently (bounded, ~3) or keep serial and just make the
wait legible? Richard's complaint is about legibility first — slices 1–3 may be enough. Parallelism
also weakens the cross-operation visibility guarantee that `workingGraph` provides, since two
concurrent operations cannot see each other's output.

**Recommendation: do slices 1–3, measure, and treat slice 4 as a separate decision** with a real
timing from a three-page plan in hand. Do not build it speculatively.

## Acceptance criteria

1. An operation is reviewable and excludable the moment it stages, with two more still running.
2. Each operation row shows elapsed time while authoring and its own activity feed.
3. The run header shows position, elapsed and cumulative cost, live.
4. Accepting a partial selection mid-run is either visible to later operations, or the UI states
   that it is not — no third option.
5. **Live**: a three-operation plan, driven through the real editor, reviewed at operation 1 while
   operation 3 is still authoring.

## Traps

- **HMR will not apply a new effect to a mounted panel** (OBS-003). Timers added here will appear
  not to work until a full reload.
- Sidebar panels are hidden-not-unmounted (WFA-002) — an elapsed-time interval must not keep ticking
  in a hidden panel, and equally must not be *reset* by the panel being hidden.
- `costUsd` is `null` when any turn had unknown pricing. Render that as "cost unknown", not `$0`.

---

## What was built (2026-08-03)

Slices 1–3. Slice 4 (parallelism) deliberately not built — see below. Criteria 1–4 are tested;
criterion 5 is the live replay.

### Where this task's stated mechanism had already moved

**Slice 1's second paragraph was stale before the task was picked up.** It says `workingGraph`
is built from `outcome.files` at stage time, so "a user's partial-accept during the run will
**not** be seen by later operations", and asks for a rebuild. AIB-003's rewrite of `PlanRun` had
already made `workingGraph()` a method that recomputes from `filesById` at the point each session
starts — so the "prefer the former" option was true before this task began. What was missing was
not a change but a **test**: `authoring-plan.test.ts` now edits a staged candidate from inside
`run.onChange` mid-run and asserts the next operation's project overview describes the edit
(`/Pages/Checkout — 1 nodes`). Criterion 4 is met by the first of its two options, and nothing
had to be built to meet it.

The corollary is worth carrying: **the only thing the validation gate does with a sibling
candidate is check that its name exists.** `validateCandidateComponent` passes
`components.map((c) => c.name)` to `buildComponentRefs` — no ports, no shape. So a mid-run edit
is visible to a later operation's *prompt* (the project overview renders node counts and the
component interface) and invisible to its *gate*. That is fine, but it means a test written
against the gate would have passed no matter which way the mechanism worked.

### What the run publishes now

`PlanOperationState` gained `startedAt` / `endedAt` / `session`, and `PlanRunState` gained
`startedAt` / `endedAt`. The clock is injected (`PlanRunOptions.now`) so a spec can pin a duration.

- **`session` per operation is the actual fix for the feed.** The task frames it as "its own
  activity feed, under its own row", which reads like a layout change. It is not: there was one
  `activeSessionState`, replaced wholesale when the next operation started, so operation 1's rows
  were *gone*, not misplaced. The run now keeps each session's last published state on the
  operation it belongs to, and the panel folds finished feeds behind a toggle.
- **The run clock is frozen when the run ends, and a retry does not restart it.**
  `retryOperation` runs after `done`, minutes of reviewing later; a header that resumed counting
  from `startedAt` would report the user's reading time as build time. The retried operation gets
  a fresh per-operation clock instead.
- **`costUsd` renders as "cost unknown", never `$0`** — and sub-cent totals render to four
  decimals, because `$0.00` after a real run reads as "nothing happened".

### The elapsed clock and the WFA-002 trap

The trap has two halves that pull against each other — do not tick in a hidden panel, do not
*reset* when the panel is hidden. Both fall out for free once elapsed is **derived** from the
timestamps the run publishes rather than accumulated in the view: the interval exists only to
force a re-render, so skipping it while hidden costs nothing, and a panel that comes back computes
the right number on its first frame. `useElapsedClock` skips the `setState` when
`ref.current.offsetParent === null` (an ancestor is `display: none`) and only runs at all while
`runState.busy`.

### Slice 4 — decided, not deferred

Not built, per the task's own recommendation, and the reason is now stronger than "measure first":
with slice 1 landed, the wait is no longer dead time. An operation is reviewable the moment it
stages, so the user has something to do while the rest run, which is what the complaint was
actually about. Parallelism would also cost the cross-operation visibility that `workingGraph`
provides and that criterion 4 has just been pinned on — two concurrent operations cannot see each
other's output. Worth revisiting with a real timing from a three-page plan; not worth building
blind.

### Criterion 5 — the live replay

Driven through the real editor by `packages/noodl-editor/scripts/aib38-live/scripted-plan.js`
(no provider: `AiClient.chatStream` replays a fixture plan and one submission per target, routed by
the component path in each session's opening message — the same seam AIX-015's single-component
driver uses). A three-operation plan; operation 1 reviewed, edited and kept while operations 2 and 3
were still authoring, asserted from the run's own state rather than from the screen:

```
ok  AIB-002 §1: an operation is reviewable while the rest still run      Building 2 of 3 · 7s · $0.01
ok  AIB-002 §3: the header reads position · elapsed · cost, live         Building 2 of 3 · 7s · $0.01
ok  AIB-002 §1 (live): the review is open while the rest is authoring    {"busy":true,"statuses":["staged","authoring","pending"]}
ok  AIB-002 §3: the finished header carries the authoring turns' total   3 of 3 built · 24s · $0.04
```

**The one thing live QA found that no spec could: a run that looks hung.** Operations 2 and 3
reported 3m21s and 4m25s for turns whose scripted work is seven seconds. It is not the editor —
Chromium throttles `setTimeout` in an occluded window to roughly one wake a minute, and the driver's
streaming loop slept four times per turn. It is recorded here because the *symptom* is a real one a
user can hit: the panel says "Writing — 3 nodes so far" and nothing else, indefinitely, and there is
no timeout anywhere in `PlanRun` or `AuthoringSession` that would ever end it. A provider that stops
responding mid-turn produces exactly this screen. **A per-turn deadline is not in this task and is
worth its own entry** — filed as AIB-009 F11.
