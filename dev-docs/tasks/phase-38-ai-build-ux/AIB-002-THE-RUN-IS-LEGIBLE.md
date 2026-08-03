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
