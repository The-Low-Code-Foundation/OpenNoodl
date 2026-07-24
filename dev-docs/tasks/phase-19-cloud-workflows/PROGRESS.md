# Phase 19 Progress — Cloud & Workflows

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track G
**Re-scoped:** 2026-07-24, per [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) — 3 tasks → 6, phase reframed from "bounded resurrection" to "the backend leg of the full stack"
**Overall status:** 🔴 Not started — 0 / 6 tasks

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| Order | ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|---|
| 1 | WF-006 | Light up execution observability | Not started | 3–5 days | Logger → runtime + missing IPC handlers; shipped panels show real data before any engine exists |
| 2 | WF-004 | The standalone backend service | Not started | 2–3 wks | Extract to `packages/nodegx-backend`; engine decision (`node:sqlite` vs `better-sqlite3`); coordinate RUN-004 |
| 3 | WF-001 | The workflow engine | Not started | 3–4 wks | Semantics are the substance. Note: `feature/task-007c-workflow-runtime` is **not in this clone** — treat as lost; restart from `CloudRunner`/`WorkflowRunner` as reference |
| 4 | WF-002 | Workflow nodes (phase-11 Series 1) | Not started | 3–4 wks | Unblocked by WF-001; catalog entries mandatory |
| 5 | WF-005 | Triggers: schedule, webhook, DB-change | Not started | 2–3 wks | The n8n-shaped capability; function triggers don't need WF-001 |
| 6 | WF-003 | One deploy target | Not started | 2–3 wks | Reduced by WF-004 to packaging the service; Docker Compose self-host is the default candidate |

## Already built (do not rebuild) — verified 2026-07-24 by the salvage audit

| Piece | State | Evidence |
|---|---|---|
| Function runtime (`CloudRunner`) | **Works** — request/response invoker, 99 lines | `packages/noodl-viewer-cloud/src/index.ts` |
| `WorkflowRunner` dispatch | **Works** (thin loader; delegates to CloudRunner; silently no-ops if `noodl-viewer-cloud` unresolved) | `packages/noodl-editor/src/main/src/local-backend/WorkflowRunner.js` (400 lines) |
| Execution store + logger | **Built–not wired** — tested, never called; store's DB injected but never fed a real one | `packages/noodl-viewer-cloud/src/execution-history/` (~1,344 lines + tests) |
| Execution History Panel | **Built–not wired** — its IPC channels have **no `ipcMain.handle`** anywhere | `.../views/panels/ExecutionHistoryPanel/` |
| Canvas Execution Overlay | **Wired to the canvas, starved of data**; has the family's only test | `.../views/CanvasOverlays/ExecutionOverlay/` (~809 lines) |
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

- **2026-07-24** — Phase re-scoped. Trigger: the pre-revival salvage audit plus a strategic re-framing of the backend gap ([BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md)). WF-004/005/006 created; WF-001 revised (lost-branch finding folded in, standalone-service premise); WF-003 reduced to packaging the WF-004 service; README rewritten. Exit criterion made concrete (webhook + schedule + DB + error route + observed + deployed).
