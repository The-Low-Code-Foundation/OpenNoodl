# WFA-004 — Notes (in progress)

**Status:** 🚧 In progress. The reuse thesis is proven and the authoring surface is built; the
live pass is **not** finished, so the task is not closed. See [What is left](#what-is-left).
**Spec:** [WFA-004-WORKFLOW-CANVAS.md](./WFA-004-WORKFLOW-CANVAS.md) ·
**Assessment / §1 decision:** [WFA-004-ASSESSMENT.md](./WFA-004-ASSESSMENT.md)

**Commits so far**

| Commit | What |
|---|---|
| (assessment) | The §1 decision, written before any canvas code |
| `b0a021b8` | A workflow is a document; step kinds are node types |
| `638ebb36` | A real workflow renders on the existing canvas |
| `632afcd9` | Edit a condition without touching JSON |

---

## The headline: it really is the same canvas

The phase-19 test workflow — six steps, a `branch`, a `retry`, an error route and a `merge` —
opens from a new Workflows panel and draws on the **existing** `NodeGraphEditor`, with:

- **canvas node id === step id**, with no mapping table anywhere;
- `ontrue` / `onfalse` written on the wires;
- the `onError` edge in the danger token **and** dashed;
- `Retry · chargeCard` as the card's second line;
- the trail reading `SQLite backend › Order Pipeline`.

Verified live (screenshot: the canvas with all six cards and every edge). The escalate branch of
the README's reuse-or-escalate rule was **not** taken, and the assessment's walk of thirteen
existing seams is what predicted that.

## The decisions, in one place

1. **A workflow is its own document type**, rendered through a `ComponentModel` adapter that is
   deliberately never handed to `ProjectModel`. It is not a project component: no ports, not
   instantiable, not in the project, not in git, not in an export, not deployed. Full reasoning in
   the assessment §1.
2. **A third `RuntimeType` exists — for the node LIBRARY, not the document.** That is the job
   `RuntimeType` already does: it is what makes the picker offer the nine step kinds on a workflow
   canvas and nothing else, with no filtering code in the picker.
3. **Step positions live on the step**, as an optional `ui: {x, y}` the engine ignores. A workflow
   definition is the *only* artefact a workflow has — no repository carries a layout beside it — so
   editor-local positions would mean every collaborator, and the same author on a second machine,
   opened a workflow that had never been arranged. Auto-layout is deterministic, so a workflow with
   no positions is readable rather than random.
4. **Acyclicity is refused at the moment you draw it**, in `WorkflowGraphModel.getConnectionStatus`
   — a `NodeGraphModel` override, because that method exists precisely to be answered differently.

## Things the spec did not anticipate

### The catalog had to grow: the operator set is now served too

§4 says a condition must be three controls and that a JSON textarea there fails the task. Rendering
an operator dropdown means having the operator list — and an editor holding **its own copy** of a
closed operator set can offer one the target backend cannot evaluate, which is exactly the drift
the served registry exists to prevent. So the catalog serves `conditionLanguage` (operator name,
human label, whether it is unary, whether it takes regex flags) and the version went **1.1.0 →
1.2.0**. Two existing specs assert that version; both were updated deliberately, which is what the
`version` field is for.

A pre-1.2.0 backend serves no operator list, and the control says so rather than guessing one.

### `mergeUpdates` is additive, so a workflow library has to be REPLACED

`NodeLibraryImporter.mergeUpdates` has always been additive — it adds a node type it has not seen
and carries a `TODO: Update the node data?` for one it has. Merging a second backend's catalog on
top of the first would therefore leave the **first** backend's params in place under the **second**
backend's name. `importWorkflowLibrary` remembers the names it installed and removes exactly those
before installing the next set.

### `Model.*` events are global, and only `nodeAdded` checked the project

Every model notification is broadcast as `Model.<event>` by `shared/model.js`, so a workflow's
canvas graph reaches every handler in `ViewerConnection`. `Model.nodeAdded` filtered on
`owner.owner !== ProjectModel.instance`; its siblings checked only that a *component* existed —
which a workflow's canvas adapter satisfies. Editing a step param would have sent the viewer a
`parameterChanged` naming a component it has never heard of. Guarded as a positive test for the
workflow prefix, because "not this project" would also drop module-component updates those handlers
deliberately still send.

### A guid is a legal step id, and that would have wrecked the run inspector

`NodeOperations.createNewNode` mints a guid. Nothing would break — a guid is a valid step id — but
every execution record would read `nodeId: "3f2a1c04-…"` instead of `nodeId: "charge"`, and the run
inspector this canvas exists to feed would be unreadable. `WorkflowGraphModel.addRoot` renames a
guid from the kind (`branch`, `branch2`, …) and **keeps** a non-guid id, because that case is the
undo of a delete re-adding a step other steps' edges still point at.

### `parent.model` is a `ModelProxy`, and reading through it fails silently

In a property-editor `TypeView`, `parent.model` is the visual-state/variant proxy; the real
`NodeGraphNode` is one hop further in at `.model` (the same hop `TypeView.bindStyleDefaultWatch`
makes). Reading `parent.model.owner` returns `undefined` with no error — the predecessor picker
simply said "nothing runs before this step" on a step that had three. Found live, fixed, **not yet
re-verified in the running app**.

### `forEachNode`'s callback is a truthy-return early-exit

Probing the canvas with `ed.forEachNode(n => nodes.push(n))` returns after the first node, because
`push` returns a length. This cost one wrong conclusion ("only one node rendered") before the
connection list gave it away. The same trap as `forEachRecursive` in the parallel-batch notes.

## What the canvas gained, in shared files

Two edits, both written as **type-driven rules** so nothing in the canvas learns the word
"workflow":

- `NodeGraphEditorConnection.paintPortLabel` — a port type may ask for its name to be drawn on the
  wire. Off for every port type that exists today. It is needed because a card only grows a port
  row for a port that is **already connected** (`NodeGraphEditorNode.measure` builds `plugs` from
  `this.connections`), so an unwired `onfalse` is invisible on the card.
- One `if` in `paint()` dashing the error wire type, beside the branch that already dashes a
  deleted-annotation wire.

Plus `CanvasTheme` gained the `logic` category — a UIX-001 token that had **no referent** until
step kinds arrived — and a `signal-error` wire colour. No new colour was invented, and red stays
reserved for the error edge under phase 23's law.

`NodeContextMenu` gained one generic hook: a graph model may contribute extra right-click actions.
The workflow graph uses it for "Start the run at …"; nothing else uses it, and the menu does not
know what an entry step is.

## Tests

- **`packages/nodegx-backend/tests/workflow-canvas-contract.test.ts` — 11 specs against a REAL
  running service** (the WF-003 `deploy-assets.test.ts` pattern the README's verification posture
  asks for). It reads the live `/admin/workflow-step-kinds` and asserts every assumption the
  editor's translator makes: known categories, known param types, enums carry values, DSL params
  are `raw`, dynamic routes exist only where the canvas derives ports from a param — plus that a
  step's `ui` position survives a round trip and that a malformed one is a **400** rather than
  something that could later stop a boot.
- The WF-002 coverage gate now also fails if a served condition operator is undocumented, and if
  this page's authoring instructions name a surface that does not exist (F10's failure mode).
- Editor: `packages/noodl-editor/tests/workflow/` — the definition⇄graph round trip (every step,
  edge, param and name), node id === step id, the acyclicity refusals, guid renaming, deterministic
  layout, and the catalog→node-type translation.
- **Backend suite: 65 suites / 683 passed.** Editor typecheck clean.

## What is left

Blocking the task's success criteria:

1. **Save round trip, live** — edit a step, Save, reopen, confirm the backend has it. The code path
   exists and the backend contract test covers the wire; the gesture has not been driven.
2. **Run &amp; pin, live** — §7's one continuous sequence, and the confirmation that WFA-002's
   overlay places badges on this canvas **without modification** (success criterion 3). The overlay
   needs nothing in theory — it resolves `step.nodeId` through `findNodeWithId` over the open graph,
   and the ids match by construction — but "in theory" is not what that criterion asks for.
3. **Re-verify the two fixes made after the last live run**: the `ModelProxy` hop in the predecessor
   picker, and the scope chips no longer offering pattern entries (`upstream.<stepId>`).
4. **The live pass on a workflow with all nine kinds, both themes, screenshotted**, and the hex
   literal check over the new files.
5. **Creation from the palette** — right-click an empty workflow canvas and add a step. The picker
   filtering is in place (`getCreateStatus` + the runtime type) but has not been driven.

## Open items to hand on

| # | Item |
|---|---|
| a | The Workflows panel re-reads backends when it **becomes active** or on Refresh. A backend started while the panel is already open needs a Refresh press — there is no backend-started event in the renderer today, so closing this properly means adding one. Same hazard family as WFA-002's F34. |
| b | `NavigationHistory` resolves its entries through `ProjectModel.getComponentWithName`, which cannot find a workflow, so workflows are deliberately kept **out** of canvas back/forward (`pushHistory: false`) rather than pushed and silently discarded. |
| c | `EditorDocument` remembers `selectedComponentName` and restores it through the same lookup, so "reopen the last thing I had open" does not restore a workflow. Guarded, so it no-ops rather than failing. |
| d | `for-each` draws as one node, per the spec's Out of Scope. Whether that reads clearly is the open question the live pass should answer. |
