'use strict';

import { Node } from '@noodl/runtime';
import Model from '@noodl/runtime/src/model';
import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  ModelChangeEvent,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';


//var previousProperties = {};

/**
 * `this` inside the deprecated Object node.
 *
 * Its property ports are `runtime-discovered`: `registerInputIfNeeded` and
 * `registerOutputIfNeeded` synthesise a port for whatever name the editor asks
 * for, and `setup` below pushes the port list back from the `properties`
 * parameter the author typed.
 */
interface ModelNodeInstance extends NodeInstance {
  _internal: {
    /** Latest value of each property input, keyed by port name. */
    inputValues: Record<string, unknown>;
    /** The record this node is bound to. Absent until an id arrives or New runs. */
    model?: ModelLike;
    /** The id last set on the input, which may not be fetched yet. */
    modelId?: string;
    onModelChangedCallback(args: ModelChangeEvent): void;
  };
  hasScheduledStore?: boolean;
  hasScheduledNew?: boolean;
  hasScheduledSetModel?: boolean;
  scheduleStore(): void;
  scheduleNew(): void;
  scheduleSetModel(): void;
  setModelID(id: string | undefined): void;
  setModel(model: ModelLike): void;
}

const ModelNodeDefinition: NodeDefinitionOptions = {
  name: 'Model',
  docs: 'https://docs.noodl.net/nodes/data/object',
  displayNodeName: 'Object',
  shortDesc:
    'Stores any amount of properties and can be used standalone or together with Collections and For Each nodes.',
  category: 'Data',
  usePortAsLabel: 'modelId',
  color: 'data',
  deprecated: true, // Use new model node
  initialize: function (this: ModelNodeInstance) {
    const internal = this._internal;
    internal.inputValues = {};

    const _this = this;
    this._internal.onModelChangedCallback = function (args: ModelChangeEvent) {
      if (_this.isInputConnected('fetch') === true) return;

      if (_this.hasOutput(args.name)) _this.flagOutputDirty(args.name);

      if (_this.hasOutput('changed-' + args.name)) _this.sendSignalOnOutput('changed-' + args.name);

      _this.sendSignalOnOutput('changed');
    };
  },
  getInspectInfo(this: ModelNodeInstance): InspectInfo {
    const model = this._internal.model;
    if (!model) return '[No Object]';

    const modelInfo = [{ type: 'text', value: 'Id: ' + model.getId() }];

    const data = this._internal.model.data;
    return modelInfo.concat(
      Object.keys(data).map((key) => {
        return { type: 'text', value: key + ': ' + data[key] };
      })
    );
  },
  outputs: {
    id: {
      type: 'string',
      displayName: 'Id',
      group: 'General',
      getter: function (this: ModelNodeInstance) {
        return this._internal.model ? this._internal.model.getId() : this._internal.modelId;
      }
    },
    /*  currentModel: {
      type: 'object',
      displayName: 'Object',
      group: 'General',
      getter: function () {
          return this._internal.model;
      }
    },*/
    stored: {
      type: 'signal',
      displayName: 'Stored',
      group: 'Events'
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events'
    },
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      group: 'Events'
    },
    created: {
      type: 'signal',
      displayName: 'Created',
      group: 'Events'
    }
  },
  inputs: {
    modelId: {
      type: {
        name: 'string',
        identifierOf: 'ModelName',
        identifierDisplayName: 'Object Ids'
      },
      displayName: 'Id',
      group: 'General',
      set: function (this: ModelNodeInstance, value: string | ModelLike) {
        const id = value instanceof Model ? value.getId() : (value as string); // Can be passed as model as well
        this._internal.modelId = id; // Wait to fetch data
        if (this.isInputConnected('fetch') === false) this.setModelID(id);
        else {
          this.flagOutputDirty('id');
        }
      }
    },
    /*  model:{
      type:'object',
      displayName:'Object',
      group: 'General',
      set: function (value) {
        if(value === undefined) return;
        if(value === this._internal.model) return;

        if(!(value instanceof Model) && typeof value === 'object') {
          // This is a regular JS object, convert to model
          value = Model.create(value);
        }

        this._internal.modelId = value.getId(); 
        if(this.isInputConnected('fetch') === false)
          this.setModelID(this._internal.modelId);
        else {
          this.flagOutputDirty('id');
        }
      }
    },*/
    properties: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Properties',
      group: 'Properties',
      // Edit-only: read from the node's parameters by `updatePorts`, never at runtime.
      set: function () {}
    },
    new: {
      displayName: 'New',
      group: 'Actions',
      valueChangedToTrue: function (this: ModelNodeInstance) {
        this.scheduleNew();
      }
    },
    store: {
      displayName: 'Set',
      group: 'Actions',
      valueChangedToTrue: function (this: ModelNodeInstance) {
        this.scheduleStore();
      }
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function (this: ModelNodeInstance) {
        this.scheduleSetModel();
      }
    },
    clear: {
      displayName: 'Clear',
      group: 'Actions',
      valueChangedToTrue: function (this: ModelNodeInstance) {
        const internal = this._internal;
        if (!internal.model) return;
        for (const i in internal.inputValues) {
          internal.model.set(i, undefined, { resolve: true });
        }
      }
    }
  },
  prototypeExtensions: {
    scheduleStore: function (this: ModelNodeInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledStore = false;
        if (!internal.model) return;

        for (const i in internal.inputValues) {
          internal.model.set(i, internal.inputValues[i], { resolve: true });
        }
        this.sendSignalOnOutput('stored');
      });
    },
    scheduleNew: function (this: ModelNodeInstance) {
      if (this.hasScheduledNew) return;
      this.hasScheduledNew = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledNew = false;
        const newModel: ModelLike = Model.get();

        for (const i in internal.inputValues) {
          newModel.set(i, internal.inputValues[i], { resolve: true });
        }

        this.setModel(newModel);

        this.sendSignalOnOutput('created');
        this.sendSignalOnOutput('stored');
      });
    },
    scheduleSetModel: function (this: ModelNodeInstance) {
      if (this.hasScheduledSetModel) return;
      this.hasScheduledSetModel = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledSetModel = false;
        this.setModelID(this._internal.modelId);
      });
    },
    setModelID: function (this: ModelNodeInstance, id: string | undefined) {
      const model: ModelLike = Model.get(id);
      this.setModel(model);
      this.sendSignalOnOutput('fetched');
    },
    setModel: function (this: ModelNodeInstance, model: ModelLike) {
      if (this._internal.model)
        // Remove old listener if existing
        this._internal.model.off('change', this._internal.onModelChangedCallback);

      this._internal.model = model;
      this.flagOutputDirty('id');
      model.on('change', this._internal.onModelChangedCallback);

      // We have a new model, mark all outputs as dirty
      for (const key in model.data) {
        if (this.hasOutput(key)) this.flagOutputDirty(key);
      }
    },
    _onNodeDeleted: function (this: ModelNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      if (this._internal.model) this._internal.model.off('change', this._internal.onModelChangedCallback);
    },
    registerOutputIfNeeded: function (this: ModelNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      this.registerOutput(name, {
        getter: userOutputGetter.bind(this, name)
      });
    },
    registerInputIfNeeded: function (this: ModelNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      this.registerInput(name, {
        set: userInputSetter.bind(this, name)
      });
    }
  }
};

function userOutputGetter(this: ModelNodeInstance, name: string) {
  /* jshint validthis:true */
  return this._internal.model ? this._internal.model.get(name, { resolve: true }) : undefined;
}

function userInputSetter(this: ModelNodeInstance, name: string, value: unknown) {
  /* jshint validthis:true */
  this._internal.inputValues[name] = value;

  // Store on change if no connection to store or new
  if (this.isInputConnected('store') === false && this.isInputConnected('new') === false) {
    const model = this._internal.model;
    const valueChanged = model ? model.get(name) !== value : true;
    if (valueChanged) {
      this.scheduleStore();
    }
  }
}

/*function detectRename(before, after) {
  if (!before || !after) return;

  if (before.length !== after.length) return; // Must be of same length

  var res = {}
  for (var i = 0; i < before.length; i++) {
    if (after.indexOf(before[i]) === -1) {
      if (res.before) return; // Can only be one from before that is missing
      res.before = before[i];
    }

    if (before.indexOf(after[i]) === -1) {
      if (res.after) return; // Only one can be missing,otherwise we cannot match
      res.after = after[i];
    }
  }

  return (res.before && res.after) ? res : undefined;
}*/

/*const defaultStorageInitCode = "initialize({\n"+
"\t// Here you can initialize new models\n"+
"\tmyProperty:'Some init value',\n"+
"\tanotherProperty:function() { return 'Some other value')\n"+
"})\n";

const defaultStorageValidateCode = "validation({\n"+
"\t// Here you add validation specifications for your model properties.\n"+
"\tmyProperty: { required:true, length:4 },\n"+
"\tanotherProperty: function(value) {\n"+
"\t\tif(value !== 'someValue) return 'Error message'\n"+
"\t}\n"+
"})\n";*/

function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike
): void {
  const ports = [];

  // Add value outputs
  const propertyList = parameters.properties as string | undefined;
  if (propertyList) {
    const properties = propertyList.split(',');
    for (const i in properties) {
      const p = properties[i];

      ports.push({
        type: {
          name: '*',
          allowConnectionsOnly: true
        },
        plug: 'input/output',
        group: 'Properties',
        name: p
      });

      ports.push({
        type: 'signal',
        plug: 'output',
        group: 'Changed Events',
        displayName: p + ' Changed',
        name: 'changed-' + p
      });
    }

    /*  var propertyRenamed = detectRename(previousProperties[nodeId], properties);
    previousProperties[nodeId] = properties;
    if (propertyRenamed) {
      var renamed = {
        plug: 'input/output',
        patterns: ['{{*}}'],
        before: propertyRenamed.before,
        after: propertyRenamed.after
      };
    }*/
  }

  editorConnection.sendDynamicPorts(nodeId, ports, {
    detectRenamed: {
      plug: 'input/output'
    }
  });
}

const ModelNodeModule: NodeModule = {
  node: ModelNodeDefinition,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Model', function (node: GraphNodeModel) {
      updatePorts(node.id, node.parameters, editorConnection);

      node.on('parameterUpdated', function () {
        updatePorts(node.id, node.parameters, editorConnection);
      });
    });
  }
};

export default ModelNodeModule;
