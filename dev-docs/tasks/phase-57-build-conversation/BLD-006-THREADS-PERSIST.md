# BLD-006 — Threads persist

**Status:** 📋 not started · **Track A** · after BLD-001 · closes **D5**

## The defect, measured

**Accepting a build deletes the record of it.** On accept the panel calls `session.dispose()` and
`setState(null)`
([AiAuthoringPanel.tsx:349-352](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L349)).
What you asked for, what the agent read, what it repaired, and what it decided all vanish at
precisely the moment they became part of your project.

There is no thread list, no way back, and no transcript on disk — with one exception that proves the
point. A project scoped in the launcher writes its conversation to a decision record, and **nothing
ever displayed it** until AIB-003 noticed:

> *"This is also the answer to 'I don't see any conversation history': the transcript was written to
> disk at creation and nothing ever showed it."*
> — [ProjectAuthoringView.tsx:1177-1184](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L1177)

That recovery path is a one-shot *"Load this plan"* offer, not history.

## The precedent to follow, not reinvent

`PlanSessionStore` + `PlanSessionSidecar` already solve "a build survives navigation and restart",
keyed by project, with a considered eviction policy (none — *"quietly dropping an authored candidate
to save a few hundred kilobytes is the defect this module exists to remove"*,
[PlanSessionStore.ts:38-42](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanSessionStore.ts#L38)).
**Reuse that shape.** A thread store is the same problem one level up.

⚠️ **Verify first:** read `installPlanSessionPersistence.ts` and `planSessionSnapshot.ts` before
designing a format. If the sidecar can carry a thread with a widened snapshot, do that rather than
adding a second persistence mechanism beside it.

## Build

1. **A thread is durable from its first message**, per project. `.noodl/ai-threads/<id>.jsonl` —
   append-only, one record per turn.
   - **Q2 is open** (README). Assumed: `.noodl/`, **not** `docs/` — these are machine records, not
     prose for humans, and they should not land in a pull request. If Richard wants them in git,
     that is a one-line path change plus a `.gitignore` decision, so do not build around the
     assumption.
2. **Accept appends a receipt; it does not clear.** The outcome card collapses to one line —
   *"✓ Added /Basket popup — 8 nodes, 4 connections. One undo removes it. Open ↗"* — and stays.
   `setState(null)` goes.
3. **A thread switcher in the panel header**: current thread name, a dropdown of recent threads with
   relative times, and a new-thread control. Thread titles are derived from the first message.
4. **Threads are per project and survive a project switch** — the `PlanSessionStore` keying rule and
   its resolution of "survives switching projects" vs "does not leak past a close" applies unchanged.
5. **Bound the memory, not the history.** Old turns stay on disk; the rendered list virtualises or
   windows. ⚠️ A twenty-operation build produces a lot of activity records — measure before deciding
   this is a problem, but do not let it become one silently.

## Acceptance

- [ ] Accept a build → the conversation is still fully readable, including the request and the
      activity strip.
- [ ] Quit the editor, reopen, open the same project → the thread is there, with its outcomes.
- [ ] Switch to another project and back → the thread returns; nothing from project B appears in
      project A.
- [ ] Three threads in one project are individually reachable from the switcher.
- [ ] A thread file is readable by a human (`jsonl`, one turn per line) — it is a debugging surface
      as much as a feature.

## Register

| # | Finding | State |
|---|---|---|
| | | |
