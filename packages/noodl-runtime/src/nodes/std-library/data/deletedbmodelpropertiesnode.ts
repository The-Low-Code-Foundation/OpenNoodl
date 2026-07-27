'use strict';

import type { DbCrudBaseInstance, DbCrudNodeModule, DbModelIdInstance } from './crud-mixins';

import DbModelCRUDBase = require('./dbmodelcrudbase');
import CloudStore = require('../../../api/cloudstore');

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
    shortDesc:
      'Stores any amount of properties and can be used standalone or together with Collections and For Each nodes.',
    inputs: {
      store: {
        displayName: 'Do',
        group: 'Actions',
        valueChangedToTrue: function (this: DeleteDbModelPropertiesInstance) {
          this.storageDelete();
        }
      }
    },
    outputs: {
      deleted: {
        type: 'signal',
        displayName: 'Success',
        group: 'Events'
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
          // project running under a scoped store.
          CloudStore.forScope(_this.nodeScope.ModelScope).delete({
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
