import * as fs from 'fs';
import * as path from 'path';

import { ThemeName, Rgb, contrastRatio, parseColor, resolveToken, themeTokens } from '../support/themeTokens';

/**
 * The property editor's **Style section** — the `VariantSelector` / `SizePicker` pair that
 * `propertyeditor.ts` mounts, the `SuggestionBanner` rendered beneath them, and the `TokenPicker`
 * that is the third and last `noodl-core-ui` entry on the phase-75 sweep's remaining list
 * (`BORDER-CONTROL-SWEEP.md`). Sibling of `folder-tree-control-borders.test.ts` (session 67),
 * whose helpers this copies and then extends in one load-bearing way — see FINDING 1.
 *
 * FIVE CONTROLS FIXED, and only TWO of them were on the list:
 *
 *   `.VariantSelector-trigger`   ON THE LIST. A `bg-3` dropdown trigger on the `bg-1` property
 *                                panel — 1.26:1 dark / 1.27:1 light.
 *   `.SizePicker-group`          NOT on any list. The segmented control rendered directly beside
 *                                the trigger by the same parent, same numbers — and invisible to
 *                                the inventory because the GROUP sets no `cursor` (its options do).
 *   `.DismissButton`             ON THE LIST. Paints no fill at all, so its edge was the only
 *                                thing marking it, at 1.07 / 1.15 on the banner's `bg-2` card.
 *   `.TokenPicker-trigger`       ON THE LIST, and see FINDING 3 — the component has no call site.
 *   `.TokenPicker-search`        NOT on any list. A native `<input>`, the `.TemplateFilter-search`
 *                                blind spot for the third time in this sweep.
 *
 * 🔴 FOUR FINDINGS THIS FAMILY ADDED:
 *
 * 1. A STATE CAN HIDE THE DIVIDER TONE INSIDE A `color-mix`, AND BOTH THE FIX AND THE INSTRUMENT
 *    MISS IT. `.TokenPicker-trigger--hasValue` was
 *    `color-mix(in srgb, var(--theme-color-primary) 40%, var(--theme-color-border-default))`.
 *    Raising the resting edge alone would have made SELECTING a token WEAKEN the boundary —
 *    4.17 -> 2.37 on `bg-1` in dark, 3.72 -> 2.08 in light — which is session 61's hover trap
 *    wearing a disguise the sweep's documented grep for it cannot see, because the divider is not
 *    the value of `border-color`, it is an argument to a function that is.
 *    ⚠️ AND THE READER HAD THE SAME HOLE: session 67's `tokenOf` takes the FIRST `var()` in a
 *    declaration, so it would have read this state as plain `primary` and scored 5.60 — a number
 *    that passes, for a colour the browser never paints. `paintOf`/`resolvePaint` below blend the
 *    mix instead. A gate shaped like the defect would have graded the fix as unnecessary.
 *
 * 2. THE GROUND IS IN ANOTHER PACKAGE. Every earlier family in this sweep read its ground out of a
 *    `.module.scss` beside the control. Here `VariantSelector`, `SizePicker` and their parent
 *    `ElementStyleSection` are all in `noodl-core-ui` and NONE of them paints a fill; what these
 *    controls are actually seen against is `.sidebar-panel` in the EDITOR's `assets/css/style.css`,
 *    reached through `propertyeditor.ts` mounting `ElementStyleSectionHost`. The ground is pinned
 *    by name across that package boundary, and the three unpainted links in the chain are asserted
 *    unpainted — otherwise the pin silently stops describing the real ground.
 *
 * 3. A CONTROL THAT IS NOT PLACED HAS NO GROUND, AND GUESSING ONE IS A MEASUREMENT OF NOTHING.
 *    `TokenPicker`'s only reference outside its own directory is a COMMENT in
 *    `TokenCategorySection.tsx` reserving it for future inline editing. There is no placement to
 *    read a ground out of, so its trigger is graded against EVERY panel step it could be placed on
 *    (`bg-1`, `bg-2`, `bg-3`) rather than against an invented one. The "it is not placed" premise
 *    is itself a row: place it and that row reddens, asking for a real ground instead of leaving
 *    a stale assumption behind.
 *
 * 4. WHAT THIS FAMILY REFUSES TO GRADE, AND SAYS SO. `.TokenPicker-swatch` draws
 *    `1px solid rgba(255,255,255,0.15)` over a colour the USER chose. There is no second operand,
 *    so any ratio would be invented. Asserted to name no theme token and left out of the contrast
 *    rows deliberately — `themeTokens`' own header says a caller that cannot name what is
 *    underneath must refuse rather than guess.
 *
 * 🔴 THIS SPEC READS THE STYLESHEETS, NOT THE PALETTE. Asserting a tone clears 3:1 would pass on a
 * build where this family never names it. Every row resolves the selector's own border, its own
 * fill and its ground out of the source, so a revert fails at a NUMBER.
 */

const CORE = path.resolve(__dirname, '../../../noodl-core-ui/src');
const EDITOR = path.resolve(__dirname, '../../src');

const FILES = {
  banner: `${CORE}/components/StyleSuggestions/SuggestionBanner.module.scss`,
  variant: `${CORE}/components/inputs/VariantSelector/VariantSelector.module.scss`,
  size: `${CORE}/components/propertyeditor/SizePicker/SizePicker.module.scss`,
  token: `${CORE}/components/inputs/TokenPicker/TokenPicker.module.scss`,
  section: `${CORE}/components/propertyeditor/ElementStyleSection/ElementStyleSection.module.scss`,
  panel: `${EDITOR}/assets/css/style.css`
} as const;

type FileKey = keyof typeof FILES;

/** ⚠️ Comments are stripped FIRST — this session's edit put `border-default`, `border-control`,
 *  `primary` and every ratio into comments directly above the rules they explain. Without this the
 *  parser reads the explanation of the fix instead of the fix. Both comment syntaxes: the `.scss`
 *  files use `//` as well as `/* *\/`. */
const source = (file: FileKey) =>
  fs
    .readFileSync(FILES[file], 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');

/** Every top-level rule in a file, as `{ selectors, body }`. A real scanner rather than a regex —
 *  see the code-editor spec's note on why an anchored `^\.X\s*\{` reads the wrong body. */
function topLevelRules(file: FileKey): { selectors: string[]; body: string }[] {
  const text = source(file);
  const out: { selectors: string[]; body: string }[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf('{', cursor);
    if (open === -1) break;
    let depth = 0;
    let close = -1;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) {
        close = i;
        break;
      }
    }
    if (close === -1) throw new Error(`unbalanced braces in ${file}`);
    const selectors = text
      .slice(cursor, open)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    out.push({ selectors, body: text.slice(open + 1, close) });
    cursor = close + 1;
  }
  return out;
}

/** Every top-level rule body that applies to `selector`, in document order. The LAST one wins. */
function rules(file: FileKey, selector: string): string[] {
  const found = topLevelRules(file)
    .filter((r) => r.selectors.includes(selector))
    .map((r) => r.body);
  if (!found.length) throw new Error(`no such rule in ${file}: ${selector}`);
  return found;
}

function rule(file: FileKey, selector: string): string {
  const found = rules(file, selector);
  if (found.length !== 1) throw new Error(`${file} ${selector} has ${found.length} rules — use rules()`);
  return found[0];
}

/**
 * A rule's OWN declarations, with every nested block removed.
 *
 * 🔴 LOAD-BEARING HERE, and measured rather than inherited — session 65's standing instruction.
 * Broken it kills: both triggers nest `&:hover { border-color: var(--theme-color-primary) }`, and
 * a reader without this resolves the RESTING edge of an un-hovered trigger to `primary`, which
 * clears 3:1 on every surface this family touches — so the revert mutant would PASS.
 */
function own(body: string): string {
  let out = '';
  let depth = 0;
  for (const ch of body) {
    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      continue;
    }
    if (depth === 0) out += ch;
  }
  return out;
}

/** Every nested `&<suffix> { ... }` block in a rule body. */
function nestedStates(body: string): { selector: string; body: string }[] {
  const found: { selector: string; body: string }[] = [];
  const pattern = /(?:^|\n)\s*&([^{,\n]*?)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    const start = body.indexOf('{', match.index);
    let depth = 0;
    for (let i = start; i < body.length; i++) {
      if (body[i] === '{') depth++;
      else if (body[i] === '}' && --depth === 0) {
        found.push({ selector: `&${match[1].trim()}`, body: body.slice(start + 1, i) });
        break;
      }
    }
  }
  return found;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FINDING 1 — a paint is not always a token, so the reader cannot return one.
   ───────────────────────────────────────────────────────────────────────────── */

type Paint =
  | { kind: 'token'; token: string }
  | { kind: 'mix'; a: string; pct: number; b: string };

/** The colour a declaration paints: a plain token, or an sRGB `color-mix` of two of them. */
function paintOf(body: string, property: string): Paint | null {
  const declarations = own(body);
  const at = declarations.search(new RegExp(`(?:^|[;{\\s])${property}:`, 'm'));
  if (at === -1) return null;
  const semicolon = declarations.indexOf(';', at);
  const value = declarations.slice(at, semicolon === -1 ? undefined : semicolon);

  const mix = value.match(
    /color-mix\(\s*in\s+srgb\s*,\s*var\(\s*(--[a-z0-9-]+)\s*\)\s*([0-9.]+)%\s*,\s*var\(\s*(--[a-z0-9-]+)\s*\)\s*\)/
  );
  if (mix) return { kind: 'mix', a: mix[1], pct: parseFloat(mix[2]) / 100, b: mix[3] };

  const token = value.match(/var\(\s*(--[a-z0-9-]+)\s*\)/);
  return token ? { kind: 'token', token: token[1] } : null;
}

function declares(body: string, property: string): boolean {
  return new RegExp(`(?:^|[;{\\s])${property}:`, 'm').test(own(body));
}

/** ⚠️ Both spellings — this family writes `background:` in three files and `background-color:` in
 *  the fourth. Reading only one makes a ground look unpainted. */
const fillOf = (body: string) => paintOf(body, 'background-color') ?? paintOf(body, 'background');
const paintsFill = (body: string) => declares(body, 'background-color') || declares(body, 'background');

const lastOf = <T,>(bodies: string[], read: (b: string) => T | null): T | null => {
  for (let i = bodies.length - 1; i >= 0; i--) {
    const value = read(bodies[i]);
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

/** A `Paint` as the browser renders it. `color-mix(in srgb, …)` of two opaque colours is a
 *  straight per-channel blend, which is why this can be answered without a renderer. */
function resolvePaint(theme: ThemeName, paint: Paint): Rgb {
  const tokens = themeTokens(theme);
  const colourOf = (name: string): Rgb => {
    const rgb = parseColor(resolveToken(tokens, name));
    if (!rgb) throw new Error(`${name} does not resolve to a measurable colour in ${theme}`);
    return rgb;
  };
  if (paint.kind === 'token') return colourOf(paint.token);

  const a = colourOf(paint.a);
  const b = colourOf(paint.b);
  return [0, 1, 2].map((i) => a[i] * paint.pct + b[i] * (1 - paint.pct)) as Rgb;
}

const ratio = (theme: ThemeName, a: Paint, b: Paint) => contrastRatio(resolvePaint(theme, a), resolvePaint(theme, b));
const asToken = (token: string): Paint => ({ kind: 'token', token });
const describe_ = (paint: Paint) =>
  paint.kind === 'token' ? paint.token : `color-mix(${paint.a} ${paint.pct * 100}%, ${paint.b})`;

/** Every state of a control, from BOTH places a state can be written. */
function statesOf(file: FileKey, selectors: string[]): { selector: string; bodies: string[] }[] {
  const order: string[] = [];
  const bySuffix = new Map<string, string[]>();
  const add = (suffix: string, body: string) => {
    if (!bySuffix.has(suffix)) {
      bySuffix.set(suffix, []);
      order.push(suffix);
    }
    bySuffix.get(suffix)!.push(body);
  };

  for (const selector of selectors) {
    for (const body of rules(file, selector)) {
      for (const state of nestedStates(body)) add(state.selector.slice(1), state.body);
    }
    for (const r of topLevelRules(file)) {
      for (const s of r.selectors) {
        if (!s.startsWith(selector) || s === selector) continue;
        const rest = s.slice(selector.length);
        // ⚠️ THE SUFFIX GUARD IS REACHED HERE AND STILL KILLS NOTHING — and that is a THIRD
        // outcome, distinct from both earlier ones. Session 66's `.Option`/`.Options` was live.
        // Session 67 predicted it live and found it unreachable: the queried selector was the
        // LONGER of the pair, so no candidate ever arrived. Here candidates DO arrive in the
        // hazardous direction — `.TokenPicker-trigger` is a strict prefix of the real rule
        // `.TokenPicker-triggerText`, and `.TokenPicker-search` of `.TokenPicker-searchRow` — so
        // the guard is genuinely exercised. It still changes no row, because the state loop below
        // only grades a candidate that declares a `border-color` or a fill, and neither helper
        // declares either. Remove this line and the suite stays green.
        //
        // ✅ Kept, and recorded as REACHED-BUT-INERT rather than reported as this file's strength.
        // "Reached" and "load-bearing" are two different questions and only a mutant separates
        // them — the next `.TokenPicker-triggerBar` that paints a fill makes this line the only
        // thing standing between the trigger and a state it does not have.
        if (!/^[:.[]/.test(rest)) continue;
        add(rest, r.body);
      }
    }
  }
  return order.map((selector) => ({ selector, bodies: bySuffix.get(selector)! }));
}

/**
 * A surface a control is seen against.
 *
 * `selector` is absent only for FINDING 3's unplaced component, where there is no placement to
 * read one out of and the honest answer is "every step it could land on".
 */
type Ground = { file?: FileKey; selector?: string; token: string; what: string };

/**
 * FINDING 2 — the ground, across a package boundary. `propertyeditor.ts` mounts
 * `ElementStyleSectionHost` into `.sidebar-property-editor` inside `.sidebar-panel`, and that rule
 * — in the EDITOR's global stylesheet, not in `noodl-core-ui` — is the only thing in the whole
 * chain that paints. PAR-002's comment on it says so: "panels sit on bg-1; inputs/cards read bg-2
 * on top."
 */
const PANEL: Ground = {
  file: 'panel',
  selector: '.sidebar-panel',
  token: '--theme-color-bg-1',
  what: 'the property editor panel (bg-1)'
};

/** The banner's own card, painted by the component that renders the button. */
const BANNER: Ground = {
  file: 'banner',
  selector: '.Banner',
  token: '--theme-color-bg-2',
  what: "the suggestion banner's card (bg-2)"
};

/** The token picker's dropdown, which is the search field's ground. */
const DROPDOWN: Ground = {
  file: 'token',
  selector: '.TokenPicker-dropdown',
  token: '--theme-color-bg-2',
  what: "the token picker's dropdown (bg-2)"
};

/** FINDING 3 — no placement, so no ground; every step it could be placed on instead. */
const ANY_PANEL_STEP: Ground[] = [
  { token: '--theme-color-bg-1', what: 'a bg-1 panel, wherever it is eventually placed' },
  { token: '--theme-color-bg-2', what: 'a bg-2 card, wherever it is eventually placed' },
  { token: '--theme-color-bg-3', what: 'a bg-3 surface, wherever it is eventually placed' }
];

const CONTROLS: { name: string; file: FileKey; selectors: string[]; grounds: Ground[] }[] = [
  {
    name: '.VariantSelector-trigger — ON the list, and its ground is in another package',
    file: 'variant',
    selectors: ['.VariantSelector-trigger'],
    grounds: [PANEL]
  },
  {
    name: '.SizePicker-group — the segmented control beside it, on NO list because the group sets no cursor',
    file: 'size',
    selectors: ['.SizePicker-group'],
    grounds: [PANEL]
  },
  {
    name: '.DismissButton — paints no fill, so the edge was the only thing marking it',
    file: 'banner',
    selectors: ['.DismissButton'],
    grounds: [BANNER]
  },
  {
    name: '.TokenPicker-trigger — ON the list, but the component is never placed (FINDING 3)',
    file: 'token',
    selectors: ['.TokenPicker-trigger'],
    grounds: ANY_PANEL_STEP
  },
  {
    name: '.TokenPicker-search — a native <input>, the third time this sweep meets that blind spot',
    file: 'token',
    selectors: ['.TokenPicker-search'],
    grounds: [DROPDOWN]
  }
];

describe.each(['dark', 'light'] as ThemeName[])('the property editor style section in %s', (theme) => {
  describe.each(CONTROLS)('$name', ({ file, selectors, grounds }) => {
    const bodies = () => selectors.flatMap((s) => rules(file, s));

    /** ✅ THE GROUND IS PINNED BY NAME wherever there is a rule to pin it to — session 64's
     *  finding. It earns its place twice here: the panel ground lives in a different PACKAGE from
     *  the control, and `bg-1`/`bg-2` differ by one ramp step (1.17:1), so a row that read the
     *  wrong one would still pass on `border-control`. */
    const groundPaint = (ground: Ground): Paint => {
      if (ground.file && ground.selector) {
        const painted = lastOf(rules(ground.file, ground.selector), fillOf);
        const seen = painted && painted.kind === 'token' ? painted.token : String(painted);
        expect(`${ground.selector} paints ${seen}`).toBe(`${ground.selector} paints ${ground.token}`);
      }
      return asToken(ground.token);
    };

    const border = (): Paint => {
      const paint = lastOf(bodies(), (b) => paintOf(b, 'border-color') ?? paintOf(b, 'border'));
      if (!paint) throw new Error(`${file} ${selectors.join('')}: no border naming a colour`);
      return paint;
    };

    /** A control that paints no fill is seen against its ground on BOTH sides of the edge. */
    const fill = (ground: Ground): Paint => lastOf(bodies(), fillOf) ?? groundPaint(ground);

    /**
     * Session 67's criterion, unchanged: a control is identified by its OUTERMOST tone against the
     * ground, and the second question — is the ring visible against the fill it encloses — is
     * asked only when the fill does not already clear 3:1 on the ground and so is not carrying the
     * object on its own.
     *
     * ⚠️ It stays strict for every control in this family: each `bg-N` fill is a 1.10-1.36 step on
     * its ground, so every ring here is load-bearing and BOTH ratios are graded. It relaxes only
     * for `.AcceptButton`, which is graded separately below.
     */
    const identifies = (edge: Paint, ownFill: Paint, ground: Ground): string[] => {
      const groundTone = groundPaint(ground);
      const failures: string[] = [];

      const onGround = ratio(theme, edge, groundTone);
      if (onGround < 3) {
        failures.push(
          `${selectors.join('')} is ${onGround.toFixed(2)}:1 against ${ground.what} in ${theme} — under ` +
            `1.4.11's 3:1, so nothing marks where the control is (boundary ${describe_(edge)})`
        );
      }

      const fillStep = ratio(theme, ownFill, groundTone);
      if (fillStep >= 3) return failures; // the fill carries the object; the ring is decoration.

      if (describe_(edge) === describe_(ownFill)) {
        failures.push(
          `${selectors.join('')} paints its edge the same tone as its fill, and that fill is only ` +
            `${fillStep.toFixed(2)}:1 on ${ground.what} in ${theme} — nothing identifies it`
        );
        return failures;
      }

      const onFill = ratio(theme, edge, ownFill);
      if (onFill < 3) {
        failures.push(
          `${selectors.join('')}'s border is ${onFill.toFixed(2)}:1 on its own fill in ${theme}, and the ` +
            `fill is only ${fillStep.toFixed(2)}:1 on ${ground.what} — the ring is the only affordance ` +
            `and it cannot be seen`
        );
      }
      return failures;
    };

    it('🔴 its resting boundary identifies the control on EVERY surface it is placed on', () => {
      const failures = grounds.flatMap((ground) => identifies(border(), fill(ground), ground));
      expect([...new Set(failures)]).toEqual([]);
    });

    it('🔴 no state of it drops the boundary below 3:1', () => {
      // FINDING 1's row. `--hasValue` is the state that matters: it is the only boundary in this
      // sweep so far that is a FUNCTION of two tokens rather than one, and re-anchoring it was
      // forced by raising the resting edge above it.
      const restBorder = border();
      const failures: string[] = [];

      for (const ground of grounds) {
        for (const state of statesOf(file, selectors)) {
          if (!state.bodies.some((b) => declares(b, 'border-color') || paintsFill(b))) continue;
          const stateBorder = lastOf(state.bodies, (b) => paintOf(b, 'border-color')) ?? restBorder;
          const stateFill = lastOf(state.bodies, fillOf) ?? fill(ground);
          for (const failure of identifies(stateBorder, stateFill, ground)) {
            failures.push(`${state.selector}: ${failure}`);
          }
        }
      }

      expect([...new Set(failures)]).toEqual([]);
    });
  });

  it('🔴 FINDING 1 — the has-value state is read as the MIX, not as the first token in it', () => {
    // The row that grades the reader as well as the stylesheet. `tokenOf`, the helper every earlier
    // file in this sweep uses, takes the first `var()` in a declaration — on this rule that is
    // `--theme-color-primary`, so it would score 5.60:1 for a colour the browser never paints and
    // report the fix as unnecessary. This row pins BOTH the parse and the blended number.
    const hasValue = nestedStates(rule('token', '.TokenPicker-trigger')).find((s) =>
      s.selector.includes('--hasValue')
    );
    expect(hasValue).toBeDefined();

    const paint = paintOf(hasValue!.body, 'border-color');
    expect(paint && paint.kind).toBe('mix');
    expect(describe_(paint!)).toBe('color-mix(--theme-color-primary 40%, --theme-color-border-control)');

    // The blend, not either end of it: strictly between primary and the resting control tone.
    const onPanel = ratio(theme, paint!, asToken('--theme-color-bg-1'));
    const primaryAlone = ratio(theme, asToken('--theme-color-primary'), asToken('--theme-color-bg-1'));
    const restingAlone = ratio(theme, asToken('--theme-color-border-control'), asToken('--theme-color-bg-1'));
    expect(onPanel).toBeLessThan(primaryAlone);
    expect(onPanel).toBeGreaterThan(restingAlone);

    expect(`has-value boundary ${onPanel.toFixed(2)}:1`).toBe(
      `has-value boundary ${(theme === 'dark' ? 4.63 : 4.22).toFixed(2)}:1`
    );
  });

  it('🔴 FINDING 2 — the ground is in another package, and the chain to it paints nothing', () => {
    // The pin is only worth having while the three links between the control and `.sidebar-panel`
    // stay transparent. The moment any of them paints a fill, THAT becomes the ground and every
    // ratio above is measured against the wrong surface — which is the shape of defect session 67
    // caught with a modal.
    for (const [file, selector] of [
      ['section', '.ElementStyleSection'],
      ['section', '.ElementStyleSection-body'],
      ['variant', '.VariantSelector'],
      ['size', '.SizePicker']
    ] as [FileKey, string][]) {
      expect(`${selector} fill: ${JSON.stringify(fillOf(rule(file, selector)))}`).toBe(`${selector} fill: null`);
    }

    const panel = lastOf(rules('panel', '.sidebar-panel'), fillOf);
    expect(panel && panel.kind === 'token' ? panel.token : null).toBe('--theme-color-bg-1');
  });

  it('🔴 the borderless controls are carried by something, and that something is READ, not named', () => {
    // The sweep's exclusion RULE applied rather than its exclusion list extended. Seven controls in
    // this family draw no boundary at all, which under the inventory's membership test reads as the
    // worst defect here. None of them is one — each is carried by a fill or a label, and a label is
    // a number. Writing "deliberately left alone" would be a claim no row could ever fail.
    //
    // 🔴 AND THE PAIR IS RESOLVED OUT OF THE STYLESHEET, NOT WRITTEN DOWN HERE. A first draft of
    // this row listed the token names as literals and measured those — which is exactly the hole
    // this file's own header warns about, one rule up: a palette assertion passes on a build where
    // these rules no longer name those tones. Every row below reads BOTH ends of its pair from
    // disk, so changing a label's colour reddens it.
    const colourIn = (file: FileKey, selector: string, body?: string) => {
      const paint = paintOf(body ?? rule(file, selector), 'color');
      if (!paint) throw new Error(`${selector} names no colour`);
      return paint;
    };
    const fillIn = (file: FileKey, selector: string, body?: string) => {
      const paint = fillOf(body ?? rule(file, selector));
      if (!paint) throw new Error(`${selector} paints no fill`);
      return paint;
    };

    const sizeActive = nestedStates(rule('size', '.SizePicker-option')).find((s) =>
      s.selector.includes('--active')
    )!;

    const carried: { what: string; fg: Paint; bg: Paint; floor: number }[] = [
      // The one place `identifies()` would relax: a `primary` fill identifies the object many times
      // over, so this button's missing ring is correct rather than overlooked.
      { what: '.AcceptButton fill on the banner', fg: fillIn('banner', '.AcceptButton'), bg: groundOf_('banner', '.Banner'), floor: 3 },
      { what: '.AcceptButton label', fg: colourIn('banner', '.AcceptButton'), bg: fillIn('banner', '.AcceptButton'), floor: 4.5 },
      { what: '.CloseButton glyph', fg: colourIn('banner', '.CloseButton'), bg: groundOf_('banner', '.Banner'), floor: 4.5 },
      { what: '.SizePicker-option label', fg: colourIn('size', '.SizePicker-option'), bg: fillIn('size', '.SizePicker-group'), floor: 4.5 },
      { what: '.SizePicker-option active label', fg: colourIn('size', '', sizeActive.body), bg: fillIn('size', '', sizeActive.body), floor: 4.5 },
      { what: '.TokenPicker-clearBtn glyph', fg: colourIn('token', '.TokenPicker-clearBtn'), bg: fillIn('token', '.TokenPicker-trigger'), floor: 4.5 },
      { what: '.TokenPicker-option label', fg: colourIn('token', '.TokenPicker-option'), bg: fillIn('token', '.TokenPicker-dropdown'), floor: 4.5 },
      { what: '.VariantSelector-option label', fg: colourIn('variant', '.VariantSelector-option'), bg: fillIn('variant', '.VariantSelector-dropdown'), floor: 4.5 }
    ];

    const failures = carried
      .map(({ what, fg, bg, floor }) => {
        const measured = ratio(theme, fg, bg);
        return measured >= floor
          ? null
          : `${what} is ${measured.toFixed(2)}:1 in ${theme} (${describe_(fg)} on ${describe_(bg)}), under ${floor}`;
      })
      .filter(Boolean);
    expect(failures).toEqual([]);

    // ...and each of them really does draw no ring, which is the premise of grading them this way.
    for (const [file, selector] of [
      ['banner', '.AcceptButton'],
      ['banner', '.CloseButton'],
      ['size', '.SizePicker-option'],
      ['token', '.TokenPicker-clearBtn'],
      ['token', '.TokenPicker-option'],
      ['variant', '.VariantSelector-option']
    ] as [FileKey, string][]) {
      expect(`${selector} border: ${JSON.stringify(paintOf(rule(file, selector), 'border'))}`).toBe(
        `${selector} border: null`
      );
    }
  });

  it('⚠️ the close button’s hover FILL is inert, and the feedback that does exist is graded', () => {
    // Found while reading, recorded as a number rather than as prose. `.CloseButton:hover` paints
    // `bg-2` — and the banner it sits on is already `bg-2`, so the hover background is 1.00:1
    // against its own ground and draws literally nothing. It is NOT a 1.4.11 failure (hover
    // feedback carries no contrast requirement) and it is NOT this sweep's to fix, so it is pinned
    // rather than changed: what actually gives feedback is the glyph moving shy -> default, and
    // that is asserted so the button is not left with no hover affordance at all.
    const hover = nestedStates(rule('banner', '.CloseButton')).find((s) => s.selector.includes(':hover'))!;
    const hoverFill = fillOf(hover.body)!;
    const inert = ratio(theme, hoverFill, asToken('--theme-color-bg-2'));
    expect(`close-button hover fill ${inert.toFixed(2)}:1 on the banner`).toBe(
      'close-button hover fill 1.00:1 on the banner'
    );

    const resting = paintOf(rule('banner', '.CloseButton'), 'color')!;
    const hovered = paintOf(hover.body, 'color')!;
    expect(describe_(hovered)).not.toBe(describe_(resting));
    const legible = ratio(theme, hovered, asToken('--theme-color-bg-2'));
    expect(legible >= 4.5 ? 'legible' : `the hovered glyph is ${legible.toFixed(2)}:1`).toBe('legible');
  });

  it('🔴 FINDING 4 — the swatch borders are REFUSED, not graded', () => {
    // `themeTokens`' header: a caller that cannot name what is underneath must refuse rather than
    // guess. Both swatches draw a translucent white hairline over a colour the USER picked; there
    // is no second operand, so any ratio would be invented. This row states that they name no theme
    // token — so if one is ever changed to a token, it stops being exempt and has to be measured.
    for (const selector of ['.TokenPicker-swatch', '.TokenPicker-optionSwatch']) {
      const body = rule('token', selector);
      expect(`${selector}: ${JSON.stringify(paintOf(body, 'border'))}`).toBe(`${selector}: null`);
      expect(/border:\s*1px solid rgba\(255, 255, 255/.test(own(body))).toBe(true);
    }
  });

  it('🔴 the divider tone is still INVISIBLE on the surfaces this family uses', () => {
    // The negative control, and the row that refuses the over-fix: a sweep that raised the shared
    // token instead of the call sites would pass every row above and redden this one.
    //
    // ⚠️ THE BOUND IS A PROPERTY OF THE GROUND — sessions 61, 62, 64, 65, 66 and 67 each filed
    // this. THREE bounds again, for three steps: the panel (bg-1, where colors.css documents the
    // divider at 1.254 BY DESIGN, so 1.4), the banner and dropdown (bg-2, 1.2) and the triggers'
    // own fill (bg-3, 1.2). Copying any single earlier file's bound reads a correct value as a
    // defect.
    const surfaces: { token: string; bound: number; what: string }[] = [
      { token: groundOf('panel', '.sidebar-panel'), bound: 1.4, what: 'the property editor panel (bg-1)' },
      { token: groundOf('banner', '.Banner'), bound: 1.2, what: 'the banner card (bg-2)' },
      { token: groundOf('token', '.TokenPicker-dropdown'), bound: 1.2, what: 'the dropdown (bg-2)' },
      { token: groundOf('variant', '.VariantSelector-trigger'), bound: 1.2, what: "the trigger's own fill (bg-3)" }
    ];

    const failures = surfaces
      .map(({ token, bound, what }) => {
        const measured = ratio(theme, asToken('--theme-color-border-default'), asToken(token));
        return measured < bound ? null : `border-default is ${measured.toFixed(2)}:1 on ${what} in ${theme}, over ${bound}`;
      })
      .filter(Boolean);

    expect(failures).toEqual([]);
  });

  it('🔴 the REGION edges were deliberately left alone', () => {
    // The over-fix mutant's target: a blanket find-and-replace over these four stylesheets would
    // raise these too, and every one is a boundary between REGIONS rather than something a reader
    // must identify as operable. The two dropdowns are containers told apart from what is behind
    // them by a popup shadow; the others are hairlines between rows of a panel.
    const regions: [FileKey, string][] = [
      ['banner', '.Banner'],
      ['variant', '.VariantSelector-dropdown'],
      ['token', '.TokenPicker-dropdown'],
      ['token', '.TokenPicker-searchRow'],
      ['section', '.ElementStyleSection']
    ];

    for (const [file, selector] of regions) {
      const body = rule(file, selector);
      const edge =
        paintOf(body, 'border') ?? paintOf(body, 'border-bottom') ?? paintOf(body, 'border-color');
      expect(`${selector}: ${edge && edge.kind === 'token' ? edge.token : String(edge)}`).toBe(
        `${selector}: --theme-color-border-default`
      );
    }

    // ⚠️ And the dropdowns' separation is asserted where it actually comes from, so the reason
    // above is graded rather than merely stated.
    expect(declares(rule('variant', '.VariantSelector-dropdown'), 'box-shadow')).toBe(true);
    expect(declares(rule('token', '.TokenPicker-dropdown'), 'box-shadow')).toBe(true);

    // The banner's accent edge is a second declaration on the same rule and is NOT a control
    // boundary — it is the card's category stripe. Pinned so the over-fix cannot quietly eat it.
    expect(paintOf(rule('banner', '.Banner'), 'border-left')).toEqual({
      kind: 'token',
      token: '--theme-color-primary'
    });
  });
});

/** The fill token of a ground rule, pinned by name at its point of use. */
function groundOf(file: FileKey, selector: string): string {
  const paint = lastOf(rules(file, selector), fillOf);
  if (!paint || paint.kind !== 'token') throw new Error(`${file} ${selector} paints no single-token fill`);
  return paint.token;
}

/**
 * FINDING 3, hoisted OUT of the theme loop: it does not depend on the theme, and walking every
 * source file in two packages twice to answer the same question is waste, not rigour.
 */
it('🔴 FINDING 3 — the token picker is still not placed, which is why it has no ground', () => {
  // The premise of ANY_PANEL_STEP, written as a row so it cannot go stale silently. If somebody
  // places `TokenPicker`, this reddens and asks for the real ground to be read out of the
  // placement — rather than leaving a guess behind that nobody re-derives.
  //
  // ⚠️ A COMMENT IS NOT A PLACEMENT. `TokenCategorySection.tsx` names it in prose, reserving it
  // for inline editing, so the search strips comments before deciding.
  const roots = [path.join(CORE, 'components'), path.join(EDITOR, 'editor/src')];
  const own_ = path.join(CORE, 'components/inputs/TokenPicker');

  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !full.startsWith(own_)) {
        const text = fs
          .readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|\s)\/\/[^\n]*/g, '$1');
        if (/\bTokenPicker\b/.test(text)) hits.push(path.relative(CORE, full));
      }
    }
  };
  for (const root of roots) walk(root);

  expect(hits).toEqual([]);
});

/** A ground rule's fill as a `Paint`, for rows that measure against it rather than name it. */
function groundOf_(file: FileKey, selector: string): Paint {
  const paint = lastOf(rules(file, selector), fillOf);
  if (!paint) throw new Error(`${file} ${selector} paints no fill`);
  return paint;
}
