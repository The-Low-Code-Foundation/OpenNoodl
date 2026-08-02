'use strict';

import Model from '@noodl/runtime/src/model';
import { outcomeOutputs } from '@noodl/runtime/src/outcome';
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
        const outcome = this.beginOutcome();

        this.scheduleAfterInputsHaveUpdated(() => {
          this._clearCollectionFailure();

          // NDA-004 §2. Both branches used to be `sendWarning` and a bare `return`, behind an
          // `if (this.context.editorConnection)` that does not exist outside the editor. The
          // node told an author on the canvas exactly what was wrong and told a deployed app,
          // a cloud function and an exported build nothing whatsoever — and there was no graph
          // surface either way, so even in the editor nothing downstream could branch on it.
          if (internal.modifyId === undefined) {
            this._failNoObjectId(outcome, 'insert');
            return;
          }

          if (internal.collection === undefined) {
            this._failNoCollection(outcome, 'insert');
            return;
          }

          /**
           * ERG-001 §2 — the node that raised the contract, and the reference implementation.
           *
           * `Array.prototype.add` early-returns when the array already holds the item
           * (`collection.ts:594`), so two `Do` pulses with the same Object Id leave the array at
           * size 1. The node signalled `Done` both times, which is why "add to cart, then
           * animate the new row" animated a row that did not appear.
           *
           * Not `Failure`: the author asked for the item to be in the array and it is. Richard's
           * framing is the whole reason `Unchanged` exists as a third outcome — a chain breaks
           * when a node emits nothing, and folding this into `Failure` breaks it for a state the
           * author explicitly asked for.
           */
          const model = Model.get(internal.modifyId);
          const alreadyPresent = internal.collection.contains(model);
          internal.collection.add(model);
          this.reportOutcome(outcome, alreadyPresent ? 'unchanged' : 'done');
        });
      }
    }
  },
  outputs: {
    ...outcomeOutputs({
      done: 'Fires once the object has been added to the array',
      unchanged: 'Fires when the object was already in the array, so nothing was added',
      failure: 'Fires when the array or the object could not be resolved, so nothing was changed'
    })
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
