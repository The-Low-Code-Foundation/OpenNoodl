'use strict';

import type { ModelModule } from '@noodl/types';

import type { DbCrudBaseInstance, DbCrudNodeModule, DbModelIdInstance, RelationPropertyInstance } from './crud-mixins';

import ModelImport = require('../../../model');
import DbModelCRUDBase = require('./dbmodelcrudbase');
import CloudStore = require('../../../api/cloudstore');

const Model = ModelImport as unknown as ModelModule;

/** `this` inside Remove Record Relation. */
interface RemoveRelationInstance extends DbCrudBaseInstance, DbModelIdInstance, RelationPropertyInstance {
  _internal: DbCrudBaseInstance['_internal'] & DbModelIdInstance['_internal'] & RelationPropertyInstance['_internal'];
  /** NDA-004 §2: returns the first missing input, or `undefined` when the node can act. */
  validateInputs(): string | undefined;
  scheduleRemoveRelation(): void;
}

// The name is a copy-paste from the Add sibling and is kept: the local binding is not
// observable, and the editor reads `node.name` below. So is the `'add-relation'` warning key
// — warnings are addressed per node id, so the two nodes never collide.
const AddDbModelRelationNodeDefinition: DbCrudNodeModule = {
  node: {
    name: 'RemoveDbModelRelation',
    docs: 'https://docs.noodl.net/nodes/data/cloud-data/remove-record-relation',
    displayName: 'Remove Record Relation',
    usePortAsLabel: 'collectionName',
    inputs: {
      store: {
        displayName: 'Do',
        group: 'Actions',
        valueChangedToTrue: function (this: RemoveRelationInstance) {
          this.scheduleRemoveRelation();
        }
      }
    },
    outputs: {
      relationRemoved: {
        type: 'signal',
        displayName: 'Success',
        group: 'Events'
      }
    },
    methods: {
      /** The first thing missing, or `undefined` when ready. See the twin in `-addrelation`. */
      validateInputs: function (this: RemoveRelationInstance): string | undefined {
        let problem: string | undefined;

        if (this._internal.collectionId === undefined) {
          problem = 'No class specified';
        } else if (this._internal.relationProperty === undefined) {
          problem = 'No relation property specified';
        } else if (this._internal.targetModelId === undefined) {
          problem = 'No target record Id (the record to remove a relation from) specified';
        } else if (this._internal.model === undefined) {
          problem = 'No record Id specified (the record that should lose the relation)';
        }

        if (this.context.editorConnection) {
          if (problem) {
            this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'add-relation', {
              message: problem
            });
          } else {
            this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'add-relation');
          }
        }

        return problem;
      },
      scheduleRemoveRelation: function (this: RemoveRelationInstance) {
        const _this = this;
        const internal = this._internal;

        this.scheduleOnce('StorageRemoveRelation', function () {
          const problem = _this.validateInputs();
          if (problem !== undefined) {
            _this.setError(problem);
            return;
          }

          const model = internal.model;
          const targetModelId = internal.targetModelId;

          CloudStore.forScope(_this.nodeScope.modelScope).removeRelation({
            collection: internal.collectionId,
            objectId: model.getId(),
            key: internal.relationProperty,
            targetObjectId: targetModelId,
            targetClass: (_this.nodeScope.modelScope || Model).get(targetModelId)._class,
            success: function (response: Record<string, unknown>) {
              for (const _key in response) {
                model.set(_key, response[_key]);
              }

              // Successfully removed relation
              _this.sendSignalOnOutput('relationRemoved');
            },
            error: function (err: string) {
              _this.setError(err || 'Failed to remove relation.');
            }
          });
        });
      }
    }
  }
};

DbModelCRUDBase.addBaseInfo(AddDbModelRelationNodeDefinition, {
  includeRelations: true
});
DbModelCRUDBase.addModelId(AddDbModelRelationNodeDefinition);
DbModelCRUDBase.addRelationProperty(AddDbModelRelationNodeDefinition);

export = AddDbModelRelationNodeDefinition;
