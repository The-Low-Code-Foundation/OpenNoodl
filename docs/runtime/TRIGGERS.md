# Triggers — Schedule, Webhook, DB-Change (NodeGX Backend)

Triggers are what turn the NodeGX backend's request/response **functions** into an
**automation platform**. A trigger invokes a designated cloud function when
something happens: a clock ticks (schedule), an HTTP request arrives (webhook),
or a database row changes (db-change). This is the "webhook-in → process → store
→ scheduled digest" backend curriculum, in graphs.

Triggers live in the `nodegx-backend` service (WF-004). They fire while the
service runs, are configured through the editor's **Backend Services → Triggers**
panel or the MCP trigger tools, and are **persisted so they survive a restart and
deploy with the backend**.

- **Config:** `<dataDir>/triggers.json` — diffable, deployable, MCP-editable.
- **Secrets:** `<dataDir>/secrets.json` — machine-local, mode 0600 (see below).
- **CRUD:** `GET/POST/PUT/DELETE /admin/triggers[/:id]` (admin-credentialed),
  proxied by the editor and driven by MCP.

Every trigger firing — success OR refusal — produces an **execution record** in
the History Panel (WF-006), tagged with the trigger type and source.

---

## The firing contract

All three trigger types share **one** code path from "trigger fired" to
"execution record written" (`TriggerDispatcher`):

- **Fire:** the target function exists → run it; the run is logged with the
  trigger's type (`schedule` / `webhook` / `db_change`) and a `triggerSource` in
  the execution metadata.
- **Reject (loud):** a refused fire — a bad webhook secret, an oversize body, a
  missing target function — writes a **failed** execution record and stamps the
  trigger's `lastResult`, then returns the error. Nothing fails silently
  (RUN-004 loud-failure doctrine).

Workflows (WF-001, when they land) become a second target `kind` on this same
contract — the semantics are designed once.

---

## Schedule (cron)

A standard 5-field cron expression (or an `@preset`) attached to a function.

```
minute hour day-of-month month day-of-week
```

- Fields support `*`, `n`, `a-b`, `a-b/step`, `*/step`, comma-lists, month names
  (`JAN`…`DEC`) and day names (`SUN`…`SAT`); day-of-week `0` or `7` is Sunday.
- Presets: `@yearly` `@monthly` `@weekly` `@daily` `@hourly` `@minutely`.
- When **both** day-of-month and day-of-week are restricted, a date matches if
  **either** does (standard cron rule).
- Times are evaluated in the **service's local timezone**.

The UI shows **last fired** and **next fire**.

### Missed-fire policy (decided + documented)

The service is not always up, so scheduled fires can be missed while it is down.
Each schedule trigger picks a policy:

| Policy | Behavior |
|---|---|
| `skip` (default) | Missed windows are ignored; resume at the next **future** fire. |
| `run-once-on-start` | If ≥1 fire was missed while down, run the target **exactly once** at startup (never once per missed window — no catch-up storm), then resume. |

Rationale: for a single-process scheduler, "skip" or "one catch-up" are the
honest choices. Replaying every missed window implies a durability guarantee we
do not make. An explicit, visible policy (with last/next fire in the UI) beats
false precision.

---

## Webhook

Route: **`POST /hooks/<backend-id>/<hook-slug>`** → a designated function, with
the request as payload.

- **Localhost + WF-004 auth govern reachability.** By default the service binds
  to `127.0.0.1`, so hooks are not exposed. A deployed instance exposes them
  deliberately; a non-loopback bind requires WF-004's admin credential and the
  BAK-003 posture. The per-hook secret governs whether a *reachable* request is
  *accepted*.
- **Per-hook secret (the decision).** The default scheme is **`hmac-sha256`** —
  what GitHub (`X-Hub-Signature-256: sha256=<hex>`) and Stripe (an HMAC-SHA256
  over the payload) actually send. The verifier computes an HMAC-SHA256 over the
  **raw request bytes** and accepts the signature from `X-Hub-Signature-256`,
  `X-Signature-256`, or `X-Webhook-Signature` (hex or base64, optional `sha256=`
  prefix), constant-time compared. Point GitHub straight at it.
  - A **`token`** scheme is also available (shared token in `X-Webhook-Token`,
    `Authorization: Bearer`, or `?token=`) for senders that cannot sign. It is
    weaker (the secret crosses the wire) — documented, not default.
- **Payload-size limit.** Per-hook `maxBodyBytes` (default 1 MB). An oversize
  body is rejected **413** and recorded.
- **Enable/disable** per hook. A disabled or unknown slug is `404` (no record,
  to avoid probe spam).
- **Unauthenticated hooks are rejected LOUDLY** into the execution record: a
  missing/invalid signature returns `401` **and** writes a failed execution
  entry with the reason.

The secret is returned **exactly once** at creation (like an API key) and is
unrecoverable afterward.

### Payload shape

The function receives a uniform envelope as its request body:

```json
{ "trigger": "webhook", "triggerId": "trg_…", "slug": "github",
  "headers": { … }, "query": { … }, "body": <the parsed webhook payload> }
```

Read `body` for what the sender posted, `headers` for signatures/metadata.

---

## DB-change

An `insert` / `update` / `delete` on a chosen collection invokes a function with
the change payload.

- **Delivered post-commit.** The source is **BAK-001's `ChangeBus`** — the same
  single post-commit tap the realtime SSE hub uses. DB-change is the bus's
  *second consumer*; there is no second event tap. A `delete` carries the
  pre-delete record, so a delete handler can see the row.
- Payload envelope: `{ trigger: "db-change", triggerId, action, collection, id, record }`.

### Loop protection (decided + documented + tested)

A handler that writes to its own trigger table would emit another change event
and recurse. The rule is a **depth cap** (`maxChangeDepth` in `triggers.json`,
default **1**): while that many db-change handlers are in flight, further change
events are **suppressed** rather than re-triggering. Default 1 = **"no re-trigger
from trigger-context writes"**; a larger cap permits bounded chains.

> **Honest limitation.** The guard is time-window based (single process, no
> per-write provenance across the loopback boundary). A consequence is that an
> *unrelated* external write landing while a db-change handler runs is also
> suppressed. For single-process v1 this is the safe trade — a missed delivery
> over an unbounded loop. Tested in `tests/dbchange.test.ts`.

---

## Secrets convention (shared)

`<dataDir>/secrets.json` is the **one** secrets file for the backend, written
mode **0600**. It is a flat JSON object **namespaced by subsystem** so features
built independently never collide:

```json
{
  "adminToken": "…",                       // BAK-003 security (top-level)
  "webhooks":   { "<triggerId>": "…" },    // WF-005 triggers (this feature)
  "email":      { … }                      // BAK-002 email (reserved namespace)
}
```

Rules: every writer read-modify-writes the whole file preserving other keys, and
owns exactly one namespace. Secrets live **only** here — never in the diffable
`triggers.json` / `security.json`, which may reference a secret by id but never
contain its plaintext. `secrets.json` is machine-local credential material: it is
**not** committed and does **not** travel in the diffable config; a deploy target
provisions it (or the service mints missing secrets on first start).

---

## Agents (MCP) and the editor

- **MCP (SUB-008):** `list_backend_triggers`, `get_backend_trigger`,
  `create_backend_trigger`, `update_backend_trigger`,
  `set_backend_trigger_enabled`, `delete_backend_trigger`. An agent can
  enumerate and author every trigger type; webhook secrets are returned once and
  never listed.
- **Editor:** Backend Services → a running local backend → **Triggers** opens a
  panel to add/enable/disable/delete triggers and see each one's type, config,
  enabled state, last fired, next fire, and last result, plus a **Test fire**.

Trigger configuration is **not node-shaped** — triggers target existing cloud
functions, whose `noodl.cloud.request` node is the entry point — so no new
catalog node ships; agent visibility is the MCP surface above (per the spec's
"configuration that isn't node-shaped is still visible via MCP").

---

## Out of scope (v1, honestly)

- No queues, at-least-once delivery, or distributed scheduling — single-process
  semantics.
- No polling triggers (IMAP/RSS/third-party) — integration territory, parked.
- No public tunnel for local webhooks — a deployed instance is the answer.
- One documented retry default (none beyond the single fire); rich retry is
  WF-002's error-node territory.
