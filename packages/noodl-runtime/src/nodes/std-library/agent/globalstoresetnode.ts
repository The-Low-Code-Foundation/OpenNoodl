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
}

const SetGlobalStoreNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.GlobalStore.Set',
  displayNodeName: 'Set Global Store',
  shortDesc: 'Writes a key in a named global store; every subscriber to that key reacts.',
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
      group: 'Store',
      default: 'app',
      set: function (this: SetGlobalStoreInstance, value: string) {
        this._internal.storeName = value === undefined || value === null || value === '' ? 'app' : String(value);
      }
    },
    key: {
      type: 'string',
      displayName: 'Key',
      group: 'Update',
      set: function (this: SetGlobalStoreInstance, value: string) {
        this._internal.key = value;
      }
    },
    value: {
      type: '*',
      displayName: 'Value',
      group: 'Update',
      set: function (this: SetGlobalStoreInstance, value: unknown) {
        this._internal.value = value;
      }
    },
    merge: {
      type: 'boolean',
      displayName: 'Merge Object',
      group: 'Update',
      default: false,
      set: function (this: SetGlobalStoreInstance, value: boolean) {
        this._internal.merge = !!value;
      }
    },
    transaction: {
      type: 'boolean',
      displayName: 'Batch With Others',
      group: 'Update',
      default: false,
      set: function (this: SetGlobalStoreInstance, value: boolean) {
        this._internal.transaction = !!value;
      }
    },
    set: {
      displayName: 'Set',
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
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
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
        this._internal.error = 'Key is required';
        this.flagOutputDirty('error');
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
        this._internal.error = String((error as Error).message || error);
        this.flagOutputDirty('error');
      }
    }
  }
};

const SetGlobalStoreModule: NodeModule = {
  node: SetGlobalStoreNodeDefinition
};

export = SetGlobalStoreModule;
