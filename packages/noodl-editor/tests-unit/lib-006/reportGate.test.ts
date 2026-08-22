/**
 * LBR-0xx — the report-file gate.
 *
 * The defect: `apply.ts` wrote `import-report.json` + `IMPORT-REPORT.md` into
 * the target project on `if (legacyReport)` — i.e. always, because every apply
 * assesses — while `ResultStage` shows its legacy-salvage banner only when
 * `verdict.recommendation !== 'proceed'`. A clean first-party prefab install
 * therefore left two files in a fresh project claiming it was legacy salvage,
 * with no banner anywhere saying so.
 *
 * The fix is ONE predicate, `shouldWriteImportReport`, applied by `apply.ts` to
 * both files (they are written together by `writeImportReport`). These specs
 * grade the predicate through the REAL report pipeline (`buildReport` →
 * `computeVerdict`), not hand-built verdicts, and pin its equivalence to the
 * UI's gate so the two cannot drift apart again.
 *
 * `writeImportReport` itself needs Electron at import time (`FileSystem`), so
 * the file I/O half is not gradable in this plain-Node runner; the decision is.
 */

import { buildReport } from '../../src/editor/src/utils/import-engine/legacy/report';
import type { LegacyFinding, LegacyOutcome } from '../../src/editor/src/utils/import-engine/legacy/types';
import { shouldWriteImportReport } from '../../src/editor/src/utils/import-engine/legacy/verdict';

const NOW = new Date('2026-08-03T12:00:00.000Z');

function finding(overrides: Partial<LegacyFinding> & { id: string; outcome: LegacyOutcome }): LegacyFinding {
  return {
    kind: 'node',
    reason: 'type-removed',
    original: 'Some.Type',
    message: 'message',
    equivalents: [],
    ...overrides
  } as LegacyFinding;
}

function report(findings: LegacyFinding[], constructsAssessed: number, nodeCount = constructsAssessed) {
  return buildReport({ sourceDir: '/src', findings, constructsAssessed, nodeCount, now: NOW });
}

describe('LBR-0xx — shouldWriteImportReport', () => {
  it('a clean install (every construct current, proceed verdict) writes no report files', () => {
    // A first-party prefab: nothing earns a finding, everything is silently
    // converted. This is exactly the report a toast/send-grid install produces.
    const r = report([], 40);

    expect(r.verdict.recommendation).toBe('proceed');
    expect(shouldWriteImportReport(r)).toBe(false);
  });

  it('a proceed-with-rewrites import also writes no files — same as the banner', () => {
    // Everything converted, some rewritten. ResultStage shows nothing here, so
    // files claiming legacy salvage would be the original defect again.
    const r = report([finding({ id: 'a', outcome: 'converted-with-changes', reason: 'rest-to-http' })], 40);

    expect(r.verdict.recommendation).toBe('proceed');
    expect(shouldWriteImportReport(r)).toBe(false);
  });

  it('a legacy import with placeholders (repair verdict) keeps its report files', () => {
    // Large enough that the verdict is repair, not rebuild.
    const r = report([finding({ id: 'a', outcome: 'placeholder', occurrences: 8 })], 400, 400);

    expect(r.verdict.recommendation).toBe('repair');
    expect(shouldWriteImportReport(r)).toBe(true);
  });

  it('a rebuild verdict keeps its report files too', () => {
    // The policy's worked example: small, 40% unconvertible.
    const r = report([finding({ id: 'a', outcome: 'placeholder', occurrences: 8 })], 20, 20);

    expect(r.verdict.recommendation).toBe('rebuild');
    expect(shouldWriteImportReport(r)).toBe(true);
  });

  it('agrees with the UI banner gate for every recommendation', () => {
    // ResultStage.tsx: `summary.legacy.recommendation !== 'proceed'`. The files
    // and the banner must move together; this pins the equivalence.
    const reports = [
      report([], 40),
      report([finding({ id: 'a', outcome: 'converted-with-changes' })], 40),
      report([finding({ id: 'a', outcome: 'placeholder', occurrences: 8 })], 400, 400),
      report([finding({ id: 'a', outcome: 'placeholder', occurrences: 8 })], 20, 20),
      report([finding({ id: 'a', outcome: 'dropped' })], 200, 200)
    ];
    for (const r of reports) {
      const bannerShown = r.verdict.recommendation !== 'proceed';
      expect(shouldWriteImportReport(r)).toBe(bannerShown);
    }
  });
});
