'use strict';

import type { NodeInstance } from '@noodl/types';

import type { MixinNodeModule } from './crud-mixins';

import ModelCRUDBase = require('./modelcrudbase');
import { outcomeOutputs } from '../../../outcome';

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
        description: 'Writes the property values currently on the inputs onto the object named by Id',
        valueChangedToTrue: function (this: SetModelPropertiesInstance) {
          this.scheduleStore();
        }
      }
    },
    /**
     * ERG-001 §4. `stored` was one of the four internal names that all displayed as "Done"
     * (§0.2 Result 2), and the one `library/prefabs` actually wired — seven shipped
     * connections across six prefabs, migrated in the same commit.
     *
     * `Failure` is declared by `addFailure` below rather than here, because its description
     * belongs beside the code prefix it raises under. No `Unchanged`: see the note in
     * `modelcrudbase.scheduleStore`.
     */
    outputs: outcomeOutputs({
      done: 'Fires once the properties have been written onto the object and anything watching it has been told'
    })
  }
};

ModelCRUDBase.addBaseInfo(SetModelPropertiedNodeDefinition);
ModelCRUDBase.addModelId(SetModelPropertiedNodeDefinition);
ModelCRUDBase.addFailure(SetModelPropertiedNodeDefinition, FAILURE_CODE_PREFIX);
ModelCRUDBase.addInputProperties(SetModelPropertiedNodeDefinition);

export = SetModelPropertiedNodeDefinition;
