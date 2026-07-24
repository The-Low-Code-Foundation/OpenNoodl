# WF-004: The Standalone Backend Service

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WF-004 |
| **Phase** | Phase 19 — Cloud & Workflows (Revival Track G) |
| **Priority** | 🟠 High (shapes everything downstream in the phase) |
| **Difficulty** | 🟡 Medium (architecture decisions; the code moves more than it changes) |
| **Estimated Time** | 2–3 weeks |
| **Prerequisites** | Coordinate with RUN-004 (shared engine decision); REV-001 |
| **Branch** | `task/wf-004-backend-service` |
| **Recommended executor** | 🔵 **Fable 5** — the process model, package boundary, and database-engine decision are semantics-defining and expensive to reverse. The extraction itself delegates down once decided. |

## Objective

Extract the local backend out of Electron's main process into its own package — working name `packages/nodegx-backend` — that runs as a child process during development and as a plain headless Node service in deployment, with a real database underneath it.

## Background

The local backend (BackendManager, LocalBackendServer, WorkflowRunner, the SQL adapter stack) currently lives inside the editor's main process. That placement is why three separate problems exist ([BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) §3):

1. **It can never be deployed.** A backend that only exists inside Electron cannot run on a server, which is why WF-003 previously had to imagine bespoke deployment machinery. As a standalone service, deploy becomes "run this Node service."
2. **It inherits Electron's native-module ABI problem.** `better-sqlite3` — never actually installed (RUN-004) — would need Electron-ABI builds across three platforms forever. Process separation and/or `node:sqlite` can dissolve this entirely.
3. **No crash isolation.** A hung workflow (WF-001's future concern) must not wedge the editor; a process boundary makes cancellation enforceable in the worst case.

The extraction is mostly relocation, not rewrite: the HTTP surface, adapter stack, and schema/config persistence move as-is. The genuinely new design work is the process contract (lifecycle, discovery, auth) and the engine decision.

## Current State

- `packages/noodl-editor/src/main/src/local-backend/` — `BackendManager.js` (801 lines, IPC handlers + config/schema persistence under `~/.noodl/backends/<id>/`), `LocalBackendServer.js` (595, HTTP server), `WorkflowRunner.js` (400, loader/dispatcher), `index.js`. Wired at `main.js:30,657,694`. **Note:** RUN-004's doc says `editor/src/local-backend/` — that path does not exist; this one is real.
- `packages/noodl-runtime/src/api/adapters/` — `LocalSQLAdapter.js` (779) + `QueryBuilder.js` (717) + `SchemaManager.js` (594); engine access funneled through one guarded `require('better-sqlite3')` at `LocalSQLAdapter.js:70`, falling back **silently** to an in-memory mock (`:98-103`). The module was never installed in any package.
- Editor UI (Backend Services panel, schema manager, data browser, ~4,600 lines) talks to `BackendManager` over renderer IPC — this seam stays; only what's behind it moves.
- `WorkflowRunner.findViewerCloudPath()` probes three paths and silently disables workflows if `noodl-viewer-cloud` doesn't resolve — an example of the quiet-failure pattern this task ends.

## Desired State

- `packages/nodegx-backend`: a package with a clean entry point (`nodegx-backend serve --data-dir <dir> --port <p>`), no Electron imports anywhere in it, embedding the HTTP surface, adapter stack, WorkflowRunner, and (from WF-006) the execution store.
- The editor spawns it as a **child process** and supervises it: start/stop/restart, health checks, log capture, status surfaced in the Backend Services panel. Renderer IPC → main process → HTTP/RPC to the service; the UI is unchanged.
- The same package runs headless on a server — this is WF-003's deployable artifact.
- **A real database.** The engine decision is made and recorded (see below); the silent mock fallback is gone (RUN-004's loud-failure policy applies here too — a backend that can't open its database says so and refuses, it does not pretend).
- **Minimal auth:** bound to localhost by default; a bearer token (generated per backend, stored in its config) required the moment it binds to anything wider. Full deploy hardening is WF-003's.

## The engine decision

Decide with RUN-004, record the reasoning in NOTES, and hold both tasks to the same answer:

- **Option A — `node:sqlite` (`DatabaseSync`).** Built into Node (flag-free since ~22.13/23.4). Zero native dependency, zero ABI matrix, works identically in the child process, in headless deploys, and (if needed) in Electron's main process. Verify: the Node versions actually in play (Electron's bundled Node for any in-editor use; the system/container Node for deploys), and API coverage against what `LocalSQLAdapter`/`QueryBuilder` use — prepared statements, transactions, WAL pragma, `last_insert_rowid`.
- **Option B — `better-sqlite3` with prebuilt binaries.** Battle-tested and API-matching the adapter's assumptions; in a separate system-Node process, prebuilds are routine and the Electron-ABI question vanishes anyway.

Either way the swap surface is one `require` in one file plus whatever thin shim the chosen API needs. Bias: **A if it covers the API surface**, because a dependency that doesn't exist can't break — but verify, don't assume; record a small compatibility-test file either way.

## The wire-protocol decision (added 2026-07-24 — see BACKEND-GAP-ASSESSMENT §3.4)

The service's data/auth/function routes speak the **Parse-wire subset** that the four existing runtime clients emit (`cloudstore.js`, `userservice.ts`, `cloudfunctions.js`, `configservice.js`). This is load-bearing: it is what makes the 9 record nodes ("Query Records", "Record", relations…) and the user nodes work against the local backend **with zero client-file changes** — today they cannot talk to it at all — and what licenses WF-007's deletions.

Concretely, the subset (from the 2026-07-24 framework map; verify against the clients, not Parse docs):

- `/classes/<collection>` CRUD incl. POST+`_method:GET` queries with the operator grammar `QueryBuilder.js` already largely encodes; `order`, `limit`/`skip`, `include` (pointer expansion), `keys`, `count`
- `/aggregate/<collection>` + `distinct`; `Increment`, `AddRelation`/`RemoveRelation` ops; Pointer/Date/File/GeoPoint types
- `/files/<name>` upload/delete (store beside the SQLite data dir)
- `/functions/<name>` (routes to CloudRunner — and later the WF-001 engine)
- `/config` (serve from backend config)
- Sessions: `/login`, `/logout`, `/users` (signup), `/users/me`, `/users/<id>` PUT; `X-Parse-Session-Token`; error code 209 for invalid session. Password-reset/email-verify endpoints may return 501 in v1 — record it. The two endpoints the client scrapes as HTML keep their shape.
- Headers: `X-Parse-Application-Id` (the backend's id), session token. **No master-key surface** — the local service trusts localhost + WF-004's bearer token instead; deployed hardening is WF-003's.

Explicitly **not** implemented: live queries, push, GraphQL, client schema/ACL management — the clients never call them. The existing `/api/:table` routes stay for the BYOB nodes; both protocols front the same `LocalSQLAdapter`.

Sizing note: this replaces the "±2 wks" naive read of "implement Parse" — it is ~15 endpoints over a query builder that already exists. Budget it inside this task's 2–3 weeks by keeping sessions minimal (login/logout/signup/me) and deferring the long tail to 501s with honest errors.

## Scope

### In Scope
- [ ] Create `packages/nodegx-backend`; move server, runner, and backend management logic; adapter stack stays in `noodl-runtime` and is consumed as a dependency (record if this proves wrong)
- [ ] Engine decision (with RUN-004) + implementation; delete the silent mock fallback (explicit, labeled ephemeral mode only if RUN-004 decides to keep one)
- [ ] Process contract: spawn/supervise from the editor; health endpoint; port allocation; clean shutdown on editor exit (replacing `backendManager.stopAll()`)
- [ ] Status surfaced honestly in the Backend Services panel: running / stopped / failed / ephemeral, replacing today's silent no-op paths (including the `findViewerCloudPath` one)
- [ ] Localhost-by-default binding; token auth for non-localhost
- [ ] **Parse-wire subset routes** per the wire-protocol section: `/classes`, `/aggregate`, `/files`, `/functions`, `/config`, minimal sessions — verified by pointing a real project's `cloudservices.endpoint` at the service and exercising Query Records / Record / login nodes live
- [ ] Editor convenience: when a local backend is running, offer/auto-set the project's `cloudservices` metadata to it (the seam `projectmodel.editor.ts` `setCloudServices` already provides)
- [ ] Headless smoke path: `node`-run the service against a data dir, exercise `/health`, `/api/:table`, `/classes/:collection`, `/functions/:name`
- [ ] Wire the `deleteTable` IPC handler's UI caller or remove the dead handler (small; recorded in the salvage audit)
- [ ] Persistence integrity test: write, restart the *service*, read back

### Out of Scope
- The workflow engine (WF-001) — but leave it an obvious home in the package
- Triggers (WF-005) — but the HTTP surface should not preclude route registration
- Deployment packaging/docs (WF-003)
- Data migration from the mock (nothing ever persisted)
- Auth beyond the single bearer token (users/roles/sessions — parked; TASK-007G territory, revisit at WF-003)
- Parse "Cloud Services" — untouched, per the phase README

## Implementation Steps

1. **Design the process contract first** (lifecycle, discovery, health, auth, log transport) and record it — this is the expensive-to-reverse part.
2. **Engine decision** with RUN-004; compatibility test against the adapter's API usage.
3. **Extract the package**; get the headless smoke path green before touching the editor.
4. **Editor supervision**: spawn/monitor/stop; route the existing renderer IPC through to the service; UI unchanged.
5. **Loud-failure pass**: every formerly-silent fallback (mock DB, missing viewer-cloud, port conflicts) now surfaces in the panel.
6. **Auth + binding policy.**
7. **Integrity + smoke tests**; verify the packaged editor app still works (packaging traps are real in this repo — see the packaging-traps notes).

## Success Criteria

- [ ] `packages/nodegx-backend` runs headless with no Electron present; smoke path green
- [ ] Editor spawns, supervises, and surfaces the service's real status; existing panels work unchanged
- [ ] Real persistence: write, restart service, read back — as a test
- [ ] No silent fallbacks remain in the backend path
- [ ] Engine decision recorded with a compatibility test
- [ ] Localhost default + token for wider binding
- [ ] Packaged editor verified, not just dev

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `node:sqlite` API gaps vs the adapter's usage | The compatibility test decides, not optimism; Option B is a known-good fallback |
| Child-process management flakiness (zombie processes, port conflicts) | Health endpoint + supervised restarts; single source of truth for ports in backend config; clean-shutdown test |
| The extraction breaks the packaged app in ways dev doesn't show | Explicit packaged-app verification step; this repo's packaging-trap history says green dev builds prove nothing |
| Runtime-package coupling (adapter imports) makes the backend package heavy | Adapters already live in `noodl-runtime`; if consuming it drags in too much, extract `api/adapters` into the backend package and record the deviation |
| Scope creep into engine/triggers/deploy | Each has its own task; this one ends at "a supervised, persistent, honest service" |

## References

- [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) §3 — the architecture argument
- [PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §6 — the local-SQL audit
- RUN-004 — loud failure + the shared engine decision
- `dev-docs/tasks/phase-5-multi-target-deployment/` TASK-007A–K — original scope and its honest PROGRESS notes

## Checklist

- [ ] Process contract designed and recorded
- [ ] Engine decision with RUN-004 + compatibility test
- [ ] Package extracted; headless smoke green
- [ ] Editor supervision + honest status; loud-failure pass
- [ ] Auth/binding; integrity test; packaged-app verification
- [ ] CHANGELOG; update RUN-004 and WF-003 with the as-built contract
