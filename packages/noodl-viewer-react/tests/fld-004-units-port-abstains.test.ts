/**
 * FLD-004 (b) (#26) — a units port sent something that is not a size keeps what it has.
 *
 * 🔴 The half of #26 that costs the author work they had already done. The units setter used to
 * `delete props[name]` for anything without a `.value` on it, which removes the property AND the
 * static value the author had authored — so one bad value arriving over a wire did not merely fail
 * to apply, it also threw away the height that was working. That is why the reporter's Group went
 * to 100% rather than staying where they had put it.
 *
 * Graded against the REAL compiled setter off `Group`'s definition — `defineRegularInputProp` runs
 * at definition time, so a reconstruction here would grade a copy of the code rather than the code.
 *
 * The mutant ledger:
 *  - restore the `delete` in the final branch → the abstain arms redden and the prop goes undefined
 *    (AC3's reverted arm, and the one that proves the branch is load-bearing).
 *  - abstain on `null`/`undefined` too → the clearing arms redden: the property panel clears a
 *    parameter through exactly that path, and a cleared value that stays on screen is a worse
 *    defect than the one being fixed.
 *  - drop the raiseRuntimeError → the "said out loud" arm reddens; silence is the defect.
 *  - drop `dimensionIsUsable` → the `{value: "tall", unit: "px"}` arm reddens with "tallpx", which
 *    is the shape a live wire actually delivers and the one no reading of this file predicted.
 *  - make `dimensionIsUsable` reject a unitless port too → the line-height arm reddens.
 */

/* eslint-env jest */

// See `nda-016-layout-sizemode.test.ts`: definitions read `Noodl.deployed` at module scope, and
// the Group's React component pulls in three untransformed ES-module scroll plugins.
(globalThis as Record<string, any>).Noodl = { deployed: false };
jest.mock('../src/components/visual/Group/scroll-plugins/nested-scroll-plugin', () => ({ default: class {} }));
jest.mock('../src/components/visual/Group/scroll-plugins/patched-momentum-scroll', () => ({ default: () => undefined }));
jest.mock('../src/components/visual/Group/scroll-plugins/slide-scroll-plugin', () => ({ default: class {} }));

import GroupNodeModule from '../src/nodes/visual/group';

interface FakeNode {
  props: Record<string, any>;
  errors: { code: string; message: string }[];
  forceUpdates: number;
  raiseRuntimeError(code: string, message: string): void;
  forceUpdate(): void;
  setDiagnostic(): void;
}

function makeInstance(): FakeNode {
  const instance: FakeNode = {
    props: {},
    errors: [],
    forceUpdates: 0,
    raiseRuntimeError(code: string, message: string) {
      instance.errors.push({ code, message });
    },
    forceUpdate() {
      instance.forceUpdates++;
    },
    setDiagnostic() {
      /* not this setter's channel */
    }
  };
  return instance;
}

/** The real compiled setter for one units-typed port on the real `Group` definition. */
function setterFor(port: 'width' | 'height'): (this: FakeNode, value: unknown) => void {
  const input = (GroupNodeModule as any).node.inputs[port];
  expect(typeof input.set).toBe('function');
  // The port really is units-typed, or this file is grading the wrong branch entirely.
  expect(input.type.units).toEqual(['%', 'px', 'vw', 'vh']);
  expect(input.type.defaultUnit).toBe('%');
  return input.set;
}

describe('FLD-004 (b) — a units port abstains rather than throwing the author’s value away', () => {
  it('applies a well-formed size, which is the control every arm below moves away from', () => {
    const node = makeInstance();
    setterFor('height').call(node, { value: 300, unit: 'px' });
    expect(node.props.height).toBe('300px');
    expect(node.errors).toEqual([]);
  });

  it('🔴 keeps the previous value when sent a bare number — AC3, and the reverted arm’s subject', () => {
    const node = makeInstance();
    const set = setterFor('height');
    set.call(node, { value: 300, unit: 'px' });
    set.call(node, 400);
    expect(node.props.height).toBe('300px');
  });

  it('keeps it for a string and for an object with no magnitude in it', () => {
    const node = makeInstance();
    const set = setterFor('height');
    set.call(node, { value: 300, unit: 'px' });
    set.call(node, 'tall');
    expect(node.props.height).toBe('300px');
    set.call(node, { unit: 'px' });
    expect(node.props.height).toBe('300px');
  });

  it('says it out loud — a port that quietly ignores a live connection IS the defect', () => {
    const node = makeInstance();
    const set = setterFor('height');
    set.call(node, { value: 300, unit: 'px' });
    set.call(node, 400);
    expect(node.errors).toHaveLength(1);
    expect(node.errors[0].code).toBe('dimensions/not-a-dimension');
    // Named by its DISPLAY name, because that is the word the author sees on the port.
    expect(node.errors[0].message).toContain('"Height"');
    expect(node.errors[0].message).toContain('400');
    expect(node.errors[0].message).toContain('{value, unit}');
    expect(node.errors[0].message).toContain('previous value is kept');
  });

  it('🔴 still CLEARS on null and on undefined — the property panel removes a parameter that way', () => {
    const node = makeInstance();
    const set = setterFor('width');
    set.call(node, { value: 50, unit: '%' });
    expect(node.props.width).toBe('50%');
    set.call(node, null);
    expect('width' in node.props).toBe(false);

    set.call(node, { value: 50, unit: '%' });
    set.call(node, undefined);
    expect('width' in node.props).toBe(false);
    // And neither is a failure: an explicit empty is a value, not a mistake.
    expect(node.errors).toEqual([]);
  });

  it('passes a design-token reference through untouched (AIB-001, still true)', () => {
    const node = makeInstance();
    setterFor('width').call(node, 'var(--space-4)');
    expect(node.props.width).toBe('var(--space-4)');
    expect(node.errors).toEqual([]);
  });

  it('🔴 keeps it when the magnitude is not a number but the UNIT is — the shape a live wire actually delivers', () => {
    // Found by driving, not by reading. `Node.queueInputValue`'s first-update consolidation wraps
    // an incoming non-object in the unit of the value it overwrites, with no numeric check, so a
    // String node wired to `height` arrives here as `{value: "tall", unit: "px"}` — NOT as the
    // bare string the other arms send. That passed the `.value !== undefined` test and was emitted
    // as "tallpx": invalid CSS, dropped silently, and the authored 120px gone with it.
    const node = makeInstance();
    const set = setterFor('height');
    set.call(node, { value: 300, unit: 'px' });
    set.call(node, { value: 'tall', unit: 'px' });
    expect(node.props.height).toBe('300px');
    expect(node.errors.map((e) => e.code)).toEqual(['dimensions/not-a-dimension']);
  });

  it('keeps it for NaN and Infinity, which concatenate into CSS just as happily and just as uselessly', () => {
    const node = makeInstance();
    const set = setterFor('height');
    set.call(node, { value: 300, unit: 'px' });
    set.call(node, { value: NaN, unit: 'px' });
    expect(node.props.height).toBe('300px');
    set.call(node, { value: Infinity, unit: 'px' });
    expect(node.props.height).toBe('300px');
  });

  it('still accepts a NUMERIC string — the property panel and older projects both write them', () => {
    const node = makeInstance();
    setterFor('height').call(node, { value: '250', unit: 'px' });
    expect(node.props.height).toBe('250px');
    expect(node.errors).toEqual([]);
  });

  it('leaves a UNITLESS port alone — `units: [\'\']` exists for line-height, where a bare 1.4 is the point', () => {
    // Asserted on the helper rather than on a port, because no units-typed port on `Group` has an
    // empty unit; the rule still has to hold, or the guard would break line-height the day it met it.
    const node = makeInstance();
    const set = setterFor('height');
    set.call(node, { value: 300, unit: 'px' });
    set.call(node, { value: 'inherit', unit: '' });
    // No unit to concatenate, so nothing is nonsense and the value passes through as it always did.
    expect(node.props.height).toBe('inherit');
    expect(node.errors).toEqual([]);
  });

  it('re-renders on every branch — an abstention the screen never hears about is not an abstention', () => {
    const node = makeInstance();
    const set = setterFor('height');
    set.call(node, { value: 300, unit: 'px' });
    set.call(node, 400);
    set.call(node, null);
    expect(node.forceUpdates).toBe(3);
  });
});
