/**
 * DEF-024 (P78 D36) — a Condition-latched gate accumulates contradictory answers, re-driven at
 * HEAD before any fix.
 *
 * The register's sentence is "a `Condition` can only ever turn a gate ON". The node itself is
 * more honest than that — `result` pushes `false` whenever a test finds false — but the AUTHORED
 * shape every gate in the members' template used cannot: a constant-`true` condition whose only
 * trigger is `Evaluate` tests true on every pulse, so the `mounted` it feeds can only ever
 * receive `true`. Two sibling answers built that way both stay up, and the person cannot tell
 * which one won.
 *
 * The control arm is the finding's other half: the product ALREADY ships the two-way shape.
 * `Switch` (the same Logic category) takes `On`/`Off` signals and pushes `Current State` on every
 * change, so one Switch per answer — `state → mounted`, each path switching the others off — shows
 * exactly one answer at a time, with fewer nodes than the double-Condition workaround the
 * template shipped. Both arms are driven through the real door and real Chrome in one instrument:
 * the latch arm reproduces the defect, the Switch arm proves the correct graph needs no new node.
 *
 * D36's own generic form applies to these specs: asserting the RIGHT notice is present passes
 * while the wrong one is present too, so the load-bearing assertions are about the notice that
 * should have GONE.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { CreateComponentResponse } from '../src/tools/responses';

import { call, connect, copyFixture, TestSession } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withRenderedPage } = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js'));

jest.setTimeout(600000);

interface RenderedPage {
  navigate(urlPath: string): Promise<void>;
  evaluate(expression: string): Promise<string>;
}

/** The template's pre-fix gate, verbatim (`CONDITION_GATE` in tpl001Components.ts). */
const LATCH = { condition: true, 'runOnChange-condition': false };

/** Which of the four notices exist in the document right now. `mounted` is existence, not paint. */
const READ = `(function () {
  var keys = ['probe-notice-on', 'probe-notice-off', 'probe-cnotice-on', 'probe-cnotice-off'];
  var out = {};
  keys.forEach(function (k) {
    out[k] = !!document.querySelector('[class*=' + k + ']');
  });
  return JSON.stringify(out);
})()`;

/** Click one probe-classed button. React's handler fires on a dispatched click. */
function click(probe: string): string {
  return `(function () {
    var el = document.querySelector('[class*=${probe}]');
    if (!el) return 'MISSING ${probe}';
    (el.matches('button') ? el : el.querySelector('button') || el).click();
    return 'clicked';
  })()`;
}

type Seen = Record<string, boolean>;

let fresh: Seen; // before anything is clicked
let afterTick: Seen; // after the "on" path fired once
let afterUntick: Seen; // after the "off" path fired — the reading D36 is about

describe('DEF-024 — a latched gate accumulates answers; the Switch shape does not', () => {
  let dir: string;
  let session: TestSession;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);

    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/D24',
      nodes: [
        { id: 'pg', type: 'Page', parameters: { title: 'D24', urlPath: 'd24' } },

        // ── The defect arm: the members template's pre-fix shape, verbatim ──
        // One constant-true Condition per answer, Evaluate-pulsed by its path. Nothing can
        // ever push `false` into either `mounted`.
        { id: 'tick', type: 'net.noodl.controls.button', parent: 'pg', parameters: { label: 'Tick', cssClassName: 'probe-tick' } },
        { id: 'untick', type: 'net.noodl.controls.button', parent: 'pg', parameters: { label: 'Untick', cssClassName: 'probe-untick' } },
        { id: 'onGate', type: 'Condition', parameters: { ...LATCH } },
        { id: 'offGate', type: 'Condition', parameters: { ...LATCH } },
        { id: 'noticeOn', type: 'Group', parent: 'pg', parameters: { mounted: false, cssClassName: 'probe-notice-on' } },
        { id: 'noticeOnText', type: 'Text', parent: 'noticeOn', parameters: { text: 'Saved. We will email you.' } },
        { id: 'noticeOff', type: 'Group', parent: 'pg', parameters: { mounted: false, cssClassName: 'probe-notice-off' } },
        { id: 'noticeOffText', type: 'Text', parent: 'noticeOff', parameters: { text: 'Saved. We will not email you.' } },

        // ── The control arm: one Switch per answer, each path switching the other off ──
        { id: 'ctick', type: 'net.noodl.controls.button', parent: 'pg', parameters: { label: 'Tick', cssClassName: 'probe-ctick' } },
        { id: 'cuntick', type: 'net.noodl.controls.button', parent: 'pg', parameters: { label: 'Untick', cssClassName: 'probe-cuntick' } },
        { id: 'swOn', type: 'Switch' },
        { id: 'swOff', type: 'Switch' },
        { id: 'cnoticeOn', type: 'Group', parent: 'pg', parameters: { mounted: false, cssClassName: 'probe-cnotice-on' } },
        { id: 'cnoticeOnText', type: 'Text', parent: 'cnoticeOn', parameters: { text: 'Saved. We will email you.' } },
        { id: 'cnoticeOff', type: 'Group', parent: 'pg', parameters: { mounted: false, cssClassName: 'probe-cnotice-off' } },
        { id: 'cnoticeOffText', type: 'Text', parent: 'cnoticeOff', parameters: { text: 'Saved. We will not email you.' } }
      ],
      connections: [
        // Defect arm.
        { fromId: 'tick', fromProperty: 'onClick', toId: 'onGate', toProperty: 'eval' },
        { fromId: 'onGate', fromProperty: 'result', toId: 'noticeOn', toProperty: 'mounted' },
        { fromId: 'untick', fromProperty: 'onClick', toId: 'offGate', toProperty: 'eval' },
        { fromId: 'offGate', fromProperty: 'result', toId: 'noticeOff', toProperty: 'mounted' },

        // Control arm.
        { fromId: 'ctick', fromProperty: 'onClick', toId: 'swOn', toProperty: 'on' },
        { fromId: 'ctick', fromProperty: 'onClick', toId: 'swOff', toProperty: 'off' },
        { fromId: 'cuntick', fromProperty: 'onClick', toId: 'swOn', toProperty: 'off' },
        { fromId: 'cuntick', fromProperty: 'onClick', toId: 'swOff', toProperty: 'on' },
        { fromId: 'swOn', fromProperty: 'state', toId: 'cnoticeOn', toProperty: 'mounted' },
        { fromId: 'swOff', fromProperty: 'state', toId: 'cnoticeOff', toProperty: 'mounted' }
      ]
    });
    // eslint-disable-next-line no-console
    if (res.isError) console.log('door refused D24:', JSON.stringify(res).slice(0, 2000));
    expect(res.isError).toBe(false);

    await withRenderedPage({ projectDir: dir }, async (page: RenderedPage) => {
      await page.navigate('/d24');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      fresh = JSON.parse(await page.evaluate(READ));

      expect(await page.evaluate(click('probe-tick'))).toBe('clicked');
      expect(await page.evaluate(click('probe-ctick'))).toBe('clicked');
      await new Promise((resolve) => setTimeout(resolve, 800));
      afterTick = JSON.parse(await page.evaluate(READ));

      expect(await page.evaluate(click('probe-untick'))).toBe('clicked');
      expect(await page.evaluate(click('probe-cuntick'))).toBe('clicked');
      await new Promise((resolve) => setTimeout(resolve, 800));
      afterUntick = JSON.parse(await page.evaluate(READ));
    });
    // eslint-disable-next-line no-console
    console.log('        fresh:', JSON.stringify(fresh), 'afterTick:', JSON.stringify(afterTick), 'afterUntick:', JSON.stringify(afterUntick));
  });

  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('CONTROL — a fresh load shows no notice in either arm', () => {
    expect(fresh).toEqual({
      'probe-notice-on': false,
      'probe-notice-off': false,
      'probe-cnotice-on': false,
      'probe-cnotice-off': false
    });
  });

  it('CONTROL — both arms CAN mount a notice: one tick shows exactly the on-notice in each', () => {
    // The known-firing signal every absence below is read beside.
    expect(afterTick['probe-notice-on']).toBe(true);
    expect(afterTick['probe-notice-off']).toBe(false);
    expect(afterTick['probe-cnotice-on']).toBe(true);
    expect(afterTick['probe-cnotice-off']).toBe(false);
  });

  it('D36 — tick then untick: the latch arm shows BOTH answers at once', () => {
    // The load-bearing half is the notice that should have gone.
    expect(afterUntick['probe-notice-on']).toBe(true);
    expect(afterUntick['probe-notice-off']).toBe(true);
  });

  it('D36 CONTROL — the same transitions through Switches show exactly one answer', () => {
    expect(afterUntick['probe-cnotice-on']).toBe(false);
    expect(afterUntick['probe-cnotice-off']).toBe(true);
  });
});
