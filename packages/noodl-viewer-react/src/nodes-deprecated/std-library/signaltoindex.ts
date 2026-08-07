'use strict';

import { EdgeTriggeredInput } from '@noodl/runtime';
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/** `this` inside the Signal To Index node. */
interface SignalToIndexNodeInstance extends NodeInstance {
  _internal: {
    currentIndex: number;
  };
  onValueChangedToTrue(index: number): void;
}

const SignalToIndexNode: NodeDefinitionOptions = {
  name: 'Signal To Index',
  docs: 'https://docs.noodl.net/nodes/logic/signal-to-index',
  category: 'Logic',
  deprecated: true,
  initialize: function (this: SignalToIndexNodeInstance) {
    this._internal.currentIndex = 0;
  },
  getInspectInfo(this: SignalToIndexNodeInstance): InspectInfo {
    return 'Index: ' + this._internal.currentIndex;
  },
  numberedInputs: {
    input: {
      type: 'boolean',
      displayPrefix: 'Signal',
      createSetter: function (this: SignalToIndexNodeInstance, index: number) {
        return EdgeTriggeredInput.createSetter({
          valueChangedToTrue: this.onValueChangedToTrue.bind(this, index)
        });
      },
      // `selectors` is read by nothing: `registerSetupFunctionForNumberedInputs`
      // builds its dynamic ports from `type`, `displayPrefix`, `group` and `index`
      // only. Dead metadata, kept because removing it moves no behaviour.
      selectors: {
        startIndex: {
          displayName: 'Start Index',
          set: function (this: SignalToIndexNodeInstance, index: number) {
            this._internal.currentIndex = index;
            this.flagOutputDirty('index');
          }
        }
      }
    } as NodeDefinitionOptions['numberedInputs'][string]
  },
  outputs: {
    index: {
      displayName: 'Index',
      type: 'number',
      description: 'Number of the signal input that last fired, counting from zero',
      getter: function (this: SignalToIndexNodeInstance) {
        return this._internal.currentIndex;
      }
    },
    signalTriggered: {
      displayName: 'Signal Triggered',
      type: 'signal',
      description: 'Fires when any signal input fires, once Index holds the number of the input that fired'
    }
  },
  prototypeExtensions: {
    /**
     * NDA-012 — the second instance of *signal before value*, and the one left standing when
     * `Receive Event` was fixed so that it could get its own discrimination check rather than
     * ride along on another node's.
     *
     * The pulse used to go out first, so a node acting on `Signal Triggered` read the
     * **previous** signal's index — or `0`, the initialised value, on the first one. Carrying
     * which input fired alongside the announcement that one did is this node's entire purpose,
     * so the ordering defeated the reason it exists.
     *
     * What settles the fix is program order: `flagOutputDirty` and `sendSignalOnOutput` both
     * push into the receiving node's input queue, so flagging first queues the value ahead of
     * the pulse. Same one-statement move as `eventreceiver.ts`'s `handleEvent`.
     *
     * The early return had to become a guarded update rather than stay an early return: the
     * pulse fires on *every* signal, including one that re-selects the index already showing,
     * and returning early after moving the pulse down would have swallowed those.
     */
    onValueChangedToTrue: function (this: SignalToIndexNodeInstance, index: number) {
      if (this._internal.currentIndex !== index) {
        this._internal.currentIndex = index;
        this.flagOutputDirty('index');
      }

      this.sendSignalOnOutput('signalTriggered');
    }
  }
};

const SignalToIndexNodeModule: NodeModule = {
  node: SignalToIndexNode
};

export default SignalToIndexNodeModule;
