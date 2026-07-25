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
