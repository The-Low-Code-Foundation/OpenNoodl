'use strict';

/**
 * Subscribe to Store — watches some or all of a named store (AGENT-003).
 *
 * This is the node that replaces a Receive Event per interested component. Leaving `keys`
 * blank watches the whole store; naming keys means the `changed` signal fires only when one
 * of those keys actually changed, which is the difference between a store that scales and
 * one where every view re-renders on every write.
 */
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { globalStoreManager, StoreChange, StoreState, Unsubscribe } from './globalstore';

import Node = require('../../../node');

interface SubscribeInstance extends NodeInstance {
  _internal: {
    storeName: string;
    /** As authored: a comma-separated list, or blank for "everything". */
    keys?: string;
    keyList: string[];
    previousValue?: unknown;
    changedKeys: string;
    unsubscribe: Unsubscribe | null;
    setupScheduled: boolean;
  };
  scheduleSetup(): void;
  setupSubscription(): void;
  teardown(): void;
  projectValue(state: StoreState): unknown;
}

/** Splits the authored `keys` string. Blank, whitespace and stray commas yield "all keys". */
function parseKeys(keys: string | undefined): string[] {
  if (!keys) return [];
  return String(keys)
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}

const SubscribeToStoreNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.GlobalStore.Subscribe',
  displayNodeName: 'Subscribe to Store',
  shortDesc: 'Reacts when named keys of a global store change, without any wiring between components.',
  category: 'Data',
  color: 'data',
  usePortAsLabel: 'keys',

  initialize: function (this: SubscribeInstance) {
    this._internal.storeName = 'app';
    this._internal.keyList = [];
    this._internal.changedKeys = '';
    this._internal.unsubscribe = null;
    this._internal.setupScheduled = false;
  },

  /**
   * Subscribes once the node is in a scope, whether or not anything was authored.
   *
   * NDA-012, same shape as the Global Store node: `storeName` has a default and `keys` is
   * legitimately blank ("watch everything"), so a node configured entirely by defaults never
   * ran a setter, never called `scheduleSetup`, and never subscribed. `Changed` could not
   * fire — the node whose only job is to react reacted to nothing.
   */
  nodeScopeDidInitialize: function (this: SubscribeInstance) {
    this.scheduleSetup();
  },

  getInspectInfo: function (this: SubscribeInstance): InspectInfo {
    return [
      {
        type: 'text',
        value: 'Store: ' + this._internal.storeName + (this._internal.keyList.length ? '' : ' (all keys)')
      },
      { type: 'value', value: this.projectValue(globalStoreManager.getState(this._internal.storeName)) }
    ];
  },

  inputs: {
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      description: 'Names the store to watch; must match the Store Name of the Global Store node that owns it',
      group: 'Store',
      default: 'app',
      set: function (this: SubscribeInstance, value: string) {
        this._internal.storeName = value === undefined || value === null || value === '' ? 'app' : String(value);
        this.scheduleSetup();
      }
    },
    keys: {
      type: 'string',
      displayName: 'Keys',
      description: 'Comma-separated keys to watch; leave blank to react to every change in the store',
      group: 'Subscribe',
      tooltip: 'Comma-separated keys to watch. Leave blank to react to every change in the store.',
      set: function (this: SubscribeInstance, value: string) {
        this._internal.keys = value;
        this._internal.keyList = parseKeys(value);
        this.scheduleSetup();
      }
    }
  },

  outputs: {
    value: {
      type: '*',
      displayName: 'Value',
      description:
        'The watched value: one key gives that key, several give an object of just those keys, none gives the whole store',
      group: 'Data',
      getter: function (this: SubscribeInstance) {
        return this.projectValue(globalStoreManager.getState(this._internal.storeName));
      }
    },
    previousValue: {
      type: '*',
      displayName: 'Previous Value',
      description: 'The same projection as Value, as it was immediately before the change that fired Changed',
      group: 'Data',
      getter: function (this: SubscribeInstance) {
        return this._internal.previousValue;
      }
    },
    changedKeys: {
      type: 'string',
      displayName: 'Changed Keys',
      description: 'Comma-separated keys that changed in the notification that fired Changed',
      group: 'Data',
      getter: function (this: SubscribeInstance) {
        return this._internal.changedKeys;
      }
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
      description: 'Fires when one of the watched keys changed, and not for a commit that touched only other keys',
      group: 'Events'
    }
  },

  methods: {
    scheduleSetup: function (this: SubscribeInstance) {
      if (this._internal.setupScheduled) return;
      this._internal.setupScheduled = true;

      this.scheduleAfterInputsHaveUpdated(function (this: SubscribeInstance) {
        this._internal.setupScheduled = false;
        this.setupSubscription();
      });
    },

    setupSubscription: function (this: SubscribeInstance) {
      this.teardown();

      this._internal.unsubscribe = globalStoreManager.subscribe(
        this._internal.storeName,
        (change: StoreChange) => {
          // Computed here, not in the getter: `previousState` exists only for the duration
          // of this notification.
          this._internal.previousValue = this.projectValue(change.previousState);
          this._internal.changedKeys = change.changedKeys.join(',');

          this.flagOutputDirty('value');
          this.flagOutputDirty('previousValue');
          this.flagOutputDirty('changedKeys');
          this.sendSignalOnOutput('changed');
        },
        this._internal.keyList
      );

      this.flagOutputDirty('value');
    },

    teardown: function (this: SubscribeInstance) {
      if (this._internal.unsubscribe) {
        this._internal.unsubscribe();
        this._internal.unsubscribe = null;
      }
    },

    /**
     * One key yields that key's value; several yield an object of just those keys; none
     * yields the whole state. The single-key case matters — an author watching `count`
     * wants the number, not `{ count: n }`.
     */
    projectValue: function (this: SubscribeInstance, state: StoreState) {
      const keys = this._internal.keyList;
      if (keys.length === 0) return state;
      if (keys.length === 1) return state[keys[0]];

      const projected: StoreState = {};
      for (const key of keys) projected[key] = state[key];
      return projected;
    },

    _onNodeDeleted: function (this: SubscribeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.teardown();
    }
  }
};

const SubscribeToStoreModule: NodeModule = {
  node: SubscribeToStoreNodeDefinition
};

export = SubscribeToStoreModule;
