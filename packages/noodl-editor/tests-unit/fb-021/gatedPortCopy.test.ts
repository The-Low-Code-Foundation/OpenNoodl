/**
 * FB-021 scope 2 — the copy for a port that is **switched off**, not unreachable.
 *
 * 🔴 The whole point of these specs is one distinction the rest of the refusal vocabulary does
 * not make. Every other `RefusalReason` means *this wire will not be made*. `gated` means the
 * wire **would be made and then ignored** — 328 input ports on the shipped catalog are wirable
 * in exactly that way. So the generic line is not a vaguer version of the gated one, it is the
 * opposite claim, and a spec that only checked "some string comes back" would pass on it.
 *
 * These grade `portCopy` alone, which is import-free. The `ConnectionBar` wiring that decides
 * *which* ports get the reason, and the `evaluateConnectionHealth` half that dashes the wire,
 * need the node library and are covered from the editor suite / the drive.
 */

import {
  refusalHeadline,
  refusedGroupSummary
} from '../../src/editor/src/views/ConnectionPopup/portCopy';

describe('FB-021 gated-port copy', () => {
  it('summarises a gated group as switched off rather than unreachable', () => {
    expect(refusedGroupSummary(3, 'gated')).toBe('3 ports switched off by a setting');
    expect(refusedGroupSummary(1, 'gated')).toBe('1 port switched off by a setting');
  });

  it('never tells the author the wire cannot reach a gated port', () => {
    // The defect in one assertion: it CAN reach it. Saying otherwise sends someone looking for
    // a type error that is not there, which is the reading Jordan arrived at four times.
    const summary = refusedGroupSummary(2, 'gated');
    expect(summary).not.toContain("can't reach");
    expect(refusalHeadline('gated', 'string', 'number')).not.toContain('cannot drive');
  });

  it('🔴 keeps the gate explanation ahead of the signal wording', () => {
    /*
     * `refusedGroupSummary` tests `targetTypeName === 'signal'` before it tests `reason`, so a
     * gated signal port would read "a moment, not a value" — true about signals, and the wrong
     * account of why THIS row is inert. Ordering is the only thing that prevents it, and
     * ordering is exactly what a later edit re-shuffles without noticing.
     */
    expect(refusedGroupSummary(2, 'gated', 'signal')).toBe('2 ports switched off by a setting');
    expect(refusalHeadline('gated', 'string', 'signal')).toBe('This port is switched off by another setting.');

    // The control: with any other reason, the signal wording is still the right one.
    expect(refusedGroupSummary(2, 'type-mismatch', 'signal')).toContain('a moment, not a value');
    expect(refusalHeadline('signal-rule', 'string', 'signal')).toBe('Signal inputs are moments, not values.');
  });

  it('leaves the reasons it does not own untouched', () => {
    // A new arm in a chain of ifs is the classic way to change an answer nobody asked about.
    expect(refusedGroupSummary(4, 'duplicate')).toBe('4 already connected');
    expect(refusedGroupSummary(4, 'other')).toBe("4 ports this wire can't reach");
    expect(refusalHeadline('duplicate', 'string', 'number')).toBe('Already connected.');
  });
});
