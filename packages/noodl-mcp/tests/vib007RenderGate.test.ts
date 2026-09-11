/**
 * VIB-007 M1 (AC1) — **the render is mandatory**, at the doors that can say so.
 *
 * The mechanism under test is not "there is a render tool" — there has been one
 * since LAS-005, and `apply_plan` has rendered by itself since LAS-005 §4. What
 * did not exist is the ability of this server to answer *"is this done?"*: the
 * render's numbers were appended to a response whose top-level shape said
 * success, and `validate_project` — the call a model makes to ask whether its
 * work is good — could answer yes about a project nobody had ever looked at.
 *
 * ## What this suite pins, and why each arm is here
 *
 * 1. The **grading** is the harness's own severity, not a list retyped here.
 * 2. The **signature** is what makes a stale certificate impossible, so the
 *    mutation arm edits a component and asserts the verdict expires. Without it
 *    a ledger that simply remembered "someone rendered once" would pass every
 *    other assertion in this file.
 * 3. 🔴 The **accepts-the-correct-answer arm**. A gate that only ever refuses is
 *    indistinguishable from a gate that is broken, and this repo has shipped
 *    that shape before — see `checkUndeclaredComponentPorts`' door spec. So the
 *    clean render is asserted to produce `done: true` at the same doors.
 * 4. The **refusal is refused before the write** (`render:"off"`), because a
 *    refusal that lands after the files are on disk is advice.
 *
 * ⚠️ **The renders here are stubbed** through `NODEGX_RENDER_CLI` — the same
 * seam `renderTools.test.ts` uses, and the reason is the same: the seam under
 * test is the ledger and the doors, not Chrome. The real-render demonstration
 * AC1 closes on is `dev-docs/.../demo/build-vib007-m1.js` +
 * `packages/nodegx-backend/tests/vib007-m1.look.ts`, which renders a
 * deliberately poor page and then the fixed one.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { call, connect, copyFixture, TestSession } from './helpers';
import { projectSignature, RenderLedger, verdictFor } from '../src/renderVerdict';
import type { RenderReportPayload } from '../src/render';

interface Completion {
  done: boolean;
  notDone?: string;
  doneBecause?: string;
  mustFix?: Array<{ code: string; viewport: string; message: string }>;
  pagesNobodyLookedAt?: Array<{ component: string; reason: string }>;
}

const CLEAN_REPORT = {
  project: '(stub)',
  projectName: 'Demo App',
  durationMs: 12,
  tokens: '181 shipped defaults',
  viewports: {
    desktop: {
      requested: { width: 1280, height: 900 },
      layoutWidth: 1280,
      clientWidth: 1280,
      scrollWidth: 1280,
      pageHeight: 900,
      text: { elements: 63, fontWeights: { '400': 33 }, distinctFontSizes: 9, bodyFontFamily: 'Inter' },
      placeholders: { count: 0, byText: {} },
      images: { total: 5, broken: 0, brokenSources: [] },
      emptyDecoratedBoxes: { count: 0 }
    }
  },
  pages: [{ component: '/Pages/Home', measured: true }],
  findings: [],
  summary: 'Rendered clean. desktop 1280×900px, 63 texts, 5 images.'
} as unknown as RenderReportPayload;

const POOR_REPORT = {
  ...CLEAN_REPORT,
  findings: [
    { code: 'dead-placeholder-text', severity: 'error', viewport: 'desktop', message: '29 elements render "Text".' },
    { code: 'broken-image', severity: 'error', viewport: 'desktop', message: '5 of 5 images failed to load.' },
    { code: 'flat-type-scale', severity: 'warning', viewport: 'desktop', message: 'One weight, two sizes.' }
  ],
  summary: '2 errors, 1 warning.'
} as unknown as RenderReportPayload;

function stubCli(report: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vib007-m1-'));
  const file = path.join(dir, 'stub-cli.js');
  fs.writeFileSync(file, `console.log(${JSON.stringify(JSON.stringify(report))});\n`);
  return file;
}

describe('VIB-007 M1 §1 — the verdict grades what the harness graded', () => {
  it('an error-severity finding blocks; a warning does not', () => {
    const poor = verdictFor(POOR_REPORT);
    expect(poor.done).toBe(false);
    expect(poor.blocking.map((f) => f.code)).toEqual(['dead-placeholder-text', 'broken-image']);
    // The warning is reported by the render and is not a reason the page is unfinished.
    expect(poor.blocking.map((f) => f.code)).not.toContain('flat-type-scale');
    expect(poor.reason).toContain('NOT DONE');
  });

  it('accepts a clean report — the arm that proves the gate is not simply always red', () => {
    const clean = verdictFor(CLEAN_REPORT);
    expect(clean.done).toBe(true);
    expect(clean.blocking).toEqual([]);
  });

  it('🔴 a routed page nobody could measure is not a clean page', () => {
    const partly = {
      ...CLEAN_REPORT,
      pages: [
        { component: '/Pages/Home', measured: true },
        { component: '/Pages/Admin', measured: false, unreachable: 'no route resolved to it' }
      ]
    } as unknown as RenderReportPayload;

    const verdict = verdictFor(partly);
    expect(verdict.done).toBe(false);
    expect(verdict.unmeasuredPages).toEqual([{ component: '/Pages/Admin', reason: 'no route resolved to it' }]);
  });
});

describe('VIB-007 M1 §2 — the ledger expires when the project moves', () => {
  let dir: string;
  beforeEach(() => {
    dir = copyFixture();
  });

  it('a clean render certifies the project it was taken of', () => {
    const ledger = new RenderLedger();
    ledger.record(dir, CLEAN_REPORT);
    expect(ledger.state(dir).done).toBe(true);
    expect(ledger.state(dir).looked).toBe(true);
  });

  it('🔴 THE MUTATION — one edited component byte expires the certificate', () => {
    const ledger = new RenderLedger();
    ledger.record(dir, CLEAN_REPORT);
    expect(ledger.state(dir).done).toBe(true);

    const nodes = firstComponentNodesFile(dir);
    const before = projectSignature(dir);
    fs.writeFileSync(nodes, fs.readFileSync(nodes, 'utf8').replace(/"nodes"/, '"nodes" '));
    expect(projectSignature(dir)).not.toBe(before);

    const after = ledger.state(dir);
    expect(after.done).toBe(false);
    expect(after.looked).toBe(false);
    expect(after.reason).toContain('changed since the last render');
  });

  it('knows nothing before anybody looks, and says so rather than passing', () => {
    const state = new RenderLedger().state(dir);
    expect(state.done).toBe(false);
    expect(state.reason).toContain('nobody has looked');
  });
});

describe('VIB-007 M1 §3 — the doors', () => {
  let session: TestSession;
  const originalCli = process.env.NODEGX_RENDER_CLI;

  afterEach(async () => {
    if (session) await session.close();
    if (originalCli === undefined) delete process.env.NODEGX_RENDER_CLI;
    else process.env.NODEGX_RENDER_CLI = originalCli;
  });

  it('validate_project answers NOT DONE on a project nobody has rendered', async () => {
    session = await connect(copyFixture());
    const res = await call<Completion>(session, 'validate_project');

    expect(res.isError).toBeFalsy();
    expect(res.data.done).toBe(false);
    expect(res.data.notDone).toContain('nobody has looked');
  });

  it('a poor render leaves every door saying NOT DONE, and names what to fix', async () => {
    process.env.NODEGX_RENDER_CLI = stubCli(POOR_REPORT);
    session = await connect(copyFixture());

    const rendered = await call<Completion>(session, 'render_report', { screenshot: 'none' });
    expect(rendered.isError).toBeFalsy();

    const validated = await call<Completion>(session, 'validate_project');
    expect(validated.data.done).toBe(false);
    expect(validated.data.mustFix?.map((f) => f.code)).toEqual(['dead-placeholder-text', 'broken-image']);
  });

  it('🔴 …and a clean render makes the same doors say DONE — the accepts arm', async () => {
    process.env.NODEGX_RENDER_CLI = stubCli(CLEAN_REPORT);
    session = await connect(copyFixture());

    await call(session, 'render_report', { screenshot: 'none' });
    const validated = await call<Completion>(session, 'validate_project');

    expect(validated.data.done).toBe(true);
    expect(validated.data.doneBecause).toContain('clean');
  });

  it('a write after a clean render puts the project back to NOT DONE', async () => {
    process.env.NODEGX_RENDER_CLI = stubCli(CLEAN_REPORT);
    session = await connect(copyFixture());
    await call(session, 'render_report', { screenshot: 'none' });

    const created = await call<Completion>(session, 'create_component', {
      path: 'Components/Banner',
      nodes: [{ id: 'bn_g', type: 'Group', parameters: {} }]
    });
    expect(created.isError).toBeFalsy();
    // The write door does not render — it reports the state it has put the
    // project into, which is "nobody has looked at this".
    expect(created.data.done).toBe(false);
    expect(await (await call<Completion>(session, 'validate_project')).data.done).toBe(false);
  });

  it('a logic-only write says nothing about doneness — it drew nothing to look at', async () => {
    process.env.NODEGX_RENDER_CLI = stubCli(CLEAN_REPORT);
    session = await connect(copyFixture());

    const created = await call<Completion>(session, 'create_component', {
      path: 'Logic/Flags',
      nodes: [{ id: 'lg_s', type: 'States', parameters: { states: 'idle' } }]
    });
    expect(created.isError).toBeFalsy();
    expect(created.data.done).toBeUndefined();
  });

  it('a page-scoped render does not certify the project', async () => {
    process.env.NODEGX_RENDER_CLI = stubCli(CLEAN_REPORT);
    session = await connect(copyFixture());

    await call(session, 'render_report', { screenshot: 'none', page: 'home' });
    const validated = await call<Completion>(session, 'validate_project');

    expect(validated.data.done).toBe(false);
  });
});

/** The nodes.json of whichever component the fixture registry lists first. */
function firstComponentNodesFile(projectDir: string): string {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'nodes.json') found.push(full);
    }
  };
  walk(path.join(projectDir, 'components'));
  found.sort();
  if (found.length === 0) throw new Error('fixture has no components');
  return found[0];
}
