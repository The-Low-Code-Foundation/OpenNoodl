/**
 * A signal and the value it pairs with must stay in step, however many events are
 * queued before the receiving node updates.
 *
 * Inputs are queued per port and drained one entry per port per pass. A value input
 * queues one entry per event. A signal used to queue two — the `true` and the `false` —
 * so it advanced through the queue at half the rate of the value beside it, and the
 * pairing came apart as soon as two events arrived in one update iteration. Nothing
 * caught it, because every test in this repository delivered one event at a time.
 *
 * What it cost: the agent-chat example's first real run in a browser rendered a chat
 * answer with every other token missing and the last one repeated a dozen times, because
 * a fast stream delivers several SSE frames inside one animation frame. These tests are
 * written at both levels — the bare runtime contract, and the SSE → Text Accumulator
 * wiring the docs recommend — because a fix at either level alone would leave the other
 * able to regress.
 */

import type { NodeInstance } from '@noodl/types';

import type { SseNodeInstance, TextAccumulatorNodeInstance } from '../src/nodes/std-library/agent/node-instances';

import { createGraph, outputValue } from './helpers/node-harness';

import sseModule = require('../src/nodes/std-library/agent/sse');
import accumulatorModule = require('../src/nodes/std-library/agent/text-accumulator');

// ---------------------------------------------------------------------------
// A minimal sender/receiver pair: one value output plus one signal output, and a
// receiver that records the value it sees each time the signal fires.
// ---------------------------------------------------------------------------

/** The one method the sender definition adds to itself. */
interface SenderNodeInstance extends NodeInstance {
  emit(payload: unknown): void;
}

function makePair() {
  const seen: unknown[] = [];

  const graph = createGraph(
    {
      node: {
        name: 'test.Sender',
        category: 'Test',
        initialize: function (this: NodeInstance) {
          this._internal.payload = undefined;
        },
        outputs: {
          payload: {
            type: 'string',
            getter: function (this: NodeInstance) {
              return this._internal.payload;
            }
          },
          onEvent: { type: 'signal' }
        },
        methods: {
          emit(this: NodeInstance, payload: unknown) {
            this._internal.payload = payload;
            this.flagOutputDirty('payload');
            this.sendSignalOnOutput('onEvent');
          }
        }
      }
    },
    {
      node: {
        name: 'test.Receiver',
        category: 'Test',
        initialize: function (this: NodeInstance) {
          this._internal.payload = undefined;
        },
        inputs: {
          payload: {
            type: 'string',
            set: function (this: NodeInstance, value: unknown) {
              this._internal.payload = value;
            }
          },
          take: {
            valueChangedToTrue: function (this: NodeInstance) {
              seen.push(this._internal.payload);
            }
          }
        }
      }
    }
  );

  const sender = graph.make<SenderNodeInstance>('test.Sender', 'sender');
  const receiver = graph.make('test.Receiver', 'receiver');

  receiver.connectInput('payload', sender, 'payload');
  receiver.connectInput('take', sender, 'onEvent');

  // One event on its own first: until a node has updated once, `_isFirstUpdate`
  // deliberately collapses value queues, which is a different path from the one under
  // test here.
  sender.emit('warm-up');
  receiver.update();
  seen.length = 0;

  return {
    emit: (payload: unknown) => sender.emit(payload),
    update: () => receiver.update(),
    seen
  };
}

describe('a signal and the value beside it', () => {
  it('stays paired for a single event', () => {
    const pair = makePair();
    pair.emit('one');
    pair.update();
    expect(pair.seen).toEqual(['one']);
  });

  it('stays paired when several events are queued before the update', () => {
    const pair = makePair();
    ['a', 'b', 'c', 'd', 'e'].forEach(pair.emit);
    pair.update();
    // Before the fix: ['a', 'c', 'e', 'e', 'e'] — every other value dropped and the
    // last one repeated for the signals whose value queue had already run dry.
    expect(pair.seen).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('holds for a long burst', () => {
    const pair = makePair();
    const payloads = Array.from({ length: 40 }, (_, i) => 'p' + i);
    payloads.forEach(pair.emit);
    pair.update();
    expect(pair.seen).toEqual(payloads);
  });
});

// ---------------------------------------------------------------------------
// The same thing through the two nodes an author actually wires.
// ---------------------------------------------------------------------------

describe('SSE -> Text Accumulator with frames batched into one iteration', () => {
  function wire() {
    const graph = createGraph(sseModule, accumulatorModule);

    const sse = graph.make<SseNodeInstance>('net.noodl.SSE', 'sse-1');
    const accumulator = graph.make<TextAccumulatorNodeInstance>('net.noodl.TextAccumulator', 'accumulator-1');

    accumulator.setInputValue('delimiter', '');
    accumulator.connectInput('chunk', sse, 'text');
    accumulator.connectInput('add', sse, 'onMessage');

    const frame = (data: string, id: string) => sse.handleFrame({ event: 'message', data, id });

    frame('warm-up', 'w');
    accumulator.update();
    accumulator.clearBuffer();

    return {
      frame,
      update: () => accumulator.update(),
      accumulated: () => outputValue(accumulator, 'accumulated')
    };
  }

  it('keeps every token, whitespace included, when a burst arrives at once', () => {
    const sse = wire();
    // Whitespace is its own token in a real token stream, so a drop-every-other bug
    // reads as an answer with the spaces removed — which is how this was first seen.
    ['Tokens', ' ', 'arrive', ' ', 'one', ' ', 'at', ' ', 'a', ' ', 'time'].forEach((token, i) =>
      sse.frame(token, String(i))
    );
    sse.update();

    expect(sse.accumulated()).toBe('Tokens arrive one at a time');
  });

  it('does not repeat the final token once the burst is drained', () => {
    const sse = wire();
    ['x', 'y', 'z'].forEach((token, i) => sse.frame(token, String(i)));
    sse.update();

    expect(sse.accumulated()).toBe('xyz');
  });
});
