/**
 * NDA-012 (Visual) — `Text Input`'s `Clear`, and the `null` that made a controlled input
 * uncontrolled.
 *
 * - **check `A1`** — `clear()` blanked `props.startValue` and the DOM and left `_internal.text`
 *   holding the old string. `Set` reads `_internal.text`, so a later `Set` pulse **restored text
 *   the author had explicitly cleared**. It also did not flag `onTextChanged` while unmounted,
 *   which `setText` next to it is careful to do — so a `Clear` before first mount left the `Text`
 *   output reading the old value.
 * - **check `G1`** — `startValue` passed `null` straight through to `props.startValue` and into the
 *   `<input>`'s `value` (`TextInput.tsx:66`), which makes a controlled input uncontrolled. `null`
 *   arrives from any query that matched nothing.
 *
 * `null` **clears** here rather than abstaining, unlike `Drag` and `Slider` in the same pass: a
 * string port has a representable empty value and `EMPTY-VALUE-CONTRACT.md` corollary 2 names it
 * (`E1`/`E2`: a string variable set to `null` clears and does not read `"null"`). The two
 * treatments are the contract applied, not an inconsistency.
 */

/* eslint-env jest */

import type { NodeInstance } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from '../../../noodl-runtime/test/corpus/graph-harness';

// The node modules reach `Noodl.deployed` at import time to decide whether to build editor
// tooltips, so it has to exist before the `require` below.
(globalThis as unknown as { Noodl: unknown }).Noodl = { deployed: true, baseUrl: '/' };

/* eslint-disable @typescript-eslint/no-var-requires */
const TextInputModule = require('../../src/nodes/controls/text-input').default;
/* eslint-enable @typescript-eslint/no-var-requires */

/** The instance members these rows drive that `NodeInstance` does not publish. */
interface DrivableNode {
  setInputValue(name: string, value: unknown): void;
  props: Record<string, unknown>;
  _internal: Record<string, unknown>;
  outputPropValues: Record<string, unknown>;
  innerReactComponentRef?: unknown;
  flagOutputDirty(name: string): void;
}

interface Probe {
  graph: CorpusGraph;
  node: NodeInstance;
  drivable: DrivableNode;
  /** Pulse one of the node's signal inputs over a real connection. */
  pulse(port: 'clear' | 'set'): void;
  /** Every output name passed to `flagOutputDirty`, in order. */
  dirtied: string[];
}

/**
 * A `Do` pulse per signal input under test — the corpus's usual pair.
 *
 * ⚠️ Pulsed over a **connection**, not by calling into the node. `Set` is only in its
 * wait-for-a-pulse mode when `isInputConnected('set')` is true, so a row that reached the setter
 * directly would measure the *other* mode and read `Clear` as harmless.
 */
const TriggerModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Corpus',
    outputs: { go: { type: 'signal' } },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      }
    }
  }
};

/**
 * ⚠️ `connectSet` is not a convenience — it selects which of the node's **two modes** the row
 * measures, and the rows below are split across both on purpose.
 *
 * With `Set` connected, `Text` waits for a pulse (`text-input.ts:114`,
 * `isInputConnected('set') === false`). With it unconnected, `Text` applies immediately. `Clear`'s
 * A1 defect is only reachable in the first mode, because the stale `_internal.text` needs a later
 * `Set` to read it; `startValue`'s G1 defect belongs to the second, which is the mode a node is in
 * until an author wires the port. A single fixture would have measured one and reported both.
 */
async function build(
  parameters: Record<string, unknown> = {},
  { connectSet = false }: { connectSet?: boolean } = {}
): Promise<Probe> {
  const connections: Array<Record<string, string>> = [
    { sourceId: 'clear-trigger', sourcePort: 'go', targetId: 'under-test', targetPort: 'clear' }
  ];
  if (connectSet) {
    connections.push({ sourceId: 'set-trigger', sourcePort: 'go', targetId: 'under-test', targetPort: 'set' });
  }

  const graph: CorpusGraph = await createCorpusGraph({
    modules: [TextInputModule as never, TriggerModule as never],
    data: {
      components: [
        {
          name: '/root',
          nodes: [
            { id: 'clear-trigger', type: 'corpus.Trigger' },
            { id: 'set-trigger', type: 'corpus.Trigger' },
            { id: 'under-test', type: 'net.noodl.controls.textinput', parameters }
          ],
          connections
        }
      ]
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

  const pulse = (port: 'clear' | 'set') => {
    (graph.node(`${port}-trigger`) as unknown as { go(): void }).go();
    graph.update();
  };

  return { graph, node, drivable, pulse, dirtied };
}

/**
 * Stand in for the mounted React component.
 *
 * Only the three members the node calls, and `setText` records rather than rendering — the point
 * of these rows is what the *node* does, and a real mount would need a DOM and a frame clock.
 * `hasFocus` is a function so a row can put the field in focus, which is the state `setText`
 * deliberately refuses to write through and `Clear` deliberately does.
 */
function mount(p: Probe, { focused = false } = {}) {
  const written: string[] = [];
  p.drivable.innerReactComponentRef = {
    setText: (text: string) => written.push(text),
    hasFocus: () => focused,
    focus: () => undefined,
    blur: () => undefined
  };
  return written;
}

describe('TI-1 — Clear empties the node, not just the field', () => {
  it('a Set after a Clear does not bring the cleared text back', async () => {
    // `Set` connected is the mode in which `Text` waits for a pulse rather than applying
    // immediately, and it is the mode in which this defect bites.
    const p = await build({ startValue: 'Ada Lovelace' }, { connectSet: true });
    const written = mount(p);

    p.pulse('clear');
    expect(written).toContain('');

    // Before the fix `_internal.text` still held 'Ada Lovelace', so this restored it.
    p.pulse('set');
    p.graph.update();

    expect(p.drivable._internal.text).toBe('');
    expect(written.filter((t) => t === 'Ada Lovelace')).toHaveLength(0);
  }, 30000);

  it('Clear empties the field even while the user has it focused', async () => {
    // The asymmetry is deliberate and this row pins it: `setText` skips a write while the field
    // has focus so a round-trip cannot fight the typist, but an explicit `Clear` must still empty
    // it. Wired the other way round, Clear would be a dead button for the person using it.
    const p = await build({ startValue: 'half-typed' });
    const written = mount(p, { focused: true });

    p.pulse('clear');

    expect(written).toContain('');
  }, 30000);

  it('a Clear before first mount still moves the Text output', async () => {
    const p = await build({ startValue: 'Ada Lovelace' });
    // No `mount()` — `innerReactComponentRef` is undefined, which is every frame before the
    // component mounts.
    p.pulse('clear');

    expect(p.drivable.outputPropValues['onTextChanged']).toBe('');
    expect(p.dirtied).toContain('onTextChanged');
  }, 30000);

  // The control: `setText` is the path that was already right, and it stays right.
  it('the control: Set still writes the current Text, and still defers to focus', async () => {
    const p = await build({ startValue: 'first' }, { connectSet: true });
    const written = mount(p);

    p.drivable.setInputValue('startValue', 'second');
    p.pulse('set');
    p.graph.update();

    expect(p.drivable._internal.text).toBe('second');
    expect(written).toContain('second');
  }, 30000);
});

describe('TI-2 — startValue clears on null instead of unsetting the input', () => {
  it('null empties the field rather than reaching the DOM', async () => {
    const p = await build({ startValue: 'Ada Lovelace' });
    const written = mount(p);

    p.drivable.setInputValue('startValue', null);

    // Before the fix both of these were `null`, and `value={null}` on an `<input>` makes a
    // controlled input uncontrolled.
    expect(p.drivable._internal.text).toBe('');
    expect(p.drivable.props.startValue).toBe('');
    expect(written).toContain('');
  }, 30000);

  it('undefined abstains and leaves the text alone', async () => {
    const p = await build({ startValue: 'Ada Lovelace' });
    mount(p);

    p.drivable.setInputValue('startValue', undefined);

    expect(p.drivable._internal.text).toBe('Ada Lovelace');
  }, 30000);

  // The controls: everything the port is for still arrives, including the empty string, which is
  // the same outcome as `null` by a different route and must not be swallowed as "no change".
  it.each([
    ['a string', 'Grace Hopper', 'Grace Hopper'],
    ['an empty string', '', ''],
    ['the digit zero as text', '0', '0']
  ])('the control: %s still reaches the field', async (_label, value, expected) => {
    const p = await build({ startValue: 'Ada Lovelace' });
    const written = mount(p);

    p.drivable.setInputValue('startValue', value);

    expect(p.drivable._internal.text).toBe(expected);
    expect(written).toContain(expected);
  }, 30000);
});
