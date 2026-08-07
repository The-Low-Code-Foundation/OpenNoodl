# WFA-006 — Assessment

**Written before any WFA-006 code**, the way WFA-004 recorded its §1 decision before touching the
canvas. Two things the spec hands the executor rather than decides: whether the reverse lookup can
reuse `NodeReferencesPanel` (step 1), and whether a rename offers to fix up backend-held workflow
definitions (step 7). A third — what "resolved" means when two different artefact stores disagree —
turned out to need writing down too.

**Spec:** [WFA-006-STEP-TO-FUNCTION-DESCENT.md](./WFA-006-STEP-TO-FUNCTION-DESCENT.md)

---

## 1. Step 1's question: can the reverse lookup reuse `NodeReferencesPanel`?

**No — and the reason is not "it would need changes". It is that every load-bearing assumption in
that panel is false for a workflow.** What is reused is its *idea* (an index from a referenced thing
to its referrers, each row a click that navigates), not its code.

`NodeReferencesPanel` ([NodeReferencesPanel.tsx](../../../packages/noodl-editor/src/editor/src/views/panels/NodeReferencesPanel/NodeReferencesPanel.tsx)),
read in full:

| What it assumes | Why a workflow breaks it |
|---|---|
| The index is built by `ProjectModel.instance.forEachComponent` | A workflow is **not in `ProjectModel`** — WFA-004 §1's decision, not an oversight. There is nothing for `forEachComponent` to walk. |
| A reference is a `NodeGraphNode` whose `node.type.name` is the referenced thing | A workflow's reference is `step.ref`, a **bare string** in a JSON definition in a backend's data directory. There is no node and no type. |
| Building the index is synchronous | Workflow definitions come from `GET /admin/workflow-defs` over IPC, **per backend**, and a backend may be unreachable. The panel has no state for "asked and did not get an answer". |
| A row's click is `switchToComponent(component, {node})` | Opening a workflow is `WorkflowEditorService.open(ref)` — a fetch, a catalog import and a document, not a component switch. |
| It refreshes on `Model.componentAdded` / `nodeAdded` / … | A workflow changing is not a project event. Nothing in that list ever fires for one. |
| One index, keyed by type name | Resolution is **per backend** (spec trap: two backends can run with different function sets). The panel has no place to say which backend a row came from. |

Reusing it would mean replacing `useNodeReferences` wholesale, adding a second row kind with its own
click behaviour, and adding backend grouping — i.e. keeping the file name and replacing the file.

Two further facts settle it:

- **The panel is registered `experimental: true`** ([router.setup.ts:336](../../../packages/noodl-editor/src/editor/src/router.setup.ts#L336)), so it
  is **not in the sidebar rail** by default — exactly the state WFA-002 found Execution History in
  (F18). An affordance the user cannot find is not an affordance.
- The spec asks for it "**from a cloud function's canvas**". A panel is not on the canvas.

**What is built instead:** a chip in the component trail bar — the same bar the descent's breadcrumb
lands in — reading *Used by 2 workflows*, which opens a menu of `<backend> · <workflow>` entries that
open that workflow. The descent and its reverse then live in the same strip of screen, which is the
symmetry the spec is asking for. The trail component gains **one optional prop**, rendered only when
supplied, so an ordinary component's trail takes a code path that is byte-for-byte what it takes
today.

## 2. Step 7's decision: a rename does **not** rewrite backend-held definitions

**Decision: make the breakage visible; do not offer an automatic fix-up.** Six reasons, in the order
they are decisive:

1. **The editor cannot know which backends to write to.** WFA-001 established that
   `BackendManager.createBackend` initialises `projectIds: []` and **nothing ever writes to it**, so
   "this project's backends" is, today, *every running local backend*. A rename in project A would
   rewrite workflow definitions on a backend that project B is authoring against. That is precisely
   the two-artefact-stores conflation this task exists to make visible.
2. **A definition that fails validation stops the backend booting.** WF-001's registry refuses to
   start with an invalid `workflow-defs` entry, and WFA-004 built the entire save path around that
   fact. Putting an automatic write to those files behind an ordinary editor gesture — renaming a
   component — attaches a boot-failure risk to an action with no visible relationship to a backend.
3. **Not every stale-looking reference is stale.** The spec's own §2 requires "deployed but not in
   this project" to be a *first-class, correct* state: a step may deliberately point at a function
   deployed from a different project or an older version. A fix-up cannot tell that step from a
   broken one, so it would rewrite a working step to point at something else.
4. **The rename is undoable and the backend write is not.** Cmd-Z restores the component name and
   would leave the rewritten definitions rewritten. WFA-005 refused the same shape for trigger
   delete — "putting an irreversible cross-process delete behind Cmd-Z's promise would be a lie about
   what just happened" — and a cross-process *write* is the same lie.
5. **It cannot be complete.** Renaming with no backend running fixes nothing, and the user is given
   no signal that a fix-up they have come to rely on did not happen. A repair that works most of the
   time is worse than a break that is always visible.
6. **The spec's own Out of Scope says so** unless this decision says otherwise with reasons. It
   does not.

**What is delivered instead**, and it is required either way: after a rename, every workflow step
referencing the old name stops claiming to resolve — the state is on the card with no interaction, the
reason is in the property editor, and the honest message appears on double-click. Retargeting is one
edit in the `ref` row, which now offers the names that actually exist (in this project, and on this
backend) rather than being free text. Fixing it is a click; doing it silently is not on offer.

**One correction to the spec's own wording, found by writing the test.** Success criterion 7 says a
rename makes referencing steps show as *unresolved*. Immediately after a rename that is not true, and
saying it would be the wrong warning: the backend is **still serving the function under its old
name**, so the step still runs. What it shows is `deployed, not in this project` — the state §2 asks
for, arriving here for a reason §2 did not anticipate. It becomes `unresolved` when the next deploy
removes the old name, which is the moment it actually breaks.

That sequence is also the strongest argument for the decision above: an automatic fix-up at rename
time would rewrite a step that is **working**.

Two tests, one per stage: the rename alone leaves the step `deployed-only` with the definition
untouched; the deploy that follows leaves it `unresolved` and flagged, still with the definition
untouched.

## 3. What "resolved" means, and the fourth state

`isTargetResolved` (WFA-005) answers `true | false | null`, and the `null` is the load-bearing part:
*"the backend could not be asked" must never be reported as "it is not there"*, because a wrong
warning about a working step is worse than no warning. That answer is reused verbatim here, and this
task needs **two independent facts** rather than one:

```
inProject  = ProjectModel has /#__cloud__/<ref>          → true | false   (always knowable)
deployed   = <ref> is in GET /admin/workflows.functions  → true | false | null
```

which collapse into the four states the card and the descent speak:

| `inProject` | `deployed` | state | what it means |
|---|---|---|---|
| true | anything | `resolved-in-project` | descend into it. If `deployed === false`, also offer to deploy — §2's third case, the common one during authoring |
| false | `true` | `deployed-only` | the backend has it, this project does not. Report it; resolve nothing (Out of Scope) |
| false | `false` | `unresolved` | the step is broken — nowhere to descend, and it will fail at run time |
| false | `null` | `unknown` | the backend could not be asked. **Never a warning.** Says "cannot check", names the backend |

**"Deployed" and "in the project" are never conflated**, which is the spec's explicit trap: the push
is hash-gated and on-save (WFA-001), so `GET /health` legitimately lags the project, and the
difference between the two is exactly the thing the user needs to see. The helper therefore keeps
both fields on the answer and derives the state; nothing downstream re-derives it.

Resolution is **per backend** and every message names the backend it is about — two backends can be
running with different function sets, and "not deployed" is meaningless without saying where.

## 4. The walker audit (the F49/F51 shape, checked before building)

A shared structure that grows a new kind of member needs every walker re-read. This has bitten twice
— F49 (a node announcing ports before it had an owner) and F51 (a trigger offered as an upstream
step). WFA-006 changes what a `call-function` card carries and adds a gesture, so:

| Walker | Verdict |
|---|---|
| `WorkflowDocument.toInput` | **Safe, and checked.** It writes `step.ref` from `node.parameters.ref` and skips `STEP_FIELD_PARAMS`. Resolution state is deliberately **not** a parameter — it lives in `metadata` and in `WarningsModel` — so there is nothing new for it to serialise into a definition the backend would reject. |
| `WorkflowDocument.syncEntry` | **Untouched.** It walks node ids and connections; no node is added or removed by this task. |
| `workflowScope.upstreamSteps` | **Untouched.** Same reason: no new node kind. A descent navigates away rather than adding anything. |
| `ExecutionOverlay` | **Already correct, by design rather than by luck.** It recomputes `getNodeBounds` per render precisely because "the open graph changes underneath us", and descending mid-pin is that case: it will report *N of M steps are not on this canvas* rather than drawing nothing. Cloud function node ids are guids, so they cannot collide with step ids and produce a badge on the wrong card. |
| `NodeGraphEditorNode.updateIcon` / `paintNode` | The mechanism being used, not a walker: an unhealthy node already draws a dashed danger ring and a warning glyph. No painter change. |
| `TitleBar.getWarningsAmount` | **Checked.** Warnings are counted for the *active* component plus project-level plus `showGlobally` ones. Workflow warnings are filed under the workflow adapter's name and are **not** `showGlobally`, so they do not inflate a project's warning count from another canvas. |
| `NavigationHistory` | **A real hazard, closed.** F48: it resolves entries through `ProjectModel.getComponentWithName`, which cannot find a workflow. The trail's back-crumb would have pushed one. Kept out by runtime type in `switchToComponent`, so no caller has to remember. |

## 5. F54 — found while reading, before any of the above

`fetchTriggerTargets` reads the deployed function list as
`status.functions.map(String)` — but `GET /admin/workflows` answers
`functions: {name, workflow}[]` (`WorkflowRunnerStatus`), so that produces
`["[object Object]"]`.

Consequences, both in WFA-005's shipped surface:

- the trigger target picker lists `[object Object]` instead of the function names, on any backend
  that actually has functions deployed;
- `isTargetResolved` then answers **`false` for a function that is deployed** — the wrong warning
  about a working trigger that WFA-005's own `null` state exists to prevent.

It was invisible in WFA-005's live pass for one reason, recorded in its notes: *"With no functions
deployed the picker said 'No functions on this backend'"*. The test project had none.

WFA-006 reads the same list, so it is fixed here rather than worked around: one
`deployedFunctionNames(status)` helper, used by both.
