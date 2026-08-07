# WFA-004 — Assessment and the §1 decision

**Written:** 2026-07-28, before any canvas code, as Implementation Step 1 requires.
**Task:** [WFA-004-WORKFLOW-CANVAS.md](./WFA-004-WORKFLOW-CANVAS.md)
**Outcome:** *reuse* — no new surface is required. The escalate branch of the README's
reuse-or-escalate rule is **not** taken, and the walk below is the evidence.

---

## 1. The decision

> **Is a workflow a component with a third `RuntimeType`, or its own document type?**

**A workflow is its own document type. It is rendered by the existing canvas through a
component-shaped adapter, and a third `RuntimeType` is added — but for the *node library*, not for
the *document*.**

The question conflates two things that turn out to have different answers, and separating them is
the whole decision:

| Question | Answer | Why |
|---|---|---|
| Is a workflow **definition** a project component? | **No.** Own document type. | It is not in the project, not in git, not in an export, not deployed, has no ports and cannot be instantiated. |
| Are workflow **step kinds** node types with a runtime type? | **Yes.** `RuntimeType.Workflow`. | That is exactly what `RuntimeType` is for: it filters which node types the picker offers for the graph you have open. |

### 1a. Why not a project component

`ComponentModel` carries four implications, and a workflow satisfies none of them:

- **It is a type.** `NodeLibrary.getComponents()` returns every project component as an
  instantiable node type; `ComponentModel.getPorts()` derives ports from `haveComponentPorts`
  nodes. A workflow has no ports and must never appear in a node picker as something you can drop
  onto a graph.
- **It lives in the project file.** `ProjectModel` owns components and writes them to
  `project.json`. Workflow definitions live in the **backend's** data directory at
  `<dataDir>/workflow-defs/<id>.workflow-def.json` and are reached over the admin API.
- **It travels through version control.** A component is a diffable project artefact; the
  SUB-007 merge driver knows how to merge one. A workflow does not travel at all.
- **It is exported and deployed.** `exportToJSON` walks the project's components. A workflow is
  not in the artifact and is not deployed with the app.

Registering a workflow as a `ComponentModel` on `ProjectModel` would imply all four falsely, and
the failure mode is not cosmetic: it would be written into `project.json` on the next save, land in
git, and be deployed as a component that no runtime can instantiate.

### 1b. Why the canvas still sees a `ComponentModel`

There is exactly one canvas (`NodeGraphContext` constructs a single `NodeGraphEditor`) and exactly
one door into it: `switchToComponent(component: ComponentModel)`, which binds `component.graph`.
Building a second canvas is forbidden by the phase's reuse decision and is this codebase's
documented failure mode.

So the adapter: **`WorkflowComponentModel extends ComponentModel`**, constructed by the document,
deliberately **never** handed to `ProjectModel.addComponent`. Its `owner` stays `undefined`, which
is a state the codebase already handles — `NodeGraphModel.evaluateHealth`, `updateTypes` and
`updateVariantRefs` all bail on `!this.owner.owner`, and `ViewerConnection` filters
`Model.nodeAdded` on `e.model.owner.owner !== ProjectModel.instance`. A detached component is not a
new concept here; it is the shape a component has *before* it is added to a project.

The document type proper is **`WorkflowDocument`**: it owns the `WorkflowDefinition`, the backend
it belongs to, the dirty flag, save/validate against the admin API, and the adapter. Nothing
outside it knows the canvas is looking at a `ComponentModel` subclass.

The adapter's name is `/#__workflow__/<workflowId>`, echoing the existing `/#__cloud__/` sheet
prefix so `getComponentModelRuntimeType` resolves the runtime type by prefix exactly as it already
does for cloud (F21's seam, extended rather than bypassed).

### 1c. The three questions §1 requires the record to answer

**Where do workflows appear in the UI?**
Not in the Components panel tree — they are not project components, and WFA-001 already established
that flattening two *runtimes* into one tree namespace is a bug, not a feature. They appear in the
**backend-facing panel that already lists them**: WFA-002's Execution History panel fetches
`backend:list-workflow-defs` per running backend today. Workflows get their own list surface beside
it (same IPC, same per-backend grouping), and opening one switches the canvas. The canvas title
names the backend it came from at all times, because "which backend am I editing?" is a question
this document type has and a project component does not.

**What happens on `git clone`?**
Nothing arrives. A cloned project has no workflows, because workflows were never in it. What you
see depends entirely on which backend you point the editor at. With no backend running the list is
empty and says *start a backend to see its workflows* — the same honesty §6 requires of the palette.
This is a real difference from cloud functions (WFA-001), which **are** project components and do
travel; the two tiers are not symmetric and the UI must not imply they are.

**What happens on deploy?**
A deployed app does not carry its workflows. Phase 26 (DEP-002/DEP-005) deploys the project
artifact; workflow definitions are backend state, created against a target backend's admin API.
WFA-004 does not solve this and does not pretend to: the workflow canvas always names its backend,
and the docs written in Step 9 state plainly what does and does not travel with a deploy. The
missing piece — "promote these workflows to the production backend" — is a phase-26 conversation,
not something to fake here with an export button that writes a file nothing reads.

### 1d. What the third `RuntimeType` is for

`RuntimeType.Workflow = 'workflow'` is added to the enum and the `RuntimeTypes` array. It does one
job: `createNodeIndex` filters the picker on `nodeType.runtimeTypes.includes(runtimeType)`, and
`NodeGraphEditor.switchToComponent` sets `this.runtimeType` from the component. With the third
value the workflow canvas's picker offers the nine step kinds and nothing else, and a browser or
cloud canvas never offers a step kind — with no new filtering code anywhere.

Checked, not assumed: adding a third member to `RuntimeTypes` is safe for
`ClientCollection.getNodeNames()`. Its `taken.size !== RuntimeTypes.length` branch already fires
today whenever only the browser client has reported, and a runtime with no cached library is
skipped. No workflow client connected means no workflow node types, which is the correct answer.

---

## 2. The canvas walk — the extension points this task uses

Every row is a seam that already exists. Nothing in this table is a new surface.

| # | What WFA-004 needs | The existing seam | Change required |
|---|---|---|---|
| 1 | A graph the canvas will render | `NodeGraphEditor.switchToComponent(ComponentModel)` → `bindModel(component.graph)` | none — call it with the adapter |
| 2 | Step kinds in the picker | `NodeLibraryImporter.onClientImport(clientId, runtimeType, library)`; picker reads `library.nodeIndex.coreNodes` and filters on `runtimeTypes` | none — import a library built from the **served** catalog under a workflow client id, the way WFA-001 imports the cloud one |
| 3 | Node id = step id | `NodeGraphModel.nodeMap` is a `Map<string, NodeGraphNode>`; ids are opaque strings | none |
| 4 | Overlay lands on the right node | `OverlayViews.getNodeBounds` → `editor.findNodeWithId(nodeId)` → `HitTester.findNodeWithId(this.roots, id)` | none, **if** (3) holds |
| 5 | Node label + subtitle | painter draws `node.model.label`, and `typeDisplayName()` as a sub-label when they differ | none — set `label` = step name/id |
| 6 | "Show the function it invokes" | `typeDisplayName()` returns `node.model.metadata?.typeLabelOverride \|\| type.displayName` | none — set `typeLabelOverride` to `Retry · chargeCard` |
| 7 | Params as editable fields | `Ports.viewClassForPort` dispatches on the port **type name**; `TypeView` subclasses are the row implementations | **add two type views** (`workflow-condition`, `workflow-path`) beside the 30 that exist. This is the registry's intended extension, not a fork |
| 8 | Route outputs / error output | ports with `plug: 'output'`, painted as named rows with a dot/arrow | none |
| 9 | `switch`'s dynamic routes | `NodeGraphNode.setDynamicPorts(ports)` — per-node, persisted, cache-invalidating | none to the mechanism; the editor drives it instead of the viewer |
| 10 | Author-time acyclicity | `NodeGraphModel.getConnectionStatus({...}) → {connectable, message}`, consulted by `ConnectionBar` before offering a port | **override in a `WorkflowGraphModel extends NodeGraphModel`** — the method exists to be answered differently |
| 11 | Colour by category, theme-aware | `CanvasTheme.categoryColors(name)` keyed off `type.color`; repaint on `nodegx:themechanged` | add the workflow categories to `CanvasTheme`'s token map (UIX-005's own extension point) |
| 12 | `onError` wire in the danger token | `NodeGraphEditorConnection.paint` reads `CanvasTheme.connectionColors(fromPort.type)` | give the error port its own **port type name** and add one entry to the theme map |
| 13 | Run + pin | `EventDispatcher` `execution:pinToCanvas`, already emitted by `ExecutionDetail`; `backend:run-workflow-def` IPC exists (WFA-002) | none |

### The two shared-file changes, named honestly

Two requirements have no existing seam and need a small edit to a shared painter. Both are written
as *type-driven* rules rather than workflow special-cases, so nothing in the canvas learns the word
"workflow":

- **Route labels on the wire.** Nothing paints text on a connection today. `paint()` gains: when
  the source port's type declares `connectionLabel`, draw the port's display name at the curve
  midpoint. Needed because **plugs are built only from existing connections**
  (`NodeGraphEditorNode.measure`, line 403) — an unwired `onfalse` route does not render on the
  card at all, so the wire is the only place the route name can appear.
- **A different line treatment for the error edge.** `paint()` already branches on
  `model.annotation` to dash a deleted wire (AIX-003). The error port type gets the same treatment
  — dashed, so the distinction survives greyscale and colourblindness, per §3.

### What the walk found that the spec did not say

- **`ComponentModel.getCreateStatus` is what the picker filters on**, via
  `createNodeIndex`'s `model.owner.getCreateStatus(...)`. The adapter overrides it, which is how
  "you cannot put a Text node in a workflow" is expressed without touching the picker.
- **`NavigationHistory` resolves back/forward entries through
  `ProjectModel.instance.getComponentWithName(name)`** and drops anything it cannot find. A
  workflow pushed into that history would be silently discarded. Handled by resolving through the
  open-workflow registry as a fallback; if that proves awkward, workflows stay out of the history
  and it is recorded rather than left to fail quietly.
- **`Model.parametersChanged` reaches `ViewerConnection` with a weaker guard than
  `Model.nodeAdded`** — it checks only `e.model.owner?.owner`, which a detached component satisfies.
  Editing a step param would send a `parameterChanged` naming a component the viewer has never
  heard of. Needs the same `!== ProjectModel.instance` guard the sibling handler already has.

---

## 3. The layout-persistence decision (§5), taken here because it is the same argument

**Positions persist alongside the definition, on the backend, as an optional `ui: { x, y }` on each
step.**

The spec frames this as *travels with the workflow but pollutes a deployable artifact* versus
*clean artifact, lost on another machine*. For a project component the second option is nearly free,
because the layout is in `project.json` and `project.json` is in git. **For a workflow it is not
free at all**: the definition is the *only* artefact, there is no repo carrying it, and editor-local
storage means every collaborator — and the same user on a second machine — sees a workflow that has
never been arranged. That is a much larger loss than the pollution it avoids.

The pollution is also smaller than it looks:

- `WorkflowRegistry.upsert` rebuilds the definition from a field whitelist but passes `steps`
  through verbatim, so a per-step key survives a round trip. A *workflow-level* key would be
  dropped — which is why this is per-step, and why relying on that accident silently is worse than
  declaring it.
- `ui` is added to `WorkflowStep` explicitly, documented as editor-owned and ignored by the engine,
  and given a write-time shape check so a garbage value is a 400 rather than something persisted.

**Checked against the boot-refusal trap:** definitions are validated on load and an invalid file
refuses to start the backend, so a *new* validation rule is exactly the change that can stop an
existing backend booting. This one cannot: `ui` is optional, no definition in existence has it, and
an absent key is not checked. Same reasoning WFA-003 applied to its two new 400s, and it is stated
here rather than assumed.

Auto-layout stays deterministic (DAG layering from `entry`), so a workflow with no `ui` is readable
rather than random, and a re-open before anything has been dragged produces the same picture.

---

## 4. Order of work

1. IPC + a renderer-side backend client for the step-kind catalog and workflow-def CRUD.
2. Served catalog → node library, registered as a `RuntimeType.Workflow` client.
3. `WorkflowDocument` / `WorkflowComponentModel` / `WorkflowGraphModel`; definition ⇄ graph.
4. **Read-only render** of the phase-19 test workflow — the checkpoint that proves this assessment.
5. Overlay over it, unmodified.
6. Palette and creation; connections with labels and author-time acyclicity.
7. Property editor, condition control first.
8. Layout; run-and-pin; docs; live pass.
