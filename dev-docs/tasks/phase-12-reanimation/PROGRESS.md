# Phase 12: Reanimation (Revival Horizon 0) - Progress Tracker

**Created:** 2026-07-22 (from NOODL-REVIVAL-ROADMAP.md Horizon 0)
**Last Updated:** 2026-07-22
**Overall Status:** 🟡 In Progress (14%)

---

## Quick Summary

| Metric | Value |
| ------------ | ------ |
| Total Tasks | 7 |
| Completed | 1 |
| In Progress | 0 |
| Not Started | 6 |
| Overall | **14%** |

---

## Task Status

| Task ID | Title | Status | Assignee | Notes |
|---------|-------------------------------------|----------------|----------|-------|
| REV-001 | The Reanimation Commit | 🟢 Completed | Sonnet 5 | typecheck 0, webpack 0, build:editor completes. Unblocked REV-003 |
| REV-002 | Fix the Electron Test Harness | 🔴 Not Started | — | Unblocks REV-003 |
| REV-003 | CI/CD Pipeline on GitHub Actions | 🔴 Not Started | — | Needs REV-001 + REV-002 |
| REV-004 | Electron 31 → 43 Upgrade | 🔴 Not Started | — | The risky one; do under CI |
| REV-005 | Dependency Hygiene | 🔴 Not Started | — | Coordinate with REV-004 |
| REV-006 | Docs Truth Pass | 🔴 Not Started | — | Independent; do early |
| REV-007 | Ship v0 (signed builds + auto-update) | 🔴 Not Started | — | Needs REV-004 |

---

## Update Protocol

When you start or finish a task, update this file **in the same commit** as the work
(status, date, and a one-line note). This phase exists partly because stale progress
trackers misled contributors (see REV-006) — do not let this file become one of them.

## History

- **2026-07-22**: Phase created from NOODL-REVIVAL-ROADMAP.md Horizon 0 (REV-001…REV-007). All tasks Not Started.
- **2026-07-22**: REV-001 completed. Added the `@noodl-viewer-cloud/execution-history` alias to `tsconfig.json` + `webpack.shared.js`, fixed the wrong-depth `EventDispatcher` import, forced CommonJS module mode in `tsconfig.build.json` so `packages/noodl-editor/scripts/build.ts` resolves its extensionless `helper` import under Node 22 ESM, and fixed the dead debug `ls` in `scripts/build-editor.ts`. Also restored `packages/noodl-editor/build/entitlements.mac.plist`, deleted from the repo years ago but still referenced by `package.json`'s `build.mac.entitlements` — without it `electron-builder` fails signing and `build:editor` cannot complete; this wasn't one of the three bugs in the task doc but was required to hit the "packaged app produced" success criterion. Verified: `npm run typecheck:editor` 12→0 errors (confirmed again after `rm -rf node_modules && npm install`), renderer production webpack 13→0 errors, and the full root `npm run build:editor` now runs to completion producing a signed (ad-hoc) `.dmg`/`.zip`. Ajv resolution confirmed deterministic via the existing lockfile (editor gets 8.18.0 nested, root stays 6.12.6) — no lockfile surgery was needed. Unblocks REV-002/REV-003.
