'use strict';

import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  ModelLike,
  ModelModule,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  RuntimeDiscoveredPort
} from '@noodl/types';

import Node = require('../../../node');
import ModelImport = require('../../../model');

import { forgetForEachItem, resolveForEachItem } from '../../../foreachitem';

const Model = ModelImport as unknown as ModelModule;

/**
 * `this` inside the Object node.
 *
 * Every `prop-…` port is dynamic, derived from the `properties` string list, so the node's
 * whole data surface is registered at runtime rather than declared. The `fetch` input
 * changes the node's mode: connected, an id no longer resolves immediately — it waits to be
 * pulled — which is why `modelId`'s setter branches on `isInputConnected('fetch')`.
 */
interface ModelNodeInstance extends NodeInstance {
  _internal: {
    model?: ModelLike;
    modelId?: string;
    inputValues: Record<string, unknown>;
    /** Which inputs have changed since the last store, so unchanged ones are not rewritten. */
    dirtyValues: Record<string, boolean>;
    onModelChangedCallback?: (args: { name: string }) => void;
    /** Latest `idSource`, so the explicit-target input knows whether it is the live mode. */
    idSource?: unknown;
    /** The `Repeater Component` input: an item component named explicitly (BINDING-CONTRACT §a). */
    repeaterComponent?: string;
  };
  /** On the instance rather than in `_internal` — these guard the two schedulers. */
  hasScheduledStore?: boolean;
  hasScheduledSetModel?: boolean;
  scheduleStore(): void;
  scheduleSetModel(): void;
  setModelID(id: string): void;
  setModel(model: ModelLike | undefined): void;
  bindToRepeaterItem(): void;
}

const ModelNodeDefinition: NodeDefinitionOptions = {
  name: 'Model2',
  docs: 'https://docs.noodl.net/nodes/data/object/object-node',
  displayNodeName: 'Object',
  shortDesc:
    'Stores any amount of properties and can be used standalone or together with Collections and For Each nodes.',
  category: 'Data',
  usePortAsLabel: 'modelId',
  color: 'data',
  dynamicports: [
    {
      name: 'conditionalports/extended',
      condition: 'idSource = explicit OR idSource NOT SET',
      inputs: ['modelId']
    },
    {
      name: 'conditionalports/extended',
      condition: 'idSource = foreach',
      inputs: ['repeaterComponent']
    }
  ],
  initialize: function (this: ModelNodeInstance) {
    const internal = this._internal;
    internal.inputValues = {};
    internal.dirtyValues = {};

    const _this = this;
    this._internal.onModelChangedCallback = function (args: { name: string }) {
      if (_this.isInputConnected('fetch') === true) return;

      if (_this.hasOutput('prop-' + args.name)) _this.flagOutputDirty('prop-' + args.name);

      if (_this.hasOutput('changed-' + args.name)) _this.sendSignalOnOutput('changed-' + args.name);

      _this.sendSignalOnOutput('changed');
    };
  },
  getInspectInfo(this: ModelNodeInstance): InspectInfo {
    const model = this._internal.model;
    if (!model) return '[No Object]';

    return [
      { type: 'text', value: 'Id: ' + model.getId() },
      { type: 'value', value: model.data }
    ];
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
    changed: {
      type: 'signal',
      displayName: 'Changed',
      group: 'Events'
    },
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      group: 'Events'
    }
  },
  inputs: {
    idSource: {
      type: {
        name: 'enum',
        enums: [
          { label: 'Specify explicitly', value: 'explicit' },
          { label: 'From repeater', value: 'foreach' }
        ],
        allowEditOnly: true
      },
      default: 'explicit',
      displayName: 'Get Id from',
      group: 'General',
      set: function (this: ModelNodeInstance, value: unknown) {
        this._internal.idSource = value;
        if (value === 'foreach') this.bindToRepeaterItem();
      }
    },
    /**
     * BINDING-CONTRACT §(a) — which Repeater's item, when nesting makes "the nearest one"
     * ambiguous. Optional: unset keeps the historical nearest-wins resolution exactly.
     *
     * A component name rather than a hop count, for the same reason as everywhere else in the
     * contract — "two levels up" breaks the moment somebody wraps a component in a Group.
     */
    repeaterComponent: {
      type: 'component',
      displayName: 'Repeater Component',
      group: 'General',
      set: function (this: ModelNodeInstance, value: string) {
        this._internal.repeaterComponent = value || undefined;
        // Only re-resolve in the mode this input belongs to; in `explicit` mode the model
        // comes from `modelId` and rebinding here would quietly overwrite it.
        if (this._internal.idSource === 'foreach') this.bindToRepeaterItem();
      }
    },
    modelId: {
      type: {
        name: 'string',
        identifierOf: 'ModelName',
        identifierDisplayName: 'Object Ids'
      },
      displayName: 'Id',
      group: 'General',
      set: function (this: ModelNodeInstance, value: unknown) {
        if (value instanceof Model) value = (value as ModelLike).getId();
        // Can be passed as model as well
        else if (typeof value === 'object') value = Model.create(value as Record<string, unknown>).getId(); // If this is an js object, dereference it

        this._internal.modelId = value as string; // Wait to fetch data
        if (this.isInputConnected('fetch') === false) this.setModelID(value as string);
        else {
          this.flagOutputDirty('id');
        }
      }
    },
    properties: {
      type: { name: 'stringlist', allowEditOnly: true },
      displayName: 'Properties',
      group: 'Properties',
      set: function () {}
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function (this: ModelNodeInstance) {
        this.scheduleSetModel();
      }
    }
  },
  prototypeExtensions: {
    /**
     * Bind to the current Repeater/Run Tasks item — BINDING-CONTRACT, via `foreachitem.ts`.
     *
     * The deferral is the one this node always had: the walk needs the component tree in
     * place, and `scheduleAfterInputsHaveUpdated` is where it was. What is new is that a walk
     * finding nothing now reports instead of setting `undefined` and falling silent.
     */
    bindToRepeaterItem: function (this: ModelNodeInstance) {
      this.scheduleAfterInputsHaveUpdated(() => {
        this.setModel(resolveForEachItem(this, { target: this._internal.repeaterComponent }));
      });
    },
    scheduleStore: function (this: ModelNodeInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(() => {
        this.hasScheduledStore = false;

        // NDA-004 §2 examined this `return` and left it silent, deliberately — it looks like
        // the "Do that did nothing" defect fixed in `modelcrudbase.scheduleStore` and is not.
        //
        // This node has no `Do`. `scheduleStore` is reached from `userInputSetter`, i.e. from
        // *any* value arriving at a `prop-…` input, so an Object node whose Id has not shown
        // up yet reaches here once per incoming value as the app boots. Nobody asked it to
        // act; the values are being accumulated, `dirtyValues` deliberately keeps them, and
        // they are written the moment an object arrives. Firing `Failure` here would report a
        // failure on the ordinary path and train authors to ignore the port — which the
        // Failure Contract names as worse than no port at all.
        if (!internal.model) return;

        for (const i in internal.dirtyValues) {
          internal.model.set(i, internal.inputValues[i], { resolve: true });
        }
        internal.dirtyValues = {}; // Reset dirty values
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
    setModelID: function (this: ModelNodeInstance, id: string) {
      const model = (this.nodeScope.modelScope || Model).get(id);
      this.setModel(model);
      this.sendSignalOnOutput('fetched');
    },
    setModel: function (this: ModelNodeInstance, model: ModelLike | undefined) {
      if (this._internal.model)
        // Remove old listener if existing
        this._internal.model.off('change', this._internal.onModelChangedCallback);

      this._internal.model = model;
      this.flagOutputDirty('id');

      // In set idSource, we are calling setModel with undefined
      if (model) {
        model.on('change', this._internal.onModelChangedCallback);

        // We have a new model, mark all outputs as dirty
        for (const key in model.data) {
          if (this.hasOutput('prop-' + key)) this.flagOutputDirty('prop-' + key);
        }
      }
    },
    _onNodeDeleted: function (this: ModelNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      if (this._internal.model) this._internal.model.off('change', this._internal.onModelChangedCallback);
      // Not optional — the resolved-target reporter holds instances strongly, and a Repeater
      // churning its template creates and destroys these constantly.
      forgetForEachItem(this);
    },
    registerOutputIfNeeded: function (this: ModelNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name.startsWith('prop-'))
        this.registerOutput(name, {
          getter: userOutputGetter.bind(this, name.substring('prop-'.length))
        });
    },
    registerInputIfNeeded: function (this: ModelNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('prop-'))
        this.registerInput(name, {
          set: userInputSetter.bind(this, name.substring('prop-'.length))
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
  const model = this._internal.model;
  const valueChanged = model ? model.get(name) !== value : true;
  if (valueChanged) {
    this._internal.dirtyValues[name] = true;
    this.scheduleStore();
  }
}

function updatePorts(nodeId: string, parameters: Record<string, unknown>, editorConnection: EditorConnectionLike) {
  const ports: RuntimeDiscoveredPort[] = [];

  // Add value outputs
  let properties = parameters.properties as string | string[] | undefined;
  if (properties) {
    properties = properties ? (properties as string).split(',') : undefined;
    for (const i in properties) {
      const p = properties[i];

      ports.push({
        type: {
          name: '*',
          allowConnectionsOnly: true
        },
        plug: 'input/output',
        group: 'Properties',
        name: 'prop-' + p,
        displayName: p
      });

      ports.push({
        type: 'signal',
        plug: 'output',
        group: 'Changed Events',
        displayName: p + ' Changed',
        name: 'changed-' + p
      });
    }
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
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Model2', function (node: GraphNodeModel) {
      updatePorts(node.id, node.parameters, context.editorConnection);

      node.on('parameterUpdated', function () {
        updatePorts(node.id, node.parameters, context.editorConnection);
      });
    });
  }
};

export = ModelNodeModule;
