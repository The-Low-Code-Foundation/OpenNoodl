# HLS-010 — The deploy spike

🔴 **This task does not produce a `deploy` command.** It produces a written verdict, and then either
a task or a recorded refusal. It exists because #36 puts `deploy` in a table beside `export` as
though they were the same shape, and they are not.

## 1. The person sentence

**The next person who asks "why is there no `nodegx deploy`?" gets a measured answer instead of a
guess — including, possibly, "there will not be one, and here is what to use instead".**

## 2. What is known (measured 2026-09-09)

| | |
|---|---|
| the entry point | `compilation/build/deployer.ts` → `deployToFolder({ project, direntry, environment, baseUrl, … })` |
| what it needs | a live `ProjectModel`, and `Exporter.exportToJSON(project, …)` / `Exporter.exportComponentBundle(...)` |
| what `ProjectModel` is | **1,927 lines**, a singleton (`ProjectModel.instance`), importing `UndoQueue`, `WarningsModel`, `NodeLibrary`, `EventDispatcher`, `ProjectFileWatcher`, `projectMigrator`, `VariantModel`, `LessonModel` |
| its loaders | `readJSONFromDirectory`, `fromLocalStorage`, `fromJSON`. **There is no `fromDirectory`** |
| the encouraging half | it goes through `@noodl/platform`'s `filesystem`, and **`@noodl/platform-node` exists** (`filesystem-node.ts`, `platform-node.ts`, `storage-node.ts`) |
| ✅ the reason to hope | `compilation.ts` is registered in the DEF-007 seam as `inherits` — it clones an already-loaded project. Nothing about the deploy *itself* is inherently GUI |

## 3. What the spike must answer

1. **Does `ProjectModel` construct and load under plain Node with the `platform-node` backend?**
   Try it. This is a two-hour question and the whole estimate turns on it.
2. If yes: what does `deployToFolder` still need that is not present — `@electron/remote`, a window,
   a renderer-only global?
3. What does the deploy actually produce, and **is it the thing we want a CLI for at all?** It
   bundles the *interpreted viewer* plus cloud functions. The React code export is the direction the
   product is going. This is R4, and this spike informs it rather than taking it.
4. What does the 2.9 CLI's `build` command in the original docs actually correspond to here? #11's
   author was reading those docs — the answer belongs in HLS-012's reply.

## 4. Acceptance criteria

1. A written verdict in this file, with the measurement beside each claim, ending in one of:
   *a task exists and here it is* / *refused, and here is what to tell people instead*.
2. The headless-load question is answered by **running it**, not by reading imports. A stack trace is
   an answer; "it imports Electron" is not.
3. If refused: #11 and #36 are updated with the reason, and the register carries a row with an owner
   or the word `NONE`.

## 5. Traps

- 🔴 **Do not start building a deploy command inside this task.** The failure mode this phase is most
  exposed to is a spike that quietly becomes the biggest task on the board.
- 🔴 **Measure, do not reason.** `ProjectModel`'s import list looks fatal and may not be — several of
  those are lazily reached. Equally it may fail for a reason not in the import list.
- ⚠️ Time-box by dependency, not by clock, per the standing rule: the spike ends when questions 1–4
  have answers, not when it feels long.

---

# 6. 🔴 The verdict — 2026-09-09, session 9

**A task exists, and it is [HLS-015](HLS-015-NODEGX-DEPLOY.md).**

**`deployToFolder` ran to completion in a plain Node process, with no Electron, no window and no
`@electron/remote`, and produced a servable static site.** The question the task file called "a
two-hour question the whole estimate turns on" is answered, and the answer is *yes*.

## 6.1 What was run

`hls010-spike/hls010-spike.ts`, bundled by `hls010-spike/build-spike.mjs` — the **same esbuild
config `nodegx serve` ships with**, entry point swapped. It calls the editor's real
`deployToFolder` against a **copy** of `templates/landing-pages` (21 components, 93 connections,
375 nodes). Re-runnable:

```
SPIKE_OUT=/tmp/hls010.cjs node dev-docs/tasks/phase-83-behind-a-click/hls010-spike/build-spike.mjs
cd packages/noodl-editor && node /tmp/hls010.cjs <project-dir> <out-dir>
node dev-docs/tasks/phase-83-behind-a-click/hls010-spike/measure-deploy.js <out-dir> <project-dir>
```

## 6.2 The four questions, answered

**Q1 — does `ProjectModel` construct and load under plain Node with `platform-node`? ✅ YES, and it
already ships.** Not a discovery of this spike: `nodegx serve` (HLS-006) has been doing it since
session 7. `noodl-preview/src/loader.ts` builds a `ProjectModel` from a v2 directory and runs
`Exporter.exportToJSON` + `exportComponentBundle` + `HtmlProcessor` on it — **every engine
`deployToFolder` uses**. Measured here: 160 node types, 21 components, root node resolved.

⚠️ **The task file's §2 row "there is no `fromDirectory`" is true and was never the obstacle.** The
loader reads the v2 directory with `ProjectImporter` and calls `fromJSON`. That path is written,
tested and shipping.

**Q2 — what does it still need that is not present? Exactly one thing, and it is not Electron.**

```
Error: ENOENT: no such file or directory, open
  '…/packages/noodl-preview/src/external/deploy/index.json'
    at async Object.readJson (…)
    at async deployToFolder (…)
```

`getExternalFolderPath()` is `filesystem.join(platform.getAppPath(), 'src/external')`, and
`platform-node`'s `getAppPath()` returns **`process.cwd()`** (the first ancestor with a
`package.json`). So the deploy runtime — `index.html`, `noodl.deploy.js`, the React pair — is
addressed relative to wherever the process happens to have been started.

**Re-run with `cwd = packages/noodl-editor` and the whole deploy resolves.** That is the entire gap:
a path, not a dependency. `noodl-preview` already solved the same problem the honest way, with an
explicit `DEPLOY_DIR = path.resolve(__dirname, '…/noodl-editor/src/external/deploy')`. Filed as
**C68**.

Nothing else was missing. No `@electron/remote`, no `window`, no renderer global — and the esbuild
bundle **resolved the entire transitive import graph of `deployToFolder` at build time**, which
`build.mjs`'s own header calls the good failure mode. It did not fail.

**Q3 — what does the deploy actually produce, and do we want a CLI for it?**

An 8-entry, self-contained static site — served over plain HTTP and every asset fetched 200:

| file | |
|---|---|
| `index.html` | references the hashed export by name |
| `index-842da8235ea3dad0.js` | 6,028 B — `window.projectData`, the root component + `componentIndex` |
| `noodl_bundles/b1…b4.json` | 4 lazily-fetched bundles, 16–46 KB |
| `noodl.deploy.js` | **14,881,568 B** — the interpreter |
| `react{,-dom}.production.min.js`, `load_terminator.js`, `noodl-app.png` | |

🔴 **This is a different artefact from `nodegx export`, not a competing one.** `nodegx export`
emits React source you build yourself; the deploy emits a **ready-to-host site with no build step**,
running the interpreter. They answer different questions — *"give me the code"* versus *"put it
somewhere"* — and #36's table is right that they belong side by side, wrong that they are the same
shape. **The recommendation is to build it (HLS-015); R4 is still Richard's ruling to take.**

**Q4 — what does the 2.9 docs' `build` command correspond to here?** Already answered by HLS-012's
research and re-confirmed: the `noodl build` CLI at `docs.noodl.net/2.9/cli/commands/build/`
**was never part of the open-sourced code**, so it corresponds to nothing in this repository. The
nearest true statement for #11's reply is now stronger than it was this morning: *the thing that
command did is what this spike just ran headlessly, and a task exists to give it a name.*

## 6.3 🔴 What the spike found that nobody was looking for

**An export built without a populated `NodeLibrary` ships a blank app and reports success.**

A negative control was run because HLS-013 §4 warns that an unprepared headless export "succeeds,
shipping a graph with almost no connections in it". **That is not what happens on this path** — and
the metric that warning suggests is blind to what does:

| | components | connections | nodes | **components with a root** |
|---|---|---|---|---|
| on disk | 21 | 93 | — | — |
| **with** node library (160 types) | 21 | 93 | 375 | **21** |
| **without** (control, 0 types) | 21 | 93 | 375 | **0** |

Every connection survives. Every node survives. `exportComponent` pushes a root only
`if (n.type.allowAsChild)`, so with nothing resolving, **every `roots` array comes back empty** —
and `ComponentInstanceNode.render()` returns `null` when `roots` is empty
(`noodl-runtime/src/nodes/componentinstance.ts:322`). The deploy resolves, writes eight files,
reports `copied 0 project file(s)` exactly as the good run does, and serves a page that renders
nothing.

🔴 **A connection count — the instrument HLS-013's trap teaches you to reach for — reads 93/93 in
both arms and cannot see this.** Filed as **C67**, with `measure-deploy.js` as the instrument that
can.

⚠️ `bootstrapNodeLibrary()` already throws on an empty library, so any deploy built **on
`noodl-preview/src/headless.ts` inherits the guard**. That is the strongest argument for where
HLS-015 should live, and it is why C67 is filed as a hole in the export rather than a bug in the
preview.

## 6.4 What this spike did NOT establish

- ⚠️ **Nothing was painted in a browser.** The evidence that the good arm renders is structural
  (21 roots present, assets fetch 200) plus the runtime source above — not a screenshot. A real
  paint belongs to HLS-011.
- ⚠️ **One project, one shape.** `templates/landing-pages` has no `noodl_modules`, no kits, and
  **zero copied project files** — all three of its top-level entries are excluded by default rules.
  The asset-copying half of `deployToFolder` therefore ran and copied nothing. A project with
  assets is unmeasured.
- ⚠️ **`environment: undefined` only.** No cloud-services metadata was baked in, so the
  deploy-with-a-backend path — the one HLS-014 generalises — is untested here.
- 🔴 **`deployToFolder` never sets `_isReadOnly`,** which is C63's guard. The project tree hashed
  **identical** before and after (`9a0f6995394b5837aba7528691cd2351`, and the pristine template
  matches), because this path mutates no model and so schedules no autosave. That is a measurement
  of *this* run, not a guarantee: the guard is absent. Filed as **C69**.
