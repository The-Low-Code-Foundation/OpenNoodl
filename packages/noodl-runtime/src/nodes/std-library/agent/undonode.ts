'use strict';

/**
 * Undo / Redo — walks a store back and forward through its State History (AGENT-006).
 *
 * Deliberately a separate node from State History, for the same reason `Set Global Store` is
 * separate from `Global Store`: the tracker belongs once, next to the store it records, while
 * the control belongs on every button that needs it. It owns nothing — it drives the history
 * the State History node created, found by store name.
 *
 * Undo at the beginning and redo at the end are **no-ops, not errors**: nothing fires, and
 * `canUndo` / `canRedo` on the State History node already say so. A `jumpTo` outside the
 * history *is* reported, because that is a graph that computed the wrong number, and so is
 * driving any of this at a store nothing is tracking.
 */
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { HistoryNavigation, stateHistoryManager } from './statehistory';

interface UndoInstance extends NodeInstance {
  _internal: {
    storeName: string;
    targetIndex: number;
    /** Actions queued this frame, in the order their signals arrived. */
    queued: ('undo' | 'redo' | 'jumpTo')[];
    scheduled: boolean;
    byReferenceKeys: string;
    error?: string;
  };
  queue(action: 'undo' | 'redo' | 'jumpTo'): void;
  runQueued(): void;
  report(action: string, result: HistoryNavigation | null): void;
  setError(message: string | undefined): void;
}

/** NDA-004 §2 — see `setError`. Also the editor's warning key; the bus keys by `code`. */
const UNDO_ERROR_CODE = 'undo/operation-failed';

const UndoNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.StateHistory.Undo',
  displayNodeName: 'Undo / Redo',
  shortDesc: 'Steps a global store back and forward through the history a State History node recorded.',
  category: 'Data',
  color: 'data',
  usePortAsLabel: 'storeName',

  initialize: function (this: UndoInstance) {
    this._internal.storeName = 'app';
    this._internal.targetIndex = 0;
    this._internal.queued = [];
    this._internal.scheduled = false;
    this._internal.byReferenceKeys = '';
  },

  getInspectInfo: function (this: UndoInstance): InspectInfo {
    const info = stateHistoryManager.getHistoryInfo(this._internal.storeName);
    if (!info) return `[Nothing is tracking "${this._internal.storeName}"]`;
    return [
      {
        type: 'text',
        value:
          `${info.storeName}: at ${info.currentIndex + 1}/${info.size}` +
          (info.canUndo ? ', can undo' : '') +
          (info.canRedo ? ', can redo' : '')
      }
    ];
  },

  inputs: {
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      group: 'Store',
      default: 'app',
      set: function (this: UndoInstance, value: string) {
        this._internal.storeName = value === undefined || value === null || value === '' ? 'app' : String(value);
      }
    },
    targetIndex: {
      type: 'number',
      displayName: 'Target Index',
      group: 'Jump',
      default: 0,
      set: function (this: UndoInstance, value: number) {
        this._internal.targetIndex = Number(value);
      }
    },
    undo: {
      displayName: 'Undo',
      group: 'Actions',
      valueChangedToTrue: function (this: UndoInstance) {
        this.queue('undo');
      }
    },
    redo: {
      displayName: 'Redo',
      group: 'Actions',
      valueChangedToTrue: function (this: UndoInstance) {
        this.queue('redo');
      }
    },
    jumpTo: {
      displayName: 'Jump To',
      group: 'Actions',
      valueChangedToTrue: function (this: UndoInstance) {
        this.queue('jumpTo');
      }
    }
  },

  outputs: {
    undone: {
      type: 'signal',
      displayName: 'Undone',
      group: 'Events'
    },
    redone: {
      type: 'signal',
      displayName: 'Redone',
      group: 'Events'
    },
    jumped: {
      type: 'signal',
      displayName: 'Jumped',
      group: 'Events'
    },
    fullyRestorable: {
      type: 'boolean',
      displayName: 'Fully Restorable',
      group: 'Status',
      // False when the entry just restored held live objects a snapshot could only keep by
      // reference. Output ports carry no tooltip, so this lives here and in the notes.
      getter: function (this: UndoInstance) {
        return this._internal.byReferenceKeys === '';
      }
    },
    byReferenceKeys: {
      type: 'string',
      displayName: 'By-Reference Keys',
      group: 'Status',
      getter: function (this: UndoInstance) {
        return this._internal.byReferenceKeys;
      }
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter: function (this: UndoInstance) {
        return this._internal.error;
      }
    }
  },

  methods: {
    /**
     * Defers to the end of the frame, because `targetIndex` and the `jumpTo` signal arrive
     * together in no guaranteed order — acting from the signal setter would jump to whatever
     * index happened to be there from last time.
     */
    queue: function (this: UndoInstance, action: 'undo' | 'redo' | 'jumpTo') {
      this._internal.queued.push(action);
      if (this._internal.scheduled) return;
      this._internal.scheduled = true;

      this.scheduleAfterInputsHaveUpdated(function (this: UndoInstance) {
        this._internal.scheduled = false;
        this.runQueued();
      });
    },

    runQueued: function (this: UndoInstance) {
      const actions = this._internal.queued;
      this._internal.queued = [];

      if (!stateHistoryManager.isTracking(this._internal.storeName)) {
        // A silent no-op here is the worst outcome: the button appears wired and does
        // nothing, and there is no store-side error to find.
        this.setError(`No State History node is tracking store "${this._internal.storeName}"`);
        return;
      }

      for (const action of actions) {
        if (action === 'undo') {
          this.report('undone', stateHistoryManager.undo(this._internal.storeName));
        } else if (action === 'redo') {
          this.report('redone', stateHistoryManager.redo(this._internal.storeName));
        } else {
          const index = this._internal.targetIndex;
          const result = stateHistoryManager.jumpTo(this._internal.storeName, index);
          if (result === null) {
            this.setError(`Target index ${index} is outside the history`);
            continue;
          }
          this.report('jumped', result);
        }
      }
    },

    report: function (this: UndoInstance, signal: string, result: HistoryNavigation | null) {
      // `null` means the history had nowhere to go. That is an ordinary end-stop, so no
      // signal and no error — `canUndo` / `canRedo` are how a graph asks in advance.
      if (result === null) return;

      this.setError(undefined);
      this._internal.byReferenceKeys = result.byReferenceKeys.join(',');
      this.flagOutputDirty('byReferenceKeys');
      this.flagOutputDirty('fullyRestorable');
      this.sendSignalOnOutput(signal);
    },

    /**
     * NDA-004 §2 / FINDINGS B-iv. Two defects, not the one B-iv predicted.
     *
     * The finding read all twenty-two `setError`s as copies of one that posted to
     * `editorConnection.sendWarning`. This one posted **nowhere**, and the node had no
     * `Failure` signal either — an author could wire the success signal and had nothing at all
     * to sequence off a failure, only an `Error` string to poll. Both halves of the contract
     * missed, in a node whose whole job is to be recoverable.
     *
     * `undefined` is a *clear*, not a failure: every success path calls `setError(undefined)`
     * first. So the raise and the signal are guarded on a defined message — without that guard
     * the new port fires on every successful operation, which is the Object node's defect
     * inverted.
     */
    setError: function (this: UndoInstance, message: string | undefined) {
      if (this._internal.error === message) return;
      this._internal.error = message;
      this.flagOutputDirty('error');

      if (message !== undefined) {
        this.sendSignalOnOutput('failure');
        this.raiseRuntimeError(UNDO_ERROR_CODE, message);
      }
    }
  }
};

const UndoNodeModule: NodeModule = {
  node: UndoNodeDefinition
};

export = UndoNodeModule;
