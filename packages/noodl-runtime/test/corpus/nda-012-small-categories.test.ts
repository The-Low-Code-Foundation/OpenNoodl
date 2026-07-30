/**
 * NDA-012 — the citations for two runtime claims from the six-small-categories batch
 * (String Manipulation, Math, Interpolation, Events, Sensors, Javascript).
 *
 * Everything else in those worksheets is answerable from the source. These two are not, and the
 * phase's rule is that an uncited ⚠️ is a suspicion.
 *
 * ## 1. `Receive Event` announces before its payload lands — **FIXED 2026-07-30**
 *
 * `handleEvent` used to send `Received` and *then* flag the payload outputs dirty, so a node acting
 * on the pulse — a Function's `Run`, a Set Object Properties' `Do` — read the payload from the
 * **previous** event, or nothing at all on the first one. That was the exact inverse of what
 * `onapperror.ts:142-148` does deliberately and of what NDA-004 §3 established on `Response`; the
 * ordering rule already existed and this node predated it.
 *
 * The two rows below are kept as the regression guard, with the assertion inverted: what they now
 * pin is that the values are queued *ahead* of the pulse. Restore the old statement order and the
 * second row reddens on `[undefined]` while the control stays green.
 *
 * ⚠️ **`Signal To Index` still has the shape** (`signaltoindex.ts:64` before `:71`, Logic
 * worksheet) and is deliberately not fixed here — a different category's worksheet, and it deserves
 * its own discrimination check rather than riding along on this one. Two instances is what made it a
 * class rather than an oversight; fixing one of them does not retire the class.
 *
 * ## 3. `Number Remapper`'s default configuration was a constant
 *
 * Both input endpoints defaulted to `0`, which is the degenerate branch, so `Remapped Value` was
 * `Output Minimum` for every input — in the state every freshly dropped node was in. **FIXED
 * 2026-07-30** by giving `initialize` an input maximum of 1; see the rows at the end of this file
 * for why the fix could not live on the port's declared `default`.
 *
 * ## 2. A value port whose setter emits announces at page load
 *
 * `Counter`'s `Start Value` seeds the count and fires `Count Changed` the first time it is set
 * (`counter.ts:90-95`). An authored parameter *is* a set, so authoring it announces a count change
 * before the author has touched anything.
 *
 * `Switch`'s `State` does the same thing (Logic worksheet, `switch.ts:68-72`). Two categories, two
 * nodes, one shape — **a value port that is really "where this starts" cannot also be a command
 * without announcing at boot.** The distinguishing control is in the Logic file: an *unset* port is
 * silent, because a declared `default` does not run its setter at construction. So this only bites
 * authors who configured the node, which is the ones who cared.
 */

/* eslint-env jest */

import type { NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import CounterNode = require('../../src/nodes/std-library/counter');

import EventReceiverNode from '../../../noodl-viewer-react/src/nodes/std-library/eventreceiver';
import NumberRemapperNode from '../../../noodl-viewer-react/src/nodes/std-library/numberremapper';
import EventSenderNode from '../../../noodl-viewer-react/src/nodes/std-library/eventsender';

interface TriggerInstance extends NodeInstance {
  go(): void;
}

/** Reads whatever a payload output holds at the instant `Received` fires. */
interface WatcherInstance extends NodeInstance {
  seen: Array<unknown>;
}

const TriggerModule: NodeModule = {
  node: {
    name: 'corpus.Trigger',
    category: 'Logic',
    initialize(this: NodeInstance) {
      this._internal.value = 7;
    },
    outputs: {
      go: { type: 'signal' },
      /**
       * The payload has to arrive over a *wire*. `setInputValue('amount', …)` on the sender is a
       * no-op — `amount` is a runtime-discovered port and `registerInputIfNeeded` only runs when a
       * connection targets it, so the call logs "node doesn't have input amount" and returns. The
       * first version of this file did exactly that, and both rows still passed: the watcher saw
       * `undefined` because nothing was ever sent, not because of the ordering under test. The
       * "delivers the event" control passed too, because `Received` fires regardless of payload.
       */
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
      }
    }
  }
};

/**
 * The observer. It takes the signal on `pulse` and the payload on `value`, and records the payload
 * *as it stands when the pulse arrives* — which is exactly what a Function node's `Run` sees.
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

describe('NDA-012 Events — Receive Event announces its payload, not the previous one', () => {
  async function eventGraph(): Promise<CorpusGraph> {
    return createCorpusGraph({
      modules: [
        TriggerModule,
        WatcherModule,
        EventSenderNode as unknown as NodeModule,
        EventReceiverNode as unknown as NodeModule
      ],
      rootComponent: '/root',
      data: {
        components: [
          {
            name: '/root',
            nodes: [
              { id: 'trigger', type: 'corpus.Trigger' },
              { id: 'send', type: 'Event Sender', parameters: { channelName: 'ch', payload: 'amount' } },
              { id: 'recv', type: 'Event Receiver', parameters: { channelName: 'ch' } },
              { id: 'watch', type: 'corpus.Watcher' }
            ],
            connections: [
              { sourceId: 'trigger', sourcePort: 'value', targetId: 'send', targetPort: 'amount' },
              { sourceId: 'trigger', sourcePort: 'go', targetId: 'send', targetPort: 'sendEvent' },
              { sourceId: 'recv', sourcePort: 'eventReceived', targetId: 'watch', targetPort: 'pulse' },
              { sourceId: 'recv', sourcePort: 'amount', targetId: 'watch', targetPort: 'value' }
            ]
          }
        ]
      } as never
    });
  }

  /** The control: the channel wiring works at all, so a silent row below would mean something. */
  test('delivers the event to the receiver', async () => {
    const graph = await eventGraph();
    await graph.settle(3);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(6);

    expect(graph.signalsFor('recv')).toContain('eventReceived');
    // The payload really did travel — without this the row below pins nothing.
    expect(graph.node('recv').getOutput('amount').value).toBe(7);
  });

  /**
   * ~~The finding.~~ **FIXED 2026-07-30** — `handleEvent` flags the payload outputs before it
   * pulses, so a node acting on `Received` reads *this* event's data. The row is inverted rather
   * than deleted: it is the regression guard, and the thing it guards is one statement's position.
   *
   * Restore the old order and this row reddens on `[undefined]` while the control above stays
   * green, which is what makes it a test of the ordering rather than of the wiring.
   */
  test('the payload is readable the instant Received fires (eventreceiver.ts handleEvent)', async () => {
    const graph = await eventGraph();
    await graph.settle(3);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(6);

    expect(graph.node('recv').getOutput('amount').value).toBe(7);
    // The node that acted on the pulse saw the value the pulse was announcing.
    expect(graph.node<WatcherInstance>('watch').seen).toEqual([7]);
  });
});

describe('NDA-012 Math — Counter announces a count change at page load', () => {
  async function counterGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [CounterNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [{ name: '/root', nodes: [{ id: 'c', type: 'Counter', parameters }], connections: [] }]
      } as never
    });
    await graph.settle(4);
    return graph;
  }

  /** The control, and the same one that corrected the Switch row: an unset port is silent. */
  test('is silent at boot when Start Value is left unset', async () => {
    const graph = await counterGraph({});

    expect(graph.signalsFor('c')).toEqual([]);
  });

  /** The finding — the second node in this pass with the shape, and in a different category. */
  test('fires Count Changed at boot when Start Value is authored (counter.ts:90-95)', async () => {
    const graph = await counterGraph({ startValue: 5 });

    expect(graph.signalsFor('c')).toEqual(['countChanged']);
  });
});

/**
 * NDA-012 (Math) — Number Remapper's default configuration is no longer a constant.
 *
 * Both input endpoints defaulted to 0, which is `_calculateNewOutputValue`'s degenerate branch:
 * `normalizedValue = 0`, so `Remapped Value` was `Output Minimum` for every input. Nothing warned,
 * and it was the state every freshly dropped node was in.
 *
 * ⚠️ These rows drive the node with **no parameters at all**, which is the only configuration the
 * defect lived in — and it is also why the fix had to be in `initialize` rather than on the port's
 * `default`. A declared default does not run its setter at construction, so a row that set the
 * parameters would exercise the setters and pass either way.
 */
describe('NDA-012 Math — Number Remapper', () => {
  async function remapperGraph(parameters: Record<string, unknown>): Promise<CorpusGraph> {
    const graph = await createCorpusGraph({
      modules: [NumberRemapperNode as unknown as NodeModule],
      rootComponent: '/root',
      data: {
        components: [
          { name: '/root', nodes: [{ id: 'r', type: 'Number Remapper', parameters }], connections: [] }
        ]
      } as never
    });
    await graph.settle(4);
    return graph;
  }

  const remapped = (graph: CorpusGraph) => graph.node('r').getOutput('remappedValue').value;

  test('an unconfigured node passes its input through rather than reporting a constant', async () => {
    const graph = await remapperGraph({});

    graph.node('r').setInputValue('inputValue', 0.25);
    await graph.settle(2);
    expect(remapped(graph)).toBeCloseTo(0.25);

    graph.node('r').setInputValue('inputValue', 0.75);
    await graph.settle(2);
    expect(remapped(graph)).toBeCloseTo(0.75);
  });

  /**
   * The control, and the reason the row above is about the *default* and not about the maths: an
   * author who deliberately collapses the input range still gets the documented constant. Without
   * this, "returns Output Minimum for everything" would read as a bug rather than as a configuration.
   */
  test('an explicitly collapsed input range still pins the result at Output Minimum', async () => {
    const graph = await remapperGraph({ minInputValue: 5, maxInputValue: 5, minOutputValue: 3 });

    graph.node('r').setInputValue('inputValue', 99);
    await graph.settle(2);
    expect(remapped(graph)).toBe(3);
  });
});
