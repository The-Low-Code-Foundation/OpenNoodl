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
  // `views/Community.tsx`. Its canvas is `bg-0`: `Launcher.module.scss` paints `.ContentArea`
  // with it and `LauncherPage` adds padding and no background of its own.
  //
  // 🔴 **NAT-005 MOVED MOST OF THIS SURFACE UP A GROUND, and that is why five rows below changed
  // their `bg` rather than a sixth being appended.** The tab used to be one flat column on the
  // canvas; the sections now sit in cards on `bg-1`, so a heading, a row title, a state line and
  // the retry link are all pairings nobody had graded — with foregrounds so familiar that an
  // appended row would have looked like the diligent move while leaving the *old* rows asserting
  // a ground nothing paints any more. ⚠️ The trigger for editing a row is the same as the trigger
  // for adding one: a new PAIRING.
  //
  // The chain is canvas `bg-0` < card `bg-1` < row hover `bg-2`.
  {
    what: 'the launcher tab: the viewer line, on the canvas above the cards',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-0',
    min: 4.5,
    why: '13px body copy — no large-text relief, which does not begin until 24px (or 18.66px bold)'
  },
  {
    what: 'the launcher tab: the Refresh button label, at rest on the canvas',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-0',
    min: 4.5,
    why: '13px words in a ghost button; a separate rule from the viewer line, so it can move alone'
  },
  {
    what: 'the launcher tab: the Refresh button under the pointer, which lifts to bg-1 and darkens its label',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-1',
    min: 4.5,
    why: 'hover changes BOTH halves of the pair, so the resting row does not cover it'
  },
  {
    what: 'the launcher tab: the lead paragraph saying what this place is for',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-0',
    min: 4.5,
    why: '13px words on the canvas — the first sentence a person reads on the tab'
  },
  // 🔴 **NAT-005's two CARD-BOUNDARY claims are NOT rows here, and the table said so itself.**
  // A first draft added them at `min: 1.09` and `every row names a bar it stated on purpose` went
  // red: this table grades WORDS at 4.5 and SHAPES at 3, and an elevation step is neither. A row
  // at 1.09 would have loosened that guard for every future row in exchange for two claims that
  // belong elsewhere — so the card fill is the `bg-0`↔`bg-1` step the elevation ramp below
  // already grades, and the 1px edge is asserted beside it. See `the %s elevation ramp is a ramp`.
  {
    what: 'the launcher tab: a section heading, now on the card',
    fg: '--theme-color-fg-highlight',
    bg: '--theme-color-bg-1',
    min: 4.5,
    why: '13px semibold — under the 18.66px bold threshold, so the normal-size bar applies'
  },
  {
    what: 'the launcher tab: the item count beside a section heading',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-1',
    min: 4.5,
    why: '11px words. ⚠️ Smaller than body copy and held to the SAME bar — 1.4.3 has no relief below 24px, only above'
  },
  {
    what: 'the launcher tab: the loading, empty and unreachable lines on a card',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-1',
    min: 4.5,
    why: '13px words, and on an empty tab they are the ONLY words in the section'
  },
  {
    what: 'the launcher tab: the pulsing dot beside “Loading…”',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-1',
    min: 3,
    why: 'NON-TEXT (1.4.11): a 6px dot is a shape. ⚠️ It carries no information the word beside it does not — it is what makes `loading` a different SHAPE from `empty`, not a different sentence'
  },
  {
    what: 'the launcher tab: the rule down the left of an unreachable section',
    fg: '--theme-color-border-control',
    bg: '--theme-color-bg-1',
    min: 3,
    why: 'NON-TEXT (1.4.11): the 2px rule is what makes an error a different shape from an empty, so it is a graphical object doing work'
  },
  {
    what: 'the launcher tab: the “Try again” link on an unreachable section',
    fg: '--theme-color-fg-accent',
    bg: '--theme-color-bg-1',
    min: 4.5,
    why: 'words, and the only way out of the error state'
  },
  {
    what: 'the launcher tab: a discussion, guide or replay title in a row on a card',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-1',
    min: 4.5,
    why: '13px medium-weight words, and the thing a person came to the tab to read'
  },
  {
    what: 'the launcher tab: a row’s meta line and its summary — NAT-005’s new second and third lines',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-1',
    min: 4.5,
    why: '11px words: “3 days ago · no reply yet”, and a guide’s summary. 🔴 These are WORDS and the smallest on the surface — the first draft of this table graded a duration as chrome'
  },
  {
    what: 'the launcher tab: a row title under the pointer',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-2',
    min: 4.5,
    why: 'hover lifts the row to a new ground, and a hover surface nobody listed is one nobody graded'
  },
  {
    what: 'the launcher tab: a row’s meta line under the pointer',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-2',
    min: 4.5,
    why: 'the quietest words on the surface, on the surface’s brightest row ground — the worst case of the four row pairings'
  },
  {
    what: 'the launcher tab: a health readout line on its card',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-1',
    min: 4.5,
    why: '12px words. D21 made these a READOUT — a number nobody can read is not a readout'
  },
  {
    what: 'the launcher tab: the “Open community.nodegx.io” label',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-0',
    min: 4.5,
    why: '13px words in a bordered button, still on the canvas below the cards'
  },
  {
    what: 'the launcher tab: the border that IS the “Open community.nodegx.io” button',
    fg: '--theme-color-border-control',
    bg: '--theme-color-bg-0',
    min: 3,
    why: 'NON-TEXT (1.4.11): the button has no fill, so this 1px edge is the only thing that says a control is there'
  },

  // ── The rail panel ──────────────────────────────────────────────────────────────────────
  // `views/panels/CommunityPanel`. `BasePanel` paints `bg-2` and sets `color: fg-default`;
  // `Section` gutters keep that ground.
  //
  // 🔴 **NAT-005 replaced this panel's `ListItem` rows with the shared `CommunityRow`**, and a
  // `CommunityRow` has no fill of its own — it rests on the panel's `bg-2` and paints `bg-3` only
  // under the pointer. So the row pairings below moved DOWN a ground, which is the opposite
  // direction to the launcher's and just as ungraded. ⚠️ The `ListItem` rows that used to be here
  // still exist everywhere else in the editor, so their pairings are kept and re-labelled rather
  // than deleted — retiring a check needs a higher bar than adding one, and nothing about
  // `ListItem` changed.
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
    what: 'the rail panel: a thread, guide or replay title in a row, at rest',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-2',
    min: 4.5,
    why: '12px words. A `CommunityRow` has no fill of its own, so at rest the row ground IS the panel’s'
  },
  {
    what: 'the rail panel: a row’s meta line — NAT-005’s new second line',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-2',
    min: 4.5,
    why: '10px words: “3 days ago · no reply yet”. 🔴 The smallest text in the product and held to the full bar — 1.4.3 gives no relief below 24px'
  },
  {
    what: 'the rail panel: a row under the pointer',
    fg: '--theme-color-fg-default',
    bg: '--theme-color-bg-3',
    min: 4.5,
    why: 'hover lifts the row one step, and a hover surface nobody listed is one nobody graded'
  },
  {
    what: 'the rail panel: a row’s meta line under the pointer',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-3',
    min: 4.5,
    why: 'the quietest words in the panel on its brightest row ground — the worst case of the four'
  },
  {
    what: 'the rail panel: the pulsing dot beside “Loading…”, and the rule down an unreachable section',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-2',
    min: 3,
    why: 'NON-TEXT (1.4.11): the two shapes that make `loading` and `unreachable` different SHAPES from `empty` rather than three greys'
  },
  {
    what: 'the rail panel: the “Try again” link on an unreachable section',
    fg: '--theme-color-fg-accent',
    bg: '--theme-color-bg-2',
    min: 4.5,
    why: 'words, and the only way out of the error state. NAT-005 made this the same link the launcher draws, so it is the same token on a different ground'
  },
  {
    what: 'a `ListItem` row’s leading icon, anywhere in the editor — the community panel no longer draws one (NAT-005)',
    fg: '--theme-color-fg-default-shy',
    bg: '--theme-color-bg-3',
    min: 3,
    why: 'NON-TEXT (1.4.11): the message/book/play glyph carries meaning but is a shape, not a word'
  },
  // 🔴 CORRECTED after reading `ListItem.module.scss`. The first draft of this row called the
  // selected row's LABEL accent-coloured and graded it at 4.5. It is not: FH-009 already moved
  // the label to `fg-highlight`, and what `is-variant-active` paints with the accent is the
  // leading GLYPH. So this is two rows at two bars, and the 4.48/3.56 the first run reported was
  // a shape being held to a word's standard.
  {
    what: 'a selected `ListItem` row’s leading icon on the accent wash, anywhere in the editor',
    fg: '--theme-color-primary',
    bg: '--theme-color-primary-bg',
    over: '--theme-color-bg-3',
    min: 3,
    why: 'NON-TEXT (1.4.11): a message/book/play glyph is a shape. The wash is 13% alpha, so it is graded composited over the row ground beneath it'
  },
  {
    what: 'a selected `ListItem` row’s label on the accent wash, anywhere in the editor',
    fg: '--theme-color-fg-highlight',
    bg: '--theme-color-primary-bg',
    over: '--theme-color-bg-3',
    min: 4.5,
    why: 'words — FH-009 chose this pair deliberately after the previous one measured 2.17:1'
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
    fg: '--theme-color-fg-danger',
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

  { what: 'Shy copy on a dialog', fg: '--theme-color-fg-default-shy', bg: '--theme-color-bg-4', min: 4.5, why: 'the ground `BaseDialog` paints, and therefore the worst case for every dialog in the editor' },

  // 🔴 THE ROWS THE PALETTE FAILED ON, KEPT. `fg-muted` is retired to an alias of
  // `fg-default-shy` (NAT-002, D9) and these now pass because of that, not despite it. They stay
  // in the table because ~217 `color:` declarations still name the retired token: if anybody
  // restores it to a value of its own, this is what says so.
  { what: 'the retired muted token, still named by ~217 declarations, on a panel', fg: '--theme-color-fg-muted', bg: '--theme-color-bg-1', min: 4.5, why: 'it was documented as secondary text, and secondary text is words' },
  { what: 'the retired muted token, a step up', fg: '--theme-color-fg-muted', bg: '--theme-color-bg-2', min: 4.5, why: 'same token, worse ground' },
  { what: 'the retired muted token, two steps up', fg: '--theme-color-fg-muted', bg: '--theme-color-bg-3', min: 4.5, why: 'same token, worse ground again' },
  { what: 'the retired muted token, on a dialog', fg: '--theme-color-fg-muted', bg: '--theme-color-bg-4', min: 4.5, why: 'the ground that broke `fg-default-shy` too, and therefore the one an un-retirement would fail on first' },

  // ⚠️ NOT AA. 1.4.3 exempts inactive controls outright, so a 4.5 here would be a gate rejecting
  // a correct answer. 3 is a LOCAL floor, stated as a choice: disabled text still has to be
  // findable enough to read what the control you cannot use says. NAT-002 AC3 owns the separate
  // question of whether this token should go on aliasing `fg-muted` at all.
  { what: 'disabled text on a panel', fg: '--theme-color-fg-disabled', bg: '--theme-color-bg-1', min: 3, why: 'NOT AA — 1.4.3 exempts inactive controls; 3 is this repo’s own floor for “still readable”' },
  { what: 'disabled text two steps up', fg: '--theme-color-fg-disabled', bg: '--theme-color-bg-3', min: 3, why: 'NOT AA — as above' },

  { what: 'a link on the page ground', fg: '--theme-color-fg-accent', bg: '--theme-color-bg-0', min: 4.5, why: '`Text` paints anchors with the TEXT accent (D10), and links are words' },
  { what: 'a link on a panel', fg: '--theme-color-fg-accent', bg: '--theme-color-bg-1', min: 4.5, why: 'same role, the most common panel ground' },
  { what: 'a link a step up', fg: '--theme-color-fg-accent', bg: '--theme-color-bg-2', min: 4.5, why: 'same role, lighter ground' },
  { what: 'a link two steps up', fg: '--theme-color-fg-accent', bg: '--theme-color-bg-3', min: 4.5, why: 'same role, lighter ground again' },
  { what: 'a link in a dialog', fg: '--theme-color-fg-accent', bg: '--theme-color-bg-4', min: 4.5, why: 'same role, on the ground every dialog paints' },
  { what: 'a primary button’s label', fg: '--theme-color-on-primary', bg: '--theme-color-primary', min: 4.5, why: 'words; ground-independent, so correct on any surface' },

  // D11. `TextType.Success/Notice/Danger` paint the TEXT roles; the fill roles keep their values
  // and their jobs. Graded on bg-2 and on bg-4, because bg-4 is where `danger` broke in DARK.
  { what: 'a success message a step up', fg: '--theme-color-fg-success', bg: '--theme-color-bg-2', min: 4.5, why: '`TextType.Success` is words' },
  { what: 'a success message in a dialog', fg: '--theme-color-fg-success', bg: '--theme-color-bg-4', min: 4.5, why: 'same role, the dialog ground' },
  { what: 'a notice message a step up', fg: '--theme-color-fg-notice', bg: '--theme-color-bg-2', min: 4.5, why: '`TextType.Notice` is words' },
  { what: 'a notice message in a dialog', fg: '--theme-color-fg-notice', bg: '--theme-color-bg-4', min: 4.5, why: 'same role, the dialog ground' },
  { what: 'a danger message a step up', fg: '--theme-color-fg-danger', bg: '--theme-color-bg-2', min: 4.5, why: '`TextType.Danger` is words' },
  { what: 'a danger message in a dialog', fg: '--theme-color-fg-danger', bg: '--theme-color-bg-4', min: 4.5, why: 'same role, the dialog ground — this is the pair that measured 4.46 in dark' },
  { what: 'an error message, which reaches its colour through `fg-error`', fg: '--theme-color-fg-error', bg: '--theme-color-bg-4', min: 4.5, why: 'a separate alias with its own consumers, so a separate claim' }
];

/**
 * NAT-003 — the syntax palette, on the ground CodeMirror actually paints.
 *
 * 🔴 **PAIRS HAD NO SYNTAX ROW AT ALL, AND THAT HOLE IS HOW A FALSE CLAIM SURVIVED.**
 * `colors.css` stated, in a comment, that the light syntax values were "all AA on bg-1/bg-2".
 * Three of them were not — `type` 4.35, `number` 4.36, `brace` 4.36 — and had not been since
 * they were written. Nothing failed, because nothing looked. NAT-003 lifting `bg-2` made them
 * marginally worse, which is the only reason anyone measured.
 *
 * ⚠️ The ground is **`bg-2`**, not `bg-1`: `codemirror-theme.ts:50` paints `.cm-editor` with it.
 * That is also the surface a person stares at for the longest continuous stretch in this app, so
 * it gets the normal-size bar rather than any large-text relief.
 *
 * These are generated rather than hand-listed — a hand-listed table is how three of twenty-one
 * went unwatched. Every `--theme-color-syntax-*` token in the file is graded, so a token added
 * tomorrow is covered without anybody remembering this file exists.
 */
describe.each(['dark', 'light'] as const)('the %s syntax palette is readable where code is read', (theme) => {
  const SYNTAX = Object.keys(themeTokens(theme))
    .filter((token) => /^--theme-color-syntax-/.test(token))
    .sort();

  it('found the syntax tokens at all', () => {
    // The control: a filter that matches nothing grades nothing and reports success.
    expect(SYNTAX.length).toBeGreaterThanOrEqual(15);
  });

  it.each(SYNTAX.map((token) => [token.replace('--theme-color-syntax-', ''), token] as const))(
    '`%s` clears AA on the editing surface',
    (_name, token) => {
      const pair: Pair = {
        what: `syntax: ${token}`,
        fg: token,
        bg: '--theme-color-bg-2',
        min: 4.5,
        why: "CodeMirror's editing surface is bg-2 — code is normal-size text and is read for longer than anything else here"
      };
      expect(verdict(pair, theme)).toBe('passes');
    }
  );
});

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
    // 🔴 THE FIRST VERSION OF THIS CONTROL WAS `fg-muted` ON `bg-0` — the defect the file was
    // written to catch, at 4.18:1. NAT-002 retired that token, the control started passing, and
    // the gate briefly could not demonstrate that it rejects anything. A known-bad input has to
    // be one nothing is trying to fix: two ELEVATION steps held to a text bar can never clear it.
    const bad: Pair = {
      what: 'a known-broken pair',
      fg: '--theme-color-bg-1',
      bg: '--theme-color-bg-0',
      min: 4.5,
      why: 'the control'
    };
    expect(verdict(bad, 'dark')).not.toBe('passes');
    expect(verdict(bad, 'dark')).toMatch(/below 4\.5/);
    expect(verdict(bad, 'light')).not.toBe('passes');

    // A colour against itself is 1.00 exactly — the one ratio knowable without this code.
    expect(verdict({ ...bad, fg: '--theme-color-bg-0', min: 1.01 }, 'dark')).toMatch(/is 1\.00:1/);
  });

  it('fails a pair that is barely under its bar, not just one that is obviously under', () => {
    // ⚠️ Self-calibrating, so it cannot rot the way the row above did: measure a pair that
    // passes comfortably, then demand 0.01 more than it scores. An instrument that rounded, or
    // compared the wrong way round, lets this through and every real row still looks green.
    const real: Pair = {
      what: 'body copy on a panel',
      fg: '--theme-color-fg-default',
      bg: '--theme-color-bg-1',
      min: 4.5,
      why: 'the control'
    };
    const { ratio } = grade(real, 'dark');
    expect(verdict(real, 'dark')).toBe('passes');
    expect(verdict({ ...real, min: ratio + 0.01 }, 'dark')).not.toBe('passes');
    expect(verdict({ ...real, min: ratio - 0.01 }, 'dark')).toBe('passes');
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
 * NAT-002 AC2 — the hierarchy the raise could have traded away.
 *
 * 🔴 A contrast fix that lifts every quiet token until it meets the loud one has swapped a
 * contrast bug for a hierarchy bug, and every assertion in this file would still be green. So
 * the STEPS are asserted, not just the floors: `fg-default` → `fg-default-shy` → `fg-disabled`
 * has to stay a descent that a reader can see.
 *
 * ⚠️ The bars are stated as choices, not derived from WCAG — WCAG has nothing to say about two
 * foregrounds against each other. 1.15 is roughly where a tone step stops being visible at 12px
 * on these grounds; the step measured 1.38/1.40 before NAT-002 and 1.21/1.25 after, so the bar
 * is set below what shipped and above what would be indistinguishable.
 */
describe.each(['dark', 'light'] as const)('the %s foreground ramp keeps its steps', (theme) => {
  const at = (token: string) => {
    const colour = parseColorAlpha(resolveToken(themeTokens(theme), token));
    if (!colour) throw new Error(`no such token: ${token}`);
    return [colour[0], colour[1], colour[2]] as Rgb;
  };

  it('body copy is louder than secondary copy', () => {
    expect(contrastRatio(at('--theme-color-fg-default'), at('--theme-color-fg-default-shy'))).toBeGreaterThanOrEqual(1.15);
  });

  it('secondary copy is louder than disabled text', () => {
    expect(contrastRatio(at('--theme-color-fg-default-shy'), at('--theme-color-fg-disabled'))).toBeGreaterThanOrEqual(1.4);
  });

  it('no two of the four foreground steps are the same colour', () => {
    // NAT-002 AC3: `fg-disabled` used to ALIAS `fg-muted`, so "they differ" was false by
    // construction and nothing said so. `fg-muted` is now the alias — of `fg-default-shy` — and
    // that one collision is the deliberate one, which is why it is named rather than counted.
    const steps = ['--theme-color-fg-highlight', '--theme-color-fg-default', '--theme-color-fg-default-shy', '--theme-color-fg-disabled'];
    const values = steps.map((token) => resolveToken(themeTokens(theme), token));
    expect(new Set(values).size).toBe(steps.length);

    expect(resolveToken(themeTokens(theme), '--theme-color-fg-muted')).toBe(
      resolveToken(themeTokens(theme), '--theme-color-fg-default-shy')
    );
  });

  it('a text role may only share its fill role’s value where that fill already reads as words', () => {
    // 🔴 The naive form of this assertion — "they must differ" — is WRONG, and asserting it
    // would be a gate rejecting a correct answer. In dark, `success` and `notice` already clear
    // 4.5:1 on every ground, so their text roles point at the same values on purpose; the
    // platform's own gate records the identical finding about `--site-fg-warn`. Only `accent`
    // and `danger` needed moving in dark, and all four needed it in light.
    //
    // What must hold is the CONDITIONAL: a text role is allowed to equal its fill only when the
    // fill is readable. That way a later tidy that points `fg-accent` back at `primary` fails
    // here, in LIGHT, where it is wrong — rather than passing because dark happens to be fine.
    const GROUNDS = ['--theme-color-bg-0', '--theme-color-bg-1', '--theme-color-bg-2', '--theme-color-bg-3', '--theme-color-bg-4'];

    for (const [text, fill] of [
      ['--theme-color-fg-accent', '--theme-color-primary'],
      ['--theme-color-fg-success', '--theme-color-success'],
      ['--theme-color-fg-notice', '--theme-color-notice'],
      ['--theme-color-fg-danger', '--theme-color-danger']
    ]) {
      const tokens = themeTokens(theme);
      if (resolveToken(tokens, text) !== resolveToken(tokens, fill)) continue;

      const worst = Math.min(
        ...GROUNDS.map((bg) => grade({ what: '', fg: fill, bg, min: 4.5, why: '' }, theme).ratio)
      );
      expect(
        `${text} shares ${fill} and that fill is ${worst.toFixed(2)}:1 at worst — ${worst >= 4.5 ? 'readable' : 'NOT readable, so the split has been undone'}`
      ).toMatch(/readable$/);
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
/**
 * NAT-003 AC1 — the ELEVATION table. Surface against surface, not text against surface.
 *
 * ## Why this is a separate table with a separate bar, and not more rows in PAIRS
 *
 * PAIRS grades readability, and every row in it names 4.5 (WCAG 1.4.3) or 3 (1.4.11). **WCAG
 * governs neither of those for two backgrounds.** A card edge is decorative elevation, not a
 * control boundary, so holding it to 1.4.11's 3:1 would be a gate rejecting a correct answer —
 * no dark theme in existence separates a panel from its canvas by 3:1, and one that did would be
 * a set of stacked greys, not a product. The bar below is therefore **a design choice, and it is
 * defended rather than borrowed.** `PAIRS`'s own shape assertion enforces `min ∈ {3, 4.5}`, which
 * is exactly why these rows cannot live there.
 *
 * ## Where the number comes from — this product's own evidence
 *
 * Before NAT-003, the dark ramp measured:
 *
 * | step | dark | light |
 * |---|---|---|
 * | `bg-0` → `bg-1` | **1.065** | 1.133 |
 * | `bg-1` → `bg-2` | **1.072** | 1.055 |
 * | `bg-2` → `bg-3` | 1.156 | 1.085 |
 * | `bg-3` → `bg-4` | 1.180 | 1.077 |
 *
 * Richard's complaint — *"less dark on dark, it's really depressing"* — was about a canvas whose
 * cards dissolve into it. The two steps that produced it are 1.065 and 1.072. The two nobody has
 * ever complained about are 1.156 and 1.180. **The perceptual threshold for this palette,
 * measured on this palette, lies between 1.07 and 1.16**, so the bar is set at **1.15** in dark:
 * above everything that drew the complaint, at or below everything that did not. That is a
 * boundary the product demonstrated, not a number imported from a spec that has no opinion.
 *
 * 🔴 **LIGHT GETS A LOWER BAR (1.09) AND THAT IS A LIMIT, NOT A PREFERENCE.** In light the raised
 * surface is `bg-1` = pure white, which cannot go higher, so the whole ramp is squeezed between
 * white and the darkest ground AA text still survives on (`fg-accent` clears `bg-4` by 0.10).
 * 1.09 is very close to the most that budget affords without darkening the light foregrounds, and
 * saying so is the honest form. Light also carries elevation a second way that dark barely uses —
 * `border-default` is a visible line there (1.04 on bg-3) and an invisible one in dark (1.08).
 * ⚠️ Do not "fix" the asymmetry by raising light to 1.15. It does not fit, and the pairs it would
 * break are text pairs.
 *
 * ## What this table cannot see
 *
 * Alpha. `--theme-color-bg-1-transparent` is `rgba(0,0,0,0.8)` in dark and does NOT follow the
 * ramp — deliberately, because its consumers are scrims and `box-shadow`s (`BaseDialog`,
 * `PopupToolbar`, `popuplayer.css`, `SideNavigation`), and a shadow is an occlusion rather than a
 * surface. That reading is NAT-003's, it is recorded in `colors.css`, and it is not asserted here
 * because a token named `bg-1-*` that is not on the `bg-1` ramp is a NAMING defect, not a
 * contrast one.
 */
describe.each(['dark', 'light'] as const)('the %s elevation ramp is a ramp', (theme) => {
  /** Adjacent surfaces a user sees meeting each other, and the bar each is held to. */
  const STEPS: Array<[string, string]> = [
    ['--theme-color-bg-0', '--theme-color-bg-1'],
    ['--theme-color-bg-1', '--theme-color-bg-2'],
    ['--theme-color-bg-2', '--theme-color-bg-3'],
    ['--theme-color-bg-3', '--theme-color-bg-4']
  ];
  const BAR = { dark: 1.15, light: 1.09 }[theme];

  const surface = (token: string): Rgb => {
    const value = resolveToken(themeTokens(theme), token);
    const colour = parseColorAlpha(value);
    if (!colour) throw new Error(`no such token: ${token}`);
    // 🔴 An elevation step is opaque by definition. A translucent ground here would be composited
    // against something this table does not know, so refuse it rather than drop the alpha.
    if (colour[3] !== 1) throw new Error(`${token} is translucent (${value}) — not an elevation step`);
    return [colour[0], colour[1], colour[2]];
  };

  it.each(STEPS)('%s and %s are distinguishable surfaces', (lower, upper) => {
    const ratio = contrastRatio(surface(lower), surface(upper));
    const verdict = ratio >= BAR ? 'passes' : `${lower} (${toHex(surface(lower))}) and ${upper} (${toHex(
      surface(upper)
    )}) are ${ratio.toFixed(3)}:1 apart in ${theme}, below the stated ${BAR} — the step is invisible`;
    expect(verdict).toBe('passes');
  });

  it('🔴 NAT-005: the 1px edge on a launcher card is a line, not a suggestion', () => {
    // The card's visibility has two halves and this is the SMALLER one: the `bg-0`→`bg-1` fill
    // step above is what a reader mostly sees. It is asserted here rather than in PAIRS because
    // it is neither words (4.5) nor a graphical object 1.4.11 reaches (3) — a decorative edge on
    // a section whose own heading names it — and a third bar in that table would have loosened
    // the guard that keeps every other row honest.
    //
    // 🔴 The measurement that chose the token: `border-subtle` on this ground is 1.29 dark but
    // **1.03 light** — in light it is less of a line than the fill step beside it, i.e. nothing.
    // A card that dropped the fill and kept a subtle border would look correct in dark and have
    // no edge at all in light, which is the exact NAT-003 complaint in a new place.
    const edge = contrastRatio(surface('--theme-color-border-default'), surface('--theme-color-bg-0'));
    const subtle = contrastRatio(surface('--theme-color-border-subtle'), surface('--theme-color-bg-0'));
    expect(edge).toBeGreaterThanOrEqual(BAR);
    // ⚠️ CONTROL, and it is the reason the row exists: if this ever stops being true, the two
    // tokens have converged and the sentence above is no longer why `border-default` was chosen.
    expect(edge).toBeGreaterThan(subtle);
  });

  it('the ramp only ever goes one way', () => {
    // ⚠️ In LIGHT it does not go the same way as dark: `bg-1` is white and is the PEAK, with
    // bg-2..4 descending from it. So this asserts monotonic LUMINANCE only where the theme
    // actually claims it, which is dark. Asserting a direction in light would be asserting a
    // model the light theme does not use.
    if (theme !== 'dark') return;
    const ys = ['--theme-color-bg-page', '--theme-color-bg-0', '--theme-color-bg-1', '--theme-color-bg-2', '--theme-color-bg-3', '--theme-color-bg-4', '--theme-color-bg-5']
      .map((t) => contrastRatio(surface(t), [0, 0, 0]));
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });

  it('🔴 CONTROL: this table rejects the ramp it was written against', () => {
    // Self-calibrating and un-rottable: the SHIPPED pre-NAT-003 values, which are what the bar
    // was chosen to exclude. If a future edit lands back near them, this says so.
    const before = { dark: ['#0b0e12', '#12161b'], light: ['#eef1f5', '#ffffff'] }[theme];
    const ratio = contrastRatio(parseColorAlpha(before[0])!.slice(0, 3) as Rgb, parseColorAlpha(before[1])!.slice(0, 3) as Rgb);
    if (theme === 'dark') expect(ratio).toBeLessThan(BAR);
    // ⚠️ In light the old bg-0→bg-1 was 1.133 and ALREADY cleared 1.09 — it was never the
    // complaint. Asserting it fails would be inventing a defect to have a control, so the light
    // arm's control is the opposite claim, and it is still a claim.
    else expect(ratio).toBeGreaterThan(BAR);
  });
});

describe('the light arm is a different palette from the dark arm', () => {
  it.each([
    ['--theme-color-bg-0', '#161c24', '#eef1f5'],
    ['--theme-color-bg-1', '#212932', '#ffffff'],
    ['--theme-color-bg-4', '#3c4857', '#d9dfe6'],
    ['--theme-color-fg-highlight', '#eef2f6', '#18212b'],
    ['--theme-color-fg-default', '#bbc6d3', '#4a5663'],
    ['--theme-color-fg-default-shy', '#abb8c5', '#59626e'],
    // NAT-002 D9: `fg-muted` is an ALIAS now, so these are `fg-default-shy`'s values reached
    // through it. If it ever resolves to something else, it has been un-retired.
    ['--theme-color-fg-muted', '#abb8c5', '#59626e'],
    ['--theme-color-fg-disabled', '#7d8a98', '#7a8691'],
    ['--theme-color-primary', '#4da3ff', '#1570ef'],
    // 🔴 NAT-003: dark is NO LONGER `primary`. NAT-002 pinned them equal and said so; lifting the
    // elevation ramp took the fill from 4.73 to 3.54 on bg-4, so accent TEXT had to leave and the
    // FILL stayed exactly where it was. The pin now stops the reverse tidy — re-aliasing dark
    // because the two "should" match. They should not: one is words, the other is an area.
    ['--theme-color-fg-accent', '#9dccff', '#0e5cca'],
    ['--theme-color-fg-success', '#6ce9a6', '#05603a'],
    ['--theme-color-fg-notice', '#fdb022', '#93370d'],
    ['--theme-color-fg-danger', '#fda29b', '#b42318'],
    ['--theme-color-on-primary', '#071627', '#ffffff']
  ])('%s resolves to %s in dark and %s in light', (token, inDark, inLight) => {
    expect(resolveToken(themeTokens('dark'), token)).toBe(inDark);
    expect(resolveToken(themeTokens('light'), token)).toBe(inLight);
  });
});

/**
 * NAT-003 AC6 — the ground CodeMirror paints on the line the cursor is on.
 *
 * 🔴 **THE SYNTAX TABLE ABOVE GRADES `bg-2`, AND THE ACTIVE LINE IS NOT `bg-2`.**
 * `codemirror-theme.ts:83` paints `.cm-activeLine` with `--theme-color-bg-hover`, and
 * `highlightActiveLine()` is registered (`codemirror-extensions.ts:357`), so every line a person
 * edits is read on a *different* surface from the one the gate checks.
 *
 * `bg-hover` is translucent — `rgba(255,255,255,0.1)` dark, `rgba(23,32,43,0.06)` light — so it
 * does not replace the ground, it composites over it: `#2b3440` → `#404853`, `#f2f4f6` → `#e5e7ea`.
 * Both confirmed against `getComputedStyle` in the running editor on 2026-08-19.
 *
 * ⚠️ **This is a RATCHET, not a floor, and the difference is deliberate.** Eight dark and ten light
 * syntax tokens are below 4.5 on this ground *today*. Asserting 4.5 outright would land a red gate;
 * asserting nothing is how the number grew in the first place. **Before NAT-003 it was 5 and 7** —
 * that task widened it by three in each theme with every existing row still green. So this pins the
 * count where it now stands and lets it move one way.
 *
 * ✅ The real fix is a decision, not a mechanical edit: either re-tune the tokens against a second
 * ground, or give the active line its own token instead of reusing the app-wide `bg-hover` and pick
 * an opacity the graded palette survives. Whoever takes it lowers the ceilings below.
 */
describe.each(['dark', 'light'] as const)('the %s syntax palette on the highlighted line', (theme) => {
  const CEILING = { dark: 8, light: 10 }[theme];
  const SYNTAX = Object.keys(themeTokens(theme))
    .filter((token) => /^--theme-color-syntax-/.test(token))
    .sort();

  const onActiveLine = (token: string): Pair => ({
    what: `syntax: ${token} on the active line`,
    fg: token,
    bg: '--theme-color-bg-hover',
    over: '--theme-color-bg-2',
    min: 4.5,
    why: 'the line the cursor sits on is bg-hover composited over the editing surface'
  });

  it('🔴 CONTROL: the active line is a DIFFERENT ground from the one the table above grades', () => {
    // Without this, a `bg-hover` that stopped being translucent would make every assertion below
    // a silent duplicate of the bg-2 rows — passing, and measuring nothing.
    const composited = grade(onActiveLine(SYNTAX[0]), theme).bgHex;
    const plain = grade({ ...onActiveLine(SYNTAX[0]), bg: '--theme-color-bg-2', over: undefined }, theme).bgHex;
    expect(composited).not.toBe(plain);
  });

  it('found the syntax tokens at all', () => {
    expect(SYNTAX.length).toBeGreaterThanOrEqual(15);
  });

  it(`no more than ${CEILING} tokens are sub-AA there — the count may only go down`, () => {
    const failing = SYNTAX.filter((token) => grade(onActiveLine(token), theme).ratio < 4.5).map(
      (token) => `${token.replace('--theme-color-syntax-', '')} ${grade(onActiveLine(token), theme).ratio.toFixed(2)}`
    );

    const verdict =
      failing.length <= CEILING
        ? 'passes'
        : `${failing.length} syntax tokens are below 4.5 on the active line in ${theme}, up from ${CEILING}: ${failing.join(
            ', '
          )} — a palette change made the code editor worse on the one line every reader is looking at`;

    expect(verdict).toBe('passes');
  });
});
