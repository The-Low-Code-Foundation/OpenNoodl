/**
 * VIB-003 — the pictures and the glyphs, on a real rendered page.
 *
 * 🔴 **A harness, not a gate**, exactly as VIB-001 and VIB-002 are. Its output is PNGs and its
 * close condition is a person looking at them (README §3). It asserts only the things that would
 * make a picture dishonest.
 *
 * ⚠️ **No suite runs it.** The `.look.ts` suffix is outside `jest.config.js`'s `testMatch`, so it
 * can neither slow a gate down nor redden one. Run it:
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib003-pictures.look.ts
 *
 * 🔴 **The project is BUILT FROM THE SHIPPED RECIPES** (`demo/build-vib003-pictures.js`), and its
 * override list is **empty** — every glyph and every `src` in the picture came out of
 * `docs/node-catalog/examples/` unchanged. VIB-002's builder needed one override, a photograph,
 * because nothing shipped carried a picture. That this one needs none is the result.
 *
 * ## 🔴 What this file is really the tripwire for
 *
 * Until VIB-003, **no photograph the Judge took could ever have contained an icon.** The instrument
 * copies a template directory and serves it, and a template directory is a real project minus what
 * `installStarterAssets` puts in — which is the font and the icon set. Two examples had carried
 * complete, correct Lucide values since August and neither could have appeared in a picture.
 *
 * `judge()` now installs the starter assets itself, from the same `STARTER_ASSETS` list the editor
 * installs from, and reports what it placed. The first assertion below reads that report: a run
 * where the icon set failed to arrive would otherwise photograph a page of blank spans and look
 * exactly like a page whose author forgot the glyphs.
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
  'vib-003-pictures'
);
const DATE = today();

/** Every `iconIconSource` and every `src` the project carries, from disk. */
function authoredMedia(): { icons: Record<string, unknown>[]; srcs: string[] } {
  const icons: Record<string, unknown>[] = [];
  const srcs: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'nodes.json') {
        const doc = JSON.parse(fs.readFileSync(full, 'utf-8')) as {
          nodes: { parameters?: Record<string, unknown> }[];
        };
        for (const node of doc.nodes) {
          const p = node.parameters ?? {};
          if (p.iconIconSource) icons.push(p.iconIconSource as Record<string, unknown>);
          if (typeof p.src === 'string' && p.src) srcs.push(p.src);
          if (typeof p.coverUrl === 'string' && p.coverUrl) srcs.push(p.coverUrl);
        }
      }
    }
  };
  walk(path.join(PROJECT_DIR, 'components'));
  return { icons, srcs };
}

describe('VIB-003 — a page with pictures and glyphs in it', () => {
  it('carries drawable icon values, complete with the field that is not optional', () => {
    const { icons } = authoredMedia();

    // Four: three in the feature strip's item component (one per placement, over the wire) and one
    // in the empty state. The strip's are instance parameters, so they are counted at the
    // placements rather than inside the component — three different glyphs, which is the point.
    expect(icons.length).toBeGreaterThanOrEqual(2);

    for (const icon of icons) {
      expect(typeof icon.class).toBe('string');
      expect(typeof icon.code).toBe('string');
      // 🔴 The whole of §1(b). `IconGlyph` branches on `codeAsClass === true`; for Lucide — the set
      // every new project gets — anything else puts the glyph's NAME in the element's text. A value
      // missing this field passes every gate in the product and renders `icon-truck` in 20px type.
      expect(icon.codeAsClass).toBe(true);
    }
  });

  it('points every picture at a file that exists on disk', () => {
    const { srcs } = authoredMedia();
    expect(srcs.length).toBeGreaterThanOrEqual(4);

    for (const src of srcs) {
      // An unverified image URL is an unchecked claim (doctrine §5). Everything this page shows is
      // a starter asset, so the claim is checkable — and checked, against the app bundle the
      // installer copies from rather than against the served copy, which is written by the run.
      expect(src.startsWith('noodl_modules/starter-imagery/')).toBe(true);
      const inBundle = path.join(
        REPO,
        'packages',
        'noodl-editor',
        'src',
        'assets',
        'starter-project',
        src
      );
      expect(fs.existsSync(inBundle)).toBe(true);
    }
  });

  it('photographs the page at all four widths, with the starter assets the editor installs', async () => {
    const run = await judge({
      task: 'vib-003',
      subject: 'pictures',
      state: 'door',
      projectDir: PROJECT_DIR,
      date: DATE,
      pages: [{ label: 'pictures', url: '/', as: 'four recipes, real glyphs and real pictures, nobody signed in' }]
    });

    // 🔴 The instrument's own honesty check, before any verdict is written from these PNGs. A
    // failure here means the picture is of a project nobody has — no Inter, or no icon set, so
    // every glyph on the page is a blank span that still takes its size in layout.
    expect(run.starterAssets.failed).toEqual([]);
    expect(run.starterAssets.written).toContain('noodl_modules/lucide-icons/styles.css');
    expect(run.starterAssets.written).toContain('noodl_modules/starter-imagery/tile-1.svg');

    expect(run.shots.length).toBe(4);
    for (const shot of run.shots) {
      expect(shot.textChars).toBeGreaterThan(200);
    }
    // eslint-disable-next-line no-console
    console.log('VIB-003 PICTURES MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
  });
});
