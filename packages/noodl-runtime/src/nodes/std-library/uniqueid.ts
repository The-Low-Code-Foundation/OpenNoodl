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
      valueChangedToTrue: function (this: UniqueIdNodeInstance) {
        const internal = this._internal;
        internal.guid = Model.guid();
        this.flagOutputDirty('guid');
      }
    }
  },
  outputs: {
    guid: {
      type: 'string',
      displayName: 'Id',
      getter: function (this: UniqueIdNodeInstance) {
        const internal = this._internal;
        return internal.guid;
      }
    }
  },
  prototypeExtensions: {}
};

const UniqueIdNodeModule: NodeModule = {
  node: UniqueIdNode
};

export = UniqueIdNodeModule;
