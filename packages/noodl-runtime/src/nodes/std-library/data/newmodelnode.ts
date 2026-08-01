'use strict';

import type { ModelModule } from '@noodl/types';

import type { MixinNodeModule, ModelIdInstance } from './crud-mixins';

import ModelImport = require('../../../model');
import ModelCRUDBase = require('./modelcrudbase');

const Model = ModelImport as unknown as ModelModule;

/** `this` inside Create New Object — `addModelId` and `addInputProperties` are both applied. */
interface NewModelNodeInstance extends ModelIdInstance {
  /** On the instance rather than in `_internal` — guards {@link scheduleNew}. */
  hasScheduledNew?: boolean;
  scheduleNew(): void;
  _pushInputValues(model: ReturnType<ModelModule['get']>): void;
}

const NewModelNodeDefinition: MixinNodeModule = {
  node: {
    name: 'NewModel',
    docs: 'https://docs.noodl.net/nodes/data/object/create-new-object',
    displayNodeName: 'Create New Object',
    inputs: {
      new: {
        displayName: 'Do',
        group: 'Actions',
        description: 'Creates a new object with a generated id and writes the property values currently on the inputs',
        valueChangedToTrue: function (this: NewModelNodeInstance) {
          this.scheduleNew();
        }
      }
    },
    outputs: {
      created: {
        type: 'signal',
        displayName: 'Done',
        group: 'Events',
        description: 'Fires once the new object exists, its properties are written and Id names it'
      }
    },
    methods: {
      scheduleNew: function (this: NewModelNodeInstance) {
        if (this.hasScheduledNew) return;
        this.hasScheduledNew = true;

        this.scheduleAfterInputsHaveUpdated(() => {
          this.hasScheduledNew = false;
          const newModel = (this.nodeScope.modelScope || Model).get();

          this._pushInputValues(newModel);

          this.setModel(newModel);

          this.sendSignalOnOutput('created');
        });
      }
    }
  }
};

ModelCRUDBase.addBaseInfo(NewModelNodeDefinition);
ModelCRUDBase.addModelId(NewModelNodeDefinition, { includeOutputs: true });
ModelCRUDBase.addInputProperties(NewModelNodeDefinition);

export = NewModelNodeDefinition;
