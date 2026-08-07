'use strict';

import Model = require('../../../model');
import { outcomeOutputs } from '../../../outcome';
import type { CollectionLike, NodeDefinitionOptions, NodeModule } from '@noodl/types';

import {
  addCollectionFailure,
  resolveCollectionId,
  setCollectionIdInput,
  type FailableCollectionInstance
} from './collection-failure';

/** `this` inside the Remove Object From Array node. */
interface CollectionRemoveInstance extends FailableCollectionInstance {
  setCollectionID(id: string | undefined): void;
}

const CollectionRemoveNode: NodeDefinitionOptions = {
  name: 'CollectionRemove',
  docs: 'https://docs.noodl.net/nodes/data/array/remove-from-array',
  displayNodeName: 'Remove Object From Array',
  category: 'Data',
  usePortAsLabel: 'collectionId',
  color: 'data',
  initialize: function () {},
  inputs: {
    collectionId: {
      type: {
        name: 'string',
        identifierOf: 'CollectionName',
        identifierDisplayName: 'Array Ids'
      },
      displayName: 'Array Id',
      description:
        'Id of the array to remove from; clearing it unbinds the node, and the next Do then fails ' +
        'rather than acting on a throwaway array',
      group: 'General',
      set: setCollectionIdInput
    },
    modifyId: {
      type: { name: 'string', allowConnectionsOnly: true },
      displayName: 'Object Id',
      description:
        'Id of the object to remove; the record must already have been loaded, or the removal is ' +
        'refused instead of quietly doing nothing',
      group: 'Modify',
      set: function (this: CollectionRemoveInstance, value: string) {
        this._internal.modifyId = value;
      }
    },
    remove: {
      displayName: 'Do',
      description: 'Removes the object named by Object Id from the array, or fires Failure if either cannot be resolved',
      group: 'Actions',
      valueChangedToTrue: function (this: CollectionRemoveInstance) {
        const internal = this._internal;
        const outcome = this.beginOutcome();

        this.scheduleAfterInputsHaveUpdated(() => {
          this._clearCollectionFailure();

          // NDA-004 §2. These were two bare `return`s — the most complete silence in the
          // family. Insert at least warned the editor; this one told nobody, anywhere, in any
          // runtime, and emitted no `Done` either, so the only evidence available to an author
          // was that the array had not changed. Same shape as `Add Record Relation` and
          // `Remove Record Relation`, fixed in the first §2 batch.
          if (internal.modifyId === undefined) {
            this._failNoObjectId(outcome, 'remove');
            return;
          }

          if (internal.collection === undefined) {
            this._failNoCollection(outcome, 'remove');
            return;
          }

          // NDA-012 (Data). `Model.get` mints on read, so an Id nothing has loaded produces a
          // fresh object that is by construction not in the array — the removal is a guaranteed
          // no-op and `Done` below was reporting it as success. See `_failUnknownObjectId`.
          // CWF-008: `exists` and `get` must ask the same registry, or in the cloud the guard
          // below would answer for one table and the removal act on another.
          const models = this.nodeScope.modelScope || Model;
          if (!models.exists(internal.modifyId)) {
            this._failUnknownObjectId(outcome, 'remove', internal.modifyId);
            return;
          }

          /**
           * ERG-001 §0 found a **third** path here that the task spec's own §2 note does not
           * cover, and the distinction is what makes `Unchanged` a real category rather than a
           * softer `Failure`:
           *
           * - an id nothing has loaded is **impossible** to remove (the guard above, DA-vi's
           *   verdict) — `Failure`;
           * - a loaded object that simply is not a member of *this* array is **redundant**.
           *   `Array.prototype.remove` is `if (idx !== -1) …` (`collection.ts:611`), so it is a
           *   silent no-op that the node reported as `Done` — `Unchanged`.
           */
          const model = models.get(internal.modifyId);
          const wasMember = internal.collection.contains(model);
          internal.collection.remove(model);
          this.reportOutcome(outcome, wasMember ? 'done' : 'unchanged');
        });
      }
    }
  },
  outputs: {
    ...outcomeOutputs({
      done: 'Fires once the object has been removed from the array',
      unchanged: 'Fires when the object was not in the array, so nothing was removed',
      failure: 'Fires when the array or the object could not be resolved, so nothing was changed'
    })
  },
  prototypeExtensions: {
    setCollectionID: function (this: CollectionRemoveInstance, id: string | undefined) {
      this.setCollection(resolveCollectionId(id));
    },
    setCollection: function (this: CollectionRemoveInstance, collection: CollectionLike | undefined) {
      this._internal.collection = collection;
    }
  }
};

const CollectionRemoveModule: NodeModule = {
  node: CollectionRemoveNode
};

addCollectionFailure(CollectionRemoveNode, 'remove-from-array');

export = CollectionRemoveModule;
