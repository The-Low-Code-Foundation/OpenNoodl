# RUN-004: Stabilise the Local SQLite Backend

> **Corrected 2026-07-24** by the salvage audit ([PRE-REVIVAL-SALVAGE-AUDIT.md](../../reviews/PRE-REVIVAL-SALVAGE-AUDIT.md) §6). Three findings change this task's premises: (1) the code paths below were wrong — see Current State; (2) `better-sqlite3` was **never installed in any package** — not "failing to load," *absent* — so the "SQLite" backend has never once run against a real database; every session ran on the in-memory mock. (3) Phase 19's re-scope creates **WF-004**, which extracts the backend into a standalone Node service and owns the engine decision (`node:sqlite`, which would eliminate the native module entirely, vs `better-sqlite3` with prebuilds). **Split accordingly: the loud-failure deliverable (steps 1–2) lands immediately and independently; the native-build half (steps 3–5) merges into WF-004's engine decision rather than being done twice.** The Electron-ABI framing below applies only if the engine stays in-process and native — both now open questions WF-004 decides.

## Metadata

| Field | Value |
|-------|-------|
| **ID** | RUN-004 |
| **Phase** | Phase 16 — Runtime & Deploy Health (Revival Track D) |
| **Priority** | 🟠 High (silent data loss) |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 2 weeks |
| **Prerequisites** | REV-004 (Electron upgrade changes the native ABI) |
| **Branch** | `task/run-004-stabilize-local-backend` |
| **Recommended executor** | 🟠 **Opus 4.8** — native module builds across three platforms and an Electron ABI are a well-known source of opaque failures. The first deliverable (make the failure loud) is simple; making the native build reliable everywhere is not. |

## Objective

Make the local SQLite backend actually persist data — and, failing that, fail loudly instead of silently substituting an in-memory mock.

## Background

OpenNoodl ships a local backend so users can build data-driven applications without standing up external services first. It is a good idea, particularly for beginners and for the education use case, where "sign up for a cloud database" is a hard stop.

The implementation has a serious defect: when the `better-sqlite3` native module fails to load, the backend **silently falls back to an in-memory mock**. Everything appears to work — records save, queries return, the UI updates — and then the data vanishes on restart. A user can build an entire feature, demo it, and only discover the problem later, with no error message pointing at the cause.

Silent failure is the worst property a persistence layer can have. A loud failure costs a user five minutes of confusion; a silent one can cost a weekend of work and considerable trust. Fixing the native build is the goal, but **making the failure visible is the more important deliverable**, because it is guaranteed achievable and it bounds the damage even if the native module misbehaves on some platform in the future.

The sequencing note matters: REV-004 upgrades Electron by twelve majors, which changes the native module ABI and requires rebuilding `better-sqlite3` regardless. Doing this task first means doing that work twice.

## Current State

- The local backend lives under `packages/noodl-editor/src/main/src/local-backend/` (**main** process, not `editor/src/` as originally written): `BackendManager.js` (801 lines), `LocalBackendServer.js` (595), `WorkflowRunner.js` (400). The SQL layer lives in `packages/noodl-runtime/src/api/adapters/local-sql/`: `LocalSQLAdapter.js` (779), `QueryBuilder.js` (717), `SchemaManager.js` (594).
- `better-sqlite3` is in **no** `package.json`, no lockfile, no `node_modules` — it was never added. The guarded `require` at `LocalSQLAdapter.js:70` has failed on every machine that ever ran this code.
- On that failure, `LocalSQLAdapter.js:98-103` logs to console and falls back to the in-memory mock with no user-visible error. Backend config and table **schemas** persist as JSON files under `~/.noodl/backends/<id>/`, which is what makes the record loss look like a bug instead of a missing database.
- Also dead: the `backend:deleteTable` IPC handler (`BackendManager.js:134-135,551`) has zero UI callers — users cannot delete tables.
- The phase-5 progress notes record all of this; TASK-007K (the fix-it task) is an unowned DRAFT.
- Related work: RUN-003 (UBA) covers *external* backends; this task covers the local one. A user unable to run the local backend can use UBA, but that is a workaround rather than a fix.

## Desired State

- The local SQLite backend loads and persists data reliably on macOS, Windows, and Linux.
- Native module rebuild happens automatically as part of install/build, not as a manual step users are expected to know about.
- If the native module cannot load, the user sees a clear, actionable error — and the in-memory fallback, if retained at all, is explicitly labelled as ephemeral everywhere it is used.
- Backend status is visible in the UI.

## Scope

### In Scope
- [ ] **Make the failure loud** (do this first): clear error surfaced in the UI when the native module fails to load
- [ ] Either remove the silent mock fallback, or retain it only as an explicit, clearly-labelled "ephemeral mode" the user opts into
- [ ] Fix the native module build/rebuild across all three platforms
- [ ] Automate rebuild in install/build scripts so it is not a manual step
- [ ] Verify against the post-REV-004 Electron ABI
- [ ] Backend status indicator in the UI (persistent vs. ephemeral vs. failed)
- [ ] Data-integrity tests: write, restart, read back
- [ ] Troubleshooting documentation

### Out of Scope
- Replacing SQLite with a different engine (only consider if the native build proves genuinely unfixable — and record that as a finding first)
- External backends (RUN-003)
- Migrating data from the in-memory mock (there is nothing to migrate; it never persisted)
- Multi-user or networked local backend

## Technical Approach

### Coordinate with WF-004 (added 2026-07-24)

The engine decision is shared with WF-004 and made once: **Option A, `node:sqlite`** (built into Node ≥22.13 flag-free; zero native dependency, zero ABI matrix — verify API coverage against the adapter's usage: prepared statements, transactions, WAL) or **Option B, `better-sqlite3` with prebuilt binaries** (made routine by WF-004's separate-process placement, which takes Electron's ABI out of the equation). The adapter's engine access is one guarded `require` in one file; either swap is small. If WF-004 has not started when this task does, make the decision here, record it, and WF-004 inherits it.

### Order of work

**Loud failure first, native fix second.** The first deliverable is small and independently valuable: even if the native build takes the full two weeks to sort out across platforms, users stop losing work on day one. It also makes the native problem diagnosable, because failures start reporting themselves.

For the native build: `better-sqlite3` must compile against Electron's ABI rather than the system Node's, which is what `electron-rebuild`-style tooling exists for. Verify it runs automatically in the install/build path on all three platforms and in CI, and confirm the packaged application ships a correctly-built binary — a module that works in development and fails in the packaged app is a common and easily-missed variant of this bug.

Consider whether prebuilt binaries for the supported platform/ABI matrix would be more reliable than compiling on user machines, given that end users are not developers and may lack a toolchain.

## Implementation Steps

1. **Surface the failure.** Detect load failure, propagate it, show a clear error in the UI, and log actionable diagnostics.
2. **Decide the fallback's fate** — remove it, or make it an explicit opt-in labelled "ephemeral, data will not persist," visible wherever data is shown.
3. **Fix the native build** for the current (post-REV-004) Electron ABI on macOS, Windows, and Linux.
4. **Automate the rebuild** in install/build scripts; verify a fresh clone works with no manual step.
5. **Verify the packaged app** — build with REV-007's packaging and confirm the module loads in the installed application, not just in development.
6. **Integrity tests**: write data, restart the app, confirm it is still there. This test would have caught the original bug and must exist.
7. **Status indicator** showing which mode the backend is in.
8. **Troubleshooting docs** for the failure modes that remain possible.

## Testing Plan

- Persistence: write records, fully restart, read back — on all three platforms.
- Failure path: deliberately break the native module and confirm a clear error appears and no silent fallback occurs.
- Fresh clone: `npm ci` then run, with no manual rebuild step — backend works.
- Packaged app: install the built artifact and verify persistence there.
- Concurrent access from editor and preview, if the architecture allows it.

## Success Criteria

- [x] Native module load failure produces a clear, actionable user-visible error
- [x] No silent in-memory substitution; any ephemeral mode is explicit and labelled
- [x] SQLite backend persists data on macOS, Windows, and Linux — verified on macOS and (in CI) Linux; `node:sqlite` leaves no per-platform artifact to differ, see Residuals
- [x] Rebuild automated; fresh clone works with no manual step — trivially: there is no native module to rebuild
- [x] Packaged application verified, not just development builds — `npm run check:persistence`, under Electron's bundled Node
- [x] Persistence integrity test in CI
- [x] Backend status visible in the UI

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Native builds remain unreliable on some platform | Loud failure (step 1) bounds the damage regardless; consider prebuilt binaries; if genuinely unfixable, record the finding and evaluate alternative engines as a separate decision |
| Works in development, fails in the packaged app | Step 5 explicitly tests the packaged artifact — this variant is common and easy to miss |
| Electron upgrade later re-breaks the ABI | CI persistence test catches it; make the rebuild part of the build, not a manual ritual |
| Removing the fallback breaks environments that relied on it | Retain as explicit opt-in ephemeral mode rather than deleting outright |

## References

- [Viability report — §5 (BYOB/local SQLite in-memory fallback)](../../reviews/NOODL-VIABILITY-REPORT.md)
- `dev-docs/tasks/phase-5-multi-target-deployment/` — where the local backend work originated
- Related: REV-004 (Electron ABI), REV-007 (packaging verification), RUN-003 (external backends)

## Progress

**COMPLETE 2026-07-26.** Two slices, delivered a day apart, plus a close-out pass that verified the half this task had deferred.

**Loud-failure slice — DONE 2026-07-25** (committed to `cline-dev`; ran in parallel with RUN-003, zero file overlap).

Shipped:
- Adapter throws `LocalBackendPersistenceError` (`code: PERSISTENCE_ENGINE_UNAVAILABLE`) instead of silently mocking; the in-memory mock is reachable only via an explicit `{ allowEphemeral: true }` opt-in and is marked ephemeral. New `getPersistenceStatus()`.
- Status plumbed adapter → `LocalBackendServer` → `BackendManager` (remembers start failures) → `backend:status` IPC → `useLocalBackends` → `LocalBackendCard` badge (Running / Ephemeral / Persistence unavailable / Stopped), with an in-card **Start ephemeral (no persistence)** opt-in.
- Persistence tests at `packages/noodl-runtime/test/adapters/LocalSQLAdapter.persistence.test.js`: loud-failure + ephemeral-opt-in run when native is absent; write→reconnect→read integrity runs when native is present (skipped, never silently passed, otherwise). Verified green via direct harness (jest reporter has an unrelated `terminal-link` breakage in this env).
- Docs: `docs/runtime/LOCAL-BACKEND-PERSISTENCE.md`; CHANGELOG updated.

**Engine slice — DONE 2026-07-25 via WF-004** (`62cfc9c`). The shared decision was made and implemented as **Option A**: the engine seam is `packages/noodl-runtime/src/api/adapters/local-sql/engine.js`, which resolves `node:sqlite` (built into Node ≥22.13, wrapped by a thin shim supplying the two methods better-sqlite3 has and it lacks — `pragma`, `transaction`) and only falls back to `better-sqlite3` if some older environment ever has it installed. **`better-sqlite3` is a dependency of no package**, deliberately: steps 3–5 of this spec (fix the native build, automate the rebuild, verify it against the post-REV-004 Electron ABI) were not completed so much as **dissolved** — there is no native module to build, no ABI matrix to track, and nothing for an Electron upgrade to invalidate. WF-004 also moved the service out of the Electron main process entirely (`ServiceSupervisor` + `packages/nodegx-backend`).

**Close-out — DONE 2026-07-26.** The two criteria still open after the engine slice were "packaged application verified, not just development builds" and "persistence integrity test in CI". Both now hold:

- **The packaged runtime is verified, and the verification is a gate.** The packaged app does not run the service on the developer's system Node: `ServiceSupervisor` spawns `process.execPath` — the Electron binary — with `ELECTRON_RUN_AS_NODE=1`. That is the one way this could still regress silently: a future Electron whose bundled Node lacks `node:sqlite` would pass every unit test and lose users' data again. New gate `scripts/check-packaged-persistence.js` (`npm run check:persistence`) runs the real `nodegx-backend` bundle under the real Electron binary exactly that way, asserts the READY handshake reports `persistence: "persistent"`, writes a record over the Parse wire, SIGTERMs the service, restarts it against the same data dir and reads the record back. Verified locally on Electron 43.2.0 (bundled Node 24.18.0): engine `node:sqlite`, record survived, SQLite files on disk.
- **The integrity tests actually run in CI.** They did not: `LocalSQLAdapter.persistence.test.js` lived in `@noodl/runtime`, whose jest suite — along with `nodegx-backend`, `noodl-viewer-react`, `@noodl/mcp`, `@noodl/preview` and `@noodl/cloud-runtime`, ~1,050 specs — was never run by any workflow. New `test-packages` job in `pr.yml` runs all six (`npm run test:packages`, serial: several bind real sockets) plus the packaged-persistence gate.

Three things had to be fixed to make that job green, all pre-existing and all disclosed here:

1. **`@noodl/runtime` was pinned to jest 28**, whose `@jest/reporters` needs `terminal-link` — a package the lockfile never contained, so the reporter crashed *after* the tests passed and returned non-zero. (This is the "jest reporting is broken in this env" trap recorded across several task notes; it was a missing dependency, not an environment quirk.) Bumped to jest ^29.7.0, matching every other package and the already-installed `ts-jest` ^29.4.1; the whole nested jest-28 tree drops out of the lockfile. Runtime suite: 384/384 green with the default reporter.
2. **The lockfile omitted `sharp`** (BAK-006 added it as an `optionalDependency` but the lockfile was never regenerated), so `npm ci` installed a tree that did not match `package.json`. Regenerating it means CI now installs sharp — and BAK-006's tests asserted the *absence* branch as if it were a permanent fact of the environment. Six specs across `transform.test.ts`, `files-http.test.ts` and the MCP `backendTools.test.ts` now assert the real behaviour of whichever environment they run in (rendered image + `transformsAvailable: true` where sharp is present, 501-with-reason where it is not), verified green **both** ways by temporarily hiding the module. The loud-failure posture BAK-006 exists to prove is unchanged and still tested.
3. `PNG_BYTES` in the file-storage tests was not a decodable PNG (only its magic bytes were ever inspected), which made the thumbnail path 400 once a real sharp could see it. Replaced with a real 1×1 PNG.

## Checklist

- [x] ~~Branch `task/run-004-...`~~ — committed straight to `cline-dev` per project convention
- [x] Make failure loud and actionable (shipped first)
- [x] Decide and implement the fallback policy — explicit opt-in ephemeral mode
- [x] ~~Fix native build on all three platforms; automate rebuild~~ — **dissolved by WF-004's engine decision**: no native module, so nothing to build or rebuild
- [x] Verify in the packaged application — `npm run check:persistence`, under the Electron binary the packaged app uses
- [x] Persistence integrity test in CI; status indicator
- [x] Troubleshooting docs; CHANGELOG

## Residuals

- **Linux and Windows are verified by construction, not by a run.** `node:sqlite` is part of Node itself, so there is no per-platform artifact to get wrong — and the CI job runs both the integrity test and the packaged-runtime gate on Linux. Nobody has run the gate on Windows; the nightly packaging workflow builds installers there but does not launch them.
- **Nothing installs a built artifact and runs it.** `check:persistence` proves the service bundle behaves under the packaging *runtime*; it does not open a `.dmg`/`.exe`. That end-to-end installed-app pass belongs to REV-007's release verification, not here.
- `backend:deleteTable` still has no UI caller (noted in Current State). It is not a persistence defect and was never in this task's scope; the equivalent surface now lives in `nodegx-backend`'s admin routes.
