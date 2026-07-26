/**
 * Project-thumbnail fallback logic, shared by every surface that renders a
 * project capture.
 *
 * This lives here rather than inside a card component because there is more
 * than one such card — the launcher grid and the node picker's "Import from
 * project" grid — and the first version of this logic shipped inside the
 * launcher only. The node picker kept rendering raw `thumbURI` values and so
 * kept showing the solid-white rectangles the guard exists to prevent. A second
 * copy would have set up a third.
 *
 * The two checks are deliberately separate: `hasUsableCapture` is a cheap string
 * test usable for initial state, while `isBlankCapture` needs a decoded image
 * and therefore only runs on load.
 */

/** Deterministic placeholder art: five gradient buckets keyed to node-category hues. */
export const PLACEHOLDER_BUCKETS = 5;

/** Stable 32-bit hash so a given project always lands in the same colour bucket. */
export function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return Math.abs(hash);
}

/** The placeholder bucket for a project title. */
export function placeholderBucket(title: string): number {
  return nameHash(title || '') % PLACEHOLDER_BUCKETS;
}

/** First alphanumeric of the title, for the ghosted initial. */
export function projectInitial(title: string): string {
  const match = (title || '').match(/[a-zA-Z0-9]/);
  return match ? match[0].toUpperCase() : '?';
}

/**
 * A capture is "usable" only if it is a real raster image or a remote URL. The
 * old empty-`<svg></svg>` sentinel and missing/blank values fall through to the
 * deterministic placeholder — a broken or blank thumbnail can never render.
 */
export function hasUsableCapture(imageSrc?: string): boolean {
  if (!imageSrc) return false;
  const src = imageSrc.trim();
  if (!src) return false;
  if (src.startsWith('data:image/svg+xml')) return false; // legacy empty sentinel
  if (src.startsWith('data:image/')) return src.length > 64; // real raster capture
  return /^https?:\/\//.test(src);
}

/**
 * A data-URI can be a *valid* PNG that is nonetheless blank — the capture
 * pipeline persists solid-white thumbURIs for some projects, and those sail
 * past hasUsableCapture() because they are long, well-formed rasters. Decoding
 * the loaded <img> onto a tiny canvas is the only source-agnostic way to catch
 * them. Two signals, because measured captures cluster cleanly: a blank white
 * frame is ~98-100% near-white pixels (a couple of stray dark pixels from a
 * lone node or a 1px border blow up min/max spread but not the near-white
 * *fraction*, which is why an outlier-sensitive spread test alone let them
 * through); a solid non-white fill has near-zero spread. Real captures here sit
 * at 0% near-white with spread ~150. Cross-origin images taint the canvas and
 * throw on getImageData — we swallow that and keep the capture rather than
 * punish an uninspectable but possibly-real remote thumbnail.
 */
export function isBlankCapture(img: HTMLImageElement): boolean {
  try {
    const S = 16;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, S, S);
    const { data } = ctx.getImageData(0, 0, S, S);
    let min = 255;
    let max = 0;
    let nearWhite = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Luma-ish: cheap average of RGB, alpha ignored (captures are opaque).
      const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (v < min) min = v;
      if (v > max) max = v;
      if (v > 244) nearWhite++;
      n++;
    }
    // Blank if it is overwhelmingly white (outlier-tolerant), or effectively a
    // single solid colour of any hue.
    return nearWhite / n >= 0.96 || max - min < 6;
  } catch {
    return false; // tainted / cross-origin — assume real, keep it.
  }
}
