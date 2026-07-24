'use strict';

import { Node } from '@noodl/runtime';
import CollectionImport from '@noodl/runtime/src/collection';
import type {
  CollectionLike,
  CollectionModule,
  InspectInfo,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

const Collection = CollectionImport as CollectionModule;

/** `this` inside the Array node. */
interface CollectionNodeInstance extends NodeInstance {
  _internal: {
    /** The collection this node owns and reports on. */
    collection?: CollectionLike;
    /** Latest id seen on the `collectionId` input, kept for the deferred `fetch`. */
    collectionId?: string;
    /** The collection connected to `items`, mirrored into {@link collection}. */
    sourceCollection?: CollectionLike;
    /** `items` as it arrived, before the scheduled copy runs. */
    pendingSourceCollection?: CollectionLike;
    collectionChangedCallback(): void;
    sourceCollectionChangedCallback(): void;
  };
  hasScheduledSetCollection?: boolean;
  hasScheduledStore?: boolean;
  hasScheduledCopyItems?: boolean;
  setCollectionID(id: string): void;
  setCollection(collection: CollectionLike): void;
  setSourceCollection(collection: CollectionLike): void;
  scheduleSetCollection(): void;
  scheduleStore(): void;
  scheduleCopyItems(): void;
  _copySourceItems(): void;
}

const CollectionNode: NodeDefinitionOptions = {
  name: 'Collection2',
  docs: 'https://docs.noodl.net/nodes/data/array/array-node',
  displayNodeName: 'Array',
  shortDesc: 'A collection of models, mainly used together with a For Each Node.',
  category: 'Data',
  usePortAsLabel: 'collectionId',
  color: 'data',
  initialize: function (this: CollectionNodeInstance) {
    let collectionChangedScheduled = false;
    this._internal.collectionChangedCallback = () => {
      if (this.isInputConnected('fetch') === true) return; // Ignore if we have explicit fetch connection

      //this can be called multiple times when adding/removing more than one item
      //so optimize by only updating outputs once
      if (collectionChangedScheduled) return;
      collectionChangedScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.sendSignalOnOutput('changed');
        this.flagOutputDirty('firstItemId');
        this.flagOutputDirty('count');
        collectionChangedScheduled = false;
      });
    };

    // When the source collection has changed, simply copy items into this collection
    // Unreachable in practice: this node declares no `store` input, so
    // `isInputConnected('store')` is always false. See PLAT-003 NOTES §17.
    this._internal.sourceCollectionChangedCallback = () => {
      if (this.isInputConnected('store') === true) return; // Ignore if we have explicit store connection

      this.scheduleCopyItems();
    };
  },
  getInspectInfo(this: CollectionNodeInstance): InspectInfo {
    const collection = this._internal.collection;
    if (!collection) {
      return { type: 'text', value: '[No Array]' };
    }

    return [
      {
        type: 'text',
        value: 'Id: ' + collection.getId()
      },
      {
        type: 'value',
        value: collection.items
      }
    ];
  },
  inputs: {
    collectionId: {
      type: {
        name: 'string',
        identifierOf: 'CollectionName',
        identifierDisplayName: 'Array Ids'
      },
      displayName: 'Id',
      group: 'General',
      set: function (this: CollectionNodeInstance, value: string | CollectionLike) {
        if (value instanceof Collection) value = value.getId(); // Can be passed as collection as well
        this._internal.collectionId = value as string; // Wait to fetch data
        if (this.isInputConnected('fetch') === false) this.setCollectionID(value as string);
        else {
          this.flagOutputDirty('id');
        }
      }
    },
    items: {
      type: 'array',
      group: 'General',
      displayName: 'Items',
      set: function (this: CollectionNodeInstance, value: CollectionLike) {
        if (value === undefined) return;
        if (value === this._internal.collection) return;

        this._internal.pendingSourceCollection = value;
        if (this.isInputConnected('store') === false) {
          // Don't auto copy if we have connections to store
          this.scheduleAfterInputsHaveUpdated(() => {
            this.setSourceCollection(value);
          });
        }
      }
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function (this: CollectionNodeInstance) {
        this.scheduleSetCollection();
      }
    }
  },
  outputs: {
    id: {
      type: 'string',
      displayName: 'Id',
      group: 'General',
      getter: function (this: CollectionNodeInstance) {
        return this._internal.collection ? this._internal.collection.getId() : this._internal.collectionId;
      }
    },
    items: {
      type: 'array',
      displayName: 'Items',
      group: 'General',
      getter: function (this: CollectionNodeInstance) {
        return this._internal.collection;
      }
    },
    firstItemId: {
      type: 'string',
      displayName: 'First Item Id',
      group: 'General',
      getter: function (this: CollectionNodeInstance) {
        if (this._internal.collection) {
          const firstItem = this._internal.collection.get(0);
          if (firstItem !== undefined) return firstItem.getId();
        }
      }
    },
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'General',
      getter: function (this: CollectionNodeInstance) {
        return this._internal.collection ? this._internal.collection.size() : 0;
      }
    },
    changed: {
      group: 'Events',
      type: 'signal',
      displayName: 'Changed'
    },
    fetched: {
      group: 'Events',
      type: 'signal',
      displayName: 'Fetched'
    }
  },
  prototypeExtensions: {
    setCollectionID: function (this: CollectionNodeInstance, id: string) {
      this.setCollection(Collection.get(id));
    },
    setCollection: function (this: CollectionNodeInstance, collection: CollectionLike) {
      if (this._internal.collection)
        // Remove old listener if existing
        this._internal.collection.off('change', this._internal.collectionChangedCallback);

      this._internal.collection = collection;
      this.flagOutputDirty('id');
      collection.on('change', this._internal.collectionChangedCallback);

      this.flagOutputDirty('items');
      this.flagOutputDirty('firstItemId');
      this.flagOutputDirty('count');
    },
    setSourceCollection: function (this: CollectionNodeInstance, collection: CollectionLike) {
      const internal = this._internal;

      if (internal.sourceCollection && internal.sourceCollection instanceof Collection)
        // Remove old listener if existing
        internal.sourceCollection.off('change', internal.sourceCollectionChangedCallback);

      internal.sourceCollection = collection;
      if (internal.sourceCollection instanceof Collection)
        internal.sourceCollection.on('change', internal.sourceCollectionChangedCallback);

      this._copySourceItems();
    },
    scheduleSetCollection: function (this: CollectionNodeInstance) {
      if (this.hasScheduledSetCollection) return;
      this.hasScheduledSetCollection = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledSetCollection = false;
        this.setCollectionID(this._internal.collectionId);
        this.sendSignalOnOutput('fetched');
      });
    },
    // Unreachable: nothing calls this. It is the `store` half of the input pair the
    // `store` port would have driven — see PLAT-003 NOTES §17.
    scheduleStore: function (this: CollectionNodeInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledStore = false;
        this.setSourceCollection(internal.pendingSourceCollection);
      });
    },
    _copySourceItems: function (this: CollectionNodeInstance) {
      const internal = this._internal;

      if (internal.collection === undefined && this.isInputConnected('fetch') === false)
        this.setCollection(Collection.get());
      internal.collection && internal.collection.set(internal.sourceCollection);
    },
    scheduleCopyItems: function (this: CollectionNodeInstance) {
      if (this.hasScheduledCopyItems) return;
      this.hasScheduledCopyItems = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledCopyItems = false;
        this._copySourceItems();
      });
    },
    _onNodeDeleted: function (this: CollectionNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);

      if (this._internal.collection)
        // Remove old listener if existing
        this._internal.collection.off('change', this._internal.collectionChangedCallback);
    }
  }
};

const CollectionNodeModule: NodeModule = {
  node: CollectionNode
};

export default CollectionNodeModule;
