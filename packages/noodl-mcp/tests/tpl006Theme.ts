/**
 * TPL-006 — the look of the story engine, and nothing else.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## The palette is an argument about what this template is
 *
 * The shelf is green (members' area), blue (site builder), rust (landing pages)
 * and ink-on-mint (the pixel dungeon). This one is **paper**: a warm off-white
 * ground, ink text, one brass accent and a serif for the prose.
 *
 * 🔴 **That is not decoration, it is the pitch.** TPL-006's claim is *the writing
 * is the product* (§1 of the task). A reader who lands on a dark arcade ground
 * has been told they are playing a game; a reader who lands on paper has been
 * told they are reading, and the first thing they do is read. The dungeon
 * deliberately went the other way for the same kind of reason, and the two
 * templates sitting next to each other is the shelf saying the product does both.
 *
 * 🔴 **None of the five shipped presets is paper** (`minimal`, `modern`,
 * `enterprise`, `soft`, `playful`), so this does what `tpl003Theme.ts` and
 * `tpl005Theme.ts` did: start from **`minimal`** — the one `tpl001Theme.ts`
 * measured as passing WCAG AA on its own primary button (17.72, where three of
 * the five fail) — and override the grounds.
 *
 * ⚠️ **Overriding a ground invalidates every ratio the preset was measured at**,
 * so all **eighteen** pairs this template actually draws were computed, and
 * `tpl006Template.test.ts` recomputes them from these very tokens. A palette edit
 * that breaks one reddens the gate rather than shipping.
 *
 * | pair | ratio | floor |
 * |---|---|---|
 * | `--primary-foreground` on `--primary` | **6.23** | 4.5 |
 * | `--primary` as text on `--background` | **6.17** | 4.5 |
 * | `--primary` as text on `--surface` | **5.71** | 4.5 |
 * | `--primary` as text on `--surface-raised` | **5.18** | 4.5 |
 * | `--foreground` on `--background` | **15.77** | 4.5 |
 * | `--foreground` on `--surface` | **14.59** | 4.5 |
 * | `--foreground` on `--surface-raised` | **13.23** | 4.5 |
 * | `--muted-foreground` on `--background` | **6.56** | 4.5 |
 * | `--muted-foreground` on `--surface` | **6.07** | 4.5 |
 * | `--muted-foreground` on `--surface-raised` | **5.51** | 4.5 |
 * | `--accent-foreground` on `--accent` | **7.06** | 4.5 |
 * | `--accent-foreground` on `--background` | **8.21** | 4.5 |
 * | `--secondary-foreground` on `--secondary` | **13.23** | 4.5 |
 * | `--border-control` on `--background` | **3.80** | 3.0 |
 * | `--border-control` on `--surface` | **3.51** | 3.0 |
 * | `--destructive` as text on `--background` | **7.48** | 4.5 |
 * | `--destructive` as text on `--surface` | **6.92** | 4.5 |
 * | `--destructive-foreground` on `--destructive` | **7.55** | 4.5 |
 *
 * ## The three colours that mean something
 *
 * A reader has to be able to tell the three kinds of thing apart at a glance,
 * because the whole interaction is *choose one of these*:
 *
 * - **`--primary` (brass)** is *a choice you can take* — the lamplight the story
 *   is about, and the only colour on the page that is also a cursor.
 * - **`--accent-foreground` (deep teal)** is *what you carry* — cool against the
 *   brass so the inventory never reads as another choice.
 * - **`--destructive` (deep red)** is *something is wrong with the data* — a
 *   `goto` with no passage behind it, or JSON that will not parse. It appears
 *   nowhere else, so seeing it means "you have a typo", never "you lost".
 *
 * 🔴 **Nothing else is allowed to be brass.** A heading in the accent colour is a
 * heading a reader tries to click.
 *
 * ## 🔴 The serif is load-bearing and it is ONE token
 *
 * `--font-serif` is set here and used on exactly two nodes (the passage title and
 * the passage prose). Everything else is `--font-sans` from the project body, per
 * the design doctrine's *"never set fontFamily on ordinary text"*. A story engine
 * whose prose is set in the UI font looks like a form; a project that sets
 * `fontFamily` on forty nodes has no type system left.
 *
 * ⚠️ **`--font-serif` is a real token name, not one invented here** — the site
 * builder's theme writer sets it (`site-builder.content.json`, `t.fontDisplay →
 * --font-serif`), so a project that later grows a theme editor already knows the
 * name.
 *
 * @module noodl-mcp/tests/tpl006Theme
 */
import { buildStyleVocabulary, getPreset } from '../src/editor-deps';

/** The shipped preset this template starts from — the one measured as passing. */
export const TPL006_PRESET = 'minimal';

/**
 * The three colours that carry meaning, spelled once.
 *
 * 🔴 Exported because `tpl006Components.ts` sets them through these names and
 * `tpl006Template.test.ts` asserts the page draws exactly these three roles. A
 * fourth meaning added without a fourth entry here is a page that no longer
 * explains itself.
 */
export const MEANING = {
  /** A choice you can take. */
  choice: 'var(--primary)',
  /** Something you are carrying. */
  carried: 'var(--accent-foreground)',
  /** Something is wrong with the story data — never "you lost". */
  broken: 'var(--destructive)'
} as const;

/**
 * Token overrides on top of the preset. Every ratio is in the header, and the
 * gate recomputes all eighteen.
 */
export const TPL006_TOKENS: ReadonlyArray<{ name: string; value: string }> = [
  // Grounds — warm paper, not grey. #fff is a form; #fbf8f3 is a page.
  { name: '--background', value: '#fbf8f3' },
  { name: '--foreground', value: '#221d18' },
  { name: '--surface', value: '#f4efe6' },
  { name: '--surface-raised', value: '#ece4d6' },
  { name: '--muted', value: '#f4efe6' },
  { name: '--muted-foreground', value: '#635848' },
  // Primary — brass. A choice you can take.
  { name: '--primary', value: '#8a4f16' },
  { name: '--primary-hover', value: '#6f3f10' },
  { name: '--primary-foreground', value: '#fdf9f2' },
  { name: '--ring', value: '#8a4f16' },
  // Destructive — deep red. Your data is wrong, and that is the only thing it means.
  { name: '--destructive', value: '#9b2226' },
  { name: '--destructive-foreground', value: '#fdf9f2' },
  // Secondary — the quiet surface a panel sits on.
  { name: '--secondary', value: '#ece4d6' },
  { name: '--secondary-hover', value: '#e2d8c6' },
  { name: '--secondary-foreground', value: '#221d18' },
  // Accent — deep teal. What you carry, and cool against the brass on purpose.
  { name: '--accent', value: '#dfeae5' },
  { name: '--accent-foreground', value: '#1d5448' },
  // Borders — on paper a hairline is warm and darker than the ground.
  { name: '--border', value: '#e0d7c8' },
  { name: '--border-subtle', value: '#ece4d6' },
  { name: '--border-strong', value: '#c9bca6' },
  { name: '--border-control', value: '#8a7d69' },
  // Radius — a book is square. Anything rounder reads as an app chrome card.
  { name: '--radius-sm', value: '3px' },
  { name: '--radius-md', value: '5px' },
  { name: '--radius-lg', value: '8px' },
  { name: '--radius-xl', value: '10px' },
  { name: '--radius-2xl', value: '14px' },
  { name: '--radius-3xl', value: '18px' },
  // Type. Inter ships in every project as `noodl_modules/inter`.
  { name: '--font-sans', value: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif' },
  // 🔴 The prose face, and the only reason this template sets a font anywhere.
  {
    name: '--font-serif',
    value: 'Iowan Old Style, "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif'
  }
];

// ── The product's own compositions, looked up by id ──────────────────────────

export const VOCABULARY = buildStyleVocabulary({ getMetaData: () => undefined });

const requested = new Set<string>();

/** Every composition id this template actually asked for — recorded, not listed. */
export function requestedCompositions(): string[] {
  return [...requested].sort();
}

/**
 * One composition's parameters, by id. Throws on an unknown id naming the ones
 * that exist, so a renamed composition reddens the generator instead of styling
 * nothing.
 *
 * ⚠️ Its own `requested` set, for the reason `tpl003Theme.ts` gives: sharing one
 * would add this template's requests to another's census whenever both fixtures
 * load in the same process, and that gate would go red about a template it does
 * not grade.
 */
export function composition(id: string): Record<string, unknown> {
  requested.add(id);
  const found = (VOCABULARY.compositions as Array<{ id: string; parameters: Record<string, unknown> }>).find(
    (c) => c.id === id
  );
  if (!found) {
    const known = (VOCABULARY.compositions as Array<{ id: string }>).map((c) => c.id).join(', ');
    throw new Error(`No style composition "${id}". The vocabulary has: ${known}`);
  }
  return { ...found.parameters };
}

/**
 * Every composition id the template uses — asserted against
 * `requestedCompositions()`, so a rename, a dropped use, or a new one nobody
 * wrote down all redden.
 *
 * ⚠️ **Written from the build and then checked, in that order.** TPL-005 wrote
 * this list as a wishlist of eighteen and used eight; the gate caught it. This
 * one was emptied and refilled from the failure message, which is the only way
 * the list is a record rather than an intention.
 */
export const USED_COMPOSITIONS = [
  'band',
  'body',
  'displayHeadline',
  'eyebrow',
  'fieldError',
  'lead',
  'meta',
  'outlineButton',
  'primaryButton',
  'sectionHeading',
  'shell'
] as const;

/** The preset's overrides plus this template's, in the order the door is given them. */
export function tpl006TokenEntries(): Array<{ name: string; value: string }> {
  const preset = getPreset(TPL006_PRESET);
  if (!preset) throw new Error(`No style preset "${TPL006_PRESET}"`);
  return [...Object.entries(preset.tokens).map(([name, value]) => ({ name, value })), ...TPL006_TOKENS];
}
