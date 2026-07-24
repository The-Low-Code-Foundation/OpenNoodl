# WF-002: Workflow Nodes (Phase 11 Series 1)

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WF-002 |
| **Phase** | Phase 19 — Cloud & Workflows (Revival Track G) |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟢 Easy to 🟡 Medium |
| **Estimated Time** | 3–4 weeks |
| **Prerequisites** | WF-001 |
| **Branch** | `task/wf-002-workflow-nodes` |
| **Recommended executor** | 🟢 **Sonnet 5** — the nodes are already specified in CF11-001/002/003, the node-authoring pattern is well established, and the runtime beneath them will be documented by WF-001. Systematic implementation against clear specs. |

## Objective

Implement phase 11's Series 1 workflow nodes — logic, error handling, and wait/delay — on the completed workflow runtime.

## Background

These nodes are the actual user-facing content of the cloud-functions work: the pieces someone building a server-side workflow assembles. They were specified in detail during phase 11 (CF11-001 logic nodes, CF11-002 error-handling nodes, CF11-003 wait/delay nodes) and then blocked, because there was no finished runtime to run them on.

With WF-001 complete, this becomes straightforward implementation work against existing specifications — which is why it is one of the few tasks in the revival plan that is genuinely routine. The value is high relative to the effort precisely because the design thinking was done eighteen months ago and only the execution stalled.

Two things to bring forward from the newer parts of the plan. Every node needs catalog entries (SUB-004/005), so that the semantic validator can check workflows and the AI authoring loop can build them — nodes that exist but are absent from the catalog are invisible to the substrate the rest of the plan is built on. And the nodes should be written in TypeScript if PLAT-003's runtime typing is underway, rather than adding new untyped JavaScript to a package being converted.

## Current State

- `dev-docs/tasks/phase-11-cloud-functions/CF11-001-logic-nodes/`, `CF11-002-error-handling-nodes/`, `CF11-003-wait-delay-nodes/` — specified, not implemented.
- WF-001 (as revised 2026-07-24) delivers the engine inside WF-004's `nodegx-backend` service, plus a written semantics spec (`WF-001-SEMANTICS.md`) — reconcile the CF11 node specs against that spec, not against the client runtime's behavior.
- The node-authoring pattern is established across the runtime and viewer packages, and documented in `dev-docs/reference/NODE-PATTERNS.md`.
- The execution history panel and canvas overlay (CF11-006/007) will display these nodes' executions.

## Desired State

- Logic nodes (conditionals, branching, comparison) usable in workflows.
- Error-handling nodes catching, routing, and reporting failures per CF11-002's design.
- Wait and delay nodes with correct semantics under the server-side execution model.
- All nodes catalogued, validated, and visible in the node picker.
- Execution of each node type visible in the history panel and canvas overlay.

## Scope

### In Scope
- [ ] CF11-001 logic nodes
- [ ] CF11-002 error-handling nodes
- [ ] CF11-003 wait/delay nodes
- [ ] Catalog entries for every node (SUB-004 generation, SUB-005 semantics)
- [ ] Node picker integration
- [ ] Tests per node against the documented runtime semantics
- [ ] An example workflow project exercising all three groups
- [ ] Documentation for workflow authors

### Out of Scope
- The runtime (WF-001)
- Deployment (WF-003)
- Series 2–5 nodes (parked; see the phase PROGRESS notes)
- Client-side equivalents of these nodes where they already exist

## Technical Approach

Follow the established node-definition pattern; these are ordinary nodes running in a different execution context, not a new category. Where a client-side equivalent already exists (conditionals, for instance), match its port names and behaviour as closely as the server semantics allow — a user who knows the client node should not have to relearn it, and gratuitous divergence between the two contexts is a documentation burden forever.

**Wait/delay nodes deserve specific attention.** In the browser they are frame-scheduled; server-side there are no frames, and a delay has real cost implications on a metered platform. Follow WF-001's documented semantics, and make sure the behaviour is explicit in the node's own documentation rather than assumed.

Error-handling nodes depend on the runtime's error routing (WF-001 step 5). If that routing turns out to be inadequate for CF11-002's design, fix it in the runtime rather than working around it in node implementations.

## Implementation Steps

1. **Review CF11-001/002/003 specifications** against WF-001's documented semantics; note and record any conflicts before implementing.
2. **Logic nodes**, matching client-side equivalents where they exist.
3. **Error-handling nodes** against the runtime's error routing.
4. **Wait/delay nodes** with semantics documented explicitly.
5. **Catalog entries** for all nodes.
6. **Node picker integration.**
7. **Example workflow project** exercising every node.
8. **Author documentation.**

## Testing Plan

- Per-node unit tests against WF-001's semantics.
- Error routing: failures reach the intended handlers; unhandled errors behave as documented.
- Delay accuracy and cancellation during a wait.
- Catalog validation: SUB-006's semantic validator accepts workflows built from these nodes.
- End-to-end: the example workflow runs and appears correctly in the history panel and canvas overlay.

## Success Criteria

- [ ] All CF11-001/002/003 nodes implemented
- [ ] Behaviour matches client-side equivalents where equivalents exist, with any differences documented
- [ ] Error routing works per CF11-002's design
- [ ] Wait/delay semantics documented and correct, including cancellation
- [ ] All nodes appear in the catalog and pass semantic validation
- [ ] Example workflow project runs end to end and displays correctly in the existing UI
- [ ] Author documentation published

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Specifications conflict with the runtime WF-001 actually built | Step 1 reconciles them before implementation; prefer changing the specs (recorded) over bending the runtime |
| Server-side node behaviour diverges confusingly from client equivalents | Match where possible; document every difference in the node's own documentation |
| Nodes ship without catalog entries and are invisible to validation and AI authoring | Catalog entries are an explicit scope item and success criterion |
| New untyped JavaScript added to a package being converted | Coordinate with PLAT-003; write TypeScript if that conversion is underway |

## References

- [`dev-docs/tasks/phase-11-cloud-functions/CF11-001-logic-nodes/`](../phase-11-cloud-functions/CF11-001-logic-nodes/) and CF11-002, CF11-003
- `dev-docs/reference/NODE-PATTERNS.md`
- Depends on: WF-001. Related: SUB-004/005 (catalog), PLAT-003 (typing)

## Checklist

- [ ] Branch `task/wf-002-workflow-nodes`; confirm WF-001 landed
- [ ] Reconcile CF11 specs with WF-001's semantics; record conflicts
- [ ] Implement logic, error-handling, and wait/delay nodes
- [ ] Catalog entries; node picker integration
- [ ] Example workflow project; author documentation
- [ ] Verify in history panel and canvas overlay; CHANGELOG; open PR
