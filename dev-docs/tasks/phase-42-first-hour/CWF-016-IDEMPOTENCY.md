# CWF-016 — The same webhook, delivered twice

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 12, approved 2026-08-05.
**Status:** open, unowned. **Real design work — the only item on the track with nothing built behind
it.** Sequence last, or when a payment/webhook case makes it urgent.

## Why it exists

Every webhook provider retries. Stripe, GitHub, a supplier's ERP — all of them will deliver the same
event twice when your 200 is slow, and the correct behaviour on the second delivery is to do nothing
and answer 200 again. Without that, a retried "payment succeeded" ships the order twice.

This is the one capability on the list that a Function node **cannot** fake, because it needs
durable state across requests — and a cloud function is created per request and torn down on send
([index.ts:81-94](../../../packages/noodl-viewer-cloud/src/index.ts#L81-L94)).

Searched before writing this: the `idempot*` hits in the backend are S3 multipart and realtime
subscription code, not this. Nothing exists.

## The design questions

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

1. Decide 1–5 above; write the answers into this doc before any code.
2. The store: table, claim/complete/replay operations, TTL sweep, tests for the concurrent case
   **first** — it is the one that will be wrong.
3. The endpoint wiring in `HttpServer`'s `functions/:name` route
   ([HttpServer.ts:488](../../../packages/nodegx-backend/src/server/HttpServer.ts#L488)), beside the
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
- ⚠️ This overlaps the workflow engine's own retry ([CWF-005](CWF-005-RETRY-IS-A-POLICY.md)): a
  workflow retrying a `call-function` step is *also* a duplicate delivery. Make the two agree, or a
  retry will be deduped into a no-op and look like a hang.
