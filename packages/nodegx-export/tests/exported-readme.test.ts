/**
 * EXP-004 — `README.md`, the exported repository's front door, and the ordered next steps.
 *
 * ## What is at risk, and which row is about which risk
 *
 * 1. **The README is not there.** It was emitted inside `apiModules` under `backend !== undefined
 *    && hasApi` until EXP-004, so six of the seven corpus fixtures exported without one. That is
 *    the file a developer opens first, absent in the ordinary case, and the regression is cheap to
 *    reintroduce because the condition reads like it is about the api modules. `every fixture` is
 *    the row, and it is deliberately over the whole corpus rather than one project.
 *
 * 2. **The order stops being an order.** EXP-004 asks for steps *"ordered by priority"*, and a
 *    list whose order is incidental satisfies the words while giving the author nothing. The
 *    ladder is documented on {@link nextSteps} and pinned twice here: once on a hand-built project
 *    that contains every group at once — a shape no fixture produces and none is likely to — and
 *    once as a **control pair**, where flipping a single component's `unreachable` moves it
 *    between two adjacent steps and changes nothing else.
 *
 * 3. **The two documents drift.** The list is rendered into `EXPORT-REPORT.md` and `README.md`,
 *    which are reached by different routes: a developer opens the README, and the `TODO(export)`
 *    markers in the generated code point at the report. Two renderings of one decision is the
 *    pattern `backendMode` already establishes — and the failure mode is a later session editing
 *    one call site. `the same list, in both documents` crosses them rather than asserting strings.
 *
 * 4. **It claims verification.** Nothing generated has been run. ⚠️ As in the report's suite, the
 *    row counts the word rather than asserting its absence: the README carries a sentence denying
 *    verification, so "the word never appears" is a claim that cannot be true here.
 *
 * ⚠️ **`nextSteps` and `renderReadme` are pure and are driven directly for what the corpus cannot
 * produce**: a stubbed backend beside a real `src/api/http.ts`, project-wide notes, and every group
 * in one project. `tests/fixtures` contains none of those, and a suite that only ran the fixtures
 * would report full coverage of a function half of whose branches had never executed.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { README_PATH, renderReadme } from '../src/emit/readme';
import { alphaNotice, exportCoverage } from '../src/ledger';
import { ExportReportData, REPORT_PATH, nextSteps, renderSteps } from '../src/emit/report';
import { parseProject } from '../src/parse/parseProject';

const catalog: Catalog = loadCatalog();

const FIXTURES = fs.readdirSync(path.join(__dirname, 'fixtures')).sort();

const exportOf = (fixture: string) =>
  emitApp(parseProject(path.join(__dirname, 'fixtures', fixture), catalog), catalog);

const readmeOf = (fixture: string): string => {
  const readme = exportOf(fixture).files[README_PATH];
  if (readme === undefined) throw new Error(`${fixture} emitted no ${README_PATH}`);
  return readme;
};

/** The numbered items of a rendered list, `"1. **Title**"` → `"Title"`, in order. */
const titlesIn = (markdown: string): string[] =>
  [...markdown.matchAll(/^\d+\. \*\*(.+)\*\*$/gm)].map((m) => m[1]);

describe('the README reaches every exported app, which is the regression', () => {
  test.each(FIXTURES)('%s exports one, at the repository root', (fixture) => {
    expect(Object.keys(exportOf(fixture).files)).toContain(README_PATH);
  });

  test('the corpus is not one project — six of these used to get none', () => {
    // 🔴 The row above is `test.each`, so a fixture directory that stopped being read would make it
    // silently weaker rather than red. This is the denominator, asserted.
    expect(FIXTURES.length).toBeGreaterThanOrEqual(7);
    expect(FIXTURES).toContain('reading-shelf');
    expect(FIXTURES).toContain('puppy-test-3');
  });

  test('it is counted in the file total the report prints', () => {
    // The README is added to `report.files` by hand at the one site that writes it, because it does
    // not exist as a key yet when that list is built. An omission there is invisible except here.
    const app = exportOf('quote-desk');
    expect(app.report.files).toContain(README_PATH);
    expect(app.report.files).toHaveLength(Object.keys(app.files).length);
  });

  test('it carries no clock, no absolute path and is byte-stable', () => {
    expect(readmeOf('puppy-test-3')).toBe(readmeOf('puppy-test-3'));
    expect(readmeOf('puppy-test-3')).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
    expect(readmeOf('puppy-test-3')).not.toContain(__dirname);
  });
});

describe('the alpha notice (0.2.2) — the same sentence the editor shows, with the ledger\'s number', () => {
  test('every README carries it, as a blockquote above the run instructions', () => {
    for (const fixture of FIXTURES) {
      const readme = readmeOf(fixture);
      expect(readme).toContain(`> **${alphaNotice()}**`);
      expect(readme.indexOf('Code export is in alpha')).toBeLessThan(readme.indexOf('## Run it'));
    }
  });

  test('the number in it is the picker reading the gate holds, rounded down', () => {
    const c = exportCoverage();
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    expect(c.exportable).toBe(ledger.pickerCoverageFloor);
    expect(c.placeable).toBe(ledger.pickerCoverageTotal);
    expect(c.percent).toBe(Math.floor((100 * c.exportable) / c.placeable));
    expect(alphaNotice()).toContain(`${c.exportable} of the ${c.placeable} nodes you can place export today (${c.percent}%)`);
    expect(alphaNotice()).toContain('do not ship a production app from it yet');
  });
});

describe('the steps are ordered by priority, and the order is the documented one', () => {
  /**
   * Every group at once. No corpus project has a stubbed backend, and none has a project-wide
   * note, so this shape has to be built rather than found — and it is the only place the full
   * ladder is observable.
   */
  const everything: ExportReportData = {
    projectName: 'Everything At Once',
    files: ['src/api/http.ts', 'src/api/orders.ts', 'src/api/session.ts'],
    components: [
      { path: 'Pages/Home', role: 'page', file: 'src/pages/Home.tsx', notes: ['a', 'b'], unreachable: false },
      { path: 'Components/Old', role: 'component', file: 'src/components/Old.tsx', notes: ['c'], unreachable: true },
      {
        path: 'Components/Gone',
        role: 'component',
        file: null,
        notes: [],
        unreachable: false,
        skipped: { kind: 'deferred', reason: 'nothing to emit' }
      }
    ],
    modules: ['kit-a failed to load'],
    project: ['the project declares a setting the export has no rule for'],
    backendEndpoint: null,
    usesBackend: true,
    httpModule: true
  };

  test('the ladder is deferred, stubs, reached, unreached, kits, project, test', () => {
    expect(nextSteps(everything).map((s) => s.title)).toEqual([
      'Write the one component the export could not generate.',
      'Point `src/api/` at a data source.',
      'Fill in 2 refusals in one component a route reaches.',
      'Fill in one refusal in one component no route reaches.',
      'Replace the nodes one kit could not contribute.',
      'Settle the one note the export left about the project itself.',
      'Test it, including the parts nothing above mentions.'
    ]);
  });

  test('the reachable step is above the unreachable one — the pair varies only that', () => {
    /*
     * 🔴 A control pair, and the only thing that differs between the two runs is one boolean on one
     * component. The claim is positional: the same refusal appears in a higher step when a route
     * reaches it. Asserting "there is a reached step and an unreached step" would pass on a
     * function that emitted them in either order.
     */
    const reachedFirst = nextSteps({
      ...everything,
      components: everything.components.map((c) =>
        c.path === 'Components/Old' ? { ...c, unreachable: false } : c
      )
    });
    const stillUnreached = nextSteps(everything);

    const reachedIndex = (steps: ReturnType<typeof nextSteps>) =>
      steps.findIndex((s) => s.title.includes('a route reaches'));
    const unreachedIndex = (steps: ReturnType<typeof nextSteps>) =>
      steps.findIndex((s) => s.title.includes('no route reaches'));

    // With the flip, both refusals collapse into the reachable step and the unreachable one is gone.
    expect(reachedFirst[reachedIndex(reachedFirst)].title).toContain('3 refusals in 2 components');
    expect(unreachedIndex(reachedFirst)).toBe(-1);

    // Without it, the two steps exist and the reachable one is strictly above.
    expect(unreachedIndex(stillUnreached)).toBeGreaterThan(reachedIndex(stillUnreached));
  });

  test('a refusal count is refusals, not components', () => {
    // Two numbers that a "count the components" implementation would make equal. `puppy-test-3` is
    // the fixture that separates them without being constructed to.
    const steps = nextSteps(exportOf('puppy-test-3').report);
    const reached = steps.find((s) => s.title.includes('a route reaches'));
    expect(reached?.title).toBe('Fill in 11 refusals in 2 components a route reaches.');
  });

  test('the last step is on every export, however well it went', () => {
    for (const fixture of FIXTURES) {
      const steps = nextSteps(exportOf(fixture).report);
      expect(steps[steps.length - 1].title).toContain('Test it');
    }
    // Including the one with nothing else in it at all.
    expect(nextSteps(exportOf('reading-shelf').report)).toHaveLength(1);
  });

  test('the stub step names the stubs and not the real HTTP module', () => {
    /*
     * 🔴 `src/api/http.ts` is a transcription of the author's own `HTTP Request` nodes — real code
     * calling addresses they typed, and not a stub in any mode. Sending them to "point it at a data
     * source" is the same error the report's `usesBackend` pair already closed once, one surface
     * later. No fixture has both, so the shape is built.
     */
    const step = nextSteps(everything).find((s) => s.title.includes('data source'));
    expect(step?.where).toEqual(['src/api/orders.ts', 'src/api/session.ts']);
  });

  test('a component with no file is located by its path, because it has no file', () => {
    const step = nextSteps(everything).find((s) => s.title.includes('could not generate'));
    expect(step?.where).toEqual(['Components/Gone']);
  });

  test('a connected backend produces no stub step at all', () => {
    // The risk table's "a good export looking bad": `puppy-test-3` has a working backend, and
    // telling its author to go and connect one would be inventing work.
    const titles = nextSteps(exportOf('puppy-test-3').report).map((s) => s.title);
    expect(titles.some((t) => t.includes('data source'))).toBe(false);
  });
});

describe('the same list, in both documents', () => {
  /**
   * 🔴 The crossing, not a list of expected strings. `nextSteps` is one decision with two readers,
   * and the way that breaks is a later session rendering one side by hand — which every row that
   * asserts literal text on one document would pass.
   */
  test.each(FIXTURES)('%s — the report and the README print identical steps', (fixture) => {
    const app = exportOf(fixture);
    const fromSteps = titlesIn(renderSteps(nextSteps(app.report)).join('\n'));
    expect(titlesIn(app.files[REPORT_PATH])).toEqual(fromSteps);
    expect(titlesIn(app.files[README_PATH])).toEqual(fromSteps);
    expect(fromSteps.length).toBeGreaterThan(0);
  });

  test('the detail and locations stay inside their numbered item', () => {
    // Three spaces is what keeps a continuation line in the list item rather than starting a new
    // paragraph after it — a Markdown detail, invisible in a string comparison, visible to a reader.
    const rendered = renderSteps(nextSteps(exportOf('puppy-test-3').report));
    const continuations = rendered.filter((line) => line !== '' && !/^\d+\. /.test(line));
    expect(continuations.length).toBeGreaterThan(0);
    for (const line of continuations) expect(line).toMatch(/^ {3}\S/);
  });
});

describe('what the README says, and what it must never say', () => {
  test.each(FIXTURES)('%s says nothing has been run, and that export is one-way', (fixture) => {
    const readme = readmeOf(fixture);
    expect(readme).toContain('**Nothing here has been run.**');
    expect(readme).toContain('**This export is one-way.**');
    expect(readme).toContain('re-exporting overwrites whatever you changed here');
  });

  test.each(FIXTURES)('%s never claims the generated code was verified', (fixture) => {
    /*
     * ⚠️ Counted, not forbidden. The README has to carry one sentence denying verification, so
     * asserting the word is absent would be asserting something that cannot be true. Every use has
     * to be that denial.
     */
    const uses = [...readmeOf(fixture).matchAll(/verif\w+/gi)].map((m) => m[0]);
    expect(uses).toEqual(['verified']);
    expect(readmeOf(fixture)).toContain('Nothing in this app has been verified against the app you built');
  });

  test.each(FIXTURES)('%s sends the reader to the report rather than repeating it', (fixture) => {
    const app = exportOf(fixture);
    const readme = app.files[README_PATH];
    expect(readme).toContain(`\`${REPORT_PATH}\`, beside this file`);
    // The itemised refusals live in exactly one document. A README that started listing them would
    // be a second copy to keep in step, and the one that drifted would be the one nobody regenerated.
    for (const note of app.report.components.flatMap((c) => c.notes)) {
      expect(readme).not.toContain(note);
    }
  });

  test('a project with nothing refused is not sent grepping for markers it will not find', () => {
    /*
     * `reading-shelf` refuses nothing, so it emits no `TODO(export)` at all. A README that printed
     * the grep anyway would send its reader to an empty result — and "I searched and found nothing"
     * reads as "the export is complete" whether or not it is, which is the one conclusion the
     * honesty surfaces exist to stop being reached by accident.
     */
    const app = exportOf('reading-shelf');
    expect(app.report.components.flatMap((c) => c.notes)).toEqual([]);
    for (const [name, content] of Object.entries(app.files)) {
      if (name.startsWith('src/')) expect(content).not.toContain('TODO(export)');
    }
    expect(app.files[README_PATH]).not.toContain('grep -rn');
    expect(app.files[README_PATH]).toContain('the export refused none of them');
  });

  test('a project with refusals is sent grepping, and the markers are there', () => {
    // The other half of the pair: same generator, opposite answer, and what varies is whether the
    // project has anything to find.
    const app = exportOf('puppy-test-3');
    expect(app.files[README_PATH]).toContain('grep -rn "TODO(export)" src');
    const marked = Object.entries(app.files).filter(
      ([name, content]) => name.startsWith('src/') && content.includes('TODO(export)')
    );
    expect(marked.length).toBeGreaterThan(0);
  });

  test('it says how to run the app before it says what is wrong with it', () => {
    // EXP-004's framing rule, on the document a developer opens first: a README that opens on a
    // list of problems reads as a failed export even when almost all of it came out clean.
    const readme = readmeOf('puppy-test-3');
    expect(readme.indexOf('npm install')).toBeLessThan(readme.indexOf('## What to do next'));
    expect(readme.indexOf('## What to do next')).toBeLessThan(readme.indexOf('## Before you start editing'));
  });
});

describe('renderReadme on the shapes the corpus does not contain', () => {
  const clean: ExportReportData = {
    projectName: 'Clean Slate',
    files: ['index.html', 'package.json', REPORT_PATH, README_PATH],
    components: [{ path: 'Pages/Home', role: 'page', file: 'src/pages/Home.tsx', notes: [], unreachable: false }],
    modules: [],
    project: [],
    backendEndpoint: null,
    usesBackend: false,
    httpModule: false
  };

  test('a clean export gets one step and no false alarm', () => {
    const readme = renderReadme(clean, null);
    expect(readme).toContain('the export refused none of them');
    expect(titlesIn(readme)).toEqual(['Test it, including the parts nothing above mentions.']);
    expect(readme).not.toContain('could not translate everything');
  });

  test('a project that declares a backend it never queries gets no env-var section', () => {
    /*
     * 🔴 `usesBackend` is false here while `cloudservices` is present, which is a real project: one
     * that was pointed at a backend and never wired a query to it. `src/api/client.ts` is not
     * emitted in that case, so instructions for configuring it would be instructions for
     * configuring a file that is not there.
     */
    const readme = renderReadme(clean, { endpoint: 'https://example.test', appId: 'app_x' });
    expect(readme).not.toContain('VITE_NODEGX_ENDPOINT');
    expect(readme).not.toContain('https://example.test');
  });

  test('a connected backend gets the endpoint and the application id it actually has', () => {
    const readme = renderReadme(
      { ...clean, usesBackend: true, backendEndpoint: 'https://example.test' },
      { endpoint: 'https://example.test', appId: 'app_x' }
    );
    expect(readme).toContain('- `VITE_NODEGX_ENDPOINT` — the backend’s base URL (default: `https://example.test`)');
    expect(readme).toContain('- `VITE_NODEGX_APP_ID` — the backend’s application id (default: `app_x`)');
  });
});
