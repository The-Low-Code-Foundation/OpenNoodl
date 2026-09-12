const remote = require('@electron/remote');

/**
 * LIB-008: the origin for **documentation pages** — the four surfaces that send a
 * person to a page they read. Its sibling `getContentEndpoint()` addresses the
 * editor's content CDN (library index, lessons, templates, tutorials, what's-new).
 *
 * 🔴 **Do not merge these two back together.** ALPHA-006 §5 split them on
 * 2026-08-13 precisely so they could move independently, and they since have:
 * the payloads stayed in the renamed `nodegx-content` repo, while the docs were
 * rebuilt as this monorepo's own Docusaurus site (`docs-site/`, published by
 * `.github/workflows/deploy-docs.yml` to this repository's GitHub Pages).
 *
 * ## Why this was a 404 in 0.2.3
 *
 * `opennoodl-docs` was renamed to `nodegx-content` on 2026-08-07. **GitHub Pages
 * does not follow a repo-rename redirect** the way git and the API do, so the old
 * origin is a hard 404, not something a fetch survives. `getContentEndpoint()`
 * was repointed at the time; this function was not, and shipped dead in 0.2.3 —
 * every in-editor documentation link with it.
 *
 * ## The `/docs` suffix is load-bearing
 *
 * Docusaurus serves the doc plugin under `routeBasePath: '/docs'`
 * (`docs-site/docusaurus.config.js`) beneath a `baseUrl` of `/NodeGX/`, so a page
 * authored at `docs-site/docs/nodes/logic/and.md` is served at
 * `…/NodeGX/docs/nodes/logic/and`. Callers join a site-relative path
 * (`nodeDocsPath()` returns `/nodes/...`), so the suffix has to be here.
 * A repoint without it turns a 404 *site* into a 404 *path* and looks fixed —
 * the same shape as `getContentEndpoint`'s `/static`, for the same kind of
 * reason: where a payload sits depends on how that site is built.
 *
 * If `routeBasePath` or `baseUrl` ever change, this string must change with them.
 * `npm run docs:verify-origin` is the thing that will tell you: it resolves known
 * pages through this function and goes red on a non-200.
 *
 * ## The local-docs branch
 *
 * Untouched, and deliberately: `main.js` only sets `useLocalDocs` when a server on
 * :3000 answers `/<major.minor>/version.json` with `{"kind":"noodl-docs"}`, which
 * is the *legacy* Noodl docs site's shape. Docusaurus serves no such file, so this
 * branch is unreachable against `docs-site/` and repointing it would be a guess.
 */
export default function getDocsEndpoint() {
  const localDocs = remote.getGlobal('useLocalDocs');
  return localDocs ? 'http://localhost:3000' : 'https://the-low-code-foundation.github.io/NodeGX/docs';
}
