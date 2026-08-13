/**
 * What a click on a link inside rendered release notes is allowed to do.
 *
 * Its own module, with **no imports**, for two reasons. The decision is a
 * security boundary — a release body is text fetched from the network, and this
 * is what stands between it and `shell.openExternal` — so it should be readable
 * and testable on its own. And a spec that reaches `UpdateDialog` would pull
 * `@noodl-core-ui` into its module graph, which is enough to stop a suite
 * *running* under the plain-node runner.
 */

/** `open` hands the URL to the OS browser; `ignore` does nothing at all. */
export type LinkAction = 'open' | 'ignore';

/**
 * Only `http:` and `https:` are handed to the browser.
 *
 * The renderer already refuses `javascript:`, `vbscript:` and `data:text/html`
 * link targets, and markdown is parsed with raw HTML disabled — so an anchor
 * carrying one of those should not reach here. This is the second lock, on the
 * assumption that the first one is one dependency bump away from changing.
 *
 * Note what is deliberately NOT opened: `file:` (a link that makes the app open
 * something on the user's disk) and every custom scheme, `nodegx:` included —
 * handing our own protocol handler a string from a release body is exactly the
 * shape of a self-inflicted deep-link injection.
 */
export function linkActionFor(href: string | null | undefined): LinkAction {
  if (typeof href !== 'string') return 'ignore';

  const trimmed = href.trim();
  if (trimmed === '') return 'ignore';

  // Parsed rather than pattern-matched: `https:/\/\evil` and friends are why a
  // regex on the raw string is the wrong instrument. An unparseable href — a
  // bare `#anchor`, a relative path — throws and is ignored, which is correct.
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'ignore';
  }

  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? 'open' : 'ignore';
}
