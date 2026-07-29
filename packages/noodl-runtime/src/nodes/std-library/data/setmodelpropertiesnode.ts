'use strict';

import type { NodeInstance } from '@noodl/types';

import type { MixinNodeModule } from './crud-mixins';

import ModelCRUDBase = require('./modelcrudbase');

/** `this` inside Set Object Properties — `scheduleStore` comes from `addInputProperties`. */
interface SetModelPropertiesInstance extends NodeInstance {
  scheduleStore(): void;
}

/**
 * NDA-004 §2 — the code prefix this node raises under.
 *
 * Named here, beside the node, rather than derived from `name` above: the raised code is a
 * stable public identifier that tooling and corpus rows match on, and the internal type name
 * (`SetModelProperties`) is not the same thing and may not travel with it.
 */
const FAILURE_CODE_PREFIX = 'set-object-properties';

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
ModelCRUDBase.addFailure(SetModelPropertiedNodeDefinition, FAILURE_CODE_PREFIX);
ModelCRUDBase.addInputProperties(SetModelPropertiedNodeDefinition);

export = SetModelPropertiedNodeDefinition;
