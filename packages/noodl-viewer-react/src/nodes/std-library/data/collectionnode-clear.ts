import Collection from '@noodl/runtime/src/collection';
import type { CollectionLike, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';


/** `this` inside the Clear Array node. */
interface CollectionClearInstance extends NodeInstance {
  _internal: {
    collection?: CollectionLike;
  };
  setCollectionID(id: string): void;
  setCollection(collection: CollectionLike): void;
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
      set: function (this: CollectionClearInstance, value: string | CollectionLike) {
        if (value instanceof Collection) value = value.getId(); // Can be passed as collection as well
        this.setCollectionID(value as string);
      }
    },
    clear: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue(this: CollectionClearInstance) {
        this.scheduleAfterInputsHaveUpdated(() => {
          const collection = this._internal.collection;

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
    setCollectionID: function (this: CollectionClearInstance, id: string) {
      this.setCollection(Collection.get(id));
    },
    setCollection: function (this: CollectionClearInstance, collection: CollectionLike) {
      this._internal.collection = collection;
    }
  }
};

const CollectionClearModule: NodeModule = {
  node: CollectionClearNode
};

export default CollectionClearModule;
