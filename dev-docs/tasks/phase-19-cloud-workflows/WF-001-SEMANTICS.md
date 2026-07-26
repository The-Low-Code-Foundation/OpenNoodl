# WF-001 — Workflow Execution Semantics (v1)

**Status:** implemented and test-backed (2026-07-26). Every claim below is
backed by a named test in `packages/nodegx-backend/tests/`. This document is the
contract WF-002's node specs are checked against.

A **workflow** here is the WF-001 engine's artifact: a multi-step, ordered,
error-routed, cancellable server execution. It is **not** the historically
mis-named `*.workflow.json` files, which hold cloud **function** graphs
(request/response, run by `CloudRunner`). The two live in separate directories
(`workflow-defs/` vs `workflows/`) and are addressed distinctly everywhere.

**Binding structural rule — a workflow node is a node.** A step does not
introduce a second node abstraction; it *schedules an existing runnable unit in a
different execution context*. In v1 the only step kind is `call-function`, which
invokes an existing cloud function (a graph of real, catalogued, typed nodes)
through the same `CloudRunner` the request/response path uses. WF-002's Series-1
workflow nodes plug into the same `StepExecutor` seam as additional step kinds;
none of the semantics below change when they arrive.

---

## Definition format

A workflow definition (`<dataDir>/workflow-defs/<id>.workflow-def.json`) is an
explicit **step DAG**:

```jsonc
{
  "version": 1,
  "id": "chain",
  "name": "Order pipeline",
  "entry": "s1",              // the step the run starts from
  "concurrency": 1,          // max concurrent RUNS of this workflow
  "timeoutMs": 0,            // whole-workflow timeout (0 = none)
  "stepTimeoutMs": 0,        // default per-step timeout (0 = none)
  "steps": [
    { "id": "s1", "kind": "call-function", "ref": "validate",
      "next": ["s2"], "onError": ["notifyFailure"] },
    { "id": "s2", "kind": "call-function", "ref": "charge", "next": ["done"] },
    { "id": "done", "kind": "call-function", "ref": "sendReceipt" },
    { "id": "notifyFailure", "kind": "call-function", "ref": "alertOps" }
  ]
}
```

Definitions are validated strictly on write **and** on load: unique step ids, a
real `entry`, every `next`/`onError` target existing, and the graph is **acyclic**
(Kahn's algorithm). An invalid definition is **rejected** (HTTP 400 on write) and
an invalid file on disk makes the backend **refuse to start** — same
loud-failure doctrine as `triggers.json`/`security.json`. A workflow that
silently fails to load is an automation that fails on a delay timer.
*Backing: `validateWorkflowDefinition` tests + `workflow-registry.test.ts`.*

---

## 1. Ordering

**Model: an explicit step DAG, executed in topological order with explicit
per-step completion.** A step becomes eligible only when its incoming edge has
been *taken* by a completed predecessor; the engine runs eligible steps one at a
time in a deterministic topological order and does not advance to a step until
the current one has completed (success or failure).

**Deliberate divergence from the client runtime (user-facing).** The browser
runtime propagates changes via per-frame dirty-flag batching — there are no
frames server-side, and there is no implicit fan-out on value change. WF-001
ordering is *edge-driven and explicit*: a step runs because a predecessor's
`next`/`onError` edge selected it, not because a value it reads went dirty. Anyone
who knows the frontend's "everything downstream recomputes each frame" mental
model must read this: **on the server, only the steps you wire an edge to run,
and they run in DAG order, once each.**

- A linear chain `a → b → c` runs exactly `[a, b, c]`.
  *Backing: "runs a linear chain in dependency order".*
- A step reached by no taken edge is recorded **skipped** (not run).
  *Backing: "skips a branch whose incoming edge was not taken".*
- v1 executes eligible steps **sequentially** in topological order (deterministic).
  Parallel fan-out of independent branches is a documented **residual** (v2) — see
  §7.

### Data passed between steps

A step's input is `{ ...runPayload, ...step.params, previous }` where `previous`
is the output of the predecessor whose edge reached this step. For a
`call-function` step the input is JSON-serialised into the function request body;
the function's 2xx response body (parsed) is the step's output.
*Backing: "passes the upstream step output to the next step as `previous`".*

---

## 2. Error propagation / routing

Errors are **routed, not merely thrown** — `onError` edges are first-class,
supporting CF11-002's catch/retry designs.

- A step that fails and **has** `onError` edges → the failure is **routed
  (handled)**: the error edges are taken, execution continues, and the workflow
  can still finish **success**. The failed step is nonetheless recorded with
  status `error` (loud — never swallowed).
  *Backing: "routes a failure along onError and the workflow can still succeed".*
- A step that fails and has **no** `onError` edge → **unrouted**: the workflow
  **halts cleanly**, the run is recorded `error` with `metadata.unroutedError =
  true`, and every not-yet-run step is recorded `skipped`. Nothing is silently
  swallowed and no partial success is reported as success (RUN-004 doctrine).
  *Backing: "halts the workflow cleanly on an UNROUTED failure and records it
  failed" + `workflow-http.test.ts` "halts and records a failed run…".*
- A `call-function` step whose target returns non-2xx, or whose target function
  does not exist, is a **step failure** (subject to the same routing/halt rules),
  not a silent skip. *Backing: `workflow-http.test.ts` unrouted-halt via a
  missing target function.*

Failure classification is precise: a genuine step failure follows routing; an
**abort** (cancel/timeout, §3/§4) does **not** follow `onError` — it stops the
run.

---

## 3. Cancellation

Every run is stoppable. The engine holds one `AbortController` per run;
`cancel(executionId)` aborts it (exposed as `POST
/admin/workflow-runs/:executionId/cancel` and the `cancel_backend_workflow_run`
MCP tool).

- Cancellation is **prompt**: the engine stops scheduling further steps, and an
  **in-flight** step is *raced* against the abort signal so the run does not wait
  for it. The run is recorded with engine status `cancelled` (`metadata.cancelled
  = true`); the not-yet-run tail is recorded `skipped`. Partial execution is
  recorded, never lost.
  *Backing: "cancels an in-flight run promptly and records it cancelled with the
  tail skipped".*
- `cancel()` on an unknown/finished run returns `false`.
  *Backing: "cancel() returns false for an unknown / finished run".*

**Honesty note (the worst case).** A `call-function` step runs inside
`CloudRunner`, which today has **no cooperative cancellation primitive**. When
the abort race is won, the engine stops waiting and records the run promptly, but
the orphaned function invocation keeps running in the background until it finishes
on its own — its result is discarded. A truly wedged step is bounded only by the
**WF-004 process boundary** (kill the service). This is the honest limit of
in-process cancellation; a cooperative-cancellation signal into node execution is
a WF-002/runtime enhancement, not built here.

---

## 4. Timeouts

Two independent timeouts, both **loud** failures:

- **Per-step** (`step.timeoutMs`, else the workflow's `stepTimeoutMs`): a step
  exceeding it is recorded `error` with an errorMessage `Step "…" timed out after
  Nms`, and is then **subject to error routing** (`onError` or halt) exactly like
  any step failure. *Backing: "enforces a per-step timeout and treats the timeout
  as a step failure".*
- **Per-workflow** (`def.timeoutMs`): a timer aborts the whole run; the run is
  recorded `error` with `metadata.timedOut = true`. *Backing: "enforces a
  per-workflow timeout, aborting the run loudly".*

The same "orphaned in-flight work completes in the background, ignored" honesty
note from §3 applies — the timeout makes the **engine** stop waiting; it does not
kill the underlying function. Per-step timeouts are the primary guard against a
long-running step blocking the service; the process boundary is the backstop.

---

## 5. Durability (honest v1 policy)

**Runs are in-memory. They do NOT resume across a restart.** What survives and
what does not:

| Survives a restart | Does **not** survive |
|---|---|
| The **execution record** of every run (in `executions.sqlite`): status, steps, timings, trigger source, metadata. | The **in-flight run itself** — its scheduler state, the AbortController, the pending step frontier. |
| Workflow **definitions** (`workflow-defs/`) and **trigger** config. | Any step that had not completed when the process died. |

**Interrupted detection (the loud half).** At startup the engine scans for any
execution left `status = 'running'` (this backend's records) and marks each
`error` with `metadata.interrupted = true` and an errorMessage explaining a
prior run did not survive the restart. This is *resumable-or-failed-loudly, never
silently half-run*: a workflow interrupted by shutdown becomes a visible failure,
not a phantom "running forever" row.
*Backing: "marks executions left `running` at startup as failed+interrupted" +
"does not touch another backend's in-flight records".*

**Divergence from the letter of the brief:** the brief says record such runs as
status `interrupted`. The shared execution-history status enum is `running |
success | error` and is consumed by the editor's History Panel and WF-006's
tests. Rather than widen that enum across the editor package (blast radius,
editor-typecheck gate, concurrent-merge risk), an interrupted run is recorded as
`error` **plus** `metadata.interrupted = true`. This satisfies "failed loudly,
never silently half-run" and is queryable/legible; it is a deliberate
blast-radius decision, called out here as the brief requires. Adding a first-class
`interrupted` status (types.ts + store + schema.sql + panel filter) is the clean
follow-up if the UI wants to distinguish it.

**v2 checkpoint/resume (documented, not built).** To make runs resumable the
store would need, per execution: a **completed-step cursor** (already implicit in
the per-step `execution_steps` rows), the **pending frontier** (the set of
reached-but-unrun step ids), and a **step input snapshot** for each frontier step
(the `previous`/payload it would receive). The per-step `input_data`/`output_data`
columns already capture most of this; what is missing is a persisted frontier and
a "resume from here" entry path. This is explicitly **out of scope for v1** and
must not be built speculatively.

---

## 6. Concurrency

Policy: **parallel runs of the same workflow up to a per-workflow cap
(`concurrency`, default 1); runs beyond the cap queue FIFO** and start as slots
free up. This is the honest single-process answer — not coalescing (which would
hide runs) and not dropping (which would lose them).

- cap = 1 ⇒ two concurrent runs never overlap (serialized).
  *Backing: "serializes runs beyond the per-workflow cap".*
- cap = 2 ⇒ at most two overlap; a third waits.
  *Backing: "allows overlap up to the cap".*

The cap is stored in the workflow config so it deploys with the backend. The
queue is in-memory (a queued run is lost on restart, same as any in-flight run —
§5). An explicit max-queue bound and cross-restart queue durability are
**residuals** (v2); v1 documents the single-process, in-memory reality rather
than implying a delivery guarantee it does not make.

---

## 7. Execution records & observability (one path)

Every run emits **one** workflow-level execution record **plus per-step events**
through WF-006's `ExecutionLogger` — the same `executions.sqlite` store the
function path uses. There is **no second execution-record path**:

- `startExecution` once (workflowId, name, trigger type/source, `metadata.kind =
  'workflow'`), then `startNode`/`completeNode` per step (`skipNode` for skipped
  steps), then `completeExecution`. The precise engine disposition (`cancelled` /
  `timedOut` / `unroutedError` / counts) is stamped into the record's metadata.
- A `call-function` step runs the function via `WorkflowRunner.invokeFunction`
  (the **unlogged** variant), so the function does **not** additionally write its
  own function-level record when it runs as a workflow step — no double-record.
  *Backing: `workflow-http.test.ts` "runs a multi-step workflow over real
  functions and records per-step events" — one record, N step rows.*

This is what the History Panel and canvas Execution Overlay render; because
WF-006 already proved that pipeline end-to-end, any mismatch is engine-side by
construction.

---

## 8. Triggers (one dispatch path)

A trigger's target is `{ kind: 'function' | 'workflow', name }`. When
`kind === 'workflow'`, WF-005's **one** `TriggerDispatcher.fire()` path runs the
workflow through the engine (which writes the same records above) and stamps the
trigger's status — exactly as the dispatcher's docblock foretold: "Workflows
become a second target `kind` here and nothing else changes." A missing workflow
target is a **loud** rejection record, not a silent drop. There is **no second
dispatch path** for workflows.
*Backing: `workflow-http.test.ts` "a trigger with target.kind 'workflow' runs the
workflow via the one dispatcher path".*

---

## Success-criteria map

| Criterion | Status | Backing test |
|---|---|---|
| Semantics spec published; divergences called out | ✅ | this doc |
| Multi-step workflow executes headless with correct ordering | ✅ | ordering suite; `workflow-http` chain |
| Errors route per spec; unrouted errors fail cleanly & visibly | ✅ | error-routing suite; `workflow-http` halt |
| Cancellation stops a run promptly; partial recorded | ✅ | cancellation suite |
| Timeouts enforced per-workflow and per-step | ✅ | timeouts suite |
| Restart marks in-flight executions interrupted; nothing silently half-runs | ✅ | durability suite |
| Per-step events visible in History Panel/overlay | ⚠️ engine-side proven (records + steps); live panel render not re-smoke-tested here | `workflow-http` per-step records |
| Concurrency policy implemented & configurable per workflow | ✅ | concurrency suite |
| Test suite mirrors the spec | ✅ | `workflow-engine.test.ts` sections = this doc's sections |
