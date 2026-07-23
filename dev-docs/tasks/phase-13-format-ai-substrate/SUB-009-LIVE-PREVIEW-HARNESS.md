# SUB-009: Standalone Live-Preview Harness

> **Status: ✅ Complete — 2026-07-23.** Shipped as `packages/noodl-preview`
> (`npm run preview -- <dir>`). See [Outcome](#outcome) at the bottom for what was
> built, what the spec got wrong about the export path, and what was deliberately
> left out.

## Metadata

| Field | Value |
|-------|-------|
| **ID** | SUB-009 |
| **Phase** | Phase 13 — Format & AI Substrate (Revival Track A) |
| **Type** | 🔬 **Spike / prototype** — optional, de-risking; not one of the phase's eight substrate pillars |
| **Priority** | 🟡 Medium — unblocks the SUB-010 demo; validates the "see it live outside the editor" claim |
| **Difficulty** | 🟡 Medium |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | SUB-001 (v2 read), SUB-006 (validator, for the error overlay). No dependency on SUB-008. |
| **Branch** | `task/sub-009-live-preview-harness` |
| **Recommended executor** | 🟠 **Opus 4.8** — composition of engines that already exist (io/, exporter, deploy template, viewer-react `renderDeployed`) against a clear target; the only real design call is reload strategy. Individual pieces drop to 🟢 Sonnet once the shape is fixed. |

## Objective

Render a running preview of a v2 project **without the Electron editor**, and refresh it automatically when the project files on disk change. This is the visible half of the "an agent edits the project, you watch the result" experience.

## Background

The strategic thesis (see the viability report §2 and SUB-008) is that Noodl's differentiator is a **legible artifact an external agent can author and a human can see and own**. The "author" half has a substrate (catalog + validator + io engines). The "see" half has a gap: the editor's live preview is driven by the in-memory `ProjectModel` streamed over a WebSocket (`ViewerConnection.ts` → `packages/noodl-runtime/src/editorconnection.js`), and **there is no watcher on the project files** — a `grep` for `fs.watch`/`chokidar`/`watchFile` finds only the Monaco code editor, nothing on `project.json` or the v2 directory. So if an external tool (an MCP server, a script, Claude via SUB-008) writes v2 files, nothing renders them live.

The runtime, however, is strongly decoupled from the editor. `packages/noodl-viewer-react/noodl-viewer-react.js` exposes three independent entry points — `render()` (editor/WS mode), `renderDeployed()` (standalone, project JSON inlined, no editor, no WebSocket), and `ssrSetupRuntime()`. `packages/noodl-runtime/src` has zero React and zero editor imports. A standalone preview is therefore a matter of *feeding an exported project into `renderDeployed` and re-feeding it on change* — not new runtime work.

This harness fills the gap with the least machinery that is still honest: watch → re-export → reload.

## Current State

- **No file watcher** on projects anywhere in the codebase.
- Live preview today is editor-only: `packages/noodl-editor/src/editor/src/ViewerConnection.ts` exports incremental diffs from `ProjectModel` over `ws://localhost:8574`; the viewer applies them via `editorconnection.js`/`editormodeleventshandler.js`. Useless to an external file-based writer.
- The pieces a standalone preview needs already exist and are Electron-free:
  - Headless load: `packages/noodl-editor/src/editor/src/validation/loadV2Project.ts` (`loadProject` accepts a v2 dir *or* a legacy file).
  - Project → JSON: `packages/noodl-editor/src/editor/src/utils/exporter/` (`Exporter.exportToJSON`), also used by the deploy path.
  - Static deploy reference: `packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts` (`deployToFolder` writes `noodl_bundles/<id>.json` + an index page).
  - Standalone runtime entry: `renderDeployed(root, __noodl_modules, projectData)` in `noodl-viewer-react.js:57`; the deployed HTML/JS template lives at `packages/noodl-editor/src/external/deploy/` (`window.projectData = {{#export#}}`).
  - Validator (for an error overlay): `scripts/validate-project.ts --json`, or the library at `.../validation`.

## Desired State

A command — `npm run preview -- <project-dir>` (or `npx noodl-preview <dir>`) — that:

1. Loads the v2 project headlessly and serves a browser preview at `http://localhost:<port>` using the deployed runtime (`renderDeployed`), no editor process involved.
2. Watches the project directory; on any change, re-exports and reloads the preview automatically (sub-second for a small project).
3. On a change that fails semantic validation, shows the SUB-006 diagnostics as an overlay **instead of** rendering a broken graph — so the agent's mid-edit invalid states are legible, not a blank screen.
4. Runs fully decoupled from the Electron editor, and does not require a GitHub remote or any cloud service.

## Scope

### In Scope
- [x] CLI entry that takes a project directory (v2 dir or legacy `project.json`) and a port
- [x] Headless export pipeline: `loadProject` → `Exporter.exportToJSON` → serve, reusing the existing engines (do **not** reimplement export)
- [x] A small static/dev server serving the deployed runtime bundle + project data (model the bundle layout on `deployer.ts`)
- [x] File watching (`chokidar`) on the project dir with debounce; ignore backup/temp/`.git` paths
- [x] Browser live-reload on change (injected WebSocket or SSE; a full reload is acceptable for the spike)
- [x] Validation-gated render: run SUB-006 on each change; on error, overlay diagnostics rather than render
- [x] README with usage and the one-line "point it at a folder an agent is editing"

### Out of Scope
- Incremental hot-update (diff-based, no full reload) — this is the Option B upgrade below; not needed to prove the experience
- Editing *through* the preview (read-only render)
- Driving the running **editor's** preview from disk (that is the WS-protocol path, deliberately avoided here)
- Packaging/publishing to npm (a repo script is enough for the spike; SUB-010 decides distribution)
- Auth, multi-project, hosting

## Technical Approach

### New Files to Create

| File | Purpose |
|------|---------|
| `scripts/preview-project.ts` (or `packages/noodl-preview/`) | CLI: load → export → serve → watch → reload |
| `scripts/preview/server.ts` | Static + live-reload server (bundle, project data, reload channel) |
| `scripts/preview/README.md` | Usage; the "agent edits a folder, you watch" recipe |

### Design notes — reload strategy

**Recommended (Option A, spike-appropriate): watch → re-export → full reload.** On a debounced file-change event: `loadProject(dir)` → validate → if clean, `Exporter.exportToJSON` → push the fresh project data to the browser → the page re-mounts `renderDeployed`. This is a handful of composition glue over engines that already exist and is easily good enough to demo "the page just changed." Reuse `deployer.ts`'s bundle layout so the served assets match a real deploy.

**Upgrade path (Option B, not this task): incremental hot-update.** Instead of a full reload, act as an `editor`-role client to the existing viewer server (`packages/noodl-editor/src/main/src/web-server.js`, port 8574) and emit the same `export`/`modelUpdate` messages `ViewerConnection.ts` sends, computing the diff from before/after exports. This gets true in-place updates but reimplements the diff protocol — worth it only once the experience has proven it wants proving. Note it in the README; do not build it here.

**Validation overlay is not decoration.** An agent writes files mid-edit; some snapshots will be invalid. Rendering a blank or half-broken graph reads as "the tool is broken." Catching the invalid state and showing "3 diagnostics — waiting for a valid graph" makes the *loop* legible and is the direct payoff of SUB-006 on the viewing side.

## Implementation Steps

1. **Static render first, no watching** — load a fixture v2 project, export it, serve `renderDeployed` at a port, confirm it renders in a plain browser tab. This proves the decoupled-runtime claim end to end.
2. **Add watching + full reload** (Option A) with debounce and a live-reload channel.
3. **Add the validation gate + overlay** using SUB-006.
4. **Point it at a directory a script is mutating** (simulate the agent) and confirm edits appear within ~1s.
5. **README + a recorded 20-second clip** of a file edit reflecting live.

## Testing Plan

- Renders a real corpus v2 project standalone (no editor), matching how it renders when deployed via `deployToFolder`.
- A programmatic edit to a component's `nodes.json`/`connections.json` reflects in the browser within the debounce window.
- An intentionally invalid edit (bad port on a static node) shows the diagnostic overlay and does **not** render a broken graph; the next valid edit recovers.
- Runs with the Electron editor **closed**; also runs harmlessly with it open (read-only; no lock contention since it never writes).
- Legacy `project.json` input path also renders (via `loadProject`'s legacy branch).

## Success Criteria

- [x] `preview <dir>` renders a v2 project in a browser with no editor process
- [x] File changes reload the preview automatically, sub-second on a small project
- [x] Invalid intermediate states show diagnostics, not a broken render
- [x] Zero new runtime code — built by composing io/, exporter, the deploy template, and `renderDeployed`
- [x] README recipe: "point this at the folder your agent is editing"

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Full-reload feels janky and undersells the experience | Acceptable for the spike; note Option B (incremental) as the upgrade and judge from the SUB-010 demo whether it's worth it |
| Export/runtime coupling turns out to need editor-only bits | Prove step 1 (static render) before anything else; if `renderDeployed` needs an asset the deploy path supplies, mirror `deployer.ts` exactly |
| Watching fires mid-write and loads a torn file | Debounce; on parse/validation failure keep the last good render and show the overlay — never crash the preview |
| Scope creep into a real product preview | Hard cap at the spike's job: render + reload + overlay. Distribution and polish belong to whoever productizes it after SUB-010. |

## References

- [SUB-008 — MCP Server](./SUB-008-MCP-SERVER.md) (the writer this preview makes visible)
- [SUB-010 — External Authoring Demo](./SUB-010-EXTERNAL-AUTHORING-DEMO.md) (consumes this harness)
- `packages/noodl-viewer-react/noodl-viewer-react.js` — `renderDeployed` entry (line 57)
- `packages/noodl-editor/src/external/deploy/` — deployed runtime template
- `packages/noodl-editor/src/editor/src/utils/compilation/build/deployer.ts` — `deployToFolder` bundle layout
- `packages/noodl-editor/src/editor/src/validation/loadV2Project.ts` — headless project load
- `packages/noodl-editor/src/editor/src/utils/exporter/` — `Exporter.exportToJSON`
- `packages/noodl-editor/src/editor/src/ViewerConnection.ts` — the editor's WS path (Option B reference)

## Checklist

- [x] Static `renderDeployed` of a fixture project in a plain browser
- [x] Watch + debounced full reload
- [x] SUB-006 validation gate + diagnostics overlay
- [x] Reflects an external script's edits within ~1s
- [x] README recipe — **not** a recorded clip; verification was headless-Chrome
      screenshots at each state (render → edit → overlay → recovery). A screen
      recording belongs to SUB-010, which is where a demo artifact is the point.
- [x] CHANGELOG — recorded in this phase's [PROGRESS.md](./PROGRESS.md), the
      convention SUB-001..008 followed (no per-task CHANGELOG.md in phase 13)

---

## Outcome

**Shipped:** `packages/noodl-preview` (`@noodl/preview`), run as
`npm run preview -- <project-dir> [--open]`. ~900 lines across seven modules plus
a 14-spec end-to-end suite and two fixtures (v2 and legacy).

### The one thing the spec got wrong

> *"Headless load: `loadV2Project.ts` (`loadProject` …) → `Exporter.exportToJSON`"*

These do not compose. `loadProject` returns the validator's **normalized** model
(ids, types, port *names*) — it has no parameters and cannot be rendered.
`Exporter.exportToJSON` needs a full `ProjectModel` plus a populated
`NodeLibrary`, both of which the "Current State" section implicitly assumed were
reachable headlessly and neither of which the validator's loader produces.

The risk row *"Export/runtime coupling turns out to need editor-only bits"* was
therefore the real question, and it was settled first, before any code: a throwaway
esbuild probe proved `ProjectModel` + `NodeLibrary` + `utils/exporter` +
`HtmlProcessor` all run in plain Node behind four shims (platform binding,
`bugtracker` stub, DOM shim shared with the node-catalog generator, and a
`NodeLibrary` fed from `NoodlRuntime.getNodeLibrary()` — the same JSON the editor
receives over the WebSocket). So the real pipeline is:

```
v2 dir ──ProjectImporter──> legacy project object ──> SUB-006 gate ──> ProjectModel ──> Exporter ──> serve
```

`ProjectImporter` (io/, pure) does the v2→legacy step the spec expected
`loadProject` to do, and the export path is the editor's own, unmodified. "Zero
new runtime code" holds, and more strongly than planned — the served page is the
real deploy template calling `renderDeployed`, with `useBundles`/`useBundleHashes`
on, so `/noodl_bundles/<id>.json` matches what `deployToFolder` writes.

### Two things found on the way

- **Projects authored from outside often have no `rootNodeId`.** The MCP server's
  own fixture does not, and `exportToJSON` returns `undefined` without a root —
  a blank page with no explanation. The loader now falls back to the editor's own
  predicate (`setRootComponent` → first node with `allowAsExportRoot`) over
  `/%rootcomponent`, `/App`, then registry order, and *says so* in the CLI output
  and `/__preview/state`. Related to the earlier new-project-no-Home fix.
- **A bogus *parameter* is not a diagnostic.** SUB-006's port rules key on
  connections, not parameter keys, so the first "invalid edit" test passed
  validation and rendered — correctly. The gate is exercised with a dangling
  connection instead.

### Verified, in a real browser (headless Chrome, editor closed)

| | |
|---|---|
| Standalone render | "Hello World!" painted from a v2 dir, console clean, no editor process |
| Live edit | a script rewriting `nodes.json` appeared in the browser inside 1s (rebuilds 3–10 ms; wall clock is debounce + reload) |
| Invalid edit | a dangling connection raised the diagnostics overlay *over* the previous render; the broken graph never reached the runtime |
| Recovery | removing the connection cleared the overlay and re-rendered |

**Real corpus project** (`big-merge-test-mine`, 176 components, legacy format):
loads, validates (12 warnings, 0 errors) and exports in **733 ms** — but does not
paint, because the project's own bundled module `noodl_modules/se-topp-fovea`
calls `Noodl.Collection.apply(this, arguments)` (ES5 Backbone style) against
today's `class Collection extends Array` in `noodl-runtime/src/collection.js`.
A pre-existing module/runtime incompatibility in the fixture — a real
`deployToFolder` deploy fails identically — not a harness fault, and arguably the
harness earning its keep: the full path (module injection → asset serving →
runtime setup) ran and the failure surfaced exactly where a real one would.
Worth a look if that corpus project is ever wanted as a demo target.

`npm --prefix packages/noodl-preview test` — 14/14 — drives the **built CLI** over
HTTP rather than the TS sources, because the risk in this package is the bundle
(platform binding, stubs, headless register load), which source-level tests would
not touch.

### Deliberately not built

Option B (incremental hot-update via the 8574 editor protocol) — noted in the
package README as the upgrade path, to be judged from the SUB-010 demo. Also out:
editing through the preview, packaging to npm, auth/multi-project/hosting.

### Prerequisite worth knowing

The harness serves `packages/noodl-editor/src/external/deploy/`, which is a
gitignored build artifact. If it is absent the CLI fails with the fix
(`npm run build:editor:_viewer`) rather than serving a broken page.
