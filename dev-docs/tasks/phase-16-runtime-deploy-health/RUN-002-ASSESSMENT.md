# RUN-002 Assessment — the SSR infrastructure is real and renders; hydration and SEO are the gaps

**Date:** 2026-07-25
**Status of task:** Step 1 (audit the existing infrastructure) **complete, with a recorded finding**. Steps 2–8 not started.
**Verdict:** **Foundation, not artifact.** The original team's unshipped SSR pipeline builds on every `npm run build`, and — assembled into a real deployment and run — it renders meaningful HTML server-side for real projects *today*. What stands between it and a shippable feature is not "invent SSR" but three concrete things: a **hydration bug introduced by the React upgrade**, an **unfinished SEO-injection TODO**, and the **node server-compatibility work** the spec already named as the crux.

---

## 1. The spec's premise vs. reality

The spec (and `dev-docs/future-projects/SSR-SUPPORT.md`) says substantial SSR infrastructure exists but was never shipped, and makes Step 1 an audit that "may substantially change the estimate in either direction." It does — mildly downward on the render pipeline (it works, which was not certain), and it sharpens where the real weeks go.

What actually exists and is wired:

- **The SSR runtime bundle is built on every build.** `webpack.prod.js` exports `[viewer, deploy, ssr]`; `webpack.ssr.common.js` builds `index.ssr.js` → `packages/noodl-editor/src/external/ssr/noodl.deploy.js` (878 KB, rebuilt during RUN-001 on 2026-07-25). It is not an orphan.
- **The SSR server template** (`packages/noodl-viewer-react/static/ssr/index.js`) is a functional Express + `ReactDOMServer.renderToString` server with `globalThis` polyfills (localStorage, fetch, XHR, rAF, File), `node-cache` per-path caching, and CSR fallback on error.
- **`ssrSetupRuntime` / `NoodlSSR.createElement`** exist (`viewer.jsx:52`, `index.ssr.js`) and the deployed runtime has a **real hydration path** (`noodl-viewer-react.js:57` `renderDeployed` → `hydrateRoot`/`createRoot`).
- **The `Noodl.SEO` API is real and SSR-aware** (`src/api/seo.ts`): it buffers title/meta into memory when `document` is undefined, DOM-manipulates when it isn't. Consumed by `router.tsx` (`setTitle`) and `Page.tsx` (`setMeta`).
- **Page enumeration / sitemap** exist: `utils/compilation/context/pages.ts` (`getIndexedPages`, `expandPaths`, dynamic routes) and `passes/sitemap.ts` (writes `.sitemap.metadata.json` "required for SSR to quickly understand what pages exist").

What is stubbed / disabled / missing (see §3 for the ones that matter):

- SEO meta injection into the served HTML: `// TODO: Inject Noodl.SEO.meta` (`static/ssr/index.js:163`).
- `SSR_PageReady` emitter + `onPageReady` input: commented out (`page.ts:47-54`, "TODO: Enable with SSR"). The server relies on a 1000-iteration busy loop instead.
- `Noodl.SEO.setOpenGraph` / Twitter card / structured data: **do not exist** (the design doc lists them as future).
- Deploy UI for SSR: entirely commented out (`DeployToFolderTab.tsx:57-67`); no SSR tab in `DeployPopup`.
- Tests: **none** anywhere for the SSR path.
- Stale duplicate build dirs: `external/{ssr 3, deploy 2, viewer 3, cloudruntime 3}/` — accidental copies, unreferenced.

---

## 2. Feasibility: proven, not assumed

I did not reason about whether it renders — I stood it up and ran it. The harness lives in the scratchpad (`ssr-smoke/`, reproducible, see §5); it reuses noodl-preview's headless export pipeline (the *real* editor deploy path) to produce `exportJson` + bundles + `index.html`, assembles them into the SSR deployment the `ssr/index.json` manifest describes, `npm install`s the server's own declared deps (React 18.3.1, express, node-cache, node-fetch, xmlhttprequest), `esbuild`-bundles it exactly as `static/ssr/package.json`'s build script does, runs `node server.js`, and curls a page.

Two projects, both **HTTP 200 with real server-rendered content in `<div id="root">` before any client JS**:

| Project | Bundles | Result |
|---|---|---|
| `hello-world` (trivial) | 1 | 1013 chars of markup + computed styles; contains the literal `Hello World!` text |
| `probe-router` (page router + `SEO.setTitle`, corpus) | 2 | 1402 chars; multi-bundle **fetched server-side** and rendered; page router resolved |

So: the render pipeline works end-to-end, multi-bundle lazy-fetch works server-side (bundles resolve from the cwd-relative `./noodl_bundles`, **not** `public/` — see §4), and the CSR fallback path is not silently masking a dead renderer.

---

## 3. The three real gaps (what the weeks actually go to)

### 3.1 Hydration is broken by the React upgrade — a bug, not missing work

`renderDeployed` decides hydrate-vs-createRoot like this (`noodl-viewer-react.js:60`):

```js
if (element.children.length > 0 && !!element.children[0].hasAttribute('data-reactroot')) {
  currentRoot = ReactDOM.hydrateRoot(element, this.createElement(...));   // SSR path
} else {
  currentRoot = ReactDOM.createRoot(element);                            // CSR path
}
```

`data-reactroot` is a **React ≤17** marker. **React 18+ `renderToString` no longer emits it** — empirically confirmed: the SSR output from the React 18.3.1 server contains no `data-reactroot` anywhere. RUN-001 moved the runtime to vendored React **18.3.1** (default) with a **19** opt-in. So *post-RUN-001, this detection always fails*: the client falls into `createRoot` and **re-renders the whole app from scratch, discarding the server HTML instead of hydrating it.**

Consequence: SEO/first-paint benefits (content is in the HTML) are unaffected, but there is no hydration — a double render, and the "hydrate cleanly without mismatches" success criterion cannot be met until the detection is fixed. This is the RUN-001 pattern repeating: a latent defect the version upgrade exposed, invisible until you actually run the path.

**Fix shape (small, early win):** stop depending on a marker React removed. Have the SSR server stamp the root it rendered (e.g. `<div id="root" data-ssr="1">…`) and have `renderDeployed` hydrate on that, or on "root already has children" alone. Must be verified with an actual browser (hydration-mismatch warnings only surface at runtime), reusing the RUN-001 CDP corpus harness.

### 3.2 SEO injection is an unfinished TODO — the headline benefit isn't delivered end-to-end

`static/ssr/index.js:163` is `// TODO: Inject Noodl.SEO.meta`. The `<title>` in the rendered output is the **static template title**, not the value a project sets via `Noodl.SEO.setTitle`/`setMeta`. So the runtime *collects* SEO state server-side (the API is SSR-aware) but the server never writes it into `<head>`. For a feature whose entire justification is SEO and social previews, this is load-bearing. It is also cheap: read `globalThis.Noodl.SEO.title`/`.meta` after render and splice `<title>` + `<meta>` into the head. (`setOpenGraph`/Twitter/structured-data are additive on top and can follow.)

### 3.3 Node server-compatibility is unhandled — the spec's named crux, confirmed

The router probe surfaced it immediately: a JavaScript/Function node running `window.__probe = …` throws **`ReferenceError: window is not defined`** server-side. The runtime catches it ("Error in JS node run code") so the render *survives*, but that node's logic **silently does not run on the server** — a partial render the user didn't author and can't see. `window` is deliberately left undefined (so the runtime's own `typeof window !== 'undefined'` guards take the server branch), which means any *user* node code touching `window`/`document`/browser globals breaks.

Nothing classifies nodes as server-safe / adaptable / client-only (Step 2, unstarted), and there is no mechanism to defer a client-only node to hydration rather than letting it throw. This is where the genuine multi-week effort lives, exactly as the spec predicted — the render engine was never the hard part.

### 3.4 Secondary: version skew + fragile trigger

- The SSR server pins **React 18.3.1** and renders with it regardless of a project's `runtimeVersion: 'react19'` (the bundle externalizes React to the server's node-module copy). Combined with §3.1, react19 projects also never hydrate, and could hit 18-vs-19 SSR semantic differences. Decide: does the SSR server track the project's chosen React pair?
- The render trigger is a 1000-iteration `triggerDidMount`/`_doUpdate` busy loop (`static/ssr/index.js:147`) because `SSR_PageReady` is commented out. Works, but it's a timeout-shaped heuristic that will bite on data-dependent pages. Wiring the real ready signal (§ `page.ts:47-54`) is the principled fix and is a prerequisite for §3.5.

### 3.5 Data resolution before render — not yet exercised

Neither smoke project fetches remote data, so server-side data resolution (spec Step 5) is untested here. The graph *does* know a page's query dependencies (a real advantage), and the SSR server already polyfills `fetch`/XHR, but "wait for data before renderToString" is not implemented beyond the busy loop. This remains genuine work and should be measured against a data-dependent corpus project next.

---

## 4. Traps found (for whoever implements)

- **Bundles must sit at the deploy *root* `./noodl_bundles/`, not only `public/`.** The server-side fetch shim (`static/ssr/index.js:42`) reads `'.' + args` (cwd-relative). `express.static('public')` serves the browser copy. The design doc's "static assets → `/public`" step alone would leave the *server* unable to find bundles → every multi-bundle project would silently CSR-fallback. The real deploy flow must write bundles to both, or fix the shim. (My harness writes both; that's why multi-bundle rendered.)
- **`renderToString` output has no `data-reactroot` under React 18/19** — see §3.1. Any code keying off it is already dead.
- **`window` is intentionally absent server-side**, not polyfilled — the runtime's SSR guards depend on that, so you cannot "just define window" to fix user nodes; classification + deferral is the answer.
- The SSR server's own `package.json` still declares React `^18.3.1` while the client can opt into 19 — keep these in lockstep or the skew in §3.4 compounds.

---

## 5. Reproducing the smoke test

Harness in the session scratchpad `ssr-smoke/` (not committed — it's a throwaway proof):

1. `node build.mjs` — esbuild-bundles `gen-export.ts` (clones noodl-preview's shim recipe: platform-node + dom-shim first, `@noodl-*` aliases, the 4 stubs).
2. `node gen-export.cjs <project-dir> <stage-dir>` — runs the real export pipeline headlessly → `exportJson.json`, `index.html`, `noodl_bundles/*.json`. (Requires `external/deploy/` built — `npm run build:editor:_viewer`; the harness resolves it via a symlink because the bundle's `__dirname` moves.)
3. Assemble: `static/ssr/index.js` with `{{#export#}}` → the export JSON; `external/ssr/noodl.deploy.js`; `index.html` + bundles into `public/` **and** bundles at root; `npm install` the SSR deps; `esbuild index.js --bundle --outfile=server.js`; `PORT=… node server.js`; `curl /`.

Assert: `<div id="root">` non-empty (not CSR fallback), contains the project's content, `data-reactroot` present (currently **false** — that's the §3.1 bug), and `<title>` equals the SEO-set title (currently the template default — that's §3.2).

---

## 6. Corrected plan

The spec's estimate (4–6 weeks) still holds — the render head-start is offset by hydration correctness and the node audit being genuinely hard. Suggested slice order:

1. **Quick wins that make the path honest (days):** fix the `data-reactroot` hydration detection (§3.1); implement SEO meta/title injection (§3.2). Verify both with the RUN-001 CDP corpus (hydration warnings, title/meta in raw HTML).
2. **Wire the ready signal (§3.4):** enable `SSR_PageReady`/`onPageReady`, replace the busy loop.
3. **Node server-compatibility audit (Step 2, the crux):** classify every node server-safe / adaptable / client-only; **record it in the node catalog (SUB-004/005)** so editor + export share one source of truth; add explicit client-only deferral so an incompatible node degrades instead of throwing.
4. **Server-side data resolution (§3.5)** driven by the page's query graph; validate on a data-dependent corpus project.
5. **SSG mode:** pre-render each `getPages()` route at build time to static HTML.
6. **Deploy wiring + settings UI:** uncomment/rebuild the SSR deploy path; project- and (ideally) page-level rendering mode; fix the bundle-location trap (§4) in the real deploy flow.
7. **Docs per mode; delete the stale `external/* N/` duplicates; add the first SSR tests.**

## 7. What stays true from the original spec

- Node server-compatibility is the crux, and it is unstarted — confirmed empirically, not assumed.
- Hydration mismatch is the classic failure mode; here it's worse than predicted because detection is already broken by version drift, so the first job is to make hydration *happen at all*.
- The graph knowing its own data dependencies is a real advantage for Step 5.
- SSR is opt-in; CSR stays the untouched default.
