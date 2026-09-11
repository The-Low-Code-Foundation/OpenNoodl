/**
 * VIB-006 — the worked page, rendered.
 *
 * 🔴 **A harness, not a gate** (README §3, and VIB-001/002/003/004 before it). Its output is PNGs and
 * its close condition is a person LOOKING at them. It asserts only the things that would make a
 * picture dishonest — a section that silently did not render, a glyph that could not have drawn, a
 * photograph pointing at a file that is not on disk.
 *
 * ⚠️ **No suite runs it.** The `.look.ts` suffix is outside `jest.config.js`'s `testMatch`. Run it:
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib006-landing.look.ts
 *
 * ## What the assertions are for, one by one
 *
 * `sectionCount` is VIB-004's `bandCount` lesson carried forward: VIB-003's builder lost an entire
 * band and every gate stayed green because the section HEADING still had its words — `textChars` was
 * 606 and `unreachablePx` was 0. Here the page is nine nodes, so the count is cheap and exact.
 *
 * 🔴 `everyPictureExists` is the assertion this task needed that no earlier one did. This page
 * references **seven** photographs by path. A `src` pointing at a file that is not in `STARTER_ASSETS`
 * renders as nothing — an `Image` with a broken src still takes its box in layout, so the page keeps
 * its shape and loses its subject, which is exactly the failure mode a screenshot at 988×313 will not
 * make obvious. The check resolves every referenced path against the shipped asset list, so a typo in
 * a filename is a red test rather than a quietly worse photograph.
 */
import { judge, today } from './helpers/judge';

import { STARTER_ASSETS } from '../../noodl-editor/src/editor/src/models/template/starterAssetList';

import * as fs from 'fs';
import * as path from 'path';

jest.setTimeout(1800000);

const REPO = path.join(__dirname, '..', '..', '..');
const PROJECT_DIR = path.join(REPO, 'dev-docs', 'tasks', 'phase-81-the-look-is-the-product', 'demo', 'vib-006-landing');
const DATE = today();

type Node = { id: string; type: string; parent?: string; children?: string[]; parameters?: Record<string, unknown> };

function nodesOf(compPath: string): Node[] {
  return JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'components', compPath, 'nodes.json'), 'utf-8')).nodes ?? [];
}

/** Every node of every component, so a sweep can be about the whole artefact. */
function allNodes(): Node[] {
  const out: Node[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'nodes.json') out.push(...(JSON.parse(fs.readFileSync(full, 'utf-8')).nodes ?? []));
    }
  };
  walk(path.join(PROJECT_DIR, 'components'));
  return out;
}

describe('VIB-006 — a complete landing page, from the example corpus', () => {
  it('is a page of section instances, not a graph of nodes', () => {
    const page = nodesOf('Pages/Home');
    const root = page.find((n) => n.type === 'Page');
    expect(root).toBeDefined();
    expect(root!.children).toHaveLength(8);

    // 🔴 Doctrine §0, and `oversized-page`'s own threshold. The first build of the example put all
    // eight bands directly on the Page and the gate answered "this page's own graph is 90 nodes …
    // above about 40 a page has usually inlined sections that wanted to be components of their own".
    // It is an INFO, so it did not fail the run — and it was right.
    expect(page.length).toBeLessThanOrEqual(12);
    for (const id of root!.children!) {
      const child = page.find((n) => n.id === id);
      expect(child?.type).toMatch(/^\/Sections\//);
    }
  });

  it('grounds every band differently — the tell the baseline fired on nine times out of nine', () => {
    // "One narrow centred column of stacked text, one background colour end to end" is the first
    // WordPress-starter tell in README §2. The predicate is the set of DISTINCT grounds across the
    // eight section roots, counting a gradient and an image as grounds of their own.
    const grounds = new Set<string>();
    for (const [, comp] of Object.entries({
      hero: 'Sections/Hero',
      strip: 'Sections/TrustStrip',
      story: 'Sections/HowItWorks',
      boxes: 'Sections/Boxes',
      stats: 'Sections/Numbers',
      quotes: 'Sections/Testimonials',
      cta: 'Sections/ClosingCta',
      footer: 'Sections/SiteFooter'
    })) {
      const root = nodesOf(comp).find((n) => !n.parent)!;
      const p = root.parameters ?? {};
      grounds.add(
        [p.backgroundImage, p.backgroundGradient, p.backgroundColor].filter(Boolean).join(' + ') || '(page background)'
      );
    }
    expect(grounds.size).toBeGreaterThanOrEqual(6);
  });

  it('points every picture at a file that actually ships', () => {
    const shipped = new Set(STARTER_ASSETS.map((a) => a.to));

    // 🔴 **The first version of this listed the port names** — `src`, `backgroundImage`, `image` —
    // and read **6** distinct pictures when the page carries 8. It missed both avatars that arrive
    // through `QuoteCard`'s `avatar` instance parameter, and would have missed any future one. An
    // enumerated port list is a claim about which ports exist; the honest predicate is *any parameter
    // whose value is a path into the installed modules*, which is what the runtime resolves.
    // Caught only because the cardinality assertion below was written before the number was known.
    const referenced = allNodes()
      .flatMap((n) => Object.values(n.parameters ?? {}))
      .filter((v): v is string => typeof v === 'string' && v.startsWith('noodl_modules/'));

    // 🔴 An absence needs a known-firing signal beside it, or "nothing missing" and "nothing
    // referenced" are the same reading. Eight distinct photographs are on this page: the hero
    // ground, the story photograph, three box cards and three different faces.
    expect(new Set(referenced).size).toBe(8);
    expect(referenced.filter((r) => !shipped.has(r))).toEqual([]);
  });

  it('carries drawable glyph values, complete with the field that is not optional', () => {
    const icons = allNodes()
      .map((n) => n.parameters?.iconIconSource)
      .filter(Boolean) as Record<string, unknown>[];
    expect(icons.length).toBeGreaterThanOrEqual(5);
    for (const icon of icons) {
      expect(typeof icon.class).toBe('string');
      expect(typeof icon.code).toBe('string');
      // Register V20: `IconGlyph` branches on `codeAsClass === true`; for Lucide anything else
      // renders the glyph's NAME as visible text and passes every gate in the product.
      expect(icon.codeAsClass).toBe(true);
    }
    // Register V21: `addIconInputs` defaults `iconColor` to #FFFFFF, so a complete, correct,
    // drawable value renders white on a white page and produces nothing visible.
    for (const n of allNodes()) {
      if (n.parameters?.iconIconSource) expect(typeof n.parameters.iconColor).toBe('string');
    }
  });

  it('declares every port its instances set — register V22', () => {
    // 14 shipped examples carry a `Component Inputs` with NO ports array and connections out of it,
    // and `catalog:examples` runs them 66/66 strict. An undeclared port is a parameter silently
    // discarded at the instance, which renders as the component's own placeholder words.
    for (const comp of ['Components/FeatureItem', 'Components/BoxCard', 'Components/StatTile', 'Components/QuoteCard', 'Components/FooterColumn']) {
      const inputs = nodesOf(comp).find((n) => n.type === 'Component Inputs') as unknown as { ports?: { name: string; plug: string }[] };
      expect(inputs).toBeDefined();
      expect(inputs.ports?.length).toBeGreaterThan(0);
      for (const port of inputs.ports!) expect(port.plug).toBe('output');
    }
  });

  it('photographs the page at all four widths, with the starter assets the editor installs', async () => {
    const run = await judge({
      task: 'vib-006',
      subject: 'landing',
      state: 'door',
      projectDir: PROJECT_DIR,
      date: DATE,
      pages: [{ label: 'landing', url: '/', as: 'the worked page from the example corpus — eight bands, nobody signed in' }]
    });

    // The instrument's own honesty check (register V19): a run where the assets failed to arrive
    // photographs a page of blank spans that still take their size, and looks like an authoring bug.
    expect(run.starterAssets.failed).toEqual([]);
    expect(run.starterAssets.written).toContain('noodl_modules/lucide-icons/styles.css');
    expect(run.starterAssets.written).toContain('noodl_modules/starter-imagery/texture-soil.webp');

    expect(run.shots.length).toBe(4);
    for (const shot of run.shots) expect(shot.textChars).toBeGreaterThan(800);

    // eslint-disable-next-line no-console
    console.log('VIB-006 LANDING MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
    // eslint-disable-next-line no-console
    for (const s of run.shots) {
      console.log(
        `  ${s.viewport.id.padEnd(8)} ${String(s.viewport.width).padStart(4)}x${String(s.viewport.height).padStart(4)} ` +
          `contentBottom=${s.contentBottom} canScroll=${s.canScroll} unreachablePx=${s.unreachablePx} textChars=${s.textChars}`
      );
    }
  });
});
