/**
 * VFN-002 criterion 3 — *"The editor still reads as a Noodl control: correct background, correct
 * foreground, a visible border, AA contrast in both themes."*
 *
 * This criterion had never been measured. The geometry half of VFN-002 was driven and passed; the
 * task file's own closing line says so — *"🔴 Still owed: criterion 3's contrast reading, in both
 * themes. The ring is present and the tokens resolve, but no AA measurement was taken."*
 *
 * ## What is provable here, and what is not
 *
 * The rule names two tokens for the text pair (`--theme-color-fg-default` on
 * `--theme-color-bg-3`) and one for the ring. Both are decided in the source, in both themes, so
 * the ratio between them is arithmetic and needs no renderer — `tests-unit/support/themeTokens.ts`
 * exists for exactly this and states its own limits in its header.
 *
 * 🔴 **What this file cannot prove, and hands to the drive:**
 *
 *  - that these rules *win*. A declaration that is present and losing to another selector looks
 *    identical from here, and this repo has a register entry about the class of defect where they
 *    were. `scripts/devtools/icon-contrast.js`' header makes the same point about the same trap.
 *  - the ring's **outer** edge. A `box-shadow` paints outside the border box, so its other side is
 *    whatever the widget div is over — a Blockly block, on a hue scale no theme token clears (see
 *    the sweep below, which is measured but is a statement about the palette, not about a pass).
 *  - the caret and the selection highlight, which are painted by the platform.
 *
 * So: the AA text reading and the ring's inner boundary are **proved**; a screenshot of an open
 * field editor on a block, in both themes, is still **owed**.
 */
import * as fs from 'fs';
import * as path from 'path';

import * as Blockly from 'blockly';

import { contrastRatio, parseColor, resolveToken, themeTokens, tokenContrast } from '../support/themeTokens';
import type { ThemeName } from '../support/themeTokens';

const SCSS = path.join(__dirname, '../../src/editor/src/views/BlocklyEditor/BlocklyWorkspace.module.scss');

const THEMES: ThemeName[] = ['dark', 'light'];

/** WCAG 1.4.3 for body text at this size. */
const AA_TEXT = 4.5;
/** WCAG 1.4.11 for the boundary of a user interface component. */
const COMPONENT = 3;

/**
 * The tokens the rule actually names, read out of the stylesheet rather than restated.
 *
 * 🔴 A contrast spec with its own copy of the token names is a spec that keeps passing after
 * somebody changes the rule — it measures the pair it remembers, not the pair that ships.
 */
function fieldEditorTokens(): { background: string; foreground: string; ring: string } {
  const source = fs.readFileSync(SCSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  const selector = source.indexOf('.blocklyHtmlInput');
  expect(selector).toBeGreaterThan(-1);
  const open = source.indexOf('{', selector);
  const close = source.indexOf('}', open);
  const body = source.slice(open + 1, close);

  const named = (property: string): string => {
    const declaration = body
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.split(':')[0].trim() === property);
    expect(declaration).toBeDefined();

    const token = (declaration as string).match(/var\(\s*(--[\w-]+)\s*\)/);
    expect(token).not.toBeNull();
    return (token as RegExpMatchArray)[1];
  };

  return { background: named('background-color'), foreground: named('color'), ring: named('box-shadow') };
}

const tokens = fieldEditorTokens();

describe('VFN-002 criterion 3 — the field editor, measured', () => {
  it('names the three tokens this file goes on to measure', () => {
    // Not decoration: if the parse silently returned the same token three times every ratio below
    // would be 1.00 and the suite would still have "measured" something.
    expect(tokens.background).toBe('--theme-color-bg-3');
    expect(new Set(Object.values(tokens)).size).toBe(3);
  });

  it.each(THEMES)('the text clears AA against the field background — %s theme', (theme) => {
    const ratio = tokenContrast(theme, tokens.foreground, tokens.background);

    // eslint-disable-next-line no-console
    console.log(
      `[VFN-002 c3] ${theme}: ${tokens.foreground} on ${tokens.background} = ${ratio.toFixed(2)}:1`
    );

    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(THEMES)('the ring is a visible boundary against the field it rings — %s theme', (theme) => {
    const ratio = tokenContrast(theme, tokens.ring, tokens.background);

    // eslint-disable-next-line no-console
    console.log(`[VFN-002 c3] ${theme}: ring ${tokens.ring} on ${tokens.background} = ${ratio.toFixed(2)}:1`);

    expect(ratio).toBeGreaterThanOrEqual(COMPONENT);
  });

  /**
   * 🔴 NEGATIVE CONTROL — the token the ring used to carry.
   *
   * Every assertion above is "this ratio is high enough", which a formula stuck at 21 would also
   * satisfy. So run the same measurement over `--theme-color-border-default`, the token that was
   * there when criterion 3 was written, and require it to come back **below 1.2 in both themes** —
   * a ring the same colour as the surface it delimits. Watched red before being inverted: with
   * `border-default` restored in the stylesheet, the two assertions above failed at 1.01 and 1.11.
   */
  it.each(THEMES)('🔴 CONTROL: the token the ring replaced is invisible on this surface — %s', (theme) => {
    const ratio = tokenContrast(theme, '--theme-color-border-default', tokens.background);

    // eslint-disable-next-line no-console
    console.log(`[VFN-002 c3 control] ${theme}: --theme-color-border-default on bg-3 = ${ratio.toFixed(2)}:1`);

    expect(ratio).toBeLessThan(1.2);
  });

  /**
   * 🔴 NEGATIVE CONTROL — the formula discriminates.
   *
   * Black on white and white on white, through the same code path, so a ratio that came back
   * plausible for the real pair cannot have come from a function that returns a constant.
   */
  it('🔴 CONTROL: the formula separates the extremes', () => {
    const black = parseColor('#000000');
    const white = parseColor('#ffffff');
    expect(black).not.toBeNull();
    expect(white).not.toBeNull();

    expect(contrastRatio(black!, white!)).toBeCloseTo(21, 1);
    expect(contrastRatio(white!, white!)).toBeCloseTo(1, 5);
  });

  /**
   * ⚠️ Measured, and deliberately **not** asserted as a pass.
   *
   * The ring's outer edge is over a Blockly block. Block bodies are on Blockly's own hue scale and
   * are theme-independent by design (`BlocklyTheme`'s module note), and the sweep below is here so
   * that the number is on the record rather than discovered again: no `--theme-color-*` tone clears
   * 3:1 against the whole circle, which is the same wall VFN-013 hit and answered by taking the
   * theme out of the badge entirely. Doing that to a *text input's* ring would mean a light-theme
   * field with a dark ring, which is a different trade and belongs to whoever looks at it on screen.
   */
  it('records what the ring measures against the block behind it, in both themes', () => {
    const hues = Array.from({ length: 36 }, (_, index) => index * 10);

    for (const theme of THEMES) {
      const map = themeTokens(theme);
      const ring = parseColor(resolveToken(map, tokens.ring));
      const fill = parseColor(resolveToken(map, tokens.background));
      expect(ring).not.toBeNull();
      expect(fill).not.toBeNull();

      const worstRing = hues
        .map((hue) => ({ hue, ratio: contrastRatio(ring!, parseColor(Blockly.utils.colour.hueToHex(hue))!) }))
        .sort((a, b) => a.ratio - b.ratio)[0];
      const worstFill = hues
        .map((hue) => ({ hue, ratio: contrastRatio(fill!, parseColor(Blockly.utils.colour.hueToHex(hue))!) }))
        .sort((a, b) => a.ratio - b.ratio)[0];

      // eslint-disable-next-line no-console
      console.log(
        `[VFN-002 c3 · owed to the drive] ${theme}: ring vs worst block hue ${worstRing.hue} = ` +
          `${worstRing.ratio.toFixed(2)}:1; field fill vs hue ${worstFill.hue} = ${worstFill.ratio.toFixed(2)}:1`
      );

      // The only claim made: there is something there to measure. A `toBeGreaterThan(0)` on a
      // number that would be `NaN` if either token stopped resolving.
      expect(worstRing.ratio).toBeGreaterThan(0);
      expect(worstFill.ratio).toBeGreaterThan(0);
    }
  });
});
