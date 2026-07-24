'use strict';

import CollectionImport from '@noodl/runtime/src/collection';
import ModelImport from '@noodl/runtime/src/model';
import type {
  CollectionLike,
  CollectionModule,
  ModelModule,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

const Model = ModelImport as ModelModule;
const Collection = CollectionImport as CollectionModule;

/** `this` inside the Remove Object From Array node. */
interface CollectionRemoveInstance extends NodeInstance {
  _internal: {
    collection?: CollectionLike;
    /** Id of the record to remove. Arrives by connection only. */
    modifyId?: string;
  };
  setCollectionID(id: string): void;
  setCollection(collection: CollectionLike): void;
}

const CollectionRemoveNode: NodeDefinitionOptions = {
  name: 'CollectionRemove',
  docs: 'https://docs.noodl.net/nodes/data/array/remove-from-array',
  displayNodeName: 'Remove Object From Array',
  shortDesc: 'A collection of models, mainly used together with a For Each Node.',
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
      group: 'General',
      set: function (this: CollectionRemoveInstance, value: string | CollectionLike) {
        if (value instanceof Collection) value = value.getId(); // Can be passed as collection as well
        this.setCollectionID(value as string);
      }
    },
    modifyId: {
      type: { name: 'string', allowConnectionsOnly: true },
      displayName: 'Object Id',
      group: 'Modify',
      set: function (this: CollectionRemoveInstance, value: string) {
        this._internal.modifyId = value;
      }
    },
    remove: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue: function (this: CollectionRemoveInstance) {
        const internal = this._internal;

        this.scheduleAfterInputsHaveUpdated(() => {
          if (internal.modifyId === undefined) return;
          if (internal.collection === undefined) return;

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
      displayName: 'Done'
    }
  },
  prototypeExtensions: {
    setCollectionID: function (this: CollectionRemoveInstance, id: string) {
      this.setCollection(Collection.get(id));
    },
    setCollection: function (this: CollectionRemoveInstance, collection: CollectionLike) {
      this._internal.collection = collection;
    }
  }
};

const CollectionRemoveModule: NodeModule = {
  node: CollectionRemoveNode
};

export default CollectionRemoveModule;
