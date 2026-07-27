/**
 * A small markdown mode for CodeMirror 6.
 *
 * AIX-009 needs a *source view* for project docs — a toggle beside the rendered
 * Markdown, in a panel that is deliberately not a markdown IDE. That wants
 * headings, emphasis, code and links to be visually distinct; it does not want
 * a full CommonMark parser.
 *
 * The spec proposed adding `@codemirror/lang-markdown`. This does the job with
 * `StreamLanguage`, which `@codemirror/language` already ships, for two
 * reasons: `lang-markdown` pulls `@codemirror/lang-html`, `@lezer/markdown` and
 * `@lezer/common` behind it (a lot of parser for a viewer), and adding any new
 * dependency leaves every checkout unbuildable until someone runs `npm install`
 * — a trap this repo has already been bitten by. If richer markdown editing is
 * ever wanted, swapping this for `markdown()` is a one-line change in
 * {@link MarkdownEditor}.
 *
 * @module code-editor
 */

import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StreamParser } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';

interface MarkdownState {
  /** Inside a fenced ``` block — everything is code until the closing fence. */
  inFence: boolean;
}

/**
 * Line-oriented, deliberately shallow: it recognises what a person scanning a
 * doc looks for (structure, code, links, emphasis) and does not attempt nesting.
 */
const markdownParser: StreamParser<MarkdownState> = {
  name: 'markdown',

  startState: () => ({ inFence: false }),

  token(stream, state) {
    if (stream.sol()) {
      // Fences first: inside one, nothing else applies.
      if (stream.match(/^\s*(```|~~~)/)) {
        state.inFence = !state.inFence;
        stream.skipToEnd();
        return 'meta';
      }
      if (state.inFence) {
        stream.skipToEnd();
        return 'string';
      }
      if (stream.match(/^#{1,6}\s.*/)) {
        return 'heading';
      }
      if (stream.match(/^\s*>/)) {
        stream.skipToEnd();
        return 'quote';
      }
      if (stream.match(/^\s*([-*+]|\d+\.)\s/)) {
        return 'list';
      }
      if (stream.match(/^\s*(-{3,}|={3,}|\*{3,})\s*$/)) {
        return 'meta';
      }
      // HTML comments are how the seed templates carry their instructions.
      if (stream.match(/^\s*<!--/)) {
        state.inFence = false;
        stream.skipToEnd();
        return 'comment';
      }
    }

    if (state.inFence) {
      stream.skipToEnd();
      return 'string';
    }

    // Token names are resolved against @lezer/highlight's tag names, so they
    // must BE tag names — "monospace", not "code" (which silently warns).
    if (stream.match(/`[^`]*`/)) return 'monospace';
    if (stream.match(/\*\*[^*]+\*\*/) || stream.match(/__[^_]+__/)) return 'strong';
    if (stream.match(/\*[^*]+\*/) || stream.match(/_[^_]+_/)) return 'emphasis';
    if (stream.match(/\[[^\]]*\]\([^)]*\)/)) return 'link';

    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { block: { open: '<!--', close: '-->' } }
  }
};

export const markdownLanguage = StreamLanguage.define(markdownParser);

/**
 * Markdown colours, on the same CSS custom properties the JavaScript theme
 * uses, so a doc and a Function node look like the same editor.
 */
const markdownHighlight = HighlightStyle.define([
  { tag: t.heading, color: 'var(--theme-color-syntax-keyword)', fontWeight: 'bold' },
  { tag: t.quote, color: 'var(--theme-color-syntax-comment)', fontStyle: 'italic' },
  { tag: t.list, color: 'var(--theme-color-syntax-control)' },
  { tag: t.monospace, color: 'var(--theme-color-syntax-string)' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.link, color: 'var(--theme-color-syntax-property)', textDecoration: 'underline' },
  { tag: t.meta, color: 'var(--theme-color-syntax-punctuation)' },
  { tag: t.string, color: 'var(--theme-color-syntax-string)' },
  { tag: t.comment, color: 'var(--theme-color-syntax-comment)', fontStyle: 'italic' }
]);

/** Language + highlighting, ready to drop into an EditorState. */
export function markdownExtensions(): Extension[] {
  return [markdownLanguage, syntaxHighlighting(markdownHighlight)];
}
