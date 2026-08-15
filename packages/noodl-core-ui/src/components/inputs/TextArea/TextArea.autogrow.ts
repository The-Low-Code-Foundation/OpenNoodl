/**
 * FIX-002 criterion 2 — "a newline can be inserted and is visible; the composer grows to show it".
 *
 * ✅ RULED 2026-08-15: **auto-grow to a max height.** The composer had `min-height: 51px` and
 * `resize: vertical` and no JS growth at all, so a second line scrolled the first one out of
 * sight — you could type a newline, but you could not see what you had written.
 *
 * The cap is a **row count**, not a fraction of the panel. A percentage cap behaves differently in
 * a tall panel and a short one, which means the composer's feel would depend on where the user
 * happened to drag a divider; a row count is the same everywhere and is the unit the ruling was
 * phrased in.
 *
 * ⚠️ The arithmetic lives here, apart from React, for the same reason
 * {@link ./TextArea.keys} does: both jest runners in this repo are **node-env, no jsdom**, so a
 * spec cannot mount a component or measure an element. What a spec *can* grade is the decision —
 * given these measurements, how tall and does it scroll — so that is what is factored out.
 */

export interface AutoGrowMetrics {
  /** The content height the browser reports with the element's own height released. */
  scrollHeight: number;
  /** Resolved line height in px. `.Input` sets this explicitly so it is never the `normal` keyword. */
  lineHeight: number;
  /**
   * Padding plus border, top and bottom. Load-bearing because `.Input` is `box-sizing: border-box`:
   * the height we set *includes* the chrome, so a cap of N rows has to leave room for it or the
   * composer tops out at N minus one-and-a-bit visible lines.
   */
  verticalChrome: number;
  /** How many rows of text the composer may grow to before it starts scrolling instead. */
  maxRows: number;
}

export interface AutoGrowResult {
  height: number;
  /**
   * `hidden` while growing, so no scrollbar flickers in and out on every keystroke; `auto` once
   * capped, because at that point there is genuinely content out of view.
   */
  overflowY: 'auto' | 'hidden';
}

export function autoGrowHeight({
  scrollHeight,
  lineHeight,
  verticalChrome,
  maxRows
}: AutoGrowMetrics): AutoGrowResult {
  const cap = lineHeight * maxRows + verticalChrome;
  return {
    height: Math.min(scrollHeight, cap),
    // Strictly greater: content that measures exactly the cap is fully visible and must not be
    // handed a scrollbar it has no use for.
    overflowY: scrollHeight > cap ? 'auto' : 'hidden'
  };
}
