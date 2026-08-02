'use strict';

import type { ModelScopeLike } from '@noodl/types';

import type { DbCrudBaseInstance, DbCrudNodeModule, DbModelIdInstance } from './crud-mixins';

import { reportOutcomes } from '../../../outcome';
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
    // ERG-001 §4: declared once in `dbmodelcrudbase.addBaseInfo` for the whole family.
    outputs: {},
    methods: {
      storageDelete: function (this: DeleteDbModelPropertiesInstance) {
        const _this = this;
        const internal = this._internal;

        // ERG-001 §4 — see `newdbmodelpropertiesnode` for why the token is minted here and
        // joins the batch only after the pre-flight check.
        const token = this.beginOutcome();
        if (!this.checkWarningsBeforeCloudOp([token])) return;
        this.pendingOutcomes('Delete').push(token);

        this.scheduleOnce('StorageDelete', function () {
          const tokens = _this.takeOutcomes('Delete');

          if (!internal.model) {
            _this.setError('Missing Record Id', tokens);
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
          const cloudstore = _this.cloudStoreForScope(_this.nodeScope.ModelScope as ModelScopeLike, tokens);
          if (!cloudstore) return;

          cloudstore.delete({
            collection: internal.collectionId,
            objectId: internal.model.getId(), // Get the objectId part of the model id,
            success: function () {
              internal.model.notify('delete'); // Notify that this model has been deleted
              reportOutcomes(_this, tokens, 'done');
            },
            error: function (err: string) {
              _this.setError(err || 'Failed to delete.', tokens);
            }
          });
        });
      }
    }
  }
};

DbModelCRUDBase.addBaseInfo(DeleteDbModelPropertiedNodeDefinition, {
  includeInputProperties: false,
  done: 'Fires once the backend has deleted the record and everything bound to it has been told that it is gone'
});
DbModelCRUDBase.addModelId(DeleteDbModelPropertiedNodeDefinition);

export = DeleteDbModelPropertiedNodeDefinition;
