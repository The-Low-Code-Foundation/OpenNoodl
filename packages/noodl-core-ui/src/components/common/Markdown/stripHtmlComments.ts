/**
 * AIB-006 — HTML comments, removed before they can swallow the page.
 *
 * Remarkable terminates an HTML comment block at the first **blank line**, not
 * at `-->`. A comment spanning a paragraph break is therefore emitted with its
 * opening `<!--` and *without* its closer — verified against the real
 * CONVENTIONS.md template: one `<!--` in the rendered output, zero `-->`. The
 * browser opens a comment that never closes and swallows the entire rest of the
 * document, which is why a 3,081-character file previewed as a lone `<h1>`.
 *
 * Stripping at the source rather than sanitising the output is both the smaller
 * change and the more complete one: a preview has no use for comments, and this
 * makes it structurally impossible for any document — including the
 * model-authored ones the Docs panel now shows — to blank itself this way.
 *
 * Its own module, with no stylesheet import, so the rule is testable in the
 * plain-Node runner rather than only inside a rendered React tree.
 *
 * @module noodl-core-ui/components/common/Markdown/stripHtmlComments
 */

/**
 * A fenced code block (``` or ~~~) or an inline code span.
 *
 * These are the regions where `<!--` is *content* rather than markup, and this
 * component renders the editor's AI chat as well as the Docs panel — a model
 * explaining an HTML comment in a code fence must see its own example intact.
 * Stripping inside them would trade one silent corruption for another.
 */
const CODE_REGION = /(^|\n)(```|~~~)[\s\S]*?\n\2[^\n]*|`[^`\n]*`/g;

/**
 * Remove HTML comments from markdown source, outside code.
 *
 * Two passes over each non-code region, and the second is the one that closes
 * the hole:
 *
 *  1. well-formed comments go whole, however many blank lines they span;
 *  2. any `<!--` or `-->` left over — a genuinely unterminated comment, which is
 *     exactly what a half-written doc contains — has its token removed, so the
 *     content around it still renders. Losing a stray marker beats losing the
 *     document.
 *
 * The raw/edit view is a different component and still shows everything.
 */
export function stripHtmlComments(content: string): string {
  const out: string[] = [];
  let cursor = 0;
  for (const match of content.matchAll(CODE_REGION)) {
    out.push(stripOutsideCode(content.slice(cursor, match.index)));
    out.push(match[0]);
    cursor = match.index! + match[0].length;
  }
  out.push(stripOutsideCode(content.slice(cursor)));
  return out.join('');
}

function stripOutsideCode(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '').replace(/<!--|-->/g, '');
}
