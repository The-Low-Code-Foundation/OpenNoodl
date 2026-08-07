# Server-rendered deployment

This folder was produced by the editor's **Deploy → Self Hosting** flow with the
rendering mode set to *Server-side rendering* or *Static pre-rendering*. It
contains everything both modes need:

- `index.js` / `server-core.js` / `render-gate.js` / `runtime-globals.js` /
  `inject-seo.js` — the SSR server and its render pipeline
- `ssg.js` / `ssg-paths.js` — the static pre-render (SSG) build entry
- `noodl.deploy.js` — the project runtime, with your project graph spliced in
- `public/` — the complete client-side app (this is what the server hydrates,
  and what a pure static host would serve)
- `noodl_bundles/` — component bundles. They exist **both** here at the root
  (the server loads them from the working directory) and in `public/` (the
  browser loads them over HTTP). Keep both.

## Run as a server (SSR)

```sh
npm install
npm run build      # bundles the server with esbuild → server.js
npm start          # serves on PORT (default 3000)
```

Every page is rendered on the server — with SEO title/meta in the `<head>` and
data resolved before the HTML is sent — then hydrated in the browser.

Environment variables:

- `PORT` — port to listen on (default `3000`).
- `NOODL_SSR_PAGE_READY_TIMEOUT` — how long (ms) a page using the Page node's
  *Page Ready* signal may take before the server renders what it has
  (default `10000`).

## Pre-render to static files (SSG)

```sh
npm install
npm run build:ssg  # bundles the SSG entry → ssg-build.js
npm run ssg        # pre-renders every route → ./dist
```

`dist/` is a fully static site (routes are written as `route/index.html`, so no
rewrite rules are needed) and can be uploaded to any static host. Data fetched
by the pages is baked in at build time — rebuild to refresh it. Dynamic routes
(`{param}` segments) cannot be enumerated at build time; they are reported,
skipped, and served client-side by the copied `index.html` on hosts with SPA
fallback.

## Notes

- Nodes classified as client-only (e.g. Screen Resolution, Open File Picker)
  do not run during the server render; they activate in the browser after
  hydration. The server log lists any it deferred.
- The server renders with the React version declared in `package.json`.
