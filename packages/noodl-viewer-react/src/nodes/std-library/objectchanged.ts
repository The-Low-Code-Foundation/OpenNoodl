import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

/**
 * ERG-004 §1 — the half of Richard's ask that needs no new plumbing at all.
 *
 * `Model.notify('change', { name, value, old })` fires on every write (`model.ts:308`, `:318`,
 * `:346`) and, until now, nothing in the node library listened to it. `Value Changed` compares
 * identity and throws the payload away — which its own port description admits, honestly and
 * uselessly. This node consumes it.
 *
 * Two decisions worth keeping:
 *
 * - **A new node, not a mode enum on `Value Changed`.** A mode makes the ports dynamic, and
 *   dynamic ports are second-class here: `nonexistentPort` *skips* their connections instead of
 *   checking them, and three of the four dynamic-port mechanisms carry no `description` channel
 *   (phase 30 FINDINGS `SR-ii`). Static ports are visible to the catalog, the validator and the
 *   AI loop. `Value Changed` is untouched.
 * - **Key Added is not a new event, it is `old === undefined`.** Measured in
 *   `erg-004-s0-event-payloads.test.ts`, row S0-A.
 *
 * ⚠️ **The signal goes last.** The most-repeated defect phase 30 found was a signal sent before
 * the values it describes (FINDINGS `NV-ii`), across four nodes whose entire purpose was
 * carrying data beside a signal. This node is that exact shape. Every emit path here writes
 * `_internal`, then flags all three value outputs, and only then sends — and the corpus drives
 * each class **twice**, because whether the defect is visible at all depends on whether the
 * paired value port held a non-`undefined` value at connect time.
 */

interface ObjectChangedInstance extends NodeInstance {
  _internal: {
    /** The object currently watched. Identity-compared, so it is the Proxy, not the target. */
    object: unknown;
    key: string | null;
    value: unknown;
    previousValue: unknown;
    changeCount: number;
  };
  /** The one listener instance, so `off` can remove exactly what `on` added. */
  _onModelChanged: (args?: unknown) => void;
  /** Every unsubscribe goes through here — see `Dropdown`'s three-defects-in-eleven-lines. */
  _unbindObject: () => void;
}

/** The payload `Model.prototype.notify('change', …)` carries. */
interface ModelChangeArgs {
  name: string;
  value: unknown;
  old: unknown;
}

/**
 * Whether `value` is something whose per-key changes we can subscribe to.
 *
 * ⚠️ Two traps, both of which produce a crash rather than a wrong answer:
 *
 * - **`Model.instanceOf(null)` throws.** It reads `(value as { target? }).target` after the
 *   `instanceof` check fails (`model.ts:260`), so it must never be reached with a nullish
 *   value. Guarding here means no caller has to remember.
 * - **Arrays carry `on`.** `collection.ts:643` installs `on`/`off` on `Array.prototype`, so a
 *   duck-type test for `typeof x.on === 'function'` says yes to every array in the runtime —
 *   and an array's `change` payload is `undefined`, so the listener would then read `.name`
 *   off nothing. An array belongs in `Array Changed`; this node declines it.
 */
/**
 * `null` for `undefined`, on the way *out* of a value port.
 *
 * ⚠️ This is not tidiness, it is the ordering fix — and the hazard is general enough to be
 * worth stating in full, because nothing in the library documents it.
 *
 * `Node.prototype.sendValue` returns early when the value is `undefined`, so a port whose first
 * emit is `undefined` never queues anything on the receiver. The receiver used to drain its
 * queues in `Object.keys(this._inputValuesQueue)` order — **insertion order of the queue keys**,
 * created lazily on each port's first delivery. So a value port that was `undefined` the first
 * time got its key created *after* the signal port that did fire, and from then on was delivered
 * **after** that signal, forever.
 *
 * That is `NV-ii` — a signal arriving before the value it describes — reached by a cause phase
 * 30 did not record: correct ordering inside the node, defeated by queue-key creation order.
 * It cost `Previous Value` on the second and every later `Object Replaced` before this fix,
 * and only a row that drove the node **twice** could see it.
 *
 * ✅ **FB-025 fixed the general hazard** — `Node.update` now applies a pending value before a
 * pending signal and an emptied port lets go of its key, so queue-key creation order decides
 * nothing. This is therefore no longer the *only* thing standing between this node and `NV-ii`.
 * It stays, unchanged, for the reason below: `undefined` on a port means "no opinion", and
 * "there was no previous value" is a statement. The ordering argument above is now history.
 *
 * Emitting `null` is also what the empty-value contract asks for: `undefined` on a port means
 * "no opinion", and these ports always have an opinion — "there was no previous value" is a
 * statement, not an abstention. No information is lost, because `Key Added` and `Key Changed`
 * already distinguish "the key did not exist" from "it held null".
 */
function emptyToNull(value: unknown): unknown {
  return value === undefined ? null : value;
}

function isWatchableObject(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return false;
  if (typeof value !== 'object' && typeof value !== 'function') return false;
  const on = (value as { on?: unknown }).on;
  const off = (value as { off?: unknown }).off;
  return typeof on === 'function' && typeof off === 'function';
}

const ObjectChangedNode: NodeDefinitionOptions = {
  name: 'net.noodl.ObjectChanged',
  displayName: 'Object Changed',
  category: 'Logic',

  initialize: function (this: ObjectChangedInstance) {
    this._internal.object = undefined;
    this._internal.key = null;
    this._internal.value = null;
    this._internal.previousValue = null;
    this._internal.changeCount = 0;

    this._onModelChanged = (args?: unknown) => {
      // Defensive rather than decorative: `isWatchableObject` already refuses arrays, which are
      // the only in-runtime source of a payload-free `change`. If some other producer ever
      // emits one, the node must not take the app down reading `.name` off `undefined`.
      if (args === null || typeof args !== 'object') return;

      const change = args as ModelChangeArgs;
      const added = change.old === undefined;

      // Values first, every one of them, and the signal after. See NV-ii above.
      this._internal.changeCount++;
      this._internal.key = change.name;
      this._internal.value = emptyToNull(change.value);
      this._internal.previousValue = emptyToNull(change.old);
      this.flagOutputDirty('key');
      this.flagOutputDirty('value');
      this.flagOutputDirty('previousValue');

      this.sendSignalOnOutput(added ? 'keyAdded' : 'keyChanged');
    };

    this._unbindObject = () => {
      const object = this._internal.object;
      if (isWatchableObject(object)) {
        (object as { off(e: string, l: unknown): void }).off('change', this._onModelChanged);
      }
    };

    // ERG-004 §3's requirement, applied to §1 as well: a deleted node must stop listening.
    // `Dropdown` never did this and a deleted one went on re-rendering forever
    // (NDA-012 check H1); `Drag` is the shape being copied.
    this.addDeleteListener(() => {
      this._unbindObject();
      this._internal.object = undefined;
    });
  },

  getInspectInfo(this: ObjectChangedInstance) {
    if (this._internal.changeCount) {
      return (
        'Reported ' +
        this._internal.changeCount +
        (this._internal.changeCount === 1 ? ' change' : ' changes') +
        (this._internal.key === null ? '' : ', last key: ' + this._internal.key)
      );
    }
    return 'No changes reported';
  },

  inputs: {
    object: {
      group: 'Values',
      type: 'object',
      displayName: 'Object',
      description:
        'The Object to watch. Changes to its keys are reported as they happen; sending a different Object reports Object Replaced. A plain JavaScript object that is not a Noodl Object cannot be watched key-by-key — only its replacement is reported',
      set: function (this: ObjectChangedInstance, newValue: unknown) {
        // The empty-value contract: `undefined` means "no opinion", so an upstream that has
        // not produced a value yet leaves the current subscription alone. `null` is an
        // explicit clear and *is* a replacement.
        if (newValue === undefined) return;

        if (this._internal.object === newValue) return;

        const previous = this._internal.object;

        this._unbindObject();
        this._internal.object = newValue;
        if (isWatchableObject(newValue)) {
          (newValue as { on(e: string, l: unknown): void }).on('change', this._onModelChanged);
        }

        // A replacement implicates no single key, so `Key` is cleared rather than left stale —
        // a stale key beside a fresh signal is the same defect class this node is guarding
        // against, one port over. The two value ports carry the objects themselves.
        this._internal.changeCount++;
        this._internal.key = null;
        this._internal.value = emptyToNull(newValue);
        this._internal.previousValue = emptyToNull(previous);
        this.flagOutputDirty('key');
        this.flagOutputDirty('value');
        this.flagOutputDirty('previousValue');

        this.sendSignalOnOutput('objectReplaced');
      }
    }
  },

  outputs: {
    keyAdded: {
      group: 'Events',
      type: 'signal',
      displayName: 'Key Added',
      description: 'Fires when a key that did not exist on the watched Object now does'
    },
    keyChanged: {
      group: 'Events',
      type: 'signal',
      displayName: 'Key Changed',
      description: 'Fires when a key that already existed on the watched Object is given a different value'
    },
    objectReplaced: {
      group: 'Events',
      type: 'signal',
      displayName: 'Object Replaced',
      description:
        'Fires when a different Object arrives on the input, including the first one and including an explicit clear; Key is empty and Value / Previous Value carry the Objects themselves'
    },
    key: {
      type: 'string',
      displayName: 'Key',
      group: 'Change',
      description:
        'The key the last Key Added or Key Changed was about; empty after Object Replaced, which is about no single key',
      getter: function (this: ObjectChangedInstance) {
        return this._internal.key;
      }
    },
    value: {
      type: '*',
      displayName: 'Value',
      group: 'Change',
      description: 'The new value of that key — or, after Object Replaced, the Object that just arrived',
      getter: function (this: ObjectChangedInstance) {
        return this._internal.value;
      }
    },
    previousValue: {
      type: '*',
      displayName: 'Previous Value',
      group: 'Change',
      description:
        'The value that key held before — empty when the key has just been added — or, after Object Replaced, the Object that was being watched before',
      getter: function (this: ObjectChangedInstance) {
        return this._internal.previousValue;
      }
    }
  }
};

export default {
  node: ObjectChangedNode
};
