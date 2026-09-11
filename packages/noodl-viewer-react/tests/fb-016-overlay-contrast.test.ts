/**
 * FB-016 AC4 — the overlay's colours, graded against every ground it can land on.
 *
 * ## Why this is not a row in the editor's PAIRS table
 *
 * `noodl-editor/tests-unit/nat-001/palette-contrast.spec.ts` grades **named design tokens**
 * resolved out of `colors.css`, in the editor's two themes. The overlay is painted somewhere
 * those tokens do not exist: inside the preview webview, over a document the *author* wrote.
 * `PreviewTokenInjector` puts the **project's** tokens in there, never the editor's, so a row
 * saying `--theme-color-fg-default over --theme-color-bg-1` would be describing a pairing that
 * never occurs. AC4 asked for PAIRS rows; this is the same claim asked of the right population,
 * and it is a stronger one — "both themes" is two grounds, and this is all of them.
 *
 * 🔴 **No single colour can hold 3:1 against both black and white.** It needs a relative
 * luminance above ~0.10 to clear black and below ~0.30 to clear white — and a colour in that
 * band is a mid-tone that then fails against mid-tone content. The control at the bottom of this
 * file is today's teal selection outline, which measures **2.86:1 against white**: it is the
 * defect this pair exists to avoid, and it is what proves the instrument can fail.
 *
 * ✅ **So every structural edge is drawn twice**, one near-black stroke and one near-white, and
 * what is graded is the *better of the two* at every ground luminance. The floor is 3:1 (WCAG
 * 1.4.11, non-text) and the measured worst case is well above it.
 *
 * ⚠️ **What this does not grade, said out loud so a green run is not read as more than it is:**
 * the tinted region fills. They are identification — the DevTools dialect an author may already
 * know — and they sit over content of unknown colour by design. The structure is carried by the
 * edges and the chips, which are the two things measured here. Whether the tints are *legible*
 * over a photograph is a drive's question, not this file's.
 */
import { OVERLAY_COLORS } from '../src/box-model-overlay';

type Rgb = [number, number, number];

function parseHex(value: string): Rgb {
  const hex = value.replace('#', '');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.x relative luminance. */
function luminance(rgb: Rgb): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

function ratioOfLuminances(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

function ratio(a: string, b: string): number {
  return ratioOfLuminances(luminance(parseHex(a)), luminance(parseHex(b)));
}

describe('the structural edge pair survives every ground a user’s app can have', () => {
  const dark = luminance(parseHex(OVERLAY_COLORS.edgeDark));
  const light = luminance(parseHex(OVERLAY_COLORS.edgeLight));

  /**
   * Relative luminance is the only property of the ground that matters to the ratio, so sweeping
   * 0 → 1 is not a sample of some grounds: it is *every* ground, at 0.001 resolution.
   */
  function worstCase(): { best: number; atLuminance: number } {
    let best = Infinity;
    let atLuminance = 0;
    for (let i = 0; i <= 1000; i++) {
      const ground = i / 1000;
      const better = Math.max(ratioOfLuminances(dark, ground), ratioOfLuminances(light, ground));
      if (better < best) {
        best = better;
        atLuminance = ground;
      }
    }
    return { best, atLuminance };
  }

  it('one of the two strokes always clears the 3:1 non-text floor', () => {
    const { best, atLuminance } = worstCase();
    expect(best).toBeGreaterThanOrEqual(3);
    // Recorded rather than only asserted: the hardest ground is a mid grey, and the margin over
    // the floor is what says whether a future tweak to either stroke has room to move.
    expect(atLuminance).toBeGreaterThan(0.1);
    expect(atLuminance).toBeLessThan(0.4);
  });

  it('the dark stroke carries the light grounds and the light stroke carries the dark ones', () => {
    expect(ratio(OVERLAY_COLORS.edgeDark, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    expect(ratio(OVERLAY_COLORS.edgeLight, '#000000')).toBeGreaterThanOrEqual(3);
  });

  it('🔴 control — a single stroke CANNOT do this, which is why there are two', () => {
    // The editor's own selection outline today, and the reason this is a control rather than a
    // note: on white content it is 2.86:1, below the non-text floor. A row that passed here with
    // one colour would mean the sweep above was not measuring anything.
    const teal = '#2CA7BA';
    expect(ratio(teal, '#FFFFFF')).toBeLessThan(3);
    expect(ratio(teal, '#000000')).toBeGreaterThan(3);
  });
});

describe('the chips paint their own ground, so their text is a plain measurable pair', () => {
  it('the fact chip’s first line is body copy and is graded at 4.5:1', () => {
    expect(ratio(OVERLAY_COLORS.chipForeground, OVERLAY_COLORS.chipBackground)).toBeGreaterThanOrEqual(4.5);
  });

  it('the secondary fact lines are the same size and take the same floor, not a relaxed one', () => {
    // 11px monospace — large-text relief does not begin until 24px (or 18.66px bold), so the
    // dimmer colour the lines use to sit behind the size does not buy a lower number.
    expect(ratio(OVERLAY_COLORS.chipSecondary, OVERLAY_COLORS.chipBackground)).toBeGreaterThanOrEqual(4.5);
  });

  it('the band numbers carry their own ground because they sit on the tints', () => {
    expect(ratio(OVERLAY_COLORS.numberForeground, OVERLAY_COLORS.numberBackground)).toBeGreaterThanOrEqual(4.5);
  });

  it('control — the instrument reports a real failure when handed one', () => {
    expect(ratio('#777777', '#6E6E6E')).toBeLessThan(4.5);
  });
});
