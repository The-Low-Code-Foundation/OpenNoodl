# CWF-016 — The same webhook, delivered twice

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 12, approved 2026-08-05.
**Status:** **slice 1 done 2026-08-06 — the design is decided below and the two wrong premises are
corrected. Slices 2–4 (the store, the endpoint, the editor door) are unbuilt.** Still the only item
on the track with nothing built behind it.

## ⚠️ CORRECTIONS, 2026-08-06 — two of this page's premises were wrong

Both were checked at file:line before the design below was written.

1. **The `functions/:name` route is at [`HttpServer.ts:511`](../../../packages/nodegx-backend/src/server/HttpServer.ts#L511), not `:488`.** Line drift only; the seam is where the page says it is.
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
Whatever CWF-013's value-based scrubbing became is what this must reuse; a second scrubber is how the
two come to disagree about what a secret looks like.

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
2. The store: table, claim/complete/replay operations, TTL sweep, tests for the concurrent case
   **first** — it is the one that will be wrong.
3. The endpoint wiring in `HttpServer`'s `functions/:name` route
   ([HttpServer.ts:511](../../../packages/nodegx-backend/src/server/HttpServer.ts#L511)), beside the
   existing security-rule resolution.
4. The editor door: one field in the same panel as CWF-017's access rule.

## Done when

- The same request with the same key, sent twice sequentially, runs the graph **once** and returns
  the identical body both times.
- Sent twice **concurrently**, still once — a real concurrency test, not two awaited calls.
- Survives a backend restart between the two deliveries.
- A different key runs the graph again.

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
