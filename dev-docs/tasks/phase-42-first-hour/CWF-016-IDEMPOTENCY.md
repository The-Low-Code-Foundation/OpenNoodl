# CWF-016 — The same webhook, delivered twice

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 12, approved 2026-08-05.
**Status:** ✅ **SHIPPED AND CLOSED 2026-08-06 — all four slices.** `c87c120f` (the design),
`f6a22fc9` (the store), `94b2b5e7` (the endpoint), `2b2ad2a5` (the editor door). What landed, and
what each slice found, is in [§ What was built](#what-was-built) at the bottom.

## ⚠️ CORRECTIONS, 2026-08-06 — two of this page's premises were wrong

Both were checked at file:line before the design below was written.

1. ~~**The `functions/:name` route is at `HttpServer.ts:511`, not `:488`.**~~ ⚠️ **Drifted AGAIN
   during the build.** The route table entry is now
   [`HttpServer.ts:560`](../../../packages/nodegx-backend/src/server/HttpServer.ts#L560) and its
   handler `runFunction` is further down still. That is twice this one line reference has been wrong
   on this page in two days, which is the argument for citing the SYMBOL (`runFunction`, the
   `pattern: 'functions/:name'` entry) rather than the number — a number in a doc is a copy of
   something that moves.
2. **The last trap is BACKWARDS, and the correction changes what this feature can promise.** The page
   warns that a workflow retrying a `call-function` step *"will be deduped into a no-op and look like
   a hang"*. It cannot be. A `call-function` step **never reaches the HTTP endpoint**: it goes
   through `invokeCloudFunction` →
   [`WorkflowRunner.invokeFunction`](../../../packages/nodegx-backend/src/workflow/WorkflowRunner.ts#L565)
   → `cloudRunner.run(...)`, **in process**, and it sends
   [`headers: {}`](../../../packages/nodegx-backend/src/workflow/StepExecutor.ts#L214) — literally no
   headers at all. So endpoint-level dedup never sees a retry and cannot swallow one.

   **The real defect is the mirror image, and it is worse:** a CWF-005 retry of a `call-function`
   step *is* a genuine duplicate invocation, and endpoint idempotency **cannot protect against it**,
   because the whole mechanism is bypassed. So the feature has a hole exactly where the product's own
   retry lives — "the same work twice" is unprotected on the one path we ourselves generate. Write
   that down as a **known, documented limit** of the endpoint design (below), not as a trap to route
   around.

## The design — questions 1–5, decided

1. **What makes two requests the same? → An explicit `Idempotency-Key` header** (Stripe's
   convention), with a body hash available as an **opt-in** and off by default. Taking the page's own
   recommendation: a body hash makes a retry with a changed timestamp look like a new request, which
   is the failure people actually hit. The key is scoped **per function**, so two functions may use
   the same key without colliding.
2. **What is stored, and for how long? → The key AND the response.** Storing the key alone means the
   second caller gets "already handled" and no answer, which is not what a webhook provider does with
   a 200. TTL **24h**, configurable in `ops.json` beside `executions.retentionDays` — the same door,
   because it is the same class of decision and a second configuration surface is how two retention
   policies come to disagree. It is swept by the same write-driven hourly pass `ExecutionStore.prune()`
   already runs, so **no fourth timer** — which matters beside the SSE handle that already hangs
   `server.close()`.
3. **Where does it live? → A table beside the execution store, on `node:sqlite`.** Explicitly **not**
   an in-memory map: WF-001's engine already runs in memory with no cross-restart resume, and
   repeating that here means idempotency evaporates on exactly the deploy that most needs it. The
   "survives a backend restart" done-when bullet is the one that forces this and it is not negotiable.
4. **Whose job is it — the node, or the endpoint? → The endpoint, as a per-function setting** beside
   CWF-017's access rule. The page's argument is decisive and I am not softening it: the correct
   behaviour is *don't run the graph at all*, and a node inside the graph has, by the time it fires,
   already run everything upstream of it. ⚠️ This is a **shape** decision and therefore reversible —
   if a case turns up where an author genuinely wants a *section* of a graph deduped rather than the
   whole call, that is an additional node, not a replacement for this.
5. **Concurrent duplicates? → Claim-then-run, and the claim is the row.** Insert the key **first**
   under a unique constraint; the winner runs, the loser waits on the winner's completion and replays
   its answer. Both check / both miss / both run is the naive failure and it is why this task is not
   "cheap". **The concurrency test is written before the store**, per the page's own slice order.

### What a failed run does to a key — the state that will exist in production

The page's trap says a 500 must not be cached and asks what happens to a run that crashed mid-way.
Decided: a claim is **provisional until the run completes successfully.** A claim whose run finished
with a success status is kept for the TTL and replayed. A claim whose run failed, timed out, or whose
process died mid-flight is **released** — the next delivery with that key runs the graph again.
Replaying a failure forever is worse than running twice, and a crashed claim that is never released
is a key that can never be retried, which is the same defect with a longer fuse. A loser waiting on a
winner that then fails does not inherit the failure as a cached answer; it becomes the new claimant.

### Storing the response means storing whatever the function returned

It goes through the same redaction question as [CWF-009](CWF-009-THE-SECRET-NODE.md) and
[CWF-013](CWF-013-THE-LOG-NODE.md) — and CWF-013's finding is the one that applies: `redact()` is
**key-based**, and a stored response body is closer to CWF-013's bare string than to a keyed record.
~~Whatever CWF-013's value-based scrubbing became is what this must reuse; a second scrubber is how
the two come to disagree about what a secret looks like.~~

⚠️ **The last sentence was wrong, and the build answered the question the other way.** Reusing
`SecretValueScrubber` here would not add a second scrubber — it would break the feature. A replay
whose bytes differ from the original answer **is not a replay**, and the first caller already
received the unscrubbed document, so scrubbing on the way in corrupts the retry without ever having
protected anyone. Key-based `redact()` would not have caught a secret in a bare response body
anyway. **Decided: nothing scrubs the stored body**; the mitigations are the TTL and the fact that
nothing in this path ever logs a body. Full reasoning in
[§ The redaction question, answered NO](#️-the-redaction-question-answered-no--and-that-is-the-decision)
and in `IdempotencyStore.ts`'s module doc.

## Why it exists

Every webhook provider retries. Stripe, GitHub, a supplier's ERP — all of them will deliver the same
event twice when your 200 is slow, and the correct behaviour on the second delivery is to do nothing
and answer 200 again. Without that, a retried "payment succeeded" ships the order twice.

This is the one capability on the list that a Function node **cannot** fake, because it needs
durable state across requests — and a cloud function is created per request and torn down on send
([index.ts:81-94](../../../packages/noodl-viewer-cloud/src/index.ts#L81-L94)).

Searched before writing this: the `idempot*` hits in the backend are S3 multipart and realtime
subscription code, not this. Nothing exists.

## The design questions — ALL FIVE DECIDED, see the block at the top

1. **What makes two requests the same?** An explicit `Idempotency-Key` header (Stripe's convention),
   a caller-supplied field, or a hash of the body? Recommend: an explicit key, with a body hash as an
   opt-in — a body hash makes retries with a changed timestamp look different, which is the failure
   people hit.
2. **What is stored, and for how long?** The key alone (→ "already handled", but the caller gets no
   answer), or the key **and the response** (→ replay the original answer, which is what callers
   actually need). Recommend the latter. TTL: 24h is the industry default; make it configurable and
   say why.
3. **Where does it live?** The backend already has SQLite via `node:sqlite`, an `ExecutionStore` and
   a persistence facade. A new table beside the execution store is the cheap answer. **Do not**
   reach for an in-memory map — the workflow engine already runs in-memory with no cross-restart
   resume (WF-001), and repeating that here means idempotency evaporates on the deploy that most
   needs it.
4. **Whose job is it — the node, or the endpoint?** Two shapes:
   - **A node**: "Idempotent Section", author-controlled, explicit on the canvas.
   - **A per-function setting**, next to the access rule ([CWF-017](CWF-017-FUNCTION-ACCESS-AND-LIMITS.md)):
     the endpoint dedupes before the graph runs.
   Recommend the **setting**, because the correct behaviour is "don't run the graph at all", and a
   node inside the graph has already run everything upstream of it by the time it fires.
5. **What about concurrent duplicates?** Two deliveries in flight at once is the case that breaks
   naive implementations: both check, both miss, both run. Needs a claim-then-run pattern (insert
   the key first, unique constraint, loser waits for or replays the winner). This is the part that
   is actually hard, and the reason this task is not "Cheap".

## Slices

1. ~~Decide 1–5 above; write the answers into this doc before any code.~~ ✅ **DONE 2026-08-06** —
   answers in the corrections block at the top. Reopening any of the five is a deliberate act with a
   stated cost.
2. ~~The store: table, claim/complete/replay operations, TTL sweep, tests for the concurrent case
   **first**.~~ ✅ **DONE 2026-08-06, `f6a22fc9`.**
3. ~~The endpoint wiring in `HttpServer`'s `functions/:name` route, beside the existing
   security-rule resolution.~~ ✅ **DONE 2026-08-06, `94b2b5e7`.**
4. ~~The editor door: one field in the same panel as CWF-017's access rule.~~ ✅ **DONE 2026-08-06,
   `2b2ad2a5`.**

## Done when — ✅ all four, in `tests/cwf-016-idempotency.test.ts`

- ✅ The same request with the same key, sent twice sequentially, runs the graph **once** and returns
  the identical body both times. (`Idempotency-Status: stored` then `replayed`.)
- ✅ Sent twice **concurrently**, still once — four deliveries fired with no `await` between them
  against a graph that sleeps 300ms: one `stored`, three `replayed`, **one** execution record.
- ✅ Survives a backend restart between the two deliveries — the service is stopped and a new one
  booted on the same data dir, and the new process's claim recovery does not eat a completed key.
- ✅ A different key runs the graph again.
- ✅ (the trap, promoted to a bullet) A non-2xx does **not** claim the key: the same delivery runs
  twice and neither is stored.

## Traps

- ⚠️ **A 500 must not be cached.** Replaying a failure forever is worse than running twice; only
  successful completions should claim the key permanently. Decide what happens to a key whose run
  crashed mid-way — that is the state that will exist in production.
- ⚠️ Storing the response means storing whatever the function returned, including anything sensitive.
  It goes through the same redaction question as [CWF-009](CWF-009-THE-SECRET-NODE.md) and
  [CWF-013](CWF-013-THE-LOG-NODE.md).
- ⚠️ ~~This overlaps the workflow engine's own retry: a retry will be deduped into a no-op and look
  like a hang.~~ **WRONG, and corrected at the top — it is the mirror image.** A `call-function` step
  never reaches this endpoint (`invokeFunction` → `cloudRunner.run`, in process, `headers: {}`), so
  dedup can never swallow a retry. **The real limit: endpoint idempotency does not cover
  [CWF-005](CWF-005-RETRY-IS-A-POLICY.md)'s retries at all**, because they bypass the mechanism
  entirely. Document that as a known hole; do not paper over it by teaching the step to send a key,
  which would make a *deliberate* retry a no-op and produce exactly the hang the original trap
  imagined.

---

## What was built

### Slice 2 — the store (`f6a22fc9`)

[`IdempotencyStore.ts`](../../../packages/nodegx-backend/src/execution/IdempotencyStore.ts), and
[`idempotency-store.test.ts`](../../../packages/nodegx-backend/tests/idempotency-store.test.ts) —
**written first, and the store was made to satisfy it**, per this page's own slice order.

**What "a real concurrency test" had to mean here, because the obvious reading is worthless.**
`node:sqlite` is synchronous: two `claim()` calls inside one process cannot interleave *inside* the
call. So two awaited claims on one connection would pass against a plain JavaScript `Set` and prove
nothing at all. The race is staged the two ways it actually occurs:

- **Two connections to the same file** — the cross-process case. Nothing in JavaScript arbitrates;
  the row's `PRIMARY KEY (scope, idem_key)` is the only thing that can, and a check-then-insert
  anywhere in the claim path fails the test. Ten interleaved claimants across two handles produce
  exactly one winner and nine losers, each handed the *winner's* claim id.
- **A claim held across an await** — the in-process case, and the endpoint's own shape. Five
  deliveries in flight together against a 60ms "graph": one runs, all five get the same body.

**The table lives in `executions.sqlite` on `ExecutionHistory`'s OWN connection** (a new
`getDatabase()`), not in a second file and not on a second handle. A second file is a second thing to
back up; a second `DatabaseSync` on one path is a second writer to a lock nobody has a plan for.

**⚠️ Premise that would have shipped a no-op: the sweep could not simply "ride `prune()`".**
`ExecutionHistory.prune()`'s first line is `if (!this.store || !this.getRetentionDays) return 0`, and
its second bails on `retentionDays <= 0`. A backend configured to keep executions forever — a real,
supported setting — would therefore have swept **no idempotency keys either**. The new
`registerSweep(name, fn)` seam runs registered sweeps *outside* that guard, each isolated in its own
try/catch. "Keep every execution forever" must not silently mean "keep every idempotency key
forever", and `prune()` was split into `pruneExecutions()` + the sweeps to say so structurally.

**The TTL is enforced on READ as well as on sweep.** The sweep is write-driven and hourly (no fourth
timer, per question 2), so a 24h TTL swept hourly is a TTL that is up to 25h in practice — a number
nobody can reason about. An expired row is dropped and re-claimed at the moment it is read.

**A crashed claim is released three ways**, because the design says a claim is provisional and this
is the state that will exist in production: a non-2xx or a throw releases it inline; `releaseInFlight()`
at service start deletes every `running` row a dead process left (WF-001's interrupted-execution
doctrine, and it deliberately does not touch `done` rows — pinned by a test); and a stale-claim
takeover covers the live process that wedged without a clean restart. Released means the row is
**deleted**, not tombstoned: "released" then has exactly one meaning at every read.

**`executions.idempotencyTtlHours: 24`** sits beside `retentionDays` in `ops.json` — the same door,
as question 2 decided.

### Slice 3 — the endpoint (`94b2b5e7`)

`runFunction` resolves `functionIdempotency(config, name)` beside the security-rule resolution the
dispatcher has already done, and the whole gate sits **before** `invoke()` — which is the only place
"don't run the graph at all" is expressible, and therefore the whole argument for the endpoint shape
over a node.

Per-function config: `idempotency: { enabled, requireKey?, hashBody? }`, strictly validated, with one
refusal the rate-limit block does not need — **`enabled: false` alongside `requireKey`/`hashBody` is
rejected**, because a setting that says two things at once is a setting that will one day be read as
if the second applied.

- **`hashBody` folds the body into the IDENTITY** (same key + different body = a different request),
  and is **off by default**, exactly as question 1 decided: a body hash makes a provider retry whose
  payload carries a fresh timestamp look brand new, which defeats the feature silently. ⚠️ The hash
  is over the re-serialised JSON, so two bodies differing only in key *order* hash differently.
  Stated on the field rather than hidden.
- **`requireKey` is off by default** because a function is usually reached by the app as well as by
  its webhook, and those calls have no key and no reason to have one.
- **Every response carries `Idempotency-Status`**: `stored` / `replayed` / `not-stored` / `unkeyed`.
  A header, not a body field — the body belongs to the function author and wrapping it would break
  every caller that already parses it. `unkeyed` exists so an enabled function called without a key
  cannot imply protection nobody asked for.
- **The wait is bounded by the winner's own CWF-018 timeout plus slack**, ceilinged at 120s for a
  function declared `timeoutMs: 0` (the CWF-007 streaming opt-out, where "wait as long as the winner
  takes" has no bound). Exhaustion is `409` + `Retry-After`, not a hang.

16 HTTP cases in
[`cwf-016-idempotency.test.ts`](../../../packages/nodegx-backend/tests/cwf-016-idempotency.test.ts),
against a real service. **"Ran once" is measured by the execution history**, not by a counter the
spec keeps — a replayed delivery writes no execution record because it never reaches `runner.run`.
The fixture graph mints a **random token per invocation**, so "identical body both times" can only
mean the second caller received the first caller's bytes; a deterministic graph would have made that
assertion vacuous. The concurrent case fires four deliveries with no `await` between them against a
graph that sleeps 300ms: one `stored`, three `replayed`, one execution record. The restart case
stops the service and boots a new one on the same data dir, and additionally pins that the new
process's claim recovery does **not** eat a completed key.

### Slice 4 — the editor door (`2b2ad2a5`)

One field in CWF-017's Permissions panel, on the seam CWF-018's `timeoutMs` row (`25e9696c`) already
proved: the admin API returns `idempotency` per function plus `{available, ttlHours}` for the
service, `PUT` accepts it, and the IPC proxy
([`BackendManager.js:321`](../../../packages/noodl-editor/src/main/src/local-backend/BackendManager.js#L321))
forwards the rules object whole — verified, not assumed.

**One `<select>` with five options rather than a checkbox trio**, because the backend refuses the
contradictory combination and a control that cannot express a refused state beats one that offers it
and then reports an error. `available: false` (no sqlite) disables the control and says why —
TALK-007's finding was capability that existed invisibly, and a control implying capability that does
not exist is the same mistake pointed the other way.

The two things an author cannot deduce from the control are in the section prose: what "replay"
returns (the first delivery's exact answer, only for a **successful** call, for the service TTL), and
the hole below.

### ⚠️ The hole, restated where the code lives

Endpoint idempotency does not cover [CWF-005](CWF-005-RETRY-IS-A-POLICY.md)'s retries, and cannot. A
`call-function` step reaches the function in process with `headers: {}`; there is no request for a
key to arrive on. The last test in the HTTP suite pins the mechanism — two `invokeFunction` calls
return two different tokens — so the limit stays a fact rather than a memory. It is deliberately not
closed by teaching the step to send a key: that would make a *deliberate* retry a silent no-op, which
is the hang the original (backwards) trap imagined. It generalises: **no endpoint feature applies to
a workflow step**, because a step is not a request.

### ⚠️ The redaction question, answered NO — and that is the decision

The stored body is whatever the function returned, and **nothing scrubs it on the way in**:

- `redact()` is **key-based** ([CWF-013](CWF-013-THE-LOG-NODE.md)'s finding, in `ops/redact.ts`'s own
  words), and a response body is a bare string whose field names we do not choose — so it would not
  catch a secret there anyway.
- `SecretValueScrubber` (CWF-013's value-based half) *would* catch one, and running it here would be
  **wrong**: a replay whose bytes differ from the original answer is not a replay. The first caller
  already received the unscrubbed document; handing the retry a different one breaks the single
  promise this feature makes.
- The replay only ever reaches a caller who presented the same key on the same function and passed
  the same `call` gate — not a new audience — and the row sits in the same machine-local
  `executions.sqlite` that already holds every execution's step payloads.

The mitigations are therefore the TTL and the fact that **nothing in this path ever logs a body**.
Both are stated in the module doc so the next reader finds the reasoning rather than the gap.

### Gates

`npx lerna run test --scope @noodl/nodegx-backend` → **97 suites, 1056 passed / 10 skipped**.
`typecheck:editor` clean. `tsc -p packages/nodegx-backend` clean for this package's own files.
Not driven in a live editor — another session held it.
