'use strict';

import { Node } from '@noodl/runtime';
import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import type {
  CollectionLike,
  InspectInfo,
  ModelLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';


/**
 * `this` inside the deprecated Array node.
 *
 * It holds *two* collections: `collection` is its own, the one its `items` output
 * hands out, and `sourceCollection` is whatever was connected to its `items`
 * input. Copying between them is a `set`, which diffs rather than assigns, so the
 * identity of entries present in both survives — which is what keeps a Repeater's
 * mounted components alive across an update.
 */
interface CollectionNodeInstance extends NodeInstance {
  _internal: {
    /** This node's own collection. Absent until an id arrives, or New/Add creates one. */
    collection?: CollectionLike;
    /** The id last set on the input, which may not be fetched yet. */
    collectionId?: string;
    /** Whatever is connected to `items`. Not necessarily a Collection — see `instanceOf`. */
    sourceCollection?: CollectionLike;
    /** The value seen on `items` but not yet copied, because `store` is connected. */
    pendingSourceCollection?: CollectionLike;
    /** Id of the item the Add/Remove actions operate on. */
    modifyId?: string;
    collectionChangedCallback(): void;
    sourceCollectionChangedCallback(): void;
  };
  hasScheduledSetCollection?: boolean;
  hasScheduledStore?: boolean;
  hasScheduledCopyItems?: boolean;
  hasScheduledNew?: boolean;
  setCollectionID(id: string | undefined): void;
  setCollection(collection: CollectionLike): void;
  setSourceCollection(collection: CollectionLike | undefined): void;
  scheduleSetCollection(): void;
  scheduleStore(): void;
  scheduleCopyItems(): void;
  scheduleNew(): void;
  _copySourceItems(): void;
}

const CollectionNode: NodeDefinitionOptions = {
  name: 'Collection',
  docs: 'https://docs.noodl.net/nodes/data/array',
  displayNodeName: 'Array',
  category: 'Data',
  usePortAsLabel: 'collectionId',
  color: 'data',
  deprecated: true, // Use new array node
  initialize: function (this: CollectionNodeInstance) {
    const _this = this;

    let collectionChangedScheduled = false;
    this._internal.collectionChangedCallback = function () {
      if (_this.isInputConnected('fetch') === true) return; // Ignore if we have explicit fetch connection

      //this can be called multiple times when adding/removing more than one item
      //so optimize by only updating outputs once
      if (collectionChangedScheduled) return;
      collectionChangedScheduled = true;

      _this.scheduleAfterInputsHaveUpdated(function () {
        _this.sendSignalOnOutput('changed');
        _this.flagOutputDirty('count');
        collectionChangedScheduled = false;
      });
    };

    // When the source collection has changed, simply copy items into this collection
    this._internal.sourceCollectionChangedCallback = function () {
      if (_this.isInputConnected('store') === true) return; // Ignore if we have explicit store connection

      _this.scheduleCopyItems();
    };
  },
  getInspectInfo(this: CollectionNodeInstance): InspectInfo {
    if (this._internal.collection) {
      return 'Count: ' + this._internal.collection.size();
    }
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
        const id = value instanceof Collection ? value.getId() : (value as string); // Can be passed as collection as well
        this._internal.collectionId = id; // Wait to fetch data
        if (this.isInputConnected('fetch') === false) this.setCollectionID(id);
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
        const _this = this;
        if (value === undefined) return;
        if (value === this._internal.collection) return;

        this._internal.pendingSourceCollection = value;
        if (this.isInputConnected('store') === false) {
          // Don't auto copy if we have connections to store
          this.scheduleAfterInputsHaveUpdated(function () {
            _this.setSourceCollection(value);
          });
        }
      }
    },
    modifyId: {
      type: { name: 'string', allowConnectionsOnly: true },
      displayName: 'Item Id',
      group: 'Modify',
      set: function (this: CollectionNodeInstance, value: string) {
        this._internal.modifyId = value;
      }
    },
    /*  modifyModel: {
      type: {name:'object',
              allowConnectionsOnly:true},
      displayName:'Item',
      group:'Modify',
      set:function(value) {
        if(!(value instanceof Model)) return;
        this._internal.modifyId = value.getId();
      },
    },   */
    store: {
      displayName: 'Set',
      group: 'Actions',
      valueChangedToTrue: function (this: CollectionNodeInstance) {
        this.scheduleStore();
      }
    },
    add: {
      displayName: 'Add',
      group: 'Modify',
      valueChangedToTrue: function (this: CollectionNodeInstance) {
        const _this = this;
        const internal = this._internal;

        this.scheduleAfterInputsHaveUpdated(function (this: CollectionNodeInstance) {
          if (internal.modifyId === undefined) return;
          if (internal.collection === undefined && this.isInputConnected('fetch') === false)
            _this.setCollection(Collection.get()); // Create a new empty collection if we don't have one yet
          if (internal.collection === undefined) return;

          const model: ModelLike = Model.get(internal.modifyId);
          internal.collection.add(model);
          _this.sendSignalOnOutput('modified');
        });
      }
    },
    remove: {
      displayName: 'Remove',
      group: 'Modify',
      valueChangedToTrue: function (this: CollectionNodeInstance) {
        const _this = this;
        const internal = this._internal;

        this.scheduleAfterInputsHaveUpdated(function (this: CollectionNodeInstance) {
          if (internal.modifyId === undefined) return;
          if (internal.collection === undefined && this.isInputConnected('fetch') === false)
            _this.setCollection(Collection.get()); // Create a new empty collection if we don't have one yet
          if (internal.collection === undefined) return;

          const model: ModelLike = Model.get(internal.modifyId);
          internal.collection.remove(model);
          _this.sendSignalOnOutput('modified');
        });
      }
    },
    clear: {
      displayName: 'Clear',
      group: 'Modify',
      valueChangedToTrue: function (this: CollectionNodeInstance) {
        const _this = this;
        const internal = this._internal;

        this.scheduleAfterInputsHaveUpdated(function (this: CollectionNodeInstance) {
          if (internal.collection === undefined && this.isInputConnected('fetch') === false)
            _this.setCollection(Collection.get()); // Create a new empty collection if we don't have one yet
          if (internal.collection === undefined) return;

          internal.collection.set([]);
          _this.sendSignalOnOutput('modified');
          // `count` is a number output, not a signal — this sends nothing. Kept verbatim.
          _this.sendSignalOnOutput('count');
        });
      }
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function (this: CollectionNodeInstance) {
        this.scheduleSetCollection();
      }
    },
    new: {
      displayName: 'New',
      group: 'Actions',
      valueChangedToTrue: function (this: CollectionNodeInstance) {
        this.scheduleNew();
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
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'General',
      getter: function (this: CollectionNodeInstance) {
        return this._internal.collection ? this._internal.collection.size() : 0;
      }
    },
    modified: {
      group: 'Events',
      type: 'signal',
      displayName: 'Modified'
    },
    changed: {
      group: 'Events',
      type: 'signal',
      displayName: 'Changed'
    },
    stored: {
      group: 'Events',
      type: 'signal',
      displayName: 'Stored'
    },
    fetched: {
      group: 'Events',
      type: 'signal',
      displayName: 'Fetched'
    },
    created: {
      group: 'Events',
      type: 'signal',
      displayName: 'Created'
    }
  },
  prototypeExtensions: {
    setCollectionID: function (this: CollectionNodeInstance, id: string | undefined) {
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
      this.flagOutputDirty('count');
    },
    setSourceCollection: function (this: CollectionNodeInstance, collection: CollectionLike | undefined) {
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
      const _this = this;

      if (this.hasScheduledSetCollection) return;
      this.hasScheduledSetCollection = true;

      this.scheduleAfterInputsHaveUpdated(function () {
        _this.hasScheduledSetCollection = false;
        _this.setCollectionID(_this._internal.collectionId);
        _this.sendSignalOnOutput('fetched');
      });
    },
    scheduleStore: function (this: CollectionNodeInstance) {
      const _this = this;
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(function () {
        _this.hasScheduledStore = false;
        _this.setSourceCollection(internal.pendingSourceCollection);
        _this.sendSignalOnOutput('stored');
      });
    },
    _copySourceItems: function (this: CollectionNodeInstance) {
      const internal = this._internal;

      if (internal.collection === undefined && this.isInputConnected('fetch') === false)
        this.setCollection(Collection.get());
      internal.collection && internal.collection.set(internal.sourceCollection);
    },
    scheduleCopyItems: function (this: CollectionNodeInstance) {
      const _this = this;

      if (this.hasScheduledCopyItems) return;
      this.hasScheduledCopyItems = true;

      this.scheduleAfterInputsHaveUpdated(function () {
        _this.hasScheduledCopyItems = false;
        _this._copySourceItems();
      });
    },
    scheduleNew: function (this: CollectionNodeInstance) {
      const _this = this;

      if (this.hasScheduledNew) return;
      this.hasScheduledNew = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(function () {
        _this.hasScheduledNew = false;
        _this.setCollection(Collection.get());

        // If we have a source collection, copy items
        if (internal.sourceCollection) internal.collection.set(internal.sourceCollection);

        _this.sendSignalOnOutput('created');
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
