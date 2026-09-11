/**
 * Phase 77 D23 — "no visual node reports its rendered geometry, so a drag cannot know what it is
 * over". This file is the drive that answers it, and the answer is **no: they all do**.
 *
 * D23's measurement grepped `packages/noodl-viewer-react/src/nodes` (67 files, 51 `outputs:`
 * blocks) for an output naming `clientHeight`/`offsetHeight`/`measuredHeight`/`boundingBox`/
 * `boundingClientRect` and read **0**, beside a control (`displayName` matching
 * height/width/size/bounds/top/left) that fired **20**. The control was run over the same
 * directory as the finding, so it could confirm the grep reached port declarations and could not
 * confirm it reached *these* port declarations: the four `Bounding Box` outputs are declared once,
 * for every visual node, in `react-component-node.ts:1053-1111` — a file that is not in `nodes/`.
 *
 * 🔴 **The trap is that the row's proposed fix would have shipped a dead port.** D23 offered "a
 * `domelement` output on `Group` (three lines, `video.ts:283-288` is the template)". Measured over
 * the 175-node catalog, `domelement` has **1 output** (`Video.onVideoElementCreated`) and **0
 * inputs**, and `nodelibraryexport.ts` casts it to `[]` — so a second one would have been the
 * second port in the product that cannot be connected to anything. That is recorded as D27.
 *
 * ## What makes this a measurement rather than a catalog reading
 *
 * A port declaration is a claim. These four are *getters* over `clientBoundingRect`, filled by a
 * polling `DOMBoundingBoxObserver` that only starts on `onFirstConnectionAdded` — so "the port
 * exists" and "the port reports the number" are genuinely different questions, and only a browser
 * separates them.
 *
 * **Two boxes, two different authored heights**, both read back through the port and through a
 * `Function` node. One box could be satisfied by a port reporting the viewport, the page, or a
 * constant; two boxes that disagree by exactly the amount they were authored to disagree by cannot.
 * The literal `Text` beside them is the render control — if it is missing, no reading here is about
 * anything.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { CreateComponentResponse } from '../src/tools/responses';

import { call, connect, copyFixture, TestSession } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withRenderedPage } = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js'));

jest.setTimeout(600000);

/** Authored heights. Different on purpose: a port reporting anything else cannot produce both. */
const H_A = 160;
const H_B = 240;
const W_A = 320;

const CONTROL_TEXT = 'render control literal';

/**
 * The script arm. `Group.this` is a `reference` output carrying the node itself, and a `Function`
 * node's author-declared input defaults to type `*` (`simplejavascript.ts:699`), which
 * `canCastPortTypes` accepts from anything. So this connection is legal today, with no runtime
 * change — and `getDOMElement()` is the same accessor `Group.tsx`'s own `Scroll To Element` uses.
 */
const SCRIPT = [
  'var el = Inputs.el && Inputs.el.getDOMElement && Inputs.el.getDOMElement();',
  'Outputs.rect = el ? String(Math.round(el.getBoundingClientRect().height)) : "NO-ELEMENT";'
].join('\n');

interface RenderedPage {
  navigate(urlPath: string): Promise<void>;
  evaluate(expression: string): Promise<string>;
}

/** One evaluate, one moment: a report assembled from five reads is about none of them. */
const READ = `(function () {
  var out = {};
  document.querySelectorAll('[class*=probe-]').forEach(function (el) {
    var key = (el.className.match(/probe-[a-z-]+/) || [])[0];
    out[key] = { text: el.innerText, offsetHeight: el.offsetHeight };
  });
  return JSON.stringify(out);
})()`;

interface Read {
  text: string;
  offsetHeight: number;
}

let seen: Record<string, Read>;

describe('D23 — whether a graph can see the geometry a node actually rendered at', () => {
  let dir: string;
  let session: TestSession;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);

    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Geometry',
      nodes: [
        { id: 'pg', type: 'Page', parameters: { title: 'Geometry', urlPath: 'geometry' } },

        // The two subjects, authored to differ.
        {
          id: 'boxA',
          type: 'Group',
          parent: 'pg',
          parameters: {
            height: { value: H_A, unit: 'px' },
            width: { value: W_A, unit: 'px' },
            cssClassName: 'probe-boxa'
          }
        },
        {
          id: 'boxB',
          type: 'Group',
          parent: 'pg',
          parameters: { height: { value: H_B, unit: 'px' }, cssClassName: 'probe-boxb' }
        },

        // The readouts.
        { id: 'outA', type: 'Text', parent: 'pg', parameters: { cssClassName: 'probe-outa' } },
        { id: 'outB', type: 'Text', parent: 'pg', parameters: { cssClassName: 'probe-outb' } },
        { id: 'outW', type: 'Text', parent: 'pg', parameters: { cssClassName: 'probe-outw' } },
        { id: 'outS', type: 'Text', parent: 'pg', parameters: { cssClassName: 'probe-outs' } },

        // The render control: a literal, on the same page, through the same Text node.
        {
          id: 'ctl',
          type: 'Text',
          parent: 'pg',
          parameters: { text: CONTROL_TEXT, cssClassName: 'probe-ctl' }
        },

        // The script arm.
        {
          id: 'js',
          type: 'JavaScriptFunction',
          parameters: { functionScript: SCRIPT },
          ports: [
            { name: 'in-el', plug: 'input', type: '*' },
            { name: 'out-rect', plug: 'output', type: 'string' }
          ]
        }
      ],
      connections: [
        // The finding, twice over, on two boxes that must disagree.
        { fromId: 'boxA', fromProperty: 'boundingHeight', toId: 'outA', toProperty: 'text' },
        { fromId: 'boxB', fromProperty: 'boundingHeight', toId: 'outB', toProperty: 'text' },
        { fromId: 'boxA', fromProperty: 'boundingWidth', toId: 'outW', toProperty: 'text' },

        // The script arm: a node reference into a Function, and its answer back out.
        { fromId: 'boxA', fromProperty: 'this', toId: 'js', toProperty: 'in-el' },
        { fromId: 'boxA', fromProperty: 'didMount', toId: 'js', toProperty: 'run' },
        { fromId: 'js', fromProperty: 'out-rect', toId: 'outS', toProperty: 'text' }
      ]
    });
    // eslint-disable-next-line no-console
    if (res.isError) console.log('door refused:', JSON.stringify(res).slice(0, 2000));
    expect(res.isError).toBe(false);

    seen = await withRenderedPage({ projectDir: dir }, async (page: RenderedPage) => {
      await page.navigate('/geometry');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return JSON.parse(await page.evaluate(READ));
    });
    // eslint-disable-next-line no-console
    console.log('        read back:', JSON.stringify(seen));
  });

  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('CONTROL — the page rendered at all, and the two boxes are the heights they were authored at', () => {
    expect(seen['probe-ctl'].text).toContain(CONTROL_TEXT);
    expect(seen['probe-boxa'].offsetHeight).toBe(H_A);
    expect(seen['probe-boxb'].offsetHeight).toBe(H_B);
  });

  it('a Group reports the height it actually rendered at, on a wire, with no runtime change', () => {
    expect(Number(seen['probe-outa'].text)).toBe(H_A);
  });

  it('and a second Group reports a DIFFERENT height — so the port is reading the element, not the page', () => {
    expect(Number(seen['probe-outb'].text)).toBe(H_B);
    expect(seen['probe-outb'].text).not.toBe(seen['probe-outa'].text);
  });

  it('width comes back the same way, so this is a bounding box and not one lucky port', () => {
    expect(Number(seen['probe-outw'].text)).toBe(W_A);
  });

  it("and a script can reach the element itself through `This`, which is what a drag's hit-test needs", () => {
    // D23's stated blocker was that a drag cannot compute an index because it cannot get the row
    // pitch. This is the row pitch, measured by a Function node in the graph.
    expect(seen['probe-outs'].text).not.toBe('NO-ELEMENT');
    expect(Number(seen['probe-outs'].text)).toBe(H_A);
  });
});
