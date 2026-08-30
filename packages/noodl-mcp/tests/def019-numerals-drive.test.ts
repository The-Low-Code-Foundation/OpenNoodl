/**
 * DEF-019 (P78 D30) — a column of numbers can be aligned, driven to the pixel.
 *
 * D30's measurement: the shared text-style group was nine ports, `fontVariantNumeric` was not
 * one of them, and a parameter naming a port that does not exist is dropped — so tabular
 * figures were unreachable by any template, agent or person. The bite is the product's own
 * font: the Inter every new project ships (v3.019, `starterAssets.ts`) has PROPORTIONAL
 * default figures (`1` advances 1308/2048 em, `8` 1736) and a `tnum` feature nothing could
 * switch on.
 *
 * The drive authors through the real door (so an unknown-parameter refusal would be caught
 * here, not read from the catalog) and renders in real Chrome against the shipped TTF:
 *
 *  - CONTROL — the same digits with no `fontVariantNumeric`: '1111' and '8888' differ by
 *    >5px. This is the known-firing signal beside the arm: it proves the font LOADED and its
 *    default figures are proportional (every likely fallback — Arial, Helvetica, Times — has
 *    equal-width digits, so a failed font load turns THIS spec red, not the arm green).
 *  - ARM — `fontVariantNumeric: 'tabular-nums'`: the same strings within a pixel. Deleting
 *    the port from `node-shared-port-definitions.ts` drops the parameter and reddens this arm
 *    (the D30 state, reproduced as the mutant).
 */
import * as fs from 'fs';
import * as path from 'path';

import type { CreateComponentResponse } from '../src/tools/responses';

import { call, connect, copyFixture, TestSession, ToolCallResult } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withRenderedPage } = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js'));

jest.setTimeout(600000);

/** The TTF every new project gets — the file `starterAssets.ts` copies, not a stand-in. */
const SHIPPED_INTER = path.resolve(__dirname, '..', '..', 'noodl-editor', 'src', 'assets', 'Inter', 'Inter-Regular.ttf');

interface Reading {
  width: number;
  fontVariantNumeric: string;
  fontFamily: string;
}

interface RenderedPage {
  navigate(urlPath: string): Promise<void>;
  evaluate(expression: string): Promise<string>;
  setViewport(vp: { name: string; width: number; height: number; mobile: boolean }): Promise<void>;
}

/** One evaluate, one moment: rect + the two computed properties per probe. */
const READ = `(function () {
  var out = { fontLoaded: document.fonts.check('32px Inter-Regular') };
  document.querySelectorAll('[class*=probe-]').forEach(function (el) {
    var key = (el.className.match(/probe-[a-z0-9-]+/) || [])[0];
    var cs = getComputedStyle(el);
    out[key] = {
      width: el.getBoundingClientRect().width,
      fontVariantNumeric: cs.fontVariantNumeric,
      fontFamily: cs.fontFamily
    };
  });
  return JSON.stringify(out);
})()`;

function digitText(text: string, probe: string, tabular: boolean): Record<string, unknown> {
  const parameters: Record<string, unknown> = {
    text,
    cssClassName: probe,
    sizeMode: 'contentSize',
    fontFamily: 'fonts/Inter-Regular.ttf',
    fontSize: 32
  };
  if (tabular) parameters.fontVariantNumeric = 'tabular-nums';
  return parameters;
}

let seen: Record<string, Reading> & { fontLoaded?: boolean };
let doorAnswer: ToolCallResult<CreateComponentResponse>;

describe('DEF-019 — tabular figures through the door, rendered in the shipped Inter', () => {
  let dir: string;
  let session: TestSession;

  beforeAll(async () => {
    dir = copyFixture();
    fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
    fs.copyFileSync(SHIPPED_INTER, path.join(dir, 'fonts', 'Inter-Regular.ttf'));
    session = await connect(dir);

    doorAnswer = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/D30',
      nodes: [
        { id: 'pg', type: 'Page', parameters: { title: 'D30', urlPath: 'd30' } },
        { id: 'col', type: 'Group', parent: 'pg', parameters: { paddingLeft: 16, paddingTop: 16 } },
        // The arm: the aligned column.
        { id: 't1', type: 'Text', parent: 'col', parameters: digitText('1111', 'probe-tab-ones', true) },
        { id: 't2', type: 'Text', parent: 'col', parameters: digitText('8888', 'probe-tab-eights', true) },
        // The control: the D30 state — same digits, same font, no numerals parameter.
        { id: 'c1', type: 'Text', parent: 'col', parameters: digitText('1111', 'probe-def-ones', false) },
        { id: 'c2', type: 'Text', parent: 'col', parameters: digitText('8888', 'probe-def-eights', false) }
      ]
    });
    // eslint-disable-next-line no-console
    if (doorAnswer.isError) console.log('door refused D30:', JSON.stringify(doorAnswer).slice(0, 2000));
    expect(doorAnswer.isError).toBe(false);

    seen = {} as typeof seen;
    await withRenderedPage({ projectDir: dir }, async (page: RenderedPage) => {
      await page.setViewport({ name: '1280x900', width: 1280, height: 900, mobile: false });
      await page.navigate('/d30');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      Object.assign(seen, JSON.parse(await page.evaluate(READ)));
    });
    // eslint-disable-next-line no-console
    console.log('        read back:', JSON.stringify(seen));
  });

  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('CONTROL — the page rendered, and the shipped Inter actually loaded', () => {
    for (const key of ['probe-tab-ones', 'probe-tab-eights', 'probe-def-ones', 'probe-def-eights']) {
      expect(seen[key]).toBeDefined();
    }
    expect(seen.fontLoaded).toBe(true);
    expect(seen['probe-def-ones'].fontFamily).toContain('Inter-Regular');
  });

  it('the door accepts the parameter — no diagnostic names fontVariantNumeric', () => {
    expect(JSON.stringify(doorAnswer)).not.toContain('unknown-parameter');
  });

  it('D30 — without the port, the shipped font renders a ragged column (the defect, held as the control)', () => {
    const ones = seen['probe-def-ones'];
    const eights = seen['probe-def-eights'];
    expect(ones.fontVariantNumeric).toBe('normal');
    expect(Math.abs(ones.width - eights.width)).toBeGreaterThan(5);
  });

  it('DEF-019 — fontVariantNumeric: tabular-nums aligns the same digits to within a pixel', () => {
    const ones = seen['probe-tab-ones'];
    const eights = seen['probe-tab-eights'];
    expect(ones.fontVariantNumeric).toBe('tabular-nums');
    expect(eights.fontVariantNumeric).toBe('tabular-nums');
    expect(Math.abs(ones.width - eights.width)).toBeLessThan(1);
  });
});
