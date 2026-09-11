/**
 * DEF-003 (c) — the drive that changed what this task was.
 *
 * Phase 76 recorded F16 as *"a `Page` node's `title` port is dead after export"*; the task file
 * sharpened it to *"an agent authoring headlessly cannot set a page title at all"*, on the strength
 * of `get_node_type("Page")` answering `notFound: ["title", "urlPath"]` and a `runtimeBehavior`
 * that said both were *"registered per instance by the editor connection"*.
 *
 * 🔴 **That reading is false, and only a browser could say so.** The catalog was right that the
 * *port declaration* came from the editor; it said nothing about the *parameter*, and the exporter
 * has always read `title` and `urlPath` straight off the node into the router index
 * (`editor/src/utils/exporter/router.ts`, `_getPageInfo`), from which the Router hands the title to
 * `Noodl.SEO.setTitle`. So the value worked the whole time and the door reported it as an unknown
 * port. §6 of the task file called this out in advance — *"(c) is read from the door, not driven;
 * drive it before building the fix"* — and it is the reason this row cost a catalog declaration
 * rather than a runtime change.
 *
 * ## What makes this a measurement
 *
 * 1. **Authored through the real door.** The page is written by `create_component` on a real
 *    `ProjectStore`, gate and all — not hand-written JSON that agrees with the door until the first
 *    edit to either.
 * 2. **No editor, ever.** Nothing in this file starts Electron or an editor connection, which is
 *    the whole claim under test.
 * 3. **A control that discriminates.** A second page, identical but for the `title` parameter,
 *    must come back with a *different* title. Without it, "the title is right" is a sentence a
 *    harness could produce by accident — and the first version of this drive did exactly that: the
 *    untitled page read `"undefined"`, a string the product cannot produce, because
 *    `render-from-disk.js` was missing the exporter's component-name fallback. That was a defect in
 *    the instrument, fixed there, and it is why the control asserts a *name* and not merely
 *    "something else".
 *
 * ⚠️ Needs the built viewer bundle and a Chrome — `checkPrerequisites` inside `withRenderedPage`
 * fails with the exact command to run if either is missing, the same contract `@noodl/preview`'s
 * suite uses. CI builds the viewer in this job before running it.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { CreateComponentResponse } from '../src/tools/responses';

import { call, connect, copyFixture, TestSession } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { withRenderedPage } = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js'));

jest.setTimeout(600000);

const TITLE = 'The Honest Title';

/** Everything one visit yields, in a single evaluate: a report from five moments is about none. */
const READ = `(function () {
  return JSON.stringify({
    title: document.title,
    text: document.body ? document.body.innerText : ''
  });
})()`;

interface Visit {
  title: string;
  text: string;
}

/** The slice of `withRenderedPage`'s page this drive uses. The helper is plain JS under `scripts/`. */
interface RenderedPage {
  navigate(urlPath: string): Promise<void>;
  evaluate(expression: string): Promise<string>;
}

/** The one field this drive reads back off disk. */
interface NodeOnDisk {
  type: string;
  parameters?: Record<string, unknown>;
}

/**
 * DEF-003 (a) — what a bare number on a dimension port actually renders as.
 *
 * `unitless-dimension` has told authors since phase 40 that `width: 240` *"renders at 240%"*, and
 * nothing measured that. A diagnostic's claim about the DOM is a claim like any other; this is the
 * arm that keeps it true, and it is why the same probe carries the object form beside it.
 *
 * The bare form is written to disk **after** the door has passed the component, because the door
 * refuses it — which is the point of (a) and also the state every legacy project is already in.
 */
const WIDTH_PROBE = `(function () {
  var out = {};
  document.querySelectorAll('[class*=probe-]').forEach(function (el) {
    out[(el.className.match(/probe-[a-z]+/) || [])[0]] = {
      offsetWidth: el.offsetWidth,
      parentWidth: el.parentElement ? el.parentElement.offsetWidth : null,
      paddingLeft: getComputedStyle(el).paddingLeft
    };
  });
  return JSON.stringify(out);
})()`;

interface Measured {
  offsetWidth: number;
  parentWidth: number;
  paddingLeft: string;
}

/**
 * Module scope, deliberately: the (a)/(b) rows below read what the (c) drive already put on the
 * screen. One browser, one project, one set of renders — a second `withRenderedPage` would be a
 * second page, and "the padded Text has no padding" and "the wrapping Group does" are only one
 * comparison if they came off the same DOM.
 */
let measured: Record<string, Measured>;

describe('DEF-003 (c) — a page title, authored headlessly, in a browser', () => {
  let dir: string;
  let session: TestSession;
  let visits: Record<string, Visit>;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);

    const titled = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Titled',
      nodes: [
        { id: 'tp', type: 'Page', parameters: { title: TITLE, urlPath: 'titled' } },
        { id: 'tt', type: 'Text', parent: 'tp', parameters: { text: 'titled page body' } }
      ]
    });
    expect(titled.isError).toBe(false);

    // The control: the same page, minus the one parameter under test.
    const plain = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Plain',
      nodes: [
        { id: 'pp', type: 'Page', parameters: { urlPath: 'plain' } },
        { id: 'pt', type: 'Text', parent: 'pp', parameters: { text: 'plain page body' } }
      ]
    });
    expect(plain.isError).toBe(false);

    // (a)'s probe page: authored clean, then given the shapes the door refuses.
    const probe = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Probe',
      nodes: [
        { id: 'pb', type: 'Page', parameters: { title: 'Probe', urlPath: 'probe' } },
        { id: 'bare', type: 'Text', parent: 'pb', parameters: { text: 'bare', cssClassName: 'probe-bare' } },
        { id: 'obj', type: 'Text', parent: 'pb', parameters: { text: 'obj', cssClassName: 'probe-obj' } },
        { id: 'pad', type: 'Text', parent: 'pb', parameters: { text: 'pad', cssClassName: 'probe-pad' } },
        {
          id: 'wrap',
          type: 'Group',
          parent: 'pb',
          parameters: { paddingLeft: { value: 24, unit: 'px' }, cssClassName: 'probe-wrap' }
        },
        { id: 'inner', type: 'Text', parent: 'wrap', parameters: { text: 'inner', cssClassName: 'probe-inner' } }
      ]
    });
    expect(probe.isError).toBe(false);

    const probeFile = path.join(dir, 'components/Pages/Probe/nodes.json');
    const probeNodes = JSON.parse(fs.readFileSync(probeFile, 'utf8')) as { nodes: NodeOnDisk[] };
    for (const node of probeNodes.nodes) {
      const parameters = node.parameters as Record<string, unknown>;
      if (node.type === 'Text' && parameters?.cssClassName === 'probe-bare') parameters.width = 240;
      if (node.type === 'Text' && parameters?.cssClassName === 'probe-obj') {
        parameters.width = { value: 240, unit: 'px' };
      }
      if (node.type === 'Text' && parameters?.cssClassName === 'probe-pad') parameters.paddingLeft = 24;
    }
    fs.writeFileSync(probeFile, JSON.stringify(probeNodes, null, 2));

    visits = await withRenderedPage({ projectDir: dir }, async (page: RenderedPage) => {
      const seen: Record<string, Visit> = {};
      for (const urlPath of ['titled', 'plain']) {
        await page.navigate(`/${urlPath}`);
        // The router mounts the page and sets the title in the same tick it renders the body, so
        // the body text below is the settle signal as well as an assertion.
        await new Promise((resolve) => setTimeout(resolve, 2500));
        seen[urlPath] = JSON.parse(await page.evaluate(READ));
      }
      await page.navigate('/probe');
      await new Promise((resolve) => setTimeout(resolve, 2500));
      measured = JSON.parse(await page.evaluate(WIDTH_PROBE));
      return seen;
    });
  });

  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('the door writes the parameter rather than refusing it', () => {
    const nodes = JSON.parse(
      fs.readFileSync(path.join(dir, 'components/Pages/Titled/nodes.json'), 'utf8')
    ) as { nodes: NodeOnDisk[] };
    expect(nodes.nodes.find((n: NodeOnDisk) => n.type === 'Page')?.parameters?.title).toBe(TITLE);
  });

  it('carries that title into the browser, with no editor anywhere in the path', () => {
    expect(visits.titled.text).toContain('titled page body');
    expect(visits.titled.title).toBe(TITLE);
  });

  it('and the control page, identical but for the parameter, does NOT', () => {
    // Its title is the component name, which is the exporter's documented fallback — so this row
    // also fails if the fallback silently becomes `undefined` again.
    expect(visits.plain.text).toContain('plain page body');
    expect(visits.plain.title).toBe('Plain');
    expect(visits.plain.title).not.toBe(TITLE);
  });

  it('and `urlPath` worked too — the page was reachable at the path it named', () => {
    // Both pages were reached by navigating to their own `urlPath`. If that parameter needed an
    // editor either, neither visit above could have found its page.
    expect(visits.titled.text).not.toContain('plain page body');
  });
});

describe('DEF-003 (a)/(b) — the two claims the diagnostics make about the DOM', () => {
  it('a bare number really does render as a percentage of the parent', () => {
    // 240% of the page's 756px content box. `unitless-dimension` says "renders at 240%"; this is
    // that sentence, measured. A tolerance rather than an equality: the parent width is whatever
    // the harness viewport gives, and the claim is the ratio.
    expect(measured['probe-bare'].offsetWidth).toBeCloseTo(measured['probe-bare'].parentWidth * 2.4, 0);
  });

  it('the object form the diagnostic proposes renders at the size it asks for', () => {
    // The repair must not itself be a defect — the whole reason the message offers both units
    // rather than guessing one.
    expect(measured['probe-obj'].offsetWidth).toBe(240);
  });

  it('padding on a Text is dropped, and the same value on a Group is not', () => {
    // (b)'s claim, measured on one page so neither reading can be about a different render.
    expect(measured['probe-pad'].paddingLeft).toBe('0px');
    expect(measured['probe-wrap'].paddingLeft).toBe('24px');
  });
});
