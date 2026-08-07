'use strict';

import type { ModelModule } from '@noodl/types';

import type { MixinNodeModule, ModelIdInstance } from './crud-mixins';

import ModelImport = require('../../../model');
import ModelCRUDBase = require('./modelcrudbase');
import { outcomeOutputs } from '../../../outcome';

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
    /**
     * ERG-001 §4. `created` was one of the four internal names that all displayed as "Done"
     * (§0.2 Result 2); it is `done` now, and `Completed` joins it.
     *
     * No `Failure`: this node builds its own object and has nothing to fail at, which is why
     * `addFailure` is deliberately not applied below. No `Unchanged`: every `Do` mints a
     * *distinct* object, so the post-condition can never already hold.
     */
    outputs: outcomeOutputs({
      done: 'Fires once the new object exists, its properties are written and Id names it'
    }),
    methods: {
      scheduleNew: function (this: NewModelNodeInstance) {
        if (this.hasScheduledNew) return;
        this.hasScheduledNew = true;
        // Opened after the coalescing guard, so two `Do` pulses inside one frame — which this
        // node deliberately collapses into one store — produce one invocation and one outcome.
        // Captured by the closure rather than parked on the instance: a token that cannot
        // outlive its invocation is what makes NV-iii's latched-result class unrepresentable.
        const outcome = this.beginOutcome();

        this.scheduleAfterInputsHaveUpdated(() => {
          this.hasScheduledNew = false;
          const newModel = (this.nodeScope.modelScope || Model).get();

          this._pushInputValues(newModel);

          this.setModel(newModel);

          // Last, after `setModel` has flagged `Id` dirty: a graph wired `Done -> Insert` must
          // already be able to read the id when the pulse lands.
          this.reportOutcome(outcome, 'done');
        });
      }
    }
  }
};

ModelCRUDBase.addBaseInfo(NewModelNodeDefinition);
ModelCRUDBase.addModelId(NewModelNodeDefinition, { includeOutputs: true });
ModelCRUDBase.addInputProperties(NewModelNodeDefinition);

export = NewModelNodeDefinition;
