/**
 * NDA-012 (Visual) — the two one-line control defects, each with its control row.
 *
 * Both are single-expression fixes and both were filed with a citation rather than a test, so
 * this file is the measurement they did not have. They are together because they are the same
 * size, not because they are the same bug.
 *
 * - **`Radio Button Group`, check `G1`** — `value.toString !== undefined` throws on the `null` it
 *   is meant to defend against: the check reads a property *of* the value it is guarding. `null`
 *   on a `Value` port is what a cleared selection looks like, so it is an ordinary arrival.
 * - **`Slider`, check `A3`** — `_updateOutputValuePercent` compared against
 *   `this._internal.valuePercentChanged`, a field nothing ever writes. Always `undefined`, so the
 *   comparison was always true and `valuePercent` was flagged dirty on every value change whether
 *   the percentage moved or not. ⚠️ PLAT-003 slice 10 found this exact bug, wrote it up, and kept
 *   it verbatim in the *deprecated* `range.tsx` without ever looking at the live node.
 *
 * ⚠️ **`Slider`'s own `G1` is deliberately not fixed here and is pinned as-is below**:
 * `_setInputValue` uses `newValue || 0`, so `null` and a legitimate `0` are indistinguishable.
 * That is a separate defect from A3 and was not in this session's scope.
 */

/* eslint-env jest */

import type { NodeInstance } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

// The node modules reach `Noodl.deployed` at import time to decide whether to build editor
// tooltips, so it has to exist before the `require`s below.
(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

/* eslint-disable @typescript-eslint/no-var-requires */
const RadioGroupModule = require('../../src/nodes/controls/radiobuttongroup').default;
const SliderModule = require('../../src/nodes/controls/slider').default;
/* eslint-enable @typescript-eslint/no-var-requires */

/** The instance members these rows drive that `NodeInstance` does not publish. */
interface DrivableNode {
  setInputValue(name: string, value: unknown): void;
  props: Record<string, unknown>;
  _internal: Record<string, unknown>;
  flagOutputDirty(name: string): void;
}

interface Probe {
  node: NodeInstance;
  drivable: DrivableNode;
  /** Every output name passed to `flagOutputDirty`, in order. */
  dirtied: string[];
  resetDirtied: () => void;
}

async function build(module: { node: { name: string } }, parameters: Record<string, unknown> = {}): Promise<Probe> {
  const graph: CorpusGraph = await createCorpusGraph({
    modules: [module as never],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'under-test', type: module.node.name, parameters }] }]
    } as never
  });

  // The text-style ports resolve through the project's style sheet; without it their setters
  // throw, and the throw rather than the behaviour becomes what the row measures.
  (graph.context as unknown as { styles: unknown }).styles = {
    getTextStyle: () => ({}),
    resolveColor: (c: unknown) => c
  };
  graph.update();

  const node = graph.node('under-test') as unknown as NodeInstance;
  const drivable = node as unknown as DrivableNode;

  // ⚠️ `flagOutputDirty` is a non-writable `Node.prototype` property, so a plain assignment
  // throws. An own property on the instance shadows it.
  const dirtied: string[] = [];
  const original = drivable.flagOutputDirty;
  Object.defineProperty(node, 'flagOutputDirty', {
    configurable: true,
    writable: true,
    value: function patched(name: string) {
      dirtied.push(name);
      return original.call(node, name);
    }
  });

  return {
    node,
    drivable,
    dirtied,
    resetDirtied: () => {
      dirtied.length = 0;
    }
  };
}

describe('RBG-1 — Radio Button Group survives a null on Value', () => {
  it('null does not throw, and leaves the current selection alone', async () => {
    const p = await build(RadioGroupModule, {});
    p.drivable.setInputValue('value', 'b');
    expect(p.drivable._internal.value).toBe('b');

    // Before the fix this threw a TypeError reading `.toString` off `null`.
    expect(() => p.drivable.setInputValue('value', null)).not.toThrow();

    // `null` is not a string and cannot name an option, so the setter abstains rather than
    // storing a non-string. The selection that was there stays there.
    expect(p.drivable._internal.value).toBe('b');
  }, 30000);

  it('undefined does not throw either', async () => {
    const p = await build(RadioGroupModule, {});

    expect(() => p.drivable.setInputValue('value', undefined)).not.toThrow();
  }, 30000);

  // The controls: everything the guard was actually for still works. A number has a `toString`
  // and must still be coerced — that is the whole reason the check exists.
  it.each([
    ['a number', 42, '42'],
    ['zero', 0, '0'],
    ['a string', 'b', 'b']
  ])('the control: %s still selects', async (_label, value, expected) => {
    const p = await build(RadioGroupModule, {});

    p.drivable.setInputValue('value', value);

    expect(p.drivable._internal.value).toBe(expected);
  }, 30000);
});

describe('SL-1 — Slider only flags Value Percent when the percentage moved', () => {
  /** Drive the node the way the React range does, through `props.updateOutputValue`. */
  const drive = (p: Probe, value: number) => (p.drivable.props.updateOutputValue as (v: number) => void)(value);

  it('a value change that does not move the percentage flags nothing', async () => {
    // 0–1000 over 100 percentage points: eleven raw units is under one point at this scale,
    // so 500 and 505 both floor to 50.
    const p = await build(SliderModule, { min: 0, max: 1000 });

    drive(p, 500);
    p.resetDirtied();
    drive(p, 505);

    // The value moved, so `value` is flagged…
    expect(p.dirtied).toContain('value');
    // …and the percentage did not, so before the fix this was flagged anyway, every time.
    expect(p.dirtied).not.toContain('valuePercent');
    expect(p.drivable._internal.valuePercent).toBe(50);
  }, 30000);

  it('the control: a value change that does move the percentage still flags it', async () => {
    const p = await build(SliderModule, { min: 0, max: 1000 });

    drive(p, 500);
    p.resetDirtied();
    drive(p, 700);

    expect(p.dirtied).toContain('valuePercent');
    expect(p.drivable._internal.valuePercent).toBe(70);
  }, 30000);

  it('the control: the first computation is still announced', async () => {
    const p = await build(SliderModule, { min: 0, max: 1000 });

    drive(p, 300);

    expect(p.dirtied).toContain('valuePercent');
    expect(p.drivable._internal.valuePercent).toBe(30);
  }, 30000);

  // ⚠️ Pinned as-is, NOT fixed. Slider's `G1`: `_setInputValue` uses `newValue || 0`, so `null`
  // and a legitimate `0` are indistinguishable and both clamp to `Min`. A slider with `Min = 10`
  // fed `null` silently reads 10. Recorded here so the next reader does not re-derive it.
  it('Slider G1 is still open: null and 0 are indistinguishable, and both clamp to Min', async () => {
    const withNull = await build(SliderModule, { min: 10, max: 100 });
    withNull.drivable.setInputValue('value', null);

    const withZero = await build(SliderModule, { min: 10, max: 100 });
    withZero.drivable.setInputValue('value', 0);

    expect(withNull.drivable.props.value).toBe(10);
    expect(withZero.drivable.props.value).toBe(10);
  }, 30000);
});
