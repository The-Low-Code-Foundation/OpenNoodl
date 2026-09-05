/**
 * SBR-003 §2, first bullet — **does a `{value,unit}` dimension port actually
 * accept `var(--token)` and reach CSS?**
 *
 * The task recorded this as verified-by-legend and explicitly refused to close
 * on that: *"`{value,unit}` (dimension) ports accept `var(--token)` per
 * `WIRE_FORMAT_LEGEND` (`validation/parameterValues.ts:395-420`) — **verify with
 * a rendered probe** (a maxWidth from a token actually constrains a box in the
 * viewer), not by quoting the legend."* At s4 nothing in the template consumed
 * the token, so the probe had nowhere to stand and was carried forward. It has
 * a consumer now: `sb006Components.ts`'s `/Pages/Site` `shell` states
 * `maxWidth: 'var(--site-measure)'`, and Studio's value for it is `44rem`.
 *
 * ## What this module reads, and why each field is here
 *
 * 🔴 **Three different faults produce a box that is 704px wide**, and only one
 * of them is "the token reached CSS":
 *
 * 1. the port took the string, CSS resolved `var(--site-measure)` → **the claim**;
 * 2. the port dropped the string, and the box is 704px because that is what its
 *    *content* happens to measure;
 * 3. the port dropped the string, and the box is 704px because its *parent* is.
 *
 * So a width alone says nothing. `shellMaxWidth` separates 1 from 2 and 3 — an
 * unresolvable `var()` computes `max-width` to `none`, a resolved one computes
 * to a length — and `frameWidth` separates a clamp that **binds** from a clamp
 * that is decorative, which is the [registered trap where a ceiling below the
 * latency still passed because something else supplied the wait].
 *
 * ⚠️ **Identification is derived from the product, not guessed from an id.**
 * A `#shell` selector would have been a literal that a project-wide id
 * renumbering silently breaks — which is exactly how `sbr010`'s D42 went stale
 * on `#pick` → `pick-2`.
 *
 * 🔴 **RE-AIMED BY REL-011c SEAM 5, AND THE OLD TARGET IS NOW THE CONTROL.**
 * This used to read `main.parentElement` — the page shell — because the shell
 * was the one box that stated `maxWidth: var(--site-measure)`. Seam 5 moved the
 * measure OFF the shell precisely so that a hero and a call to action could
 * reach the window, and there is no longer any clamp there to read.
 *
 * ⚠️ **Left unchanged, this probe would not have failed — it would have gone on
 * reading, and read `max-width: none` in BOTH arms.** That is the same shape
 * D57 produced, and it fits *"the dimension port drops `var(--token)`"*
 * perfectly: the exact defect SBR-003 AC5 exists to detect, reported by a probe
 * pointed at a box that was never supposed to carry the measure. The reading is
 * now taken on the page `<header>`, which states it, and which is identified by
 * being the single `<header>` inside the single `<main>` and holding the `<h1>`.
 */

/** One reading of the reading-measure clamp on one rendered document. */
export interface MeasureClamp {
  /** `<main>` elements in the document. Exactly one is the identification precondition. */
  mains: number;
  /**
   * `<header>` elements in the document. Exactly one is the second half of the
   * identification, and it is what the reading is actually taken on.
   */
  headers: number;
  /**
   * The computed `max-width` of the shell, **verbatim**.
   *
   * 🔴 This is the field that carries the claim. An unresolvable `var()` is
   * invalid at computed-value time, so `max-width` falls back to its initial
   * value `none`; a resolved one computes to an absolute length. `'704px'` and
   * `'none'` are two different mechanisms, not two numbers.
   */
  shellMaxWidth: string;
  /** Rendered width of the shell, px. */
  shellWidth: number;
  /**
   * Rendered width of the shell's parent — the width the shell would take if
   * nothing clamped it. Without this, a clamp that never binds reads identical
   * to one that does.
   */
  frameWidth: number;
  /** Viewport width the reading was taken at. */
  viewportWidth: number;
  /** `:root`'s font-size in px — what turns a `rem` measure into a number. */
  rootFontSize: number;
  /** `--site-measure` as `:root` resolves it, trimmed; `''` when no such token exists. */
  tokenValue: string;
  /**
   * The frame's horizontal padding, px — what reconciles the unclamped shell
   * width against the frame's border box.
   *
   * 🔴 Added after the first reading: the control arm was PREDICTED to fill the
   * frame at 1280 and measured 1232. Without this field that 48px gap is a
   * magic number a later session would be tempted to edit to fit; with it the
   * control's claim is stated as an equation — an unclamped shell fills its
   * parent's CONTENT box — rather than as a literal.
   */
  framePaddingX: number;
  /** `<nav>`s inside the shell. The nav band is a child of `shell`, not of `main`. */
  shellHasNav: number;
  /** `<h1>`s inside the shell. */
  shellHasH1: number;
  /** True if the element found is the `<main>` itself — i.e. the walk went wrong. */
  shellIsMain: boolean;
  /**
   * True when the measured element is inside the `<main>`, which it must be.
   *
   * 🔴 The header is the page's OWN header, not a site-wide banner: REL-011c
   * §5 put `siteMain` around the page's content and left the nav band outside
   * it. A reading taken on a `<header>` that had drifted outside `<main>` would
   * be a reading of a different box.
   */
  shellInsideMain: boolean;
}

/**
 * 🔴 **The sentinel an arm that never ran leaves behind.**
 *
 * Copied in spirit from `documentOutline.ts`'s `NO_LANDMARKS` and for the same
 * reason: the control arm's *expected* reading is an absent clamp, so a browser
 * arm that silently failed to run would leave `''`/`0` and pass by not
 * happening. No document produces `-1`.
 */
export const NO_CLAMP: MeasureClamp = Object.freeze({
  mains: -1,
  headers: -1,
  shellMaxWidth: '(never ran)',
  shellWidth: -1,
  frameWidth: -1,
  viewportWidth: -1,
  rootFontSize: -1,
  tokenValue: '(never ran)',
  framePaddingX: -1,
  shellHasNav: -1,
  shellHasH1: -1,
  shellIsMain: false,
  shellInsideMain: false
});

/** The custom property the site template mints. Mirrors `siteTheme.ts`'s `SITE_MEASURE_TOKEN`. */
export const MEASURE_TOKEN = '--site-measure';

/**
 * The expression, evaluated in the page. Returns an object by value.
 *
 * `shell` is null unless there is EXACTLY one `<main>` with a parent element:
 * with two of them "the shell" has no referent, and answering about the first
 * would be a reading of a document this template does not produce.
 */
export const READ_MEASURE_CLAMP = `(function () {
  var m = document.querySelectorAll('main');
  var main = m.length === 1 ? m[0] : null;
  var h = document.querySelectorAll('header');
  var shell = h.length === 1 ? h[0] : null;
  var rootStyle = getComputedStyle(document.documentElement);
  var shellStyle = shell ? getComputedStyle(shell) : null;
  var shellBox = shell ? shell.getBoundingClientRect() : null;
  var frame = shell && shell.parentElement ? shell.parentElement : null;
  var frameBox = frame ? frame.getBoundingClientRect() : null;
  return {
    mains: m.length,
    headers: h.length,
    shellMaxWidth: shellStyle ? shellStyle.maxWidth : '(no shell)',
    shellWidth: shellBox ? shellBox.width : -1,
    frameWidth: frameBox ? frameBox.width : -1,
    viewportWidth: document.documentElement.clientWidth,
    rootFontSize: parseFloat(rootStyle.fontSize),
    tokenValue: (rootStyle.getPropertyValue('${MEASURE_TOKEN}') || '').trim(),
    framePaddingX: frame
      ? parseFloat(getComputedStyle(frame).paddingLeft) + parseFloat(getComputedStyle(frame).paddingRight)
      : -1,
    shellHasNav: shell ? shell.querySelectorAll('nav').length : -1,
    shellHasH1: shell ? shell.querySelectorAll('h1').length : -1,
    shellIsMain: shell !== null && shell === main,
    shellInsideMain: shell !== null && main !== null && main.contains(shell)
  };
})()`;

/** The narrowest shape of a driven page this module needs. */
export interface EvaluatingPage {
  evaluate(expression: string): Promise<unknown>;
}

/**
 * Read one document's reading-measure clamp.
 *
 * Both a string and an object are accepted for the same reason
 * `readLandmarks` accepts both: the drives in this repo wrap `evaluate` two
 * different ways and one of them `String(...)`s the result.
 */
export async function readMeasureClamp(page: EvaluatingPage): Promise<MeasureClamp> {
  const raw = await page.evaluate(READ_MEASURE_CLAMP);
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as MeasureClamp;
}

/**
 * What is wrong with one reading, in words, or `null` if nothing is.
 *
 * A sentence rather than a boolean, so a failing spec prints *which* of the
 * ways this can be wrong actually happened — and "the arm never ran" is one of
 * them rather than a silent zero.
 */
export function clampFault(c: MeasureClamp | undefined): string | null {
  if (!c || typeof c.mains !== 'number') return 'no reading was taken';
  if (c.mains === -1) return 'the arm never ran';
  if (c.mains !== 1) return `${c.mains} <main>, expected 1 — the measured box has no referent`;
  if (c.headers !== 1) return `${c.headers} <header>, expected 1 — the measured box has no referent`;
  if (c.shellIsMain) return 'the reading landed on the <main> itself, not the header inside it';
  if (!c.shellInsideMain) return 'the <header> is not inside the <main> — a different box was measured';
  if (c.shellHasH1 !== 1) return `the measured box holds ${c.shellHasH1} <h1>, expected 1`;
  if (c.shellWidth <= 0) return `the measured box was ${c.shellWidth}px — nothing was laid out`;
  return null;
}
