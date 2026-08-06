# CWF-018 — A cloud function that never answers holds the connection forever

**From:** found while driving [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §7's Run Tasks
question, 2026-08-05. Not on anyone's list — it fell out of a probe whose fixture was wrong, which
is the only reason anyone looked.
**Status:** SHIPPED 2026-08-06 — slices 1 and 2. Slice 3 (the authoring-time warning) is still open,
and so is the editor row for the new setting: the Permissions panel does not render `timeoutMs` yet,
though the admin API it reads now returns it. Driven by
`packages/nodegx-backend/tests/cloud-function-timeout.test.ts` (7 cases), not yet driven in a live
editor. Two of this doc's cited mechanisms were slightly wrong and are **CORRECTED** in place below.

## The mechanism, exactly

`CloudRunner.run` returns a promise that settles **only** when a Response node fires
([index.ts](../../../packages/noodl-viewer-cloud/src/index.ts)): `resolve` lives
inside `_sendResponseCallback`, and `reject` covers exactly two cases — the component failing to
instantiate, and no Request node being found.

`POST /functions/:name` awaits that promise with **no timeout**.

⚠️ **CORRECTED.** The route handler is `HttpServer.runFunction` (~line 1755, not 1700-1719), and it
does not await `CloudRunner` — it awaits **`WorkflowRunner.run`**, which wraps it, writes the
execution record and turns a throw into a 500. That intermediary is where the fix belongs and where
this doc's line reference pointed away from: `HttpServer` needed no change at all.

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

### The same mechanism, three ways in (confirmed while fixing)

The "no Response node fires" silence has more causes than an unwired outcome port, and one bound
covers all of them because they end in the same place:

1. **An unwired outcome port** — the case above.
2. **An unregistered node type**, found independently by another agent. It is the *same* mechanism,
   not a neighbouring one: `NodeScope.createNodeFromModel` catches the register's
   `Unknown node type with name …`, `console.error`s it and returns nothing; `NodeScope.addConnection`
   then catches `Unknown node id …` for each wire that referenced it and carries on. The graph runs
   with its chain cut, so the Response node is simply never reached. Nothing throws, and — before
   this fix — nothing answered. Covered by the same timeout, and driven as its own case in the spec.
3. **A node that never reports either outcome.** The repo already contains one: the two red
   `email-flows.test.ts` "Send Email node" cases hang on `POST /functions/notify` until jest's own
   30s limit, with `sent` and `failed` both wired to Response nodes. That is a Send Email defect, not
   a CWF-018 one — but it is why "the socket is held" was never a hypothetical.

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

## What shipped, 2026-08-06

**The bound lives in `CloudRunner.run`, because teardown does.** `run` takes a third argument,
`{ timeoutMs }` (`0`/omitted = wait forever, which is what every caller did before). Every way the
run can settle — a Response node, the timeout, a throw out of the request node, no Request node at
all — now goes through one `settle()` that stops the clock, **tears the graph down**, and only then
delivers. Two leaks closed at once: the timeout path, and the pre-existing "could not find request
node" rejection, which had always left its component instance and model scope alive.

`_requestIsOpen` now answers "is this run still settleable", so a Response node that fires after a
timeout is refused exactly as a second Response node is — it reports `response/already-sent` rather
than resolving a promise whose caller has already been answered.

**The answer is a 504** from `WorkflowRunner.run`, naming the function, the limit and the likely
cause; the run is recorded with the engine's own `timedOut` metadata key rather than a second word.
`WorkflowRunner.invokeFunction` (the workflow-step path) gets the same bound, and it is not
redundant with the engine's per-step timeout: a step timeout abandons the promise and leaves the
component instance running: only this tears it down.

**The default is 30 seconds**, chosen against three edges: under nginx's 60s `proxy_read_timeout`
(so the limit that fires is ours, named and logged, not a bare 502); above anything request-shaped
(a function is "answer the user now" — minutes of work is a workflow); and short enough that an
unwired `Failure` port is found in development. A function that needs longer declares
`functions.<name>.timeoutMs` in `security.json` — CWF-017's entry, CWF-017's admin route,
`0` = no limit, which is the honest way for CWF-007 streaming to opt out.

**The log line** is `function.timeout` at `error` through the ops logger — levelled, structured and
shipped by whatever supervises the process, with the `requestId` that joins it to the access log and
the execution record. ⚠️ It deliberately does **not** include the request body: `ops/redact.ts` is
KEY-based ("a secret stored under an innocent name is not caught", in its own words), and a
function's request body is arbitrary caller data whose field names we do not choose.
