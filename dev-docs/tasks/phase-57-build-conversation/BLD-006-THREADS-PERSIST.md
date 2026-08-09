# BLD-006 — Threads persist

**Status:** ✅ **built, driven and closed** (2026-08-09, session 10) · **Track A** · after BLD-001 ·
closes **D5**

> ⚠️ **Three premises in this doc were wrong about mechanism, and one control had to be split in
> two.** The path is `.nodegx/`, not `.noodl/` (R1); the platform has no append (R2); and the
> switcher is **not one rule** — starting a new thread is the user saying they are done with this
> build, which `retire()` already covers, while *switching to read an older one is navigation, and
> navigation may not destroy authored output*. Routing both through `retire()` would have made a
> staged eight-node component evaporate on a dropdown click. See `ThreadSwitcher.tsx`.

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

**All five driven live in `ai-test` on 2026-08-09 (session 10).**

- [x] Accept a build → the conversation is still fully readable, including the request and the
      activity strip. — *the request, the agent's sentence, the collapsed activity run, the staged
      line and then the receipt "Added /Ui/DriveOne to your project — undo removes it", all still on
      screen after the accept.*
- [x] Quit the editor, reopen, open the same project → the thread is there, with its outcomes. —
      *full `dev:stop` + relaunch; reopened on the most recently updated thread with its turns.*
- [x] Switch to another project and back → the thread returns; nothing from project B appears in
      project A. — *`lib21-qa` opened with an empty thread; back in `ai-test`, the conversation
      returned.*
- [x] Three threads in one project are individually reachable from the switcher. — *three built,
      listed newest-first with relative times, and switching to the first returned both its bubbles,
      its plan summary and its accept receipt.*
- [x] A thread file is readable by a human (`jsonl`, one turn per line). — *`.nodegx/threads/
      msm2tfph-1.jsonl`: a header line, then one line per turn, `cat`-able.*

## Register

| # | Finding | State |
|---|---|---|
| R1 | ⚠️ **The task doc's `.noodl/ai-threads/` does not exist in this codebase.** The sidecar directory has been `.nodegx/` since the rebrand, with one helper (`utils/nodegxSidecar`) both existing writers go through so that "make sure git ignores it" cannot exist in two copies. Built at `.nodegx/threads/<id>.jsonl`; Q2's *decision* (machine records, never in a PR) is unchanged and verified — `.nodegx/` is in the fixture's `.gitignore`. | ✅ built as corrected |
| R2 | ⚠️ **"Append-only" has no platform support.** `IFileSystem` offers `writeFile` / `writeFileOverride` / `readFile` and no append. The sidecar rewrites the whole file from the in-memory thread; the *content* is still append-only (lines are only ever added), which is the property the format was chosen for. | ✅ documented in `threadRecord.ts` |
| R3 | ⚠️ **`PlanSessionSidecar.flush()` was written for the quit path in AIB-003 slice 4 and never had a caller.** An unapplied build staged inside its 750ms debounce was lost to ⌘Q — the same defect `flushPendingProjectSave` exists to fix, one directory over. Both sidecars now ride the `flush-project-save` IPC handshake. | ✅ fixed (`flushAiSidecars`) |
| R4 | **R6 confirmed and fixed** — the request rendered twice for the whole of every component build. `send` awaits `routePlan`, which awaits `session.run()`, so `planningRequest` (and its pending turn) outlived the producer that had the same words. It read as a retired turn because `composeThread` clears `busy` on all but the last. The pending turn now stands in only while `liveTurns` is empty. | ✅ fixed and driven |
| R5 | ⚠️ **Removing that duplicate uncovered a hole it was hiding: a docs run had no request at all.** `docsTurns` has always accepted one and `liveTurns` never had one to give. `LiveSources.request` now carries it. Nobody had seen it because the pending turn was showing the same words two lines up. | ✅ fixed |
| R6 | ⚠️ **Restore left an empty *"New thread"* in the switcher on every launch** — the store mints a blank on first `get()`, the disk read re-points away from it, and nothing pruned it. Invisible to the specs because they all seeded a thread that had something in it. **Found by driving a restart.** | ✅ fixed (`prune`) |
| R7 | ⚠️ **"Is the current thread blank?" is not "did anyone choose it?"** Fixing R6 exposed it: a blank the *user* asked for by pressing New thread is as blank as the one the store minted, and re-pointing away from it yanks them into last week's conversation because a disk read finished. `ThreadsState.chosen` separates them. **Caught by a spec, before the drive.** | ✅ fixed |
| R8 | ⚠️ **`MenuDialog.is-highlighted` recolours `h2`, `.Label span` and `.Icon path` — but not `EndSlot`.** The selected row's timestamp measured **1.16:1** on the primary fill; the row that is selected was the one row whose time could not be read. Fixed locally (6.94 dark / 4.57 light, both AA). **Filed for a design-system pass: it is a trap at every `MenuDialog` with an `endSlot`, not a defect of this panel.** | 🔴 filed (UIX) · fixed here |
| R9 | **`IconButton`'s `label` renders as visible text.** The `+` button read *"New thread"* beside a switcher already reading *"New thread"* — the same words twice — and a fixed-width label takes its space from the one element in the row that shrinks. Icon-only with a tooltip. | ✅ fixed |
| R10 | **The selected thread is not persisted.** A restart reopens on the most recently *updated* thread, not the one that was last being read. Deliberate for now — `chosen` is about a sitting, not about the project — but it is a decision, not an oversight. | 📋 filed |
| R11 | **A component session does not survive a restart, so an unfinished component build is not in the thread.** Only *retired* turns are durable; a live turn is derived from a session, and `planSessionSnapshot`'s rule stands — *a restart is a stop*, and a half-finished model turn cannot be resumed. A restored **plan** does come back, because `PlanSessionStore` persists it. | 📋 by design, stated |
| R12 | **The quit *flush* itself is wired, not driven.** Persistence across a restart is driven; that the 750ms debounce is drained by ⌘Q specifically is inferred from the IPC wiring. Needs a timed append-then-quit. | 📋 **BLD-010** |
| R13 | **Build item 5 (bound the memory) is measured, not built.** `ThreadSidecar` reads at most `THREAD_READ_LIMIT` (25) files per project and **logs what it skipped rather than dropping it silently**; nothing is ever deleted. The rendered list does not virtualise — the three-thread drive gave no reason to, and the task says measure first. | 📋 revisit if a thread gets long |
