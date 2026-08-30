/**
 * SBR-007 AC2 — "a client reorders sections **by dragging**". The outcome half has shipped and
 * been driven since s27 (two buttons and a `reorderSection` endpoint); the *gesture* half has
 * stood at ⬜ for three sessions behind a recorded product blocker, D23, which s29 disproved.
 *
 * This file is the drive that answers the question D23 answered wrongly: **can a graph, with no
 * runtime change, turn a real pointer drag into the `toIndex` that `reorderSection` already
 * takes?**
 *
 * ## What was on file, and why it needed a drive rather than a re-read
 *
 * `sb005Components.ts`'s `moveRow` comment says, in the shipped template source:
 *
 * > a drag needs to answer "which row am I over", and this runtime cannot […] **no node in the
 * > viewer reports its own rendered geometry to the graph** […] these rows are anything but
 * > uniform: a textarea and an image preview make every one a different height. So
 * > `Drag Y / rowHeight` has no `rowHeight` to divide by.
 *
 * s29 killed the middle clause — all 27 box-drawing visual nodes carry `Bounding Box` outputs —
 * but it left the last one standing, and **the last one is the real difficulty**. A row's own
 * height is not the pitch when rows differ, and a `For Each` item cannot see its siblings: it is
 * handed its own record and nothing else. "The geometry exists" therefore does not yet mean "the
 * index is computable", and reading s29's result as though it did would repeat D23's mistake with
 * the sign flipped.
 *
 * ## The route under test, and why it is indifferent to the surviving clause
 *
 * s29's fifth probe opened a door it did not walk through: `this` is a `reference` output on every
 * visual node, a `Function` node's author-declared input is `*`, and `getDOMElement()` is live on
 * the far side. From the dragged row's own element, `parentElement.children` is **every sibling's
 * box at once** — so the drop index is a count of siblings whose centre is above the dragged row's
 * centre, and **no row ever needs a pitch**. That is precisely why the non-uniform-heights clause
 * stops mattering rather than having to be worked around.
 *
 * 🔴 **Three rows, three different heights, and three drags with three different answers.** One
 * drag is satisfied by a script returning a constant, by a port reporting the viewport, or by
 * arithmetic that happens to be right when rows are uniform. Three drags over deliberately
 * non-uniform rows — down two, up one, and nowhere — are not. The no-move arm is the one that
 * kills "always reports last" and "always reports first" together.
 *
 * ⚠️ **The heights are made by CONTENT, not by a `height` parameter**, and that is a finding
 * rather than a preference: a connection carries a bare number, and a bare number on a dimension
 * port is read as a PERCENTAGE (`height: 60` renders `height: 60%; flex-grow: 60`). The first run
 * of this drive authored `h → card.height` and got three rows that divided the list between them
 * in the authored ratio. See §33 — it is the same trap `SIDEBAR_WIDTH` records for parameters,
 * one port-shape over, where the object form that escapes it is not available.
 *
 * ⚠️ **The pointer is real.** `Input.dispatchMouseEvent` over the same CDP connection the page is
 * rendered on — pressed, moved in frames, released. A drive that called `onStop` itself would
 * prove the arithmetic and say nothing about whether `react-draggable` ever sees a pointer inside
 * a `For Each` item, which is the half nobody had run.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { CreateComponentResponse } from '../src/tools/responses';

import { call, connect, copyFixture, TestSession } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withRenderedPage } = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js'));

jest.setTimeout(600000);

/**
 * The three rows. Their heights differ because their LABELS differ in line count — see the header:
 * a connected number cannot express `px`, so content is the only way to author a row that is
 * genuinely taller than its neighbour through a `For Each`.
 *
 * `ccls` is the card — the `Drag`'s direct child. `icls` is a Group one level further in, and the
 * pair is a control rather than decoration: see the `cssClassName` spec below.
 */
const ROWS = [
  { label: 'row A', ccls: 'probe-card-a', icls: 'probe-inner-a', rcls: 'probe-report-a', bcls: 'probe-click-a' },
  {
    label: ['row B', 'two', 'three', 'four', 'five', 'six'].join('\n'),
    ccls: 'probe-card-b',
    icls: 'probe-inner-b',
    rcls: 'probe-report-b',
    bcls: 'probe-click-b'
  },
  {
    label: ['row C', 'two'].join('\n'),
    ccls: 'probe-card-c',
    icls: 'probe-inner-c',
    rcls: 'probe-report-c',
    bcls: 'probe-click-c'
  }
];

const CONTROL_TEXT = 'render control literal';

/**
 * The hit test — the whole of the gesture's brain, and the thing AC2 was said to need a runtime
 * change for.
 *
 * `Inputs.el` is the CARD's `this`, not the `Drag`'s: `Drag` renders no host element of its own
 * (`Drag.tsx` delegates `draggableNodeRef` to `children[0].getDOMElement()`), so the element that
 * carries the transform — the only element whose rect moves — is the card.
 *
 * It reports its working, not only its answer. `sib` and `pc` are here because a `For Each` is
 * free to render its items into a wrapper nobody authored, and an index counted over the wrong
 * parent would still be a plausible small integer.
 */
const HIT_TEST = [
  'var el = Inputs.el && Inputs.el.getDOMElement && Inputs.el.getDOMElement();',
  'if (!el) { Outputs.report = "NO-ELEMENT"; } else {',
  '  var parent = el.parentElement;',
  '  var kids = parent ? Array.prototype.slice.call(parent.children) : [];',
  '  var mine = el.getBoundingClientRect();',
  '  var myCentre = mine.top + mine.height / 2;',
  '  var before = 0, sib = 0;',
  '  for (var i = 0; i < kids.length; i++) {',
  '    if (kids[i] === el) continue;',
  '    sib++;',
  '    var r = kids[i].getBoundingClientRect();',
  '    if (r.top + r.height / 2 < myCentre) before++;',
  '  }',
  '  Outputs.report = "idx=" + before + " sib=" + sib + " dy=" + Math.round(Number(Inputs.dy) || 0)',
  '    + " pc=" + (parent && parent.className ? String(parent.className).slice(0, 30) : "none");',
  '}'
].join('\n');

interface RenderedPage {
  client: { send(method: string, params?: Record<string, unknown>): Promise<unknown> };
  consoleErrors: string[];
  navigate(urlPath: string): Promise<void>;
  evaluate(expression: string): Promise<string>;
  setViewport(vp: { width: number; height: number }): Promise<void>;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One evaluate, one moment — a report assembled from five reads is about none of them.
 *
 * The cards are read by the class their author gave them. Until D28 was fixed they could not be:
 * `react-draggable` was the only handle the card had, and the selector had to borrow it. The `>`
 * is the parent-boundary control either way — if `For Each` rendered its items into a wrapper,
 * this returns nothing and every arm below fails loudly rather than quietly.
 */
const READ = `(function () {
  var out = {};
  document.querySelectorAll('[class*=probe-]').forEach(function (el) {
    var key = (el.className.match(/probe-[a-z-]+/) || [])[0];
    var r = el.getBoundingClientRect();
    out[key] = { text: el.innerText, top: Math.round(r.top), height: Math.round(r.height) };
  });
  var cards = document.querySelectorAll('.probe-list > [class*="probe-card-"]');
  for (var i = 0; i < cards.length; i++) {
    var cr = cards[i].getBoundingClientRect();
    out['card' + i] = { text: cards[i].className, top: Math.round(cr.top), height: Math.round(cr.height) };
  }
  out.cardCount = { text: String(cards.length), top: 0, height: 0 };
  var btn = document.querySelector('.probe-inner-a button, .probe-inner-a [role=button]');
  if (btn) {
    var br = btn.getBoundingClientRect();
    out.btn = {
      text: btn.innerText,
      top: Math.round(br.top),
      height: Math.round(br.height),
      cx: Math.round(br.left + br.width / 2),
      cy: Math.round(br.top + br.height / 2)
    };
  }
  return JSON.stringify(out);
})()`;

interface Probe {
  text: string;
  top: number;
  height: number;
  /** Centre of the box, emitted only for `btn` — arm 4 needs a point to press, not a span. */
  cx?: number;
  cy?: number;
}
type Reading = Record<string, Probe>;

/**
 * A real pointer drag, in frames, on the connection the page is already on.
 *
 * 🔴 `buttons: 1` on every move is load-bearing, and is the kind of thing only a drive finds:
 * `react-draggable` listens for `mousemove` on the document, and a move dispatched without the
 * button bit is delivered and ignored — so the press and the release both land, the element never
 * moves, and the failure reads exactly like "the runtime cannot drag".
 */
async function dragBy(page: RenderedPage, x: number, fromY: number, dy: number, steps = 12) {
  const send = (type: string, y: number, extra: Record<string, unknown> = {}) =>
    page.client.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: 1, ...extra });

  await send('mousePressed', fromY, { clickCount: 1 });
  await wait(40);
  for (let i = 1; i <= steps; i++) {
    await send('mouseMoved', fromY + (dy * i) / steps);
    await wait(20);
  }
  await send('mouseReleased', fromY + dy, { clickCount: 1 });
  await wait(300);
}

/** `idx=2 sib=2 dy=118 pc=probe-list` → `{ idx: 2, sib: 2, dy: 118, pc: 'probe-list' }`. */
function parse(report: string) {
  const f = (k: string) => (report.match(new RegExp(k + '=([^ ]+)')) || [])[1];
  return { idx: Number(f('idx')), sib: Number(f('sib')), dy: Number(f('dy')), pc: f('pc'), raw: report };
}

let boot: Reading;
let armDown: ReturnType<typeof parse>;
let armUp: ReturnType<typeof parse>;
let armStill: ReturnType<typeof parse>;
let controlProbe: Probe;
let clickInsideDrag: string;
let consoleErrors: string[];

describe('SBR-007 AC2 — whether a pointer drag can produce the toIndex reorderSection already takes', () => {
  let dir: string;
  let session: TestSession;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);

    // ── The repeater item: a Drag wrapping one card, the shape /Admin/SectionRow has ──────
    const row = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Rows/DragRow',
      nodes: [
        {
          id: 'inputs',
          type: 'Component Inputs',
          // `For Each` sets every declared input to the model field of the same name, so this
          // port list IS what the row can see.
          ports: [
            { name: 'label', type: 'string', plug: 'output' },
            { name: 'ccls', type: 'string', plug: 'output' },
            { name: 'icls', type: 'string', plug: 'output' },
            { name: 'rcls', type: 'string', plug: 'output' },
            { name: 'bcls', type: 'string', plug: 'output' }
          ]
        },
        {
          id: 'drag',
          type: 'Drag',
          label: 'Drag this section',
          // `useParentBounds: false` because the list is exactly as tall as its rows, so
          // constraining to the parent pins every gesture to a few pixels and no drag ever
          // crosses a row. A property of this probe page, not advice for the template.
          parameters: { axis: 'y', useParentBounds: false }
        },
        {
          id: 'card',
          type: 'Group',
          parent: 'drag',
          parameters: { sizeMode: 'contentHeight', flexDirection: 'column' }
        },
        {
          id: 'inner',
          type: 'Group',
          parent: 'card',
          parameters: { sizeMode: 'contentHeight', flexDirection: 'column' }
        },
        { id: 'labelText', type: 'Text', parent: 'inner' },
        // Arm 4's subject. A real control, inside the draggable card, where every control in
        // `/Admin/SectionRow` would be.
        { id: 'btn', type: 'net.noodl.controls.button', parent: 'inner', parameters: { label: 'Press me' } },
        { id: 'clickText', type: 'Text', parent: 'inner' },
        {
          id: 'clicked',
          type: 'JavaScriptFunction',
          label: 'Did the button hear a click',
          parameters: { functionScript: 'Outputs.msg = "CLICKED";' },
          ports: [{ name: 'out-msg', plug: 'output', type: 'string' }]
        },
        { id: 'reportText', type: 'Text', parent: 'card' },
        {
          id: 'hit',
          type: 'JavaScriptFunction',
          label: 'Which row did this land on',
          parameters: {
            functionScript: HIT_TEST,
            // §31.1's rule, for the same reason: `Drag Y` changes on every frame, so a node that
            // re-runs when a value arrives would recompute the drop index mid-gesture and the
            // last write before `onStop` would be a position the pointer had already left.
            'runOnChange-in-el': false,
            'runOnChange-in-dy': false
          },
          ports: [
            { name: 'in-el', plug: 'input', type: '*' },
            { name: 'in-dy', plug: 'input', type: 'number' },
            { name: 'out-report', plug: 'output', type: 'string' }
          ]
        }
      ],
      connections: [
        { fromId: 'inputs', fromProperty: 'label', toId: 'labelText', toProperty: 'text' },
        // The three CSS classes, all by connection, at three depths — see the cssClassName spec.
        { fromId: 'inputs', fromProperty: 'ccls', toId: 'card', toProperty: 'cssClassName' },
        { fromId: 'inputs', fromProperty: 'icls', toId: 'inner', toProperty: 'cssClassName' },
        { fromId: 'inputs', fromProperty: 'rcls', toId: 'reportText', toProperty: 'cssClassName' },
        { fromId: 'inputs', fromProperty: 'bcls', toId: 'clickText', toProperty: 'cssClassName' },
        { fromId: 'btn', fromProperty: 'onClick', toId: 'clicked', toProperty: 'run' },
        { fromId: 'clicked', fromProperty: 'out-msg', toId: 'clickText', toProperty: 'text' },

        // The gesture: the card's element in, the drag distance in, the release as the trigger.
        { fromId: 'card', fromProperty: 'this', toId: 'hit', toProperty: 'in-el' },
        { fromId: 'drag', fromProperty: 'positionY', toId: 'hit', toProperty: 'in-dy' },
        { fromId: 'drag', fromProperty: 'onStop', toId: 'hit', toProperty: 'run' },
        { fromId: 'hit', fromProperty: 'out-report', toId: 'reportText', toProperty: 'text' }
      ]
    });
    // eslint-disable-next-line no-console
    if (row.isError) console.log('door refused the row:', JSON.stringify(row).slice(0, 3000));
    expect(row.isError).toBe(false);

    const page = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/DragRows',
      nodes: [
        { id: 'pg', type: 'Page', parameters: { title: 'Drag rows', urlPath: 'dragrows' } },
        {
          id: 'list',
          type: 'Group',
          parent: 'pg',
          parameters: { sizeMode: 'contentHeight', flexDirection: 'column', cssClassName: 'probe-list' }
        },
        {
          id: 'rows',
          type: 'For Each',
          parent: 'list',
          parameters: { templateType: 'explicit', template: '/Rows/DragRow' }
        },
        { id: 'data', type: 'Static Data', parameters: { type: 'json', json: JSON.stringify(ROWS) } },
        // The render control: a literal, on the same page, through the same Text node.
        { id: 'ctl', type: 'Text', parent: 'pg', parameters: { text: CONTROL_TEXT, cssClassName: 'probe-ctl' } }
      ],
      connections: [{ fromId: 'data', fromProperty: 'items', toId: 'rows', toProperty: 'items' }]
    });
    // eslint-disable-next-line no-console
    if (page.isError) console.log('door refused the page:', JSON.stringify(page).slice(0, 3000));
    expect(page.isError).toBe(false);

    await withRenderedPage({ projectDir: dir }, async (p: RenderedPage) => {
      await p.setViewport({ width: 900, height: 900 });

      const read = async (): Promise<Reading> => JSON.parse(await p.evaluate(READ));
      const centre = (r: Reading, k: string) => r[k].top + r[k].height / 2;
      const X = 200;

      /**
       * One arm, on a page loaded for it.
       *
       * 🔴 **The reload is not hygiene, it is a finding acted on.** `Drag` leaves the element
       * translated where the pointer dropped it — `react-draggable` keeps the transform, and
       * nothing in the runtime puts it back. So a second arm run on the same load measures a page
       * whose first row is sitting three rows lower than its DOM position, and a third arm presses
       * on whichever card happens to be under that coordinate. The first version of this drive did
       * exactly that and read `idx=0` and `NaN` — both of which were the page answering honestly
       * about a state the arms had not accounted for.
       *
       * The same fact is the reason the template needs `Snap To Position Y → 0` on the reorder's
       * `done`: after a successful write the list re-renders in the new order, and a leftover
       * transform would move the row a second time. See §33.
       */
      async function arm(cardIndex: number, reportKey: string, target: (r: Reading) => number) {
        await p.navigate('/dragrows');
        await wait(2500);
        const before = await read();
        const from = centre(before, `card${cardIndex}`);
        await dragBy(p, X, from, target(before) - from);
        const after = await read();
        return { before, report: parse(after[reportKey].text) };
      }

      // ── Arm 1: card 0 (row A, shortest) dragged DOWN past both others ────────────────
      // Its centre must clear card 2's centre. The distance is read off the page rather than
      // computed from the authored rows, because the rows are authored in LINES and the browser
      // owns the line height.
      const one = await arm(0, 'probe-report-a', (r) => centre(r, 'card2') + 8);
      boot = one.before;
      armDown = one.report;
      // eslint-disable-next-line no-console
      console.log('        booted:', JSON.stringify(boot));
      // eslint-disable-next-line no-console
      console.log('        arm 1 (A down past B and C):', armDown.raw);

      // ── Arm 2: card 2 (row C) dragged UP past card 1 only, NOT past card 0 ───────────
      // A different row, a different direction, and it must give a different answer.
      //
      // 🔴 The target is the midpoint between card 0's centre and card 1's centre, and the
      // arithmetic is the point rather than the tolerance: card 1 is the TALL row, so "past card
      // 1" is decided by its centre and not by its edge — a drop 6px above card 1's own centre is
      // still 60px inside card 1's box. A first pass aimed 6px BELOW that centre and read `idx=2`,
      // which is card 2 correctly being told to stay where it is. Landing between the two centres
      // is the only placement that means "index 1" and cannot mean anything else, and it is what
      // an implementation dividing one distance by one pitch cannot produce.
      armUp = (await arm(2, 'probe-report-c', (r) => (centre(r, 'card0') + centre(r, 'card1')) / 2)).report;
      // eslint-disable-next-line no-console
      console.log('        arm 2 (C up past B only):', armUp.raw);

      // ── Arm 3: the no-move control — press card 1 and release it where it stands ─────
      armStill = (await arm(1, 'probe-report-b', (r) => centre(r, 'card1') + 4)).report;
      // eslint-disable-next-line no-console
      console.log('        arm 3 (B stays put):', armStill.raw);

      // ── Arm 4: a plain click on a BUTTON inside the draggable card ──────────────────
      // The template's card is nothing but controls — a textarea, a file picker, Save, Delete —
      // so "can the row still be operated once it is draggable" decides whether the template can
      // adopt this at all. Press and release on the same pixel: a click, not a gesture.
      await p.navigate('/dragrows');
      await wait(2500);
      const forClick = await read();
      const bx = forClick.btn.cx as number;
      const by = forClick.btn.cy as number;
      await p.client.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: bx,
        y: by,
        button: 'left',
        buttons: 1,
        clickCount: 1
      });
      await wait(60);
      await p.client.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: bx,
        y: by,
        button: 'left',
        buttons: 1,
        clickCount: 1
      });
      await wait(400);
      const clicked = await read();
      clickInsideDrag = clicked['probe-click-a'].text;
      // eslint-disable-next-line no-console
      console.log('        arm 4 (click a button inside the card):', JSON.stringify(clickInsideDrag), 'button at', bx, by);

      controlProbe = clicked['probe-ctl'];
      consoleErrors = p.consoleErrors.slice();
    });
  });

  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('CONTROL — the page rendered, three rows exist, and they are three DIFFERENT heights', () => {
    expect(controlProbe.text).toContain(CONTROL_TEXT);
    expect(boot.cardCount.text).toBe('3');
    // The clause s29 did NOT disprove, reproduced on purpose rather than assumed away.
    const heights = [boot.card0.height, boot.card1.height, boot.card2.height];
    expect(new Set(heights).size).toBe(3);
    expect(Math.min(...heights)).toBeGreaterThan(0);
  });

  it('CONTROL — the hit test counted over the LIST, not a wrapper, and saw exactly two siblings', () => {
    // An index counted over the wrong parent is still a plausible small integer. This is the
    // check that says which parent it was counted over.
    expect(armDown.pc).toBe('probe-list');
    expect(armDown.sib).toBe(2);
  });

  it('a real pointer drag moves the row and the graph is told how far — Drag Y is not zero', () => {
    // The half nobody had run: whether `react-draggable` sees a pointer at all inside a `For
    // Each` item. If this is 0, every arm below is arithmetic over a gesture that never happened.
    expect(Math.abs(armDown.dy)).toBeGreaterThan(30);
  });

  it('dragging the FIRST row down past both others produces toIndex 2', () => {
    expect(armDown.idx).toBe(2);
  });

  it('and dragging the LAST row up past ONE other produces toIndex 1 — a different answer', () => {
    expect(armUp.idx).toBe(1);
    expect(armUp.idx).not.toBe(armDown.idx);
  });

  it('a press-and-release that goes nowhere answers the row it started on, not an edge', () => {
    // Card 1 is index 1 and neither arm above moved it. An implementation that always reports
    // "last", always reports "first", or rounds a near-zero distance badly, fails exactly here.
    expect(armStill.idx).toBe(1);
    expect(Math.abs(armStill.dy)).toBeLessThan(12);
  });

  /**
   * 🔴 Found by driving, and not on any register: **a `Drag`'s direct child loses its CSS class.**
   *
   * `react-draggable` clones the child with its own `className` and the card's authored one does
   * not survive it. The two controls are what make this about `Drag` rather than about
   * `cssClassName`: `inner` sits one level further in and takes its class by the SAME kind of
   * connection from the SAME `Component Inputs` node, and `reportText` is a third. If a connected
   * `cssClassName` simply did not apply, all three would be bare.
   *
   * It bites a person the moment they style, animate or select a draggable row from a stylesheet —
   * most of what anyone does with a drag — and it fails silently: the class is accepted in the
   * editor, stored in the graph, and absent from the DOM. Registered as **D28**.
   *
   * ✅ **FIXED 2026-08-30 as phase 80's DEF-027, and the last two assertions are flipped rather
   * than deleted, exactly as this block asked.** The discarding was the *spread's*, not `Drag`'s:
   * `NoodlReactComponent.render` merged `...noodlNode.props` then `...otherProps`, and the
   * library's injected `className` — landing in `otherProps` — overwrote the author's. It could
   * not merge on the library's side either, because the child `react-draggable` clones is the
   * wrapper element, whose props are only `{key, noodlNode, ref}`, so its own
   * `clsx(children.props.className || '', …)` had nothing to see. The two now accumulate, which
   * is what class names do; `style` keeps its deliberate parent-wins precedence.
   *
   * `READ` reads the cards by `probe-card-` now instead of borrowing `.react-draggable`. The
   * first two assertions were the controls that made this about `Drag` rather than about
   * `cssClassName`, and they stay.
   */
  it('a Drag child keeps its cssClassName (was the D28 pin, flipped when DEF-027 fixed it)', () => {
    expect(boot['probe-inner-a']).toBeDefined();
    expect(boot['probe-report-a']).toBeDefined();

    expect(boot['probe-card-a']).toBeDefined();
    expect(boot.card0.text).toContain('probe-card-a');
    expect(boot.card0.text).toContain('react-draggable');
  });

  /**
   * The question that decides whether `/Admin/SectionRow` can adopt this at all: the card there is
   * nothing BUT controls — a textarea, a file picker, `Save`, `Delete`. `react-draggable` starts on
   * `mousedown` anywhere in its child and there is no `handle` or `cancel` port on the `Drag` node,
   * so if the press is swallowed the whole row becomes undraggable-or-unusable, pick one.
   */
  it('a button inside the draggable card is still clickable — the drag does not eat the press', () => {
    expect(clickInsideDrag).toBe('CLICKED');
  });

  it('and the runtime raised nothing while doing it', () => {
    expect(consoleErrors).toEqual([]);
  });
});
