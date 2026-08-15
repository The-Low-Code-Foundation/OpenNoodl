/**
 * FIX-003 — the shared AiMarkdown link policy.
 *
 * One routing decision for every AI-rendered surface: a `noodl-node:` citation
 * goes to the canvas (LEG-003's contract), an `http(s)` link goes to the OS
 * browser, everything else is swallowed. The window itself never navigates —
 * `AiMarkdown` calls `preventDefault` on every anchor click before it even
 * asks this policy, so the specs here grade the *decision*, which is the half
 * a plain-Node runner can reach.
 */

import { aiLinkActionFor, CITATION_SCHEME, linkActionFor } from '@noodl-core-ui/components/ai/AiMarkdown/linkActions';

describe('the citation scheme', () => {
  // ⚠️ The editor defines the same literal in
  // `@noodl-models/AiAssistant/explain/citations` (LEG-003). This package
  // cannot import the editor, so the constant is duplicated there — this spec
  // pins the literal so a drift on either side fails here.
  it('is the LEG-003 literal', () => {
    expect(CITATION_SCHEME).toBe('noodl-node:');
  });
});

describe('a citation link', () => {
  it('routes to the canvas with its node id', () => {
    expect(aiLinkActionFor('noodl-node:abc-123')).toEqual({ kind: 'citation', nodeId: 'abc-123' });
  });

  it('survives the whitespace a markdown renderer can leave on an href', () => {
    expect(aiLinkActionFor('  noodl-node:abc-123')).toEqual({ kind: 'citation', nodeId: 'abc-123' });
  });

  it('is swallowed when it names no node at all', () => {
    expect(aiLinkActionFor('noodl-node:')).toEqual({ kind: 'ignore' });
  });
});

describe('an ordinary web link', () => {
  it.each([
    'https://github.com/The-Low-Code-Foundation/NodeGX/releases',
    'http://example.com',
    'HTTPS://EXAMPLE.COM/SHOUTING',
    'https://example.com/path?query=1&other=2#fragment'
  ])('opens %s in the OS browser', (href) => {
    expect(aiLinkActionFor(href)).toEqual({ kind: 'open', href });
  });

  it('is trimmed before it is handed over', () => {
    expect(aiLinkActionFor('  https://example.com  ')).toEqual({ kind: 'open', href: 'https://example.com' });
  });
});

describe('everything else is swallowed', () => {
  it.each([
    ['a script link', 'javascript:alert(1)'],
    ['a data URL', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    ['a file URL', 'file:///etc/passwd'],
    ['our own protocol', 'nodegx://open?project=/tmp/evil'],
    ['a mail link', 'mailto:someone@example.com'],
    ['a bare fragment', '#section'],
    ['a relative path', '/releases/tag/v0.1.7'],
    ['an empty href', ''],
    ['a missing href', null]
  ])('ignores %s', (_label, href) => {
    expect(aiLinkActionFor(href as string | null)).toEqual({ kind: 'ignore' });
  });
});

describe('the two policies agree', () => {
  // `aiLinkActionFor` is `linkActionFor` plus one carve-out. If the carve-out
  // ever grows into a divergence — an href one opens and the other ignores —
  // that is a second policy wearing the first one's name.
  it.each(['https://example.com', 'http://example.com', 'javascript:alert(1)', 'file:///x', 'ftp://example.com', ''])(
    'on %s',
    (href) => {
      const shared = linkActionFor(href);
      const ai = aiLinkActionFor(href);
      expect(ai.kind === 'open').toBe(shared === 'open');
    }
  );
});
