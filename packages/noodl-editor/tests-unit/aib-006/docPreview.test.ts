/**
 * AIB-006 defect 2 — a document does not blank its own preview.
 *
 * Reported as *"'CONVENTIONS.md' seems to have raw content, but the preview just
 * shows a blank page"*. It is not a content bug and not a CSS bug: Remarkable
 * terminates an HTML comment block at the first **blank line**, not at `-->`, so
 * a comment spanning a paragraph break reaches the DOM as an opening `<!--` with
 * no closer and the browser swallows everything after it.
 *
 * The renderer is asserted through the **real Remarkable, configured exactly as
 * `Markdown.tsx` configures it**, over the **real generated templates** rather
 * than a fixture — because a fixture is precisely what would have let the
 * original defect through: every hand-written test case anyone would think to
 * write has its comment on one line.
 */

import { Remarkable } from 'remarkable';

import { stripHtmlComments } from '../../../noodl-core-ui/src/components/common/Markdown/stripHtmlComments';
import { DOC_TEMPLATES } from '../../src/editor/src/models/ProjectDocs/templates';

/** Exactly what `Markdown.tsx` does, minus React. */
function preview(content: string): string {
  return new Remarkable({ html: true, breaks: true }).render(stripHtmlComments(content));
}

/**
 * What a browser would actually show: everything outside an unclosed comment.
 * This is the assertion that matters — the raw HTML string always *contained*
 * the swallowed content, which is why the defect was invisible to any test that
 * checked the output for a substring.
 */
function visible(html: string): string {
  const opener = html.indexOf('<!--');
  return opener === -1 ? html : html.slice(0, opener);
}

describe('the comment that swallowed a page', () => {
  const SPANS_A_BLANK_LINE = [
    '# Conventions',
    '',
    '<!--',
    '  A note to whoever edits this file.',
    '',
    '  A second paragraph, which is what breaks it.',
    '-->',
    '',
    '## Structure',
    '',
    'The rules go here.'
  ].join('\n');

  it('renders everything after a comment containing a blank line', () => {
    const html = preview(SPANS_A_BLANK_LINE);
    expect(visible(html)).toContain('Structure');
    expect(visible(html)).toContain('The rules go here.');
  });

  it('leaves no comment opener in the output for the browser to act on', () => {
    const html = preview(SPANS_A_BLANK_LINE);
    expect(html).not.toContain('<!--');
  });

  it('is a real Remarkable behaviour, not a straw man', () => {
    // Guards the premise. If a Remarkable upgrade ever fixes this, this spec
    // fails and the strip becomes belt-and-braces rather than load-bearing —
    // which is worth being told about rather than discovering years later.
    const raw = new Remarkable({ html: true, breaks: true }).render(SPANS_A_BLANK_LINE);
    expect((raw.match(/<!--/g) ?? []).length).toBe(1);
    expect((raw.match(/-->/g) ?? []).length).toBe(0);
    expect(visible(raw)).not.toContain('Structure');
  });

  it('survives a comment that is never closed at all', () => {
    const html = preview('# Title\n\n<!-- someone started a note and stopped\n\n## Body\n\nText.');
    expect(html).not.toContain('<!--');
    expect(visible(html)).toContain('Body');
  });

  it('does not disturb a document with no comments', () => {
    const plain = '# Title\n\nSome **bold** text.\n\n- one\n- two\n';
    expect(preview(plain)).toBe(new Remarkable({ html: true, breaks: true }).render(plain));
  });

  it('keeps inline HTML working, which is why html:true is not simply turned off', () => {
    expect(preview('Some <kbd>Ctrl</kbd> text.')).toContain('<kbd>Ctrl</kbd>');
  });

  it('leaves a comment inside a code fence alone — it is content, not markup', () => {
    // `Markdown` also renders the editor's AI chat, so a model explaining an
    // HTML comment must see its own example survive. Stripping everywhere would
    // trade one silent corruption for another.
    const fenced = ['Here is how to comment HTML:', '', '```html', '<!-- a note -->', '```', '', 'Done.'].join('\n');
    const html = preview(fenced);
    expect(html).toContain('&lt;!-- a note --&gt;');
    expect(visible(html)).toContain('Done.');
  });

  it('leaves a comment inside an inline code span alone', () => {
    expect(preview('Write `<!-- like this -->` to comment.')).toContain('&lt;!-- like this --&gt;');
  });

  it('still strips a comment that follows a code fence', () => {
    const mixed = ['```js', 'const a = 1;', '```', '', '<!--', '  a note', '', '  with a blank line', '-->', '', '## After'].join('\n');
    const html = preview(mixed);
    expect(html).not.toContain('<!--\n');
    expect(visible(html)).toContain('After');
  });
});

describe('every generated document previews in full', () => {
  // Criterion 4, against the real templates. Each entry is content that must be
  // visible to a reader — the last section of each document, so anything the
  // renderer swallows takes it with it.
  const MUST_BE_VISIBLE: Record<string, string[]> = {
    brief: ['What this app is', 'Deliberately out of scope'],
    architecture: ['Backend contracts', 'Decisions'],
    conventions: ['How this file is used', 'Structure', 'What not to do']
  };

  for (const [kind, expected] of Object.entries(MUST_BE_VISIBLE)) {
    it(`${kind}: shows every section`, () => {
      const shown = visible(preview(DOC_TEMPLATES[kind as keyof typeof DOC_TEMPLATES]));
      for (const heading of expected) expect(shown).toContain(heading);
    });
  }

  it('CONVENTIONS.md no longer hides its own instructions in a comment', () => {
    // Half 2 of the fix. A 14-line HTML comment at the top of a file the *user*
    // is meant to read and edit is poor design whatever the renderer does — and
    // these instructions are genuinely useful to the human, not just the agent.
    expect(DOC_TEMPLATES.conventions).not.toContain('<!--');
    expect(DOC_TEMPLATES.conventions).toContain('## How this file is used');
    // The (example) rule about (example) lines is the one that keeps the file
    // honest, and it was invisible for the same reason everything else was.
    expect(visible(preview(DOC_TEMPLATES.conventions))).toContain('ignore every line marked (example)');
  });
});
