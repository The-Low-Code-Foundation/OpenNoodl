/**
 * SBR-003 — the Site Builder token contract, in one place.
 *
 * Three artefacts read this module and nothing restates its values:
 *
 *  1. `site-builder.template.ts` builds its `designTokens` block from
 *     `buildSiteDesignTokens()` — the Studio preset authored as project token
 *     overrides, which `generateProjectTokenCss` stamps into `:root {}` of
 *     every deploy and `PreviewTokenInjector` pushes into the editor preview.
 *     **An unclaimed site with zero records renders the full Studio look.**
 *  2. The template's `docs/THEME.md` (the door's `get_project_doc` surface) is
 *     `buildThemeDoc()` — generated, so the doc cannot drift from the data.
 *  3. The theme editor's preset row (SBR-009) serialises `SITE_THEME_PRESETS`
 *     into its graph; the cross-file key contract in `sb006PublicSite.test.ts`
 *     holds the graph scripts to `THEME_TOKEN_FIELDS`.
 *
 * ## The contract, as ruled (SBR-003 §1)
 *
 * The shipped 182-token vocabulary (`StyleTokensModel/DefaultTokens.ts`) IS the
 * contract — no parallel `--bg`/`--ink` namespace. A `Theme` record is a
 * runtime overlay of the SAME names via `document.documentElement.style`
 * (element style beats the `:root` rule, so overrides beat defaults with no new
 * mechanism), and the template's `designTokens` metadata is the floor beneath
 * it (`buildEffectiveTokens` — defaults are always the floor).
 *
 * 🔴 One default writer (`designTokens`), one overlay writer (the site's
 * `applyTheme` code node). No per-component `var(--x, fallback)` fallbacks —
 * that duplicates the defaults into every component, and a second copy of a
 * palette drifts silently.
 *
 * ## Two deliberate wrinkles, so nobody rediscovers them
 *
 * - `fontDisplay` rides `--font-serif` and `fontUi` rides `--font-sans` even
 *   when the value is not a serif/sans stack (Night's display face is a sans).
 *   The token names the ROLE SLOT in the shipped vocabulary; minting
 *   `--site-display` would be the parallel namespace the ruling forbids.
 * - `measure` is the one new custom token (`--site-measure`): the vocabulary
 *   has no reading-width token, and `StyleTokensModel` supports custom tokens
 *   first-class ("Add a brand-new custom token").
 */
import { StyleTokenRecord, StyleTokensData, TokenCategory } from '../../StyleTokensModel/TokenCategories';

/**
 * The `Theme` record's field list — SBR-003 §1.3's deliverable, final.
 *
 * `Theme.tokens` carries exactly these keys (a missing key and an empty one
 * are different things to a reader doing `tokens.colorText`, so writers write
 * all of them). Each maps to the CSS custom property the overlay writes.
 *
 * The subset a client edits by hand on the theme editor is smaller (SBR-009
 * groups them); the preset row writes the full record, which is how the
 * companion values a hand-editor never thinks about (`colorOnPrimary`,
 * `colorAccentSoft`) stay coherent.
 */
export const THEME_TOKEN_FIELDS = {
  colorPrimary: '--primary',
  colorOnPrimary: '--primary-foreground',
  colorBackground: '--background',
  colorSurface: '--surface',
  colorText: '--foreground',
  colorTextSoft: '--muted-foreground',
  colorBorder: '--border',
  colorAccentSoft: '--accent',
  radius: '--radius-md',
  fontDisplay: '--font-serif',
  fontUi: '--font-sans',
  measure: '--site-measure'
} as const;

export type ThemeField = keyof typeof THEME_TOKEN_FIELDS;

/** The one token this template mints rather than overrides. */
export const SITE_MEASURE_TOKEN = '--site-measure';

/** A preset is a full `Theme.tokens` value — every field, no gaps. */
export type ThemePreset = Record<ThemeField, string>;

const FONT_UI = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const FONT_SERIF = '"Iowan Old Style", Georgia, serif';

/**
 * The three presets, values verbatim from the screens artifact (the six-screen
 * proposal Richard ruled ships un-trimmed). Studio is also the shipped floor:
 * `buildSiteDesignTokens()` below derives the `designTokens` block from it, so
 * "pick Studio" and "delete the Theme row" are the same look by construction.
 */
export const SITE_THEME_PRESETS: Record<'studio' | 'press' | 'night', ThemePreset> = {
  studio: {
    colorPrimary: '#1e4d8c',
    colorOnPrimary: '#ffffff',
    colorBackground: '#fbfaf8',
    colorSurface: '#ffffff',
    colorText: '#1b1a17',
    colorTextSoft: '#56534c',
    colorBorder: '#e3ded4',
    colorAccentSoft: '#e7eef8',
    radius: '6px',
    fontDisplay: FONT_SERIF,
    fontUi: FONT_UI,
    measure: '44rem'
  },
  press: {
    colorPrimary: '#8c2f22',
    colorOnPrimary: '#fff8f2',
    colorBackground: '#f5efe6',
    colorSurface: '#fffdf9',
    colorText: '#241a12',
    colorTextSoft: '#5f5145',
    colorBorder: '#e0d3c1',
    colorAccentSoft: '#f6e5df',
    radius: '2px',
    fontDisplay: FONT_SERIF,
    fontUi: FONT_UI,
    measure: '44rem'
  },
  night: {
    colorPrimary: '#d9a441',
    colorOnPrimary: '#191713',
    colorBackground: '#14161a',
    colorSurface: '#1c1f25',
    colorText: '#eceae5',
    colorTextSoft: '#a7a49d',
    colorBorder: '#2c3038',
    colorAccentSoft: '#2a2418',
    radius: '10px',
    fontDisplay: '"Helvetica Neue", Arial, sans-serif',
    fontUi: FONT_UI,
    measure: '44rem'
  }
};

/**
 * Floor-only companions: vocabulary tokens the site's surfaces use that are
 * NOT `Theme` record fields. Static Studio-warm values here; at runtime the
 * overlay re-derives each from the record fields it follows (`applyTheme` in
 * `sb006Components.ts` — a derivation, not a second palette).
 *
 * ⚠️ Static hexes on purpose. `TokenResolver.generateCss` resolves a pure
 * `var(--x)` value inline at stamp time, which would freeze the link; an
 * expression would survive, but the floor does not need to track anything —
 * the overlay is what tracks the record.
 */
const STUDIO_COMPANIONS: ReadonlyArray<readonly [name: string, value: string, description: string]> = [
  ['--primary-hover', '#1a4177', 'Studio primary, darkened — hover state of --primary'],
  ['--ring', '#1e4d8c', 'Focus ring follows the primary'],
  ['--accent-foreground', '#1e4d8c', 'Text on --accent is the primary (the screens artifact’s live-pill)'],
  ['--surface-raised', '#ffffff', 'Raised surfaces share the Studio card surface'],
  ['--border-subtle', '#efebe2', 'Warm-neutral step lighter than --border'],
  ['--border-strong', '#cdc5b6', 'Warm-neutral step darker than --border'],
  ['--muted', '#f1ede5', 'Subtle warm background, between surface and border']
];

const CATEGORY_BY_FIELD: Record<ThemeField, TokenCategory> = {
  colorPrimary: 'color-semantic',
  colorOnPrimary: 'color-semantic',
  colorBackground: 'color-semantic',
  colorSurface: 'color-semantic',
  colorText: 'color-semantic',
  colorTextSoft: 'color-semantic',
  colorBorder: 'color-semantic',
  colorAccentSoft: 'color-semantic',
  radius: 'border-radius',
  fontDisplay: 'typography-family',
  fontUi: 'typography-family',
  measure: 'spacing'
};

/**
 * The Studio preset as a project `designTokens` block — what
 * `site-builder.template.ts` declares and `EmbeddedTemplateProvider.install`
 * writes into the new project's metadata under `STYLE_TOKENS_METADATA_KEY`.
 */
export function buildSiteDesignTokens(): StyleTokensData {
  const studio = SITE_THEME_PRESETS.studio;

  const fromRecord: StyleTokenRecord[] = (Object.keys(THEME_TOKEN_FIELDS) as ThemeField[]).map((field) => ({
    name: THEME_TOKEN_FIELDS[field],
    value: studio[field],
    category: CATEGORY_BY_FIELD[field],
    // `--site-measure` is minted here; everything else overrides a shipped
    // default. `buildEffectiveTokens` treats both the same way (set-by-name),
    // but the panel labels customs differently and the vocabulary spec below
    // keys off exactly this split.
    isCustom: THEME_TOKEN_FIELDS[field] === SITE_MEASURE_TOKEN,
    description:
      THEME_TOKEN_FIELDS[field] === SITE_MEASURE_TOKEN
        ? 'Reading width of the public site (Site Builder custom token)'
        : `Site Builder Studio default (Theme field: ${field})`
  }));

  const companions: StyleTokenRecord[] = STUDIO_COMPANIONS.map(([name, value, description]) => ({
    name,
    value,
    category: 'color-semantic',
    isCustom: false,
    description
  }));

  return { version: 1, customTokens: [...fromRecord, ...companions] };
}

/**
 * `docs/THEME.md` for a new Site Builder project — SBR-003 AC3. Generated from
 * the same data the graphs use, so reading it IS reading the contract.
 */
export function buildThemeDoc(): string {
  const fieldRows = (Object.keys(THEME_TOKEN_FIELDS) as ThemeField[])
    .map((field) => `| \`${field}\` | \`${THEME_TOKEN_FIELDS[field]}\` |`)
    .join('\n');

  const presetNames = Object.keys(SITE_THEME_PRESETS) as Array<keyof typeof SITE_THEME_PRESETS>;
  const presetRows = (Object.keys(THEME_TOKEN_FIELDS) as ThemeField[])
    .map((field) => {
      const cells = presetNames.map((p) => `\`${SITE_THEME_PRESETS[p][field]}\``).join(' | ');
      return `| \`${field}\` | ${cells} |`;
    })
    .join('\n');

  return `---
title: The theme contract
inject: pull
when: theme, tokens, colour, color, preset, font, radius, restyle, style
---

# The theme contract

Every visual value in this project comes from a CSS custom property — the
platform's own token vocabulary (open the style panel, or \`get_style_vocabulary\`
through the door). **No component sets a raw colour, radius, gap or typeface**,
and no component writes a \`var(--x, fallback)\` fallback: defaults have exactly
one writer, and it is not a component.

## How a value reaches the screen

1. **The floor.** This project's metadata carries a \`designTokens\` block — the
   Studio preset. The deploy stamps it (with the shipped defaults beneath it)
   into \`:root {}\` of index.html; the editor preview injects the same CSS. A
   site with no \`Theme\` record at all already wears the full Studio look.
2. **The overlay.** The one row in the \`Theme\` collection carries a \`tokens\`
   object (fields below). The public site's "theme applier" code node writes
   each present value onto \`document.documentElement.style\` — element style
   beats \`:root\`, so the record beats the floor, per token, with no merge step.
3. **Deleting the row** (or any single field being empty) falls that token back
   to the floor. Studio is what "no theme" looks like, by construction.

## The \`Theme.tokens\` fields

Writers write **all** of these keys (empty string = "no override"); the applier
reads these and nothing else.

| field | CSS token it overlays |
|---|---|
${fieldRows}

\`measure\` maps to \`${SITE_MEASURE_TOKEN}\` — the one custom token this template
mints (reading width). \`radius\` is one step for the whole site (\`--radius-md\`);
\`fontDisplay\`/\`fontUi\` are the display/interface ROLE slots — Night puts a sans
stack in \`--font-serif\`, and that is intended.

## Derived companions

The applier also derives, from the fields above: \`--primary-hover\` (darkened
primary), \`--ring\` and \`--accent-foreground\` (follow primary),
\`--surface-raised\` (follows surface), \`--border-subtle\`/\`--border-strong\`
(mixed toward background/foreground), and the document's base \`font-family\`
(mirrored from \`fontUi\` — the deploy already stamps
\`body { font-family: var(--font-sans) }\`, so the token is the effective
channel there; the mirror covers surfaces the stamp never reached).
Derivations, not fields: do not write them into the record.

## Presets

Picking a preset on the theme editor fills every field and Save writes the
record. Studio is also the floor.

| field | studio | press | night |
|---|---|---|---|
${presetRows}
`;
}

/**
 * The label a person reads on each preset chip — SBR-009's presets row.
 *
 * Beside the values rather than in the graph for the same reason everything else
 * here is: the row is generated from `SITE_THEME_PRESETS`, so a fourth preset is
 * one entry in two objects and the screen grows a chip on the next regeneration.
 */
export const SITE_THEME_PRESET_LABELS: Record<keyof typeof SITE_THEME_PRESETS, string> = {
  studio: 'Studio',
  press: 'Press',
  night: 'Night'
};

/**
 * The theme applier, as one script — SBR-009 §4's trap, paid rather than
 * repeated.
 *
 * 🔴 **Two graphs run this and there is one copy of it.** The public site's
 * `applyTheme` (`sb006Components.ts`) has always written the record onto
 * `document.documentElement`; SBR-009 AC1 asks the **admin panel** to wear the
 * same theme, and `/Admin/Shell` is where every admin screen would get it. A
 * second hand-written applier beside the first is the second-copy-of-a-palette
 * trap wearing an admin costume — the derivations below (`--primary-hover`,
 * `--ring`, `--accent-foreground`, `--surface-raised`, the two border steps and
 * the mirrored base family) are exactly the values that would drift first,
 * because nobody edits two appliers on the same day.
 *
 * The body is byte-identical to what SB-006 shipped: this function was extracted
 * from that node, not rewritten, and `sb007Template.test.ts`'s byte-identity arm
 * is what proves the extraction changed nothing.
 *
 * 🔴 Guarded for a server render — this bundle is the one most likely to be
 * deployed SSR/SSG, and `document` does not exist there.
 */
export function buildThemeApplierScript(): string {
  return [
    "if (typeof document === 'undefined') return;",
    'const rows = Inputs.rows || [];',
    'const first = rows[0] ? rows[0].data || rows[0] : {};',
    'const t = first.tokens || {};',
    'const root = document.documentElement;',
    'if (t.colorPrimary) {',
    "  root.style.setProperty('--primary', t.colorPrimary);",
    "  root.style.setProperty('--primary-hover', 'color-mix(in srgb, ' + t.colorPrimary + ' 82%, black)');",
    "  root.style.setProperty('--ring', t.colorPrimary);",
    "  root.style.setProperty('--accent-foreground', t.colorPrimary);",
    '}',
    "if (t.colorOnPrimary) root.style.setProperty('--primary-foreground', t.colorOnPrimary);",
    "if (t.colorBackground) root.style.setProperty('--background', t.colorBackground);",
    'if (t.colorSurface) {',
    "  root.style.setProperty('--surface', t.colorSurface);",
    "  root.style.setProperty('--surface-raised', t.colorSurface);",
    '}',
    "if (t.colorText) root.style.setProperty('--foreground', t.colorText);",
    "if (t.colorTextSoft) root.style.setProperty('--muted-foreground', t.colorTextSoft);",
    'if (t.colorBorder) {',
    "  root.style.setProperty('--border', t.colorBorder);",
    "  root.style.setProperty('--border-subtle', 'color-mix(in srgb, ' + t.colorBorder + ' 45%, var(--background))');",
    "  root.style.setProperty('--border-strong', 'color-mix(in srgb, ' + t.colorBorder + ' 65%, var(--foreground))');",
    '}',
    "if (t.colorAccentSoft) root.style.setProperty('--accent', t.colorAccentSoft);",
    "if (t.radius) root.style.setProperty('--radius-md', t.radius);",
    "if (t.fontDisplay) root.style.setProperty('--font-serif', t.fontDisplay);",
    'if (t.fontUi) {',
    "  root.style.setProperty('--font-sans', t.fontUi);",
    '  root.style.fontFamily = t.fontUi;',
    '}',
    "if (t.measure) root.style.setProperty('--site-measure', t.measure);"
  ].join('\n');
}
