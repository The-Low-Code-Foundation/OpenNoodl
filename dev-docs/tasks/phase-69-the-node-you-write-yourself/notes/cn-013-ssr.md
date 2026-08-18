# CN-013 — the SSR half: the globals are set and **nothing fills them**

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

## What is left, and what would close it

- 🔴 **Not measured: a rendered SSR page.** The seam is measured; the visible consequence is
  derived from the already-established skip-with-connections mechanism, not separately observed.
  **The drive that closes AC1's second half:** deploy a project with a logic kit at
  `deployRenderingMode: 'ssr'`, serve it, `curl` the HTML, and check for the kit node's output in
  the server response **before** any JavaScript runs. A control in the same run — a built-in node
  in the same page — separates "kits are missing" from "SSR rendered nothing".
- **The fix, if it is wanted, is small and already designed twice.** The cloud loader built this
  session (`kitModules.ts`) is exactly the missing piece in a second runtime: read the kit sources,
  evaluate them against the bootstrap's `Noodl`, push into `__noodl_modules` before
  `ssrSetupRuntime`. Server-side it can read the files directly — they are on disk in the deploy —
  so it needs no bundle-shipping half at all. ⚠️ It wants its own slice; it is not the cloud half
  and D18 does not rule on it.
