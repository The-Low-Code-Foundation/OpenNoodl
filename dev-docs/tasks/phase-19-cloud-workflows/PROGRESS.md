# Phase 19 Progress — Cloud & Workflows

**Created:** 2026-07-22, from [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Track G
**Overall status:** 🔴 Not started — 0 / 3 tasks

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Tasks

| ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|
| WF-001 | Finish the workflow runtime | Not started | 3–4 wks | The blocker under phase-11's Series 1 nodes; work exists on `feature/task-007c-workflow-runtime` |
| WF-002 | Workflow nodes (phase-11 Series 1) | Not started | 3–4 wks | Unblocked by WF-001 |
| WF-003 | One managed deploy target | Not started | 2–3 wks | Pick one — explicitly not the Docker + Fly + Railway matrix |

## Already built in phase 11 (do not rebuild)

The February 2026 sprint delivered more of phase 11 than its top-level tracker records:

| Task | Deliverable | Evidence |
|---|---|---|
| CF11-004 | Execution storage schema | `feature/cf11-004-execution-storage-schema` |
| CF11-005 | Execution logger | `packages/noodl-viewer-cloud/src/execution-history/ExecutionLogger.ts` (commit `95bf2f3`) |
| CF11-006 | Execution History Panel UI | `packages/noodl-editor/src/editor/src/views/panels/ExecutionHistoryPanel/` (commit `7d373e0`) |
| CF11-007 | Canvas execution overlay | `.../views/CanvasOverlays/ExecutionOverlay/` (commit `83278b4`) |

Note that REV-001 fixes the missing `@noodl-viewer-cloud/execution-history` path alias that currently prevents this code from compiling — so it is "built, not building" until that lands.

## What this phase deliberately parks

Phase 11 as originally scoped ran to 19 tasks across five series, including a Python/AI runtime, multi-provider container deployment, and a monitoring suite. The revival roadmap keeps only the parts that unblock existing work and ship one deployment path well.

Parked, with reasons:

- **Series 5 (Python/AI runtime)** — a second language runtime is a large ongoing commitment; revisit only if pilots or users demand it.
- **Multi-provider deploys (Docker + Fly.io + Railway simultaneously)** — WF-003 picks one. Three half-supported providers is worse than one that works.
- **Series 4 monitoring beyond what CF11-004/005/006/007 already provide** — the existing execution history and overlay cover the practical need for now.

## Dependencies

- **REV-001** (Phase 12) — required before any of the CF11 code compiles.
- WF-002 depends on WF-001; WF-003 is independent and can run in parallel.
