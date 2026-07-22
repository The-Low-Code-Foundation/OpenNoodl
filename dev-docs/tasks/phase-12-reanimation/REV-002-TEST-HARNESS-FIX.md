# REV-002: Restore the Editor Test Harness

## Metadata

| Field | Value |
|-------|-------|
| **ID** | REV-002 |
| **Phase** | Phase 12 — Reanimation (Revival Horizon 0) |
| **Priority** | 🔴 Critical |
| **Difficulty** | 🟡 Medium (environment/launch debugging) |
| **Estimated Time** | 2–4 days |
| **Prerequisites** | None (REV-001 helps but is not blocking) |
| **Branch** | `task/rev-002-test-harness-fix` |
| **Recommended executor** | 🟠 **Opus 4.8** — the root cause is an Electron launch/environment interaction that fails *before* any test code runs, so it needs iterative hypothesis-testing rather than applying a known fix. Sonnet will likely thrash on the boot path; Fable is overkill once the failure mode is identified. |

## Objective

Make `npm run test:editor` and `npm run test:ci` actually execute the editor test suite (including the ~149 project-format tests under `packages/noodl-editor/tests/io/`) both locally and headlessly in CI.

## Background

The editor's tests run inside Electron: a webpack dev server serves the compiled test bundle, then Electron launches with `test.js` as its entry point and Jasmine runs in the renderer. This is unusual but deliberate — much of the editor touches Electron APIs, the filesystem, and the DOM, so tests run in the real host environment rather than under Node + jsdom.

As of the 2026-07-22 viability assessment, **the harness does not boot at all**. This matters more than it appears: the largest recent body of work (the v2 project-format engines, ~149 tests) is currently unverifiable, and every later task in the revival plan — especially the Phase 13 format work — depends on those tests being a trustworthy gate. A test suite that cannot run is equivalent to no test suite.

The final commit before the stall, `b5f200c` "Trying to fix editor launch bugs", indicates launch-path problems were already being fought when work stopped. Treat that commit and its neighbours as evidence, not noise.

## Current State

Running `npm run test:editor` (which invokes `scripts/test-editor.ts` → webpack dev server on :8081 → `npm run test:_start_electron` → `electron test.js`):

```
webpack dev server listening, starting electron with tests
> electron test.js

/Users/.../packages/noodl-editor/test.js:51
app.on('ready', function () {
    ^
TypeError: Cannot read properties of undefined (reading 'on')
    at Object.<anonymous> (.../test.js:51:5)
Node.js v20.15.1
```

Key observations:

- `require('electron').app` is `undefined` at `packages/noodl-editor/test.js:51`. That happens when the `electron` module is loaded in a **plain Node context** rather than the Electron main process — classic causes being `ELECTRON_RUN_AS_NODE` set in the environment, the `electron` npm shim resolving to its CLI stub path, or the binary being invoked in a way that skips main-process bootstrap.
- The banner reports **Node.js v20.15.1** — the Node bundled with Electron 31 — confirming the Electron binary *is* being used, but not in main-process mode.
- The webpack dev-server half of the harness works: it compiles and serves before Electron launches.
- This is environment-sensitive: the suite is reported green in `dev-docs/tasks/phase-10-ai-powered-development/PROGRESS-dishant.md` as of 2026-02-19, so it booted on at least one machine five months ago.

## Desired State

- `npm run test:editor` opens Electron, runs the full Jasmine suite, prints a pass/fail summary, and exits with a correct status code.
- `npm run test:ci` runs the same suite headlessly and is usable as a CI merge gate (consumed by REV-003).
- Non-zero exit code on any test failure — silent green is worse than red.

## Scope

### In Scope
- [x] Diagnose why `require('electron').app` is undefined at launch
- [x] Fix the launcher in `packages/noodl-editor/package.json` scripts and/or `scripts/test-editor.ts`
- [x] Guard `test.js` with a clear diagnostic if `app` is undefined, so the next regression self-explains
- [x] Ensure correct process exit codes for pass and fail
- [x] Verify the ~149 `tests/io/` tests actually pass (they may have bit-rotted while unverifiable)
- [x] Document the working invocation in `dev-docs/reference/DEBUG-INFRASTRUCTURE.md`

### Out of Scope
- Migrating off the Electron/Jasmine harness to Jest/Vitest (tempting, but a separate decision — see Risks)
- Writing new tests (that is per-task work in later phases)
- `@noodl/platform-node` tests (`npm run test:platform`), which use Jest and are unaffected

## Technical Approach

### Key Files to Modify

| File | Changes |
|------|---------|
| `packages/noodl-editor/test.js` | Add explicit guard + diagnostic when `app` is undefined; verify ready/bootstrap sequence against current Electron API |
| `packages/noodl-editor/package.json` | `test`, `test:_start_electron`, `test:ci` scripts — invoke Electron as an app, with `ELECTRON_RUN_AS_NODE` explicitly unset |
| `scripts/test-editor.ts` | Environment passed to the child process; propagate the child's exit code |
| `packages/noodl-editor/webpackconfigs/webpack.test.js`, `webpack.test-ci.js` | Only if bundle entry/output path is implicated |

## Implementation Steps

1. **Reproduce and isolate.** From `packages/noodl-editor`, run `npx electron -e "console.log(typeof require('electron').app)"`. If it prints `undefined`, the problem is launch mode, not `test.js`.
2. **Check for `ELECTRON_RUN_AS_NODE`** in the inherited environment — `scripts/test-editor.ts` spreads `process.env` into the child, so a stray value (including one set by an IDE or shell profile) silently forces Node mode. Explicitly delete it in the spawned env.
3. **Verify electron binary resolution.** `require('electron')` from Node returns the *path string* to the binary; inside the main process it returns the API object. Confirm `test:_start_electron` invokes the binary directly rather than through a wrapper that re-enters Node.
4. **Add the guard** in `test.js` above line 51: if `!app`, print "must run as Electron main process, not under Node" and `process.exit(1)`.
5. **Run the suite and triage failures.** Expect some genuine bit-rot after five months; fix or explicitly quarantine with a tracking note — do not delete tests to reach green.
6. **Wire the headless path** for CI; confirm exit-code propagation.
7. **Document** the working command and the failure signature in `DEBUG-INFRASTRUCTURE.md`.

## Testing Plan

- Deliberately break one assertion in a `tests/io/` spec; confirm the run reports failure **and** exits non-zero.
- Run three times consecutively; confirm no flakiness in the boot path.
- Run on a second machine or clean clone if available — this bug is environment-shaped.

## Success Criteria

- [x] `npm run test:editor` runs the suite to completion locally
- [x] `npm run test:ci` runs headlessly to completion
- [x] Exit code 0 on pass, non-zero on any failure
- [x] The ~149 `tests/io/` tests confirmed passing (or failures triaged and tracked)
- [x] `test.js` self-diagnoses the Node-vs-main-process failure mode
- [x] Working invocation documented in `DEBUG-INFRASTRUCTURE.md`

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The harness breaks again when REV-004 upgrades Electron | Do REV-002 first on Electron 31, then re-verify as part of REV-004's acceptance — the upgrade must not silently re-break tests |
| Temptation to rewrite the harness on Jest/Vitest mid-task | Out of scope. If the Electron harness proves unsalvageable, stop and raise a separate decision task rather than expanding this one |
| Tests pass but assert little (bit-rot hidden by weak assertions) | Phase 13 SUB-002 audits format-test fidelity explicitly; record anything suspicious in NOTES.md for that task |

## References

- [Viability report — Appendix D (build & test attempts)](../../reviews/NOODL-VIABILITY-REPORT.md)
- [Revival roadmap — Horizon 0](../../reviews/NOODL-REVIVAL-ROADMAP.md)
- `dev-docs/reference/DEBUG-INFRASTRUCTURE.md`
- Commit `b5f200c` "Trying to fix editor launch bugs" (prior art)

## Checklist

- [x] Read this file fully; create branch `task/rev-002-test-harness-fix`
- [x] Reproduce the `app === undefined` failure; identify launch-mode cause
- [x] Fix launcher/env; add self-diagnosing guard in `test.js`
- [x] Get the full suite running locally; triage bit-rotted failures
- [x] Verify headless `test:ci` and exit codes
- [x] Update `DEBUG-INFRASTRUCTURE.md`; complete CHANGELOG
- [x] Confirm success criteria
- [ ] Open PR
