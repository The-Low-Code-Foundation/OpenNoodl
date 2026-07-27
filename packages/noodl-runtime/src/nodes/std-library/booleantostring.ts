'use strict';

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

/**
 * `this` inside the Boolean To String node.
 *
 * Note `inputs` and the two index fields are initialised but never read — the node's whole
 * state is `currentInput`, `trueString` and `falseString`. They are left in place because
 * removing them is a behaviour-neutral change to a shipping node and belongs in its own
 * commit, not a typing slice.
 */
interface BooleanToStringNodeInstance extends NodeInstance {
  _internal: {
    inputs: unknown[];
    currentSelectedIndex: number;
    indexChanged: boolean;
    trueString: string;
    falseString: string;
    currentInput?: boolean;
  };
}

const BooleanToStringNode: NodeDefinitionOptions = {
  name: 'Boolean To String',
  docs: 'https://docs.noodl.net/nodes/utilities/boolean-to-string',
  category: 'Utilities',
  initialize: function (this: BooleanToStringNodeInstance) {
    this._internal.inputs = [];
    this._internal.currentSelectedIndex = 0;
    this._internal.indexChanged = false;

    this._internal.trueString = '';
    this._internal.falseString = '';
  },
  inputs: {
    trueString: {
      displayName: 'String for true',
      type: 'string',
      set: function (this: BooleanToStringNodeInstance, value: string) {
        if (this._internal.trueString === value) return;
        this._internal.trueString = value;

        if (this._internal.currentInput) {
          this.flagOutputDirty('currentValue');
        }
      }
    },
    falseString: {
      displayName: 'String for false',
      type: 'string',
      set: function (this: BooleanToStringNodeInstance, value: string) {
        if (this._internal.falseString === value) return;
        this._internal.falseString = value;

        if (!this._internal.currentInput) {
          this.flagOutputDirty('currentValue');
        }
      }
    },
    input: {
      type: { name: 'boolean' },
      displayName: 'Selector',
      set: function (this: BooleanToStringNodeInstance, value: boolean) {
        if (this._internal.currentInput === value) return;

        this._internal.currentInput = value;
        this.flagOutputDirty('currentValue');
        this.sendSignalOnOutput('inputChanged');
      }
    }
  },
  outputs: {
    currentValue: {
      type: 'string',
      displayName: 'Current Value',
      group: 'Value',
      getter: function (this: BooleanToStringNodeInstance) {
        return this._internal.currentInput ? this._internal.trueString : this._internal.falseString;
      }
    },
    inputChanged: {
      type: 'signal',
      displayName: 'Selector Changed',
      group: 'Signals'
    }
  }
};

const BooleanToStringNodeModule: NodeModule = {
  node: BooleanToStringNode
};

export = BooleanToStringNodeModule;
