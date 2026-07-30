'use strict';

import Model from '@noodl/runtime/src/model';
import type { CollectionLike, NodeDefinitionOptions, NodeModule } from '@noodl/types';

import {
  addCollectionFailure,
  resolveCollectionId,
  setCollectionIdInput,
  type FailableCollectionInstance
} from './collection-failure';

/** `this` inside the Insert Object Into Array node. */
interface CollectionInsertInstance extends FailableCollectionInstance {
  setCollectionID(id: string | undefined): void;
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
      set: setCollectionIdInput
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
          this._clearCollectionFailure();

          // NDA-004 §2. Both branches used to be `sendWarning` and a bare `return`, behind an
          // `if (this.context.editorConnection)` that does not exist outside the editor. The
          // node told an author on the canvas exactly what was wrong and told a deployed app,
          // a cloud function and an exported build nothing whatsoever — and there was no graph
          // surface either way, so even in the editor nothing downstream could branch on it.
          if (internal.modifyId === undefined) {
            this._failNoObjectId('insert');
            return;
          }

          if (internal.collection === undefined) {
            this._failNoCollection('insert');
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
    setCollectionID: function (this: CollectionInsertInstance, id: string | undefined) {
      this.setCollection(resolveCollectionId(id));
    },
    setCollection: function (this: CollectionInsertInstance, collection: CollectionLike | undefined) {
      this._internal.collection = collection;
    }
  }
};

const CollectionInsertModule: NodeModule = {
  node: CollectionInsertNode
};

addCollectionFailure(CollectionInsertNode, 'insert-into-array');

export default CollectionInsertModule;
