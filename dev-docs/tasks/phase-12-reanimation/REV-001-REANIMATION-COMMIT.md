# REV-001: The Reanimation Commit

## Metadata

| Field | Value |
|-------|-------|
| **ID** | REV-001 |
| **Phase** | Phase 12 — Reanimation (Revival Horizon 0) |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟢 Easy (config/script fixes, no product logic) |
| **Estimated Time** | 1–2 days |
| **Prerequisites** | None |
| **Branch** | `task/rev-001-reanimation-commit` |
| **Recommended executor** | 🟢 **Sonnet 5** — three well-diagnosed config/script fixes with known root causes and a binary success test (typecheck 0, webpack 0, build completes). No design judgement required. |

## Objective

Fix the three build breakages left dangling by the 2026-02-18 mid-sprint stall so that editor typecheck reports 0 errors, the renderer webpack build reports 0 errors, and `npm run build:editor` completes end-to-end.

## Background

Development stopped abruptly on 2026-02-18 (last commit `b5f200c` on `cline-dev`). The 2026-07-22 viability assessment found the repo does not build — but for exactly three shallow reasons, all artifacts of the sprint stopping mid-flight rather than structural rot: an Ajv v6-vs-v8 typing clash, a missing module alias for a module that actually exists, and a Node-22 ESM bug in the build scripts. The report calls fixing these "the single highest-leverage first task" — the difference between a stalled repo and a working project, for the cost of an afternoon-to-two-days.

Everything else in this phase (test harness, CI, Electron upgrade, shipping v0) assumes this task lands first or in parallel.

## Current State

Verified on 2026-07-22 (Node v22.x, branch `cline-dev`):

**(a) Ajv v6-vs-v8 typing clash — partially landed, resolution is fragile.**

- `packages/noodl-editor/src/editor/src/schemas/validator.ts:11` imports `Ajv, { ValidateFunction } from 'ajv'` and is written against the **Ajv v8** API (v8-only `strict` option, `error.instancePath`). Lines 12–16 already contain a `require('ajv-formats')` workaround comment about cross-version type mismatches.
- The viability report (Appendix C) recorded **5 typecheck errors** here (`Cannot use namespace 'Ajv' as a type`, missing `instancePath`, unknown `strict` option) because the editor resolved the **root-hoisted ajv 6.12.6**.
- Since then, `ajv: "^8.18.0"` was added to `packages/noodl-editor/package.json` `dependencies` (commit `b01903b`, "commit pending dep updates") and `packages/noodl-editor/node_modules/ajv` now contains 8.18.0 — so on a machine with a fresh install, the 5 Ajv errors no longer appear. **However** the root `node_modules/ajv` is still 6.12.6 (root entry in `package-lock.json` around line 9025), pulled in by root tooling. Whether tsc sees v6 or v8 depends on npm hoisting, which is exactly how the errors appeared in the first place. The task is to make v8 resolution **deterministic**, and to verify on a clean install.

**(b) Missing `@noodl-viewer-cloud/execution-history` alias — 11–12 TS errors / 13 webpack errors.**

- 11 editor source files import `@noodl-viewer-cloud/execution-history` (all under `packages/noodl-editor/src/editor/src/views/panels/ExecutionHistoryPanel/**` and `.../views/CanvasOverlays/ExecutionOverlay/**`), producing `TS2307: Cannot find module` for each — and 13 module-not-found errors in the production renderer webpack build (report Appendix D).
- The module **exists**: `packages/noodl-viewer-cloud/src/execution-history/` contains `index.ts`, `ExecutionLogger.ts`, `store.ts`, `types.ts`, `schema.sql` (commits `95bf2f3`, `7d373e0`, `83278b4`). The alias was simply never added when the CF11-006/007 execution-history UI merged.
- Alias maps that must gain the entry:
  - `packages/noodl-editor/tsconfig.json:8-18` (`compilerOptions.paths`) — has `@noodl-core-ui/*`, `@noodl-utils/*`, etc., but nothing for viewer-cloud.
  - `packages/noodl-editor/webpackconfigs/shared/webpack.shared.js:12-25` (`alias` object shared by all renderer/test configs) — same gap.
- A current `npm run typecheck:editor` shows **12 errors**: the 11 above **plus one bonus breakage** — `ExecutionHistoryPanel.tsx:3` imports `'../../../../shared/utils/EventDispatcher'` (one `../` short; the file lives at `packages/noodl-editor/src/shared/utils/EventDispatcher.ts`, five levels up from the panel directory). Fix this import in the same commit.

**(c) ESM/debug bugs in the build scripts.**

- `packages/noodl-editor/scripts/build.ts:3` imports `'../../../scripts/helper'` **without extension**; Node 22's ESM resolver rejects extensionless relative imports (`ERR_MODULE_NOT_FOUND`), killing `npm run build:editor` after the viewer bundle succeeds (report Appendix D).
- `scripts/build-editor.ts:85` (root repo scripts) contains a leftover debug command in the darwin catch block: `execSync('ls /node_modules/app-builder-lib/templates')` — an **absolute path** (`/node_modules/...`) that can never exist, so the diagnostic itself errors.

Result today: `npm run typecheck:editor` = 12 errors (17 at report time), renderer production webpack build = 13 errors, `npm run build:editor` fails.

## Desired State

- `npm run typecheck:editor` → **0 errors** on a clean checkout + fresh `npm install`.
- `npx webpack --config=webpackconfigs/webpack.renderer.production.js` (in `packages/noodl-editor`) → compiles with **0 errors**.
- `npm run build:editor` (root) → completes end-to-end and produces a packaged app.
- Ajv resolution is deterministic (editor always gets v8) and documented.

## Scope

### In Scope
- [x] Deterministic Ajv v8 resolution for `noodl-editor` (lockfile/dedupe verification on clean install)
- [x] `@noodl-viewer-cloud/execution-history` alias in editor tsconfig + shared webpack config
- [x] Fix the wrong-depth `EventDispatcher` relative import in `ExecutionHistoryPanel.tsx`
- [x] Fix extensionless helper import in `packages/noodl-editor/scripts/build.ts`
- [x] Remove/fix the absolute-path debug `ls` in `scripts/build-editor.ts`
- [x] _(discovered during verification)_ Restore missing `packages/noodl-editor/build/entitlements.mac.plist`, deleted from the repo but still referenced by `package.json`; without it `electron-builder` fails signing and `build:editor` cannot complete

### Out of Scope
- Fixing the Electron **test** harness boot failure (REV-002)
- Any dependency upgrades beyond making ajv v8 resolve (REV-004/REV-005)
- Wiring the ExecutionHistory panel into anything new — only make existing code compile

## Technical Approach

### Key Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/tsconfig.json` | Add `"@noodl-viewer-cloud/execution-history": ["../noodl-viewer-cloud/src/execution-history/index.ts"]` (and/or a `/*` variant) to `compilerOptions.paths` |
| `packages/noodl-editor/webpackconfigs/shared/webpack.shared.js` | Add matching entry to the `alias` map (this file feeds renderer dev/production/test configs) |
| `packages/noodl-editor/src/editor/src/views/panels/ExecutionHistoryPanel/ExecutionHistoryPanel.tsx` | Correct the `EventDispatcher` import depth (`../../../../../shared/utils/EventDispatcher`) |
| `packages/noodl-editor/scripts/build.ts` | Make the `'../../../scripts/helper'` import Node-22-safe (add explicit extension / adjust how ts-node resolves it — see Step 3) |
| `scripts/build-editor.ts` | Delete the `execSync('ls /node_modules/app-builder-lib/templates')` debug line (~line 85), or point it at a real relative path if the diagnostic is worth keeping |
| `package-lock.json` | Regenerated if dedupe/lockfile surgery is needed for ajv (verify, don't assume) |

### New Files to Create

| File | Purpose |
|------|---------|
| _(none)_ | This task is config and one-line fixes only |

## Implementation Steps

### Step 1: Baseline
Run and record: `npm run typecheck:editor`, then `cd packages/noodl-editor && npx webpack --config=webpackconfigs/webpack.renderer.production.js`, then root `npm run build:editor`. You should see the errors described above; if the counts differ, note why before proceeding.

### Step 2: Add the execution-history alias
Add the path mapping to `tsconfig.json` `paths` and the same alias to `webpack.shared.js`. Point at `packages/noodl-viewer-cloud/src/execution-history` (the TS source — the editor compiles TS from sibling packages already, e.g. `@noodl/git` → `../noodl-git/src/index.ts`). Re-run typecheck: the 11 TS2307s must disappear.

### Step 3: Fix the EventDispatcher import
One-line change in `ExecutionHistoryPanel.tsx:3`. Check how sibling files import EventDispatcher (several editor files use relative paths into `src/shared/utils/`) and match the working pattern.

### Step 4: Verify Ajv resolution on a clean install
`rm -rf node_modules packages/*/node_modules && npm install`, then `npm run typecheck:editor`. If the 5 Ajv errors from report Appendix C reappear, the root-hoisted 6.12.6 is shadowing the editor's 8.18.0: fix with `npm dedupe ajv` / lockfile regeneration so `packages/noodl-editor/node_modules/ajv` (or the hoisted copy) is v8, and confirm `node -e "console.log(require('ajv/package.json').version)"` from inside `packages/noodl-editor` prints 8.x. Also confirm `ajv-formats@^2.1.1` still pairs with v8 at runtime (the workaround comment at `validator.ts:12-16` explains the historical mismatch).

### Step 5: Fix the build scripts
- `packages/noodl-editor/scripts/build.ts:3`: the script runs via `npx ts-node -P ./tsconfig.build.json ./scripts/build.ts`. Under Node 22 the extensionless `'../../../scripts/helper'` import fails ESM resolution. Fix by whichever is smallest and verifiable: import `'../../../scripts/helper.ts'` with ts-node's ESM support, or ensure the script runs in CJS mode where extensionless resolution still works (match how the root `scripts/*.ts` are executed — they use `ts-node -P ./scripts/tsconfig.json` and work). Do not restructure the build scripts; smallest fix wins.
- `scripts/build-editor.ts:85`: remove the debug `ls /node_modules/...` line (it references an absolute path that cannot exist). If the missing-entitlements diagnostic is still useful, log `require.resolve('app-builder-lib')` relative paths instead.

### Step 6: Full verification and commit
Run the full sequence of Step 1 again — all three must now be green — and commit as a single "reanimation commit" with the before/after error counts in the message.

## Testing Plan

### Unit Tests
- None new — this task changes no product logic. (The ~149 io tests cannot run until REV-002; do not block on them.)

### Integration Tests
- [x] `npm run typecheck:editor` → 0 errors
- [x] Renderer production webpack build → 0 errors
- [x] `npm run build:editor` → completes, packaged output exists

### Manual Testing
- [x] Clean-clone + fresh `npm install` on a second machine/directory reproduces all green results (guards against "works because of my node_modules" — the exact failure mode that produced the Ajv clash). Done via `rm -rf node_modules packages/*/node_modules && npm install`; ajv entries in `package-lock.json` diff were untouched, confirming resolution is lockfile-pinned, not hoisting-order-dependent.
- [x] `npm run dev` still launches the editor (smoke test that the alias didn't break dev config). Full Electron GUI launch isn't practical headless; verified instead that `webpack.renderer.dev.js` (which shares the same `webpack.shared.js` alias map via `webpack.renderer.shared.js`) compiles with 0 errors.

## Success Criteria

- [x] Typecheck: 17 (report) / 12 (current) → **0 errors**
- [x] Renderer webpack build: 13 → **0 errors**
- [x] `npm run build:editor` completes end-to-end
- [x] Ajv v8 resolution verified on a clean install
- [x] All changes are config/one-liners; no product behavior changed (plus one restored config file — `entitlements.mac.plist` — that was deleted from the repo)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Aliasing viewer-cloud TS source pulls its (TS 4.9) compile settings into the editor build | Alias only the `execution-history` subfolder (pure TS, no build step needed); the editor's ts-loader/tsc compiles it under editor settings — same pattern as `@noodl/git` |
| Ajv hoisting differs across npm versions/machines | Verify on clean install (Step 4); pin via lockfile, not via local node_modules state |
| ts-node ESM fix breaks the script on other platforms | Keep the fix minimal and test `build:editor` on macOS at minimum; CI (REV-003) will cover the rest |
| `build:editor` has further latent failures beyond the two known script bugs | Possible (it hasn't completed in months). Timebox: fix what surfaces if hours-scale; anything bigger becomes a follow-up task, and REV-001 still ships the typecheck/webpack green state |

## Rollback Plan

Single revert of the reanimation commit restores the prior (broken) state; no data or format migrations involved.

## References

- [NOODL-VIABILITY-REPORT.md](../../reviews/NOODL-VIABILITY-REPORT.md) — §3 "Test/build health" row; §7 "the reanimation commit"; **Appendix C** (typecheck evidence), **Appendix D** (build/webpack evidence)
- [NOODL-REVIVAL-ROADMAP.md](../../reviews/NOODL-REVIVAL-ROADMAP.md) — Horizon 0, REV-001 row
- `packages/noodl-viewer-cloud/src/execution-history/` — the module the alias must expose

---

## Checklist

- [x] Branch `task/rev-001-reanimation-commit` created
- [x] Baseline error counts recorded
- [x] Alias added to tsconfig + webpack.shared.js
- [x] EventDispatcher import fixed
- [x] Ajv v8 verified on clean install (dedupe/lockfile if needed — not needed, already deterministic via lockfile)
- [x] `build.ts` ESM import fixed (via `tsconfig.build.json` module override, not the import statement itself)
- [x] `build-editor.ts:85` debug line removed
- [x] Typecheck 0 / webpack 0 / build:editor completes
- [x] Clean-clone verification done
- [x] PROGRESS.md updated in same commit
