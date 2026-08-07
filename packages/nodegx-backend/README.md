# @noodl/nodegx-backend

The standalone NodeGX backend service (WF-004). Runs **headless with no
Electron** — as a supervised child process the editor spawns in development,
and as a plain Node service in deployment. One self-contained bundle
(`dist/cli.js`), one SQLite database, three route families.

## Quick start

```bash
npm run build          # esbuild -> dist/cli.js (self-contained) + dist/index.js

# Port-free headless smoke: open persistence, print status, exit.
node bin/nodegx-backend.js doctor --data-dir ./.data

# Start the full service.
node bin/nodegx-backend.js serve --data-dir ./.data --port 8577
curl http://127.0.0.1:8577/health
```

When ready, `serve` prints a machine-readable line the editor's supervisor
handshakes on:

```
NODEGX_BACKEND_READY {"port":8577,"url":"http://127.0.0.1:8577","persistence":"persistent","engine":"node:sqlite"}
```

## CLI

```
nodegx-backend serve  --data-dir <dir> --port <p> [--host <h>] [--token <t>]
                      [--backend-id <id>] [--backend-name <name>] [--ephemeral]
nodegx-backend doctor --data-dir <dir> [--ephemeral]
```

- `--host` defaults to `127.0.0.1`. A non-loopback bind **requires** a bearer
  token (one is generated if you don't pass `--token`); everything except
  `/health` then wants `Authorization: Bearer <token>`.
- `--ephemeral` opts in to non-persisting in-memory mode **only** if no SQLite
  engine can load. Off by default: the service refuses to start rather than
  silently losing data (RUN-004 loud-failure policy).

## HTTP surface

| Family | Routes | Who speaks it |
|--------|--------|---------------|
| **Parse-wire** | `/classes/:c[/:id]`, `/aggregate/:c`, `/files/:name`, `/functions/:name`, `/config`, `/login`, `/logout`, `/users`, `/users/me`, `/users/:id` | The runtime's record / user / cloud-function / config nodes — unchanged clients (`cloudstore.js`, `userservice.ts`, `cloudfunctions.js`, `configservice.js`) |
| **BYOB** | `/api/:table[/:id]`, `/api/_schema`, `/api/_batch` | The `noodl.byob.*` nodes and the Data Browser |
| **Admin** | `/health`, `/admin/status`, `/admin/schema*`, `/admin/schema-export`, `/admin/workflows*`, `/executions[/:id]` | The editor's BackendManager (IPC → HTTP proxy) and ops tooling |
| **Access control** | `/admin/permissions*`, `/admin/roles*`, `/admin/keys*` | The Permissions panel, the MCP backend tools, and the served dashboard |
| **Admin dashboard** | `/_admin`, `/_admin/whoami` | A browser. The service serves its own operator UI (BAK-005) — see below |
| **Operations** | `/metrics`, `/admin/audit`, `/admin/ops` | Prometheus; the audit trail and operational config (BAK-009) — see [`docs/runtime/BACKEND-OPERATIONS.md`](../../docs/runtime/BACKEND-OPERATIONS.md) |

All three front the same `LocalSQLAdapter` database. Cloud functions run in
this process via the bundled CloudRunner; record/user/config nodes *inside* a
function loop back over the Parse-wire routes (`_noodl_cloudservices` points at
the service itself, carrying the master key so functions run as system). Every
function run is logged — scrubbed — to `<dataDir>/executions.sqlite`.

## Access control (BAK-003)

Every route is enforced through one declarative route table: collection-level
permissions (CLPs) gate operations, per-record ACLs filter rows **in SQL**, and
three principal types (admin credential, scoped API keys, session users +
roles) resolve before any handler runs. A fresh backend is **dev-open** on
localhost and *refuses to start* if asked to bind non-loopback with dev-open on
— the unsafe path is impossible, not merely discouraged.

- Policy lives in `<dataDir>/security.json` (diffable, deploys with the
  backend); the admin credential in `<dataDir>/secrets.json` (0600). `--token`
  provisions the admin credential.
- The model of record: [`BAK-003-SECURITY-MODEL.md`](../../dev-docs/tasks/phase-22-production-backend/BAK-003-SECURITY-MODEL.md).
  Operator guide: [`docs/runtime/BACKEND-ACCESS-CONTROL.md`](../../docs/runtime/BACKEND-ACCESS-CONTROL.md).
- `src/security/model.ts` exports the pure model (`canReadRecord`,
  `resolvePrincipal`, CLP evaluation) — the contract BAK-001's realtime
  delivery consumes so query filtering and event filtering cannot drift.

## The served admin dashboard (BAK-005)

The service carries its own operator UI at **`/_admin`** — collections, schema,
users, roles, permissions, API keys, triggers, workflows, executions, email and
backups — so a deployed backend is administrable from a browser with no editor
installed. It signs in with the same admin credential above, and sections whose
backing subsystem is absent are not rendered rather than served broken.

- One self-contained document (markup + CSS + JS inlined at build time), so
  `dist/cli.js` is still the only artefact to deploy and the page's CSP can be
  `default-src 'none'` with a per-response nonce.
- `--readonly-token <t>` provisions a second credential that can read
  everything and write nothing — refused in the dispatcher, not the UI.
- `--no-admin` unregisters the routes entirely (404, not 403).
- Operator guide, including **exposure advice**:
  [`docs/runtime/BACKEND-ADMIN-DASHBOARD.md`](../../docs/runtime/BACKEND-ADMIN-DASHBOARD.md).

## Data directory layout

```
<dataDir>/
  data/local.db          # the database (node:sqlite)
  executions.sqlite      # execution history
  workflows/*.workflow.json
  files/                 # Parse-wire file uploads
  config-params.json     # optional: served at /config
  security.json          # access control (BAK-003)
  search.json            # full-text search opt-in (BAK-008)
  ops.json               # logging, rate limits, CORS, audit, metrics (BAK-009)
  secrets.json           # admin credential, SMTP/S3/webhook secrets (0600)
```

## Deploying it (WF-003)

`deploy/` is the supported self-hosting target: Docker Compose, two services,
**one published port** serving the application, the API and `/_admin` on a
single origin.

```bash
cd deploy
./nodegx-deploy.sh deploy --app /path/to/exported/app --site-url https://apps.example
./nodegx-deploy.sh rollback          # images are tagged by artifact digest
```

`npm run package:deploy` produces the same deterministic artifact on its own —
one bundle plus the app plus a hashed manifest — which is also what a plain
`scp` to a VPS wants. Operator documentation:
[`docs/runtime/SELF-HOSTING.md`](../../docs/runtime/SELF-HOSTING.md); the assets
themselves are mapped in [`deploy/README.md`](./deploy/README.md).

Once it is up, [`docs/runtime/BACKEND-OPERATIONS.md`](../../docs/runtime/BACKEND-OPERATIONS.md)
is the operator's page: structured logs and request ids, rate limits behind a
proxy, `/metrics`, the audit trail, graceful shutdown, a systemd unit, and the
verified Caddy example ([`deploy/Caddyfile.example`](./deploy/Caddyfile.example)).

## Database engine

`node:sqlite` (built into Node ≥ 22.13) — zero native dependency, zero ABI
matrix. `better-sqlite3` is a legacy fallback used only if it happens to be
installed. Decision + compatibility evidence, the process contract, the wire
subset's sharp edges, and honest residuals: [`NOTES.md`](./NOTES.md).
