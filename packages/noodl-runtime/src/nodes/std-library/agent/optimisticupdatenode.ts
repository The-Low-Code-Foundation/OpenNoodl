'use strict';

/**
 * Optimistic Update — apply now, confirm later, undo if the server says no (AGENT-004).
 *
 * ## What this node is, and what it deliberately is not
 *
 * The pattern is three steps: write the value the user is about to be shown, send the real
 * request in the background, then either confirm it (do nothing at all) or put the old value
 * back with the reason visible. Only the first and third steps need machinery, and almost
 * all of that machinery already exists — AGENT-003's store has apply/commit/rollback patches
 * that capture what each key held first, including *absence*, so rolling back a key the
 * update introduced deletes it rather than leaving a hole holding `undefined`.
 *
 * So this node owns exactly three things the store deliberately does not:
 *
 * 1. **The timer.** The store has no timers on purpose — an auto-rollback deadline is a node
 *    concern. Each open update gets its own `setTimeout`, cleared on every exit path.
 * 2. **Which patch a signal means.** A graph can have several updates in flight at once
 *    (goal 5) and the responses can come back out of order (goal 6), so `commit` and
 *    `rollback` resolve to the transaction named on the `transactionId` input when one is
 *    given, and to the *oldest* open one otherwise.
 * 3. **Whether rolling back is still the right thing to do.** See below — this is the part
 *    the phase-3.5 spec gets wrong, and the part that matters most in a real app.
 *
 * ## The rollback that races a newer write
 *
 * A rollback restores what the key held before. That is only correct while nothing else has
 * touched the key in the meantime. If it has — a realtime push landed, another component
 * wrote, the user edited again — restoring the *pre-update* value throws away a write that
 * came after the one being undone, and does it silently.
 *
 * Two different races, handled differently:
 *
 * - **A newer open patch on the same key.** The store already solves this: rollback writes
 *   live state only where this patch is the newest open writer, and otherwise hands the old
 *   value to the newer patch so *its* rollback lands correctly. Nothing to do here but let
 *   it happen.
 * - **A plain write to the same key.** The store cannot see this coming, because a plain
 *   write is not a patch. This node checks for it: if the key no longer holds the value this
 *   update applied, the update is *superseded*. Its patch is closed without restoring, the
 *   newer value stands, and `error` says so. The transaction still resolves as rolled back —
 *   the request did fail and the author's failure branch must still run — but the value is
 *   left alone, which is what every optimistic-update library does with a stale rollback.
 *
 * ## Everything is a graph output
 *
 * A node whose whole job is to undo things quietly would be the exact failure AIX-005 exists
 * to prevent. There is no path through this node that ends in silence: a missing key, an
 * unknown transaction, a duplicate id, a timeout, a supersession and a plain server rejection
 * all land on `error`, and every state change fires a signal.
 */
import type { InspectInfo, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { globalStoreManager, Unsubscribe } from './globalstore';

import Node = require('../../../node');

/** Marks "the key did not exist", kept distinct from a key holding `undefined`. */
const ABSENT = Symbol('noodl.optimisticupdate.absent');

const DEFAULT_TIMEOUT = 30000;

/** What this node remembers about one update it applied. The store remembers the rest. */
interface Transaction {
  id: string;
  /** Captured at apply time: the node's inputs may have moved on before this resolves. */
  storeName: string;
  key: string;
  optimisticValue: unknown;
  /** What the key held before, or {@link ABSENT}. Only used for the `previousValue` output. */
  previousValue: unknown;
  timer: ReturnType<typeof setTimeout> | null;
}

type DisposePolicy = 'rollback' | 'commit';

interface OptimisticUpdateInstance extends NodeInstance {
  _internal: {
    storeName: string;
    key?: string;
    optimisticValue?: unknown;
    /** As authored. Blank means "generate one on apply, resolve to the oldest on commit". */
    transactionIdInput?: string;
    timeout: number;
    errorMessage?: string;
    onDispose: DisposePolicy;

    /** Open updates, oldest first. Insertion order is the resolution order for a blank id. */
    open: Transaction[];
    /** Id of the most recent apply, so it can be carried through the request. */
    lastTransactionId?: string;
    previousValue?: unknown;
    isCommitted: boolean;
    isRolledBack: boolean;
    error?: string;

    unsubscribe: Unsubscribe | null;
    setupScheduled: boolean;
    applyScheduled: boolean;
    commitScheduled: boolean;
    rollbackScheduled: boolean;
  };
  scheduleSetup(): void;
  setupSubscription(): void;
  teardown(): void;
  scheduleApply(): void;
  scheduleCommit(): void;
  scheduleRollback(): void;
  doApply(): void;
  doCommit(): void;
  doRollback(): void;
  pickTransaction(action: string): Transaction | undefined;
  forget(transaction: Transaction): void;
  finishRollback(transaction: Transaction, reason: string, timedOut: boolean): void;
  isSuperseded(transaction: Transaction): boolean;
  reportError(message: string): void;
  reportFailure(message: string): void;
  clearError(): void;
  flagStatus(): void;
}

/** NDA-004 §2 — the matchable half of the failure pair. The bus keys by `code`. */
const UPDATE_ERROR_CODE = 'optimistic-update/operation-failed';

function generateTransactionId(): string {
  return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 11);
}

const OptimisticUpdateNodeDefinition: NodeDefinitionOptions = {
  name: 'net.noodl.OptimisticUpdate',
  displayNodeName: 'Optimistic Update',
  category: 'Data',
  color: 'data',
  usePortAsLabel: 'key',

  initialize: function (this: OptimisticUpdateInstance) {
    this._internal.storeName = 'app';
    this._internal.timeout = DEFAULT_TIMEOUT;
    this._internal.onDispose = 'rollback';
    this._internal.open = [];
    this._internal.isCommitted = false;
    this._internal.isRolledBack = false;
    this._internal.unsubscribe = null;
    this._internal.setupScheduled = false;
    this._internal.applyScheduled = false;
    this._internal.commitScheduled = false;
    this._internal.rollbackScheduled = false;
  },

  getInspectInfo: function (this: OptimisticUpdateInstance): InspectInfo {
    if (!this._internal.key) return '[No key set]';

    const open = this._internal.open.length;
    const status = open
      ? open + (open === 1 ? ' update pending' : ' updates pending')
      : this._internal.isRolledBack
      ? 'Rolled back'
      : this._internal.isCommitted
      ? 'Committed'
      : 'Idle';

    return [
      { type: 'text', value: this._internal.storeName + '.' + this._internal.key + ' — ' + status },
      { type: 'value', value: globalStoreManager.getKey(this._internal.storeName, this._internal.key) }
    ];
  },

  inputs: {
    storeName: {
      type: 'string',
      displayName: 'Store Name',
      description: 'Names the store holding the key this update writes',
      group: 'Store',
      default: 'app',
      set: function (this: OptimisticUpdateInstance, value: string) {
        this._internal.storeName = value === undefined || value === null || value === '' ? 'app' : String(value);
        this.scheduleSetup();
      }
    },
    key: {
      type: 'string',
      displayName: 'Key',
      description: 'Key to write optimistically; an Apply with no key is refused rather than dropped',
      group: 'Store',
      set: function (this: OptimisticUpdateInstance, value: string) {
        this._internal.key = value;
        this.scheduleSetup();
      }
    },
    optimisticValue: {
      type: '*',
      displayName: 'Optimistic Value',
      description: 'Value to show immediately, before the server has confirmed anything',
      group: 'Update',
      set: function (this: OptimisticUpdateInstance, value: unknown) {
        this._internal.optimisticValue = value;
      }
    },
    errorMessage: {
      type: 'string',
      displayName: 'Error Message',
      description: 'Reason reported on Error when this update is rolled back; wire the server error here',
      group: 'Update',
      tooltip: 'Reason reported on Error when this update is rolled back. Wire the server error here.',
      set: function (this: OptimisticUpdateInstance, value: string) {
        this._internal.errorMessage = value;
      }
    },
    transactionId: {
      type: 'string',
      displayName: 'Transaction Id',
      description:
        'Names the update to commit or roll back when several are in flight; leave blank to generate one and resolve to the oldest',
      group: 'Transaction',
      tooltip:
        'Leave blank to let the node generate one. Set it to commit or roll back a specific update when several are in flight.',
      set: function (this: OptimisticUpdateInstance, value: string) {
        this._internal.transactionIdInput = value;
      }
    },
    timeout: {
      type: 'number',
      displayName: 'Timeout (ms)',
      description: 'Milliseconds to wait for an answer before rolling back on its own; 0 waits forever',
      group: 'Config',
      default: DEFAULT_TIMEOUT,
      tooltip: 'Roll back automatically after this long with no answer. Zero disables the deadline.',
      set: function (this: OptimisticUpdateInstance, value: number) {
        const parsed = Number(value);
        this._internal.timeout = isFinite(parsed) ? parsed : DEFAULT_TIMEOUT;
      }
    },
    onDispose: {
      type: {
        name: 'enum',
        enums: [
          { label: 'Roll back', value: 'rollback' },
          { label: 'Keep the value', value: 'commit' }
        ],
        allowEditOnly: true
      },
      default: 'rollback',
      displayName: 'When Removed',
      description:
        'What happens to updates still in flight when this node is removed: put the old value back, or keep the value that was shown',
      group: 'Config',
      tooltip:
        'What happens to updates still in flight when this node is removed. Rolling back keeps the store honest; keeping the value suits fire-and-forget actions the user navigates away from.',
      set: function (this: OptimisticUpdateInstance, value: DisposePolicy) {
        this._internal.onDispose = value === 'commit' ? 'commit' : 'rollback';
      }
    },
    apply: {
      displayName: 'Apply',
      description: 'Writes Optimistic Value at Key now and opens a transaction the server response will resolve',
      group: 'Actions',
      valueChangedToTrue: function (this: OptimisticUpdateInstance) {
        this.scheduleApply();
      }
    },
    commit: {
      displayName: 'Commit',
      description: 'Confirms the update, so the optimistic value becomes the truth',
      group: 'Actions',
      valueChangedToTrue: function (this: OptimisticUpdateInstance) {
        this.scheduleCommit();
      }
    },
    rollback: {
      displayName: 'Rollback',
      description: 'Puts the old value back, unless something else has written the key since',
      group: 'Actions',
      valueChangedToTrue: function (this: OptimisticUpdateInstance) {
        this.scheduleRollback();
      }
    }
  },

  outputs: {
    value: {
      type: '*',
      displayName: 'Value',
      description: 'What the key holds right now, following writes made by anything, not only by this node',
      group: 'Data',
      getter: function (this: OptimisticUpdateInstance) {
        if (!this._internal.key) return undefined;
        return globalStoreManager.getKey(this._internal.storeName, this._internal.key);
      }
    },
    previousValue: {
      type: '*',
      displayName: 'Previous Value',
      description: 'What the key held immediately before the most recent Apply; blank when the key did not exist',
      group: 'Data',
      getter: function (this: OptimisticUpdateInstance) {
        return this._internal.previousValue;
      }
    },
    isPending: {
      type: 'boolean',
      displayName: 'Is Pending',
      description: 'True while at least one update is waiting for an answer',
      group: 'Status',
      getter: function (this: OptimisticUpdateInstance) {
        return this._internal.open.length > 0;
      }
    },
    pendingCount: {
      type: 'number',
      displayName: 'Pending Count',
      description:
        'How many updates are open at once, which can be more than one when responses come back out of order',
      group: 'Status',
      getter: function (this: OptimisticUpdateInstance) {
        return this._internal.open.length;
      }
    },
    isCommitted: {
      type: 'boolean',
      displayName: 'Is Committed',
      description: 'True when the last update to resolve was confirmed',
      group: 'Status',
      getter: function (this: OptimisticUpdateInstance) {
        return this._internal.isCommitted;
      }
    },
    isRolledBack: {
      type: 'boolean',
      displayName: 'Is Rolled Back',
      description:
        'True when the last update to resolve was undone, whether by Rollback, by the deadline, or by disposal',
      group: 'Status',
      getter: function (this: OptimisticUpdateInstance) {
        return this._internal.isRolledBack;
      }
    },
    transactionId: {
      type: 'string',
      displayName: 'Transaction Id',
      description:
        'Id of the most recent Apply; carry it through the request and hand it back to resolve that update specifically',
      group: 'Info',
      getter: function (this: OptimisticUpdateInstance) {
        return this._internal.lastTransactionId;
      }
    },
    applied: {
      type: 'signal',
      displayName: 'Applied',
      description: 'Fires once the optimistic value is in the store and the transaction is open',
      group: 'Events'
    },
    committed: {
      type: 'signal',
      displayName: 'Committed',
      description: 'Fires once an update has been confirmed and its value is the truth',
      group: 'Events'
    },
    rolledBack: {
      type: 'signal',
      displayName: 'Rolled Back',
      description:
        'Fires once an update has been undone, including when the value was left alone because something newer had written the key',
      group: 'Events'
    },
    timedOut: {
      type: 'signal',
      displayName: 'Timed Out',
      description: 'Fires alongside Rolled Back when it was the deadline rather than the graph that ended the update',
      group: 'Events'
    },
    /**
     * NDA-012 / NDA-004 §2.
     *
     * Deliberately **not** fired by a rollback. A rollback is a reported outcome with its own
     * terminating signals (`Rolled Back`, and `Timed Out` when the deadline caused it) and the
     * author's failure branch already hangs off those. What had no signal at all was the node
     * refusing to act: `Apply` with no `Key`, `Apply` with a transaction id already open, and
     * `Commit`/`Rollback` naming an update that is not in flight. All three ended on the
     * `error` string, which an author can only poll.
     */
    failure: {
      type: 'signal',
      displayName: 'Failure',
      description:
        'Fires when the node refused to act: no Key, a transaction id already open, or no such update to resolve',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      description: 'Why the last update failed or was undone; blank once an Apply succeeds',
      group: 'Events',
      getter: function (this: OptimisticUpdateInstance) {
        return this._internal.error;
      }
    }
  },

  methods: {
    // -- subscription ------------------------------------------------------

    scheduleSetup: function (this: OptimisticUpdateInstance) {
      if (this._internal.setupScheduled) return;
      this._internal.setupScheduled = true;

      this.scheduleAfterInputsHaveUpdated(function (this: OptimisticUpdateInstance) {
        this._internal.setupScheduled = false;
        this.setupSubscription();
      });
    },

    /**
     * Watches the one key this node targets, so `value` stays honest when something else
     * writes it. Without this the output would only ever reflect writes made through this
     * node, which is exactly the case where an optimistic update is *not* safe to undo.
     */
    setupSubscription: function (this: OptimisticUpdateInstance) {
      this.teardown();

      const key = this._internal.key;
      if (!key) return;

      this._internal.unsubscribe = globalStoreManager.subscribe(
        this._internal.storeName,
        () => {
          this.flagOutputDirty('value');
        },
        [key]
      );

      this.flagOutputDirty('value');
    },

    teardown: function (this: OptimisticUpdateInstance) {
      if (this._internal.unsubscribe) {
        this._internal.unsubscribe();
        this._internal.unsubscribe = null;
      }
    },

    // -- signals -----------------------------------------------------------

    /**
     * All three actions are deferred to the end of the frame.
     *
     * `key`, `optimisticValue`, `transactionId` and the signal itself all arrive in one frame
     * in no guaranteed order, so acting straight from the signal setter reads whichever
     * happened to land first. This is the same reason `Set Global Store` defers its write,
     * and it matters more here: applying with a stale `transactionId` would open a patch the
     * response can never resolve.
     */
    scheduleApply: function (this: OptimisticUpdateInstance) {
      if (this._internal.applyScheduled) return;
      this._internal.applyScheduled = true;

      this.scheduleAfterInputsHaveUpdated(function (this: OptimisticUpdateInstance) {
        this._internal.applyScheduled = false;
        this.doApply();
      });
    },

    scheduleCommit: function (this: OptimisticUpdateInstance) {
      if (this._internal.commitScheduled) return;
      this._internal.commitScheduled = true;

      this.scheduleAfterInputsHaveUpdated(function (this: OptimisticUpdateInstance) {
        this._internal.commitScheduled = false;
        this.doCommit();
      });
    },

    scheduleRollback: function (this: OptimisticUpdateInstance) {
      if (this._internal.rollbackScheduled) return;
      this._internal.rollbackScheduled = true;

      this.scheduleAfterInputsHaveUpdated(function (this: OptimisticUpdateInstance) {
        this._internal.rollbackScheduled = false;
        this.doRollback();
      });
    },

    // -- the three actions -------------------------------------------------

    doApply: function (this: OptimisticUpdateInstance) {
      const key = this._internal.key;

      if (!key) {
        // Reported rather than dropped: an Optimistic Update with no key is a half-finished
        // graph, and the author will otherwise see a button that does nothing at all.
        this.reportFailure('Key is required');
        return;
      }

      const storeName = this._internal.storeName;
      const authoredId = this._internal.transactionIdInput;
      const id = authoredId ? String(authoredId) : generateTransactionId();
      const optimisticValue = this._internal.optimisticValue;

      const hadKey = globalStoreManager.hasKey(storeName, key);
      const previousValue = hadKey ? globalStoreManager.getKey(storeName, key) : ABSENT;

      try {
        globalStoreManager.applyPatch(storeName, { [key]: optimisticValue }, { id });
      } catch (error) {
        // The store throws when an id is already open. That is the spec's "apply twice with
        // the same transaction id" case, and it is the author's bug, not a silent one.
        this.reportFailure(String((error as Error).message || error));
        return;
      }

      const transaction: Transaction = {
        id,
        storeName,
        key,
        optimisticValue,
        previousValue,
        timer: null
      };

      if (this._internal.timeout > 0) {
        transaction.timer = setTimeout(() => {
          transaction.timer = null;
          this.finishRollback(transaction, 'Request timed out', true);
        }, this._internal.timeout);
      }

      this._internal.open.push(transaction);
      this._internal.lastTransactionId = id;
      this._internal.previousValue = previousValue === ABSENT ? undefined : previousValue;
      this._internal.isCommitted = false;
      this._internal.isRolledBack = false;

      this.clearError();
      this.flagOutputDirty('value');
      this.flagOutputDirty('previousValue');
      this.flagOutputDirty('transactionId');
      this.flagStatus();
      this.sendSignalOnOutput('applied');
    },

    doCommit: function (this: OptimisticUpdateInstance) {
      const transaction = this.pickTransaction('commit');
      if (!transaction) return;

      this.forget(transaction);
      globalStoreManager.commitPatch(transaction.id);

      this._internal.isCommitted = true;
      this._internal.isRolledBack = false;

      this.clearError();
      this.flagStatus();
      this.sendSignalOnOutput('committed');
    },

    doRollback: function (this: OptimisticUpdateInstance) {
      const transaction = this.pickTransaction('roll back');
      if (!transaction) return;

      const authored = this._internal.errorMessage;
      this.finishRollback(transaction, authored ? String(authored) : 'The update was rolled back', false);
    },

    // -- resolution --------------------------------------------------------

    /**
     * Which open update a bare `commit` / `rollback` means.
     *
     * An explicit `transactionId` wins, which is how out-of-order responses are handled: the
     * author carries the id emitted by `applied` through the request and hands it back.
     * Without one, the oldest open update is resolved — first in, first answered, which is
     * what a queue of updates against one endpoint actually does. With a single update in
     * flight, the common case, oldest and newest are the same thing.
     */
    pickTransaction: function (this: OptimisticUpdateInstance, action: string): Transaction | undefined {
      const open = this._internal.open;
      const authoredId = this._internal.transactionIdInput;

      if (authoredId) {
        const id = String(authoredId);
        const found = open.find((transaction) => transaction.id === id);
        if (!found) {
          this.reportFailure(`No open update with transaction id "${id}" to ${action}`);
          return undefined;
        }
        return found;
      }

      if (open.length === 0) {
        this.reportFailure(`There is no open update to ${action}`);
        return undefined;
      }

      return open[0];
    },

    forget: function (this: OptimisticUpdateInstance, transaction: Transaction) {
      if (transaction.timer) {
        clearTimeout(transaction.timer);
        transaction.timer = null;
      }
      const index = this._internal.open.indexOf(transaction);
      if (index !== -1) this._internal.open.splice(index, 1);
    },

    /**
     * Has something written this key since the update was applied?
     *
     * A newer *patch* does not count — the store handles overlapping patches itself, and
     * treating one as supersession would defeat that. A plain write does count, and the
     * comparison is by identity for the same reason the store's own change detection is: an
     * equal-but-distinct object is a different value as far as everything downstream of the
     * store is concerned.
     */
    isSuperseded: function (this: OptimisticUpdateInstance, transaction: Transaction): boolean {
      const open = globalStoreManager.getOpenPatches(transaction.storeName);
      const index = open.findIndex((patch) => patch.id === transaction.id);

      if (index !== -1) {
        const newerPatchOnKey = open.slice(index + 1).some((patch) => patch.keys.indexOf(transaction.key) !== -1);
        if (newerPatchOnKey) return false;
      }

      if (!globalStoreManager.hasKey(transaction.storeName, transaction.key)) return true;
      return globalStoreManager.getKey(transaction.storeName, transaction.key) !== transaction.optimisticValue;
    },

    /**
     * Ends an update in failure, from `rollback`, from the timeout, or from disposal.
     *
     * The value is only put back when this update's own value is still there. If it is not,
     * the patch is closed *keeping* the newer value and `error` says why — undoing on top of
     * somebody else's write would destroy data, and doing it quietly would be worse.
     */
    finishRollback: function (
      this: OptimisticUpdateInstance,
      transaction: Transaction,
      reason: string,
      timedOut: boolean
    ) {
      this.forget(transaction);

      const superseded = this.isSuperseded(transaction);

      if (superseded) {
        globalStoreManager.commitPatch(transaction.id);
      } else {
        globalStoreManager.rollbackPatch(transaction.id);
      }

      this._internal.isRolledBack = true;
      this._internal.isCommitted = false;

      this.reportError(
        superseded ? reason + '. The value changed after the update was applied, so it was left as it is.' : reason
      );

      this.flagOutputDirty('value');
      this.flagStatus();
      this.sendSignalOnOutput('rolledBack');
      if (timedOut) this.sendSignalOnOutput('timedOut');
    },

    // -- output plumbing ---------------------------------------------------

    /** Puts a reason on the graph. Used where a terminating signal is already being sent. */
    reportError: function (this: OptimisticUpdateInstance, message: string) {
      this._internal.error = message;
      this.flagOutputDirty('error');
    },

    /**
     * The node refused to act, so nothing else will fire. Reports on all three channels the
     * Failure Contract asks for — the string, the signal, and the runtime error bus, which is
     * what reaches `On App Error` in a deployed build where no editor is watching.
     */
    reportFailure: function (this: OptimisticUpdateInstance, message: string) {
      this.reportError(message);
      this.sendSignalOnOutput('failure');
      this.raiseRuntimeError(UPDATE_ERROR_CODE, message);
    },

    clearError: function (this: OptimisticUpdateInstance) {
      if (this._internal.error === undefined) return;
      this._internal.error = undefined;
      this.flagOutputDirty('error');
    },

    flagStatus: function (this: OptimisticUpdateInstance) {
      this.flagOutputDirty('isPending');
      this.flagOutputDirty('pendingCount');
      this.flagOutputDirty('isCommitted');
      this.flagOutputDirty('isRolledBack');
    },

    /**
     * An update still in flight when the node dies cannot be resolved by the graph any more:
     * the node that would have received `commit` is gone. Leaving the patch open would leak
     * it — and its timer — into a store that outlives the component, so it is resolved here.
     *
     * Which way is a genuine judgement call, hence the `onDispose` input. The default rolls
     * back, because an optimistic value that nothing can ever confirm has no business
     * outliving the thing that showed it; `commit` suits fire-and-forget actions the user
     * navigates away from on purpose. Either way the supersede check still applies, and none
     * of it signals — there is nobody left to hear it.
     */
    _onNodeDeleted: function (this: OptimisticUpdateInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.teardown();

      const open = this._internal.open.slice();
      this._internal.open.length = 0;

      for (const transaction of open) {
        if (transaction.timer) {
          clearTimeout(transaction.timer);
          transaction.timer = null;
        }

        if (this._internal.onDispose === 'commit' || this.isSuperseded(transaction)) {
          globalStoreManager.commitPatch(transaction.id);
        } else {
          globalStoreManager.rollbackPatch(transaction.id);
        }
      }
    }
  }
};

const OptimisticUpdateModule: NodeModule = {
  node: OptimisticUpdateNodeDefinition
};

export = OptimisticUpdateModule;
