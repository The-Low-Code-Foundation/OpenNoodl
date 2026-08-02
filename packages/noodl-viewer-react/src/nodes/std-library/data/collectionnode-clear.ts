import { outcomeOutputs } from '@noodl/runtime/src/outcome';
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
      description:
        'Id of the array to empty; clearing it unbinds the node, and the next Do then fails rather ' +
        'than emptying a throwaway array',
      group: 'General',
      set: setCollectionIdInput
    },
    clear: {
      displayName: 'Do',
      description: 'Removes every item from the array, or fires Failure if no array is bound',
      group: 'Actions',
      valueChangedToTrue(this: CollectionClearInstance) {
        const outcome = this.beginOutcome();

        this.scheduleAfterInputsHaveUpdated(() => {
          const collection = this._internal.collection;

          // NDA-004 §2. This was `collection.set([])` with no guard at all — the only node in
          // the family whose missing-array path was not silent but a **crash**: a `TypeError`
          // thrown out of a scheduled callback, from a node whose Array Id an author had simply
          // not filled in yet. Its two siblings at least returned.
          if (collection === undefined) {
            this._failNoCollection(outcome, 'clear');
            return;
          }

          this._clearCollectionFailure();
          // ERG-001. Clearing an array that is already empty is the post-condition already
          // holding — the author asked for an empty array and has one. Reported before the
          // `set([])` because after it the distinction is gone.
          const wasEmpty = collection.length === 0;
          collection.set([]);
          this.reportOutcome(outcome, wasEmpty ? 'unchanged' : 'done');
        });
      }
    }
  },
  outputs: {
    ...outcomeOutputs({
      done: 'Fires once the array has been emptied',
      unchanged: 'Fires when the array was already empty, so nothing was removed',
      failure: 'Fires when no array is bound, so nothing was changed'
    })
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
