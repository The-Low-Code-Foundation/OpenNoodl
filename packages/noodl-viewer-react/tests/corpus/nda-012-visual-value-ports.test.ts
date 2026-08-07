/**
 * NDA-012 (Visual) — the `Value` ports that invent a number when they are handed nothing.
 *
 * `Drag`'s snap positions and `Slider`'s `Value` both take a number an author can also feed from
 * a query, and both coerced whatever arrived into a plausible position rather than abstaining.
 * That is the phase's *"what value does it fall back to"* rule (FINDINGS **DV-x**, and the
 * `Expression` finding that produced the rule): silence would be visible, a plausible number is
 * not.
 *
 * - **`Drag`, check `G1`** — `snapToPositionX.value` stored whatever arrived straight into
 *   `_internal.snapPositionX`. ⚠️ The worksheet recorded the consequence as `NaN`; it is not.
 *   `easeOutCubic` computes `(end - start) * … + start`, so `null` coerces to **0** and the
 *   element animates to the origin — a position the author never asked for and cannot tell from
 *   one they did. A non-numeric *string* is the `NaN` case, and nothing coerces a declared
 *   `number` port on arrival.
 * - **`Slider`, checks `G1` and `E1`** — `_setInputValue` used `newValue || 0`, so `null` and a
 *   legitimate `0` were indistinguishable and both clamped to `Min`; and the port was declared
 *   `type: 'string'` while the `Value` *output* is `type: 'number'`, so one Slider could not feed
 *   another and the panel offered a text field for a number.
 *
 * Both now follow `EMPTY-VALUE-CONTRACT.md` for a port that has no representable empty state, the
 * shape `Radio Button Group`'s `Value` took earlier in this phase: `undefined` and `null` abstain
 * and leave the current position alone, and a value that is not a number is **reported** rather
 * than coerced — on the runtime channel, so a deployed app has the diagnosis too
 * (`FAILURE-CONTRACT.md`).
 */

/* eslint-env jest */

import type { NodeInstance } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

// The node modules reach `Noodl.deployed` at import time to decide whether to build editor
// tooltips, so it has to exist before the `require`s below.
(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

/* eslint-disable @typescript-eslint/no-var-requires */
const DragModule = require('../../src/nodes/visual/drag').default;
const SliderModule = require('../../src/nodes/controls/slider').default;
/* eslint-enable @typescript-eslint/no-var-requires */

/** The instance members these rows drive that `NodeInstance` does not publish. */
interface DrivableNode {
  setInputValue(name: string, value: unknown): void;
  props: Record<string, unknown>;
  _internal: Record<string, unknown>;
}

interface Probe {
  graph: CorpusGraph;
  node: NodeInstance;
  drivable: DrivableNode;
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
  return { graph, node, drivable: node as unknown as DrivableNode };
}

describe('DG-1 — Drag abstains on a snap position it cannot read as a number', () => {
  it('null leaves the position that was there, and does not become 0', async () => {
    const p = await build(DragModule, {});
    p.drivable.setInputValue('snapToPositionX.value', 240);
    expect(p.drivable._internal.snapPositionX).toBe(240);

    p.drivable.setInputValue('snapToPositionX.value', null);

    // Before the fix this stored `null`, and `easeOutCubic` then animated the element to 0 —
    // the origin, silently, for a value that means "I have nothing to give you".
    expect(p.drivable._internal.snapPositionX).toBe(240);
  }, 30000);

  it('undefined abstains as well', async () => {
    const p = await build(DragModule, {});
    p.drivable.setInputValue('snapToPositionY.value', 90);

    p.drivable.setInputValue('snapToPositionY.value', undefined);

    expect(p.drivable._internal.snapPositionY).toBe(90);
  }, 30000);

  it('a value that is not a number is reported, not stored', async () => {
    const p = await build(DragModule, {});
    p.drivable.setInputValue('snapToPositionX.value', 240);

    p.drivable.setInputValue('snapToPositionX.value', 'somewhere');

    expect(p.drivable._internal.snapPositionX).toBe(240);
    expect(p.graph.errors.map((e) => e.code)).toContain('drag/snap-position-not-a-number');
  }, 30000);

  // The controls. Everything the port is for still arrives, including the two values a
  // truthiness guard would have eaten.
  it.each([
    ['a positive number', 120, 120],
    ['zero', 0, 0],
    ['a negative offset', -40, -40],
    ['a numeric string from a text field', '75', 75]
  ])('the control: %s still reaches the snap', async (_label, value, expected) => {
    const p = await build(DragModule, {});

    p.drivable.setInputValue('snapToPositionX.value', value);

    expect(p.drivable._internal.snapPositionX).toBe(expected);
  }, 30000);

  it('the control: an abstaining arrival raises nothing', async () => {
    const p = await build(DragModule, {});

    p.drivable.setInputValue('snapToPositionX.value', null);
    p.drivable.setInputValue('snapToPositionX.value', undefined);
    p.drivable.setInputValue('snapToPositionX.value', '');

    expect(p.graph.errors).toHaveLength(0);
  }, 30000);
});

describe('SL-2 — Slider tells null from 0 on Value', () => {
  it('null abstains and leaves the handle where it was', async () => {
    const p = await build(SliderModule, { min: 10, max: 100 });
    p.drivable.setInputValue('value', 60);
    expect(p.drivable.props.value).toBe(60);

    p.drivable.setInputValue('value', null);

    // Before the fix `null || 0` clamped to Min, so a Slider with `Min = 10` fed `null` read 10
    // — indistinguishable from an author asking for 0, or for 10.
    expect(p.drivable.props.value).toBe(60);
  }, 30000);

  it('a legitimate 0 still clamps to Min, and that is a different outcome from null', async () => {
    const p = await build(SliderModule, { min: 10, max: 100 });
    p.drivable.setInputValue('value', 60);

    p.drivable.setInputValue('value', 0);

    expect(p.drivable.props.value).toBe(10);
  }, 30000);

  it('a value that is not a number is reported, not clamped', async () => {
    const p = await build(SliderModule, { min: 0, max: 100 });
    p.drivable.setInputValue('value', 40);

    p.drivable.setInputValue('value', 'nearly there');

    // Before the fix `Math.min(100, 'nearly there')` was `NaN`, `Math.max(0, NaN)` was `NaN`,
    // and `props.value` became `NaN` with nothing said anywhere.
    expect(p.drivable.props.value).toBe(40);
    expect(p.graph.errors.map((e) => e.code)).toContain('slider/value-not-a-number');
  }, 30000);

  it('the Value input is declared a number, so one Slider can feed another', async () => {
    // E1: the input was `type: 'string'` while the `Value` output is `type: 'number'`.
    const inputs = (SliderModule as { node: { inputs: Record<string, { type: unknown }> } }).node.inputs;
    const outputs = (SliderModule as { node: { outputs: Record<string, { type: unknown }> } }).node.outputs;

    expect(inputs.value.type).toBe('number');
    expect(outputs.value.type).toBe('number');
  }, 30000);

  // The controls.
  it.each([
    ['a number in range', 55, 55],
    ['a numeric string', '55', 55],
    ['above Max', 5000, 100],
    ['below Min', -5, 0]
  ])('the control: %s still moves the handle', async (_label, value, expected) => {
    const p = await build(SliderModule, { min: 0, max: 100 });

    p.drivable.setInputValue('value', value);

    expect(p.drivable.props.value).toBe(expected);
  }, 30000);

  it('the control: an abstaining arrival raises nothing', async () => {
    const p = await build(SliderModule, { min: 0, max: 100 });

    p.drivable.setInputValue('value', null);
    p.drivable.setInputValue('value', undefined);
    p.drivable.setInputValue('value', '');

    expect(p.graph.errors).toHaveLength(0);
  }, 30000);
});
