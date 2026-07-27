# WFA-002: The Run Inspector

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WFA-002 |
| **Phase** | Phase 27 — Visual Backend Authoring (Track L) |
| **Tier** | 1 — reconnect |
| **Priority** | 🟠 High (the cheapest ownership win in the phase; ships before any canvas) |
| **Difficulty** | 🟢 Low–Medium — most of it exists and is switched off; the care is in the parts that were never fed real data |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | none (WFA-001 gives it richer subjects, but is not required) |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — small surface, high visibility, and the whole value is in what it looks like when you use it |

## Objective

Let someone watch a workflow or cloud function run — step by step, with the real data that went in and
came out of each step — without leaving the editor. This is the capability that makes an AI-authored
workflow *yours*: you did not write it, but you can see exactly what it did.

## Background

WF-006 built a complete run inspector and WF-004 fed it real data. It is not reachable.

**What exists** (findings F15–F19):

| Piece | File | What it does |
|---|---|---|
| `ExecutionOverlay` | `views/CanvasOverlays/ExecutionOverlay/ExecutionOverlay.tsx` | Canvas-space transform container + fixed header/timeline |
| `ExecutionNodeBadge` | same folder | Status badge positioned at a node's bounds |
| `ExecutionDataPopup` | same folder | Input data, output data, error message, timing for the selected step |
| `ExecutionTimeline` | same folder | Scrubber: prev / range / status-coloured step dots / next |
| `ExecutionHistoryPanel` | `views/panels/ExecutionHistoryPanel/` | List + detail, with "Pin to Canvas" emitting `execution:pinToCanvas` |
| The data | `GET /executions`, `GET /executions/:id` | Merged across every running backend plus the editor-local store (WF-004) |

**Why it is dark:**

- The panel is registered `experimental: true`
  ([`router.setup.ts:232`](../../../packages/noodl-editor/src/editor/src/router.setup.ts#L232)), so it
  has no rail slot unless a user finds the experimental-panels list in editor settings.
- Cloud functions were unreachable (WFA-001), so in practice nothing produced executions a user could
  have pinned to a canvas they were looking at.
- Workflow executions were never rendered by it at all. WF-002 flagged exactly this: "the new
  `nodeType` vocabulary (`branch`, `for-each:perItem`, …) is untested against the overlay's renderer."

**The finding that makes this task cheap.** The overlay keys on `step.nodeId` and asks the canvas for
that node's bounds ([`ExecutionOverlay.tsx:38,77`](../../../packages/noodl-editor/src/editor/src/views/CanvasOverlays/ExecutionOverlay/ExecutionOverlay.tsx#L38),
bounds from `OverlayViews.ts:100` via `nodegrapheditor.ts:340`). The workflow engine writes the
workflow's **own step ids** there. A live run recorded:

```
0  save         function:saveOrder       success   4ms
1  decide       branch                   success   1ms
2  charge       retry:chargeCard         error    62ms   failed after 3 attempt(s)
3  notifySmall  function:notifyBigOrder  skipped     —
4  notifyBig    function:notifyBigOrder  skipped     —
5  logfail      function:logFailure      success   3ms
6  tally        merge                    success   1ms
7  count        function:countOrders     success   3ms
```

Each record carries `nodeId`, `nodeType`, `stepIndex`, `startedAt`, `completedAt`, `durationMs`,
`status`, `inputData`, `outputData`. That is everything the overlay renders, already in the shape it
wants.

## Current State

| File | State |
|---|---|
| `router.setup.ts:232` | `experimental: true` on the `execution-history` panel |
| `ExecutionHistoryPanel.tsx:24,41` | "Pin to Canvas" → `EventDispatcher.emit('execution:pinToCanvas', {execution})` |
| `ExecutionOverlay.tsx` | Renders badges for `nodeId`s the canvas can locate; silently renders nothing for ones it cannot |
| `OverlayViews.ts:100` | `getNodeBounds(nodeId)` — resolves against the **currently open graph** |
| `nodegx-backend` `/executions` | Real records for both function calls and workflow runs, including `skipped` steps |

## Desired State

### 1. The panel is a normal panel

Remove `experimental: true` from the `execution-history` registration. It has a main-process handler,
real data, and a working detail view — the flag is a leftover from when none of that was true. Give it
a description that says what it is for in one line.

### 2. Workflow executions render

The panel already lists them (`workflowName` is populated). The detail view must handle a workflow
execution as a first-class subject:

- The step table shows `stepIndex`, `nodeId`, `nodeType`, `status`, `durationMs`, and the error
  message for failed steps.
- **`skipped` is rendered, not hidden.** It is the single most useful piece of information when
  debugging a branch — "the charge step did not run because the condition was false" is exactly what
  a user needs to see, and the engine records it deliberately rather than omitting it.
- A failed step shows its error with the fields the engine actually provides —
  `{message, name, statusCode, step}` — and the handler step that received it shows that same object
  arriving in its `inputData.previous.error`. Making that link visible is most of the value of the
  whole panel.
- `retry:*` steps show the attempt count from the step output (`attempts`, `retried`).

### 3. The overlay tolerates unknown nodes

`getNodeBounds` resolves against the currently open graph. Pinning a workflow execution while a
browser component is open finds nothing and renders an empty overlay — indistinguishable from a bug.

- If **no** step in a pinned execution resolves to a node in the open graph, say so: "This execution
  ran on *Order Pipeline*, which is not open." Offer to open it if there is something to open (there
  will not be until WFA-004; until then, the message is the deliverable).
- If **some** resolve, render those and state how many did not. A partial overlay that silently drops
  half the steps is worse than one that admits it.

### 4. Run it from here

A "Run" affordance in the panel for a workflow definition, posting to
`POST /admin/workflow-defs/:id/run` with an editable JSON payload, and selecting the resulting
execution when it returns. Round-tripping through `curl` to test a change is the friction this phase
exists to remove, and this is four lines of IPC over routes that already exist.

Cancel likewise, where a run is in flight: `POST /admin/workflow-runs/:executionId/cancel` exists and
was proven to work on a run parked in a 5-minute `wait`.

### 5. It survives having nothing to show

Empty states for: no backend running, backend running with no executions, and an execution whose
backend has since stopped. Each says which of the three it is.

## Implementation Steps

1. **Look at it first.** Start a backend, produce a few executions (a success, a failure with an error
   route, one with a `skipped` branch), open the panel via the experimental-panels setting, and
   screenshot what renders today. Everything after this is a diff against that baseline, and the
   baseline belongs in `WFA-002-NOTES.md`.
2. **Un-flag the panel.**
3. **Workflow execution detail** — step table, skipped rows, the error→`previous.error` link.
4. **Overlay resolution honesty** — the all/some/none cases.
5. **Run and cancel** from the panel.
6. **Empty states.**
7. **Live pass**: pin a *cloud function* execution to that function's canvas (requires WFA-001; if it
   has not landed, note this as unverified rather than claiming it) and step the timeline through it
   with the data popup open. Screenshot.

## Success Criteria

- [ ] The Execution History panel is in the sidebar rail without touching experimental settings.
- [ ] A workflow execution's detail shows every step including `skipped` ones, in DAG order.
- [ ] A failed step's error object is visible, and the handler step that received it visibly shows the
      same object under `previous.error`.
- [ ] A `retry` step shows how many attempts it made.
- [ ] Pinning an execution whose steps do not match the open graph produces an explanation, not an
      empty overlay.
- [ ] A workflow can be run and cancelled from the panel, and the resulting execution is selected.
- [ ] All three empty states are distinguishable.
- [ ] Screenshots of the timeline being scrubbed with the data popup open, before and after.

## Out of Scope

- **Live/streaming execution.** Records are read after the fact. A run in flight can be polled; a
  push channel is not in this task.
- **Editing anything.** This is a read surface, plus run/cancel.
- **Making the overlay work over a workflow canvas.** There is no workflow canvas until WFA-004. This
  task makes the overlay *honest* about that; WFA-004 makes it *work*.
- **Retention, pruning or export of execution history.** BAK-009 owns ops concerns.

## Traps

- **The overlay renders nothing when it cannot resolve a node, with no error.** That is the exact
  failure this task must convert into a message; do not add the message in a place that only fires
  when the overlay is already rendering.
- **Execution history is merged across every running backend plus the editor-local store** (WF-004).
  Two backends running the same-named function produce records that look identical apart from
  `backendId`. Show it.
- **`GET /executions` returns a bare array; `GET /executions/:id` returns an object.** Observed live —
  do not assume a consistent envelope.
- **Step `durationMs` is null for skipped steps.** Rendering `nullms` is the obvious bug here.
- **`triggerData` contains request headers.** They are scrubbed by WF-006's `scrub.ts` before storage,
  but confirm what actually reaches the panel before rendering it wholesale — this view is a
  screenshot away from a support ticket containing someone's token.
- **The panel's IPC merges over HTTP.** A backend that stopped mid-request produces a partial list;
  make sure that reads as "one backend is unreachable", not as an empty history.
