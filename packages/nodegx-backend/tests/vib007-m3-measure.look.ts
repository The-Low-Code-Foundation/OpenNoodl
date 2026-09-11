/**
 * VIB-007 AC3 — the measurement the poverty predicates were designed FROM.
 *
 * 🔴 **Not a gate, and deliberately not a design.** It renders the two arms AC3
 * names — the VIB-001 baseline artefacts (nine SHITTY pages) and the VIB-006
 * page (the phase's only WORTHY) — through the real instrument and prints the
 * raw numbers. A predicate written from `VIB-007-THE-LOOP.md` §3's table would
 * have been written from the wrong measurement: that table's "distinct grounds"
 * is counted in `vib006-landing.look.ts` over `nodes.json` PARAMETERS, and a
 * render finding sees a rendered DOM. The two are not the same number and there
 * is no reason they would be.
 *
 * ⚠️ **No suite runs it** — `.look.ts` is outside `jest.config.js`'s `testMatch`.
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib007-m3-measure.look.ts
 *
 * 🔴 The starter assets are INSTALLED before measuring, through the same
 * `placeStarterAssets` the Judge uses (VIB-003 / register V19). Measuring
 * VIB-006 without them would report eight broken images and no glyphs — i.e. it
 * would price the empty arm and call it the page.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { placeStarterAssets } from './helpers/judge';

const REPO = path.join(__dirname, '..', '..', '..');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { renderReport } = require(path.join(REPO, 'scripts', 'devtools', 'render-report')) as {
  renderReport: (o: Record<string, unknown>) => Promise<any>;
};

jest.setTimeout(1800000);

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900, mobile: false },
  { name: 'phone', width: 390, height: 844, mobile: true }
];

/** Serve a COPY, with the assets a real project has. Never the shipped directory. */
function servedCopy(from: string, label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `m3-${label}-`));
  fs.cpSync(from, dir, { recursive: true });
  const placed = placeStarterAssets(dir);
  if (placed.failed.length) throw new Error(`starter assets failed: ${placed.failed.join(', ')}`);
  return dir;
}

type Row = {
  arm: string;
  subject: string;
  viewport: string;
  texts: number;
  sizes: number;
  largest: number;
  weights: string;
  images: number;
  icons: number;
  grounds: number;
  accents: number;
  neutrals: number;
  bands: number;
  spacings: number;
  pageHeight: number;
  contentBottom: number;
  findings: string;
};

const rows: Row[] = [];

async function measure(arm: string, projectDir: string, subject: string, page?: string) {
  const { report } = await renderReport({
    projectDir,
    viewports: VIEWPORTS,
    screenshot: 'none',
    renderRoutedPages: false,
    ...(page ? { page } : {})
  });
  for (const [name, v] of Object.entries(report.viewports) as [string, any][]) {
    if (!v || v.error) {
      // eslint-disable-next-line no-console
      console.log(`  !! ${arm}/${subject}/${name}: ${v?.error ?? 'no measurement'}`);
      continue;
    }
    rows.push({
      arm,
      subject,
      viewport: name,
      texts: v.text.elements,
      sizes: v.text.distinctFontSizes,
      largest: Math.round(v.text.largestFontSize),
      weights: Object.keys(v.text.fontWeights).sort().join('+') || 'none',
      images: v.images.total,
      icons: v.images.icons,
      grounds: v.grounds ? v.grounds.distinct : -1,
      accents: v.colors.distinctAccents,
      neutrals: v.colors.distinctNeutrals,
      bands: v.rhythm.bands,
      spacings: v.rhythm.distinctSpacings,
      pageHeight: v.pageHeight,
      contentBottom: v.contentBottom,
      findings: report.findings
        .filter((f: any) => f.viewport === name)
        .map((f: any) => `${f.code}/${f.severity}`)
        .join(' ')
    });
  }
  // The whole per-viewport object, so a predicate can be designed against a
  // field this table did not think to print.
  // eslint-disable-next-line no-console
  console.log(`RAW ${arm}/${subject} ` + JSON.stringify(report.viewports));
}

describe('VIB-007 AC3 — what separates the baseline from the worthy page, measured', () => {
  it('measures the members-area baseline at its door, page by page', async () => {
    const dir = servedCopy(path.join(REPO, 'templates', 'members-area'), 'members');
    for (const page of ['/', 'members', 'setup', 'join']) {
      await measure('BASELINE members-area door', dir, page, page);
    }
    expect(rows.length).toBeGreaterThan(0);
  });

  it('measures the VIB-006 worked page', async () => {
    const dir = servedCopy(
      path.join(REPO, 'dev-docs', 'tasks', 'phase-81-the-look-is-the-product', 'demo', 'vib-006-landing'),
      'vib006'
    );
    await measure('WORTHY vib-006', dir, '/', '/');
    expect(rows.some((r) => r.arm.startsWith('WORTHY'))).toBe(true);
  });

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.log('\n=== M3 SEPARATION TABLE ===');
    const head = 'arm|subject|vp|texts|sizes|largest|weights|imgs|icons|grounds|accents|neutrals|bands|spacings|pageH|contentB|findings';
    // eslint-disable-next-line no-console
    console.log(head);
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(
        [
          r.arm,
          r.subject,
          r.viewport,
          r.texts,
          r.sizes,
          r.largest,
          r.weights,
          r.images,
          r.icons,
          r.grounds,
          r.accents,
          r.neutrals,
          r.bands,
          r.spacings,
          r.pageHeight,
          r.contentBottom,
          r.findings
        ].join('|')
      );
    }
  });
});
