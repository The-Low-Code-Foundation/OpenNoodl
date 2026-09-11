/**
 * EL-009 AC4 — a kit node on page three renders ON PAGE THREE.
 *
 * ## Why the tag assertion CN-001 already has is not this
 *
 * CN-001 asserts that `render-from-disk.js` emits a project's module `<script>`
 * tags, and it says plainly that it never executes the kit: it grades the tag,
 * because a tag is a fact you can see without a browser. That was the right
 * call for what CN-001 was fixing, and it leaves exactly one gap — **a tag in
 * the document proves the injector fired and proves nothing about whether the
 * node it defines ever drew on the page the caller cares about.**
 *
 * The gap is not hypothetical, and it is not a gap the sweep closed either. The
 * page shell is one SPA document, so the tags are page-independent by
 * construction; what is page-DEPENDENT is whether anything ever looked. Before
 * UNI-010 §8.2 the harness measured the start page and nothing else, so a kit
 * placed on page three was, to this instrument, indistinguishable from a kit
 * that did not work at all.
 *
 * ## The fixture is shaped so that the kit is the only thing holding page three up
 *
 * `Pages/Deep` contains two `demo.kit.Badge` nodes and nothing else. If the kit
 * reaches the browser, that page has two texts on it; if it does not, that page
 * is blank. Home and Middle carry one ordinary `Text` node each, and both
 * asymmetries are load-bearing: the **blank** is what arm B reads, and the
 * **count** is what stops arm A passing on a run that measured the start page by
 * mistake. Grading found that second one — see arm A.
 *
 * ## The three arms, measured 2026-08-20 before this file existed
 *
 * | arm | the kit's `runtimes` | `--page deep` |
 * |---|---|---|
 * | **A** good | (absent — browser) | `Rendered clean`, **2 texts** — a count only page three yields |
 * | **B** control | `["cloud"]` | **2 errors, `blank-render`**, attributed `/Pages/Deep` |
 * | **C** the same broken project, **start page only** | `["cloud"]` | **`Rendered clean`** |
 *
 * 🔴 **Arm C is the one that shows the teeth**, and it is why a two-arm pair
 * would not have been enough here. B and A differ, which tells you the check can
 * fail — but B alone cannot tell you *whether the blank is page three's or the
 * whole instrument's*. C holds the project broken and varies only which page is
 * looked at, and gets `Rendered clean` back. That is CN-001's lesson — a green
 * report over a page missing its work — in route-shaped form, and it is the
 * sentence this task exists to stop being true.
 *
 * ⚠️ The control is DERIVED from the committed fixture at run time by rewriting
 * one field, rather than committed as a second project. Two hand-maintained
 * fixtures drift, and a control that differs in some second way nobody noticed
 * proves whatever that second way did. `runtimes: ["cloud"]` is the narrowest
 * available lever: the kit file, the node, the page and the graph are byte-identical
 * across the arms, and the only thing that changes is whether the injector is
 * allowed to send it to a browser.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const CLI = path.join(REPO, 'scripts', 'devtools', 'measure-from-disk.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'kit-on-page-three');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { checkPrerequisites } = require(path.join(REPO, 'scripts', 'devtools', 'render-report.js'));

/**
 * This file needs a real Chrome and a built viewer bundle. Both are present in a
 * working checkout and neither is guaranteed on a machine that has only ever run
 * `npm ci`, so the suite skips rather than fails.
 *
 * 🔴 It skips LOUDLY. A silent skip is the same class of instrument as the one
 * this task is fixing — a check that stopped running while its report went on
 * looking identical — and the whole file is an argument against that.
 */
const prereq = checkPrerequisites(FIXTURE);
if (!prereq.ok) {
  // eslint-disable-next-line no-console
  console.warn(
    `\n⚠️  EL-009 AC4 DID NOT RUN — the per-page kit assertion was skipped, not passed.\n   ${prereq.problems.join(
      '\n   '
    )}\n`
  );
}
const describeOrSkip = prereq.ok ? describe : describe.skip;

interface Report {
  summary: string;
  findings: { code: string; page?: string; viewport: string }[];
  viewports: Record<string, { text: { elements: number } }>;
  pages?: { component: string; measured: boolean }[];
}

/** One viewport, no screenshots: this file asks "did it draw", not "how did it look". */
function render(projectDir: string, page: string): Report {
  let stdout: string;
  try {
    stdout = execFileSync(
      process.execPath,
      [CLI, projectDir, '--screenshot', 'none', '--viewports', 'desktop', '--page', page, '--json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (thrown) {
    /*
     * 🔴 A refused render answers on STDOUT and exits 1 — that is
     * `measure-from-disk.js`'s `--json` contract, and `page-selection.test.ts`
     * asserts it by name one file over. So `execFileSync` THROWS, and the
     * machine-readable cause is sitting on the throw's `.stdout` where, until
     * this catch existed, nothing read it. Jest printed `Command failed: <argv>`
     * and the diagnosis went in the bin.
     *
     * That is not hypothetical. Both arms of this file failed on CI on
     * 2026-08-20 (runs 32386192365 and 32386199625) with an EMPTY stderr and no
     * other evidence anywhere in the log, while the same command exited 0
     * locally — so the one thing needed to tell a wedged Chrome from an OOM kill
     * from a real regression had been generated, serialised, and discarded.
     *
     * ⚠️ `status` is null when the child was SIGNALLED rather than exiting, which
     * is exactly the OOM case, so the signal is named too — the two look
     * identical in a bare `Command failed:` and want opposite fixes.
     */
    // ⚠️ Typed rather than `any`: this file is counted by the `tsfixme` ratchet,
    // and a diagnostic improvement that widens the `any` census pays for itself
    // in the wrong currency.
    const e = thrown as { stdout?: unknown; stderr?: unknown; status?: number | null; signal?: string | null };
    const out = String(e?.stdout ?? '');
    const err = String(e?.stderr ?? '');
    let why = out.trim() || err.trim() || '(nothing on stdout or stderr)';
    try {
      const refusal = JSON.parse(out);
      if (refusal?.error) {
        // `problems` repeats `message` verbatim for a single-problem refusal, so
        // the duplicate is dropped rather than printed twice under one bullet.
        const extra = (refusal.error.problems ?? []).filter((p: string) => p !== refusal.error.message);
        why = [refusal.error.message, ...extra].join('\n     - ');
      }
    } catch {
      // Not JSON at all: the CLI died before it could answer in its own dialect.
      // The raw text — or its absence — is then the whole of the evidence.
    }
    const how = e?.signal ? `was killed by ${e.signal}` : `exited ${e?.status}`;
    throw new Error(`measure-from-disk ${how} for --page ${page}:\n     - ${why}`);
  }

  const parsed = JSON.parse(stdout);
  if (parsed.error) throw new Error(`render refused: ${parsed.error.message}`);
  return parsed as Report;
}

/** Arm B/C: the committed fixture with exactly one field rewritten. */
function withKitKeptOutOfTheBrowser(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'el009-cloudonly-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  const manifestPath = path.join(dir, 'noodl_modules', 'demo-kit', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.runtimes = ['cloud'];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

describeOrSkip('EL-009 AC4 — the kit is asserted on the page that carries it', () => {
  jest.setTimeout(240_000);

  let broken: string;
  beforeAll(() => {
    broken = withKitKeptOutOfTheBrowser();
  });

  it('🔴 ARM A — a kit node on page three draws on page three', () => {
    const report = render(FIXTURE, 'deep');

    // 🔴 TWO, exactly — and the count is the assertion, not `> 0`.
    //
    // `> 0` was what this arm said first, and grading it found the hole: with
    // the navigation removed the harness measures the START page, which also has
    // text, and the arm stayed green while the instrument was blind again. Page
    // three carries two badges and every other page carries one text, so `2` is
    // a number only page three can produce. It says the kit drew AND says which
    // page was looked at, which is the whole claim.
    expect(report.viewports.desktop.text.elements).toBe(2);
    expect(report.findings.map((f) => f.code)).not.toContain('blank-render');
    expect(report.pages?.map((p) => p.component)).toEqual(['/Pages/Deep']);
  });

  it('🔴 ARM B — CONTROL: keep the kit out of the browser and page three goes blank, BY NAME', () => {
    const report = render(broken, 'deep');

    expect(report.viewports.desktop.text.elements).toBe(0);
    const blanks = report.findings.filter((f) => f.code === 'blank-render');
    expect(blanks.length).toBeGreaterThan(0);
    // Attributed, not pooled — AC2's rule, which AC4 is the customer for. A
    // finding that did not name the page would send an author to the start page.
    for (const finding of blanks) expect(finding.page).toBe('/Pages/Deep');
  });

  it('🔴 ARM C — the SAME broken project still reads "Rendered clean" from the start page', () => {
    // 🔴 This is the defect, preserved as an assertion. It is not a bug being
    // reported: it is the reason looking at one page is not looking at an app,
    // and if this ever stops being true the fixture has drifted into something
    // that would have been caught the old way too — which would quietly retire
    // arms A and B.
    const report = render(broken, '/');

    expect(report.summary).toContain('Rendered clean');
    expect(report.findings).toEqual([]);
    expect(report.viewports.desktop.text.elements).toBeGreaterThan(0);
  });

  it('🔴 and the DEFAULT sweep — what F4 actually calls — catches it without being asked', () => {
    // Arms A–C all pass `--page`. If the per-page kit behaviour only worked for
    // callers who knew to name the page, every existing consumer would still be
    // blind, which is the shape UNI-010 §8.2 warned about when it made the sweep
    // the default.
    const stdout = execFileSync(
      process.execPath,
      [CLI, broken, '--screenshot', 'none', '--viewports', 'desktop', '--json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }
    );
    const report = JSON.parse(stdout) as Report;

    expect(report.summary).not.toContain('Rendered clean');
    const blanks = report.findings.filter((f) => f.code === 'blank-render');
    expect(blanks.map((f) => f.page)).toContain('/Pages/Deep');
  });
});
