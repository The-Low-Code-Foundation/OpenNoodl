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
    /** Message for the `Error` output; see NDA-004. */
    lastError?: string;
    setWith?: SetVariableAs;
    variablesModel: ModelLike;
  };
  hasScheduledStore?: boolean;
  setValue(value: unknown): void;
  scheduleStore(): void;
  reportFailure(code: string, message: string): void;
}

/** NDA-004 §2 — see `scheduleStore`. Also the editor's warning key; the bus keys by `code`. */
const NO_NAME_ERROR_CODE = 'set-variable/no-name';

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
  // NDA-004 §2: `Done` had no counterpart, and it fired for a write that went nowhere. See
  // `scheduleStore`. The trigger is an author `Do` (group `Actions`), so these cannot fire on
  // the boot path.
  outputs: {
    done: {
      type: 'signal',
      displayName: 'Done',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter: function (this: SetVariableInstance) {
        return this._internal.lastError;
      }
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
    reportFailure: function (this: SetVariableInstance, code: string, message: string) {
      this._internal.lastError = message;
      this.raiseRuntimeError(code, message);
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');
    },
    setValue: function (this: SetVariableInstance, value: unknown) {
      this._internal.value = value;
    },
    scheduleStore: function (this: SetVariableInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(function (this: SetVariableInstance) {
        this.hasScheduledStore = false;

        /**
         * NDA-004 §2 — the phase's worst shape, in one of its simplest nodes.
         *
         * With no `Name`, this called `Model.set(undefined, value)`. That does not throw and
         * does not no-op: it writes a key literally named `undefined` on the shared
         * `--ndl--global-variables` record, notifies a change no Variable node is listening
         * for, and then fires **`Done`**. A false success — `Set Parent Component Object
         * Properties` and `Collection.get(undefined)` for the third time, here reached by
         * simply not filling in a field.
         *
         * An empty string is the same mistake as `undefined`: `usePortAsLabel: 'name'` means an
         * unnamed node shows no label either way, and no Variable node can read a key with no
         * name.
         */
        if (internal.name === undefined || internal.name === null || internal.name === '') {
          this.reportFailure(
            NO_NAME_ERROR_CODE,
            'No variable name is set — the value was not stored anywhere a Variable node can read'
          );
          return;
        }

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
