/**
 * VFN-013 criterion 3 — *"Badge contrast measures ≥ 3:1 against whatever now sits behind it, in
 * both themes."*
 *
 * ## What is behind a badge, and why the answer is the same in both themes
 *
 * A badge is painted on a Blockly block. Block bodies are on Blockly's hue scale — HSV
 * saturation 0.45, value 0.65 — and are **theme-independent** on purpose: `BlocklyTheme`'s
 * module note says the hues are semantic ("green means loops") and only the chrome around the
 * blocks follows the editor's tokens. So "whatever sits behind it" is the same set of colours in
 * light and in dark, and the badge's own fill is the only variable.
 *
 * 🔴 **This file found a real failure and it is why `BADGE_TOKENS.surface` no longer carries a
 * token.** The badge used `--theme-color-bg-2`, which is `#f7f9fb` in the light theme and
 * measures **2.58:1** against the My Blocks hue — under the floor, on a control this register has
 * already lost nine glyphs to. The whole hue circle is swept below rather than the seven hues
 * `NoodlBlocks` happens to use today, so a block added at any hue is covered in advance.
 *
 * ⚠️ **`hueToHex` is asked, not assumed.** The saturation and value are Blockly's module state,
 * a theme can change them, and a table of hexes copied into a spec is a second truth about the
 * palette. Same reason `BADGE_TOKENS` is imported rather than restated.
 */

import * as Blockly from 'blockly';

import { BADGE_TOKENS } from '../../src/editor/src/views/BlocklyEditor/BlockValueBadges';

/** WCAG 2.x relative luminance. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Every hue a block could be given, in 10° steps. */
const HUE_CIRCLE = Array.from({ length: 36 }, (_, index) => index * 10);

function blockColours(): { hue: number; hex: string }[] {
  return HUE_CIRCLE.map((hue) => ({ hue, hex: Blockly.utils.colour.hueToHex(hue) }));
}

/**
 * The two colours that must not follow the theme, read from the module that draws them.
 *
 * `resolveThemeTokens` returns the fallback whenever a spec has no `css` name, so these are the
 * values the badge is painted with in *any* document — which is the property under test.
 */
const surface = BADGE_TOKENS.surface.fallback;
const ink = BADGE_TOKENS.text.fallback;

describe('VFN-013 criterion 3 — the badge reads against the block it sits on', () => {
  it('🔴 NEGATIVE CONTROL: the fill this replaced fails in the light theme', () => {
    // `--theme-color-bg-2` in `:root[data-theme='light']`, from
    // packages/noodl-core-ui/src/styles/custom-properties/colors.css.
    const lightBg2 = '#f7f9fb';

    const worst = blockColours()
      .map((block) => ({ ...block, ratio: contrast(lightBg2, block.hex) }))
      .sort((a, b) => a.ratio - b.ratio)[0];

    // eslint-disable-next-line no-console
    console.log(
      '[VFN-013 negative control] light --theme-color-bg-2 vs hue ' +
        worst.hue +
        ' (' +
        worst.hex +
        ') = ' +
        worst.ratio.toFixed(2) +
        ':1'
    );

    // If this ever clears 3, the palette changed and the assertions below became free.
    expect(worst.ratio).toBeLessThan(3);
  });

  it('the badge fill clears 3:1 against every hue a block can be', () => {
    const measured = blockColours().map((block) => ({ ...block, ratio: contrast(surface, block.hex) }));
    const worst = measured.sort((a, b) => a.ratio - b.ratio)[0];

    // eslint-disable-next-line no-console
    console.log(
      '[VFN-013] badge fill ' +
        surface +
        ' — worst hue ' +
        worst.hue +
        ' (' +
        worst.hex +
        ') = ' +
        worst.ratio.toFixed(2) +
        ':1'
    );

    expect(worst.ratio).toBeGreaterThanOrEqual(3);
  });

  it('and it does so in both themes, because it carries no theme token at all', () => {
    // The property, stated directly: a badge fill that resolved from a token would be light in
    // the light theme, and no light fill exists that clears the floor.
    expect(BADGE_TOKENS.surface.css).toBeUndefined();
    expect(BADGE_TOKENS.text.css).toBeUndefined();
  });

  it('the badge text clears 4.5:1 against the badge fill', () => {
    const ratio = contrast(ink, surface);

    // eslint-disable-next-line no-console
    console.log('[VFN-013] badge ink ' + ink + ' on ' + surface + ' = ' + ratio.toFixed(2) + ':1');

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('the hollow wash still follows the theme — it dims a block rather than sitting on one', () => {
    expect(BADGE_TOKENS.wash.css).toBe('--theme-color-bg-2');
  });
});
