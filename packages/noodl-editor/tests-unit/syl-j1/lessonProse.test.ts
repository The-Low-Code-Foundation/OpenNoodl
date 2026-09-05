/**
 * P79 J1 — lesson prose loses the sentence the lesson exists to teach.
 *
 * Measured by the session-8 lesson-runner drive: in `Poke it` step 0 the DOM had
 * `blockquotes: 0` and the rendered text read
 *
 *   > *An event is a pulse. It says something just happened and carries no value with it.*
 *
 * with the `>` and the asterisks literal. Re-measured here at HEAD, and the drive's
 * observation reproduces exactly — but its DIAGNOSIS ("the blockquote construct falls
 * through, taking its inline emphasis with it") is wrong. There are TWO independent
 * defects in that one line, and only the first is about blockquotes:
 *
 *  1. `renderMarkdown` has no blockquote branch, so `> …` falls to the paragraph
 *     branch and `escapeHtml` turns the marker into a literal `&gt;`.
 *
 *  2. `inlineMarkdown`'s bold rule matched its content with the class `[^*]+` — which
 *     forbids `*`, so bold containing nested emphasis never matched. The single-star
 *     rule then paired across the wrong spans, so the emphasised words rendered PLAIN
 *     and the plain words rendered ITALIC, leaving two stray `*`. That bites any nested
 *     emphasis anywhere in any lesson, blockquote or not — which is why it gets its own
 *     cases below rather than riding on the blockquote ones.
 */
import * as fs from 'fs';
import * as path from 'path';

import { renderMarkdown } from '@noodl-models/lessonformat';

/** The real line from the shipped `poke-it` bundle, verbatim. */
const POKE_IT_LINE =
  '> **An event is a pulse. It says *something just happened* and carries no value with it.**';

const LESSONS_DIR = path.resolve(__dirname, '../../../../project-examples/lessons');

describe('J1(a) — a blockquote is a blockquote', () => {
  it('renders `> …` as a blockquote, not a literal >', () => {
    const html = renderMarkdown('> quoted line');
    expect(html).toContain('<blockquote>');
    expect(html).not.toContain('&gt;');
    expect(text(html)).toBe('quoted line');
  });

  it('keeps a multi-line blockquote as one quote', () => {
    const html = renderMarkdown('> first line\n> second line');
    expect((html.match(/<blockquote>/g) || []).length).toBe(1);
    expect(text(html)).toContain('first line');
    expect(text(html)).toContain('second line');
  });

  it('renders inline markdown INSIDE the quote', () => {
    const html = renderMarkdown('> a **bold** word');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<strong>bold</strong>');
  });

  // The control that keeps the fix honest: a `>` that is not a block marker must
  // stay escaped. Without this, "render every > raw" would pass every case above.
  it('leaves a mid-sentence > escaped and unquoted', () => {
    const html = renderMarkdown('the value a > b is true');
    expect(html).not.toContain('<blockquote>');
    expect(html).toContain('&gt;');
  });
});

describe('J1(b) — bold containing nested emphasis', () => {
  it('emphasises the words the author emphasised, and no others', () => {
    const html = renderMarkdown('**bold with *nested* inside**');
    expect(html).toBe('<p><strong>bold with <em>nested</em> inside</strong></p>');
  });

  it('leaves no stray asterisk behind', () => {
    expect(renderMarkdown('**bold with *nested* inside**')).not.toContain('*');
  });
});

describe('J1(c) — a code span is opaque to emphasis', () => {
  // The corpus row below catches this too, but only while `moods` happens to contain a
  // multiplication. Edit that lesson and the corpus row goes green with the defect live,
  // so the property gets a case that does not depend on any lesson's wording.
  it('does not read a * inside code as an emphasis marker', () => {
    const html = renderMarkdown('`min(96 + pokes * 8, 200)` answered *how much*.');
    expect(html).toBe('<p><code>min(96 + pokes * 8, 200)</code> answered <em>how much</em>.</p>');
  });

  it('leaves every tag properly nested', () => {
    const html = renderMarkdown('`a * b` and *stress* and `c * d`');
    expect(html).not.toMatch(/<code>[^<]*<em>/); // an <em> opened inside a code span
    expect((html.match(/<em>/g) || []).length).toBe((html.match(/<\/em>/g) || []).length);
  });

  it('does not read an _ inside code as an emphasis marker', () => {
    expect(renderMarkdown('`snake_case_name` and *stress*')).toBe(
      '<p><code>snake_case_name</code> and <em>stress</em></p>'
    );
  });
});

describe('the shipped line, end to end', () => {
  it('renders Poke it step 0 as a quote with the right words emphasised', () => {
    const html = renderMarkdown(POKE_IT_LINE);

    expect(html).toContain('<blockquote>');
    expect(html).toContain('<em>something just happened</em>');
    expect(html).not.toContain('*');
    expect(html).not.toContain('&gt;');
    expect(text(html)).toBe(
      'An event is a pulse. It says something just happened and carries no value with it.'
    );
  });
});

describe('the shipped bundles', () => {
  const bundles = fs
    .readdirSync(LESSONS_DIR)
    .filter((d) => fs.existsSync(path.join(LESSONS_DIR, d, 'lesson.json')));

  it('finds the eight shipped lessons', () => {
    expect(bundles.length).toBe(8);
  });

  it.each(bundles)('%s renders no literal markdown marker', (bundle) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(LESSONS_DIR, bundle, 'lesson.json'), 'utf8'));

    for (const [where, prose] of proseFields(manifest)) {
      const html = renderMarkdown(prose);

      // A `>` opening a rendered line is the J1 symptom.
      expect(`${where}: ${html}`).not.toMatch(/(?:^|<p>|<br>|<blockquote>)&gt;/);

      // A leftover `*` outside a code span is the nested-emphasis symptom. Code spans
      // legitimately carry one, so they are removed before the check rather than
      // exempting the whole field.
      expect(`${where}: ${html.replace(/<code>[\s\S]*?<\/code>/g, '')}`).not.toContain('*');
    }
  });
});

/** Every markdown-bearing string in a manifest, with a path for the failure message. */
function proseFields(manifest: unknown): [string, string][] {
  const out: [string, string][] = [];
  const KEYS = new Set(['body', 'detail', 'title', 'description', 'instructions']);

  const walk = (value: unknown, where: string): void => {
    if (typeof value === 'string') {
      const key = where.slice(where.lastIndexOf('/') + 1).replace(/\[\d+\]$/, '');
      if (KEYS.has(key)) out.push([where, value]);
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${where}[${i}]`));
    } else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, `${where}/${k}`);
    }
  };

  walk(manifest, '');
  return out;
}

/** Rendered text as a reader sees it — tags dropped, entities resolved. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

/**
 * The behaviour that must NOT have moved.
 *
 * These eight are the existing assertions from `tests/lessons/lessonformat.test.ts`, restated
 * here on purpose: that spec runs only inside the editor's webpack+Electron `test:ci` bundle,
 * so a change to this renderer could sit red for a whole session before anyone saw it. Both
 * fixes above rewrite rules that every one of these depends on — the bold rule and the code
 * rule especially — so the cheap runner should be able to say they still hold.
 */
describe('unchanged behaviour', () => {
  it('renders inline bold, code and links as before', () => {
    expect(renderMarkdown('Drag a **Group** node')).toBe('<p>Drag a <strong>Group</strong> node</p>');
    expect(renderMarkdown('press `Ctrl`')).toBe('<p>press <code>Ctrl</code></p>');
    expect(renderMarkdown('see [docs](https://x)')).toBe('<p>see <a href="https://x">docs</a></p>');
  });

  it('renders headings and lists as before', () => {
    expect(renderMarkdown('## Title')).toBe('<h2>Title</h2>');
    expect(renderMarkdown('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>');
    expect(renderMarkdown('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>');
  });

  it('still escapes HTML and still breaks paragraphs the same way', () => {
    expect(renderMarkdown('a < b & c')).toBe('<p>a &lt; b &amp; c</p>');
    expect(renderMarkdown('one\ntwo\n\nthree')).toBe('<p>one<br>two</p>\n<p>three</p>');
  });

  it('🔴 still refuses a javascript: href — the sink is unchanged', () => {
    // The property, not a transcript: the compiled HTML reaches `innerHTML` inside a renderer
    // with node integration, so what matters is that no such scheme survives as an href. The
    // refused link keeps its words by design (see `safeLessonUrl`).
    for (const md of ['[click](javascript:alert)', '[click](javascript:alert(1))', '[click](JaVaScRiPt:x)']) {
      const html = renderMarkdown(md);
      expect(html).not.toContain('href');
      expect(html).toContain('click');
    }
    // A permitted scheme still becomes a link, so the check above is not passing vacuously.
    expect(renderMarkdown('[click](https://x.dev)')).toContain('href="https://x.dev"');
  });
});
