'use strict';

import { Node } from '@noodl/runtime';
import Model from '@noodl/runtime/src/model';
import type {
  InspectInfo,
  ModelChangeEvent,
  ModelLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

/**
 * `this` inside the deprecated Variable node.
 *
 * Shares its storage with the current Variable node: both keep every project
 * variable as one property of the single record keyed `'--ndl--global-variables'`,
 * which is what makes a Set Variable anywhere reach a Variable node reading that
 * name — including across the two generations.
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
  name: 'Variable',
  docs: 'https://docs.noodl.net/nodes/data/variable',
  category: 'Data',
  usePortAsLabel: 'name',
  color: 'data',
  deprecated: true, // use newvariable instead
  initialize: function (this: VariableNodeInstance) {
    const _this = this;
    const internal = this._internal;

    this._internal.onModelChangedCallback = function (args: ModelChangeEvent) {
      if (!_this.isInputConnected('fetch') && args.name === internal.name) {
        _this.sendSignalOnOutput('changed');
        _this.flagOutputDirty('value');
      }
    };

    internal.variablesModel = Model.get('--ndl--global-variables');
    internal.variablesModel.on('change', this._internal.onModelChangedCallback);
  },
  getInspectInfo(this: VariableNodeInstance): InspectInfo {
    // Wrapped as a value entry, the same correction DEBT-006 applied to
    // `variablenode2`: the raw value only rendered for string variables — numbers,
    // booleans and objects showed nothing at all (§13.3 / §17.7).
    if (this._internal.name) {
      return [{ type: 'value', value: this._internal.variablesModel.get(this._internal.name) }];
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
    store: {
      displayName: 'Set',
      group: 'Actions',
      valueChangedToTrue: function (this: VariableNodeInstance) {
        this.scheduleStore();
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
        if (this.isInputConnected('store') === false) {
          this.scheduleStore();
        }
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
        this.sendSignalOnOutput('stored');
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
