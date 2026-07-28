/**
 * Size prop coercion.
 *
 * CED-001 (A6). `parseInt('100%')` is `100`, so a consumer asking for a full-width
 * editor got a 100px one — then clamped up to the 400px minimum. Every CSS length
 * that is not a plain number of pixels has to pass through untouched.
 *
 * @module code-editor/utils
 */

/** A number of pixels, or any other CSS length, ready to drop into a style object. */
export type CssSize = number | string;

const PIXELS = /^(-?\d+(?:\.\d+)?)(?:px)?$/;

/**
 * Coerce a `width`/`height` prop into a value React can put in `style`.
 *
 * Numbers and pixel-valued strings (`480`, `'480'`, `'480px'`) come back as numbers,
 * because the drag-resize path does arithmetic on them. Everything else — `'100%'`,
 * `'70vh'`, `'calc(100% - 2rem)'` — is a CSS length we have no business parsing, and
 * is returned as written.
 */
export function parseSizeProp(value: CssSize | undefined | null, fallback: number): CssSize {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const trimmed = value.trim();
  const pixels = PIXELS.exec(trimmed);

  return pixels ? Number(pixels[1]) : trimmed;
}

/**
 * Whether a coerced size can take part in the numeric drag-resize path — and,
 * equivalently, whether a pixel `minWidth`/`minHeight` floor is meaningful for it.
 * Imposing a 400px floor on a `'100%'` editor inside a narrow modal only overflows it.
 */
export function isPixelSize(value: CssSize): value is number {
  return typeof value === 'number';
}
