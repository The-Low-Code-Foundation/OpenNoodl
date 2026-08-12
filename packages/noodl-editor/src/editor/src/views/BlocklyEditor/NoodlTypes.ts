/**
 * Noodl port types ⇄ Blockly connection checks.
 *
 * Blockly has a real type system: every connection carries a `check` — an array of strings —
 * and two connections may join when their arrays intersect, or when **either is `null`**.
 * `null` is the permissive value. Our own port types are the other vocabulary, and `detectIO`
 * (`@noodl/runtime`, `logic-builder-io.ts`) already reports them for a block program. This
 * module is the single place the two vocabularies meet, in both directions.
 *
 * ⚠️ **`'*'` maps to `null`, and must never map to a string.** `detectIO` returns `'*'` for a
 * port the blocks declare no type for, which is the common case (`noodl_get_input` and
 * `noodl_set_output` always report `'*'`, and the `Define …` dropdown defaults to `any`).
 * `'*'` means *unknown*, and Blockly's check strings mean *this exact tag*. Passing `'*'` — or
 * `'Any'`, or any other string — through as a check would produce a connection that matches
 * **nothing**: the exact opposite meaning, from the same character. LGC-005 register L14.
 *
 * @module BlocklyEditor
 */

/** The Noodl type name `detectIO` uses for "no type declared". */
export const PERMISSIVE_NOODL_TYPE = '*';

/**
 * The map, forward. LGC-005 §1.
 *
 * `Number`, `String`, `Boolean`, `Array` and `Colour` are Blockly's own tags — the built-in
 * blocks use exactly these, verified against the bundled library: `math_number` outputs
 * `['Number']`, `text` and `text_join` output `['String']`, `logic_boolean` outputs
 * `['Boolean']`, `lists_create_with` outputs `['Array']`, `math_arithmetic` requires
 * `['Number']` on both operands and `text_length` requires `['String','Array']`.
 *
 * `Object` is ours, declared here. It is not invented by this file: `noodl_get_object`
 * already ships `setOutput(true, 'Object')` (`NoodlBlocks.ts`), and this map is what makes
 * that string a declaration rather than a one-off.
 *
 * `signal` is deliberately absent. A signal is not a value connection at all — it is the
 * previous/next statement seam, which Blockly types separately — so there is no check to give
 * it. `blocklyCheckForNoodlType('signal')` therefore returns `null`, and callers that care
 * about the distinction should ask `isSignalType` first.
 *
 * `Colour` has no producer in the shipped toolbox (Blockly moved its colour blocks out to
 * `@blockly/field-colour`, and `BlocklyToolbox.ts` lists none), and `color` is not offered by
 * the `Define input`/`Define output` dropdown either. It is mapped because the table says so
 * and because the moment a colour block is added the mapping must already be right.
 */
export const NOODL_TYPE_TO_BLOCKLY_CHECK: Readonly<Record<string, string>> = Object.freeze({
  number: 'Number',
  string: 'String',
  boolean: 'Boolean',
  array: 'Array',
  color: 'Colour',
  colour: 'Colour',
  object: 'Object'
});

/**
 * The map, backward.
 *
 * Not derived by inverting the object above at runtime: `color`/`colour` both map onto
 * `Colour`, so the inverse has to name its winner rather than depend on key order.
 */
export const BLOCKLY_CHECK_TO_NOODL_TYPE: Readonly<Record<string, string>> = Object.freeze({
  Number: 'number',
  String: 'string',
  Boolean: 'boolean',
  Array: 'array',
  Colour: 'color',
  Object: 'object'
});

/** A Noodl port type that is a pulse rather than a value. */
export function isSignalType(noodlType: string | null | undefined): boolean {
  return noodlType === 'signal';
}

/**
 * The Blockly check for a Noodl port type, or `null` for "connects to anything".
 *
 * `null` is returned for `'*'`, for `'signal'`, for a missing type, and for any type this map
 * does not name — all four are "we do not know enough to refuse a connection", and in Blockly
 * that is spelled `null`. Returning a string for an unknown type is the L14 bug.
 */
export function blocklyCheckForNoodlType(noodlType: string | null | undefined): string | null {
  if (!noodlType || noodlType === PERMISSIVE_NOODL_TYPE || isSignalType(noodlType)) {
    return null;
  }
  return NOODL_TYPE_TO_BLOCKLY_CHECK[noodlType] || null;
}

/**
 * The Noodl port type for a Blockly check, or `'*'` when there is nothing to go on.
 *
 * Takes the array form as well as the bare string, because that is what `Connection.getCheck`
 * returns. A check listing several tags has no single Noodl type, so it reads as `'*'` — the
 * honest answer, and the same one an absent check gets.
 */
export function noodlTypeForBlocklyCheck(check: string | string[] | null | undefined): string {
  if (!check) return PERMISSIVE_NOODL_TYPE;

  if (Array.isArray(check)) {
    if (check.length !== 1) return PERMISSIVE_NOODL_TYPE;
    return noodlTypeForBlocklyCheck(check[0]);
  }

  return BLOCKLY_CHECK_TO_NOODL_TYPE[check] || PERMISSIVE_NOODL_TYPE;
}

/**
 * The check to actually put on a block connection for a port the author declared, given which
 * end of the node it is. **This is the policy; `blocklyCheckForNoodlType` is only the map.**
 *
 * ## `plug: 'output'` — the declaration is enforceable, so it is enforced
 *
 * A `set output` block writes a value the author's own blocks produced, into a port the
 * author's own `Define output` block typed. Nothing outside the workspace participates, so
 * the declared type is a promise only these blocks can break — and refusing to snap a `text`
 * block into an output the same program declared `number` is a mistake made impossible.
 *
 * ## `plug: 'input'` — the declaration is *not* enforceable, so no check is given
 *
 * ⚠️ This is LGC-005 §1's coercion trap, and reading the runtime in source makes it larger
 * than the spec assumed. A check on the value coming *out* of `get input` would claim the
 * value on that wire has the declared type. It does not, for three reasons, each read in
 * source:
 *
 * 1. **The typecast table permits mismatched wires and converts almost nothing.**
 *    `nodelibraryexport.ts` (`typecasts`) lets `string` reach a `number`, `boolean`, `object`
 *    or `array` input, `number` and `boolean` reach a `string` input, and so on. The *only*
 *    conversion the runtime performs on a wire is `object`/`array` → `string`
 *    (`node.ts` `_setValueFromConnection`, `JSON.stringify`) and `string` → `object`/`array`
 *    (`node.ts` `setInputValue`, `eval`). `string → number` converts nothing at all: the
 *    string arrives verbatim. PORT-TYPE-CONTRACT.md names this directly — the table "gates the
 *    editor; it converts nothing" — and its Direction C is the unbuilt fix.
 * 2. **`'*'` outputs connect to everything and carry anything.** `canCastPortTypes` returns
 *    true the moment either end is `'*'` (`nodelibrary.ts`), and `'*'` is the default for an
 *    undeclared `Function` output. So even a type with no permissive inbound cast can be
 *    handed a value of any shape.
 * 3. **Logic Builder's own input setter coerces nothing.** `registerInputIfNeeded`
 *    (`logic-builder.ts`) stores the delivered value verbatim in `_internal.inputValues`.
 *    The declared type is published to the editor and never consulted again.
 *
 * So a `Number` check on `get input` would promise a guarantee the port does not provide,
 * while also refusing constructions that would have worked. `null` is the honest value. The
 * policy lives here, in one function, so that if the runtime ever *does* coerce — the obvious
 * fix is `coerceToType` (`expression-type-coercion.ts`, already imported by `node.ts`) in
 * `registerInputIfNeeded`'s setter — one line here turns every read-side check back on.
 */
export function connectionCheckForDeclaredPort(
  noodlType: string | null | undefined,
  plug: 'input' | 'output'
): string | null {
  if (plug === 'input') {
    return null;
  }
  return blocklyCheckForNoodlType(noodlType);
}
