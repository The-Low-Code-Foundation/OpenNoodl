/**
 * NDA-012 — the Logic category, audited (7 nodes).
 *
 * NDA-012 produces verdicts and citations rather than fixes, but two of this category's findings are
 * claims about *runtime* behaviour rather than about what the source says, and the phase's rule is
 * that an uncited ⚠️ is a suspicion. These rows are the citations. They pin **current** behaviour, so
 * a later fix will redden the ones marked in the audit worksheet as defects — which is the intent.
 *
 * The two substantive findings:
 *
 * 1. **`Switch` announces a state change at boot that never happened.** `onFromStart` (shown as
 *    `State`) declares `default: false` and its setter calls `emitSignals()` unconditionally, where
 *    the neighbouring `On` and `Off` setters both guard on the state already being what is asked for.
 *    So the port's default arriving is indistinguishable from an author switching it off.
 *
 * 2. **`Value Changed` cannot see a change to a Collection's contents**, only a repoint of the
 *    binding. Its `===` is correct for primitives and wrong for the library's two aggregate types:
 *    NDA-002 made `Collection.get`/`create` return a *memoised* Proxy so `items === arr` holds, which
 *    is what makes mutation invisible here. This is the reactivity contract meeting the identity
 *    guarantee, and each is right on its own.
 *
 * Also recorded: `And`/`Or` coerce an empty input to `false` where `Inverter`, in the same category,
 * deliberately passes `undefined` through so downstream can tell "not set" from "false". Three nodes,
 * two empty-value policies, and the one that is right documents why (`inverter.ts:5-9`).
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import SwitchNode from '../../../noodl-viewer-react/src/nodes/std-library/switch';
import ValueChangedNode from '../../../noodl-viewer-react/src/nodes/std-library/valuechanged';

interface TriggerInstance extends NodeInstance {
  send(value: unknown): void;
  go(): void;
}

/** Feeds one value or one signal down a wire, so a row can drive an input the way a graph does. */
const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Logic',
    initialize(this: NodeInstance) {
      this._internal.value = undefined;
    },
    outputs: {
      go: { type: 'signal' },
      value: {
        type: '*',
        getter(this: NodeInstance) {
          return this._internal.value;
        }
      }
    },
    methods: {
      go(this: NodeInstance) {
        this.sendSignalOnOutput('go');
      },
      send(this: NodeInstance, value: unknown) {
        this._internal.value = value;
        this.flagOutputDirty('value');
      }
    }
  }
};

describe('NDA-012 Logic — Switch emits at boot', () => {
  async function switchGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, SwitchNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'sw', type: 'Switch', parameters }
            ],
            connections: [{ sourceId: 'trigger', sourcePort: 'go', targetId: 'sw', targetPort: 'off' }]
          }
        ]
      } as never
    });
    await graph.settle(4);
    return graph;
  }

  /**
   * The control that killed the first version of this row. An unset `State` emits nothing, so the
   * declared `default: false` does **not** run the setter — the port's default is only queued when a
   * parameter is reset, never at construction. Worth keeping: "a default fires the setter at boot"
   * is the obvious reading of `switch.ts:63-73` and it is wrong.
   */
  test('emits nothing at boot when State is left unset', async () => {
    const graph = await switchGraph({});

    expect(graph.signalsFor('sw')).toEqual([]);
  });

  /**
   * The finding, in the shape that survives. `State` is a *value* port that reads as an initial
   * condition — the display name is `State`, the group is `General`, and it sits apart from the three
   * `Change State` action inputs. An author who sets it in the property panel is describing where the
   * switch starts, and gets a `Switched` announcement at page load for a switch that never switched.
   */
  test('emits Switched at boot when State is authored, for a switch nothing switched (switch.ts:68-72)', async () => {
    const graph = await switchGraph({ onFromStart: true });

    expect(graph.signalsFor('sw')).toEqual(['switchedToOn', 'switched']);
  });

  /**
   * The control, and it is what makes the row above a defect rather than a preference: `On` and
   * `Off` *do* guard (`switch.ts:34-36,46-48`), so this is an inconsistency inside one file rather
   * than a house style. Setting `State` to the value it already holds re-announces it; asking `Off`
   * for a state it is already in correctly says nothing.
   */
  test('Off is silent when already off, so the guard exists and State simply skips it', async () => {
    const graph = await switchGraph({});
    const before = graph.signalsFor('sw').length;

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(3);

    expect(graph.signalsFor('sw').length).toBe(before);
  });
});

describe('NDA-012 Logic — Value Changed and aggregate identity', () => {
  async function valueChangedGraph(): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [TriggerModule, ValueChangedNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'vc', type: 'Value Changed' }
            ],
            connections: [{ sourceId: 'trigger', sourcePort: 'value', targetId: 'vc', targetPort: 'value' }]
          }
        ]
      } as never
    });
    await graph.settle(3);
    return graph;
  }

  /** The control: a primitive change is seen, which is the node working as advertised. */
  test('fires when a primitive changes', async () => {
    const graph = await valueChangedGraph();
    graph.node<TriggerInstance>('trigger').send('a');
    await graph.settle(3);
    graph.node<TriggerInstance>('trigger').send('b');
    await graph.settle(3);

    expect(graph.signalsFor('vc').filter((s) => s === 'valueChanged').length).toBe(2);
  });

  /**
   * The finding. The same array, mutated, is `===` to itself, so nothing fires — and an author
   * wiring an Array's `Items` into `Value Changed` to notice edits gets silence.
   *
   * Asserting on the *count* rather than on absence matters here: the first send fires legitimately
   * (undefined → the array), and a row asserting "no signal at all" would pass with the node deleted.
   */
  test('does not fire when an array is mutated in place (valuechanged.ts:29)', async () => {
    const graph = await valueChangedGraph();
    const items: string[] = ['a'];

    graph.node<TriggerInstance>('trigger').send(items);
    await graph.settle(3);
    const afterFirst = graph.signalsFor('vc').filter((s) => s === 'valueChanged').length;

    items.push('b');
    graph.node<TriggerInstance>('trigger').send(items);
    await graph.settle(3);

    expect(afterFirst).toBe(1);
    expect(graph.signalsFor('vc').filter((s) => s === 'valueChanged').length).toBe(1);
  });
});
