# RUN-001 Assessment — what the spec got wrong, and the corrected plan

**Date:** 2026-07-24
**Author:** re-scope slice, before any migration work
**Verdict:** the task is real and worth doing, but the spec's Current State is wrong on
every load-bearing fact. The work is **substantially smaller** than the 4–6-week estimate
assumed, and the hard problem is not the one the spec names.

## 1. The spec's premise vs. reality

| Spec claim | Reality (verified 2026-07-24) |
|---|---|
| Runtime "pinned to React 17" | Runtime ships **vendored React 18.3.1 UMD** files (`static/shared/react*.production.min.js`). There is **no react npm dependency** in `noodl-viewer-react` at all — webpack maps `react`/`react-dom` to the globals loaded by `<script>` tags (`webpack-configs/webpack.common.js:6-9`). |
| Design doc "exists and is unstarted" | Upstream commit `1477a29` (Dec 2025, the second commit in this repo) **already started the migration**: vendored bundles bumped 17→18.3.1, entry converted to `createRoot`/`hydrateRoot`, binding-hub `findDOMNode` replaced with ref-captured `_domElement`, `Drag`/`Group` `UNSAFE_componentWillReceiveProps` → `componentDidUpdate`. Half-done, never validated, never documented. |
| "largely untyped JavaScript (131 `.js` files)" | PLAT-003 slices 1–8 typed the binding hub (`react-component-node.ts`) and **all of `src/nodes/`**. 43 `.js` files remain, none of them node code (mostly `nodes-deprecated/` + small utilities). |
| Migration blocked on lifecycle/refs/StrictMode work | The viewer source is **already React 19-clean** on every scannable axis: zero `UNSAFE_` lifecycles, zero string refs, zero legacy context, zero `defaultProps`, zero `prop-types`. Exactly **one live `findDOMNode`** remains (`src/highlighter.js:58`; the editor-only highlight overlay). |
| Dual runtime = "React 17 and React 19" | Deployed apps freeze their React copy at deploy time, so nobody is served old React by *us* — redeploying is what changes an app. The shipped baseline today is 18.3.1. Dual runtime therefore means **18.3.1 (current, unchanged) vs 19** — React 17 does not need resurrecting. |

The design doc (`dev-docs/future-projects/PHASE-RUNTIME-REACT-19-MIGRATION.md`, Dec 2025)
remains useful for its UX (deploy-dialog version selector, migration-report panel) and its
detection-pattern catalogue, but its build plan silently assumes React 19 still ships UMD
builds (`externals: { react: 'React' }` in its proposed React 19 webpack config). It does not.

## 2. The actual hard problem: React 19 ships no UMD build

The entire delivery architecture — `<script src="react.production.min.js">` + webpack
`externals` + the `window.React` contract that external Noodl modules compile against —
depends on React being loadable as a browser global. React 19 dropped UMD builds upstream.

### Options considered

1. **Self-built global bundles (chosen).** Bundle `react` / `react-dom` + `react-dom/client`
   from npm into script-tag-loadable IIFEs that assign `window.React` / `window.ReactDOM`.
   Everything downstream — index.html script tags, webpack externals, external-module
   contract, deploy file copying — stays byte-for-byte the same shape; only the two static
   files change per version.
2. Bundle React into the runtime bundle. Breaks the `window.React` external-module contract,
   duplicates React into every bundle that externals currently share, churns the deploy layout.
3. ESM `<script type="module">` + import maps. Cleanest long-term, but rewrites every
   index.html template, changes the module contract, and buys nothing the global shim doesn't.

### Feasibility: proven, not assumed

Spike (2026-07-24, esbuild 0.25.12, react 19.0.0 from the repo's own node_modules):

- `react19.production.min.js` — 8 KB min (`import * as React from 'react'; window.React = React`)
- `react-dom19.production.min.js` — 185 KB min (merges `react-dom` + `react-dom/client`, so
  `ReactDOM.createRoot` / `hydrateRoot` sit where the 18 UMD had them — the shape
  `noodl-viewer-react.js` already calls)
- Loaded via script tags in jsdom: `React.version === '19.0.0'`, `createRoot`/`hydrateRoot`/
  `createPortal` all functions, `createRoot().render()` renders correctly.
- `ReactDOM.findDOMNode` is `undefined` — which precisely delimits the breakage surface (§3).

## 3. Verified breakage surface for the 19 runtime

> **Update, same day:** items 1–4 are FIXED in commit `0d075b2`, and item 3 turned out to be
> far worse than written below. Live probing in the editor preview showed `getDOMElement()`
> returned **null for every built-in visual node** on the shipped 18.3.1 runtime — none of
> the 18 built-in components is a host element, so `1477a29`'s ref capture never fired for
> any of them. Consequence: the `setStyle` direct-DOM fast path (visibility, zIndex,
> transforms/animations, fonts, shadows) silently no-oped until an unrelated render flushed
> `this.style`, and the bounding-box observer never had a target — a live P1 in the shipped
> runtime since Dec 2025, proven by probe (setStyle({color}) left the DOM unchanged until a
> forced render). The fix is the `setDOMElement` contract: every built-in component reports
> its root host element via a stable ref (`components/noodl-root-ref.ts`); third-party module
> components fall back to a guarded `findDOMNode` (present on 18, undefined-and-skipped
> on 19 — the one documented degradation). Re-probed after the fix: all nodes resolve,
> setStyle hits the DOM synchronously.

1. **`src/highlighter.js:58`** — the one live `findDOMNode` call. Editor-preview highlight
   overlay; falls back to node refs. Small fix (use `getDOMElement()`/`_domElement`).
2. **`react-draggable` 4.5.0 without `nodeRef`** — `Drag.tsx` renders `<Draggable>` bare;
   react-draggable calls `findDOMNode` internally unless given a `nodeRef`. Crashes under 19.
   Fix: pass `nodeRef` (supported since 4.4).
3. **`getDOMElement()` class-component gap (pre-existing from `1477a29`)** — the ref callback
   only captures `_domElement` when the inner ref IS a DOM element. For class-component inner
   components the ref is the instance, so `getDOMElement()` returns `null` where React 17
   `findDOMNode(instance)` found the node. Works today only because 18.3.1 still has
   `findDOMNode`… except the code no longer calls it, so the gap is live *now* for any
   class-based inner component. Needs an explicit audit + fix (forward refs or documented
   contract). Candidate for the DEBT-006 ledger regardless of RUN-001.
4. **`requestAnimationFrame` deferral in the bounding-box observer path** (`1477a29`) — the
   observer target is now set a frame late. Interacts with Noodl's own per-frame dirty-flag
   scheduler; watch in corpus testing, especially animation-heavy projects.
5. **React 19 behavioural deltas that scanning can't catch** — automatic-batching interplay
   with Noodl's scheduler, ref-callback cleanup-function semantics, `element.ref` removal.
   Corpus comparison remains the only honest test (spec §Testing Plan stands).

User-project code (Function nodes, custom modules) can still hit removed APIs — the design
doc's migration detector + per-project opt-in remain the right shape for that.

## 4. Delivery points (surveyed 2026-07-24)

One canonical source, `packages/noodl-viewer-react/static/shared/` (react + react-dom
18.3.1 UMD), fanned out by `copy-webpack-plugin` into `packages/noodl-editor/src/external/`:

| Consumer | How React arrives | Files |
|---|---|---|
| **Editor preview** | Editor web server (port 8574, `main/src/web-server.js:106,145-160`) serves `src/external/viewer/`; `static/viewer/index.html:73-76` loads `/react*.production.min.js` before `noodl.viewer.js` | 18.3.1 UMD pair |
| **Deployed apps** | `deployToFolder` → `build/deploy-index.ts:copyDeployFilesToFolder` copies every file listed in `src/external/deploy/index.json` (both react files included); `static/deploy/index.html:73-74` loads them via `%baseUrl%` script tags | 18.3.1 UMD pair, frozen into the deploy |
| **noodl-preview** (SUB-009) | `src/loader.ts:253-276` serves the same `external/deploy` react files and **hard-asserts their presence** (`assertDeployAssets`) | same pair |
| **SSR harness** (`static/ssr/`) | npm `react`/`react-dom` ^18.3.1 (node process, not UMD) — but **unwired**: the only `runtimeType: 'ssr'` deploy call is commented out (`DeployToFolderTab.tsx:59-66`) | n/a |
| **noodl-viewer-cloud** | **Uses no React at all** — `externals: {}`, no react imports, node/sandbox targets | n/a |
| Parse dashboard (editor-internal) | Self-bundled React 16.x inside `parse-dashboard-public/bundles/` — unrelated to the runtime | untouched |

External Noodl modules get React implicitly through the `window.React`/`window.ReactDOM`
globals the index.html sets up before `<%modules_dependencies%>` injection — no template
names the global explicitly, but the contract is load-bearing
(`dev-docs/reference/LEARNINGS-RUNTIME.md:36-37`).

**Choke points for the version switch** (the complete list of what selects which React a
consumer gets): `webpack.common.js` + `webpack.ssr.common.js` externals, the two script
tags in `static/viewer/index.html` / `static/deploy/index.html`, `static/deploy/index.json`,
and noodl-preview's `DEPLOY_ASSETS`. Nothing else in the repo delivers runtime React.

Two scope items from the spec resolve immediately:
- **Cloud runtime**: nothing to migrate — record the exclusion (it is React-free), done.
- **SSR**: not RUN-001's problem; it is unwired and npm-based. RUN-002 owns it (and gets an
  easier job, since node-side React needs no UMD).

## 5. Corrected plan

Slices, each independently landable on `cline-dev`:

1. **Vendored React 19 globals + dual static sets.** ✅ DONE (`1c6790c`) —
   `scripts/build-react-globals.js` builds `static/shared-react19/` from the installed npm
   packages; react-dom aliases `react` to the window global (two bundled copies split the
   hooks dispatcher — verified single-instance with a hooks render in jsdom). Same filenames
   as the 18 set, so selection is purely which directory gets copied. Nothing consumes it yet.
2. **Source fixes for 19.** ✅ DONE (`0d075b2`) — setDOMElement contract across all 18
   built-in components, highlighter.js off findDOMNode, Drag.tsx delegating nodeRef for
   react-draggable, Page gains noodlNodeAsProp. Also fixes the live setStyle P1 (§3 update).
   Residual: Router/navigation-stack (childless roots, like Drag) rely on the findDOMNode
   fallback under 18 and have no reachable root under 19 — revisit in the corpus pass.
3. **Per-project runtime version setting** (project.json), plumbed through preview + deploy
   file selection. New projects default 19; absent setting = 18 (existing projects unchanged).
4. **Editor surface:** version selector in deploy flow + migration scan (design doc's
   detector patterns, trimmed to what's actually removed in 19 relative to *18*, not 17).
5. **Corpus comparison** on 18 vs 19 preview: the SUB-004/SUB-009 project corpus + signal-heavy
   and animation-heavy projects; diff behaviour, not just absence of crashes.
6. ~~Cloud runtime decision~~ **Resolved by the §4 survey**: `noodl-viewer-cloud` uses no
   React (excluded, with reasoning recorded); the SSR harness is unwired and npm-based
   (deferred to RUN-002).
7. **Docs:** user-facing behavioural-difference notes (18→19 is a far shorter list than 17→19).

**Estimate impact:** spec said 4–6 weeks assuming an untyped 17-era runtime and an unstarted
design. With the source already 19-clean, the binding hub typed, and delivery proven, slices
1–4 are days each, not weeks; the corpus pass is the long pole.

### PLAT-003 boundary (spec prerequisite "coordinate with PLAT-003")

Agreed boundary: RUN-001 owns the React-facing files it must touch — `highlighter.js`,
`Drag.tsx`, `noodl-viewer-react.js` (entry), `webpack-configs/`, `static/`. PLAT-003's next
slice (per PLAT-003-NOTES §20) targets the same `src/` root utilities for typing; whoever
lands first wins, the other rebases — the files are small and the work orthogonal
(typing vs. API usage). `catalog:check` remains the shared regression gate.

## 6. What stays true from the original spec

- "No one gets left behind": per-project opt-in, absent setting means unchanged behaviour.
- Single runtime source, no fork; version-conditional code isolated (it amounts to: which
  static React pair gets copied, plus at most one shim module).
- Corpus testing as the real safety net; batching/ordering scrutiny for signal-heavy apps.
- CI builds both variants (cheap: the variants differ only in two static files + a setting).
