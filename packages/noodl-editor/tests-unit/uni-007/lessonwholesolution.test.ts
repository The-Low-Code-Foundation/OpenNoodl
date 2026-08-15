/**
 * UNI-007 slice 4 — engine 2's **editor** adapter, and the counting rule both
 * adapters now share.
 *
 * The sidecar's adapter (`noodl-mcp/lessons/wholeSolutionGrader.ts`) has its own
 * 21 specs against recorded renders. This file grades the second implementation
 * — the one the editor's "check my work" button runs — plus
 * `lessondrawncount.ts`, which exists precisely so the rule under test here is
 * the *same* rule the sidecar applies rather than a second copy of it.
 *
 * 🔴 The spine: **an adapter that stays silent about `drawnElementCount` opts
 * itself out of the empty-page check.** `normaliseWholeSolutionResult` refuses
 * to invent a count nobody reported, so "always reports it, including zero" is a
 * property of each adapter and has to be graded once per adapter.
 */

import { countDrawnElements, reportsBlankRender } from '../../src/editor/src/models/lessondrawncount';
import {
  capFindingLines,
  createEditorWholeSolutionGrader,
  MAX_FINDING_LINES
} from '../../src/editor/src/models/lessonwholesolution';
import type { RenderProbeResult, ValidityProbeResult } from '../../src/editor/src/models/lessonwholesolution';
import { normaliseWholeSolutionResult } from '../../src/editor/src/models/lessongrading';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function viewport(texts: number, images: number) {
  return { requested: { width: 1280, height: 900 }, text: { elements: texts }, images: { total: images } };
}

function render(partial: Partial<RenderProbeResult> = {}): RenderProbeResult {
  return { viewports: {}, findings: [], lines: [], ...partial };
}

const healthy: ValidityProbeResult = { valid: true, lines: [] };

function grader(validity: () => ValidityProbeResult, renderResult: () => Promise<RenderProbeResult>) {
  return createEditorWholeSolutionGrader({ probeValidity: validity, probeRender: renderResult });
}

// ─── The shared rule ────────────────────────────────────────────────────────

describe('countDrawnElements — the rule both adapters apply', () => {
  it('counts text elements plus images, the harness’s own two numbers', () => {
    expect(countDrawnElements({ desktop: viewport(7, 2) })).toBe(9);
  });

  it('aggregates across viewports with min, not sum', () => {
    // 🔴 The whole point. A page drawing on desktop and nothing on a phone has
    // not rendered, and summing would hide exactly that — while the harness
    // would independently raise `blank-render`.
    expect(countDrawnElements({ desktop: viewport(40, 3), phone: viewport(0, 0) })).toBe(0);
  });

  it('skips a viewport that failed to measure rather than counting it as zero', () => {
    expect(countDrawnElements({ desktop: viewport(5, 0), phone: { error: 'evaluation failed' } })).toBe(5);
  });

  it('skips a viewport missing either number, whatever else it holds', () => {
    expect(countDrawnElements({ desktop: viewport(5, 0), phone: { text: { elements: 3 } } })).toBe(5);
  });

  it('returns undefined — not zero — when nothing could be measured at all', () => {
    expect(countDrawnElements({ desktop: { error: 'x' }, phone: { error: 'y' } })).toBeUndefined();
    expect(countDrawnElements({})).toBeUndefined();
    expect(countDrawnElements(undefined)).toBeUndefined();
  });

  it('reads the harness’s own blank verdict by its own code', () => {
    expect(reportsBlankRender([{ code: 'placeholder-text' }, { code: 'blank-render' }])).toBe(true);
    expect(reportsBlankRender([{ code: 'placeholder-text' }])).toBe(false);
    expect(reportsBlankRender(undefined)).toBe(false);
  });
});

// ─── The adapter ────────────────────────────────────────────────────────────

describe('createEditorWholeSolutionGrader', () => {
  it('always reports drawnElementCount, including zero', async () => {
    const result = await grader(
      () => healthy,
      async () => render({ viewports: { desktop: viewport(0, 0) } })
    ).check();

    // Reported rather than omitted: omitting it would opt this adapter out of
    // the empty-page rule entirely, which is the one thing engine 2 is for.
    expect(result.drawnElementCount).toBe(0);
    expect(result.rendered).toBe(false);
  });

  it('a clean, valid, empty page does not complete a lesson', async () => {
    const result = normaliseWholeSolutionResult(
      await grader(
        () => healthy,
        async () => render({ viewports: { desktop: viewport(0, 0) } })
      ).check()
    );

    expect(result.valid).toBe(true);
    expect(result.rendered).toBe(false);
  });

  it('lets the harness’s blank verdict overrule a positive count', async () => {
    const result = await grader(
      () => healthy,
      async () => render({ viewports: { desktop: viewport(3, 0) } , findings: [{ code: 'blank-render' }] })
    ).check();

    // Two independent reads of one question; the conservative one wins.
    expect(result.drawnElementCount).toBe(3);
    expect(result.rendered).toBe(false);
  });

  it('reports a healthy render as rendered, with the count', async () => {
    const result = await grader(
      () => healthy,
      async () => render({ viewports: { desktop: viewport(12, 1), phone: viewport(11, 1) } })
    ).check();

    expect(result).toMatchObject({ valid: true, rendered: true, drawnElementCount: 12 });
    expect(result.unavailable).toBeUndefined();
  });

  it('reports a capture that could not run as unavailable, never as an empty page', async () => {
    const result = await grader(
      () => healthy,
      async () => render({ error: 'the capture did not finish within 60s' })
    ).check();

    expect(result.unavailable).toContain('the capture did not finish');
    expect(result.drawnElementCount).toBeUndefined();
    expect(result.rendered).toBe(false);
  });

  it('reports every-viewport-failed as unavailable rather than as zero drawn', async () => {
    const result = await grader(
      () => healthy,
      async () => render({ viewports: { desktop: { error: 'evaluation failed' } } })
    ).check();

    expect(result.unavailable).toContain('no measurement');
    expect(result.drawnElementCount).toBeUndefined();
  });

  it('keeps the render honest when only the validator could not run', async () => {
    /*
     * 🔴 The mistake the sidecar adapter's first draft made, guarded here for
     * the second implementation: the halves fail independently, so a project
     * the validator cannot read may still render perfectly. Emitting
     * `rendered: false` beside a real count would be a payload contradicting
     * itself.
     */
    const result = await grader(
      () => {
        throw new Error('the model was mid-swap');
      },
      async () => render({ viewports: { desktop: viewport(98, 0) } })
    ).check();

    expect(result.valid).toBe(false);
    expect(result.rendered).toBe(true);
    expect(result.drawnElementCount).toBe(98);
    expect(result.unavailable).toContain('could not be validated');
  });

  it('never throws, so engine 1’s per-step verdicts survive a dead browser', async () => {
    const result = await grader(
      () => {
        throw new Error('no project');
      },
      async () => {
        throw new Error('no window');
      }
    ).check();

    expect(result.unavailable).toBeTruthy();
    expect(result.valid).toBe(false);
    expect(result.rendered).toBe(false);
  });

  it('reports validity findings in the validator’s own lines', async () => {
    const result = await grader(
      () => ({ valid: false, lines: ['[error] Home: UnknownNodeType — "Grup" is not a node type'] }),
      async () => render({ viewports: { desktop: viewport(4, 0) } })
    ).check();

    expect(result.valid).toBe(false);
    expect(result.findings).toContain('[error] Home: UnknownNodeType — "Grup" is not a node type');
  });

  it('puts the reason it could not run first, ahead of the findings', async () => {
    const result = await grader(
      () => ({ valid: false, lines: ['[warning] a thing'] }),
      async () => render({ error: 'no viewer' })
    ).check();

    expect(result.findings[0]).toContain('The render could not run');
  });
});

describe('capFindingLines', () => {
  it('announces the overflow rather than dropping it silently', () => {
    const lines = Array.from({ length: MAX_FINDING_LINES + 5 }, (_, i) => `problem ${i}`);
    const capped = capFindingLines(lines);

    expect(capped).toHaveLength(MAX_FINDING_LINES + 1);
    expect(capped[capped.length - 1]).toBe('…and 5 more problems not listed here.');
  });

  it('leaves a short list exactly as it was', () => {
    expect(capFindingLines(['one', 'two'])).toEqual(['one', 'two']);
  });
});
