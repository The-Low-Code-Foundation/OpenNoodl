/**
 * Telling the editor's own echo apart from a real edit.
 *
 * CED-001 (A7). `JavaScriptEditor` is a controlled component: it reports edits through
 * `onChange` and accepts a `value` back. Without a marker, pushing that value into the
 * document looks exactly like the user typing it, and the component reports it straight
 * back out again.
 *
 * The previous guard was a pair of generation counters, and it was broken: the counter
 * that unblocked the guard was only advanced inside the block the guard prevented, so
 * from the first keystroke onwards the `value` prop was ignored entirely. Annotating the
 * transaction is the standard CodeMirror answer and has no state to get out of step.
 *
 * Lives apart from `codemirror-extensions.ts` so it can be tested without pulling in
 * `@codemirror/view`, which wants a DOM.
 *
 * @module code-editor/utils
 */

import { Annotation, type Transaction } from '@codemirror/state';

/**
 * Marks a transaction dispatched purely to bring the document in line with an
 * externally-supplied `value`.
 *
 * Deliberately *not* applied to the component's other programmatic dispatches —
 * Format, and restoring a snapshot — because those are real edits the consumer needs
 * to hear about.
 */
export const externalValueSync = Annotation.define<boolean>();

/**
 * Whether an update consists only of the component's own echo of the `value` prop.
 */
export function isExternalValueSync(transactions: readonly Transaction[]): boolean {
  return transactions.some((transaction) => transaction.annotation(externalValueSync) === true);
}
