'use strict';

import type { ModelModule } from '@noodl/types';

import type {
  AccessControlInstance,
  DbCrudBaseInstance,
  DbCrudNodeModule,
  DbInputPropertiesInstance,
  DbModelIdInstance
} from './crud-mixins';

import ModelImport = require('../../../model');
import DbModelCRUDBase = require('./dbmodelcrudbase');
import CloudStore = require('../../../api/cloudstore');

const Model = ModelImport as unknown as ModelModule;

/** `this` inside Create New Record. */
interface NewDbModelPropertiesInstance
  extends DbCrudBaseInstance,
    DbModelIdInstance,
    DbInputPropertiesInstance,
    AccessControlInstance {
  _internal: DbCrudBaseInstance['_internal'] &
    DbModelIdInstance['_internal'] &
    DbInputPropertiesInstance['_internal'] &
    AccessControlInstance['_internal'] & {
      /** Seeds the new record from an existing one's data. */
      sourceObjectId?: string;
    };
  storageInsert(): void;
}

const NewDbModelPropertiedNodeDefinition: DbCrudNodeModule = {
  node: {
    name: 'NewDbModelProperties',
    docs: 'https://docs.noodl.net/nodes/data/cloud-data/create-new-record',
    displayName: 'Create New Record',
    usePortAsLabel: 'collectionName',
    inputs: {
      store: {
        displayName: 'Do',
        group: 'Actions',
        valueChangedToTrue: function (this: NewDbModelPropertiesInstance) {
          this.storageInsert();
        }
      },
      sourceObjectId: {
        type: { name: 'string', allowConnectionsOnly: true },
        displayName: 'Source Object Id',
        group: 'General',
        set: function (this: NewDbModelPropertiesInstance, value: unknown) {
          if (value instanceof Model) value = value.getId(); // Can be passed as model as well
          this._internal.sourceObjectId = value as string; // Wait to fetch data
        }
      }
    },
    outputs: {
      created: {
        type: 'signal',
        displayName: 'Success',
        group: 'Events'
      }
    },
    methods: {
      storageInsert: function (this: NewDbModelPropertiesInstance) {
        const internal = this._internal;

        if (!this.checkWarningsBeforeCloudOp()) return;

        this.scheduleOnce('StorageInsert', () => {
          const initValues = Object.assign(
            {},
            internal.sourceObjectId ? (this.nodeScope.modelScope || Model).get(internal.sourceObjectId).data : {},
            internal.inputValues
          );

          const cloudstore = CloudStore.forScope(this.nodeScope.modelScope);
          cloudstore.create({
            collection: internal.collectionId,
            data: initValues,
            acl: this._getACL(),
            success: (data: Record<string, unknown>) => {
              // Successfully created
              // `_fromJSON` is an instance field the constructor binds to the scope, not the
              // static of the same name — so this resolves the new record into *this* store.
              const m = cloudstore._fromJSON(data, internal.collectionId);
              this.setModel(m);
              this.sendSignalOnOutput('created');
            },
            error: (err: string) => {
              this.setError(err || 'Failed to insert.');
            }
          });
        });
      }
    }
  }
};

DbModelCRUDBase.addBaseInfo(NewDbModelPropertiedNodeDefinition);
DbModelCRUDBase.addModelId(NewDbModelPropertiedNodeDefinition, {
  includeOutputs: true
});
DbModelCRUDBase.addInputProperties(NewDbModelPropertiedNodeDefinition);
DbModelCRUDBase.addAccessControl(NewDbModelPropertiedNodeDefinition);

export = NewDbModelPropertiedNodeDefinition;
