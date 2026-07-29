'use strict';

import type { ModelLike } from '@noodl/types';

import type {
  AccessControlInstance,
  DbCrudBaseInstance,
  DbCrudNodeModule,
  DbInputPropertiesInstance,
  DbModelIdInstance
} from './crud-mixins';

import DbModelCRUDBase = require('./dbmodelcrudbase');
import CloudStore = require('../../../api/cloudstore');

/**
 * `this` inside Set Record Properties — the intersection of every mixin the file applies.
 *
 * `storeType` is what makes this node two nodes in one: `'cloud'` writes through to the
 * backend, `'local'` only updates the in-memory record.
 */
interface SetDbModelPropertiesInstance
  extends DbCrudBaseInstance,
    DbModelIdInstance,
    DbInputPropertiesInstance,
    AccessControlInstance {
  _internal: DbCrudBaseInstance['_internal'] &
    DbModelIdInstance['_internal'] &
    DbInputPropertiesInstance['_internal'] &
    AccessControlInstance['_internal'] & {
      storeType?: 'cloud' | 'local';
      storeProperties?: 'specified' | 'all';
    };
  /** On the instance rather than in `_internal` — guards {@link scheduleStore}. */
  hasScheduledStore?: boolean;
  scheduleSave(): void;
  scheduleStore(): void;
}

const SetDbModelPropertiedNodeDefinition: DbCrudNodeModule = {
  node: {
    name: 'SetDbModelProperties',
    docs: 'https://docs.noodl.net/nodes/data/cloud-data/set-record-properties',
    displayNodeName: 'Set Record Properties',
    usePortAsLabel: 'collectionName',
    dynamicports: [
      {
        name: 'conditionalports/extended',
        condition: 'storeType = cloud OR storeType NOT SET',
        inputs: ['storeProperties']
      }
    ],
    inputs: {
      store: {
        displayName: 'Do',
        group: 'Actions',
        valueChangedToTrue: function (this: SetDbModelPropertiesInstance) {
          if (this._internal.storeType === undefined || this._internal.storeType === 'cloud') this.scheduleSave();
          else this.scheduleStore();
        }
      },
      storeProperties: {
        displayName: 'Properties to  store',
        group: 'General',
        type: {
          name: 'enum',
          enums: [
            { label: 'Only specified', value: 'specified' },
            { label: 'All', value: 'all' }
          ]
        },
        default: 'specified',
        set: function (this: SetDbModelPropertiesInstance, value: unknown) {
          this._internal.storeProperties = value as 'specified' | 'all';
        }
      },
      storeType: {
        displayName: 'Store to',
        group: 'General',
        type: {
          name: 'enum',
          enums: [
            { label: 'Cloud and local', value: 'cloud' },
            { label: 'Local only', value: 'local' }
          ]
        },
        default: 'cloud',
        set: function (this: SetDbModelPropertiesInstance, value: unknown) {
          this._internal.storeType = value as 'cloud' | 'local';
        }
      }
    },
    outputs: {
      stored: {
        type: 'signal',
        displayName: 'Success',
        group: 'Events'
      }
    },
    methods: {
      scheduleSave: function (this: SetDbModelPropertiesInstance) {
        const _this = this;
        const internal = this._internal;

        if (!this.checkWarningsBeforeCloudOp()) return;

        this.scheduleOnce('StorageSave', function () {
          if (!internal.model) {
            _this.setError('Missing Record Id');
            return;
          }

          const model = internal.model;
          for (const key in internal.inputValues) {
            model.set(key, internal.inputValues[key], { resolve: true });
          }

          CloudStore.forScope(_this.nodeScope.modelScope).save({
            collection: internal.collectionId,
            objectId: model.getId(), // Get the objectId part of the model id
            data: internal.storeProperties === 'all' ? model.data : internal.inputValues, // Only store input values by default, if not explicitly specified
            acl: _this._getACL(),
            success: function (response: Record<string, unknown>) {
              for (const key in response) {
                model.set(key, response[key]);
              }

              _this.sendSignalOnOutput('stored');
            },
            error: function (err: string) {
              _this.setError(err || 'Failed to save.');
            }
          });
        });
      },
      scheduleStore: function (this: SetDbModelPropertiesInstance) {
        if (this.hasScheduledStore) return;
        this.hasScheduledStore = true;

        const internal = this._internal;
        this.scheduleAfterInputsHaveUpdated(() => {
          this.hasScheduledStore = false;

          // NDA-004 §2: the two branches of `Store Type` disagreed about this. `scheduleSave`
          // (cloud) has always answered a missing Id with `setError('Missing Record Id')`;
          // this one, the local branch of the *same node*, returned silently. Same node, same
          // mistake by the author, and whether they heard about it depended on an enum.
          if (!internal.model) {
            this.setError('Missing Record Id');
            return;
          }

          for (const i in internal.inputValues) {
            (internal.model as ModelLike).set(i, internal.inputValues[i], { resolve: true });
          }
          this.sendSignalOnOutput('stored');
        });
      }
    }
  }
};

DbModelCRUDBase.addBaseInfo(SetDbModelPropertiedNodeDefinition);
DbModelCRUDBase.addModelId(SetDbModelPropertiedNodeDefinition);
DbModelCRUDBase.addInputProperties(SetDbModelPropertiedNodeDefinition);
DbModelCRUDBase.addAccessControl(SetDbModelPropertiedNodeDefinition);

export = SetDbModelPropertiedNodeDefinition;
