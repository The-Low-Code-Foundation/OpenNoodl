# Phase 27 — Visual Backend Authoring (Track L): Progress

**Status:** 📋 Specced, not started — 0 / 7
**Specced:** 2026-07-27, from a live end-to-end test of phase 19's workflow engine
**Phase overview:** [README.md](./README.md)

## Status vocabulary

Not started · In progress · **Built–not wired** · Complete · Superseded

## Task status

| ID | Title | Tier | Status | Landed | Notes |
|---|---|---|---|---|---|
| [WFA-001](./WFA-001-CLOUD-FUNCTIONS-RECONNECTED.md) | Cloud functions, reconnected | 1 | ⬜ Not started | — | A **regression against old Noodl**, not a new feature. Four cuts, all small; the deploy wire is the substantive half |
| [WFA-002](./WFA-002-RUN-INSPECTOR.md) | The run inspector | 1 | ⬜ Not started | — | Mostly switching on what WF-006 built. Independent of the canvas |
| [WFA-003](./WFA-003-STEP-DATA-MAPPING.md) | Step data mapping & one payload shape | 2 | ⬜ Not started | — | Prerequisite for WFA-004. Backend-only; no editor work |
| [WFA-004](./WFA-004-WORKFLOW-CANVAS.md) | The workflow canvas | 3 | ⬜ Not started | — | The big one. Reuse-or-escalate is the governing rule |
| [WFA-005](./WFA-005-TRIGGERS-ON-CANVAS.md) | Triggers as canvas entry nodes | 3 | ⬜ Not started | — | Carries shipped defects F7 and F8 |
| [WFA-006](./WFA-006-STEP-TO-FUNCTION-DESCENT.md) | Descend from a step into its function graph | 3 | ⬜ Not started | — | What makes the two tiers feel like one language |
| [WFA-007](./WFA-007-AI-PROPOSES-ONTO-CANVAS.md) | AI proposes workflows onto the canvas | 4 | ⬜ Not started | — | Adds no AI capability; adds a review surface |

## Findings register

Established on 2026-07-27 by **running** the backend and the editor, not by reading alone. Every row
below was observed live unless marked *(read)*. Executors should re-confirm the live symptom before
building around a finding — if one turns out to be stale, correct it here rather than implementing
around the description.

### The editor cannot reach the backend at all

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

### The data model

| # | Finding | Where | Owner |
|---|---|---|---|
| F11 | A step's input is `{...runPayload, ...step.params, previous}` and `params` are **static literals** — no `$path` resolution. There is no way to feed one step's output into the next step's function parameters | `WorkflowEngine.ts:397`; contract described at `StepExecutor.ts:30` | WFA-003 |
| F12 | The three entry points deliver **three different payload shapes**: webhook `{trigger, triggerId, slug, headers, query, body}` (`HttpServer.ts:1875`), schedule `{trigger, triggerId, firedAt, cron}`, manual `{trigger:'manual', triggerId, ...body}` (`admin-triggers.ts:121`), admin run `body.payload \|\| body` (`admin-workflows.ts:107`). A workflow authored against one breaks under another | as listed | WFA-003 |
| F13 | Observed consequence of F11+F12: a workflow that worked from `POST /admin/workflow-defs/:id/run` failed from the same webhook with `Cannot order-compare undefined and 100`. The failure was **loud and precise**, which is the engine behaving correctly | live run `exec_ms3nr5vsuzmckc05` | WFA-003 |
| F14 | Working around F11 today means each cloud function resolves its own source with a JS node (`previous.result ?? body ?? Inputs`). Functional, but every function carries adapter code | test fixtures, 2026-07-27 | WFA-003 |

### What already exists and is worth reusing

| # | Finding | Where | Owner |
|---|---|---|---|
| F15 | `ExecutionOverlay` keys on `step.nodeId → getNodeBounds(nodeId)`, and the workflow engine writes the **workflow's own step ids** into that field (`save`, `decide`, `charge`). A canvas using step ids as node ids gets the overlay unmodified | `ExecutionOverlay.tsx:38,77`; bounds from `OverlayViews.ts:100` via `nodegrapheditor.ts:340` | WFA-002, WFA-004 |
| F16 | The overlay is a complete run inspector already: `ExecutionNodeBadge` (status at node bounds), `ExecutionDataPopup` (input/output/error/timing), `ExecutionTimeline` (scrubber that steps through a run) | `views/CanvasOverlays/ExecutionOverlay/` | WFA-002 |
| F17 | "Pin to Canvas" already exists — `ExecutionDetail` emits `execution:pinToCanvas` over `EventDispatcher` with the full execution including steps | `ExecutionHistoryPanel.tsx:24,41` | WFA-002 |
| F18 | The Execution History panel is registered `experimental: true`, so it is **not in the sidebar rail** by default | `router.setup.ts:232` | WFA-002 |
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
