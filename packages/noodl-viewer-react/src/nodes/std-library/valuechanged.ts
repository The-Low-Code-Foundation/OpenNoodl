import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

interface ValueChangedInstance extends NodeInstance {
  _internal: {
    lastValue: unknown;
    changeCount: number;
  };
}

const ValueChangedNode: NodeDefinitionOptions = {
  name: 'Value Changed',
  docs: 'https://docs.noodl.net/nodes/logic/value-changed',
  category: 'Logic',
  initialize: function (this: ValueChangedInstance) {
    this._internal.lastValue = undefined;
    this._internal.changeCount = 0;
  },
  getInspectInfo(this: ValueChangedInstance) {
    if (this._internal.changeCount) {
      return 'Triggered ' + this._internal.changeCount + (this._internal.changeCount === 1 ? ' time' : ' times');
    }
    return 'Not triggered';
  },
  inputs: {
    value: {
      group: 'Values',
      type: '*',
      displayName: 'Input',
      description:
        'Value to watch; changes are detected by identity, so editing an Object or Array in place is not a change here',
      set: function (this: ValueChangedInstance, value: unknown) {
        if (this._internal.lastValue === value) {
          return;
        }

        this._internal.changeCount++;
        this.sendSignalOnOutput('valueChanged');
        this._internal.lastValue = value;
      }
    }
  },
  outputs: {
    valueChanged: {
      group: 'Events',
      type: 'signal',
      displayName: 'Value Changed',
      description: 'Fires when Input becomes a different value, including the first time it arrives'
    }
  }
};

export default {
  node: ValueChangedNode
};
