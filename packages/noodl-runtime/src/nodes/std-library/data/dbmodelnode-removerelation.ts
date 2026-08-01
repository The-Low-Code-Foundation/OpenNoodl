'use strict';

import type { ModelModule } from '@noodl/types';

import type { DbCrudBaseInstance, DbCrudNodeModule, DbModelIdInstance, RelationPropertyInstance } from './crud-mixins';

import ModelImport = require('../../../model');
import DbModelCRUDBase = require('./dbmodelcrudbase');

const Model = ModelImport as unknown as ModelModule;

/** `this` inside Remove Record Relation. */
interface RemoveRelationInstance extends DbCrudBaseInstance, DbModelIdInstance, RelationPropertyInstance {
  _internal: DbCrudBaseInstance['_internal'] & DbModelIdInstance['_internal'] & RelationPropertyInstance['_internal'];
  /** NDA-004 §2: returns the first missing input, or `undefined` when the node can act. */
  validateInputs(): string | undefined;
  /** The target record's class, or `undefined` when nothing has loaded that record. */
  targetCollection(): string | undefined;
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
        } else if (this.targetCollection() === undefined) {
          // NDA-012 (Data) — the twin of the Add sibling's check, and it matters here for the
          // same reason: `Model.get` mints a record on read, so an id that never came from a
          // query resolves to a record with no `_class`, and the wire sends a class-less
          // Pointer. On Parse that answers `107` while writing `Relation<undefined>` into the
          // class schema, which then refuses every correct write. See `-addrelation` for the
          // measurement.
          problem =
            `The target record "${this._internal.targetModelId}" has not been loaded, so its class is unknown. ` +
            'Connect the Id from a Query Records / Record node rather than from a raw string, or the relation ' +
            'cannot be written.';
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
      /** One reader of the target record's class — see the twin in `-addrelation`. */
      targetCollection: function (this: RemoveRelationInstance): string | undefined {
        const targetModelId = this._internal.targetModelId;
        if (targetModelId === undefined) return undefined;
        return (this.nodeScope.modelScope || Model).get(targetModelId)._class;
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

          // BCN-004 step 5: the store the `Backend` input names. This node shares
          // `addBaseInfo` with the Record family, so it gets the picker port; resolving it
          // here is what keeps the port honest.
          //
          // BCN-005 made this work on the three REST backends too. Where it cannot —
          // a relation the synced schema does not describe, because relation metadata
          // is admin-only on all three — the adapter refuses with a sentence naming
          // the field and the fix, and it lands on `setError` below.
          const cloudstore = _this.cloudStore();
          if (!cloudstore) return;

          cloudstore.removeRelation({
            collection: internal.collectionId,
            objectId: model.getId(),
            key: internal.relationProperty,
            targetObjectId: targetModelId,
            // BCN-005 renamed this on the contract: `targetCollection` is the neutral
            // name, matching `collection` two lines up, and `targetClass` stays a
            // deprecated alias for `Noodl.Records`'s public `targetClassName`.
            //
            // `validateInputs` has already refused the `undefined` case.
            targetCollection: _this.targetCollection(),
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
