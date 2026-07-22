# Phase 19: Cloud & Workflows (Revival Track G)

**Phase:** 19
**Track:** G — Bounded resurrection of Phase 11
**Source:** [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) Horizon 2, Track G
**Status:** Not started (created 2026-07-22)

## Why this phase exists — and why it is small

Phase 11 (cloud functions) was one of the more ambitious parts of the original roadmap: nineteen tasks spanning workflow nodes, execution history, container-based cloud deployment, monitoring, and a Python/AI runtime. About six tasks landed, several during the final sprint before the stall, and the rest stopped.

The revival plan does not restart it wholesale. The viability assessment's central strategic finding was that the project's problem was never a shortage of ambition — it was twelve phases of parallel ambition being pursued by what was effectively one person. Server-side execution is genuinely useful and some of it is genuinely finished, but it is not what the repositioned product is *about*. The strategy rests on the graph as a legible substrate for human–AI collaboration and for learning, and cloud functions serve that only indirectly.

So this phase does three things and stops:

1. **Finishes what is blocked.** Phase 11's Series 1 workflow nodes cannot ship because the workflow runtime beneath them is incomplete. That is a small, contained piece of work that unlocks a substantial one.
2. **Ships one deployment target properly** rather than three partially.
3. **Leaves the rest parked** — explicitly, with reasons recorded, so that a future contributor understands the omissions are decisions rather than oversights.

## Task Table

| ID | Title | Priority | Estimate | Prerequisites | Executor |
|---|---|---|---|---|---|
| [WF-001](./WF-001-WORKFLOW-RUNTIME.md) | Finish the workflow runtime | 🟠 High | 3–4 wks | REV-001 | 🟠 Opus 4.8 |
| [WF-002](./WF-002-WORKFLOW-NODES.md) | Workflow nodes (phase-11 Series 1) | 🟡 Medium | 3–4 wks | WF-001 | 🟢 Sonnet 5 |
| [WF-003](./WF-003-MANAGED-DEPLOY.md) | One managed deploy target, done well | 🟡 Medium | 2–3 wks | REV-007 | 🟠 Opus 4.8 |

## Sequencing notes

- **REV-001 first, for everything.** The execution-history code delivered in the February sprint does not currently compile, because the editor is missing a path alias for a module that exists. Until that is fixed, phase-11 work cannot even be evaluated.
- **WF-001 before WF-002** — the nodes are blocked on the runtime, which is the entire reason Series 1 stalled.
- **WF-003 is independent** and gated only on having installable builds and a deployment story worth documenting.
- This whole track runs at lower priority than Tracks A, C, and E. If capacity is contended, it yields.

## Exit criterion

Workflow nodes function on a completed runtime, execution history and the canvas overlay work end to end against real executions, and a user can deploy to one managed target with documented, repeatable steps.

## References

- [Revival roadmap — Horizon 2, Track G, and "What stays dead"](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- [Viability report — §5 roadmap triage (phase 11)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [`dev-docs/tasks/phase-11-cloud-functions/`](../phase-11-cloud-functions/) — the original nineteen-task scope; CF11-004…007 are complete
