# Phase 12: Reanimation (Revival Horizon 0) - Progress Tracker

**Created:** 2026-07-22 (from NOODL-REVIVAL-ROADMAP.md Horizon 0)
**Last Updated:** 2026-07-22
**Overall Status:** 🟡 In Progress (14%)

---

## Quick Summary

| Metric | Value |
| ------------ | ------ |
| Total Tasks | 8 |
| Completed | 2 |
| In Progress | 0 |
| Not Started | 6 |
| Overall | **25%** |

---

## Task Status

| Task ID | Title | Status | Assignee | Notes |
|---------|-------------------------------------|----------------|----------|-------|
| REV-001 | The Reanimation Commit | 🟢 Completed | Sonnet 5 | typecheck 0, webpack 0, build:editor completes. Unblocked REV-003 |
| REV-002 | Fix the Electron Test Harness | 🟢 Completed | Opus 4.8 | 540 specs, 539 pass, 1 quarantined. Exit codes verified. Unblocked REV-003 |
| REV-003 | CI/CD Pipeline on GitHub Actions | 🔴 Not Started | — | Needs REV-001 + REV-002 |
| REV-004 | Electron 31 → 43 Upgrade | 🔴 Not Started | — | The risky one; do under CI |
| REV-005 | Dependency Hygiene | 🔴 Not Started | — | Coordinate with REV-004 |
| REV-006 | Docs Truth Pass | 🔴 Not Started | — | Independent; do early |
| REV-007 | Ship v0 (signed builds + auto-update) | 🔴 Not Started | — | Needs REV-004 |
| REV-008 | Dev Loop Hardening + Verification Debt | 🔴 Not Started | — | Stream A is critical: committed bundles let stale code run silently |

---

## Update Protocol

When you start or finish a task, update this file **in the same commit** as the work
(status, date, and a one-line note). This phase exists partly because stale progress
trackers misled contributors (see REV-006) — do not let this file become one of them.

## History

- **2026-07-22**: Phase created from NOODL-REVIVAL-ROADMAP.md Horizon 0 (REV-001…REV-007). All tasks Not Started.
- **2026-07-22**: REV-001 completed. Added the `@noodl-viewer-cloud/execution-history` alias to `tsconfig.json` + `webpack.shared.js`, fixed the wrong-depth `EventDispatcher` import, forced CommonJS module mode in `tsconfig.build.json` so `packages/noodl-editor/scripts/build.ts` resolves its extensionless `helper` import under Node 22 ESM, and fixed the dead debug `ls` in `scripts/build-editor.ts`. Also restored `packages/noodl-editor/build/entitlements.mac.plist`, deleted from the repo years ago but still referenced by `package.json`'s `build.mac.entitlements` — without it `electron-builder` fails signing and `build:editor` cannot complete; this wasn't one of the three bugs in the task doc but was required to hit the "packaged app produced" success criterion. Verified: `npm run typecheck:editor` 12→0 errors (confirmed again after `rm -rf node_modules && npm install`), renderer production webpack 13→0 errors, and the full root `npm run build:editor` now runs to completion producing a signed (ad-hoc) `.dmg`/`.zip`. Ajv resolution confirmed deterministic via the existing lockfile (editor gets 8.18.0 nested, root stays 6.12.6) — no lockfile surgery was needed. Unblocks REV-002/REV-003.
- **2026-07-22**: REV-002 completed. Root cause was `ELECTRON_RUN_AS_NODE=1` in the inherited environment — VS Code sets it in integrated terminals and the extension host, so the Electron binary booted as plain Node, `require('electron')` returned the CLI shim path instead of the API object, and `app` was `undefined` before any test code ran. That is why the suite could be green on another machine in February and dead here. Added `packages/noodl-editor/scripts/run-electron-tests.js` (spawns the binary directly with the variable stripped, propagates the exit code), stripped it in `scripts/test-editor.ts` too, and added a self-diagnosing guard in `test.js`. The harness also had no results path at all: `test.js` now receives Jasmine results over IPC from a reporter in `SpecRunner.html` and exits non-zero on failures, zero specs, renderer crash, early window close, or a 15-minute watchdog; `webpack.test.js` carries the child's code out through the dev server. Fixed the CI path, which could never have worked — `webpack.test-ci.js` inherited the dev-server `onListening` Electron spawn, and `SpecRunner.html` hard-coded the bundle URL to `localhost:8081` with no server running; CI now builds to disk and runs with a hidden window. Pinned `random: false` in Jasmine: the suite shares global state (`ProjectModel.instance`, `NodeLibrary` registration) and two `tests/nodegraph/export.js` specs passed or failed by seed. Suite result: **540 specs, 539 pass**, three consecutive clean runs at exit 0, and a deliberately broken `tests/io/` assertion correctly reported and exited 1. Fixed along the way: `tests/utils/ParameterValueResolver.test.ts` imported `@jest/globals`, which throws at module load and was taking down the entire run; two `schema-validator.test.ts` specs used Jest substring `toThrow`; and `ParameterValueResolver.toNumber(null)` returned `0` against its own documented contract (real bug, no production callers yet). One spec quarantined as `xit` — component port renames do not propagate to instances in other graphs, a genuine editor bug needing its own task. See `REV-002-NOTES.md` for that and the other follow-ups. Unblocks REV-003.
- **2026-07-22**: Merged `cline-dev-tara` (16 commits, Jan 2026) into `cline-dev` after REV-002 made verification possible — see `dev-docs/reviews/MERGE-NOTES-cline-dev-tara.md`. Both branches had independently implemented ElementConfigs with different architectures and different consumers (9 of 14 conflicts were add/add on those files); kept `cline-dev`'s, which compiles and drives the property panel. Brought in StyleTokens and the embedded template system. Suite green at 540/0.
- **2026-07-22**: Fixed the dev loop (`1502581`). The editor opened a black window because of two stacked stale-artefact bugs: `src/editor/index.html` only loads the dev-server bundle when `devMode === 'yes'`, which nothing ever set, so it ran a stale production `index.bundle.js` (production react-dom + external development react → `dispatcher.getOwner is not a function` before first paint); and `npm run dev` never rebuilt `src/main/main.bundle.js`, the Electron entry point, so main-process edits did nothing in dev. Also stripped `ELECTRON_RUN_AS_NODE` from the dev launch path — same bug REV-002 fixed for tests. Added headless debugging: `scripts/devtools/cdp.js` (health/eval/console/screenshot/dom/wait), `npm run dev:debug` with all service output in `.logs/dev.log`, renderer console mirrored into main stdout, and a `run-editor` agent skill. Editor verified rendering via CDP. Follow-up work captured as REV-008.
