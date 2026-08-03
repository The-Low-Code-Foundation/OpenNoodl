/**
 * ALPHA-007 §2 — the URL budget.
 *
 * "Long URLs are silently mangled rather than rejected, which is the worst
 * failure mode available." A reporter who sees a half-filled GitHub form
 * concludes NodeGX is broken and does not file — which is the exact drop-off
 * this task exists to stop. So the fitting is asserted, not assumed.
 */

import { composeReport } from '../../src/editor/src/utils/report/compose';
import { ErrorTailEntry } from '../../src/editor/src/utils/report/errorTail';
import { FIELD, URL_BUDGET_BYTES, encodeIssueQuery, fitToBudget } from '../../src/editor/src/utils/report/issueForm';

const NOW = Date.parse('2026-08-03T12:00:00.000Z');

function bigTail(lines: number): ErrorTailEntry[] {
  return Array.from({ length: lines }, (_value, index) => ({
    at: NOW - 1000,
    level: 'error' as const,
    text: `Uncaught TypeError: cannot read property 'value' of undefined (frame ${index}) ` + 'x'.repeat(120)
  }));
}

function report(overrides: { whatHappened?: string; errors?: ErrorTailEntry[] } = {}) {
  return composeReport({
    reportId: 'r-20260803-120000-abcd',
    capturedAt: new Date(NOW).toISOString(),
    user: {
      whatHappened: overrides.whatHappened ?? 'The preview stopped updating.',
      surface: 'The editor (canvas, panels, menus)',
      severity: 'blocker',
      freshProject: 'Yes — a new project does it too',
      steps: '1. open\n2. edit\n3. look'
    },
    app: { version: '0.1.0', packaged: true },
    os: { platform: 'darwin', arch: 'arm64' },
    editor: { route: 'editor' },
    project: null,
    errors: overrides.errors,
    now: NOW
  });
}

describe('a normal report is nowhere near the budget', () => {
  it('fits without trimming anything', () => {
    const composed = report();
    expect(composed.truncated).toEqual([]);
    expect(new URL(composed.url).search.length).toBeLessThan(URL_BUDGET_BYTES);
  });
});

describe('an enormous error tail', () => {
  const composed = report({ errors: bigTail(200) });

  it('is trimmed to fit rather than mangled by the browser', () => {
    expect(encodeIssueQuery(composed.fields).length).toBeLessThanOrEqual(URL_BUDGET_BYTES);
  });

  it('says so in the field itself, so the reader is not misled about completeness', () => {
    // The tail is capped before the URL budget is even consulted (§3: "take
    // only … from the last few minutes, redacted, capped"), so this particular
    // report never reaches `fitToBudget`. What matters is that a truncated tail
    // announces itself rather than looking like the whole story.
    expect(composed.fields[FIELD.errors]).toContain('[older lines omitted]');
  });

  it('keeps the newest lines, because those are the ones about the bug', () => {
    const errors = composed.fields[FIELD.errors] as string;
    expect(errors).toContain('frame 199');
    expect(errors).not.toContain('frame 0)');
  });

  it('keeps the reporter’s own words and the required dropdowns untouched', () => {
    expect(composed.fields[FIELD.whatHappened]).toBe('The preview stopped updating.');
    expect(composed.fields[FIELD.surface]).toBe('The editor (canvas, panels, menus)');
    expect(composed.fields[FIELD.os]).toBe('macOS (Apple Silicon)');
  });

  it('leaves the bundle with the full, untrimmed count', () => {
    // The bundle is the fallback and exists precisely so nothing is lost (§5).
    expect(composed.diagnostics.errorCount).toBe(200);
  });
});

describe('when even a trimmed tail will not fit', () => {
  // A reporter who pastes a wall of text. `what-happened` is required by the
  // form, so it must be shortened rather than dropped: an empty required field
  // blocks them at the very last step with no explanation.
  const composed = report({ whatHappened: 'A'.repeat(20000), errors: bigTail(200) });

  it('still fits', () => {
    expect(encodeIssueQuery(composed.fields).length).toBeLessThanOrEqual(URL_BUDGET_BYTES);
  });

  it('leaves the required field non-empty', () => {
    expect((composed.fields[FIELD.whatHappened] as string).length).toBeGreaterThan(400);
  });

  it('keeps the diagnostics fence valid JSON even after replacing it', () => {
    const value = composed.fields[FIELD.diagnostics] as string;
    expect(() => JSON.parse(value)).not.toThrow();
    expect(JSON.parse(value).schema).toBe(1);
    expect(JSON.parse(value).reportId).toBe('r-20260803-120000-abcd');
  });
});

describe('fitToBudget on its own', () => {
  it('is a no-op when everything already fits', () => {
    const fields = { [FIELD.whatHappened]: 'short' };
    expect(fitToBudget(fields, { budgetBytes: 1000 })).toEqual({ fields, truncated: [] });
  });

  it('never returns a query longer than the budget it was given', () => {
    const fields = {
      [FIELD.whatHappened]: 'w'.repeat(5000),
      [FIELD.steps]: 's'.repeat(5000),
      [FIELD.errors]: 'e'.repeat(5000),
      [FIELD.diagnostics]: JSON.stringify({ schema: 1, padding: 'd'.repeat(5000) })
    };
    const fitted = fitToBudget(fields, { budgetBytes: 2000, minimalDiagnostics: '{"schema":1}' });
    expect(encodeIssueQuery(fitted.fields).length).toBeLessThanOrEqual(2000);
  });
});
