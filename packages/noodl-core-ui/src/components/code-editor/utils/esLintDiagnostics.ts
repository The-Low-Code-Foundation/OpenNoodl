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
 * `no-undef` is a **warning**, never an error, in the modes that do run it.
 * FH-019 threads the registered libraries' globals in (see
 * {@link projectGlobals}), which removes the most common false positive — but
 * not the last one, because a project can also attach a global from a Script
 * node at runtime, which no static reading of the project can see. A warning is
 * the honest severity for a rule that depends on what is in scope.
 *
 * @module code-editor/utils
 */

import type { Diagnostic } from '@codemirror/lint';
import type { EditorState } from '@codemirror/state';
import { Linter } from 'eslint-linter-browserify';
import globals from 'globals';

import { getCodeAuthoringContext } from '../authoringContext';
import { portDiagnostics } from './portDiagnostics';
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
 * Identifiers the runtime supplies to a node body — **one list per node**,
 * because the two nodes are compiled with different parameters and a single
 * conflated list is wrong in both directions.
 *
 * | node | compiled as |
 * |---|---|
 * | Function (`JavaScriptFunction`) | `AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', prefix + script)` — `simplejavascript.ts:609-619` |
 * | Script (`Javascript2`) | `Function('define', 'script', 'Node', 'Component', prefix + code)` — `javascriptnodeparser.js:22` |
 *
 * 🔴 **The single list this replaces was the union of the two, and it made the
 * editor accuse the Script node's own API.** `define` and `script` were in
 * neither half of it, so `define({ inputs: … })` — the notation
 * `NOTATION_RULES.script` tells the author to write — produced *"No port named
 * define. Create an input port by reading it: `Inputs.define`"*, with a fix-it
 * that inserts notation the Script node does not have. Measured before the split.
 *
 * The mirror is now reportable too: `Inputs`/`Outputs` in a Script node throw,
 * and are handled by message 6 rather than by `no-undef`'s own sentence.
 *
 * ⚠️ **`Noodl` is declared in both, deliberately.** It is a parameter only of the
 * Function, but the Script path reads `window.Noodl` when it is there
 * (`javascriptnodeparser.js#createNoodlAPI`) — so calling it undefined would risk
 * being wrong about working code, which is the one thing `no-undef` may not be
 * here.
 *
 * ⚠️ **`Script` is declared in both** because the shared code prefix declares it
 * (`javascriptnodeparser.js:492-494`, `const Script = …`), and both nodes prepend
 * that prefix.
 *
 * ⚠️ **Removing `Node` from the Function list changes nothing on its own**:
 * `globals.browser` carries the DOM `Node` constructor, so `Node.Signals.X = …`
 * in a Function body still lints clean. That silence is a real gap (FIX-016 §3 —
 * the assignment lands on the DOM constructor and mints no port) and it needs its
 * own rule, not a globals entry.
 */
const FUNCTION_NODE_GLOBALS: Record<string, 'readonly' | 'writable'> = {
  Inputs: 'readonly',
  Outputs: 'writable',
  Noodl: 'readonly',
  Component: 'readonly',
  Script: 'readonly'
};

const SCRIPT_NODE_GLOBALS: Record<string, 'readonly' | 'writable'> = {
  define: 'readonly',
  script: 'readonly',
  Node: 'readonly',
  Noodl: 'readonly',
  Component: 'readonly',
  Script: 'readonly'
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

/**
 * The globals the open project adds — a registered library's `global` is a real
 * `window` property once the app runs, so `no-undef` reporting it is the linter
 * being wrong about working code (ERG-002 §2 finding #4, the diagnostics half).
 *
 * Read per lint pass rather than captured, for the same reason the completion
 * sources read per keystroke: the popout mounts once and outlives any number of
 * changes to Settings → Libraries.
 */
function projectGlobals(): Record<string, 'readonly'> {
  const declared: Record<string, 'readonly'> = {};

  for (const library of getCodeAuthoringContext().libraries) {
    if (library.global && library.global.trim()) declared[library.global.trim()] = 'readonly';
  }

  return declared;
}

/** The flat config for a mode, or `null` if this mode is not JavaScript. */
function configFor(validationType: ValidationType) {
  const shared = (nodeGlobals: Record<string, 'readonly' | 'writable'>) => ({
    languageOptions: {
      ecmaVersion: 2022 as const,
      sourceType: 'script' as const,
      parserOptions: {
        // A node's code is a function *body*: `return` at top level is correct.
        ecmaFeatures: { globalReturn: true }
      },
      globals: {
        ...globals.browser,
        ...nodeGlobals,
        ...projectGlobals()
      }
    }
  });

  switch (validationType) {
    case 'function':
      return {
        ...shared(FUNCTION_NODE_GLOBALS),
        rules: { ...STRUCTURAL_RULES, 'no-undef': 'warn' }
      };

    case 'script':
      return {
        ...shared(SCRIPT_NODE_GLOBALS),
        rules: { ...STRUCTURAL_RULES, 'no-undef': 'warn' }
      };

    case 'expression':
      // See the module header: an unknown identifier here is a feature. The
      // globals hardly matter without `no-undef`; the Function set is the one an
      // expression's own API is closest to.
      return {
        ...shared(FUNCTION_NODE_GLOBALS),
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

  const base = messages.map((message) => {
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

  // FUN-004. Everything above is a claim about JavaScript. This is the pass that
  // knows a name is a *port* — it rewrites `no-undef` where the name turns out to
  // be one, and adds the two rules ESLint cannot express. It is a no-op in every
  // mode without declared ports, `'expression'` most importantly: see the ⚠️ in
  // `portDiagnostics.ts`.
  return portDiagnostics(state, validationType, base);
}
