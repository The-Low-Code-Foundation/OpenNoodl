# nodegx-backend — engine decision & front-half build notes (WF-004)

This records the semantics-defining decisions of the WF-004 front half. It is the
decision of record shared with RUN-004 (both tasks hold to the same engine).

## The engine decision — Option A: `node:sqlite` (`DatabaseSync`)

**Chosen: Option A (`node:sqlite`).** Not Option B (`better-sqlite3`).

### Why

- **The dependency that doesn't exist can't break.** `better-sqlite3` was never
  actually installed in any package (RUN-004 / salvage audit). `node:sqlite` is
  built into Node — zero native dependency, zero Electron-ABI matrix across
  three platforms, identical in the child process, in headless deploys, and (if
  ever needed) in Electron's main process.
- **The versions in play cover it.** `node:sqlite` (`DatabaseSync`) is flag-free
  since Node 22.13 / 23.4.
  - System/deploy Node here: **v22.22.0** → available flag-free (verified).
  - Editor: **Electron 43.2.0**, which bundles Node 22.x (≥ 22.13) → also
    covered. But note the standalone service runs as a **separate system-Node
    child process**, so Electron's bundled Node is not even on the critical path
    for the backend.
- **The API surface is fully covered.** Verified by an actual run (below), not
  assumed. The one real risk — that the adapter relied on `last_insert_rowid` /
  `RETURNING`, which have historically been awkward — does **not** apply:
  `QueryBuilder` uses **UUID `objectId` primary keys** and re-`SELECT`s by
  `objectId`; it never reads an auto-increment rowid.

### The seam (one require in one file + a thin shim)

`packages/noodl-runtime/src/api/adapters/local-sql/engine.js`:

- `resolveEngine()` resolves, in order: `node:sqlite` (wrapped) → `better-sqlite3`
  (only if actually installed) → `null`.
- `wrapNodeSqlite(db)` is the thin shim. `node:sqlite`'s `StatementSync` already
  exposes `get/all/run` with variadic positional params, and `DatabaseSync` has
  `exec/prepare/close`. The **only** two gaps vs the better-sqlite3 shape the
  adapter is written against are:
  - `pragma(source)` — implemented as `prepare('PRAGMA ' + source).all()` (used
    for `journal_mode = WAL`).
  - `transaction(fn)` — single-level `BEGIN`/`COMMIT`/`ROLLBACK` wrapper
    returning a callable (matches `db.transaction(fn)()`). The adapter never
    nests transactions, so savepoints are unnecessary; documented in the shim.

`LocalSQLAdapter.connect()` now calls `resolveEngine()` instead of
`require('better-sqlite3')`. Everything downstream (SchemaManager, all CRUD) is
unchanged because it consumes the shimmed handle transparently. The adapter also
accepts an injected `options.engine` (`{ name, open(dbPath) }`) as a test/embed
seam.

`better-sqlite3` remains **NOT a dependency** of any package (per the "do not add
it if you chose Option A" instruction).

### Loud failure (RUN-004 policy) is preserved and strengthened

If no engine resolves (Node < 22.13 and no `better-sqlite3`), or the engine's
`open()` throws, `connect()` throws `LocalBackendPersistenceError`
(`code: PERSISTENCE_ENGINE_UNAVAILABLE`) — it never silently mocks. The
in-memory mock is reachable ONLY via explicit `allowEphemeral: true`, and reports
`mode: 'ephemeral'`. In practice, because `node:sqlite` ships with Node, the
happy path now essentially always persists.

### Compatibility test — real output

Standalone, runnable with plain `node`:
`dev-docs/tasks/phase-19-cloud-workflows/wf-004-engine-compat-test.js`

It exercises (Part 1) every raw primitive the adapter/SchemaManager use, and
(Part 2) the **real `LocalSQLAdapter`** end-to-end including a close+reopen to
prove data survives a restart. Result on Node 22.22.0:

```
Resolved engine: node:sqlite
Part 1: raw engine primitives
  ok  - db.pragma("journal_mode = WAL") -> [{"journal_mode":"wal"}]
  ok  - db.exec() multi-statement DDL (CREATE TABLE + CREATE INDEX)
  ok  - prepare().get() with positional param against sqlite_master
  ok  - prepare().run(...params) returns { changes } -> changes=1
  ok  - INSERT OR REPLACE upsert semantics
  ok  - prepare().all(...params) returns row array
  ok  - ALTER TABLE ADD COLUMN then read back
  ok  - db.transaction(fn)() commits and returns fn result
  ok  - db.transaction(fn) rolls back on throw and rethrows
  ok  - db.close()
Part 2: real LocalSQLAdapter end-to-end
  ok  - adapter.connect() -> persistent, engine=node:sqlite
  ok  - adapter.create() -> objectId ...
  ok  - adapter.query() returns both rows
  ok  - adapter.save() then fetch reflects update
  ok  - adapter.count() -> 2
  ok  - adapter.disconnect()
  ok  - fresh adapter on same file reads back persisted data (survives restart)
  ok  - adapter.delete() persists
ALL 18 ASSERTIONS PASSED — engine "node:sqlite" covers the adapter API surface.
```

The runtime jest suite (334 tests, 20 suites) is green with the seam wired,
including the rewritten `LocalSQLAdapter.persistence.test.js` whose
persistence-integrity branch now actually runs (it used to skip because
`better-sqlite3` was absent).

### Caveats recorded honestly

- `node:sqlite` still emits `ExperimentalWarning: SQLite is an experimental
  feature` on Node 22.x. It is stable in behaviour for our usage but the warning
  is cosmetic noise; the deploy/service can silence it with
  `--no-warnings=ExperimentalWarning` if desired. Not suppressed by default so
  the status stays honest.
- `package.json` `engines.node` is `>=22.13.0` for this package specifically
  (the editor's is `>=22.0.0`; anything 22.0–22.12 would need the
  `--experimental-sqlite` flag and is out of support for the standalone service).
- The transaction shim is single-level by design. If a future caller nests
  transactions, revisit (better-sqlite3-style savepoints, or the fallback engine).

## Package scaffold (what's real vs deferred)

Real and verified in the front half:
- Package boundary `@noodl/nodegx-backend`, Node-targeted TS (CommonJS, no DOM,
  no Electron), `tsc` → `dist`, `bin/nodegx-backend.js` launcher.
- CLI: `serve --data-dir <dir> --port <p> [--host] [--token] [--ephemeral]` and
  `doctor` (port-free headless smoke). Verified running with plain `node`:
  `doctor` reports `persistent (engine: node:sqlite)`; `serve` binds, `/health`
  returns live persistence status, deferred routes return 501, SIGTERM shuts
  down cleanly.
- Persistence wiring (`createAdapter`) consuming the `@noodl/runtime` adapter as
  a dependency (subpath `@noodl/runtime/src/api/adapters/local-sql`).
- Config/auth policy (`config.ts`): localhost default, mandatory token on any
  non-loopback bind. Unit-tested (11 tests green).

Deferred to the **second half of WF-004 / WF-006** — labelled placeholders:
- `server/HttpServer.ts` — only `/health` exists; all data/auth/function routes
  (BYOB `/api/:table` + Parse-wire `/classes`, `/aggregate`, `/files`,
  `/functions`, `/config`, sessions) return 501. **Deferred because
  `LocalBackendServer.js` is being edited concurrently by WF-006.**
- `workflow/WorkflowRunner.ts` — reserved home; the real runner
  (`.../local-backend/WorkflowRunner.js`) is owned by WF-006 right now.
- `execution/ExecutionStore.ts` — reserved home; introduced by WF-006.
- Editor supervision (spawn/monitor/stop, IPC → child process), the
  `deleteTable` IPC caller, and `cloudservices` auto-set — all touch
  `main.js` / `local-backend/` and are deferred to avoid the WF-006 collision.

### Worktree-only note (not committed)

To smoke-test in this isolated worktree, `@noodl/runtime` was shadowed with a
local symlink `node_modules/@noodl/runtime -> ../packages/noodl-runtime` so the
service loads the worktree's `engine.js` (the repo-root `node_modules` symlink
points at the main checkout, which does not yet have `engine.js`). `dist/` and
`node_modules/` are gitignored. On a normal install after merge, the declared
`@noodl/runtime` dependency resolves correctly with no symlink needed.

---

# Second half (2026-07-25) — the service is real

Everything the front half deferred now exists. Decisions of record:

## Process contract

- **Spawn:** the editor's `ServiceSupervisor` runs `process.execPath` (the
  Electron binary) with `ELECTRON_RUN_AS_NODE=1` on `bin/nodegx-backend.js
  serve …` — the same binary that runs the editor runs the service as plain
  Node, so dev, packaged app, and headless deploy share one artifact and there
  is no system-Node dependency.
- **Handshake:** the service prints `NODEGX_BACKEND_READY {json}` (port, url,
  persistence, engine) on stdout when the HTTP surface is up. The supervisor
  resolves on that line, with a 15s timeout and the child's captured log tail
  in every failure message. stdout/stderr go into a 200-line ring buffer
  surfaced through `backend:status`.
- **Shutdown:** SIGTERM, SIGKILL after 3s. `stopAll()` on editor quit. A child
  that dies on its own shows up as `mode: 'failed'` with exit code + log tail —
  verified live (stop → no zombie process, port closed; start → data intact).
- **Entry resolution:** `NODEGX_BACKEND_ENTRY` env override → monorepo sibling
  `packages/nodegx-backend/dist/cli.js` (two `__dirname` depths: webpack bundle
  at `src/main` vs source at `src/main/src/local-backend`) →
  `<resourcesPath>/nodegx-backend/cli.js` (packaged). Missing entry = loud
  error listing every probed path.

## Build: esbuild bundle, not tsc output

`dist/cli.js` is one self-contained CJS bundle (~690KB, built in ~20ms by
`scripts/build.js`): this package's TS + the `@noodl/runtime` adapter stack +
**`noodl-viewer-cloud/src` (CloudRunner + execution-history) via the
`@cloud-runtime` alias**. Deploy = copy the file, run it. Two tricks:

- The banner defines `_noodl_cloud_runtime_version`, flipping the runtime
  clients (cloudstore/configservice) into their fetch-based cloud path — same
  as viewer-cloud's own webpack BannerPlugin. `service.ts` also sets it on
  `globalThis` so the un-bundled form (jest, embedding) behaves identically.
- `node:sqlite` stays external. Jest mirrors the alias via `moduleNameMapper`;
  `tsc --noEmit` stays as the typecheck.

## The wire subset, as built

`/classes` (POST create + `_method:'GET'` query tunnel, GET count-style
queries, fetch/save/delete, `Increment`/`AddRelation`/`RemoveRelation` ops,
`$relatedTo`, `keys`/`order`/`limit`/`skip`/`count`), `/aggregate`
(`$group`/`$match` + `distinct`), `/files` (upload/serve/delete under
`<dataDir>/files`), `/functions/:name` (WorkflowRunner → CloudRunner),
`/config` (from `<dataDir>/config-params.json`), sessions (`/login`,
`/logout`, `/users` signup, `/users/me`, `PUT /users/:id`) with scrypt
password hashing, Parse-style `r:` revocable tokens in a `_Session` table,
and the load-bearing **error code 209** for invalid sessions. Email flows
(password reset / verification) are 501 — with HTML bodies on the two
endpoints the client scrapes as HTML — until BAK-002.

Response-shape subtleties that are contract, not style:
- Create answers `{objectId, createdAt}` ONLY — the client merges its own data
  over the response *without* deserializing, so wire-typed fields would leak
  `__type` envelopes into model data.
- `/users/me` must echo `sessionToken` — the client re-stores the whole
  response as its current user and reads the token from it afterwards.
- Schema-typed `Pointer` columns serialize as `{__type:'Pointer'}` envelopes,
  expanded to embedded `__type:'Object'` records under `include=` (one level).
- Functions inside the service reach the database **over the wire**: the
  service sets `_noodl_cloudservices = {endpoint: itself, appId: backendId}`,
  so record/user/config nodes in cloud functions loop back over HTTP. The old
  in-editor `injectAdapterIntoContext()` was consumed by nothing and is gone.

## Execution history across the process boundary

Each service owns `<dataDir>/executions.sqlite` (same WF-006 store/logger
classes, bundled; fresh-logger-per-run; same scrub rules — `scrub.ts` moved to
`noodl-viewer-cloud/src/execution-history` and is re-exported from the editor's
old path). The editor reads it over HTTP (`/executions`, `/executions/:id`):
`ExecutionHistoryManager.listMerged/getMerged` merge every running backend's
store with the editor-local one behind the *unchanged* IPC channels. An
unreachable backend degrades to local-only, never an error.

## Bugs found under the real engine

- **SchemaManager `NOT LIKE '_%'`** — `_` is a LIKE wildcard, so
  `listTables()`/`exportSchemas()` excluded EVERY table on a real engine
  (invisible on the mock, which regex-parsed the SQL). Fixed with
  `ESCAPE '\'`; regression-guarded in the service tests.
- **BYOB handlers `await`ed callback-style adapter methods** (which return
  `undefined`) — the old in-editor `/api` routes could never actually answer
  with data. The service routes go through the promise-shaped `AdapterFacade`.

## Verified

- 37 package tests (full HTTP surface incl. a real CloudRunner function run
  with scrubbed execution logging; restart persistence; non-loopback token
  auth; process contract against the built bundle) + 334 runtime + 32
  editor-main tests green; editor tsc clean.
- Live in the editor: panel Start → child spawned + READY; /health honest;
  Schema panel (system tables hidden — the LIKE fix); Data Browser showing
  records written over Parse-wire; Stop → clean exit, no zombies; Start →
  data intact.

## Residuals / notes for the next tasks

- `packages/noodl-editor/package.json` gained electron-builder
  `extraResources` for `nodegx-backend/cli.js`(+map) and `scripts/build-editor.ts`
  builds the service — but a **packaged-app run was not executed** this pass
  (the repo's packaging-trap history says treat that as unverified).
  *The package.json edit is intentionally uncommitted:* a concurrent DEBT-013
  session holds entangled uncommitted edits to the same file (Monaco
  retirement); the extraResources addition rides with that session's commit.
- Live record/user nodes in a **preview** against the local backend not yet
  exercised (the cloudservices auto-set seam is wired; RUN-003's BYOB path is
  what the smoke project uses). WF-005/WF-001 will live on this surface daily.
- In-editor local preview hard-codes `:8577` for `/functions`
  (`cloudfunctions.js` `isRunningLocally()` branch) — functions from a local
  preview still hit the legacy hidden-window server, not the new service.
  That seam moves in **WF-007** when the 8577 server dies.
- `_User`/`_Session` are pre-created at service start (a `where` on a column of
  a not-yet-created table is a SQL error, not an empty result).
- File serving derives content type from the extension (no sidecar metadata) —
  recorded simplification.
