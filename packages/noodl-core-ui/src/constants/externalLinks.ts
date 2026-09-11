/**
 * The three external places a NodeGX user is ever sent: docs, video, chat.
 *
 * POL-002. Before this, the launcher footer and the editor's `?` menu each
 * carried their own hardcoded URLs — all of them Noodl's (`docs.noodl.net`,
 * `forum.noodl.net`, `noodl.net/support`, a `youtube.com/@noodlapp` channel and
 * a `discord.gg/noodl` invite), none of them ours, all of them dead.
 *
 * The docs domain is explicitly temporary — Richard's words were "until I find a
 * better domain" — which is the whole reason this is one constant rather than
 * two copies: the next change is a one-line change.
 *
 * This module is deliberately dependency-free. `noodl-editor` has
 * `getDocsEndpoint()`, which reads an Electron global to allow a localhost docs
 * server; that cannot live here, because the launcher chrome in `noodl-core-ui`
 * renders in Storybook too and must not reach for `@electron/remote`.
 *
 * 2026-08-13: this now points at the docs site ALPHA-006 §2/§3 built out of
 * this monorepo's own `docs-site/`, which has been publishing live since
 * 2026-08-07. The old `opennoodl-docs` origin is a 404 — its repo was renamed
 * and GitHub Pages, unlike git and the API, does not follow a rename redirect.
 * `getDocsEndpoint()` still carries the dead origin: it is not the same
 * one-line change, because its four call sites join paths (`/nodes/...`, the
 * MCP page) that the new site does not serve at those paths yet.
 */
export const EXTERNAL_LINKS = {
  docs: 'https://the-low-code-foundation.github.io/NodeGX/',
  youtube: 'https://www.youtube.com/@simple-rick-tutorials',
  discord: 'https://discord.gg/dZw4w5pKf9'
} as const;

export type ExternalLinkId = keyof typeof EXTERNAL_LINKS;

/**
 * Deep links into the docs site.
 *
 * CN-007. These are **composed from `EXTERNAL_LINKS.docs`** rather than written
 * out, for the reason stated above: the docs origin is explicitly temporary, and
 * the whole point of it being one constant is that moving it stays a one-line
 * change. A second hardcoded origin here would quietly undo that.
 *
 * The path is the Docusaurus route (`routeBasePath: '/docs'` in
 * `docs-site/docusaurus.config.js`) plus the page's filename.
 */
export const DOCS_PAGES = {
  /** Writing your own nodes — the page that replaces Noodl 2.7's `create-react-lib` guide. */
  customNodes: `${EXTERNAL_LINKS.docs}docs/custom-nodes`
} as const;

export type DocsPageId = keyof typeof DOCS_PAGES;
