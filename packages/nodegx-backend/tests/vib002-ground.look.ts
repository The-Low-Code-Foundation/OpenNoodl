/**
 * VIB-002 — the demonstration page for the decorative ground, photographed.
 *
 * 🔴 **A harness, not a gate**, exactly as VIB-001 is. Its output is PNGs and its
 * close condition is a person looking at them (README §3). It asserts only the
 * things that would make a picture dishonest.
 *
 * ⚠️ **No suite runs it.** The `.look.ts` suffix is outside `jest.config.js`'s
 * `testMatch`, so it can neither slow a gate down nor redden one. Run it:
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib002-ground.look.ts
 *
 * 🔴 **The project it photographs is BUILT FROM THE SHIPPED RECIPES**
 * (`demo/build-vib002-ground.js`, which copies
 * `docs/node-catalog/examples/ui-gradient-hero.json` and `ui-image-scrim-band.json`
 * verbatim). A hand-written demonstration would only have proved that a person
 * can express a gradient ground. What VIB-002 has to prove is that the
 * **sanctioned vocabulary** can — so the picture has to be of the recipes an
 * authoring model is actually handed.
 *
 * 🔴 **The `door` state is the only honest one here.** This project has no
 * backend, no data and nobody signed in — there is no living state to have. That
 * is the point: a decorative ground is not gated on anything, so if the page is
 * empty at the door the emptiness is the design's.
 *
 * ⚠️ **The rendered result depends on a freshly built viewer bundle.** The five
 * background ports live in `packages/noodl-viewer-react/src/node-shared-port-definitions.ts`,
 * and the harness serves `packages/noodl-editor/src/external/viewer/noodl.viewer.js`.
 * A stale bundle renders the page with the ports simply absent — a flat band,
 * indistinguishable from the defect this task exists to fix. `npm run
 * build:editor:_viewer` first; the assertion below is the tripwire that says so.
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
  'vib-002-ground'
);
const VIEWER_BUNDLE = path.join(REPO, 'packages', 'noodl-editor', 'src', 'external', 'viewer', 'noodl.viewer.js');
const DATE = today();

describe('VIB-002 — the decorative ground, on a real rendered page', () => {
  it('is being rendered by a viewer that actually has the ports', () => {
    // Reading the built bundle rather than the source: the source proves what
    // was written, and only the bundle proves what the browser will run. This
    // is the difference between the members-area verdict being about the
    // product and being about a stale artefact.
    const bundle = fs.readFileSync(VIEWER_BUNDLE, 'utf-8');
    for (const port of ['backgroundGradient', 'backgroundImage', 'backdropBlur', '_updateBackgroundLayers']) {
      expect(bundle.includes(port)).toBe(true);
    }
  });

  it('is being rendered from the recipes, with the picture the corpus cannot carry', () => {
    const nodes = JSON.parse(
      fs.readFileSync(path.join(PROJECT_DIR, 'components', 'Pages', 'Ground', 'nodes.json'), 'utf-8')
    ) as { nodes: { id: string; parameters?: Record<string, unknown> }[] };
    const withGradient = nodes.nodes.filter((n) => n.parameters?.backgroundGradient);
    const withImage = nodes.nodes.filter((n) => n.parameters?.backgroundImage);
    const withBlur = nodes.nodes.filter((n) => n.parameters?.backdropBlur);

    // Three grounds, one image, one glass panel — the shape a verdict is about.
    expect(withGradient.length).toBe(3);
    expect(withImage.length).toBe(1);
    expect(withBlur.length).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(path.join(PROJECT_DIR, 'assets', 'hero.jpg'))).toBe(true);
  });

  it('photographs the demonstration page at all four widths', async () => {
    const run = await judge({
      task: 'vib-002',
      subject: 'ground',
      state: 'door',
      projectDir: PROJECT_DIR,
      date: DATE,
      pages: [{ label: 'ground', url: '/', as: 'the three grounds, one page, nobody signed in' }]
    });
    expect(run.shots.length).toBe(4);
    for (const shot of run.shots) {
      // A page whose ground failed to paint still has its text, so text alone
      // proves nothing here — but zero text means the render died, and a verdict
      // written from a dead render is the failure VIB-001 §9 already made once.
      expect(shot.textChars).toBeGreaterThan(200);
    }
    // eslint-disable-next-line no-console
    console.log('VIB-002 GROUND MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
  });
});
