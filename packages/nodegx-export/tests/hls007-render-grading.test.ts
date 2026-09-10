/**
 * HLS-007 — what `nodegx render` decides, graded without a browser.
 *
 * ## Why the grading is a separate function, and why this file is not a drive
 *
 * The interesting failures of `nodegx render` are the ones where **the renderer succeeded** and
 * the answer is still wrong: a page the router registers that the sweep never visited, a page
 * reached and blank, a page whose image was never written. None of the three is visible in the
 * harness's exit code, which is 0 whatever it finds — deliberately, because in `render_report` a
 * finding is the product and not a crash. So a pipeline gating on the harness gates on nothing,
 * and `gradeRender` is the whole of what this command adds over a shell alias.
 *
 * Provoking all of them for real would take a bespoke broken project per row and ~15 seconds of
 * Chrome each. `gradeRender` takes a report and the router's page list and returns a code and its
 * sentences, so each row below is a fabricated report and runs in microseconds.
 *
 * 🔴 **A fabricated report is a report about a fabrication.** Two rows guard against that: the
 * shapes here are the shapes `measure-from-disk.js --json` actually produced against a real
 * five-page project (`REAL_SHAPE`, recorded 2026-09-10, field names copied off the run, not
 * invented), and the end-to-end arms — a clean project exiting 0 and the same project with one
 * page emptied exiting 7 — were driven and are written up in HLS-007-WHAT-WAS-BUILT §4. This file
 * grades the decision; the drive grades that the decision is fed real numbers.
 */
import { gradeRender, type RenderReportShape } from '../src/cli/render';
import { EXIT } from '../src/cli/exitCodes';

/**
 * The field names, exactly as `measure-from-disk.js --json` emitted them against `Puppy test 3`
 * on 2026-09-10 — five routed pages, two viewports, `--out-dir` set.
 *
 * ⚠️ Copied from the run, not written from the type. The type is this package's *claim* about the
 * harness's output and the harness is plain JS in another directory that `tsc` cannot check
 * against it; a fixture written from the claim would agree with the claim and say nothing about
 * the harness.
 */
const REAL_SHAPE: RenderReportShape = {
  projectName: 'Puppy test 3',
  durationMs: 27_246,
  pages: [
    {
      component: '/#__page__/Home',
      urlPath: 'home',
      isStart: false,
      measured: true,
      viewports: { desktop: { screenshot: '/out/page-home-desktop.png' }, phone: { screenshot: '/out/page-home-phone.png' } }
    },
    {
      component: '/Pages/Landing',
      urlPath: 'landing',
      isStart: true,
      measured: true,
      viewports: {
        desktop: { screenshot: '/out/pages-landing-desktop.png' },
        phone: { screenshot: '/out/pages-landing-phone.png' }
      }
    }
  ],
  findings: [],
  viewports: { desktop: {}, phone: {} }
};

const ROUTES = ['/#__page__/Home', '/Pages/Landing'];

/** A deep copy, so a row that mutates its report cannot reach the next one. */
const shape = (): RenderReportShape => JSON.parse(JSON.stringify(REAL_SHAPE)) as RenderReportShape;

describe('gradeRender — the clean run', () => {
  it('exits 0 and says how many pages rendered against how many the router registers', () => {
    const grade = gradeRender(shape(), ROUTES, 2, true);
    expect(grade.code).toBe(EXIT.ok);
    expect(grade.lines[0]).toContain('2 of 2 routed pages rendered, 2 registered by the router');
  });

  it('names every image it wrote, so the caller does not have to list the directory', () => {
    const grade = gradeRender(shape(), ROUTES, 2, true).lines.join('\n');
    expect(grade).toContain('/out/pages-landing-phone.png');
    expect(grade).toContain('/out/page-home-desktop.png');
  });

  it('does not ask for images that were never requested', () => {
    // The CI-gate shape: `nodegx render <project>` with no --out-dir renders, grades and keeps
    // nothing. Every `screenshot` field is absent and that must not be a failure.
    const report = shape();
    for (const page of report.pages!) for (const v of Object.values(page.viewports!)) delete v.screenshot;
    expect(gradeRender(report, ROUTES, 2, false).code).toBe(EXIT.ok);
  });
});

describe('gradeRender — AC3, the count is asserted against the ROUTER, not against the sweep', () => {
  it('fails on a page the router registers that the report has no row for', () => {
    // 🔴 The silent case. `report.pages` is internally consistent — two rows, both measured, both
    // photographed — and a count taken from it agrees with itself. Only a second reader of the
    // router can see that a third page was registered and never visited.
    const grade = gradeRender(shape(), [...ROUTES, '/Pages/Quiz'], 2, true);
    expect(grade.code).toBe(EXIT.render);
    expect(grade.lines.join('\n')).toContain('/Pages/Quiz — the router registers it and the render report has no row for it at all');
  });

  it('still counts the router as the denominator when nothing is missing', () => {
    // The presence half: without this the row above passes on a grader that fails on every list.
    expect(gradeRender(shape(), ROUTES, 2, true).code).toBe(EXIT.ok);
  });
});

describe('gradeRender — a page that did not render', () => {
  it('fails and names an unreachable page, with the harness reason', () => {
    const report = shape();
    report.pages!.push({
      component: '/Pages/Product',
      measured: false,
      unreachable: 'its urlPath "product/{id}" takes a route parameter, which this harness has no value for'
    });
    const grade = gradeRender(report, [...ROUTES, '/Pages/Product'], 2, true);
    expect(grade.code).toBe(EXIT.render);
    expect(grade.lines.join('\n')).toContain('/Pages/Product — not rendered: its urlPath "product/{id}" takes a route parameter');
  });

  it('fails on a blank-render finding and attributes it to the page it names', () => {
    const report = shape();
    report.findings = [
      { code: 'blank-render', severity: 'error', viewport: 'desktop', page: '/#__page__/Home', message: 'rendered nothing' }
    ];
    const grade = gradeRender(report, ROUTES, 2, true);
    expect(grade.code).toBe(EXIT.render);
    expect(grade.lines.join('\n')).toContain('/#__page__/Home — rendered nothing at all (blank-render at desktop)');
  });

  it('attributes a blank-render with NO page to the start page', () => {
    // 🔴 `renderReport` labels the sweep's findings with a `page` and leaves the start page's
    // unlabelled, because everything above the sweep already describes the start page. A grader
    // that read `finding.page` alone would report the app's entry point rendering nothing as a
    // failure of "(unknown)" — or, worse, not at all.
    const report = shape();
    report.findings = [{ code: 'blank-render', severity: 'error', viewport: 'phone', message: 'rendered nothing' }];
    const grade = gradeRender(report, ROUTES, 2, true);
    expect(grade.code).toBe(EXIT.render);
    expect(grade.lines.join('\n')).toContain('/Pages/Landing — rendered nothing at all');
  });

  it('reports a measurement error against the page and the viewport it happened at', () => {
    const report = shape();
    report.pages![1].viewports!.phone = { error: 'Execution context was destroyed' };
    const grade = gradeRender(report, ROUTES, 2, true);
    expect(grade.code).toBe(EXIT.render);
    expect(grade.lines.join('\n')).toContain('/Pages/Landing at phone — Execution context was destroyed');
  });

  it('does not report a finding that is not blank-render', () => {
    // The look findings — `no-imagery`, `flat-type-scale` — are `render_report`'s product and are
    // warnings about a page that rendered. Failing a pipeline on them would make this command a
    // taste gate, which is not what it is, and would fail on nine of the nine VIB-001 baselines.
    const report = shape();
    report.findings = [{ code: 'no-imagery', severity: 'warning', viewport: 'desktop', message: 'no pictures' }];
    expect(gradeRender(report, ROUTES, 2, true).code).toBe(EXIT.ok);
  });
});

describe('gradeRender — the image count is per page', () => {
  it('fails when one page is short an image even though the total is right', () => {
    // 🔴 This is the row the obvious check would pass. Ten images for five pages at two viewports
    // is the right *total* whether every page has two or one page has four and another has none.
    const report = shape();
    delete report.pages![0].viewports!.desktop.screenshot;
    report.pages![1].viewports!.phone.screenshot = '/out/extra.png';
    const grade = gradeRender(report, ROUTES, 2, true);
    expect(grade.code).toBe(EXIT.render);
    expect(grade.lines.join('\n')).toContain('/#__page__/Home — 1 of 2 images written (phone only)');
  });

  it('fails when a page was photographed at no viewport at all', () => {
    const report = shape();
    for (const v of Object.values(report.pages![0].viewports!)) delete v.screenshot;
    const grade = gradeRender(report, ROUTES, 2, true);
    expect(grade.code).toBe(EXIT.render);
    expect(grade.lines.join('\n')).toContain('/#__page__/Home — 0 of 2 images written');
  });
});

describe('gradeRender — the harness itself failed', () => {
  it("blames the project for an actionable error, with the harness's own words", () => {
    const report: RenderReportShape = {
      error: { actionable: true, problems: ['No routed page matches "quizz". This project registers: quiz, home.'] }
    };
    const grade = gradeRender(report, ROUTES, 1, false);
    expect(grade.code).toBe(EXIT.project);
    expect(grade.lines.join('\n')).toContain('No routed page matches "quizz"');
  });

  it('does not blame the project when the harness merely fell over', () => {
    // 🔴 Chrome refusing to start is not a fact about the project, and a pipeline that reads
    // EXIT.project will go and look at a project that is fine.
    const grade = gradeRender({ error: { actionable: false, message: 'Chrome exited with 133' } }, ROUTES, 1, false);
    expect(grade.code).toBe(EXIT.render);
    expect(grade.code).not.toBe(EXIT.project);
  });
});
