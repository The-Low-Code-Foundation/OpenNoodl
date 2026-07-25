# Local Backend Persistence & Troubleshooting

*Applies to the built-in local backend (Backend Services → "Local SQLite"). External
backends — Directus, Supabase, Pocketbase, custom REST — are covered by
[BACKEND-SERVICES.md](./BACKEND-SERVICES.md) and are unaffected by this.*

## What changed and why (RUN-004)

The local backend stores data in a SQLite database on disk via a native module
(`better-sqlite3`). If that module could not be loaded, the adapter used to
**silently** fall back to an in-memory mock: records appeared to save, queries
returned them, the UI updated — and then everything vanished on restart, with no
error pointing at the cause. Backend config and table *schemas* persisted as JSON,
which made the loss look like a bug rather than a missing database.

Silent failure is the worst property a persistence layer can have. A loud failure
costs five minutes; a silent one can cost a weekend of work. So the behaviour is now:

- **Default: fail loudly.** If the native SQLite engine cannot load, the backend
  refuses to start and surfaces a clear, actionable error. It never pretends to
  persist data it is actually dropping.
- **Ephemeral is opt-in and labelled.** You can still start a throwaway,
  non-persisting session — but only by explicitly choosing it, and the panel marks
  it **Ephemeral** everywhere, warning that data is lost on stop/restart.

## Backend status at a glance

Each local backend card shows one of:

| Badge | Meaning |
|-------|---------|
| **Running** (green ✓) | Started normally and **persisting** data to disk. |
| **Ephemeral** (⚠, notice) | Running in explicit in-memory mode. **Data will NOT persist.** |
| **Persistence unavailable** (⚠, red) | The native SQLite engine could not load; the backend did not start. The error message and a **Start ephemeral (no persistence)** button are shown on the card. |
| **Stopped** | Not running; no start has been attempted this session. |

## Failure modes

### "Persistence unavailable" / `PERSISTENCE_ENGINE_UNAVAILABLE`

The native `better-sqlite3` module could not be loaded or the database file could
not be opened. Common causes:

1. **The native module is not installed.** As of this writing `better-sqlite3` is
   not yet wired into the build — the reliable, cross-platform native build (and the
   decision between `better-sqlite3` and Node's built-in `node:sqlite`) is owned by
   **WF-004** (standalone backend service). Until that lands, expect this state on a
   normal checkout.
2. **ABI mismatch.** The module was built for a different Node/Electron ABI than the
   one running it. Native modules must be rebuilt for Electron's ABI, not the system
   Node's. This is the classic "works in `node`, fails in the app" trap.
3. **Corrupt or locked database file.** The engine loaded but could not open
   `~/.noodl/backends/<id>/data/local.db`.

**What to do right now:** if you only need a throwaway session (trying something out,
a demo you don't need to keep), click **Start ephemeral (no persistence)** — just know
the data is gone when the backend stops. If you need real persistence, you need the
native engine available for your platform/ABI; track that under WF-004.

### Data disappeared after restart

If you were running in **Ephemeral** mode, this is expected — ephemeral data is
in-memory only. Recreate the backend once the native engine is available and start it
normally (you'll see the green **Running** badge, not **Ephemeral**).

If you were running in normal **Running** mode and still lost data, that is a real
bug — the persistence-integrity test
(`packages/noodl-runtime/test/adapters/LocalSQLAdapter.persistence.test.js`) exists
precisely to catch it. File it with your platform and how the backend was started.

## For developers

- The engine boundary is a single guarded `require('better-sqlite3')` in
  [`LocalSQLAdapter.js`](../../packages/noodl-runtime/src/api/adapters/local-sql/LocalSQLAdapter.js).
  On failure it calls `_handleEngineLoadFailure`, which **throws**
  `LocalBackendPersistenceError` unless the adapter was constructed with
  `{ allowEphemeral: true }`.
- Persistence state is queryable via `adapter.getPersistenceStatus()` →
  `{ mode: 'persistent' | 'ephemeral' | 'failed' | 'unknown', persistent, ephemeral, engine, error }`.
  It flows up through `LocalBackendServer.getPersistenceStatus()` →
  `BackendManager.getStatus()` → the `backend:status` IPC channel → the
  `useLocalBackends` hook → the card badge.
- Opting into ephemeral mode from the UI sends `backend:start` with
  `{ ephemeral: true }`; nothing else can reach the in-memory mock.
- **Tests:** the loud-failure and ephemeral-opt-in cases run wherever the native
  engine is *absent*; the write → reconnect → read integrity case runs wherever it is
  *present* (skipped otherwise, never silently passed). Exactly one branch executes in
  any given environment, and both are asserted honestly.

## Scope note

This work is the "make the failure loud" half of RUN-004 (bounding the damage on day
one). The native-build half — compiling/​shipping the engine reliably on macOS,
Windows, and Linux, verified in the packaged app, with an automated rebuild — is
deferred into **WF-004**, which also owns the engine choice. See
`dev-docs/tasks/phase-16-runtime-deploy-health/RUN-004-STABILIZE-LOCAL-BACKEND.md`.
