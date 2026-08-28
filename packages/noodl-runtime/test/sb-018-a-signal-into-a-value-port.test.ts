/**
 * SB-018 (5) — what a **signal** output does when it is wired to a **value**
 * input, which is not "nothing".
 *
 * The Site Builder's `submitContactForm` answered `{"received": false}` about a
 * message it had stored correctly, driven over real HTTP (SB-017 §10.5). The
 * wire was `compose.out-built -> res.pm-received`: a signal output into a value
 * parameter port on the cloud Response node. `canCastPortTypes` allows the cast,
 * so nothing warned on the canvas and nothing dropped on the way out.
 *
 * 🔴 **SB-018 recorded the mechanism as "the port simply never receives a value
 * and the response reports the declared default". Both halves are wrong, and the
 * correction is why the fix had to change shape.** There is no declared default:
 * `pm-` ports are typed `*` with none, and `Response.initialize` starts
 * `responseParameters` at `{}` — an unset port would have left `received` out of
 * the body entirely, not put `false` in it.
 *
 * What actually happens is here: a pulse into a value port is delivered as
 * **`true` and then `false`, both inside one drain pass** (`node.ts:686-692`;
 * `OutputProperty.sendPulse` calls `_setPulseFromConnection`, which queues one
 * `SIGNAL_PULSE` that the drain expands back into two `setInputValue` calls). So
 * the receiving setter runs twice and the port settles on the falling edge. The
 * response body carried the rearm, not a default.
 *
 * That is what made "publish a value instead of a signal" — SB-018 (5)'s own
 * suggested fix — insufficient rather than merely partial: the value would have
 * been published by `compose`, which runs on `req.receive` and therefore before
 * anything is stored, so the endpoint would have promised `true` on the failure
 * path too. The template's fix moves the flag to after the write. This file is
 * the mechanism underneath that decision.
 */

import type { NodeInstance } from '@noodl/types';

import { createGraph } from './helpers/node-harness';

/** The sender definition's own surface — the harness types the instance from this. */
interface SenderInstance extends NodeInstance {
  fire(): void;
  publish(value: unknown): void;
}

/** Every value the receiver's `flag` setter saw, in order. */
function record(): { seen: unknown[]; graph: ReturnType<typeof createGraph> } {
  const seen: unknown[] = [];

  const graph = createGraph(
    {
      node: {
        name: 'test.sb018.Sender',
        category: 'Test',
        initialize: function (this: NodeInstance) {
          this._internal.value = undefined;
        },
        outputs: {
          // The two shapes being compared: one signal, one plain value.
          onEvent: { type: 'signal' },
          value: {
            type: 'boolean',
            getter: function (this: NodeInstance) {
              return this._internal.value;
            }
          }
        },
        methods: {
          fire(this: NodeInstance) {
            this.sendSignalOnOutput('onEvent');
          },
          publish(this: NodeInstance, value: unknown) {
            this._internal.value = value;
            this.flagOutputDirty('value');
          }
        }
      }
    },
    {
      node: {
        name: 'test.sb018.Receiver',
        category: 'Test',
        inputs: {
          // A VALUE port, like `pm-received`: it has a setter and no notion of
          // an edge.
          flag: {
            type: '*',
            set: function (_value: unknown) {
              seen.push(_value);
            }
          }
        }
      }
    }
  );

  return { seen, graph };
}

describe('SB-018 (5): a signal wired into a value port', () => {
  it('🔴 sets the port TWICE and settles on `false` — it does not leave it unset', () => {
    const { seen, graph } = record();
    const sender = graph.make<SenderInstance>('test.sb018.Sender', 'sender');
    const receiver = graph.make('test.sb018.Receiver', 'receiver');

    receiver.connectInput('flag', sender, 'onEvent');

    // Until a node has updated once, `_isFirstUpdate` collapses value queues,
    // which is a different path from the one under test.
    receiver.update();
    seen.length = 0;

    sender.fire();
    receiver.update();

    // The finding, in one row: the rising edge is the event and the falling edge
    // rearms the detector, and a value port has no idea either of those is what
    // it is being told.
    expect(seen).toEqual([true, false]);
  });

  it('…so anything storing the last value it was given stores `false`', () => {
    // The consequence rather than the mechanism, which is the form the defect
    // actually took: the Response node's `pm-` setter writes into a plain object
    // that is JSON-encoded when the response goes out.
    const { seen, graph } = record();
    const sender = graph.make<SenderInstance>('test.sb018.Sender', 'sender');
    const receiver = graph.make('test.sb018.Receiver', 'receiver');

    receiver.connectInput('flag', sender, 'onEvent');
    receiver.update();
    seen.length = 0;

    sender.fire();
    receiver.update();

    expect(seen[seen.length - 1]).toBe(false);
  });

  it('🔴 the control: a real VALUE output sets the port once, with the value', () => {
    // The known-firing comparison, and it is what makes the two rows above about
    // signals rather than about this harness. Same sender, same receiver, same
    // port — only the output's type varies, which is the one thing the claim is
    // about.
    const { seen, graph } = record();
    const sender = graph.make<SenderInstance>('test.sb018.Sender', 'sender');
    const receiver = graph.make('test.sb018.Receiver', 'receiver');

    receiver.connectInput('flag', sender, 'value');
    receiver.update();
    seen.length = 0;

    sender.publish(true);
    receiver.update();

    expect(seen).toEqual([true]);
  });
});
