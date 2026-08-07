# Rendering modes — client, server, or static

Every NodeGX project deploys as a client-rendered single-page app (CSR) by
default, exactly as before. You can now opt a project into **server-side
rendering (SSR)** or **static pre-rendering (SSG)** instead — per project,
fully reversible, chosen at deploy time.

## Choosing a mode

| | CSR (default) | SSR | SSG |
|---|---|---|---|
| HTML before JavaScript runs | Empty root | Full page | Full page |
| SEO / social previews | Poor | Good | Good |
| Data freshness | Live | Live (fetched per request) | Frozen at build time |
| Hosting | Any static host | Node.js server | Any static host |

Rules of thumb: internal tools and apps behind a login are fine on CSR; a
public app with changing data wants SSR; a marketing site, portfolio, or blog
whose data changes rarely wants SSG.

## How to switch

**Deploy → Self Hosting → Rendering mode**, with three options: *Client-side
rendering (default)*, *Server-side rendering (SSR)*, *Static pre-rendering
(SSG)*. The choice is saved with the project (setting `deployRenderingMode`)
and applies to every subsequent folder deploy. Switching back to CSR restores
the old flat deploy output unchanged.

SSR and SSG produce the **same deploy artifact** — a folder with the render
server at the root and the complete client-side app in `public/` — so you can
run either mode (or both) from one deploy. The mode selection only changes
which instructions the popup shows; a `README.md` with run instructions is
written into the deploy folder itself.

## Running each mode

From the deployed folder:

```sh
# SSR — a Node.js server that renders every request
npm install
npm run build        # bundles the server → server.js
npm start            # serves on PORT (default 3000)

# SSG — pre-render every route to static files
npm install
npm run build:ssg
npm run ssg          # writes ./dist — upload it to any static host
```

SSG writes routes as `route/index.html`, so static hosts need no rewrite
rules. Dynamic routes (`{param}` segments) cannot be enumerated at build time;
they are reported during the build, skipped, and served client-side by the
copied `index.html` on hosts with SPA fallback.

Server environment variables: `PORT`, and `NOODL_SSR_PAGE_READY_TIMEOUT` (ms;
default `10000`) — how long a page using the Page node's *Page Ready* signal
may hold the render before the server sends what it has.

## What the server render gives you

- **SEO in the `<head>`.** Titles and meta set through the Page node or the
  `Noodl.SEO` API are rendered into the served HTML — crawlers and link
  previews see them without executing JavaScript.
- **Data resolved before the HTML is sent.** Any request a page makes while
  loading — REST nodes, the HTTP node, cloud-data query nodes, whether they
  use `fetch` or `XMLHttpRequest` — automatically holds the render until it
  completes. No wiring is required. For readiness the transport can't see
  (multi-step loads, state computed after a fetch), connect the Page node's
  **Page Ready** signal (group *Server Side Rendering*): the server then waits
  for your explicit signal.
- **Hydration, not a re-render.** The browser adopts the server-rendered DOM
  in place (React hydration) instead of rendering from scratch — no flash of
  replaced content, and interactivity attaches to what was served.

## Node compatibility on the server

Every node type is classified for server rendering, and the classification is
part of the node catalog (`ssr` field, also visible through the MCP server):

- **Safe** (the large majority): renders on the server exactly as in the
  browser.
- **Partial**: works with a caveat — e.g. animation and Delay nodes never
  advance server-side (the server clock is frozen; the page serves its initial
  state), the User node is always logged out server-side (sessions live in
  browser storage), and Function/Script code that touches `window` fails on
  the server (logged; outputs keep their defaults).
- **Client-only** (Screen Resolution, Open File Picker, Gyroscope, Script
  Downloader): skipped during the server render and activated in the browser
  after hydration. The server log lists every type it deferred.

A client-only or nondeterministic node whose output feeds *visible initial
content* can make the server HTML differ from the first client render; React
recovers by re-rendering client-side (the page still works — it just loses the
adopted-DOM benefit). Keep such nodes out of the first paint, or gate the
content on their signals.

## Known limitations

- **SSG data is baked at build time** and goes stale until the next build.
  Incremental regeneration is not implemented; rebuild to refresh.
- **No state serialization yet**: data is fetched during the server render and
  again in the browser during hydration. Correct, but each page load hits your
  data source twice, and non-idempotent endpoints can cause a mismatch.
- **The server renders with React 18.3** regardless of a project's React 19
  opt-in (see [REACT-19-RUNTIME.md](./REACT-19-RUNTIME.md)).
- **Rendering mode is per project**, not per page.
- **Don't drive Page Ready from a Delay node** — server-side time is frozen,
  so the Delay never fires and the page waits out the timeout. Async
  Function/Script code and data fetches work fine.

## If something looks wrong

The server falls back to serving the plain client-side app for a page whose
render throws, and logs why — a broken SSR deploy degrades to CSR rather than
going down. Check the server log for deferred client-only nodes, pages that
never signalled Page Ready, and render errors; switching the project back to
client-side rendering at any time restores the old behaviour entirely.
