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

### What a trigger targets

Every trigger names a target as `{ kind, name }`:

| `kind` | `name` is | What runs |
|---|---|---|
| `function` | the cloud function's name | the function, once |
| `workflow` | the workflow **id** | the WF-001 step DAG, through the engine |

A workflow target is a second target *kind* on this same contract, not a second
dispatch path — the semantics are designed once. A target that does not exist on
this backend fails **loudly at fire time** with `Trigger target … not found on
this backend`, recorded as a failed execution; the editor additionally warns
about it at author time, which is an addition rather than a replacement.

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

### `payload` — constant data every fire delivers

A schedule may carry a `payload` object, and it arrives as the run's **`body`** —
the same slot a webhook's JSON lands in:

```json
{
  "type": "schedule",
  "target": { "kind": "workflow", "name": "digest" },
  "schedule": {
    "cron": "0 3 * * *",
    "missedFirePolicy": "skip",
    "payload": { "mode": "nightly", "limit": 50 }
  }
}
```

The step then reads `{"$path": "body.mode"}` exactly as it would from a webhook,
which is what lets **one** definition serve both entry points. A schedule with no
payload still delivers `body: {}`, so `body.x` is safe to read unconditionally.

`payload` must be an object — it becomes `body`, which definitions read keys off.
It is schedule-only; a webhook's body comes from its caller and a db-change's is
the changed record.

**Test fire** (`POST /admin/triggers/:id/fire`, and the panel button) sends the
schedule's own payload when the caller posts no body, so a test fire exercises
what cron will actually send. An explicitly posted body still wins.

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
  - A **`token`** scheme is also available for senders that cannot sign. It is
    weaker (the secret crosses the wire) — documented, not default. **All three
    transports below work, and are the only three:**

    | Transport | Example |
    |---|---|
    | `X-Webhook-Token` header | `X-Webhook-Token: whsec_…` |
    | `Authorization: Bearer` | `Authorization: Bearer whsec_…` |
    | `?token=` query parameter | `POST /hooks/<backend-id>/<slug>?token=whsec_…` |

    A wrong secret in any of them is refused **401** with the *webhook's* reason
    (`Webhook rejected: webhook token does not match`) and recorded.

    > **Fixed in WFA-005.** `Authorization: Bearer` was accepted by the verifier
    > and advertised by its own error message, but could never authenticate: the
    > service resolved a principal for every request before routing and rejected
    > any Bearer that was not an admin token, so the sender got a bare
    > `{"error":"Unauthorized."}` that did not mention webhooks. The hook route
    > family is now exempt from service-credential resolution, because it carries
    > its own credential. An admin token gains nothing there — on a hook it is
    > compared against *that hook's* secret like any other caller's bytes.
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

The function receives the same envelope every entry point delivers (WFA-003):

```json
{ "trigger": { "type": "webhook", "id": "trg_…", "firedAt": "…", "slug": "github" },
  "triggerType": "webhook",
  "headers": { … }, "query": { … }, "body": <the parsed webhook payload> }
```

Read `body` for what the sender posted, `headers` for signatures/metadata. The
full language for reading these from a workflow step is in
[Workflow step kinds → Passing data between steps](./WORKFLOW-NODES.md#passing-data-between-steps).

> **Changed:** `trigger` used to be the type as a **string** (`"webhook"`) and is
> now the object above. Read **`triggerType`** — or `trigger.type` — for the
> string. Every other key this envelope used to carry is still delivered at the
> top level, deprecated, for one release.

---

## Answering the caller (`responseMode`)

A trigger whose target is a **workflow** carries `responseMode`, and it decides
what a caller gets back.

| `responseMode` | Response body | Status |
|---|---|---|
| `async` *(default, and every trigger written before CWF-002)* | `{"executionId": "…", "status": "success"}` | 200 / 500 |
| `sync` | The workflow's **output** — its [`return` step](./WORKFLOW-NODES.md#return)'s value, or the last step's output. `null` if it produced none. | 200 |
| `sync`, run failed | `{"executionId": "…", "status": "error", "error": "…"}` — an error **envelope**, never shaped like an output | 500 |
| `sync`, run too slow | `{"status": "running", "error": "…"}` | 504 |

A `sync` response also carries **`X-Execution-Id`**, so the run is still
findable without an envelope wrapped round the body.

```console
$ curl -sS -X POST http://127.0.0.1:8577/hooks/my-backend/quote \
    -H 'X-Webhook-Token: whsec_…' -d '{"lines":3}'
{"total":42,"currency":"GBP"}
```

**It is not the wait that `sync` adds — it is the cap.** The dispatcher has
always awaited the whole run before answering, in both modes, since triggers
shipped: a webhook pointed at a workflow with a ten-minute `wait` step has
always held the connection for ten minutes. What `sync` adds is
**`responseTimeoutMs`** (default **30 000**, maximum **300 000**). Past it the
caller gets a `504` and *the run continues* — it finishes, writes its execution
record and stamps the trigger, just with nobody on the line. Giving up on the
answer is not giving up on the work.

Two things `responseMode` deliberately does not do:

- **It is refused on a function target.** A trigger pointed at a cloud function
  already relays that function's own HTTP response verbatim. Setting `sync`
  there would be a flag stored by the registry and read by nothing, so the write
  is rejected with that sentence.
- **It changes nothing for a schedule or a db-change trigger firing normally.**
  There is no caller to answer. The field is only meaningful when a request is
  waiting — a webhook, or a manual test fire from the editor.

---

## DB-change

An `insert` / `update` / `delete` on a chosen collection invokes a function with
the change payload.

- **Delivered post-commit.** The source is **BAK-001's `ChangeBus`** — the same
  single post-commit tap the realtime SSE hub uses. DB-change is the bus's
  *second consumer*; there is no second event tap. A `delete` carries the
  pre-delete record, so a delete handler can see the row.
- Payload envelope: the changed record is `body`, and the change context is on
  `trigger`: `{ trigger: { type: "db_change", id, firedAt, collection, action, recordId }, triggerType: "db_change", body: <the record> }`.
  The pre-WFA-003 top-level keys (`triggerId`, `action`, `collection`, `id`,
  `record`) are still delivered, deprecated, for one release.

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
  `set_backend_trigger_enabled`, `rotate_backend_trigger_secret`,
  `delete_backend_trigger`. An agent can enumerate and author every trigger type;
  webhook secrets are returned once and never listed.
- **Editor:** Backend Services → a running local backend → **Triggers** opens a
  panel to add/edit/enable/disable/delete triggers and see each one's type,
  config, enabled state, last fired, next fire, and last result, plus a
  **Test fire**. The target is `{kind, name}` and both halves are chosen:
  `a cloud function` or `a workflow`, then a name from what that backend actually
  has. A name may still be typed — a function that is not deployed yet is a
  legitimate thing to point at — and is then flagged as unresolved rather than
  accepted silently.

### Editing an existing trigger (WFA-008)

**An edit keeps a webhook's secret.** That is the whole reason to edit rather
than delete and recreate: `PUT /admin/triggers/:id` mints only when no secret is
stored and replaces one only when the caller actually sends `secret`, so changing
a cron, a name or a target leaves every sender working.

What each change does to the integrations already pointing at a hook:

| Change | Senders |
|---|---|
| cron, missed-fire policy, payload, name, target, actions, collection | unaffected |
| `webhook.slug` | **the URL moves** — anything posting to the old one gets a 404. The credential itself is unchanged and works at the new address |
| rotating the secret | **every sender is rejected** until it is given the new value |

Rules the write path enforces, for the editor, an agent and `curl` alike:

- **`enabled` absent means "keep what is stored."** So an edit cannot re-enable a
  trigger somebody turned off; use the enable/disable route to change it.
- **Sending `secret` REPLACES it.** Rotation is therefore its own verb —
  `POST /admin/triggers/:id/secret` mints server-side and returns the new value
  **once**. It is recorded in the audit trail as `trigger.secret.rotate`, because
  it is the entry an operator looks for when working integrations start failing.
- **A trigger's `type` cannot be changed** (400). A different type is a different
  trigger: turning a webhook into a schedule would leave its secret orphaned in
  `secrets.json`, and turning it back would silently re-use that old secret.
  Create the new trigger, then delete the old one.
- **A `PUT` to an unknown id is a 404**, not a create. A trigger deleted while an
  editor form was open is not resurrected with a fresh secret and a reset fire
  count.
- **The config block is rebuilt from the input**, so a `PUT` sends its type's
  whole block (`{slug, scheme}`, `{cron, missedFirePolicy}`, …). Omitting it is a
  400, not "keep what is stored". `GET` → edit → `PUT` round-trips, and the
  registry-owned `status`, `createdAt` and `updatedAt` are accepted and ignored.
- **Status is not a configuration change.** `updatedAt` moves for an edit, a
  toggle or a rotation and **not** for a fire, which is what lets an editor tell
  "somebody changed this while I had it open" from "it fired twice".

The editor's form is on the Triggers panel for both creating and editing — the
canvas's trigger node offers **Edit this trigger…**, which opens that panel at
that trigger rather than putting a second form on the canvas. It reads the
trigger fresh when the form opens and again before it saves: if the definition
moved in between, it says what changed and saves nothing until you say so again.

### On the workflow canvas (WFA-005)

A workflow's triggers are drawn as its **entry nodes**, wired into its entry
step, so the whole automation is one picture:

| Node | Shows |
|---|---|
| Webhook | the full `POST /hooks/<backend-id>/<slug>` URL with a copy button, and which verification scheme is in force |
| Schedule | the cron, a plain-English reading of it, the next fire, the missed-fire policy, and the payload |
| DB change | the collection and the actions |
| Manual | drawn when *nothing* triggers the workflow, so "how does this start?" always has a visible answer |

Enabled/disabled is on the card itself, and right-clicking the node offers
**Edit this trigger…**, **Enable/Disable** and
**Delete this trigger from &lt;backend&gt;…**.

Three things to be clear about:

- **The nodes are a view.** A trigger is a backend object in `triggers.json`, not
  part of the workflow definition. Nothing about a trigger is written when the
  workflow is saved, and the drawn wire is derived from the definition's `entry`
  (dragging it to another step moves the entry — that is a change to the
  *workflow*).
- **Deleting the node deletes the trigger from the backend**, which is why it is
  on the menu behind a confirmation rather than on the canvas's delete key: canvas
  delete is local and undoable, and this is neither.
- **A trigger targeting a function has no node here** and stays in the panel. A
  function is not a workflow.
- **The secret is not recoverable from the node.** It was shown once at creation;
  the row says so rather than implying otherwise. Editing the trigger does not
  need it, and rotating it is a deliberate act with its own confirmation
  (see *Editing an existing trigger* above).

Trigger configuration was **not node-shaped** when WF-005 shipped, because a
trigger targeted a cloud function whose `noodl.cloud.request` node was already
the entry point. A *workflow* has no such node, which is what the entry nodes
above supply. Agent visibility is still the MCP surface, which reaches every
trigger type including the ones no canvas shows.

---

## Out of scope (v1, honestly)

- No queues, at-least-once delivery, or distributed scheduling — single-process
  semantics.
- No polling triggers (IMAP/RSS/third-party) — integration territory, parked.
- No public tunnel for local webhooks — a deployed instance is the answer.
- One documented retry default (none beyond the single fire); rich retry is
  WF-002's error-node territory.
