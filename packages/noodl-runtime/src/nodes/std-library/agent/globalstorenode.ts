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

  /**
   * Attaches once the node is in a scope, whether or not anything was authored.
   *
   * NDA-012: every input on this node has a usable default, and `registerInput` writes a
   * declared `default` straight into `_inputValues` (`node.ts:116-117`) without calling the
   * setter — `NodeScope.setNodeParameters` queues only the keys the *model* carries
   * (`nodescope.ts:148-157`). So an author who accepted `app` wrote no parameter, no setter
   * ran, `scheduleSetup` was never called, and this node configured nothing and subscribed to
   * nothing. It was invisible because the `State` output's getter goes straight to the
   * manager — the value read correctly and only the reactions were missing.
   *
   * `nodeScopeDidInitialize` rather than `initialize`, because it runs after the whole scope's
   * connections are in place, which is what the `ready` signal is supposed to mean.
   * `scheduleSetup` is idempotent, so an authored `storeName` still produces one attach.
   */
  nodeScopeDidInitialize: function (this: GlobalStoreNodeInstance) {
    this.scheduleSetup();
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
      description:
        'Names the store this node reads; several nodes may share a name and every one of them sees the same state',
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
      description:
        'Keys to fill in on stores that do not already have them, as an object or as JSON text; live values are never overwritten',
      group: 'Store',
      set: function (this: GlobalStoreNodeInstance, value: unknown) {
        this._internal.initialState = value;
        this.scheduleSetup();
      }
    },
    persist: {
      type: 'boolean',
      displayName: 'Persist',
      description:
        'Keeps the store in browser storage so it survives a reload; under SSR and cloud functions there is no storage and Error says so',
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
      description: 'Name to store the persisted copy under, defaulting to Store Name; ignored unless Persist is on',
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
      description: 'The whole store as a live object; write through Set Global Store rather than mutating it',
      group: 'Data',
      getter: function (this: GlobalStoreNodeInstance) {
        return globalStoreManager.getState(this._internal.storeName);
      }
    },
    changedKeys: {
      type: 'string',
      displayName: 'Changed Keys',
      description: 'Comma-separated keys that changed in the notification that fired State Changed',
      group: 'Data',
      getter: function (this: GlobalStoreNodeInstance) {
        return this._internal.changedKeys;
      }
    },
    stateChanged: {
      type: 'signal',
      displayName: 'State Changed',
      description: 'Fires once per commit to the store, however many keys that commit touched',
      group: 'Events'
    },
    ready: {
      type: 'signal',
      displayName: 'Ready',
      description: 'Fires once the store has been created and configured, so a graph can sequence its first read',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      description:
        'What the store could not do, prefixed by the phase it happened in: persist, load, clone or subscriber',
      group: 'Events',
      getter: function (this: GlobalStoreNodeInstance) {
        return this._internal.error;
      }
    },
    storeId: {
      type: 'string',
      displayName: 'Store Id',
      description:
        'The id of the Model backing this store, so a Function node can reach the same state through Noodl.Object',
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
