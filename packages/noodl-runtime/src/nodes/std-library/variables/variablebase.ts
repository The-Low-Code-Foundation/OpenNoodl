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
    /**
     * The selected `Treat empty as` option's {@link VariableEmptyOption.value}. NDA-003 §1:
     * Variables are nullable and `null` is the default empty value; this exists so authors
     * (and graphs written before the decision) can opt back into the old coercion.
     */
    treatEmptyAs: string;
  };
  setValueTo(value: unknown): void;
}

/**
 * One choice offered by a Variable's `Treat empty as` input.
 *
 * `coerce` is what a stored `null` becomes when this option is selected — the empty-value
 * contract's "type's empty value; stored value stays `null` unless `Treat empty as` says
 * otherwise" (`dev-docs/reference/EMPTY-VALUE-CONTRACT.md`). The first entry a node supplies
 * must be the `null` default, since `variablebase` reads `emptyOptions[0]` for both the
 * input's `default` and `initialize`'s seed.
 */
export interface VariableEmptyOption {
  /** Enum value stored in `_internal.treatEmptyAs` / the node's `treatEmptyAs` parameter. */
  value: string;
  label: string;
  /** What a stored `null` (or a cast that produced `NaN`) becomes under this option. */
  coerce: unknown;
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
  /**
   * Coerces a genuinely non-empty incoming value to the node's type. Runs on every store of
   * a value that is neither `null` nor `undefined` — those two are handled generically by
   * `createDefinition` per the empty-value contract, so `cast` never has to think about
   * them. If the coercion cannot produce a real value (e.g. `Number('abc')` is `NaN`),
   * return `NaN` — `createDefinition` bans it from ever being stored and substitutes the
   * `Treat empty as` value instead, the same as it would for `null`.
   */
  cast(value: unknown): unknown;
  /** Called on the instance after a *changed* store, for extra outputs (String's `length`). */
  onChanged?: (this: VariableNodeInstance) => void;
  /**
   * `Treat empty as` options for this type, first-to-default. NDA-003 §1: Variables are
   * nullable and `null` is the default empty value; this is the per-node back-compat input
   * that restores the pre-contract coercion (`0`, `''`, `false`, …) for graphs that want it.
   */
  emptyOptions: [VariableEmptyOption, ...VariableEmptyOption[]];
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
      this._internal.treatEmptyAs = args.emptyOptions[0].value;
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
        description:
          'The empty-value contract (dev-docs/reference/EMPTY-VALUE-CONTRACT.md): `undefined` ' +
          "abstains and leaves the Variable's stored value untouched. `null` is a real value — " +
          'it clears the Variable, is stored, and fires Changed. What "cleared" is stored as is ' +
          'controlled by `Treat empty as` (null by default).',
        set: function (this: VariableNodeInstance, value: unknown) {
          // `undefined` abstains everywhere (EMPTY-VALUE-CONTRACT.md corollary 4): an author
          // who sent no opinion should not blank out a value pending behind a disconnected
          // `saveValue`, any more than they should overwrite `currentValue` directly.
          if (value === undefined) return;

          if (this.isInputConnected('saveValue') === false) {
            this.setValueTo(value);
          } else {
            this._internal.latestValue = value;
          }
        }
      },
      treatEmptyAs: {
        type: {
          name: 'enum',
          enums: args.emptyOptions.map((option) => ({ label: option.label, value: option.value })),
          allowEditOnly: true
        },
        displayName: 'Treat empty as',
        group: 'Advanced',
        default: args.emptyOptions[0].value,
        description:
          'Back-compat for graphs written before Variables were nullable. `null` (default) ' +
          'keeps a cleared value distinguishable from a real ' +
          (args.emptyOptions[1] ? JSON.stringify(args.emptyOptions[1].coerce) : 'empty value') +
          '. Choosing another option restores the pre-NDA-003 coercion for authors who relied on it.',
        set: function (this: VariableNodeInstance, value: unknown) {
          this._internal.treatEmptyAs = value as string;
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
        description:
          'Can be `null` — a cleared Variable (see `value`\'s description) stores and emits ' +
          'null by default, not this type\'s zero value, unless `Treat empty as` says otherwise.',
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
        // `undefined` abstains (EMPTY-VALUE-CONTRACT.md corollary 4). The `value` input
        // already filters it before calling in, but `saveValue` can also reach here with a
        // pending `latestValue` that was never given an opinion (`initialize` seeds it `0`,
        // which is a real value, not `undefined` — this guard is for completeness per "cast:
        // not reached — if reached, abstain" in the contract's table, not a load-bearing path
        // today).
        if (value === undefined) return;

        // `null` maps to the type's empty value (contract corollary 2) rather than through
        // `args.cast`, which never has to think about it. The empty value defaults to `null`
        // itself — Variables are nullable — unless `Treat empty as` selects the legacy
        // coercion.
        const emptyOption =
          args.emptyOptions.find((option) => option.value === this._internal.treatEmptyAs) ?? args.emptyOptions[0];

        let casted: unknown;
        if (value === null) {
          casted = emptyOption.coerce;
        } else {
          casted = args.cast(value);
          // `NaN` is banned as a stored value outright (contract corollary 2): `NaN !== NaN`
          // breaks the `changed` guard below permanently, reporting a change on every
          // subsequent set forever. A cast that could not produce a real value is treated the
          // same as an explicit clear.
          if (typeof casted === 'number' && Number.isNaN(casted)) {
            casted = emptyOption.coerce;
          }
        }

        // NDA-002 §3 (corpus R7). The `!==` guard is right and stays — setting a Variable to
        // the value it already holds is not a change. What was wrong is that `initialize`
        // seeds `currentValue` with `startValue`, and a seeded value is indistinguishable
        // from one the author stored: wiring "set this String to '', then react" fired
        // nothing, for ever, because `''` is where the node started. The contract requires
        // that the guard compare against what the *author* last observed, and that "has been
        // set" be tracked explicitly rather than inferred from equality.
        const changed = !this._internal.hasBeenSet || this._internal.currentValue !== casted;
        this._internal.currentValue = casted;
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
