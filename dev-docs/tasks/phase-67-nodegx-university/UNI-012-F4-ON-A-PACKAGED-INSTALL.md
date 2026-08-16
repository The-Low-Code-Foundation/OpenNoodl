# UNI-012 — F4 on a packaged install: ship the render harness with the sidecar

**Surface:** editor packaging + MCP · **Tier:** falls out of UNI-010 · **Effort:** M
· ✅ **RULED 2026-08-16 by Richard** — *ship the harness with the sidecar*, the first of the two
options UNI-010 put to him. This file is the scoping that ruling asked for, plus **two facts measured
on 2026-08-16 that change what the option delivers**, neither of which was known when it was put to
him.

> 🔴 **Nothing here is built.** The ruling was taken and the work was scoped and not started, for a
> reason stated plainly rather than buried: **the change cannot be verified without producing a
> packaged build**, and a shipping claim nobody exercised is exactly the artifact this phase has
> found wrong four times by building the caller. See §5.

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
