'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, PortTypeSpec } from '@noodl/types';

/**
 * What a Variable node's `this` carries.
 *
 * `currentValue` is the stored value and the one every output reads. `latestValue` is the
 * *pending* one: when `saveValue` is connected the `value` input stops writing through and
 * parks here instead, so the value only lands when Set fires. That is the whole of the
 * node's behaviour, and it is why the two fields cannot be collapsed into one.
 */
export interface VariableNodeInstance extends NodeInstance {
  _internal: {
    currentValue: unknown;
    latestValue: unknown;
    /**
     * Whether an author has ever stored into this Variable, as opposed to `initialize`
     * having seeded it. NDA-002 §3: the `!==` guard has to compare against what the author
     * last observed, and a seeded `startValue` was never observed.
     */
    hasBeenSet: boolean;
  };
  setValueTo(value: unknown): void;
}

/** What each concrete Variable node (Number, String, Boolean, Color) supplies. */
export interface VariableDefinitionArgs {
  name: string;
  docs?: string;
  shortDesc?: string;
  nodeDoubleClickAction?: NodeDefinitionOptions['nodeDoubleClickAction'];
  /**
   * The port type. Note this is the whole spec object, not a name — `inputs.value.type`
   * takes it verbatim while `outputs.savedValue.type` takes only its `name`, which is why
   * the two ports read differently below.
   */
  type: Extract<PortTypeSpec, { name: string }>;
  startValue: unknown;
  /** Coerces an incoming value to the node's type. Runs on every store, not on read. */
  cast(value: unknown): unknown;
  /** Called on the instance after a *changed* store, for extra outputs (String's `length`). */
  onChanged?: (this: VariableNodeInstance) => void;
}

export function createDefinition(args: VariableDefinitionArgs): NodeDefinitionOptions {
  return {
    name: args.name,
    docs: args.docs,
    shortDesc: args.shortDesc,
    nodeDoubleClickAction: args.nodeDoubleClickAction,
    category: 'Variables',
    initialize: function (this: VariableNodeInstance) {
      this._internal.currentValue = args.startValue;
      this._internal.latestValue = 0;
      this._internal.hasBeenSet = false;
    },
    getInspectInfo(this: VariableNodeInstance): InspectInfo {
      const type = args.type.name === 'color' ? 'color' : 'text';
      return [{ type, value: this._internal.currentValue }];
    },
    inputs: {
      value: {
        type: args.type,
        displayName: 'Value',
        default: args.startValue,
        set: function (this: VariableNodeInstance, value: unknown) {
          if (this.isInputConnected('saveValue') === false) {
            this.setValueTo(value);
          } else {
            this._internal.latestValue = value;
          }
        }
      },
      saveValue: {
        displayName: 'Set',
        valueChangedToTrue: function (this: VariableNodeInstance) {
          this.scheduleAfterInputsHaveUpdated(function (this: VariableNodeInstance) {
            this.setValueTo(this._internal.latestValue);
            this.sendSignalOnOutput('stored');
          });
        }
      }
    },
    outputs: {
      savedValue: {
        type: args.type.name,
        displayName: 'Value',
        getter: function (this: VariableNodeInstance) {
          return this._internal.currentValue;
        }
      },
      changed: {
        type: 'signal',
        displayName: 'Changed'
      },
      stored: {
        type: 'signal',
        displayName: 'Stored'
      }
    },
    prototypeExtensions: {
      setValueTo: function (this: VariableNodeInstance, value: unknown) {
        value = args.cast(value);
        // NDA-002 §3 (corpus R7). The `!==` guard is right and stays — setting a Variable to
        // the value it already holds is not a change. What was wrong is that `initialize`
        // seeds `currentValue` with `startValue`, and a seeded value is indistinguishable
        // from one the author stored: wiring "set this String to '', then react" fired
        // nothing, for ever, because `''` is where the node started. The contract requires
        // that the guard compare against what the *author* last observed, and that "has been
        // set" be tracked explicitly rather than inferred from equality.
        const changed = !this._internal.hasBeenSet || this._internal.currentValue !== value;
        this._internal.currentValue = value;
        this._internal.hasBeenSet = true;

        if (changed) {
          this.flagOutputDirty('savedValue');
          this.sendSignalOnOutput('changed');
          args.onChanged && args.onChanged.call(this);
        }
      }
    }
  };
}

/**
 * Exported as an ES default rather than with `export =`, unlike the rest of this package.
 *
 * `variablebase` is the one runtime node module a *viewer* TypeScript file imports —
 * `noodl-viewer-react/src/nodes/std-library/variables/color.ts` builds the Color node from
 * it. That pulls this file into the viewer's `module: es6` program, where `export =` is a
 * compile error (TS1203), the same boundary slice 4 hit with `src/utils`. The runtime's own
 * consumers are `.ts` too and import it the same way, so nothing needs an interop unwrap.
 */
export default { createDefinition };
