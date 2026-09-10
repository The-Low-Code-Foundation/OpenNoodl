# FLD-017 — The release stops shipping what it never runs

🟢 **BUILT** — session 11, 2026-09-10, `07f6a7e74` + `aedc51f64` (ruling **R5** answered mid-session).
**`app.asar` 283,432,139 → 168,143,884 B — −115,288,255 B, −40.7%** — and idle CPU on the welcome
screen **2.42% → 0.14% of a core**. All six ACs are met or answered; see §6 and §9.

Files (`07f6a7e74`):
`packages/noodl-editor/package.json`, `.../src/editor/src/styles/popuplayer.css`,
`.../src/editor/src/views/popuplayer.ts`, `.../src/main/main.js`,
`packages/noodl-core-ui/src/components/inputs/PrimaryButton/PrimaryButton.tsx`,
`packages/noodl-editor/tests-unit/fld-017/primary-button-spinner.test.ts` (new),
`packages/noodl-editor/jest.config.js`. **#42 replied twice and CLOSED.**

Plus (`aedc51f64`): `packages/noodl-editor/webpackconfigs/webpack.renderer.production.js`,
`scripts/check-build-artefacts.js`, `.gitignore`.

⚠️ Items 2 and 4 are **refused with a measurement** — see §6. They are not deferred; their premises
are false, and **AC4 is vacuous rather than met**.

271 MB of app archive, of which **86 MB is sourcemaps nobody reads at runtime**, and an idle
launcher burning 4% of a core with nothing open. The two best fixes are about twenty-five lines
between them.

## 1. The person sentence

**Someone installs NodeGX and it is a normal-sized desktop app; they leave it open on the welcome
screen and their fan stays off.**

## 2. What was reported, and what the code says

[#42](https://github.com/The-Low-Code-Foundation/NodeGX/issues/42), measured on the shipped 0.2.2
AppImage: `app.asar` 271 MB / 12,790 files — 115 MB `node_modules`, **86.4 MB sourcemaps**, 62 MB
first-party JS (`index.bundle.js` **31.3 MB unminified**, 545,101 lines), 6.7 MB fonts, 6.0 MB
images. Idle launcher: 805 CPU-seconds over 5 h 23 m = **4.1% of one core**, 847 MB RSS.

Verified against `cline-dev` 2026-09-09:

- ✅ **Maps ship.** `webpackconfigs/webpack.renderer.production.js:11` — `devtool: 'source-map'`, and
  `build.files` has **no `!**/*.map`** exclusion. `build.extraResources` additionally ships
  `nodegx-backend/dist/cli.js.map` explicitly.
- 🔴 **Minification is off, and there is no recorded reason.**
  `webpack.renderer.production.js:6-10` sets `optimization: { minimize: false }` with no comment and
  no linked issue. `git log -S'minimize: false'` on that file returns **exactly one commit: the
  initial fork commit**. It has never been touched or justified here. The main-process config sets no
  such override and **does** minify.
- **Blockly is code-split and the split is defeated.** `tabWorkspaces.tsx:17` dynamically imports the
  workspace — but `propertyeditor/DataTypes/LogicBuilderWorkspaceType.ts:9` →
  `BlocklyEditor/readableCode.ts:47-48` does `import * as Blockly from 'blockly'` as a **value**
  import, pulling 13.4 MB back into the main bundle. The other cross-boundary imports are clean.
- **dugite is a hard runtime dependency** (`noodl-git/package.json:14`, 12 importing files) and
  `build.files` lists it explicitly. ⚠️ **A system-git path half-exists already:**
  `noodl-git/core/client.ts:144-145` respects `LOCAL_GIT_DIRECTORY` if pre-set. What is missing is
  detection — but the −44 MB only materialises if the bundled copy becomes an **optional download**,
  which is a much larger change.
- **Runtime copies are bigger than reported:** `noodl-editor/src/external/` holds `viewer` 15 MB,
  `deploy` 15 MB, `ssr` 14 MB, `cloudruntime` 1.6 MB — **~46 MB**, not ~4.8 MB.
- 🔴 **The idle-CPU proposal in the issue is misdirected.** `backgroundThrottling` is at Electron's
  default for the main window, and the reporter's window was **visible**, so that change would do
  nothing. What actually runs with nothing open: a **UDP multicast every 2 s forever**
  (`main.js:1309`) and a **user-profile file poll every 2 s forever in the renderer**
  (`UserProfile/install.ts:97`). `ProjectsPage` itself has no interval, no rAF and no keyframes.
  ⚠️ The 300 s of GPU-process time is **not explained by anything static** — it needs a live trace,
  not a code read. Do not promise a fix for it.
- `utils/electron/appFocusTimer.ts` is marked `@deprecated` with **zero call sites**. Dead.

## 3. Scope — ranked, and the ranking is the deliverable

| # | change | saves | effort | risk |
|---|---|---|---|---|
| 1 | `"!**/*.map"` in `build.files`; drop the `cli.js.map` extraResource | **−86 MB** | 2 lines | ~none |
| 2 | Break the `readableCode.ts` → blockly **value** import | **−13 MB** eager | ~20 lines | low |
| 3 | Gate the multicast on project-open (`main.js:1313` already has the hook) | a 0.5 Hz wakeup + a LAN broadcast | ~10 lines | low |
| 4 | Profile poll → `fs.watch`, or back off when blurred | likely a real slice of the 480 s renderer | ~15 lines | low |
| 5 | Enable minification with `keep_classnames`/`keep_fnames` | −35 MB | 1 line + a full QA pass | **medium-high (R5)** |

**Do 1 and 2 first**: ~99 MB off a 271 MB archive for about 25 lines and no behavioural risk. 3 and 4
are the cheap half of the idle story and can ride the same change. **5 is gated on R5.**
⚠️ **Out of scope, filed:** one runtime build with a flag (−30 MB), variable woff2 (−6 MB), optional
dugite (−44 MB, days, high risk).

## 4. Acceptance criteria

1. **(person)** The installed application is measurably smaller, and the numbers are recorded
   **before and after from the same build** — asar bytes and file count, not an estimate.
2. Sourcemaps are absent from the shipped archive, asserted by inspecting the built artefact. A
   config change that does not reach the artefact is not this fix.
3. 🔴 **The editor still works without its maps.** Launch the built app, open a project, trigger a
   caught error, and confirm the app behaves. Removing maps must not remove a code path.
4. `blockly` is absent from the initial renderer chunk, asserted from the build output — and the
   Logic Builder still opens and loads it on demand. Both arms.
5. Idle CPU is measured over a fixed window before and after, on the welcome screen, same machine.
   🔴 **Report what did not change too** — the GPU-process time is unexplained and must not be
   quietly folded into a headline improvement.
6. If R5 admits minification: the full editor QA pass is run and named. This codebase has legacy
   prototype code and dynamic `require` in its plugin paths, which is exactly what mangling breaks.

## 5. Traps

- 🔴 **Minification is not a one-line change in consequence.** `mode: 'production'` also enables
  `sideEffects` and mangling. Start with `keep_classnames`/`keep_fnames` and still QA it.
- 🔴 **Do not delete the bundled dugite.** A user without git installed loses version control
  entirely, and the editor's own Git fixtures make real commits through it.
- ⚠️ **This checkout has ~16 MB of stray macOS duplicate directories** under `src/external/`
  (`deploy 2/`, `viewer 3/`, `ssr 3/`, `cloudruntime 3/`). They are gitignored so CI never sees them,
  **but `build.files` includes `"src"` wholesale**, so a local packaging run would ship them. Delete
  them; do not let them into a measurement.
- ⚠️ A size measurement taken on a local build is not a measurement of the release. Take both from CI
  artefacts, or say which you took.

## 6. ✅ What session 11 built, and the two things in §2 and §3 that were wrong

### The size half — `−85,414,531 bytes`, from the artefact

`"!**/*.map"` added to `build.files`; the `nodegx-backend/dist/cli.js.map` `extraResource` removed.
Two `electron-builder --mac --arm64 --dir` runs of the same pipeline, before and after, measured by
reading the asar's own header:

| | before | after |
|---|---|---|
| `app.asar` on disk | 283,432,139 B | 198,017,608 B (**−30.1%**) |
| files in the archive | 13,113 | 11,932 (**−1,181**) |
| `.map` files anywhere in the built `.app` | 1,181 / 81.2 MB | **0** |

⚠️ Our archive is **283 MB**, not the 271 MB #42 measured on the shipped 0.2.2 — `cline-dev` has
grown. AC1 asked for both numbers from the same build, and that is what these are.

**AC3 driven.** The built, map-free app was launched, a copied project opened by clicking its
launcher card (hit-tested first), and then: a caught `JSON.parse` throw still carries its message
and a stack; an uncaught throw still reaches `window.onerror` with file and line; the editor is
still holding the project afterwards. Nothing in first-party source reads a `.map` — grepped.

### The idle half — and it was neither of the two candidates in §2

🔴 **`opacity: 0` is not "not rendered", and only `display: none` stops a CSS animation.**
`.popup-layer-activity` is built once in `popuplayer.ts`'s constructor and never leaves the tree; it
hides itself with `opacity: 0`. Its three `bouncedelay 1.4s infinite` dots therefore composited for
the life of the app, on **every screen**. `PrimaryButton` had the identical defect — its `.Spinner`
wrapper is also `opacity: 0` and it mounted the dots unconditionally — which is why the Deploy
button animated behind every open project.

`document.getAnimations()`, packaged build: **3 → 0** on the welcome screen, **3 → 0** with a
project open.

Idle CPU, welcome screen, 180-second windows, same machine, cumulative process time sampled twice:

| process | before | after |
|---|---|---|
| gpu | 0.92% of a core | **0.03%** |
| renderer | 1.42% | **0.04%** |
| main | 0.06% | 0.06% |
| utility | 0.02% | 0.01% |
| **total** | **2.42%** | **0.14%** |

🔴 **AC5 asked what did NOT change, and the answer is the main process** — 0.06% either way. The
multicast gate (item 3) is built and it moved nothing measurable; it is **network hygiene**, not a
CPU fix, and the reply to #42 says so in those words.

🔴 **The §2 line "the 300 s of GPU-process time is not explained by anything static — do not promise
a fix for it" is now answered, and the answer was static after all.** It was compositing the
invisible spinner. `getAnimations()` is the instrument a code read could not be: three running
animations on a screen whose source has, as §2 correctly says, no interval, no rAF, and — in
`ProjectsPage` itself — no keyframes. The keyframes were in a layer mounted underneath it.

### 🔴 Items 2 and 4 are REFUSED, with measurements

**Item 2 (`blockly`, "−13 MB eager") does not exist.** `webpack.renderer.production.js` uses
`getExternalModules({production: true})`, which marks **every directory in `node_modules`** as a
webpack external except the three named `!node_modules/…` in `build.files`. So blockly was never in
the bundle: `index.bundle.js` holds exactly **one `require("blockly")`** and none of blockly's code,
and blockly ships as `node_modules/blockly` and is required at runtime. A static trace confirms the
import graph §2 describes — every eager path to blockly goes through
`LogicBuilderWorkspaceType.ts → readableCode.ts`, one edge — but cutting that edge saves **0 archive
bytes**. The only cost is boot work, and a cold re-`require` of blockly measured in the packaged
renderer is **4 ms**. Making `renderReadableCodeFromJson` async for 4 ms is not worth the risk.

⚠️ **AC4 is therefore vacuous, not met.** "blockly is absent from the initial renderer chunk" was
already true before this task existed, for a reason the AC did not know about.

**Item 4 (the user-profile poll) is not measurable.** `installUserProfile()` is called from
`setupEditor`, so it **does not run on the welcome screen at all** — the exact scenario #42
reported. With a project open, a 30-second V8 sampling profile of the renderer puts its
`existsSync` + `readFileUtf8` at **8 samples of 112,752**, 0.007% of wall time; the renderer's JS is
**99.78% idle** there. The busiest JS with a project open is `toDataURL` (0.06%) — thumbnail
capture — not any of the polls.

## 7. Gates and instruments

- `test:main`: **448 suites / 7,372 tests, exit 0.**
- `typecheck:editor`: exit 0. `typecheck:core-ui`: **45 errors — the IDENTICAL error set at HEAD**,
  proved by `git show HEAD:PrimaryButton.tsx >` over the changed file, re-running, and restoring
  (md5-verified both ways). Pre-existing, measured against *this* change rather than inherited.
- `tests-unit/fld-017/primary-button-spinner.test.ts`, 4 tests, **two reverted arms run**:
  making the render unconditional again reddens 2 of 4; deleting the dots outright reddens 1 of 4.
  ⚠️ The fourth test was renamed after arm 2 — it was called *"the two arms differ ONLY by the
  dots"* and it **passed with the dots deleted**, because the wrapper and label keep their
  `is-loading` class either way. It grades "neither arm is empty", and now says so.
- ⚠️ `jest.config.js` gained `^@noodl-hooks/(.*)$`, and the spec mocks **only** `Icon`
  (`require.context` is a webpack API that fails the suite *to run*). No arm passes an `icon`, so
  the stub is never called.

## 8. ✅ Item 5 — minification. R5 answered mid-session; AC6 is MET

**Ruling R5, answered by Richard 2026-09-10: in scope for 0.2.3, with `keep_classnames` /
`keep_fnames`.** Shipped `aedc51f64`.

`optimization: { minimize: false }` had been in `webpack.renderer.production.js` **since the initial
fork commit with no comment and no linked issue** — `git log -S` returns that one commit. Nobody
here chose it.

### The number was an estimate; this is the measurement

Two full renderer builds, one variable changed:

| build | the two renderer bundles |
|---|---|
| `minimize: false` | 55,600,724 B |
| `keep_classnames` + `keep_fnames` (shipped) | **27,036,061 B (−51.4%)** |
| full mangling, no `keep_*` | 24,966,424 B |

Packaged, the whole day in one table:

| | `app.asar` | files |
|---|---|---|
| HEAD at the start of session 11 | 283,432,139 B | 13,113 |
| after the sourcemap fix (`07f6a7e74`) | 198,017,608 B | 11,932 |
| **after minification (`aedc51f64`)** | **168,143,884 B** | 11,934 |

**−115,288,255 B, −40.7%.** The name-safety costs **1,066,993 B — 3.5%** — and is not worth trading.

### 🔴 §5's first trap was overstated, and the measurement says how

*"`mode: 'production'` also enables `sideEffects` and mangling"* — **`mode: 'production'` was already
set, on the line above.** Tree-shaking, `usedExports`, `sideEffects` and module concatenation have
been live in every shipped build all along. The only thing this change adds is terser.

On the surface mangling can actually reach: `constructor.name` has **zero** call sites in the editor
source; the ~25 `.name ===` comparisons are node-type, component and port names — **data strings out
of project JSON**, which terser never touches; terser does not mangle property names unless asked.

🔴 **The one genuine hazard is handled by terser itself, and it is READ OFF THE MINIFIED ARTEFACT
rather than argued.** `compilation.ts` does `eval(fileContent)` on project build scripts, in a scope
whose locals mangling would otherwise rename. Terser detects the direct `eval` and left that whole
scope alone — `buildScriptLocation`, `scriptFiles`, `readTasks`, `filePath`, `fileContent`,
`buildScript` all appear verbatim in `src/editor/index.bundle.js`. The other site,
`sitemap.ts`'s `new Function(codeText)`, captures no scope at all.

### AC6 — the QA pass, named

Driven headlessly against the **packaged minified** build, console errors and uncaught exceptions
recorded throughout (`scratchpad/qa-drive.js`):

| step | reading |
|---|---|
| launcher renders | 1 project card, hit-tested before the press |
| project opened by a real click | editor up, **13 canvas nodes**, 0 animations |
| property editor / side panels | **10 panels, 34 buttons, 2 inputs** |
| `keep_classnames` / `keep_fnames` live | a named class and a named function both still report their names |
| detached viewer window (`viewer-detach`) | **`viewer-frame`, the SECOND minified bundle**: 24 visible boxes, its webview present, **0 console errors, 0 exceptions** |
| live preview webview | real computed output — *"Both stamps fall on the same working day"*, *"The launch date has passed"* |
| both renderers | 🔴 **0 uncaught exceptions** |

⚠️ **What the QA could NOT reach:** an actual deploy/export run, and a Logic Builder session. Both
are behind flows that need a backend or a node with a saved workspace. The `eval` path they exercise
is the one proved above by reading the artefact, which is the stronger evidence anyway.

⚠️ **Two consequences of enabling minification, both handled.** Terser writes a
`*.bundle.js.LICENSE.txt` sidecar per bundle — gitignored, covered by
`scripts/check-build-artefacts.js` (green), and **shipped**, because shipping the attribution is
right. And the renderer build goes **58–73 s → 113 s**; watch the first CI run, since the macOS
runners are the ones that OOMed at 2048 MB (`webpackHeapCeiling.ts`).

## 9. ⚠️ One pre-existing defect the QA drive found — NOT minification

**The node-graph canvas icons have never shipped.** `CanvasIcons.ts` `require`s five SVGs through
`file-loader`, which emits them as hashed files into the **package root**; `build.files` ships
`"*.js"` from there but nothing else, so all five fail to load in every packaged build — five
`Failed to load … icon` console errors, and the home / component / AI-assistant / warning glyphs
simply are not painted.

🔴 **Proved pre-existing for free, against a SHIPPED artefact rather than a rebuild:**
`/Applications/NodeGX.app`'s asar carries the **identical** 56 SVGs and the same **zero** hashed
file-loader assets as ours. Minification cannot cause this and did not.

⚠️ **`"*.svg"` in `build.files` is probably NOT the whole fix** — the bundle references the assets by
bare filename while the HTML lives at `src/editor/index.html`, so this is a `publicPath` question as
well as a packaging one. **Not attempted here**; it is not FLD-017's and guessing at it would be
worse than filing it. 325 files / 375,288 B.

## 10. Housekeeping this session did, and one environment trap

⚠️ The four stray macOS duplicate directories under `src/external/` (§5's third trap) were removed
before any measurement was taken — they went to the session scratchpad, which is ephemeral, so
treat them as gone. They were gitignored build output.

⚠️ The `--dir` build itself (`packages/noodl-editor/dist/mac-arm64`, 525 MB) was removed at the end
of the session; the machine is at 11 GiB free. Reproduce with `npm run build:bundles` then
`CSC_IDENTITY_AUTO_DISCOVERY=false node_modules/.bin/electron-builder --mac --arm64 --dir --publish never --config.npmRebuild=false`.
🔴 **Never `npm run build:editor`** — it runs `npx rimraf ./node_modules` (register **P28**).

⚠️ **`ELECTRON_RUN_AS_NODE=1` is set in this session's environment** (an MCP server exports it), and
with it set the packaged binary parses its argv with **Node's** option parser and dies on
`bad option: --user-data-dir=…`. Launch a packaged build with `env -u ELECTRON_RUN_AS_NODE`.
