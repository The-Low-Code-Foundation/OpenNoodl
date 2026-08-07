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
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule, OutcomeToken } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';

import { HistoryNavigation, stateHistoryManager } from './statehistory';

interface UndoInstance extends NodeInstance {
  _internal: {
    storeName: string;
    targetIndex: number;
    /**
     * Actions queued this frame, in the order their signals arrived, each carrying the outcome
     * token for the invocation that queued it (ERG-001 §4).
     */
    queued: { action: 'undo' | 'redo' | 'jumpTo'; outcome: OutcomeToken }[];
    scheduled: boolean;
    byReferenceKeys: string;
    error?: string;
  };
  queue(action: 'undo' | 'redo' | 'jumpTo'): void;
  runQueued(): void;
  report(outcome: OutcomeToken, signal: string, result: HistoryNavigation | null): void;
  setError(message: string | undefined): void;
}

/** NDA-004 §2 — see `setError`. Also the editor's warning key; the bus keys by `code`. */
const UNDO_ERROR_CODE = 'undo/operation-failed';

const UndoNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.StateHistory.Undo',
  displayNodeName: 'Undo / Redo',
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
      description: 'Names the store to step through; a State History node must already be tracking it',
      group: 'Store',
      default: 'app',
      set: function (this: UndoInstance, value: string) {
        this._internal.storeName = value === undefined || value === null || value === '' ? 'app' : String(value);
      }
    },
    targetIndex: {
      type: 'number',
      displayName: 'Target Index',
      description: 'Entry to move to when Jump To is signalled, counting from zero; ignored by Undo and Redo',
      group: 'Jump',
      default: 0,
      set: function (this: UndoInstance, value: number) {
        this._internal.targetIndex = Number(value);
      }
    },
    undo: {
      displayName: 'Undo',
      description: 'Steps the store back one entry, or fires Unchanged when it is already at the beginning',
      group: 'Actions',
      valueChangedToTrue: function (this: UndoInstance) {
        this.queue('undo');
      }
    },
    redo: {
      displayName: 'Redo',
      description: 'Steps the store forward one entry, or fires Unchanged when it is already at the end',
      group: 'Actions',
      valueChangedToTrue: function (this: UndoInstance) {
        this.queue('redo');
      }
    },
    jumpTo: {
      displayName: 'Jump To',
      description: 'Moves the store to the entry named by Target Index',
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
      description: 'Fires when a step back actually happened, and not when the history was already at its beginning',
      group: 'Events'
    },
    redone: {
      type: 'signal',
      displayName: 'Redone',
      description: 'Fires when a step forward actually happened, and not when the history was already at its end',
      group: 'Events'
    },
    jumped: {
      type: 'signal',
      displayName: 'Jumped',
      description: 'Fires once the store holds the entry Target Index named',
      group: 'Events'
    },
    fullyRestorable: {
      type: 'boolean',
      displayName: 'Fully Restorable',
      description: 'False when the entry just restored held live objects a snapshot could only keep by reference',
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
      description: 'Comma-separated keys the restored entry put back as the same live object rather than as a copy',
      group: 'Status',
      getter: function (this: UndoInstance) {
        return this._internal.byReferenceKeys;
      }
    },
    ...outcomeOutputs({
      done: 'Fires when the step actually moved the store',
      unchanged:
        'Fires when the history had nowhere to go — an Undo at the beginning or a Redo at the ' +
        'end. Not a failure: this is an ordinary end-stop, and it used to be silent',
      failure:
        'Fires when the step could not be made, because nothing is tracking the store or Target Index is outside the history'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the last step failed; blank once one succeeds',
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
      // ERG-001 §4: one token per *queued action*, not per drain. Several `Undo`s can arrive
      // in one frame and each is an invocation the author made, so each owes exactly one
      // outcome.
      this._internal.queued.push({ action, outcome: this.beginOutcome() });
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
        const message = `No State History node is tracking store "${this._internal.storeName}"`;
        this.setError(message);
        // One outcome per queued invocation: three `Undo`s against an untracked store are
        // three failures, not one.
        for (const queued of actions) {
          this.reportOutcome(queued.outcome, 'failure', { code: UNDO_ERROR_CODE, message });
        }
        return;
      }

      for (const queued of actions) {
        if (queued.action === 'undo') {
          this.report(queued.outcome, 'undone', stateHistoryManager.undo(this._internal.storeName));
        } else if (queued.action === 'redo') {
          this.report(queued.outcome, 'redone', stateHistoryManager.redo(this._internal.storeName));
        } else {
          const index = this._internal.targetIndex;
          const result = stateHistoryManager.jumpTo(this._internal.storeName, index);
          if (result === null) {
            const message = `Target index ${index} is outside the history`;
            this.setError(message);
            this.reportOutcome(queued.outcome, 'failure', { code: UNDO_ERROR_CODE, message });
            continue;
          }
          this.report(queued.outcome, 'jumped', result);
        }
      }
    },

    report: function (this: UndoInstance, outcome: OutcomeToken, signal: string, result: HistoryNavigation | null) {
      /**
       * ERG-001 §4, and this node is §0.3's clearest single argument for the contract.
       *
       * `null` means the history had nowhere to go — an ordinary end-stop. The comment that
       * used to sit here said "no signal and no error … `canUndo` / `canRedo` are how a graph
       * asks in advance", which names the workaround it was forcing on authors: poll a boolean
       * before every press, because the press itself tells you nothing. It is `Unchanged` now.
       */
      if (result === null) {
        this.reportOutcome(outcome, 'unchanged');
        return;
      }

      this.setError(undefined);
      this._internal.byReferenceKeys = result.byReferenceKeys.join(',');
      this.flagOutputDirty('byReferenceKeys');
      this.flagOutputDirty('fullyRestorable');
      this.sendSignalOnOutput(signal);
      // Last, after `Undone`/`Redone`/`Jumped` and the values they describe.
      this.reportOutcome(outcome, 'done');
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
    /**
     * The `Error` string only — ERG-001 §4 moved the signal and the raise into `reportOutcome`.
     *
     * ⚠️ That move fixes a second thing, and it is worth naming. The dedupe below (`if the
     * message is the same, return`) used to gate the **signal** as well as the string, so
     * pressing `Undo` twice at the start of a history raised and signalled once and then went
     * silent — a per-node latch on a per-invocation fact, which is NV-iii's shape. The dedupe
     * is right for a *value* output, which is all it now guards.
     */
    setError: function (this: UndoInstance, message: string | undefined) {
      if (this._internal.error === message) return;
      this._internal.error = message;
      this.flagOutputDirty('error');
    }
  }
};

const UndoNodeModule: NodeModule = {
  node: UndoNodeDefinition
};

export = UndoNodeModule;
