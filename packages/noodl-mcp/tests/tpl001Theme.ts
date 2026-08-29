/**
 * TPL-001 — the look, and the only reason the members' area has one.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ## The defect this module exists to end
 *
 * Richard drove the template on 2026-08-28: *"it's so basic, black and white,
 * everything left aligned in one column, it doesn't even look like a website."*
 * Measured on the artefact he drove: **137 visual nodes, 0 colour parameters, 0
 * type-ramp parameters, 0 constrained widths, no token block at all** — and 125
 * style parameters that were, every one of them, layout plumbing.
 *
 * 🔴 **NodeGX already ships the entire design system and the generator drove
 * straight past it.** Five style presets, semantic tokens by category, legal
 * variants per element and eighteen named compositions, all reported by
 * `get_style_vocabulary` and all reachable through the same door this template
 * is authored through. The fix is not to design a members' area. It is to stop
 * bypassing the system the product already has.
 *
 * ## Why the compositions are LOOKED UP rather than typed
 *
 * Every parameter set below comes from `buildStyleVocabulary()` — the same
 * function `get_style_vocabulary` answers with. A typed copy would agree with
 * the product until the first change to either, and then the template would be
 * wearing a design system that no longer exists while every spec stayed green.
 * `composition()` throws on an unknown id, so a renamed composition reddens the
 * generator instead of silently shipping the old parameters.
 *
 * ## 🔴 The palette, and a product defect found by choosing it
 *
 * The base is the shipped **Enterprise** preset. That is a contrast decision,
 * not a taste one, and it is worth stating because the obvious choices are
 * broken: **three of the five presets fail WCAG AA on their own primary
 * button** — `--primary-foreground` on `--primary` measures **Modern 3.68**,
 * **Playful 4.23**, **Soft 4.47**, against the 4.5 floor for normal text. Modern
 * is the DEFAULT, so every project the wizard creates inherits it. Only Minimal
 * (17.72) and Enterprise (17.85) pass. That is a product defect, it is recorded
 * in the phase's defect log, and it is not this module's to fix.
 *
 * The overrides then take Enterprise off corporate navy, because the person
 * receiving this template runs a church, a club or a charity. Every pair below
 * is measured, and the numbers are in the comments rather than in a promise.
 *
 * @module noodl-mcp/tests/tpl001Theme
 */
import { buildStyleVocabulary, getPreset } from '../src/editor-deps';

/** The shipped preset this template starts from. See the header on why. */
export const TPL001_PRESET = 'enterprise';

/**
 * Token overrides on top of the preset — the association's own character.
 *
 * Contrast measured against `--background` `#fcfcfb` and `--surface` `#f4f6f4`:
 *
 * | pair | ratio | floor |
 * |---|---|---|
 * | `--primary-foreground` (#fff) on `--primary` | **7.55** | 4.5 |
 * | `--primary` as text on `--background` | **7.36** | 4.5 |
 * | `--foreground` on `--background` | **16.35** | 4.5 |
 * | `--muted-foreground` on `--surface` | **6.62** | 4.5 |
 * | `--accent-foreground` on `--accent` | **6.45** | 4.5 |
 * | `--border-control` on `--background` | **5.49** | 3.0 |
 *
 * ⚠️ `--border` is **1.33** and that is deliberate: it is the hairline that
 * separates a card from the page, and a decorative divider carries no minimum.
 * The token that does — the one a control's edge must use — is
 * `--border-control`, which is why the `outlineButton` composition reaches for
 * `--muted-foreground` rather than `--border` and says so in its own
 * description.
 */
export const TPL001_TOKENS: ReadonlyArray<{ name: string; value: string }> = [
  // Primary — a deep green. Civic rather than corporate, and distinct on a
  // shelf whose only other row (site-builder/Studio) is blue.
  { name: '--primary', value: '#1f5f45' },
  { name: '--primary-hover', value: '#174a35' },
  { name: '--primary-foreground', value: '#ffffff' },
  { name: '--ring', value: '#1f5f45' },
  // Accent — the primary at a whisper, for the eyebrow and the pending notice.
  { name: '--accent', value: '#e7efea' },
  { name: '--accent-foreground', value: '#1f5f45' },
  // Surfaces — warmed off the preset's pure white so cards read as raised.
  { name: '--background', value: '#fcfcfb' },
  { name: '--foreground', value: '#14201a' },
  { name: '--surface', value: '#f4f6f4' },
  { name: '--surface-raised', value: '#ffffff' },
  { name: '--muted', value: '#eef1ee' },
  { name: '--muted-foreground', value: '#4f5a54' },
  // Borders — a hairline for dividers, a darker one for control edges.
  { name: '--border', value: '#d9ded9' },
  { name: '--border-subtle', value: '#e8ebe8' },
  { name: '--border-strong', value: '#bcc5bd' },
  { name: '--border-control', value: '#5b6b62' },
  // Radius — softer than Enterprise's 4px, which reads as a bank rather than a
  // congregation. Not Soft's 12–28px, which reads as a toy.
  { name: '--radius-sm', value: '4px' },
  { name: '--radius-md', value: '8px' },
  { name: '--radius-lg', value: '10px' },
  { name: '--radius-xl', value: '14px' }
];

// ── The product's own compositions, looked up by id ──────────────────────────

const VOCABULARY = buildStyleVocabulary({ getMetaData: () => undefined });

/**
 * One composition's parameters, by id.
 *
 * 🔴 Throws on an unknown id **naming the ones that exist**. A composition set
 * that silently returned `{}` would style nothing and redden nothing, which is
 * the exact shape of the defect this file was written to end.
 */
const requested = new Set<string>();

/**
 * Every composition id this template actually asked for, as a fact rather than
 * a list somebody maintains.
 *
 * 🔴 **`USED_COMPOSITIONS` used to be maintained by hand and was wrong.** It
 * claimed in its own doc comment to be *"asserted by the gate, so a rename
 * reddens"*, and nothing anywhere read it — `grep USED_COMPOSITIONS` returned
 * the declaration and no other site. Two of its thirteen entries, `eyebrow` and
 * `sectionHead`, named compositions the template did not use at all. A list that
 * documents an enforcement that does not exist is worse than no list: it is
 * where the next person stops looking.
 */
export function requestedCompositions(): string[] {
  return [...requested].sort();
}

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
 * Every composition id the template uses.
 *
 * ✅ **Now actually asserted** — `tpl001Template.test.ts` §4 compares this list
 * against `requestedCompositions()`, which is recorded by `composition()` itself
 * rather than declared. A rename reddens, an id that stops being used reddens,
 * and a new one that nobody added here reddens.
 */
export const USED_COMPOSITIONS = [
  'shell',
  // s8. `Pages/Members`' three moderator actions reflow on a `Columns`, because
  // no Group in the runtime has a breakpoint and three buttons in a row ran off
  // the right edge at 390px. First use of an `arrangement` composition here.
  'gridAutoFit',
  'card',
  'cardBody',
  // s12 (B3). The row that is NOT a card: a hairline under it and no fill at
  // all, so a noticeboard reads as one list of eight rather than as eight
  // objects. It only exists because P80 C1 added it — of eighteen compositions
  // exactly two carried a content fill and both were `--surface`, which is why
  // every list in this template wore the same box (D26).
  'ruled',
  'sectionHead',
  'primaryButton',
  'outlineButton',
  'displayHeadline',
  'sectionHeading',
  'cardTitle',
  'eyebrow',
  'lead',
  'body',
  'meta'
] as const;

/**
 * The preset's overrides plus this template's, in the order the door is given
 * them. Exported so the gate can assert the artefact carries exactly this.
 */
export function tpl001TokenEntries(): Array<{ name: string; value: string }> {
  const preset = getPreset(TPL001_PRESET);
  if (!preset) throw new Error(`No style preset "${TPL001_PRESET}"`);
  return [...Object.entries(preset.tokens).map(([name, value]) => ({ name, value })), ...TPL001_TOKENS];
}
