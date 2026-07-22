# WF-001: Finish the Workflow Runtime

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WF-001 |
| **Phase** | Phase 19 — Cloud & Workflows (Revival Track G) |
| **Priority** | 🟠 High (unblocks the rest of the phase) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–4 weeks |
| **Prerequisites** | REV-001 (the CF11 code does not currently compile) |
| **Branch** | `task/wf-001-workflow-runtime` |
| **Recommended executor** | 🟠 **Opus 4.8** — picking up a half-finished runtime on an abandoned branch requires assessing what exists and what was intended before writing anything. Execution semantics (ordering, error propagation, cancellation) need care. |

## Objective

Complete the server-side workflow execution runtime so that phase 11's workflow nodes have something to run on, and the already-built execution history and canvas overlay have real executions to display.

## Background

Phase 11 set out to give Noodl server-side execution: workflows that run on a backend rather than in the browser, with logic, error handling, and delay nodes, plus visibility into what happened. The visibility half was substantially delivered during the February 2026 sprint — an execution storage schema, an execution logger, a history panel in the editor, and a canvas overlay showing execution state on the graph.

The execution half was not. The workflow nodes of Series 1 depend on a runtime capable of running them, and that runtime was started on a feature branch and left incomplete. The result is an unusual and rather wasteful state: the project has good tooling for observing workflow executions and no way to produce one.

This task closes that gap, and it is scoped narrowly on purpose. The goal is not to build a general server-side execution platform — it is to finish the specific runtime that unblocks work already paid for.

One practical note before starting: the CF11 code currently does not compile, because the editor is missing a path alias for the `@noodl-viewer-cloud/execution-history` module (which exists). REV-001 fixes this. Until then, evaluating what phase 11 actually delivered is difficult.

## Current State

Evidence in the repository:

- Commit `98fa779`, "feat(local-backend): add WorkflowRunner for visual workflow execution" — a runner exists in some form under the editor's local-backend code.
- Branch `feature/task-007c-workflow-runtime` — the unfinished workflow-runtime work.
- Commit `8938fa6` — `ExecutionStore` for workflow execution history (`packages/noodl-viewer-cloud/src/execution-history/store.ts`).
- Commit `95bf2f3` — `ExecutionLogger` (`.../execution-history/ExecutionLogger.ts`).
- Commits `7d373e0` and `83278b4` — Execution History Panel and Canvas Execution Overlay in the editor.
- `dev-docs/tasks/phase-11-cloud-functions/` — CF11-001 (logic nodes), CF11-002 (error handling), CF11-003 (wait/delay) specified but blocked; CF11-004…007 delivered.

Unknown until assessed: how complete `WorkflowRunner` is, how it relates to the `feature/task-007c-workflow-runtime` branch, and whether the two are the same effort or divergent attempts.

## Desired State

- A workflow can be defined, executed server-side, and observed.
- Execution semantics are defined and documented: node ordering, error propagation, cancellation, and timeouts.
- Executions are logged through the existing `ExecutionLogger` and appear in the History Panel and canvas overlay.
- The runtime is testable in isolation, without requiring a deployed environment.

## Scope

### In Scope
- [ ] Assess `WorkflowRunner` and the `feature/task-007c-workflow-runtime` branch; reconcile them
- [ ] Complete the execution engine: run a workflow graph to completion
- [ ] Define and document execution semantics (ordering, errors, cancellation, timeouts)
- [ ] Integrate with `ExecutionLogger` so runs appear in the existing UI
- [ ] Error handling and propagation
- [ ] Cancellation and timeout support
- [ ] Local execution for development, without deploying anything
- [ ] Tests covering the semantics, not just the happy path

### Out of Scope
- The workflow nodes themselves (WF-002)
- Deployment (WF-003)
- Python or other language runtimes (parked — see the phase PROGRESS notes)
- Scaling, queuing, or distributed execution
- Reworking the already-delivered execution history UI

## Technical Approach

### Assessment first

Two artifacts appear to address the same problem: the merged `WorkflowRunner` and the unmerged `feature/task-007c-workflow-runtime` branch. Establish which is further along, whether they conflict, and what the intended design was, before writing any new code. The output of the first week should be a short written finding — including a recommendation on whether to continue from the branch, from `main`, or to restart the engine with the existing pieces as reference.

### Semantics are the substance

The mechanical part of an execution engine is straightforward; the semantics are where correctness lives, and they must be decided explicitly rather than emerging from implementation:

- **Ordering** — the browser runtime uses a dirty-flag scheduler with per-frame batching. Server-side workflows have no frames. Decide the model (sequential by dependency, or an explicit scheduler) and document it, including where it deliberately differs from the client runtime, since that difference will surprise users otherwise.
- **Errors** — does a failing node halt the workflow, or route to an error path? CF11-002 specifies error-handling nodes, so the engine must support routed errors, not merely thrown ones.
- **Cancellation and timeouts** — a workflow that hangs must be stoppable, and its partial execution must be recorded rather than lost.

Reuse the existing node execution model where possible: the runtime's node definitions are framework-neutral, so a workflow node should be a node, not a parallel abstraction. Diverging here would create a second node system to maintain.

## Implementation Steps

1. **Assess and reconcile** `WorkflowRunner` and the feature branch; publish a written finding with a recommendation.
2. **Define execution semantics** and document them before implementing.
3. **Complete the execution engine** against those semantics.
4. **Integrate `ExecutionLogger`** so runs surface in the History Panel and canvas overlay (both already exist — verify against them rather than building anything new).
5. **Error routing** to support CF11-002's node designs.
6. **Cancellation and timeouts**, including partial-execution recording.
7. **Local execution path** for development and testing.
8. **Semantics test suite.**

## Testing Plan

- Execute simple workflows to completion; verify output correctness.
- Ordering tests: dependent nodes run in the documented order.
- Error tests: failures route as specified; unrouted failures halt cleanly and are logged.
- Cancellation mid-execution: stops promptly, partial execution recorded.
- Timeout behaviour.
- End-to-end: an execution appears correctly in the History Panel and on the canvas overlay.

## Success Criteria

- [ ] Written assessment of existing work published, with a recommended path
- [ ] Workflows execute to completion server-side
- [ ] Execution semantics documented, including deliberate differences from the client runtime
- [ ] Errors route per CF11-002's design; unrouted failures fail cleanly
- [ ] Cancellation and timeouts work; partial executions are recorded
- [ ] Executions appear in the existing History Panel and canvas overlay
- [ ] Local execution works without deployment
- [ ] Semantics covered by tests

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The existing work is divergent or unusable, and effort is wasted reconciling it | Step 1 is an explicit assessment with a restart-or-continue recommendation; restarting with the existing code as reference is a legitimate outcome |
| Server semantics diverge from client semantics in surprising ways | Document the differences explicitly as user-facing information, not just internal notes |
| A second parallel node abstraction is created | Reuse the framework-neutral node model; a workflow node should be a node |
| The already-built history UI does not fit real executions | Verify against it early (step 4) rather than at the end; it is easier to adapt the engine's logging than to rework shipped UI |

## References

- [`dev-docs/tasks/phase-11-cloud-functions/`](../phase-11-cloud-functions/) — CF11-001…003 (blocked), CF11-004…007 (delivered)
- [Revival roadmap — Track G](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- Prior work: commit `98fa779` (`WorkflowRunner`), branch `feature/task-007c-workflow-runtime`
- Related: REV-001 (makes the CF11 code compile)

## Checklist

- [ ] Branch `task/wf-001-workflow-runtime`; confirm REV-001 landed
- [ ] Assess existing runner + feature branch; publish finding and recommendation
- [ ] Define and document execution semantics before coding
- [ ] Complete the engine; integrate `ExecutionLogger`
- [ ] Error routing, cancellation, timeouts
- [ ] Local execution path; semantics test suite
- [ ] Verify end-to-end in History Panel and canvas overlay; CHANGELOG; open PR
