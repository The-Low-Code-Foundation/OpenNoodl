# BAK-009 — Production Ops: implementation notes

**Status:** IN PROGRESS — one slice done. **Date:** 2026-07-26.

The task has eight in-scope deliverables (rate limiting, structured logs,
request ids, `_Audit`, `/metrics`, graceful shutdown, CORS/headers, runbook).
This file records what is actually done, so nothing here should be read as a
claim about the rest.

---

## Slice 1 — the `readRawBody` 413, root-fixed

**Done.** This was called out separately from the spec because two subsystems
had each worked around it and neither had fixed it.

### The defect

`readRawBody` rejected with a 413 and then immediately called `req.destroy()`:

```ts
if (size > maxSize) {
  reject(new HttpError(413, 'Request body too large'));
  req.destroy();          // <- takes the socket down
  return;
}
```

Destroying the request tears down the socket, so the 413 the caller then tried
to write never reached anyone. Every sender saw a bare `ECONNRESET` and no
status — the one thing a size limit exists to communicate.

### Why it survived two encounters

Both call sites noticed the symptom and routed around it rather than into it:

- **WF-005** (`HttpServer.handleWebhook`) added a `Content-Length` pre-check and
  a `try/catch` that re-raises the streaming 413 into an execution record.
- **BAK-006** (`FileRoutes.upload`) added the same `Content-Length` pre-check,
  with a comment explicitly describing the reset race.

The pre-check is good — refusing before reading a byte beats reading 12 MB and
then refusing — so it stays. What it cannot do is cover a sender that does not
declare a length, and that was exactly the uncovered path.

The other reason it survived: **a promise-level test passes either way.**
`expect(readRawBody(...)).rejects.toBe(413)` was true the whole time the product
was broken. The difference is only observable through a real socket.

### The fix

- `readRawBody` detaches its listeners, `req.pause()`s and rejects. It does not
  destroy. The request stays intact so the caller's response can be written.
- `sendError` sets `Connection: close` on a 413 — that is what ends the socket,
  after the status has flushed, and it stops Node trying to parse the remaining
  upload bytes as the next pipelined request on a keep-alive connection.
- Both workaround comments were rewritten. They described a bug that no longer
  exists; leaving them would have taught the next reader to work around it a
  third time.

### Verification

`tests/body-limit.test.ts` drives a **real `http.Server` over a real socket**,
because that is the only place the difference is visible.

| | with `destroy()` | with the fix |
|---|---|---|
| under the limit → 200 | pass | pass |
| over-limit **chunked** → readable 413 | **fail** | pass |
| over-limit declared-length → readable 413 | **fail** | pass |
| connection closed after the 413 | **fail** | pass |
| rejects with `HttpError` status 413 | pass | pass |
| request not destroyed | **fail** | pass |

The old behaviour was re-introduced deliberately to confirm the tests catch it:
4 of 6 fail. Note the row that passes both ways — that is the promise-level
assertion, kept as a reminder of why it proved nothing.

Live check against a real backend (`node dist/cli.js serve --port 8579`,
12 MB body vs the 10 MB JSON limit):

- chunked, no `Content-Length` → `HTTP 413 {"error":"Request body too large"}`
- `curl --data-binary @12mb` → `HTTP 413`, curl exit 0, body readable

Full suite after the change: **49 suites, 455 passed, 7 skipped**; `tsc` clean.

---

## Found, not yet fixed — for the rest of this task

**`PUT /admin/permissions/collections/:name` reports success for a body it
ignored.** The handler only reads `permissions` and `creatorOwns`. Anything else
produces an empty entry that is validated (an empty entry is valid), persisted,
and answered with `{"success":true,"collection":"Message","rules":{}}`.

Found the hard way while granting public read on a deployed backend during
WF-003's live verification: `{"find":"public","get":"public"}` — the shape the
response's own `rules` field suggests — silently changed nothing and said it
worked. Only `{"permissions":{"find":"public","get":"public"}}` does anything.

It should reject a body that sets no recognised field. This sits squarely in
this task's "honest admin surface" territory, and it is exactly the kind of
thing the `_Audit` trail would otherwise record as a successful permission
change that never happened.

---

## Remaining scope

Untouched: rate limiting, structured logging + redaction, request ids, the
`_Audit` table, `/metrics`, graceful shutdown, CORS/header defaults, the MCP
additions, and the ops runbook with a verified Caddy example. The spec's step
order (logging + request ids first, since everything else wants them) still
stands.
