# BAK-009 — Production Ops: implementation notes

**Status:** COMPLETE. **Date:** 2026-07-26.

Eight in-scope deliverables, all landed: structured logs + redaction, request
ids, rate limiting, the `_Audit` trail, `/metrics`, graceful shutdown,
CORS/security headers, the MCP additions, and the ops runbook with a verified
Caddy example. Two defects found in earlier tasks were root-fixed on the way.

This file records the decisions and the traps, not the feature list — that is
in the phase CHANGELOG.

---

## The shape of it

Everything operational hangs off `ops.json` in the data dir, beside
`security.json` and `search.json` and validated the same way: **unknown keys
are errors**, an invalid file refuses to start. Sections: `logging`,
`rateLimit`, `cors`, `audit`, `metrics`. Every one has a working default, so a
backend that never writes the file still gets the whole operational floor —
limits on, logs structured, audit recording. That is the point of the task: the
floor is not opt-in.

New module directory `src/ops/`: `model`, `OpsState`, `logger`, `redact`,
`client-ip`, `request-id`, `rate-limit`, `audit`, `audit-actions`, `metrics`,
`headers`.

---

## Slice 1 — the `readRawBody` 413, root-fixed

**Done first, separately, because two subsystems had each worked around it and
neither had fixed it.**

`readRawBody` rejected with a 413 and then immediately called `req.destroy()`.
Destroying the request tears down the socket, so the 413 the caller then wrote
never reached anyone: every sender saw a bare `ECONNRESET` and no status — the
one thing a size limit exists to communicate.

Fix: detach listeners, `req.pause()`, reject without destroying. `sendError`
sets `Connection: close` on a 413 — that is what ends the socket, *after* the
status flushes, and it stops Node parsing the rest of the refused upload as the
next pipelined request.

Two lessons worth more than the fix:

- **A promise-level test passed the entire time the product was broken.**
  `expect(readRawBody(...)).rejects` with status 413 is true either way; the
  difference is only visible through a real socket. `tests/body-limit.test.ts`
  drives a real `http.Server`, and re-introducing `destroy()` fails 4 of its 6
  tests — that check (deliberately break it, confirm the test notices) is the
  only thing that makes such a test worth writing.
- **Two subsystems each worked around it instead of into it** (WF-005 webhooks,
  BAK-006 uploads), both with a `Content-Length` pre-check. The pre-check is
  kept — it refuses before reading a byte — but it cannot cover a sender that
  declares no length, which was the uncovered path. Both comments described the
  bug as permanent; both were rewritten so a third workaround does not get added.

---

## Redaction: extend the existing rule, do not start a second one

There was already a redaction rule — `SENSITIVE_KEY_PATTERN` in
`noodl-viewer-cloud/src/execution-history/scrub.ts`, which WF-004 had explicitly
framed as "shared by the editor and the standalone backend service so both log
with the same redaction rules".

Writing a second one in `src/ops/` would have been faster and would have drifted
invisibly until a credential turned up in a log. So `ops/redact` is a thin door
onto the shared rule, and the shared pattern was widened to cover CONFIG shapes
as well as request bodies: `accessKeyId`/`secretAccessKey`, `signingKey`,
`keyHash`, `hmac`, `salt`.

`key` on its own is deliberately NOT in the pattern — it appears in too many
innocent shapes (`keys: [...]`, `sortKey`), and a log where everything is
`[REDACTED]` is its own failure mode. The credential-bearing spellings are
enumerated instead.

`tests/ops-redaction.test.ts` plants a distinct secret in every real loggable
shape (secrets.json, SMTP auth, S3 config, a session, an API-key principal, a
webhook trigger, request headers) and asserts none survive — plus a negative
half asserting the innocent neighbours DO survive. Re-narrowing the pattern to
its old form fails 2 of its 6 tests; that was checked, not assumed.

---

## Request ids

Accepted from the caller only if short and boring (`^[A-Za-z0-9._~+/=@:-]{1,128}$`)
— it lands in log lines and a response header, so anything else is a
log-injection primitive handed to an anonymous client.

`sendError` picks the id back off the response header rather than having it
threaded in. That is deliberate: `sendError(res, err)` is handed a response and
nothing else, and the alternative was monkey-patching a field onto
`http.ServerResponse`.

The id reaches execution records through `RunTriggerContext.requestId` — which
already existed as the seam for `source`/`triggerId`, so webhooks, direct
`/functions/:name` calls and workflow runs all got it with one field.

---

## Rate limiting

**Token bucket, not fixed window.** A window lets a caller spend the whole
allowance in its last millisecond and again in the first of the next.

**Classes derived from the `access` declaration routes already carry**, with an
explicit list for the routes where a credential is PRESENTED. The interesting
call: `users/me` and `logout` are `session`-access but are ordinary app traffic
(an app reads `users/me` on every load), so they get the `data` budget; only
login/signup/reset/verify and the `_admin` login page are `auth`. `_admin/whoami`
is admin-credentialed and polled by the dashboard, so it is `admin`.

**Keyed by principal AFTER resolution.** Deriving the key from the raw header
would let an attacker mint a fresh bucket per request by sending garbage tokens.
The pre-auth flood is already bounded by BAK-005's failure budget, which counts
wrong credentials rather than requests — the two limiters stay separate on
purpose: merging them would let a valid client's traffic launder a guessing
attack.

**`auth` defaults are 60/min burst 30, not a single human's rate.** Fifty people
behind one office NAT signing in at 9am is one address making fifty auth
requests a minute; refusing them would be a self-inflicted outage. Guessing is
the failure budget's job.

**Realtime is capped by connection COUNT.** One SSE stream is a single very long
request; a request-rate bucket would measure nothing while breaking reconnect
storms. `RealtimeHub.addConnection` now returns `null` at the cap — refusing
BEFORE the stream headers go out, because a client already told
`200 text/event-stream` has no way to learn it was rejected.

**The `X-Forwarded-For` fix.** The old `clientKey` took the LEFTMOST entry, which
is forgeable: a proxy APPENDS the peer it saw, so a client sending
`X-Forwarded-For: 9.9.9.9` produced `9.9.9.9, <real client>`. Now the header is
believed only from a trusted peer (`loopback` by default) and the RIGHTMOST
untrusted hop wins. Verified live with a real forged header through Caddy.

**BAK-002's mail budgets migrated** onto a `checkPolicy(bucketName, key, policy)`
entry point: still stricter than `auth` (5 sends per 15 minutes), no longer
their own fixed-window implementation, their own key derivation, or their own
refusal shape.

---

## The audit trail

**Written by the dispatcher, not by handlers.** A handler that forgets to call
`audit()` is invisible, and reviewers do not catch that — BAK-003 learned the
same lesson about access gates. Actions are DECLARED per route in
`ops/audit-actions`; a test walks the live route table and fails any
state-changing admin route that is neither declared nor explicitly exempt (with
its reason — `POST /admin/permissions/check` is a dry run and says so). Handlers
may ENRICH via `ctx.audit({...})`, never create.

**Recorded at request completion**, from the same hook as the access log, so
`outcome` is what happened rather than what was attempted. A refused permission
change is a `failure` entry, not an absence — verified live.

**A plain table, and the docs say the DB owner can edit it.** No hash chain, no
append-only pretence: anyone who can reach the SQLite file can rewrite history,
and a tamper-proofing story that `rm` defeats invites trust it cannot carry. The
honest answer is in the runbook: ship the structured logs off-box, since every
audited action also produces a log line with the same request id.

**Writing never blocks the action.** Refusing a restore because the trail is
unwritable would make the trail a new way to lose the service.

---

## Metrics

Labels are route CLASS and never path — a path label on `/api/:table` is one
series per collection per status per method, and a metrics endpoint that costs
more than the service is one that gets turned off.

Gauges are read at scrape time. `nodegx_backup_age_seconds` is **absent** rather
than zero until a backup succeeds: a zero reads as "backed up just now", which
is the exact opposite of the truth. The runbook's alert example fires on
`absent()` as well as on age.

The test parses the output with a real exposition parser rather than asserting
200, because one malformed line makes a scraper drop the entire scrape.

---

## Graceful shutdown — the obvious implementation was wrong twice

1. **`await server.close()` hangs forever on an open SSE stream.** Its callback
   fires only when every connection has gone, and a stream never goes on its
   own. Caught by the live run, not by reasoning: the first version sat there
   until SIGKILL. `server.close()` is now called and NOT awaited.
2. **Idle keep-alive sockets hold it open too**, so `closeIdleConnections()` is
   explicit, with `closeAllConnections()` as the backstop after the drain.

The drain is polled rather than event-driven: the completion hook that empties
the in-flight set can fire between the size check and the listener registration,
and a shutdown that hangs on that race is worse than 25ms of latency.

`service.stop()` was reordered — it used to close the realtime hub FIRST, which
cut SSE streams before the goodbye could be sent. Order is now: schedulers (no
new work) → HTTP (goodbye + drain) → hub → change bus → database, because a
still-draining request may be using any of the last three.

The goodbye reuses `resync` rather than inventing a `goodbye` event: every
client already handles it (BAK-001 — "re-query, you may have missed something"),
which is exactly the right instruction for a client whose stream is vanishing. A
new event type would be ignored by every client shipped before it.

### The stale-artifact trap

`tests/ops-shutdown.test.ts` spawns `bin/nodegx-backend.js`, which loads
`dist/cli.js`. The first run of that test graded a **stale bundle** and produced
a confusing failure that looked like a logic bug. The test now runs
`scripts/build.js` in `beforeAll` (esbuild, ~150ms). Same family as the
packaging note: a green run against `src/` proves nothing about the artifact an
operator runs.

---

## CORS

Moved from a `CORS_HEADERS` constant spread into every `writeHead` to a
per-request decision the dispatcher applies with `res.setHeader` before any
handler runs. Handlers therefore cannot forget it — and the constant HAD to go,
because spreading it in `writeHead` overrides the dynamic value.

Two consequences worth remembering: `RealtimeHub`'s `SSE_HEADERS` had its own
hard-coded `Access-Control-Allow-Origin: *` (removed for the same reason), and
`files.ts` had four spread sites.

An allow-list ECHOES the request's origin — a browser accepts exactly one origin
in that header, so sending the list verbatim is the same as sending nothing,
only harder to debug. A refused origin still gets its response: CORS is the
browser's rule, not access control.

---

## The honesty fix

`PUT /admin/permissions/collections/:name` read `permissions` and `creatorOwns`,
silently dropped everything else, and answered
`{"success":true,"collection":"Message","rules":{}}`. So
`{"find":"public","get":"public"}` — the shape the response's own `rules` field
suggests — changed nothing and said it worked. It cost real time during WF-003's
live verification.

It now refuses unknown fields and an empty change, naming the shape it wants and
where per-operation rules go. This is squarely this task's territory: it is
exactly what the audit trail would otherwise record as a permission change that
never happened, and the live run confirms both the 400 and the `failure` entry.

---

## Verified live

Caddy 2 in Docker (`tls internal`) in front of a real backend on a non-loopback
bind with `devOpen: false`, `trustedProxies: ["private"]`, `auth` at 6/min
burst 3:

| Checked | Result |
|---|---|
| TLS, one origin | `HTTP/2 200` on `/health` |
| `Server` header, request id | `nodegx-backend/0.1.0`, `x-request-id` present |
| `/metrics` at the edge vs locally | `404` through Caddy; exposition on loopback |
| Client address through the proxy | forwarded client recorded, not the proxy |
| Forged `X-Forwarded-For: 9.9.9.9` | **ignored** — rightmost hop won |
| Rate limit through TLS | 3 allowed, then `429` + `Retry-After: 10` |
| Failed admin login | audit entry: `failure`, 401, origin, request id |
| The old accept-and-ignore body | `400` naming the shape, **and** a `failure` entry |
| SSE through the proxy | `connected` frame immediate — unbuffered |
| `SIGTERM` | `resync`/`server-shutdown`, 26ms drain, exit 0 |
| Public-bind warning | `cors.wildcard-on-public-bind` at startup |

The dashboard's Audit view was driven in **jsdom** against a live backend: nav
entry present, rows rendered, the action filter populated from the server's
declared vocabulary (42 options), filtering narrowing the table, the detail
modal showing the request id, and no console errors.

---

## Residuals

- **Not distributed**, by design and by the phase's scope: in-memory buckets,
  one process's metrics, a local trail. Two replicas each get their own budget.
- **CLI backup/restore is not audited.** The HTTP routes are; `nodegx-backend
  restore` from a shell writes an execution record but no `_Audit` row, because
  that process has no request to attribute it to. Adding it means giving the
  CLI an actor concept.
- **The nginx TLS path was not re-verified** in this pass (Caddy was);
  `deploy/nginx.conf` changed only by adding the `/metrics` refusal.
- **No OpenTelemetry.** Request ids are the seam if it is ever wanted.
- The dashboard Audit view is jsdom-verified, not eyeballed in a real browser.
