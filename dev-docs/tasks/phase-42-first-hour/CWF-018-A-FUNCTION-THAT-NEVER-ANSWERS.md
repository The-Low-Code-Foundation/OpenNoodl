# CWF-018 — A cloud function that never answers holds the connection forever

**From:** found while driving [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §7's Run Tasks
question, 2026-08-05. Not on anyone's list — it fell out of a probe whose fixture was wrong, which
is the only reason anyone looked.
**Status:** open, unowned. **Filed, not fixed.**

## The mechanism, exactly

`CloudRunner.run` returns a promise that settles **only** when a Response node fires
([index.ts:50-113](../../../packages/noodl-viewer-cloud/src/index.ts#L50-L113)): `resolve` lives
inside `_sendResponseCallback`, and `reject` covers exactly two cases — the component failing to
instantiate, and no Request node being found.

`POST /functions/:name` awaits that promise with **no timeout**
([HttpServer.ts:1700-1719](../../../packages/nodegx-backend/src/server/HttpServer.ts#L1700-L1719)).

So a function graph that runs, does work, and simply never reaches a Response node neither resolves
nor rejects. The HTTP request hangs. Nothing logs a completion, nothing errors, the execution record
stays open, and the socket is held until the client gives up.

**Observed**, not theorised: a Run Tasks whose template did not satisfy the completion contract
raised its runtime error correctly (`run-tasks/no-completion-output`) and reported `failure`. The
graph wired only `done` → Response. The call sat there until the test harness killed it at 60
seconds. The node behaved perfectly; the request still never got an answer.

**And this is the ordinary authoring mistake**, not an exotic one: every outcome-contract node has
`Failure` and `Unchanged` ports beside `Done`, and wiring only the happy path is what everyone does
first.

## Why it matters more than it looks

- Workflows already solved this: the engine has per-step and per-run timeouts, and
  `WorkflowEngine` treats a timeout as **a LOUD failure recorded on the step and the run**
  ([WorkflowEngine.ts:15, 46, 392](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L15)).
  The direct function call path has none of that. The same graph is safe under one caller and
  unbounded under another.
- A held connection is a resource. Enough of them and the backend stops answering anything —
  which will read as "the server is down", not as "one function has an unwired Failure port".
- [CWF-002](CWF-002-THE-WORKFLOW-RETURN.md) already notes the neighbouring case: a `wait` step in a
  sync workflow holds an HTTP connection open. Same family; this one needs no `wait` and no
  workflow.

## Slices

### Slice 1 — a timeout with a real answer

A configurable per-function execution timeout (default: seconds, not minutes) that rejects the run
and returns **504** with a body saying the function did not respond, naming the function. Not a
silent 500 — the whole point is that the author must be able to tell this apart from a crash.

⚠️ Reuse the workflow engine's vocabulary rather than inventing a second one — it already
distinguishes `cancelled` from `timeout` ([WorkflowEngine.ts:46](../../../packages/nodegx-backend/src/workflow/WorkflowEngine.ts#L46)).

### Slice 2 — tear the graph down

`_sendResponseCallback` is also what deletes the component instance and resets the request scope
([index.ts:81-94](../../../packages/noodl-viewer-cloud/src/index.ts#L81-L94)). A timed-out run must
do the same teardown or every hung request **leaks a component instance and its model scope** for
the life of the process. This is the half that will be forgotten; it is also the half that turns a
slow endpoint into an outage.

### Slice 3 — say it at authoring time

A function whose graph has a reachable path that ends without a Response node is a warning the
editor can raise statically — the same shape as Run Tasks' own `checkTemplateContract`, which warns
about a template that cannot report completion. Not required for the fix; it is the thing that stops
the fix being needed.

## Done when

- A function that never fires Response returns **504** at the configured timeout, with the function
  named in the body, and the run appears in execution history as timed out rather than hanging open.
- Repeating that call N times leaves no growth in live component instances (the teardown criterion —
  assert it, do not eyeball it).
- A normal function is unaffected: `cloud-run-tasks-loop.test.ts` and the WFA-009 suite stay green.
- The timeout is configurable per function, beside the access rule from
  [CWF-017](CWF-017-FUNCTION-ACCESS-AND-LIMITS.md) — same panel, same trip.

## Traps

- ⚠️ **A streaming function legitimately holds its connection open** ([CWF-007](CWF-007-STREAMING-RESPONSES.md)).
  Whatever timeout lands must not strangle streaming; decide the interaction before implementing,
  not after CWF-007 ships and starts timing out.
- ⚠️ Node's own `requestTimeout`/`headersTimeout` govern *receiving* a request, not how long a
  handler may take. They will not save this, and a change to them is not this fix.
- ⚠️ The `1s` quit-flush class of defect is nearby: a timeout that fires during shutdown must not
  race the teardown path `service.stop()` already runs.
