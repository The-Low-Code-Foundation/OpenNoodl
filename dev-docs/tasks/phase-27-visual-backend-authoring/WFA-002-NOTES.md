# WFA-002 — Notes

**Task:** [WFA-002-RUN-INSPECTOR.md](./WFA-002-RUN-INSPECTOR.md) · **Landed:** 2026-07-28 · **Phase:** 27, task 2 of 7

The run inspector is reachable, honest about what it cannot show, and can run and cancel a workflow
without leaving the editor. The spec was right that most of it existed and was switched off. It was
wrong about one load-bearing thing, and finding that out changed the shape of the task — see
**Finding 2** below.

## The baseline, measured before touching anything

Screenshots in the session scratchpad (`before-01`…`before-04`). Setup: a `nodegx-backend` started
from the Backend Services panel, three workflow definitions posted to `/admin/workflow-defs`, and runs
producing a success, a routed failure and skipped branches. The panel was opened by setting
`experimental.panel.execution-history` in editor settings.

What already worked, and worked well:

- The list rendered workflow runs and cloud function calls together, merged across the backend and the
  editor-local store, newest first.
- The detail view rendered **all six steps in DAG order, including the skipped one**, with expandable
  input/output/error. WF-002's worry that "the new `nodeType` vocabulary is untested against the
  overlay's renderer" turned out to be unfounded — `branch`, `retry:chargeCard` and `merge` all
  rendered fine.
- Pin to Canvas worked: the overlay mounted, the header showed the workflow name and status, and the
  timeline showed six status-coloured dots and `Step 6 / 6`.

What was wrong was narrower and sharper than "it needs building":

| Baseline defect | Why it matters |
|---|---|
| **The pinned overlay drew nothing at all**, with a header and a working timeline over an untouched canvas | Indistinguishable from a broken overlay. This is the spec's headline trap and it reproduced exactly. |
| A **skipped** step and a **0 ms successful** step both rendered `—` with a grey/green dot and no word | The one thing a branch debugger must not blur. See Finding 1. |
| No step showed its `nodeId` | The step id is what the overlay keys on and what a workflow definition is written in. |
| No source | Two backends running the same-named workflow produced identical-looking rows. |
| No run, no cancel | Testing a change meant `curl` with an admin token read out of `secrets.json`. |
| One empty state for three situations | "No backend running", "backend running, nothing has run", "the backend that had your runs is unreachable". |

## Findings

### Finding 1 — a 0 ms step read as "no duration"

`ExecutionStore.rowToStep` / `rowToExecution` converted nullable numeric columns with
`(row.duration_ms as number) || undefined`, which folds a genuine **0** into "absent". On a local
backend most steps finish sub-millisecond, so the `branch` step in every observed run reported `—`,
exactly like the `skipped` step two rows below it. A run inspector whose duration column cannot
distinguish "did not run" from "ran instantly" is worse than one with no duration column.

Fixed with a `nullableNumber` helper in `packages/noodl-viewer-cloud/src/execution-history/store.ts`
(shared with the backend, so it fixes the served `/executions` payload too). The panel additionally
renders `—` for `skipped` regardless, because a skipped step really has no duration.

### Finding 2 — cloud function runs record **zero** steps, so the overlay can never place a badge

This one reframes the task. `ExecutionLogger.startNode` — the only thing that writes step records — is
called from exactly one place in the whole repo: `WorkflowEngine.ts:406`. Nothing in the cloud runtime
records a function's graph nodes individually. Verified against the three `saveOrder` webhook
executions WFA-001's live pass left behind: `steps: 0`, every time.

Consequences:

- A **cloud function** execution has no steps, so there is nothing to put on its canvas. The spec's
  Implementation Step 7 — "pin a *cloud function* execution to that function's canvas and step the
  timeline through it" — **cannot be done**, and not because WFA-001 had not landed. There is no data.
- A **workflow** run has steps, but their `nodeId`s are workflow step ids, which no canvas contains
  until WFA-004 builds one.

So today the overlay's node badges can *never* resolve. Finding F15 (the overlay keys on step ids and
the engine writes step ids) stays true and stays the reason WFA-004 gets the overlay free. Finding F16
("the overlay is a complete run inspector already") is true only of workflow runs, and only once
there is a canvas to draw them on.

That makes the honesty message not an edge case but the overlay's normal output, so it is written as
two distinct statements rather than one:

- **no steps recorded at all** → "This run recorded no steps… Only workflow runs record steps today —
  a cloud function call records the call itself, not its individual nodes."
- **steps exist, none match the open graph** → "This execution ran on *Order Pipeline*. None of its 6
  steps matches a node in the graph you have open…"

The panel's step list says the same thing in the same words when a run has no steps, instead of the
old bare "No steps recorded" — which read as data loss rather than as the shape of the data.

### Finding 3 — a long run reads as a failed run

`POST /admin/workflow-defs/:id/run` answers only when the run **finishes**, and every
`ServiceSupervisor.request` carries a hard `AbortSignal.timeout(30000)`. A workflow with a `wait` step
longer than that therefore surfaces in the editor as `TimeoutError: The operation was aborted due to
timeout` — observed live on a 5-minute wait — while the run is perfectly healthy and still going.

Raising the ceiling only moves the lie further out, so `runWorkflowDef` catches the abort and returns
`{ stillRunning: true }`. The panel treats that as dispatched-and-running, not as an error. This is
also what makes cancel reachable at all: the run's record is written as the run *starts*, so a
refresh puts the in-flight row in the list where it can be opened and cancelled while the original
request is still outstanding.

### Finding 4 — the sidebar keeps panels mounted but hidden, so they go stale silently

`SidebarModel.setActivePanel` caches the panel element and the inactive panel is hidden
(`offsetParent === null`, width 0), not unmounted. So switching away and back does **not** remount and
does **not** refetch. Found live: open the panel, start a backend from Backend Services, come back —
still "No backend is running" until Refresh was pressed.

Fixed for this panel with a `SidebarModelEvent.activeChanged` listener that refetches when it becomes
active. This is a general hazard for any panel whose subject is another process's state; the Backend
Services and Triggers panels are worth checking against it.

### Finding 5 — the in-flight row races its own dispatch

A single refresh issued in the same tick as the run request lost the race to the HTTP round trip, so
the in-flight row was missing until the user pressed Refresh. One follow-up fetch ~800 ms later covers
it. Deliberately not a poller: live/streaming execution is out of scope for this task.

## What was built

| Change | Where |
|---|---|
| Panel is no longer `experimental`; description says what it is for | `router.setup.ts` |
| Nullable numeric columns preserve `0` | `noodl-viewer-cloud/src/execution-history/store.ts` |
| `execution-history:list` answers `{executions, sources}`; each row stamped with the source that served it | `main/src/execution-history/ExecutionHistoryManager.ts` |
| Three distinguishable empty states + a partial-list notice when one backend of several is unreachable | `ExecutionList.tsx` |
| Source name on rows when more than one backend is running | `ExecutionItem.tsx` |
| Detail: `Ran on`, `4 succeeded · 1 failed · 1 skipped`, `nodeId` on every row, status word, retry attempts, folded request headers | `ExecutionDetail.tsx`, `NodeStepItem.tsx` |
| Error routing stated in words, always visible: `Error routed to Log failure` / `Error not routed — the workflow halted here` / `Received the error from Charge card`, plus a dedicated `previous.error` block | `stepAnnotations.ts`, `NodeStepItem.tsx` |
| "This run is no longer available" for a record whose backend has stopped | `ExecutionDetail.tsx` |
| Run a definition with an editable JSON payload; cancel an in-flight run; refetch after cancel | `RunWorkflow.tsx`, `useWorkflowRunner.ts`, `useExecutionDetail.ts`, `BackendManager.js` |
| Overlay: no-steps and none-match notices, and a `Showing N of M steps` line for a partial match | `ExecutionOverlay.tsx` |
| The editor's main-process jest suites now run in CI | `pr.yml`, `package.json` × 2 |

### Decisions

**(a) `list` returns an object, not a bare array.** A bare array cannot say which stores answered, and
that is precisely the information the three empty states need. The IPC channel name and the detail
channel's shape are unchanged.

**(b) The source is stamped in `metadata`, not as a new column.** `metadata.sourceId`/`sourceName`
record *which source answered*; the backend's own `metadata.backendId` is left untouched because it
records *what the backend called itself* — a different fact, and one that survives the row being read
from a different place later.

**(c) A failed step's body is expanded by default, everything else collapsed.** The failure is what
the user came for; a 20-step run is still readable.

**(d) Error routing is prose on the row, not a colour.** `Error routed to Log failure` and `Received
the error from Charge card` are derived from `previous.error.step` and rendered outside the
disclosure. Unit-tested in `tests-main/execution-history/stepAnnotations.test.ts`, including the case
that must NOT be guessed: a retry step's attempt count is read from its output on success and from the
engine's own error message on failure, and is left blank rather than inferred from `maxAttempts`,
because `retryOnStatus` can fail a retry on its first attempt.

**(e) Request headers are folded.** They are already scrubbed before storage (`scrub.ts` redacts
`authorization`, `cookie`, `x-api-key` and eight more, confirmed by reading the stored rows), but they
are a wall of noise and this panel is a screenshot away from a support ticket.

**(f) The editor's jest suites go into CI.** `tests-main/` — the gate on execution history — ran on
developer machines only: `test:packages` scopes by package and `noodl-editor`'s `test` script starts a
webpack dev server. This is the same gap RUN-004 closed for six other suites. Scoped addition,
disclosed rather than silent.

## Live pass

Driven with the `run-editor` skill against the `test` project, 2026-07-28. Three workflow definitions
(`orderPipeline` with a branch, a failing retry routed to a handler, and a merge; `slowJob` with a
5-minute wait) were created over `/admin/workflow-defs` — the surface WFA-004 will eventually author
into. Everything after that was driven in the editor.

| Case | Result |
|---|---|
| Panel in the rail with `experimental.panel.execution-history` explicitly **false** | ✅ present in `getVisibleItems`, absent from `getExperimentalItems` |
| Empty state — no backend running | ✅ "No backend is running / Start one from the Backend Services panel…" |
| Empty state — a backend running with no runs | ✅ "No runs yet / Second backend is running and has recorded nothing…" |
| Empty state — a running backend that cannot be read (`kill -STOP` on the child) | ✅ "SQLite backend is running but could not be read: The operation was aborted due to timeout." |
| Two backends running → source on each row | ✅ `Slow Job · 4m ago · SQLite backend` |
| Workflow detail: every step in DAG order incl. skipped | ✅ 6 steps, `wait · start`, `branch · decide`, `retry:chargeCard · charge` + `2 attempts`, `SKIPPED` + "Not reached — no incoming edge was taken" |
| Failed step's error, and the handler that received it | ✅ `Error routed to Log failure` on step 3; `Received the error from Charge card` on step 5; `previous.error` rendered as its own block |
| Retry attempt count | ✅ `2 attempts`, parsed from the engine's message on a failed retry |
| 0 ms step no longer reads as absent | ✅ `branch · decide` now `1ms`, was `—` |
| Run a definition from the panel with an edited payload | ✅ `{"total":250,"orderId":"ord_live"}` → run completed → its execution selected |
| A long run stays legible | ✅ in-flight row appears at once; `Running Slow Job — open it below to cancel`; no `TimeoutError` |
| Cancel an in-flight run | ✅ status flips to `ERROR` / "Workflow run was cancelled."; step 1 `ERROR` + "Error not routed — the workflow halted here"; step 2 `SKIPPED` |
| Pin a workflow run with a browser component open | ✅ "Nothing to show on this graph — This execution ran on **Order Pipeline**. None of its 6 steps matches a node in the graph you have open…" |
| Pin a cloud function run (0 steps) | ✅ "This run recorded no steps — … Only workflow runs record steps today" |
| A record whose backend has gone away | ✅ "This run is no longer available / Execution records live in the backend that ran them…" |

Screenshots `after-01`…`after-13` in the session scratchpad.

Incidental confirmations, not defects: an in-flight run interrupted by a service restart is reconciled
on the next start with `Interrupted by service restart (in-flight run did not resume — WF-001 v1
durability)`, which is WF-001's headline residual behaving loudly and correctly. The engine's write-time
validation is likewise loud — the first `orderPipeline` POST was rejected with three precise
per-step messages, and a default `merge` mode of `all` failed the run rather than half-merging.

## Not done, and why

- **The overlay's "some steps resolve" branch is not live-verified.** No data the product records today
  can produce it: function runs have no steps, and workflow step ids match no canvas until WFA-004. The
  branch is the same computation as the none case (`resolvedCount` from `getNodeBounds`) and reads
  `Showing N of M steps — K are not in this graph`. WFA-004's live pass is where it first becomes
  reachable.
- **Spec Implementation Step 7** — pin a cloud function execution and scrub its timeline — is not
  possible for the reason in Finding 2. Recorded as a finding rather than skipped quietly.
- **A successful retry's `attempts`** is read from `outputData.attempts` and unit-tested, but not seen
  live: the test backend has no cloud function for a retry step to succeed against.
- **Live/streaming execution** stays out of scope, as the spec says. A run in flight updates on
  refresh, not by itself.

## Gates

`test:ci` **1731 specs, 0 failures** (seed 55785) · `test:main` **43 specs, 0 failures** (6 suites) ·
`@noodl/nodegx-backend` and `@noodl/cloud-runtime` suites pass (cloud-runtime 46/0) ·
`typecheck:editor`, `typecheck:editor-tests`, `typecheck:cloud`, backend `typecheck` clean ·
`typecheck:core-ui` 46 errors, unchanged from baseline (all pre-existing path-alias errors; one new
one was introduced by an `ExecutionStep` type import and removed by typing the helper structurally) ·
`lint:ci` 840 vs 3916 baseline · `check:artefacts` clean · `catalog:check` clean.

**`cloud-library:check` is stale, and was already stale on a clean `cline-dev` tree** — verified by
stashing. Filed as F36; not caused by this task and not fixed here, because regenerating a node
library inside a run-inspector change would bury it.
