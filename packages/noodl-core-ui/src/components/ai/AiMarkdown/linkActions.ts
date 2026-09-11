/**
 * What a click on a link inside AI-rendered markdown is allowed to do.
 *
 * Moved here from `noodl-editor`'s `UpdateManager/releaseLinks.ts` (FIX-003):
 * the policy was written for release notes, but it is the same decision for
 * every surface that renders text a model or the network wrote — the Build
 * thread, the Explain answer, a dialog. One module, so the surfaces cannot
 * drift apart.
 *
 * Its own module, with **no imports**, for two reasons. The decision is a
 * security boundary — the text is untrusted, and this is what stands between
 * it and `shell.openExternal` — so it should be readable and testable on its
 * own. And an import-free module is reachable from both plain-Node test
 * runners (this package's and the editor's), where anything that pulls in
 * React or a `.scss` import is not.
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

/**
 * The Explain feature's citation scheme (LEG-003). ⚠️ Deliberately duplicated
 * from `noodl-editor`'s `@noodl-models/AiAssistant/explain/citations` — this
 * package cannot import the editor. `aiMarkdownLinkPolicy.test.ts` pins the
 * literal so a drift over there fails a spec here.
 */
export const CITATION_SCHEME = 'noodl-node:';

/** What one anchor inside AI markdown means, decided from its href alone. */
export type AiLinkAction =
  | { kind: 'ignore' }
  | { kind: 'open'; href: string }
  | { kind: 'citation'; nodeId: string };

/**
 * The one routing decision `AiMarkdown` makes: a `noodl-node:` citation goes to
 * the canvas, an `http(s)` link goes to the OS browser, and everything else is
 * swallowed. The window itself never navigates on any branch — that is the
 * caller's contract, and it holds even for a link this function refuses.
 */
export function aiLinkActionFor(href: string | null | undefined): AiLinkAction {
  if (typeof href !== 'string') return { kind: 'ignore' };

  const trimmed = href.trim();
  if (trimmed.startsWith(CITATION_SCHEME)) {
    const nodeId = trimmed.slice(CITATION_SCHEME.length);
    return nodeId === '' ? { kind: 'ignore' } : { kind: 'citation', nodeId };
  }

  return linkActionFor(trimmed) === 'open' ? { kind: 'open', href: trimmed } : { kind: 'ignore' };
}
