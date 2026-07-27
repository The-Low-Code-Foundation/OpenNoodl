'use strict';

import type { ModelModule } from '@noodl/types';

import type { DbCrudBaseInstance, DbCrudNodeModule, DbModelIdInstance, RelationPropertyInstance } from './crud-mixins';

import ModelImport = require('../../../model');
import DbModelCRUDBase = require('./dbmodelcrudbase');
import CloudStore = require('../../../api/cloudstore');

const Model = ModelImport as unknown as ModelModule;

/** `this` inside Add Record Relation. */
interface AddRelationInstance extends DbCrudBaseInstance, DbModelIdInstance, RelationPropertyInstance {
  _internal: DbCrudBaseInstance['_internal'] & DbModelIdInstance['_internal'] & RelationPropertyInstance['_internal'];
  validateInputs(): void;
  scheduleAddRelation(): void;
}

const AddDbModelRelationNodeDefinition: DbCrudNodeModule = {
  node: {
    name: 'AddDbModelRelation',
    docs: 'https://docs.noodl.net/nodes/data/cloud-data/add-record-relation',
    displayNodeName: 'Add Record Relation',
    usePortAsLabel: 'collectionName',
    // shortDesc: "Stores any amount of properties and can be used standalone or together with Collections and For Each nodes.",
    inputs: {
      store: {
        displayName: 'Do',
        group: 'Actions',
        valueChangedToTrue: function (this: AddRelationInstance) {
          this.scheduleAddRelation();
        }
      }
    },
    outputs: {
      relationAdded: {
        type: 'signal',
        displayName: 'Success',
        group: 'Events'
      }
    },
    methods: {
      validateInputs: function (this: AddRelationInstance) {
        if (!this.context.editorConnection) return;

        const _warning = (message: string) => {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'add-relation', {
            message
          });
        };

        if (this._internal.collectionId === undefined) {
          _warning('No class specified');
        } else if (this._internal.relationProperty === undefined) {
          _warning('No relation property specified');
        } else if (this._internal.targetModelId === undefined) {
          _warning('No target record Id (the record to add a relation to) specified');
        } else if (this._internal.model === undefined) {
          _warning('No record Id specified (the record that should get the relation)');
        } else {
          this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'add-relation');
        }
      },
      scheduleAddRelation: function (this: AddRelationInstance) {
        const _this = this;
        const internal = this._internal;

        this.scheduleOnce('StorageAddRelation', function () {
          _this.validateInputs();

          if (!internal.model) return;
          const model = internal.model;

          const targetModelId = internal.targetModelId;
          if (targetModelId === undefined) return;

          CloudStore.forScope(_this.nodeScope.modelScope).addRelation({
            collection: internal.collectionId,
            objectId: model.getId(),
            key: internal.relationProperty,
            targetObjectId: targetModelId,
            targetClass: (_this.nodeScope.modelScope || Model).get(targetModelId)._class,
            success: function (response: Record<string, unknown>) {
              for (const _key in response) {
                model.set(_key, response[_key]);
              }

              // Successfully added relation
              _this.sendSignalOnOutput('relationAdded');
            },
            error: function (err: string) {
              _this.setError(err || 'Failed to add relation.');
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
