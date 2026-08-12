/**
 * The error the node threw **when it last ran**, shown in the gutter beside the
 * line that threw.
 *
 * FUN-007 §2. The runtime half has been built and driven since 2026-08-12: a
 * throw inside a Function body is caught, its stack line is mapped back to the
 * author's document by `functionDiagnostics.ts#userPositionForError`, and the
 * mapped `line`, `column` and `hint` ride along on the warning payload. Nothing
 * rendered any of it. The whole of §2 is putting those three fields on screen.
 *
 * ## Why this is not a lint rule
 *
 * Everything else in the gutter is a claim about the text: ESLint read it and
 * something is wrong. This is a claim about **an execution that already
 * happened** — the node ran, this line threw. The two look identical in the
 * gutter and behave completely differently:
 *
 * - A lint diagnostic is a pure function of the document, so it is recomputed on
 *   every keystroke and is always current.
 * - A runtime diagnostic is a fact about a body that has since possibly been
 *   edited. Nothing recomputes it, and **the moment the text changes it stops
 *   being true**.
 *
 * So this field clears itself on `docChanged` rather than waiting to be told.
 * That is the same reasoning `simplejavascript.ts:171-176` applies to
 * `parseError` — *"a stale `parseError` left here would make the next `Run`
 * report a syntax error the author has already deleted"* — and FUN-007 §2's own
 * ⚠️ asks for it explicitly. It also means a stale error cannot survive in this
 * editor even if the producer forgets to clear it, which given F31 (a warning
 * that stranded and never cleared) is worth having as a floor rather than a
 * courtesy.
 *
 * ## ⚠️ The line number arrives already mapped
 *
 * `line` is **1-based in the author's document**: the runtime has already
 * subtracted `stackLineOffset()`, the measured 3-line prefix that `new
 * AsyncFunction` compiles above the body. Do not adjust it again here. An error
 * anchored one line off accuses innocent code, and there are now two places that
 * could introduce the off-by-one — which is why the spec below drives a body
 * whose *first* line throws.
 *
 * @module code-editor/utils
 */

import type { Diagnostic } from '@codemirror/lint';
import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/**
 * What the last run of this node's code reported.
 *
 * Deliberately not CodeMirror's `Diagnostic`: this crosses a package boundary
 * from the editor, which knows nothing about CodeMirror, and the position is in
 * line/column rather than document offsets.
 */
export interface RuntimeDiagnostic {
  /** 1-based line in the author's document. Already prefix-adjusted. */
  readonly line: number;
  /** 1-based column, as V8 reports it. Optional — the stack does not always carry one. */
  readonly column?: number;
  /**
   * The sentence to show. Already assembled by the runtime's
   * `runtimeErrorMessage` — engine message, plus FUN-004's port hint where the
   * thrown name turned out to be a port.
   */
  readonly message: string;
}

/** Set the runtime diagnostic, or clear it with `null`. */
export const setRuntimeDiagnosticEffect = StateEffect.define<RuntimeDiagnostic | null>();

/**
 * Holds the last run's error until the document changes.
 *
 * ⚠️ The `docChanged` clear is checked **after** the effects, so a producer that
 * sets a diagnostic in the same transaction as a document edit still loses it.
 * That is the correct precedence and not an accident: such a transaction is
 * describing a run of the *old* text.
 */
export const runtimeDiagnosticField = StateField.define<RuntimeDiagnostic | null>({
  create: () => null,

  update(value, tr) {
    let next = value;

    for (const effect of tr.effects) {
      if (effect.is(setRuntimeDiagnosticEffect)) next = effect.value;
    }

    // The text changed, so nothing the last run said about it is still known to
    // be true. See the module header.
    if (tr.docChanged) return null;

    return next;
  }
});

/** Read the held diagnostic. Exported for the spec and for a consumer that wants to ask. */
export function currentRuntimeDiagnostic(state: EditorState): RuntimeDiagnostic | null {
  return state.field(runtimeDiagnosticField, false) ?? null;
}

/**
 * Push a runtime diagnostic into a live editor, or clear it with `null`.
 *
 * Safe to call on a view whose state does not carry the field — a `MarkdownEditor`
 * or a mode with no linter — rather than throwing at the call site.
 */
export function setRuntimeDiagnostic(view: EditorView, diagnostic: RuntimeDiagnostic | null): void {
  if (view.state.field(runtimeDiagnosticField, false) === undefined) return;

  view.dispatch({ effects: setRuntimeDiagnosticEffect.of(diagnostic) });
}

/**
 * Turn the held diagnostic into the gutter's own shape, positioned in the document.
 *
 * ## Clamping, and why it is not defensive padding
 *
 * The document in the editor and the body that ran are the same text *almost*
 * always — but not necessarily: an editor can be opened on a node that threw
 * before the popout existed, and a project can be edited on disk. A line number
 * past the end of the document is therefore reachable without anyone having a
 * bug, and the choice is between dropping the message and anchoring it at the
 * last line. **Anchor it**: the sentence is the valuable part and losing it
 * silently is the failure mode this task exists to end. The clamp is why this
 * cannot throw a `RangeError` into the linter and take the real diagnostics down
 * with it.
 */
export function runtimeDiagnostics(state: EditorState): Diagnostic[] {
  const diagnostic = currentRuntimeDiagnostic(state);
  if (!diagnostic) return [];

  const doc = state.doc;

  // `Text.line` is 1-based and throws outside `[1, doc.lines]`.
  const lineNumber = Math.min(Math.max(Math.floor(diagnostic.line), 1), doc.lines);
  const line = doc.line(lineNumber);

  // V8 columns are 1-based; `line.from` is the offset of the line's first
  // character, so column 1 is `line.from + 0`.
  const rawColumn = diagnostic.column === undefined ? 1 : Math.floor(diagnostic.column);
  const column = Math.min(Math.max(rawColumn, 1), Math.max(line.length, 1));
  const from = Math.min(line.from + column - 1, line.to);

  return [
    {
      from,
      // To the end of the line rather than a single character: the engine gives
      // one position, and a one-character underline under a long expression reads
      // as a typo rather than as "this line threw".
      to: line.to,
      severity: 'error',
      source: 'Last run',
      message: diagnostic.message
    }
  ];
}

/** The state field, for `createExtensions`. */
export function runtimeDiagnosticExtension(): Extension {
  return [runtimeDiagnosticField];
}
