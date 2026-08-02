/**
 * LIB-006 — the report and the rebuild verdict.
 *
 * The load-bearing test in here is `coverage`: the report's claim that nothing
 * was silently dropped is arithmetic, and this asserts the arithmetic.
 */

import { buildReport, renderReportMarkdown } from '../../src/editor/src/utils/import-engine/legacy/report';
import type { LegacyFinding, LegacyOutcome } from '../../src/editor/src/utils/import-engine/legacy/types';
import {
  computeVerdict,
  tallyOutcomes,
  REBUILD_MAX_NODES,
  REBUILD_UNCONVERTED_SHARE
} from '../../src/editor/src/utils/import-engine/legacy/verdict';

const NOW = new Date('2026-08-02T12:00:00.000Z');

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

// ─── Coverage: the no-silent-drops proof ─────────────────────────────────────

describe('report — coverage', () => {
  it('makes the four counts sum to the constructs assessed', () => {
    const findings = [
      finding({ id: 'a', outcome: 'placeholder' }),
      finding({ id: 'b', outcome: 'dropped' }),
      finding({ id: 'c', outcome: 'converted-with-changes' }),
      finding({ id: 'd', outcome: 'converted', occurrences: 7 })
    ];
    const r = report(findings, 100);
    const total = (['converted', 'converted-with-changes', 'placeholder', 'dropped'] as LegacyOutcome[]).reduce(
      (sum, o) => sum + r.counts[o],
      0
    );

    expect(total).toBe(100);
    expect(r.coverage.constructsAssessed).toBe(100);
    expect(r.coverage.findingsEmitted).toBe(4);
    // 100 assessed − (1 + 1 + 1 + 7 accounted for by findings) = 90 silent.
    expect(r.coverage.silentlyConverted).toBe(90);
  });

  it('weights an aggregated finding by its occurrences, not as one', () => {
    const counts = tallyOutcomes([finding({ id: 'a', outcome: 'placeholder', occurrences: 5 })], 10);
    expect(counts.placeholder).toBe(5);
    expect(counts.converted).toBe(5);
  });

  it('holds when every construct earned an entry', () => {
    const r = report([finding({ id: 'a', outcome: 'placeholder' })], 1);
    expect(r.coverage.silentlyConverted).toBe(0);
    expect(r.counts.placeholder).toBe(1);
    expect(r.counts.converted).toBe(0);
  });
});

// ─── The rebuild verdict ─────────────────────────────────────────────────────

describe('verdict', () => {
  const counts = (over: Partial<Record<LegacyOutcome, number>>): Record<LegacyOutcome, number> => ({
    converted: 0,
    'converted-with-changes': 0,
    placeholder: 0,
    dropped: 0,
    ...over
  });

  it('proceeds on a clean import', () => {
    const v = computeVerdict({ counts: counts({ converted: 40 }), constructsAssessed: 40, nodeCount: 40 });
    expect(v.recommendation).toBe('proceed');
    expect(v.fidelity).toBe(1);
    expect(v.unconvertedCount).toBe(0);
  });

  it('still proceeds when everything converted but some was rewritten', () => {
    const v = computeVerdict({
      counts: counts({ converted: 38, 'converted-with-changes': 2 }),
      constructsAssessed: 40,
      nodeCount: 40
    });
    expect(v.recommendation).toBe('proceed');
    expect(v.message).toContain('rewritten');
  });

  it('recommends a rebuild for a small project with a large unconverted share', () => {
    // The policy's own worked example: small, and 40% unconvertible.
    const v = computeVerdict({
      counts: counts({ converted: 12, placeholder: 8 }),
      constructsAssessed: 20,
      nodeCount: 20
    });
    expect(v.recommendation).toBe('rebuild');
    expect(v.message).toContain('specification');
  });

  it('recommends repair for a LARGE project with the same share', () => {
    // Fidelity alone would say rebuild here, and it would be absurd advice.
    const v = computeVerdict({
      counts: counts({ converted: 1200, placeholder: 800 }),
      constructsAssessed: 2000,
      nodeCount: 2000
    });
    expect(v.recommendation).toBe('repair');
  });

  it('recommends repair for a small project with a small unconverted share', () => {
    const v = computeVerdict({
      counts: counts({ converted: 99, placeholder: 1 }),
      constructsAssessed: 100,
      nodeCount: 100
    });
    expect(v.recommendation).toBe('repair');
  });

  it('sits exactly on both thresholds and still says rebuild', () => {
    const assessed = 100;
    const placeholder = assessed * REBUILD_UNCONVERTED_SHARE;
    const v = computeVerdict({
      counts: counts({ converted: assessed - placeholder, placeholder }),
      constructsAssessed: assessed,
      nodeCount: REBUILD_MAX_NODES
    });
    expect(v.recommendation).toBe('rebuild');
  });

  it('does not divide by zero on an empty import', () => {
    const v = computeVerdict({ counts: counts({}), constructsAssessed: 0, nodeCount: 0 });
    expect(v.recommendation).toBe('proceed');
    expect(v.fidelity).toBe(1);
  });
});

// ─── The assistant hand-off ──────────────────────────────────────────────────

describe('report — assistant hand-off', () => {
  it('splits repairable from unrepairable by whether an equivalent is known', () => {
    const r = report(
      [
        finding({ id: 'fixable', outcome: 'placeholder', equivalents: ['DbCollection2'] }),
        finding({ id: 'not-fixable', outcome: 'placeholder', equivalents: [] }),
        finding({ id: 'fine', outcome: 'converted', equivalents: ['Text'] })
      ],
      3
    );

    expect(r.handoff.repairable).toEqual(['fixable']);
    expect(r.handoff.unrepairable).toEqual(['not-fixable']);
    // A converted finding is not an action item, so its equivalents are not
    // handed over as types to look up.
    expect(r.handoff.catalogTypes).toEqual(['DbCollection2']);
  });

  it('names the four capabilities the policy leans on', () => {
    const joined = report([], 0).handoff.instructions.join(' ');
    expect(joined).toContain('catalog');
    expect(joined).toContain('authoring loop');
    expect(joined).toContain('semantic validator');
    expect(joined).toContain('rebuild');
  });
});

// ─── The two renderings ──────────────────────────────────────────────────────

describe('report — renderings', () => {
  const findings = [
    finding({
      id: 'node:/App:n1:noodl.byob.QueryData',
      outcome: 'placeholder',
      original: 'noodl.byob.QueryData',
      message: 'Query Data was removed.',
      location: { component: '/App', nodeId: 'n1', nodeLabel: 'Fetch users' },
      equivalents: ['DbCollection2'],
      portChanges: [{ from: 'records', to: 'items' }],
      recommendation: 'Replace it.'
    }),
    finding({
      id: 'type:Label',
      outcome: 'converted',
      reason: 'type-deprecated',
      original: 'Label',
      message: 'Label is deprecated.',
      occurrences: 3,
      equivalents: ['Text']
    })
  ];

  it('renders every finding id, so nothing in the JSON is missing from the prose', () => {
    const markdown = renderReportMarkdown(report(findings, 20));
    for (const f of findings) {
      expect(markdown).toContain(f.id);
    }
  });

  it('leads with the verdict', () => {
    const markdown = renderReportMarkdown(report(findings, 20));
    expect(markdown.indexOf('## Verdict')).toBeLessThan(markdown.indexOf('## Summary'));
  });

  it('puts what cannot be converted above what merely changed', () => {
    const markdown = renderReportMarkdown(
      report([...findings, finding({ id: 'changed', outcome: 'converted-with-changes' })], 20)
    );
    expect(markdown.indexOf('## Could not be converted')).toBeLessThan(markdown.indexOf('## Converted, with changes'));
  });

  it('prefers a node label over a node id when naming a place', () => {
    const markdown = renderReportMarkdown(report(findings, 20));
    expect(markdown).toContain('node "Fetch users"');
  });

  it('accounts for the silent conversions in prose, not just in the table', () => {
    const markdown = renderReportMarkdown(report(findings, 20));
    expect(markdown).toContain('counted, not listed');
  });

  it('omits an empty section rather than printing an empty heading', () => {
    const markdown = renderReportMarkdown(report([finding({ id: 'a', outcome: 'placeholder' })], 1));
    expect(markdown).not.toContain('## Not carried across');
  });

  it('is reproducible for a given clock', () => {
    expect(renderReportMarkdown(report(findings, 20))).toBe(renderReportMarkdown(report(findings, 20)));
  });
});
