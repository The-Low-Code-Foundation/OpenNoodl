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

import SignalToIndexNode from '../../../noodl-viewer-react/src/nodes-deprecated/std-library/signaltoindex';
import SwitchNode from '../../../noodl-viewer-react/src/nodes/std-library/switch';
import ValueChangedNode from '../../../noodl-viewer-react/src/nodes/std-library/valuechanged';

/** Reads whatever a value output holds at the instant a signal output fires. */
interface WatcherInstance extends NodeInstance {
  seen: Array<unknown>;
}

/**
 * The observer for the signal-before-value rows. It takes the pulse on `pulse` and the payload on
 * `value`, and records the payload *as it stands when the pulse arrives* — which is what a Function
 * node's `Run` sees. Same shape as the one in `nda-012-small-categories.test.ts`.
 */
const WatcherModule: NodeModule = {
  node: {
    name: 'corpus.Watcher',
    category: 'Logic',
    initialize(this: WatcherInstance) {
      this.seen = [];
    },
    inputs: {
      value: {
        type: '*',
        set(this: WatcherInstance, value: unknown) {
          this._internal.value = value;
        }
      },
      pulse: {
        type: 'signal',
        valueChangedToTrue(this: WatcherInstance) {
          this.seen.push(this._internal.value);
        }
      }
    }
  }
};

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

/* ------------------------------------------------------------------ *
 * Signal To Index — the second instance of signal-before-value
 * ------------------------------------------------------------------ */

/**
 * `Signal To Index` announced before it updated the index the announcement was about
 * (`signaltoindex.ts`, pulse at the top of `onValueChangedToTrue`). Reordered — but **the
 * defect is latent here, not live, and finding that out is the useful part.**
 *
 * It was left standing when `Receive Event` was fixed so it would get its own discrimination
 * check rather than ride along on another node's. The check then refused to discriminate:
 * restoring the original statement order leaves every row below green. That is not a weak row,
 * it is a real difference between the two nodes, and the mechanism is worth writing down because
 * it governs the whole *signal before value* class.
 *
 * **A receiver's input queue is per port** — `_inputValuesQueue` is `{ [portName]: value[] }` and
 * `Node.update` drains it with `Object.keys(...)` (`node.ts:531,543`), one entry per port per pass.
 * So which of `pulse` and `value` is applied first is decided by **which port name was inserted
 * into that object first**, not by the order `sendPulse`/`sendValue` were called in the node.
 *
 * And the first insertion happens at *connection* time: `connectInput` pushes the source port's
 * current value downstream, but only `if (outputValue !== undefined)` (`node.ts:452`). So:
 *
 * - `Signal To Index` initialises `currentIndex` to `0`, so `index`'s getter is non-`undefined`
 *   when the wire is made. The `value` key is created first and drains ahead of `pulse` **for the
 *   life of the node**, which masks the source order entirely.
 * - `Receive Event`'s payload outputs read `undefined` until an event arrives, so no `value` key
 *   is created at connect, the `pulse` key is created first, and the defect is observable — which
 *   is why *that* row discriminated.
 *
 * **Whether this defect class is visible depends on whether the paired value port held a
 * non-`undefined` value when the connection was made** — an accident of the node's `initialize`,
 * not of its ordering. The reorder is kept because it removes the dependence on that accident, not
 * because it repaired an observed wrong read. Recorded as a verdict, per NDA-012.
 */
describe('NDA-012 Logic — Signal To Index updates Index before it announces', () => {
  async function signalToIndexGraph(): Promise<CorpusGraph> {
    return createCorpusGraph({
      modules: [TriggerModule, WatcherModule, SignalToIndexNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'sti', type: 'Signal To Index' },
              { id: 'watch', type: 'corpus.Watcher' }
            ],
            /**
             * The numbered inputs have to be reached over a **wire**. They are registered by
             * `registerInputIfNeeded` (`nodedefinition.ts:112-131`) only when a connection targets
             * them, so `setInputValue('input 2', …)` is a no-op that logs and returns — the banked
             * Event Sender trap, in a second mechanism.
             */
            connections: [
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'sti', targetPort: 'input 2' },
              { sourceId: 'sti', sourcePort: 'signalTriggered', targetId: 'watch', targetPort: 'pulse' },
              { sourceId: 'sti', sourcePort: 'index', targetId: 'watch', targetPort: 'value' }
            ]
          }
        ]
      } as never
    });
  }

  /** The control: the node reports the index at all, so a silent row below would mean something. */
  test('reports the index of the input that fired', async () => {
    const graph = await signalToIndexGraph();
    await graph.settle(3);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(6);

    expect(graph.signalsFor('sti')).toContain('signalTriggered');
    expect(graph.node('sti').getOutput('index').value).toBe(2);
  });

  /**
   * A node acting on the pulse reads the index the pulse is about.
   *
   * ⚠️ **This row does not discriminate on the reorder, and that is the finding.** Restoring the
   * original statement order leaves it green, because `value` reaches this watcher's queue ahead of
   * `pulse` regardless — see the block comment above. It is kept as the behavioural statement the
   * node is supposed to satisfy; the row below is what pins the mechanism that makes it true.
   */
  test('Index is readable the instant Signal Triggered fires', async () => {
    const graph = await signalToIndexGraph();
    await graph.settle(3);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(6);

    expect(graph.node<WatcherInstance>('watch').seen).toEqual([2]);
  });

  /**
   * The mechanism, pinned — this is what the row above cannot say.
   *
   * `index` is non-`undefined` at connect time, so `connectInput` (`node.ts:452`) queues it
   * immediately and `value` becomes the first key in the receiver's per-port queue. The drain
   * (`node.ts:531`) therefore applies it before `pulse` in every pass, whatever order the node
   * sent them in — which is exactly why the reorder above is unobservable *for this node*.
   *
   * If a future change makes `Index` abstain until a signal has actually fired, this row reddens
   * and the ordering above stops being free. That is the point of pinning it.
   */
  test('the value port is queued before the pulse, which is what masks the ordering', async () => {
    const graph = await signalToIndexGraph();
    await graph.settle(3);

    const watcher = graph.node('watch') as unknown as { _inputValuesQueue: Record<string, unknown[]> };
    // Before anything has fired, only `value` has ever been queued — the connect-time push.
    expect(Object.keys(watcher._inputValuesQueue)).toEqual(['value']);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(6);

    // `value` keeps its place at the head of the drain order for the life of the node.
    expect(Object.keys(watcher._inputValuesQueue)).toEqual(['value', 'pulse']);
  });

  /**
   * The regression guard for how the fix was written. The old code returned early when the index
   * had not changed; moving the pulse below a bare early return would have swallowed the pulse for
   * every repeat of the same signal — a node that stops reporting once the user picks the same
   * option twice. Firing the same input twice must give two pulses.
   */
  test('re-firing the same input still announces', async () => {
    const graph = await signalToIndexGraph();
    await graph.settle(3);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(6);
    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(6);

    expect(graph.signalsFor('sti').filter((s) => s === 'signalTriggered')).toHaveLength(2);
    expect(graph.node<WatcherInstance>('watch').seen).toEqual([2, 2]);
  });
});
