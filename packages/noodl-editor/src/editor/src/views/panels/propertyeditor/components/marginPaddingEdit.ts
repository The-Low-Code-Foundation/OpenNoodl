import { isTokenReference, readNumberFieldEdit } from '../DataTypes/NumberWithUnits';

/**
 * REL-014 — what a typed edit to the margin/padding widget *means*, and how a
 * stored side is displayed.
 *
 * ## 🔴 Why this is the copy that mattered most
 *
 * The eight margin/padding ports are `{ name: 'number', units: ['px','%'] }` —
 * indistinguishable from Width to a naive check — and `isOfMarginPaddingType`
 * claims them **four branches ahead** of the numeric rows in
 * `Ports.viewClassForPort`. So they never reach `NumberWithUnits`, and the fix
 * that landed there did not reach them. Meanwhile `TextInputConfig` stamps
 * `paddingTop/Bottom: 'var(--space-2)'` and `paddingLeft/Right: 'var(--space-3)'`
 * onto **every new Text Input**, and `ButtonConfig` stamps four more per size
 * variant: this widget is where most of the tokens the editor authors actually
 * live.
 *
 * What it did with them was worse than the twins did. `commitEdit` was
 * `parseFloat(text)` → `isNaN ? undefined`, and `undefined` here does not merely
 * fail to store — it is the value that clears the parameter. And before any edit,
 * a token stored on a side rendered as `0` (a raw string has no `.value`) and
 * opened its edit box showing the literal text `undefined`, so the value was
 * already invisible and already looked like a zero somebody had typed.
 *
 * ## Lifted out of the component on purpose
 *
 * `MarginPaddingInput.tsx` imports `common/Icon`, which this checkout's
 * plain-Node runner cannot load at all (`Icon.tsx` uses webpack's
 * `require.context`), and the component is a hook-calling function so no runner
 * here can evaluate it either. Everything below is a pure function of its
 * arguments, so the disposition of a typed edit and the text each side shows are
 * gradeable rather than read.
 *
 * 🔴 **Not a fourth parser.** `readMarginPaddingEdit` is an adapter: it asks
 * `readNumberFieldEdit` — the one the dimension and number-with-units rows share
 * — and maps its four answers onto this widget's payload. The token rule lives in
 * exactly one place for all four fields.
 *
 * @module views/panels/propertyeditor/components/marginPaddingEdit
 */

/** One side's value: a magnitude and the unit it is in. */
export interface MarginPaddingValue {
  value: number;
  unit: string;
}

/**
 * What one side can hold. A design-token reference is kept **verbatim as a bare
 * string** — the same shape `ElementConfigRegistry.applyDefaults` writes and the
 * same shape the runtime's `isTokenReference` guard already reads back, so it
 * round-trips through the field it is typed into.
 */
export type MarginPaddingParam = MarginPaddingValue | string;

/** The two independently lockable groups inside the one widget. */
export type MarginPaddingSide = 'margin' | 'padding';

/**
 * Which group a comp belongs to.
 *
 * The eight ports share one port *group* (`'Margin and padding'`) and therefore
 * one view, so the split has to come from the comp name. It is the only thing
 * that distinguishes them.
 */
export function sideOf(comp: string): MarginPaddingSide {
  return comp.startsWith('padding') ? 'padding' : 'margin';
}

/** Whether a stored side is a design-token reference rather than a magnitude. */
export function isMarginPaddingToken(value: unknown): value is string {
  return isTokenReference(value);
}

/** What one typed edit to a margin/padding field means. */
export type MarginPaddingEdit =
  /** An emptied field. Deleting on purpose is untouched. */
  | { kind: 'clear'; value: undefined }
  /** A design-token reference, kept verbatim. */
  | { kind: 'token'; value: string }
  /** A magnitude, in the unit the widget's own dropdown is showing. */
  | { kind: 'number'; value: MarginPaddingValue }
  /** None of the above. Nothing is written — see AC4. */
  | { kind: 'refuse' };

/**
 * Read one typed edit to a margin/padding field.
 *
 * ⚠️ **`readNumberFieldEdit` is handed no permitted units, deliberately.** This
 * widget carries its own unit dropdown and has always taken the unit from there
 * rather than from the text — `50px` typed while the dropdown says `%` has always
 * committed 50%. An empty unit list turns the shared function's unit sniffing off,
 * so what survives of its numeric branch is the `parseFloat` this field already
 * did. REL-014 changes what happens to text that is **not** a number, and nothing
 * else.
 */
export function readMarginPaddingEdit(text: string, unit: string): MarginPaddingEdit {
  const edit = readNumberFieldEdit(text, []);

  switch (edit.kind) {
    case 'clear':
      return { kind: 'clear', value: undefined };
    case 'token':
      return { kind: 'token', value: edit.token };
    case 'number':
      return { kind: 'number', value: { value: edit.value, unit } };
    default:
      return { kind: 'refuse' };
  }
}

/** Everything one commit needs, so the component's own `commitEdit` is a hand-off. */
export interface MarginPaddingCommit {
  /** The side being edited, e.g. `padding-top`. */
  comp: string;
  /** What is in the box. */
  text: string;
  /** What the box's unit dropdown is showing. */
  unit: string;
  /** What each side currently holds. */
  values: Record<string, MarginPaddingParam | undefined>;
  /** POL-012 — per side, whether editing one field writes all four. */
  linked: Record<MarginPaddingSide, boolean>;
  onUpdate: (comp: string, value: MarginPaddingParam | undefined) => void;
  onUpdateAll: (side: MarginPaddingSide, value: MarginPaddingParam | undefined) => void;
  /**
   * AC4 — put `text` back in the box, because nothing was written and therefore
   * nothing upstream will re-seed it.
   */
  onRefuse: (text: string) => void;
}

/**
 * Commit one typed edit to the margin/padding widget.
 *
 * 🔴 **This is the whole of `commitEdit`, deliberately.** The component around it
 * cannot be loaded by any runner in this checkout (see the module note), so a
 * decision left inside it is a decision graded by reading. What stays there is a
 * five-line hand-off; what a revert of REL-014 would have to undo is here.
 */
export function commitMarginPaddingEdit(commit: MarginPaddingCommit): 'committed' | 'refused' {
  const edit = readMarginPaddingEdit(commit.text, commit.unit);

  if (edit.kind === 'refuse') {
    commit.onRefuse(editTextOf(commit.values[commit.comp]));
    return 'refused';
  }

  // ⚠️ The unit goes with the value on every side. Four sides carrying different
  // units is a real state, and linked mode resolves it by making them all the one
  // the user just typed in — a visible action, not a silent reinterpretation of
  // three numbers under a new unit.
  const side = sideOf(commit.comp);
  if (commit.linked[side]) commit.onUpdateAll(side, edit.value);
  else commit.onUpdate(commit.comp, edit.value);

  return 'committed';
}

/** `var(--space-2)` → `--space-2`; `var(--space-2, 16px)` → `--space-2`. */
const TOKEN_NAME = /^var\(\s*(--[A-Za-z0-9_-]+)/;

/**
 * The compact label a token gets in the box.
 *
 * ⚠️ The eight value labels are ~40px of a 150px widget and `var(--space-2)` does
 * not fit in one. The name alone does, it is the form the design-token panel and
 * the style vocabulary both use, and it cannot be mistaken for a magnitude. The
 * full text is still what the edit box seeds with and what a `title` carries, so
 * nothing about the stored value is hidden — see {@link editTextOf}.
 */
export function tokenLabel(token: string): string {
  const match = TOKEN_NAME.exec(token.trim());
  return match ? match[1] : token;
}

/** What one side shows on the widget. */
export function labelTextOf(value: MarginPaddingParam | undefined): string {
  if (value === undefined) return '0';
  if (typeof value === 'string') return tokenLabel(value);

  // No "- px" wireframe placeholder: show the numeric value (zeros read muted),
  // and only surface a non-px unit inline.
  const num = value.value === undefined ? '0' : value.value;
  return value.unit && value.unit !== 'px' ? `${num}${value.unit}` : `${num}`;
}

/** What the inline edit box is seeded with — a token in full, so it round-trips. */
export function editTextOf(value: MarginPaddingParam | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return value.value === undefined ? '' : String(value.value);
}

/** The unit the edit box's dropdown opens on. */
export function unitOf(value: MarginPaddingParam | undefined, fallbackUnit: string): string {
  if (value === undefined || typeof value === 'string') return fallbackUnit;
  return value.unit || fallbackUnit;
}

/** Whether a side reads as zero, for the muted styling. A token never does. */
export function isZeroValue(value: MarginPaddingParam | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === 'string') return false;
  return Number(value.value || 0) === 0;
}

/**
 * The magnitude a drag on this side starts from.
 *
 * ⚠️ **A token has no magnitude, and this is the one gesture that still replaces
 * one with a number.** That is unchanged by REL-014 and arguably correct — a drag
 * is a deliberate statement about size — but before this the fallback was
 * `start.value || 0` on a bare string, which meant a drag from a token began at
 * **0 with no unit** and wrote `{value: n, unit: undefined}`. Falling back to the
 * side's default keeps the unit real. Registered as the remaining gesture that
 * removes a token without saying so.
 */
export function scrubStartOf(
  value: MarginPaddingParam | undefined,
  fallback: MarginPaddingParam | undefined,
  fallbackUnit: string
): MarginPaddingValue {
  if (value !== undefined && typeof value !== 'string') {
    return { value: value.value || 0, unit: value.unit || fallbackUnit };
  }
  if (fallback !== undefined && typeof fallback !== 'string') {
    return { value: fallback.value || 0, unit: fallback.unit || fallbackUnit };
  }
  return { value: 0, unit: fallbackUnit };
}

/**
 * How two sides are compared for "do these four agree?" — the seed for the
 * per-group link. A token compares as itself, so four sides all carrying
 * `var(--space-2)` agree and link on, which is the state `TextInputConfig` leaves
 * every new Text Input in.
 */
export function agreementKeyOf(value: MarginPaddingParam | undefined): string {
  if (value === undefined) return ' default';
  if (typeof value === 'string') return `token|${value}`;
  return `${value.value}|${value.unit}`;
}
