'use strict';

import type { InspectInfo, NodeDefinitionOptions, NodeInstance, PortTypeSpec } from '@noodl/types';

import { outcomeInputs, outcomeOutputs } from '../../../outcome';

/**
 * ERG-001 §3/§4 — one options object, spread into both plugs.
 *
 * Declared once because {@link outcomeInputs} derives the `Treat Unchanged as` enum from the
 * *same* description set that builds the outputs: no `failure` here means no `Failure` option
 * offered, so an author cannot select an outcome this node has nowhere to send.
 */
const VARIABLE_OUTCOME = {
  done: 'Fires when a Set stored a value the Variable was not already holding',
  unchanged:
    'Fires when a Set stored the value it already held, so nothing changed. ⚠️ With Value ' +
    'left ticked under Run On Value Change this is the common case, because Value has ' +
    'already stored by the time Set fires'
};

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
  /**
   * @returns whether the stored value actually changed — `Done` versus `Unchanged`.
   *
   * ⚠️ It was `void`, and the answer was computed and discarded. ERG-001: §0.3 names this
   * family as the canonical `Unchanged`, and NDA-002 §3's `changed` guard has known the answer
   * since it was written. Returning it is what lets `Set` report it.
   */
  setValueTo(value: unknown): boolean;
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
    nodeDoubleClickAction: args.nodeDoubleClickAction,
    category: 'Variables',
    // NDA-017 §2. `Set` is this family's control signal.
    //
    // Constraint 4 is deliberately *not* applied here, and the distinction is worth stating:
    // a Variable is a store, not an evaluator. `savedValue` before anything has been set
    // reports `args.startValue`, which is the type's declared starting value and a real
    // answer the author can see in the panel — not a number the node invented to stand in for
    // "nothing has arrived". Abstaining with `null` would be the fabrication here.
    runOnValueChange: { controlSignal: 'saveValue', inputs: ['value'] },
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
      /*
       * SIG-003 — the reported case, and the worst one in the library.
       *
       * `value`, `saveValue`, `savedValue` and `changed` — the four ports that
       * are the entire point of a Variable — declared no group, so all four fell
       * to `Other`, while `treatEmptyAs`, which is pure NDA-003 back-compat, was
       * the only port with a heading. A beginner opening a String variable saw a
       * category called *Advanced* and a bucket called *Other* containing
       * everything they came for.
       */
      value: {
        group: 'Values',
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

          // NDA-017 §2. `latestValue` is now recorded unconditionally, and that is a fix in
          // its own right rather than tidying. It used to be written *only* on the branch
          // where the value was not stored, which was safe while the two branches were
          // mutually exclusive for the life of the node — `Set` connected meant the store
          // branch never ran. With `Set` additive both can happen, and a node that stored
          // eagerly while leaving `latestValue` behind would revert to a stale value the next
          // time `Set` was pulsed.
          // DEF-046: read before the unconditional write above replaces it.
          const previous = this._internal.latestValue;
          this._internal.latestValue = value;

          // Was `if (this.isInputConnected('saveValue') === false)`.
          if (this.shouldRunOnValueChanged('value', previous, value)) {
            this.setValueTo(value);
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
        group: 'Actions', // SIG-003 — a signal input is an Action you cause
        displayName: 'Set',
        description:
          'Stores the latest value now. This is additional to Value storing on change; untick Value under Run On Value Change to stop that',
        valueChangedToTrue: function (this: VariableNodeInstance) {
          // ERG-001 §4. Minted at the port and carried through the deferral, so only an
          // author's `Set` reports — `Value` writing straight through under Run On Value
          // Change reaches `setValueTo` too, and that is not an invocation of this port.
          const outcome = this.beginOutcome();
          this.scheduleAfterInputsHaveUpdated(function (this: VariableNodeInstance) {
            // `setValueTo` flags `savedValue` dirty and fires `Changed` before returning, so
            // every value the outcome is about is already on the wire when it goes out.
            const changed = this.setValueTo(this._internal.latestValue);
            this.reportOutcome(outcome, changed ? 'done' : 'unchanged');
          });
        }
      },

      // ERG-001 §3 — the contract's one sanctioned setting, on the family the spec names as
      // its first home. ⚠️ Two options here, not three: this node has no `Failure` port, and
      // `outcomeInputs` derives that from `VARIABLE_OUTCOME` rather than being told twice.
      ...outcomeInputs(VARIABLE_OUTCOME)
    },
    outputs: {
      savedValue: {
        group: 'Values', // SIG-003
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
        group: 'Events', // SIG-003 — a signal output is an Event that happened
        type: 'signal',
        displayName: 'Changed',
        description:
          'Fires whenever the stored value actually changed, however it was reached — including ' +
          'Value writing straight through under Run On Value Change. It is a value-level event, ' +
          'not the outcome of a Set'
      },

      // ERG-001 §4. ⚠️ `Stored` is *removed* rather than renamed, and it is the one port in
      // the library whose meaning was already exactly `Completed`: it fired after every `Set`
      // whatever happened. §0.2 Result 3 found the mirror image twice — a `Completed` that
      // meant "succeeded" — and had to rename those; here the reserved name fits, so keeping
      // both would have shipped two ports that always fire together.
      //
      // No `Failure`: `setValueTo` casts or substitutes the `Treat empty as` value, and never
      // refuses. A node that cannot fail gets no `Failure` port.
      ...outcomeOutputs(VARIABLE_OUTCOME)
    },
    prototypeExtensions: {
      setValueTo: function (this: VariableNodeInstance, value: unknown): boolean {
        // `undefined` abstains (EMPTY-VALUE-CONTRACT.md corollary 4). The `value` input
        // already filters it before calling in, but `saveValue` can also reach here with a
        // pending `latestValue` that was never given an opinion (`initialize` seeds it `0`,
        // which is a real value, not `undefined` — this guard is for completeness per "cast:
        // not reached — if reached, abstain" in the contract's table, not a load-bearing path
        // today).
        if (value === undefined) return false;

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

        return changed;
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
