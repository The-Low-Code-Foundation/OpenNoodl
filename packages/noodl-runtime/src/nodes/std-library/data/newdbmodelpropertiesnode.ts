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
import { reportOutcomes } from '../../../outcome';
import DbModelCRUDBase = require('./dbmodelcrudbase');

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
    // BCN-010 step 3 — the label, not the type name.
    //
    // `NewDbModelProperties` stays exactly as it is: type names appear in every
    // saved project and renaming one churns all of them, while a label appears
    // only in the picker and on an unlabelled node's titlebar. The two are easy
    // to conflate in a file that carries both, which is why this comment is here
    // and not in a commit message.
    //
    // ⚠️ **This creates a creatable label collision, deliberately and visibly**,
    // with `noodl.byob.CreateRecord` — which already reads "Create Record". So
    // does the Update Record relabel, against `noodl.byob.UpdateRecord`, and
    // "Delete Record" was already colliding before this task started. Three
    // pending collisions, all closed by the same four type deletions.
    //
    // The spec's precondition for this rename is *"with the BYOB types gone"*
    // and they are **not** gone: BCN-004 step 7 is blocked on Directus system
    // collections, which `RestDataAdapter` cannot yet reach. The alternative —
    // leaving the padding until the deletion lands — puts the rename in someone
    // else's commit as a thing to remember. Instead all three are enumerated in
    // `duplicate-labels.test.js`, which fails if a *fourth* appears and fails
    // again when the types go and the list is not emptied.
    displayName: 'Create Record',
    usePortAsLabel: 'collectionName',
    inputs: {
      store: {
        displayName: 'Do',
        group: 'Actions',
        description: 'Creates a record in the chosen Class from the property inputs and sends it to the backend',
        valueChangedToTrue: function (this: NewDbModelPropertiesInstance) {
          this.storageInsert();
        }
      },
      sourceObjectId: {
        type: { name: 'string', allowConnectionsOnly: true },
        displayName: 'Source Object Id',
        group: 'General',
        description:
          'Id of an existing record whose properties seed the new one before the property inputs are applied over them; leave blank to start empty',
        set: function (this: NewDbModelPropertiesInstance, value: unknown) {
          if (value instanceof Model) value = value.getId(); // Can be passed as model as well
          this._internal.sourceObjectId = value as string; // Wait to fetch data
        }
      }
    },
    // ERG-001 §4: the outcome ports are declared once in `dbmodelcrudbase.addBaseInfo`, for the
    // whole family. `created` — one of §0.2 Result 2's four spellings of a single displayed
    // "Done" — is gone; the sentence it carried is now the `done` option at the bottom of this
    // file.
    outputs: {},
    methods: {
      storageInsert: function (this: NewDbModelPropertiesInstance) {
        const internal = this._internal;

        // ERG-001 §4. Minted here, in the only method the `Do` port reaches, and handed to the
        // pre-flight check so a refusal settles *this* invocation rather than opening a second
        // one behind its back. It joins the pending batch only once the check has passed.
        const token = this.beginOutcome();
        if (!this.checkWarningsBeforeCloudOp([token])) return;
        this.pendingOutcomes('Insert').push(token);

        this.scheduleOnce('StorageInsert', () => {
          // Drained before the request goes out: a second `Do` arriving mid-flight owns its own
          // batch rather than being settled by this request's answer.
          const tokens = this.takeOutcomes('Insert');

          const initValues = Object.assign(
            {},
            internal.sourceObjectId ? (this.nodeScope.modelScope || Model).get(internal.sourceObjectId).data : {},
            internal.inputValues
          );

          // BCN-004 step 5: the store the `Backend` input names, not the singleton. With
          // nothing selected this resolves to exactly the store `forScope` used to return.
          const cloudstore = this.cloudStore(tokens);
          if (!cloudstore) return;

          cloudstore.create({
            collection: internal.collectionId,
            data: initValues,
            acl: this._getACL(),
            success: (data: Record<string, unknown>) => {
              // Successfully created
              // `_fromJSON` is an instance field the constructor binds to the scope, not the
              // static of the same name — so this resolves the new record into *this* store.
              const m = cloudstore._fromJSON(data, internal.collectionId);
              // `setModel` flags `id` dirty; the outcome goes last, so a graph reading `Id` on
              // `Done` already has the Id the backend assigned.
              this.setModel(m);
              reportOutcomes(this, tokens, 'done');
            },
            error: (err: string) => {
              this.setError(err || 'Failed to insert.', tokens);
            }
          });
        });
      }
    }
  }
};

DbModelCRUDBase.addBaseInfo(NewDbModelPropertiedNodeDefinition, {
  done: 'Fires once the backend has stored the new record and Id carries the Id it was given'
});
DbModelCRUDBase.addModelId(NewDbModelPropertiedNodeDefinition, {
  includeOutputs: true
});
DbModelCRUDBase.addInputProperties(NewDbModelPropertiedNodeDefinition);
DbModelCRUDBase.addAccessControl(NewDbModelPropertiedNodeDefinition);

export = NewDbModelPropertiedNodeDefinition;
