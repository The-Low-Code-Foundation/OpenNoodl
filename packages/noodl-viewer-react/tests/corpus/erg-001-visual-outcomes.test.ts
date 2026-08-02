/**
 * ERG-001 §4 / DV-viii — the Visual nodes that could not say an action had finished.
 *
 * > Seven of the eight Visual nodes with action inputs cannot tell a graph the action
 * > finished. — `OUTCOME-CONTRACT.md`, the second bullet of the problem it exists to solve.
 *
 * Those seven were held back through the whole of phase 30 *waiting for these port names*.
 * They exist now, and this file is the evidence they reached the nodes.
 *
 * ## The rows, and what each is really about
 *
 * | Node | Claim |
 * |---|---|
 * | `Video` | four Video Actions, all previously terminal in silence, report `Done` then `Completed` |
 * | `Drag` | the two snap `Do`s report; NDA-012 A3 closed the *drop* here and left the *report* to ERG-001 by name |
 * | `Group` | the scroll actions' existing `reason` string becomes `Failure`, and `Focus` — which had nothing at all — reports `Done` |
 * | `Checkbox` | `Check` on an already-ticked box was a bare `return`; it is `Unchanged` now, the one Visual node in §0.3's register |
 * | `Text Input` | `Set` absorbed while the field has focus is `Unchanged`, not a `Done` that lies |
 * | the queue cap | an action discarded by `withInnerComponent`'s 16-deep cap reports `Failure` rather than vanishing |
 *
 * ## ⚠️ These rows drive the pre-mount state deliberately
 *
 * The corpus harness builds a graph without React, so `innerReactComponentRef` is never
 * assigned by React — which *is* the pre-mount state. Rows fire the action, then simulate the
 * ref callback exactly as `react-component-node.ts` does (assign, then flush), and assert on
 * what came out. That matters for the outcome contract specifically: the outcome is reported
 * from *inside* the queued action, so a node that never mounts reports nothing — which is
 * correct, and is why the queue-cap row below exists to cover the one case where "never
 * mounts" turns into a discarded invocation.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | `outcomeOnInnerComponent` back to `withInnerComponent` on Video | the four Video rows, not the Group or Checkbox ones |
 * | Checkbox's `Unchanged` back to a bare `return` | the already-ticked row only; the real-flip control stays green |
 * | Text Input's `setText` back to returning nothing | the focused-`Set` row; the unfocused control stays green |
 * | the `onDropped` callback in `withInnerComponent` | the queue-cap row alone |
 */

/* eslint-env jest */

import type { NodeInstance } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

// Same three stubs `nda-012-visual-premount-actions.test.ts` uses, and for the same reason:
// the Group's React component pulls in hand-written ES-module scroll plugins that ts-jest does
// not transform. None of the three is involved in anything under test here.
jest.mock('../../src/components/visual/Group/scroll-plugins/nested-scroll-plugin', () => ({ default: class {} }));
jest.mock('../../src/components/visual/Group/scroll-plugins/patched-momentum-scroll', () => ({
  default: () => undefined
}));
jest.mock('../../src/components/visual/Group/scroll-plugins/slide-scroll-plugin', () => ({ default: class {} }));

/* eslint-disable @typescript-eslint/no-var-requires */
const VideoModule = require('../../src/nodes/visual/video').default;
const GroupModule = require('../../src/nodes/visual/group').default;
const DragModule = require('../../src/nodes/visual/drag').default;
const CheckboxModule = require('../../src/nodes/controls/checkbox').default;
const TextInputModule = require('../../src/nodes/controls/text-input').default;
/* eslint-enable @typescript-eslint/no-var-requires */

interface DrivableNode extends NodeInstance {
  setInputValue(name: string, value: unknown): void;
  innerReactComponentRef: unknown;
  _flushPendingInnerActions(): void;
  _internal: Record<string, unknown>;
  outputPropValues: Record<string, unknown>;
}

async function build(module: { node: { name: string } }, parameters: Record<string, unknown> = {}) {
  const graph: CorpusGraph = await createCorpusGraph({
    modules: [module as never],
    data: {
      components: [{ name: '/root', nodes: [{ id: 'under-test', type: module.node.name, parameters }] }]
    } as never
  });

  (graph.context as unknown as { styles: unknown }).styles = {
    getTextStyle: () => ({}),
    resolveColor: (c: unknown) => c
  };
  // ⚠️ `setNodeFocused` lives on the *viewer's* NodeContext; the corpus harness builds the
  // runtime's, which has no focus tracker. Stubbed rather than worked around, because the `Focus`
  // rows are about what the node reports afterwards and not about where focus went.
  (graph.context as unknown as { setNodeFocused: unknown }).setNodeFocused = () => undefined;
  graph.update();

  return { graph, node: graph.node('under-test') as unknown as DrivableNode };
}

/**
 * A stand-in for the component React would have mounted.
 *
 * `scrollFails` is what makes the `Failure` rows possible: the real components return a
 * *reason string* when they decline, which is the value ERG-001 §4 turned into the contract's
 * `Failure`. That return path already existed and already raised — it just had no port.
 */
function mount(node: DrivableNode, options: { scrollFails?: string; hasFocus?: boolean } = {}): string[] {
  const calls: string[] = [];
  const inner = {
    play: () => calls.push('play'),
    restart: () => calls.push('restart'),
    pause: () => calls.push('pause'),
    reset: () => calls.push('reset'),
    setSourceObject: (v: unknown) => calls.push('setSourceObject:' + JSON.stringify(v)),
    scrollToIndex: (i: number, d: number) => {
      calls.push(`scrollToIndex:${i}:${d}`);
      return options.scrollFails;
    },
    scrollToElement: (e: unknown, d: number) => {
      calls.push(`scrollToElement:${String(e)}:${d}`);
      return options.scrollFails;
    },
    snapToPositionX: (v: number, d: number) => calls.push(`snapToPositionX:${v}:${d}`),
    snapToPositionY: (v: number, d: number) => calls.push(`snapToPositionY:${v}:${d}`),
    stopSnapTimers: () => calls.push('stopSnapTimers'),
    setText: (t: string) => calls.push('setText:' + t),
    hasFocus: () => options.hasFocus === true,
    focus: () => calls.push('focus'),
    blur: () => calls.push('blur')
  };
  node.innerReactComponentRef = inner;
  node._flushPendingInnerActions();
  return calls;
}

/** Fire a signal input the way a connected pulse does. */
function pulse(node: DrivableNode, name: string): void {
  node.setInputValue(name, true);
  node.setInputValue(name, false);
}

function outcomesOf(graph: CorpusGraph): string[] {
  return graph.signalsFor('under-test').filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function countOf(graph: CorpusGraph, signal: string): number {
  return graph.signalsFor('under-test').filter((s) => s === signal).length;
}

// =================================================================================================
// Video — four actions, twelve outputs, and not one of them terminal
// =================================================================================================

describe('ERG-001 §4 / DV-viii: Video', () => {
  it.each([['play'], ['restart'], ['pause'], ['reset']])(
    '%s reports Done once the element has it, then Completed',
    async (port) => {
      const p = await build(VideoModule);
      pulse(p.node, port);

      // Nothing yet: the action is queued, and so is its outcome. Reporting `Done` before the
      // element had the action would be the "announce before you update" defect in its purest
      // form — a graph told the video played before it had.
      expect(outcomesOf(p.graph)).toEqual([]);

      mount(p.node);
      p.graph.update();

      const signals = p.graph.signalsFor('under-test');
      expect(outcomesOf(p.graph)).toEqual(['done']);
      expect(signals).toContain('completed');
      expect(signals.indexOf('completed')).toBeGreaterThan(signals.indexOf('done'));
    },
    30000
  );

  it(
    'four actions in one frame give four outcomes and four Completeds',
    async () => {
      const p = await build(VideoModule);
      pulse(p.node, 'play');
      pulse(p.node, 'pause');
      pulse(p.node, 'restart');
      pulse(p.node, 'reset');
      mount(p.node);
      p.graph.update();

      // Per invocation, never latched on the node — NV-iii, in a family that had no outcome at
      // all to latch until now.
      expect(outcomesOf(p.graph)).toEqual(['done', 'done', 'done', 'done']);
      expect(countOf(p.graph, 'completed')).toBe(4);
    },
    30000
  );

  it(
    'the node declares Done and Completed and no Unchanged it cannot use',
    async () => {
      const p = await build(VideoModule);

      expect(p.node.hasOutput('done')).toBe(true);
      expect(p.node.hasOutput('completed')).toBe(true);
      // "A node that cannot be a no-op gets no Unchanged port." The element cannot tell us it
      // was already playing, so claiming to know would be worse than not offering the port.
      expect(p.node.hasOutput('unchanged')).toBe(false);
    },
    30000
  );
});

// =================================================================================================
// Drag — the report NDA-012 A3 explicitly left to this task
// =================================================================================================

describe('ERG-001 §4 / DV-viii: Drag', () => {
  it.each([['snapToPositionX.do'], ['snapToPositionY.do']])(
    '%s reports Done once the element has the snap',
    async (port) => {
      const p = await build(DragModule);
      pulse(p.node, port);
      mount(p.node);
      p.graph.update();

      expect(outcomesOf(p.graph)).toEqual(['done']);
      expect(p.graph.signalsFor('under-test')).toContain('completed');
    },
    30000
  );
});

// =================================================================================================
// Group — the node that was *nearly* there: a reason with nowhere to go
// =================================================================================================

describe('ERG-001 §4 / DV-viii: Group', () => {
  it(
    'a scroll the component declines reports Failure, with the reason still on the error channel',
    async () => {
      const p = await build(GroupModule, { scrollEnabled: true });
      pulse(p.node, 'scrollToIndex.do');
      mount(p.node, { scrollFails: 'no child at index 9' });
      p.graph.update();

      // The reason string already existed and already raised. What it did not have was a port,
      // so no graph could branch on it — the exact gap the contract names.
      expect(outcomesOf(p.graph)).toEqual(['failure']);
      expect(p.graph.signalsFor('under-test')).toContain('completed');
      expect(p.graph.errors.map((e) => e.code)).toContain('group/scroll-to-index-failed');
      expect(p.graph.errors.map((e) => e.message).join(' ')).toContain('no child at index 9');
    },
    30000
  );

  it(
    '(control) a scroll the component performs reports Done and raises nothing',
    async () => {
      const p = await build(GroupModule, { scrollEnabled: true });
      pulse(p.node, 'scrollToIndex.do');
      mount(p.node);
      p.graph.update();

      // Without this, "Group always reports Failure" would satisfy the row above.
      expect(outcomesOf(p.graph)).toEqual(['done']);
      expect(p.graph.errors).toEqual([]);
    },
    30000
  );

  it(
    'Focus reports Done — it had no terminal signal of any kind before',
    async () => {
      const p = await build(GroupModule);
      pulse(p.node, 'focus');
      p.graph.update();

      // `Focused` is a different fact: it fires when the DOM takes focus, which is not the same
      // as "the action you asked for ran".
      expect(outcomesOf(p.graph)).toEqual(['done']);
      expect(p.graph.signalsFor('under-test')).toContain('completed');
    },
    30000
  );
});

// =================================================================================================
// The queue cap — the one path on which a Visual action could still end in silence
// =================================================================================================

describe('ERG-001 §4: withInnerComponent’s cap cannot swallow an invocation', () => {
  it(
    'an action discarded by the 16-deep cap reports Failure rather than vanishing',
    async () => {
      const p = await build(VideoModule);

      // 17 pulses against a node that never mounts. The cap shifts the oldest, which is right —
      // replaying two hundred queued Plays at mount would be its own defect — but until ERG-001
      // §4 the shifted one was simply gone.
      for (let i = 0; i < 17; i++) pulse(p.node, 'play');
      p.graph.update();

      expect(outcomesOf(p.graph)).toEqual(['failure']);
      expect(p.graph.signalsFor('under-test')).toContain('completed');
      expect(p.graph.errors.map((e) => e.code)).toContain('visual/action-dropped');
    },
    30000
  );

  it(
    '(control) sixteen pulses fit, so nothing is dropped and nothing is reported yet',
    async () => {
      const p = await build(VideoModule);
      for (let i = 0; i < 16; i++) pulse(p.node, 'play');
      p.graph.update();

      // The boundary matters: an off-by-one that dropped at 16 would make the row above pass
      // for the wrong reason, and this is the only thing that would notice.
      expect(outcomesOf(p.graph)).toEqual([]);
      expect(p.graph.errors).toEqual([]);
    },
    30000
  );
});

// =================================================================================================
// Checkbox — the one Visual node in §0.3's Unchanged register
// =================================================================================================

describe('ERG-001 §4 / DV-viii: Checkbox', () => {
  it(
    'Check on an already-ticked box reports Unchanged, where it used to report nothing',
    async () => {
      const p = await build(CheckboxModule, { checked: true });
      p.graph.update();
      pulse(p.node, 'check');
      p.graph.update();

      // `checkbox.ts:77` was `if (this._internal.checked === true) return;` — a bare return.
      // `Changed` deliberately does not fire for the Check/Uncheck actions either, so there was
      // no signal at all: a dead chain for a state the author explicitly asked for.
      expect(outcomesOf(p.graph)).toEqual(['unchanged']);
      expect(p.graph.signalsFor('under-test')).toContain('completed');
      // Not a failure, and it raises nothing — the box is ticked, which is what Check asked for.
      expect(p.graph.errors).toEqual([]);
    },
    30000
  );

  it(
    '(control) Check on an unticked box still flips it and reports Done',
    async () => {
      const p = await build(CheckboxModule, { checked: false });
      p.graph.update();
      pulse(p.node, 'check');
      p.graph.update();

      expect(outcomesOf(p.graph)).toEqual(['done']);
      expect(p.node.getOutput('checked').value).toBe(true);
    },
    30000
  );

  it(
    'Uncheck splits the same way, and the two share one body',
    async () => {
      const p = await build(CheckboxModule, { checked: true });
      p.graph.update();
      pulse(p.node, 'uncheck');
      pulse(p.node, 'uncheck');
      p.graph.update();

      // First unticks, second finds it already unticked. Two invocations, two outcomes, and
      // they differ — which is what proves the state is read per invocation rather than latched.
      expect(outcomesOf(p.graph)).toEqual(['done', 'unchanged']);
      expect(countOf(p.graph, 'completed')).toBe(2);
    },
    30000
  );
});

// =================================================================================================
// Text Input — a Set the field absorbs is not a Done
// =================================================================================================

describe('ERG-001 §4 / DV-viii: Text Input', () => {
  it(
    'a Set absorbed because the field has focus reports Unchanged, not Done',
    async () => {
      const p = await build(TextInputModule);
      mount(p.node, { hasFocus: true });
      p.node.setInputValue('startValue', 'from the graph');
      p.graph.update();

      pulse(p.node, 'set');
      p.graph.update();

      // `setText` will not fight the typist mid-edit — a deliberate and correct abstention that
      // was indistinguishable, from the graph, from a Set that landed.
      expect(outcomesOf(p.graph)).toEqual(['unchanged']);
      expect(p.graph.signalsFor('under-test')).toContain('completed');
    },
    30000
  );

  it(
    '(control) the same Set with the field unfocused reports Done and reaches the field',
    async () => {
      const p = await build(TextInputModule);
      const calls = mount(p.node, { hasFocus: false });
      p.node.setInputValue('startValue', 'from the graph');
      p.graph.update();

      pulse(p.node, 'set');
      p.graph.update();

      // Without this the row above would be satisfied by a Set that had stopped working.
      expect(outcomesOf(p.graph)).toEqual(['done']);
      expect(calls).toContain('setText:from the graph');
    },
    30000
  );

  it(
    'Focus and Blur report Done, and the node declares no Failure it cannot use',
    async () => {
      const p = await build(TextInputModule);
      mount(p.node);
      pulse(p.node, 'focus');
      pulse(p.node, 'blur');
      p.graph.update();

      expect(outcomesOf(p.graph)).toEqual(['done', 'done']);
      expect(countOf(p.graph, 'completed')).toBe(2);
      expect(p.node.hasOutput('failure')).toBe(false);
    },
    30000
  );
});
