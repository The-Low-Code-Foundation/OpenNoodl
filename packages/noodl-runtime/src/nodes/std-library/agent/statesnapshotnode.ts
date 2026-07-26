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
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { StoreSnapshot } from './globalstore';
import { stateHistoryManager } from './statehistory';

interface SnapshotInstance extends NodeInstance {
  _internal: {
    storeName: string;
    snapshotName?: string;
    snapshotData?: unknown;
    snapshot?: StoreSnapshot;
    error?: string;
    queued: ('save' | 'restore')[];
    scheduled: boolean;
  };
  queue(action: 'save' | 'restore'): void;
  runQueued(): void;
  doSave(): void;
  doRestore(): void;
  setError(message: string | undefined): void;
  adopt(snapshot: StoreSnapshot): void;
}

const StateSnapshotNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.StateSnapshot',
  displayNodeName: 'State Snapshot',
  shortDesc: 'Saves a named checkpoint of a global store, and puts it back on demand.',
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
      group: 'Store',
      default: 'app',
      set: function (this: SnapshotInstance, value: string) {
        this._internal.storeName = value === undefined || value === null || value === '' ? 'app' : String(value);
      }
    },
    snapshotName: {
      type: 'string',
      displayName: 'Snapshot Name',
      group: 'Snapshot',
      set: function (this: SnapshotInstance, value: string) {
        this._internal.snapshotName = value;
      }
    },
    snapshotData: {
      type: 'object',
      displayName: 'Snapshot Data',
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
      group: 'Actions',
      valueChangedToTrue: function (this: SnapshotInstance) {
        this.queue('save');
      }
    },
    restore: {
      displayName: 'Restore',
      group: 'Actions',
      valueChangedToTrue: function (this: SnapshotInstance) {
        this.queue('restore');
      }
    }
  },

  outputs: {
    snapshot: {
      type: 'object',
      displayName: 'Snapshot',
      group: 'Data',
      getter: function (this: SnapshotInstance) {
        return this._internal.snapshot;
      }
    },
    fullyRestorable: {
      type: 'boolean',
      displayName: 'Fully Restorable',
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
      group: 'Status',
      getter: function (this: SnapshotInstance) {
        const snapshot = this._internal.snapshot;
        return snapshot ? snapshot.byReference.join(',') : '';
      }
    },
    saved: {
      type: 'signal',
      displayName: 'Saved',
      group: 'Events'
    },
    restored: {
      type: 'signal',
      displayName: 'Restored',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
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
    queue: function (this: SnapshotInstance, action: 'save' | 'restore') {
      this._internal.queued.push(action);
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
      for (const action of actions) {
        if (action === 'save') this.doSave();
        else this.doRestore();
      }
    },

    doSave: function (this: SnapshotInstance) {
      try {
        const snapshot = stateHistoryManager.saveNamedSnapshot(
          this._internal.snapshotName as string,
          this._internal.storeName
        );
        this.adopt(snapshot);
        this.setError(undefined);
        this.sendSignalOnOutput('saved');
      } catch (error) {
        this.setError(String((error as Error).message || error));
      }
    },

    doRestore: function (this: SnapshotInstance) {
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
      } catch (error) {
        // Reported rather than thrown: the phase-3.5 draft throws out of the signal handler,
        // which in this runtime takes the frame down over a mistyped checkpoint name.
        this.setError(String((error as Error).message || error));
      }
    },

    adopt: function (this: SnapshotInstance, snapshot: StoreSnapshot) {
      this._internal.snapshot = snapshot;
      this.flagOutputDirty('snapshot');
      this.flagOutputDirty('fullyRestorable');
      this.flagOutputDirty('byReferenceKeys');
    },

    setError: function (this: SnapshotInstance, message: string | undefined) {
      if (this._internal.error === message) return;
      this._internal.error = message;
      this.flagOutputDirty('error');
    }
  }
};

const StateSnapshotNodeModule: NodeModule = {
  node: StateSnapshotNodeDefinition
};

export = StateSnapshotNodeModule;
