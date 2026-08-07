'use strict';

/**
 * State Snapshot — named checkpoints of a global store (AGENT-006).
 *
 * Separate from the undo history on purpose. A history is a linear record of everything that
 * happened; a snapshot is a point somebody deliberately marked and can come back to at will.
 * Saving one does not disturb the undo stack, and restoring one is an **ordinary write** — so
 * it appears in the history and can itself be undone, which is what an author who restored
 * the wrong checkpoint wants.
 *
 * The `snapshot` output is plain JSON-shaped data (as long as `byReferenceKeys` is empty), so
 * routing it out to a file and back into `snapshotData` is the export/import path the spec
 * asks for, with no extra ports for it.
 */
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule, OutcomeToken } from '@noodl/types';

import { outcomeOutputs } from '../../../outcome';

import { StoreSnapshot } from './globalstore';
import { stateHistoryManager } from './statehistory';

interface SnapshotInstance extends NodeInstance {
  _internal: {
    storeName: string;
    snapshotName?: string;
    snapshotData?: unknown;
    snapshot?: StoreSnapshot;
    error?: string;
    /**
     * ERG-001 §4 — the queued actions, each carrying its own invocation's token.
     *
     * One entry per pulse, so a `Save` and a `Restore` queued in the same frame each report
     * their own outcome. ⚠️ Paired with the action rather than held in a second array: the two
     * must not be able to drift out of step.
     */
    queued: { action: 'save' | 'restore'; token: OutcomeToken }[];
    scheduled: boolean;
  };
  queue(action: 'save' | 'restore', token: OutcomeToken): void;
  runQueued(): void;
  doSave(token: OutcomeToken): void;
  doRestore(token: OutcomeToken): void;
  setError(message: string | undefined, token?: OutcomeToken): void;
  adopt(snapshot: StoreSnapshot): void;
}

/** NDA-004 §2 — see `setError`. Also the editor's warning key; the bus keys by `code`. */
const SNAPSHOT_ERROR_CODE = 'state-snapshot/operation-failed';

const StateSnapshotNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.StateSnapshot',
  displayNodeName: 'State Snapshot',
  category: 'Data',
  color: 'data',
  usePortAsLabel: 'snapshotName',

  initialize: function (this: SnapshotInstance) {
    this._internal.storeName = 'app';
    this._internal.queued = [];
    this._internal.scheduled = false;
  },

  getInspectInfo: function (this: SnapshotInstance): InspectInfo {
    const snapshot = this._internal.snapshot;
    if (!snapshot) return '[No snapshot saved]';

    const lines: InspectInfo = [{ type: 'text', value: `${this._internal.snapshotName} — ${snapshot.storeName}` }];

    if (snapshot.byReference.length) {
      lines.push({
        type: 'text',
        value:
          'These keys hold live objects and are kept by reference, so restoring will not undo ' +
          'changes made to them since: ' +
          snapshot.byReference.join(', ')
      });
    }

    lines.push({ type: 'value', value: snapshot.state });
    return lines;
  },

  inputs: {
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      description: 'Names the store to snapshot or restore into',
      group: 'Store',
      default: 'app',
      set: function (this: SnapshotInstance, value: string) {
        this._internal.storeName = value === undefined || value === null || value === '' ? 'app' : String(value);
      }
    },
    snapshotName: {
      type: 'string',
      displayName: 'Snapshot Name',
      description: 'Name to save this checkpoint under, and the name Restore looks up; required to save',
      group: 'Snapshot',
      set: function (this: SnapshotInstance, value: string) {
        this._internal.snapshotName = value;
      }
    },
    snapshotData: {
      type: 'object',
      displayName: 'Snapshot Data',
      description: 'A previously exported Snapshot to restore instead of the named one; leave blank to restore by name',
      group: 'Snapshot',
      tooltip:
        'Snapshot to restore instead of the named one — a previously exported "Snapshot" output. ' +
        'Leave blank to restore by name.',
      set: function (this: SnapshotInstance, value: unknown) {
        this._internal.snapshotData = value;
      }
    },
    save: {
      displayName: 'Save',
      description: 'Copies the store as it is now and keeps it under Snapshot Name',
      group: 'Actions',
      valueChangedToTrue: function (this: SnapshotInstance) {
        this.queue('save', this.beginOutcome());
      }
    },
    restore: {
      displayName: 'Restore',
      description: 'Puts a checkpoint back as an ordinary write, so it appears in the history and can itself be undone',
      group: 'Actions',
      valueChangedToTrue: function (this: SnapshotInstance) {
        this.queue('restore', this.beginOutcome());
      }
    }
  },

  outputs: {
    snapshot: {
      type: 'object',
      displayName: 'Snapshot',
      description:
        'The checkpoint just saved or restored, as plain data that can be written to a file and fed back into Snapshot Data',
      group: 'Data',
      getter: function (this: SnapshotInstance) {
        return this._internal.snapshot;
      }
    },
    fullyRestorable: {
      type: 'boolean',
      displayName: 'Fully Restorable',
      description:
        'False when the checkpoint holds a Collection, a Model or a function, which it can only keep by reference',
      group: 'Status',
      // False when the snapshot holds live objects it could only keep by reference. Output
      // ports carry no tooltip, so this lives here and in the notes.
      getter: function (this: SnapshotInstance) {
        const snapshot = this._internal.snapshot;
        return snapshot ? snapshot.byReference.length === 0 : true;
      }
    },
    byReferenceKeys: {
      type: 'string',
      displayName: 'By-Reference Keys',
      description:
        'Comma-separated keys the checkpoint holds as live objects, so restoring will not undo changes made to them since',
      group: 'Status',
      getter: function (this: SnapshotInstance) {
        const snapshot = this._internal.snapshot;
        return snapshot ? snapshot.byReference.join(',') : '';
      }
    },
    saved: {
      type: 'signal',
      displayName: 'Saved',
      description: 'Fires once the checkpoint has been taken and Snapshot holds it',
      group: 'Events'
    },
    restored: {
      type: 'signal',
      displayName: 'Restored',
      description: 'Fires once the store holds the checkpoint again',
      group: 'Events'
    },
    /**
     * ERG-001 §4. `Saved` and `Restored` say *which* verb finished and are kept; `Done` says
     * "the invocation you triggered succeeded" for either of them, which is what a graph
     * sequencing two verbs off one node needs.
     *
     * ⚠️ **No `Unchanged`.** `Save` copies the store every time and `Restore` writes every
     * time — deliberately, as an ordinary write that appears in the history — so neither has a
     * post-condition that can already hold.
     */
    ...outcomeOutputs({
      done: 'Fires once a Save or Restore you triggered has finished, whichever of the two it was',
      failure:
        'Fires when the checkpoint could not be saved or put back, most often an unnamed or unknown checkpoint'
    }),
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the last save or restore failed; blank once one succeeds',
      group: 'Events',
      getter: function (this: SnapshotInstance) {
        return this._internal.error;
      }
    }
  },

  methods: {
    /**
     * Deferred like every other write in this set: `snapshotName`, `snapshotData` and the
     * signal all arrive in one frame in no guaranteed order.
     */
    queue: function (this: SnapshotInstance, action: 'save' | 'restore', token: OutcomeToken) {
      this._internal.queued.push({ action, token });
      if (this._internal.scheduled) return;
      this._internal.scheduled = true;

      this.scheduleAfterInputsHaveUpdated(function (this: SnapshotInstance) {
        this._internal.scheduled = false;
        this.runQueued();
      });
    },

    runQueued: function (this: SnapshotInstance) {
      const actions = this._internal.queued;
      this._internal.queued = [];
      for (const entry of actions) {
        if (entry.action === 'save') this.doSave(entry.token);
        else this.doRestore(entry.token);
      }
    },

    doSave: function (this: SnapshotInstance, token: OutcomeToken) {
      try {
        const snapshot = stateHistoryManager.saveNamedSnapshot(
          this._internal.snapshotName as string,
          this._internal.storeName
        );
        this.adopt(snapshot);
        this.setError(undefined);
        this.sendSignalOnOutput('saved');
        this.reportOutcome(token, 'done');
      } catch (error) {
        this.setError(String((error as Error).message || error), token);
      }
    },

    doRestore: function (this: SnapshotInstance, token: OutcomeToken) {
      try {
        // Explicit data wins over the name: that is the import path, and an author who wired
        // both meant the one they wired a value into.
        const data = this._internal.snapshotData;
        const hasData = data !== undefined && data !== null && data !== '';

        const snapshot = hasData
          ? stateHistoryManager.restoreSnapshotData(data, { storeName: this._internal.storeName })
          : stateHistoryManager.restoreNamedSnapshot(this._internal.snapshotName as string, {
              storeName: this._internal.storeName
            });

        this.adopt(snapshot);
        this.setError(undefined);
        this.sendSignalOnOutput('restored');
        this.reportOutcome(token, 'done');
      } catch (error) {
        // Reported rather than thrown: the phase-3.5 draft throws out of the signal handler,
        // which in this runtime takes the frame down over a mistyped checkpoint name.
        this.setError(String((error as Error).message || error), token);
      }
    },

    adopt: function (this: SnapshotInstance, snapshot: StoreSnapshot) {
      this._internal.snapshot = snapshot;
      this.flagOutputDirty('snapshot');
      this.flagOutputDirty('fullyRestorable');
      this.flagOutputDirty('byReferenceKeys');
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
    setError: function (this: SnapshotInstance, message: string | undefined, token?: OutcomeToken) {
      const repeat = this._internal.error === message;
      if (!repeat) {
        this._internal.error = message;
        this.flagOutputDirty('error');
        if (message !== undefined) this.raiseRuntimeError(SNAPSHOT_ERROR_CODE, message);
      }

      // A clear is not a failure — every success path calls `setError(undefined)` first, and
      // without this guard the `Failure` port fires on every successful operation.
      if (message === undefined) return;

      // ⚠️ ERG-001 §4. Settled outside the dedup above: the dedup is about the announcement, and
      // a second Restore of the same missing checkpoint is a second invocation that still owes
      // its own outcome. `raise: false` because this method has already decided about the bus.
      if (token) {
        this.reportOutcome(token, 'failure', { code: SNAPSHOT_ERROR_CODE, message, raise: false });
        return;
      }

      if (!repeat) this.sendSignalOnOutput('failure');
    }
  }
};

const StateSnapshotNodeModule: NodeModule = {
  node: StateSnapshotNodeDefinition
};

export = StateSnapshotNodeModule;
