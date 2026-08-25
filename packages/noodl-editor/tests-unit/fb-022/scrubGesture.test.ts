/**
 * FB-022 — the arithmetic a drag does to a number.
 *
 * Every rule here is one a user would feel and could not name: that dragging back to where
 * they pressed restores the value exactly, that shift moves in tens, that an `em` field does
 * not travel a hundred ems across the panel. None of them need a DOM, so none of them are
 * left to the drive.
 *
 * ⚠️ What this file cannot see: that anything calls `scrubAt`, that the value reaches the
 * model, or that a field is draggable at all. Those are `scrubController.test.ts`,
 * `scrubCommit.test.ts` and the drive respectively.
 */
import {
  SCRUB_ALT_SCALE,
  SCRUB_SHIFT_SCALE,
  SCRUB_THRESHOLD_PX,
  beginScrubGesture,
  decimalsForStep,
  quantizeToStep,
  scrubAt,
  scrubModifierScale,
  scrubStepForUnit
} from '@noodl-core-ui/components/property-panel/scrub/scrubGesture';

const gesture = (startValue = 50, step = 1) => beginScrubGesture({ startValue, originX: 100, step });

describe('FB-022 — the threshold is what separates a click from a drag', () => {
  // 🔴 The paired arm matters more than either half. "Nothing happened" is also what a broken
  // gesture produces, so the boundary is asserted from both sides of the same number with one
  // pixel between them.
  it('does not move on travel below the threshold', () => {
    const g = gesture();
    const sample = scrubAt(g, 100 + (SCRUB_THRESHOLD_PX - 1));
    expect(sample.moved).toBe(false);
    expect(g.moved).toBe(false);
  });

  it('moves at exactly the threshold', () => {
    const g = gesture();
    expect(scrubAt(g, 100 + SCRUB_THRESHOLD_PX).moved).toBe(true);
  });

  it('moves the same distance in either direction', () => {
    const left = gesture();
    expect(scrubAt(left, 100 - SCRUB_THRESHOLD_PX).moved).toBe(true);
  });

  // 🔴 The latch. Without it a drag that returns near its origin reads as a click on mouseup,
  // so the gesture writes 200 values and then records no undo entry for any of them — the
  // model changes and the history does not.
  it('stays moved once it has moved, even back at the origin', () => {
    const g = gesture();
    scrubAt(g, 140);
    const back = scrubAt(g, 100);
    expect(back.moved).toBe(true);
    expect(back.value).toBe(50);
  });
});

describe('FB-022 — the value is absolute within the gesture, never accumulated', () => {
  it('is the start value plus total displacement times the step', () => {
    const g = gesture(50, 1);
    expect(scrubAt(g, 130).value).toBe(80);
  });

  // 🔴 The arm that separates absolute from accumulated. An implementation that added a delta
  // per sample lands on the same number here ONLY if it never rounds — and it does round, on
  // every sample, which is why the out-and-back below is the real test.
  it('lands on the same value whether it got there in one sample or fifty', () => {
    const oneHop = gesture(50, 0.1);
    expect(scrubAt(oneHop, 150).value).toBe(55);

    const manyHops = gesture(50, 0.1);
    let last = 0;
    for (let x = 101; x <= 150; x++) last = scrubAt(manyHops, x).value;
    expect(last).toBe(55);
  });

  it('returns exactly to the start value when the pointer returns to the origin', () => {
    const g = gesture(50.5, 0.1);
    for (let x = 101; x <= 180; x++) scrubAt(g, x);
    for (let x = 179; x >= 100; x--) scrubAt(g, x);
    expect(scrubAt(g, 100).value).toBe(50.5);
  });

  it('does not leak binary float noise into the value', () => {
    const g = gesture(50, 0.1);
    expect(scrubAt(g, 103).value).toBe(50.3);
    expect(String(scrubAt(g, 103).value)).toBe('50.3');
  });
});

describe('FB-022 — modifiers scale the step', () => {
  it('shift is x10 and alt is x0.1', () => {
    expect(scrubModifierScale({ shiftKey: true })).toBe(SCRUB_SHIFT_SCALE);
    expect(scrubModifierScale({ altKey: true })).toBe(SCRUB_ALT_SCALE);
    expect(scrubModifierScale({})).toBe(1);
    expect(scrubModifierScale()).toBe(1);
  });

  // The composition rule, stated. Both keys is the ordinary step — the only rule that is
  // order-independent, and the reason the implementation multiplies rather than branching.
  it('composes multiplicatively, so both modifiers are the ordinary step', () => {
    expect(scrubModifierScale({ shiftKey: true, altKey: true })).toBe(1);
  });

  it('carries the scale into the value', () => {
    const coarse = gesture(50, 1);
    expect(scrubAt(coarse, 110, { shiftKey: true }).value).toBe(150);

    const fine = gesture(50, 1);
    expect(scrubAt(fine, 110, { altKey: true }).value).toBe(51);
  });

  // ⚠️ A modifier pressed mid-drag changes the ramp from the ORIGIN, not from where the key
  // went down. That follows from the value being absolute, and it is the behaviour that makes
  // "hold shift to go faster, let go to fine-tune" land somewhere predictable.
  it('re-reads the modifier on every sample', () => {
    const g = gesture(50, 1);
    expect(scrubAt(g, 110).value).toBe(60);
    expect(scrubAt(g, 110, { shiftKey: true }).value).toBe(150);
    expect(scrubAt(g, 110).value).toBe(60);
  });
});

describe('FB-022 — the step a unit implies', () => {
  it('is one for every unit that is roughly a pixel or a degree', () => {
    for (const unit of ['', 'px', '%', 'vw', 'vh', 'deg']) {
      expect(scrubStepForUnit(unit)).toBe(1);
    }
  });

  // 🔴 The one that is not 1, and the arm that would catch the table being flattened. An em
  // is a line of text: one-per-pixel makes a 200px drag span 200 ems.
  it('is a tenth for em and rem', () => {
    expect(scrubStepForUnit('em')).toBe(0.1);
    expect(scrubStepForUnit('rem')).toBe(0.1);
  });

  it('falls back to one for a unit a kit invented, and for no unit at all', () => {
    expect(scrubStepForUnit('fr')).toBe(1);
    expect(scrubStepForUnit(undefined)).toBe(1);
    expect(scrubStepForUnit(null)).toBe(1);
  });
});

describe('FB-022 — quantizing', () => {
  it('reads decimals off the step', () => {
    expect(decimalsForStep(1)).toBe(0);
    expect(decimalsForStep(10)).toBe(0);
    expect(decimalsForStep(0.1)).toBe(1);
    expect(decimalsForStep(0.01)).toBe(2);
  });

  it('gives a whole number for a whole step', () => {
    expect(quantizeToStep(50.7, 1)).toBe(51);
    expect(quantizeToStep(-0.4, 1)).toBe(-0);
  });

  it('does not invent precision the step does not have', () => {
    expect(quantizeToStep(50.34, 0.1)).toBe(50.3);
  });

  // Guards against a step of 0 or NaN reaching the arithmetic from a malformed port type: the
  // gesture clamps it to 1 rather than producing NaN, which would be written to the project.
  it('clamps a nonsense step rather than producing NaN', () => {
    const zero = beginScrubGesture({ startValue: 20, originX: 0, step: 0 });
    expect(zero.step).toBe(1);
    expect(scrubAt(zero, 5).value).toBe(25);

    const nan = beginScrubGesture({ startValue: 20, originX: 0, step: Number.NaN });
    expect(scrubAt(nan, 5).value).toBe(25);
  });

  it('treats a non-finite start value as zero rather than poisoning every sample', () => {
    const g = beginScrubGesture({ startValue: Number.NaN, originX: 0, step: 1 });
    expect(scrubAt(g, 10).value).toBe(10);
  });
});
