# HLS-015 — what was built

**Session 14, 2026-09-10. 5 of 5 acceptance criteria closed.** Ruling **R4 taken by Richard this
session: yes, the legacy deploy gets a CLI.**

`nodegx deploy <project> <out>` writes a ready-to-host site — `index.html`, the hashed export, the
component bundles and the ~14.9 MB NodeGX interpreter — with no editor, no build step, and **no way
to be handed a blank page without being told**.

## 1. The person sentence, performed

```
$ cd /tmp/anywhere                       # neither the repo nor the project
$ nodegx deploy ./landing-pages ./site
Landing pages deployed to /tmp/anywhere/site — 8 entries, 0 project files copied,
  21 of 21 components render.
  3 project file(s) deliberately not published:
      components/ — components/ (project source (v2))
      docs/ — docs/ (project documentation, not for publication)
      nodegx.project.json — nodegx.project.json (project source (v2))
Serve it with: nodegx serve /tmp/anywhere/site
```

Served and opened in a real Chrome, that folder draws **1,881 characters** of the template's own
copy across **151 elements**, with no uncaught exception.

## 2. The shape

| piece | where | why there |
|---|---|---|
| `deploy` arm + `parseDeploy` | `nodegx-export/src/cli/args.ts` | one front door; the discriminated union keeps it total |
| `runDeploy` + `gradeDeploy` | `nodegx-export/src/cli/deploy.ts` | the grading is a pure function of the engine's report |
| `resolveEngine` / `describeMissingEngine` | `nodegx-export/src/cli/deployEngine.ts` | the same shape as `renderHarness.ts`, for the same reason |
| `deployProject` | `noodl-preview/src/deploy.ts` | needs `ProjectModel`, `NodeLibrary`, the viewer register |
| `readDeployedRoots` / `gradeRoots` | `noodl-preview/src/deployReading.ts` | **imports `fs` and `path` and nothing else** |
| the process boundary | `noodl-preview/src/deploy-cli.ts` | one JSON object on stdout; the caller owns the exit code |
| `setExternalFolderPath` | `noodl-editor/.../build/deploy-index.ts` | C68 — the runtime folder stated, not inferred from `cwd` |

🔴 **The engine is a second bundle from the same `build.mjs`, not a second build script.** It needs
byte-identical shims to the preview's — the same dom shim, the same `bugtracker` stub, the same
type-module proxy, the same `empty` asset loaders — and a second copy of those four is a copy that
drifts from the day it is written.

🔴 **`nodegx deploy` dispatches into another process rather than importing the engine.** HLS-013
measured what pulling the editor's model graph into a sibling package's type program costs: **201
type errors and a renderer view module in a server bundle.** The `EngineReport` interface in
`cli/deploy.ts` is therefore declared, not imported, and the drive is what keeps the two honest.

## 3. The acceptance criteria

### AC1 — it renders in a real browser ✅

`tests/hls015-drive.mjs`, three readings and a presence control. **All green, and the control is
the reason arm 1 means anything.**

```
2. the good arm in Chrome
  ✓ the page has text — 1881 characters
  ✓ the page has elements — 151 elements
  ✓ no uncaught exception — none
3. the same folder with every `roots` emptied — register row C67, in a browser
  ✓ the mutation fired — 21 roots arrays emptied
  ✓ the page has NO text — ""
  ✓ and arm 1 is not trivially the same page — 1881 vs 0 characters
4. the engine reads the two folders the way the browser draws them
  ✓ good arm: components with a root — 21
  ✓ blank arm: components with a root — 0
```

🔴 **C67 had never been put in a browser.** Every word of it was established by reading code and
counting fields — `ComponentInstanceNode.render()` returns `null` when `roots` is empty, therefore
the page is blank. Arm 3 empties every `roots` array **in the written artefact** (no source edit, no
rebuild, so the two arms differ by exactly one field) and reads the page. 1,881 characters against
0. The claim is now a measurement.

### AC2 — a deploy that would ship a blank app refuses ✅

Two instruments, and they fail in different directions:

1. **The cause.** `bootstrapNodeLibrary()` throws on an empty register, before a byte is written.
2. **The consequence.** `readDeployedRoots` reads the folder that was written. That catches any
   cause, including the next one.

**The reverted arm, run for real** — `const nodeTypes = bootstrapNodeLibrary()` → `= 0`, rebuilt,
deployed:

```
MUTANT_CLI_EXIT=9
This deploy would ship a blank site, so it is being reported as a failure.
Not one of the 21 deployed components carries a root node, so every one of them renders nothing.
```

and the spike's **independent** reader beside it:

```
on disk : 21 components, 93 connections
deployed: 21 components, 93 connections, 375 nodes
roots   : 0 component(s) WITH a root, 21 WITHOUT
```

🔴 **93 of 93 connections in both arms.** That is the reading HLS-013 §4's trap teaches you to take,
and it is blind to this. Restoring the line and re-packing gives the byte-identical bundle
(`f365838b24c12bffb45846f6c243d82e` before and after), so the arms are proved to differ by one line.

🔴 **The rule is NOT "every component has a root."** A logic-only helper legitimately renders
nothing, and a gate on "no rootless component" refuses the correct answer — HLS-005 filed the same
shape from the other side. The two readings that are actually equivalent to a blank page are: *no*
component carries a root, or the component the app **starts at** does not. Both have a row, and so
do both correct answers a stricter rule would have rejected.

### AC3 — the runtime resolves from the install, not `process.cwd()` ✅

Run from `/tmp/hls015`, a directory that is neither the repo nor the project:

```
'indexJs': 'index-842da8235ea3dad0.js'
```

— **byte-identical to the hash HLS-010's spike recorded** for the good arm run from
`packages/noodl-editor`. Same bundle, two working directories, one output.

🔴 **C68 is deeper than its register row says, in two ways, and both were measured.**

- The row says `getAppPath()` "returns the first ancestor of the working directory holding a
  `package.json`". **There is no ancestor walk**: it checks `process.cwd()` exactly, then
  `__dirname`, and throws if neither has one.
- And it throws **a bare string, at module scope, inside `PlatformNode`'s constructor** — so the
  first real run of the bundle from `/tmp` did not produce `ENOENT … /src/external/deploy/index.json`
  at all. It produced `[@noodl/platform] Cannot find package.json` before a line of deploy code ran,
  with no `stack` for a caller to report. Two fixes, both shipped: `build.mjs` now writes a
  `dist/package.json` beside the bundles so `__dirname` answers, and the deploy **states** its
  runtime folder through `setExternalFolderPath()` rather than trusting `getAppPath()` at all.

### AC4 — a project with assets ships them ✅

`templates/landing-pages` copies **zero** project files (every top-level entry is excluded by a
default rule), so it cannot grade this half at all — the task file said so and it was right.
`tests/fixtures/kits` was used instead:

```
Kits deployed to /tmp/hls015/kits-out — 9 entries, 12 project files copied, 2 of 2 components render.
```

All 12 files under `noodl_modules/` arrive, including `dots.woff2` and `styles.css` — a binary and a
stylesheet, not just JSON.

### AC5 — the deploy does not write to the project it reads ✅

```
project tree BEFORE: 82ec23afa75fcc68caa8017d641903eb
project tree AFTER : 82ec23afa75fcc68caa8017d641903eb
AC5: UNCHANGED
```

`project._isReadOnly = true` is set before `deployToFolder` (C69). ⚠️ It was **measured harmless
without it too**, which is exactly why the row is filed as latent: today this path mutates no model
and so schedules no save. That is a property of what it happens not to do.

## 4. 🔴 What building it found

### C77 — a bundled entry's platform binding is held up by one call site

Writing AC2's mutant removed the **call** to `bootstrapNodeLibrary()` and the bundle then died at
module load with:

```
Cannot read properties of undefined (reading 'join')
  at new _EditorSettings (…/nodegx-deploy.cjs:73851:23)
```

esbuild drops an import whose bindings are all unused, so removing the call removed the
`./headless` import — and with it the side effect that binds `@noodl/platform` to the Node
implementation. **A sentence that names neither the platform nor the import.** `src/cli.ts` has the
same shape and the same latent fragility. Fixed in `deploy.ts` with a bare `import './headless';`
above the named one, and the fix costs **zero bytes** — the rebuilt bundle is byte-identical
(`f365838b…`), because in the good arm esbuild already had the module in the graph. It only changes
what happens the day somebody edits the call away.

### C78 — a spec whose subject is "a command that does not exist" named `deploy`

`hls002-cli.test.ts`'s `EXIT.usage` row was:

```ts
const result = nodegx('deploy', CLEAN, path.join(tmp, 'app'));
expect(result.status).toBe(EXIT.usage);
```

It passed a **real project** and a **real output folder**. The moment `deploy` existed, the row read
exit **0**, having performed a full 15 MB deploy inside the suite — which is also why that file took
**520 seconds**. Renamed to `upload`; the file is back to **70 seconds**. 🔴 The lesson is not about
deploy: a row testing an absence has to name something nothing will ever claim, because the day it
is claimed the row silently starts exercising whatever took the name.

### The `--help` question nobody had to answer before

`nodegx export` and `nodegx deploy` produce different artefacts and #36 files them as one table row.
The usage text now answers it where a person reads it:

```
export or deploy?
  export writes React SOURCE. You run npm install and npm run build, and you own the code.
  deploy writes a FINISHED SITE — index.html, your app, and the NodeGX runtime that runs it.
    Upload the folder and it works. Nothing to build, and no source to edit.
```

## 5. Gates

- **34 new CI rows**, 24 in `nodegx-export/tests/hls015-deploy-cli.test.ts` and 10 in
  `noodl-preview/tests/deploy.test.ts`. **All green on the first run, which is when to distrust
  them — six mutants run, each fires:**

  | mutant | rows red |
  |---|---|
  | `gradeRoots` always passes | 3 of 10 |
  | `readDeployedRoots` ignores the bundles | 1 of 10 |
  | `gradeRoots` refuses ANY rootless component | 3 of 10 |
  | `resolveEngine` falls through on a missing override | 1 of 24 |
  | `gradeDeploy` prints the refusal after the summary | 1 of 24 |
  | `parseDeploy` swallows the next flag as a value | 1 of 24 |

  Restores proved: 0 failed of 10 and 0 failed of 24 afterwards.

- `nodegx-export` **97 suites / 3,352** green (from 94 / 3,297) · `noodl-preview` **2 / 24** green
  (from 1 / 14) · root `tsc --noEmit` **0** · `typecheck:editor` **0** · `typecheck:editor-tests`
  **0** · editor `test:main` **446 suites / 7,359, one red**.

- ⚠️ **That one red is not this task's, and it was not a flake.**
  `tests-unit/fld-009/projectLevelWatch.test.ts` — *"reports the project file when a real atomic
  write lands on it"* — went red under full-suite load and passed **in 276 ms** run alone, which is
  what a flake looks like and is also what a **too-tight ceiling** looks like. I recorded it as a
  flake; the session that owns it (phase 84) re-measured and found the real cause: the spec set its
  latency ceiling to **4,000 ms**, took REL-009b's stopwatch note only half way, and read >4,000 ms
  under this 446-suite run. Raised to REL-009b's own 30,000 with the reason written in the file.
  🔴 **"Green alone, red under load" does not distinguish nondeterminism from a budget that is
  simply too small**, and only the second one is fixable. Re-running told me the wrong thing;
  reading the ceiling told them the right one.

- ⚠️ `tests/hls015-drive.mjs` is **not** a CI gate. It needs Chrome, and calling a
  Chrome-dependent script a gate is this phase's own C46/C47 mistake. `.mjs`, so jest's
  `tests/**/*.test.ts` and tsconfig's `tests/**/*.ts` both skip it, exactly as `tests/hls011/` does.

## 5b. ⚠️ What §2 of the task file got right, and the one thing it did not

Every factual clause held: `deployToFolder` runs in plain Node, it bundles under the config
`nodegx serve` already ships, the engines are the ones `noodl-preview/src/loader.ts` drives, and the
output is a self-contained site.

🔴 **Its conclusion was wrong.** *"One thing is missing, and it is a path — see C68."* There were
**two**, and the path is not the one you hit first: running the bundle from `/tmp` throws
`[@noodl/platform] Cannot find package.json` from `PlatformNode`'s constructor at module scope,
before a single line of deploy code runs and before any path is resolved. A §2 can be accurate line
by line and still point at the wrong file — the milder cousin of HLS-010's own §2, which was "true
in every clause and wrong in its conclusion".

## 6. What this leaves

- ⚠️ **`environment` is still unmeasured.** Every run here was `environment: undefined`. A deploy
  carrying cloud-services metadata is HLS-014's generalisation and is untested.
- ⚠️ **`--base-url` is parsed, forwarded and never driven.** It reaches `deployToFolder`'s
  `baseUrl`; no arm here served a site from a subfolder.
- ⚠️ **One project rendered in a browser.** `landing-pages`. `kits` was deployed and its assets
  counted, not rendered.
- ⚠️ **C69 stays open and latent** — the guard is set, and what makes it necessary has not appeared.
- ⚠️ The engine bundle is a **build artifact**, so `nodegx deploy` from a fresh checkout refuses
  until `npm run build --workspace @noodl/preview` has run. That refusal is graded and says which
  of the two fixes applies.
