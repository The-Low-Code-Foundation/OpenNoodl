# WFA-007 — Notes

**Status:** 🟨 Built, specs green, **live pass NOT run.** The editor could not be
started for this task — another session held the dev stack — so everything below that says
"verified" means a spec verified it, and the live-QA script at the end is what remains.
**Spec:** [WFA-007-AI-PROPOSES-ONTO-CANVAS.md](./WFA-007-AI-PROPOSES-ONTO-CANVAS.md) ·
**Assessment / §1 decision:** [WFA-007-ASSESSMENT.md](./WFA-007-ASSESSMENT.md)

**Branch:** `wt-wfa-007`, from `cline-dev` at `32e3a946`.

| Commit | What |
|---|---|
| `6ba16834` | The assessment: AIX-003's surface takes a workflow, and the editor has no AI path |
| `87efbe97` | Ask a backend whether it would accept a definition, without it accepting one |
| `b4678557` | The MCP tools can propose instead of write, and the served registry is now the gate |
| `d812a6eb` | The editor reads the review queue an agent writes to |
| `671bcf63` | A workflow proposal as a change set, with closures re-derived from the engine |
| `a8b121e3` | A proposal arrives as a diff on the canvas, and accept is the only write |
| (this) | Docs and notes |

---

## The headline: the spec's premise had a hole, and closing it is most of the task

> "This task makes the **editor's** path reviewable."

**There is no editor path.** Verified from source, not assumed: the editor's AI authoring loop
(`AiAssistant/authoring/tools.ts`) has exactly three tools — `get_node_types`, `get_component`,
`submit_component` — all component-scoped, none of which knows a backend exists. The only thing in
this product that can author a workflow is `noodl-mcp`, writing straight to a running backend's
admin API. Giving the editor an agent that authors workflows is new AI capability, which the task
lists Out of Scope.

So the reviewable path had to be made out of the tools that already exist:
**`create_backend_workflow` / `update_backend_workflow` gained `propose: true`.** In that mode the
tool writes nothing to the backend and drops a proposal file the editor picks up. No new tool, no
new prompt, no new capability — the same tool pointed at a review queue.

The queue is `~/.noodl/backends/<id>/workflow-proposals/`, which is the directory **both processes
already know**: `BackendManager` owns that layout and MCP's `backendsRoot()` resolves the same path.
That shared knowledge *is* finding F24, the thing this task exists because of; using it means no
daemon, no port and no new discovery mechanism.

`propose` defaults to **false**, so the direct path is not closed. That is stated in
`WORKFLOW-NODES.md` rather than papered over, because the task's own trap says to.

## The decisions, in one place

1. **Reuse, not escalate.** AIX-003's `ChangeReviewDocument` renders the workflow diff. It was
   component-shaped in exactly one place — it materialized component files itself — so `onAcceptFiles(files)`
   became `onAccept(rejected)` and each subject materializes its own artifact. Everything else in
   it already spoke `GraphSnapshot`/`GraphChange`. Two call sites updated; no second diff canvas.
2. **Partial accept ships.** §2's "or say you shipped accept-all only" was not taken. The closures
   were re-derived from `validateWorkflowDefinition` rather than inherited — see below.
3. **Validate before render, and validate again before write.** The second one is the load-bearing
   one, and it needed a new backend route.
4. **The review names its backend.** A definition validated against one backend is not valid against
   another; the title and the context note both say which one, and the proposal file carries the
   backend id it was validated against.

## Things the spec did not anticipate

### There was no way to ask "would you accept this?" without it accepting

`POST`/`PUT /admin/workflow-defs` **persists on success**. "Check" and "write" were the same call,
so validating a proposal against its target backend meant making it that backend's state — the one
thing a review surface exists to prevent.

`POST /admin/workflow-defs/validate` was added: the same normalisation `upsert` does, the same
validator, nothing written, `{valid, errors}` as a **200** (a 400 would be indistinguishable from
the route being wrong). The spec asserts the property a careless implementation gets wrong: that a
**valid** definition is not written either.

### The MCP tool's `kind` was a bundled copy of the step vocabulary

`kind` was `z.enum([...the nine kinds])` — inside the one package whose entire doctrine is that the
vocabulary is *served* because it differs per backend. It could accept a kind an older backend
cannot run (rejected later, by a 400 mid-save) and reject a kind a newer backend serves (rejected
by a schema nobody can update from outside). Both are the drift the served registry exists to
prevent, sitting in the enforcement layer.

It is now an open string, and `refuseUnservedKinds` reads `GET /admin/workflow-step-kinds` from the
**target** backend and refuses anything it does not serve — naming `list_backend_step_kinds`,
listing what *is* served, and doing it before anything is written. That is §4 done at the only place
that can be right about it.

### The generic closures only ran one way, and the gap was silent

`computeRequirements` (AIX-003) says *accepting a node removal requires accepting the edge removals
that touched it*. Correct — and it makes the reverse closure drop the node removal when a reader
restores an edge. What it does not do is the other direction: rejecting the **node** removal left
the **edge** removal accepted, so a reader who said "don't delete this step" got the step back with
nothing wired into it.

That is **not a 400** — an unreachable step is a legal definition — which is precisely why it needed
finding. A closure's job is not only to prevent invalid definitions; it is to prevent a reader
getting something they did not ask for. Made mutual, so the pair is atomic. (A cycle in `requires`
is fine: both closures walk with a visited set.)

### `upstream.<stepId>` has no component analogue

WFA-003 made a param able to reference an earlier step, and the engine rejects a reference to a step
that is not there. So: a step whose params contain `{"$path": "upstream.X…"}` requires the change
that adds **X**. Nothing in the component closures can produce that rule, and this is exactly the
trap the spec warned about — "reusing the code without re-deriving the rules will produce closures
that are subtly wrong in the direction of allowing a bad accept."

The walk deliberately does **not** descend into `$literal`: whatever is under it is data, and a
`{"$path": …}` there is a string somebody wants passed through. Treating it as a reference would
make a legitimate proposal un-acceptable. Spec'd both ways.

### The entry is repaired, not closed over

A partial accept can orphan the entry (reject the add of the step the proposal made the entry).
Making that a dependency would either make half the proposal non-excludable or produce a closure a
reader cannot predict. Instead the materializer applies the rule the canvas already uses when a step
is deleted (`WorkflowDocument.syncEntry`): keep the stored entry if it survives, else the first step
nothing is wired into. That is an outcome a reader can anticipate; a surprising closure is not.

### `component-metadata-changed.path` is dotted and rooted

It is `metadata.entry`, not `entry`. Reading it raw made every accepted entry / concurrency /
timeout change **silently do nothing** — the accept succeeded, wrote a definition, and dropped the
one field the reader had explicitly kept. Caught by the spec that asserts which paths the diff
produces, which is the only reason it was caught at all: nothing throws, nothing warns, and the
save is a 200.

### A review component must carry the workflow name prefix

`ViewerConnection.isWorkflowModelEvent` filters model traffic by testing for `/#__workflow__/`. A
review graph named anything else pushes `nodeAdded` / `parametersChanged` at the viewer naming a
component it has never heard of — F44's class, closed six times, and F49 a seventh. So the change
set's `componentName` is the workflow adapter name, and it is a correctness requirement rather than
a cosmetic one. (It also gives `getComponentModelRuntimeType` the right answer by prefix.)

### The Workflows panel could not show an error unless a workflow was open

`{status && …}` and `{error && …}` were rendered **inside** `{document && …}`. So anything that
failed with nothing open reported itself to nobody — which is WFA-004's own note, *"a click that
appears to do nothing is what a thrown-and-caught open looks like"*, still true four tasks later.
Hoisted out. A shipped defect, fixed in passing, and it had to be: every refusal this task can
produce happens with no workflow open.

## Two extractions, both verbatim, both to make the logic testable

The editor's own specs are Jasmine-in-Electron and could not be run for this task. But
`packages/noodl-editor/tests-unit/` is a **jest** runner for renderer-side code that is *pure*
(OBS-002 built it). Getting the change-set logic in there took two moves:

- **`workflowPorts.ts`** — the port and type-name vocabulary, out of `workflowNodeLibrary.ts`, which
  imports `CanvasTheme` and therefore dragged the whole canvas into anything reusing the names.
- **`changeClosure.ts`** — the pure half of `ChangeSet.ts` (ids, requirements, both closures), out of
  the module that reaches `ProjectModel` and the v2 exporter.

Both re-export from their old homes, so **no call site moved**. The payoff is 28 jest specs that
actually ran, over the code where every subtle failure in this task lives.

`jest.config.js` gained `@noodl-versioning` and `@noodl-models/*` mappings. That does **not** make
the renderer importable — a module reaching React or an editor singleton still fails loudly there,
which is the boundary doing its job.

## Tests

| Suite | Result |
|---|---|
| `packages/nodegx-backend` — the dry-run route (**new**, 6 specs) | ✅ 11 workflow suites / **161 specs** |
| `packages/noodl-mcp` — propose / kind refusal / `ui` carry-over against a **real spawned backend** (**new**, 9 specs) | ✅ these + `backendTools` = **38 specs** |
| `packages/noodl-editor` jest (`tests-main` + `tests-unit`) — the proposal file contract (8), the change set and closures (19), the fix request (9) | ✅ **18 suites / 176 specs** |
| `typecheck:editor`, `typecheck:editor-tests`, nodegx-backend `typecheck` | ✅ clean |
| `packages/noodl-editor` **Jasmine** — `tests/workflow/workflowproposal.test.ts` (6 specs) | ⛔ **not run** — `test:ci` starts Electron |

**Two gates were already red on this base**, both verified as pre-existing rather than caused here:

- `packages/noodl-mcp` `tests/tools.test.ts` — one failure (`create_component` / `validate_project`).
  Verified by restoring `HEAD`'s `backendTools.ts` and re-running: identical failure. Nothing in this
  task touches that path.
- `npm run colors` — `noodl-editor` +15 hex, **all in `ProvenancePanel.module.scss`** (OBS-002/004
  territory). The SCSS added here uses tokens only and contributes zero.

## Could not verify — the live-QA script

The editor was never started. Everything in this section is unrun, in the order to run it. The whole
thing needs **one running backend** and an MCP client pointed at this checkout.

### Setup

1. Start the editor on a project, open **Backend Services**, start a backend. Note its name.
2. Create a workflow to update, either from the Workflows panel (**+**, then save) or over the admin
   API. Call it `wf_orders`, two steps, so there is a base to diff against.

### 1 — the tool refuses a kind the backend does not serve (§4)

From an MCP client:

```
create_backend_workflow  id=wf_bad  entry=a  steps=[{id:"a", kind:"send-carrier-pigeon"}]
```

**Expect:** an error naming `list_backend_step_kinds` and listing the kinds this backend serves.
**Expect:** the Workflows panel, after **Refresh**, shows no `wf_bad`.

### 2 — a proposal is staged, and nothing is written

```
update_backend_workflow  id=wf_orders  propose=true  note="Retry the charge and route its failure"
  entry=<the existing entry>
  steps=<the existing steps, ids REUSED, with one changed to kind "retry" and a new step wired from its onError>
```

**Expect (tool):** `proposed: true`, `mode: "update"`, and a note saying nothing was written.
**Expect (editor):** open the **Workflows** panel and press **Refresh** (a proposal is written by
another process; there is no event — see the residual below). An amber section appears above the
workflow list: *Proposed for \<backend\> — 1 awaiting review*, with the agent's note in italics and
two buttons.
**Expect:** the workflow itself is unchanged — open it and confirm it still has its original steps.

### 3 — the diff renders on the canvas

Press **Review on the canvas**.

**Expect:** the editor switches to a full-window review document titled
*Review \<workflow\> — proposed on \<backend\>*. Left: a read-only canvas showing **step cards**, not
red unknown nodes. The added step is green/Created, the changed step is Changed, the untouched one
is plain. The added `onError` wire is drawn **red and dashed**, and any route wire carries its name.
Right: a change list grouped into sentences, with a `Before / Changes / After` toggle in the topbar.

**Check, specifically:**
- clicking a change entry centres its card on the canvas;
- **Before** shows the original graph, **After** shows the proposal;
- the context note names the backend and says *Nothing is written until you accept*;
- the walkthrough (`Walk through` / `Next`) steps through the anchored changes.

**If the cards render as red unknowns**, the step-kind library was not installed before the document
opened — that is the one ordering this task depends on.

### 4 — accept

Press **Accept all**.

**Expect:** the button reads *Applying…* briefly, the review closes, and the canvas lands on the
**real** workflow with the accepted changes drawn on it. The Proposals section is gone (the proposal
was discarded). Reopen the workflow from the panel and confirm the change persisted on the backend.

### 5 — partial accept, and the closure

Stage another proposal that **adds two steps**, one wired from the other, and give the second one a
param `{"$path": "upstream.<first new step id>.result.x"}`.

Review it, and use the **×** on the change that adds the FIRST new step.

**Expect:** the row greys out, and **so do** the row that adds the second step and the row that adds
the edge between them — that is the closure. The accept button reads *Accept N of M*.
**Expect:** accepting writes a workflow with neither new step and no dangling edge.

### 6 — a proposal that would not save is never offered

```
create_backend_workflow  id=wf_cycle  propose=true  entry=a
  steps=[{id:"a",kind:"wait",params:{duration:1},next:["b"]},
         {id:"b",kind:"wait",params:{duration:1},next:["a"]}]
```

**Expect (tool):** refused with `validation-failed`, the word *cycle*, and *a user cannot accept*.
**Expect (editor):** no proposal appears in the panel at all.

### 7 — the failed-run → fix hop (§6)

Break the workflow deliberately (point a `call-function` step at a function that does not exist, or
`Run & pin` a workflow whose step fails), then open **Execution History** and select the failed run.

**Expect:** an **Ask for a fix** section with a **Copy a fix request** button, above the Error
section. Press it; it should read *Copied — paste it to your agent*.
**Expect (clipboard):** the backend id, the workflow id, the execution id, the failing step and its
error, and an instruction to answer with `update_backend_workflow` using `propose: true` and to
reuse the step ids.

Paste it to the agent, let it answer, **Refresh** the Workflows panel, review the proposal, accept,
re-run. That is the phase's closing loop.

**Expect the button to be ABSENT** on a successful run, and on a cloud function call (which records
no steps at all).

### 8 — AIX-003's own review is unregressed (a success criterion)

The Build panel's component review shares the document this task changed. Author a component with
the AI panel, press **Review**, exclude a change, accept. **Expect** identical behaviour to before:
the same canvas, the same rail, and `Accept N of M` writing only the kept subset.

### 9 — both themes

The Proposals section uses the amber `--theme-color-warning` token (an unreviewed proposal is
something waiting for you, not something wrong — red stays reserved for errors). Screenshot it light
and dark.

## Open items to hand on

| # | Item |
|---|---|
| a | **A proposal is only noticed on refresh.** No event exists: another process writes the file. The panel re-reads on open, on becoming active, on `backend:statusChanged` and on **Refresh**. This is exactly **F61**, one artifact further out — and it closes the same way, with a backend-side signal on BAK-001's `ChangeBus`. F61's note says to wait for a second consumer before tapping that idea again; this is that second consumer, so the case for doing it is now stronger than it was. |
| b | **`propose` is opt-in.** An agent that does not pass it still writes straight to a running backend. Documented in `WORKFLOW-NODES.md` rather than hidden. Making it the default is a product call for Richard: it would break every existing agent flow built on these tools, and it would mean an agent working with no human present could not author at all. |
| c | **The proposal queue has no expiry.** A proposal staged against a workflow that is later deleted still lists, and its review would open as a `create` diff (the base fetch fails softly). Not wrong, but not thought about either. |
| d | **`BackendManager.backendsPath` ignores `NODEGX_BACKENDS_DIR`** while `noodl-mcp` honours it. Not introduced here — the new store takes its root from `BackendManager` precisely so the two cannot disagree — but if anyone ever sets that variable for the editor, the two halves of this feature would look at different directories. Worth making `BackendManager` honour it, in a commit of its own. |
| e | **The Jasmine specs are unrun.** `tests/workflow/workflowproposal.test.ts` (6 specs) asserts the §1 claim — that `buildReviewComponent` annotates a workflow diff correctly and produces something `ComponentModel.fromJSON` builds on the Workflow runtime. It typechecks; it has never executed. |
