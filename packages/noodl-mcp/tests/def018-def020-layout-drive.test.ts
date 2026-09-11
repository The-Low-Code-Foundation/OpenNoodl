/**
 * DEF-018 (P78 D28) + DEF-020 (P78 D32) — the layout pair, re-driven at HEAD before either fix.
 *
 * Both rows are the same mechanism one step apart: a parent/child layout combination in which a
 * declared parameter is silently inert, decidable from the graph alone, and the door says nothing.
 *
 *  - **D28**: `Columns` hands each child a fixed box (`column-item`, `flexGrow: 0, flexShrink: 0`,
 *    percentage width) and nothing clips it; a `sizeMode: 'contentSize'` child — which is what both
 *    button compositions stamp — keeps its intrinsic width and draws straight across the next
 *    column's content.
 *  - **D32**: every visual node's `width` defaults to `100%`, and `layout.ts` turns a percentage
 *    width inside a `row` parent into `flexGrow`. Two such children absorb all free space, so
 *    `justifyContent: 'space-between'` distributes nothing — an even split, not a split.
 *
 * Each arm renders beside a one-variable control (the same graph with the child sizing that works),
 * because "the parameter did nothing" is an absence, and an absence is only a reading beside a
 * known-firing signal: the control is the same instrument reporting the parameter working.
 *
 * These specs pin the RUNTIME mechanism. The product fix is door-side (see
 * `layoutInertCombination.ts` in noodl-editor's validation), so these readings must hold before
 * and after it — a door warning changes what an author is told, not what the runtime draws.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { CreateComponentResponse } from '../src/tools/responses';

import { call, connect, copyFixture, TestSession } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withRenderedPage } = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js'));

jest.setTimeout(600000);

/** The five labels the members band shipped — the register's own instance of D28. */
const LABELS = ['Announcements board', 'Meetings calendar', 'Requests to join today', 'Member directory', 'Post something new'];

/** `primaryButton` as `StyleCompositions.ts` ships it — `sizeMode: 'contentSize'` is the defect's half. */
function primaryButton(label: string, probe: string): Record<string, unknown> {
  return {
    label,
    cssClassName: probe,
    backgroundColor: 'var(--primary)',
    color: 'var(--primary-foreground)',
    borderRadius: 'var(--radius-full)',
    borderStyle: 'none',
    paddingLeft: 'var(--space-6)',
    paddingRight: 'var(--space-6)',
    paddingTop: 'var(--space-3)',
    paddingBottom: 'var(--space-3)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--font-semibold)',
    sizeMode: 'contentSize'
  };
}

/** The control: `tpl001Components.ts`'s `inColumn` shape — width from the column, height from the label. */
function inColumnButton(label: string, probe: string): Record<string, unknown> {
  return {
    ...primaryButton(label, probe),
    sizeMode: 'contentHeight',
    width: { value: 100, unit: '%' },
    paddingLeft: 'var(--space-3)',
    paddingRight: 'var(--space-3)'
  };
}

interface Rect {
  left: number;
  right: number;
  top: number;
  width: number;
}

interface RenderedPage {
  navigate(urlPath: string): Promise<void>;
  evaluate(expression: string): Promise<string>;
  setViewport(vp: { name: string; width: number; height: number; mobile: boolean }): Promise<void>;
}

/** One evaluate, one moment. Keys are the probe class names. */
const READ = `(function () {
  var out = {};
  document.querySelectorAll('[class*=probe-]').forEach(function (el) {
    var key = (el.className.match(/probe-[a-z0-9-]+/) || [])[0];
    var r = el.getBoundingClientRect();
    out[key] = { left: r.left, right: r.right, top: r.top, width: r.width };
  });
  return JSON.stringify(out);
})()`;

/** The rects of one arm's five buttons, in authored (left-to-right) order. */
function row(seen: Record<string, Rect>, prefix: string): Rect[] {
  return LABELS.map((_, i) => seen[`${prefix}${i}`]).filter(Boolean);
}

let seen: Record<string, Rect>;

describe('DEF-018/DEF-020 — the layout system doing nothing and saying nothing, measured at 1280×900', () => {
  let dir: string;
  let session: TestSession;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);

    const d18 = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/D18',
      nodes: [
        { id: 'pg', type: 'Page', parameters: { title: 'D18', urlPath: 'd18' } },
        // The defect arm: autoFit columns, the composition verbatim.
        {
          id: 'cols',
          type: 'net.noodl.visual.columns',
          parent: 'pg',
          parameters: { sizing: 'autoFit', minWidth: 120, marginX: 16, marginY: 16 }
        },
        ...LABELS.map((label, i) => ({
          id: `btn${i}`,
          type: 'net.noodl.controls.button',
          parent: 'cols',
          parameters: primaryButton(label, `probe-d18-${i}`)
        })),
        // The control arm: same columns, same labels, the `inColumn` sizing.
        {
          id: 'ctlcols',
          type: 'net.noodl.visual.columns',
          parent: 'pg',
          parameters: { sizing: 'autoFit', minWidth: 120, marginX: 16, marginY: 16 }
        },
        ...LABELS.map((label, i) => ({
          id: `cbtn${i}`,
          type: 'net.noodl.controls.button',
          parent: 'ctlcols',
          parameters: inColumnButton(label, `probe-c18-${i}`)
        }))
      ]
    });
    // eslint-disable-next-line no-console
    if (d18.isError) console.log('door refused D18:', JSON.stringify(d18).slice(0, 2000));
    expect(d18.isError).toBe(false);

    const d20 = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/D20',
      nodes: [
        { id: 'pg', type: 'Page', parameters: { title: 'D20', urlPath: 'd20' } },
        // The defect arm: two default-width Texts in a space-between row.
        {
          id: 'r1',
          type: 'Group',
          parent: 'pg',
          parameters: { flexDirection: 'row', justifyContent: 'space-between', cssClassName: 'probe-d20-row' }
        },
        { id: 't1', type: 'Text', parent: 'r1', parameters: { text: 'Ada Lovelace', cssClassName: 'probe-d20-left' } },
        { id: 't2', type: 'Text', parent: 'r1', parameters: { text: 'moderator', cssClassName: 'probe-d20-right' } },
        // The control arm: the same row with content-sized children.
        {
          id: 'r2',
          type: 'Group',
          parent: 'pg',
          parameters: { flexDirection: 'row', justifyContent: 'space-between', cssClassName: 'probe-c20-row' }
        },
        {
          id: 't3',
          type: 'Text',
          parent: 'r2',
          parameters: { text: 'Ada Lovelace', sizeMode: 'contentSize', cssClassName: 'probe-c20-left' }
        },
        {
          id: 't4',
          type: 'Text',
          parent: 'r2',
          parameters: { text: 'moderator', sizeMode: 'contentSize', cssClassName: 'probe-c20-right' }
        }
      ]
    });
    // eslint-disable-next-line no-console
    if (d20.isError) console.log('door refused D20:', JSON.stringify(d20).slice(0, 2000));
    expect(d20.isError).toBe(false);

    seen = {};
    await withRenderedPage({ projectDir: dir }, async (page: RenderedPage) => {
      await page.setViewport({ name: '1280x900', width: 1280, height: 900, mobile: false });
      await page.navigate('/d18');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      Object.assign(seen, JSON.parse(await page.evaluate(READ)));
      await page.navigate('/d20');
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

  it('CONTROL — both pages rendered: all four arms report rects', () => {
    expect(row(seen, 'probe-d18-').length).toBe(LABELS.length);
    expect(row(seen, 'probe-c18-').length).toBe(LABELS.length);
    for (const key of ['probe-d20-row', 'probe-d20-left', 'probe-d20-right', 'probe-c20-row', 'probe-c20-left', 'probe-c20-right']) {
      expect(seen[key]).toBeDefined();
    }
  });

  it('D28 — a contentSize button inside an autoFit Columns draws across its neighbour', () => {
    const rects = row(seen, 'probe-d18-').sort((a, b) => a.left - b.left);
    const overlaps = rects
      .slice(0, -1)
      .map((r, i) => ({ i, by: r.right - rects[i + 1].left }))
      .filter((o) => o.by > 2);
    // eslint-disable-next-line no-console
    console.log('        D28 overlaps:', JSON.stringify(overlaps));
    expect(overlaps.length).toBeGreaterThan(0);
  });

  it('D28 CONTROL — the same buttons with the inColumn sizing do not overlap', () => {
    const rects = row(seen, 'probe-c18-').sort((a, b) => a.left - b.left);
    for (let i = 0; i < rects.length - 1; i++) {
      // Same-row neighbours only: a folded layout puts later buttons on a new line.
      if (Math.abs(rects[i].top - rects[i + 1].top) > 4) continue;
      expect(rects[i].right).toBeLessThanOrEqual(rects[i + 1].left + 1);
    }
  });

  it('D32 — two default-width children of a space-between row split it evenly: the gap is nothing', () => {
    const left = seen['probe-d20-left'];
    const right = seen['probe-d20-right'];
    const gap = right.left - left.right;
    // eslint-disable-next-line no-console
    console.log('        D32 widths:', left.width, right.width, 'gap:', gap);
    // Equal halves, not a split: each child grew to half the row...
    expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(4);
    // ...and the free space space-between was asked to distribute does not exist.
    expect(gap).toBeLessThanOrEqual(4);
  });

  it('D32 CONTROL — the same row with content-sized children pushes them to the far edges', () => {
    const rowRect = seen['probe-c20-row'];
    const left = seen['probe-c20-left'];
    const right = seen['probe-c20-right'];
    const gap = right.left - left.right;
    // eslint-disable-next-line no-console
    console.log('        D32 control gap:', gap, 'row width:', rowRect.width);
    expect(gap).toBeGreaterThan(200);
    // And the split really is at the edges, not merely wider.
    expect(left.left - rowRect.left).toBeLessThanOrEqual(4);
    expect(rowRect.right - right.right).toBeLessThanOrEqual(4);
  });
});
