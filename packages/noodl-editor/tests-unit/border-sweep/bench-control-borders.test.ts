import * as fs from 'fs';
import * as path from 'path';

import { ThemeName, tokenContrast } from '../support/themeTokens';

/**
 * The component bench's slice of the `--theme-color-border-default` sweep opened in phase 75
 * (`BORDER-CONTROL-SWEEP.md`). Sibling of `node-picker-control-borders.test.ts`.
 *
 * 🔴 `border-default` IS A DIVIDER TONE AND IS SUPPOSED TO BE INVISIBLE — `colors.css` says so in
 * two comment blocks, and NAT-003 records the day the ramp moved without it. The defect is never
 * the token; it is the subset of declarations that are CONTROL boundaries wearing it.
 *
 * 🔴 THE NODE PICKER'S REMEDY DOES NOT TRANSFER TO THIS FAMILY, AND THAT IS THE FINDING HERE.
 * There, `:hover` lightened the fill `bg-2 -> bg-1`, which RAISED the very same border (3.57 ->
 * 4.17) — so deleting `border-color` from the hover rule was enough. Here both hover rules move
 * the fill the other way, `bg-3 -> bg-4`, where `border-control` measures 2.64:1 dark / 2.77:1
 * light — UNDER 3:1. Dropping `border-color` would therefore have left the control failing 1.4.11
 * *while the pointer is on it*, and the fill step cannot carry the boundary alone (bg-4 on bg-2 is
 * 1.35 / 1.22). Both rules now use `primary`. `the hover fill CANNOT identify the control on its
 * own` below is the row that records why, and it is a measurement rather than a memo.
 *
 * 🔴 THE SWEEP'S INVENTORY MISSED A SITE HERE TOO — the FOURTH independent proof that 60 is a
 * floor. That query selects blocks holding both `border-default` and `cursor: pointer`; it listed
 * six sites in this family and did not list `BenchScenarioBar .NameField`, which misses on BOTH
 * counts: it is a text `<input>`, so it sets no cursor, and its edge named `border-strong` rather
 * than `border-default`. Both are NAT-003 divider tones. It measured 1.74:1 on its own fill.
 *
 * 🔴 THIS SPEC READS THE STYLESHEETS, NOT THE PALETTE. Asserting `border-control` clears 3:1 would
 * pass on a build where the bench never names it — that ratio is a property of the token, and every
 * claim here is about a SURFACE. Each row resolves the selector's own border, its own fill and its
 * ground out of the `.scss` files, so a revert fails at a NUMBER.
 */

const BENCH = path.resolve(__dirname, '../../src/editor/src/views/VisualCanvas');

const FILES = {
  bench: `${BENCH}/ComponentBench.module.scss`,
  scenario: `${BENCH}/BenchScenarioBar.module.scss`,
  inputs: `${BENCH}/BenchInputsRail.module.scss`,
  outputs: `${BENCH}/BenchOutputsRail.module.scss`
} as const;

type FileKey = keyof typeof FILES;

/** ⚠️ Comments are stripped FIRST — the prose added by this sweep names the very tokens the
 *  parser below looks for, and a regex that read a comment would report the wrong tone. */
const source = (file: FileKey) => fs.readFileSync(FILES[file], 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Brace-matched body of the rule whose selector is EXACTLY `selector`. */
function rule(file: FileKey, selector: string): string {
  const text = source(file);
  const open = text.search(new RegExp(`^\\${selector}\\s*\\{`, 'm'));
  if (open === -1) throw new Error(`no such rule in ${file}: ${selector}`);
  const start = text.indexOf('{', open);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(start + 1, i);
  }
  throw new Error(`unbalanced braces after ${selector} in ${file}`);
}

/**
 * Every OTHER top-level rule whose selector starts with this base and carries a state suffix —
 * `:hover`, `:disabled`, `.is-primary`, `.is-hidden`. 🔴 The sweep's finding is that the unit of
 * work is a RULE, not a declaration: a resting edge raised to a control tone while a `:hover`
 * quietly keeps a divider is a REGRESSION, not a fix. Discovering the states from disk means a
 * state added later is measured without anyone remembering to add a row for it.
 */
function stateRules(file: FileKey, base: string): { selector: string; body: string }[] {
  const text = source(file);
  const found: { selector: string; body: string }[] = [];
  const pattern = new RegExp(`^\\${base}([:.][^{]*?)\\s*\\{`, 'gm');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const start = text.indexOf('{', match.index);
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) {
        found.push({ selector: `${base}${match[1].trim()}`, body: text.slice(start + 1, i) });
        break;
      }
    }
  }
  return found;
}

type Property = 'border' | 'border-color' | 'background-color';

/** The token a declaration names, e.g. `border: 1px solid var(--x)` -> `--x`. */
function tokenOf(body: string, property: Property): string | null {
  const match = body.match(new RegExp(`(?:^|[;{\\s])${property}:[^;]*?var\\((--[a-z0-9-]+)\\)`, 'm'));
  return match ? match[1] : null;
}

function declares(body: string, property: Property): boolean {
  return new RegExp(`(?:^|[;{\\s])${property}:`, 'm').test(body);
}

/**
 * The ground every rail in this family is seen against: `ComponentBench .Rail`, the 260px column
 * that holds the scenario bar, the inputs rail and the outputs read-out. None of the three paints
 * its own background, so the ground is read from the file that actually paints it — not from the
 * file the control lives in.
 */
function railGround(): string {
  const token = tokenOf(rule('bench', '.Rail'), 'background-color');
  if (!token) throw new Error('ComponentBench .Rail no longer paints a background');
  return token;
}

/** A rule's fill. `background-color: transparent` means the ground shows through, which is the
 *  case for four of the seven controls here — for those, BOTH sides of the edge are the ground. */
function fillToken(body: string, fallback: string): string {
  return tokenOf(body, 'background-color') ?? fallback;
}

/**
 * The seven CONTROLS in the bench. Confirmed against the TSX: `.PickerChip`, `.Action`, `.Empty`,
 * `.SignalButton`, `.ResetAll` and `.Clear` are `<button>`s, and `.NameField` is an `<input>`.
 *
 * ⚠️ DELIBERATELY ABSENT and asserted as dividers at the bottom of this file: `ComponentBench
 * .Frame` (the preview box's edge — a REGION boundary, and the thing the sweep doc warns is a
 * judgement rather than a grep) and `BenchScenarioBar .Menu` (a popup SURFACE). A reader operates
 * neither.
 */
const CONTROLS: { name: string; file: FileKey; selector: string }[] = [
  { name: 'BenchScenarioBar .PickerChip (a <button>)', file: 'scenario', selector: '.PickerChip' },
  { name: 'BenchScenarioBar .Action (a <button>)', file: 'scenario', selector: '.Action' },
  { name: 'BenchScenarioBar .Empty (a <button>)', file: 'scenario', selector: '.Empty' },
  { name: 'BenchScenarioBar .NameField (an <input> — the inventory MISS)', file: 'scenario', selector: '.NameField' },
  { name: 'BenchInputsRail .SignalButton (a <button>)', file: 'inputs', selector: '.SignalButton' },
  { name: 'BenchInputsRail .ResetAll (a <button>)', file: 'inputs', selector: '.ResetAll' },
  { name: 'BenchOutputsRail .Clear (a <button>)', file: 'outputs', selector: '.Clear' }
];

describe.each(['dark', 'light'] as ThemeName[])('the component bench in %s', (theme) => {
  const ground = () => railGround();

  describe.each(CONTROLS)('$name', ({ file, selector }) => {
    const body = () => rule(file, selector);
    const border = () => {
      const token = tokenOf(body(), 'border');
      if (!token) throw new Error(`${file} ${selector}: no \`border\` naming a token`);
      return token;
    };

    it('its resting boundary clears 3:1 against its own fill', () => {
      const ratio = tokenContrast(theme, border(), fillToken(body(), ground()));
      const verdict =
        ratio >= 3
          ? 'passes'
          : `${file} ${selector}'s border is ${ratio.toFixed(2)}:1 on its own fill in ${theme} — under ` +
            `1.4.11's 3:1, so the control has no perceivable edge`;
      expect(verdict).toBe('passes');
    });

    it('its resting boundary clears 3:1 against the rail behind it', () => {
      // 🔴 The edge has TWO sides. A border that cleared its own fill and vanished into the column
      // behind it would still leave the control without an outline.
      const ratio = tokenContrast(theme, border(), ground());
      const verdict =
        ratio >= 3 ? 'passes' : `${file} ${selector}'s border is ${ratio.toFixed(2)}:1 on the bench rail in ${theme}`;
      expect(verdict).toBe('passes');
    });

    it('🔴 no state of it moves the edge below 3:1 on EITHER side', () => {
      // The row a find-and-replace over the sweep's inventory would not have. `border-strong` is
      // not a stronger control tone — it is one of NAT-003's three DIVIDER tones, and both
      // `.PickerChip:hover` and `.SignalButton:hover` used to move the edge to it. Restoring
      // either reddens this row at a number (1.10 dark / 1.14 light on the hover fill).
      const rest = body();
      const failures: string[] = [];

      for (const state of stateRules(file, selector)) {
        if (!declares(state.body, 'border-color') && !declares(state.body, 'background-color')) continue;
        const stateBorder = tokenOf(state.body, 'border-color') ?? border();
        const stateFill = declares(state.body, 'background-color')
          ? fillToken(state.body, ground())
          : fillToken(rest, ground());

        const onFill = tokenContrast(theme, stateBorder, stateFill);
        const onGround = tokenContrast(theme, stateBorder, ground());
        if (onFill < 3) failures.push(`${state.selector} is ${onFill.toFixed(2)}:1 on its own fill`);
        if (onGround < 3) failures.push(`${state.selector} is ${onGround.toFixed(2)}:1 on the rail`);
      }

      expect(failures).toEqual([]);
    });
  });

  it('🔴 the hover fill CANNOT identify the control on its own', () => {
    // This is why the node picker's remedy — delete `border-color` and let the fill carry the edge
    // — does not transfer to this family, and it is a MEASUREMENT rather than a memo. There the
    // hover fill moved TOWARD the border tone; here it moves away, and the step it makes against
    // the rail is 1.35 dark / 1.22 light. If this row ever clears 3:1 the fill would be doing the
    // work on its own and the hover borders could be reconsidered — until then they are structural.
    const hover = tokenOf(rule('scenario', '.PickerChip:hover'), 'background-color');
    expect(hover).toBe('--theme-color-bg-4');
    expect(tokenContrast(theme, hover as string, railGround())).toBeLessThan(3);
  });

  it('🔴 NEGATIVE CONTROL: `border-default` is still a divider and was NOT raised to pass this file', () => {
    // The cheap way to turn every row above green is to raise the shared token — which would fix
    // nothing here and restage NAT-003 across all 376 declarations, reddening VFN-002's c3 by
    // construction. If this row goes red, read NAT-003's note in `colors.css` BEFORE changing
    // anything: the ramp has probably moved and the dividers have not followed.
    //
    // ⚠️ THE BOUND IS 1.2 HERE AND 1.4 IN THE NODE PICKER'S COPY OF THIS ROW, AND BOTH ARE RIGHT.
    // The bench rail is `bg-2`, where the divider measures 1.07 / 1.15; the picker panel is `bg-1`,
    // where `colors.css` documents it at 1.254 BY DESIGN. The bound belongs to the GROUND, not to
    // the token — copying the other file's threshold reads a correct value as a defect.
    expect(tokenContrast(theme, '--theme-color-border-default', railGround())).toBeLessThan(1.2);
  });

  it('🔴 NEGATIVE CONTROL: `border-strong` is a divider too, and is not a control tone', () => {
    // This is why the state rows exist, and why `.NameField` was a defect rather than a style. If
    // someone "fixes" a hover by raising `border-strong`, they have moved a divider tone and every
    // hairline in the editor moved with it.
    expect(tokenContrast(theme, '--theme-color-border-strong', railGround())).toBeLessThan(1.8);
  });
});

describe('🔴 NEGATIVE CONTROL: the non-controls in the bench still wear the divider token', () => {
  // ⚠️ The complement of CONTROLS. Without this, sweeping every `border-default` in the family to
  // `border-control` — the over-correction the sweep exists to refuse — passes silently. Both of
  // these are REGIONS: the preview box's own edge, and the surface a dropdown paints. The sweep
  // doc's warning that membership is a judgement rather than a grep is aimed at exactly this pair.
  const DIVIDERS: [FileKey, string][] = [
    ['bench', '.Frame'], // the preview box edge — a region boundary, not something operated
    ['scenario', '.Menu'] // a popup surface
  ];

  it.each(DIVIDERS)('%s %s', (file, selector) => {
    expect([`${file}${selector}`, rule(file, selector).includes('--theme-color-border-default')]).toEqual([
      `${file}${selector}`,
      true
    ]);
  });
});
