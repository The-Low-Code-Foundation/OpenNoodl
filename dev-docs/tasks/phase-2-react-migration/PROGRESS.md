# Phase 2: React Migration - Progress Tracker

**Last Updated:** 2026-07-23 (REV-006 documentation truth pass)
**Overall Status:** 🟡 Mostly complete, with one task fully fabricated in the old tracker

---

## Status vocabulary

- **Not started** — no code exists for this task.
- **In progress** — some code exists but the task's deliverables are incomplete.
- **Built–not wired** — the deliverable(s) exist and are tested, but have zero call sites in the application outside of tests.
- **Complete** — deliverable exists, is tested, AND has real call sites in the app (outside tests).
- **Superseded** — the task's goal was later addressed by different work, or the task itself is obsolete.

---

## Summary

The previous `PROGRESS.md` (dated 2026-01-07) claimed 9/9 tasks "Complete" and omitted TASK-008 entirely. That is largely accurate but has one serious error and a couple of overstatements. **TASK-005 ("New Nodes") is not started** — none of its five sub-specs (React 19 node modernization, responsive breakpoints, video player, rich text node, user location node) have any trace in the codebase; two of the five spec files (`NODES-002`, `NODES-004`) are literally empty (0 bytes), meaning the work was never even scoped, let alone built. This is the opposite of "Complete." **TASK-000 (Legacy CSS token migration)** is real but only partially done: the token file and two of the four target stylesheets (`popuplayer.css`, `propertyeditor.css`) are fully migrated, but `DeployPopup/deploypopup.css` (16 hardcoded hex values), `layoutpanel.css`, `createnewnodepanel.css`, `reactcomponents/propertyeditors.css`, and `LessonLayerView.css` still contain hardcoded hex colors — the task's own success criteria are not met. **TASK-001**, despite its folder name ("new-node-test") and the old tracker's generic description, is actually about a declarative HTTP node; its core (fetch logic, auth presets, response mapping, dynamic ports) is built and live in the runtime, but the task's own Phase 3 (editor UI: HttpNodeEditor.tsx, curl import modal, auth/pagination editors) and Phase 5 (tests) were never done — this is "In progress," not "Complete." Every other task (TASK-002, 003, 004, 004B, 006, 007, 008) checks out as genuinely complete and wired into the running application, with real call sites confirmed by grep outside test files. No per-developer `PROGRESS-*.md` file exists in this folder to merge.

---

## Task Table

| ID | Title | Status | Evidence (commit / path) | Notes |
|----|-------|--------|---------------------------|-------|
| TASK-000 | Legacy CSS Token Migration | 🟡 In progress | `packages/noodl-editor/src/editor/src/styles/popuplayer.css` (0 hardcoded hex, 70 `var(--theme-color…)` uses); `styles/propertyeditor/propertyeditor.css` (0 hex, 33 token uses) — both fully migrated. But `views/DeployPopup/deploypopup.css` (16 hex), `styles/layoutpanel.css` (4), `styles/createnewnodepanel.css` (1), `reactcomponents/propertyeditors.css` (3), `views/lessons/LessonLayerView.css` (1) still have hardcoded hex colors | Sessions 1–3 of the task's own plan (token setup, popuplayer.css, propertyeditor.css) are done; Session 4 ("Additional Files") is not. Success criteria ("`grep` returns minimal results") not met. No commit history found tagged to this task specifically — work appears folded into other commits. |
| TASK-001 | HTTP Node (folder named "new-node-test", spec titled "Robust HTTP Node") | 🟡 In progress | `packages/noodl-runtime/src/nodes/std-library/data/httpnode.js` (1006 lines); registered live in `packages/noodl-viewer-react/src/register-nodes.js:64`; commits `0485a1f` (feat: add HTTP Request node), `6fd59e8` (node creation documentation) | Core fetch/auth/response-mapping/dynamic-ports logic exists and is genuinely wired into the runtime used by deployed/previewed apps. However the task's own Phase 3 (editor UI — `HttpNodeEditor.tsx`, `HeadersEditor.tsx`, `CurlImportModal.tsx`, etc.) was never created (zero matches for `HttpNode` under `packages/noodl-editor`), the planned helper modules (`curlParser.js`, `jsonPath.js`, `authPresets.js`, `pagination.js`) were never split out, and no tests exist. Debug `console.log` statements (e.g. `'[HTTP Node Module] 📦 httpnode.js MODULE LOADED'`) remain in the shipped file. Also note: `packages/noodl-runtime/noodl-runtime.js:26` has this same require **commented out** ("moved to viewer for debugging") — the node is only live via the viewer-react registration path, not the base runtime package. |
| TASK-002 | React 19 UI Fixes | 🟢 Complete | `createRoot`/root-reuse pattern present in `nodegrapheditor.debuginspectors.js`, `commentlayer.ts`, `TextStylePicker/TextStylePicker.jsx` (all outside tests) | Matches the task's own changelog exactly; no discrepancy found. |
| TASK-003 | Runtime React 19 Upgrade (shipped as React 18.3.1) | 🟢 Complete | `packages/noodl-viewer-react/package.json` → `react`/`react-dom` `^18.3.1`; `createRoot`/`hydrateRoot` in `noodl-viewer-react.js`; `findDOMNode` removed from `react-component-node.js` | Task's own changelog explains the pivot: React 19 dropped UMD bundle support, which the viewer's externals-based loading depends on, so the team shipped React 18.3.1 (95%+ API-compatible) instead. This is an accurate, self-documented scope change, not a discrepancy. The editor itself (a separate package) does run React 19.0.0 — see TASK-002/004. |
| TASK-004 | Runtime Migration System | 🟢 Complete | `packages/noodl-editor/src/editor/src/views/migration/MigrationWizard.tsx` and siblings; wired via `views/projectsview.ts:664` (`onMigrateProjectClicked`) and `pages/ProjectsPage/ProjectsPage.tsx`; present and reachable in `index.bundle.js` | Core wizard flow (scan → confirm → migrate → report) is real and wired. One sub-component, `MigrationNotesPanel` (`views/panels/MigrationNotesPanel/`), exists and is tested but has **zero call sites outside its own barrel file and a dead `.ts.legacy` file** — it is not registered in `router.setup.ts` alongside the other side panels. No task in this phase is scoped to close that specific gap; flagging for whoever picks up Phase-2 follow-on work. |
| TASK-004B | ComponentsPanel React Migration | 🟢 Complete | `packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/ComponentsPanelReact.tsx`, reached via `router.setup.ts` → `views/panels/componentspanel/index.tsx` → `ComponentsPanelReact` | The folder's own `STATUS-BLOCKED.md` (Dec 22, 2025) says "BLOCKED — Caching Issue," but is superseded by the same folder's `CHANGELOG.md`, which documents the blocker's resolution and final completion. Treat `STATUS-BLOCKED.md` as a stale mid-task snapshot, not current status. |
| TASK-005 | New Nodes (React 19 node modernization, responsive breakpoints, video player, rich text node, user-location node) | 🔴 Not started | Exhaustive grep across `packages/noodl-runtime/src` and `packages/noodl-viewer-react/src` for `forwardRef`, `breakpointParameters`/`stateBreakpointParameters`/`smallPhone`, `videoplayer`, `richtext`/`rich_text`, `userlocation`/`geolocation` — **zero matches** for all of them | This is the single biggest discrepancy found in this phase. The old `PROGRESS.md` claimed "Complete... New node types added." In reality: `NODES-000` (node modernization) and `NODES-001` (responsive breakpoints) specs describe features with no implementation anywhere; `NODES-003` (video player) and `NODES-005` (user location) are fully-written specs with zero code; `NODES-002` and `NODES-004` (expression-function-updates, rich-text-node) are **empty files (0 bytes)** — not even scoped. No git commits reference any of this work. |
| TASK-006 | Preview Font Loading | 🟢 Complete | `packages/noodl-editor/src/main/src/web-server.js` — font MIME types (`.otf`/`.woff`/`.woff2`) and fallback path resolution (`/fonts{path}`, `/assets/fonts/{filename}`, etc.); commit `ea45e8b` ("fix(preview): add missing font MIME types to web server") | Both sessions described in the task's own changelog (MIME fix, fallback resolution) are present in the shipped file. |
| TASK-007 | Wire AI Migration Backend | 🟢 Complete | `packages/noodl-editor/src/editor/src/models/migration/MigrationSession.ts` — `executeAIAssistedPhase()` is a real implementation (dynamic-imports `AIMigrationOrchestrator`, handles budget pause/decision callbacks), not the TODO stub the task describes as the starting point; `views/migration/DecisionDialog.tsx` exists and is rendered from `MigratingStep.tsx`; commit `03a464f` ("React 19 runtime migration complete, AI-assisted migration underway") | Matches the task's own changelog; the AI migration path is genuinely wired, not just built. |
| TASK-008 | ComponentsPanel Menu Enhancements & Sheet System | 🟢 Complete | `components/SheetSelector.tsx`, `hooks/useSheetManagement.ts` — `SheetSelector` is imported and rendered inside `ComponentsPanelReact.tsx` (line ~217), which is the same component confirmed wired for TASK-004B | **Not listed at all** in the old `PROGRESS.md`'s 9-task table (which only went up to TASK-007) despite existing on disk since December 2025 — a simple omission rather than a false claim, but still meant the tracker undercounted the phase's real scope (10 tasks, not 9). |

---

## Flagged for human review

- **TASK-000**: judgment call on how "complete" a mechanical, session-based cleanup task needs to be to count as done. I called it "In progress" because the task's own success criteria (near-zero hardcoded hex outside the token file) are not met (5 files, ~25 instances remain, including 16 in `DeployPopup`). A human may reasonably decide this is "close enough" to complete for a low-risk cosmetic task — the remaining files are a short, well-scoped follow-up.
- **TASK-001**: no per-task git commits could be cleanly isolated (the two commits found were general "node creation" commits touching many files); confirm these are in fact the TASK-001 commits and not unrelated HTTP-adjacent work before citing them elsewhere.

## Surprising findings

- TASK-005 being "Not started" while claimed "Complete" is the standout finding — worth checking whether any other phase's PROGRESS.md has a similar total fabrication, not just partial overstatement.
- TASK-004's `MigrationNotesPanel` is a small but clean example of "built–not wired": tested, present, zero real call sites, no other task in this phase claims it.
- `packages/noodl-runtime/noodl-runtime.js` has the HTTP node's require commented out ("moved to viewer for debugging") — the base runtime package and the viewer-react runtime have diverged on which nodes are registered, which is worth flagging to whoever owns the runtime/viewer split.

---

## Dependencies

Depends on: Phase 1 (Dependency Updates)

---

## Recent Updates

| Date | Update |
|------|--------|
| 2026-01-07 | (Prior tracker) Phase marked complete — since found to be inaccurate for TASK-005 and TASK-000 |
| 2026-07-23 | REV-006 documentation truth pass: verified every task ID against code and git history, rewrote this file |
