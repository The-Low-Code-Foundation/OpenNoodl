const remote = require('@electron/remote');

/**
 * ALPHA-006 §5: the docs origin doubles as the editor's content CDN for six
 * non-documentation payloads (library index, lessons, project templates,
 * tutorials, what's-new feed). This is that origin, kept as its own function
 * so those call sites are no longer indistinguishable from the four that
 * fetch actual documentation (`getDocsEndpoint`). Both resolve to the same
 * origin today — the split is what lets them move independently later,
 * without a call site having to guess which kind of URL it's building.
 */
export default function getContentEndpoint() {
  const localDocs = remote.getGlobal('useLocalDocs');
  return localDocs ? 'http://localhost:3000' : 'https://the-low-code-foundation.github.io/opennoodl-docs';
}
