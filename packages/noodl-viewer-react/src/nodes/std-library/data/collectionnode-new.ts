'use strict';

import Collection from '@noodl/runtime/src/collection';
import { outcomeOutputs } from '@noodl/runtime/src/outcome';
import type { CollectionLike, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';


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
  category: 'Data',
  color: 'data',
  initialize: function () {},
  inputs: {
    new: {
      displayName: 'Do',
      description: 'Creates a fresh array with a generated id and copies Items into it',
      group: 'Actions',
      valueChangedToTrue: function (this: CollectionNewInstance) {
        this.scheduleNew();
      }
    },
    items: {
      type: 'array',
      group: 'General',
      displayName: 'Items',
      description: 'Contents to copy into the new array when Do fires; leave unconnected to start empty',
      set: function (this: CollectionNewInstance, value: CollectionLike) {
        this._internal.sourceCollection = value;
      }
    }
  },
  outputs: {
    id: {
      type: 'string',
      displayName: 'Id',
      description:
        'Id of the array made by the last Do — give it to an Array node or a mutator to reach the ' +
        'same array; empty until Do has fired',
      group: 'General',
      getter: function (this: CollectionNewInstance) {
        // DEBT-006: the old fallback read `_internal.collectionId`, which nothing
        // could assign — the node has no `collectionId` input (PLAT-003 NOTES §17.7 #5).
        return this._internal.collection ? this._internal.collection.getId() : undefined;
      }
    },
    /**
     * ERG-001: no `Failure` and no `Unchanged`, and both absences are the contract's own
     * exemptions rather than an oversight. `Collection.get()` with no name builds a fresh
     * array every time, so this node cannot fail to find one and cannot no-op.
     */
    ...outcomeOutputs({ done: 'Fires once the new array exists and Id is up to date' })
  },
  prototypeExtensions: {
    setCollection: function (this: CollectionNewInstance, collection: CollectionLike) {
      this._internal.collection = collection;
      this.flagOutputDirty('id');
    },
    scheduleNew: function (this: CollectionNewInstance) {
      if (this.hasScheduledNew) return;
      this.hasScheduledNew = true;
      const outcome = this.beginOutcome();

      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledNew = false;

        const collection = Collection.get();
        if (this._internal.sourceCollection !== undefined) collection.set(this._internal.sourceCollection);

        // `setCollection` flags `id` dirty. The outcome is reported after it, so a graph wiring
        // `Done -> …` alongside `Id` already has the new id when the pulse lands.
        this.setCollection(collection);

        this.reportOutcome(outcome, 'done');
      });
    }
  }
};

const CollectionNewModule: NodeModule = {
  node: CollectionNewNode
};

export default CollectionNewModule;
