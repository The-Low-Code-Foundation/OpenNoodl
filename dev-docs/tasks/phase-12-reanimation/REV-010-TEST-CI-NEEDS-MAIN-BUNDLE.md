# REV-010: `test:ci` depends on an artefact it does not build

## Metadata

| Field | Value |
|-------|-------|
| **ID** | REV-010 |
| **Phase** | Phase 12 — Reanimation (Revival Horizon 0) |
| **Priority** | 🔴 High — blocks REV-003. A clean CI runner fails three specs for reasons unrelated to any code change |
| **Difficulty** | 🟢 Low — the diagnosis was the work; the fix is ~30 lines |
| **Estimated Time** | Under a day |
| **Prerequisites** | None. Found during REV-009 |
| **Branch** | `cline-dev` — work directly on it, no task branch (see `.clinerules`) |
| **Recommended executor** | 🟡 Sonnet 5 — mechanical once the cause is known |

## Objective

Make `npm run test:ci` pass on a checkout that has never been built, so REV-003's
pipeline measures the code rather than the state of someone's disk.

## What was found

On a tree with no prior `build:editor`, `npm run test:ci` fails three specs and
spawns seven Electron windows that each throw a dialog and exit:

```
Unable to find Electron app at .../packages/noodl-editor
Cannot find module '.../packages/noodl-editor/src/main/main.bundle.js'.
Please verify that the package.json has a valid "main" entry
```

The three:

```
Git local tests  can handle merge with conflicts in project.json
  Error: Timeout - Async function did not complete within 60000ms
Git remote tests can handle merge with conflicts in project.json
Git remote tests Merge with conflicts everywhere, even in stash
```

### Why

`noodl-git` installs a git merge driver that shells out to the editor itself
(`packages/noodl-git/src/core/init.ts`):

```ts
const driverPath = process.env.devMode
  ? `"${path.join(process.cwd(), 'electron')}" "${process.cwd()}"`
  : `"${process.env.exePath}"`;
const driver = `${driverPath} --merge %O %A %B %L`;
```

So any spec that merges a conflicting `project.json` boots this package as an
Electron app. That resolves `package.json`'s `"main": "src/main/main.bundle.js"`,
which REV-008's `10ea2a8` correctly untracked as generated output. `test:ci`
builds only the renderer test bundle (`webpack.test-ci.js`), so the driver's
Electron cannot start, never writes the merged file, and git waits until Jasmine's
60s timeout fires.

### Why it was not caught

REV-008 recorded **705 specs, 0 failures** — measured on a machine where
`main.bundle.js` was still on disk from an earlier `build:editor`. The suite's
result depended on whether someone had happened to build recently, which is
exactly the stale-artefact class of bug REV-008 existed to close, reappearing one
level up. Untracking the bundle was right; not building it in the test path was
the gap.

This lands on REV-003 immediately: a GitHub Actions runner is by definition a
checkout that has never been built.

### Already fixed concurrently

The related "harness exits 0 having reported nothing" symptom — observed once
during REV-009, where a run produced no `Jasmine:` summary and no
`tests/test-results.json` yet exited 0 — was root-caused and fixed in the CI
work: `app.exit()` is `process.exit()` underneath and does not flush pending
writes, so with stdout on a pipe the entire summary was discarded. `test.js` now
writes the report with `fs.writeSync` and drops a machine-readable
`tests/test-results.json`. No action needed here; recorded so the two findings are
not conflated.

## Implementation

`packages/noodl-editor/scripts/run-electron-tests.js` builds `main.bundle.js`
before spawning Electron.

That file rather than the `test:ci` script because it is the single launcher both
`test:ci` and `test:editor` already go through, and it exists precisely to make
the launch robust — it is where the `ELECTRON_RUN_AS_NODE` strip lives.

It rebuilds on **every** run rather than only when the file is missing. A stale
main bundle is the same class of defect as an absent one, and
`webpack.main.dev.js` takes ~200ms.

## Verification

Delete `src/main/main.bundle.js`, then run `npm run test:ci`. Before: 3 failures,
seven error dialogs. After: 712 specs, 0 failures, exit 0, no stray windows.

## Success criteria

- [x] `npm run test:ci` passes on a tree with no `src/main/main.bundle.js`
- [x] No Electron windows appear during a `--ci` run
- [x] The build failure surfaces as a non-zero exit with a clear message, not a
      60s timeout in an unrelated spec

*(Boxes ticked by DEBT-010, 2026-07-25 — the doc's own Verification section
records the passing run: 712 specs, 0 failures, exit 0, no stray windows.)*

## References

- `packages/noodl-editor/scripts/run-electron-tests.js` — the launcher
- `packages/noodl-git/src/core/init.ts` — the merge driver that needs the app
- `packages/noodl-editor/package.json` — the `main` entry being resolved
- [REV-008-DEV-LOOP-HARDENING.md](./REV-008-DEV-LOOP-HARDENING.md) — Stream A, which
  untracked the bundle
- [REV-009-STYLE-TOKENS-NEVER-WIRED.md](./REV-009-STYLE-TOKENS-NEVER-WIRED.md) — where
  this surfaced
- [REV-003-CI-PIPELINE.md](./REV-003-CI-PIPELINE.md) — the task this blocks
