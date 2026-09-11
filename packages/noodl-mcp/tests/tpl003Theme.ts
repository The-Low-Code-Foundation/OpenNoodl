/**
 * TPL-003 — the look of the landing pages, and nothing else.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## Why this is a file of its own
 *
 * `tpl001Theme.ts` exists because the first template *"drove straight past"*
 * the design system the product ships. This one is written after that lesson,
 * so it does not repeat the argument — it repeats the mechanism: a shipped
 * preset first, this template's own tokens merged on top, and **every
 * parameter set looked up from `buildStyleVocabulary()`** rather than typed. A
 * typed copy agrees with the product until the first change to either;
 * `composition()` throws on an unknown id, so a renamed composition reddens the
 * generator instead of shipping the old parameters.
 *
 * ⚠️ **Its own `composition()` and its own `requested` set, on purpose.**
 * `tpl001Theme.ts` records every id asked for in a module-level set and
 * `tpl001Template.test.ts` §4 asserts that set equals `USED_COMPOSITIONS`.
 * Importing that function here would add this template's requests to the
 * members' area's census whenever both fixtures load in one process, and the
 * gate over there would go red about a template it does not grade.
 *
 * ## The palette, and why it is not the other two
 *
 * The shelf has one green row (members' area) and one blue row (site builder).
 * A small business or a freelancer is neither civic nor corporate, so the base
 * is **Minimal** — near-black type, no shadow — warmed: paper rather than white,
 * and a rust primary that is a colour a person would choose rather than a
 * default.
 *
 * 🔴 **Minimal, and not Modern, for the reason `tpl001Theme.ts` measured:**
 * three of the five presets fail WCAG AA on their own primary button, Modern
 * among them. Minimal (17.72) passes, and this template's overrides are all
 * measured against its own grounds:
 *
 * | pair | ratio | floor |
 * |---|---|---|
 * | `--primary-foreground` (#fff) on `--primary` | **7.86** | 4.5 |
 * | `--primary` as text on `--background` | **7.61** | 4.5 |
 * | `--primary` as text on `--surface` | **7.04** | 4.5 |
 * | `--foreground` on `--background` | **16.68** | 4.5 |
 * | `--muted-foreground` on `--surface` | **6.56** | 4.5 |
 * | `--accent-foreground` on `--accent` | **6.49** | 4.5 |
 * | `--border-control` on `--background` | **5.77** | 3.0 |
 *
 * `--border` is a hairline and carries no minimum; a control's edge uses
 * `--border-control`, which is what `textField` and `outlineButton` already do.
 *
 * ⚠️ **No gradient token is overridden.** `DefaultTokens.ts` writes every
 * gradient in terms of `--primary`, `--primary-hover` and `--foreground`, so
 * the hero grounds re-theme to rust and ink without this file knowing gradients
 * exist — which is the whole point of that design, and the reason a rust
 * `--gradient-brand` typed here would be a second copy of the brand colour.
 *
 * @module noodl-mcp/tests/tpl003Theme
 */
import { buildStyleVocabulary, getPreset } from '../src/editor-deps';

/** The shipped preset this template starts from. */
export const TPL003_PRESET = 'minimal';

/** Token overrides on top of the preset. Contrast is in the header. */
export const TPL003_TOKENS: ReadonlyArray<{ name: string; value: string }> = [
  // Primary — rust. Warm, and distinct on a shelf whose rows are green and blue.
  { name: '--primary', value: '#8f3416' },
  { name: '--primary-hover', value: '#742a11' },
  { name: '--primary-foreground', value: '#ffffff' },
  { name: '--ring', value: '#8f3416' },
  // Secondary — a warm charcoal for anything that is not the one action.
  { name: '--secondary', value: '#3d3733' },
  { name: '--secondary-hover', value: '#2b2724' },
  { name: '--secondary-foreground', value: '#ffffff' },
  // Accent — the primary at a whisper, for badges and the step numbers.
  { name: '--accent', value: '#f7e6df' },
  { name: '--accent-foreground', value: '#8f3416' },
  // Surfaces — paper, not white. A card on paper reads as raised; on white it
  // reads as a border somebody drew.
  { name: '--background', value: '#fdfbf7' },
  { name: '--foreground', value: '#1f1a17' },
  { name: '--surface', value: '#f6f2ea' },
  { name: '--surface-raised', value: '#ffffff' },
  { name: '--muted', value: '#f1ece3' },
  { name: '--muted-foreground', value: '#5c554f' },
  // Borders — a hairline for dividers, a darker one for control edges.
  { name: '--border', value: '#e6dfd3' },
  { name: '--border-subtle', value: '#efe9df' },
  { name: '--border-strong', value: '#cfc5b5' },
  { name: '--border-control', value: '#6b625b' },
  // Radius — rounder than Minimal's 4–8, which reads as a spreadsheet, and not
  // Soft's 28, which reads as a toy.
  { name: '--radius-sm', value: '6px' },
  { name: '--radius-md', value: '10px' },
  { name: '--radius-lg', value: '14px' },
  { name: '--radius-xl', value: '20px' },
  { name: '--radius-2xl', value: '24px' },
  { name: '--radius-3xl', value: '28px' },
  // Type — Inter ships in every project as `noodl_modules/inter`; Minimal's
  // system-ui is a different face on every machine the site is opened on.
  { name: '--font-sans', value: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif' }
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
 * that exist, so a renamed composition reddens rather than styling nothing.
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
 * Every composition id the template uses — asserted by `tpl003Template.test.ts`
 * against `requestedCompositions()`, so a rename, a dropped use or a new one
 * nobody wrote down all redden.
 */
export const USED_COMPOSITIONS = [
  // Grounds
  'band',
  'bandSurface',
  'shell',
  'heroGround',
  'imageGround',
  'ctaBand',
  'footerBand',
  // Objects
  'card',
  'cardBody',
  'cardImage',
  'glassPanel',
  'badge',
  'testimonialCard',
  'featureItem',
  'ruled',
  'sectionHead',
  'actionRow',
  // Arrangements
  'gridAutoFit',
  'columnsTwoUp',
  // Controls
  'primaryButton',
  'outlineButton',
  'textField',
  'field',
  // Type
  'displayHeadline',
  'sectionHeading',
  'cardTitle',
  'eyebrow',
  'lead',
  'body',
  'meta',
  'fieldLabel',
  'fieldHint'
] as const;

/**
 * The preset's overrides plus this template's, in the order the door is given
 * them. Exported so the gate can assert the artefact carries exactly this.
 */
export function tpl003TokenEntries(): Array<{ name: string; value: string }> {
  const preset = getPreset(TPL003_PRESET);
  if (!preset) throw new Error(`No style preset "${TPL003_PRESET}"`);
  return [...Object.entries(preset.tokens).map(([name, value]) => ({ name, value })), ...TPL003_TOKENS];
}
