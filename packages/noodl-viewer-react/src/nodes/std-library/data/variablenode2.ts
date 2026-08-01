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
    /** Why the last write was refused; the `Error` output reads this. */
    lastError?: string;
    variablesModel: ModelLike;
    onModelChangedCallback(args: ModelChangeEvent): void;
  };
  hasScheduledStore?: boolean;
  scheduleStore(): void;
  setVariableName(name: string): void;
  reportFailure(code: string, message: string): void;
}

/** NDA-012 (Data) — `Set Variable`'s code, for the same defect. Also the editor's warning key. */
const NO_NAME_ERROR_CODE = 'variable/no-name';

const VariableNodeDefinition: NodeDefinitionOptions = {
  name: 'Variable2',
  displayNodeName: 'Variable',
  docs: 'https://docs.noodl.net/nodes/data/variable/variable-node',
  category: 'Data',
  usePortAsLabel: 'name',
  color: 'data',
  // NDA-017 §2. Not in the spec's twelve-row table; identical idiom. Distinct from the
  // *runtime* Variable nodes (`variablebase.ts`), whose control signal is `Set` and whose
  // governed input is `Value` — here it is `Fetch`, and what it governed is which variable
  // the node is looking at plus whether it notices that variable changing elsewhere.
  runOnValueChange: {
    controlSignal: 'fetch',
    inputs: ['name'],
    sources: [{ name: 'variable', displayName: 'Variable changes' }]
  },
  initialize: function (this: VariableNodeInstance) {
    const internal = this._internal;

    this._internal.onModelChangedCallback = (args: ModelChangeEvent) => {
      // Was `if (!this.isInputConnected('fetch') && …)`.
      if (this.shouldRunOnValueChange('variable') && args.name === internal.name) {
        this.sendSignalOnOutput('changed');
        this.flagOutputDirty('value');
      }
    };

    internal.variablesModel = Model.get('--ndl--global-variables');
    internal.variablesModel.on('change', this._internal.onModelChangedCallback);
  },
  getInspectInfo(this: VariableNodeInstance): InspectInfo {
    // Wrapped as a value entry — the raw value only rendered for string
    // variables; numbers, booleans and objects showed nothing in the editor's
    // inspector popup (DEBT-006, PLAT-003 NOTES §13.3 / §17.7 #4).
    if (this._internal.name) {
      return [{ type: 'value', value: this._internal.variablesModel.get(this._internal.name) }];
    }

    return '[No value set]';
  },
  outputs: {
    name: {
      type: 'string',
      displayName: 'Name',
      description: 'The variable name this node is currently bound to',
      group: 'General',
      getter: function (this: VariableNodeInstance) {
        return this._internal.name;
      }
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      description: 'Fires when the named variable is written from anywhere in the app',
      group: 'Events'
    },
    fetched: {
      type: 'signal',
      displayName: 'Fetched',
      description: 'Fires once Fetch has rebound this node and Value is up to date',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      description: 'Fires when a value arrived but could not be stored because no Name is set',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the last write was refused, in one sentence; empty until something fails',
      group: 'Events',
      getter: function (this: VariableNodeInstance) {
        return this._internal.lastError;
      }
    },
    value: {
      type: '*',
      displayName: 'Value',
      description: 'Current contents of the named variable, or empty until something writes it',
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
      description: 'Which app-wide variable this node reads and writes',
      group: 'General',
      set: function (this: VariableNodeInstance, value: string) {
        if (this.shouldRunOnValueChange('name')) this.setVariableName(value);
        else {
          this._internal.name = value; // Wait to fetch data
          this.flagOutputDirty('name');
        }
      }
    },
    fetch: {
      displayName: 'Fetch',
      description:
        'Re-reads the variable named by Name and refreshes Value. This is additional to Name rebinding on change and to changes being announced; untick either under Run On Value Change to stop it',
      group: 'Actions',
      valueChangedToTrue: function (this: VariableNodeInstance) {
        this.setVariableName(this._internal.name);
      }
    },
    value: {
      type: '*',
      displayName: 'Value',
      description: 'Stores this value in the named variable as soon as it arrives; refused, loudly, when Name is empty',
      group: 'General',
      set: function (this: VariableNodeInstance, value: unknown) {
        this._internal.value = value;
        this.scheduleStore();
      }
    }
  },
  prototypeExtensions: {
    reportFailure: function (this: VariableNodeInstance, code: string, message: string) {
      this._internal.lastError = message;
      this.raiseRuntimeError(code, message);
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');
    },
    scheduleStore: function (this: VariableNodeInstance) {
      if (this.hasScheduledStore) return;
      this.hasScheduledStore = true;

      const internal = this._internal;
      this.scheduleAfterInputsHaveUpdated(function (this: VariableNodeInstance) {
        this.hasScheduledStore = false;

        /**
         * NDA-012 (Data) — NDA-004 §2's worst shape, still live in `Set Variable`'s twin.
         *
         * §2 fixed exactly this in `Set Variable` and did not look one file across. Measured here:
         * a `Variable` with no `Name` and something wired to `Value` called
         * `Model.set(undefined, value)`, which writes a key literally named `undefined` on the
         * shared `--ndl--global-variables` record — and then this node's own change listener saw
         * `args.name === internal.name` (both `undefined`), so it fired **`Changed`** and flagged
         * `Value` dirty for a write nothing can read. `Value`'s getter returns early when there is
         * no name, so not even this node can read back what it just stored.
         *
         * An empty string is the same mistake: `usePortAsLabel: 'name'` means an unnamed node
         * shows no label either way, and no other Variable node can bind to a nameless key.
         *
         * The refusal sits after `scheduleAfterInputsHaveUpdated`, so a `Name` and a `Value`
         * arriving in the same frame are both applied before it runs — the boot-path false
         * positive the Failure Contract warns about needs `Name` to arrive in a *later* frame
         * than `Value`, which no ordinary graph does.
         */
        if (internal.name === undefined || internal.name === null || internal.name === '') {
          this.reportFailure(
            NO_NAME_ERROR_CODE,
            'No variable name is set — the value was not stored anywhere a Variable node can read'
          );
          return;
        }

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
