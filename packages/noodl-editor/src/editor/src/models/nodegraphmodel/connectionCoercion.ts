/**
 * FIX-025 — the wire the editor allows and the runtime does not convert.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * 🔴 THE DEFECT, IN RICHARD'S WORDS (2026-08-20):
 *
 * *"In the visual function node (blockly), I set a value input as type 'number', then connected
 * a string connector to that input, and the visual function node didn't throw an error (maybe
 * it only does it once the value comes in, but when the connector is deffo a wrong type it
 * should say so)."*
 *
 * ## Why nothing fired, and why that was not a bug in the warning code
 *
 * `NodeGraphModel.getConnectionHealth` already raises `con-type-mismatch` — but only when
 * `canCastPortTypes` says **no**, and for `string → number` it says **yes**. That answer comes
 * from the `typecasts` table in `nodelibraryexport.ts`, which lists `string` as castable to
 * `number`, `boolean`, `image`, `color`, `enum`, `textStyle`, `dimension`, `array` and `object`.
 *
 * ⚠️ **The table gates the editor; it converts almost nothing.** That sentence is
 * `PORT-TYPE-CONTRACT.md`'s, not ours. The only conversions the runtime actually performs on a
 * wire are `object`/`array` → `string` (`JSON.stringify`, in `_setValueFromConnection`) and
 * `string` → `object`/`array` (parsed, in `setInputValue`). **`string → number` converts
 * nothing: the string arrives verbatim.** So the port declared `number` holds `"5"`, and
 * `"5" + 1` is `"51"`.
 *
 * 🔴 **And the Visual Function is the worst place for it to be silent**, because its own input
 * setter also coerces nothing — `registerInputIfNeeded` in `logic-builder.ts` stores the
 * delivered value as it arrives and the declared type is published to the editor and never
 * consulted again. `NoodlTypes.connectionCheckForDeclaredPort` documents exactly this, and
 * that is why it declines to put a Blockly check on `get input`: the check would be a promise
 * the port does not keep.
 *
 * ## What this does, and the two things it deliberately does not do
 *
 * ✅ It reports. A `warning`, beside the existing `error`-level mismatch.
 *
 * ❌ **It does not refuse the connection.** `PORT-TYPE-CONTRACT.md`'s rule is *"declaring a
 * port's true type must never make it less connectable than leaving it untyped"*, and casts are
 * additive only — *"nothing that connects today stops connecting"*. Making this an error, or
 * removing the row from the table, would break every project that currently wires a Text output
 * into a number input and types digits into it. Those projects work; they are one edit away from
 * not working, and being told is the whole ask.
 *
 * ❌ **It does not fire on every permitted cast.** Only where the value's runtime *behaviour*
 * changes silently, which is the numeric and boolean family:
 *
 *   - `string → number` — arithmetic concatenates instead of adding.
 *   - `string → boolean` — 🔴 **`"false"` is truthy.** The worst of the set, because the value
 *     reads correctly everywhere a human looks at it and behaves as its opposite.
 *
 * `string → object`/`array` are converted and are not listed. `number`/`boolean` → `string` are
 * not listed either: JavaScript renders both, so nothing surprising happens downstream. A wire
 * warning that fired on working, sensible graphs would be noise, and noise is how a warnings
 * surface stops being read — which would cost more than this defect does.
 *
 * ⚠️ This is the narrow, honest slice of `PORT-TYPE-CONTRACT.md`'s **Direction C**, which names
 * the real fix: *"the editor may then distinguish 'connectable losslessly' from 'connectable via
 * cast' in the UI, which the single-field model cannot express."* Direction C is a model change
 * and is not built here. This says the one thing that can be said truthfully today.
 *
 * @module models/nodegraphmodel/connectionCoercion
 */

/** A port type is either a bare string or `{ name }`, depending on the node. */
export type PortTypeLike = string | { name?: string } | null | undefined;

/** The type's name, lower-cased, or `null` when there isn't one. */
export function portTypeName(type: PortTypeLike): string | null {
  if (!type) return null;
  const name = typeof type === 'string' ? type : type.name;
  return typeof name === 'string' && name.length ? name.toLowerCase() : null;
}

/**
 * The pairs the editor permits and the runtime leaves alone. Keyed `source → target`.
 *
 * ⚠️ Each entry says what the builder will actually SEE, not that the types differ — a message
 * reading "a string cannot be a number" tells someone who wired it deliberately nothing they
 * did not know. The consequence is the part they cannot predict.
 */
const UNCONVERTED: Record<string, Record<string, string>> = {
  string: {
    number:
      'the text arrives as text — it is not converted to a number, so adding it to another ' +
      'number joins the two instead of summing them',
    boolean:
      'the text arrives as text and is not converted, so any non-empty value counts as true — ' +
      'including the word “false”'
  }
};

export interface CoercionWarning {
  /** Source port type name, as matched. */
  from: string;
  /** Target port type name, as matched. */
  to: string;
  /** What the builder will see. A sentence, no markup. */
  consequence: string;
}

/**
 * Whether this wire is one the editor allows but the runtime will not convert.
 *
 * `null` means there is nothing to say — which includes the ordinary cases of matching types,
 * `*` at either end, a genuinely refused pair (the existing `con-type-mismatch` error owns
 * that one) and every cast that really is performed.
 */
export function unconvertedCast(source: PortTypeLike, target: PortTypeLike): CoercionWarning | null {
  const from = portTypeName(source);
  const to = portTypeName(target);
  if (!from || !to) return null;
  // `*` is "unknown", and a wire out of an undeclared output is not evidence of anything.
  if (from === '*' || to === '*') return null;
  if (from === to) return null;

  const consequence = UNCONVERTED[from]?.[to];
  return consequence ? { from, to, consequence } : null;
}
