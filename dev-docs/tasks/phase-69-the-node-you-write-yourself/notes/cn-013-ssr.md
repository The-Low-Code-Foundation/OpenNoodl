# CN-013 — the SSR half: the globals were set and nothing filled them. ✅ **Now fixed**

**s25, 2026-08-18.** CN-013 item 1 asks *"does a kit node render under SSR today? The globals are
set, so it plausibly does — **confirm, don't infer**."* Confirmed, and the answer is no.

## Observation written before measuring

| # | Observation | "Renders" looks like | "Does not" looks like |
|---|---|---|---|
| S1 | A kit's nodes reach the SSR runtime | `__noodl_modules` non-empty at `renderPage` | `[]`, and the node types unregistered |
| S2 | If it does render, `useLayoutEffect` warns | React's SSR warning in the build log | silence |
| S3 | A browser-only kit on an SSG build | silent omission / blank / crash | — |

## Measured: S1 is **no**, and S2/S3 do not arise in the form the spec expected

🔴 **`globalThis.__noodl_modules` is `[]` at render time, always.** `runtime-globals.js:33` creates
it empty and installs a `defineModule` that pushes into it. `index.js:68` and `ssg.js:68` hand that
array to `renderPage` as `noodlModules`. **Nothing in `static/ssr/` ever evaluates a kit's
`index.js`** — the templates `require` exactly `./runtime-globals`, `./server-core` and
`./noodl.deploy`, and no file in that directory so much as names the `noodl_modules` directory.

In a browser a kit reaches the runtime because `@nodegx/module-inject` writes a `<script>` tag per
kit and the browser runs it. **Server-side there is no browser**, and no replacement for one.

✅ **Measured with a known-firing control, because an empty list is also what a broken bootstrap
gives.** `tests/ssr-kit-modules.test.js`: after the real `installRuntimeGlobals`, the list is `[]`;
evaluate a kit's source in those same globals the way a script tag would and it becomes 1, correctly
named from `__noodl_module_name`. So the receiving half works and **the caller is absent** — the
identical shape CN-012 M4 found in the cloud runtime, in a second runtime, found the same way.

## 🔴 The consequence is not a blank, and that is what makes it bad

`noodl_modules/` ships verbatim in a deploy and the HtmlProcessor injects the kit `<script>` tags
into `public/index.html`. SSR splices its markup into that same document. So:

- **the server** renders the page with every kit node missing — an unregistered type is logged and
  skipped **with its connections**, so the surrounding graph loses those edges too;
- **the client** loads the kit on hydration and renders a different tree.

That is CN-001's finding in a second instrument: *not a blank — the page renders without the node
and reports success.* ⚠️ It is also a hydration mismatch, which is the class RUN-001 flagged for
React copies and CN-013's own trap list flagged for `useLayoutEffect` — reached by a different road
than either expected.

⚠️ **S2 cannot be observed today**: `useLayoutEffect` is in `Cashflow Lane`, a kit node that never
runs server-side, so the warning the spec predicted "would be the first thing that breaks" cannot
fire. It becomes reachable only once a loader exists — and at that point it is the interesting case
the spec says it is.

⚠️ **S3's answer is "silent omission", but not for the reason the question assumed.** It is not that
a *browser-only* kit is omitted from SSR; **every** kit is, whatever its `runtimes` says. So a
`kitNeedsSsrWarning` predicate built on `libraryNeedsSsrWarning`'s model (CN-013 item 4) would be
**wrong today**: it would warn about browser-only kits and stay silent about the rest, while the
rest are equally missing. 🔴 **Item 4 must not be built before item 1 is fixed** or the editor will
confidently name the wrong kits.

## ✅ BUILT the same session (s25) — `static/ssr/kit-modules.js`

Richard's call: build the loader. It does **not** scan `noodl_modules/` — it reads the **injector's
own `<script>` tags** out of the `index.html` the server already holds as `htmlData`, and evaluates
them in document order with `new Function(source)()`, which is what a `<script>` tag does. Three
consequences, all deliberate:

- 🔴 **It cannot disagree with the browser about which kits load**, because it is reading the
  browser's instructions. A second manifest scanner is the regression LIB-003 exists to end, and
  this file cannot import the first one — an SSR deploy is a standalone folder.
- ✅ **CN-003's name adoption is reused, not copied.** The marker `window.__noodl_module_name` is set
  per script, exactly where the injector sets it, so the bootstrap's existing `defineModule` does
  the adoption. ⚠️ A mutation setting it once per page instead of once per script reddens.
- ⚠️ **There is no `runtimes: ["ssr"]`, and there should not be.** SSR is the *browser* app rendered
  on a server, so the set that loads is the set whose `runtimes` contains `browser`. A kit declaring
  only `ssr` is in no page and still runs nowhere — which is why `KIT_LOADERS` stays
  `['browser', 'cloud']` and the `kit-loads-nowhere` diagnostic still has a population.

**11 tests, 4/4 mutations killed** (name marker per-page · match every script not just kit ones ·
no per-kit try/catch · no `public/` fallback). `noodl-viewer-react` **921 / 72**.

⚠️ **A kit that throws costs its own nodes and nothing else**, and the warning names the consequence
an author will actually see — *"its nodes will be missing from the server render and will appear
only after hydration, which is a hydration mismatch"*. ⚠️ **A remote `http(s)` dependency cannot be
fetched synchronously here** and is skipped with a reason; a kit relying on one will still be
missing server-side. That is a real residual, named rather than hidden.

## What is left, and what would close it

- 🔴 **Still not measured: a rendered SSR page.** The seam is measured on both sides of the fix;
  the visible consequence is derived from the already-established skip-with-connections mechanism,
  not separately observed. **The drive that closes AC1 outright:** deploy a project with a kit at
  `deployRenderingMode: 'ssr'`, serve it, `curl` the HTML, and look for the kit node's output in
  the server response **before** any JavaScript runs. A control in the same run — a built-in node
  in the same page — separates "kits are missing" from "SSR rendered nothing". ⚠️ **This is now a
  confirmation drive, not a discovery one**, and it is the last thing between CN-013 and AC1.
- ✅ **Item 4 (`kitNeedsSsrWarning`) is now buildable, and its shape has changed.** The blocking
  objection was that *every* kit was missing under SSR, so a predicate modelled on
  `libraryNeedsSsrWarning` would name the wrong kits. With the loader in place the honest predicate
  is the one that objection implied all along: **warn about a kit that will throw or no-op
  server-side**, not about one whose manifest omits a runtime. The loader's own failure list is the
  right input — it already distinguishes loaded, threw, and skipped-remote-dependency.
