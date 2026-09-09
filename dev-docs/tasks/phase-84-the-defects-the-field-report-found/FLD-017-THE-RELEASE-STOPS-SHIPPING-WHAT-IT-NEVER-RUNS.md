# FLD-017 — The release stops shipping what it never runs

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
