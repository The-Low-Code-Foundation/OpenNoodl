'use strict';

/**
 * Global Store — creates or attaches to a named store and reports its state (AGENT-003).
 *
 * The node is a *view*: it does not own the store, and several of them pointing at the same
 * name is normal and correct. Attaching is idempotent, which is why `initialState` fills in
 * only the keys the store does not already have — a store that has been live for a while
 * must not be reset to defaults because a component holding one of these remounted.
 */
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { globalStoreManager, StoreChange, StoreError, Unsubscribe } from './globalstore';

import Node = require('../../../node');

interface GlobalStoreNodeInstance extends NodeInstance {
  _internal: {
    storeName: string;
    initialState?: unknown;
    persist?: boolean;
    storageKey?: string;
    /** Comma-separated list of the keys that changed in the last notification. */
    changedKeys: string;
    error?: string;
    unsubscribe: Unsubscribe | null;
    unsubscribeError: Unsubscribe | null;
    setupScheduled: boolean;
  };
  scheduleSetup(): void;
  setupStore(): void;
  teardown(): void;
}

const GlobalStoreNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.GlobalStore',
  displayNodeName: 'Global Store',
  shortDesc: 'Shared, observable state that any component can read and write by name.',
  category: 'Data',
  color: 'data',
  usePortAsLabel: 'storeName',

  initialize: function (this: GlobalStoreNodeInstance) {
    this._internal.storeName = 'app';
    this._internal.changedKeys = '';
    this._internal.unsubscribe = null;
    this._internal.unsubscribeError = null;
    this._internal.setupScheduled = false;
  },

  getInspectInfo: function (this: GlobalStoreNodeInstance): InspectInfo {
    return [
      { type: 'text', value: 'Store: ' + this._internal.storeName },
      { type: 'value', value: globalStoreManager.getState(this._internal.storeName) }
    ];
  },

  inputs: {
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      group: 'Store',
      default: 'app',
      set: function (this: GlobalStoreNodeInstance, value: string) {
        this._internal.storeName = value === undefined || value === null || value === '' ? 'app' : String(value);
        this.scheduleSetup();
      }
    },
    initialState: {
      type: 'object',
      displayName: 'Initial State',
      group: 'Store',
      set: function (this: GlobalStoreNodeInstance, value: unknown) {
        this._internal.initialState = value;
        this.scheduleSetup();
      }
    },
    persist: {
      type: 'boolean',
      displayName: 'Persist',
      group: 'Store',
      default: false,
      set: function (this: GlobalStoreNodeInstance, value: boolean) {
        this._internal.persist = !!value;
        this.scheduleSetup();
      }
    },
    storageKey: {
      type: 'string',
      displayName: 'Storage Key',
      group: 'Store',
      set: function (this: GlobalStoreNodeInstance, value: string) {
        this._internal.storageKey = value;
        this.scheduleSetup();
      }
    }
  },

  outputs: {
    state: {
      type: 'object',
      displayName: 'State',
      group: 'Data',
      getter: function (this: GlobalStoreNodeInstance) {
        return globalStoreManager.getState(this._internal.storeName);
      }
    },
    changedKeys: {
      type: 'string',
      displayName: 'Changed Keys',
      group: 'Data',
      getter: function (this: GlobalStoreNodeInstance) {
        return this._internal.changedKeys;
      }
    },
    stateChanged: {
      type: 'signal',
      displayName: 'State Changed',
      group: 'Events'
    },
    ready: {
      type: 'signal',
      displayName: 'Ready',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter: function (this: GlobalStoreNodeInstance) {
        return this._internal.error;
      }
    },
    storeId: {
      type: 'string',
      displayName: 'Store Id',
      group: 'Info',
      getter: function (this: GlobalStoreNodeInstance) {
        return globalStoreManager.modelIdFor(this._internal.storeName);
      }
    }
  },

  methods: {
    /**
     * Configures once per frame however many inputs arrived.
     *
     * Without this, setting `storeName`, `initialState` and `persist` in the same frame
     * would attach three times and, worse, attach to the *old* store name with the new
     * initial state before the name setter had run.
     */
    scheduleSetup: function (this: GlobalStoreNodeInstance) {
      if (this._internal.setupScheduled) return;
      this._internal.setupScheduled = true;

      this.scheduleAfterInputsHaveUpdated(function (this: GlobalStoreNodeInstance) {
        this._internal.setupScheduled = false;
        this.setupStore();
      });
    },

    setupStore: function (this: GlobalStoreNodeInstance) {
      this.teardown();

      const storeName = this._internal.storeName;

      this._internal.unsubscribeError = globalStoreManager.onError(storeName, (error: StoreError) => {
        this._internal.error = `${error.phase}: ${error.message}`;
        this.flagOutputDirty('error');
      });

      globalStoreManager.configureStore(storeName, {
        initialState: this._internal.initialState as never,
        persist: this._internal.persist,
        storageKey: this._internal.storageKey
      });

      this._internal.unsubscribe = globalStoreManager.subscribe(storeName, (change: StoreChange) => {
        this._internal.changedKeys = change.changedKeys.join(',');
        this.flagOutputDirty('state');
        this.flagOutputDirty('changedKeys');
        this.sendSignalOnOutput('stateChanged');
      });

      this.flagOutputDirty('state');
      this.flagOutputDirty('storeId');
      this.sendSignalOnOutput('ready');
    },

    teardown: function (this: GlobalStoreNodeInstance) {
      if (this._internal.unsubscribe) {
        this._internal.unsubscribe();
        this._internal.unsubscribe = null;
      }
      if (this._internal.unsubscribeError) {
        this._internal.unsubscribeError();
        this._internal.unsubscribeError = null;
      }
    },

    /**
     * A store outlives the nodes that view it, so an unsubscribed-on-delete rule is not
     * optional: a retained subscriber holds the node, its closure and its whole component
     * for the life of the app, and fires signals on a node nobody can see.
     */
    _onNodeDeleted: function (this: GlobalStoreNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.teardown();
    }
  }
};

const GlobalStoreNodeModule: NodeModule = {
  node: GlobalStoreNodeDefinition
};

export = GlobalStoreNodeModule;
