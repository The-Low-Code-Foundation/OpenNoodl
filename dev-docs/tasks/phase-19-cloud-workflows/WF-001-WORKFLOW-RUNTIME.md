# WF-001: The Workflow Engine

> **Revised 2026-07-24.** The original brief (2026-07-22) centered on reconciling a half-finished runtime with the `feature/task-007c-workflow-runtime` branch. The salvage audit resolved that question: **the branch is not present in this clone** — the deeper runtime work is lost or was never pushed — and the merged `WorkflowRunner` turned out to be a thin loader that delegates to `CloudRunner`, not a partial engine. The assessment step is therefore already answered: **build the engine fresh**, with the existing pieces as reference, inside WF-004's service. The semantics-first core of the original brief stands unchanged.

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WF-001 |
| **Phase** | Phase 19 — Cloud & Workflows (Revival Track G) |
| **Priority** | 🟠 High (the phase's hard task; unblocks WF-002 and workflow-targeted triggers) |
| **Difficulty** | 🔴 Hard (semantics, not volume) |
| **Estimated Time** | 3–4 weeks |
| **Prerequisites** | WF-004 (the service it lives in), WF-006 (the logging it emits into) |
| **Branch** | `task/wf-001-workflow-runtime` |
| **Recommended executor** | 🟠 **Opus 4.8** — execution semantics (ordering, error propagation, cancellation, durability) need careful iterative design against a clear target. Escalate to Fable if the durability model turns contentious. |

## Objective

Build the server-side workflow execution engine: multi-step graph executions with defined ordering, routed errors, cancellation, timeouts, and honest durability — so phase-11's Series 1 nodes (WF-002) have something to run on and the observability pipeline (WF-006) has real workflow executions to show.

## Background

Phase 11 delivered the *visibility* half of workflows (store, logger, panel, overlay — now wired by WF-006) and none of the *execution* half. What exists is a request/response function invoker: `CloudRunner` (99 lines) finds one `noodl.cloud.request` node, wires the `response` nodes, and resolves the first response. There is no scheduler, no ordering model beyond the client runtime's dirty-flag propagation, no error routing, no cancellation, no notion of an execution that outlives its request.

That model is right for functions and stays untouched. Workflows are the different thing: potentially long-running, multi-step, error-routed, trigger-initiated executions that must be observable step-by-step and stoppable. The engine is the one genuinely hard piece of the backend gap ([BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) §6) — everything else in the phase is assembly.

One structural rule inherited from the original brief, still binding: **a workflow node is a node.** The runtime's node definitions are framework-neutral, typed (PLAT-003), catalogued (SUB-004/005), validated (SUB-006), and MCP-visible (SUB-008). The engine schedules ordinary nodes in a different execution context; it must not spawn a parallel node abstraction.

## Current State

- `CloudRunner` — `packages/noodl-viewer-cloud/src/index.ts` (99 lines): request/response invoker. Reference for how cloud components instantiate; not an engine.
- `WorkflowRunner` — `packages/.../local-backend/WorkflowRunner.js` (400 lines): loads `*.workflow.json`, delegates `run()` to `CloudRunner.run()` (line 303), injects `LocalSQLAdapter` into the runtime context. The DB-injection pattern is worth keeping; the rest is a dispatcher. (Moves into `nodegx-backend` with WF-004.)
- Execution store/logger wired for function executions by WF-006; the event vocabulary in `execution-history/types.ts` is the starting point for workflow-level events.
- `feature/task-007c-workflow-runtime`: **absent from this clone.** Do not spend time hunting for it.
- CF11-001/002/003 node specs (`dev-docs/tasks/phase-11-cloud-functions/`) define what the engine must be able to schedule.

## Desired State

- A workflow — a graph component designated as such — executes server-side inside the WF-004 service: initiated by a manual call or a WF-005 trigger, running its nodes under documented semantics, emitting per-step events through `ExecutionLogger`, visible live-ish in the History Panel and canvas overlay.
- **Semantics documented before implementation**, as a spec in this folder, covering:
  - **Ordering** — the browser runtime uses dirty-flag propagation with per-frame batching; there are no frames server-side. Decide the model (dependency-ordered with explicit completion, most likely) and document exactly where it deliberately differs from the client runtime — that difference will otherwise surprise every user who knows the frontend behavior.
  - **Errors** — routed, not merely thrown: CF11-002's catch/retry nodes require error paths as first-class edges. Unrouted failures halt the workflow cleanly and are recorded as failed, never swallowed.
  - **Cancellation and timeouts** — every execution stoppable (worst case: the WF-004 process boundary); per-workflow and per-step timeouts; partial execution recorded, never lost.
  - **Durability, honestly** — v1 policy: an execution interrupted by service shutdown is recorded as `interrupted` on restart — *resumable-or-failed-loudly, never silently half-run*. Checkpoint/resume is explicitly a possible v2; do not build it speculatively, do document the store fields it would need.
  - **Concurrency** — same workflow triggered twice: parallel, queued, or coalesced? Pick a default (parallel with a per-workflow concurrency cap is the honest simple answer), document it, record the cap in workflow config.
- The engine is testable headless (no editor, no deploy) — it lives in `nodegx-backend`, so plain Node test runs.

## Scope

### In Scope
- [ ] Semantics spec (ordering, errors, cancellation/timeouts, durability, concurrency) — written and reviewed before engine code
- [ ] The scheduler/engine implementing that spec over the framework-neutral node model
- [ ] Workflow definition format (what marks a component as a workflow; entry points — including trigger entry nodes for WF-005; stored in v2 project format, diffable by SUB-007)
- [ ] Per-step event emission through `ExecutionLogger` (extend the event vocabulary if needed; coordinate with the store's schema)
- [ ] Error routing supporting CF11-002's designs
- [ ] Cancellation API (used by the editor UI and exposed on the service HTTP surface)
- [ ] Interrupted-execution detection on service start
- [ ] Semantics test suite — the tests mirror the spec's sections, not just happy paths

### Out of Scope
- The Series 1 nodes themselves (WF-002)
- Triggers (WF-005) — the engine exposes "start execution with payload"; WF-005 calls it
- Checkpoint/resume durability (documented as v2)
- Distributed/queued execution, horizontal scaling
- Reworking the delivered observability UI

## Implementation Steps

1. **Write the semantics spec** (`WF-001-SEMANTICS.md` in this folder). This is the deliverable the rest of the phase leans on; it is finished when WF-002's node specs can be checked against it without ambiguity.
2. **Workflow definition format** in v2 terms; agree the entry-point contract with WF-005.
3. **Engine core**: dependency-ordered scheduling with explicit step completion; unit-tested headless.
4. **Error routing**; **cancellation/timeouts**; **interrupted-detection**.
5. **Logger integration** per step; verify live in the panel and overlay (already proven by WF-006, so mismatches are engine-side by construction).
6. **Semantics test suite**, section by section.

## Success Criteria

- [ ] Semantics spec published; deliberate divergences from the client runtime called out explicitly
- [ ] A multi-step workflow executes to completion headless with correct ordering
- [ ] Errors route per spec; unrouted errors fail the execution cleanly and visibly
- [ ] Cancellation stops a running execution promptly; partial execution recorded
- [ ] Timeouts enforced per-workflow and per-step
- [ ] Service restart marks in-flight executions `interrupted`; nothing silently half-runs
- [ ] Per-step events visible in the History Panel and canvas overlay
- [ ] Concurrency policy implemented and configurable per workflow
- [ ] Test suite mirrors the spec

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Server semantics diverge surprisingly from client semantics | The spec documents every divergence as user-facing information; WF-002 matches client node behavior wherever the spec allows |
| A second node abstraction creeps in | Binding rule: a workflow node is a node; review the engine's node interface against the runtime's before merging |
| Durability ambitions balloon into a checkpointing system | v1 policy is fixed (interrupted-loudly); v2 fields documented, not built |
| The event vocabulary doesn't fit per-step workflow events | WF-006 wired the pipeline against the existing types; extend the types + schema deliberately, with the store's tests updated — never log around the store |
| Long-running steps block the service | Per-step timeouts mandatory; the WF-004 process boundary is the backstop |

## References

- [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) — §1, §3, §6
- [PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §7 — what exists, what's lost
- CF11-001/002/003 specs; `execution-history/types.ts` — the event vocabulary
- WF-004 (home), WF-006 (pipeline), WF-002 (consumer), WF-005 (initiator)

## Checklist

- [ ] Confirm WF-004 + WF-006 landed
- [ ] Semantics spec written and checked against CF11 node specs
- [ ] Definition format + entry-point contract (with WF-005)
- [ ] Engine core headless-tested; error routing; cancellation/timeouts; interrupted-detection
- [ ] Logger integration verified live; semantics suite green
- [ ] CHANGELOG; update WF-002 with any spec-driven changes to the node briefs
