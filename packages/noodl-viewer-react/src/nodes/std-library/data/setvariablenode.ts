'use strict';

import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import type {
  GraphNodeModel,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';


/** How the author asked the value to be coerced before it is stored. */
type SetVariableAs = 'string' | 'boolean' | 'number' | 'emptyString' | 'date' | 'object' | 'array' | '*';

/** `this` inside the Set Variable node. See {@link VariableNodeInstance} for the record. */
interface SetVariableInstance extends NodeInstance {
  _internal: {
    name?: string;
    value?: unknown;
    setWith?: SetVariableAs;
    variablesModel: ModelLike;
  };
  hasScheduledStore?: boolean;
  setValue(value: unknown): void;
  scheduleStore(): void;
}

const SetVariableNodeDefinition: NodeDefinitionOptions = {
  name: 'Set Variable',
  docs: 'https://docs.noodl.net/nodes/data/variable/set-variable',
  category: 'Data',
  usePortAsLabel: 'name',
  color: 'data',
  initialize: function (this: SetVariableInstance) {
    const internal = this._internal;

    internal.variablesModel = Model.get('--ndl--global-variables');
  },
  outputs: {
    done: {
      type: 'signal',
      displayName: 'Done',
      group: 'Events'
    }
  },
  inputs: {
    name: {
      type: {
        name: 'string',
        identifierOf: 'VariableName',
        identifierDisplayName: 'Variable names'
      },
      displayName: 'Name',
      group: 'General',
      set: function (this: SetVariableInstance, value: string) {
        this._internal.name = value;
      }
    },
    setWith: {
      type: {
        name: 'enum',
        enums: [
          { label: 'String', value: 'string' },
          { label: 'Boolean', value: 'boolean' },
          { label: 'Number', value: 'number' },
          { label: 'Empty string', value: 'emptyString' },
          { label: 'Date', value: 'date' },
          { label: 'Object', value: 'object' },
          { label: 'Array', value: 'array' },
          { label: 'Any', value: '*' }
        ],
        allowEditOnly: true
      },
      displayName: 'Set as',
      default: '*',
      group: 'General',
      set: function (this: SetVariableInstance, value: SetVariableAs) {
        this._internal.setWith = value;
      }
    },
    do: {
      displayName: 'Do',
      group: 'Actions',
      valueChangedToTrue: function (this: SetVariableInstance) {
        this.scheduleStore();
      }
    }
  },
  methods: {
    setValue: function (this: SetVariableInstance, value: unknown) {
      this._internal.value = value;
    },
    scheduleStore: function (this: SetVariableInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(function (this: SetVariableInstance) {
        this.hasScheduledStore = false;

        let value = internal.setWith === 'emptyString' ? '' : internal.value;

        if (internal.setWith === 'object' && typeof value === 'string') value = Model.get(value); // Can set arrays with "id" or array
        if (internal.setWith === 'array' && typeof value === 'string') value = Collection.get(value); // Can set arrays with "id" or array
        if (internal.setWith === 'boolean') value = !!value;

        //use forceChange to always trigger Variable nodes to send the value on their output, even if it's the same value twice
        internal.variablesModel.set(internal.name, value, {
          forceChange: true
        });
        this.sendSignalOnOutput('done');
      });
    },
    registerInputIfNeeded: function (this: SetVariableInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name === 'value')
        this.registerInput(name, {
          set: this.setValue.bind(this)
        });
    }
  }
};

const SetVariableModule: NodeModule = {
  node: SetVariableNodeDefinition,
  setup: function (context: NodeContextLike, graphModel) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Set Variable', function (node: GraphNodeModel) {
      function _updatePorts() {
        const ports = [];

        if (node.parameters.setWith === 'emptyString') {
          // No ports needed
        } else {
          ports.push({
            type: node.parameters.setWith !== undefined ? node.parameters.setWith : '*',
            plug: 'input',
            group: 'General',
            name: 'value',
            displayName: 'Value'
          });
        }

        context.editorConnection.sendDynamicPorts(node.id, ports);
      }

      _updatePorts();

      node.on('parameterUpdated', function () {
        _updatePorts();
      });
    });
  }
};

export default SetVariableModule;
