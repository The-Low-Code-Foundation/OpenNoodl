# Phase 49 — Discovery (Track W: the web edges)

**Created:** 2026-08-06
**Status:** 📋 Specced, not started — 5 tasks. Post-alpha.
⚠️ **Re-scoped 2026-08-06.** This was written as "the smallest phase on the list" on the premise that
the SSR engine was sound and only its edges were missing. An adversarial review
([counter-review §A.1](../../reviews/NODEGX-VS-CODE-THE-COUNTER-REVIEW.md)) read the 887-line server
template and found four defects, three of them correctness bugs. DIS-004 absorbed them and the phase
roughly doubled.
**Origin:** the NodeGX-vs-code comparison, and specifically the correction to it.

## Why this phase is small, and why that is the interesting part

The comparison's first draft claimed NodeGX has no SSR. That was wrong, and the correction is worth
carrying here because it sets this phase's entire scope.

**NodeGX has SSR and SSG, and both are wired into Deploy → Self Hosting** as a rendering-mode
dropdown ([`DeployToFolderTab.tsx:23-34`](../../../packages/noodl-editor/src/editor/src/views/DeployPopup/tabs/DeployToFolderTab/DeployToFolderTab.tsx#L23-L34)).
It is not a stub:

- [`render-gate.js`](../../../packages/noodl-viewer-react/static/ssr/render-gate.js) has a real
  settle loop **plus** an `SSR_PageLoading` / `SSR_PageReady` handshake, so a page holds the render
  until its data has actually landed
- [`inject-seo.js`](../../../packages/noodl-viewer-react/static/ssr/inject-seo.js) injects title and
  meta into the served `<head>`; the Page node already carries `description`, `og:title`,
  `og:description`, `twitter:title`
- nodes classified client-only are deferred **and reported in the server log** rather than silently
  skipped
- SSG enumerates routes from `routerIndex`, writes `route/index.html` so no rewrite rules are
  needed, and **explicitly reports-and-skips** dynamic `{param}` routes rather than dropping them

The *design* is done and better than most of the category — the render gate and the client-only
deferral in particular are real engineering. **The server that hosts it is not.** See DIS-004 below:
the template races on process globals, caches forever on a path key, renders any URL sent to it, and
server-renders React 19 under React 18. The edges (sitemap, robots, JSON-LD) really are days each;
the server is not.

⚠️ **The meta-lesson, and it has two halves — the second one cost more.** The capability was
invisible to a careful search of `packages/noodl-viewer-react/src` and the exporter because it lives
in `static/ssr/`; this repo's most repeated failure is *the capability exists and is unreachable from
where you looked*. So: **grep before you build.**

But the review that found it then concluded *"I was too pessimistic"* and marked SSR ✅ without
reading the server. The second half of the lesson is the expensive one: **a capability's existence is
not evidence of its quality.** Finding the file is where verification starts, not where it ends.

## Tasks

| ID | Title | Est. | Notes |
|---|---|---|---|
| **DIS-001** | `sitemap.xml` | 3 d | Generated from `routerIndex` at SSG build and served dynamically under SSR. Per-locale alternates once [INT-007](../phase-47-internationalisation/README.md) lands — the two phases meet here and DIS-001 should land second. |
| **DIS-002** | `robots.txt` as a project surface | 1 d | Today: no way to author one. It is a text field and a served file. Trivial, and its absence is embarrassing rather than limiting. |
| **DIS-003** | Data-driven route enumeration for SSG | 1 wk | `ssg-paths.js` reports-and-skips `{param}` routes because it cannot know the data — correct, and honest. The fix is to let a project **declare a route source**: a cloud function or view returning the parameter set, called at build time. `/blog/{slug}` then pre-renders every article. SSR already handles this case, so this is for people who want a purely static host. |
| **DIS-004** | ~~Render cache / ISR~~ **Rewrite the SSR server** | **3–4 wks** | ⚠️ **Re-scoped 2026-08-06 — the original premise was backwards.** It said *"SSR renders every request."* It does not: `new NodeCache()` with no TTL and `set()` with no expiry, keyed `cache__${path}` (`index.js:10-17, 83-84`), so each path renders **once** and is served until the process restarts. The work is not adding a cache — it is removing a broken one. See the defect list below. |
| **DIS-005** | Structured data (JSON-LD) | 4 d | An Article / Product / Organization / BreadcrumbList emitter fed from page parameters. This is what produces rich results, and — increasingly the bigger prize — what makes a page legible to LLM crawlers, most of which do not execute JavaScript at all. |

⚠️ **DIS-004's real scope — four defects in the shipped SSR template, all verified in source 2026-08-06.**
This is the phase's centre of gravity, not its polish.

1. **Not concurrency-safe.** `server-core.js:53-59` mutates `globalThis.Noodl.SEO` and
   `globalThis.location` per request, then awaits a settle loop of 10–3,000 `setTimeout(…,1)` turns
   plus a 10s `PAGE_READY_TIMEOUT`. Express serves concurrently, so two overlapping requests render
   each other's routes. Needs per-request context (AsyncLocalStorage) or a render queue.
2. **The cache is unbounded, permanent, and keyed on path alone** — no TTL, no query string, no
   locale, no principal. Compose with (1) and a wrong-page render is cached forever under the wrong
   key. Note `runtime-globals.js:66` also installs **one process-wide `localStorage`**, which the
   runtime uses for `Parse/<appId>/currentUser`.
3. **`app.get('*')` renders any path** (`index.js:79`) with no route validation and no rate limit —
   a `curl` loop is an unbounded memory write. A blog with 10,000 slugs does it without an attacker.
4. **React version mismatch.** The template pins `react@^18.3.1` while the repo resolves 19.0.0 and
   projects declare `runtimeVersion: "react19"`. React-19 projects are server-rendered by
   ReactDOMServer 18 and hydrated by 19.

⚠️ **(2) is a live counter-example to a claim made elsewhere in this roadmap** — that forgotten
tenant scoping is *structurally impossible* because of ACLs. ACLs protect the data layer. They do not
protect a response cache. Fixing this is therefore not only an SEO task.

**Total: ~6–7 weeks** (was ~3.5 before DIS-004 was re-scoped). Could reasonably be folded into
[phase 26 (Deployment)](../phase-26-deployment/README.md), which is also unstarted and adjacent; kept
separate here because phase 26 is about *reaching a host* and this is about *being found once you
are there*.

## Exit criteria

1. A deployed app serves a valid sitemap covering every static route and every locale.
2. `/blog/{slug}` pre-renders every article under SSG.
3. A blog article produces a valid Article rich result in Google's testing tool.
4. A cached SSR page serves in under 50ms and invalidates when its record changes.
5. **Two concurrent requests for different routes each receive their own route** — a property test,
   not an example test.
6. **A request for an unregistered path is refused** without booting a runtime.
7. **A React-19 project is server-rendered by ReactDOMServer 19.**
