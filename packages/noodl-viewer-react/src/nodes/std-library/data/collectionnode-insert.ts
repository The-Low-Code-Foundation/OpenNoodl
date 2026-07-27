'use strict';

import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import type {
  CollectionLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';


/** `this` inside the Insert Object Into Array node. */
interface CollectionInsertInstance extends NodeInstance {
  _internal: {
    collection?: CollectionLike;
    /** Id of the record to insert. Arrives by connection only. */
    modifyId?: string;
  };
  setCollectionID(id: string): void;
  setCollection(collection: CollectionLike): void;
}

const CollectionInsertNode: NodeDefinitionOptions = {
  name: 'CollectionInsert',
  docs: 'https://docs.noodl.net/nodes/data/array/insert-into-array',
  displayNodeName: 'Insert Object Into Array',
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
      set: function (this: CollectionInsertInstance, value: string | CollectionLike) {
        if (value instanceof Collection) value = value.getId(); // Can be passed as collection as well
        this.setCollectionID(value as string);
      }
    },
    modifyId: {
      type: { name: 'string', allowConnectionsOnly: true },
      displayName: 'Object Id',
      group: 'Modify',
      set: function (this: CollectionInsertInstance, value: string) {
        this._internal.modifyId = value;
      }
    },
    add: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue: function (this: CollectionInsertInstance) {
        const internal = this._internal;

        this.scheduleAfterInputsHaveUpdated(() => {
          if (this.context.editorConnection) {
            this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'insert-warning');
          }

          if (internal.modifyId === undefined) {
            if (this.context.editorConnection) {
              this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'insert-warning', {
                showGlobally: true,
                message: 'No Object Id specified'
              });
            }
            return;
          }

          if (internal.collection === undefined) {
            if (this.context.editorConnection) {
              this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'insert-warning', {
                showGlobally: true,
                message: 'No Array Id specified'
              });
            }
            return;
          }

          const model = Model.get(internal.modifyId);
          internal.collection.add(model);
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
    setCollectionID: function (this: CollectionInsertInstance, id: string) {
      this.setCollection(Collection.get(id));
    },
    setCollection: function (this: CollectionInsertInstance, collection: CollectionLike) {
      this._internal.collection = collection;
    }
  }
};

const CollectionInsertModule: NodeModule = {
  node: CollectionInsertNode
};

export default CollectionInsertModule;
