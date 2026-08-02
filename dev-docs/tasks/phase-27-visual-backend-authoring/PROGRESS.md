# Phase 27 — Visual Backend Authoring (Track L): Progress

**Status:** 🚧 9 / 9 built — **live QA is the only thing outstanding.** 2026-08-02 closed the
phase's code: WFA-007 and WFA-009 were built in parallel worktrees alongside F26 and F37, merged
together and gated. Nothing here has been driven in the running editor, because the checkout's editor
belonged to a concurrent session throughout; every task carries an ordered live-QA script in its
notes, and those scripts are the remaining work
**Specced:** 2026-07-27, from a live end-to-end test of phase 19's workflow engine
**Phase overview:** [README.md](./README.md) ·
**What is left and what each piece needs:** [OPEN-WORK.md](./OPEN-WORK.md)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Task status

| ID | Title | Tier | Status | Landed | Notes |
|---|---|---|---|---|---|
| [WFA-001](./WFA-001-CLOUD-FUNCTIONS-RECONNECTED.md) | Cloud functions, reconnected | 1 | ✅ Complete | 2026-07-28 | There were **five** cuts, not four — the cloud node library never reached the editor after WF-007 (F25b). Full loop live-verified; two shipped defects found by running it (F26 export-without-Home, F28 hot-deploy crash). [Notes](./WFA-001-NOTES.md) |
| [WFA-002](./WFA-002-RUN-INSPECTOR.md) | The run inspector | 1 | ✅ Complete | 2026-07-28 | The spec was right that most of it existed and was off — and wrong that cloud function runs feed it: **they record zero steps** (F32), so the overlay can place a badge only once WFA-004 exists. Run/cancel live-verified; three shipped defects fixed (F31, F33, F34). [Notes](./WFA-002-NOTES.md) |
| [WFA-003](./WFA-003-STEP-DATA-MAPPING.md) | Step data mapping & one payload shape | 2 | ✅ Complete | 2026-07-28 | Backend-only, as specced. There were **five** entry points, not four (F38). One key could not be kept in both shapes — `trigger` is now the object, the string moved to `triggerType` (F39). [Notes](./WFA-003-NOTES.md) |
| [WFA-004](./WFA-004-WORKFLOW-CANVAS.md) | The workflow canvas | 3 | ✅ Complete | 2026-07-28 | **Reuse, not escalate** — the §1 decision is in [WFA-004-ASSESSMENT.md](./WFA-004-ASSESSMENT.md), and a real workflow renders on the *existing* canvas with node ids that are step ids, so WFA-002's overlay lands on it **unmodified** (criterion 3, confirmed badge-by-badge). The live pass found one shipped defect: a single `switch` step made a whole workflow fail to open (F49). [Notes](./WFA-004-NOTES.md) |
| [WFA-005](./WFA-005-TRIGGERS-ON-CANVAS.md) | Triggers as canvas entry nodes | 3 | ✅ Complete | 2026-07-28 | **F8 was never about `payload`** — the write path validated the object it had just built, so an unknown key was dropped at every level while the load path refuses to boot on the same key. F7's exemption is scoped by the matched route's own declared access kind, not by a path prefix. F9 was two defects in one number. F47 folded in on Richard's call and closes F34's other half. The live pass drove the phase-19 exit clause end to end: one definition, two entry points, **different branches**. [Notes](./WFA-005-NOTES.md) |
| [WFA-006](./WFA-006-STEP-TO-FUNCTION-DESCENT.md) | Descend from a step into its function graph | 3 | ✅ Complete | 2026-07-28 | **Two facts, never collapsed into one** — `inProject` and `deployed` (`true \| false \| null`) derive four states, and the difference between them is the feature. Descent + crumb + reverse lookup, no painter change and one optional trail slot. Found F54 by reading (a deployed function reported as missing) and F55 by measuring (the marker gate was already red). §7's decision is recorded and the test **corrected the spec's own wording** (F56). [Notes](./WFA-006-NOTES.md) · [Decisions](./WFA-006-ASSESSMENT.md) |
| [WFA-008](./WFA-008-EDIT-A-TRIGGER.md) | Edit a trigger's configuration (F53) | 3 | ✅ Complete | 2026-07-28 | **The premise held and two new findings came out of checking it**: a `PUT` keeps a webhook's secret (so an edit is what delete-and-recreate cannot be), but it also accepted a **type change** that orphaned the secret and re-used it on the way back (F58), and a `PUT` to a deleted id **recreated** it with a fresh secret and answered 200 (F59). One form, in the panel, with a door from the canvas node (§1); `enabled` and `secret` are never sent, and the form re-reads before it writes. The live pass found **two** defects in the redraw this task added, the first of which **destroyed a one-time secret**. [Notes](./WFA-008-NOTES.md) · [Decisions](./WFA-008-ASSESSMENT.md) |
| [WFA-007](./WFA-007-AI-PROPOSES-ONTO-CANVAS.md) | AI proposes workflows onto the canvas | 4 | 🟡 **Built, not live-QA'd** | 2026-08-02 | **The spec's premise was wrong in a way that changed the design: there is no editor-side AI path to make reviewable.** `AiAssistant/authoring/tools.ts` has exactly three tools, all component-scoped, none aware a backend exists — MCP is the only thing that can author a workflow. So the reviewable path is a `propose: true` mode on the existing MCP tools (no new tool), staging into the proposal directory both processes already know, with `propose` defaulting false so the direct path stays open. §3's "validate against the target backend" was **not possible** — `POST`/`PUT` persist on success, so check and write were the same call; it added `POST /admin/workflow-defs/validate` and uses it twice, the second time on every accept, because a partial accept is a definition nobody saw whole. Two defects fixed in passing: accepted entry/concurrency/timeout changes silently did nothing (dotted `component-metadata-changed.path`), and the Workflows panel rendered `status`/`error` inside `{document && …}`, so anything failing with no workflow open reported to nobody. **The 6 Jasmine specs typecheck but have never executed.** [Notes](./WFA-007-NOTES.md) · [Decisions](./WFA-007-ASSESSMENT.md) |
| [WFA-009](./WFA-009-RESPONSE-NODE-PORTS.md) | A cloud function can return a value (F27) | 2 | 🟡 **Built, not live-QA'd** | 2026-08-02 | **Scheduled on 2026-08-02 and its own §1 framing did not survive contact.** The spec said *"nothing in the editor can derive a port from a parameter's value"*; `PageInputsAdapter` has been doing exactly that all along, so the real choice was never "editor-side rule vs. revive the cloud runtime" but "one hand-written adapter per node, or one declarative rule". It chose the rule (`namedports/list`, read by one evaluator shared with the `conditionalports/*` filter). The exporter is **out of scope, by evidence**: a backend on port 8711 over an export-shaped bundle (`"ports": []`) returned the wired value, so `registerInputIfNeeded` is load-bearing and `exportDynamicPorts` is not needed. **Request was pulled into scope** — F27's criterion is unreachable without it, since the value you return comes from the request. Both `setup()`s were fixed rather than mirrored (an emptied list minted a blank-labelled port; a repeated name minted it twice). [Notes](./WFA-009-NOTES.md) · [Decisions](./WFA-009-ASSESSMENT.md) |

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
| F7 | **Closed by WFA-005, 2026-07-28.** A webhook secret sent as `Authorization: Bearer <secret>` **can never authenticate**. `webhook.ts` explicitly accepts that form and its own 401 advertises it, but `resolvePrincipal` runs first for every request and throws 401 for any Bearer that is not an admin credential. `X-Webhook-Token` and `?token=` both work | `webhook.ts:67-68` vs `HttpServer.ts:1310` → `security/state.ts:220-224` | WFA-005 ✅ |
| F8 | **Closed by WFA-005, 2026-07-28 — and it was a class, not a key.** A schedule trigger created with a `payload` key returned **201 and silently discarded it**; so did an unknown key at the top level, in `target`, in `webhook` and in `dbChange`, all reproduced live. `upsert` reconstructed a `TriggerDef` from the input and validated *the reconstruction*, so validation of the write path could only ever confirm that `upsert` copied correctly — while the same key in `triggers.json` refuses to start the service. Fixed by validating the INPUT before anything is copied, with the key sets in one place; then `ScheduleConfig.payload` delivered as WFA-003's `body` | `registry.ts` ScheduleConfig; observed via `POST /admin/triggers` then `GET` | WFA-005 ✅ |
| F9 | **Closed by WFA-005, 2026-07-28.** The Triggers panel hardcoded `target: {kind: 'function'}`, so no trigger created in the editor could target a workflow; and the target was free text, so a typo only surfaced at the next fire. Both halves are now chosen — a `runs` control and a name picked from `/admin/workflows` + `/admin/workflow-defs` — with free text still permitted and flagged as unresolved rather than accepted silently | `TriggersPanel.tsx:44,109` | WFA-005 ✅ |
| F10 | `docs/runtime/WORKFLOW-NODES.md` tells authors to use "the Backend Services panel" to author workflows. No such surface exists. **Closed by WFA-004, 2026-07-28** — the page now describes the Workflows panel and the canvas, and a coverage test fails if it ever again names a surface that is not there | `docs/runtime/WORKFLOW-NODES.md` | WFA-004 ✅ |

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
| F26 | `StringInputPopup` renders **every** name prompt as an 8-line code editor with a line-number gutter and the placeholder `// Add your comment here...`, including "New component name". A faithful port of a legacy comment template, reused by component creation, component ports, `PropListType` and `StringListType` | `views/PopupLayer/StringInputPopup.tsx:62` | **Closed 2026-08-02.** `multiline` defaults to false; the gutter, `rows={8}` and the comment placeholder now belong only to the comment node, the one caller the code editor was written for. Single-line also answers Enter and Escape, which it never did. **The spec's call-site list was wrong in both directions** — `PropListType` and `StringListType` no longer call this popup at all (ERG-003 §3 replaced both add-flows with inline editing), and two callers it never knew about do (new group name, new folder name): five sites, not four. Found by grepping instead of trusting the list |
| F27 | A Response node's parameter port (`params: 'id'`) does not reach a deployed function, so returning a value through one does not work. **Diagnosis corrected by WFA-006, 2026-07-28 — it is not the exporter, and the fix is not a one-liner there.** Those `pm-<name>` ports have only ever existed because a *running cloud runtime* pushed them to the editor: `response.ts`'s `setup()` calls `context.editorConnection.sendDynamicPorts`, and it returns early unless `isRunningLocally()`. WF-007 deleted that client (F25b) and WFA-001 replaced the node **library** with a generated JSON served by a synthetic client that never runs `setup()` — so **since WF-007 there is no `pm-*` port in the editor at all**, which is upstream of anything the export does: there is nothing to wire. Confirmed live (a Response node offers `params`, `errorMessage`, `send`, `status` and nothing else) and in `cloud-node-library.json`, whose `dynamicports` carry only the two `conditionalports/extended` entries. A second, currently unreachable fault sits behind it: `exportPorts` exports a node's dynamic ports only when `node.type.exportDynamicPorts` is set, and this type does not set it — though the *connection* is what the runtime actually needs (`nodescope` calls `registerInputIfNeeded(targetPort)` when wiring one). **Fixing it means an editor-side dynamic-port provider for this pattern, or restoring a cloud-runtime editor connection** — the editor's `expand` port manager is commented out and only `conditionalports/*` survives | `noodl-viewer-cloud/src/nodes/cloud/response.ts` `setup()`; `nodelibrary.ts:122-130`; `utils/exporter/util.ts` `exportPorts` | **Closed by [WFA-009](./WFA-009-RESPONSE-NODE-PORTS.md), 2026-08-02** — and the corrected diagnosis above was itself corrected once more. "The editor has no machinery that could derive a port from a parameter's value" was false when written: `PageInputsAdapter` splits a comma-separated parameter into `pm-<name>` ports today, registered and running. The exporter half is settled by evidence rather than argument — a deployed function returned a wired value with `exportDynamicPorts` unset |
| F28 | **Hot-deploying a bundle crashed the backend service** (`exit 1`, mid-request): `cloudRunner.load()` re-imports components already in the runtime — always, since the bundle is loaded from disk at start — and `Duplicate component name` escapes the awaited call from a scheduled update, so a `try`/`catch` cannot contain it. Never seen because `backend:update-workflow` had no caller (F4) until WFA-001 | `WorkflowRunner.loadWorkflow`; fixed with a candidate-runner swap | WFA-001 ✅ |
| F29 | Both frontend exporters bail on `!projectModel.getRootNode()`, so a project with **no Home component** could export no cloud functions at all — and the deployer read that as "no functions". Cloud functions have no visual root | `utils/exporter/json.ts:29,76`; fixed in `exporter/cloudFunctions.ts` | WFA-001 ✅ |
| F30 | Creating a component while any non-default sheet is selected named it from the tree's **display** path, which has the sheet prefix stripped — so it landed in the default sheet (and at root, with no leading `/`). Dragging and folder-renaming had the same bug. Pre-existing for `#Pages`; fatal for `#__cloud__` | `ComponentsPanelNew/hooks/useComponentActions.ts`; fixed generally | WFA-001 ✅ |

### Found by WFA-002, 2026-07-28

| # | Finding | Where | Owner |
|---|---|---|---|
| F31 | **A 0 ms step was indistinguishable from a skipped one.** `rowToStep`/`rowToExecution` read nullable numeric columns with `(row.x as number) \|\| undefined`, folding a genuine `0` into "absent". On a local backend most steps finish sub-millisecond, so the `branch` step in every observed run showed `—`, exactly like the `skipped` step two rows below it. Fixed with a `nullableNumber` helper — shared with the backend, so `/executions` is fixed too | `noodl-viewer-cloud/src/execution-history/store.ts:621,641` | WFA-002 ✅ |
| F32 | **Cloud function runs record zero steps.** `ExecutionLogger.startNode` is called from exactly one place in the repo — `WorkflowEngine.ts:406`. Nothing in the cloud runtime records a function's graph nodes. Confirmed against WFA-001's three `saveOrder` executions: `steps: 0` every time. So the `ExecutionOverlay` can **never** place a badge today: function runs have no steps, and a workflow run's step ids match no canvas until WFA-004. **F16 is true only of workflow runs**, and the spec's Step 7 (pin a function execution, scrub its timeline) is not possible. WFA-002 makes both cases say so in words | `ExecutionLogger.startNode`, `WorkflowEngine.ts:406` | WFA-004 (to make it resolvable); message shipped by WFA-002 |
| F33 | **A long run read as a failed run.** `POST /admin/workflow-defs/:id/run` answers only when the run finishes, and every `ServiceSupervisor.request` carries a hard `AbortSignal.timeout(30000)`. Observed live on a 5-minute `wait`: `TimeoutError` surfaced in the editor while the run was healthy. `runWorkflowDef` now reports `{stillRunning:true}` instead of throwing; raising the ceiling would only move the lie further out | `BackendManager.runWorkflowDef`, `ServiceSupervisor.js:311` | WFA-002 ✅ |
| F34 | **The sidebar keeps an inactive panel mounted but hidden**, so switching away and back does not remount or refetch. Observed live: open the panel, start a backend, come back — still "No backend is running" until Refresh. Fixed for this panel with an `activeChanged` listener. A general hazard for **any** panel whose subject is another process's state — Backend Services and Triggers are worth checking | `SidebarModel.setActivePanel` | WFA-002 ✅ (this panel); **the others closed by WFA-005's `backend:statusChanged`** |
| F35 | A dispatched run's record is written as the run *starts*, so a refresh in the same tick loses the race to the HTTP round trip and the in-flight row is missing until the user refreshes. One follow-up fetch ~800 ms later covers it (deliberately not a poller) | `ExecutionHistoryPanel.handleStarted` | WFA-002 ✅ |
| F36 | `npm run cloud-library:check` reports the committed cloud node library stale — **and was already stale on a clean `cline-dev` tree** (verified by stashing). A CI gate WFA-001 added is red on `main`-line work | `scripts/cloud-node-library/`, `cloud-node-library.json` | **Closed 2026-08-02, having gone green and red again in between.** It was *green* when this batch started — something between 07-28 and 08-02 regenerated it — then `62fdc4ec` changed the generator (output port descriptions) without regenerating the artefact and it went red again. Regenerated with the diff **proved** rather than trusted: stripped of `description`, old and new are byte-identical, 58 node types before and after, none added or removed. A concurrent session regenerated it independently the same hour (`b6065b5c`). **The lesson is the gate's own: a file that is generated by one commit and committed by another will keep doing this** |
| F37 | Schedule-triggered executions carry a doubled workflow name (`countOrdercountOrderss`) in the list. Cosmetic, from the WF-005 trigger path, not touched here | observed in `/executions` rows | **Not reproducible, and the mechanism is ruled out, 2026-08-02.** `workflow_name` has exactly three writers repo-wide (`WorkflowRunner.ts:253`, `WorkflowEngine.ts:401`, `dispatcher.ts:248`); a new spec drives a real `CronScheduler` catch-up through a real dispatcher into `ExecutionHistory` and all three record the name once, unmodified. The read path and all three display surfaces render it once. **`countOrdercountOrderss` is an anagram of `countOrderscountOrders`** — the same 22 characters with the two `s`es transposed, i.e. `name + name` mis-transcribed by eye. Since nothing composes that, the likeliest truth is that the trigger's `target.name` was doubled at authoring time and recorded verbatim. That backend's `triggers.json` no longer exists and the sighting has no screenshot, so it cannot be settled — **closed as data, not code**, with a test that would catch a real doubling |

### Found by WFA-003, 2026-07-28

| # | Finding | Where | Owner |
|---|---|---|---|
| F38 | **There are five entry points, not four.** F12's table lists webhook, schedule, manual fire and admin run; **db-change** delivered a fifth shape (`{trigger:'db-change', triggerId, action, collection, id, record}`) and was missed. Unified with the rest: the changed record is the run's `body`, and `collection`/`action`/`recordId` moved onto `trigger` | `triggers/dbchange.ts:124` | WFA-003 ✅ |
| F39 | **One key could not be preserved in both shapes.** `payload.trigger` was the trigger type as a *string*; the uniform envelope needs it to be the metadata object, and one key cannot hold both. The object wins (it is what the served spec, the MCP tools and WFA-004's property editor are written against) and the string is preserved beside it as `triggerType`. Checked before deciding: nothing in this repository read `payload.trigger`; `docs/runtime/TRIGGERS.md` documented it and now documents the migration. Every *other* legacy top-level key is still delivered, deprecated, for one release, and where one collides with a canonical key the canonical one wins — decided in one place and tested, not left to spread order | `workflow/runPayload.ts` | WFA-003 ✅ |
| F40 | **A `wait` duration written as a reference was rejected at write time**, although `WaitStepExecutor` has resolved it since WF-002 — so the executor's own resolution was unreachable from a saved definition. Validation now defers the numeric and 24h-cap checks to the executor (which fails loudly on both) when the value is a reference | `steps/kinds.ts` `validateStepShape` case `wait` | WFA-003 ✅ |
| F41 | `for-each` now passes the **resolved** `items` array into each per-item function invocation, where it previously passed the unresolved `{"$path": …}` spec. Strictly better, and a change in what those functions receive | `steps/logic.ts` `ForEachStepExecutor` | WFA-003 ✅ (noted, not a defect) |

### Found by WFA-004, 2026-07-28

| # | Finding | Where | Owner |
|---|---|---|---|
| F42 | **The step-kind catalog could not drive a condition editor as served.** §4 requires a condition to render as three controls, which means having the operator list — and an editor holding its own copy of a *closed* operator set can offer one the target backend cannot evaluate, which is the drift the served registry exists to prevent. The catalog now serves `conditionLanguage` (name, human label, unary, takes-flags) and the version went 1.1.0 → **1.2.0**; two existing specs assert that version and were updated deliberately, which is what the field is for. A pre-1.2.0 backend serves no list and the control says so rather than guessing | `workflow/steps/conditions.ts`, `steps/kinds.ts` | WFA-004 ✅ |
| F43 | **`NodeLibraryImporter.mergeUpdates` is additive by design** (`TODO: Update the node data?`), so importing a second backend's step-kind catalog would leave the FIRST backend's params in place under the second backend's names — the exact drift the served registry exists to prevent, arriving through the editor's own merge. A workflow library is now *replaced*: the importer remembers the names it installed and removes exactly those first | `NodeLibraryImporter.ts` | WFA-004 ✅ |
| F44 | **`Model.*` events are broadcast globally** by `shared/model.js`, so a workflow's canvas graph — deliberately not part of `ProjectModel` — reaches every handler in `ViewerConnection`. Only `Model.nodeAdded` filtered on project ownership; its siblings checked that a *component* existed, which a workflow's canvas adapter satisfies, so editing a step param would have sent the viewer a `parameterChanged` naming a component it has never heard of. Guarded as a positive test for the workflow prefix — "not this project" would also drop module-component updates those handlers deliberately still send | `ViewerConnection.ts` | WFA-004 ✅ |
| F45 | **A guid is a legal step id**, so nothing would have broken if canvas-created steps kept theirs — but every execution record would read `nodeId: "3f2a1c04-…"` instead of `nodeId: "charge"`, and the run inspector this canvas exists to feed would be unreadable. New nodes are renamed from their kind on the way in; a non-guid id is kept, because that case is the undo of a delete re-adding a step other steps' edges point at | `WorkflowGraphModel.addRoot` | WFA-004 ✅ |
| F46 | **In a property-editor row, `parent.model` is a `ModelProxy`** and the real `NodeGraphNode` is one hop further in at `.model`. Reading `parent.model.owner` returns `undefined` with no error, so the `$path` predecessor picker said "nothing runs before this step" on a step with three. Silent because every other read through the proxy works. Fixed and **re-verified live** — `decide` now offers *Receive order* | `propertyeditor/DataTypes/WorkflowTypes.ts` | WFA-004 ✅ |
| F47 | **Closed by WFA-005, 2026-07-28, on Richard's call to fold it in rather than work around it a fourth time.** `BackendManager` now broadcasts `backend:statusChanged` on create / start / stop / delete **and on an unexpected exit** — the last being the state that was previously invisible, because a crashed backend left every panel still describing a running one. One `useBackendStatusChanged` hook, adopted by the Workflows, Execution History and Triggers panels; **F34's "unowned for the others" is closed with it**. Verified live: the Workflows panel went from *"Start a backend to author workflows"* to listing three workflows with no Refresh press | `WorkflowsPanel.tsx`; `BackendManager.js` sends nothing | WFA-005 ✅ |
| F48 | `NavigationHistory` resolves its entries through `ProjectModel.getComponentWithName`, and `EditorDocument` restores `selectedComponentName` the same way — neither can find a workflow. Workflows are therefore kept **out** of canvas back/forward rather than pushed and silently discarded, and "reopen the last thing I had open" does not restore one | `NavigationHistory.ts:104`, `EditorDocument.tsx:396` | WFA-004 (accepted) |
| F49 | **One `switch` step made a whole workflow fail to open, and a green suite could not see it.** `buildGraph` called `setDynamicPorts` *before* `graph.addRoot`, and `ViewerConnection`'s `Model.instancePortsChanged` handler opens `if (!e.model.owner.owner)` — a guard whose own comment describes a node with no *component* but which is one level too shallow for a node with no *graph*. The `TypeError` escaped the listener, `notifyListeners`, `buildGraph` and `WorkflowDocument.open`, so the panel click appeared to do nothing at all. **F44 closed six of these handlers and missed the seventh**, which also had no `isWorkflowModelEvent` filter — so a `switch` step's ports would have reached the viewer naming a component it has never heard of. Both fixed, plus the ordering: a step is in the graph *before* it announces its ports, because every listener of a global model event identifies the event by walking `owner`, and an unowned node is invisible to the very filter meant to stop it. The editor specs already built a `switch` step and passed, because no `ViewerConnection` exists there — the new spec asserts the *invariant* instead | `ViewerConnection.ts` `Model.instancePortsChanged`; `WorkflowDocument.buildGraph` | WFA-004 ✅ |

### Found by WFA-005, 2026-07-28

| # | Finding | Where | Owner |
|---|---|---|---|
| F50 | **The Bearer webhook rejection produced no execution record, and fed the auth lockout budget.** F7's description stopped at "returns 401". Two further consequences, both read off the live execution log during the reproduction: the request was refused in `handle()` *before* routing reached `handleWebhook`, so the loud-rejection record the spec's own trap protects was never written — an operator debugging a failing integration saw an empty history rather than a rejected hook; and `handle()` calls `authLimiter.recordFailure` on a thrown principal resolution, so a third-party service retrying a Bearer hook walked itself into BAK-005's 429 for **every** route on the backend. Both fixed as a consequence of the exemption | `HttpServer.handle`, `admin/auth` | WFA-005 ✅ |
| F51 | **A trigger entry node was offered as an upstream STEP by the `$path` picker** — the F49 shape again, a global structure growing a member every existing walker assumed could not exist. A trigger genuinely *is* upstream of the entry step on the canvas, so `upstreamSteps` listed it, and `{"$path": "upstream.trg_…"}` is a 400 from the backend: precisely the drift `workflowScope` exists to prevent. `syncEntry` had the mirror problem — the trigger's wire made the entry step look like it had a predecessor, so deleting the entry step would have promoted the wrong step. Caught within minutes by WFA-004's existing "the node ids are the step ids" spec | `workflowScope.ts`, `WorkflowDocument.syncEntry` | WFA-005 ✅ |
| F52 | **The property editor's type chip names a COLOUR as if it were a category.** `getNodeTypeChipInfo` appends the taxonomy key's label, and for most nodes the colour and the category happen to be the same word — so it reads as a category. A trigger is coloured `data` for its hue (it is where the run's data comes from) and the chip read `WEBHOOK · POST /BOTH-WAYS · DATA`. Given a one-line opt-out (`metadata.hideCategoryChip`) rather than a taxonomy change; the general problem stands for any node whose colour is chosen for hue | `propertyeditor/utils.ts:46` | WFA-005 ✅ (locally) |
| F53 | **Closed by WFA-008, 2026-07-28.** **A trigger's configuration cannot be edited from either surface.** `PUT /admin/triggers/:id` exists and is tested, but neither the panel nor the canvas offers a form for it — changing a cron means delete-and-recreate, which for a webhook mints a new secret and breaks every sender. Not in WFA-005's scope (the spec asks for creation, enable/disable and delete) but it is the obvious next ask. **Richard's call, 2026-07-28: fold into phase 27 now, before WFA-007** — the secret loss is data-loss-shaped rather than polish, and WFA-005 already built the create form and target picker it reuses. Owned by **WFA-008** | `TriggersPanel.tsx` | WFA-008 |

### Found by WFA-006, 2026-07-28

| # | Finding | Where | Owner |
|---|---|---|---|
| F54 | **A deployed function was reported as missing, by a `.map(String)`.** `GET /admin/workflows` answers `functions: {name, workflow}[]` (`WorkflowRunnerStatus`), and `fetchTriggerTargets` read it as `status.functions.map(String)` — i.e. `["[object Object]"]`. So WFA-005's trigger target picker listed a placeholder instead of the function names, and `isTargetResolved` answered **false for a function that is deployed**: exactly the wrong-warning-about-a-working-trigger its own `null` state exists to prevent. Invisible in WFA-005's live pass because that backend had no functions deployed — its notes record the picker saying *"No functions on this backend"*. One reader now (`deployedFunctionNames`), shared with WFA-006's resolution and specced against the object shape the backend actually serves | `TriggerBackendClient.fetchTriggerTargets`; `models/workflow/functionRefResolution.ts` | WFA-006 ✅ |
| F55 | **Partly closed 2026-07-28 by deletion rather than by re-baselining.** Most of what the gate was counting was **twelve copies of the same three lines** — an `any` cast, its eslint-disable, and `window.require('electron').ipcRenderer` — written independently in twelve modules because `window.require` is Electron's and nothing types it. One `@noodl-utils/ipc` door later, `any` is **333, three BELOW the baseline**, and TSFixme is 554 (was 556). The baseline is deliberately **not** re-pinned: the ratchet itself warned that 31 uncommitted `.ts/.tsx` files from a concurrent session — including deletions — would be written into it as if they were part of this commit, and a baseline contaminated by someone else's half-finished work is worse than a red gate. Still red at **+14 TSFixme**, none of it from this session; needs a re-pin in a clean tree. Original finding: | `.tsfixme-baseline.json`; `utils/ipc.ts` | unowned (re-pin only) — **still blocked 2026-08-02, for the same reason and a sharper one.** The 2026-08-02 batch measured it properly: the ratchet reports 18 entries at the merge base and the **identical** 18 after merging all three branches, so this phase's work adds nothing to it — every marker belongs to other sessions' recent work. A re-pin needs a tree nobody else is dirtying, and the checkout has been shared all day. [OPEN-WORK.md](./OPEN-WORK.md) |
| F55 (as found) | **The TSFixme / `any` ratchet is red on `cline-dev`, and was red before WFA-006.** Measured, not assumed: `git archive HEAD` into a clean tree scores **TSFixme +16 / any +9** against a baseline pinned at `b22cfab0`, **48 commits back**. WFA-006 adds +1 and +1 (one `args: TSFixme` consistent with five sibling `TypeView`s, and the `(window as any).require('electron')` idiom every renderer client module uses). Deliberately **not** re-baselined by this task — that would launder 48 commits of unrelated drift into one commit, and PLAT-004's rule is to raise it deliberately and say so. Needs a re-baseline commit of its own | `.tsfixme-baseline.json`, `scripts/tsfixme-ratchet.js` | unowned |
| F56 | **A rename does not make a step "unresolved" — not immediately, and saying so would be its own wrong warning.** Success criterion 7 asks for `unresolved`; the backend is still serving the function under its **old name**, so the step still runs. What it shows is `deployed, not in this project`, and it becomes `unresolved` only when the next deploy removes the old name. Reproduced live end to end. This is not a defect but a correction to the spec's wording, and it is the strongest argument for §7's decision: an automatic fix-up at rename time would rewrite a **working** step | observed live; specced in both stages | WFA-006 ✅ (recorded) |
| F57 | **A property-panel checkbox row did not respond to a dispatched click at its own box.** The Request node's *Allow Unauthenticated* toggle reports a real 32×19 rect and a real `<input type=checkbox>`, and `Input.dispatchMouseEvent` at its centre changed nothing (the parameter stayed unset). Not workflow-specific — `PropertyPanelCheckbox` is used by every node type — and not investigated here beyond confirming the click landed. Worth knowing before the next pass tries to drive one | `PropertyPanelCheckbox`; observed live | unowned, and **still waiting on the one thing an agent cannot do: a human click.** Asked of Richard on 2026-08-02; until then it stays filed as unknown rather than as a bug, because "broken for a user" and "broken for a synthetic click" want opposite fixes and every future live pass needs to know which. [OPEN-WORK.md](./OPEN-WORK.md) |

### Found by WFA-008, 2026-07-28

| # | Finding | Where | Owner |
|---|---|---|---|
| F58 | **A `PUT` could change a trigger's TYPE, and the secret survived the change — then came back.** `upsert` rebuilds the definition from the input, so `{type:'schedule'}` on a webhook's id was accepted: the stored trigger lost its `webhook` block and its secret stayed in `secrets.json` under that id, orphaned (only `delete()` clears one). Morphing **back** to a webhook then **re-used that old secret** instead of minting — so a hook an operator believes is gone can return, credential intact, with nothing saying so. Observed against a real registry, not deduced. Refused in the registry (one rule for the panel, the canvas and MCP) rather than by clearing the secret on the way out, which would make morphing look supported while handing out a secret every sender is unaware of | `triggers/registry.ts` `upsert` | WFA-008 ✅ |
| F59 | **`PUT /admin/triggers/:id` on an unknown id CREATED it.** `upsert` is a true upsert and the route passed `ctx.params.id` straight in, so saving a form over a trigger deleted meanwhile silently resurrected it — same id, a **new** webhook secret (delete had removed the old one), a reset fire count, and **200** reported as a successful edit. Reachable from MCP's `update_backend_trigger` too. Now a 404 at the route, because `upsert` is legitimately an upsert (the boot path and `POST` use it) and the promise belongs to the HTTP verb | `server/admin-triggers.ts` `update` | WFA-008 ✅ |
| F60 | **A redraw of a canvas view tore down an unrelated panel, and the first version of it destroyed a webhook secret.** Two halves, both found live. (i) `ModelBindings`' `nodeAdded` handler **selects** a newly added node unless told not to, and selecting switches the sidebar to the property editor; the Triggers panel is *transient*, so switching away unmounts it — taking the banner holding the webhook's **one-time, unrecoverable** secret with it, one tick after creation. (ii) With that fixed, `nodeRemoved` → `clearSelection()` → `hidePanels()` still switched to `components` when the manual marker was removed, i.e. **removing a node nobody had selected** tore down a panel. Fixed as `disableSelect` on trigger nodes and, generally, by hiding the panels only when the removed node was the selected one. Not visible to a unit test of either the panel or the graph, because the damage lands in a third place | `views/nodegrapheditor/ModelBindings.ts`; `models/workflow/workflowTriggerNodes.ts` | WFA-008 ✅ |
| F61 | An **out-of-process** write does not reach an open canvas: the `TRIGGERS_CHANGED` broadcast lives on the renderer's write door (`TriggerBackendClient`), so a trigger changed by MCP or `curl` leaves the entry nodes stale until the Workflows panel refreshes. Observed deliberately. A backend-side signal (the `ChangeBus`/SSE pair BAK-001 and WF-005 already share) would close it for every surface at once | `models/triggers/TriggerBackendClient.ts` | unowned — accepted; wait for a second consumer of the same signal, [OPEN-WORK.md](./OPEN-WORK.md) |

### Found by the 2026-08-02 closing batch

Three tasks ran in parallel worktrees; these came out of building them and out of **merging** them,
which is not the same thing. Every red below was attributed by running the same gate at the merge
base — not assumed.

| # | Finding | Where | Owner |
|---|---|---|---|
| F62 | **`noodl.cloud.aggregate` cannot be configured or fired at all.** It carries four ports in the editor (`aggregates`, `fetched`, `failure`, `error`) and has no `collectionName`, no `Do` signal and no filter. WFA-009 found it while answering "what happens to the other node with this hook", and deliberately did **not** absorb it: giving it value-derived ports would furnish a node you still cannot run. It is a WFA-005-sized task of its own, and it belongs in the `AggregateRecordsAdapter` that already exists for the type | `noodl-viewer-cloud/src/nodes/data/aggregatenode.js`; `AggregateRecordsAdapter` | unowned — [OPEN-WORK.md](./OPEN-WORK.md) |
| F63 | **CI's `typecheck` job has been failing, and no branch has ever reached it.** `npm run typecheck` — `pr.yml`'s first step — reported 18 × `TS2307: Cannot find module '@noodl-versioning'`. The alias is declared in `packages/noodl-editor/tsconfig.json` and was never added to the root config, whose `paths` mirrors every other editor alias. Two entries make it exit 0 with zero diagnostics, so nothing was masked behind it. It survived because `pr.yml` runs on pull requests and on pushes to `main`/`cline-dev`, and this repo commits to `cline-dev` **without pushing** — so the job that would have caught it has never run. Fixed twice on 2026-08-02, independently and within the hour, by this batch and by a concurrent session | `tsconfig.json`; `.github/workflows/pr.yml:28` | ✅ fixed |
| F64 | **The merge made the node catalog stale, and neither branch could have seen it.** `catalog:check` is green at the merge base and green on `wt-wfa-009` alone, and red once merged: the catalog is generated from the live registries, and WFA-009 gave the two cloud nodes a `namedports/list` rule. Regenerating then makes `node-catalog-enriched.json` stale in turn, so `catalog:merge:check` goes red exactly as `catalog:check` goes green. Both regenerated, both diffs verified as the identical 27-line set. **The general rule this batch confirms: after merging, regenerate every artefact and require an empty diff** — textual conflict-freedom proves nothing about a generated file | `packages/noodl-types/src/node-catalog*.json` | ✅ fixed in the merge, not on either branch |
| F65 | **Three suites are red on `cline-dev` and have nothing to do with this phase**, verified by running them at the merge base: `nodegx-backend`'s `email-flows.test.ts` (2 tests, 30s timeouts in the Send Email node's `WorkflowRunner` integration) and `noodl-mcp`'s `tools.test.ts` (`create_component validates, writes and updates the registry`). Both are in `test:packages`, which is a CI job — so that job is red for everyone, for the same reason F63 went unnoticed | `packages/nodegx-backend/tests/email-flows.test.ts`; `packages/noodl-mcp/tests/tools.test.ts` | unowned — [OPEN-WORK.md](./OPEN-WORK.md) |

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

- ~~**Should the workflow canvas be a third `RuntimeType`, or a separate document type?**~~
  **Decided by WFA-004, 2026-07-28 — both, for different things.** A workflow is its own document
  type, rendered through a `ComponentModel` adapter that is never handed to `ProjectModel`; the
  third `RuntimeType` is added for the node LIBRARY, which is what filters the picker. The question
  conflated two things with different answers, and separating them was the decision. Reasoning in
  [WFA-004-ASSESSMENT.md](./WFA-004-ASSESSMENT.md) §1.
- ~~**Where do workflows live in the tree?**~~ **Decided by WFA-004 — not in the tree at all.** They
  are listed in their own **Workflows** panel, grouped by the backend they belong to, beside Execution
  History rather than beside the project's components — because they are not project components, and
  WFA-001 already established that flattening two *runtimes* into one tree namespace is a bug. A
  `git clone` brings none: what you see depends entirely on which backend the editor is pointed at.
  The interaction with DEP-002/DEP-005 stands and is **not solved here**: a deployed app does not
  carry its workflows, the canvas names its backend at all times, and "promote these workflows to the
  production backend" is a phase-26 conversation rather than an export button that writes a file
  nothing reads. Reasoning in [WFA-004-ASSESSMENT.md](./WFA-004-ASSESSMENT.md) §1c.
- ~~**Does an empty palette read as broken?**~~ **Handled by WFA-004** — with no backend running
  the Workflows panel says *"Start a backend to author workflows"* and explains that a workflow
  lives in a backend's data directory rather than in the project. Nothing is bundled: the step-kind
  catalog is fetched per backend, and the condition editor says so rather than guessing when a
  backend is too old to describe its own operator set (F42).
- ~~**Does auto-layout need to be stable across re-opens?**~~ **Decided by WFA-004 — positions
  persist, on the step.** A workflow definition is the only artefact a workflow has, so no
  repository carries a layout beside it and editor-local positions would lose the arrangement for
  every collaborator. Auto-layout is deterministic, so a workflow with no positions is readable
  rather than random, and a step added with none is placed clear of everything already arranged
  without moving any of it.
- ~~**Is `for-each` legible on a canvas without a sub-graph?**~~ **Answered by the WFA-004 live pass
  — yes, because of the sub-label.** The card is titled *Each order line* with a second line reading
  `For Each · chargeLine`: the per-item function is named on the card itself, beside its `empty` /
  `nonempty` routes. Nothing about it suggests a container to descend into, so the n8n expectation is
  never set up and then broken. Descending into `chargeLine` is WFA-006, and the card already names
  what WFA-006 will open.
- **Should WFA-001 deploy functions on save, on backend start, or on an explicit button?** On-save is
  the best feel and the worst failure mode (a broken function silently replaces a working one on a
  running backend). WFA-001 decides; whatever it picks must be visible in the UI.

## Log

- **2026-07-28** — **WFA-008 complete** (F53 closed). The task was worth doing for one verified fact
  and it earned its keep by two the check turned up. **`upsert` keeps a webhook's secret** — a `PUT`
  that changed a token hook's name and target returned no secret, left `getWebhookSecret` byte-identical
  and preserved `createdAt` — which is exactly what delete-and-recreate cannot promise, and the whole
  argument for the feature. The same probe found that a `PUT` could change a trigger's **type**,
  orphaning the secret in `secrets.json` and silently **re-using it** if the type was changed back
  (F58), and that a `PUT` to a **deleted** id recreated the trigger with a fresh secret, a reset fire
  count and a 200 (F59) — both reachable from MCP, both now refused where the rule belongs rather than
  guarded in one caller.
  **The §1 decision is one form, in the panel, with a door from the canvas.** The fields are the create
  form's, extracted so a field cannot reach one path and miss the other; the canvas node offers *Edit
  this trigger…* rather than growing a second form on a surface whose rows are deliberately prose
  (`"No — this trigger will not fire"`) and which has nowhere to put a three-line 400. Three rules make
  an edit safe, and all three are structural rather than defensive: the form **never sends `secret`**
  (sending it *is* rotation, which is now its own verb with its own confirmation), **never sends
  `enabled`** (absent means keep, so a save cannot re-enable what someone turned off), and **re-reads
  before it writes** — usable because `updatedAt` moves for a configuration change and *not* for a
  fire, so a hook firing every minute does not read as somebody editing it.
  **The walker audit paid for itself twice.** The set of trigger entry nodes was not new; what is new
  is that a member can change identity-relevant fields in place — so a *re-targeted* trigger has to
  leave one workflow's canvas and appear on another's, and nothing was telling `refreshTriggers` that
  anything had happened. Closed as a rule (the write door broadcasts) rather than per caller.
  **And the live pass found two defects in the redraw this task added, the first of which destroyed a
  one-time secret** (F60): adding a node selects it, selecting switches the sidebar, and the Triggers
  panel is transient — so the webhook's unrecoverable secret was unmounted one tick after it was
  created. The second arrived through the same redraw's *removal* half. Neither is visible to a unit
  test of the panel or of the graph, because the damage lands in the sidebar.
  **The criterion was driven with the hook itself**: fired before the edit (ran *Both Ways*),
  re-targeted from the canvas, fired again **with the same secret** — 200 by header and by Bearer,
  running *Order Pipeline* — a wrong secret 401, then a rotation making the old secret 401 and the new
  one 200, and a slug change moving the URL (old **404**) while the credential stayed valid at the new
  address. Backend **67 suites / 728** (was 66 / 715), editor **1851 / 0** (was 1823), typecheck clean.
  Full pass in [WFA-008-NOTES.md](./WFA-008-NOTES.md), decisions in
  [WFA-008-ASSESSMENT.md](./WFA-008-ASSESSMENT.md).

- **2026-07-28** — **WFA-006 complete.** The task is one idea applied consistently: **a workflow step
  and a cloud function live in different stores and are allowed to disagree**, so the resolver keeps
  *two* facts — `inProject` (always knowable) and `deployed` (`true | false | null`, WFA-005's third
  value reused rather than reinvented) — and never collapses them, because the difference between
  them is the thing the user needs to see. Four states follow, and the discipline is in what is
  **not** a warning: `deployed, not in this project` is a legitimate state and `the backend could not
  be asked` is an unanswered question, so neither draws a danger ring, and the second says nothing on
  the card at all until an answer arrives.
  **Nothing in the canvas learned the word "workflow".** The descent rides one hook shaped like
  WFA-004's context-menu one; the crumb back is a normal trail item carrying the workflow's own
  adapter, prepended in `OverlayViews` from a pointer that self-clears by matching on the function it
  landed on; the danger ring is `WarningsModel`, which the painter already reads — **no painter
  change**. The shared trail component gained one optional slot, and an ordinary component's trail
  takes the code path it took before (re-checked live). F48 is closed as a *rule* — workflows are
  kept out of `NavigationHistory` by runtime type, not by every caller remembering.
  **Two findings before a line was written, from reading and from measuring.** `fetchTriggerTargets`
  read the deployed-function list as `.map(String)` over `{name, workflow}` objects, so WFA-005's
  picker listed `[object Object]` and `isTargetResolved` called a **deployed** function missing —
  invisible in that pass only because the backend had no functions (F54). And the marker ratchet is
  red on this branch independent of this task, by +16/+9, with a baseline 48 commits stale (F55).
  **§7's decision was recorded before building and then corrected by its own test.** A rename does
  not rewrite backend-held definitions — six reasons, the first being that `projectIds` is dead so
  "this project's backends" is *every* running backend. Writing the test showed the spec's criterion
  7 was wrong in a way that mattered: right after a rename the step is `deployed, not in this
  project` and **still works**, because the backend still serves the old name; `unresolved` arrives
  with the next deploy (F56). Which is the strongest argument for the decision.
  **The live pass drove the phase's thesis end to end.** Same workflow, same payload, twice: `charge`
  **ERROR** (`Function "chargeCard" returned HTTP 500`, 2 attempts, *Error routed to Log failure*) →
  descend into the function from its own step → edit → **Deploy** from the function's trail → run →
  `charge` **SUCCESS**, 1 attempt, badges pinned on the workflow canvas. Without leaving the editor.
  The pass also found a defect in this task's own property-editor row — it painted the **old** name
  beside the **new** name's answer, because it cached the value and nothing re-rendered it when the
  value changed from elsewhere; and verifying the fix needed a clean restart, HMR having kept
  `Ports.ts` handing out the previous class. Editor **1823 / 0** (was 1791), backend **66 / 715**
  unchanged (editor-only), typecheck clean. Full pass in [WFA-006-NOTES.md](./WFA-006-NOTES.md),
  decisions in [WFA-006-ASSESSMENT.md](./WFA-006-ASSESSMENT.md).

- **2026-07-28** — **WFA-005 complete.** The spec's implementation order earned its keep:
  **F8 was never about `payload`.** Reproduced live before anything changed, an unknown key
  was silently dropped at *every* level — top level, `target`, `schedule`, `webhook`,
  `dbChange` — all answered **201**, while the same key in `triggers.json` refuses to let
  the service start. The cause is one line of shape: `upsert` reconstructs a `TriggerDef`
  field-by-field from the input and then validates *the reconstruction*, so validating the
  write path could only ever confirm that `upsert` copied correctly. The key sets now live
  in one place and `validateTriggerInput` checks what the caller sent **before any of it is
  copied**, with every value rule left where it was — one description of a valid trigger,
  and the new strictness on the write path only, so a `triggers.json` that boots today
  still boots. Adding the field first would have hidden the class, which is exactly what
  the spec said.
  **F7's exemption is scoped by the matched route's own declared access kind**
  (`{kind:'webhook'}`), not by a path prefix: `matchRoute` has already run, nothing about
  the request can steer it, and reaching a second route through it would take adding that
  route to the family deliberately. An admin token gains nothing — on a hook it arrives
  anonymous and is compared against *that hook's* secret. Two consequences the finding did
  not list, both read off the live execution log: the Bearer rejection produced **no
  execution record at all** (refused before the handler, so the loud-rejection behaviour
  never ran) and it **fed BAK-005's auth lockout**, so a retrying third-party service
  walked itself into a 429 for every route (F50).
  **F9 was two defects in one number** — a hardcoded target kind and a free-text name —
  and both halves are now chosen from what the backend actually has, with free text still
  permitted and flagged rather than accepted silently. Triggers draw as **entry nodes** on
  the workflow canvas, and the whole design is about keeping "this is a view of a backend
  object" true: a trigger is not a step to `kindFromTypeName`, so `toInput` cannot write
  one into a definition; the nodes are added before the dirty listener exists, so a
  workflow does not open unsaved because something triggers it; and the types are
  `singleton`, so the canvas will not delete or copy them — the real actions are on the
  node's menu, because canvas delete is undoable and deleting a backend object is not.
  Drawing them immediately caused **the F49 shape again**: the `$path` picker offered a
  trigger as an upstream *step*, which produces a definition the backend rejects with a
  400, and `syncEntry` would have promoted the wrong step (F51). Caught in minutes by
  WFA-004's own "node ids are step ids" spec.
  **F47 folded in on Richard's call**, which also closes F34's "unowned for the others":
  one `backend:statusChanged` broadcast — including on an *unexpected exit*, the state that
  was previously invisible because a crashed backend left every panel describing a running
  one — and one hook, adopted by three panels.
  **The live pass drove the phase-19 exit clause end to end.** One definition, one webhook
  trigger and one schedule trigger, and the branch takes a **different route** for each:
  the schedule's payload arrives as `body` and picks `nightly`, the webhook's JSON picks
  `adhoc`. That comparison was impossible before F8. All three token transports returned
  200 against the URL copied off the panel; a wrong secret and an admin token were both
  refused with the webhook's own message; the Workflows panel noticed a backend starting
  with no Refresh press. One thing only a screenshot could find: the property editor's
  header chip names a colour as if it were a category, so a webhook read `· DATA` (F52).
  Backend **66 suites / 715** (was 65 / 683), editor **1791 / 0** (was 1767), typecheck
  clean. Full pass in [WFA-005-NOTES.md](./WFA-005-NOTES.md).

- **2026-07-28** — **WFA-004 complete.** The live pass closed it, and it earned its keep: **one
  `switch` step made an entire workflow fail to open** (F49), and the click that opened it appeared to
  do nothing at all. `buildGraph` announced a step's dynamic ports *before* putting the step in the
  graph, and `ViewerConnection`'s `Model.instancePortsChanged` handler — the one sibling F44 missed,
  and the one with no workflow filter — read through the missing graph and threw a `TypeError` that
  escaped all the way out of `WorkflowDocument.open`. The editor suite already built a `switch` step
  and passed, because no `ViewerConnection` is constructed there; the new spec therefore asserts the
  **invariant** (a node has an owner when it announces its ports) rather than re-testing one listener.
  A green suite proved nothing about this, which is exactly the claim this phase's verification
  posture makes.
  **Every success criterion driven in the running editor.** Node ids are step ids and WFA-002's
  overlay lands on this canvas **with no modification** — confirmed badge-by-badge, each one sitting
  at its own step's card corner, which closes F32's "the badges have never had anything to draw".
  A condition edited through three controls (`gt 100` → `250`) survived Save → close → reopen and was
  read back off the backend, with the per-step `ui` positions beside it. A workflow was built from
  scratch — right-click an empty canvas, palette offering **exactly the nine step kinds and nothing
  else** (the third `RuntimeType` doing its job with no filtering code in the picker), a step inserted
  with the id `wait` rather than a guid — then saved and run, with the overlay reporting *success* and
  `✓ 28 ms`. Its **first** save was *refused* — `step "wait".params.duration must be a number > 0`,
  the backend validator's own words in the panel — which is the boot-refusal trap closed by
  demonstration rather than by argument. Drawing a cycle is refused live with a sentence about DAGs;
  the `$path` picker offers the served scope roots and the concrete predecessor **Receive order**
  (F46 re-verified). All nine kinds screenshotted in **both themes**, repainting through
  `nodegx:themechanged`, with the `onError` edge red *and* dashed so it survives greyscale; the
  hex-literal check over the 17 new files is **zero**.
  **The `for-each` question is answered: yes, it reads as one node**, because the card's second line
  names the function it iterates (`For Each · chargeLine`) — it never sets up the n8n expectation of a
  container, and it already names what WFA-006 will open. Editor suite **1767/0**, backend
  **65 / 683**, typecheck clean. F47 (no backend-started event in the renderer) is left as a residual
  beside F34 — closing it properly would fix three panels at once, which is the argument for doing it
  once. Full pass, including the CDP driving notes that cost this session two hours, in
  [WFA-004-NOTES.md](./WFA-004-NOTES.md).

- **2026-07-28** — **WFA-004 in progress.** The §1 decision was taken and written down before any
  canvas code, and it separates two questions the spec asked as one: **a workflow is its own
  document type** (not a project component — no ports, not instantiable, not in the project, not in
  git, not in an export, not deployed), while **a third `RuntimeType` is added for the node
  library**, which is the job `RuntimeType` already does. The canvas has one door —
  `switchToComponent(ComponentModel)` — so a workflow reaches it through an adapter that is
  deliberately never handed to `ProjectModel`. The walk that produced that decision found **13
  existing seams and exactly two shared-painter edits**, so the escalate branch of reuse-or-escalate
  was not taken.
  The reuse thesis is **proven live**: the phase-19 test workflow (six steps, a branch, a retry, an
  error route and a merge) opens from a new Workflows panel and draws on the existing canvas, with
  `ontrue`/`onfalse` written on the wires, the `onError` edge in the danger token *and* dashed,
  `Retry · chargeCard` as the card's second line, and **canvas node ids that are step ids with no
  mapping table anywhere** — the identity WFA-002's overlay depends on. A condition edits as three
  controls with `all`/`any` groups, and an operand is a literal or a reference chosen from a picker
  over the steps that can genuinely have run first.
  **Three things the spec did not anticipate.** The catalog had to grow: rendering an operator
  dropdown means having the operator list, and an editor holding its own copy of a closed set can
  offer one the backend cannot evaluate — so `conditionLanguage` is served and the version went
  1.1.0 → **1.2.0** (F42). `NodeLibraryImporter.mergeUpdates` is additive, so a second backend's
  catalog would have left the first backend's params under the second backend's names — a workflow
  library is now *replaced*, not merged (F43). And `Model.*` events are broadcast globally, so a
  workflow's graph reached every `ViewerConnection` handler; only `Model.nodeAdded` checked project
  ownership, and its siblings would have sent the viewer updates naming a component it has never
  heard of (F44). Positions live on the step rather than in editor-local storage, because a
  definition is the only artefact a workflow has and no repository carries a layout beside it (F45).
  Backend suite **65 suites / 683 passed**, including 11 new specs read off a **real running
  service**. `docs/runtime/WORKFLOW-NODES.md` no longer describes a surface that does not exist
  (F10 closed), and the coverage gate now fails if it ever does again. **Not yet done:** the save
  and run-and-pin gestures live, the overlay-badge confirmation, and the all-nine-kinds/both-themes
  pass. Full state in [WFA-004-NOTES.md](./WFA-004-NOTES.md).

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
