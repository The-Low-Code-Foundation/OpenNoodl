/**
 * FIX-005 §1 — the dropdown nobody could read, measured.
 *
 * > *"The dropdowns that appear on certain nodes have strange highlight colours, between the one
 * > selected and the other non selected ones, their hover animations make them very hard to
 * > read."*
 *
 * Acceptance criterion 1 asks that the selected, hovered and keyboard-highlighted rows are each
 * distinct and each clear AA in **both** themes. Every colour involved is decided in source, in
 * both themes, so the ratios are arithmetic — `tests-unit/support/themeTokens.ts` exists for
 * exactly this and states its own limits. This file follows `vfn-002/field-editor-contrast.spec.ts`
 * in reading the token NAMES out of the stylesheet rather than restating them: a contrast spec
 * carrying its own copy of the token names keeps passing after somebody changes the rule.
 *
 * ## 🔴 What this file CANNOT prove, and hands to the drive
 *
 *  - that these rules **win**. A declaration present and losing to another selector is invisible
 *    from here, and this ruleset is a pile of `!important` where source order decides — which is
 *    precisely the defect criterion 2 is about. A screenshot of an open dropdown in both themes
 *    is still owed.
 *  - anything about `font-weight`, which is a real part of how selected is distinguished but is
 *    not a contrast question.
 *  - the perceptual size of a background step. The ratios below say two greys are 1.18:1 apart;
 *    that they *look* the same is a judgement this file only supports, never establishes.
 */
import * as fs from 'fs';
import * as path from 'path';

import { contrastRatio, parseColor, tokenContrast } from '../support/themeTokens';
import type { ThemeName } from '../support/themeTokens';

const SCSS = path.join(__dirname, '../../src/editor/src/views/BlocklyEditor/BlocklyWorkspace.module.scss');

const THEMES: ThemeName[] = ['dark', 'light'];

/** WCAG 1.4.3 for body text at this size. */
const AA_TEXT = 4.5;
/** WCAG 1.4.11 for the boundary of a user interface component — what a 3px rule is. */
const COMPONENT = 3;

const source = fs.readFileSync(SCSS, 'utf8');
/** Comments stripped, so a token named in prose is never mistaken for a declaration. */
const declarations = source.replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of the first rule whose selector text contains `needle`. */
function ruleBody(needle: string): string {
  const at = declarations.indexOf(needle);
  expect(at).toBeGreaterThan(-1);
  const open = declarations.indexOf('{', at);
  // Nested SCSS: walk braces rather than taking the first `}`.
  let depth = 0;
  for (let i = open; i < declarations.length; i++) {
    if (declarations[i] === '{') depth++;
    else if (declarations[i] === '}' && --depth === 0) return declarations.slice(open + 1, i);
  }
  throw new Error(`unbalanced braces after ${needle}`);
}

/** The token named by `property` in `body`, e.g. `--theme-color-bg-4`. */
function tokenFor(body: string, property: string): string {
  const declaration = body
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.split(':')[0].trim() === property);
  expect(declaration).toBeDefined();

  const token = (declaration as string).match(/var\(\s*(--[\w-]+)\s*\)/);
  expect(token).not.toBeNull();
  return (token as RegExpMatchArray)[1];
}

const menuItem = ruleBody('.blocklyDropDownDiv .blocklyMenuItem');

/** The four states, as the stylesheet actually spells them. */
const STATE = {
  text: tokenFor(menuItem, 'color'),
  resting: tokenFor(ruleBody('.blocklyDropDownDiv,\n  :global(.blocklyDropDownDiv)'), 'background-color'),
  hover: tokenFor(ruleBody("&:hover,\n    &.blocklyMenuItemHighlight,"), 'background-color'),
  hoverRule: tokenFor(ruleBody("&:hover,\n    &.blocklyMenuItemHighlight {"), 'border-left-color'),
  selected: tokenFor(ruleBody("&[aria-selected='true'],"), 'background-color'),
  selectedRule: tokenFor(ruleBody("&[aria-selected='true'] {"), 'border-left-color')
};

describe('FIX-005 §1 — the dropdown reads the tokens it ships', () => {
  it('names four distinct backgrounds and two distinct rules', () => {
    // Not decoration: a parse that silently returned one token six times would make every ratio
    // below 1.00 and the suite would still claim to have measured something.
    expect(STATE.text).toBe('--theme-color-fg-highlight');
    expect(new Set([STATE.resting, STATE.hover, STATE.selected]).size).toBe(3);
    expect(STATE.hoverRule).not.toBe(STATE.selectedRule);
  });

  it('never paints text on the accent, which is what failed', () => {
    // The whole defect in one assertion: no state may put the row's label on solid primary.
    for (const background of [STATE.resting, STATE.hover, STATE.selected]) {
      expect(background).not.toBe('--theme-color-primary');
      expect(background).not.toBe('--theme-color-primary-highlight');
    }
  });
});

describe('FIX-005 §1 criterion 1 — every state clears AA in both themes', () => {
  const states: [string, keyof typeof STATE][] = [
    ['resting', 'resting'],
    ['hover / keyboard highlight', 'hover'],
    ['selected', 'selected']
  ];

  for (const [label, key] of states) {
    it.each(THEMES)(`${label} — %s theme`, (theme) => {
      const ratio = tokenContrast(theme, STATE.text, STATE[key]);
      // eslint-disable-next-line no-console
      console.log(`[FIX-005 c1] ${theme}: ${label} — ${STATE.text} on ${STATE[key]} = ${ratio.toFixed(2)}:1`);
      expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
    });
  }
});

describe('FIX-005 §1 — the rules are visible boundaries', () => {
  it.each(THEMES)('the hover rule clears 3:1 on its own row — %s theme', (theme) => {
    const ratio = tokenContrast(theme, STATE.hoverRule, STATE.hover);
    // eslint-disable-next-line no-console
    console.log(`[FIX-005] ${theme}: hover rule ${STATE.hoverRule} on ${STATE.hover} = ${ratio.toFixed(2)}:1`);
    expect(ratio).toBeGreaterThanOrEqual(COMPONENT);
  });

  it.each(THEMES)('the selected rule clears 3:1 on its own row — %s theme', (theme) => {
    const ratio = tokenContrast(theme, STATE.selectedRule, STATE.selected);
    // eslint-disable-next-line no-console
    console.log(
      `[FIX-005] ${theme}: selected rule ${STATE.selectedRule} on ${STATE.selected} = ${ratio.toFixed(2)}:1`
    );
    expect(ratio).toBeGreaterThanOrEqual(COMPONENT);
  });
});

/**
 * 🔴 THE NEGATIVE CONTROL, and it is the reason this file exists rather than a screenshot.
 *
 * Every assertion above is "this ratio is high enough", which a formula stuck at 21 would also
 * satisfy. So measure what the stylesheet used to do — `fg-highlight` on solid
 * `--theme-color-primary` — and require it to come back BELOW AA in both themes. Watched red
 * before being inverted: with the old rule restored, the selected-row assertion above fails at
 * 2.33 (dark) and 3.56 (light), which are the report's numbers.
 */
describe('FIX-005 §1 criterion 4 — the control', () => {
  it.each(THEMES)('🔴 CONTROL: the rule this replaced fails AA — %s theme', (theme) => {
    const ratio = tokenContrast(theme, '--theme-color-fg-highlight', '--theme-color-primary');
    // eslint-disable-next-line no-console
    console.log(`[FIX-005 control] ${theme}: fg-highlight on solid primary = ${ratio.toFixed(2)}:1`);
    expect(ratio).toBeLessThan(AA_TEXT);
  });

  /**
   * 🔴 CONTROL for the design decision itself — why state moved onto a rule.
   *
   * The neutral ladder is too compressed to carry a state change. If this ever stops being true
   * the stylesheet's long comment is wrong and should be revisited, so it is asserted rather
   * than merely written down.
   */
  it.each(THEMES)('🔴 CONTROL: the background steps alone are imperceptible — %s theme', (theme) => {
    const oneStep = tokenContrast(theme, '--theme-color-bg-4', '--theme-color-bg-3');
    const twoSteps = tokenContrast(theme, '--theme-color-bg-5', '--theme-color-bg-3');
    // eslint-disable-next-line no-console
    console.log(`[FIX-005 control] ${theme}: bg-4/bg-3 = ${oneStep.toFixed(2)}, bg-5/bg-3 = ${twoSteps.toFixed(2)}`);
    expect(oneStep).toBeLessThan(1.5);
    expect(twoSteps).toBeLessThan(1.5);
  });

  it('🔴 CONTROL: the formula separates the extremes', () => {
    const black = parseColor('#000000');
    const white = parseColor('#ffffff');
    expect(contrastRatio(black!, white!)).toBeCloseTo(21, 0);
    expect(contrastRatio(white!, white!)).toBeCloseTo(1, 5);
  });
});

/**
 * 🔴 FIX-005 §1 — the five toolbox specs that used to sit here are DELETED, and they are the
 * sharpest thing this file has to say.
 *
 * They graded `.blocklyTreeSelected` and `.blocklyTreeLabel`: five green rows, a negative control
 * that fired at 1.19:1, arithmetic correct throughout. Then the drive opened the toolbox and
 * counted matches — **both selectors match zero elements**, and had for several major Blockly
 * versions. Blockly 12 emits `.blocklyToolboxSelected` and `.blocklyToolboxCategoryLabel`, and
 * paints the selected category from an inline style. So the block measured, in both themes and
 * with a working control, a rule that has never been on screen.
 *
 * ⚠️ **The control did not save it, and could not have.** It varied the *background token* and
 * held the *selector* constant, so it proved the formula separates two colours — never that either
 * colour reaches a pixel. Reading a token name out of a stylesheet establishes what the file says,
 * not what the browser applies, and this file's own header says so in the first paragraph. The
 * dropdown blocks above are exempt only because session 21 opened the menu and counted matches.
 *
 * The stylesheet rules went with them (see the note in `BlocklyWorkspace.module.scss`). Nothing is
 * asserted about the toolbox here now: what renders is Blockly's own selection at 5.35:1, which
 * passes AA and is not ours to measure from a token table.
 */
