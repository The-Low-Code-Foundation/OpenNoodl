'use strict';

import type { ModelModule } from '@noodl/types';

import type { DbCrudBaseInstance, DbCrudNodeModule, DbModelIdInstance, RelationPropertyInstance } from './crud-mixins';

import ModelImport = require('../../../model');
import DbModelCRUDBase = require('./dbmodelcrudbase');

const Model = ModelImport as unknown as ModelModule;

/** `this` inside Add Record Relation. */
interface AddRelationInstance extends DbCrudBaseInstance, DbModelIdInstance, RelationPropertyInstance {
  _internal: DbCrudBaseInstance['_internal'] & DbModelIdInstance['_internal'] & RelationPropertyInstance['_internal'];
  /** NDA-004 §2: returns the first missing input, or `undefined` when the node can act. */
  validateInputs(): string | undefined;
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
      /**
       * The first thing missing, or `undefined` when the node is ready to act.
       *
       * NDA-004 §2 — this used to `return` immediately without an `editorConnection`, so
       * outside the editor it validated *nothing*, and the caller then hit two bare `return`s.
       * A deployed Add Record Relation with an unset property therefore did nothing at all and
       * said nothing at all. It still writes the same editor warning it always did; what is
       * new is that it also hands the verdict back, so the caller can fail properly.
       */
      validateInputs: function (this: AddRelationInstance): string | undefined {
        let problem: string | undefined;

        if (this._internal.collectionId === undefined) {
          problem = 'No class specified';
        } else if (this._internal.relationProperty === undefined) {
          problem = 'No relation property specified';
        } else if (this._internal.targetModelId === undefined) {
          problem = 'No target record Id (the record to add a relation to) specified';
        } else if (this._internal.model === undefined) {
          problem = 'No record Id specified (the record that should get the relation)';
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
      scheduleAddRelation: function (this: AddRelationInstance) {
        const _this = this;
        const internal = this._internal;

        this.scheduleOnce('StorageAddRelation', function () {
          // One exit for every "cannot act" case, replacing two silent `return`s that between
          // them covered the same conditions `validateInputs` already knew about.
          const problem = _this.validateInputs();
          if (problem !== undefined) {
            _this.setError(problem);
            return;
          }

          const model = internal.model;
          const targetModelId = internal.targetModelId;

          // BCN-004 step 5: the store the `Backend` input names. This node shares
          // `addBaseInfo` with the Record family, so it gets the picker port; resolving it
          // here is what keeps the port honest. A REST backend refuses relation editing
          // with the descriptor's own sentence (BCN-005 owns making it work).
          const cloudstore = _this.cloudStore();
          if (!cloudstore) return;

          cloudstore.addRelation({
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
