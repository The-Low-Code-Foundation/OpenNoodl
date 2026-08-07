/**
 * Syntax diagnostics from the Lezer tree.
 *
 * CED-001 (A3). The previous approach ran the document through `new Function(...)`
 * and regexed the thrown message for `line (\d+)` — which V8 almost never emits, so
 * every diagnostic ended up spanning the whole document.
 *
 * The language extension (`javascript()` / `json()`) already builds and incrementally
 * maintains a Lezer parse tree, and an incremental parser marks exactly where it lost
 * the thread: error nodes. Walking for those gives real positions for free.
 *
 * @module code-editor/utils
 */

import { ensureSyntaxTree, syntaxTree } from '@codemirror/language';
import type { Diagnostic } from '@codemirror/lint';
import type { EditorState } from '@codemirror/state';

/**
 * A document that is being typed into is briefly a document full of syntax errors.
 * Reporting every one of them turns the gutter into a wall, so cap the run.
 */
const MAX_DIAGNOSTICS = 20;

/**
 * How long to let the parser catch up before falling back to whatever it has.
 *
 * `syntaxTree` alone only returns the part of the document parsed for the current
 * viewport, so diagnostics would stop at the fold of a long script — and in a state
 * with no view attached (a headless test) it can be empty altogether.
 */
const PARSE_BUDGET_MS = 100;

/** How much of the offending text to quote back in the message. */
const MESSAGE_EXCERPT = 24;

/**
 * Lezer reports the position where the parse failed, which is often zero-length
 * (the parser noticed *between* two tokens). A zero-length range draws nothing, so
 * widen it onto the neighbouring character.
 *
 * Exported for `esLintDiagnostics.ts`, which has the same problem from a different
 * parser — one helper, not a twin.
 */
export function widen(state: EditorState, from: number, to: number): { from: number; to: number } {
  if (to > from) {
    return { from, to };
  }

  const line = state.doc.lineAt(from);

  if (from < line.to) {
    return { from, to: from + 1 };
  }

  if (from > line.from) {
    return { from: from - 1, to: from };
  }

  // An empty line — nothing to point at but the line itself.
  return { from: line.from, to: line.to };
}

function describe(state: EditorState, from: number, to: number, wasEmpty: boolean): string {
  if (wasEmpty) {
    return from >= state.doc.length ? 'Unexpected end of input' : 'Unexpected token';
  }

  const text = state.doc.sliceString(from, Math.min(to, from + MESSAGE_EXCERPT)).trim();
  return text ? `Unexpected \`${text}\`` : 'Unexpected token';
}

/**
 * Walk the parse tree and report every position the parser could not make sense of.
 *
 * Adjacent or overlapping errors are merged — a single missing bracket can leave the
 * parser confused for several tokens, and that reads as one problem, not five.
 */
export function syntaxDiagnostics(state: EditorState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const tree = ensureSyntaxTree(state, state.doc.length, PARSE_BUDGET_MS) ?? syntaxTree(state);

  tree
    .cursor()
    .iterate((node) => {
      if (!node.type.isError) {
        return;
      }

      const wasEmpty = node.to === node.from;
      const { from, to } = widen(state, node.from, node.to);

      const previous = diagnostics[diagnostics.length - 1];
      if (previous && from <= previous.to) {
        previous.to = Math.max(previous.to, to);
        return;
      }

      if (diagnostics.length >= MAX_DIAGNOSTICS) {
        return;
      }

      diagnostics.push({
        from,
        to,
        severity: 'error',
        message: describe(state, from, to, wasEmpty)
      });
    });

  return diagnostics;
}

/**
 * 1-based line and column of the first thing the parser could not read.
 *
 * The error panel below the editor shows a position, and the engine rarely supplies
 * one: `new Function` never does, and `JSON.parse` only for some error classes. The
 * parse tree always knows.
 */
export function firstErrorPosition(state: EditorState): { line: number; column: number } | undefined {
  const [first] = syntaxDiagnostics(state);
  if (!first) {
    return undefined;
  }

  const line = state.doc.lineAt(first.from);
  return { line: line.number, column: first.from - line.from + 1 };
}
