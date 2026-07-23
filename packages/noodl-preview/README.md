# @noodl/preview — standalone live-preview harness

Render a NodeGX (OpenNoodl) project in a browser **with no editor process**, and
reload it automatically when the files on disk change.

```bash
npm run preview -- ./my-project --open
```

That is the whole recipe: **point it at the folder your agent is editing.** An
MCP server, a script, or Claude writes v2 files; this watches them and the page
updates. It is the "see it" half of the AI-authoring loop — the editor's own
live preview is driven by its in-memory model over a WebSocket and cannot see
anything written to disk from outside.

---

## Usage

```
noodl-preview <project-dir> [options]

  --port <n>        Port to listen on (default 8575, 0 for any free port)
  --host <addr>     Address to bind (default 127.0.0.1)
  --debounce <ms>   Quiet period before rebuilding after a change (default 120)
  --no-watch        Render once and serve; do not watch
  --open            Open the preview in the default browser
```

Accepts a **v2 project directory** (`nodegx.project.json` + `components/`) or a
**legacy `project.json`** (the directory or the file).

From the repo root, `npm run preview -- <dir>` builds the harness first, so it is
always in step with the sources. Direct invocation is
`node packages/noodl-preview/bin/noodl-preview.js <dir>`.

### Prerequisites

The deployed viewer runtime (`packages/noodl-editor/src/external/deploy/`) is a
build artifact and is not committed. If it is missing, the CLI says so and how to
fix it:

```bash
npm run build:editor:_viewer
```

---

## What it does

```
project dir ──watch──> read ──> SUB-006 validate ──> ProjectModel ──> Exporter ──> serve ──SSE──> browser
                                       │                                                            │
                                       └── errors ────────────────────────────────────────> diagnostics overlay
```

- **Renders through the real deploy path.** The page it serves is the deployed
  runtime template (`external/deploy/index.html` + `noodl.deploy.js`) calling
  `renderDeployed`, fed by `Exporter.exportToJSON` with bundles and hashes on —
  the same call `deployToFolder` makes. Component bundles are served from
  `/noodl_bundles/<id>.json` exactly as a real deploy lays them out; project
  assets are served from the project folder. Nothing about the export is
  re-implemented here.
- **Validates before it renders.** Every snapshot goes through the SUB-006
  semantic validator first. On errors the preview keeps the *last good render*
  and puts the diagnostics on top of it, so a half-written edit reads as "the
  edit isn't finished" instead of "the tool is broken". Warnings never block.
- **Reloads on change.** Chokidar watches the directory with a debounce (one
  rebuild per burst of writes), and an injected SSE client reloads the page.
- **Touches nothing.** The harness only ever reads. It is safe to run against a
  project the editor has open — it binds port 8575, clear of the editor's viewer
  server on 8574.

---

## Verified behaviour

Checked in headless Chrome against the `tests/fixtures/hello-world` project with
the Electron editor closed:

| | |
|---|---|
| Standalone render | "Hello World!" painted, console clean, no editor process |
| Live edit | a script rewriting `nodes.json` showed up in the browser inside 1s (rebuilds measured at 3–10 ms; the wall-clock cost is the debounce plus a page reload) |
| Invalid edit | a dangling connection produced the diagnostics overlay over the previous render — the broken graph never reached the runtime |
| Recovery | removing the bad connection cleared the overlay and re-rendered |

Also run against the real 176-component corpus project
(`packages/noodl-editor/tests/testfs/big-merge-test-mine`, legacy format): it
loads, validates (12 warnings, 0 errors) and exports in **733 ms**, and the page
does *not* paint — because one of the project's own bundled modules
(`noodl_modules/se-topp-fovea`) calls `Noodl.Collection.apply(this, arguments)`,
the ES5 Backbone pattern, against today's `class Collection extends Array` in
`noodl-runtime/src/collection.js`. That is a pre-existing module/runtime
incompatibility in the fixture — a real `deployToFolder` deploy of that project
fails identically — not a harness fault. It is recorded here because it is what
the harness is *for*: the whole pipeline (module injection, asset serving,
runtime setup) ran, and the failure surfaced where a real one would.

`npm --prefix packages/noodl-preview test` runs the same paths over HTTP against
the built CLI (14 specs). They drive `dist/noodl-preview.cjs` rather than the
TypeScript sources on purpose: the risk in this package is the *bundle* — the
platform binding, module stubs, and headless node-register load — and testing the
sources would exercise none of it.

---

## How it works headlessly

The interesting part is that the editor's export pipeline runs in plain Node at
all. `Exporter.exportToJSON` needs a `ProjectModel` and a populated
`NodeLibrary`, both of which normally only exist inside the running Electron app.
Four shims are enough (all in `build.mjs` and `src/headless.ts`):

1. `@noodl/platform` bound to `@noodl/platform-node`, imported before any editor
   module — several read `platform.getUserDataPath()` at module scope.
2. `bugtracker` stubbed; at import time it hijacks `console.log` and writes to a
   log file, which a CLI must not do.
3. The browser DOM globals the viewer's node modules touch at module scope
   (shared with the node-catalog generator's `dom-shim.js`).
4. `NodeLibrary` fed from `NoodlRuntime.getNodeLibrary()` — the same node-library
   JSON the editor receives over the WebSocket, produced in-process instead.

No node metadata, export logic, or runtime behaviour is duplicated.

---

## Upgrade path: incremental hot-update

This harness does a **full page reload** on every change. That is deliberate for
a spike — it is a small amount of glue over engines that already exist, and it is
enough to demonstrate the loop.

The upgrade, when the experience proves it wants it, is to act as an `editor`
-role client of the existing viewer server (`packages/noodl-editor/src/main/src/
web-server.js`, port 8574) and emit the same `export`/`modelUpdate` messages
`ViewerConnection.ts` sends, computing the diff from before/after exports. That
buys true in-place updates at the cost of re-implementing the diff protocol —
worth it only once the payoff is proven. Deliberately not built here.

---

## Layout

| File | Purpose |
|------|---------|
| `src/cli.ts` | Argument parsing and the watch → rebuild → serve loop |
| `src/headless.ts` | Platform binding + node-library bootstrap |
| `src/loader.ts` | Project dir → validated export JSON, bundles and HTML |
| `src/validate.ts` | The SUB-006 gate |
| `src/server.ts` | Static + generated routes, SSE channel |
| `src/client.ts` | The injected browser script and diagnostics overlay |
| `src/watcher.ts` | Debounced chokidar watch |

Task spec: `dev-docs/tasks/phase-13-format-ai-substrate/SUB-009-LIVE-PREVIEW-HARNESS.md`
