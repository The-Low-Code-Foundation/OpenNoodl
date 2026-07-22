# RUN-004: Stabilise the Local SQLite Backend

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

- The local backend lives under `packages/noodl-editor/src/editor/src/local-backend/` (including a substantial `BackendManager.js`).
- `better-sqlite3` is a native dependency requiring compilation against Electron's ABI.
- On failure to load, the code falls back to an in-memory implementation without surfacing a user-visible error.
- The phase-5 progress notes record this as a known bug.
- `npm run rebuild` exists for native module rebuilds but is evidently not reliably run or not reliably succeeding.
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

- [ ] Native module load failure produces a clear, actionable user-visible error
- [ ] No silent in-memory substitution; any ephemeral mode is explicit and labelled
- [ ] SQLite backend persists data on macOS, Windows, and Linux
- [ ] Rebuild automated; fresh clone works with no manual step
- [ ] Packaged application verified, not just development builds
- [ ] Persistence integrity test in CI
- [ ] Backend status visible in the UI

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

## Checklist

- [ ] Branch `task/run-004-stabilize-local-backend`; confirm REV-004 landed
- [ ] Make failure loud and actionable (ship this first)
- [ ] Decide and implement the fallback policy
- [ ] Fix native build on all three platforms; automate rebuild
- [ ] Verify in the packaged application
- [ ] Persistence integrity test in CI; status indicator
- [ ] Troubleshooting docs; CHANGELOG; open PR
