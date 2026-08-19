/**
 * NAT-001 — the contrast floor the editor never had.
 *
 * ## What this is for, and why it is not a duplicate of the platform's gate
 *
 * `nodegx-community` has had a palette gate since UNI-013 (`tests/uni013-contrast.test.ts`,
 * ~30 named pairs at 4.5:1 in both themes). The editor has never had one. It has the *parts* —
 * `tests-unit/support/themeTokens.ts` resolves tokens out of `colors.css` and computes WCAG
 * ratios — but only three narrow specs use them, each about one component
 * (`vfn-013/badge-contrast`, `fix-005/dropdown-contrast`, `vfn-006/save-outline-contrast`).
 * Nothing asserted a floor across the design system, which is exactly how
 * `--theme-color-fg-muted` came to sit at 3.93:1 while being the default secondary text colour
 * of the launcher's Community tab.
 *
 * 🔴 **This is a second pipeline for a check that already exists, and that is deliberate — say
 * what each one reads or the next reader deletes one as a duplicate.** The platform's gate reads
 * the **vendored copy** of `colors.css`; this one reads the **canonical source**. They agree
 * until somebody hand-edits the vendored copy or changes the canonical file without re-running
 * `npm run tokens:sync` — which is the drift UNI-013's `tests/uni013-token-drift.test.ts` exists
 * to catch, and is precisely the split that reads as "done" from either side alone. The two
 * gates plus the drift test are three claims about three different files.
 *
 * ## What it cannot see — stated because an unstated limit reads as coverage
 *
 * It grades **the pairs listed in PAIRS**. It is not a crawl. A component that invents a colour
 * combination is invisible to it, and a rule that measures 8:1 here and is covered by another
 * element still fails a human. `scripts/devtools/icon-contrast.js` samples rendered pixels in a
 * running editor and remains the authority on anything decided at paint time. A green run here
 * does not close a drive-shaped question.
 *
 * ## Registration
 *
 * None needed. `jest.config.js` matches `tests-unit/ ** /?(*.)+(spec|test).ts` by path, so this
 * file runs under `npm run test:main` the moment it exists — unlike the jasmine suite, which
 * needs a barrel export.
 *
 * @module noodl-editor/tests-unit/nat-001/palette-contrast
 */
import {
  ThemeName,
  composite,
  contrastRatio,
  parseColorAlpha,
  resolveToken,
  themeTokens,
  toHex,
  Rgb
} from '../support/themeTokens';

/**
 * One graded pairing.
 *
 * 🔴 `min` is stated per row and **never defaulted**, and `why` is what makes the number a claim
 * rather than a habit. The platform's gate learned this when three rows that looked like chrome
 * turned out to be words — a duration ("19h") and an accepted-answer label — and had been graded
 * at 3:1 because a glance said "badge".
 *
 * `over` names the **opaque surface underneath a translucent background**. A wash is not a
 * colour: `--theme-color-primary-bg` is the accent at 13% alpha, and what a reader sees is that
 * wash composited over whatever it happens to sit on — a fact about the layout that no colour
 * token carries. A row whose background is translucent and names no `over` fails loudly rather
 * than being skipped; see the control at the bottom of this file.
 */
type Pair = {
  what: string;
  fg: string;
  bg: string;
  /** 4.5 = words at a normal size (WCAG 1.4.3). 3 = non-text (1.4.11) or a stated local floor. */
  min: number;
  over?: string;
  why: string;
};

/**
 * The pairs the editor's community surfaces actually render, plus the design system's own
 * text defaults.
 *
 * ⚠️ The trigger for a new row is a new **PAIRING**, not a new colour role. A familiar
 * foreground on a ground nobody listed is an ungraded pairing however familiar both halves look.
 */
const PAIRS: Pair[] = [
  // ── The launcher's Community tab ────────────────────────────────────────────────────────
  // `views/Community.tsx`. Its ground is `bg-0`: `Launcher.module.scss` paints `.ContentArea`
  // with it and `LauncherPage` adds padding and no background of its own.
  //
  // 🔴 THE FIRST ROW IS THE WHOLE REASON THIS FILE EXISTS. `const shy = { color:
  // 'var(--theme-color-fg-muted)', fontSize: 13 }` is one object used for the viewer line, all
  // four empty states, every health readout and the error text — nearly every word on the page.
  {
    what: 'the launcher tab: viewer line, four empty states, health readouts and error text',
    fg: '--theme-color-fg-muted',
    bg: '--theme-color-bg-0',
    min: 4.5,
    why: '13px body copy — no large-text relief, which does not begin until 24px (or 18.66px bold)'
  },
  {
    what: 'the launcher tab: the Refresh button label',
    fg: '--theme-color-fg-muted',
    bg: '--theme-color-bg-0',
    min: 4.5,
    why: '13px words in a ghost button; a separate inline style from `shy`, so it can move alone'
  },
  {
    what: 'the launcher tab: a section heading',
    fg: '--theme-color-fg-highlight',
    bg: '--theme-color-bg-0',
    min: 4.5,
    why: '13px semibold — under the 18.66px bold threshold, so the normal-size bar applies'
  },
  {
    what: 'the launcher tab: a discussion, guide or replay title in a row',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-0',
    min: 4.5,
    why: '13px words, and the only content on the surface'
  },
  {
    what: 'the launcher tab: the “Try again” link on an unreachable section',
    fg: '--theme-color-primary',
    bg: '--theme-color-bg-0',
    min: 4.5,
    why: 'words, and the only way out of the error state'
  },
  {
    what: 'the launcher tab: the “Open community.nodegx.io” label',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-0',
    min: 4.5,
    why: '13px words in a bordered button'
  },
  {
    what: 'the launcher tab: the border that IS the “Open community.nodegx.io” button',
    fg: '--theme-color-bg-3',
    bg: '--theme-color-bg-0',
    min: 3,
    why: 'NON-TEXT (1.4.11): the button has no fill, so this 1px edge is the only thing that says a control is there'
  },

  // ── The rail panel ──────────────────────────────────────────────────────────────────────
  // `views/panels/CommunityPanel`. `BasePanel` paints `bg-2` and sets `color: fg-default`;
  // `Section` gutters keep that ground; `ListItem` rows sit a step up on `bg-3`.
  {
    what: 'the rail panel: Shy copy — loading, the four empty lines, the health readout, the sign-in pointer',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-2',
    min: 4.5,
    why: '12px words. POL-017 already moved `Text`’s Shy off `fg-muted` for exactly this reason'
  },
  {
    what: 'the rail panel: the viewer line, which is Secondary rather than Shy',
    fg: '--theme-color-secondary-as-fg',
    bg: '--theme-color-bg-2',
    min: 4.5,
    why: '12px words; a different token from the launcher’s equivalent line, so a separate claim'
  },
  {
    what: 'the rail panel: a thread, guide or replay title in a list row',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-3',
    min: 4.5,
    why: 'words on the row’s own ground, which is a step above the panel’s'
  },
  {
    what: 'the rail panel: a list row under the pointer',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-4',
    min: 4.5,
    why: 'hover lifts the row to a new ground, and a hover surface nobody listed is one nobody graded'
  },
  {
    what: 'the rail panel: a list row’s leading icon',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-3',
    min: 3,
    why: 'NON-TEXT (1.4.11): the message/book/play glyph carries meaning but is a shape, not a word'
  },
  {
    what: 'the rail panel: a selected list row’s label on the accent wash',
    fg: '--theme-color-primary',
    bg: '--theme-color-primary-bg',
    over: '--theme-color-bg-3',
    min: 4.5,
    why: 'words; the wash is 13% alpha so it is graded composited over the row ground beneath it'
  },

  // ── The “Ask about this node” composer ──────────────────────────────────────────────────
  // `AskAboutNodeDialog`. Its `.Root` paints `bg-4` (its own note explains why it repaints at
  // all); the payload preview and the per-port consent list sit on `bg-2` inside it.
  {
    what: 'the composer: its title',
    fg: '--theme-color-fg-default-contrast',
    bg: '--theme-color-bg-4',
    min: 4.5,
    why: 'the line that says what the dialog is about to do, at 12px — under every large-text threshold'
  },
  {
    what: 'the composer: Shy copy — the explainer, the capture hint, the consent lead-in, the failure message',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-4',
    min: 4.5,
    why: '12px words, and the consent copy is the text a person is being asked to act on'
  },
  {
    what: 'the composer: Default copy beside a port toggle',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-4',
    min: 4.5,
    why: 'the port name a person is deciding whether to publish — words, on the dialog’s own ground'
  },
  {
    what: 'the composer: the payload preview, which is what will be posted',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-2',
    min: 4.5,
    why: '11px monospace — the smallest text on the surface, and the text consent is given about'
  },
  {
    what: 'the composer: a port’s value in the consent list',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-2',
    min: 4.5,
    why: '11px monospace words'
  },
  {
    what: 'the composer: the sign-in error',
    fg: '--theme-color-danger',
    bg: '--theme-color-bg-4',
    min: 4.5,
    why: 'words, and the only explanation of why the post did not happen'
  },

  // ── The design system’s own text defaults ───────────────────────────────────────────────
  // Every editor panel is one of these grounds. The rows are the tokens `Text` exposes.
  { what: 'body copy on a panel', fg: '--theme-color-fg-default', bg: '--theme-color-bg-1', min: 4.5, why: '`TextType.Default` at 12px — the editor’s most common pairing, on the most common panel ground' },
  { what: 'body copy a step up', fg: '--theme-color-fg-default', bg: '--theme-color-bg-2', min: 4.5, why: 'the same 12px words on the ground every `BasePanel` paints' },
  { what: 'a heading on a panel', fg: '--theme-color-fg-highlight', bg: '--theme-color-bg-1', min: 4.5, why: '`TextType.Proud` — a heading is words, and panel headings here sit well under the 18.66px bold relief' },
  { what: 'Shy copy on the page ground', fg: '--theme-color-fg-default-shy', bg: '--theme-color-bg-0', min: 4.5, why: 'the token POL-017 moved Shy onto, graded on every ground it can land on rather than the one it was measured against' },
  { what: 'Shy copy on a panel', fg: '--theme-color-fg-default-shy', bg: '--theme-color-bg-1', min: 4.5, why: '12px secondary words — the role `fg-muted` used to carry here' },
  { what: 'Shy copy a step up', fg: '--theme-color-fg-default-shy', bg: '--theme-color-bg-3', min: 4.5, why: 'the highest ground Shy text is painted on, and therefore its worst case' },

  // 🔴 THE THREE ROWS THE PALETTE ACTUALLY FAILS ON, listed at every elevation because the token
  // gets worse as the ground gets lighter and "it fails on bg-1" understates it.
  { what: 'muted copy on a panel', fg: '--theme-color-fg-muted', bg: '--theme-color-bg-1', min: 4.5, why: '`colors.css` documents this token as secondary text, and secondary text is words' },
  { what: 'muted copy a step up', fg: '--theme-color-fg-muted', bg: '--theme-color-bg-2', min: 4.5, why: 'same token, worse ground' },
  { what: 'muted copy two steps up', fg: '--theme-color-fg-muted', bg: '--theme-color-bg-3', min: 4.5, why: 'same token, worse ground again' },

  // ⚠️ NOT AA. 1.4.3 exempts inactive controls outright, so a 4.5 here would be a gate rejecting
  // a correct answer. 3 is a LOCAL floor, stated as a choice: disabled text still has to be
  // findable enough to read what the control you cannot use says. NAT-002 AC3 owns the separate
  // question of whether this token should go on aliasing `fg-muted` at all.
  { what: 'disabled text on a panel', fg: '--theme-color-fg-disabled', bg: '--theme-color-bg-1', min: 3, why: 'NOT AA — 1.4.3 exempts inactive controls; 3 is this repo’s own floor for “still readable”' },
  { what: 'disabled text two steps up', fg: '--theme-color-fg-disabled', bg: '--theme-color-bg-3', min: 3, why: 'NOT AA — as above' },

  { what: 'a link on a panel', fg: '--theme-color-primary', bg: '--theme-color-bg-1', min: 4.5, why: '`Text` paints anchors with the accent, and links are words' },
  { what: 'a link a step up', fg: '--theme-color-primary', bg: '--theme-color-bg-2', min: 4.5, why: 'same accent, lighter ground' },
  { what: 'a link two steps up', fg: '--theme-color-primary', bg: '--theme-color-bg-3', min: 4.5, why: 'same accent, lighter ground again' },
  { what: 'a primary button’s label', fg: '--theme-color-on-primary', bg: '--theme-color-primary', min: 4.5, why: 'words; ground-independent, so correct on any surface' },

  { what: 'a success message a step up', fg: '--theme-color-success', bg: '--theme-color-bg-2', min: 4.5, why: '`TextType.Success` is words' },
  { what: 'a notice message a step up', fg: '--theme-color-notice', bg: '--theme-color-bg-2', min: 4.5, why: '`TextType.Notice` is words' },
  { what: 'a danger message a step up', fg: '--theme-color-danger', bg: '--theme-color-bg-2', min: 4.5, why: '`TextType.Danger` is words' }
];

// ── The instrument ────────────────────────────────────────────────────────────────────────

/** The opaque colour a token actually paints, given the surface underneath it. */
function ground(theme: ThemeName, token: string, over: string | undefined): Rgb {
  const tokens = themeTokens(theme);

  const value = resolveToken(tokens, token);
  if (value === undefined) throw new Error(`no such token: ${token}`);

  const colour = parseColorAlpha(value);
  // A typo'd token resolves to the literal string `var(--typo)` — `resolveToken` returns the
  // literal rather than throwing — so this is the second half of the same guard, not a duplicate.
  if (!colour) throw new Error(`${token} does not resolve to a measurable colour in ${theme}: ${value}`);

  if (colour[3] === 1) return [colour[0], colour[1], colour[2]];
  if (over === undefined) throw new Error(`${token} is translucent (${value}) — name the opaque surface under it with \`over\``);

  return composite(colour, ground(theme, over, undefined));
}

/** The ratio a row is graded at, and the two colours it was actually computed from. */
export function grade(pair: Pair, theme: ThemeName): { ratio: number; fgHex: string; bgHex: string } {
  const bg = ground(theme, pair.bg, pair.over);

  const value = resolveToken(themeTokens(theme), pair.fg);
  if (value === undefined) throw new Error(`no such token: ${pair.fg}`);
  const ink = parseColorAlpha(value);
  if (!ink) throw new Error(`${pair.fg} does not resolve to a measurable colour in ${theme}: ${value}`);

  // Translucent INK needs no `over`: the surface under it is the row's own background, which is
  // already known. That is why only the background half of a row can be ungradeable.
  const fg = ink[3] === 1 ? ([ink[0], ink[1], ink[2]] as Rgb) : composite(ink, bg);

  return { ratio: contrastRatio(fg, bg), fgHex: toHex(fg), bgHex: toHex(bg) };
}

/**
 * Grade one row and describe the outcome as a string, so a failure prints the fact rather than
 * `expected 3.93 to be >= 4.5`. The controls below run the *same* function — a gate whose
 * known-broken case takes a different code path has proved something about the other path.
 */
export function verdict(pair: Pair, theme: ThemeName): string {
  const { ratio, fgHex, bgHex } = grade(pair, theme);
  if (ratio >= pair.min) return 'passes';
  return `${pair.fg} (${fgHex}) on ${pair.bg}${pair.over ? ` over ${pair.over}` : ''} (${bgHex}) is ${ratio.toFixed(
    2
  )}:1 in ${theme}, below ${pair.min} — ${pair.why}`;
}

// ── The gate ──────────────────────────────────────────────────────────────────────────────

describe.each(['dark', 'light'] as const)('the %s palette clears its stated floor', (theme) => {
  it('resolved a palette at all — an empty token map would pass every assertion below', () => {
    const tokens = themeTokens(theme);
    expect(Object.keys(tokens).length).toBeGreaterThanOrEqual(200);
    expect(resolveToken(tokens, '--theme-color-fg-muted')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(resolveToken(tokens, '--theme-color-bg-0')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(PAIRS.map((pair) => [pair.what, pair] as const))('%s', (_what, pair) => {
    expect(verdict(pair, theme)).toBe('passes');
  });
});

// ── The controls ──────────────────────────────────────────────────────────────────────────

/**
 * 🔴 Every assertion above is "a number is big enough", which is the exact shape that passes
 * when the number is computed from nothing. These pin the arithmetic and the failure paths to
 * answers known independently of this file.
 */
describe('the instrument can reject a wrong answer', () => {
  it('scores black on white at 21:1 and a colour against itself at 1:1', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
    expect(contrastRatio([77, 163, 255], [77, 163, 255])).toBeCloseTo(1, 5);
  });

  it('fails a deliberately bad pair put through the same function the table uses', () => {
    // Mid grey on near-black: ~4.2:1, chosen because it is close enough to the bar that an
    // instrument rounding in the wrong direction would let it through.
    const bad: Pair = {
      what: 'a known-broken pair',
      fg: '--theme-color-fg-muted',
      bg: '--theme-color-bg-0',
      min: 4.5,
      why: 'the control'
    };
    expect(verdict(bad, 'dark')).not.toBe('passes');
    expect(verdict(bad, 'dark')).toMatch(/below 4\.5/);

    // ⚠️ And the other direction: the same row with a bar it does clear must pass, or "fails"
    // would be all this function knows how to say.
    expect(verdict({ ...bad, min: 3 }, 'dark')).toBe('passes');
  });

  it('refuses a token that does not exist rather than scoring it as undefined', () => {
    const missing: Pair = {
      what: 'a token nobody declared',
      fg: '--theme-color-does-not-exist',
      bg: '--theme-color-bg-1',
      min: 4.5,
      why: 'the control'
    };
    expect(() => verdict(missing, 'dark')).toThrow(/no such token: --theme-color-does-not-exist/);
    expect(() => verdict({ ...missing, fg: '--theme-color-fg-default', bg: '--nope' }, 'dark')).toThrow(
      /no such token: --nope/
    );
  });

  it('refuses to grade a translucent ground with no opaque surface named', () => {
    const ungradeable: Pair = {
      what: 'an accent wash over nothing in particular',
      fg: '--theme-color-primary',
      bg: '--theme-color-primary-bg',
      min: 4.5,
      why: 'the control'
    };
    expect(() => verdict(ungradeable, 'dark')).toThrow(/translucent/);
    // With a ground named it grades — so the throw above is about the missing `over`, not about
    // the token being unreachable.
    expect(typeof verdict({ ...ungradeable, over: '--theme-color-bg-3' }, 'dark')).toBe('string');
  });

  it('composites a wash rather than dropping its alpha', () => {
    expect(composite([255, 255, 255, 1], [0, 0, 0])).toEqual([255, 255, 255]);
    expect(composite([255, 255, 255, 0], [18, 52, 86])).toEqual([18, 52, 86]);
    expect(composite([0, 0, 0, 0.5], [255, 255, 255])).toEqual([128, 128, 128]);
  });

  it('every row names a bar it stated on purpose', () => {
    // AC2. A row that inherited its bar from a default is the defect the platform's gate found
    // the hard way, so the shape is enforced rather than trusted.
    for (const pair of PAIRS) {
      expect([3, 4.5]).toContain(pair.min);
      expect(pair.why.length).toBeGreaterThan(10);
      if (pair.min === 3) expect(pair.why).toMatch(/NON-TEXT|NOT AA/);
    }
  });
});

/**
 * 🔴 The two arms must actually be two arms.
 *
 * If `themeTokens('light')` silently returned the dark palette — a selector that stopped
 * matching, an override block read in the wrong order — the light half of this file would go
 * green while measuring nothing, and "both themes clear the floor" would be true of one theme.
 * The values are pinned rather than merely required to differ: "they differ" still passes if
 * light resolves to a third thing that is nobody's palette.
 */
describe('the light arm is a different palette from the dark arm', () => {
  it.each([
    ['--theme-color-bg-0', '#0b0e12', '#eef1f5'],
    ['--theme-color-bg-1', '#12161b', '#ffffff'],
    ['--theme-color-bg-4', '#2c3540', '#e2e8ef'],
    ['--theme-color-fg-highlight', '#eef2f6', '#18212b'],
    ['--theme-color-fg-default', '#a6b0bb', '#4a5663'],
    ['--theme-color-fg-default-shy', '#8b95a1', '#616c79'],
    ['--theme-color-fg-muted', '#6b7682', '#7c8894'],
    ['--theme-color-primary', '#4da3ff', '#1570ef'],
    ['--theme-color-on-primary', '#071627', '#ffffff']
  ])('%s resolves to %s in dark and %s in light', (token, inDark, inLight) => {
    expect(resolveToken(themeTokens('dark'), token)).toBe(inDark);
    expect(resolveToken(themeTokens('light'), token)).toBe(inLight);
  });
});
