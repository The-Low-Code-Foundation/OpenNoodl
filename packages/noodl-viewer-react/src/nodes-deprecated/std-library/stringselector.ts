'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/** `this` inside the Index To String node. */
interface StringSelectorNodeInstance extends NodeInstance {
  _internal: {
    /** One entry per numbered `input N` port, indexed by that number. */
    inputs: string[];
    currentSelectedIndex: number;
    indexChanged: boolean;
  };
}

const StringSelectorNode: NodeDefinitionOptions = {
  name: 'String Selector',
  displayNodeName: 'Index To String',
  shortDesc: 'Choose between multiple strings.',
  category: 'Utilities',
  deprecated: true,
  initialize: function (this: StringSelectorNodeInstance) {
    this._internal.inputs = [];
    this._internal.currentSelectedIndex = 0;
    this._internal.indexChanged = false;
  },
  getInspectInfo(this: StringSelectorNodeInstance): InspectInfo {
    return this._internal.inputs[this._internal.currentSelectedIndex];
  },
  numberedInputs: {
    input: {
      type: 'string',
      displayPrefix: 'String for ',
      group: 'Inputs',
      createSetter: function (index: number) {
        // The port is declared `string`, but the setter coerces because anything
        // can arrive over a connection — so the parameter is `unknown` and the
        // coerced value gets its own name.
        return function (this: StringSelectorNodeInstance, value: unknown) {
          const text = value ? String(value) : '';
          this._internal.inputs[index] = text;
          if (this._internal.currentSelectedIndex === index) {
            this.flagOutputDirty('currentValue');
          }
        };
      }
    }
  },
  inputs: {
    index: {
      type: {
        name: 'number'
      },
      displayName: 'Index',
      default: 0,
      description: 'Which of the numbered strings to publish, counting from zero and truncated to a whole number',
      set: function (this: StringSelectorNodeInstance, value: number) {
        value = value | 0;

        this._internal.currentSelectedIndex = value;
        this.flagOutputDirty('currentValue');
        this.sendSignalOnOutput('indexChanged');
      }
    }
  },
  outputs: {
    currentValue: {
      type: 'string',
      displayName: 'Current Value',
      group: 'Value',
      description: 'The numbered string sitting at Index, or nothing when there is none',
      getter: function (this: StringSelectorNodeInstance) {
        return this._internal.inputs[this._internal.currentSelectedIndex];
      }
    },
    indexChanged: {
      type: 'signal',
      displayName: 'Index Changed',
      group: 'Signals',
      description: 'Fires when Index changes, after Current Value has been updated'
    }
  }
};

const StringSelectorNodeModule: NodeModule = {
  node: StringSelectorNode
};

export default StringSelectorNodeModule;
