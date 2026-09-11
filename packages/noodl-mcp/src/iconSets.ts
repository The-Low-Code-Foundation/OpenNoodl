/**
 * VIB-003 — **what an authoring model is told about icons**, which until now was nothing.
 *
 * ## The defect this answers, measured at the door
 *
 * `packages/noodl-mcp/src` contained **two** occurrences of the word "icon", both incidental.
 * `get_style_vocabulary` — the surface whose whole job is *"this project's design system… what to
 * reach for"* — named no icon set, no glyph and no value shape, and its `media` category held one
 * entry. All three `net.noodl.visual.icon` nodes in the 64-example corpus set no glyph at all.
 *
 * The only thing an authoring model could read was the port's own description, *"the glyph, picked
 * from the project's enabled icon fonts; stored as class + code"*, and the authoring gate's hint,
 * `{"class":"material-icons","code":"search"}`. **Both lead to a value that does not draw**, for two
 * separate reasons:
 *
 * 1. `material-icons` is a library module a person adds. Every project created here gets `inter`
 *    and `lucide-icons` from `STARTER_ASSETS`, and nothing else.
 * 2. 🔴 **`{class, code}` alone renders the glyph's NAME as visible text.** Lucide's manifest is
 *    `codeAsClass: true`, and `IconGlyph.tsx` branches on exactly that field: true puts the code
 *    among the element's classes, anything else puts it in the element's *text*. So
 *    `{class: "lucide", code: "icon-check"}` renders the string `icon-check`, set in the Lucide
 *    webfont. The third field is what makes it a glyph, and it was named nowhere readable.
 *
 * ## Why this reads the project rather than hard-coding Lucide
 *
 * Because the answer is a property of the project on disk, not of the product. A project that has
 * installed `material-icons` should be told about `material-icons`; one carrying a sprite set gets
 * a `{kind, url, symbolId}` value with no `class` in it at all. A door that answered "lucide,
 * always" would be right for a new project and confidently wrong for an extended one — which is
 * the same failure as the hint it replaces, one install later.
 *
 * 🔴 **The advertised value is built by `iconValueForGlyph`, never assembled here.** That function
 * is where the picker builds the value it stores, and FB-019 (P75) settled why nothing else may:
 * two of its three fields come from the set's manifest, and the shipped conventions want opposite
 * ones, so anything that guesses *"renders a blank glyph again, having reported success"*. If this
 * module composed its own literal, the door and the picker would be two functions that agree until
 * somebody installs a set with the other `codeAsClass`.
 *
 * @module noodl-mcp/iconSets
 */

import { iconValueForGlyph, scanModuleManifestsSync, toIconSets, type IconSetDescriptor } from './editor-deps';

/** One installed set, as the door reports it. */
export interface IconSetReport {
  /** Directory name under `noodl_modules/` — the set's identity. */
  moduleName: string;
  /** Display name from the manifest. */
  name: string;
  kind: 'font' | 'sprite';
  /**
   * A complete, copyable parameter value for {@link IconSetReport.sampleGlyph}, built by the same
   * function the editor's picker uses.
   *
   * 🔴 This exists because a *description* of the shape is what produced the defect. "class + code"
   * is a true description of two of the three fields, and the missing one is the difference between
   * a glyph and the glyph's name in 24px type. A worked literal cannot be read as two-thirds of
   * itself.
   */
  valueShape: unknown;
  /** The glyph {@link IconSetReport.valueShape} was built from. */
  sampleGlyph: string;
  /**
   * Glyph names to pick from — **capped, and the cap is stated**, see {@link GLYPH_SAMPLE}.
   */
  glyphs: string[];
  /** How many the set actually declares. Equal to `glyphs.length` when nothing was dropped. */
  glyphsTotal: number;
  /** Anything wrong with the set, from the editor's own reader. Never silent. */
  warnings: string[];
}

// ⚠️ Deliberately NOT reported: the manifest's `_note`. Lucide's is genuinely useful — the bundled
// font carries all 1998 glyphs and the stylesheet has a rule for each, so the curated 212 is a
// starting list rather than a ceiling. But `toIconSets` discards it, and reaching around the
// editor's reader to pick one field back out would make this module a second, partial manifest
// parser. The fact belongs where an author reads prose, so it is in the design doctrine
// (`prompts/design.ts` §5) instead.

/**
 * How many glyph names a set reports.
 *
 * 🔴 **A cap, because this response is billed, and it is STATED rather than silent.** Lucide's
 * curated manifest lists 212 names; carrying all of them pushed `get_style_vocabulary` past both of
 * its wire budgets (prompt 3,201 against 3,000; full 11,723 against 11,000) — for a list a model
 * reads to pick three glyphs from.
 *
 * ⚠️ The reason a sample is *sufficient* rather than merely cheaper is specific to how these sets
 * work, and would not hold for an arbitrary one: the value shape is what a model cannot guess, and
 * that is reported in full. A name it can — the bundled Lucide font carries all 1,998 glyphs and its
 * stylesheet has a rule for every one, so any name from lucide.dev works. `glyphsTotal` and the
 * rendered "… and N more" line are what stop this reading as "these are the glyphs there are".
 */
const GLYPH_SAMPLE = 36;

/**
 * The icon sets installed in a project, or an empty list.
 *
 * ⚠️ **Empty is a real answer and must not be dressed up.** A project with no `noodl_modules/` has
 * no icon set, and every `Icon` node in it will draw nothing whatever it is given. Reporting a
 * plausible default here would be the `material-icons` hint's mistake with a better excuse.
 */
export function readIconSets(projectDir: string | undefined): IconSetReport[] {
  if (!projectDir) return [];

  let sets: IconSetDescriptor[];
  try {
    sets = toIconSets(scanModuleManifestsSync(projectDir));
  } catch {
    // A malformed manifest is the scanner's to warn about; a door that threw here would take
    // the whole style vocabulary down over one bad module directory.
    return [];
  }

  return sets.map((set) => {
    const sampleGlyph = set.icons[0] ?? '';
    const report: IconSetReport = {
      moduleName: set.moduleName,
      name: set.name,
      kind: set.kind,
      valueShape: sampleGlyph ? iconValueForGlyph(set, sampleGlyph) : null,
      sampleGlyph,
      glyphs: set.icons.slice(0, GLYPH_SAMPLE),
      glyphsTotal: set.icons.length,
      warnings: set.warnings
    };
    return report;
  });
}

/**
 * The icon block of the compact prompt rendering.
 *
 * Empty string when there is nothing installed — the caller concatenates, and a heading over a
 * blank list teaches an author that icons are available here when they are not.
 */
export function renderIconSets(sets: readonly IconSetReport[]): string {
  if (sets.length === 0) {
    return (
      'ICON SETS — none installed in this project. `Icon` nodes will draw nothing until a set is ' +
      'added under noodl_modules/. Do not invent a value for iconIconSource.'
    );
  }

  const lines: string[] = [
    'ICON SETS — set `iconIconSource` to a value of EXACTLY the shape below, copied field for ' +
      'field with only the glyph name changed. A value missing a field renders the glyph NAME as ' +
      'visible text, not the glyph.'
  ];

  for (const set of sets) {
    lines.push(
      `- ${set.name} (${set.moduleName}, ${set.kind}): iconIconSource=${JSON.stringify(set.valueShape)}`
    );
    const more = set.glyphsTotal - set.glyphs.length;
    lines.push(
      `    glyphs: ${set.glyphs.join(', ')}` +
        (more > 0 ? ` … and ${more} more in noodl_modules/${set.moduleName}/manifest.json` : '')
    );
    for (const warning of set.warnings) lines.push(`    ⚠️ ${warning}`);
  }

  return lines.join('\n');
}
