# WFA-001: Cloud Functions, Reconnected

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WFA-001 |
| **Phase** | Phase 27 — Visual Backend Authoring (Track L) |
| **Tier** | 1 — reconnect |
| **Priority** | 🔴 Critical (this is a regression against old Noodl; without it nothing in phases 19 and 22 is reachable) |
| **Difficulty** | 🟡 Medium — three of the four cuts are one-liners; the deploy wire is the real work |
| **Estimated Time** | ~1 week |
| **Prerequisites** | none |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🔵 **Opus 5** — small diffs in three subsystems plus one genuinely new path, and the failure mode (a stale function silently serving on a running backend) is quiet |

## Objective

Make it possible to create a cloud function on the canvas, see it in the components tree, and have it
run on the local backend — restoring the authoring loop old Noodl had, on top of the `nodegx-backend`
service phases 19 and 22 built.

## Background

Cloud function *editing* was never removed. The canvas draws these graphs, the cloud node types are
registered, and everything that consumes them still exists:

| Piece | Where | State |
|---|---|---|
| `Cloud Function Component` template (Request + Response on a fresh canvas) | [`ComponentTemplates.ts:135`](../../../packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/ComponentTemplates.ts#L135) | intact, never offered |
| Cloud node types (`noodl.cloud.request` / `.response` / `.sendemail` / `.aggregate`) | `noodl-viewer-cloud/src/nodes/` | intact, registered |
| Record/user/config nodes usable inside a function | `noodl-runtime/src/nodes/std-library/data/` | intact |
| `cloudfunction` component kind, its icon and its label | [`componentKind.ts:56,59,76,90`](../../../packages/noodl-editor/src/editor/src/views/panels/ComponentsPanelNew/componentKind.ts#L56) | intact |
| `CloudFunctionAdapter` (renames keep callers in sync) | `models/NodeTypeAdapters/CloudFunctionAdapter.ts` | intact |
| Drag a cloud component onto a browser graph → a caller node | `views/nodegrapheditor.drag.ts:118` | intact |
| Property editor's cloud-function special case | `views/panels/propertyeditor/propertyeditor.ts:317` | intact |
| The trail's cloud-sheet handling | `NodeGraphComponentTrail.tsx:223` | intact |

What is missing is **four cuts**, three of them accidental. See findings F1–F6 in
[PROGRESS.md](./PROGRESS.md); the short version:

1. `hideSheets: ['__cloud__']` on the one Components panel ([`router.setup.ts:79`](../../../packages/noodl-editor/src/editor/src/router.setup.ts#L79)).
2. The panel that used to show that sheet was deleted by WF-007 (`1a9557e0`).
3. All three create menus pass `forRuntimeType: 'browser'`.
4. Nothing has ever called `backend:update-workflow`, so functions never reach a backend.

The deleted panel is recoverable and worth reading first — it is 72 lines and shows the intended
shape:

```bash
git show 1a9557e0^:packages/noodl-editor/src/editor/src/views/panels/CloudFunctionsPanel/CloudFunctionsPanel.tsx
```

Its `ComponentsPanel` options were `{ showSheetList: false, lockCurrentSheetName: '__cloud__',
componentTitle: 'Cloud Components' }`. Its two buttons (`cloud-runtime-open-devtools`,
`cloud-runtime-refresh`) targeted the port-8577 hidden-window server that WF-007 correctly deleted;
**do not restore those** — the equivalent today is the backend's own logs and
`POST /admin/workflows/reload`.

### How functions actually reach a backend

Proven live on 2026-07-27. `nodegx-backend` loads `*.workflow.json` from `<dataDir>/workflows/` at
start ([`WorkflowRunner.ts:132`](../../../packages/nodegx-backend/src/workflow/WorkflowRunner.ts#L132))
and exposes a hot-deploy path for a single bundle
([`WorkflowRunner.ts:150`](../../../packages/nodegx-backend/src/workflow/WorkflowRunner.ts#L150),
"Save + (re)load a single workflow (hot deploy from the editor)"). The file is a project export
containing only cloud components:

```jsonc
{
  "components": [
    { "name": "/#__cloud__/saveOrder", "nodes": [ … ], "connections": [ … ], "roots": [] }
  ],
  "settings": {},
  "metadata": {}
}
```

A hand-written bundle in that shape loaded, appeared in `GET /health` under
`workflows.functions`, and answered `POST /functions/saveOrder` with real records written to the
database. The editor side already exists too: `BackendManager.updateWorkflow(backendId, name,
workflow)` at [`BackendManager.js:847`](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js#L847),
reachable over `backend:update-workflow`. It has **no caller**.

So this task is not inventing a protocol. It is calling one function that already works, with an
export that the exporter can already produce.

## Current State

| File | What it does today |
|---|---|
| `router.setup.ts:64-82` | Registers the one Components panel, with `hideSheets: ['__cloud__']` |
| `useComponentsPanel.ts:150` | Filters the **sheet list** by `hideSheets` |
| `useComponentsPanel.ts:294` | Filters the **tree** by `hideSheets` |
| `ComponentsPanelReact.tsx:202` | Right-click empty space → templates, `forRuntimeType: 'browser'` |
| `FolderItem.tsx:176` | Right-click a folder → same |
| `ComponentItem.tsx:178` | Right-click a component → same |
| `ComponentTemplates.ts:257` | `getTemplates({forParentType, forRuntimeType})` — the filter |
| `build/deployer.ts:70-75` | `exportToJSON(..., ignoreComponentFilter: c => !c.name.startsWith('/#__cloud__/'))` — strips cloud components from the **frontend** deploy |
| `utils/exporter/json.ts:64` | `exportToJSON` — takes `ignoreComponentFilter`; the inverse filter is what this task needs |
| `BackendManager.js:120,847` | `backend:update-workflow` IPC + implementation, zero callers |
| `BackendManager.js:123` | `backend:reload-workflows` |

## Desired State

### 1. Cloud functions are visible and creatable

The cloud sheet is reachable again. **Either** approach is acceptable and the executor picks one with
a recorded reason:

- **(a) Restore a Cloud Functions view** — closest to what was deleted, and to old Noodl. It keeps the
  browser components tree uncluttered for users who never write a function.
- **(b) Surface the cloud sheet in the existing panel** — one panel rather than two, consistent with
  phase 19's "the editor gets exactly one backend-configuration surface" line, and cheaper.

Whichever is chosen, all of the following must hold:

- A cloud function component can be **created** from a context menu, producing the Request + Response
  starter graph the existing template defines.
- A cloud function component is **visible** in a tree, with its existing `cloudfunction` icon and
  "Cloud function" label from `componentKind.ts`.
- Opening one puts the canvas in the cloud runtime context, so the node picker offers cloud-legal
  nodes — confirm this by *placing* a Create New Record node, not by reading `NodeGraphContext`.
- The browser-side experience is unchanged for a project with no cloud functions. No new empty folder,
  no new rail icon that opens onto nothing.

The three `forRuntimeType: 'browser'` call sites must offer cloud templates **when the context is the
cloud sheet**, and must keep offering only browser templates elsewhere. A create menu that offers
"Cloud Function Component" inside a browser folder would produce a component in the wrong sheet.

### 2. Functions reach the running backend

A cloud-only export is produced and pushed to every running local backend for the project:

```ts
const cloudExport = Exporter.exportToJSON(project, {
  useBundles: false,
  ignoreComponentFilter: (c) => c.name.startsWith('/#__cloud__/')   // the inverse of the deployer's
});
await ipcRenderer.invoke('backend:update-workflow', { backendId, name, workflow: cloudExport });
```

Decisions this task must take and record:

- **When does it push?** On save, on backend start, or on an explicit "Deploy functions" action. This
  is an open question in PROGRESS.md. On-save has the best feel and the worst failure mode — a
  function with a broken graph silently replacing a working one on a running backend. Whatever is
  chosen, **the UI must show the state**: which functions the backend currently has, and when they
  were last pushed. `GET /health` already returns `workflows.functions[{name, workflow}]`, and
  `backend:workflow-status` already proxies it.
- **What is the bundle called?** `WorkflowRunner` keys by file name (`<name>.workflow.json`) and
  replaces wholesale. One bundle per project is simplest and matches how the runner reloads; per
  function would allow finer updates but multiplies the reload surface. Pick one, state why.
- **What happens on backend start?** A backend that starts after the editor has the project open must
  end up with the project's functions, not an empty function list. Today it reports
  `functions: []` (F6).

### 3. Deleting and renaming behave

- Deleting a cloud function component removes it from the backend, not just from the project.
  `WorkflowRunner.deleteWorkflow` exists; if the whole-bundle approach is taken, a re-push with the
  component absent achieves the same thing — say which.
- Renaming is already handled inside the project by `CloudFunctionAdapter`; confirm the pushed bundle
  reflects the new name and the old function stops answering.

### 4. The failure path is visible

A function whose graph is broken must fail **at push time with a message in the editor**, not at 3am
with a 503. `WorkflowRunner.loadWorkflow` already returns `{success, error}`; surface it. A push that
fails must leave the previously-working function in place rather than half-replacing it — confirm
which of those the runner actually does and record it.

## Implementation Steps

1. **Read the deleted panel** (`git show 1a9557e0^:…`) and decide (a) or (b). Record the choice and
   the reason in a `WFA-001-NOTES.md` before writing code.
2. **Un-hide the sheet** and confirm by opening a project that already has a cloud component. If no
   such project is to hand, create the component by hand in the project JSON first so that step 2 is
   verified independently of step 3.
3. **Offer cloud templates in the right context** at the three call sites.
4. **Confirm the canvas is genuinely in cloud mode** by placing a Create New Record node and a
   Response node and wiring them. Screenshot.
5. **Write the cloud-only export helper** next to the deployer's inverse, with a unit test asserting
   the two filters partition the component set — no component in both, none in neither.
6. **Wire the push** to whatever trigger step 2 of the Desired State chose, plus backend start.
7. **Surface backend function state** in the Backend Services panel's local backend card.
8. **Live pass, and this is the acceptance test**: create a cloud function on canvas that writes a
   record; start the local backend from the panel; `curl` the function; see the record in the Data
   browser. Screenshot each stage. This is the loop that does not exist today.

## Success Criteria

- [ ] A cloud function component can be created from the UI and appears in a tree with its own icon.
- [ ] Its canvas offers cloud nodes — proven by placing and wiring one, not by inspecting state.
- [ ] Starting a local backend from the Backend Services panel results in `GET /health` listing the
      project's functions under `workflows.functions`.
- [ ] `POST /functions/<name>` on that backend runs the graph authored on the canvas and returns the
      Response node's body.
- [ ] A function that writes a record shows that record in the panel's Data browser.
- [ ] Deleting the component removes the function from the backend.
- [ ] A broken graph fails at push time with a message in the editor, and the previously-working
      function is not left half-replaced.
- [ ] A project with no cloud functions has an unchanged editor experience.
- [ ] The full live loop is screenshotted end to end in `WFA-001-NOTES.md`.

## Out of Scope

- **Deploying functions with the app.** `nodegx-backend`'s deploy artifact (WF-003) and phase 26 own
  that. This task is the editor↔local-backend loop only.
- **A cloud function preview/debugger.** WFA-002 covers run inspection.
- **Restoring the deleted `cloud-runtime-open-devtools` / `cloud-runtime-refresh` buttons.** They
  targeted the port-8577 server WF-007 deleted for good reasons.
- **Changing the cloud node vocabulary.** Whatever the runtime registers today is what this task
  exposes.

## Traps

- **`external/deploy 2/` and `external/viewer 3/` are stale duplicates** carrying their own copies of
  the `!component.name.startsWith('/#__cloud__/')` filter. Editing them does nothing, forever. Edit
  the real ones.
- **`hideSheets` is applied in two places** (`useComponentsPanel.ts:150` for the sheet dropdown,
  `:294` for the tree). Fixing one leaves the feature half-visible in a way that looks like a
  rendering bug.
- **`getTemplates` filters on `forParentType` too** — the cloud template declares
  `parentTypes: ['folder']`. A create menu invoked on a component rather than a folder will filter it
  out even after the runtime type is right.
- **The exporter's filter is a *keep* predicate under an *ignore* name.** `ignoreComponentFilter: c =>
  !c.name.startsWith('/#__cloud__/')` is what the frontend deployer uses to *keep* browser
  components. Read `exportToJSON` before assuming the polarity; getting it backwards ships every
  browser component to the backend and no functions.
- **`lerna exec` runs the main checkout, not a worktree**, so the live pass must be driven from the
  primary checkout.
- **HMR closes modals and can keep an old panel component mounted.** If a restored panel appears not
  to pick up a change, restart the editor before investigating.
- **The editor's Jasmine suite passes today with this feature entirely unreachable.** A green suite is
  not evidence for this task; the screenshots are.
