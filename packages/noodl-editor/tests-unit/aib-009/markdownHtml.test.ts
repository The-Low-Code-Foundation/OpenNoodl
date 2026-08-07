/**
 * AIB-009 F2 — model-authored HTML must not reach the editor's renderer.
 *
 * `Markdown.tsx` injects with `dangerouslySetInnerHTML`, in a renderer that can
 * reach `ipcRenderer`. Since AIX-011 criterion 7 the bodies it renders are
 * authored by a model, and since AIX-009 the Docs panel shows them.
 *
 * These specs run against **Remarkable directly, with the component's own
 * options**, rather than through a rendered React tree — `noodl-core-ui` has
 * jest but no jsdom (the same constraint that left AIB-006's criteria 1–2
 * untestable offline). What is being pinned is the parser's behaviour, which is
 * where the fix lives, so the missing DOM costs nothing here.
 *
 * ⚠️ If `Markdown.tsx`'s options ever diverge from `MARKDOWN_OPTIONS` below,
 * this file is testing something the product does not do. The options are
 * duplicated rather than imported because importing the component pulls a
 * `.module.scss` the plain-Node runner cannot resolve.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Remarkable } from 'remarkable';

import { stripHtmlComments } from '../../../noodl-core-ui/src/components/common/Markdown/stripHtmlComments';

/** Must match `Markdown.tsx`. */
const MARKDOWN_OPTIONS = { html: false, breaks: true };

function render(markdown: string): string {
  return new Remarkable(MARKDOWN_OPTIONS).render(stripHtmlComments(markdown));
}

describe('the options under test are the options the component uses', () => {
  it('reads `html: false` out of Markdown.tsx itself', () => {
    // The guard for the duplication above. A comment saying "keep these in
    // sync" is how they come to differ; this fails the moment they do, and it
    // is the whole reason the rest of this file is worth running.
    const source = fs.readFileSync(
      path.join(__dirname, '../../../noodl-core-ui/src/components/common/Markdown/Markdown.tsx'),
      'utf8'
    );
    expect(source).toMatch(/html:\s*false/);
    expect(source).not.toMatch(/html:\s*true/);
  });
});

describe('the Markdown component cannot execute what a model writes', () => {
  const attacks = [
    '<img src=x onerror="alert(1)">',
    '<script>alert(1)</script>',
    'text <b onmouseover=alert(1)>hover</b> text',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<svg/onload=alert(1)>',
    '<a href="javascript:alert(1)">click</a>',
    '<style>body{background:url("javascript:alert(1)")}</style>',
    // The realistic one: a doc a model wrote, with an injected paragraph.
    '# Architecture\n\nThe app is a reading list.\n\n<img src=x onerror="require(\'electron\')">\n'
  ];

  /**
   * Every tag in the output, by name.
   *
   * ⚠️ The obvious assertion — "the output does not match `/ onerror=/`" — is
   * **wrong**, and it failed here before this was written: an escaped
   * `&lt;img src=x onerror=&quot;…&quot;&gt;` contains that substring as *text*
   * and is entirely inert. Substring checks over rendered HTML cannot tell
   * markup from content, which is the same confusion that produces XSS in the
   * first place. What matters is that every `<` in the output opens a tag
   * markdown itself generated.
   */
  function tagsIn(html: string): string[] {
    return [...html.matchAll(/<\/?([a-zA-Z0-9]+)/g)].map((m) => m[1].toLowerCase());
  }

  /** Everything Remarkable emits for the markdown this product renders. */
  const MARKDOWN_TAGS = new Set([
    'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
    'strong', 'em', 'del', 'hr', 'br', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ]);

  for (const attack of attacks) {
    it(`escapes rather than emits: ${attack.slice(0, 40)}`, () => {
      const html = render(attack);
      // Nothing the attacker named became a tag…
      expect(tagsIn(html).filter((t) => !MARKDOWN_TAGS.has(t))).toEqual([]);
      expect(html).not.toMatch(/<(img|script|iframe|svg|style)[\s/>]/i);
      // …and it is still *visible*, escaped rather than deleted. A doc that
      // silently lost a paragraph would be its own defect.
      expect(html).toContain('&lt;');
    });
  }

  it('refuses script-bearing link targets, which is why an allow-list adds nothing', () => {
    // Measured, not assumed: Remarkable's own link validation already declines
    // these, and leaves the markdown literal rather than emitting an anchor.
    for (const href of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='
    ]) {
      const html = render(`[click](${href})`);
      expect(html).not.toContain('<a ');
    }
  });

  it('still renders the markdown the product actually uses', () => {
    // The other half of the trade. Turning HTML off must not degrade the docs,
    // the AI chat or the scoping conversation into plain text.
    expect(render('**bold** and `code`')).toContain('<strong>bold</strong>');
    expect(render('[ok](https://example.com)')).toContain('<a href="https://example.com">ok</a>');
    expect(render('![img](./assets/x.png)')).toContain('<img src="./assets/x.png"');
    expect(render('| a | b |\n|---|---|\n| 1 | 2 |')).toContain('<table>');
    expect(render('- one\n- two')).toContain('<li>');
    expect(render('```js\nconst a = 1;\n```')).toContain('<code');
  });

  it('keeps AIB-006 working: a comment spanning a blank line neither swallows nor shows', () => {
    const withComment = '# Conventions\n\n<!-- a note\n\nspanning a blank line -->\n\nA rule.\n';
    const html = render(withComment);
    expect(html).toContain('<h1>Conventions</h1>');
    expect(html).toContain('A rule.');
    // Not swallowed (AIB-006), and not shown as literal text either — which is
    // the failure mode `html: false` would have introduced without the strip.
    expect(html).not.toContain('spanning a blank line');
    expect(html).not.toContain('&lt;!--');
  });
});
