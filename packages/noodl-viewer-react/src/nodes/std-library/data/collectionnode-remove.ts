'use strict';

import Model from '@noodl/runtime/src/model';
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
  shortDesc: 'Takes an object, named by its id, out of a shared array.',
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

        this.scheduleAfterInputsHaveUpdated(() => {
          this._clearCollectionFailure();

          // NDA-004 §2. These were two bare `return`s — the most complete silence in the
          // family. Insert at least warned the editor; this one told nobody, anywhere, in any
          // runtime, and emitted no `Done` either, so the only evidence available to an author
          // was that the array had not changed. Same shape as `Add Record Relation` and
          // `Remove Record Relation`, fixed in the first §2 batch.
          if (internal.modifyId === undefined) {
            this._failNoObjectId('remove');
            return;
          }

          if (internal.collection === undefined) {
            this._failNoCollection('remove');
            return;
          }

          // NDA-012 (Data). `Model.get` mints on read, so an Id nothing has loaded produces a
          // fresh object that is by construction not in the array — the removal is a guaranteed
          // no-op and `Done` below was reporting it as success. See `_failUnknownObjectId`.
          if (!Model.exists(internal.modifyId)) {
            this._failUnknownObjectId('remove', internal.modifyId);
            return;
          }

          const model = Model.get(internal.modifyId);
          internal.collection.remove(model);
          this.sendSignalOnOutput('modified');
        });
      }
    }
  },
  outputs: {
    modified: {
      group: 'Events',
      type: 'signal',
      displayName: 'Done',
      description: 'Fires once the object is no longer in the array'
    }
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

export default CollectionRemoveModule;
