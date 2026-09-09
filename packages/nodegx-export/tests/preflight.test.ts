/**
 * EXP-004 — the pre-flight summary, the surface an author reads *before* choosing a directory.
 *
 * ## What is actually at risk
 *
 * The pre-flight and `EXPORT-REPORT.md` are two renderings of one export. The failure that matters
 * is not either of them being ugly — it is the two **disagreeing**, because an author who is told
 * "six of ten come out clean", proceeds on that, and then reads a report describing something else
 * has been misled by the surface whose whole purpose was to set expectations accurately. Most of
 * the rows below are therefore crossings of the two channels rather than assertions about strings.
 *
 * ## 🔴 The row that guards the layer this was built at
 *
 * `the plan layer and the export do not agree` is the important one, and it is a **control pair**
 * rather than a check. The cheap way to build a pre-flight is to stop after `planProject` — that
 * is where most refusals are decided, it is where a reader's eye goes (§20.1), and it looks like
 * the same answer for less work. It is not the same answer, and the row measures the gap so that
 * a future rewrite to the cheap layer reddens something instead of quietly under-reporting. If the
 * two ever came level, that row fails and this file's premise needs re-examining — which is the
 * point of asserting a **disagreement** rather than asserting the number this session measured.
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { preflight, renderPreflight, summarizePreflight, PreflightSummary } from '../src/emit/preflight';
import { REPORT_PATH } from '../src/emit/report';
import { parseProject } from '../src/parse/parseProject';

const catalog: Catalog = loadCatalog();

const FIXTURE_DIR = path.join(__dirname, 'fixtures');
/** Every fixture on disk, so a project added later is graded without editing this file. */
const FIXTURES = fs.readdirSync(FIXTURE_DIR).filter((f) => fs.statSync(path.join(FIXTURE_DIR, f)).isDirectory());

const irOf = (fixture: string) => parseProject(path.join(FIXTURE_DIR, fixture), catalog);
const summaryOf = (fixture: string): PreflightSummary => preflight(irOf(fixture), catalog);

describe('the pre-flight and the export are two accounts of one set of facts', () => {
  test.each(FIXTURES)('%s — the headline number is the length of the list the report prints', (fixture) => {
    const app = emitApp(irOf(fixture), catalog);
    const summary = summarizePreflight(app);

    // Counted here from the report data directly, the long way round, so this is a crossing of two
    // computations rather than a restatement of one.
    const fromReport =
      app.report.components.reduce((n, c) => n + c.notes.length, 0) +
      app.report.components.filter((c) => c.skipped?.kind === 'deferred').length +
      app.report.modules.length +
      app.report.project.length;

    expect(summary.refusals).toBe(fromReport);
  });

  test.each(FIXTURES)('%s — every component is on exactly one side of "clean"', (fixture) => {
    const app = emitApp(irOf(fixture), catalog);
    const summary = summarizePreflight(app);
    const generated = app.report.components.filter((c) => c.file !== null);

    expect(summary.whole.length + summary.attention.length).toBe(generated.length);
    expect(summary.pages + summary.components).toBe(generated.length);
    // No component may appear in both lists.
    const attentionPaths = summary.attention.map((c) => c.path);
    expect(summary.whole.filter((p) => attentionPaths.includes(p))).toEqual([]);
  });

  test.each(FIXTURES)('%s — a component the pre-flight names is named by the emitted report too', (fixture) => {
    const app = emitApp(irOf(fixture), catalog);
    const summary = summarizePreflight(app);
    const report = app.report ? app.files[REPORT_PATH] : undefined;
    expect(report).toBeDefined();
    for (const c of summary.attention) {
      expect(report as string).toContain(`\`${c.path}\``);
    }
  });

  test.each(FIXTURES)('%s — components needing attention are worst first, ties alphabetical', (fixture) => {
    // `puppy-test-3` carries a genuine tie (two components on four refusals), so this row has a
    // population rather than passing vacuously — without one it would grade nothing.
    const attention = summaryOf(fixture).attention;
    for (let i = 1; i < attention.length; i++) {
      const prev = attention[i - 1];
      const here = attention[i];
      expect(prev.refusals).toBeGreaterThanOrEqual(here.refusals);
      if (prev.refusals === here.refusals) expect(prev.path < here.path).toBe(true);
    }
  });

  test('the corpus actually contains a tie, so the row above is not vacuous', () => {
    const counts = summaryOf('puppy-test-3').attention.map((c) => c.refusals);
    expect(counts.length).toBeGreaterThan(new Set(counts).size);
  });

  test('the file count is what will land on disk, and copied assets are counted apart from it', () => {
    // §19.6: `files` and `copies` are two channels and the one shipped runner dropped the second.
    // A pre-flight that folded them together, or ignored the second, would promise a smaller repo
    // than the export delivers — the same defect read from the other end.
    const app = emitApp(irOf('kits'), catalog);
    const summary = summarizePreflight(app);

    expect(summary.generatedFiles).toBe(app.report.files.length);
    expect(summary.copiedAssets).toBe(app.copies.length);
    expect(summary.copiedAssets).toBeGreaterThan(0);
    expect(renderPreflight(summary)).toContain(`${summary.copiedAssets} files copied across unchanged`);
  });
});

describe('the plan layer and the export do not agree, which is why this is not built there', () => {
  test('stopping after planProject under-reports the corpus', () => {
    let planLayer = 0;
    let exact = 0;
    for (const fixture of FIXTURES) {
      const ir = irOf(fixture);
      const plan = planProject(ir, new CatalogIndex(catalog));
      const app = emitApp(ir, catalog);
      planLayer += plan.plans.reduce((n, p) => n + p.notes.length, 0);
      exact += app.report.components.reduce((n, c) => n + c.notes.length, 0);
    }

    // 🔴 A disagreement, not a number. The gap was 28 vs 32 when this was written; what must stay
    // true is that the cheap layer sees *fewer* refusals than the export records, because that is
    // the claim the pre-flight's design rests on.
    expect(planLayer).toBeLessThan(exact);
  });

  test('the pre-flight counts refusals the plan layer cannot see', () => {
    /*
     * ⚠️ **The first draft of this row could not fail.** It asserted that the emit layer produces
     * `has no style/content mapping` notes and that `summary.refusals` was at least as large as
     * their count — both facts about `emitApp`, neither about where the pre-flight reads from. A
     * pre-flight rebuilt on `planProject` would still have satisfied it.
     *
     * The claim that bites is a comparison against the cheap layer's own answer for this same
     * project: the summary must be *strictly larger*, which is false the moment it stops running
     * the generator.
     */
    const ir = irOf('puppy-test-3');
    const planLayer = planProject(ir, new CatalogIndex(catalog)).plans.reduce((n, p) => n + p.notes.length, 0);
    const summary = summarizePreflight(emitApp(ir, catalog));

    const emitOnly = emitApp(ir, catalog)
      .report.components.flatMap((c) => c.notes)
      .filter((n) => n.includes('has no style/content mapping'));
    expect(emitOnly.length).toBeGreaterThan(0);

    expect(summary.refusals).toBeGreaterThan(planLayer);
  });
});

describe("the framing rules, which are what EXP-004 is actually about", () => {
  test.each(FIXTURES)('%s — leads with what worked', (fixture) => {
    const text = renderPreflight(summaryOf(fixture));
    const good = text.indexOf('## What you will get');
    const bad = text.indexOf('## What will not translate');
    expect(good).toBeGreaterThan(-1);
    expect(bad).toBeGreaterThan(good);
  });

  test.each(FIXTURES)('%s — specific, not statistical: no percentage anywhere', (fixture) => {
    expect(renderPreflight(summaryOf(fixture))).not.toMatch(/\d\s*%/);
  });

  test.each(FIXTURES)('%s — never implies verification', (fixture) => {
    // ⚠️ Unlike the report, which must carry one sentence *denying* verification and therefore
    // cannot assert the word is absent, the pre-flight has no use for the word at all. It says
    // "nothing will be run", which is the plain-language form and cannot be misread as a verdict.
    const text = renderPreflight(summaryOf(fixture));
    expect(text).not.toMatch(/verif/i);
    expect(text).toContain('nothing will be run');
  });

  test('a project with nothing to report is not made to look broken', () => {
    const summary = summaryOf('reading-shelf');
    expect(summary.refusals).toBe(0);
    const text = renderPreflight(summary);
    expect(text).toContain('**Nothing.** Every node and every wire in this project has a translation');
    expect(text).not.toContain('will not translate (');
  });

  test('a whole component with no file is in the headline number, not just in the list', () => {
    // The largest thing an export can leave out, and the first draft's number could not see it.
    const summary = summaryOf('puppy-test-3');
    expect(summary.noFileDeferred).toBeGreaterThan(0);

    const withoutDeferred = summary.refusals - summary.noFileDeferred;
    const text = renderPreflight(summary);
    expect(text).toContain(`## What will not translate (${summary.refusals})`);
    expect(text).not.toContain(`## What will not translate (${withoutDeferred})`);
    for (const c of summary.noFile.filter((n) => n.kind === 'deferred')) {
      expect(text).toContain(`\`${c.path}\` — **no file at all**`);
    }
  });

  test('a component the app shell handles is good news, and is reported as such', () => {
    const summary = summaryOf('reading-shelf');
    const scaffolded = summary.noFile.filter((c) => c.kind === 'scaffolded');
    expect(scaffolded.length).toBeGreaterThan(0);

    const text = renderPreflight(summary);
    const good = text.indexOf('## What you will get');
    const claims = text.indexOf('## What this export will claim');
    for (const c of scaffolded) {
      const at = text.indexOf(`\`${c.path}\``);
      expect(at).toBeGreaterThan(good);
      expect(at).toBeLessThan(claims);
    }
  });
});

/*
 * 🔴 **These rows drive the shipped runner itself, and that is the point of them.**
 *
 * §19.6 records a defect that lived in a runner while every gate stayed green, for one reason:
 * *no test drove it.* The `--dry-run` mode's entire promise is a negative — that it writes
 * nothing — and a negative about the filesystem cannot be checked anywhere except against the
 * filesystem. Asserting that a `dryRun` flag is `true` would be asserting the mechanism; what
 * matters is the consequence, which is that no directory appears.
 *
 * ⚠️ **The runner changed under these rows in HLS-002, and two of them changed with it.**
 * `scripts/emit-app.ts` is gone: it had its own write loop, which is the duplicate that dropped
 * `copies` in the first place, and the mode flag it dispatched on was read positionally. The
 * runner is now `src/cli/main.ts` — the `nodegx` binary — and `--preflight` is kept as an alias
 * for `--dry-run` so the invocation in anybody's notes still works. The one row whose *verdict*
 * changed is the second: an output folder passed alongside `--dry-run` used to be accepted and
 * silently ignored, and is now a usage error. The consequence being asserted is the same one
 * either way — nothing is written — and it is asserted the same way. The fuller exit-code and
 * equivalence rows live in `tests/hls002-cli.test.ts`.
 */
describe('the shipped runner, driven', () => {
  const CLI = path.join(__dirname, '..', 'src', 'cli', 'main.ts');
  const TS_NODE = path.join(__dirname, '..', '..', '..', 'node_modules', '.bin', 'ts-node');
  const TSCONFIG = path.join(__dirname, '..', 'tsconfig.json');

  const run = (args: string[]) =>
    spawnSync(TS_NODE, ['-P', TSCONFIG, CLI, ...args], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });

  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-preflight-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('--dry-run prints the summary and creates nothing', () => {
    const out = path.join(tmp, 'app');
    const result = run(['export', '--dry-run', path.join(FIXTURE_DIR, 'reading-shelf')]);

    expect(result.stdout).toContain('# Before you export — Reading Shelf');
    expect(result.stdout).toContain('**Nothing has been written yet.**');
    // The consequence, not the mechanism: nothing was passed as an output directory, and nothing
    // that looks like one exists afterwards.
    expect(fs.existsSync(out)).toBe(false);
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  test('--preflight is still the same mode, because it is the name in the old notes', () => {
    const result = run(['export', '--preflight', path.join(FIXTURE_DIR, 'reading-shelf')]);
    expect(result.stdout).toContain('**Nothing has been written yet.**');
    expect(fs.readdirSync(tmp)).toEqual([]);
  });

  test('--dry-run given an output directory is refused, and still writes nothing into it', () => {
    // The old runner accepted and dropped this argument. A person who typed an output folder
    // believes they asked for an export, and will not read a summary as a refusal to do one — so
    // it is a usage error now. What has not changed is that nothing appears on disk.
    const out = path.join(tmp, 'app');
    const result = run(['export', '--dry-run', path.join(FIXTURE_DIR, 'reading-shelf'), out]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('takes a project folder and no output folder');
    expect(fs.existsSync(out)).toBe(false);
  });

  test('without --dry-run it still writes the app, its report and its copied assets', () => {
    // The control for the rows above: the same runner, the same fixture, and this time files
    // must appear. Without it, "nothing was written" would pass on a runner that writes nothing
    // in either mode.
    const out = path.join(tmp, 'app');
    const result = run(['export', path.join(FIXTURE_DIR, 'kits'), out]);
    expect(result.status).toBe(0);

    expect(fs.existsSync(path.join(out, REPORT_PATH))).toBe(true);
    expect(fs.existsSync(path.join(out, 'src'))).toBe(true);
    const copied = emitApp(irOf('kits'), catalog).copies;
    expect(copied.length).toBeGreaterThan(0);
    for (const copy of copied) expect(fs.existsSync(path.join(out, copy.to))).toBe(true);
  });
});
