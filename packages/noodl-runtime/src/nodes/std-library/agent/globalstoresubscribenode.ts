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
      group: 'Data',
      getter: function (this: SubscribeInstance) {
        return this.projectValue(globalStoreManager.getState(this._internal.storeName));
      }
    },
    previousValue: {
      type: '*',
      displayName: 'Previous Value',
      group: 'Data',
      getter: function (this: SubscribeInstance) {
        return this._internal.previousValue;
      }
    },
    changedKeys: {
      type: 'string',
      displayName: 'Changed Keys',
      group: 'Data',
      getter: function (this: SubscribeInstance) {
        return this._internal.changedKeys;
      }
    },
    changed: {
      type: 'signal',
      displayName: 'Changed',
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
