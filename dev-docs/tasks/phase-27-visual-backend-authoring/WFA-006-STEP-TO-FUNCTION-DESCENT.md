# WFA-006: Descend From a Step Into Its Function Graph

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WFA-006 |
| **Phase** | Phase 27 — Visual Backend Authoring (Track L) |
| **Tier** | 3 — the canvas |
| **Priority** | 🟡 Medium (not required for the phase to work; it is what makes it feel like one product) |
| **Difficulty** | 🟢 Low–Medium — the gesture and the breadcrumb both exist; the work is making two different graph sources agree |
| **Estimated Time** | ~1 week |
| **Prerequisites** | WFA-001, WFA-004 |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — a small, high-polish task that is mostly about navigation state |

## Objective

Make a `call-function` step behave like a component instance: double-click it and land inside that
function's graph, with a breadcrumb back — so the orchestration layer and the computation layer read
as two zoom levels of one thing rather than two products.

## Background

The phase's ladder (README) is deliberate: workflows orchestrate, cloud functions compute, JavaScript
is the escape hatch. The risk is that it reads as three disconnected places. The mitigation is a
gesture every Noodl user already has — descending into a component instance and following a trail
back.

Both halves exist:

- **The gesture.** Double-clicking a component instance to open its graph is core canvas behaviour.
- **The trail.** `NodeGraphComponentTrail` renders the breadcrumb and **already knows about this
  tier** — `if (name === '#__cloud__') return null` at
  [`NodeGraphComponentTrail.tsx:223`](../../../packages/noodl-editor/src/editor/src/views/NodeGraphComponentTrail/NodeGraphComponentTrail.tsx#L223)
  hides the cloud sheet segment, which is exactly the behaviour wanted here: the trail should read
  `Order Pipeline › saveOrder`, not `Order Pipeline › #__cloud__ › saveOrder`.
- **The context.** `NodeGraphContext` already switches an active graph between `'frontend'` and
  `'backend'` on `isComponentModel_CloudRuntime` ([`NodeGraphContext.tsx:12,125`](../../../packages/noodl-editor/src/editor/src/contexts/NodeGraphContext/NodeGraphContext.tsx#L12)).

### The one genuinely hard part

A workflow and a cloud function come from **different places**:

| | Workflow definition | Cloud function |
|---|---|---|
| Lives in | the backend's data dir (`<dataDir>/workflow-defs/`) | the project (`/#__cloud__/…` components) |
| Reached by | `GET /admin/workflow-defs/:id` | `ProjectModel` |
| Travels with | the backend | the project, through git |
| Exists when | a backend is running | always |

So a workflow step can reference a function that **does not exist in the open project** — because it
was deployed from a different project, or from an older version of this one, or by an agent. The
descent has to handle that honestly rather than opening an empty canvas.

## Current State

| Piece | Where | State |
|---|---|---|
| Component trail | `views/NodeGraphComponentTrail/` | Renders the breadcrumb; already suppresses `#__cloud__` |
| Active graph switching | `contexts/NodeGraphContext/NodeGraphContext.tsx` | `'frontend' \| 'backend'` on cloud-runtime components |
| Cloud component resolution | `utils/NodeGraph/index.ts` | By name prefix |
| Function name on a step | `step.ref` in a workflow definition | A bare name, e.g. `saveOrder` |
| Function name in the project | `/#__cloud__/saveOrder` | The prefix is stripped when deployed |
| Deployed function list | `GET /health` → `workflows.functions[{name, workflow}]` | What the backend actually has |
| Rename handling | `models/NodeTypeAdapters/CloudFunctionAdapter.ts` | Keeps in-project callers in sync |

## Desired State

### 1. Double-click descends

Double-clicking a `call-function` or `retry` step opens `/#__cloud__/<ref>` in the canvas, with the
trail showing `<Workflow name> › <function name>` and the workflow segment navigating back to the
workflow canvas.

The reverse is worth having too and is nearly free: from a cloud function's canvas, an affordance
listing the workflows whose steps reference it. "What calls this?" is the question you ask right
before editing a function, and `NodeReferencesPanel` already exists for the browser-graph equivalent —
check whether it can be reused before building anything.

### 2. A missing function is a first-class outcome

When `ref` does not resolve to a component in the open project, the descent must say which case it is:

- **Not in this project, but deployed on the backend** (present in `GET /health`'s
  `workflows.functions`) — "this function is deployed but is not part of this project." Offer nothing
  clever; the honest message is the deliverable.
- **Not in this project and not on the backend** — the step is broken. Say so, and make it visible on
  the step node itself, not only on double-click. This is the same class of problem as WFA-005's
  unresolved trigger target and should look the same.
- **In this project but not deployed** — offer to deploy it, using WFA-001's push path.

That third case is the common one during authoring and the one worth making smooth.

### 3. The step node shows what it points at

`call-function` and `retry` nodes show their `ref` on the card, with a resolution state: resolved in
project, deployed only, or unresolved. A step that points at nothing should be visibly wrong on the
canvas without any interaction.

### 4. Renames do not silently break workflows

`CloudFunctionAdapter` keeps in-project callers in sync when a function is renamed. Workflow
definitions are **not** in the project, so they are not updated.

This task does not have to rewrite backend-held definitions on rename — that is a cross-boundary
write with its own hazards. It does have to make the breakage **visible**: after a rename, any
workflow step referencing the old name shows as unresolved. Whether to offer a fix-up is a decision
this task takes and records; if it does offer one, it must be explicit about writing to the backend.

## Implementation Steps

1. **Read `NodeReferencesPanel` and the trail** before writing anything, and record whether the
   reverse-lookup half can reuse the panel.
2. **Resolution helper**: `ref` → one of `{resolvedInProject, deployedOnly, unresolved}`, using
   `ProjectModel` and `GET /health`. One function, unit-tested, used by both the node card and the
   descent.
3. **Node card state** on `call-function` and `retry`.
4. **Descent** on double-click, with the trail.
5. **The three missing-function outcomes**, including deploy-from-here for the in-project case.
6. **Reverse lookup** from a function's canvas.
7. **Rename behaviour** — decision recorded, breakage made visible, test that a rename produces an
   unresolved step rather than a silent no-op.
8. **Live pass**: from a workflow canvas, descend into a function, edit it, deploy it, run the
   workflow, and watch the changed behaviour in WFA-002's inspector — all without leaving the editor.
   That loop is the phase's thesis; screenshot it.

## Success Criteria

- [ ] Double-clicking a `call-function` step opens that function's graph with a working breadcrumb.
- [ ] The trail reads `Order Pipeline › saveOrder`, with no `#__cloud__` segment.
- [ ] A step whose `ref` does not resolve is visibly wrong on the canvas before any interaction.
- [ ] All three missing-function cases produce distinct, accurate messages.
- [ ] An in-project, not-yet-deployed function can be deployed from the descent.
- [ ] A function's canvas can list the workflows that reference it.
- [ ] Renaming a function makes referencing workflow steps show as unresolved; the decision on
      automatic fix-up is recorded either way.
- [ ] The edit → deploy → run → inspect loop is screenshotted end to end.

## Out of Scope

- **Writing workflow definitions on rename**, unless step 7's decision says otherwise with reasons.
- **Descending into `for-each`'s per-item function differently** from any other `call-function`. It is
  the same descent.
- **Any change to how functions are stored or deployed.** WFA-001 owns that path.
- **Cross-project function reuse.** "Deployed but not in this project" is reported, not resolved.

## Traps

- **`step.ref` is a bare name; the component is `/#__cloud__/<name>`.** The prefix is stripped on
  deploy. Every comparison needs to normalise, and the drag-to-canvas code already does this at
  `nodegrapheditor.drag.ts:118` — match its convention rather than inventing a second one.
- **`GET /health` reflects the backend, which may be stale relative to the project** if WFA-001's push
  is not on-save. "Deployed" means "the backend has it", which is not "the project has it" — the
  resolution helper must not conflate them, because the difference is exactly what the user needs to
  see.
- **Two backends can be running** with different function sets. Resolution is per backend; say which
  one is being reported against.
- **The trail is shared with the browser-graph descent.** A change to it affects normal component
  navigation; the live pass must include descending into an ordinary component to prove nothing
  regressed.
- **HMR keeps old panel components mounted.** If the trail appears not to update, restart before
  investigating.
