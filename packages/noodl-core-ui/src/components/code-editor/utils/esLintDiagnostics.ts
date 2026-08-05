/**
 * JavaScript diagnostics from ESLint.
 *
 * FH-017 slice 3, on TALK-002's decision to take the `eslint-linter-browserify`
 * dependency rather than hand-roll parse-error anchoring.
 *
 * What this replaces, and what it does *not*: the Lezer error walk in
 * `syntaxDiagnostics.ts` reported "Unexpected token" and nothing else. ESLint
 * reports the same class of parse error — **at the same place**, because an
 * unterminated block is a parse failure at end-of-input for acorn exactly as it
 * is for Lezer; no parser points at the opening brace — but it also reports
 * *semantic* problems, which are the plural, stable, real-position diagnostics
 * this editor has never had. `Outputs.x = totl` is the case that matters: today
 * it is silently valid until the app runs.
 *
 * `syntaxDiagnostics.ts` stays, for JSON. This module is JavaScript only.
 *
 * ## Which identifiers exist
 *
 * Not guessed — read off the runtime:
 *
 * - A **Function/Script** node's body is compiled as
 *   `new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', prefix + script)`
 *   (`noodl-runtime/src/nodes/std-library/simplejavascript.ts:447-453`), where the
 *   prefix declares `Script` from `Node`
 *   (`javascriptnodeparser.js:492-494`).
 * - An **Expression** node compiles with *its own input names as parameters* —
 *   every undeclared identifier in an expression **becomes an input port**
 *   (`expression.ts:357`). There is therefore no such thing as an undefined
 *   variable in an expression, and `no-undef` is off for that mode. Turning it
 *   on would underline every input the author just created.
 *
 * `no-undef` is a **warning**, never an error, in the modes that do run it: a
 * project can put a registered library's global on `window`
 * (`library-completions.ts`), and until [FH-019] threads those names in, a
 * confident red mark on working code would be worse than the gap it closes.
 *
 * @module code-editor/utils
 */

import type { Diagnostic } from '@codemirror/lint';
import type { EditorState } from '@codemirror/state';
import { Linter } from 'eslint-linter-browserify';
import globals from 'globals';

import { widen } from './syntaxDiagnostics';
import type { ValidationType } from './types';

/** A diagnostic in *document* coordinates: 1-based line, 1-based column. */
export interface LintMessage {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning';
  ruleId: string | null;
}

/**
 * Identifiers the Noodl runtime supplies to a Function/Script node body.
 * `Node` is referenced by the code prefix under `typeof`, and is a real global
 * for the older Script path (`javascriptnodeparser.js:22`).
 */
const NOODL_FUNCTION_GLOBALS: Record<string, 'readonly' | 'writable'> = {
  Inputs: 'readonly',
  Outputs: 'writable',
  Noodl: 'readonly',
  Component: 'readonly',
  Script: 'readonly',
  Node: 'readonly'
};

/**
 * Rules that cannot be wrong about working code — every one of them describes a
 * structure that is a mistake in any program, with no dependence on what is in
 * scope. These are the only rules allowed to report as errors.
 */
const STRUCTURAL_RULES = {
  'no-const-assign': 'error',
  'no-dupe-args': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-else-if': 'error',
  'no-duplicate-case': 'error',
  'no-func-assign': 'error',
  'no-obj-calls': 'error',
  'no-self-assign': 'error',
  'no-unsafe-negation': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-unreachable': 'warn'
} as const;

const linter = new Linter();

/** The flat config for a mode, or `null` if this mode is not JavaScript. */
function configFor(validationType: ValidationType) {
  const shared = {
    languageOptions: {
      ecmaVersion: 2022 as const,
      sourceType: 'script' as const,
      parserOptions: {
        // A node's code is a function *body*: `return` at top level is correct.
        ecmaFeatures: { globalReturn: true }
      },
      globals: {
        ...globals.browser,
        ...NOODL_FUNCTION_GLOBALS
      }
    }
  };

  switch (validationType) {
    case 'function':
    case 'script':
      return {
        ...shared,
        rules: { ...STRUCTURAL_RULES, 'no-undef': 'warn' }
      };

    case 'expression':
      // See the module header: an unknown identifier here is a feature.
      return {
        ...shared,
        rules: { ...STRUCTURAL_RULES }
      };

    default:
      return null;
  }
}

/**
 * An expression is not a program. `{ a: 1, b: 2 }` on its own line is a block
 * containing a syntax error; wrapped, it is an object. The runtime wraps too,
 * and so did the validator this replaces (`jsValidator.ts`'s `return (${code})`).
 *
 * The wrapper is put on its **own line** so mapping back is a line shift and
 * columns never move.
 */
const EXPRESSION_PREFIX = 'return (\n';
const EXPRESSION_SUFFIX = '\n);';

/**
 * Run ESLint over a document and return its messages in document coordinates.
 *
 * Pure and view-free, so it can be tested without a DOM.
 */
export function lintMessages(code: string, validationType: ValidationType): LintMessage[] {
  const config = configFor(validationType);
  if (!config) return [];
  if (!code || code.trim() === '') return [];

  const wraps = validationType === 'expression';
  const source = wraps ? EXPRESSION_PREFIX + code + EXPRESSION_SUFFIX : code;
  const lineShift = wraps ? 1 : 0;
  const lastCodeLine = code.split('\n').length + lineShift;

  let raw;
  try {
    raw = linter.verify(source, config);
  } catch (error) {
    // A linter that cannot run must not take the editor down with it, and must
    // not invent a problem in the user's code either.
    console.error('[code-editor] ESLint failed to run:', error);
    return [];
  }

  const lastLine = lastCodeLine - lineShift;
  const messages: LintMessage[] = [];

  for (const message of raw) {
    if (typeof message.line !== 'number') continue;

    const line = message.line - lineShift;

    // The prefix line is not the author's text; nothing there is their problem.
    if (line < 1) continue;

    // An unterminated expression fails at the wrapper's closing `);`. That is a
    // real error about real text — move it onto the last line the author wrote
    // rather than dropping it, and don't carry a column from a line that isn't
    // the one being reported.
    const moved = line > lastLine;
    const at = moved ? lastLine : line;

    messages.push({
      line: at,
      column: moved ? 1 : (message.column ?? 1),
      ...(moved ? {} : endOf(message, lineShift)),
      message: stripParsingPrefix(message.message),
      severity: message.severity === 1 ? 'warning' : 'error',
      ruleId: message.ruleId ?? null
    });
  }

  return messages;
}

/** The end of a range, in document coordinates, when ESLint supplies one. */
function endOf(
  message: { endLine?: number | null; endColumn?: number | null },
  lineShift: number
): { endLine?: number; endColumn?: number } {
  if (typeof message.endLine !== 'number' || typeof message.endColumn !== 'number') return {};
  return { endLine: message.endLine - lineShift, endColumn: message.endColumn };
}

/**
 * "Parsing error: Unexpected token" says the same thing twice in a panel whose
 * heading is already the problem. Keep the sentence, drop the label.
 */
function stripParsingPrefix(message: string): string {
  return message.replace(/^Parsing error:\s*/, '');
}

/** A 1-based line/column in document coordinates, as a document offset. */
function offsetOf(state: EditorState, line: number, column: number): number {
  const bounded = Math.min(Math.max(line, 1), state.doc.lines);
  const docLine = state.doc.line(bounded);
  return Math.min(docLine.from + Math.max(column - 1, 0), docLine.to);
}

/**
 * CodeMirror diagnostics for a JavaScript document.
 *
 * The rule name travels in `source`, which is what CM's diagnostics panel shows
 * beside the message — so "'totl' is not defined" carries `eslint:no-undef` and
 * the reader can tell a typo report from a parse failure.
 */
export function javascriptDiagnostics(state: EditorState, validationType: ValidationType): Diagnostic[] {
  const messages = lintMessages(state.doc.toString(), validationType);

  return messages.map((message) => {
    const from = offsetOf(state, message.line, message.column);
    const to =
      message.endLine !== undefined && message.endColumn !== undefined
        ? Math.max(offsetOf(state, message.endLine, message.endColumn), from)
        : from;

    return {
      ...widen(state, from, to),
      severity: message.severity,
      message: message.message,
      source: message.ruleId ? `eslint:${message.ruleId}` : 'eslint'
    };
  });
}
