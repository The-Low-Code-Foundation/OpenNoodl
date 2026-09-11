/**
 * FLD-011 AC3 + AC6 — the routed-page sweep, across tabs, and the two things parallelism breaks.
 *
 * [#40](https://github.com/The-Low-Code-Foundation/NodeGX/issues/40) measured 37.0s of wall for
 * ~5.3s of CPU on ten pages. Session 7 answered most of that with a settle budget (205s → 55s over
 * the corpus) and left the third scope item — parallelise **by tab** — unbuilt, with AC3 and AC6
 * unmet. This file is those two.
 *
 * ## The two hazards, and why each needs its own arm
 *
 * 🔴 **AC3 — attribution.** `withRenderedPage` used to hold ONE `consoleErrors` array and decide
 * which page an error belonged to by slicing it around each measurement. Index slicing is a claim
 * that nothing else appended in between: true of a serial loop, false the moment two pages are live,
 * and **silent** when it is false — page seven's error lands in page three's row and both rows read
 * perfectly plausibly. The fix is a buffer per tab, and the arm that grades it is a fixture where
 * two known pages shout two known strings while six others are measured around them.
 *
 * 🔴 **AC6 — the reaper.** `reapOrphanedRenderProcesses` is what keeps this harness from
 * accumulating 260MB orphans, and its safety is the `ppid === 1` test. A parallel path that spawned
 * processes would put a live sibling's children in range of it; a parallel path built on tabs adds
 * no processes at all. That is an argument, so it is measured: a real orphan, matched the way the
 * reaper matches, reaped by a run that swept in parallel.
 *
 * ## What makes each assertion a measurement rather than a hope
 *
 * 1. **A known-firing control before every absence.** "Page three's row does not contain page
 *    seven's error" is also true of a harness that captures no console output whatsoever, so every
 *    such assertion here sits beside the positive one — page three's row *does* carry page three's
 *    error. See [[assert-an-absence-with-a-known-firing-signal-beside-it]].
 * 2. **A control that the parallel path was actually parallel.** Every assertion below would pass on
 *    a serial run, so `report.sweep.tabs` is asserted to be more than one first. A report that swept
 *    on one tab grades nothing here — it is the code this task replaced.
 * 3. 🔴 **A reverted arm in the direction that matters.** The module is copied with `attachTab`
 *    textually rewritten to share ONE buffer across tabs — the pre-FLD-011 shape — and the same
 *    fixture is driven through it. If attribution survives that, this file is not measuring
 *    attribution. Both replacements are asserted, so a moved source fails loudly instead of grading
 *    the fixed code twice (FLD-008's shape).
 *
 * ⚠️ Needs the built viewer bundle and a Chrome, like every drive in this directory.
 */
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SOURCE = path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { renderReport, PAGE_TABS, RENDER_SCRIPT, reapOrphanedRenderProcesses } = require(SOURCE);

jest.setTimeout(900000);

/** Eight pages: enough that four tabs interleave, and enough that "page 3" and "page 7" mean something. */
const PAGE_COUNT = 8;

/**
 * Which pages shout, and what they shout.
 *
 * AC3 names page 3 and page 7 — deliberately not adjacent, and deliberately not first or last, so a
 * misattribution has somewhere wrong to land that is not an off-by-one at an edge.
 */
const SHOUTS: Record<number, string> = {
  3: 'FLD011-THREE-ecb4',
  7: 'FLD011-SEVEN-9a17'
};

interface Row {
  component: string;
  measured?: boolean;
  isStart?: boolean;
  viewports?: Record<string, { consoleErrors?: string[] }>;
}

interface Report {
  pages: Row[];
  findings: Array<{ code: string; page?: string; message: string; viewport?: string }>;
  sweep?: { pages: number; tabs: number };
  viewports: Record<string, { consoleErrors?: string[] }>;
  durationMs: number;
}

/**
 * A project of eight routed pages, two of which console.error at load.
 *
 * The shouting is a `JavaScriptFunction` with one seeded input, which is what makes it fire without
 * anybody clicking anything: NDA-017's default is **every input ticked**, so the parameter arriving
 * at graph build counts as a change and the script runs. (The same mechanism DEF-038 exists to stop
 * happening by accident in shipped templates — here it is the point.)
 */
function writeFixture(dir: string): void {
  const components: Record<string, { path: string; type: string }> = {
    App: { path: 'App', type: 'visual' }
  };
  fs.mkdirSync(path.join(dir, 'components', 'App'), { recursive: true });

  const routes: string[] = [];
  for (let n = 1; n <= PAGE_COUNT; n++) {
    const key = `Pages/P${n}`;
    routes.push(`/${key}`);
    components[key] = { path: key, type: 'page' };
    const pageDir = path.join(dir, 'components', key);
    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(
      path.join(pageDir, 'component.json'),
      JSON.stringify({ id: `c-p${n}`, name: `P${n}`, path: `/${key}`, type: 'page' }, null, 2)
    );

    const nodes: unknown[] = [
      {
        id: `p${n}Page`,
        type: 'Page',
        children: [`p${n}Ground`],
        // Page 1 is the start page and needs no path of its own; the rest are addressed by theirs.
        parameters: { title: `Page ${n}`, urlPath: n === 1 ? '' : `p${n}` }
      },
      {
        id: `p${n}Ground`,
        type: 'Group',
        parent: `p${n}Page`,
        children: [`p${n}Text`],
        parameters: { width: { value: 100, unit: '%' }, sizeMode: 'contentHeight' }
      },
      {
        id: `p${n}Text`,
        type: 'Text',
        parent: `p${n}Ground`,
        parameters: { text: `This is page ${n} of eight, and it says so.`, fontSize: '18px' }
      }
    ];

    if (SHOUTS[n]) {
      nodes.push({
        id: `p${n}Shout`,
        type: 'JavaScriptFunction',
        label: `Page ${n} shouts`,
        parameters: {
          functionScript: `console.error(${JSON.stringify(SHOUTS[n])} + ' ' + String(Inputs.tag));`,
          'in-tag': `page-${n}`
        },
        ports: [{ name: 'in-tag', displayName: 'tag', plug: 'input', type: '*', group: 'Inputs' }]
      });
    }

    fs.writeFileSync(path.join(pageDir, 'nodes.json'), JSON.stringify({ componentId: `c-p${n}`, nodes }, null, 2));
  }

  fs.writeFileSync(
    path.join(dir, 'components', 'App', 'component.json'),
    JSON.stringify({ id: 'c-app', name: 'App', path: '/App', type: 'visual' }, null, 2)
  );
  fs.writeFileSync(
    path.join(dir, 'components', 'App', 'nodes.json'),
    JSON.stringify(
      {
        componentId: 'c-app',
        nodes: [
          { id: 'appRoot', type: 'Group', children: ['appRouter'] },
          {
            id: 'appRouter',
            type: 'Router',
            parent: 'appRoot',
            parameters: { name: 'Main', pages: { startPage: '/Pages/P1', routes } }
          }
        ]
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(dir, 'components', '_registry.json'),
    JSON.stringify({ version: 1, components }, null, 2)
  );
  fs.writeFileSync(
    path.join(dir, 'nodegx.project.json'),
    JSON.stringify(
      {
        name: 'FLD-011 eight pages, two of them shouting',
        version: '4',
        settings: { htmlTitle: 'FLD-011', navigationPathType: 'hash' },
        structure: { componentsDir: 'components' },
        rootNodeId: 'appRoot'
      },
      null,
      2
    )
  );
}

/** Every console error a report attributed to one page, across every viewport it measured. */
function errorsOn(report: Report, component: string): string[] {
  const row = report.pages.find((p) => p.component === component);
  if (!row) throw new Error(`no row for ${component} — the fixture or the sweep changed`);
  if (row.isStart) return Object.values(report.viewports).flatMap((v) => v.consoleErrors || []);
  return Object.values(row.viewports || {}).flatMap((v) => v.consoleErrors || []);
}

/** Every console error the whole report holds, wherever it landed. */
function allErrors(report: Report): string[] {
  return report.pages.flatMap((p) => errorsOn(report, p.component));
}

const has = (lines: string[], needle: string) => lines.some((l) => l.includes(needle));

let dir: string;
let parallel: Report;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fld011-tabs-'));
  writeFixture(dir);
  parallel = (await renderReport({ projectDir: dir, screenshot: 'none', concurrency: PAGE_TABS })).report;
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('FLD-011 AC3 — a console error is attributed to the page that produced it, under parallelism', () => {
  /**
   * 🔴 The control that has to come first. Every assertion in this describe would pass on a serial
   * sweep — which is the code this task is replacing — so the claim "under parallelism" has to be
   * read off the artefact before anything is concluded from it.
   */
  it('swept on more than one tab, so the rest of this file is about parallelism', () => {
    expect(parallel.sweep).toBeDefined();
    expect(parallel.sweep!.pages).toBe(PAGE_COUNT - 1);
    expect(parallel.sweep!.tabs).toBeGreaterThan(1);
    expect(parallel.sweep!.tabs).toBe(Math.min(PAGE_TABS, PAGE_COUNT - 1));
  });

  /** The known-firing signal. Without this, every absence below is met by a harness that reads nothing. */
  it('heard both pages shout', () => {
    const heard = allErrors(parallel);
    expect(has(heard, SHOUTS[3])).toBe(true);
    expect(has(heard, SHOUTS[7])).toBe(true);
  });

  it('put page three’s error on page three, and page seven’s nowhere near it', () => {
    const three = errorsOn(parallel, '/Pages/P3');
    expect(has(three, SHOUTS[3])).toBe(true);
    expect(has(three, SHOUTS[7])).toBe(false);
  });

  it('put page seven’s error on page seven, and page three’s nowhere near it', () => {
    const seven = errorsOn(parallel, '/Pages/P7');
    expect(has(seven, SHOUTS[7])).toBe(true);
    expect(has(seven, SHOUTS[3])).toBe(false);
  });

  /**
   * The six quiet pages. A misattribution does not have to land on the *other* shouting page to be
   * a misattribution, and a buffer shared across four tabs would spray these rows.
   */
  it('left the six quiet pages quiet', () => {
    for (const n of [1, 2, 4, 5, 6, 8]) {
      const errors = errorsOn(parallel, `/Pages/P${n}`);
      expect({ page: n, three: has(errors, SHOUTS[3]), seven: has(errors, SHOUTS[7]) }).toEqual({
        page: n,
        three: false,
        seven: false
      });
    }
  });

  /**
   * Each shout appears **exactly once** in the whole report, in the window that contains the
   * navigation that caused it.
   *
   * 🔴 This is the half of the attribution fix that the "landed on the right page" assertions above
   * cannot see. The windows are closed at each read as well as opened before the navigation, so they
   * are disjoint: nothing is dropped and **nothing is counted twice**. A watermark that only opened
   * early would put a load-time error in every viewport's row of that page, and the `console-error`
   * finding reports the array's *length* — "the runtime logged 2 errors" about one error is a wrong
   * report, not a verbose one.
   *
   * ⚠️ Written from the fixture's behaviour and not from the shape of the loop: the first version of
   * this expected one shout **per viewport**, because "two viewports are measured" was easier to
   * reach for than "the page loaded once". It failed, and it was the assertion that was wrong.
   */
  it('counted each shout exactly once, in the window that holds its navigation', () => {
    const count = (needle: string) => allErrors(parallel).filter((l) => l.includes(needle)).length;
    expect({ three: count(SHOUTS[3]), seven: count(SHOUTS[7]) }).toEqual({ three: 1, seven: 1 });

    for (const [n, shout] of Object.entries(SHOUTS)) {
      const row = parallel.pages.find((p) => p.component === `/Pages/P${n}`)!;
      const names = Object.keys(row.viewports || {});
      const where = names.filter((name) => (row.viewports![name].consoleErrors || []).some((l) => l.includes(shout)));
      expect({ page: n, where }).toEqual({ page: n, where: [names[0]] });
    }
  });
});

describe('FLD-011 AC4 — the same fixture, serial and parallel, reports the same thing', () => {
  it('finds the same findings and attributes the same errors at one tab as at four', async () => {
    const serial: Report = (await renderReport({ projectDir: dir, screenshot: 'none', concurrency: 1 })).report;
    expect(serial.sweep).toEqual({ pages: PAGE_COUNT - 1, tabs: 1 });

    const key = (r: Report) =>
      r.findings.map((f) => `${f.code}|${f.viewport}|${f.page || ''}|${f.message}`).sort();
    expect(key(parallel)).toEqual(key(serial));

    expect(parallel.pages.map((p) => `${p.component}:${p.measured ? 'measured' : 'skipped'}`)).toEqual(
      serial.pages.map((p) => `${p.component}:${p.measured ? 'measured' : 'skipped'}`)
    );
    for (const row of serial.pages) {
      expect({ page: row.component, errors: errorsOn(parallel, row.component).sort() }).toEqual({
        page: row.component,
        errors: errorsOn(serial, row.component).sort()
      });
    }
  });
});

describe('FLD-011 AC6 — the orphan reaper still reaps, under the parallel path', () => {
  /**
   * A real orphan, matched the way the reaper matches: `ppid === 1` and a command line carrying
   * `RENDER_SCRIPT`. The `sh -c '… &'` is what makes it an orphan — the shell exits immediately and
   * init inherits the child, which is the only state the reaper will touch.
   *
   * ⚠️ It is a `node -e` sleeper rather than a real server, on purpose: this grades the reaper's
   * matching and killing, and a second project server on a shared box is a cost with no reading
   * attached to it. It sleeps for 60s, not ten minutes, so a failed run cannot leave the thing this
   * spec exists to clean up.
   *
   * 🔴 **`>/dev/null 2>&1` on the backgrounded child is load-bearing and cost a hung run to find.**
   * `execFile` resolves when the child's stdio streams close, not when the child exits — and a
   * process backgrounded by `sh` inherits `sh`'s stdout, so the pipe stays open for as long as the
   * sleeper lives. Without the redirect this helper waits out the whole sleep, and the suite looks
   * like the drive is hanging rather than like the harness is.
   */
  const leakOne = (): Promise<number> =>
    new Promise((resolve, reject) => {
      const sleeper = `node -e "setTimeout(function(){}, 60000)" ${RENDER_SCRIPT} --fld011-orphan >/dev/null 2>&1`;
      execFile('sh', ['-c', `${sleeper} & echo $!`], (err, stdout) =>
        err ? reject(err) : resolve(Number(String(stdout).trim()))
      );
    });

  const alive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };

  it('reaps an orphan left before a parallel sweep, and the sweep still swept in parallel', async () => {
    const pid = await leakOne();
    // Long enough for `sh` to exit and init to adopt the child; the reaper only looks at ppid 1.
    await new Promise((r) => setTimeout(r, 1500));
    expect(alive(pid)).toBe(true);

    const { report } = await renderReport({ projectDir: dir, screenshot: 'none', concurrency: PAGE_TABS });

    // 🔴 Both halves, or this passes on a drive that reaped nothing and swept on one tab.
    expect(report.sweep.tabs).toBeGreaterThan(1);
    expect(alive(pid)).toBe(false);
  });

  /**
   * The other direction, and the one that makes the reaper safe rather than merely effective: a
   * process that matches the command but is still somebody's child is left alone. This is the check
   * that a concurrent drive — which is what parallelism makes more likely, not less — survives.
   */
  it('leaves a matching process that still has a living parent', async () => {
    const child = require('child_process').spawn(
      'node',
      ['-e', 'setTimeout(function(){}, 600000)', RENDER_SCRIPT, '--fld011-not-an-orphan'],
      { stdio: 'ignore' }
    );
    try {
      await new Promise((r) => setTimeout(r, 500));
      expect(reapOrphanedRenderProcesses()).not.toContain(String(child.pid));
      expect(alive(child.pid as number)).toBe(true);
    } finally {
      child.kill('SIGKILL');
    }
  });
});

describe('FLD-011 AC3 — the reverted arm: one buffer across four tabs', () => {
  /**
   * 🔴 The arm that decides whether this file measures anything.
   *
   * `attachTab` is rewritten to append into a buffer shared by every tab — the state
   * `withRenderedPage` used to hold — and the same eight-page fixture is driven through the copy at
   * four lanes. With four tabs interleaving, a shared buffer cannot keep two pages' errors apart:
   * the slice taken around page three's measurement contains whatever the other three tabs logged
   * while it ran.
   *
   * ⚠️ The assertion is "attribution is wrong", not "attribution is wrong in this specific way".
   * Which row a stray error lands in is a race, and an arm that pins the race would be flaky for a
   * reason that has nothing to do with the defect. What cannot vary is that a correct report and
   * this one are different reports.
   */
  const buildSharedBufferArm = (): string => {
    let src = fs.readFileSync(SOURCE, 'utf8');
    const reverts: Array<[string, string]> = [
      // One module-level array, reached by every tab: the pre-FLD-011 shape, one scope up.
      [
        'async function attachTab({ wsUrl, servePort, settles, label }) {\n  const consoleErrors = [];',
        'const SHARED_CONSOLE_ERRORS = [];\nasync function attachTab({ wsUrl, servePort, settles, label }) {\n  const consoleErrors = SHARED_CONSOLE_ERRORS;'
      ]
    ];
    for (const [from, to] of reverts) {
      if (!src.includes(from)) {
        throw new Error(
          'The shared-buffer arm could not be built: render-report.js no longer contains the text it ' +
            'reverts. Update this spec rather than grading the fixed code against itself.'
        );
      }
      src = src.split(from).join(to);
    }
    const file = path.join(path.dirname(SOURCE), `render-report.fld011-shared-${process.pid}.js`);
    fs.writeFileSync(file, src);
    return file;
  };

  it('misattributes, where the per-tab buffer does not', async () => {
    const file = buildSharedBufferArm();
    let broken: Report;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const arm = require(file);
      broken = (await arm.renderReport({ projectDir: dir, screenshot: 'none', concurrency: PAGE_TABS })).report;
    } finally {
      fs.unlinkSync(file);
    }

    // The arm still ran, still swept in parallel, and still heard both shouts — so what follows is
    // about attribution and not about a broken harness.
    expect(broken.sweep!.tabs).toBeGreaterThan(1);
    const heard = allErrors(broken);
    expect(has(heard, SHOUTS[3])).toBe(true);
    expect(has(heard, SHOUTS[7])).toBe(true);

    /** Where each shout landed, in the fixed report and in the reverted one. */
    const landings = (r: Report, needle: string) =>
      r.pages.filter((p) => has(errorsOn(r, p.component), needle)).map((p) => p.component);

    const correct = { three: landings(parallel, SHOUTS[3]), seven: landings(parallel, SHOUTS[7]) };
    const reverted = { three: landings(broken, SHOUTS[3]), seven: landings(broken, SHOUTS[7]) };
    expect(correct).toEqual({ three: ['/Pages/P3'], seven: ['/Pages/P7'] });
    expect(reverted).not.toEqual(correct);
  });

  /**
   * 🔴 The second arm, for the second half of the fix — and the one that pins a hole this file found
   * rather than one it was written to expect.
   *
   * Every assertion above was failing before the attribution *window* was fixed, and failing for a
   * reason that had nothing to do with tabs: `loggedBefore` was read **after** the navigation, so an
   * error a page logged while loading was in no window at all and the report dropped it. Both
   * shouting pages came back silent, and so does the boot of any project that logs on its way up —
   * which is the `console-error` rule's entire evidence.
   *
   * This arm moves that one line back to where it was. If the shouts survive it, this file is not
   * measuring the window, and the next person to "tidy" the watermark will be told nothing.
   */
  it('drops a load-time error entirely, when the window opens after the navigation', async () => {
    let src = fs.readFileSync(SOURCE, 'utf8');
    const fixed =
      '        let loggedThrough = tab.consoleErrors.length;' +
      '\n        await tab.goto(p.url, firstInTab ? BOOT_MS : PAGE_NAV_MS);';
    const before =
      '        await tab.goto(p.url, firstInTab ? BOOT_MS : PAGE_NAV_MS);' +
      '\n        let loggedThrough = tab.consoleErrors.length;';
    if (!src.includes(fixed)) {
      throw new Error(
        'The late-window arm could not be built: the watermark is no longer read before the goto. ' +
          'Update this spec rather than grading the fixed code against itself.'
      );
    }
    src = src.replace(fixed, before);
    const file = path.join(path.dirname(SOURCE), `render-report.fld011-late-${process.pid}.js`);
    fs.writeFileSync(file, src);

    let broken: Report;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const arm = require(file);
      broken = (await arm.renderReport({ projectDir: dir, screenshot: 'none', concurrency: PAGE_TABS })).report;
    } finally {
      fs.unlinkSync(file);
    }

    // The arm rendered the same eight pages and measured them all — it is silent, not broken.
    expect(broken.pages.filter((p) => p.measured).length).toBe(PAGE_COUNT);
    const heard = allErrors(broken);
    expect({ three: has(heard, SHOUTS[3]), seven: has(heard, SHOUTS[7]) }).toEqual({
      three: false,
      seven: false
    });
    // Beside the arm that hears them, so this absence is an absence and not a harness that is deaf.
    const heardWhenFixed = allErrors(parallel);
    expect({ three: has(heardWhenFixed, SHOUTS[3]), seven: has(heardWhenFixed, SHOUTS[7]) }).toEqual({
      three: true,
      seven: true
    });
  });
});
