# WFA-007 — Assessment and the §1 decision

**Written:** 2026-08-02, before any review-surface code, as Implementation Step 1 requires.
**Task:** [WFA-007-AI-PROPOSES-ONTO-CANVAS.md](./WFA-007-AI-PROPOSES-ONTO-CANVAS.md)
**Outcome:** *reuse* — AIX-003's review surface takes a workflow. The escalate branch of the
README's reuse-or-escalate rule is **not** taken. The walk below is the evidence, and it names the
four coupling points that had to be cut for it to be true.

---

## 1. The decision

> **Can AIX-003's review surface take a workflow subject, or is it component-shaped?**

**It can, and the coupling is in exactly one place: how an accepted selection becomes a written
artifact. The canvas, the annotated merged graph, the change list, the walkthrough and the
dependency closures are all subject-agnostic already — they speak `GraphSnapshot` and `GraphChange`,
not "component".**

`ChangeReviewDocument` today takes `{changeSet, files, onAcceptFiles}`. Of those three:

| Prop | Component-shaped? | Why |
|---|---|---|
| `changeSet: AuthoringChangeSet` | **No** | `{componentName, base, target, changes}` — two `GraphSnapshot`s and SUB-007 `GraphChange`s. A workflow definition converts to both. |
| `files: ComponentFiles` | **Yes** | The v2 `component.json` / `nodes.json` / `connections.json` triple. A workflow has no such thing and never will. |
| `onAcceptFiles(files)` | **Yes** | Only used to hand the materialized files onward. |

So the cut is: **the document stops materializing.** It becomes
`onAccept(rejected: ReadonlySet<string>) => string | null | Promise<string | null>` — "here is the
set of changes the reader excluded; apply the rest and tell me if it failed." Both existing AIX-002
call sites keep their behaviour by doing the `materializeSelection(changeSet, files, rejected)` hop
themselves, which is where it belonged: it is the *component* materializer, and a document that
renders a diff should not know that a component is three JSON files.

That is one prop signature and two call sites. It is not a fork, not a second canvas, and not a
subclass.

### 1a. What the review canvas needs that a component gives it for free

`buildReviewComponent(changeSet)` produces legacy component JSON with `annotation: Created |
Deleted | Changed` on nodes and connections plus `diffData.parent` for parameter detail, and
`ChangeReviewDocument` feeds it through `ComponentModel.fromJSON` into a read-only
`NodeGraphEditor`. Every one of those steps is type-driven:

- the **node types** resolve out of `NodeLibrary` by `typename`. WFA-004 already installs the nine
  step kinds under `workflow.<kind>` via `NodeLibraryImporter.importWorkflowLibrary`, so the review
  canvas draws real step cards — provided the proposal's backend catalog is imported *before* the
  review opens. That ordering is load-bearing, exactly as it is in `WorkflowDocument.open`.
- the **route labels on the wire** and the **dashed error edge** are painted from the port type
  (`connectionLabel`, `WIRE_TYPE_ERROR`), which the same library carries. A proposal's `onfalse`
  route is legible on the diff canvas for the same reason it is legible on the authoring canvas, and
  with no extra code.
- the **`annotation` dashing** already coexists with the error-edge dashing WFA-004 added — both are
  branches of the same `if` in `NodeGraphEditorConnection.paint`.

### 1b. The one thing that is NOT free, and it is a safety property

`Model.*` events are global (WFA-004's F44/F49 lesson). `ViewerConnection` filters workflow traffic
with `isWorkflowModelEvent`, which is a **positive test on the `/#__workflow__/` name prefix**. A
review component built with a plain name would therefore push `nodeAdded` / `parametersChanged`
events at the viewer naming a component it has never heard of — the precise defect F44 closed six
times and F49 closed a seventh.

So the review change set's `componentName` is `/#__workflow__/<workflowId>`, and that is a
correctness requirement, not a cosmetic one. It also gives `getComponentModelRuntimeType` the right
answer by prefix, so the read-only canvas is a workflow canvas.

`ChangeReviewDocument` appends ` (before)` / ` (proposed)` to that name for its two other view
modes; the prefix survives the suffix, and both filters still fire.

### 1c. Where a proposal comes from, since the editor has no workflow agent

**Verified against source, and the spec's framing needed adjusting.** The spec says "This task makes
the *editor's* path reviewable". There is no editor path. The editor's AI authoring loop
(`AiAssistant/authoring/tools.ts`) has exactly three tools — `get_node_types`, `get_component`,
`submit_component` — all component-scoped, none aware a backend exists. The only thing in this
product that can author a workflow is **`noodl-mcp`, writing straight to a running backend's admin
API**. Giving the editor an agent that authors workflows would be new AI capability, which the task
lists Out of Scope.

So the reviewable path is made by giving the *existing* tools a second destination:

**`create_backend_workflow` / `update_backend_workflow` gain `propose: true`. In that mode the tool
writes nothing to the backend. It writes a proposal file the editor picks up.** No new tool, no new
prompt, no new capability — the same tool, pointed at a review queue instead of at the engine.

The queue is `~/.noodl/backends/<id>/workflow-proposals/*.json`, which is the directory **both sides
already know**: `BackendManager` owns it in the editor's main process and `noodl-mcp`'s
`backendsRoot()` resolves the same path (that shared layout is F24, the finding this task is about).
Using it means no new discovery mechanism and no daemon.

**The direct path stays open, and the docs say so.** `propose` defaults to `false`, so every
existing agent flow is unchanged and an agent can still write to a backend the editor knows nothing
about. Pretending otherwise would be the dishonesty the task's own trap warns against. What changed
is that there is now somewhere better to send it, and the tool descriptions say when to.

### 1d. Why validate-before-render needed a new backend route

§3 requires the candidate to be validated **against the target backend** before it is offered. The
authoritative validator is `validateWorkflowDefinition`, and until now the only way to reach it over
HTTP was `POST`/`PUT /admin/workflow-defs`, which **persists on success**. "Check whether this would
be accepted" and "accept it" were the same call, so validating a proposal meant writing it — which
is the one thing this task exists to prevent.

`POST /admin/workflow-defs/validate` is added: same normalisation as `upsert`, same validator, no
persistence, `{valid, errors}`. It is additive, admin-access like its siblings, and cannot affect a
boot — `WorkflowRegistry.load` is untouched.

This is used twice, and the second use is the one that matters:

1. When a proposal is **staged**, the tool validates first and refuses to stage an invalid one,
   returning the backend's own errors to the agent. A proposal that cannot be saved never becomes a
   choice the user is asked to make.
2. When a **partial** selection is accepted, the materialized definition is validated before it is
   written. This is what makes partial accept safe in the last resort: whatever the closures miss,
   the authoritative validator sees, and the user is told before anything reaches disk.

### 1e. Partial accept: it ships, with the closures re-derived

The task's §2 offers an out — "ship accept-all / reject-all only and say so". **It is not taken.**
Workflow closures are simpler than component ones and they were derived from the engine's validator
rather than inherited:

| Rule | Where it comes from |
|---|---|
| An accepted edge requires the added steps at both ends | `validateWorkflowDefinition`: *next target "x" does not exist* |
| Removing a step requires removing every edge that touched it | same |
| A step whose params contain `{"$path": "upstream.X…"}` requires the change that adds **X** | `validateValueReferences` — **this rule has no component analogue** and is the one AIX-003's generic requirements cannot produce |
| The entry always names a surviving step | `entry "x" must name one of the steps` — handled by *repair*, not by a closure (below) |

The generic `computeRequirements` in `ChangeSet.ts` supplies rows 1–2 unchanged, because they are
graph facts rather than component facts. Row 3 is added by a workflow-specific augmentation. The
component-only rules it also computes (parent-of-a-new-node, reparenting, child disposition) are
inert here: workflow steps are never nested, so `parent` is always `undefined`.

Row 4 is deliberately **not** a closure. The entry is one field of the workflow, it is not
excludable in the review (it rides the non-excludable component-metadata row, like the component
identity rows AIX-003 already treats that way), and a partial accept can still orphan it by
rejecting the add of the step it names. Making that a dependency would either make half the
proposal non-excludable or produce a closure the reader cannot predict. Instead the materializer
**repairs** it with the rule the canvas already uses when a step is deleted
(`WorkflowDocument.syncEntry`): keep the stored entry if it survives, else the leftmost step with
nothing wired into it. A reader who rejects the entry step gets the answer they would have got by
deleting it on the canvas, which is the answer they can predict.

### 1f. Update mode and ids (§5)

Three mechanisms, in the order they bite:

1. **The tool asks for the ids back.** `update_backend_workflow`'s description names
   `get_backend_workflow` as the place to read the existing step ids, and says a re-numbered
   proposal reviews as a wholesale replacement.
2. **The tool carries `ui` over by id.** A proposed step whose id matches an existing one and which
   omits `ui` keeps the stored canvas position. This is AIX-002's field-carryover pattern applied to
   the one field an agent has no way to know and every reason to drop — and without it, every
   AI-authored update would silently re-lay-out a hand-arranged workflow.
3. **The diff's structural matcher names a rename.** SUB-007's `matchRecreatedNodes` is on by
   default, so a step that was re-identified but is otherwise the same reads as *recreated*, with
   its parameter deltas, rather than as an unrelated removal and addition.

Ids are **not** rewritten by the editor. A step id is the execution-history `nodeId` (F15) and the
canvas node id; silently re-keying one would break the run inspector's link to every past run of
that workflow.

---

## 2. The walk — what the review path uses, and what it had to change

Every row that says "none" is a seam that already existed.

| # | What WFA-007 needs | The existing seam | Change |
|---|---|---|---|
| 1 | A diff canvas | `ChangeReviewDocument` + `buildReviewComponent` + read-only `NodeGraphEditor` | **one prop**: accept is a callback, not a file materializer |
| 2 | Step cards on that canvas | `NodeLibraryImporter.importWorkflowLibrary(buildWorkflowNodeLibrary(catalog))` | none — call it before opening, as `WorkflowDocument.open` does |
| 3 | Two graphs to diff | `fromLegacyComponent` → `GraphSnapshot`; `diffGraphs` | **new**: definition → legacy graph JSON (`workflowGraphSnapshot.ts`), a pure function that mirrors `buildGraph` without a `NodeGraphModel` |
| 4 | Stable change ids + requirements | `wrapChanges` / `requiredWith` / `excludedWith` in `ChangeSet.ts` | **extracted** to a pure `changeClosure.ts` (they import nothing but `@noodl-versioning`); `ChangeSet.ts` re-exports, so no call site moves |
| 5 | The `upstream.<id>` closure | — | **new**, per §1e row 3 |
| 6 | An accepted selection → a definition | `materializeSelection` (component files) | **new** `materializeWorkflowSelection`, definition-native |
| 7 | "Would this save?" | — | **new** `POST /admin/workflow-defs/validate` (§1d) |
| 8 | A proposal reaching the editor | `~/.noodl/backends/<id>/` (F24's shared layout) | **new** `workflow-proposals/` directory, written by MCP, read by `BackendManager` over three IPC channels |
| 9 | Somewhere to review from | The Workflows panel (WFA-004) | a Proposals section — the same panel that lists workflows per backend, because a proposal is *for* a backend |
| 10 | Accept → written | `saveWorkflow` (`backend:save-workflow-def`) | none |
| 11 | Failed run → fix request | `ExecutionDetail` (WFA-002) | one button that puts the run's context on the clipboard as a request (§4 below) |

### The port vocabulary had to come out of the canvas module

`typeNameForKind`, `routePortName`, `PORT_IN/NEXT/ON_ERROR` and friends live in
`workflowNodeLibrary.ts`, which imports `CanvasTheme` — so anything reusing them drags the canvas
in, and the definition→snapshot conversion cannot be unit-tested without Electron. They are moved
verbatim to a `workflowPorts.ts` with no imports at all, and `workflowNodeLibrary.ts` re-exports
them so no existing import changes. That single extraction is what lets the change-set logic live in
`tests-unit/` (jest, plain Node) rather than in the Jasmine-in-Electron suite.

---

## 3. What the walk found that the spec did not say

- **The spec's "the editor's path" does not exist.** §1c. This is the largest correction, and it is
  what makes `propose` a mode on the existing tools rather than a hook into an editor agent.
- **There was no way to ask a backend "would you accept this?" without it accepting.** §1d. The task
  is built on validate-before-render and the endpoint for it did not exist.
- **`buildChangeSet` is not reusable, but 80% of `ChangeSet.ts` is.** The entry point hard-codes
  `ProjectModel` + the v2 exporter; the closure machinery under it is pure graph algebra.
- **AIX-003's `isExcludable` already has the right instinct for workflow-level fields.** It refuses
  to let component-identity rows be excluded. Entry / name / concurrency / timeouts map onto exactly
  that treatment with no new concept.
- **`node-moved` is `category: 'cosmetic'`.** Step `ui` positions therefore diff as layout-only and
  are counted in the rail's "N layout-only" line rather than presented as change. That is the right
  answer and it arrives free.

## 4. The failed-run → fix hop (§6), and its honest size

The spec asks for "at least the first hop … even if the rest is just the existing flow". The rest of
the flow is an agent that holds the MCP tools, and that agent is **not inside the editor** — it is
whatever the user is talking to. So the first hop is: from a failed workflow execution, produce the
request that agent needs, with the execution id, the workflow id, the backend id, the failing step
and its error, and the instruction to answer with `update_backend_workflow` in `propose` mode.

It is a **Copy fix request** button on the failure, not a chat box. A chat box would imply an agent
the editor does not have; the clipboard is the transport that actually exists between this editor
and the agent the user is running. The loop closes because the proposal comes back to the Workflows
panel — that half is real.

## 5. Order of work

1. `POST /admin/workflow-defs/validate` + registry `validate()`, with backend specs.
2. MCP: unknown-kind refusal naming `list_backend_step_kinds`; `propose` mode; `ui` carry-over, with
   specs against a real running backend.
3. Editor main: the proposal store + three IPC channels, with jest specs on the file contract.
4. Pure renderer modules: `workflowPorts`, `workflowGraphSnapshot`, `workflowChangeSet`
   (+ closures + materializer), with jest specs in `tests-unit/`.
5. `ChangeReviewDocument`'s accept generalisation and the two AIX-002 call sites.
6. The Workflows panel's Proposals section, the open/accept/reject orchestration.
7. The failed-run fix request.
8. Docs, and the live pass.
