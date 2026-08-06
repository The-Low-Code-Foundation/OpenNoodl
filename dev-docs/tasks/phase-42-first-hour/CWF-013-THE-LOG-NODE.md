# CWF-013 — A cloud function can log, and you cannot find the log

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 6, approved 2026-08-05.
**Status:** **built** 2026-08-06 — all three slices. `net.noodl.Log` is in the shared runtime; the
cloud destination is the structured logger plus a step in the execution record, driven end to end
in [`tests/cloud-log-node.test.ts`](../../../packages/nodegx-backend/tests/cloud-log-node.test.ts)
with a planted secret. Small node, **real** question behind it.

## The node is the easy half

`console.log` in a Function node already works — it is Node's console, because the cloud runtime
runs in the backend's process (TALK-007 §3.1). So a Log node is a thin thing: a message input, a
level enum, a Log signal, pass-through of the value so it can sit inline on a wire.

The question that costs something is **where it comes out**, and there are already three answers in
the codebase:

1. **The structured logger** ([ops/logger.ts](../../../packages/nodegx-backend/src/ops/logger.ts)) —
   one JSON line per event on stdout, `ts`/`level`/`event` always first, **every field passed through
   `redact()` on the way out** so a caller cannot log a secret by accident. This is the backend's
   real log transport (journald / docker / the editor's supervisor).
2. **Execution history** (`noodl-viewer-cloud/src/execution-history`) — per-run records with steps,
   inputs, outputs and errors.
3. **A bare `console.log`**, which goes to stdout *unstructured* and bypasses both.

Today a function author gets (3). That is the defect: the one path an author can reach is the one
with no redaction, no request id and no way to query it.

⚠️ **Two premises in that list were wrong when checked.**

- *"with its own scrubber"* — it is not its own. `ops/redact.ts` says the opposite in its own
  words: there is exactly **one** rule for what counts as a secret, `SENSITIVE_KEY_PATTERN` in the
  execution-history scrubber, and the backend's `redact()` is *"the backend-facing door to it, not
  a second implementation"*. Destinations (1) and (2) therefore share a redaction rule rather than
  having two, which is what makes routing a log line to both defensible.
- *"and retention policy"* — the policy exists as a **method nobody calls**.
  `ExecutionLogger.runRetentionCleanup()` and `ExecutionStore.cleanupByAge/cleanupByCount` are
  fully implemented, `DEFAULT_CONFIG.retentionDays` is 30, and a grep of the whole backend finds
  **zero call sites**. (The *audit* log does have a live retention sweep — `ops/audit.ts` prunes on
  a schedule and logs `audit.pruned` — which is what makes this easy to believe about executions
  too.) So the volume trap at the bottom of this page is worse than it says: nothing is trimming
  that table today. That is why the sink caps lines per run rather than trusting retention.

## Slices

### Slice 1 — decide the destination, and write it down

**Decided, and built: the structured logger, with the request id attached, plus a copy into the
run's execution record.** One event name, `function.log`, so an operator can separate the graph's
own output from the service's with `jq 'select(.event=="function.log")'`. Every line carries
`function`, `requestId`, `nodeId`, `message` and the optional `data`.

⚠️ **The seam the task told me to reuse is the wrong one, and using it would have shipped a lie.**
The Send Email precedent — and `_noodl_get_secret` beside it — is a **process global**
([service.ts](../../../packages/nodegx-backend/src/service.ts), the `_noodl_send_email` assignment;
the line reference in this task said 380-382 and the actual assignment is at 411-412). A process
global is right for those two because neither answer depends on *which request is asking*. A log
line does: its whole value is the request id, and two cloud functions run concurrently in this one
process (`cloud-array-vocabulary.test.ts` asserts exactly that). A module-level "current run" would
have attributed one caller's line to the other's request the first time two overlapped — a wrong id
is worse than no id, because it is believed.

So the sink travels **per run**, on the channel that already exists for exactly this problem:
`NodeScope.runContext`, set by `CloudRunner.run` on the scope it creates for the request and
inherited by every component instance below it, precisely as `modelScope` already is
(`componentinstance.ts`). That is not a second seam — it is the *same* seam `modelScope` proved,
which is the one that is actually per-request.

### Slice 2 — the node

- Inputs: message, level (debug | info | warn | error), an optional data object, a Log signal.
- Pass-through output so it can sit on a wire without breaking the chain.
- ⚠️ **A declared `default` never runs its setter** — apply the `info` default in `initialize`.
- ⚠️ Register it **cloud-only**? No — a Log node is useful in the browser too, where it should map to
  the browser console. Same node, two implementations behind one name is a mistake; one node whose
  destination is chosen by the runtime is right.

### Slice 3 — where you read it back

Both destinations have a reader, and both are named on the node's page:

- **The structured log.** stdout, one JSON line per event, so whatever supervises the process is
  the transport — journald under systemd, the docker log driver, the editor's supervisor in dev.
  The command is `jq 'select(.event=="function.log")'`, and `requestId` joins it to the access log
  line and to the execution record.
- **The execution record.** The editor's **Execution History panel** renders steps with their
  `inputData` expandable (`ExecutionDetail/NodeStepItem.tsx`), so each `Log` line appears as a
  `net.noodl.Log` step in the run it belongs to.

⚠️ One honest wrinkle worth knowing before you go looking: that panel's empty state currently reads
*"Only workflow runs record steps. A cloud function call is recorded as one execution, not node by
node."* That was true before this node and stays true for a function with no `Log` node in it —
the message only renders when there are no steps at all — but a function that logs now does record
steps, so the sentence is no longer the whole story. Not changed here; filed as an observation.

The admin dashboard was checked and is **not** a reader: it serves ops state, and there is no log
or execution route on it.

## Done when

- A cloud function logs at each level; the lines appear in the structured log with the run's request
  id, and in the execution record.
- A logged object containing something `redact()` recognises comes out redacted — tested, not
  assumed.
- The node page names the reader.

## The redaction answer, in full

The question the task exists to force: **what stops the most likely thing in the product to print a
secret from printing one?** Three layers, and it matters which catches what.

| | Catches | Misses |
|---|---|---|
| `redact()` (key-based), inside `logger.log` | `Data` properties whose NAME says credential — `apiKey`, `password`, `token`, an Authorization header — whatever the value is, including one we never issued | Anything with no key: **the whole `Message` string** |
| `SecretValueScrubber` (value-based), `ops/log-scrub.ts` | Every value **this backend provisioned** — `secrets.json`'s `functions` namespace and every `NODEGX_SECRET_*` — wherever it appears, in the message or nested in `data` under an innocent key | A credential that arrived in a request body, was minted in a Function node, or was typed into a parameter. We have never seen it and cannot recognise it |
| The node itself | — | It has no `getInspectInfo`, logs nothing on its own account, and cannot see a secret's value: layer 2 lives in the backend on purpose, because a browser bundle carrying the list of a backend's secrets would be the exact failure the Secret node is registered cloud-only to avoid |

Layer 2 is the one that had to be built. `redact.ts` concedes the gap in its own comment — *"a
secret stored under an innocent name is not caught. The mitigation is that nothing constructs log
fields out of arbitrary user text without naming them"* — and **the Log node is the first thing in
the product to break that mitigation.** `Secret → Log` is a two-node graph an author writes on
their first afternoon, and it is the exact graph the spec drives with a planted value.

Two deliberate limits, both stated in `log-scrub.ts` because both are worse if "fixed": a value
shorter than 8 characters is not scrubbed (a secret provisioned as `dev` would otherwise turn every
log line into confetti), and the value table is re-read at most every 5 seconds (a `Log` in a loop
must not become an fs benchmark).

## Traps

- ⚠️ **Volume.** A Log node inside a Run Tasks loop over 10,000 items writes 10,000 lines to stdout
  and into the execution record. ⚠️ And this task's own premise about the mitigation is wrong:
  **nothing trims the execution table today.** `runRetentionCleanup()` has no caller (see the
  correction at the top of this page). So the sink caps a run at `MAX_LOG_LINES_PER_RUN` = 200 and
  announces the cap once as `function.log.suppressed` — a silent cap is a debugging session with
  half the evidence missing and nothing saying so.
- ⚠️ Logging is the easiest place to leak a secret. This task and
  [CWF-009](CWF-009-THE-SECRET-NODE.md) share that surface — do them in either order, but read the
  other's redaction note.
- ⚠️ A function called **as a workflow step** logs too, into the structured log only: the engine
  writes the one per-step record, so a second one here would double-record. Silence there would
  have meant a function that logs when you call it and does not when a workflow does.
