'use strict';

import { Node } from '@noodl/runtime';
import Collection from '@noodl/runtime/src/collection';
import type {
  CollectionLike,
  InspectInfo,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';


/** `this` inside the Array node. */
interface CollectionNodeInstance extends NodeInstance {
  _internal: {
    /** The collection this node owns and reports on. */
    collection?: CollectionLike;
    /** Latest id seen on the `collectionId` input, kept for the deferred `fetch`. */
    collectionId?: string;
    /**
     * The collection connected to `items`, mirrored into {@link collection}. `null` is the
     * empty-value contract's explicit clear (dev-docs/reference/EMPTY-VALUE-CONTRACT.md) —
     * distinct from `undefined`, which never reaches here at all (`items`'s `set` abstains
     * before storing it).
     */
    sourceCollection?: CollectionLike | null;
    /** `items` as it arrived, before the scheduled copy runs. */
    pendingSourceCollection?: CollectionLike | null;
    collectionChangedCallback(): void;
    sourceCollectionChangedCallback(): void;
  };
  hasScheduledSetCollection?: boolean;
  hasScheduledCopyItems?: boolean;
  setCollectionID(id: string): void;
  setCollection(collection: CollectionLike): void;
  setSourceCollection(collection: CollectionLike | null): void;
  scheduleSetCollection(): void;
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

    // When the source collection has changed, simply copy items into this collection.
    // DEBT-006: the old `store`-connection guard here (and the scheduleStore method it
    // paired with) tested a port this node never declared — deleted; auto-copy is, and
    // always was, the only behaviour (PLAT-003 NOTES §17.7 #3).
    this._internal.sourceCollectionChangedCallback = () => {
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
      description:
        'undefined leaves this Array\'s current collection alone (no opinion supplied). null ' +
        'clears it — every item is removed and Changed fires once, the same as connecting an ' +
        'empty collection.',
      set: function (this: CollectionNodeInstance, value: CollectionLike | null) {
        // Empty-value contract (dev-docs/reference/EMPTY-VALUE-CONTRACT.md): `undefined`
        // abstains — no upstream opinion was given, so the collection this node already owns
        // is left exactly as it is. `null` is a real value and falls through to the path
        // below, which clears it.
        if (value === undefined) return;
        if (value === this._internal.collection) return;

        this._internal.pendingSourceCollection = value;
        this.scheduleAfterInputsHaveUpdated(() => {
          this.setSourceCollection(value);
        });
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
    setSourceCollection: function (this: CollectionNodeInstance, collection: CollectionLike | null) {
      const internal = this._internal;

      if (internal.sourceCollection && internal.sourceCollection instanceof Collection)
        // Remove old listener if existing
        internal.sourceCollection.off('change', internal.sourceCollectionChangedCallback);

      // `collection` is `null` on the empty-value contract's clear path (`items`'s `set`
      // above) — `instanceof Collection` is false for it, so no listener is attached, which
      // is correct: there is nothing to listen to.
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
    _copySourceItems: function (this: CollectionNodeInstance) {
      const internal = this._internal;

      if (internal.collection === undefined && this.isInputConnected('fetch') === false)
        this.setCollection(Collection.get());
      // `Collection#set` (src/collection.ts, out of scope here) treats a falsy source —
      // `null` included — as an empty array, which is the null path the empty-value
      // contract calls for: every item is removed as one batched `change`, not left as
      // whatever this node held before.
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
