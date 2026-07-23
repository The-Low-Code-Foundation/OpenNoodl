# Phase 5: Multi-Target Deployment — Progress Tracker

**Last Updated:** 2026-07-23 (REV-006 documentation truth pass)
**Overall Status:** 🟡 In Progress — BYOB backend sub-phase is the only one with any code; Capacitor, Electron, Chrome Extension and Target System Core are still pure specs.

---

## Status Vocabulary

- **Not started** — no code exists for this task.
- **In progress** — some code exists but the task's deliverables are incomplete.
- **Built–not wired** — the deliverable(s) exist and are tested, but have zero call sites in the application outside of tests. The task expected to close the gap is named, or its absence is stated explicitly.
- **Complete** — deliverable exists, is tested, and has real call sites in the app (outside tests).
- **Superseded** — the task's goal was later addressed by different work, or the task itself is obsolete.

---

## Summary of what changed in this pass

The prior `PROGRESS.md` (last touched 2026-01-15) was directionally correct about the sub-phase split (BYOB active, other four targets not started) but understated how much of TASK-007 (Integrated Local Backend) actually landed, and it listed four PWA tasks (TASK-008…011, "Phase F") that **do not correspond to any spec folder on disk** — there is no `06-pwa` directory anywhere in this phase, and no PWA code exists. Those four rows are dropped from the table below pending human clarification (see note at the end).

The single biggest finding of this audit: **none of the BYOB code has dedicated unit or integration tests.** Every "Complete" verdict below is based on evidence of real call sites in the shipped app (the strict evidence-priority-1 test), not on the presence of tests — there simply aren't any (`grep` across `packages/*/test*`, `*.test.ts(x)`, `*.spec.*` for `byob`, `BackendServices`, `LocalSQL`, `SchemaManager`, `LocalBackendServer` returns nothing). This is a real coverage gap, not just a documentation gap; it's noted per-row rather than invented as a new status.

Also notable: the known-issues list in `TASK-007K-DRAFT.md` (can't edit/delete tables, real SQLite falls back to mock) still holds true today — `better-sqlite3` is not a dependency anywhere in the repo (`grep` across all `package.json` files is empty), so the in-memory fallback is not a transient bug, it is the only backing store that has ever worked. A `deleteTable` IPC handler exists in `BackendManager.js` but has zero call sites in the Schema Manager UI, so "can't delete tables" is still accurate.

---

## Task Table

### 01-byob-backend (Phase A)

| ID | Title | Status | Evidence | Notes |
|----|-------|--------|----------|-------|
| TASK-001 | Backend Services Panel | Complete | `packages/noodl-editor/src/editor/src/models/BackendServices/{types,presets,BackendServices,index}.ts`, `views/panels/BackendServicesPanel/{BackendServicesPanel.tsx,BackendCard,AddBackendDialog}`; registered in `router.setup.ts:160`. Commit `73b5a42` (2025-12-31). | No dedicated tests. UI and model are real and reachable from the sidebar. |
| TASK-002 | Data Nodes (Query/Create/Update/Delete + Filter Builder) | Complete | `packages/noodl-runtime/src/nodes/std-library/data/byob-{query-data,create-record,update-record,delete-record}.js`, registered in `nodelibraryexport.js:569-572` as `noodl.byob.{QueryData,CreateRecord,UpdateRecord,DeleteRecord}`; `views/panels/propertyeditor/components/ByobFilterBuilder/*`. Commits `73b5a42`, `ae7d3b8`. | No dedicated tests. Nodes are registered in the real node library, not just present as files. |
| TASK-003 | Schema Viewer (dedicated tree view of remote BYOB schema) | Not started | No `SchemaViewer` component exists anywhere (`grep -ri SchemaViewer` across the repo, excluding dev-docs, is empty). | Do not confuse with the `schemamanager/SchemaPanel` built under TASK-007H — that panel browses **local SQLite** backend schema (TASK-007 scope), not the remote Directus/Supabase/Pocketbase schema this task was scoped for. TASK-003's original scope remains unbuilt. |
| TASK-004 | Edit Backend Dialog | Not started | No `EditBackendDialog` file exists. `BackendServices.ts` has an `updateBackend()` method (noted in TASK-001 README) but no UI calls it. | |
| TASK-005 | Local Docker Wizard | Not started | No docker-wizard code exists (`grep -i "docker.*wizard"` empty). | |
| TASK-006 | Authentication Nodes (Sign Up / Log In / Log Out for BYOB) | Not started | No `SignUp`/`LogIn`/`LogOut` node implementations for BYOB/Directus exist in `noodl-runtime`. | Not to be confused with TASK-007G (separate auth system, also not started — see below). |
| TASK-007 | Integrated Local Backend (parent/umbrella) | In progress | See subtasks below. | Roll-up: A/B/C/D/H/I/J landed and are wired; E/F/G were never started; K (bug-fix pass) only partially addressed. |
| TASK-007A | LocalSQL Adapter | Complete | `packages/noodl-runtime/src/api/adapters/local-sql/{QueryBuilder,SchemaManager,LocalSQLAdapter,index}.js`. Commit `72c9989` (2026-01-15). Used by `LocalBackendServer.js`. | No tests. Real backing store is an in-memory mock — `better-sqlite3` is not installed anywhere in the repo, so the "SQLite" adapter has never run against real SQLite in this codebase. |
| TASK-007B | Local Backend Server | Complete | `packages/noodl-editor/src/main/src/local-backend/{LocalBackendServer,BackendManager}.js`; wired into `main.js:30` (`require('./src/local-backend')`). Commit `8c0f0c6` (2026-01-15). | No tests. |
| TASK-007C | Workflow Runtime (WorkflowRunner) | Complete | `packages/noodl-editor/src/main/src/local-backend/WorkflowRunner.js`, instantiated and used in `LocalBackendServer.js:486` (`this.workflowRunner = new WorkflowRunner(...)`). Commit `98fa779` (2026-01-15). | No tests. |
| TASK-007D | Launcher/Editor Integration | Complete | `BackendServicesPanel` uses `hooks/useLocalBackends.ts` and `LocalBackendCard/LocalBackendCard.tsx`. Commits `5f61317`, `9181d5d`, `dac5330` (2026-01-15). | No tests. Note: this wires into the **editor's** BackendServicesPanel, not a separate project-independent launcher as originally scoped — a smaller but real version of the goal. |
| TASK-007E | Migration & Export Tools | Not started | No Parse-to-Local migration wizard or schema-export code exists (`grep` for `ParseToLocal`, `SchemaExport` is empty; the one `MigrationWizard.tsx` hit belongs to Phase 2 react-migration, unrelated). | |
| TASK-007F | Standalone Deployment (bundle backend with exported app) | Not started | No backend-bundler code in `packages/noodl-editor/src/editor/src/export`. | |
| TASK-007G | Authentication System (bcrypt/JWT for local backend) | Not started | No `bcrypt`/`jsonwebtoken` usage in `local-backend/*.js`; neither dependency appears in any `package.json`. | Distinct from TASK-006 (BYOB remote auth), also not started. |
| TASK-007H | Schema Manager UI | Complete | `packages/noodl-editor/src/editor/src/views/panels/schemamanager/{SchemaPanel,TableRow,CreateTableModal,AddColumnForm,index}.tsx`. Imported and rendered from `LocalBackendCard.tsx:21,173` (`import { SchemaPanel } from '../../schemamanager'`). Commit `32a0a08` (2026-01-16). | No tests. Table/column *editing* and *deletion* are not wired (see TASK-007K). |
| TASK-007I | Data Browser & Editor | Complete | `packages/noodl-editor/src/editor/src/views/panels/databrowser/{DataBrowser,DataGrid,CellEditor,NewRecordModal,index}.tsx`. Imported and rendered from `LocalBackendCard.tsx:20,187` (`import { DataBrowser } from '../../databrowser'`). Commit `32a0a08` (2026-01-16). | No tests. Object/Array cell editing is buggy per TASK-007K; not independently re-verified in this pass. |
| TASK-007J | Schema/Data Creation UX | Complete | `CreateTableModal.tsx`, `AddColumnForm.tsx` (table/column creation), `NewRecordModal.tsx` (record creation) — same commit `32a0a08`, same wiring path as 007H/I. | No tests. This is the "create" half of 007H/I; the two are effectively one shipped feature split across three spec docs. |
| TASK-007K | Bug Fixes & Polish | In progress | `BackendManager.js:134-135,551` has a `backend:deleteTable` IPC handler — but `grep` finds zero callers of it in `schemamanager/*.tsx` or `useLocalBackends.ts`, i.e. it's dead code, not a fix. No commits after `32a0a08` touch `CellEditor.tsx`, `TableRow.tsx`, `LocalSQLAdapter.js`, or `SchemaManager.js`. | Task is still in its `DRAFT` state and none of its four listed bugs (Object/Array cell editor, real-SQLite fallback, schema persistence, edit/delete tables) appear fixed. **No task currently claims this integration gap** — flagging for scheduling. |

### 02-05: Other deployment targets (Phases B–E)

| ID | Title | Status | Evidence | Notes |
|----|-------|--------|----------|-------|
| PHASE-B | Capacitor Mobile Target | Not started | `grep -ri capacitor` across the repo (excluding `dev-docs`) returns nothing — no nodes, no bridge, no exporter. | Entire `02-capacitor-mobile/README.md` is a design spec only; none of Phases B.1–B.4 have started. |
| PHASE-C | Electron Desktop Target | Not started | No `noodl-runtime-electron` package, no `RunProcessNode`/`ReadFileNode`/etc. exist. | Ironic given the editor itself already runs on Electron (`packages/noodl-platform-electron/`) — that existing platform code is infrastructure the editor uses, not this phase's deliverable. |
| PHASE-D | Chrome Extension Target | Not started | No `chrome-extension` node folder, no manifest generator, no extension exporter. | |
| PHASE-E | Target System Core | Not started | No `TargetType`, `NodeCompatibilityRegistry`, `TargetConfigService`, or `targetCompatibility` field exists anywhere in `packages/`. | This was meant to be the prerequisite foundation for B/C/D (per this folder's own README dependency graph) — since it was never built, B/C/D were correctly never started either; no phase jumped ahead of its dependency. |

---

## Flagged for human review

- **PWA tasks (old TASK-008…011, "Phase F")**: the previous `PROGRESS.md` carried four PWA tasks and a whole "Phase F Scope" section, but there is no `06-pwa` (or similarly named) spec folder in `01-byob-backend`'s siblings, and no PWA-related code (manifest generator, service-worker template, icon processor) exists anywhere in the repo. Either this was planned but never speced, or the spec lives somewhere this audit didn't check. Recommend confirming with whoever wrote the original entries before deciding whether to recreate the spec folder or drop the reference entirely.
- **TASK-007K bug-fix task has no owner.** Per REV-006's instruction to name the task that closes every integration gap: there is currently no successor task in this or any other phase folder that claims responsibility for the `better-sqlite3`/in-memory-fallback issue or the dead `deleteTable` IPC handler. This should be either revived as an active task or explicitly deferred with a named future task ID.

## Metrics

| Metric | Value |
|--------|-------|
| BYOB tasks Complete (TASK-001…007D, 007H/I/J) | 10 |
| BYOB tasks In progress (TASK-007 umbrella, TASK-007K) | 2 |
| BYOB tasks Not started (TASK-003…006, 007E/F/G) | 7 |
| Other-target phases (B/C/D/E) | 4 of 4 Not started |
| Dedicated tests found for any BYOB code | 0 |

## Dependencies

Depends on: Phase 2 (Runtime), HTTP Node updates — unchanged from prior version, still accurate.

## Notes

- Phase E (Target System Core) was intended as the prerequisite for Phases B/C/D; since it was never started, the recommended execution order in `README.md` was never violated — B/C/D simply never started either.
- The real shipped work in this phase folder is entirely inside `01-byob-backend`, specifically the "integrated local backend" (TASK-007 family), not the originally-planned adapter layer for third-party BaaS platforms (Directus/Supabase/Pocketbase adapters described in `01-byob-backend/README.md` §4 are still just TypeScript interface sketches in the spec — no `DirectusAdapter.ts`/`SupabaseAdapter.ts`/`PocketbaseAdapter.ts` files exist in `packages/noodl-runtime/src/backends/`, only the loosely-related `byob-*.js` nodes that talk to a generic REST shape).
