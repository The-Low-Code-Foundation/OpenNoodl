'use strict';

import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import { outcomeOutputs, reportOutcomes } from '@noodl/runtime/src/outcome';
import type {
  GraphNodeModel,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  OutcomeToken
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
    /**
     * ERG-001 §4 — one token per `Do`, drained by the deferred callback.
     *
     * An array rather than a single token because `hasScheduledStore` drops the *second* pulse's
     * work in an update pass, which is deliberate and is how "set the value, then press Do"
     * batches. It must not drop the second pulse's **outcome**: two presses are two invocations
     * and Rule 1 is about each of them. ⚠️ Created lazily here rather than in `initialize`.
     */
    pendingStoreOutcomes?: OutcomeToken[];
  };
  hasScheduledStore?: boolean;
  setValue(value: unknown): void;
  scheduleStore(): void;
  reportFailure(code: string, message: string, tokens: OutcomeToken[]): void;
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
    /**
     * ERG-001 §4. This node's `Done` already meant what the contract means — `scheduleStore` is
     * reached from the `Do` port and from nothing else — so it is not renamed and not
     * re-described. What it gained is `Completed`, and the routing of both terminal paths
     * through `reportOutcome` so neither can be emitted twice or skipped.
     *
     * ⚠️ **No `Unchanged`.** The write uses `forceChange: true` deliberately, so storing the
     * identical value still notifies every Variable node reading it. There is no no-op to
     * declare, and §5 must not expect a port here.
     */
    ...outcomeOutputs({
      done: 'Fires once the variable has been written and every Variable node reading it has been notified',
      failure: 'Fires when nothing was stored because no variable Name is set'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the write was refused, in one sentence; empty until something fails',
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
      description: 'Which app-wide variable to write; leaving it blank refuses the write rather than storing it somewhere unreadable',
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
      // NDA-012 (Data): the sentence says what is actually done, not what the labels imply.
      // Only Empty string, Boolean, Object and Array change the value; String, Number and Date
      // choose the Value port's declared type and leave what arrives on a wire untouched. Filed
      // rather than repaired — what `Date` should even produce is a decision.
      description:
        'Chooses the type of the Value port; Empty string stores "" and needs no Value, Object and ' +
        'Array accept an id as well as a value, and Boolean is coerced',
      default: '*',
      group: 'General',
      set: function (this: SetVariableInstance, value: SetVariableAs) {
        this._internal.setWith = value;
      }
    },
    do: {
      displayName: 'Do',
      description: 'Writes Value into the named variable, or fires Failure when no Name is set',
      group: 'Actions',
      valueChangedToTrue: function (this: SetVariableInstance) {
        // ERG-001 §4. Minted here, at the port, and nowhere else. `setValue` and the `name`
        // setter are value arrivals — nobody invoked anything — and a mint in either would
        // report `Done` on the boot path the moment a saved project applies its parameters.
        const internal = this._internal;
        if (!internal.pendingStoreOutcomes) internal.pendingStoreOutcomes = [];
        internal.pendingStoreOutcomes.push(this.beginOutcome());
        this.scheduleStore();
      }
    }
  },
  methods: {
    reportFailure: function (this: SetVariableInstance, code: string, message: string, tokens: OutcomeToken[]) {
      this._internal.lastError = message;
      this.flagOutputDirty('error');
      // The value is dirty first and the outcome is last: `reportOutcome` raises on the NDA-004
      // channel and then sends `Failure` and `Completed`, in that order.
      reportOutcomes(this, tokens, 'failure', { code, message });
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

        // Drained into a local before anything else can run, so a `Do` arriving later owns its
        // own batch rather than being settled by this one's answer.
        const tokens = internal.pendingStoreOutcomes || [];
        internal.pendingStoreOutcomes = [];

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
            'No variable name is set — the value was not stored anywhere a Variable node can read',
            tokens
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
        // The outcome is the last thing the action does — the write above has already landed and
        // every Variable node reading this name has already been notified.
        reportOutcomes(this, tokens, 'done');
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
