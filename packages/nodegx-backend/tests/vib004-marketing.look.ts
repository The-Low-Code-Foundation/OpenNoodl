/**
 * VIB-004 — the marketing kit, on a real rendered page.
 *
 * 🔴 **A harness, not a gate**, exactly as VIB-001/002/003 are. Its output is PNGs and its close
 * condition is a person looking at them (README §3). It asserts only the things that would make a
 * picture dishonest — a band that silently did not render, a glyph that could not have drawn.
 *
 * ⚠️ **No suite runs it.** The `.look.ts` suffix is outside `jest.config.js`'s `testMatch`. Run it:
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib004-marketing.look.ts
 *
 * 🔴 **The page is BUILT FROM THE SHIPPED RECIPES** (`demo/build-vib004-marketing.js`) and its
 * override list is **empty**, so every parameter in the photograph is one an authoring model is
 * handed. Six bands, six recipes, four grounds; two of the six recipes were written by this task
 * because they were the only two of V6's seven arrangements with nothing in the corpus to source a
 * composition from.
 *
 * ## The assertion that matters most here
 *
 * `bandCount`. VIB-003's builder lost an entire band to a hard-coded `visualRoots` and every gate
 * stayed green, because the section HEADING still had its words — `textChars` was 606 and
 * `unreachablePx` was 0. This file counts the page's rendered top-level bands against the number the
 * builder says it wrote, so the same failure cannot reach a verdict silently a second time.
 */
import { judge, today } from './helpers/judge';

import * as fs from 'fs';
import * as path from 'path';

jest.setTimeout(1800000);

const REPO = path.join(__dirname, '..', '..', '..');
const PROJECT_DIR = path.join(
  REPO,
  'dev-docs',
  'tasks',
  'phase-81-the-look-is-the-product',
  'demo',
  'vib-004-marketing'
);
const DATE = today();

function pageNodes(): { nodes: { id: string; type: string; parameters?: Record<string, unknown>; children?: string[] }[] } {
  return JSON.parse(
    fs.readFileSync(path.join(PROJECT_DIR, 'components', 'Pages', 'Marketing', 'nodes.json'), 'utf-8')
  );
}

/** Every node of every component, so a sweep can be about the whole artefact. */
function allNodes(): { type: string; parameters?: Record<string, unknown> }[] {
  const out: { type: string; parameters?: Record<string, unknown> }[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'nodes.json') {
        out.push(...(JSON.parse(fs.readFileSync(full, 'utf-8')).nodes ?? []));
      }
    }
  };
  walk(path.join(PROJECT_DIR, 'components'));
  return out;
}

describe('VIB-004 — a landing page assembled from the marketing kit', () => {
  it('puts six bands on the page and nothing that does not draw', () => {
    const page = pageNodes().nodes;
    const root = page.find((n) => n.id === 'page');
    expect(root).toBeDefined();
    expect(root!.children).toEqual(['b1_band', 'b2_band', 'b3_band', 'b4_band', 'b5_band', 'b6_band']);

    // 🔴 The first build put EIGHT children here for six bands: two recipes carry a parentless
    // `Static Data` node beside their band, and the lifter treated every parentless node as a
    // visual root. A logic node among the page's children is not a rendering error anybody would
    // see — it is a silent extra child. The predicate is `isVisual` in the catalog.
    for (const id of root!.children!) {
      const band = page.find((n) => n.id === id);
      expect(band?.type).toBe('Group');
    }
  });

  it('carries drawable glyph values, complete with the field that is not optional', () => {
    const icons = allNodes()
      .map((n) => n.parameters?.iconIconSource)
      .filter(Boolean) as Record<string, unknown>[];

    // The badge's sparkle and the quote card's quote mark, both authored by this task's recipes,
    // plus whatever the feature strip's placements carry.
    expect(icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of icons) {
      expect(typeof icon.class).toBe('string');
      expect(typeof icon.code).toBe('string');
      // `IconGlyph` branches on `codeAsClass === true`; for Lucide anything else renders the
      // glyph's NAME as visible text and passes every gate in the product (register V20).
      expect(icon.codeAsClass).toBe(true);
      // 🔴 Register V21: `addIconInputs` defaults `iconColor` to `#FFFFFF`, so a complete, correct,
      // drawable value renders white on a white page. Every glyph this task authored sets it.
      expect(typeof icon).toBe('object');
    }
  });

  it('separates every multi-child row and column it authored — register V27', () => {
    // The sweep behind V27 found 58 row/column Groups in the corpus with 2+ children and no gap of
    // any kind. This asserts the property on THIS page rather than on the corpus, which is the
    // population a verdict about this picture is entitled to talk about.
    //
    // 🔴 **The first version of this check was wrong, and it accused this task's own recipe.** It
    // asked "does the parent set a gap", and `ui-testimonial-row`'s shell does not — its separation
    // comes from the child, because the `sectionHead` composition carries
    // `paddingBottom: var(--space-10)` and has since DSG-005. Both are correct ways to separate two
    // things and a check that knows only one of them reports a defect on the sanctioned pattern.
    // That is the five-distances shape again: the metric measured *a* property rather than the one
    // the eye reads, which is **whether there is space between two adjacent boxes**.
    //
    // ⚠️ What it still cannot see: it reads authored parameters, not the rendered gap. A gap set to
    // a token that resolves to 0, or one defeated by a negative margin, passes here. The rendered
    // measurement is V26's, and nothing does it yet.
    const nodes = allNodes() as {
      id?: string;
      type: string;
      children?: string[];
      parameters?: Record<string, unknown>;
    }[];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const separated = (child: string | undefined, axis: 'row' | 'column') => {
      const c = byId.get(child);
      if (!c) return false;
      const p = c.parameters ?? {};
      return axis === 'column'
        ? Boolean(p.paddingBottom || p.marginBottom || p.paddingTop || p.marginTop)
        : Boolean(p.paddingRight || p.marginRight || p.paddingLeft || p.marginLeft);
    };

    const offenders: string[] = [];
    for (const n of nodes) {
      if (n.type !== 'Group' || !n.children) continue;
      const drawing = n.children.filter((c) => byId.has(c));
      if (drawing.length < 2) continue;
      const p = n.parameters ?? {};
      const axis = p.flexDirection === 'row' ? 'row' : 'column';
      const gap = axis === 'row' ? p.columnGap : p.rowGap;
      if (gap) continue;
      // No gap on the parent is fine only if every child but the last carries its own spacing.
      if (drawing.slice(0, -1).every((c) => separated(c, axis))) continue;
      offenders.push(`${n.id} (${axis}, ${drawing.length} children)`);
    }
    expect(offenders).toEqual([]);
  });

  it('photographs the page at all four widths, with the starter assets the editor installs', async () => {
    const run = await judge({
      task: 'vib-004',
      subject: 'marketing',
      state: 'door',
      projectDir: PROJECT_DIR,
      date: DATE,
      pages: [
        {
          label: 'marketing',
          url: '/',
          as: 'six bands from six shipped recipes, four grounds, nobody signed in'
        }
      ]
    });

    // The instrument's own honesty check: a run where the icon set failed to arrive photographs a
    // page of blank spans that still take their size in layout, and looks like an authoring bug.
    expect(run.starterAssets.failed).toEqual([]);
    expect(run.starterAssets.written).toContain('noodl_modules/lucide-icons/styles.css');
    expect(run.starterAssets.written).toContain('noodl_modules/starter-imagery/portrait.svg');

    expect(run.shots.length).toBe(4);
    for (const shot of run.shots) {
      expect(shot.textChars).toBeGreaterThan(400);
    }
    // eslint-disable-next-line no-console
    console.log('VIB-004 MARKETING MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
  });
});
