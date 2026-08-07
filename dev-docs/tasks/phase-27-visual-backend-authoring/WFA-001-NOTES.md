# WFA-001 — Notes

**Task:** [WFA-001: Cloud functions, reconnected](./WFA-001-CLOUD-FUNCTIONS-RECONNECTED.md)
**Started:** 2026-07-27

This file records the decisions the spec asks the executor to take, the evidence behind each, and the
live pass at the end.

---

## Decision 1 — panel shape: **(b) surface the cloud sheet in the existing panel**

The spec offers (a) restore a Cloud Functions view, or (b) surface the cloud sheet in the existing
Components panel. **(b)**, with three qualifications that fell out of reading the code.

### Why (b)

- **(a) cannot satisfy the spec's own criterion.** Desired State §1 requires "no new rail icon that
  opens onto nothing". A registered sidebar panel gets a permanent rail slot; the overwhelming
  majority of projects have no cloud functions, so that slot would open onto an empty tree forever.
  Making the registration conditional on the project having a `#__cloud__` sheet is more machinery
  than the whole rest of this decision, and it would also mean the panel is invisible exactly when a
  user needs it — before they have made their first function.
- **What is left of the deleted panel is not worth a panel.** `git show 1a9557e0^:…CloudFunctionsPanel.tsx`
  is 72 lines, of which the two `PrimaryButton`s (`cloud-runtime-open-devtools`,
  `cloud-runtime-refresh`) target the port-8577 hidden-window server WF-007 deleted and the spec
  forbids restoring, and the `ActionButton` shows the active Parse *environment*, which WF-007 also
  retired. Strip those and the file is `<ComponentsPanel options={{lockToSheet: '__cloud__'}} />`.
- **The sheet mechanism already does this.** `SheetSelector` already renders a sheet list with
  per-sheet counts, an "All" entry and create/rename/delete actions; `useComponentsPanel` already
  filters the tree by the selected sheet. Cloud functions are already *a sheet*. Reuse-or-escalate
  says use it.
- Phase 19's "the editor gets exactly one backend-configuration surface" line points the same way.

### Qualification 1 — the cloud sheet is listed but **excluded from the "All" view**

Reading `buildTreeFromProject` turned up something the spec does not mention and that makes the naive
"just delete `hideSheets`" change wrong:

> When `currentSheet === null` ("All"), the tree **strips the sheet prefix** from every component's
> display path (`useComponentsPanel.ts:314-317`).

So under "All", `/#Pages/Home` is drawn at `/Home`. If cloud components were simply un-hidden,
`/#__cloud__/saveOrder` would be drawn at `/saveOrder` — flattened into the browser tree, sharing a
folder namespace with browser components of the same name, and offering "Create Visual Component"
inside what is actually a cloud folder.

Two components that run in **different runtimes** must not be merged into one flattened namespace, so:

- The cloud sheet appears in the sheet dropdown, always, labelled **"Cloud Functions"**.
- Its components appear in the tree **when that sheet is selected**, and only then.
- The "All" view is unchanged from today.

This is not a special case invented for convenience — `RuntimeType` (`NodeLibraryData.ts:1-6`) is
resolved from exactly this prefix, and `NodeGraphContext` already switches its active graph on it
(F21/F22). The sheet is a runtime boundary, and the tree now treats it as one.

### Qualification 2 — the sheet is **always listed**, even when the project has none

Sheets are derived from component names, so a project with no cloud functions has no `#__cloud__`
sheet and therefore no way to make the first one. `SheetSelector`'s "Add Sheet" rejects `#` in names,
and asking a user to type `__cloud__` is not a door.

The Cloud Functions entry is therefore synthesised when absent (count 0), exactly as the "Default"
sheet already is. Selecting it with nothing in it shows an empty state whose context menu offers the
cloud templates. It is protected: no rename, no delete (the `!sheet.isDefault` guard that already
hides those actions is extended).

The tree itself is untouched for a project with no cloud functions — no new folder, no placeholder
component. Only the dropdown gains an entry.

### Qualification 3 — creating into a sheet was already broken, and is fixed generally

`handleAddComponent(template, parentPath)` builds `componentName = parentPath + localName` from the
**display** path, which has had the sheet prefix stripped. Creating a component while the `#Pages`
sheet is selected therefore produces `/Home`, not `/#Pages/Home` — it silently lands in the default
sheet and vanishes from the view you created it in. (Root-level creation is worse: `finalParentPath`
is `''`, so the component is named `Home` with no leading `/` at all.)

Cloud function creation cannot work without fixing this, and the fix is the same line for every
sheet, so it is applied generally rather than special-cased to `__cloud__`. Recorded here because it
is a behaviour change outside the strict letter of the task.

---

## Decision 2 — one bundle per project, keyed by project directory

`WorkflowRunner` keys by file name (`<name>.workflow.json`) and `loadWorkflow` **replaces wholesale**
(`WorkflowRunner.ts:150`). One bundle per project:

- Matches how the runner reloads. Per-function bundles would multiply the reload surface for no gain,
  since a push is cheap and `GraphModel.addComponent` replaces by name.
- Makes **delete and rename fall out for free** (Desired State §3): a re-push without the component
  leaves `loadedWorkflows` without it, so `hasFunction()` returns false and `run()` 404s. No
  `deleteWorkflow` call is needed, and none is made.
- A backend can be shared by more than one project, so the key must be per-project. `ProjectModel.id`
  is **not** persisted (`toJSON()` at `projectmodel.ts:1307` omits it), so it is not stable across
  opens. The key is `<sanitised project name>-<8 hex of the project directory path>` — stable,
  filesystem-safe, and legible when you look in `<backend>/workflows/`.

### What a wholesale replace does *not* clean up

`GraphModel.addComponent` overwrites by name and never removes; `CloudRunner`'s runtime therefore
still holds the graph of a function deleted from the bundle. This is harmless because
`WorkflowRunner.run()` gates on `hasFunction()`, which reads `loadedWorkflows`, not the graph — but it
means a deleted function's nodes stay resident until the backend restarts or
`POST /admin/workflows/reload` is called. Recorded rather than fixed; it is a memory footprint, not a
behaviour.

---

## Decision 3 — push on save, on backend start, and on demand

- **On project save** (`ProjectModel.projectSavedToDisk`), to every running local backend, but only
  when the cloud export's hash has changed since the last successful push. Autosave fires ~1s after
  any model change, so unconditional pushing would be constant; hashing makes an edit to a browser
  component cost nothing.
- **On backend start**, which is finding F6: today a backend started from the panel reports
  `functions: []` regardless of what the project contains.
- **On demand**, from the Backend Services card, for the case where you want to force it.

On-save is chosen for feel, and the spec's objection to it — "a broken function silently replaces a
working one" — is answered by making the state visible rather than by making the push manual: the
local backend card lists the functions the backend currently has and when they were last pushed, and
a failed push raises a toast and shows on the card. Silence was the problem, not the automation.

**`projectIds` is dead.** `BackendManager.createBackend` initialises `projectIds: []` and nothing
ever writes to it, so "every running local backend for the project" is, in practice, every running
local backend. The push targets all of them and this is recorded rather than worked around.

---

## Decision 4 — the export door is `exportComponentsToJSON`, not `exportToJSON`

The spec's suggested snippet does not work:

```ts
Exporter.exportToJSON(project, { ignoreComponentFilter: (c) => c.name.startsWith('/#__cloud__/') })
```

`exportToJSON` requires the project's **root component** to survive the filter
(`utils/exporter/json.ts:80-83`):

```ts
if (!rootComponent || !allComponents.find((c) => c.name === rootComponent.name)) return;
```

The root component is a browser component, so the cloud-only filter removes it and the function
returns `undefined`. The frontend deployer's inverse filter works only because it keeps the root.

`exportComponentsToJSON(project, components, args)` takes an explicit component list, does not require
the root component to be in it, and emits exactly `{settings, components, componentIndex, metadata}` —
the shape proven live on 2026-07-27 and the shape `CloudRunner.load` consumes (it applies its own
`componentFilter: c => c.name.startsWith('/#__cloud__/')`, `index.ts:31`).

---

## Decision 5 — there was a **fifth cut**, and it was the one that actually blocked authoring

The spec's background table records "Cloud node types (`noodl.cloud.request` / `.response` /
`.sendemail` / `.aggregate`) — intact, registered". They are registered in `noodl-viewer-cloud`. They
were **not reaching the editor**, and running it is the only way that shows:

```
> window.NodeLibraryData.nodetypes.filter(n => n.name.startsWith('noodl.cloud'))
[]                                     // 150 node types, every one of them `browser`
```

A newly created cloud function drew the Request and Response nodes **from its own starter template**
as red dashed unknown types, and the node picker offered nothing that runs on a backend.

The editor does not bundle a node library. It learns node types from **connected viewer clients**
(`ViewerConnection.loadNodeLibrary(clientId, runtimeType, library)` → `NodeLibraryImporter`). Browser
types arrive from the preview window. Cloud types used to arrive from the hidden cloud-runtime window
on port 8577 — which WF-007 deleted. `NodeLibraryImporter.ts:187` even documents the consequence
("This used to wait for two clients … WF-007 removed the cloud sandbox") without noticing that the
cloud half never came back.

**Fix: generate the cloud library, ship it, register it as a client that never disconnects.**

- `scripts/cloud-node-library/generate.js` + `extractor-entry.js` register the real cloud node set the
  way `CloudRunner` does and export it with the runtime's own `nodelibraryexport` — the same
  headless-registry recipe as `scripts/node-catalog`, so it cannot drift into being a parallel
  hand-written description. Output: `models/nodelibrary/cloud-node-library.json`, 56 node types.
- `npm run cloud-library:generate` / `cloud-library:check`, the latter wired into `pr.yml` beside
  `catalog:check`. Deterministic (two runs compared byte-for-byte before writing).
- `NodeLibraryImporter.onClientImport` merges it under a synthetic client id **after** the first real
  client, so the browser client still establishes the library and this only ever adds.

Generated rather than served (the phase's "served, not generated" decision is about *workflow step
kinds*, and is about not lying about a backend you are targeting). You author a cloud function before
you ever start a backend; an empty palette until then would be a worse lie.

Two smaller things fell out: `mergeUpdates` threw on a library with no `projectsettings` block (the
cloud runtime has none), and the picker already filters by `runtimeTypes`
(`createnodeindex.ts:28`), so browser graphs are unaffected — confirmed live.

## Live pass

Driven with the `run-editor` skill against the `test` project, 2026-07-27/28. Screenshots in the
session scratchpad; the states they show are described inline below.

### What was driven as real user gestures

Sheet dropdown → **Cloud Functions (0)** → empty state → right-click → **Create Cloud Function
Component** → name → the function opens on canvas → right-click canvas → node picker → search →
**Create New Record** placed. Then Backend Services → **Start backend**, and **Deploy functions**.

### What was driven through the model API, and why

The three wires and the node parameters (`collectionName`, `properties`, `prop-note`, `allowNoAuth`,
Response `params`) were set through `NodeGraphModel.addConnection` / `NodeGraphNode.setParameter` —
the same calls a port drag and the property editor make. Port-drag geometry is not reliably
scriptable over CDP. Everything after the graph exists — autosave → change hash → push → backend
load → HTTP call → record — is the real path, and that is what this task is about.

### The loop, end to end

| Stage | Result |
|---|---|
| Cloud sheet listed with count, protected from rename/delete | ✅ `Cloud Functions (0)` in the dropdown of a project with none |
| Create menu offers cloud templates on the cloud sheet only | ✅ Logic Component + Cloud Function Component; browser menus unchanged |
| Component created into `/#__cloud__/` | ✅ `/#__cloud__/saveOrder`, cloud icon in the trail |
| Canvas in cloud mode | ✅ `__nodeGraphEditor.runtimeType === 'cloud'` |
| Picker offers cloud nodes | ✅ 56 nodes, a **Cloud Functions** category; Create New Record placed |
| Backend start pushes the project's functions (**F6**) | ✅ `GET /admin/workflows` → `functions: [{name: 'saveOrder'}]` |
| Card shows what the backend has | ✅ "Cloud functions · pushed just now · ✓ saveOrder" |
| `POST /functions/saveOrder` runs the canvas graph | ✅ `200 {"result":{}}` |
| The record appears in the Data browser | ✅ `Orders` → `note: "created by saveOrder"` |
| Deleting the component removes the function | ✅ next call `404 Function 'saveOrder' not found` |
| A project with no cloud functions is unchanged | ✅ card section absent, tree unchanged |

Before `allowNoAuth` was set, the call returned `{"error":"Unauthenticated requests not accepted."}` —
BAK-003's default working through a graph authored on the canvas.

### Two defects the live pass found, both fixed

**1. Cloud functions could not be exported from a project with no Home component.**
Both frontend exporters begin `const root = projectModel.getRootNode(); if (!root) return;`
(`json.ts:29`, `:76`). The `test` project has never had a Home, so `exportCloudFunctionsToJSON`
returned nothing, the deployer read that as "no cloud functions", and the backend came up with
`functions: []` — the exact silence this task exists to remove. A cloud function has no visual root
and does not need one. The bundle is now assembled from `exportComponent` + `exportSettings`
directly. Regression spec: *"exports functions from a project with no Home component"*.

The deployer had the matching hole — `null` meant both "no functions" and "export failed". It now
distinguishes them and raises the failure.

**2. Hot-deploying a bundle crashed the backend service (`exit code 1`), mid-push.**

```
Error: Duplicate component name /#__cloud__/saveOrder
    at NodeContext.registerComponentModel
    at GraphModel.addComponent
```

`cloudRunner.load()` re-imports components that are already in the runtime — and they always are,
because the backend loads the bundle from disk at start. `NoodlRuntime.setData`'s own comment names
this case. The throw escapes the awaited call (it comes out of a scheduled update), so a `try`/`catch`
around the load does not contain it and the process dies, taking every other function with it.

`WorkflowRunner.loadWorkflow` now builds a **candidate `CloudRunner`** from the other bundles plus the
new one, and only swaps it in — and only then writes the file — if the whole set loads. That fixes the
crash and, in the same move, the half-replace the spec's Desired State §4 asked about: the original
wrote the file and updated `loadedWorkflows` *before* loading anything, so a rejected bundle still
became the advertised state and was read back on restart. A failed push now leaves the previous
function serving and the previous file on disk.

**This endpoint has never had a caller.** `backend:update-workflow` shipped in WF-004 and finding F4
records it as callerless; WFA-001 is the first thing to call it, and it did not work.

### Also found, not fixed here

- **`StringInputPopup` renders every name prompt as an 8-line code editor** with a line-number gutter
  and the placeholder `// Add your comment here...` — including "New component name". It is a faithful
  port of a legacy *comment* template (`views/PopupLayer/StringInputPopup.tsx:62`) reused by every
  call site: component creation, component ports, `PropListType`, `StringListType`. Pre-existing and
  shared, so out of WFA-001's scope, but it is the first thing a user sees when creating their first
  cloud function. Filed in PROGRESS.md as F26.
- The Response node's `id → id` connection did not survive the export (2 of 3 connections in the
  bundle). The dynamic port exists in the editor but is not in the exported `ports` array, so the
  runtime never created the input. It did not affect the acceptance run — the record is written by the
  `created → send` path — but a value returned through a Response parameter is a normal thing to want.
  Filed as F27.

### Gates

`test:ci` **1667 specs, 0 failures** (seed 43532) · `catalog:check` clean · `cloud-library:check`
clean · `check:artefacts` clean · `lint:ci` 840 errors vs 3916 baseline · backend `tests/workflow`
**94 passed** · `typecheck` clean for editor, editor-tests and backend.
