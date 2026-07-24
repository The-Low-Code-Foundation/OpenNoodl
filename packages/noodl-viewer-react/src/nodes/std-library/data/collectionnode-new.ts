'use strict';

import CollectionImport from '@noodl/runtime/src/collection';
import type { CollectionLike, CollectionModule, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

const Collection = CollectionImport as CollectionModule;

/** `this` inside the Create New Array node. */
interface CollectionNewInstance extends NodeInstance {
  _internal: {
    collection?: CollectionLike;
    /** Whatever arrived on `items` — an array, or another node's collection. */
    sourceCollection?: CollectionLike;
  };
  hasScheduledNew?: boolean;
  setCollection(collection: CollectionLike): void;
  scheduleNew(): void;
}

const CollectionNewNode: NodeDefinitionOptions = {
  name: 'CollectionNew',
  docs: 'https://docs.noodl.net/nodes/data/array/create-new-array',
  displayNodeName: 'Create New Array',
  shortDesc: 'A collection of models, mainly used together with a For Each Node.',
  category: 'Data',
  color: 'data',
  initialize: function () {},
  inputs: {
    new: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue: function (this: CollectionNewInstance) {
        this.scheduleNew();
      }
    },
    items: {
      type: 'array',
      group: 'General',
      displayName: 'Items',
      set: function (this: CollectionNewInstance, value: CollectionLike) {
        this._internal.sourceCollection = value;
      }
    }
  },
  outputs: {
    id: {
      type: 'string',
      displayName: 'Id',
      group: 'General',
      getter: function (this: CollectionNewInstance) {
        // DEBT-006: the old fallback read `_internal.collectionId`, which nothing
        // could assign — the node has no `collectionId` input (PLAT-003 NOTES §17.7 #5).
        return this._internal.collection ? this._internal.collection.getId() : undefined;
      }
    },
    created: {
      group: 'Events',
      type: 'signal',
      displayName: 'Done'
    }
  },
  prototypeExtensions: {
    setCollection: function (this: CollectionNewInstance, collection: CollectionLike) {
      this._internal.collection = collection;
      this.flagOutputDirty('id');
    },
    scheduleNew: function (this: CollectionNewInstance) {
      if (this.hasScheduledNew) return;
      this.hasScheduledNew = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledNew = false;

        const collection = Collection.get();
        if (this._internal.sourceCollection !== undefined) collection.set(this._internal.sourceCollection);

        this.setCollection(collection);

        this.sendSignalOnOutput('created');
      });
    }
  }
};

const CollectionNewModule: NodeModule = {
  node: CollectionNewNode
};

export default CollectionNewModule;
