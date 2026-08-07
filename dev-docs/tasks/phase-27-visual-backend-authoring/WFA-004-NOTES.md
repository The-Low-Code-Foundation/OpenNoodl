# WFA-004 — Notes

**Status:** ✅ Complete. Every success criterion was driven in the running editor and
screenshotted; the live pass found and fixed one shipped defect (F49).
**Spec:** [WFA-004-WORKFLOW-CANVAS.md](./WFA-004-WORKFLOW-CANVAS.md) ·
**Assessment / §1 decision:** [WFA-004-ASSESSMENT.md](./WFA-004-ASSESSMENT.md)

**Commits**

| Commit | What |
|---|---|
| (assessment) | The §1 decision, written before any canvas code |
| `b0a021b8` | A workflow is a document; step kinds are node types |
| `638ebb36` | A real workflow renders on the existing canvas |
| `632afcd9` | Edit a condition without touching JSON |
| (this) | The live pass, and the `switch` step that could not open (F49) |

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
simply said "nothing runs before this step" on a step that had three. Found live, fixed, and
**re-verified live**: selecting Order Pipeline's `decide` step now offers *Receive order*.

### One `switch` step made a whole workflow fail to open (F49)

The defect the live pass existed to find, and it was invisible to a green suite.

`buildGraph` called `node.setDynamicPorts(...)` **before** `graph.addRoot(node)`. `setDynamicPorts`
broadcasts `Model.instancePortsChanged`, and `ViewerConnection`'s handler for it opens with
`if (!e.model.owner.owner)` — a guard whose own comment describes "the node isn't assigned to a
component yet" but which is written one level too shallow. A node with no *graph* threw a
`TypeError` out of the listener, through `notifyListeners`, out of `buildGraph`, and out of
`WorkflowDocument.open` — so a workflow containing a single `switch` step opened as nothing at all.
The Workflows panel's `guard` caught the rejection but the message never rendered, which is a second
small thing worth knowing: a click that appears to do nothing is what a thrown-and-caught open looks
like.

Two fixes, because there were two faults:

- **The listener** now guards both levels (`!e.model.owner || !e.model.owner.owner`), the way every
  sibling handler in that file already does — and it gained the `isWorkflowModelEvent` filter it was
  missing, so a `switch` step's dynamic ports no longer reach the viewer naming a component it has
  never heard of. F44 closed six of these handlers and missed the seventh.
- **`buildGraph`** adds the step to the graph *before* it announces its ports. That ordering is
  load-bearing rather than tidy: every listener of a global model event identifies what the event is
  about by walking `owner`, so an unowned node is both a crash risk in a listener that does not
  expect one and **invisible to the workflow filter** — the guard could not have fired.

**Why the suite could not have caught it:** `workflowdocument.test.ts` already built a `switch` step
and passed, because no `ViewerConnection` is constructed in the editor specs, so nothing was
listening. The new spec therefore asserts the *invariant* — every `Model.instancePortsChanged` a
workflow emits carries a node that has an owner — rather than re-testing one listener.

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
- **Backend suite: 65 suites / 683 passed. Editor suite: 1767 specs / 0 failures.** Editor typecheck
  clean. The editor suite gained the `instancePortsChanged` ownership invariant above.

## The live pass

Driven in the running editor over CDP, from the launcher each time, against a real backend on
`:8578`. Fixture: `WFA-004-nine-kinds.workflow.json` in this folder — one workflow with all nine
kinds, authored over the admin API (which is itself the second success criterion), left on the local
backend as *All Nine Kinds*.

| Criterion | Evidence |
|---|---|
| §1 decision recorded before canvas code | [the assessment](./WFA-004-ASSESSMENT.md), dated before `b0a021b8` |
| An admin-API workflow renders, routes labelled, error path distinct | Order Pipeline and All Nine Kinds both open on the existing canvas; `ontrue`/`onfalse`/`empty`/`nonempty`/`done`/`skipped`/`paid`/`refunded`/`default` drawn on the wires; `onError` red **and** dashed |
| Node ids are step ids; the overlay works **unmodified** | `getNodeBounds` answered for all six Order Pipeline step ids, and every pinned badge sat at `node.x + node.width + 3` — i.e. each badge on its own step's card, with no change to `ExecutionOverlay` |
| Created from scratch on the canvas, and runs | *From Scratch* built by hand (New → palette → delete the template step → set `duration`), saved, then `Run & pin` → overlay header **success**, `✓ 28 ms` on the step, timeline `Step 1 / 1` |
| A condition edited without touching JSON | `total gt 100` → `250` through the three controls, saved, reopened, confirmed on the backend |
| `$path` from a picker over reachable predecessors | `decide` offers `body`, `trigger`, `headers`, `query`, `previous` and the concrete step **Receive order** — no pattern entries |
| A cycle prevented at author time | `tally.next → receive.in` refused live: *"That would make a loop…"*; a self-edge refused; a legitimate downstream edge allowed |
| Layout readable with no stored positions; adding a step disturbs nothing | All Nine Kinds arrived with no `ui` and laid out as a readable DAG row; the two saves wrote `ui` per step and a reopen reproduced the arrangement |
| No backend, no lies | With the backend stopped the panel reads *"Start a backend to author workflows"* and explains that a workflow lives in a backend's data directory |
| Run-and-pin as one gesture | One button: saves if dirty, runs, reads the record back, emits `execution:pinToCanvas` |
| Both themes, tokens only | Screenshotted light and dark; the canvas repainted through `nodegx:themechanged`. Hex-literal check over the 17 new files: **zero**. The only hex in touched code is `CanvasTheme`'s `fallback:` for the new `logic` token — that file's own convention for all 32 tokens, and `--theme-color-node-category-logic` is defined for both themes in `colors.css` |
| `WORKFLOW-NODES.md` describes what exists | F10 closed; the coverage gate fails if it names a missing surface again |

**A saved definition cannot break a backend, demonstrated rather than argued.** The from-scratch
workflow's first save was *refused* — `step "wait".params.duration must be a number > 0`, the
backend validator's own message shown verbatim in the panel — because the palette-inserted step had
no duration yet. That is the spec's boot-refusal trap closed at the only place it can be: nothing is
written locally first, so a refused save leaves the backend exactly as it was.

### The open question the spec asked: does `for-each` read as one node?

**Yes, and the reason is the sub-label.** The card measures 150 × 120, is titled *Each order line*,
and its second line reads **`For Each · chargeLine`** — the per-item function named on the card
itself, beside two route ports (`empty`, `nonempty`). Nothing about it suggests a container you could
descend into, so the n8n expectation is not set up and then broken; what it says is "this step calls
`chargeLine` once per item", which is exactly what it does. Descending into `chargeLine` is WFA-006,
and the card already names the thing WFA-006 will open.

## Open items to hand on

| # | Item |
|---|---|
| a | **F47, and a call for Richard.** The Workflows panel re-reads backends when it becomes active or on Refresh. A backend started while the panel is already open needs a Refresh press, because there is no backend-started event in the renderer. Closing it properly means adding one — and it would close WFA-002's F34 and the Triggers panel at the same time, which is the argument for doing it once rather than three times. Left as a residual beside F34 pending that call. |
| b | `NavigationHistory` resolves its entries through `ProjectModel.getComponentWithName`, which cannot find a workflow, so workflows are deliberately kept **out** of canvas back/forward (`pushHistory: false`) rather than pushed and silently discarded. |
| c | `EditorDocument` remembers `selectedComponentName` and restores it through the same lookup, so "reopen the last thing I had open" does not restore a workflow. Guarded, so it no-ops rather than failing. |
| d | The node picker's count says *9 nodes* while also listing `Comment` under **Other** — `Comment` is a canvas annotation available on every graph and is not counted as a node type. Pre-existing picker behaviour, not workflow-specific; noted because a nine-kind workflow is the first graph where "9" and "10 cards" sit next to each other. |

## Driving notes for the next executor

Two hours of this task went to the harness rather than the code. What actually works:

- **`--target=dashboard` is not a real target.** `cdp.js` has no such name, so it silently falls back
  to *the first page in `/json/list`* — which is the editor only until an About window or a detached
  preview exists. Use `--target=/src/editor/index.html`.
- **Do not click the sidebar rail by index.** It is icon-only, clicking the *active* icon collapses
  the panel and re-renders the rail, and index 0 is `BrandExit` — which leaves the project. Call
  `SidebarModel.instance.switch('<panel id>')` instead. Reach it from CDP by pushing a probe chunk
  onto `webpackChunknoodl_editor` to capture `__webpack_require__`, then reading `R.c` by module path;
  `scripts` for this are worth keeping.
- **A hidden panel's elements have a zero-sized box**, and `cdp.js click` then aims somewhere else
  entirely. Check `getBoundingClientRect().width > 0` before every click.
- **The canvas is Canvas2D**, so there is nothing to select. Screen position is
  `topLeftCanvasPos + (getNodeBounds(id) + pan) * scale`; dispatch `Input.dispatchMouseEvent` at that
  point. `centerToFit` centres but does **not** zoom out, and `setPanAndScale` needs a `repaint()`.
- **A card only grows a port row for a port that is already connected**, so a new node shows no
  ports: hover its right edge to raise the connection dot, then drag to the target to open the
  existing two-step ConnectionBar.
- The editor process was SIGTERMed repeatedly mid-session (renderer *and* GPU, `exit_code=15`, with
  the quit handshake's "Timed out waiting for the renderer to flush" in the log). Launch it with the
  Bash sandbox disabled and do each check in **one** script rather than across several calls.
