# Self-hosting — one deploy target, done properly

NodeGX supports exactly one packaged deployment path: **Docker Compose on a
machine you control** — a school server, an office box, a €5 VPS. One command
brings up your application, its backend, and the admin dashboard on a single
port, with no vendor account, no per-user cost, and no credit card.

This is deliberately the only path we package. A partially-supported second
target costs more in documentation, support, and broken promises than it ever
returns. If you want to host some other way, see [Other hosting](#other-hosting)
at the end — deploying somewhere else is a supported thing to want, it just is
not something this page automates.

## What you get

One published port serving three things on **one origin**:

| Path | What it is |
|---|---|
| `/` | Your application |
| `/_admin` | The [admin dashboard](./BACKEND-ADMIN-DASHBOARD.md) — collections, users, permissions, triggers, backups |
| `/classes`, `/api/…`, `/functions/…`, `/files/…` | The backend API your app calls |

Single origin is the point, not an implementation detail. A NodeGX app does not
discover its backend at runtime — the editor bakes the endpoint into the app
bundle when you deploy — so the fewer distinct URLs involved, the fewer ways
that value can be wrong. It also means no CORS configuration, one firewall
rule, and one TLS certificate.

Behind the port are two containers: `web` (nginx, serving your app and
forwarding API paths) and `backend` (the NodeGX backend service). The backend
publishes no port of its own; the front door is the only way in.

## Before you start

You need Docker with Compose v2 (`docker compose version`), and a checkout of
this repository for the `packages/nodegx-backend/deploy/` directory.

**Then do the one thing that is easy to get wrong.** In the editor, open
**Backend Services** and set the endpoint to *the URL this deployment will be
reached at* — `https://apps.myschool.example`, or `http://192.168.1.50:8080`
on a LAN, or `http://127.0.0.1:8080` if you are only smoke-testing on your own
machine. The same origin serves the app and the API, so this is one value, and
it is the site's own address.

If you leave it pointing at your development backend, the deployed app will
load, render its shell, and never fetch any data — and it will work perfectly
on your machine, because your machine is where that backend is. The packaging
step checks for this and refuses (see [Troubleshooting](#troubleshooting)), but
it can only check against a URL you tell it.

Now export the app: **Deploy → Self Hosting → Deploy to folder**, and note the
folder you chose.

## The happy path

```bash
cd packages/nodegx-backend/deploy

# Package, build images, and start. --app and --site-url are remembered.
./nodegx-deploy.sh deploy \
  --app /path/to/your/deployed/folder \
  --site-url https://apps.myschool.example
```

That runs four steps you can also run by hand: it packages a deterministic
artifact (the backend bundle plus your app, with a build id derived from the
artifact's own content hash), builds two images tagged with that id, writes the
tag to `.env`, and starts the stack.

When it finishes it prints the URL and whether the stack answers. Then find your
admin credential — on a first run the backend mints one and says where it is:

```bash
docker compose logs backend | grep -A3 "FIRST RUN"
docker compose exec backend cat /data/secrets.json
```

Open `/_admin`, paste that value, and you are administering a deployed backend.

To choose your own credential instead, see [Credentials](#credentials) below.

### Updating

Re-export from the editor, then:

```bash
./nodegx-deploy.sh deploy      # remembers --app and --site-url
```

A redeploy is the same operation as the first deploy. The data volume is not
touched, and the new build gets a new id, so the previous images stay on the
machine and remain runnable.

## Configuration

Copy `env.example` to `.env` and edit. Everything is optional except the
credential decision.

| Variable | Default | Meaning |
|---|---|---|
| `NODEGX_HTTP_PORT` | `8080` | Host port for the whole stack |
| `NODEGX_BIND` | `0.0.0.0` | Host interface. Use `127.0.0.1` when a reverse proxy on the same box terminates TLS |
| `NODEGX_TAG` | written by the script | The build id currently deployed |
| `NODEGX_BACKEND_ID` | `nodegx-backend` | Doubles as the accepted app id — must match the editor's **App ID** |
| `NODEGX_ADMIN_TOKEN` / `NODEGX_ADMIN_TOKEN_FILE` | unset | The admin credential |
| `NODEGX_READONLY_TOKEN_FILE` | unset | A second credential that reads everything and changes nothing |
| `NODEGX_ADMIN_DASHBOARD` | `true` | Set `false` to not route `/_admin` at all |

`.env` is read by Compose only. It is excluded from the Docker build context,
and packaging **fails** if a file like it ever turns up inside an artifact.

### Credentials

Three options, in increasing order of care:

- **Let the backend mint one** (leave both variables empty). It is written to
  `/data/secrets.json` inside the volume, mode `0600`, and reused on every
  restart. Good for a box only you can reach.
- **`NODEGX_ADMIN_TOKEN=…`** in `.env`. Simple, but the value is visible in the
  container's process arguments and in `docker inspect`.
- **`NODEGX_ADMIN_TOKEN_FILE=/run/secrets/nodegx_admin_token`** with the
  `secrets:` blocks in `docker-compose.yml` uncommented, and the secret in
  `./secrets/admin_token`. The value never enters `.env`, an image layer, or
  `docker inspect`. This is the right answer for anything shared.

No credential is ever baked into an image. `scripts/package-deploy.js` scans
every byte of the artifact for credential material — private keys, cloud API
keys, connection strings with passwords, serialised admin tokens, and the
machine-local files (`secrets.json`, `.env`, `*.db`, `*.pem`) — and refuses to
package a hit rather than warning about it.

### TLS and domains

Out of scope here, and genuinely simple: set `NODEGX_BIND=127.0.0.1`, then put
Caddy, nginx, or your existing reverse proxy in front of `127.0.0.1:8080` and
let it handle certificates. Because everything is one origin on one port, that
is a single `reverse_proxy` line.

A working Caddyfile — verified against a live backend, including the parts that
are easy to get wrong (SSE must not be buffered, `/metrics` should not be
published, and the proxy's `X-Forwarded-For` has to be one the backend
believes) — is at
[`packages/nodegx-backend/deploy/Caddyfile.example`](../../packages/nodegx-backend/deploy/Caddyfile.example).

### Day-two operations

Logs, rate limits, metrics, the audit trail, shutdown behaviour, systemd units,
and what to check when the thing is slow all live in
**[Running a NodeGX backend in production](./BACKEND-OPERATIONS.md)**. Read it
once your first deploy is up.

## Rollback

Rolling back **code** is one command, and it is tested rather than merely
described:

```bash
./nodegx-deploy.sh versions     # what is running, and what you can go back to
./nodegx-deploy.sh rollback     # to the previous build
./nodegx-deploy.sh rollback 09cbcd63b440   # or to a specific build id
```

Rollback re-points the stack at images that are already on the machine — it
refuses if they are not, rather than taking the stack down during an incident to
discover that. It is also reversible: rolling back records the version you left,
so rolling forward again is the same command.

**It rolls back code, not data.** The volume is untouched, which is what you
want unless the deploy changed the schema. For that case take a backup *before*
deploying, and restore it with the service stopped —
[BACKUP-RESTORE.md](../../packages/nodegx-backend/docs/BACKUP-RESTORE.md) is
the runbook, and it also covers promoting schema changes from a development
backend to a production one without touching production data.

## Backups

The volume is the only stateful thing in the stack: SQLite, uploaded files,
workflows, `security.json`, `secrets.json`. Back it up with the backend's own
command, not by copying the live database file:

```bash
docker compose exec backend node /app/cli.js backup --data-dir /data
```

Scheduled backups, retention, off-box copies, and the restore runbook are in
[BACKUP-RESTORE.md](../../packages/nodegx-backend/docs/BACKUP-RESTORE.md).

## Troubleshooting

**Packaging refuses: "the app bundle has `http://localhost:8577` baked in".**
The exported app points at your development backend. Fix the endpoint in
**Backend Services**, re-export, and package again. This is the most common
first-deploy failure and the check exists so that you meet it now rather than
after users do.

**The backend refuses to start: "devOpen: true but the service is asked to bind
beyond localhost".** The data directory came from a development machine.
Dev-open disables all access control and only ever applies to a loopback bind,
so the backend refuses rather than serving your data wide open. Set
`"devOpen": false` in `security.json` and configure collection permissions —
see [BACKEND-ACCESS-CONTROL.md](./BACKEND-ACCESS-CONTROL.md). A fresh deploy
never hits this: the container writes a locked policy on first run.

**The app loads but shows no data, and `/_admin` works fine.** Almost always the
baked endpoint again — open the browser's network tab and look at where the
`/classes` or `/api` requests are going. If they are going to the right origin
and returning 401, the app is not signed in and your collection permissions
require authentication, which is the default.

**502 from nginx.** The backend is not healthy. `./nodegx-deploy.sh logs backend`
— the reason is normally in the first twenty lines, and the service fails loudly
rather than degrading (a SQLite engine that will not load is a refusal to start,
not a silent switch to in-memory data).

**`/_admin` returns 404.** `NODEGX_ADMIN_DASHBOARD=false` — when the dashboard is
disabled the route is not registered at all, so it 404s like any unknown path.

**A newly added backend feature 404s in production but works locally.** nginx
forwards a known list of top-level API paths. There is a test that fails when
the backend grows a route family the list does not cover
(`tests/deploy-assets.test.ts`), so this should be caught before release — but
if you hit it, add the segment to the `location ~ ^/(…)` alternation in
`deploy/nginx.conf`.

**Reserved paths.** Because app and API share an origin, these top-level names
belong to the backend and cannot be used by your app's own files or routes:
`_admin`, `admin`, `aggregate`, `api`, `apps`, `auth`, `classes`, `config`,
`executions`, `files`, `functions`, `health`, `hooks`, `login`, `logout`,
`oauth`, `realtime`, `requestPasswordReset`, `users`, `verificationEmailRequest`.

## Other hosting

Nothing about a NodeGX deploy is exotic. The application is a static folder, and
the backend is a single self-contained JavaScript file that runs on plain
Node.js (≥ 22.13) with no `node_modules`:

```bash
node cli.js serve --data-dir /var/lib/nodegx --port 8577 --host 0.0.0.0
```

So you can deploy the app to any static host and run that command under systemd,
or use a different container platform, or your existing Kubernetes. Package the
artifact with `node scripts/package-deploy.js --app <folder>` and you have the
same deterministic tree the images are built from; the pieces in
`deploy/nginx.conf` and `deploy/entrypoint.sh` are the reference for what any
other front door needs to do.

The two things you must reproduce yourself, whatever you use: serve the app and
the API on one origin (or set the endpoint to wherever the API really is), and
never bind the backend beyond localhost with `devOpen` still on — it will refuse,
and that refusal is protecting you.

A more thorough answer is planned: **code export** (Phase 18) turns a project
into a conventional React application you can build and deploy by entirely
ordinary means, with no NodeGX runtime involved. That work has not started yet —
it is a roadmap item, not a feature you can use today, and this page will point
at it when it lands.
