/**
 * FLD-005 (#35) — a column of Groups multiplies out, measured at HEAD.
 *
 * The reporter's smallest graph, verbatim: a column `Group` holding five row `Group`s, no
 * `sizeMode` anywhere. `Group`'s `sizeMode` defaults to `explicit` and both dimension ports
 * default to `100%` (`node-shared-port-definitions.ts`), so `layout.ts` gives every one of those
 * six nodes `height: 100%` and then turns the percentage on the parent's main axis into
 * `flexGrow` — the same conversion FLD-004's `wired-dimension-becomes-grow` is about, arriving
 * here from the port's own default rather than from a wire.
 *
 * Three arms, one page each, one render:
 *
 *  - **`/d`** — the reporter's graph.
 *  - **`/c`** — the control: the same graph with `sizeMode: 'contentHeight'` on all six, which is
 *    the fix the reporter says they now apply by hand. An absence ("the page is not too tall") is
 *    only a reading beside a known-firing signal, and this is the signal.
 *  - **`/r`** — AC1's own arm: `band` / `shell` / `card` / `cardBody` copied out of
 *    `StyleCompositions.ts` VERBATIM, which is the claim that makes this a product defect rather
 *    than a defensible default.
 *
 * 🔴 The page height is read from the tallest `scrollHeight` in the tree, never from `<body>`:
 * `#root` is `position: fixed` on every viewer page, so `document.body.scrollHeight` is `0` and
 * the obvious probe reports one viewport for any content.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { CreateComponentResponse, ValidateComponentResponse } from '../src/tools/responses';
import { call, connect, copyFixture, TestSession } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withRenderedPage } = require(path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'scripts',
  'devtools',
  'render-report.js'
));

jest.setTimeout(600000);

const ROWS = ['Announcements', 'Meetings', 'Requests', 'Directory', 'New post'];

const GROUP100 = { value: 100, unit: '%' };

/** `card`, out of `StyleCompositions.ts`. No `sizeMode`, and that is the defect. */
const CARD: Record<string, unknown> = {
  width: GROUP100,
  backgroundColor: 'var(--surface)',
  borderRadius: 'var(--radius-xl)',
  borderStyle: 'solid',
  borderWidth: 'var(--border-1)',
  borderColor: 'var(--border)',
  clip: true,
  flexDirection: 'column'
};

/** `cardBody`, out of `StyleCompositions.ts`. */
const CARD_BODY: Record<string, unknown> = {
  width: GROUP100,
  flexDirection: 'column',
  rowGap: 'var(--space-2)',
  paddingLeft: 'var(--space-5)',
  paddingRight: 'var(--space-5)',
  paddingTop: 'var(--space-5)',
  paddingBottom: 'var(--space-5)'
};

/** `shell`, out of `StyleCompositions.ts`. */
const SHELL: Record<string, unknown> = {
  width: GROUP100,
  maxWidth: { value: 1200, unit: 'px' },
  flexDirection: 'column',
  paddingLeft: 'var(--space-6)',
  paddingRight: 'var(--space-6)'
};

interface Rect {
  top: number;
  height: number;
  css: string;
  inline: string;
}

interface Reading {
  pageHeight: number;
  rects: Record<string, Rect>;
}

interface RenderedPage {
  navigate(urlPath: string): Promise<void>;
  evaluate(expression: string): Promise<string>;
  setViewport(vp: { name: string; width: number; height: number; mobile: boolean }): Promise<void>;
}

/**
 * One evaluate, one moment. `pageHeight` walks the tree for the tallest `scrollHeight` because
 * `<body>` has no content box on a viewer page.
 */
const READ = `(function () {
  var h = window.innerHeight;
  var all = document.body.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) { if (all[i].scrollHeight > h) h = all[i].scrollHeight; }
  var out = {};
  document.querySelectorAll('[class*=probe-]').forEach(function (el) {
    var key = (el.className.match(/probe-[a-z0-9-]+/) || [])[0];
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    out[key] = {
      top: r.top,
      height: r.height,
      css: cs.height + ' | grow ' + cs.flexGrow + ' | shrink ' + cs.flexShrink + ' | ' + cs.position + ' | basis ' + cs.flexBasis,
      inline: el.getAttribute('style') || ''
    };
  });
  return JSON.stringify({ pageHeight: h, rects: out });
})()`;

/** `read[bodyScroll][arm]`. Both states, because which one the reporter had decides the number. */
/** What `validate_component` says about the defect graph and its control. */
const doorCodes: Record<string, string[]> = {};

const read: Record<'scroll' | 'clip', Record<string, Reading>> = { scroll: {}, clip: {} };

describe('FLD-005 (#35) — a column of Groups, measured at 1280x900', () => {
  let dir: string;
  let session: TestSession;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);

    /** The reporter's graph. `fix` adds the sizeMode they now set by hand. */
    function plain(fix: boolean) {
      const extra = fix ? { sizeMode: 'contentHeight' } : {};
      return [
        { id: 'pg', type: 'Page', parameters: { title: 'T', urlPath: fix ? 'c' : 'd' } },
        {
          id: 'col',
          type: 'Group',
          parent: 'pg',
          parameters: { flexDirection: 'column', cssClassName: 'probe-col', ...extra }
        },
        ...ROWS.map((label, i) => ({
          id: `row${i}`,
          type: 'Group',
          parent: 'col',
          parameters: { flexDirection: 'row', cssClassName: `probe-row-${i}`, ...extra }
        })),
        ...ROWS.map((label, i) => ({
          id: `txt${i}`,
          type: 'Text',
          parent: `row${i}`,
          parameters: { text: label }
        }))
      ];
    }

    const d = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/D',
      nodes: plain(false)
    });
    // eslint-disable-next-line no-console
    if (d.isError) console.log('door refused D:', JSON.stringify(d).slice(0, 2000));
    expect(d.isError).toBe(false);

    const c = await call<CreateComponentResponse>(session, 'create_component', { path: 'Pages/C', nodes: plain(true) });
    // eslint-disable-next-line no-console
    if (c.isError) console.log('door refused C:', JSON.stringify(c).slice(0, 2000));
    expect(c.isError).toBe(false);

    /** AC1's arm: the shipped recipes, copied verbatim, nothing added. */
    const r = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/R',
      nodes: [
        { id: 'pg', type: 'Page', parameters: { title: 'R', urlPath: 'r' } },
        {
          id: 'band',
          type: 'Group',
          parent: 'pg',
          parameters: {
            width: GROUP100,
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 'var(--space-20)',
            paddingBottom: 'var(--space-20)',
            cssClassName: 'probe-band'
          }
        },
        { id: 'shell', type: 'Group', parent: 'band', parameters: { ...SHELL, cssClassName: 'probe-shell' } },
        // Each card carries i+1 lines. The variation is forced, not chosen: five structurally
        // identical subtrees are REFUSED by `repeated-sibling-subtree`, which is the door telling
        // the truth — nobody hand-authors five identical cards, they instantiate a component. The
        // sizing under test is per-card and unaffected by how many lines are inside one.
        ...ROWS.flatMap((label, i) => [
          { id: `card${i}`, type: 'Group', parent: 'shell', parameters: { ...CARD, cssClassName: `probe-card-${i}` } },
          { id: `body${i}`, type: 'Group', parent: `card${i}`, parameters: { ...CARD_BODY } },
          ...Array.from({ length: i + 1 }, (_, k) => ({
            id: `rt${i}_${k}`,
            type: 'Text',
            parent: `body${i}`,
            parameters: { text: `${label} ${k + 1}` }
          }))
        ])
      ]
    });
    // eslint-disable-next-line no-console
    if (r.isError) console.log('door refused R:', JSON.stringify(r).slice(0, 2000));
    expect(r.isError).toBe(false);

    /**
     * Arm E — the same five rows inside a parent that HAS a definite height, which is the only
     * circumstance in which `flexGrow` has anything to distribute. Content lengths differ 1..5
     * lines on purpose: if the rows come back equal, the column has overwritten every one of
     * them with a share of the parent.
     */
    const e = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/E',
      nodes: [
        { id: 'pg', type: 'Page', parameters: { title: 'E', urlPath: 'e' } },
        {
          id: 'box',
          type: 'Group',
          parent: 'pg',
          parameters: {
            flexDirection: 'column',
            sizeMode: 'explicit',
            width: GROUP100,
            height: { value: 800, unit: 'px' },
            cssClassName: 'probe-box'
          }
        },
        ...ROWS.flatMap((label, i) => [
          {
            id: `erow${i}`,
            type: 'Group',
            parent: 'box',
            parameters: { flexDirection: 'column', cssClassName: `probe-erow-${i}` }
          },
          ...Array.from({ length: i + 1 }, (_, k) => ({
            id: `et${i}_${k}`,
            type: 'Text',
            parent: `erow${i}`,
            parameters: { text: `${label} ${k + 1}` }
          }))
        ])
      ]
    });
    // eslint-disable-next-line no-console
    if (e.isError) console.log('door refused E:', JSON.stringify(e).slice(0, 2000));
    expect(e.isError).toBe(false);

    /**
     * Arm G — register row **V17**, verbatim: `imageGround` (the one recipe that DOES set
     * `sizeMode: 'explicit'` and a 520px height) holding the default `shell` (which does not).
     * `justifyContent: 'flex-end'` is set correctly the whole time and has nothing to justify.
     */
    const g = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/G',
      nodes: [
        { id: 'pg', type: 'Page', parameters: { title: 'G', urlPath: 'g' } },
        {
          id: 'ground',
          type: 'Group',
          parent: 'pg',
          parameters: {
            width: GROUP100,
            sizeMode: 'explicit',
            height: { value: 520, unit: 'px' },
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            cssClassName: 'probe-ground'
          }
        },
        { id: 'gshell', type: 'Group', parent: 'ground', parameters: { ...SHELL, cssClassName: 'probe-gshell' } },
        {
          id: 'gtext',
          type: 'Text',
          parent: 'gshell',
          parameters: { text: 'Headline over the photograph', cssClassName: 'probe-gtext' }
        },
        // The control: the same band with the sizeMode `imageGround`'s own comment says to set.
        {
          id: 'cground',
          type: 'Group',
          parent: 'pg',
          parameters: {
            width: GROUP100,
            sizeMode: 'explicit',
            height: { value: 520, unit: 'px' },
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            cssClassName: 'probe-cground'
          }
        },
        {
          id: 'cshell',
          type: 'Group',
          parent: 'cground',
          parameters: { ...SHELL, sizeMode: 'contentHeight', cssClassName: 'probe-cgshell' }
        },
        {
          id: 'ctext',
          type: 'Text',
          parent: 'cshell',
          parameters: { text: 'Headline over the photograph', cssClassName: 'probe-cgtext' }
        }
      ]
    });
    // eslint-disable-next-line no-console
    if (g.isError) console.log('door refused G:', JSON.stringify(g).slice(0, 2000));
    expect(g.isError).toBe(false);

    /**
     * Arm H — the consequence, not the number. `card` sets `clip: true`, so a card handed a share
     * SMALLER than its content does not overflow visibly, it is cut off. Five `card`s in a 300px
     * definite parent get 60px each; the last one holds ten lines.
     */
    const h = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/H',
      nodes: [
        { id: 'pg', type: 'Page', parameters: { title: 'H', urlPath: 'h' } },
        {
          id: 'box',
          type: 'Group',
          parent: 'pg',
          parameters: {
            flexDirection: 'column',
            sizeMode: 'explicit',
            width: GROUP100,
            height: { value: 300, unit: 'px' },
            cssClassName: 'probe-hbox'
          }
        },
        ...ROWS.flatMap((label, i) => [
          { id: `hcard${i}`, type: 'Group', parent: 'box', parameters: { ...CARD, cssClassName: `probe-hcard-${i}` } },
          ...Array.from({ length: i === ROWS.length - 1 ? 10 : 1 }, (_, k) => ({
            id: `ht${i}_${k}`,
            type: 'Text',
            parent: `hcard${i}`,
            parameters: {
              text: `${label} ${k + 1}`,
              cssClassName: i === ROWS.length - 1 ? `probe-hline-${k}` : undefined
            }
          }))
        ])
      ]
    });
    // eslint-disable-next-line no-console
    if (h.isError) console.log('door refused H:', JSON.stringify(h).slice(0, 2000));
    expect(h.isError).toBe(false);

    // 🔴 GRADE THE WIRING, NOT THE FUNCTION. The unit arms in
    // `noodl-editor/tests-unit/validation/layoutInertCombination.test.ts` call
    // `checkLayoutInertCombination` directly, and a spec that calls the function it is grading
    // cannot tell you whether anything else does — that is exactly how FLD-004 shipped ten green
    // arms against a report that never fired. These two go through `validate_component`, which is
    // the door an agent actually meets, so the mutant "unhook the call" is expressible here.
    for (const [key, target] of [
      ['defectDoor', 'Pages/E'],
      ['controlDoor', 'Pages/C']
    ] as const) {
      const v = await call<ValidateComponentResponse>(session, 'validate_component', { path: target });
      // 🔴 An empty `diagnostics` and a REFUSED call read identically downstream — the first run
      // of this arm passed `component:` instead of `path:` and reported "the rule is not wired".
      expect(v.isError).toBe(false);
      doorCodes[key] = (v.data.diagnostics ?? []).map((d) => `${d.code}@${d.location?.nodeId}`);
    }
    // eslint-disable-next-line no-console
    console.log('        door:', JSON.stringify(doorCodes));

    // 🔴 Both `bodyScroll` states, because the task's open question is which one is in the loop.
    // `create_project` writes `bodyScroll: true` for every new project (REL-002a), so `scroll` is
    // the state the reporter was in; `clip` is the fixture's own, and the viewer pins the whole
    // app to the viewport there, which makes the page height definite.
    for (const state of ['scroll', 'clip'] as const) {
      session.store.writeProjectSettings({ bodyScroll: state === 'scroll' });
      await withRenderedPage({ projectDir: dir }, async (page: RenderedPage) => {
        await page.setViewport({ name: '1280x900', width: 1280, height: 900, mobile: false });
        for (const [key, urlPath] of [
          ['defect', '/d'],
          ['control', '/c'],
          ['recipes', '/r'],
          ['definite', '/e'],
          ['v17', '/g'],
          ['clipped', '/h']
        ] as const) {
          await page.navigate(urlPath);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          read[state][key] = JSON.parse(await page.evaluate(READ));
        }
      });
    }
    // eslint-disable-next-line no-console
    console.log('        FLD-005 read back:', JSON.stringify(read, null, 1));
  });

  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('CONTROL — all six arms rendered, in both scroll states', () => {
    for (const state of ['scroll', 'clip'] as const) {
      for (const arm of ['defect', 'control', 'recipes', 'definite', 'v17', 'clipped'] as const) {
        expect(read[state][arm]).toBeDefined();
        expect(read[state][arm].pageHeight).toBeGreaterThan(0);
      }
      for (let i = 0; i < ROWS.length; i++) {
        expect(read[state].defect.rects[`probe-row-${i}`]).toBeDefined();
        expect(read[state].control.rects[`probe-row-${i}`]).toBeDefined();
        expect(read[state].recipes.rects[`probe-card-${i}`]).toBeDefined();
        expect(read[state].definite.rects[`probe-erow-${i}`]).toBeDefined();
      }
    }
  });

  it('THE READING — every number this task is built on, printed once', () => {
    for (const state of ['scroll', 'clip'] as const) {
      // eslint-disable-next-line no-console
      console.log(
        `        [${state}] page heights:`,
        JSON.stringify({
          defect: read[state].defect.pageHeight,
          control: read[state].control.pageHeight,
          recipes: read[state].recipes.pageHeight
        }),
        `\n        [${state}] reporter's rows:`,
        JSON.stringify(ROWS.map((_, i) => read[state].defect.rects[`probe-row-${i}`].height)),
        `\n        [${state}] control rows:`,
        JSON.stringify(ROWS.map((_, i) => read[state].control.rects[`probe-row-${i}`].height)),
        `\n        [${state}] recipe cards:`,
        JSON.stringify(ROWS.map((_, i) => read[state].recipes.rects[`probe-card-${i}`].height)),
        `\n        [${state}] definite parent ${read[state].definite.rects['probe-box'].height}px, rows:`,
        JSON.stringify(ROWS.map((_, i) => read[state].definite.rects[`probe-erow-${i}`].height)),
        `\n        [${state}] V17:`,
        JSON.stringify({
          ground: read[state].v17.rects['probe-ground'].height,
          shell: read[state].v17.rects['probe-gshell'].height,
          textTop: read[state].v17.rects['probe-gtext'].top,
          ctlShell: read[state].v17.rects['probe-cgshell'].height,
          ctlTextTop: read[state].v17.rects['probe-cgtext'].top
        }),
        `\n        [${state}] clipped: box ${read[state].clipped.rects['probe-hbox'].height}px, cards:`,
        JSON.stringify(ROWS.map((_, i) => read[state].clipped.rects[`probe-hcard-${i}`].height))
      );
    }
    expect(true).toBe(true);
  });

  // ── The mechanism, and it is NOT the one the issue names ──────────────────

  it('THE MECHANISM IS REAL — every un-sizeModed Group carries height:100% and flex-grow:100', () => {
    for (const key of ['probe-col', 'probe-row-0', 'probe-row-4']) {
      const inline = read.scroll.defect.rects[key].inline;
      expect(inline).toContain('height: 100%');
      expect(inline).toContain('flex-grow: 100');
      // 🔴 The half the issue does not account for, and the half that decides everything below.
      expect(inline).toContain('flex-shrink: 1');
    }
    // The control is the same instrument reporting the parameter working: no conversion at all.
    expect(read.scroll.control.rects['probe-row-0'].inline).not.toContain('height: 100%');
    expect(read.scroll.control.rects['probe-row-0'].inline).not.toContain('flex-grow');
  });

  it('#35 AS WRITTEN DOES NOT REPRODUCE — the five rows are at content height, not multiplied', () => {
    // The reporter's smallest graph, rendered: five rows of one line each, 18px each, and the
    // tallest scrollHeight in the tree is the viewport. Nothing multiplied.
    for (const state of ['scroll', 'clip'] as const) {
      const rows = ROWS.map((_, i) => read[state].defect.rects[`probe-row-${i}`].height);
      expect(rows).toEqual(ROWS.map((_, i) => read[state].control.rects[`probe-row-${i}`].height));
      expect(read[state].defect.pageHeight).toBe(read[state].control.pageHeight);
    }
  });

  it('bodyScroll IS NOT IN THE LOOP — every reading is identical in both scroll states', () => {
    // The task predicted this was the discriminator. It is not: the two renders agree exactly,
    // including the arms that DO go wrong.
    expect(JSON.stringify(read.scroll)).toBe(JSON.stringify(read.clip));
  });

  // ── What actually goes wrong ──────────────────────────────────────────────

  it('THE DEFECT — under a parent with a DEFINITE height, five rows of 1..5 lines all render equal', () => {
    const rows = ROWS.map((_, i) => read.scroll.definite.rects[`probe-erow-${i}`].height);
    // One line and five lines come back the same number: the share has overwritten the content.
    expect(new Set(rows).size).toBe(1);
    expect(rows[0]).toBeCloseTo(read.scroll.definite.rects['probe-box'].height / ROWS.length, 0);
  });

  it('THE CONSEQUENCE — a card handed a share smaller than its content has the rest CUT OFF', () => {
    const card = read.scroll.clipped.rects[`probe-hcard-${ROWS.length - 1}`];
    const bottom = card.top + card.height;
    const lines = Array.from({ length: 10 }, (_, k) => read.scroll.clipped.rects[`probe-hline-${k}`]).filter(Boolean);
    expect(lines.length).toBe(10);
    // `card` ships `clip: true`, so the overflow is not scrolled and not visible — it is gone.
    const cut = lines.filter((l) => l.top >= bottom);
    expect(cut.length).toBeGreaterThan(0);
    // eslint-disable-next-line no-console
    console.log(`        card bottom ${bottom}px, ${cut.length} of ${lines.length} lines start below it`);
  });

  it('V17 — an un-sizeModed shell fills its 520px ground, so justifyContent has nothing to justify', () => {
    const v = read.scroll.v17.rects;
    expect(v['probe-gshell'].height).toBe(v['probe-ground'].height);
    // The headline sits at the TOP of the band with `justifyContent: 'flex-end'` set correctly.
    expect(v['probe-gtext'].top).toBe(v['probe-ground'].top);
    // The control: the same band with the sizeMode `imageGround`'s own comment names.
    expect(v['probe-cgshell'].height).toBeLessThan(v['probe-cground'].height);
    expect(v['probe-cgtext'].top).toBeGreaterThan(v['probe-cground'].top);
  });

  it('THE DOOR IS WIRED — validate_component reports the new rule on the defect graph', () => {
    // Fires, on the parent that holds the fixed height, through the real validator.
    expect(doorCodes.defectDoor).toContain('column-children-split-a-fixed-height@box');
  });

  it('THE DOOR IS WIRED — and says nothing about the control, which is the same graph fixed', () => {
    expect(doorCodes.controlDoor.filter((c) => c.startsWith('column-children-split-a-fixed-height'))).toEqual([]);
    // The control must be a graph the door has opinions about at ALL, or this arm passes on a
    // validator that returned nothing — an absence beside no known-firing signal.
    expect(doorCodes.controlDoor.length + doorCodes.defectDoor.length).toBeGreaterThan(0);
  });
});
