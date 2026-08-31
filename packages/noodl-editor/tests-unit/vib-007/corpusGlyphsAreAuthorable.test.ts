/**
 * VIB-007 / register **V23** — a glyph the corpus teaches that the picker cannot produce.
 *
 * 🔴 **The predicate `VIB-007-THE-LOOP.md` §3 tabled — *"a glyph name absent from the installed
 * manifest"* — would have condemned the phase's only WORTHY artefact.** Measured over all 67
 * examples before anything was written: 16 glyph values, of which **7 render but are outside the
 * curated 212**, and **5 of those 7 are on `ui-landing-page`**, the VIB-006 page Richard ruled
 * *"it looks fucking pro"*. Not one corpus glyph fails to render. A check written to that sentence
 * would fire on a page a person has already ruled beautiful, for glyphs that draw perfectly — which
 * is `dead-placeholder-text` (AC3, one session earlier) a second time.
 *
 * **The two lists are not the same claim, and the manifest says so itself.** Its `_note` reads
 * *"This is a curated starter set… styles.css has a rule for every one of them, so any name from
 * lucide.dev can be added"*, and the product ships the proof: the library module's copy of this
 * manifest lists all **1998**, of which the starter's 212 is a strict subset.
 *
 *  - **absent from the STYLESHEET** → draws nothing. A defect. The corpus has **none**.
 *  - **absent from the curated MANIFEST** → renders, but the editor's picker cannot offer it, so a
 *    model copying the corpus writes a value a person cannot then find in the UI. That is V23's
 *    actual complaint, and the repair is to widen the list — not to flag the artefact.
 *
 * So V23 ships as a repair with a gate rather than as a diagnostic: three names added to the
 * curated set (212 → 215), and this spec to stop the corpus drifting off it again.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.join(__dirname, '..', '..', '..', '..');
const EXAMPLES = path.join(REPO, 'docs', 'node-catalog', 'examples');
const LUCIDE = path.join(REPO, 'packages', 'noodl-editor', 'src', 'assets', 'starter-project', 'noodl_modules', 'lucide-icons');

const manifest = (): { icons: string[]; _note?: string } =>
  JSON.parse(fs.readFileSync(path.join(LUCIDE, 'manifest.json'), 'utf-8'));

/** Every per-glyph rule in the shipped stylesheet — what actually renders. */
const stylesheetRules = (): Set<string> =>
  new Set(
    [...fs.readFileSync(path.join(LUCIDE, 'styles.css'), 'utf-8').matchAll(/\.([A-Za-z0-9_-]+)::before/g)].map(
      (m) => m[1]
    )
  );

/** Every glyph name the corpus teaches, as `file :: code`. */
function corpusGlyphs(): { where: string; code: string }[] {
  const found: { where: string; code: string }[] = [];
  for (const file of fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.json')).sort()) {
    const example = JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), 'utf-8'));
    for (const c of example.components ?? []) {
      for (const n of c.nodes ?? []) {
        for (const value of Object.values(n.parameters ?? {})) {
          // The value shape, not the parameter NAME: `iconColor` matches a name filter and is a
          // colour, and `/Components/TrustItem.icon` does not match `iconIconSource` and is a glyph.
          if (value && typeof value === 'object' && typeof (value as { code?: unknown }).code === 'string') {
            found.push({ where: `${file} :: ${c.name} :: ${n.id}`, code: (value as { code: string }).code });
          }
        }
      }
    }
  }
  return found;
}

describe('V23 — the two lists are different claims', () => {
  it('the curated manifest is a strict SUBSET of what the stylesheet renders', () => {
    const curated = manifest().icons;
    const rules = stylesheetRules();
    expect(rules.size).toBe(1998);
    expect(curated.length).toBeLessThan(rules.size);
    // 🔴 The sentence the register row got wrong, as an assertion: every curated name renders, and
    // the reverse does not hold. "Not in the manifest" is not "does not render".
    expect(curated.filter((c) => !rules.has(c))).toEqual([]);
  });

  it('says so in its own `_note`, which is where the correct repair is written down', () => {
    expect(manifest()._note).toContain('curated starter set');
    expect(manifest()._note).toContain('any name from');
  });
});

describe('V23 — the corpus, which is what a model copies', () => {
  it('teaches only glyphs that RENDER — and the population is asserted', () => {
    const glyphs = corpusGlyphs();
    // 🔴 Cardinality before the verdict: a corpus with no glyphs at all passes both arms below.
    expect(glyphs.length).toBeGreaterThanOrEqual(16);
    const rules = stylesheetRules();
    expect(glyphs.filter((g) => !rules.has(g.code))).toEqual([]);
  });

  it('teaches only glyphs the PICKER can offer — V23s complaint, as a gate', () => {
    const curated = new Set(manifest().icons);
    // Before the repair this read 7 hits across 3 names — `icon-inbox`, `icon-sprout`,
    // `icon-recycle` — five of them on the page ruled WORTHY.
    expect(corpusGlyphs().filter((g) => !curated.has(g.code))).toEqual([]);
  });

  it('the three names the repair added are the three the corpus was using', () => {
    const curated = new Set(manifest().icons);
    for (const added of ['icon-inbox', 'icon-sprout', 'icon-recycle']) {
      expect(curated.has(added)).toBe(true);
      // ⚠️ The mutation, in the only direction that matters: each added name is one the corpus
      // actually uses, so removing it from the list reddens the arm above. A name added because it
      // seemed nice would pass this file and prove nothing.
      expect(corpusGlyphs().some((g) => g.code === added)).toBe(true);
    }
  });
});
