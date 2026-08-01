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
  shortDesc: 'Adds an object, named by its id, to a shared array.',
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
      description:
        'Id of the array to insert into; clearing it unbinds the node, and the next Do then fails ' +
        'rather than writing to a throwaway array',
      group: 'General',
      set: setCollectionIdInput
    },
    modifyId: {
      type: { name: 'string', allowConnectionsOnly: true },
      displayName: 'Object Id',
      description: 'Id of the object to insert; a record with this id is created if none has been loaded yet',
      group: 'Modify',
      set: function (this: CollectionInsertInstance, value: string) {
        this._internal.modifyId = value;
      }
    },
    add: {
      displayName: 'Do',
      description: 'Adds the object named by Object Id to the array, or fires Failure if either cannot be resolved',
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
      displayName: 'Done',
      // NDA-012 (Data): the sentence carries the pinned ambiguity. Inserting an id the array
      // already holds is a no-op that still reports Done — filed for a decision, not repaired.
      description:
        'Fires after the insert has been applied, including when the object was already in the ' +
        'array and nothing changed'
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
