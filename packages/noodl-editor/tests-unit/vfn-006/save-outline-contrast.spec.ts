/**
 * VFN-006 — the save-preview outline, measured against the blocks it is drawn on.
 *
 * ## Why this file exists
 *
 * This register keeps finding the same failure in two costumes: **a theme token painted onto a
 * Blockly surface**. VFN-013 found `--theme-color-bg-2` at 2.58:1 behind a value badge and took
 * the theme out of the badge. The save outline had it too, one token over: its casing was
 * `--theme-color-bg-1`, which is `#12161b` in the dark theme and **`#ffffff`** in the light one.
 * The module's own sentence — *"a dark casing underneath"* — was false in half the app, and the
 * white casing measured **2.72:1** against the My Blocks hue, which is the hue of the blocks a
 * save outline is most often wrapped around.
 *
 * ## The sweep
 *
 * The whole hue circle, in 10° steps, rather than the hues `NoodlBlocks` happens to use today —
 * VFN-013's reason, kept: a block added at any hue is then covered in advance. `hueToHex` is
 * asked rather than assumed, because saturation and value are Blockly's module state and a table
 * of hexes copied into a spec is a second truth about the palette.
 *
 * 🔴 What this cannot see, and the drive is owed: that the outline is *painted* — that the clone
 * lands inside the block's `<g>`, that `vector-effect` holds the widths under zoom, and that
 * nothing paints over it. A ratio is not a screenshot.
 */
import * as Blockly from 'blockly';

import { OUTLINE_TOKENS } from '../../src/editor/src/views/BlocklyEditor/MyBlocksSaveOutline';
import { MY_BLOCKS_HUE } from '../../src/editor/src/views/BlocklyEditor/MyBlocksBlocks';
import { APP_CONFIG_HUE } from '../../src/editor/src/views/BlocklyEditor/appConfig';
import { contrastRatio, parseColor, themeTokens, resolveToken } from '../support/themeTokens';

/** WCAG 1.4.11 — a graphical object that conveys meaning, against what is behind it. */
const GRAPHICS = 3;

const HUE_CIRCLE = Array.from({ length: 36 }, (_, index) => index * 10);

function hueHex(hue: number): string {
  return Blockly.utils.colour.hueToHex(hue);
}

function ratioTo(colour: string, hue: number): number {
  const a = parseColor(colour);
  const b = parseColor(hueHex(hue));
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  return contrastRatio(a!, b!);
}

function worstHue(colour: string): { hue: number; hex: string; ratio: number } {
  return HUE_CIRCLE.map((hue) => ({ hue, hex: hueHex(hue), ratio: ratioTo(colour, hue) })).sort(
    (a, b) => a.ratio - b.ratio
  )[0];
}

/**
 * What the stroke is actually painted with, in one theme.
 *
 * 🔴 **`resolveThemeTokens`' own rule, restated over the token map rather than the fallback.** A
 * spec that graded `spec.fallback` would be grading the colour used *when there is no document* —
 * which is green today and would have stayed green through the entire defect, because the broken
 * casing's fallback (`#11151b`) was dark and only its token resolved white. The paint is
 * `css ? getComputedStyle(root)[css] : fallback`, so that is what is measured.
 */
function painted(which: 'casing' | 'accent', theme: 'dark' | 'light'): string {
  const spec = OUTLINE_TOKENS[which];
  if (!spec.css) return spec.fallback;
  const value = resolveToken(themeTokens(theme), spec.css);
  expect(value).toBeDefined();
  return value as string;
}

const THEMES = ['dark', 'light'] as const;

describe('VFN-006 — the save outline reads on every block it can be drawn on', () => {
  it('neither stroke follows the theme — a mark on a block has no theme to follow', () => {
    // The property, stated directly rather than inferred from the ratios: a casing that resolved
    // from a token would be light in the light theme, and no light casing clears the floor below.
    expect(OUTLINE_TOKENS.casing.css).toBeUndefined();
    expect(OUTLINE_TOKENS.accent.css).toBeUndefined();
  });

  it.each(THEMES)('the casing clears 3:1 against every hue a block can be — %s theme', (theme) => {
    const casing = painted('casing', theme);
    const worst = worstHue(casing);

    // eslint-disable-next-line no-console
    console.log(
      `[VFN-006] ${theme}: casing ${casing} — worst hue ${worst.hue} (${worst.hex}) = ${worst.ratio.toFixed(2)}:1`
    );

    expect(worst.ratio).toBeGreaterThanOrEqual(GRAPHICS);
  });

  it.each(THEMES)('the accent clears 3:1 against the casing it is painted on — %s theme', (theme) => {
    const accent = painted('accent', theme);
    const casing = painted('casing', theme);
    const ratio = contrastRatio(parseColor(accent)!, parseColor(casing)!);

    // eslint-disable-next-line no-console
    console.log(`[VFN-006] ${theme}: accent ${accent} on casing ${casing} = ${ratio.toFixed(2)}:1`);

    expect(ratio).toBeGreaterThanOrEqual(GRAPHICS);
  });

  it.each(THEMES)('and on the two hues this phase added, named rather than swept — %s theme', (theme) => {
    // The circle above covers these, but naming them is what makes a future hue change face this
    // file rather than pass inside a 36-way `sort()[0]`.
    const casing = painted('casing', theme);
    for (const [name, hue] of [
      ['My Blocks', Number(MY_BLOCKS_HUE)],
      ['App Config', Number(APP_CONFIG_HUE)]
    ] as const) {
      const ratio = ratioTo(casing, hue);
      // eslint-disable-next-line no-console
      console.log(`[VFN-006] ${theme}: casing vs ${name} hue ${hue} (${hueHex(hue)}) = ${ratio.toFixed(2)}:1`);
      expect(ratio).toBeGreaterThanOrEqual(GRAPHICS);
    }
  });

  /**
   * 🔴 NEGATIVE CONTROL — the token the casing used to carry.
   *
   * Every assertion above is "this ratio is high enough". So run the same sweep over
   * `--theme-color-bg-1` as the **light** theme resolves it, which is what shipped, and require it
   * to fail. Watched red before being inverted: with `css: '--theme-color-bg-1'` restored, `the
   * casing clears 3:1` failed at 2.58 with `resolveThemeTokens` given a light document.
   */
  it('🔴 CONTROL: the light-theme value of the token it replaced fails the same sweep', () => {
    const light = resolveToken(themeTokens('light'), '--theme-color-bg-1');
    expect(light).toBeDefined();

    const worst = worstHue(light as string);

    // eslint-disable-next-line no-console
    console.log(
      `[VFN-006 control] light --theme-color-bg-1 ${light} — worst hue ${worst.hue} ` +
        `(${worst.hex}) = ${worst.ratio.toFixed(2)}:1; vs My Blocks hue ${MY_BLOCKS_HUE} = ` +
        `${ratioTo(light as string, Number(MY_BLOCKS_HUE)).toFixed(2)}:1`
    );

    expect(worst.ratio).toBeLessThan(GRAPHICS);
    // The specific block a save outline is most often drawn on, not just the worst of 36.
    expect(ratioTo(light as string, Number(MY_BLOCKS_HUE))).toBeLessThan(GRAPHICS);
  });

  /**
   * 🔴 NEGATIVE CONTROL — the sweep discriminates.
   *
   * A sweep that returned the same answer for everything would pass both of the assertions above
   * by accident. `#ffffff` and `#000000` through the same code path, and they must disagree.
   */
  it('🔴 CONTROL: the sweep tells a black casing from a white one', () => {
    expect(worstHue('#000000').ratio).toBeGreaterThanOrEqual(GRAPHICS);
    expect(worstHue('#ffffff').ratio).toBeLessThan(GRAPHICS);
    // And it is reading the hue table, not a constant: two hues have different answers.
    expect(ratioTo('#0b0e12', 60)).not.toBeCloseTo(ratioTo('#0b0e12', 240), 2);
  });
});
