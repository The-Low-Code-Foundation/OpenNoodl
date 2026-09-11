/**
 * UNI-007 engine 2 — the MCP adapter, pinned against real recorded renders.
 *
 * The measurements in `fixtures/render/` are the exact per-viewport output of
 * `scripts/devtools/measure-from-disk.js` against builds this project has
 * actually shipped, captured 2026-08-08. Running them through the harness's own
 * `summarise()` gives real findings, so these specs assert what this adapter
 * says about pages that really rendered that way — not about a report someone
 * invented to make a mapping look right.
 *
 * Three of them carry the argument:
 *
 *  - `phase55-s8-deepseek-v4-pro` — **0 texts and 0 images on both viewports.**
 *    The genuinely blank page, and the one this engine exists for.
 *  - `phase55-replay-haiku` — architecturally correct and renders dead: it draws
 *    68 things, several of them the literal word "Text". `rendered` is *true*
 *    here and must be, because it did draw; the findings are what say it is bad.
 *  - `phase55-replay-sonnet` — the build phase 55 calls correct.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { ValidationReport } from '../src/editor-deps';
import { ToolError } from '../src/errors';
import {
  capFindingLines,
  countDrawnElements,
  createWholeSolutionGrader,
  renderFindingLines,
  reportsBlankRender,
  validityFindingLines,
  MAX_FINDING_LINES
} from '../src/lessons/wholeSolutionGrader';
import type { RenderReportPayload } from '../src/render';

import { copyFixture } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { summarise } = require(path.resolve(__dirname, '..', '..', '..', 'scripts', 'devtools', 'render-report.js'));

/** A real recorded measurement, run through the harness's own summariser. */
function recordedReport(name: string): RenderReportPayload {
  const viewports = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'render', `${name}.json`), 'utf8'));
  const { findings, summary } = summarise(viewports);
  return { project: `/fixtures/${name}`, durationMs: 1, tokens: 'recorded', viewports, findings, summary };
}

function report(overrides: Partial<RenderReportPayload>): RenderReportPayload {
  return { project: '/p', durationMs: 1, tokens: 't', viewports: {}, findings: [], summary: '', ...overrides };
}

const CLEAN_VALIDATION: ValidationReport = {
  diagnostics: [],
  summary: { errors: 0, warnings: 0, infos: 0, nodesChecked: 1, endpointsChecked: 1 }
} as unknown as ValidationReport;

// ─── The count, and whose rule it follows ───────────────────────────────────

describe('countDrawnElements — the report’s own blank rule, not a second one', () => {
  it('counts texts plus images, on the builds that drew', () => {
    // 63 texts + 5 images, and 82 + 16.
    expect(countDrawnElements(recordedReport('phase55-replay-haiku'))).toBe(68);
    expect(countDrawnElements(recordedReport('phase55-replay-sonnet'))).toBe(98);
    expect(countDrawnElements(recordedReport('ecommerce-example'))).toBe(53);
  });

  it('returns zero for the page that really did render nothing', () => {
    const blank = recordedReport('phase55-s8-deepseek-v4-pro');
    expect(countDrawnElements(blank)).toBe(0);
    // And the harness independently agrees, which is what makes it evidence.
    expect(reportsBlankRender(blank)).toBe(true);
  });

  it('takes the WORST viewport, not the sum — a page blank on the phone has not rendered', () => {
    // `summarise()` raises blank-render if ANY viewport is blank, so summing
    // would let a healthy desktop hide an empty phone.
    const mixed = report({
      viewports: {
        desktop: { text: { elements: 40 }, images: { total: 2 } },
        phone: { text: { elements: 0 }, images: { total: 0 } }
      } as never
    });
    expect(countDrawnElements(mixed)).toBe(0);
  });

  it('skips a viewport that failed to measure, exactly as summarise() does', () => {
    const partial = report({
      viewports: {
        desktop: { error: 'evaluation failed' },
        phone: { text: { elements: 7 }, images: { total: 1 } }
      } as never
    });
    expect(countDrawnElements(partial)).toBe(8);
  });

  it('returns undefined — never zero — when nothing could be measured at all', () => {
    // The distinction the whole `unavailable` path rests on: "not counted" is
    // not "counted, and it was none".
    expect(countDrawnElements(report({ viewports: { desktop: { error: 'x' } } as never }))).toBeUndefined();
    expect(countDrawnElements(report({}))).toBeUndefined();
  });
});

// ─── Findings, in the reporting tools' own words ────────────────────────────

describe('finding lines', () => {
  it('renders the harness’s findings in the harness’s format', () => {
    const lines = renderFindingLines(recordedReport('phase55-replay-haiku'));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => /^\[(error|warning)\] \w+: [a-z-]+ — /.test(l))).toBe(true);
  });

  it('drops info findings, which name nothing to fix', () => {
    const noisy = report({
      findings: [
        { code: 'a', severity: 'error', viewport: 'desktop', message: 'broken' },
        { code: 'b', severity: 'info', viewport: 'desktop', message: 'observation' }
      ]
    });
    expect(renderFindingLines(noisy)).toHaveLength(1);
  });

  it('renders diagnostics with the editor’s own formatter', () => {
    const withError = {
      diagnostics: [
        {
          code: 'UnknownNodeType',
          severity: 'error',
          message: 'Unknown node type "Repeater".',
          suggestion: 'For Each',
          location: { component: '/App' }
        }
      ],
      summary: { errors: 1, warnings: 0, infos: 0 }
    } as unknown as ValidationReport;
    const lines = validityFindingLines(withError);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('UnknownNodeType');
    expect(lines[0]).toContain('For Each');
  });

  it('caps the list and says how much it withheld', () => {
    const many = Array.from({ length: MAX_FINDING_LINES + 5 }, (_, i) => `problem ${i}`);
    const capped = capFindingLines(many);
    expect(capped).toHaveLength(MAX_FINDING_LINES + 1);
    expect(capped[capped.length - 1]).toBe('…and 5 more problems not listed here.');
  });
});

// ─── The adapter ────────────────────────────────────────────────────────────

function grader(opts: {
  validity?: ValidationReport;
  validityFails?: Error;
  render?: RenderReportPayload;
  renderFails?: Error;
}) {
  return createWholeSolutionGrader('/lesson-project', {
    probeValidity: () => {
      if (opts.validityFails) throw opts.validityFails;
      return opts.validity ?? CLEAN_VALIDATION;
    },
    probeRender: async () => {
      if (opts.renderFails) throw opts.renderFails;
      return opts.render ?? recordedReport('phase55-replay-sonnet');
    }
  });
}

describe('createWholeSolutionGrader', () => {
  it('passes a project that validates and draws', async () => {
    const result = await grader({}).check();
    expect(result.valid).toBe(true);
    expect(result.rendered).toBe(true);
    expect(result.drawnElementCount).toBe(98);
    expect(result.unavailable).toBeUndefined();
  });

  it('🔴 always reports a count when a render ran — including zero', async () => {
    // The rule this adapter exists to honour. `normaliseWholeSolutionResult()`
    // deliberately does not invent a count an adapter omitted, so an adapter
    // that stays silent opts itself out of the empty-page check entirely. This
    // is the spec that stops that happening here.
    const blank = await grader({ render: recordedReport('phase55-s8-deepseek-v4-pro') }).check();
    expect(blank).toHaveProperty('drawnElementCount', 0);
    expect(blank.rendered).toBe(false);
  });

  it('fails the blank page and says so in the harness’s words', async () => {
    const result = await grader({ render: recordedReport('phase55-s8-deepseek-v4-pro') }).check();
    expect(result.rendered).toBe(false);
    expect(result.findings.some((f) => f.includes('blank-render'))).toBe(true);
    // It is not *unavailable*: the render ran fine. The page was empty.
    expect(result.unavailable).toBeUndefined();
  });

  it('calls a page that drew badly RENDERED, and lets the findings carry the badness', async () => {
    // The architecturally-correct, renders-dead build. Saying `rendered: false`
    // here would be a lie about what happened, and would collapse "drew nothing"
    // into "drew rubbish" — two different conversations with a learner.
    const result = await grader({ render: recordedReport('phase55-replay-haiku') }).check();
    expect(result.rendered).toBe(true);
    expect(result.drawnElementCount).toBe(68);
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('🔴 reports the badness as CODES too, because a verdict cannot branch on prose', async () => {
    /*
     * UNI-010 §8.1. The spec above is right and was not enough: the findings
     * carried the badness as **strings**, F4 read `valid` and `rendered`, and a
     * lesson whose rows were three copies of the word "Text" scored four
     * passes. The recorded haiku build is that page — it draws 68 things and
     * the harness calls two classes of them broken.
     */
    const result = await grader({ render: recordedReport('phase55-replay-haiku') }).check();
    expect(result.renderDefects).toEqual(['dead-placeholder-text', 'broken-image']);
    // And it is still `rendered`. The count is not the thing that changed.
    expect(result.rendered).toBe(true);
  });

  it('reports an empty defect list for the build phase 55 calls correct', async () => {
    // The other half of the control pair, and the half that matters most: this
    // must stay a pass, or the gate has started rejecting the right answer.
    const result = await grader({ render: recordedReport('phase55-replay-sonnet') }).check();
    expect(result.renderDefects).toEqual([]);
    expect(result.rendered).toBe(true);
  });

  it('does not report the blank page’s own error a second time under a new name', async () => {
    // `blank-render` is `rendered`'s to report. One defect, one accusation.
    const result = await grader({ render: recordedReport('phase55-s8-deepseek-v4-pro') }).check();
    expect(result.renderDefects).toEqual([]);
    expect(result.rendered).toBe(false);
  });

  it('does not report warnings as defects — ecommerce-example is a working page', async () => {
    const result = await grader({ render: recordedReport('ecommerce-example') }).check();
    expect(result.renderDefects).toEqual([]);
    expect(result.findings.some((f) => f.includes('minimum-layout-width'))).toBe(true);
  });

  it('marks a project invalid when the validator found errors, without touching the render', async () => {
    const invalid = {
      diagnostics: [
        { code: 'UnknownNodeType', severity: 'error', message: 'nope', location: { component: '/App' } }
      ],
      summary: { errors: 1, warnings: 0, infos: 0 }
    } as unknown as ValidationReport;
    const result = await grader({ validity: invalid }).check();
    expect(result.valid).toBe(false);
    expect(result.rendered).toBe(true);
    expect(result.findings.some((f) => f.includes('UnknownNodeType'))).toBe(true);
  });

  it('does not fail a project for warnings alone', async () => {
    const warned = {
      diagnostics: [{ code: 'W', severity: 'warning', message: 'hmm', location: { component: '/App' } }],
      summary: { errors: 0, warnings: 1, infos: 0 }
    } as unknown as ValidationReport;
    const result = await grader({ validity: warned }).check();
    expect(result.valid).toBe(true);
    // Reported, not fatal — a learner should see it without being failed by it.
    expect(result.findings.some((f) => f.includes('hmm'))).toBe(true);
  });
});

describe('when engine 2 cannot run at all', () => {
  it('reports unavailable rather than failing the learner, when there is no Chrome', async () => {
    // The sidecar case UNI-010 lives in. `rendered: false` alone would tell a
    // learner their page is empty when the truth is that nothing looked at it.
    const result = await grader({
      renderFails: new ToolError(
        'io-error',
        'The render harness is not present in this installation — set NODEGX_RENDER_CLI.'
      )
    }).check();

    expect(result.unavailable).toContain('NODEGX_RENDER_CLI');
    expect(result.rendered).toBe(false);
    // Validation still ran, and still says what it found. Half an answer is
    // reported as half an answer.
    expect(result.valid).toBe(true);
    expect(result).not.toHaveProperty('drawnElementCount');
    // Same rule for the defect list: a render that did not happen found no
    // defects and must not say it found none.
    expect(result).not.toHaveProperty('renderDefects');
    expect(result.findings[0]).toContain('The render could not run');
  });

  it('reports unavailable — not invalid — when the project cannot be read', async () => {
    const result = await grader({
      validityFails: new ToolError('not-a-v2-project', 'holds a legacy monolithic project.json')
    }).check();

    expect(result.unavailable).toContain('legacy monolithic');
    expect(result.valid).toBe(false);
    // 🔴 And the render half, which ran fine, still reports what it saw. The two
    // halves fail independently, so collapsing this to `rendered: false` would
    // put a contradiction in the payload — "it did not render" beside a count of
    // 98. Nothing is risked by the honesty: `buildLessonEvidence()` withholds
    // `complete` from any result carrying `unavailable`.
    expect(result.rendered).toBe(true);
    expect(result.drawnElementCount).toBe(98);
  });

  it('reports unavailable when every viewport failed to measure', async () => {
    const result = await grader({ render: report({ viewports: { desktop: { error: 'boom' } } as never }) }).check();
    expect(result.unavailable).toContain('no measurement');
    expect(result.rendered).toBe(false);
    expect(result).not.toHaveProperty('drawnElementCount');
  });

  it('never throws, so engine 1’s per-step verdicts survive', async () => {
    const result = await grader({
      validityFails: new Error('disk on fire'),
      renderFails: new Error('chrome on fire')
    }).check();
    expect(result.valid).toBe(false);
    expect(result.rendered).toBe(false);
    expect(result.unavailable).toContain('disk on fire');
    expect(result.unavailable).toContain('chrome on fire');
  });
});

// ─── The validity half, actually wired ──────────────────────────────────────

describe('the real validity probe', () => {
  it('validates a project on disk through validate_project’s own call', async () => {
    // No injected probe: this runs `new ProjectStore(dir)` + `validateOnDisk`,
    // which is what proves the wiring rather than the mapping. Only the render
    // is stubbed, because that one needs a Chrome.
    const dir = copyFixture();
    const result = await createWholeSolutionGrader(dir, {
      probeRender: async () => recordedReport('phase55-replay-sonnet')
    }).check();

    expect(result.unavailable).toBeUndefined();
    expect(result.valid).toBe(true);
    expect(result.rendered).toBe(true);
  });

  it('reports a directory that is not a v2 project as unavailable', async () => {
    const result = await createWholeSolutionGrader('/definitely/not/a/project', {
      probeRender: async () => recordedReport('phase55-replay-sonnet')
    }).check();

    expect(result.unavailable).toContain('does not exist');
    expect(result.valid).toBe(false);
  });
});

describe('🔴 FIX-027 §18 — the sidecar reports the same tally the editor does', () => {
  /** A validation report carrying `n` non-`info` diagnostics. */
  function withDiagnostics(n: number): ValidationReport {
    return {
      diagnostics: Array.from({ length: n }, (_, i) => ({
        code: 'UnknownNodeType',
        severity: 'error',
        message: `problem ${i}`,
        location: { component: '/App' }
      })),
      summary: { errors: n, warnings: 0, infos: 0, nodesChecked: 1, endpointsChecked: 1 }
    } as unknown as ValidationReport;
  }

  it('counts before the cap — 26 problems are 26, not the 21 lines that fit', async () => {
    const result = await grader({ validity: withDiagnostics(26) }).check();

    expect(result.findings).toHaveLength(MAX_FINDING_LINES + 1);
    expect(result.findingTotal).toBe(26);
  });

  it('🔴 agrees with the editor adapter, which is the whole reason both cap at one number', async () => {
    // A learner graded in the sidecar and a learner graded in the editor must
    // be told the same thing. The list length cannot carry that promise — it is
    // 21 for both of these — so the tally has to.
    const of = async (n: number) => {
      const r = await grader({ validity: withDiagnostics(n) }).check();
      return { listed: r.findings.length, total: r.findingTotal };
    };

    expect([await of(22), await of(400)]).toEqual([
      { listed: 21, total: 22 },
      { listed: 21, total: 400 }
    ]);
  });

  it('reports zero for a clean project rather than staying silent', async () => {
    expect((await grader({}).check()).findingTotal).toBe(0);
  });
});
