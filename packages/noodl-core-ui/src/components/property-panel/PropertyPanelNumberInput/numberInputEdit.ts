import { extractNumber } from '../../../utils/extractNumber';

/**
 * REL-014 — what `PropertyPanelNumberInput` does with one typed edit, lifted out
 * of the component so it can be graded without a renderer.
 *
 * ## 🔴 Why this exists: the field was swallowing the value before the row saw it
 *
 * `BasicType` is the only row that selects `PropertyPanelInputType.Number`, and
 * its `onChange` decides what a plain `number` port stores. But `handleUpdate`
 * used to be:
 *
 * ```
 * const newNumber = extractNumber(inputValue);
 * if (!isNaN(newNumber)) { …commit… }
 * ```
 *
 * — with **no else**. Text this field could not read as a number never reached
 * `onChange` at all: nothing was written, nothing snapped back, and the input sat
 * there displaying `var(--space-4)` while the model held something else. So a
 * token typed into a plain number field looked accepted and was gone on the next
 * render, and the row below could not have kept it however carefully it tried.
 * That is the "build the caller" half of REL-014's third and fourth copies —
 * fixing `BasicType` alone would have been dead code.
 *
 * ## The three outcomes, and why the third is a hand-off rather than a decision
 *
 * ⚠️ **This component deliberately does not know what a design token is.** It is
 * in `noodl-core-ui`, which has no business importing the editor's
 * `readNumberFieldEdit`, and a fourth cross-package copy of the token rule is
 * exactly the drift REL-014 was filed about. So `passthrough` means *"not a
 * number — your call"*: the row that owns the port decides whether the text is a
 * token to keep or an edit to refuse, and the component's job is only to stop
 * destroying the answer on the way there.
 */
export type NumberInputEdit =
  /** An emptied field. The row clears the parameter. */
  | { kind: 'empty' }
  /** A number the field read out of the text, and the text it will display for it. */
  | { kind: 'number'; value: number; text: string }
  /** Not a number. Handed to the row verbatim; see the module note. */
  | { kind: 'passthrough'; text: string };

/**
 * Read one typed edit.
 *
 * ⚠️ `extractNumber`'s tolerance is kept exactly as it was — it strips everything
 * but digits, `.` and `-` before `parseFloat`, so `12px` is `12` and `1-2` is `1`.
 * Narrowing that would be a second behaviour change riding along with this one.
 * Note what it does with a token: `var(--space-4)` reduces to `---4`, which is
 * `NaN`, so a token has always landed in the branch that did nothing.
 */
export function readNumberInputText(text: string): NumberInputEdit {
  if (text === '') return { kind: 'empty' };

  const value = extractNumber(text);
  if (!isNaN(value)) return { kind: 'number', value, text: value.toString() };

  return { kind: 'passthrough', text };
}
