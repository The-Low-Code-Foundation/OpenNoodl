/**
 * FB-021 scope 2 — the summary line over a set that is **partly** switched off.
 *
 * ## 🔴 Why this file exists: every part was already green and the composition was wrong
 *
 * `gatedPortCopy.test.ts` next to this one grades `refusedGroupSummary('gated')` and passes.
 * `refusalPlan.test.ts` grades `dominantReason` and passes. Both functions are correct. Driven
 * on a real `Group` in `contentSize` with a string output in flight (2026-08-25), the folded
 * block held **8 gated ports and one type-mismatched `Focus`**, `dominantReason` answered
 * `'other'` — by design, and rightly, for two kinds of *refusal* — and the popup rendered
 *
 *     "9 ports this wire can't reach"
 *
 * over eight ports the wire reaches perfectly well. That is the exact sentence this task exists
 * to prevent, produced by two correct functions composed.
 *
 * ⚠️ Note what would NOT have caught it: `dominantReason` cannot be "fixed" by letting `gated`
 * win, because that puts *"switched off by a setting"* over the type-mismatched row instead —
 * the same defect pointing the other way. The two kinds have to stop sharing a line, which is a
 * fact about the composition and is only assertable here.
 *
 * Both modules under test are import-free, so this runs in plain Node like its neighbours.
 */

import { refusedGroupSummary } from '../../src/editor/src/views/ConnectionPopup/portCopy';
import {
  dominantReason,
  dominantTypeName,
  partitionGated,
  type PlannablePort
} from '../../src/editor/src/views/ConnectionPopup/refusalPlan';

function port(partial: Partial<PlannablePort> & { name: string }): PlannablePort {
  return { displayName: partial.name, typeName: 'string', disabled: true, ...partial };
}

/**
 * The folded block as the drive actually found it: `Focus` refused for its type, and the
 * dimension and scroll families switched off by `Size Mode` / `Enable Scroll`.
 */
const AS_DRIVEN: PlannablePort[] = [
  port({ name: 'focus', displayName: 'Focus', typeName: 'signal', group: 'Focus', reason: 'type-mismatch' }),
  port({ name: 'width', displayName: 'Width', typeName: 'dimension', group: 'Dimensions', reason: 'gated' }),
  port({ name: 'height', displayName: 'Height', typeName: 'dimension', group: 'Dimensions', reason: 'gated' }),
  port({ name: 'scrollToIndex.do', displayName: 'Scroll To Index - Do', typeName: 'signal', group: 'Scroll', reason: 'gated' })
];

/** What the component renders: one summary line per non-empty half, in render order. */
function summaryLines(ports: PlannablePort[]): string[] {
  const { refused, gated } = partitionGated(ports);
  return [refused, gated]
    .filter((half) => half.length > 0)
    .map((half) => refusedGroupSummary(half.length, dominantReason(half), dominantTypeName(half)));
}

describe('FB-021 — a mixed refused set never gets one summary', () => {
  it('🔴 does not say "can\'t reach" over a set that is mostly switched off', () => {
    const lines = summaryLines(AS_DRIVEN);

    // The defect, stated as the drive found it: this string appeared over 8 gated ports.
    for (const line of lines) {
      if (line.includes('switched off')) continue;
      expect(line).not.toContain('3 ports');
      expect(line).not.toContain('4 ports');
    }
    expect(lines.join(' | ')).not.toContain("4 ports this wire can't reach");
  });

  it('gives each kind its own line, and each line the right count', () => {
    expect(summaryLines(AS_DRIVEN)).toEqual([
      // `Focus` recovers its own honest wording too — melted into `other` it had lost it.
      '1 signal input · a moment, not a value',
      '3 ports switched off by a setting'
    ]);
  });

  it('leaves a set with no gated ports rendering exactly as before', () => {
    // The regression guard for SIG-001: one line, unchanged, when the split has nothing to do.
    const refusedOnly = AS_DRIVEN.filter((p) => p.reason !== 'gated');
    expect(summaryLines(refusedOnly)).toEqual(['1 signal input · a moment, not a value']);

    const gatedOnly = AS_DRIVEN.filter((p) => p.reason === 'gated');
    expect(summaryLines(gatedOnly)).toEqual(['3 ports switched off by a setting']);
  });

  it('partitions by reason and preserves order within each half', () => {
    const { refused, gated } = partitionGated(AS_DRIVEN);
    expect(refused.map((p) => p.name)).toEqual(['focus']);
    expect(gated.map((p) => p.name)).toEqual(['width', 'height', 'scrollToIndex.do']);
  });

  it('treats a missing reason as refused, not as gated', () => {
    /*
     * ⚠️ `reason` is optional on the row and `dominantReason` already defaults it to `'other'`.
     * A partition that put unlabelled ports in the gated half would claim a setting switched off
     * a port nothing has explained — the failure `portGateReason` refuses to make elsewhere.
     */
    const { refused, gated } = partitionGated([port({ name: 'mystery' })]);
    expect(refused.map((p) => p.name)).toEqual(['mystery']);
    expect(gated).toEqual([]);
  });

  it('renders nothing for an empty set', () => {
    expect(summaryLines([])).toEqual([]);
  });
});
