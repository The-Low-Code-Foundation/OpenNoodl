const remote = require('@electron/remote');

/**
 * ALPHA-006 §5: the docs origin doubles as the editor's content CDN for six
 * non-documentation payloads (library index, lessons, project templates,
 * tutorials, what's-new feed). This is that origin, kept as its own function
 * so those call sites are no longer indistinguishable from the four that
 * fetch actual documentation (`getDocsEndpoint`). The split is what lets the
 * two move independently — and as of 2026-08-13 they have.
 *
 * ALPHA-006 B5 owed a repoint after `opennoodl-docs` was renamed to
 * `nodegx-content` on 2026-08-07; nobody made it, and the Library panel has
 * been erroring ever since. **GitHub Pages does not follow a repo-rename
 * redirect** the way git and the API do, so the old origin is a hard 404 —
 * not a redirect the fetch could survive.
 *
 * The `/static` suffix is not cosmetic. The same rename re-ran Pages as a
 * *legacy* build (`build_type: legacy`, source `main:/`), which publishes the
 * repo tree verbatim instead of the Docusaurus output that used to flatten
 * `static/**` up to the site root. So the six payloads now live one level
 * down, exactly where they sit in the repo. If that repo's `pages.yaml`
 * workflow ever runs again it flips back to a Docusaurus build and this
 * suffix must come off — see B5.
 *
 * The local-docs branch keeps no suffix: a Docusaurus dev server on :3000
 * serves `static/**` at its root, which is the arrangement the published
 * site used to mirror.
 */
export default function getContentEndpoint() {
  const localDocs = remote.getGlobal('useLocalDocs');
  return localDocs ? 'http://localhost:3000' : 'https://the-low-code-foundation.github.io/nodegx-content/static';
}
