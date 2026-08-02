'use strict';

/**
 * State History — records a global store's changes so they can be undone (AGENT-006).
 *
 * One of these per store is enough; the history it creates is shared, so an Undo node
 * anywhere in the app can drive it with nothing but the store name. Two of them on the same
 * store share one history rather than each keeping their own, and the history outlives
 * whichever of them is deleted first.
 *
 * The `fullyRestorable` / `byReferenceKeys` pair is not decoration. A store holding a
 * Collection, a Model or a function cannot be snapshotted — those are kept by reference, and
 * undoing them puts the same live object back. An author needs to be told that on the graph,
 * not left to discover it when an undo half-works.
 */
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';
import { HistoryInfo, stateHistoryManager } from './statehistory';

import Node = require('../../../node');

interface StateHistoryInstance extends NodeInstance {
  _internal: {
    storeName: string;
    attachedTo: string | null;
    /** As authored: comma-separated, blank for "the whole store". */
    trackKeys?: string;
    trackKeyList: string[];
    maxHistory: number;
    coalesceMs: number;
    enabled: boolean;
    detach: (() => void) | null;
    setupScheduled: boolean;
  };
  scheduleSetup(): void;
  setupTracking(): void;
  teardown(): void;
  info(): HistoryInfo | null;
  refreshOutputs(): void;
}

function parseKeys(keys: string | undefined): string[] {
  if (!keys) return [];
  return String(keys)
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}

const StateHistoryNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.StateHistory',
  displayNodeName: 'State History',
  category: 'Data',
  color: 'data',
  usePortAsLabel: 'storeName',

  initialize: function (this: StateHistoryInstance) {
    this._internal.storeName = 'app';
    this._internal.attachedTo = null;
    this._internal.trackKeyList = [];
    this._internal.maxHistory = 50;
    this._internal.coalesceMs = 0;
    this._internal.enabled = true;
    this._internal.detach = null;
    this._internal.setupScheduled = false;
  },

  /**
   * Attaches once the node is in a scope, whether or not anything was authored.
   *
   * NDA-012, same shape as the Global Store node: every input here has a default, so a
   * tracker the author dropped and left alone never ran a setter and never attached. The
   * symptom was one node over — an `Undo / Redo` node reporting *"No State History node is
   * tracking store 'app'"* with the tracker sitting on the canvas beside it.
   */
  nodeScopeDidInitialize: function (this: StateHistoryInstance) {
    this.scheduleSetup();
  },

  getInspectInfo: function (this: StateHistoryInstance): InspectInfo {
    const info = this.info();
    if (!info) return '[Not tracking]';

    const lines: InspectInfo = [
      {
        type: 'text',
        value: `Store: ${info.storeName} — ${info.currentIndex + 1}/${info.size}` + (info.enabled ? '' : ' (paused)')
      }
    ];

    if (info.byReferenceKeys.length) {
      lines.push({
        type: 'text',
        value:
          'Undo cannot fully restore these keys — they hold live objects (Collection, Model, ' +
          'function) that a snapshot can only keep by reference: ' +
          info.byReferenceKeys.join(', ')
      });
    }

    lines.push({ type: 'value', value: info.entries });
    return lines;
  },

  inputs: {
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      description:
        'Names the global store to record; one tracker per store is enough, and two on the same store share one history',
      group: 'Store',
      default: 'app',
      set: function (this: StateHistoryInstance, value: string) {
        this._internal.storeName = value === undefined || value === null || value === '' ? 'app' : String(value);
        this.scheduleSetup();
      }
    },
    trackKeys: {
      type: 'string',
      displayName: 'Track Keys',
      description:
        'Comma-separated keys to record; leave blank to record the whole store, and note that changing this clears the history',
      group: 'Config',
      tooltip:
        'Comma-separated keys to record. Blank records the whole store. ' +
        'Undo then writes only these keys and leaves the rest alone. Changing this clears the history.',
      set: function (this: StateHistoryInstance, value: string) {
        this._internal.trackKeys = value;
        this._internal.trackKeyList = parseKeys(value);
        this.scheduleSetup();
      }
    },
    maxHistory: {
      type: 'number',
      displayName: 'Max History',
      description:
        'How many entries to keep before the oldest is dropped, never below two and never dropping the current one',
      group: 'Config',
      default: 50,
      tooltip: 'How many entries to keep. The oldest are dropped first. An unbounded history is a memory leak.',
      set: function (this: StateHistoryInstance, value: number) {
        this._internal.maxHistory = Number(value);
        this.scheduleSetup();
      }
    },
    coalesceMs: {
      type: 'number',
      displayName: 'Coalesce (ms)',
      description:
        'Window in milliseconds within which successive changes to the same keys fold into one undo step; 0 records every change separately',
      group: 'Config',
      default: 0,
      tooltip:
        'Fold successive changes to the same keys within this many milliseconds into one undo step, ' +
        'so typing is one undo rather than one per keystroke. 0 records every change separately.',
      set: function (this: StateHistoryInstance, value: number) {
        this._internal.coalesceMs = Number(value);
        this.scheduleSetup();
      }
    },
    enabled: {
      type: 'boolean',
      displayName: 'Enabled',
      description: 'Turning this off pauses recording and keeps the entries already collected',
      group: 'Config',
      default: true,
      tooltip: 'Turning this off pauses recording. The history already collected is kept.',
      set: function (this: StateHistoryInstance, value: boolean) {
        this._internal.enabled = value === undefined ? true : !!value;
        this.scheduleSetup();
      }
    },
    clearHistory: {
      displayName: 'Clear History',
      description: 'Throws the history away and starts again from the live state',
      group: 'Actions',
      valueChangedToTrue: function (this: StateHistoryInstance) {
        // ERG-001 §4. The token is minted here, at the signal input, and travels through the
        // deferral — `scheduleAfterInputsHaveUpdated` runs a frame later, and the token is what
        // ties the report back to *this* press rather than to the node.
        const outcome = this.beginOutcome();
        this.scheduleAfterInputsHaveUpdated(function (this: StateHistoryInstance) {
          const result = stateHistoryManager.clearHistory(this._internal.storeName);

          // Values before the signal, always: a graph wiring `Done -> show the history` must be
          // able to read the emptied history when the pulse lands.
          this.refreshOutputs();

          // ⚠️ `'not-tracking'` is `Unchanged`, not `Failure`, and NDA-004's pinned control is
          // what caught the first attempt to make it one. Its reasoning holds: this node *is*
          // the tracker and `storeName` normalises, so there is no store it can be asked for and
          // persistently fail to find. `'not-tracking'` is only reachable as a one-frame race —
          // a `Clear History` landing in the same frame as a `Store Name` change, before
          // `setupTracking` has run — and raising at an author whose graph is correct is exactly
          // what the contract says trains people to ignore the port. Either way nothing was
          // thrown away and the post-condition (a history that is just its baseline) holds.
          this.reportOutcome(outcome, result === 'cleared' ? 'done' : 'unchanged');
        });
      }
    }
  },

  outputs: {
    historySize: {
      type: 'number',
      displayName: 'History Size',
      description: 'How many entries the history holds, including the baseline it started from',
      group: 'Status',
      getter: function (this: StateHistoryInstance) {
        const info = this.info();
        return info ? info.size : 0;
      }
    },
    currentIndex: {
      type: 'number',
      displayName: 'Current Index',
      description: 'Where in the history the store is sitting; -1 when nothing is being tracked',
      group: 'Status',
      getter: function (this: StateHistoryInstance) {
        const info = this.info();
        return info ? info.currentIndex : -1;
      }
    },
    canUndo: {
      type: 'boolean',
      displayName: 'Can Undo',
      description: 'True when there is an earlier entry to step back to',
      group: 'Status',
      getter: function (this: StateHistoryInstance) {
        const info = this.info();
        return info ? info.canUndo : false;
      }
    },
    canRedo: {
      type: 'boolean',
      displayName: 'Can Redo',
      description: 'True when an undo has been made and there is a later entry to step forward to',
      group: 'Status',
      getter: function (this: StateHistoryInstance) {
        const info = this.info();
        return info ? info.canRedo : false;
      }
    },
    fullyRestorable: {
      type: 'boolean',
      displayName: 'Fully Restorable',
      description:
        'False when some entry holds a Collection, a Model or a function, which a snapshot can only keep by reference',
      group: 'Status',
      getter: function (this: StateHistoryInstance) {
        const info = this.info();
        return info ? info.byReferenceKeys.length === 0 : true;
      }
    },
    byReferenceKeys: {
      type: 'string',
      displayName: 'By-Reference Keys',
      description: 'Comma-separated keys an undo cannot fully restore because they hold live objects rather than data',
      group: 'Status',
      getter: function (this: StateHistoryInstance) {
        const info = this.info();
        return info ? info.byReferenceKeys.join(',') : '';
      }
    },
    history: {
      type: 'array',
      displayName: 'History',
      description:
        'One entry per recorded change, each with its index, timestamp, description and changed keys, but not its state',
      group: 'Data',
      getter: function (this: StateHistoryInstance) {
        const info = this.info();
        return info ? info.entries : [];
      }
    },
    historyChanged: {
      type: 'signal',
      displayName: 'History Changed',
      description: 'Fires whenever an entry is added, the position moves, or the history is cleared',
      group: 'Events'
    },
    // ERG-001 §4 / OUTCOME-CONTRACT.md. `Clear History` was one of §0.3's "emits nothing at all"
    // cases: the handler called a `void` method whose first line was `if (!record) return`.
    //
    // ⚠️ No `Failure`, and NDA-004's pinned control in `statehistory.test.ts` is what holds that
    // in place — see `clearHistory`'s handler for why the one non-clearing path is `Unchanged`.
    ...outcomeOutputs({
      done: 'Fires once the history has been thrown away and re-baselined from the live state',
      unchanged: 'Fires when there was nothing to throw away, because the history was already just its baseline'
    })
  },

  methods: {
    /**
     * Attaches once per frame however many inputs arrived — the same reason the Global Store
     * node defers: `storeName`, `trackKeys` and `maxHistory` all land in one frame in no
     * guaranteed order, and attaching per setter would attach to the wrong store with the
     * wrong options and then throw the resulting history away.
     */
    scheduleSetup: function (this: StateHistoryInstance) {
      if (this._internal.setupScheduled) return;
      this._internal.setupScheduled = true;

      this.scheduleAfterInputsHaveUpdated(function (this: StateHistoryInstance) {
        this._internal.setupScheduled = false;
        this.setupTracking();
      });
    },

    setupTracking: function (this: StateHistoryInstance) {
      const options = {
        maxHistory: this._internal.maxHistory,
        trackKeys: this._internal.trackKeyList,
        coalesceMs: this._internal.coalesceMs,
        enabled: this._internal.enabled
      };

      // Reconfigure in place when the store has not changed. Detaching and reattaching would
      // destroy the undo stack every time an author nudged `maxHistory`.
      if (this._internal.attachedTo === this._internal.storeName) {
        stateHistoryManager.configure(this._internal.storeName, options);
        this.refreshOutputs();
        return;
      }

      this.teardown();

      this._internal.attachedTo = this._internal.storeName;
      this._internal.detach = stateHistoryManager.attach(this._internal.storeName, options, () => {
        this.refreshOutputs();
        this.sendSignalOnOutput('historyChanged');
      });

      this.refreshOutputs();
    },

    teardown: function (this: StateHistoryInstance) {
      if (this._internal.detach) {
        this._internal.detach();
        this._internal.detach = null;
      }
      this._internal.attachedTo = null;
    },

    info: function (this: StateHistoryInstance) {
      return stateHistoryManager.getHistoryInfo(this._internal.storeName);
    },

    refreshOutputs: function (this: StateHistoryInstance) {
      this.flagOutputDirty('historySize');
      this.flagOutputDirty('currentIndex');
      this.flagOutputDirty('canUndo');
      this.flagOutputDirty('canRedo');
      this.flagOutputDirty('fullyRestorable');
      this.flagOutputDirty('byReferenceKeys');
      this.flagOutputDirty('history');
    },

    /**
     * A history pins a deep copy of the store per entry, so leaving one attached to a deleted
     * node is a real leak, not a tidiness issue. Detaching drops this node's reference; the
     * last one out releases the snapshots.
     */
    _onNodeDeleted: function (this: StateHistoryInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.teardown();
    }
  }
};

const StateHistoryNodeModule: NodeModule = {
  node: StateHistoryNodeDefinition
};

export = StateHistoryNodeModule;
