/**
 * Where the cursor is, for completion sources that need to know.
 *
 * FH-017 (slice 1). Both completion sources in this component used the same
 * guard — `word.from === word.to && !context.explicit` — to avoid popping a
 * menu at every empty position. It is the right instinct and the wrong test:
 * the word after a `.` is *always* zero-length, so `Noodl.` (the single most
 * useful trigger in a Noodl script) was the one place the guard fired, and
 * the `Noodl.`-branch below it was unreachable except by Ctrl-Space.
 *
 * The distinction the guard actually wants is member position vs top level.
 *
 * @module code-editor/utils
 */

import type { CompletionContext } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';

/**
 * Is `pos` immediately after a `.` — i.e. is the user completing a member of
 * something, rather than typing a fresh identifier?
 *
 * Only the character matters, not what precedes it: a source that completes
 * top-level names has no business answering here whatever the object is, and
 * a source that completes a *specific* object's members checks for that object
 * itself (see `noodlCompletionSource`).
 */
export function isMemberPosition(context: CompletionContext, pos: number): boolean {
  return pos > 0 && context.state.doc.sliceString(pos - 1, pos) === '.';
}

/**
 * Should a source that completes top-level identifiers answer at all?
 *
 * No at a member position (`foo.` is not the place to offer `Math.min`), and
 * no at an empty position unless the completion was asked for explicitly.
 */
export function completesTopLevel(context: CompletionContext, word: { from: number; to: number }): boolean {
  if (isMemberPosition(context, word.from)) return false;
  return word.from !== word.to || context.explicit;
}

/**
 * Is the cursor naming something, rather than referring to something?
 *
 * FUN-008 §3's third exclusion. `var Inp…` is someone binding a local; offering
 * `Inputs.Input_1` there produces `var Inputs.Input_1`, which is a syntax error —
 * a completion that breaks the document is worse than no completion. FUN-004's
 * message 2 is the right answer for that line anyway, and it fires on the same
 * text.
 *
 * `VariableDefinition` is the Lezer node for exactly this and for nothing else:
 * measured against `@codemirror/lang-javascript`'s own parse, `var Inp`, `let Inp`,
 * `const Inp` and `function Inp` all resolve to it at the cursor, while `return Inp`,
 * `x = Inp` and a bare `Inp` resolve to `VariableName`. It also covers parameter
 * lists, which the text-matching version of this test would have missed.
 */
export function isDeclarationPosition(context: CompletionContext, pos: number): boolean {
  return syntaxTree(context.state).resolveInner(pos, -1).name === 'VariableDefinition';
}
