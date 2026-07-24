# Phase 19: Cloud & Workflows (Revival Track G)

**Phase:** 19
**Track:** G — The backend leg of the full stack
**Source:** [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Horizon 2, Track G; re-scoped 2026-07-24 by [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md)
**Status:** Not started (created 2026-07-22; re-scoped 2026-07-24)

## Why this phase exists — re-framed

The original framing of this phase ("bounded resurrection; finish what's blocked, park the rest") was written before two things: the completion of the phase-13 AI substrate, and the 2026-07-24 salvage audit ([PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md)), which established precisely what the February 2026 sprint left standing. Both change the picture, and [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) is the full argument. The short version:

NodeGX has a strong frontend runtime and a nearly-real local database. Backend logic — functions, workflows, triggers — is the remaining leg of the full-stack story, and without it every real app built here needs a third-party backend, which undercuts both wedges (an agent that can't build the endpoint behind the page builds half an app; a classroom can't require cloud signups). The function model users have today (request/response graphs under `/#__cloud__/`) is good and stays. What's missing is the middle: a workflow engine, triggers, a backend that can run outside Electron, and the wiring between an execution and the already-shipped observability UI.

Crucially, the AI substrate inverts the economics of the "n8n alternative" question: NodeGX does not compete on integration count (unwinnable solo), it competes on **one graph language front and back, AI-authorable through catalog + validator + MCP, self-hosted with no per-execution pricing**. Integrations become generated, legible artifacts — not a library to maintain.

The discipline that survives from the original framing: this phase does its six tasks and stops. Python runtimes, monitoring suites, provider matrices, and marketplaces stay parked. And the track still runs behind the G2-critical path (authoring loop, pilots) — it runs second, but it no longer "stays parked."

## Task Table

| Order | ID | Title | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|---|
| 1 | [WF-006](./WF-006-OBSERVABILITY-WIRING.md) | Light up execution observability | 🟠 High | 3–5 days | REV-001 (alias) | 🟢 Sonnet 5 |
| 2 | [WF-004](./WF-004-BACKEND-SERVICE.md) | The standalone backend service | 🟠 High | 2–3 wks | Coordinate RUN-004 | 🔵 Fable 5 |
| 3 | [WF-001](./WF-001-WORKFLOW-RUNTIME.md) | The workflow engine | 🟠 High | 3–4 wks | WF-004, WF-006 | 🟠 Opus 4.8 |
| 4 | [WF-002](./WF-002-WORKFLOW-NODES.md) | Workflow nodes (phase-11 Series 1) | 🟡 Medium | 3–4 wks | WF-001 | 🟢 Sonnet 5 |
| 5 | [WF-005](./WF-005-TRIGGERS.md) | Triggers: schedule, webhook, DB-change | 🟠 High | 2–3 wks | WF-004; WF-001 for workflow targets | 🟠 Opus 4.8 |
| 6 | [WF-003](./WF-003-MANAGED-DEPLOY.md) | One deploy target, done well | 🟡 Medium | 2–3 wks | WF-004; REV-007 | 🟠 Opus 4.8 |
| 7 | [WF-007](./WF-007-PARSE-FRAMEWORK-RETIREMENT.md) | Retire the Parse framework | 🟡 Medium | ~1 wk | WF-004 (dashboard deletion: anytime) | 🟢 Sonnet 5 |

## Sequencing notes

- **WF-006 first and immediately viable** — it needs only the REV-001 path alias and makes the already-shipped History Panel and canvas overlay show real function executions before any engine exists. Days-scale, high visibility, zero conflict with G2 work.
- **WF-004 before the engine.** Process placement and the database-engine decision (`node:sqlite` vs `better-sqlite3`) shape everything downstream, and the extraction is what makes deploy (WF-003) a packaging task instead of a platform task. Coordinate with RUN-004: its loud-failure deliverable lands independently and immediately; its native-build half merges into WF-004's engine decision.
- **WF-001 is the hard task** — semantics are the substance. Everything else in the phase is assembly.
- **WF-005 can overlap WF-002** once the engine's trigger interface is defined; webhook/cron invocation of plain *functions* doesn't even need WF-001.
- This track yields to Tracks C and E when capacity is contended — except WF-006 and RUN-004's loud-failure fix, which are too small and too valuable to defer.

## Exit criterion

A user — or an agent through MCP — can build a workflow that is triggered by a webhook **and** on a schedule, reads and writes the local database, handles a failing step through an error route, and shows its executions in the History Panel and on the canvas. The same workflow deploys to a VPS by the one documented path and keeps running with the editor closed.

## What this phase still deliberately parks

- **Series 5 (Python/AI runtime)** — a second language runtime is a large ongoing commitment; revisit only on demonstrated demand.
- **Multi-provider deploys** — WF-003 picks one; export (Phase 18) is the general answer.
- **Series 4 monitoring beyond the existing execution history** — the store + panel + overlay cover the practical need.
- **An integration library** — permanently. See the assessment §5: integrations are generated artifacts, not maintained surface.
- ~~**Parse "Cloud Services"** — legacy, untouched, deprecated; removed later when it is free.~~ **Superseded 2026-07-24** by the framework map: WF-004 speaks the Parse-wire subset (the record/user/function nodes finally work against the local backend, external-Parse users keep working for free), and WF-007 deletes the management framework — CloudServices model/panel, master-key deploy pass, the port-8577 hidden-window function server, the orphaned `noodl-parse-dashboard` package. See [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) §3.4.

## References

- [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) — the 2026-07-24 viability assessment this scope derives from
- [PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) — §7 (cloud functions), §6 (local SQL)
- [Revival roadmap — Horizon 2, Track G](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [`dev-docs/tasks/phase-11-cloud-functions/`](../phase-11-cloud-functions/) — the original nineteen-task scope; CF11-004…007 delivered (UI/store halves)
- Related: RUN-004 (local backend persistence), RUN-003 (external backends), Phase 18 (export)
