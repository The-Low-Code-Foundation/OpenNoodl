/**
 * EXP-004 — `EXPORT-REPORT.md`, the report the exported app carries with it.
 *
 * ## What is actually at risk here
 *
 * The report is prose, and prose is the one output of this package that a type checker cannot
 * grade at all. Three things can go wrong with it and only one of them looks like a bug:
 *
 * 1. **It silently drops a refusal.** The report is the *only* place an author can read what the
 *    export left out — the `TODO(export)` markers point at it by name. A note channel added later
 *    that feeds `notes` and forgets the report ships an app whose report does not describe it.
 *    `the report and the notes are two accounts of one set of facts` is the pair of rows for that,
 *    written as a crossing of the two channels rather than as a list of expected strings — one
 *    for the renderer printing everything it was handed, one for the counts agreeing.
 * 2. **It overstates the damage.** EXP-004's risk table: *"the report is so cautious that a good
 *    export looks bad."* A router shell handled by the scaffold is not a gap; a generated
 *    `src/api/http.ts` is not a stub. Both were wrong in the first draft and both have a row.
 * 3. **It claims verification.** Nothing in a generated app has been run, replayed or compared
 *    against the project it came from — EXP-003 does not exist yet. ⚠️ The row for this counts the
 *    uses of the word rather than asserting its absence: the report has to carry one sentence
 *    denying verification, so "the word is absent" is a claim that cannot be true here.
 *
 * ⚠️ **`renderReport` is pure and is driven directly for the shapes no fixture produces.** The
 * corpus has no project with zero refusals, which is the case the "lead with what worked" rule is
 * really about — a report that reads well only when there is bad news is not the one this task
 * asked for.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { ExportReportData, REPORT_PATH, renderReport, stripScope } from '../src/emit/report';
import { parseProject } from '../src/parse/parseProject';

const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

const exportOf = (fixture: string) => {
  const dir = path.join(__dirname, 'fixtures', fixture);
  return emitApp(parseProject(dir, catalog), catalog);
};

const reportOf = (fixture: string): string => {
  const report = exportOf(fixture).files[REPORT_PATH];
  if (report === undefined) throw new Error(`${fixture} emitted no ${REPORT_PATH}`);
  return report;
};

describe('the report reaches the exported app at all', () => {
  test('every fixture emits one, at the repository root', () => {
    for (const fixture of ['puppy-test-3', 'quote-desk', 'kits', 'reading-shelf', 'variable-dial']) {
      expect(Object.keys(exportOf(fixture).files)).toContain(REPORT_PATH);
    }
  });

  test('the file count it prints is the number of files on disk, itself included', () => {
    // The first thing anyone checks is `ls`, so the number has to survive that.
    const app = exportOf('quote-desk');
    const count = Object.keys(app.files).length;
    expect(app.files[REPORT_PATH]).toContain(`**${count} files**`);
    expect(app.report.files).toHaveLength(count);
  });

  test('emission is deterministic and carries no clock', () => {
    // 🔴 The generators are byte-stable by design (EXP-002-DETERMINISTIC-GENERATORS). A date line
    // is the obvious thing to put in a report and would break every golden in the package.
    expect(reportOf('puppy-test-3')).toBe(reportOf('puppy-test-3'));
    expect(reportOf('puppy-test-3')).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
    expect(reportOf('puppy-test-3')).not.toContain(__dirname);
  });
});

describe('the report and the notes are two accounts of one set of facts', () => {
  /**
   * 🔴 **The renderer drops nothing it was handed.** Half of the completeness claim, and the half
   * that is about `report.ts`: every refusal in the structured channel has to reach the page. A
   * section added with a `slice(0, 5)` in it, or a heading whose loop is never entered, fails
   * here and passes every other row in this file.
   */
  test.each(['puppy-test-3', 'quote-desk', 'kits', 'variable-dial'])(
    'every refusal recorded for %s is printed in the report',
    (fixture) => {
      const app = exportOf(fixture);
      const report = app.files[REPORT_PATH];
      const recorded = app.report.components.flatMap((c) => c.notes);

      // The population control. An empty list makes the loop below vacuous, and "this fixture has
      // no refusals" is a true reading of the corpus rather than of this test — so it is asserted.
      expect(recorded.length).toBeGreaterThan(0);
      for (const note of recorded) expect(report).toContain(note);
    }
  );

  /**
   * 🔴 **The two channels carry the same number of facts.** The other half, and the one about
   * `emitApp`: `notes` and `report` are filled at the same push sites and neither is derived from
   * the other — which is what keeps a reworded refusal from being re-grouped, and is exactly what
   * lets them drift. A note channel added to `notes` alone lands here as a count mismatch.
   *
   * ⚠️ **The `unreachable` term is the interesting part.** That fact is one line in `notes` and a
   * *flag* in the report, where it renders as a suffix on the component's heading rather than as
   * a bullet — because "no route reaches this" is a qualifier on the refusals below it, not a
   * refusal of its own. Counting it as a missing bullet is what the first draft of this row did,
   * and it read as a defect in the renderer. It is stated as a term in the sum instead.
   */
  test.each(['puppy-test-3', 'quote-desk', 'kits', 'variable-dial'])(
    'in %s, each component accounts for exactly its own notes',
    (fixture) => {
      const app = exportOf(fixture);
      let crossed = 0;
      for (const c of app.report.components) {
        if (c.file === null) continue;
        const fromNotes = app.notes.filter((note) => note.startsWith(`${c.path}: `));
        expect({ path: c.path, count: fromNotes.length }).toEqual({
          path: c.path,
          count: c.notes.length + (c.unreachable ? 1 : 0)
        });
        // …and the wording matches too, not only the arithmetic.
        for (const note of c.notes) {
          if (fromNotes.some((n) => stripScope(c.path, n) === note)) crossed++;
        }
      }
      expect(crossed).toBeGreaterThan(0);
    }
  );

  test('a component that emitted nothing still says so, with its reason', () => {
    const app = exportOf('puppy-test-3');
    const skipped = app.report.components.filter((c) => c.file === null);
    expect(skipped.length).toBeGreaterThan(0);
    for (const c of skipped) expect(app.files[REPORT_PATH]).toContain(c.skipped!.reason);
  });

  /**
   * 🔴 **A mutation survivor, and it was a real hole.** `modules: []` in `emitApp` — kit load
   * failures never reaching the report — passed the whole suite. `renderReport` was driven on
   * *synthetic* module data by the unit rows below, and the per-component rows above walk
   * `report.components`, which module failures are not in. Nothing crossed the one wiring that
   * carries them, so the channel could have been cut without a red.
   *
   * ⚠️ The `kits` fixture is the population that makes this checkable: four of its five modules
   * fail to load, on four different mechanisms.
   */
  test('a kit that failed to load reaches the report from the real fixture, not just from a stub', () => {
    const app = exportOf('kits');
    expect(app.report.modules.length).toBeGreaterThan(0);
    const report = app.files[REPORT_PATH];
    for (const note of app.report.modules) expect(report).toContain(note);
    // And the note is still the emitter's own sentence, reaching both channels intact.
    for (const note of app.report.modules) expect(app.notes).toContain(note);
  });

  test('a component no route reaches is marked, beside its notes rather than instead of them', () => {
    const app = exportOf('puppy-test-3');
    const unreachable = app.report.components.filter((c) => c.unreachable && c.notes.length > 0);
    expect(unreachable.length).toBeGreaterThan(0);
    const report = app.files[REPORT_PATH];
    for (const c of unreachable) {
      expect(report).toContain(`\`${c.path}\` — no route reaches this component`);
      for (const note of c.notes) expect(report).toContain(note);
    }
  });
});

describe('it leads with what worked', () => {
  test('what was generated is printed before what needs attention', () => {
    const report = reportOf('puppy-test-3');
    expect(report.indexOf('## What was generated')).toBeGreaterThan(-1);
    expect(report.indexOf('## What was generated')).toBeLessThan(report.indexOf('## What needs your attention'));
  });

  test('the router shell is filed as done, not as a gap', () => {
    // 🔴 The `skipKind` row. `App` and a logic-only component both arrive as one skipped plan with
    // one sentence; the scaffold emits the first as `src/App.tsx` and nothing emits the second.
    // Told apart by matching the prose, they would swap sides the day either was reworded.
    const app = exportOf('puppy-test-3');
    const shell = app.report.components.find((c) => c.path === 'App');
    expect(shell?.skipped?.kind).toBe('scaffolded');

    const report = app.files[REPORT_PATH];
    const shellAt = report.indexOf('`App` — router shell');
    expect(shellAt).toBeGreaterThan(-1);
    expect(shellAt).toBeLessThan(report.indexOf('## What needs your attention'));
  });

  test('a logic-only component is filed as a gap', () => {
    const app = exportOf('puppy-test-3');
    const logicOnly = app.report.components.filter((c) => c.skipped?.kind === 'deferred');
    expect(logicOnly.length).toBeGreaterThan(0);

    const report = app.files[REPORT_PATH];
    expect(report.indexOf('### Components with no generated file')).toBeGreaterThan(
      report.indexOf('## What needs your attention')
    );
  });
});

describe('the data-access sentence is about a backend, not about any api file', () => {
  /**
   * 🔴 This pair is the finding. `quote-desk` emits `src/api/http.ts` and declares no backend, so
   * a report keyed on "were any api files emitted" told its author that their working `fetch` was
   * a stub whose "reads answer empty and writes throw". Two predicates, one of them right.
   *
   * The rows differ only in the fixture, which is the control: same sentence generator, opposite
   * answers, and the thing varied is whether the project asks anything of a backend.
   */
  test('a project with an HTTP Request and no backend is not told its api is stubbed', () => {
    const app = exportOf('quote-desk');
    expect(app.report.httpModule).toBe(true);
    expect(app.report.usesBackend).toBe(false);

    const report = app.files[REPORT_PATH];
    expect(report).toContain('`src/api/http.ts`');
    expect(report).not.toContain('reads answer empty and writes throw');
  });

  test('a project with a backend names the endpoint it will call', () => {
    const app = exportOf('puppy-test-3');
    expect(app.report.usesBackend).toBe(true);
    expect(app.report.backendEndpoint).toBe('http://localhost:8581');
    expect(app.files[REPORT_PATH]).toContain('calling your NodeGX backend at `http://localhost:8581`');
  });

  test('a project that asks nothing of a backend says nothing about one', () => {
    const app = exportOf('variable-dial');
    expect(app.report.usesBackend).toBe(false);
    expect(app.report.httpModule).toBe(false);
    expect(app.files[REPORT_PATH]).not.toContain('src/api/');
  });
});

describe('it never claims the generated code was checked', () => {
  test.each(['puppy-test-3', 'quote-desk', 'kits'])('%s says nothing was run', (fixture) => {
    const report = reportOf(fixture);
    /*
     * EXP-004's first risk: users read "verified" as "guaranteed correct". EXP-003's trace
     * verification does not exist, so the word cannot be earned yet.
     *
     * 🔴 **Asserted as "the only use of the word is the denial", not as "the word is absent".**
     * A bare `not.toContain('verified')` is unsatisfiable beside the sentence this report has to
     * carry — the first draft of this row asserted both and contradicted itself. Counting the
     * occurrences is what distinguishes *saying nothing was verified* from *saying something was*.
     */
    const uses = report.match(/verified/g) ?? [];
    expect(uses).toHaveLength(1);
    expect(report).toContain('Nothing in this app has been verified against the app you built.');
    expect(report).toContain('nothing here has been run');
  });

  test('it says the export is one-way, and how to find the markers', () => {
    const report = reportOf('quote-desk');
    expect(report).toContain('This export is one-way');
    expect(report).toContain('grep -rn "TODO(export)" src');
  });

  test('it does not present the in-code markers as the complete list', () => {
    /*
     * 🔴 **Still the pair it always was — the sides have swapped, and the claim has not.**
     *
     * This row was written when EXP-004's marker half did not exist: it asserted `puppy-test-3`
     * emitted **no** `TODO(export)` at all while its report listed nine refusals, *and* that the
     * report said as much. The markers now exist, so the first half is inverted — they are
     * present, and the grep the report recommends finds them.
     *
     * What has **not** changed is the sentence being guarded. A marker needs an element to sit on,
     * and a refusal between two logic nodes has none, so the report is still the complete list and
     * the markers are still a subset of it. Asserting only the wording would pass on the day
     * someone widened that sentence to "every"; asserting only the markers would pass on the day
     * the paragraph went stale. Both halves, for the same reason as before.
     */
    const app = exportOf('puppy-test-3');
    const marked = Object.entries(app.files).filter(
      ([name, content]) => name.startsWith('src/') && content.includes('TODO(export)')
    );
    expect(marked.length).toBeGreaterThan(0);

    /*
     * The subset is **proper**, which is the fact the paragraph turns on. `puppy-test-3` refuses
     * wires between logic nodes that no element can carry a marker for, so there are strictly more
     * reported refusals than marked nodes — if these ever came level, "the complete list" would
     * have stopped meaning anything and the sentence below would need re-reading.
     */
    const notes = app.report.components.flatMap((c) => c.notes);
    const markedNodes = new Set(
      marked.flatMap(([, content]) => [...content.matchAll(/TODO\(export\): node (\S+) renders/g)].map((m) => m[1]))
    );
    expect(markedNodes.size).toBeGreaterThan(0);
    expect(notes.length).toBeGreaterThan(markedNodes.size);

    const report = app.files[REPORT_PATH];
    expect(report).toContain('**Not quite everything above can leave one.**');
    expect(report).toContain('**This report is the complete list**');
  });

  test('the honesty section is reachable by its heading', () => {
    // ⚠️ **A weak mutant, recorded as one.** Renaming this heading survived the suite — and it
    // survived honestly: every sentence the rows above assert was still on the page, so nothing
    // the tests claimed had stopped being true. The heading is still worth pinning, because it is
    // how a reader scanning the file finds the part that qualifies everything above it. This row
    // closes a gap in *legibility*, not a gap in a claim, and saying so is the point of writing
    // it down — a survivor is a finding about the tests only until a control shows otherwise.
    expect(reportOf('quote-desk')).toContain('## What this export claims, and what it does not');
  });
});

describe('renderReport on the shapes the corpus does not contain', () => {
  const base: ExportReportData = {
    projectName: 'Clean Slate',
    files: ['index.html', 'package.json', REPORT_PATH],
    components: [
      { path: 'Pages/Home', role: 'page', file: 'src/pages/Home.tsx', notes: [], unreachable: false }
    ],
    modules: [],
    project: [],
    backendEndpoint: null,
    usesBackend: false,
    httpModule: false
  };

  test('a project with nothing to report says so, rather than printing an empty heading', () => {
    // The case no fixture produces, and the one "lead with what worked" is really about.
    const report = renderReport(base);
    expect(report).toContain('### Translated with nothing left over (1)');
    expect(report).toContain('**Nothing.**');
    expect(report).not.toContain('### Components with no generated file');
    expect(report).not.toContain('### Kits that could not contribute their nodes');
  });

  test('a zero count is dropped rather than printed as an absence', () => {
    // "1 page and 0 components" reads as something the author should go and fix.
    expect(renderReport(base)).toContain('**3 files** — 1 page, plus the app shell');
    expect(renderReport(base)).not.toContain('0 components');
  });

  test('a kit that could not load is reported without being called a component', () => {
    const report = renderReport({ ...base, modules: ['noodl_modules/gone-kit: index.js could not be read.'] });
    expect(report).toContain('### Kits that could not contribute their nodes');
    expect(report).toContain('noodl_modules/gone-kit: index.js could not be read.');
    // The files still ship — a kit contributing only fonts still contributes them, and an author
    // told "the kit failed" without that sentence deletes a folder the app needs.
    expect(report).toContain('Their files still ship with the app');
  });
});

describe('stripScope', () => {
  test('removes the component prefix the emitter writes, and only that one', () => {
    expect(stripScope('Pages/Home', 'Pages/Home: wire a->b dropped')).toBe('wire a->b dropped');
    // Not this component's prefix: kept whole rather than trimmed by guesswork.
    expect(stripScope('Pages/Admin', 'Pages/Home: wire a->b dropped')).toBe('Pages/Home: wire a->b dropped');
    expect(stripScope('Pages/Home', 'a note with no prefix')).toBe('a note with no prefix');
  });
});
