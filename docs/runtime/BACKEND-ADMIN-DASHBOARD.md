# The served admin dashboard

`nodegx-backend` carries its own web admin UI. A deployed backend is
administered from a browser with no NodeGX editor installed anywhere near it —
the thing you actually need on a VPS at 2am.

```
http://your-backend-host:8577/_admin
```

The editor keeps its Backend Services panel. That panel is for the backend you
are *building*; this dashboard is for the backend you are *running*. Both speak
the same HTTP routes to the same server, which is why they cannot drift.

---

## What it does

| Section | What you can do |
|---|---|
| **Collections** | Browse, filter (JSON `where`), page, create, edit and delete records. Optional **Live** toggle streams changes over the backend's SSE realtime. |
| **Schema** | See tables and columns; create tables; add columns; **delete a table** (typed confirmation). |
| **Users** | List `_User`, create a user, delete one, trigger a password-reset email, see role membership. |
| **Roles** | Create/delete roles, add members. Permissions reference these as `role:<name>`. |
| **Permissions** | Per-collection rules for `find`/`get`/`create`/`update`/`delete` plus creator-owns. Shows loudly when enforcement is off. |
| **API keys** | Issue scoped keys (secret shown once), revoke them. |
| **Triggers** | List schedules/webhooks/db-change hooks with last-fired and last-result; enable, disable, fire now. |
| **Workflows** | List WF-001 definitions and run them with a payload. |
| **Executions** | The full run history with per-run detail. |
| **Email** | SMTP settings, verification policy, templates, and a real test send. |
| **Backups** | Schedule and status, archive list, and "back up now". |

Sections whose backing subsystem is not present in your build are **not
rendered**. They never appear and then fail.

### What it deliberately does not do

- **Author graphs.** Functions and workflows are edited in the editor. The
  dashboard shows what they did; it does not write them.
- **Restore a backup.** The blessed recovery path is `nodegx-backend restore`
  with the service stopped. A one-click restore of a live service is a footgun,
  not a feature. (The route exists for automation; there is no button.)
- **Manage more than one backend.** One dashboard per instance.

---

## Signing in

The credential is BAK-003's admin credential — the same one the editor and MCP
use. There is no separate dashboard account.

Find it in the backend's data directory:

```
<data-dir>/secrets.json   →   { "adminToken": "…" }      (mode 0600)
```

Or choose your own at start:

```sh
nodegx-backend serve --data-dir /srv/nodegx --port 8577 --token "$(openssl rand -base64 32)"
```

The dashboard holds the token in `sessionStorage` (this tab only, cleared when
the tab closes) and sends it as `Authorization: Bearer …` on every request.
There is no cookie and therefore no CSRF surface.

### First run

Unlike Pocketbase, there is **no "create the first admin" page**, and this is
deliberate. A NodeGX backend always has an admin credential by the time it can
serve anything — it mints one on first start. An unauthenticated setup page on
an already-provisioned backend is a takeover waiting to happen, so instead:

- the service prints the dashboard URL and, when the credential was auto-minted
  on that start, exactly where to read it;
- the dashboard shows a first-run banner saying the same, and how to replace it
  with `--token`.

### Dev-open backends

If `security.json` has `"devOpen": true`, the backend enforces **nothing** —
collection permissions, row ACLs and this dashboard's own credential are all
bypassed. Dev-open is only ever active on a loopback bind (the service refuses
to start dev-open while bound wider), so this is a local-development state.

The dashboard does not stage a password prompt in front of a backend that would
ignore it. It opens straight up and puts a banner at the top of every page
saying enforcement is off.

---

## Read-only access

For support and demos: a second credential that can read everything the admin
surface exposes and change nothing.

```sh
nodegx-backend serve --data-dir /srv/nodegx \
  --token "$FULL_ADMIN_SECRET" \
  --readonly-token "$READONLY_SECRET"
```

It is stored as `adminReadonlyToken` beside `adminToken` in `secrets.json`.

- **Never minted automatically.** A backend has this tier only if you ask.
- **Enforced server-side, in the dispatcher.** A read-only admin cannot issue
  `POST`/`PUT`/`DELETE` on *any* route. It is not a UI toggle — hand someone the
  read-only token and `curl` cannot write either.
- **Refused loudly.** The response says which tier was used and what to use
  instead, so nobody debugs it as a broken backend.
- The only non-`GET` exceptions are three reads that need a request body:
  opening a realtime subscription, the permission dry-run, and the schema
  promotion *diff* (not `apply`).
- Providing a read-only token identical to the full one **refuses to start** —
  a "read-only" credential that silently grants write access is worse than none.

---

## Turning it off

```sh
nodegx-backend serve --data-dir /srv/nodegx --no-admin
```

The `/_admin` routes are **not registered**. They return 404, exactly like any
unknown path — an operator who disabled the dashboard leaks no evidence that
there was ever one to disable.

---

## Exposing it safely

The dashboard is an admin surface on a public port. Treat it accordingly.

**The cautious default — do not expose it at all.** Bind the service to
localhost and reach the dashboard over an SSH tunnel:

```sh
ssh -N -L 8577:127.0.0.1:8577 you@your-server
# then open http://127.0.0.1:8577/_admin locally
```

**If it must be reachable**, put it behind something that authenticates before
NodeGX sees the request:

- a VPN (Tailscale/WireGuard) — simplest and strongest;
- a reverse proxy with its own auth in front of `/_admin`;
- an IP allow-list on `/_admin` in nginx/Caddy.

**Always use TLS.** The credential travels in a header on every request; over
plain HTTP it is on the wire in cleartext. Terminate TLS at a reverse proxy.

### What the service already does for you

- **The page fetches nothing.** Markup, styles and script are one document, and
  its `Content-Security-Policy` is `default-src 'none'` with a per-response
  nonce and no `unsafe-inline`. No CDN, no font host, no analytics — a hostile
  value in one of your records has nowhere to send anything.
- **Record values never touch `innerHTML`.** They are rendered as text.
- **Failed credentials are rate-limited** — 10 failures per client per 5
  minutes, then `429` with `Retry-After`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `frame-ancestors 'none'` (it cannot be framed), `Cache-Control: no-store`.

### Two honest caveats

1. **The rate limiter keys on client identity** — `X-Forwarded-For` when
   present, otherwise the socket address. Directly exposed, an attacker sharing
   your NAT can burn the budget and lock *you* out for five minutes. Behind a
   correctly-configured reverse proxy it keys per real client. This is a
   deliberate trade: a speed bump beats a permanent lockout on a service with
   one credential and no recovery flow.
2. **The credential in the browser is the master key.** It bypasses all CLPs and
   ACLs by design. Cross-site scripting inside the dashboard would be a full
   compromise — which is what the CSP, the nonce and the no-`innerHTML` rule are
   for. Hand out the read-only token instead whenever read access is enough.

---

## For agents

Everything above is enumerable over MCP:

- `get_backend_admin_dashboard` — enabled/disabled, URL, which credential tier
  the agent itself holds, whether a read-only tier is provisioned, enforcement
  posture, and the available sections.
- The dashboard's data operations are the same routes the other backend tools
  already use (`get_backend_permissions`, `list_backend_roles`,
  `list_backend_triggers`, `list_backend_backups`, …).

---

## See also

- [Access control](./BACKEND-ACCESS-CONTROL.md) — the credential, CLPs, ACLs, roles, keys
- [Realtime](./REALTIME.md) — the SSE stream the Live toggle rides
- [Email](./BACKEND-EMAIL.md) — SMTP and the reset/verify flows
- [Backup & restore](../../packages/nodegx-backend/docs/BACKUP-RESTORE.md) — the CLI restore path
