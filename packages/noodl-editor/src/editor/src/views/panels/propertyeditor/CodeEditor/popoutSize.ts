/**
 * CED-002 — how big the code editor popout opens, and why it kept opening tiny.
 *
 * ## 🔴 The defect
 *
 * The popout remembers its size as a fraction of the viewport, measured in `onClose` from the
 * React root's container div, and restores it clamped to `Math.max(…, 400)`. Two things about
 * that were wrong and they compound:
 *
 * 1. **The container can be empty when it is measured.** `CodeEditorType.dispose()` unmounts the
 *    React root, and it is called by a property-panel teardown as well as by the popout's own
 *    close — the file's own comment says so ("a panel teardown that removes the view out from
 *    under an open popout"). A detached or emptied `<div>` measures **0×0**, so `{width: 0,
 *    height: 0}` is written to `localStorage` as if it were a size the user chose.
 * 2. **The floor then hid it.** `Math.max(b.width * 0, 400)` is 400, which is a real editor at a
 *    plausible-looking size, so nothing ever looked broken enough to investigate — the popout
 *    just quietly opened small from then on, on every node, forever, because nothing ever writes
 *    a *larger* value back unless the user resizes it by hand.
 *
 * The repair is both halves: **refuse to store a measurement that cannot be real**, and raise the
 * floor so that even a bad stored value from before this change cannot produce a cramped editor.
 * A stale `{0, 0}` in someone's `localStorage` is not hypothetical — it is what is there now.
 *
 * ⚠️ The floor is deliberately **not** `JavaScriptEditor`'s `MIN_WIDTH` (400). That is the
 * narrowest the component can *render*; this is the narrowest it is worth *opening at*, and
 * conflating the two is how a "sensible minimum" became the size everybody got.
 */

export interface Viewport {
  width: number;
  height: number;
}

export interface PopoutSize {
  width: number;
  height: number;
}

/** Stored form: fractions of the viewport, so a size chosen on one screen means something on another. */
export interface PopoutSizeFractions {
  width: number;
  height: number;
}

/**
 * The narrowest the popout will ever be opened at.
 *
 * The toolbar alone carries a mode label, a verdict, History, Format, Save and Close; below
 * ~800 px they start wrapping, and the editor is holding code, which is the one kind of text
 * where a narrow column costs comprehension directly.
 */
export const CODE_POPOUT_MIN_WIDTH = 800;

/** The shortest the popout will ever be opened at — toolbar, ~15 lines of code, and the footer. */
export const CODE_POPOUT_MIN_HEIGHT = 420;

/**
 * The smallest box the editor component can actually render, and therefore the smallest
 * measurement that can be a real one.
 *
 * ⚠️ **Deliberately a different number from the opening floor above, and the distinction is the
 * repair.** `JavaScriptEditor` enforces `MIN_WIDTH = 400` / `MIN_HEIGHT = 200` on its own root,
 * so a measurement below that did not come from a rendered editor — it came from an unmounted or
 * half-torn-down one. Using the *opening* floor here instead would silently discard a size
 * somebody deliberately dragged to, which is the same disrespect the defect showed from the
 * other direction.
 *
 * A size between these two thresholds is therefore stored faithfully and then opened at the
 * floor: we believe the measurement, and separately decline to open a code editor that cramped.
 */
const MEASURABLE_MIN_WIDTH = 400;
const MEASURABLE_MIN_HEIGHT = 200;

/** How much of the viewport the popout claims when nothing is stored. */
export const CODE_POPOUT_DEFAULT_WIDTH_FRACTION = 0.7;
export const CODE_POPOUT_DEFAULT_HEIGHT_FRACTION = 0.72;

/** The gap left between the popout and the window edge, so it never opens flush. */
const VIEWPORT_MARGIN = 40;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * The floor, reduced to fit a window smaller than it is.
 *
 * An 800 px floor on a 700 px window is not a floor, it is a popout wider than the screen it is
 * clamped into — which is the same class of mistake as the one this module exists to fix.
 */
function floors(viewport: Viewport): PopoutSize {
  return {
    width: Math.min(CODE_POPOUT_MIN_WIDTH, Math.max(viewport.width - VIEWPORT_MARGIN, 1)),
    height: Math.min(CODE_POPOUT_MIN_HEIGHT, Math.max(viewport.height - VIEWPORT_MARGIN, 1))
  };
}

function fit(size: PopoutSize, viewport: Viewport): PopoutSize {
  const floor = floors(viewport);

  return {
    width: Math.round(clamp(size.width, floor.width, Math.max(viewport.width - VIEWPORT_MARGIN, floor.width))),
    height: Math.round(clamp(size.height, floor.height, Math.max(viewport.height - VIEWPORT_MARGIN, floor.height)))
  };
}

/** Where the popout opens with nothing stored. */
export function defaultCodeEditorSize(viewport: Viewport): PopoutSize {
  return fit(
    {
      width: viewport.width * CODE_POPOUT_DEFAULT_WIDTH_FRACTION,
      height: viewport.height * CODE_POPOUT_DEFAULT_HEIGHT_FRACTION
    },
    viewport
  );
}

/**
 * The size to open at, given whatever is in storage.
 *
 * Anything that is not two positive finite fractions — including the `{0, 0}` this used to
 * write — is treated as nothing stored, and answered with the default rather than with a
 * repaired version of nonsense.
 */
export function restoreCodeEditorSize(stored: unknown, viewport: Viewport): PopoutSize {
  if (!stored || typeof stored !== 'object') return defaultCodeEditorSize(viewport);

  const record = stored as Record<string, unknown>;
  const width = record.width;
  const height = record.height;

  const usable =
    typeof width === 'number' &&
    typeof height === 'number' &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0;

  if (!usable) return defaultCodeEditorSize(viewport);

  return fit({ width: (width as number) * viewport.width, height: (height as number) * viewport.height }, viewport);
}

/**
 * The fractions to store for a popout that measured `size`, or `null` if that measurement cannot
 * be a real one.
 *
 * 🔴 This is the half that stops the defect recurring. A measurement of an unmounted React root
 * is `0×0`, and a measurement taken mid-teardown can be a sliver; neither is a size anybody
 * chose, and writing either one is how a session's editor became permanently small. The test is
 * against {@link MEASURABLE_MIN_WIDTH} rather than against zero, because a 12 px popout is
 * exactly as impossible as a 0 px one and only one of them would have been caught — and *not*
 * against the opening floor, because a size somebody dragged to is theirs to have stored.
 */
export function storableCodeEditorSize(size: PopoutSize, viewport: Viewport): PopoutSizeFractions | null {
  if (!(viewport.width > 0) || !(viewport.height > 0)) return null;

  const minWidth = Math.min(MEASURABLE_MIN_WIDTH, viewport.width);
  const minHeight = Math.min(MEASURABLE_MIN_HEIGHT, viewport.height);

  if (!(size.width >= minWidth) || !(size.height >= minHeight)) return null;

  return { width: size.width / viewport.width, height: size.height / viewport.height };
}
