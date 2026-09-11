/**
 * VIB-007 M1 (AC1) — **the demonstration**: the door refuses to call a poor page done, names why,
 * and accepts after the fix.
 *
 * 🔴 **Not a `.test.ts`.** Like `*.look.ts` in `nodegx-backend`, this is outside `testMatch` and
 * cannot redden a gate, because it spawns a real Chrome through `measure-from-disk.js` and takes
 * ~20s. `vib007RenderGate.test.ts` is the gate; this is the evidence AC1 closes on.
 *
 * ## Why this exists when there is already a unit spec
 *
 * The unit spec stubs the render CLI. That is right for pinning the ledger and the doors, and it is
 * worth nothing as evidence for AC1, whose claim is about a *page* — a stub can be made to say
 * anything, including that a fixed page is clean. This drives the shipped path end to end:
 *
 *   1. `validate_project` on a project nobody has rendered → **NOT DONE**.
 *   2. `render_report` (real Chrome, the real harness) → **NOT DONE**, naming `dead-placeholder-text`
 *      and `broken-image` — the two defects `build-vib007-m1.js` deliberately built in.
 *   3. The fix, applied **through the door** (`update_component`) plus the missing photograph placed
 *      in the project, because a broken image is fixed by the file arriving.
 *   4. `render_report` again → **DONE**, and `validate_project` agrees.
 *
 * 🔴 **Step 4 is the arm that makes the other three mean something.** A gate that never accepts is
 * indistinguishable from a gate that is broken — the same half this repo's icon gate and its
 * undeclared-port door spec each had to be given.
 *
 * Run it:
 *
 *     npx jest --config packages/noodl-mcp/jest.config.js \
 *       --testMatch '**\/tests/**\/*.door.ts' --runTestsByPath \
 *       packages/noodl-mcp/tests/vib007-m1.door.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { call, connect, TestSession } from './helpers';

jest.setTimeout(600_000);

const REPO = path.join(__dirname, '..', '..', '..');
const DEMO = path.join(REPO, 'dev-docs', 'tasks', 'phase-81-the-look-is-the-product', 'demo', 'vib-007-m1');
const PHOTO = path.join(
  REPO,
  'packages',
  'noodl-editor',
  'src',
  'assets',
  'starter-project',
  'noodl_modules',
  'starter-imagery',
  'work-potter.webp'
);

interface Completion {
  done: boolean;
  notDone?: string;
  doneBecause?: string;
  mustFix?: Array<{ code: string; viewport: string; message: string }>;
}

interface RawResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
}

describe('VIB-007 M1 — the door refuses to certify a page nobody fixed', () => {
  let session: TestSession;
  let dir: string;

  beforeAll(async () => {
    // A copy, so the demo project in the repo is never the thing being written to.
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vib007-m1-'));
    fs.cpSync(DEMO, dir, { recursive: true });
    session = await connect(dir);
  });

  afterAll(async () => {
    if (session) await session.close();
  });

  it('1 — validate_project says NOT DONE before anybody has looked', async () => {
    const res = await call<Completion>(session, 'validate_project');
    expect(res.isError).toBeFalsy();
    // eslint-disable-next-line no-console
    console.log('M1 step 1 — ' + res.data.notDone);
    expect(res.data.done).toBe(false);
    expect(res.data.notDone).toContain('nobody has looked');
  });

  it('2 — a real render of the poor page refuses, and names the two built-in defects', async () => {
    const res = (await session.client.callTool({
      name: 'render_report',
      arguments: { screenshot: 'none' }
    })) as RawResult;

    expect(res.isError).toBeFalsy();
    const headline = res.content[0].text ?? '';
    // eslint-disable-next-line no-console
    console.log('M1 step 2 — ' + headline);
    expect(headline).toContain('NOT DONE');
    expect(headline).toContain('dead-placeholder-text');
    expect(headline).toContain('broken-image');

    const validated = await call<Completion>(session, 'validate_project');
    expect(validated.data.done).toBe(false);
    // ⚠️ Each defect is listed once PER VIEWPORT — the render measures desktop and phone, and a
    // finding that fires at one width and not the other is a different page, so the list is not
    // deduped by code. Asserted as a set, and the count is asserted separately so a silent
    // collapse to one viewport would be caught rather than pass this line.
    const codes = validated.data.mustFix?.map((f) => f.code) ?? [];
    expect([...new Set(codes)].sort()).toEqual(['broken-image', 'dead-placeholder-text']);
    expect(new Set(validated.data.mustFix?.map((f) => f.viewport)).size).toBe(2);
  });

  it('3 — the fix goes through the door, and the door still refuses until somebody looks again', async () => {
    const nodes = JSON.parse(
      fs.readFileSync(path.join(dir, 'components', 'Pages', 'Home', 'nodes.json'), 'utf-8')
    ) as { nodes: Array<{ id: string; parameters?: Record<string, unknown> }> };

    const copy = JSON.parse(JSON.stringify(nodes.nodes)) as Array<{ id: string; parameters?: Record<string, unknown> }>;
    const write = (id: string, text: string) => {
      const node = copy.find((n) => n.id === id);
      if (!node) throw new Error(`no node ${id}`);
      node.parameters = { ...node.parameters, text };
    };
    write('hero_sub', 'Hand-thrown stoneware, fired twice a week in a barn by the water.');
    write('feat_one', 'Every piece is thrown, trimmed and glazed in the same room.');
    write('feat_two', 'Come and make one yourself: Saturday mornings, four to a bench.');

    const updated = await call<Completion>(session, 'update_component', {
      path: 'Pages/Home',
      set: { nodes: copy }
    });
    expect(updated.isError).toBeFalsy();
    // The write door does not render. It reports what it has done to the project.
    expect(updated.data.done).toBe(false);

    // The photograph the graph has always pointed at, finally in the project.
    const target = path.join(dir, 'noodl_modules', 'starter-imagery');
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(PHOTO, path.join(target, 'work-potter.webp'));
  });

  it('4 — 🔴 THE ACCEPTS ARM: the fixed page renders clean and the door says DONE', async () => {
    const res = (await session.client.callTool({
      name: 'render_report',
      arguments: { screenshot: 'none' }
    })) as RawResult;

    const headline = res.content[0].text ?? '';
    // eslint-disable-next-line no-console
    console.log('M1 step 4 — ' + headline);
    expect(headline).toContain('DONE');
    expect(headline).not.toContain('NOT DONE');

    const validated = await call<Completion>(session, 'validate_project');
    // eslint-disable-next-line no-console
    console.log('M1 step 4 — validate_project done=' + validated.data.done);
    expect(validated.data.done).toBe(true);
  });
});
