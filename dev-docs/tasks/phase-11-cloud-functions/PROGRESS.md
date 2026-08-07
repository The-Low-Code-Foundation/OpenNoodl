# Phase 11: Cloud Functions — Progress Tracker

**Phase Status:** 🔵 In Progress (execution-history pipeline built but not connected end-to-end)
**Last Updated:** 2026-07-23 (REV-006 documentation truth pass)
**Audited by:** REV-006 (see `dev-docs/tasks/phase-12-reanimation/REV-006-DOCS-TRUTH-PASS.md`)

---

## Status vocabulary

| Status | Meaning |
|---|---|
| **Not started** | No code exists for this task. |
| **In progress** | Some code exists but the task's deliverables are incomplete. |
| **Built–not wired** | Deliverable(s) exist and are tested, but have zero call sites in the application outside tests. |
| **Complete** | Deliverable exists, is tested, AND has real call sites in the app (outside tests). |
| **Superseded** | The task's goal was later addressed by different work, or the task itself is obsolete. |

---

## Summary of true current state

The previous version of this file claimed **~10% complete**, with only CF11-004 and CF11-005 done and CF11-006/007 "Not Started." That was stale by five weeks. Commits `7d373e0` and `83278b4` (2026-02-18, Dishant) confirm **CF11-006 (Execution History Panel UI)** and **CF11-007 (Canvas Execution Overlay)** were also built, tested, and wired into the running application (sidebar panel registration in `router.setup.ts`; overlay mounted and driven from `nodegrapheditor.ts`'s render/pan-zoom loop). So far this matches the "known lead."

However, a deeper look changes the overall picture in the **opposite** direction for CF11-004/005: they are **not actually "Complete" either**. `ExecutionStore` (CF11-004) and `ExecutionLogger` (CF11-005) exist as well-tested library code in `packages/noodl-viewer-cloud/src/execution-history/`, but grepping the whole main process and `CloudRunner`/`WorkflowRunner`/`BackendManager` turns up **zero imports of either class outside their own test files**. CF11-005's own spec says the point of the task is "Integration hooks in CloudRunner... without it the database remains empty" — and that integration was never built. There is also no `ipcMain.handle` registered anywhere in `packages/noodl-editor/src/main` for the `execution-history:list` / `execution-history:get` channels that the CF11-006 panel's hooks call (`useExecutionHistory.ts`, `useExecutionDetail.ts`) — those channel names appear nowhere on the main-process side, only as strings the renderer calls into a void.

Net effect: **the whole execution-history feature is UI-complete but data-pipeline-broken.** A user opening the Execution History panel today will find it wired into the sidebar and rendering correctly, but it has no IPC handler to answer it and, even if one existed, no execution has ever been logged to feed it, because CloudRunner never calls the logger. CF11-006/007 satisfy the literal "Complete" bar (real call sites outside tests), so they're recorded as Complete below — but this is flagged prominently as functionally non-functional pending a new integration task, since none of CF11-001–007 currently owns closing that gap.

Series 1 (CF11-001 Logic Nodes, CF11-002 Error Handling Nodes, CF11-003 Wait/Delay Nodes) remains **exactly as documented**: not started. Only the task spec `README.md` exists in each folder; no implementation code, no commits, no test files were found anywhere in the repo for IF/switch/for-each/merge nodes, try/catch/retry nodes, or wait/delay nodes.

---

## Task table

| ID | Title | Status | Evidence (commit / path) | Notes |
|---|---|---|---|---|
| CF11-001 | Logic Nodes (IF/Switch/ForEach/Merge) | **Not started** | Only `CF11-001-logic-nodes/README.md` (spec) exists; `git log --all --grep="CF11-001"` returns nothing; no matching source files anywhere in `packages/` | Still blocked on Phase 5 TASK-007C (Workflow Runtime/CloudRunner triggers) per the task's own prerequisites |
| CF11-002 | Error Handling Nodes (Try/Catch, Retry) | **Not started** | Only `CF11-002-error-handling-nodes/README.md` (spec) exists; no source, no commits | Same blocker as CF11-001 |
| CF11-003 | Wait/Delay Nodes | **Not started** | Only `CF11-003-wait-delay-nodes/README.md` (spec) exists; no source, no commits | Same blocker as CF11-001 |
| CF11-004 | Execution Storage Schema | **Built–not wired** | `packages/noodl-viewer-cloud/src/execution-history/{store.ts,types.ts,schema.sql,index.ts}`, commit `8938fa6` ("feat(viewer-cloud): add ExecutionStore for workflow execution history"); tested in `packages/noodl-viewer-cloud/tests/execution-history.test.ts` (572 lines) | `ExecutionStore` is never instantiated anywhere outside its own tests — grep confirms zero imports in `BackendManager.js`, `WorkflowRunner.js`, or `LocalBackendServer.js`. No task in this folder currently closes this; CF11-005 was meant to (see below) but didn't finish the job |
| CF11-005 | Execution Logger Integration | **Built–not wired** | `packages/noodl-viewer-cloud/src/execution-history/ExecutionLogger.ts`, commit `95bf2f3` ("feat(viewer-cloud): add ExecutionLogger for workflow execution tracking"); tested in `packages/noodl-viewer-cloud/tests/execution-logger.test.ts` (439 lines) | The task's own spec ("Integration hooks in CloudRunner... without it the database remains empty") was not delivered — `ExecutionLogger`/`ExecutionStore` have zero call sites in `CloudRunner`/`WorkflowRunner`/`BackendManager`. **No IPC handler for `execution-history:list` or `execution-history:get` exists anywhere in `packages/noodl-editor/src/main`** — the channels the CF11-006 panel calls have no listener. **This is the integration gap that currently has no owning task — flag for human review**, e.g. a new task ("wire ExecutionLogger into CloudRunner + register IPC handlers") is needed before CF11-006/007 can show real data |
| CF11-006 | Execution History Panel UI | **Complete** (UI layer only — see caveat) | `packages/noodl-editor/src/editor/src/views/panels/ExecutionHistoryPanel/**`, registered in `router.setup.ts:22,171` (sidebar order 8.8) — real call site outside tests; commit `7d373e0`; 15 unit tests in `tests/cloud/ExecutionHistoryPanel.test.ts`; also see `PROGRESS-dishant.md` | Satisfies the literal "Complete" bar (real call site in the running app), but is functionally inert: its data hooks call `execution-history:list`/`execution-history:get` IPC channels that have no main-process handler (verified by grep — no hits outside this panel's own call sites and bundled build artifacts), and no execution is ever logged upstream (CF11-005 gap). Will render an empty/erroring panel today |
| CF11-007 | Canvas Execution Overlay | **Complete** (UI layer only — see caveat) | `packages/noodl-editor/src/editor/src/views/CanvasOverlays/ExecutionOverlay/**`; wired into `nodegrapheditor.ts` (`renderExecutionOverlay()`/`updateExecutionOverlay()`, called from `render()` and `setPanAndScale()`) and `nodegrapheditor.html` (`#execution-overlay-layer`) — real call sites outside tests; commit `83278b4`; 20 unit tests in `tests/cloud/ExecutionOverlay.test.ts` | Same caveat as CF11-006 — mounted and reacts to pan/zoom/pin events correctly, but there is no real execution data flowing into it end-to-end today because of the CF11-004/005 wiring gap |
| CF11-008 | Docker Container Builder | Not started | No matching source found; not in scope of this audit (no task folder yet) | Series 3, unstarted per spot-check grep |
| CF11-009 | Fly.io Deployment Provider | Not started | No matching source found | Series 3, unstarted per spot-check grep |
| CF11-010 | Railway Deployment Provider | Not started | No matching source found | Series 3, unstarted per spot-check grep |
| CF11-011 | Cloud Deploy Panel UI | Not started | No matching source found | Series 3, unstarted per spot-check grep |
| CF11-012 | Metrics Collection System | Not started | No matching source found | Series 4, unstarted per spot-check grep |
| CF11-013 | Monitoring Dashboard UI | Not started | No matching source found | Series 4, unstarted per spot-check grep |
| CF11-014 | Alerting System | Not started | No matching source found | Series 4, unstarted per spot-check grep |
| CF11-015 | Python Runtime Bridge | Not started | No matching source found | Series 5, unstarted per spot-check grep |
| CF11-016 | Python Core Nodes | Not started | No matching source found | Series 5, unstarted per spot-check grep |
| CF11-017 | Claude/OpenAI Nodes | Not started | No matching source found | Series 5, unstarted per spot-check grep |
| CF11-018 | LangGraph Agent Node | Not started | No matching source found | Series 5, unstarted per spot-check grep |
| CF11-019 | Language Toggle UI | Not started | No matching source found | Series 5, unstarted per spot-check grep |

CF11-008 through CF11-019 have no task folders on disk yet (only speced in `README.md`'s task list) and were not deeply re-verified beyond a source-code grep for their obvious deliverable names, since they are outside the CF11-001…007 folders this audit was scoped to. Nothing found suggests otherwise.

---

## Verified commit evidence

```
$ git show --stat 7d373e0
feat(phase-11): CF11-006  Execution History Panel UI
20 files changed, 1229 insertions(+)
(ExecutionHistoryPanel.tsx, ExecutionList/*, ExecutionFilters/*, ExecutionDetail/*,
 useExecutionHistory.ts, useExecutionDetail.ts, router.setup.ts wiring,
 tests/cloud/ExecutionHistoryPanel.test.ts)

$ git show --stat 83278b4
feat(editor): CF11-007 canvas execution overlay
15 files changed, 1238 insertions(+), 31 deletions(-)
(ExecutionOverlay.tsx, ExecutionNodeBadge.tsx, ExecutionDataPopup.tsx, ExecutionTimeline.tsx,
 nodegrapheditor.html + nodegrapheditor.ts wiring, ExecutionHistoryPanel.tsx pin-to-canvas hook,
 tests/cloud/ExecutionOverlay.test.ts, PROGRESS-dishant.md update)
```

Both commits exist on the current history and touch exactly what `PROGRESS-dishant.md` claims. Confirmed authentic.

```
$ git log --oneline --all --grep="CF11"
83278b4 feat(editor): CF11-007 canvas execution overlay
748ec07 docs(sprint-1): update PROGRESS-dishant.md  CF11-006 complete, session 1 done
7d373e0 feat(phase-11): CF11-006  Execution History Panel UI
dd73b13 docs: update progress for TASK-007A/B and CF11-004/005
95bf2f3 feat(viewer-cloud): add ExecutionLogger for workflow execution tracking
8938fa6 feat(viewer-cloud): add ExecutionStore for workflow execution history
```

No commits reference CF11-001, CF11-002, or CF11-003 anywhere in history.

---

## Prerequisites Status

| Dependency                           | Status      | Notes                                     |
| ------------------------------------ | ----------- | ------------------------------------------ |
| Phase 5 TASK-007A (LocalSQL Adapter) | ✅ Complete | Unblocked CF11-004/005                    |
| Phase 5 TASK-007B (Backend Server)   | ✅ Complete | REST API + IPC working                    |
| Phase 5 TASK-007C (Workflow Runtime) | ⬜ Unverified in this audit | Required for CF11-001…003 trigger/logic nodes; not re-checked here — see Phase 5 folder |

---

## Series Progress (corrected)

### Series 1: Advanced Workflow Nodes (0/3) — unchanged from prior doc

| Task     | Name                 | Status         | Notes           |
| -------- | -------------------- | -------------- | --------------- |
| CF11-001 | Logic Nodes          | Not started | Needs TASK-007C |
| CF11-002 | Error Handling Nodes | Not started | Needs TASK-007C |
| CF11-003 | Wait/Delay Nodes     | Not started | Needs TASK-007C |

### Series 2: Execution History (2/4 UI-complete, 4/4 built, pipeline broken)

| Task     | Name                         | Status              | Notes                                                        |
| -------- | ---------------------------- | -------------------- | ------------------------------------------------------------ |
| CF11-004 | Execution Storage Schema     | Built–not wired      | `ExecutionStore` never instantiated outside tests            |
| CF11-005 | Execution Logger Integration | Built–not wired      | CloudRunner integration hooks never built; DB never populated |
| CF11-006 | Execution History Panel UI   | Complete (UI only)   | Wired into sidebar; IPC channel it calls has no handler       |
| CF11-007 | Canvas Execution Overlay     | Complete (UI only)   | Wired into canvas render loop; same upstream data gap         |

### Series 3: Cloud Deployment (0/4) — unchanged

### Series 4: Monitoring (0/3) — unchanged

### Series 5: Python/AI Runtime (0/5) — unchanged

---

## Integration gap requiring a new task

No existing task ID in this folder closes the CF11-004/005 → CF11-006/007 wiring gap. Recommended for whoever picks up Phase 11 next:

1. Wire `ExecutionLogger` into `CloudRunner`'s node-execution lifecycle (start/complete/error hooks) — this is what CF11-005 originally scoped but did not deliver.
2. Register `ipcMain.handle('execution-history:list', ...)` and `ipcMain.handle('execution-history:get', ...)` in `packages/noodl-editor/src/main`, backed by an `ExecutionStore` instance owned by `BackendManager` (mirroring the `backend:*` handler pattern already in `BackendManager.js`).
3. Manually re-run the verification steps documented in `PROGRESS-dishant.md`'s "Manual verification steps" section for CF11-007 once the above is done — those steps assume live data that does not currently exist.

This gap was not present in the pre-audit `PROGRESS.md`, which had marked CF11-004/005 "Complete" without checking for CloudRunner call sites.

---

## Per-developer progress (merged from PROGRESS-dishant.md, verified against code)

`PROGRESS-dishant.md` is preserved unchanged as historical record. Its claims for CF11-006 and CF11-007 were verified true for the UI/wiring layer described above (component lists, sidebar registration, nodegrapheditor wiring, test counts, and the pin-to-canvas event flow all check out against the code and commits `7d373e0`/`83278b4`). Its claim that both tasks are "✅ COMPLETE" is accurate only for the UI layer; it does not address (and does not claim to address) the missing CloudRunner logging hooks or IPC handlers, which live in CF11-004/005's scope, not CF11-006/007's.

---

## Testing Commands

```javascript
// In DevTools (Cmd+E) after npm run dev:
const { ipcRenderer } = require('electron');
const backend = await ipcRenderer.invoke('backend:create', 'Test');
await ipcRenderer.invoke('backend:start', backend.id);
fetch(`http://localhost:${backend.port}/health`)
  .then((r) => r.json())
  .then(console.log);
// → {status: 'ok', backend: 'Test', id: '...', port: 8580}

// Execution history IPC channels exist in the renderer code but currently have
// NO main-process handler — the calls below will reject until the integration
// gap above is closed:
await ipcRenderer.invoke('execution-history:list', {});
await ipcRenderer.invoke('execution-history:get', '<id>');
```

---

## Blockers

| Blocker | Impact | Resolution |
|---|---|---|
| No CloudRunner ↔ ExecutionLogger wiring | Execution history DB is always empty even where the schema/logger classes exist | New task needed (see "Integration gap" above) |
| No `execution-history:list`/`get` IPC handlers in main process | CF11-006/007 UI cannot fetch any real data | Same new task |
| CF11-001/002/003 still blocked on Phase 5 TASK-007C | Series 1 cannot start | Verify TASK-007C status in Phase 5 folder (not re-checked in this audit) |

---

## Notes

- Backend server uses in-memory mock when better-sqlite3 unavailable (Python 3.14 issue) — unchanged from prior doc, not re-verified in this pass.
- External integrations deferred to future phase (see `FUTURE-INTEGRATIONS.md`).
- This file supersedes the 2026-01-15 version. See git history of this file for the prior claims.
