/**
 * FIX-004 §A — the conversion block's mode table.
 *
 * Its own module, and import-free, for the reason `appConfig.ts` and `windowAccess.ts` are:
 * the block definition needs the dropdown options and the output check, the generator needs
 * the expression, and a table split across those two files is a table that drifts. Nothing
 * here imports Blockly, so `tests-unit` can grade it directly.
 *
 * ## Why a conversion block exists at all
 *
 * Core Blockly ships **no type-conversion block** — not one, in any category. A block author
 * who reads a text input and wants arithmetic has only the coercion trick, and the coercion
 * trick is a trap with a sharp edge: `"5" * 1` is `5` but `"5" + 0` is `"50"`. That asymmetry
 * is invisible in a block language, because both are just *a maths block with two sockets*.
 *
 * @module BlocklyEditor
 */

/** The dropdown value stored on the block. Never change these — they are in saved programs. */
export type ConvertMode = 'NUMBER' | 'STRING' | 'BOOLEAN' | 'INT' | 'FLOAT';

interface ConvertModeSpec {
  /** The dropdown label. Plain words, not JavaScript names — see the note below. */
  label: string;
  /**
   * The Blockly output check this mode produces, in Blockly's vocabulary (`NoodlTypes.ts`
   * owns the Noodl-side names). Every mode here has a check: unlike a port whose type is
   * declared elsewhere and may be unknown, a conversion's result type is the whole point of
   * the block and is always known from the mode alone.
   */
  check: 'Number' | 'String' | 'Boolean';
  /** Builds the expression from an already-parenthesised argument. */
  expression: (value: string) => string;
}

/**
 * The five modes, in the order they appear in the dropdown.
 *
 * ⚠️ **Labels are deliberately not the JavaScript names.** `parseInt` means nothing to the
 * audience this node exists for, and the two numeric parsers differ from `Number()` in a way
 * that *is* expressible in plain words: `Number(" 12abc ")` is `NaN` while
 * `parseInt(" 12abc ")` is `12`. "number" vs "whole number from text" says that; `Number` vs
 * `parseInt` does not. The stored values stay in the JavaScript vocabulary.
 */
const MODES: Readonly<Record<ConvertMode, ConvertModeSpec>> = Object.freeze({
  NUMBER: { label: 'number', check: 'Number', expression: (v) => `Number(${v})` },
  STRING: { label: 'text', check: 'String', expression: (v) => `String(${v})` },
  BOOLEAN: { label: 'true/false', check: 'Boolean', expression: (v) => `Boolean(${v})` },
  INT: { label: 'whole number from text', check: 'Number', expression: (v) => `parseInt(${v}, 10)` },
  FLOAT: { label: 'decimal from text', check: 'Number', expression: (v) => `parseFloat(${v})` }
});

/** The mode a freshly-dragged block starts in — the one the report actually asked for. */
export const DEFAULT_CONVERT_MODE: ConvertMode = 'NUMBER';

/** `[label, value]` pairs in dropdown order, the shape `Blockly.FieldDropdown` takes. */
export function convertModeOptions(): [string, string][] {
  return (Object.keys(MODES) as ConvertMode[]).map((mode) => [MODES[mode].label, mode]);
}

/**
 * The Blockly output check for a mode, or `Number`'s for anything unrecognised.
 *
 * An unknown mode can only come from a hand-edited or future-versioned program. Falling back
 * to the default mode's check rather than to `null` keeps the block honest about being a
 * conversion; `null` would quietly turn it into a block that plugs in anywhere.
 */
export function convertModeCheck(mode: string | null | undefined): string {
  return MODES[mode as ConvertMode]?.check ?? MODES[DEFAULT_CONVERT_MODE].check;
}

/**
 * The JavaScript for a mode applied to `value`.
 *
 * `value` arrives already parenthesised by `valueToCode` at `Order.NONE`, so no mode needs to
 * add brackets of its own.
 */
export function convertModeExpression(mode: string | null | undefined, value: string): string {
  const spec = MODES[mode as ConvertMode] ?? MODES[DEFAULT_CONVERT_MODE];
  return spec.expression(value);
}

/** Tooltip text for a mode, so the block explains the trap rather than only naming the call. */
export function convertModeTooltip(mode: string | null | undefined): string {
  switch (mode) {
    case 'STRING':
      return 'Converts any value to text.';
    case 'BOOLEAN':
      return 'Converts any value to true or false. Empty text, 0 and nothing all become false.';
    case 'INT':
      return 'Reads a whole number from the front of some text. "12px" becomes 12.';
    case 'FLOAT':
      return 'Reads a decimal number from the front of some text. "1.5kg" becomes 1.5.';
    default:
      return 'Converts text to a number, so maths blocks add it instead of joining it.';
  }
}
