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
  shortDesc: 'Maps signal inputs to their index value.',
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
      getter: function (this: SignalToIndexNodeInstance) {
        return this._internal.currentIndex;
      }
    },
    signalTriggered: {
      displayName: 'Signal Triggered',
      type: 'signal'
    }
  },
  prototypeExtensions: {
    onValueChangedToTrue: function (this: SignalToIndexNodeInstance, index: number) {
      this.sendSignalOnOutput('signalTriggered');

      if (this._internal.currentIndex === index) {
        return;
      }

      this._internal.currentIndex = index;
      this.flagOutputDirty('index');
    }
  }
};

const SignalToIndexNodeModule: NodeModule = {
  node: SignalToIndexNode
};

export default SignalToIndexNodeModule;
