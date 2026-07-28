# Phase 27 — Visual Backend Authoring (Track L): Progress

**Status:** 🚧 In progress — 3 / 7 (WFA-001, WFA-002, WFA-003 complete)
**Specced:** 2026-07-27, from a live end-to-end test of phase 19's workflow engine
**Phase overview:** [README.md](./README.md)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Task status

| ID | Title | Tier | Status | Landed | Notes |
|---|---|---|---|---|---|
| [WFA-001](./WFA-001-CLOUD-FUNCTIONS-RECONNECTED.md) | Cloud functions, reconnected | 1 | ✅ Complete | 2026-07-28 | There were **five** cuts, not four — the cloud node library never reached the editor after WF-007 (F25b). Full loop live-verified; two shipped defects found by running it (F26 export-without-Home, F28 hot-deploy crash). [Notes](./WFA-001-NOTES.md) |
| [WFA-002](./WFA-002-RUN-INSPECTOR.md) | The run inspector | 1 | ✅ Complete | 2026-07-28 | The spec was right that most of it existed and was off — and wrong that cloud function runs feed it: **they record zero steps** (F32), so the overlay can place a badge only once WFA-004 exists. Run/cancel live-verified; three shipped defects fixed (F31, F33, F34). [Notes](./WFA-002-NOTES.md) |
| [WFA-003](./WFA-003-STEP-DATA-MAPPING.md) | Step data mapping & one payload shape | 2 | ✅ Complete | 2026-07-28 | Backend-only, as specced. There were **five** entry points, not four (F38). One key could not be kept in both shapes — `trigger` is now the object, the string moved to `triggerType` (F39). [Notes](./WFA-003-NOTES.md) |
| [WFA-004](./WFA-004-WORKFLOW-CANVAS.md) | The workflow canvas | 3 | ⬜ Not started | — | The big one. Reuse-or-escalate is the governing rule |
| [WFA-005](./WFA-005-TRIGGERS-ON-CANVAS.md) | Triggers as canvas entry nodes | 3 | ⬜ Not started | — | Carries shipped defects F7 and F8 |
| [WFA-006](./WFA-006-STEP-TO-FUNCTION-DESCENT.md) | Descend from a step into its function graph | 3 | ⬜ Not started | — | What makes the two tiers feel like one language |
| [WFA-007](./WFA-007-AI-PROPOSES-ONTO-CANVAS.md) | AI proposes workflows onto the canvas | 4 | ⬜ Not started | — | Adds no AI capability; adds a review surface |

## Findings register

Established on 2026-07-27 by **running** the backend and the editor, not by reading alone. Every row
below was observed live unless marked *(read)*. Executors should re-confirm the live symptom before
building around a finding — if one turns out to be stale, correct it here rather than implementing
around the description.

### The editor cannot reach the backend at all — **all closed by WFA-001, 2026-07-28**

| # | Finding | Where | Owner |
|---|---|---|---|
| F1 | The Components panel is configured `hideSheets: ['__cloud__']`, filtering cloud components out of **both** the tree and the sheet dropdown — invisible even under "All" | `router.setup.ts:79`; filtering at `useComponentsPanel.ts:150` (sheet list) and `:294` (tree) | WFA-001 |
| F2 | `CloudFunctionsPanel.tsx` — 72 lines, a `ComponentsPanel` locked to `lockCurrentSheetName: '__cloud__'` — was deleted by WF-007 alongside the Parse *management* UI. It was the authoring door, not Parse management | deleted in `1a9557e0`; recoverable with `git show 1a9557e0^:…` | WFA-001 |
| F3 | All three "create component" menus hardcode `forRuntimeType: 'browser'`, so the surviving `Cloud Function Component` template is never offered | `ComponentsPanelReact.tsx:202`, `FolderItem.tsx:176`, `ComponentItem.tsx:178`; template at `ComponentTemplates.ts:135`; filter at `:257` | WFA-001 |
| F4 | `ipcMain.handle('backend:update-workflow')` exists and works, and **has zero callers in the renderer**. Nothing deploys a project's cloud functions to a backend | `BackendManager.js:120`, impl at `:847` | WFA-001 |
| F5 | The deployer strips cloud components from the export (`ignoreComponentFilter`), so the frontend deploy path cannot be reused as-is for functions | `build/deployer.ts:75` | WFA-001 |
| F6 | Confirmed live: a backend started from the Backend Services panel reports `workflows: {workflowCount: 0, functions: []}` for a project regardless of its cloud components | `GET /health` on the editor-started backend | WFA-001 |

### Shipped defects found by running it

| # | Finding | Where | Owner |
|---|---|---|---|
| F7 | A webhook secret sent as `Authorization: Bearer <secret>` **can never authenticate**. `webhook.ts` explicitly accepts that form and its own 401 advertises it, but `resolvePrincipal` runs first for every request and throws 401 for any Bearer that is not an admin credential. `X-Webhook-Token` and `?token=` both work | `webhook.ts:67-68` vs `HttpServer.ts:1310` → `security/state.ts:220-224` | WFA-005 |
| F8 | A schedule trigger created with a `payload` key returns **201 and silently discards it** — not stored, not rejected. So a scheduled run always receives `{trigger, triggerId, firedAt, cron}` and nothing else | `registry.ts` ScheduleConfig; observed via `POST /admin/triggers` then `GET` | WFA-005 |
| F9 | The Triggers panel hardcodes `target: {kind: 'function'}`, so **no trigger created in the editor can target a workflow**; and the target is free text with no validation, so a typo only surfaces at the next fire | `TriggersPanel.tsx:44,109` | WFA-005 |
| F10 | `docs/runtime/WORKFLOW-NODES.md` tells authors to use "the Backend Services panel" to author workflows. No such surface exists | `docs/runtime/WORKFLOW-NODES.md` | WFA-004 |

### The data model — **all closed by WFA-003, 2026-07-28**

| # | Finding | Where | Owner |
|---|---|---|---|
| F11 | A step's input is `{...runPayload, ...step.params, previous}` and `params` are **static literals** — no `$path` resolution. There is no way to feed one step's output into the next step's function parameters | `WorkflowEngine.ts:397`; contract described at `StepExecutor.ts:30` | WFA-003 ✅ |
| F12 | The three entry points deliver **three different payload shapes**: webhook `{trigger, triggerId, slug, headers, query, body}` (`HttpServer.ts:1875`), schedule `{trigger, triggerId, firedAt, cron}`, manual `{trigger:'manual', triggerId, ...body}` (`admin-triggers.ts:121`), admin run `body.payload \|\| body` (`admin-workflows.ts:107`). A workflow authored against one breaks under another | as listed | WFA-003 ✅ |
| F13 | Observed consequence of F11+F12: a workflow that worked from `POST /admin/workflow-defs/:id/run` failed from the same webhook with `Cannot order-compare undefined and 100`. The failure was **loud and precise**, which is the engine behaving correctly | live run `exec_ms3nr5vsuzmckc05` | WFA-003 ✅ |
| F14 | Working around F11 today means each cloud function resolves its own source with a JS node (`previous.result ?? body ?? Inputs`). Functional, but every function carries adapter code | test fixtures, 2026-07-27 | WFA-003 ✅ |

### Found by WFA-001, 2026-07-28

| # | Finding | Where | Owner |
|---|---|---|---|
| F25b | **The fifth cut.** The editor's node library is delivered by connected viewer clients; the cloud runtime's client was the port-8577 window WF-007 deleted, so since then the editor has had **zero cloud node types**. A new cloud function painted its own template's Request/Response as unknown types and the picker offered nothing backend-capable. The spec's "cloud node types — intact, registered" was true of the package and false of the editor | `ViewerConnection.ts:380`, `NodeLibraryImporter.ts:187`; fixed by `scripts/cloud-node-library/` + a synthetic client | WFA-001 ✅ |
| F26 | `StringInputPopup` renders **every** name prompt as an 8-line code editor with a line-number gutter and the placeholder `// Add your comment here...`, including "New component name". A faithful port of a legacy comment template, reused by component creation, component ports, `PropListType` and `StringListType` | `views/PopupLayer/StringInputPopup.tsx:62` | unowned — pre-existing, shared; first thing a user meets when creating a cloud function |
| F27 | A Response node's dynamic parameter port (`params: 'id'`) is not in the exported `ports` array, so a connection into it does not survive the export and the runtime never creates the input. Returning a value through a Response parameter therefore does not work from a deployed function | `utils/exporter/util.ts` `exportComponent`; observed in a pushed bundle | unowned — WFA-006 territory |
| F28 | **Hot-deploying a bundle crashed the backend service** (`exit 1`, mid-request): `cloudRunner.load()` re-imports components already in the runtime — always, since the bundle is loaded from disk at start — and `Duplicate component name` escapes the awaited call from a scheduled update, so a `try`/`catch` cannot contain it. Never seen because `backend:update-workflow` had no caller (F4) until WFA-001 | `WorkflowRunner.loadWorkflow`; fixed with a candidate-runner swap | WFA-001 ✅ |
| F29 | Both frontend exporters bail on `!projectModel.getRootNode()`, so a project with **no Home component** could export no cloud functions at all — and the deployer read that as "no functions". Cloud functions have no visual root | `utils/exporter/json.ts:29,76`; fixed in `exporter/cloudFunctions.ts` | WFA-001 ✅ |
| F30 | Creating a component while any non-default sheet is selected named it from the tree's **display** path, which has the sheet prefix stripped — so it landed in the default sheet (and at root, with no leading `/`). Dragging and folder-renaming had the same bug. Pre-existing for `#Pages`; fatal for `#__cloud__` | `ComponentsPanelNew/hooks/useComponentActions.ts`; fixed generally | WFA-001 ✅ |

### Found by WFA-002, 2026-07-28

| # | Finding | Where | Owner |
|---|---|---|---|
| F31 | **A 0 ms step was indistinguishable from a skipped one.** `rowToStep`/`rowToExecution` read nullable numeric columns with `(row.x as number) \|\| undefined`, folding a genuine `0` into "absent". On a local backend most steps finish sub-millisecond, so the `branch` step in every observed run showed `—`, exactly like the `skipped` step two rows below it. Fixed with a `nullableNumber` helper — shared with the backend, so `/executions` is fixed too | `noodl-viewer-cloud/src/execution-history/store.ts:621,641` | WFA-002 ✅ |
| F32 | **Cloud function runs record zero steps.** `ExecutionLogger.startNode` is called from exactly one place in the repo — `WorkflowEngine.ts:406`. Nothing in the cloud runtime records a function's graph nodes. Confirmed against WFA-001's three `saveOrder` executions: `steps: 0` every time. So the `ExecutionOverlay` can **never** place a badge today: function runs have no steps, and a workflow run's step ids match no canvas until WFA-004. **F16 is true only of workflow runs**, and the spec's Step 7 (pin a function execution, scrub its timeline) is not possible. WFA-002 makes both cases say so in words | `ExecutionLogger.startNode`, `WorkflowEngine.ts:406` | WFA-004 (to make it resolvable); message shipped by WFA-002 |
| F33 | **A long run read as a failed run.** `POST /admin/workflow-defs/:id/run` answers only when the run finishes, and every `ServiceSupervisor.request` carries a hard `AbortSignal.timeout(30000)`. Observed live on a 5-minute `wait`: `TimeoutError` surfaced in the editor while the run was healthy. `runWorkflowDef` now reports `{stillRunning:true}` instead of throwing; raising the ceiling would only move the lie further out | `BackendManager.runWorkflowDef`, `ServiceSupervisor.js:311` | WFA-002 ✅ |
| F34 | **The sidebar keeps an inactive panel mounted but hidden**, so switching away and back does not remount or refetch. Observed live: open the panel, start a backend, come back — still "No backend is running" until Refresh. Fixed for this panel with an `activeChanged` listener. A general hazard for **any** panel whose subject is another process's state — Backend Services and Triggers are worth checking | `SidebarModel.setActivePanel` | WFA-002 ✅ (this panel); unowned for the others |
| F35 | A dispatched run's record is written as the run *starts*, so a refresh in the same tick loses the race to the HTTP round trip and the in-flight row is missing until the user refreshes. One follow-up fetch ~800 ms later covers it (deliberately not a poller) | `ExecutionHistoryPanel.handleStarted` | WFA-002 ✅ |
| F36 | `npm run cloud-library:check` reports the committed cloud node library stale — **and was already stale on a clean `cline-dev` tree** (verified by stashing). A CI gate WFA-001 added is red on `main`-line work | `scripts/cloud-node-library/`, `cloud-node-library.json` | unowned — pre-existing, needs a regenerate-and-commit |
| F37 | Schedule-triggered executions carry a doubled workflow name (`countOrdercountOrderss`) in the list. Cosmetic, from the WF-005 trigger path, not touched here | observed in `/executions` rows | unowned |

### Found by WFA-003, 2026-07-28

| # | Finding | Where | Owner |
|---|---|---|---|
| F38 | **There are five entry points, not four.** F12's table lists webhook, schedule, manual fire and admin run; **db-change** delivered a fifth shape (`{trigger:'db-change', triggerId, action, collection, id, record}`) and was missed. Unified with the rest: the changed record is the run's `body`, and `collection`/`action`/`recordId` moved onto `trigger` | `triggers/dbchange.ts:124` | WFA-003 ✅ |
| F39 | **One key could not be preserved in both shapes.** `payload.trigger` was the trigger type as a *string*; the uniform envelope needs it to be the metadata object, and one key cannot hold both. The object wins (it is what the served spec, the MCP tools and WFA-004's property editor are written against) and the string is preserved beside it as `triggerType`. Checked before deciding: nothing in this repository read `payload.trigger`; `docs/runtime/TRIGGERS.md` documented it and now documents the migration. Every *other* legacy top-level key is still delivered, deprecated, for one release, and where one collides with a canonical key the canonical one wins — decided in one place and tested, not left to spread order | `workflow/runPayload.ts` | WFA-003 ✅ |
| F40 | **A `wait` duration written as a reference was rejected at write time**, although `WaitStepExecutor` has resolved it since WF-002 — so the executor's own resolution was unreachable from a saved definition. Validation now defers the numeric and 24h-cap checks to the executor (which fails loudly on both) when the value is a reference | `steps/kinds.ts` `validateStepShape` case `wait` | WFA-003 ✅ |
| F41 | `for-each` now passes the **resolved** `items` array into each per-item function invocation, where it previously passed the unresolved `{"$path": …}` spec. Strictly better, and a change in what those functions receive | `steps/logic.ts` `ForEachStepExecutor` | WFA-003 ✅ (noted, not a defect) |

### What already exists and is worth reusing

| # | Finding | Where | Owner |
|---|---|---|---|
| F15 | `ExecutionOverlay` keys on `step.nodeId → getNodeBounds(nodeId)`, and the workflow engine writes the **workflow's own step ids** into that field (`save`, `decide`, `charge`). A canvas using step ids as node ids gets the overlay unmodified | `ExecutionOverlay.tsx:38,77`; bounds from `OverlayViews.ts:100` via `nodegrapheditor.ts:340` | WFA-002, WFA-004 |
| F16 | The overlay is a complete run inspector already: `ExecutionNodeBadge` (status at node bounds), `ExecutionDataPopup` (input/output/error/timing), `ExecutionTimeline` (scrubber that steps through a run). **Qualified by F32 (2026-07-28): true only for workflow runs, and only once a canvas exists whose node ids are step ids. Cloud function runs record no steps at all, so the badges have never had anything to draw.** | `views/CanvasOverlays/ExecutionOverlay/` | WFA-002 |
| F17 | "Pin to Canvas" already exists — `ExecutionDetail` emits `execution:pinToCanvas` over `EventDispatcher` with the full execution including steps | `ExecutionHistoryPanel.tsx:24,41` | WFA-002 |
| F18 | The Execution History panel is registered `experimental: true`, so it is **not in the sidebar rail** by default. **Closed by WFA-002, 2026-07-28** | `router.setup.ts:232` | WFA-002 ✅ |
| F19 | Step records carry everything a run inspector needs: `nodeId`, `nodeType`, `stepIndex`, `startedAt`, `completedAt`, `durationMs`, `status`, `inputData`, `outputData`. Observed `nodeType` values: `function:saveOrder`, `branch`, `retry:chargeCard`, `merge` | `GET /executions/:id`, live | WFA-002 |
| F20 | `GET /admin/workflow-step-kinds` serves a versioned registry: per kind, `params[{name,type,required,description}]`, `routes[{name,description,dynamic}]`, `output`, `whenToUse`, `clientEquivalent`. Types include `condition`, `path`, `enum` — enough to drive a property editor | `workflow/steps/kinds.ts`, served live | WFA-004 |
| F21 | `RuntimeType` is a two-value enum (`Browser`, `Cloud`) with a `RuntimeTypes` array, resolved from the component name prefix — the seam a third type would extend *(read)* | `NodeLibraryData.ts:1-6`, `utils/NodeGraph/index.ts` | WFA-004 |
| F22 | `NodeGraphContext` already switches an `'frontend' \| 'backend'` active graph on `isComponentModel_CloudRuntime` *(read)* | `NodeGraphContext.tsx:12,125` | WFA-004, WFA-006 |
| F23 | The component trail already special-cases the cloud sheet (`if (name === '#__cloud__') return null`) — the breadcrumb WFA-006 needs already knows about this tier *(read)* | `NodeGraphComponentTrail.tsx:223` | WFA-006 |
| F24 | MCP discovers editor backends from the userData directory, reading `config.json` for the port and `secrets.json` for the admin token — so an agent already reaches a running local backend without editor cooperation *(read)* | `noodl-mcp/src/backend/client.ts:40` | WFA-007 |
| F25 | The engine's own semantics are sound and were proven live: DAG order, `skipped` recorded for unreached steps, retry with exponential backoff, `onError` carrying `{error}`, `merge` over the taken paths, cancel, and full survival of a service restart | live runs, 2026-07-27 | — |

## Open questions

- **Should the workflow canvas be a third `RuntimeType`, or a separate document type?** F21/F22 make a
  third runtime type look natural, but a workflow is not a component and has no ports, no instances
  and no parent graph. WFA-004 must decide and record the choice; picking "component" for convenience
  and discovering later that workflows need to not be instantiable is the expensive version.
- **Where do workflows live in the tree?** They are backend artefacts stored in the backend's data
  directory, not project files — so unlike cloud functions they do not belong to the project, do not
  travel through version control, and are not in the export. That is a genuine modelling question
  WFA-004 owns, and it interacts with DEP-002/DEP-005: a workflow that is not in the artifact does not
  get deployed with the app.
- **Does an empty palette read as broken?** The step-kind registry is served by a running backend
  (README decision). With no backend started the palette is empty. WFA-004 must make that state read
  as "start a backend" rather than "this feature is broken", and must not fall back to a bundled copy
  that can disagree with the backend.
- **Does auto-layout need to be stable across re-opens?** MCP-authored workflows have no coordinates.
  If layout is recomputed each open, a hand-tidied graph is lost; if positions persist, an
  AI-authored change to an existing workflow has to place new nodes without disturbing the rest.
  WFA-004 picks one and says why.
- **Is `for-each` legible on a canvas without a sub-graph?** It iterates a function rather than a
  sub-graph, deliberately. Whether that reads clearly as a single node with a fan-out badge, or
  confuses everyone who has used n8n, is a real question the WFA-004 live pass should answer.
- **Should WFA-001 deploy functions on save, on backend start, or on an explicit button?** On-save is
  the best feel and the worst failure mode (a broken function silently replaces a working one on a
  running backend). WFA-001 decides; whatever it picks must be visible in the UI.

## Log

- **2026-07-28** — **WFA-003 complete.** A step param can now be a reference rather than a
  literal — `{"$path": "previous.result.total"}`, `{"$path": "upstream.save.result.orderId"}`,
  `{"$literal": …}` to escape — using the value language that already existed for conditions,
  **extracted** rather than reimplemented (the condition suite passes untouched, which is the
  evidence the extraction was behaviour-preserving). "Take the order id from the save step and
  pass it to the charge step" is now expressible, proven end to end against real cloud functions
  by the receiving function's own response body rather than by a spy. And every entry point
  delivers one envelope — `{trigger, triggerType, body, headers?, query?}` — with the caller's
  data always under `body`, so the same definition branches identically whether an admin run, a
  webhook or a schedule started it. That is **F13 closed**: the live failure phase 27 was specced
  on cannot recur.
  **Three things the spec did not anticipate.** There are **five** entry points, not four — F12's
  table missed db-change (F38). One key could **not** be kept in both shapes: `payload.trigger`
  was the trigger type as a string and the envelope needs it to be the metadata object, so the
  object wins and the string moved to `triggerType` (F39) — every other legacy top-level key is
  still delivered, deprecated, for one release, with the canonical key winning any collision by
  an explicit, tested decision rather than by spread order. And a `wait` duration written as a
  reference was rejected at write time even though the executor has resolved it since WF-002,
  making that path unreachable from a saved definition (F40). Write-time validation gained two
  typo-only 400s — a `$path` naming a step that does not exist, or one that is not upstream — and
  the boot-refusal risk that carries is assessed and accepted in the notes rather than assumed
  away. The served catalog now describes the value language (version `1.1.0`) so WFA-004's
  property editor and the MCP tools can render a param control without hardcoding, and the WF-002
  coverage gate was extended so the spec and the author docs cannot drift apart on it.
  Backend suite **64 suites / 670 passed**, up from 62 / 622. Full pass in
  [WFA-003-NOTES.md](./WFA-003-NOTES.md).
- **2026-07-28** — **WFA-002 complete.** The Execution History panel is a normal rail panel, the merged
  list says which stores answered it (so "no backend running", "backend running with nothing recorded"
  and "the backend that had your runs cannot be read" are three different messages), and a workflow's
  step records now read as a run rather than as JSON: every step in DAG order including the skipped
  ones, the step id beside the name, a status word, retry attempts, and the error routing stated in
  words — *Error routed to Log failure* on the failure, *Received the error from Charge card* on the
  handler, with `previous.error` broken out of the input blob. A definition can be run from the panel
  with an edited payload and an in-flight run cancelled, both live-verified, closing the `curl`
  round-trip this phase exists to remove.
  **The task's shape changed on one finding.** The spec assumed cloud function calls feed the canvas
  overlay; they record **zero steps** (F32) — `startNode` is called only by the workflow engine — so
  the overlay's badges have never had anything to draw, and the spec's Step 7 is not possible. That
  turns the "be honest about unresolved nodes" requirement from an edge case into the overlay's normal
  output, written as two distinct messages (no steps recorded vs. steps that match no open node) rather
  than one that would blame the open graph for missing data. Three further shipped defects fixed on the
  way: a **0 ms step was indistinguishable from a skipped one** (F31), a **long run reported
  `TimeoutError` and read as a failure** because the run route answers only on completion behind a hard
  30-second request ceiling (F33), and **an inactive sidebar panel stays mounted and hidden**, so this
  panel silently showed pre-backend state until Refresh was pressed (F34). Editor suite **1731/0**;
  the editor's main-process jest suites (43 specs, the gate on execution history) now run in CI, which
  they did not before. Full pass in [WFA-002-NOTES.md](./WFA-002-NOTES.md).
- **2026-07-28** — **WFA-001 complete.** The cloud sheet is a first-class, always-listed, protected
  sheet in the existing Components panel (decision (b)) and is deliberately kept out of the flattened
  "All" tree, because "All" strips sheet prefixes and would merge two *runtimes* into one namespace.
  The three create menus resolve their templates from the selected sheet's runtime, and creation,
  dragging and folder-renaming now put the sheet prefix back — that was broken for every sheet, not
  just the cloud one (F30). Functions reach the backend on save (hash-gated), on backend start, and on
  demand, with the backend's own function list on the Backend Services card so a bad push cannot be
  silent. Four cuts closed — and a fifth found: **the editor has had no cloud node types at all since
  WF-007** deleted the cloud runtime's viewer client (F25b), so the starter template's own nodes
  painted as unknown. Fixed with a generated cloud node library (`cloud-library:check` gates it in CI)
  registered as a client that never disconnects. Running the loop found two further shipped defects,
  both fixed: cloud functions could not be exported from a project with **no Home component** (F29),
  and **hot deploy crashed the backend service** with `Duplicate component name` (F28) — the first
  time `backend:update-workflow` has ever been called since WF-004 shipped it. Full live pass in
  [WFA-001-NOTES.md](./WFA-001-NOTES.md): function authored on canvas → deployed on backend start →
  `POST /functions/saveOrder` → record visible in the Data browser → component deleted → 404.
  Editor suite 1667/0.
- **2026-07-27** — Phase specced. Trigger: a live end-to-end test of phase 19 drove the whole exit
  criterion successfully against a standalone `nodegx-backend` — webhook and cron both firing one
  workflow, DB read and write, branch, retry with backoff, error routing, merge, per-step history,
  full restart survival — and then found that **none of it is reachable from the editor**. The four
  cuts (F1–F4) are three accidents and one decision: the Components panel hides the cloud sheet, the
  panel that showed it was deleted by WF-007 as though it were Parse management UI, all three create
  menus hardcode the browser runtime type, and nothing has ever called the `backend:update-workflow`
  IPC that deploys functions. Items 1–3 are a regression against old Noodl. Scoping then rejected
  "restore the old panel" as the goal: the step DAG is already node-shaped (WF-002 took its port names
  from the client `Condition` node), the run inspector already exists and already keys on the
  workflow's own step ids (F15), and the no-`eval` condition language is what makes conditions
  renderable as dropdowns — so the visual story is mostly *reconnection*, not construction. Five
  decisions recorded in the README, of which two are load-bearing: **reuse or escalate** (no second
  canvas — this codebase's failure mode is half-wired UI), and **debugger before editor** (WFA-002
  ships before WFA-004 and does not depend on it, because an authoring canvas you cannot watch execute
  is a JSON editor with rounded corners). Two shipped defects filed from the test (F7 webhook Bearer,
  F8 silently-dropped schedule payload) and given to WFA-005, whose surface they belong to. Durable
  and resumable runs — WF-001's headline residual — are explicitly **not** in this phase.
