# UNI-012 — F4 on a packaged install: ship the render harness with the sidecar

**Surface:** editor packaging + MCP · **Tier:** falls out of UNI-010 · **Effort:** M
· ✅ **RULED 2026-08-16 by Richard** — *ship the harness with the sidecar*, the first of the two
options UNI-010 put to him. This file is the scoping that ruling asked for, plus **two facts measured
on 2026-08-16 that change what the option delivers**, neither of which was known when it was put to
him.

> ✅ **BUILT AND VERIFIED AGAINST A PACKAGED BUILD — 2026-08-20 (session 45).** The reason this sat
> unbuilt was that *"the change cannot be verified without producing a packaged build"*. One was
> produced, and every acceptance criterion was measured on it rather than argued. **§3's plan was
> wrong in a way that made the task cheaper**, and §2.1's warning was right. Write-up below.

---

## ✅ 0. What was built, and the measurement that changed the design

`electron-builder --dir` on `packages/noodl-editor`, `NodeGX.app` at `dist/mac-arm64/`.

### 0.1 🔴 The load-bearing measurement: `ELECTRON_RUN_AS_NODE` reads inside `app.asar`

§3 planned **two bundles and three data files copied into `extraResources`**, which is the sidecar
pattern and would have meant duplicating the **14MB viewer bundle**. Before writing any of it, four
things were measured against the **installed 0.1.7 app**:

| Probe | Plain `node` | The sidecar's actual runtime (`ELECTRON_RUN_AS_NODE=1`) |
|---|---|---|
| `readFileSync` inside `app.asar` | ❌ `ENOTDIR` | ✅ 3262 bytes |
| `existsSync` / `statSync` / `isFile` / `isDirectory` | ❌ | ✅ all true |
| **Run a main script** from inside an asar | ❌ | ✅ ran |
| `require('@scope/pkg')` from the asar's own `node_modules` | ❌ | ✅ resolved |

`runRenderReport` spawns with `process.execPath`, which on a packaged install **is the Electron
binary**. So the harness can live *inside* `app.asar` and read what the editor already ships.

🔴 **The plan's "three data files" was wrong in both directions, and only measuring the artefact
showed it.** Listing the shipped `app.asar` of the 0.1.7 dmg:

| §3 said | Actually |
|---|---|
| ship the viewer bundle | **already in the asar** — the whole 14MB `src/external/viewer/` directory, and the harness serves arbitrary URLs out of it, not just `noodl.viewer.js` |
| ship `ws` | **already in the asar** |
| — | `@nodegx/render-measure` **already in the asar** |
| ship `node-catalog.json` | ✅ genuinely absent |
| (`render-from-disk` "additionally reads" the enriched catalog) | ✅ genuinely absent |
| **not mentioned at all** | 🔴 **`DefaultTokens.ts`** — a *TypeScript source file*, read as text and regex-scraped for the `:root` block. Excluded by `!src/editor/src` |

So what ships is **four small scripts and three data files**, and nothing is duplicated.

### 0.1b ⚠️ A shipped artefact is evidence about the build that made it, not about the config

The 0.1.7 dmg carries **`@nodegx/render-measure` and no other `@nodegx` package** — not
`module-inject`, `kit-catalog` or `kit-scaffold`, all declared dependencies of `noodl-editor` since
2026-08-16, two days before that build. `render-from-disk.js` requires `module-inject`, so this
read as a packaging defect and an explicit `files` mapping was added for it.

🔴 **It was not a defect.** A fresh build ships **all five**, with no mapping — and ships them with
their `jest.config.js`, which the mapping's filter excluded, so the automatic collection was
demonstrably doing the work. The mapping was **removed and the build re-run to prove the removal**,
rather than left in as a rule that looks load-bearing and is not. What the 0.1.7 asar actually
records is the state of `node_modules` when *it* was built. ⚠️ The editor webpacks these packages,
so nothing but a non-bundled consumer — this harness — would ever have noticed either way.

### 0.2 What moved

| | |
|---|---|
| **`scripts/devtools/harness-paths.js`** (new) | Every data path, resolved for both layouts. Replaces `REPO = path.resolve(__dirname, '../..')`, which was right in a checkout and *silently plausible* anywhere else |
| `render-report.js`, `render-from-disk.js` | Rewired onto it; no `REPO` left in either |
| `package.json` `build.files` | Three from/to mappings → `render-harness/` and `render-harness/data/` **inside the asar** |
| `render.ts` `resolveRenderCli` | Two packaged candidates added |
| `render.ts` `spawnRender` | 🔴 sets `ELECTRON_RUN_AS_NODE=1` **explicitly** rather than inheriting it |
| Three refusal strings | §0.4 |

### 0.3 🔴 A missing catalog is now a named refusal, not a silent abstention

`visualTypeNames` and `contentBearingTypeNames` abstain to `null` when the catalog cannot be read,
and that is right *inside* the walk. But abstention with nothing said is how a packaged install
would call a page **clean using a strictly weaker rule than the checkout applied to the same
project** — a gate with a hole shaped like the defect. Both catalogs are now prerequisites, named
once in `checkPrerequisites`, where a refusal still means something.

### 0.4 The three refusals, and why the old ones pointed the wrong way

1. **No harness.** Said *"render_report needs the repo checkout … or run this server from a
   checkout"*. On a packaged install — the one place this is now most likely to be read — that
   **sent someone to clone a repository to fix a broken installation**, or more often a missing
   browser it never mentioned.
2. **`NODEGX_RENDER_CLI` points at nothing.** Offered *"the checkout beside this server"*, which on
   a packaged install does not exist.
3. **No Chrome.** Now names `CHROME_PATH` **and** `allow_unrendered` — §2.1's point that the
   ruling's honest version is *"F4 becomes answerable on a packaged install **that has Chrome on
   it**"*. The `create_lesson` F4 refusal names both too.

### 0.5 ⚠️ §2.1 stands, and §2.2 was not re-tested

Shipping the harness makes `allow_unrendered` **rare, not unnecessary**. That is a permanent
property of this design. §2.2's `ELECTRON_RUN_AS_NODE` finding was taken as read — and the same
variable turned out to be what makes this task work, from the other side.

---

## 1. The hole, restated in one paragraph

`create_lesson` answers F4 — *does the lesson's own solution actually draw anything, and is what it
drew broken?* — by spawning the render harness, `scripts/devtools/measure-from-disk.js`.
[`scripts/` is not in `packages/noodl-editor/package.json`'s `build.files`](../../../packages/noodl-editor/package.json),
so on a packaged install that file does not exist. The editor cannot answer F4 either — its engine-2
adapter drives the *running viewer* and cannot render a solution directory. So **for a user running
the packaged sidecar, F4 is checked by nobody**, and F4 is the class the prior arc pre-registered as
the one that would dominate.

Recorded in two halves across two slices before anyone joined them —
[RULINGS.md](RULINGS.md)'s sixth amendment, *"a hole recorded in two halves is not recorded"*.

## 2. 🔴 Two facts measured 2026-08-16, and the first qualifies the ruling

### 2.1 The harness needs a **system Chrome**, and shipping it does not ship one

[`render-report.js:695-730`](../../../scripts/devtools/render-report.js) probes
`/Applications/Google Chrome.app/…`, `/usr/bin/google-chrome`, `C:\Program Files\Google\Chrome\…`
and honours `CHROME_PATH`. With none of them it returns
*"No Chrome or Chromium binary found. Install Google Chrome, or set CHROME_PATH to one."*

> ⚠️ **So shipping the harness makes `allow_unrendered` RARE, not unnecessary.** The option as put to
> Richard read as "F4 becomes answerable on a packaged install"; the accurate version is "F4 becomes
> answerable on a packaged install **that has Chrome on it**". That is most desktops and it is not
> all of them, and the difference is the whole of what the second option was offering to say out
> loud. **Both halves of the ruling are probably wanted:** ship the harness *and* have the refusal
> name `CHROME_PATH` and `allow_unrendered` when no browser is found.

🔴 **The refusal text is wrong the moment the harness ships**, and it is wrong in the direction that
wastes a user's time. Today it reads *"render_report needs the repo checkout … or run this server
from a checkout"* ([`render.ts:200-208`](../../../packages/noodl-mcp/src/render.ts)). On a packaged
install with the harness present and no Chrome, that sentence sends someone to clone a repo to fix a
missing browser.

### 2.2 The sidecar cannot render through Electron instead — that route is closed by a ruling

Worth recording because it is the obvious alternative and it looks cheap. The MCP sidecar *is*
launched with the Electron binary, so "open a hidden `BrowserWindow` like the editor's engine-2
adapter does" seems to be sitting right there. It is not: the registration sets
**`ELECTRON_RUN_AS_NODE=1`**
([`mcpCommands.ts:222`](../../../packages/noodl-editor/src/editor/src/views/panels/SettingsPanel/sections/mcpCommands.ts#L222)),
which turns the binary into a plain Node process — `process.type` undefined, no GUI event loop, no
`BrowserWindow`. That variable is load-bearing and its header records the measurement: without it the
binary boots as a full Electron *app* with a dock icon and an event loop that never exits, and it
**still serves stdio correctly**, so a probe that forgets the variable looks like a pass.

**Therefore Chrome is the only route, and §2.1 is a permanent property of this design rather than a
gap to close later.**

## 3. What has to move

| # | Thing | Why it is not a one-liner |
|---|---|---|
| 1 | **Two bundles, not one** | `render-report.js` **spawns** `render-from-disk.js` as a child process (`RENDER_SCRIPT`, `child_process.spawn`), so the served-page half has to exist as its own file on disk. Bundling `measure-from-disk.js` alone produces something that runs and then cannot find its own server |
| 2 | **Three data files resolved for a packaged layout** | `render-report.js` computes `REPO` as `../..` from `__dirname` and hangs `VIEWER_BUNDLE` (`noodl-editor/src/external/viewer/noodl.viewer.js`), `CATALOG_JSON` (`noodl-types/src/node-catalog.json`) and `WS_MODULE` off it; `render-from-disk.js` additionally reads `node-catalog-enriched.json`. `ws` can be bundled in. The other three are data and need a resolution order that works from a checkout **and** from `Resources/` |
| 3 | **`extraResources` entries** | The sidecar already ships this way (`../noodl-mcp/dist/noodl-mcp.cjs` → `noodl-mcp/noodl-mcp.cjs`), beside `nodegx-backend/cli.js` and `nodegx-observe.cjs`. The harness follows the same pattern — **this is the part CN-001 made cheaper** by moving the pure half into `@nodegx/render-measure` |
| 4 | **`resolveRenderCli`'s probe list and both refusal strings** | [`render.ts:127-208`](../../../packages/noodl-mcp/src/render.ts). The packaged location joins the two checkout candidates, and the "not present" sentence stops being true. Add the no-Chrome case per §2.1 |

✅ **What is already done and must not be redone:** CN-001 extracted the pure half into
[`packages/nodegx-render-measure`](../../../packages/nodegx-render-measure/package.json), a no-build
workspace package. That is the structural half of this option and the reason it is M rather than L.

## 4. Acceptance

1. A **packaged** build's `Resources/` contains the harness and everything it reads, and
   `resolveRenderCli()` finds it with no `NODEGX_RENDER_CLI` set.
2. `create_lesson` on a packaged install, on a machine **with** Chrome, scores F4 and writes a bundle
   — and the same lesson with a deliberately blank solution is **refused** naming F4. 🔴 Both arms:
   a pass alone is indistinguishable from a gate that stopped running.
3. On a machine **without** Chrome, the refusal names `CHROME_PATH` and `allow_unrendered`, and does
   **not** tell the user to clone a repo.
4. The checkout route still works unchanged — `test:main`, `noodl-mcp` and the recorded render
   fixtures are the guard.

## ✅ 4b. Acceptance — measured on the packaged build, 2026-08-20

Driven through a **minimal MCP stdio client** against
`dist/mac-arm64/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs`, spawned exactly as the
editor registers it. Building that caller is the method this phase keeps returning to, and it is
what turned up the `find_tools` step below.

| AC | Reading |
|---|---|
| **1** — `Resources/` carries the harness and everything it reads; `resolveRenderCli()` finds it with no `NODEGX_RENDER_CLI` | ✅ `render_report` on a real 27-component project: **7368ms**, `182 shipped defaults + 23 project override(s)`, 87 texts, 12 images, 0 broken, repeater rows counted. The token line proves `DefaultTokens.ts` was read **out of the asar**; the list/placeholder findings prove both catalogs were |
| **2** — `create_lesson` scores F4 and writes; a blank solution is **refused naming F4**. 🔴 Both arms | ✅ **They disagree.** Draws → `{F1..F4: pass}`, `written: true`, bundle on disk (`lesson.json`, `solution/`, `components/`). Blank → `F4: 'fail'`, refused *"F4 (a solution that draws nothing) failed"*, and **the bundle directory was never created** |
| **3** — no-Chrome refusal names `CHROME_PATH` and `allow_unrendered`, and does not say clone a repo | ✅ Both sentences asserted. Paired with a **known-firing control**: the identical call finds Chrome with `fs` untouched and does not with the candidates stubbed — zero reads the same whether the probe refused or never ran |
| **4** — the checkout route still works unchanged | ✅ See §4c |

### 🔴 Two things this run found that no unit test would have

1. **`NODEGX_RENDER_DISABLED=1` does not disable the lesson render.** It was the obvious way to
   reach "F4 unanswerable", and the arm came back `F4: 'pass'`. `automaticRenderDisabled()` is
   consulted by **`planTools` only** — the lesson path never asks. The render had genuinely run and
   F4 honestly passed, so this is **not a gate reporting a pass it did not earn**; but a session
   reaching for that variable to prove a refusal would have measured nothing and said it had.
   The arm was re-run by making the harness genuinely unresolvable.
2. **A refusal writes nothing — re-checked, because the first check was wrong.** `ls` on the bundle
   directory showed files beside `written: false`. They were **left by an earlier arm that reused
   the directory name**. Against a fresh directory the refusal creates nothing at all, as
   `bundleWriter`'s header promises. Recorded because the false reading was mine, and a reused
   fixture directory is how a passing guarantee gets reported as broken.

### ⚠️ Two notes for whoever runs this next

- **Lesson tools are deferred.** `create_lesson` answers `MCP error -32602: Tool create_lesson
  disabled` until `find_tools { group: 'lesson' }` reveals it. That is AWP-006's surface budget
  working as designed, and it is a step every caller of this tool needs.
- The build was `--dir` and **unsigned**, and reused the renderer/main bundles on disk (2026-08-18).
  Nothing on the harness path goes through them, but a release build is a different artefact.

## ✅ 4c. Gate readings — 2026-08-20, session 45

All readings below are against the **final** source — the sidecar and the package were rebuilt after
the last edit, and all three acceptance arms were re-driven on that artefact rather than on the
earlier one they were first measured against.

| Gate | Reading |
|---|---|
| `npx tsc -p packages/noodl-mcp --noEmit` | ✅ **0 errors**, measured without a pipe |
| `packages/noodl-mcp` jest | ✅ **54 files / 644 tests / 0 failures** — includes `renderReportModule` and `renderTools`, which exercise the resolution this task rewrote |
| `npm run test:main` | ✅ **271 suites / 4388 tests / 0 failures** — up one suite and 7 tests, which are §4d's |
| `tests-unit/uni-012` | ✅ **7 specs**, and proved to fail on three known breakages — §4d |
| Checkout render, unchanged code path | ✅ Real project, 8304ms, findings identical in shape to before the change |
| Packaged render, final artefact | ✅ 7272ms, `182 shipped defaults + 23 project override(s)`, 87 texts / 12 images |

⚠️ **`noodl-mcp` failed 2 of 644 on the first run of that final pass, and they were flakes.** Both
were real-backend provisioning specs — `provision.test.ts` and `projectOwnsBackend.test.ts`, which
start actual backends and bind real ports — and **neither touches the render path**. They passed in
isolation *and* on a full re-run of all 54 files. Recorded rather than quietly re-run, because "I
re-ran it and it was fine" is the sentence that hides a real intermittent: the honest reading is
that this suite has two specs that can flake when the machine has just been doing something else,
and this session had just packaged an Electron app and driven four MCP servers.

## ✅ 4d. The regression guard, and the one thing it is allowed to claim

[`tests-unit/uni-012/harness-packaging.test.ts`](../../../packages/noodl-editor/tests-unit/uni-012/harness-packaging.test.ts)
— 7 specs in `test:main`.

§5 is right that a spec asserting *"`resolveRenderCli` prefers `Resources/…`"* would pass against a
layout that never exists, so this asserts **only what is checkable without a build and actually
rots**: every source path the packaging names still exists, and the resolver still knows both
layouts. The packaged layout itself is verified by §4b's build and drive, and the file says so.

🔴 **The failure it exists for is silent in the direction of a pass.** The mappings name filenames.
Rename `node-catalog-enriched.json`, move `DefaultTokens.ts` out of `StyleTokensModel/`, or drop a
script from the filter, and **electron-builder copies nothing and exits 0**. The packaged harness
then scores F4 with a *strictly weaker rule than the checkout applies to the same project* — a
lesson certified against a page the checkout would have judged differently, every gate green.

✅ **Proved to discriminate rather than assumed to.** The assertion was run over the real config and
three known-broken variants, and they disagree:

| Population | Reading |
|---|---|
| the real config | **PASS** |
| enriched catalog renamed upstream | **FAIL** — *filter matches nothing → node-catalog-enriched-v2.json* |
| `DefaultTokens.ts` moved to another directory | **FAIL** — *from missing* |
| a harness script renamed | **FAIL** — *filter matches nothing* |

⚠️ It also asserts **the mappings exist at all**, because a guard that iterates a list can be
silenced by deleting the list — it would then pass hardest with the feature gone.

### 🔴 The near-miss in the guard itself, kept because it is the general case

The natural assertion for *"the resolver knows the packaged layout"* is **a candidate mentions
`render-harness`**. It was written, and it **failed**. The packaged candidates are built from the
module's own `__dirname` — which *is* `scripts/devtools` in a checkout and only becomes
`render-harness` once packaged, so that string can never appear while the test runs. The property
that actually makes relocation work is that the second candidate is **anchored to wherever the
module lives** rather than to the repo root, and that is what is asserted now.

⚠️ A second near-miss in the same file: `probed` stops at the first hit, so in a checkout it holds
**one** entry. A check reading `probed` to prove both layouts are covered would pass a resolver that
had never heard of the second one. `candidates` was added to the resolver for that reason and the
two fields are deliberately separate — on a *failure* they are identical, which is why the refusal
messages print `probed`.

## 5. 🔴 Why this was scoped and not built on 2026-08-16

Every part of it is verifiable **only** against a packaged build. A change to `build.files` /
`extraResources` and to a path-resolution order has no honest unit test: a spec asserting
"`resolveRenderCli` prefers `Resources/…`" passes against a layout that never exists, which is a
check written from the same assumption as the code it checks. This phase's standing method is to
**build the caller**, and here the caller is `electron-builder`.

⚠️ **And the session that does it should budget for the run**, not discover it: a full package on
macOS is minutes, and it wants a checkout nobody else is mid-drive on — 15 peer sessions were live on
2026-08-16.

## Not in scope

Shipping a browser (Playwright's Chromium download, or a bundled Chromium) — that is a large
dependency and a licensing question, and §2.1's honest refusal is the cheap answer to the same
problem. Rendering pages other than the Router's `startPage`: that is
[UNI-010 §8.2](UNI-010-CRITERION-3-RUN.md) and belongs to phase 69's CN-001, and it is a **different
hole in the same class** — this task makes F4 *run*, CN-001 makes it *see*.
