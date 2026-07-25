# Phase 19 Progress — Cloud & Workflows

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track G
**Re-scoped:** 2026-07-24, per [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) — 3 tasks → 6, phase reframed from "bounded resurrection" to "the backend leg of the full stack"
**Overall status:** 🟡 In progress — 1 / 7 tasks complete

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| Order | ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|---|
| 1 | WF-006 | Light up execution observability | **Complete** | 3–5 days | `node:sqlite` engine (bundled Node 24 in Electron 43 confirmed at runtime), logger wired at `WorkflowRunner.run()`, both IPC handlers implemented; see log below |
| 2 | WF-004 | The standalone backend service | Not started | 2–3 wks | Extract to `packages/nodegx-backend`; engine decision (`node:sqlite` vs `better-sqlite3`); coordinate RUN-004 |
| 3 | WF-001 | The workflow engine | Not started | 3–4 wks | Semantics are the substance. Note: `feature/task-007c-workflow-runtime` is **not in this clone** — treat as lost; restart from `CloudRunner`/`WorkflowRunner` as reference |
| 4 | WF-002 | Workflow nodes (phase-11 Series 1) | Not started | 3–4 wks | Unblocked by WF-001; catalog entries mandatory |
| 5 | WF-005 | Triggers: schedule, webhook, DB-change | Not started | 2–3 wks | The n8n-shaped capability; function triggers don't need WF-001 |
| 6 | WF-003 | One deploy target | Not started | 2–3 wks | Reduced by WF-004 to packaging the service; Docker Compose self-host is the default candidate |
| 7 | WF-007 | Retire the Parse framework | Not started | ~1 wk | After WF-004; `noodl-parse-dashboard` deletion is anytime (orphaned) |

## Already built (do not rebuild) — verified 2026-07-24 by the salvage audit

| Piece | State | Evidence |
|---|---|---|
| Function runtime (`CloudRunner`) | **Works** — request/response invoker, 99 lines | `packages/noodl-viewer-cloud/src/index.ts` |
| `WorkflowRunner` dispatch | **Works** (thin loader; delegates to CloudRunner; silently no-ops if `noodl-viewer-cloud` unresolved) | `packages/noodl-editor/src/main/src/local-backend/WorkflowRunner.js` (400 lines) |
| Execution store + logger | **Wired** (WF-006, 2026-07-25) — `ExecutionHistoryManager` opens a real `node:sqlite`-backed store per app run; `WorkflowRunner.run()` logs every function execution | `packages/noodl-viewer-cloud/src/execution-history/`, `packages/noodl-editor/src/main/src/execution-history/` |
| Execution History Panel | **Wired** (WF-006) — `execution-history:list`/`:get` `ipcMain.handle` implemented | `.../views/panels/ExecutionHistoryPanel/` |
| Canvas Execution Overlay | **Wired to the canvas, now fed by real data via the panel's "pin to canvas"**; has the family's only test | `.../views/CanvasOverlays/ExecutionOverlay/` (~809 lines) |
| Local backend HTTP surface | **Works** (on the mock DB — RUN-004) | `LocalBackendServer.js` routes: `/health`, `/api/*`, `/functions/:name` |
| Client Cloud Function node | **Fixed** (DEBT-001, commit `cc2efd5`) | `noodl-viewer-react/.../cloudfunction2.ts` |

Corrections to prior records, from the audit:

- The branch `feature/task-007c-workflow-runtime` referenced by WF-001's original text is **not present in this clone** — the deeper runtime work is lost or was never pushed. WF-001's assessment step is resolved: restart, with the existing pieces as reference.
- The phase-11 README's claim that Phase 5 delivered "basic trigger nodes (Schedule, DB Change, Webhook)" is **not borne out by code** — no trigger infrastructure exists anywhere.
- CF11-006/007 are "Complete (UI only)": the panel's IPC has no main-process handler; the overlay renders but no data flows.

## What this phase deliberately parks

Unchanged in substance from the original framing, plus one addition:

- **Series 5 (Python/AI runtime)** — revisit only on demonstrated demand.
- **Multi-provider deploys** — WF-003 picks one; export (Phase 18) is the general answer.
- **Series 4 monitoring beyond existing execution history.**
- **An integration library — permanently.** Integrations are generated, legible artifacts authored on demand (assessment §5), not maintained surface.
- **Parse "Cloud Services"** — legacy, deprecated, untouched until removal is free.

## Dependencies

- **REV-001** — the `@noodl-viewer-cloud/execution-history` path alias; required before WF-006.
- **RUN-004** — loud-failure fix lands independently and immediately; native-engine half merges into WF-004's decision.
- WF-001 after WF-004/WF-006; WF-002 after WF-001; WF-005 after WF-004 (workflow-targeted triggers after WF-001); WF-003 after WF-004 + REV-007.

## Log

- **2026-07-25** — WF-006 complete. Engine: `node:sqlite` (`DatabaseSync`), confirmed available flag-free by actually requiring it under `ELECTRON_RUN_AS_NODE=1` against this repo's Electron 43.2.0 (bundles Node 24.18.0) — not assumed from docs, per the task's engine note. A loudly-labeled, generically-correct in-memory fallback (`InMemorySqliteFallback`, pattern-matches `ExecutionStore`'s fixed SQL grammar) exists and is unit-tested for the case it's ever needed. IPC: only two channels exist in the panel's hooks (`execution-history:list`, `execution-history:get`) — both implemented against a new `ExecutionHistoryManager` singleton (mirrors `BackendManager`'s pattern), one `ExecutionStore` shared per app run. Logging wired at `WorkflowRunner.run()`: a **fresh `ExecutionLogger` per execution** (not one shared instance) because `ExecutionLogger` keeps single-execution state internally and a shared instance would let concurrent function calls clobber each other's in-flight state. Request headers/bodies are scrubbed (`scrub.ts`) before being written. `packages/noodl-viewer-cloud`'s existing execution-history unit tests had no runner wired anywhere in the repo (no jest config, no test script) — added one, which also surfaced and fixed two latent bugs the tests never caught before (a TS `unknown`-chaining error, and a mock-ordering bug that made a getStats assertion pass for the wrong reason). New integration test drives `WorkflowRunner.run()` end-to-end and reads the result back through the real registered IPC handlers. Did not touch the panel/overlay UI (out of scope) — live-editor verification of the panel rendering real data was not performed in this pass; say so explicitly rather than claim it.
- **2026-07-24 (later)** — Framework map run (code-level, recorded in BACKEND-GAP-ASSESSMENT §3.4): no Parse server was ever in the repo; two data stacks that never meet (record nodes → Parse REST via `cloudstore.js`; local backend → `/api/:table` via BYOB nodes only — "Query Records" against a local backend has never worked); the used Parse surface is a bounded ~15-endpoint subset. Decision: WF-004 speaks the Parse-wire subset (zero client-file changes, heals the split); **WF-007 created** to delete the management framework (CloudServices model/panel ~55 KB, `deploy-cloud-functions.ts`, port-8577 `cloud-function-server.js` + cloudruntime bundle, orphaned `noodl-parse-dashboard`). The earlier "legacy, untouched" stance is superseded.
- **2026-07-24** — Phase re-scoped. Trigger: the pre-revival salvage audit plus a strategic re-framing of the backend gap ([BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md)). WF-004/005/006 created; WF-001 revised (lost-branch finding folded in, standalone-service premise); WF-003 reduced to packaging the WF-004 service; README rewritten. Exit criterion made concrete (webhook + schedule + DB + error route + observed + deployed).
