'use strict';

import type { InspectInfo, ModelModule, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import ModelImport = require('../../model');

const Model = ModelImport as unknown as ModelModule;

/** `this` inside the Unique Id node — one guid, regenerated on demand. */
interface UniqueIdNodeInstance extends NodeInstance {
  _internal: {
    guid: string;
  };
}

const UniqueIdNode: NodeDefinitionOptions = {
  name: 'Unique Id',
  docs: 'https://docs.noodl.net/nodes/utilities/unique-id',
  category: 'String Manipulation',
  initialize: function (this: UniqueIdNodeInstance) {
    const internal = this._internal;
    internal.guid = Model.guid();
  },
  getInspectInfo(this: UniqueIdNodeInstance): InspectInfo {
    return this._internal.guid;
  },
  inputs: {
    new: {
      displayName: 'New',
      description: 'Generates a fresh id, replacing the one on Id',
      valueChangedToTrue: function (this: UniqueIdNodeInstance) {
        const internal = this._internal;
        internal.guid = Model.guid();
        this.flagOutputDirty('guid');
        // NDA-004 §3. `Id` is a value output, so a downstream node that wants to *act* on a
        // fresh id had nothing to trigger on — the node took `New` and emitted nothing. The
        // value is flagged dirty first so the signal and the id it announces stay in step.
        this.sendSignalOnOutput('generated');
      }
    }
  },
  outputs: {
    guid: {
      type: 'string',
      displayName: 'Id',
      description: 'A globally unique identifier, generated once when the node is created and again on every New',
      getter: function (this: UniqueIdNodeInstance) {
        const internal = this._internal;
        return internal.guid;
      }
    },
    generated: {
      type: 'signal',
      displayName: 'Generated',
      group: 'Events',
      description: 'Fires once a new id is available on Id'
    }
  },
  prototypeExtensions: {}
};

const UniqueIdNodeModule: NodeModule = {
  node: UniqueIdNode
};

export = UniqueIdNodeModule;
