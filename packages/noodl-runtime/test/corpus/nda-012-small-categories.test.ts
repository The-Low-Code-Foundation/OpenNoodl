/**
 * NDA-012 — the citations for two runtime claims from the six-small-categories batch
 * (String Manipulation, Math, Interpolation, Events, Sensors, Javascript).
 *
 * Everything else in those worksheets is answerable from the source. These two are not, and the
 * phase's rule is that an uncited ⚠️ is a suspicion.
 *
 * ## 1. `Receive Event` announces before its payload lands
 *
 * `handleEvent` sends `Received` and *then* flags the payload outputs dirty
 * (`eventreceiver.ts:106` before `:108-113`). So a node that acts on the pulse — a Function's `Run`,
 * a Set Object Properties' `Do` — reads the payload from the **previous** event, or nothing at all on
 * the first one. This is the exact inverse of what `onapperror.ts:142-148` does deliberately, and of
 * what NDA-004 §3 established on `Response`; the ordering rule already exists, this node predates it.
 *
 * It is the second instance in one batch — `Signal To Index` has the same shape
 * (`signaltoindex.ts:64` before `:71`, in the Logic worksheet) — which is what makes it a class
 * rather than an oversight. **Carrying a payload alongside a signal is the whole purpose of both
 * nodes**, so in each case the defect defeats the reason the node exists.
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

describe('NDA-012 Events — Receive Event fires before its payload is updated', () => {
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
   * The finding. On the first event the watcher sees `undefined` where the sender said `7`, because
   * the payload output has not been flagged dirty yet when `Received` propagates.
   */
  test('the payload is not yet readable when Received fires (eventreceiver.ts:106)', async () => {
    const graph = await eventGraph();
    await graph.settle(3);

    graph.node<TriggerInstance>('trigger').go();
    await graph.settle(6);

    // The event carried 7, and the receiver holds 7 by the end of the frame — but the node that
    // acted on the pulse read the port before any of that happened.
    expect(graph.node('recv').getOutput('amount').value).toBe(7);
    expect(graph.node<WatcherInstance>('watch').seen).toEqual([undefined]);
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
