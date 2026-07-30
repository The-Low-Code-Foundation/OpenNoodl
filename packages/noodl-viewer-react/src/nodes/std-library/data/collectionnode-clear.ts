import type { CollectionLike, NodeDefinitionOptions, NodeModule } from '@noodl/types';

import {
  addCollectionFailure,
  resolveCollectionId,
  setCollectionIdInput,
  type FailableCollectionInstance
} from './collection-failure';

/** `this` inside the Clear Array node. */
interface CollectionClearInstance extends FailableCollectionInstance {
  setCollectionID(id: string | undefined): void;
}

const CollectionClearNode: NodeDefinitionOptions = {
  name: 'CollectionClear',
  docs: 'https://docs.noodl.net/nodes/data/array/clear-array',
  displayNodeName: 'Clear Array',
  category: 'Data',
  usePortAsLabel: 'collectionId',
  color: 'data',
  inputs: {
    collectionId: {
      type: {
        name: 'string',
        identifierOf: 'CollectionName',
        identifierDisplayName: 'Array Ids'
      },
      displayName: 'Array Id',
      group: 'General',
      set: setCollectionIdInput
    },
    clear: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue(this: CollectionClearInstance) {
        this.scheduleAfterInputsHaveUpdated(() => {
          const collection = this._internal.collection;

          // NDA-004 §2. This was `collection.set([])` with no guard at all — the only node in
          // the family whose missing-array path was not silent but a **crash**: a `TypeError`
          // thrown out of a scheduled callback, from a node whose Array Id an author had simply
          // not filled in yet. Its two siblings at least returned.
          if (collection === undefined) {
            this._failNoCollection('clear');
            return;
          }

          this._clearCollectionFailure();
          collection.set([]);
          this.sendSignalOnOutput('modified');
        });
      }
    }
  },
  outputs: {
    modified: {
      group: 'Events',
      type: 'signal',
      displayName: 'Done'
    }
  },
  methods: {
    setCollectionID: function (this: CollectionClearInstance, id: string | undefined) {
      this.setCollection(resolveCollectionId(id));
    },
    setCollection: function (this: CollectionClearInstance, collection: CollectionLike | undefined) {
      this._internal.collection = collection;
    }
  }
};

const CollectionClearModule: NodeModule = {
  node: CollectionClearNode
};

addCollectionFailure(CollectionClearNode, 'clear-array');

export default CollectionClearModule;
