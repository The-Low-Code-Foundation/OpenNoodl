# WFA-007: AI Proposes Workflows Onto the Canvas

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WFA-007 |
| **Phase** | Phase 27 — Visual Backend Authoring (Track L) |
| **Tier** | 4 — AI |
| **Priority** | 🟡 Medium (additive by construction — tiers 1–3 are a complete product without it) |
| **Difficulty** | 🟡 Medium — no new AI capability; the work is making an existing review surface accept a new subject |
| **Estimated Time** | 1.5–2 weeks |
| **Prerequisites** | WFA-004; AIX-003 (graph-native review) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Opus 5** — spans the AI authoring loop, the diff/review machinery and the new canvas, and the failure mode is a user accepting something they did not understand |

## Objective

Make an AI-authored workflow arrive as a **reviewable diff on a canvas** rather than as JSON accepted
blind — so the fastest way to build a workflow and the most legible way to understand one are the same
path.

## Background

### The capability already exists; the review surface does not

MCP can author workflows today. `noodl-mcp` exposes `create_backend_workflow` /
`update_backend_workflow` and `list_backend_step_kinds`, and discovers a running editor backend from
the userData directory — reading `config.json` for the port and `secrets.json` for the admin token
(F24, [`noodl-mcp/src/backend/client.ts:40`](../../../packages/noodl-mcp/src/backend/client.ts#L40)).
An agent can create a workflow on the user's local backend right now, with no editor cooperation and
**nothing rendered anywhere**.

That is the exact shape of the thing this phase exists to prevent: logic in your product that you did
not write and cannot see.

### AIX-003 already built the answer for browser graphs

Phase 15's graph-native review shipped in 2026-07-24: an annotated component rendered **on a diff
canvas** (not an overlay), with dependency closures that make invalid partial accepts
unrepresentable. AIX-002's update mode established the pattern of whole-candidate review with a diff,
keeping ids and carrying fields over rather than replaying operations.

This task points that machinery at workflow definitions. It adds no model capability, no new tool and
no new prompt surface beyond what already exists — its entire contribution is that the output lands
somewhere you can look at it.

### Why a workflow diff is easier than a component diff

- Workflows are small — ten steps, not a component tree.
- Steps have stable ids, so a diff is a set of added / removed / changed steps and edges rather than a
  tree reconciliation.
- The engine already validates a definition strictly at write time and refuses invalid ones with a
  400, so "would this even run?" has a cheap authoritative answer *before* the user is asked to accept
  it.

That last point is the one to exploit: **validate the candidate against the target backend before
rendering it for review.** A proposal that would be rejected on save should never reach the user as a
choice.

## Current State

| Piece | Where | State |
|---|---|---|
| MCP workflow tools | `noodl-mcp/src/tools/backendTools.ts` | `create_backend_workflow`, `update_backend_workflow`, `list_backend_step_kinds` — working, unrendered |
| Backend discovery | `noodl-mcp/src/backend/client.ts:40` | Reads userData backends dir + admin token |
| Graph-native review | AIX-003, phase 15 | Annotated component on a diff canvas; dependency closures |
| Authoring loop + update mode | AIX-002 | Whole-candidate review, id-keeping, field carryover |
| Diff/merge engine | SUB-007 | Graph diff, conflict UI, merge driver |
| Semantic validator | SUB-006 | Validates **project graphs against the node catalog** — explicitly does *not* see workflow definitions (WF-002 recorded this as an unowned follow-up) |
| Write-time validation | `WorkflowEngine.ts:135` + the served step catalog | Unknown kind / missing param / malformed condition / bad route → 400 naming it |

## Desired State

### 1. A proposal is rendered before it is accepted

An AI-authored workflow — new or an update — is presented on the WFA-004 canvas with added, removed
and changed steps and edges marked, in the visual language AIX-003 already established for components.
Accept or reject; nothing is written to the backend until accept.

Reuse AIX-003's surface. If it turns out to be component-shaped in a way that cannot take a workflow,
that is a finding worth recording and escalating — **not** a licence to build a second diff canvas.
The README's reuse-or-escalate rule applies with full force here, because a second review surface is
how "review your AI's work" quietly becomes two half-features.

### 2. Partial accept is safe or absent

AIX-003's insight was dependency closures: you cannot accept half of something and get a graph that
does not make sense. The workflow equivalent:

- Accepting a step requires accepting the edges that reach it, or it is unreachable.
- Accepting an edge requires both endpoints.
- Accepting a step that references `upstream.<id>` (WFA-003) requires that step.

If those closures cannot be computed cheaply and correctly, **ship accept-all / reject-all only** and
say so. A partial accept that produces a definition the backend rejects on save is worse than no
partial accept — and the engine's own 400 is the backstop that proves which happened.

### 3. Validated before it is offered

Before rendering, the candidate is validated against the **target backend**:

- Its kinds exist in that backend's `GET /admin/workflow-step-kinds` (versions can differ between
  backends; that is the point of the served registry).
- Its `ref`s resolve, using WFA-006's resolution helper — an unresolved function is shown on the
  proposal exactly as it is shown on a normal canvas.
- It passes write-time validation. If it does not, the failure is shown as the *AI's* failure with the
  400's message, and the user is not asked to accept something that cannot be saved.

### 4. The agent is told to look first

`list_backend_step_kinds` is already described as a tool to call before authoring. Reinforce it:
`create_backend_workflow` / `update_backend_workflow` should refuse, with a message naming the step
kinds tool, when they are called with a kind the target backend does not serve. The served registry is
the contract; making the tool enforce it costs one lookup and removes a class of bad proposal before
it is ever rendered.

### 5. Update mode keeps ids

Following AIX-002: an update to an existing workflow keeps step ids where the step is recognisably the
same, so the diff shows *changed*, not *removed and added*. A diff that renumbers everything is
unreadable, which defeats the task.

### 6. There is a path from a run to a fix

The phase's strongest loop, and the reason this task comes last: an execution failed in WFA-002's
inspector → ask for a fix with that execution as context → the proposal arrives on the canvas as a
diff → accept → re-run → watch it pass. Wire at least the first hop (an affordance from a failed
execution that carries the execution id and the failing step into the request) even if the rest is
just the existing flow.

## Implementation Steps

1. **Assessment**: can AIX-003's review surface take a workflow subject? Record the answer with the
   specific coupling points before writing code. This is the task's main risk and it is knowable in a
   day.
2. **Validate-before-render**, including the backend-version check and WFA-006's `ref` resolution.
3. **Render the diff** on the WFA-004 canvas.
4. **Accept/reject**, with closures if they are cheap and correct — or accept-all only, stated
   plainly.
5. **Tool-side refusal** of unknown kinds in the MCP write tools.
6. **Update mode id-keeping.**
7. **The failed-execution → fix affordance.**
8. **Live pass**: ask for a workflow in plain English against a running backend, review the proposal on
   the canvas, accept it, run it, break it deliberately, ask for a fix from the failed execution, and
   accept that. Screenshot every stage. This is the phase's closing argument and it should be
   demonstrable in one sitting.

## Success Criteria

- [ ] An AI-authored workflow is rendered as a diff on the canvas before anything is written.
- [ ] Nothing reaches the backend until the user accepts.
- [ ] A candidate that would fail write-time validation is never offered as an acceptable choice; the
      400's message is shown instead.
- [ ] A candidate using a step kind the target backend does not serve is refused at the tool, naming
      `list_backend_step_kinds`.
- [ ] An update keeps step ids, so the diff reads as changes rather than a wholesale replacement.
- [ ] Partial accept either respects dependency closures or does not exist, and which one shipped is
      stated.
- [ ] A failed execution in the inspector can start a fix request carrying its context.
- [ ] The full loop — describe, review, accept, run, break, fix, accept, pass — is screenshotted.
- [ ] AIX-003's existing component review is unregressed, proven by running it.

## Out of Scope

- **New AI capability.** No new tools beyond enforcement on existing ones, no new prompts beyond the
  fix-from-execution context.
- **Autonomous application.** Nothing is written without an explicit accept. This is the whole point.
- **Extending SUB-006's semantic validator to workflow definitions.** WF-002 recorded that as an
  unowned follow-up; the engine's own write-time validation is what this task uses, and it is
  authoritative because it is the thing that will reject the save.
- **AI authoring of cloud function graphs.** That is AIX-002's existing territory and is unchanged.
- **A second diff canvas.** See §1.

## Traps

- **MCP can already write to a running backend without the editor knowing** (F24). This task makes the
  *editor's* path reviewable; it does not close the direct path, and should not pretend to. Say so in
  the docs rather than implying every AI-authored workflow is reviewed.
- **The step-kind registry is per backend.** A proposal validated against one backend is not valid
  against another. Name the backend in the review UI.
- **AIX-003's dependency closures are component-shaped.** Workflow closures are simpler but not
  identical; reusing the code without re-deriving the rules will produce closures that are subtly
  wrong in the direction of allowing a bad accept.
- **A workflow definition that fails validation can prevent a backend from starting** — the registry
  refuses to start on an invalid file. Anything written by an accept must be validated first, and the
  test that proves it should try to write a bad one.
- **Editor specs are Jasmine, not Jest.**
- **AIX-002's spec-barrel trap** resurrected 16 dead specs once; when adding specs near that loop,
  check what the barrel picks up.
- **Do not let "the AI can fix it" become the answer to a defect this phase found.** F7 and F8 are code
  fixes owned by WFA-005. A troubleshooting assistant that talks a user through a broken Bearer header
  is a worse product than one where the header works.
