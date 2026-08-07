'use strict';

import type { ModelLike } from '@noodl/types';

import type {
  AccessControlInstance,
  DbCrudBaseInstance,
  DbCrudNodeModule,
  DbInputPropertiesInstance,
  DbModelIdInstance
} from './crud-mixins';

import { reportOutcomes } from '../../../outcome';
import DbModelCRUDBase = require('./dbmodelcrudbase');

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
    // BCN-010 step 3. Label only — `SetDbModelProperties` is unchanged.
    // "Update Record" is the verb the other five backends use and the one the
    // BYOB family already used; "Set Record Properties" described the mechanism.
    displayNodeName: 'Update Record',
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
        description:
          'Writes the property inputs onto the record named by Id, and on to the backend unless Store to is Local only',
        valueChangedToTrue: function (this: SetDbModelPropertiesInstance) {
          if (this._internal.storeType === undefined || this._internal.storeType === 'cloud') this.scheduleSave();
          else this.scheduleStore();
        }
      },
      storeProperties: {
        displayName: 'Properties to  store',
        group: 'General',
        description:
          'Whether to send only the properties wired on this node or every property the record holds; not offered when Store to is Local only',
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
        description:
          'Whether the change is sent to the backend as well as applied to the in-memory record, or only held locally',
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
    // ERG-001 §4: declared once in `dbmodelcrudbase.addBaseInfo` for the whole family; `stored`
    // was one of §0.2 Result 2's four spellings of a single displayed "Done".
    outputs: {},
    methods: {
      scheduleSave: function (this: SetDbModelPropertiesInstance) {
        const _this = this;
        const internal = this._internal;

        // ERG-001 §4. `Do` reaches one of two methods depending on `Store to`, and both are
        // invocations of the same port — so both mint, and NDA-004 §2's finding (the two
        // branches disagreeing about whether a missing Id is reportable) cannot recur as the
        // two branches disagreeing about whether an outcome is.
        const token = this.beginOutcome();
        if (!this.checkWarningsBeforeCloudOp([token])) return;
        this.pendingOutcomes('Save').push(token);

        this.scheduleOnce('StorageSave', function () {
          const tokens = _this.takeOutcomes('Save');

          if (!internal.model) {
            _this.setError('Missing Record Id', tokens);
            return;
          }

          const model = internal.model;
          for (const key in internal.inputValues) {
            model.set(key, internal.inputValues[key], { resolve: true });
          }

          // BCN-004 step 5: the store the `Backend` input names, not the singleton.
          const cloudstore = _this.cloudStore(tokens);
          if (!cloudstore) return;

          cloudstore.save({
            collection: internal.collectionId,
            objectId: model.getId(), // Get the objectId part of the model id
            data: internal.storeProperties === 'all' ? model.data : internal.inputValues, // Only store input values by default, if not explicitly specified
            acl: _this._getACL(),
            success: function (response: Record<string, unknown>) {
              for (const key in response) {
                model.set(key, response[key]);
              }

              reportOutcomes(_this, tokens, 'done');
            },
            error: function (err: string) {
              _this.setError(err || 'Failed to save.', tokens);
            }
          });
        });
      },
      scheduleStore: function (this: SetDbModelPropertiesInstance) {
        // ⚠️ ERG-001 §4: minted **before** the guard, the shape `login.ts` established. The
        // guard exists to coalesce the *work* — two presses in one pass do one write — and
        // dropping the second press's outcome with it would be Rule 1 broken by an optimisation.
        this.pendingOutcomes('Store').push(this.beginOutcome());

        if (this.hasScheduledStore) return;
        this.hasScheduledStore = true;

        const internal = this._internal;
        this.scheduleAfterInputsHaveUpdated(() => {
          this.hasScheduledStore = false;
          const tokens = this.takeOutcomes('Store');

          // NDA-004 §2: the two branches of `Store Type` disagreed about this. `scheduleSave`
          // (cloud) has always answered a missing Id with `setError('Missing Record Id')`;
          // this one, the local branch of the *same node*, returned silently. Same node, same
          // mistake by the author, and whether they heard about it depended on an enum.
          if (!internal.model) {
            this.setError('Missing Record Id', tokens);
            return;
          }

          for (const i in internal.inputValues) {
            (internal.model as ModelLike).set(i, internal.inputValues[i], { resolve: true });
          }
          reportOutcomes(this, tokens, 'done');
        });
      }
    }
  }
};

DbModelCRUDBase.addBaseInfo(SetDbModelPropertiedNodeDefinition, {
  done: 'Fires once the record has been updated, waiting for the backend to answer unless Store to is Local only'
});
DbModelCRUDBase.addModelId(SetDbModelPropertiedNodeDefinition);
DbModelCRUDBase.addInputProperties(SetDbModelPropertiedNodeDefinition);
DbModelCRUDBase.addAccessControl(SetDbModelPropertiedNodeDefinition);

export = SetDbModelPropertiedNodeDefinition;
