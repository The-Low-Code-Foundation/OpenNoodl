/**
 * FB-026 — what a Text Input's value ports carry, given its `Type`, in one place.
 *
 * `Type` is not only the on-screen keyboard. **Number** makes the field's value a number, and
 * every `<input>` — `type="number"` included — reports `event.target.value` as a *string*. So a
 * field an author had set to Number published `"5"`, not `5`: `"5" + 1` is `"51"`, a `number`
 * port stores it verbatim, and the only thing that ever said so was FIX-025's dashed wire, which
 * was telling the truth.
 *
 * This module is the single source for the three answers that follow from `Type`, because the
 * rule has **four** callers that must not drift: the React component converting a keystroke, the
 * node converting a `Set` that arrives before the field has mounted, `Clear` deciding whether it
 * changed anything, and `updatePorts` telling the canvas what type the ports are. A second copy
 * of this rule is the `L11` shape this repository keeps finding.
 *
 * Only `number` earns its own port type. `email`, `url` and `password` are strings with a
 * keyboard and a validation hint, and `textArea` is a string with more room; widening any of them
 * would be a claim the value does not support.
 *
 * @module nodes/controls/textInputValue
 */

/** The `Type` parameter's enum values. Anything else is treated as text. */
export type TextInputFieldType = 'text' | 'textArea' | 'email' | 'number' | 'password' | 'url';

/** The Noodl port type the value ports carry for this field type. */
export function portTypeForFieldType(fieldType: unknown): 'string' | 'number' {
  return fieldType === 'number' ? 'number' : 'string';
}

/**
 * What an empty field publishes.
 *
 * `EMPTY-VALUE-CONTRACT.md` E3/E4 — on a number, `null` is the empty value and `NaN` is never
 * stored. OBS-003 raises `node/nan-input` on any node handed a `NaN`, which would make an empty
 * field look like a fault several hops downstream.
 */
export function emptyValueForFieldType(fieldType: unknown): '' | null {
  return fieldType === 'number' ? null : '';
}

/**
 * The value that leaves the node, given the text the field is holding.
 *
 * ⚠️ The *field* keeps the raw string whatever this returns. It is what the controlled `<input>`
 * renders, and a half-typed `-`, `1.` or `1e` has to survive the keystroke that produced it —
 * converting the field's own state would delete the character as it was typed.
 */
export function outwardValueForFieldType(fieldType: unknown, text: unknown): string | number | null {
  if (fieldType !== 'number') return text as string;
  if (text === '' || text === null || text === undefined) return null;
  if (typeof text === 'number') return Number.isNaN(text) ? null : text;
  const parsed = Number(text);
  return Number.isNaN(parsed) ? null : parsed;
}
