# CN-013 — the cloud half, built and verified in **both build shapes**

**s25, 2026-08-18.** D18 ruled the cloud loader IN for pure-JS logic kit nodes and bound whoever
built it to *"verify preview AND production."* [cn-013-cloud-premise.md](cn-013-cloud-premise.md)
shows those two contexts are one; the honest replacement is the two **build shapes** of that one
context, and both are below.

## What was built

| Piece | Where |
|---|---|
| the loader — evaluate a kit's entry script, register its logic nodes, name every failure | `noodl-viewer-cloud/src/kitModules.ts` |
| the call site — kits register before `setData`, result kept on `kitLoads` | `noodl-viewer-cloud/src/index.ts` |
| the `runtimes` cloud predicate + the disk read | `@nodegx/module-inject` — `moduleRunsInCloud`, `readCloudModuleSources` |
| the bundle carries the kits | `noodl-editor/…/exporter/cloudFunctions.ts` — `exportCloudFunctionsWithKits` |
| the backend says what happened, at load | `nodegx-backend/…/WorkflowRunner.ts` — `reportKitLoad` |

**Opt-in by `runtimes`.** A kit reaches the cloud only if its manifest says `"cloud"`. Two reasons:
a kit is third-party code in the service process and D18 explicitly does not re-open D6; and it
makes `manifest.runtimes` mean something in the direction CN-012's M4b measured as broken — a kit
declaring `["cloud"]` used to be filtered out of the page and loaded by nothing else, so **the
field's only positive value made the kit run nowhere.** Kits that did not opt in still travel **by
name, without source**, so the runtime can say *"that kit exists and is not cloud-enabled"*.

## Shape 1 — source, via the `@cloud-runtime` alias

`noodl-viewer-cloud` **189 / 9 suites** (17 new across two CN-013 files) ·
`nodegx-backend` **1090 / 101 suites** (5 new, real HTTP through `BackendService`) ·
`@nodegx/module-inject` **21** · editor `test:main` **3752 / 244** · `noodl-viewer-react` **913 / 72**
(3 new) · `typecheck:cloud` **0** · `typecheck:editor` **0** · `typecheck:mcp` **0**.

**Mutations, 5 of 5 killed** — name adoption dropped · the `require` shim removed · `reactNodes`
passed through · the per-runner load memory removed · registration moved after `setData`.

🔴 **The fifth one survived first, and the comment it disproved was mine.** *"Kits register before
`setData`, and the order is the whole feature — `importEditorData` resolves node types as it
imports"* is **false for this class**: `CloudRunner` is built with `dontCreateRootComponent: true`
and creates its graph per request in `run()`, long after `setData` returns. What the order actually
buys is `setup` — `setData` loops `noodlModules` and calls each module's `setup` once, so a kit
registered afterwards silently never gets one. A row now pins that, and the comment says the true
thing.

## Shape 2 — the esbuild bundle, over real HTTP

🔴 Built to a **scratch** outfile, never over `packages/nodegx-backend/dist/cli.js` — the editor
spawns that file (`ServiceSupervisor.js:43-80`) and a peer's backend may start from it at any moment.

| Arm | Result |
|---|---|
| bundled `cli.js serve`, bundle **with** `modules` (the real `tally-kit` fixture) | ✅ `HTTP 200 {"result":{"total":7}}` |
| 🔴 control: **same graph, `modules` deleted, nothing else changed** | ⏱ `HTTP 504 function/timeout` after 30 s |
| the log, at load | `registered 1 cloud kit(s) — Tally Kit (3 node type(s))` |
| a kit calling `require('stripe')` | `warn` naming the limit: *"no node_modules … Server-side SDKs (Stripe, AWS, Anthropic) are not supported here"* |
| a kit with `runtimes: ["browser"]` | *"is not available to cloud functions … Add \"cloud\" to that list"* |

**`7`, not `1` and not `0`** — the `step` parameter reached the kit node and its `add` ran once, so
the body is evidence about the node rather than about the wiring. The control is the same bundle
with one field removed, so the pair varies exactly one thing.

## ⚠️ Residuals

- **A project with no kits at all still gets a bare 504.** Correct — there is no kit to name — but
  it means the improved diagnostic is only reachable once `modules` is in the bundle.
- **A `require` reached from inside a node's *method*** throws at run time with the same sentence,
  but lands in that request's error path rather than the load report. Not covered by a row.
- **`kitLoads` accumulates per runner and nothing prunes it.** One entry per bundle load; a backend
  serving many projects across many hot deploys grows it slowly. Not a leak worth a mechanism yet.
- 🔴 **The deploy-time half is not built.** The editor could name, *before* pushing, a cloud
  function whose graph uses a node type belonging to a kit that has not opted in — the node library
  already stamps `module` on every kit node (CN-003). That turns a 504 into a warning in the editor.
  **Wants a slice number.**
