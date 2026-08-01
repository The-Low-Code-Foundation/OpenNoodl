'use strict';

import type { ModelScopeLike } from '@noodl/types';

import type { DbCrudBaseInstance, DbCrudNodeModule, DbModelIdInstance } from './crud-mixins';

import DbModelCRUDBase = require('./dbmodelcrudbase');

/** `this` inside Delete Record. Note it applies neither `addInputProperties` nor `addAccessControl`. */
interface DeleteDbModelPropertiesInstance extends DbCrudBaseInstance, DbModelIdInstance {
  _internal: DbCrudBaseInstance['_internal'] & DbModelIdInstance['_internal'];
  storageDelete(): void;
}

const DeleteDbModelPropertiedNodeDefinition: DbCrudNodeModule = {
  node: {
    name: 'DeleteDbModelProperties',
    docs: 'https://docs.noodl.net/nodes/data/cloud-data/delete-record',
    displayNodeName: 'Delete Record',
    // NDA-012 (Data): this used to carry Create Record's sentence verbatim — "Stores any
    // amount of properties…" — on the node that deletes one. A copy-paste, and the one
    // string in the definition that the picker shows an author before they commit to the node.
    shortDesc: 'Deletes a record from the backend, given its Id.',
    inputs: {
      store: {
        displayName: 'Do',
        group: 'Actions',
        description: 'Deletes the record named by Id from its Class in the backend',
        valueChangedToTrue: function (this: DeleteDbModelPropertiesInstance) {
          this.storageDelete();
        }
      }
    },
    outputs: {
      deleted: {
        type: 'signal',
        displayName: 'Success',
        group: 'Events',
        description:
          'Fires once the backend has deleted the record and everything bound to it has been told that it is gone'
      }
    },
    methods: {
      storageDelete: function (this: DeleteDbModelPropertiesInstance) {
        const _this = this;
        const internal = this._internal;

        if (!this.checkWarningsBeforeCloudOp()) return;

        this.scheduleOnce('StorageDelete', function () {
          if (!internal.model) {
            _this.setError('Missing Record Id');
            return;
          }

          // DEFECT (PLAT-003 NOTES §27.3), left verbatim: `ModelScope` — capital M. The
          // property is `modelScope`, as every sibling in this directory spells it, so this
          // reads `undefined` and `forScope` falls back to the process-wide store. Delete
          // Record therefore ignores the component's own record scope, unlike Save, Create,
          // Add Relation and Remove Relation. Fixing it is a behaviour change for any
          // project running under a scoped store. PLAT-003 slice 13 note: now that
          // `NodeScopeLike` is typed, the compiler *proves* it — `ModelScope` reaches the
          // index signature rather than the declared `modelScope`, so it is `unknown`. The
          // cast keeps the behaviour verbatim rather than quietly fixing it here.
          // BCN-004 step 5: the store the `Backend` input names, not the singleton. The
          // scope override above the comment is what keeps the defect verbatim.
          const cloudstore = _this.cloudStoreForScope(_this.nodeScope.ModelScope as ModelScopeLike);
          if (!cloudstore) return;

          cloudstore.delete({
            collection: internal.collectionId,
            objectId: internal.model.getId(), // Get the objectId part of the model id,
            success: function () {
              internal.model.notify('delete'); // Notify that this model has been deleted
              _this.sendSignalOnOutput('deleted');
            },
            error: function (err: string) {
              _this.setError(err || 'Failed to delete.');
            }
          });
        });
      }
    }
  }
};

DbModelCRUDBase.addBaseInfo(DeleteDbModelPropertiedNodeDefinition, {
  includeInputProperties: false
});
DbModelCRUDBase.addModelId(DeleteDbModelPropertiedNodeDefinition);

export = DeleteDbModelPropertiedNodeDefinition;
