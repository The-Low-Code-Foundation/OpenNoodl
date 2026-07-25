# @noodl/nodegx-backend

The standalone NodeGX backend service (WF-004). Runs **headless with no
Electron** — as a child process the editor spawns in development, and as a plain
Node service in deployment.

> **Status: front-half scaffold.** The package boundary, entry point, config/auth
> policy, and the (verified) persistence + SQLite engine seam are real. The HTTP
> route surface, WorkflowRunner, and ExecutionStore are labelled placeholders
> whose relocation is deferred to the second half of WF-004 / WF-006. See
> [`NOTES.md`](./NOTES.md).

## Quick start

```bash
npm run build          # tsc -> dist/

# Port-free headless smoke: open persistence, print status, exit.
node bin/nodegx-backend.js doctor --data-dir ./.data

# Start the service (health-only in the scaffold).
node bin/nodegx-backend.js serve --data-dir ./.data --port 8577
curl http://127.0.0.1:8577/health
```

## CLI

```
nodegx-backend serve  --data-dir <dir> --port <p> [--host <h>] [--token <t>] [--ephemeral]
nodegx-backend doctor --data-dir <dir> [--ephemeral]
```

- `--host` defaults to `127.0.0.1`. A non-loopback bind **requires** a bearer
  token (one is generated if you don't pass `--token`).
- `--ephemeral` opts in to non-persisting in-memory mode **only** if no SQLite
  engine can load. Off by default: the service refuses to start rather than
  silently losing data (RUN-004 loud-failure policy).

## Database engine

`node:sqlite` (built into Node ≥ 22.13) — zero native dependency, zero ABI
matrix. `better-sqlite3` is a legacy fallback used only if it happens to be
installed. Decision + compatibility evidence: [`NOTES.md`](./NOTES.md).

## Package layout

| Path | State |
|------|-------|
| `src/config.ts` | **real** — options, bind/auth policy |
| `src/persistence/createAdapter.ts` | **real** — opens the DB via `@noodl/runtime` adapter |
| `src/service.ts` | **real** — composition root |
| `src/cli.ts`, `bin/` | **real** — entry point |
| `src/server/HttpServer.ts` | placeholder — `/health` only; routes deferred (WF-006 collision) |
| `src/workflow/WorkflowRunner.ts` | placeholder — reserved home (WF-006 owns current file) |
| `src/execution/ExecutionStore.ts` | placeholder — introduced by WF-006 |
