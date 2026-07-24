'use strict';

import { Node } from '@noodl/runtime';
import ModelImport from '@noodl/runtime/src/model';
import type {
  InspectInfo,
  ModelChangeEvent,
  ModelLike,
  ModelModule,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

const Model = ModelImport as ModelModule;

/**
 * `this` inside the Variable node.
 *
 * Every Variable in a project is one property of a single shared record — the one keyed
 * `'--ndl--global-variables'` — which is what makes Variables global and why a Set Variable
 * node anywhere in the graph reaches every Variable node reading that name.
 */
interface VariableNodeInstance extends NodeInstance {
  _internal: {
    /** The variable this node reads. */
    name?: string;
    /** Latest value seen on the `value` input, pending the scheduled store. */
    value?: unknown;
    variablesModel: ModelLike;
    onModelChangedCallback(args: ModelChangeEvent): void;
  };
  hasScheduledStore?: boolean;
  scheduleStore(): void;
  setVariableName(name: string): void;
}

const VariableNodeDefinition: NodeDefinitionOptions = {
  name: 'Variable2',
  displayNodeName: 'Variable',
  docs: 'https://docs.noodl.net/nodes/data/variable/variable-node',
  category: 'Data',
  usePortAsLabel: 'name',
  color: 'data',
  initialize: function (this: VariableNodeInstance) {
    const internal = this._internal;

    this._internal.onModelChangedCallback = (args: ModelChangeEvent) => {
      if (!this.isInputConnected('fetch') && args.name === internal.name) {
        this.sendSignalOnOutput('changed');
        this.flagOutputDirty('value');
      }
    };

    internal.variablesModel = Model.get('--ndl--global-variables');
    internal.variablesModel.on('change', this._internal.onModelChangedCallback);
  },
  // Returns the raw variable value, so any variable holding a number, boolean or object
  // renders as nothing in the editor's inspector popup — see PLAT-003 NOTES §13. Only a
  // string variable inspects correctly. Kept as-is: correcting it changes what the editor
  // shows.
  getInspectInfo(this: VariableNodeInstance): InspectInfo {
    if (this._internal.name) {
      return this._internal.variablesModel.get(this._internal.name) as InspectInfo;
    }

    return '[No value set]';
  },
  outputs: {
    name: {
      type: 'string',
      displayName: 'Name',
      group: 'General',
      getter: function (this: VariableNodeInstance) {
        return this._internal.name;
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
    },
    value: {
      type: '*',
      displayName: 'Value',
      group: 'General',
      getter: function (this: VariableNodeInstance) {
        const internal = this._internal;
        if (!internal.name) return;

        return internal.variablesModel.get(internal.name);
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
      set: function (this: VariableNodeInstance, value: string) {
        if (this.isInputConnected('fetch') === false) this.setVariableName(value);
        else {
          this._internal.name = value; // Wait to fetch data
          this.flagOutputDirty('name');
        }
      }
    },
    fetch: {
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function (this: VariableNodeInstance) {
        this.setVariableName(this._internal.name);
      }
    },
    value: {
      type: '*',
      displayName: 'Value',
      group: 'General',
      set: function (this: VariableNodeInstance, value: unknown) {
        this._internal.value = value;
        this.scheduleStore();
      }
    }
  },
  prototypeExtensions: {
    scheduleStore: function (this: VariableNodeInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(function (this: VariableNodeInstance) {
        this.hasScheduledStore = false;

        internal.variablesModel.set(internal.name, internal.value);
      });
    },
    setVariableName: function (this: VariableNodeInstance, name: string) {
      this._internal.name = name;
      this.flagOutputDirty('name');
      this.flagOutputDirty('value');
      this.sendSignalOnOutput('fetched');
    },
    _onNodeDeleted: function (this: VariableNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this._internal.variablesModel.off('change', this._internal.onModelChangedCallback);
    }
  }
};

const VariableNodeModule: NodeModule = {
  node: VariableNodeDefinition
};

export default VariableNodeModule;
