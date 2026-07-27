'use strict';

import type { NodeInstance } from '@noodl/types';

import type { MixinNodeModule } from './crud-mixins';

import ModelCRUDBase = require('./modelcrudbase');

/** `this` inside Set Object Properties — `scheduleStore` comes from `addInputProperties`. */
interface SetModelPropertiesInstance extends NodeInstance {
  scheduleStore(): void;
}

const SetModelPropertiedNodeDefinition: MixinNodeModule = {
  node: {
    name: 'SetModelProperties',
    docs: 'https://docs.noodl.net/nodes/data/object/set-object-properties',
    displayNodeName: 'Set Object Properties',
    inputs: {
      store: {
        displayName: 'Do',
        group: 'Actions',
        valueChangedToTrue: function (this: SetModelPropertiesInstance) {
          this.scheduleStore();
        }
      }
    },
    outputs: {
      stored: {
        type: 'signal',
        displayName: 'Done',
        group: 'Events'
      }
    }
  }
};

ModelCRUDBase.addBaseInfo(SetModelPropertiedNodeDefinition);
ModelCRUDBase.addModelId(SetModelPropertiedNodeDefinition);
ModelCRUDBase.addInputProperties(SetModelPropertiedNodeDefinition);

export = SetModelPropertiedNodeDefinition;
