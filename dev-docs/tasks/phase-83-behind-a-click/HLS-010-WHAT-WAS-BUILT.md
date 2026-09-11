# HLS-010 — what was built

**Session 9, 2026-09-09.** A spike. **No product code changed** — `git status` shows three modified
docs and two new ones, and nothing under `packages/`. That is the correct output shape for this task.

> **The next person who asks "why is there no `nodegx deploy`?" gets a measured answer.**

The answer is: **there can be one, it is not blocked by Electron, and here is the task** —
[HLS-015](HLS-015-NODEGX-DEPLOY.md). The full verdict lives in
[the task file §6](HLS-010-THE-DEPLOY-SPIKE.md#6--the-verdict--2026-09-09-session-9), per AC1.

## 1. The three acceptance criteria

| # | criterion | state |
|---|---|---|
| 1 | A written verdict in the task file, measurement beside each claim, ending in a task or a refusal | 🟢 **CLOSED** — §6, ending in HLS-015 |
| 2 | The headless-load question answered by **running it**, not by reading imports | 🟢 **CLOSED** — two full deploys of a real template; the one failure is quoted as its stack trace |
| 3 | If refused: #11/#36 updated, register carries a row with an owner or `NONE` | 🟢 **CLOSED (vacuously + substantively)** — not a refusal, so the #11/#36 clause does not apply; **C67, C68, C69** filed regardless |

## 2. What was measured

**`deployToFolder` ran to completion in a plain Node process** and produced a self-contained static
site: `index.html` + a hashed `index-*.js` carrying `window.projectData` + four lazily-fetched
bundles + the 14.9 MB interpreter. Served over plain HTTP, every asset **200**.

No Electron. No window. No `@electron/remote`. The esbuild bundle resolved the entire transitive
import graph at build time — which `noodl-preview/build.mjs`'s own header calls the good failure
mode, and it did not fail.

🔴 **The task file's §2 was true in every clause and wrong in its conclusion.** `ProjectModel` is
1,927 lines, is a singleton, and has no `fromDirectory` — and none of that was the obstacle.
`ProjectModel.fromJSON` after `ProjectImporter` loads a v2 directory headlessly, and **`nodegx serve`
has been doing exactly this since HLS-006**. The import list looked fatal and was not, which is the
trap the task file's own §5 warned about.

**The one real gap is a path**, not a dependency: `getExternalFolderPath()` resolves against
`platform.getAppPath()`, which under `platform-node` is `process.cwd()`. Same binary, same project,
one cwd gives `ENOENT … /src/external/deploy/index.json` and another gives a complete deploy
(**C68**).

## 3. 🔴 What the control found

A negative control was run because HLS-013 §4 warns that an unprepared headless export ships a graph
with its connections stripped. **That is not the failure on this path**, and the instrument that
warning points you at cannot see the one that is:

| | components | connections | nodes | **components with a root** |
|---|---|---|---|---|
| on disk | 21 | 93 | — | — |
| **with** node library (160 types) | 21 | 93 | 375 | **21** |
| **without** (control, 0 types) | 21 | 93 | 375 | **0** |

Every connection survives. Every node survives. `exportComponent` pushes a root only
`if (n.type.allowAsChild)`, so an unresolved library empties every `roots` array — and
`ComponentInstanceNode.render()` returns `null` on empty roots
(`noodl-runtime/src/nodes/componentinstance.ts:322`). **The deploy resolves, writes all eight files,
logs the same success line, and serves a blank page.** Filed as **C67**; it blocks HLS-015 AC2.

⚠️ Contained today only because `bootstrapNodeLibrary()` throws on an empty library — a guard that
lives in `noodl-preview`, **not in the exporter**. Any new caller re-opens it.

## 4. The instrument

[`hls010-spike/`](hls010-spike/) — kept because HLS-015 needs it to grade AC2, and because a spike
whose numbers cannot be re-run is a claim rather than a measurement. Rebuilt from its new home and
**re-run: both arms reproduced byte-identical bundle hashes** (`842da8235ea3dad0`,
`8ab1c061cf564938`). See that folder's README.

## 5. Suites

**None run, and none needed: no product code changed.** `git status` under `packages/` is clean; the
temporary spike entry and build script were moved out of `noodl-preview` into the task folder, and
`packages/noodl-preview/dist/` is untouched (Aug 20).

## 6. What this does NOT leave you

- ⚠️ **Nothing was painted in a browser.** The good arm's evidence is structural (21 roots, assets
  200) plus the runtime source — not a screenshot. HLS-015 AC1 and HLS-011 own the paint.
- ⚠️ **One project, one shape.** `templates/landing-pages` copies **zero** project files (all three
  top-level entries are excluded by default rules), so the asset-copying half of `deployToFolder`
  ran and copied nothing. A project with `noodl_modules` or static assets is unmeasured — HLS-015
  AC4.
- ⚠️ **`environment: undefined` only.** The deploy-with-a-backend path HLS-014 generalises is
  untested here.
- 🔴 **R4 is not taken.** The spike recommends; the ruling is Richard's, and HLS-014 stays gated.
