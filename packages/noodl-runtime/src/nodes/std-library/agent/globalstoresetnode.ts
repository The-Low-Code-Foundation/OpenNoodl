'use strict';

/**
 * Set Global Store — writes one key of a named store (AGENT-003).
 *
 * The write is deferred to the end of the frame with `scheduleAfterInputsHaveUpdated`, the
 * same pattern `Set Variable` uses, because `key`, `value` and the `set` signal all arrive
 * in one frame in no guaranteed order. Writing straight from the signal setter would read
 * whichever of them happened to land first.
 */
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule, OutcomeToken } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';
import { globalStoreManager } from './globalstore';

interface SetGlobalStoreInstance extends NodeInstance {
  _internal: {
    storeName: string;
    key?: string;
    value?: unknown;
    merge: boolean;
    transaction: boolean;
    error?: string;
    writeScheduled: boolean;
  };
  scheduleWrite(): void;
  /**
   * The outcome token travels as an argument rather than on `_internal`, so it cannot outlive
   * its invocation — which is the property that makes NV-iii's latched-first-result class
   * unrepresentable rather than merely absent.
   */
  doSet(outcome: OutcomeToken): void;
  reportFailure(outcome: OutcomeToken, message: string): void;
}

/** NDA-004 §2 — the matchable half of the failure pair. The bus keys by `code`. */
const SET_ERROR_CODE = 'global-store/set-failed';

const SetGlobalStoreNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.GlobalStore.Set',
  displayNodeName: 'Set Global Store',
  category: 'Data',
  color: 'data',
  usePortAsLabel: 'key',

  initialize: function (this: SetGlobalStoreInstance) {
    this._internal.storeName = 'app';
    this._internal.merge = false;
    this._internal.transaction = false;
    this._internal.writeScheduled = false;
  },

  getInspectInfo: function (this: SetGlobalStoreInstance): InspectInfo {
    if (!this._internal.key) return '[No key set]';
    return [
      { type: 'text', value: this._internal.storeName + '.' + this._internal.key },
      { type: 'value', value: globalStoreManager.getKey(this._internal.storeName, this._internal.key) }
    ];
  },

  inputs: {
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      description: 'Names the store to write; must match the Store Name of the Global Store node that owns it',
      group: 'Store',
      default: 'app',
      set: function (this: SetGlobalStoreInstance, value: string) {
        this._internal.storeName = value === undefined || value === null || value === '' ? 'app' : String(value);
      }
    },
    key: {
      type: 'string',
      displayName: 'Key',
      description: 'Key to write; a Set with no key is refused rather than dropped',
      group: 'Update',
      set: function (this: SetGlobalStoreInstance, value: string) {
        this._internal.key = value;
      }
    },
    value: {
      type: '*',
      displayName: 'Value',
      description: 'Value to write, of any type; null is stored as null and is not coerced to a blank string',
      group: 'Update',
      set: function (this: SetGlobalStoreInstance, value: unknown) {
        this._internal.value = value;
      }
    },
    merge: {
      type: 'boolean',
      displayName: 'Merge Object',
      description:
        'Shallow-merges into the existing value when both the old and the new value are plain objects, instead of replacing it',
      group: 'Update',
      default: false,
      set: function (this: SetGlobalStoreInstance, value: boolean) {
        this._internal.merge = !!value;
      }
    },
    transaction: {
      type: 'boolean',
      displayName: 'Batch With Others',
      description:
        'Holds the notification until the end of the current microtask so several writers in one turn produce a single change',
      group: 'Update',
      default: false,
      set: function (this: SetGlobalStoreInstance, value: boolean) {
        this._internal.transaction = !!value;
      }
    },
    set: {
      displayName: 'Set',
      description: 'Writes Value at Key, reading both as of the end of the current frame',
      group: 'Actions',
      valueChangedToTrue: function (this: SetGlobalStoreInstance) {
        this.scheduleWrite();
      }
    }
  },

  /**
   * ⚠️ **ERG-001 §4, and this is not a rename** — §0.2 Result 3.
   *
   * The port that used to be called `Completed` fired *inside* the `try` and the no-key guard
   * routed to `reportFailure` instead, so `Completed` and `Failure` were **mutually
   * exclusive**. That is the exact opposite of the contract's `Completed`, which fires after
   * all three outcomes. Adopting the reserved name in place would have silently inverted the
   * meaning of every wire an author had already drawn from it — the SR-ix class.
   *
   * So the existing port becomes `Done` (which is what it always meant: the write happened),
   * and a genuinely universal `Completed` is minted beside it.
   *
   * ⚠️ **No `Unchanged`, and it is a live candidate rather than a settled no.** `setKey`
   * ends in `Model.set` without `forceChange`, which does not notify when the value compares
   * equal — so re-writing a key with the value it already holds *is* a real no-op, of exactly
   * the shape §0.3's register collects. It is not added here because `setKey` returns `void`
   * and detecting it means changing that signature and reasoning about `merge`; §0.3 never
   * measured this node, and inventing the verdict from the shape of the code is the mistake
   * that section exists to prevent. Recorded in `ERG-001-S0-MEASUREMENT.md`.
   */
  outputs: {
    ...outcomeOutputs({
      done: 'Fires once the write has been applied and every subscriber has been told',
      // NDA-012 / NDA-004 §2. `Set` used to end on the `error` string and nothing else. `Set`
      // is an author `Do` (group `Actions`), so this cannot fire on the boot path.
      failure: 'Fires when the write could not be made, most often because Key is empty'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the last write failed; blank once a write succeeds',
      group: 'Error',
      getter: function (this: SetGlobalStoreInstance) {
        return this._internal.error;
      }
    }
  },

  methods: {
    scheduleWrite: function (this: SetGlobalStoreInstance) {
      if (this._internal.writeScheduled) return;
      this._internal.writeScheduled = true;
      // After the coalescing guard, so two `Set` pulses in one frame — which this node
      // deliberately collapses into one write — are one invocation with one outcome.
      const outcome = this.beginOutcome();

      this.scheduleAfterInputsHaveUpdated(function (this: SetGlobalStoreInstance) {
        this._internal.writeScheduled = false;
        this.doSet(outcome);
      });
    },

    doSet: function (this: SetGlobalStoreInstance, outcome: OutcomeToken) {
      const key = this._internal.key;

      if (!key) {
        // Reported rather than dropped: a Set node with no key is a graph the author has
        // half-finished, and silence is the worst way to tell them.
        this.reportFailure(outcome, 'Key is required');
        return;
      }

      try {
        if (this._internal.transaction) {
          globalStoreManager.deferNotifications(this._internal.storeName);
        }

        globalStoreManager.setKey(this._internal.storeName, key, this._internal.value, {
          merge: this._internal.merge
        });

        if (this._internal.error !== undefined) {
          this._internal.error = undefined;
          this.flagOutputDirty('error');
        }

        // Last, after the store has notified and `error` has been cleared.
        this.reportOutcome(outcome, 'done');
      } catch (error) {
        this.reportFailure(outcome, String((error as Error).message || error));
      }
    },

    /**
     * The one place a failed write is reported, on all three of the channels the Failure
     * Contract asks for: the `error` string an author can display, the `Failure` signal an
     * author can sequence off, and the runtime error bus, which is what reaches `On App Error`
     * in a deployed build where no editor is watching.
     *
     * ERG-001 §4 folded the last two into `reportOutcome`, which also mints the `Completed`
     * this path could never emit before.
     */
    reportFailure: function (this: SetGlobalStoreInstance, outcome: OutcomeToken, message: string) {
      this._internal.error = message;
      this.flagOutputDirty('error');
      this.reportOutcome(outcome, 'failure', { code: SET_ERROR_CODE, message });
    }
  }
};

const SetGlobalStoreModule: NodeModule = {
  node: SetGlobalStoreNodeDefinition
};

export = SetGlobalStoreModule;
