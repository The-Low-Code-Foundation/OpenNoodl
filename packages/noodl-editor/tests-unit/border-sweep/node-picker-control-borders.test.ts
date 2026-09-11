import * as fs from 'fs';
import * as path from 'path';

import {
  ThemeName,
  contrastRatio,
  parseColor,
  resolveToken,
  themeTokens,
  tokenContrast,
  Rgb
} from '../support/themeTokens';

/**
 * The node picker's slice of the `--theme-color-border-default` sweep opened in phase 75
 * (`BORDER-CONTROL-SWEEP.md`).
 *
 * 🔴 `border-default` IS A DIVIDER TONE AND IS SUPPOSED TO BE INVISIBLE — `colors.css` says so in
 * two comment blocks, and NAT-003 records the day the ramp moved without it. The defect is never
 * the token; it is the subset of declarations that are CONTROL boundaries wearing it. POL-016's
 * `--theme-color-border-control` was already the right tone and clears 3:1 on bg-0/1/2/3 in both
 * themes.
 *
 * 🔴 THE SWEEP'S 60-SITE INVENTORY IS A FLOOR, AND THIS FAMILY PROVES IT AGAIN. That query selects
 * blocks holding both `border-default` and `cursor: pointer`, so it listed three sites here
 * (`.Root`, `.Action`, `.DocsButton`) out of nine stylesheets that name the token. It MISSED
 * `NodePickerSearchBar .Field` — the visible boundary of a text `<input>`, which never sets a
 * cursor. That site was found by reading the files, exactly as `.TemplateFilter-search` was.
 *
 * 🔴 AND IT MISSED A DEFECT THE RESTING-STATE FIX WOULD HAVE CREATED. `--theme-color-border-strong`
 * is not a stronger control tone — it is one of the three DIVIDER tones (1.74:1 dark / 1.53:1
 * light). Both `.Root:hover` and `.DocsButton:hover` moved the edge to it. Raising only the resting
 * declaration would therefore have made the boundary WEAKER when a reader points at it: 3.57 -> 1.74.
 * `hover does not weaken the edge` below is the row that refuses that, and it is the one a
 * find-and-replace over the inventory would not have.
 *
 * 🔴 THIS SPEC READS THE STYLESHEETS, NOT THE PALETTE. Asserting `border-control` clears 3:1 would
 * pass on a build where the node picker never names it — that ratio is a property of the token, and
 * every claim here is about a SURFACE. Each row resolves the selector's own border, its own fill and
 * its ground out of the `.scss` files, so a revert fails at a NUMBER.
 */

const PICKER = path.resolve(__dirname, '../../src/editor/src/views/NodePicker');

const FILES = {
  picker: `${PICKER}/NodePicker.module.scss`,
  card: `${PICKER}/components/NodePickerCard/NodePickerCard.module.scss`,
  search: `${PICKER}/components/NodePickerSearchBar/NodePickerSearchBar.module.scss`,
  empty: `${PICKER}/components/NodePickerEmpty/NodePickerEmpty.module.scss`,
  preview: `${PICKER}/components/NodePickerPreview/NodePickerPreview.module.scss`,
  footer: `${PICKER}/components/NodePickerFooter/NodePickerFooter.module.scss`,
  rail: `${PICKER}/components/NodePickerRail/NodePickerRail.module.scss`,
  results: `${PICKER}/components/NodePickerResults/NodePickerResults.module.scss`,
  library: `${PICKER}/tabs/NodeLibrary/NodeLibrary.module.scss`
} as const;

type FileKey = keyof typeof FILES;

const source = (file: FileKey) => fs.readFileSync(FILES[file], 'utf8');

/**
 * The full body of a top-level rule, brace-matched so nested `&:hover` blocks come with it.
 * (T4's version stopped at the first `^}`, which is only safe for flat blocks; these are not.)
 */
function block(file: FileKey, selector: string): string {
  const text = source(file);
  const open = text.search(new RegExp(`^\\${selector}\\s*\\{`, 'm'));
  if (open === -1) throw new Error(`no such top-level selector in ${file}: ${selector}`);
  const start = text.indexOf('{', open);
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(start + 1, i);
  }
  throw new Error(`unbalanced braces after ${selector} in ${file}`);
}

/** A rule's own declarations, with every nested block removed. */
function own(body: string): string {
  let flat = body;
  let next: string;
  while ((next = flat.replace(/\{[^{}]*\}/g, '')) !== flat) flat = next;
  // Drop the selector lines the nested blocks left behind.
  return flat.replace(/^[^;]*$/gm, (line) => (line.includes(':') && !line.includes('&') ? line : ''));
}

/** The body of a nested rule, e.g. `&:hover`, or null when the rule declares none. */
function nested(body: string, selector: string): string | null {
  const open = body.indexOf(`${selector} {`);
  if (open === -1) return null;
  const start = body.indexOf('{', open);
  let depth = 0;
  for (let i = start; i < body.length; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}' && --depth === 0) return body.slice(start + 1, i);
  }
  return null;
}

type Property = 'border' | 'border-color' | 'background-color';

/** The token a declaration names, e.g. `border: 1px solid var(--x)` -> `--x`. */
function tokenOf(body: string, property: Property): string | null {
  const match = body.match(new RegExp(`(?:^|\\s)${property}:[^;]*?var\\((--[a-z0-9-]+)\\)`, 'm'));
  return match ? match[1] : null;
}

function required(body: string, property: Property, where: string): string {
  const token = tokenOf(body, property);
  if (!token) throw new Error(`${where}: no \`${property}\` naming a token`);
  return token;
}

function rgb(theme: ThemeName, token: string): Rgb {
  const colour = parseColor(resolveToken(themeTokens(theme), token));
  if (!colour) throw new Error(`unresolvable token in ${theme}: ${token}`);
  return colour;
}

/** `color-mix(in srgb, var(--a) N%, var(--b))` as the sRGB blend browsers paint. */
function mixedRgb(theme: ThemeName, declaration: string): Rgb {
  const match = declaration.match(
    /color-mix\(in srgb,\s*var\((--[a-z0-9-]+)\)\s*(\d+)%,\s*var\((--[a-z0-9-]+)\)\s*\)/
  );
  if (!match) throw new Error(`not a two-token srgb color-mix: ${declaration.trim()}`);
  const [, a, percent, b] = match;
  const [ca, cb] = [rgb(theme, a), rgb(theme, b)];
  const weight = Number(percent) / 100;
  return [0, 1, 2].map((i) => Math.round(ca[i] * weight + cb[i] * (1 - weight))) as Rgb;
}

/**
 * The four CONTROLS in the picker. `fill` is the rule's own `background-color`; `ground` is the
 * surface BEHIND it, read from whichever stylesheet actually paints it — the picker panel for the
 * three that sit in the results column, the preview column for the docs button.
 *
 * ⚠️ DELIBERATELY ABSENT and asserted as dividers at the bottom of this file: the panel itself,
 * the rail/footer/preview hairlines, `.GroupRule`, and the two keycap chips (`.Kbd`, `.Enter`),
 * which are hints rather than things a reader operates.
 */
const CONTROLS = [
  { name: 'NodePickerCard .Root (a <button>)', file: 'card' as FileKey, selector: '.Root', ground: 'picker' as FileKey },
  { name: 'NodePickerSearchBar .Field (wraps the <input>)', file: 'search' as FileKey, selector: '.Field', ground: 'picker' as FileKey },
  { name: 'NodePickerEmpty .Action (a <button>)', file: 'empty' as FileKey, selector: '.Action', ground: 'picker' as FileKey },
  { name: 'NodePickerPreview .DocsButton (a <button>)', file: 'preview' as FileKey, selector: '.DocsButton', ground: 'preview' as FileKey }
];

/** The ground a control is seen against: the `.Root` fill of the column that holds it. */
function groundToken(file: FileKey): string {
  return required(own(block(file, '.Root')), 'background-color', `${file} .Root`);
}

describe.each(['dark', 'light'] as ThemeName[])('the node picker in %s', (theme) => {
  describe.each(CONTROLS)('$name', ({ file, selector, ground }) => {
    it('its resting boundary clears 3:1 against its own fill', () => {
      const body = own(block(file, selector));
      const where = `${file} ${selector}`;
      const ratio = tokenContrast(theme, required(body, 'border', where), required(body, 'background-color', where));
      const verdict =
        ratio >= 3
          ? 'passes'
          : `${where}'s border is ${ratio.toFixed(2)}:1 on its own fill in ${theme} — under 1.4.11's ` +
            `3:1, so the control has no perceivable edge`;
      expect(verdict).toBe('passes');
    });

    it('its resting boundary clears 3:1 against the surface behind it', () => {
      // 🔴 The edge has TWO sides. A border that cleared its own fill and vanished into the column
      // behind it would still leave the control without an outline.
      const body = own(block(file, selector));
      const where = `${file} ${selector}`;
      const ratio = tokenContrast(theme, required(body, 'border', where), groundToken(ground));
      const verdict =
        ratio >= 3 ? 'passes' : `${where}'s border is ${ratio.toFixed(2)}:1 on the ${ground} column in ${theme}`;
      expect(verdict).toBe('passes');
    });

    it('🔴 hover does not WEAKEN the edge', () => {
      // The row a find-and-replace over the sweep's inventory would not have. `border-strong` is a
      // DIVIDER tone, and both the card and the docs button used to move their edge to it on hover
      // — which, once the resting edge is a real 3:1 control tone, is a DOWNGRADE (3.57 -> 1.74).
      // Restoring either `border-color` reddens this row at a number.
      const body = block(file, selector);
      const rest = own(body);
      const where = `${file} ${selector}:hover`;
      const restingToken = required(rest, 'border', where);
      const restingRatio = tokenContrast(theme, restingToken, required(rest, 'background-color', where));

      const hover = nested(body, '&:hover');
      if (!hover) return; // no hover rule at all: nothing can weaken.

      const hoverBorder = tokenOf(hover, 'border-color') ?? restingToken;
      const hoverFill = tokenOf(hover, 'background-color') ?? required(rest, 'background-color', where);
      const hoverRatio = tokenContrast(theme, hoverBorder, hoverFill);

      const verdict =
        hoverRatio >= 3 && hoverRatio >= restingRatio - 0.005
          ? 'passes'
          : `${where} is ${hoverRatio.toFixed(2)}:1 while resting is ${restingRatio.toFixed(2)}:1 in ` +
            `${theme} — pointing at the control makes its boundary harder to see`;
      expect(verdict).toBe('passes');
    });
  });

  it('the unavailable card still has an identifiable edge', () => {
    // BCN-010 dims and badges a card the backend cannot serve, but IT STILL INSERTS — so it is
    // still a control. Mixed against the divider tone this measured 3.19 dark / 2.52 LIGHT, i.e.
    // already failing before the sweep touched it.
    const declaration = block('card', '.is-unavailable').match(/border-color:[^;]*;/)?.[0] ?? '';
    const ratio = contrastRatio(mixedRgb(theme, declaration), rgb(theme, groundToken('picker')));
    const verdict =
      ratio >= 3 ? 'passes' : `the unavailable card's dashed edge is ${ratio.toFixed(2)}:1 in ${theme}`;
    expect(verdict).toBe('passes');
  });

  it('🔴 NEGATIVE CONTROL: `border-default` is still a divider and was NOT raised to pass this file', () => {
    // The cheap way to turn every row above green is to raise the shared token — which would fix
    // nothing here and restage NAT-003 across all 376 declarations, reddening VFN-002's c3 by
    // construction. If this row goes red, read NAT-003's note in `colors.css` BEFORE changing
    // anything: the ramp has probably moved and the dividers have not followed.
    //
    // ⚠️ THE BOUND IS 1.4 HERE AND 1.2 IN THE SHELF'S COPY OF THIS ROW, AND BOTH ARE RIGHT. That
    // spec measures the divider against `bg-2`; the picker panel is `bg-1`, where `colors.css`
    // documents `border-default` at 1.254 BY DESIGN ("re-placed at the ratio it held against
    // bg-1: 1.109 / 1.254 / 1.730"). Copying the other file's threshold reads the correct value
    // as a defect — the bound belongs to the GROUND, not to the token.
    expect(tokenContrast(theme, '--theme-color-border-default', groundToken('picker'))).toBeLessThan(1.4);
  });

  it('🔴 NEGATIVE CONTROL: `border-strong` is a divider too, and is not a control tone', () => {
    // This is why the hover rows exist. If someone "fixes" hover by raising `border-strong`, they
    // have moved a divider tone and every hairline in the editor moved with it.
    expect(tokenContrast(theme, '--theme-color-border-strong', groundToken('picker'))).toBeLessThan(2.5);
  });
});

describe('🔴 NEGATIVE CONTROL: the non-controls in the picker still wear the divider token', () => {
  // ⚠️ The complement of CONTROLS. Without this, sweeping every `border-default` in the family to
  // `border-control` — the over-correction the sweep exists to refuse — passes silently. These are
  // region hairlines and two keycap HINTS; a reader does not operate any of them.
  const DIVIDERS: [FileKey, string][] = [
    ['picker', '.Root'], // the panel itself is a surface, not a control
    ['rail', '.Root'],
    ['footer', '.Root'],
    ['footer', '.Kbd'], // a keycap hint
    ['card', '.Enter'], // a keycap hint
    ['preview', '.Root'],
    ['preview', '.Head'],
    ['preview', '.Foot'],
    ['results', '.GroupRule'],
    ['library', '.Body']
  ];

  it.each(DIVIDERS)('%s %s', (file, selector) => {
    expect([`${file}${selector}`, own(block(file, selector)).includes('--theme-color-border-default')]).toEqual([
      `${file}${selector}`,
      true
    ]);
  });
});
