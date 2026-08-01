'use strict';

/**
 * Set Global Store — writes one key of a named store (AGENT-003).
 *
 * The write is deferred to the end of the frame with `scheduleAfterInputsHaveUpdated`, the
 * same pattern `Set Variable` uses, because `key`, `value` and the `set` signal all arrive
 * in one frame in no guaranteed order. Writing straight from the signal setter would read
 * whichever of them happened to land first.
 */
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

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
  doSet(): void;
  reportFailure(message: string): void;
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

  outputs: {
    completed: {
      type: 'signal',
      displayName: 'Completed',
      description: 'Fires once the write has been applied and every subscriber has been told',
      group: 'Events'
    },
    // NDA-012 / NDA-004 §2. `Set` used to end on the `error` string and nothing else, so an
    // author could wire `Completed` and had nothing at all to sequence off a failure. `Set` is
    // an author `Do` (group `Actions`), so this cannot fire on the boot path.
    failure: {
      type: 'signal',
      displayName: 'Failure',
      description: 'Fires when the write could not be made, most often because Key is empty',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the last write failed; blank once a write succeeds',
      group: 'Events',
      getter: function (this: SetGlobalStoreInstance) {
        return this._internal.error;
      }
    }
  },

  methods: {
    scheduleWrite: function (this: SetGlobalStoreInstance) {
      if (this._internal.writeScheduled) return;
      this._internal.writeScheduled = true;

      this.scheduleAfterInputsHaveUpdated(function (this: SetGlobalStoreInstance) {
        this._internal.writeScheduled = false;
        this.doSet();
      });
    },

    doSet: function (this: SetGlobalStoreInstance) {
      const key = this._internal.key;

      if (!key) {
        // Reported rather than dropped: a Set node with no key is a graph the author has
        // half-finished, and silence is the worst way to tell them.
        this.reportFailure('Key is required');
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

        this.sendSignalOnOutput('completed');
      } catch (error) {
        this.reportFailure(String((error as Error).message || error));
      }
    },

    /**
     * The one place a failed write is reported, on all three of the channels the Failure
     * Contract asks for: the `error` string an author can display, the `Failure` signal an
     * author can sequence off, and the runtime error bus, which is what reaches `On App Error`
     * in a deployed build where no editor is watching.
     */
    reportFailure: function (this: SetGlobalStoreInstance, message: string) {
      this._internal.error = message;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');
      this.raiseRuntimeError(SET_ERROR_CODE, message);
    }
  }
};

const SetGlobalStoreModule: NodeModule = {
  node: SetGlobalStoreNodeDefinition
};

export = SetGlobalStoreModule;
