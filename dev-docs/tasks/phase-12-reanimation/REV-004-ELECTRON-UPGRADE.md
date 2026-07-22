# REV-004: Electron 31 → 43 Upgrade

## Metadata

| Field | Value |
|-------|-------|
| **ID** | REV-004 |
| **Phase** | Phase 12 — Reanimation (Revival Horizon 0) |
| **Priority** | 🔴 Critical (security) |
| **Difficulty** | 🔴 Hard (12 major versions; native modules) |
| **Estimated Time** | 1–3 weeks |
| **Prerequisites** | REV-001, REV-002 (need a working build and test suite to detect breakage), REV-003 strongly recommended |
| **Branch** | `cline-dev` — work directly on it, no task branch (see `.clinerules`) |
| **Recommended executor** | 🟠 **Opus 4.8** — a long, judgement-heavy migration across 12 majors with native-module ABI rebuilds and breaking main-process API changes. Needs sustained debugging of opaque runtime failures, but the target state is unambiguous. |

## Objective

Upgrade the editor's Electron runtime from 31.3.1 to the current 43.x line (with electron-builder upgraded in lockstep), restoring a supported Chromium/Node security baseline without regressing editor functionality.

## Background

OpenNoodl's editor is an Electron desktop application. The pinned version, **Electron 31.3.1**, is roughly two years and twelve major releases behind current (43.x). Every Electron release carries the Chromium and Node security fixes of its cycle, so the gap is not cosmetic — `npm audit` flags `electron` itself as a high-severity finding, and unlike most of the audit noise (which sits in build tooling), this one ships to end users' machines.

The 2026-07-22 viability assessment named this "the one real dependency project" and the largest genuine piece of accumulated debt in the repo. It also concluded the rest of the dependency picture is healthy: React 19, TypeScript 5.9, and webpack 5 all landed in the Phase 1 work, so this upgrade stands alone rather than being tangled with a broader modernisation.

This task is deliberately sequenced after the build and test fixes: attempting a twelve-major upgrade without a working test suite means having no way to distinguish "the upgrade broke it" from "it was already broken."

## Current State

- `packages/noodl-editor/package.json` — `electron: 31.3.1` (exact pin), `electron-builder: 24.13.3`.
- `packages/noodl-platform-electron/package.json` — depends on `electron` and, per `npm outdated`, *wants* 43.2.0 while the resolved version is 31.3.1: an existing internal inconsistency to resolve as part of this task.
- Electron 31 bundles Node 20.15.1 (visible in the test-harness output).
- Native modules in the tree that require ABI rebuild against the target Electron:
  - `better-sqlite3` — used by the local backend (`packages/noodl-editor/src/editor/src/local-backend/`); already unstable, currently falling back to an in-memory mock (see RUN-004, Phase 16).
  - `dugite` — Git integration in `packages/noodl-git`; also 1.110.0 vs 3.2.2 latest, and flagged by `npm audit`.
- `npm audit` reports `electron` and `electron-builder` among high-severity findings.

## Desired State

- Editor runs on Electron 43.x with `electron-builder` 26.x, packaging successfully on macOS, Windows, and Linux.
- Native modules rebuilt and functional against the new ABI (or explicitly replaced — see RUN-004 for `better-sqlite3`).
- All editor tests pass; no functional regressions in window management, IPC, file dialogs, menus, or the preview/runtime window separation.
- `electron` version consistent across `noodl-editor` and `noodl-platform-electron`.

## Scope

### In Scope
- [ ] Electron 31 → 43 (stepwise if a direct jump proves intractable)
- [ ] `electron-builder` 24 → 26 and any packaging-config migration it requires
- [ ] Native module rebuilds (`better-sqlite3`, `dugite`) against the new ABI
- [ ] Main-process API migration (deprecated/removed APIs across 12 majors)
- [ ] Renderer-side fallout: `contextIsolation`/`nodeIntegration` defaults, `remote` usage, protocol handlers, session/CSP behaviour
- [ ] Verify the editor↔runtime window separation still functions (see `dev-docs/reference/LEARNINGS.md` on window separation)
- [ ] Re-verify REV-002's test harness on the new version

### Out of Scope
- Code signing / notarisation (REV-007)
- Replacing `better-sqlite3` with a different storage engine (RUN-004 decides that)
- Migrating away from Electron entirely (the web-editor question is LEARN-004, Phase 17)

## Technical Approach

### Key Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/package.json` | `electron`, `electron-builder` versions; `build` config keys renamed by builder 26 |
| `packages/noodl-platform-electron/package.json` | Align `electron` version |
| `packages/noodl-editor/src/main/main.js` | Main-process API migration; window creation options; security defaults |
| `packages/noodl-editor/webpackconfigs/webpack.main.production.js` | Target/externals if Node version assumptions changed |
| `scripts/build-editor.ts`, `scripts/build-pack.ts` | Packaging invocation and builder option changes |
| `packages/noodl-editor/test.js` | Harness bootstrap, if Electron's app lifecycle changed |

### Migration Reading

Work through the official Electron breaking-changes notes for each major from 32 through 43 before writing code. The high-risk categories historically are: `contextIsolation` and sandbox defaults, removal of the `remote` module, `webContents` and `session` API changes, protocol handler registration, and native module ABI.

## Implementation Steps

1. **Baseline.** With REV-001/002 merged, record a green state: typecheck 0, tests passing, build succeeding, editor launching. Screenshot/record core flows (open project, edit graph, preview, deploy) as the regression reference.
2. **Inventory Electron API usage.** Grep the main process and preload for Electron APIs; list everything touched. This is the true scope of the task.
3. **Attempt a direct jump to 43.** Update `electron` + `electron-builder`, run `npm run rebuild` for native modules, and see how far the app gets. If it launches, the remaining work is targeted fixes.
4. **If a direct jump fails intractably, step through waypoints** (31 → 35 → 39 → 43), landing each on a branch and running the suite. Stepping is slower but isolates which major introduced a given breakage.
5. **Native modules.** Rebuild `better-sqlite3` and `dugite` against the new ABI; coordinate with RUN-004 if `better-sqlite3` remains broken (its in-memory fallback currently masks failures — make it fail loudly during this work).
6. **Security defaults.** Newer Electron tightens defaults. Verify `contextIsolation`, sandbox, and CSP behaviour against the editor's preload and the runtime preview window; do not disable protections to make things work — fix the code.
7. **Full regression pass** against the step-1 reference flows, plus packaging on all three platforms via REV-003's nightly workflow.
8. **Re-run and confirm REV-002's harness** on the new Electron.

## Testing Plan

- Automated: full editor suite + platform tests green on the new version.
- Manual regression: launch editor, open an existing project, edit a node graph, open preview/runtime window, use file dialogs, use Git integration (dugite), use the local backend (better-sqlite3), open DevTools, check menus and shortcuts.
- Packaging: produce installable artifacts on macOS, Windows, Linux; install and launch each.

## Success Criteria

- [ ] Editor runs on Electron 43.x; `electron-builder` 26.x packages successfully on all three platforms
- [ ] `electron` version consistent across editor and platform-electron packages
- [ ] Native modules rebuilt and functional (or explicitly tracked as RUN-004 work)
- [ ] Full test suite green; manual regression checklist clean
- [ ] `npm audit` no longer flags `electron`/`electron-builder` as high severity
- [ ] No security defaults weakened to achieve the upgrade

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| A native module has no build supporting the new ABI | Identify early (step 5). For `better-sqlite3`, RUN-004 already contemplates replacement; for `dugite`, upgrading to 3.x may be required in the same task |
| Twelve majors of breakage is too tangled to debug at once | Fall back to stepwise waypoints (step 4) — slower but each failure is attributable |
| Subtle runtime regressions escape testing (IPC timing, window lifecycle) | The editor/runtime window separation is architecturally load-bearing; test preview and deploy flows explicitly, not just the editor shell |
| Upgrade silently re-breaks the test harness | REV-002 acceptance is re-run as part of this task's success criteria |

## References

- [Viability report — §3 scorecard, Appendix B](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Horizon 0](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- `dev-docs/reference/LEARNINGS.md` — editor/runtime window separation constraints
- Electron breaking-changes documentation for majors 32–43

## Checklist

- [ ] Branch `task/rev-004-electron-upgrade`; confirm green baseline first
- [ ] Inventory all Electron API usage in main/preload
- [ ] Attempt direct 43 jump; fall back to waypoints if needed
- [ ] Rebuild and verify native modules
- [ ] Audit security defaults (no weakening)
- [ ] Full automated + manual regression; package all three platforms
- [ ] Re-verify test harness; complete CHANGELOG; commit to cline-dev and push
