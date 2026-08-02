import type { NodeDefinitionOptions, NodeInstance } from '@noodl/types';

/**
 * ERG-004 §2 and §3 — `Array Changed`.
 *
 * `Collection.notify('add' | 'remove', { item, index })` has carried the structural detail
 * since NDA-002 (`collection.ts:206`, `:212`, `:600`, `:624`, `:637`) and, as with
 * `Object Changed`, nothing consumed it. §2 is that consumption. §3 — `Item Changed`, an
 * object *inside* the array being edited in place — is the one genuinely new mechanism, and
 * the only part of ERG-004 that has to own a lifecycle.
 *
 * ## What this node deliberately does not report
 *
 * ⚠️ **`change` is not a signal here, and the §0 decision is why.** The spec believed the bare
 * `Collection.notify('change')` at `collection.ts:180`/`:192` was "the whole-array-replacement
 * path", carrying no detail about a wholesale `set`. It is measured, in
 * `erg-004-s0-event-payloads.test.ts` row S0-C, and it is not: `notifyChange` is the
 * **coalesced companion** to every structural event — `announceAdd` and `announceRemove` each
 * call it — and `Collection.set` runs its whole diff inside `withBatch` (`:512`), so replacing
 * a collection emits a full per-item `add`/`remove` stream *and then* one summary `change`.
 * Every detail the spec thought was missing is already on `add`/`remove`. Enriching those two
 * calls was therefore rejected: see `ERG-004-NOTES.md` §0.
 *
 * One consequence is honest and is stated on the ports: a pure **reorder** — `sort`, `reverse`,
 * `fill`, `copyWithin`, and growing an array by writing `length` — emits `change` alone, with
 * no `add`/`remove` beside it (S0-C's third row). This node reports no signal for it. It does
 * listen to `change` for one narrow purpose: repairing `Count`, which those paths can move
 * without any structural event. No signal is sent from that path and `Count` is only re-sent
 * when it actually differs, so the repair cannot be mistaken for a change report.
 *
 * ⚠️ **Announce after you update, and emit the signal last** (FINDINGS `NV-ii`), and never emit
 * `undefined` on a value port — see `emptyToNull` in `objectchanged.ts` for the queue-key
 * ordering hazard that costs, which a corpus row driving the node twice is the only thing that
 * catches.
 *
 * ## The lifecycle (§3)
 *
 * Phase 30 found five separate listener/timer leaks; `Dropdown` is the near-exact precedent —
 * a node subscribing to a collection's `change` — and it left two listeners behind on a
 * re-send and never removed one on delete. This node subscribes to *n + 1* things (the array,
 * plus every member), so it unbinds through one pair of methods that are the only code allowed
 * to touch subscriptions, and it unsubscribes on all four of: item removed, array replaced,
 * input cleared, node deleted.
 */

interface ArrayChangedInstance extends NodeInstance {
  _internal: {
    array: unknown;
    index: number | null;
    item: unknown;
    key: string | null;
    count: number;
    changeCount: number;
    /** Members currently subscribed to. Distinct, so a duplicated item is bound once. */
    watched: unknown[];
    /** `watchers[i]` is the listener registered on `watched[i]`. Maintained in lockstep. */
    watchers: ((args?: unknown) => void)[];
  };
  _onArrayAdd: (args?: unknown) => void;
  _onArrayRemove: (args?: unknown) => void;
  _onArrayChanged: () => void;
  _onItemChanged: (item: unknown, change: ModelChangeArgs) => void;
  _watchItem: (item: unknown) => void;
  _unwatchItem: (item: unknown) => void;
  _unwatchAllItems: () => void;
  _unbindArray: () => void;
}

interface CollectionEventArgs {
  item: unknown;
  index: number;
}

interface ModelChangeArgs {
  name: string;
  value: unknown;
  old: unknown;
}

/** See `objectchanged.ts` — `undefined` on a value port reorders it behind its own signal. */
function emptyToNull(value: unknown): unknown {
  return value === undefined ? null : value;
}

/** An array we can subscribe to. `on`/`off` come from `Array.prototype` (`collection.ts:643`). */
function isWatchableArray(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const on = (value as { on?: unknown }).on;
  const off = (value as { off?: unknown }).off;
  return typeof on === 'function' && typeof off === 'function';
}

/**
 * A member whose per-key changes we can subscribe to.
 *
 * `Model.instanceOf(null)` throws (`model.ts:260` reads `.target` off it), so the nullish check
 * comes first and no caller has to remember. A plain object member is legal — `arr.push({})` is
 * legal JavaScript, which is why `collection.ts:199` guards the same way — and simply cannot be
 * watched.
 */
function isWatchableItem(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return false;
  if (typeof value !== 'object' && typeof value !== 'function') return false;
  const on = (value as { on?: unknown }).on;
  const off = (value as { off?: unknown }).off;
  return typeof on === 'function' && typeof off === 'function';
}

const ArrayChangedNode: NodeDefinitionOptions = {
  name: 'net.noodl.ArrayChanged',
  displayName: 'Array Changed',
  category: 'Logic',

  initialize: function (this: ArrayChangedInstance) {
    this._internal.array = undefined;
    this._internal.index = null;
    this._internal.item = null;
    this._internal.key = null;
    this._internal.count = 0;
    this._internal.changeCount = 0;
    this._internal.watched = [];
    this._internal.watchers = [];

    /** Writes the three item-level outputs and flags them. The signal is the caller's, and last. */
    const report = (index: number | null, item: unknown, key: string | null) => {
      this._internal.changeCount++;
      this._internal.index = index;
      this._internal.item = emptyToNull(item);
      this._internal.key = key;
      this._internal.count = Array.isArray(this._internal.array) ? (this._internal.array as unknown[]).length : 0;
      this.flagOutputDirty('index');
      this.flagOutputDirty('item');
      this.flagOutputDirty('key');
      this.flagOutputDirty('count');
    };

    this._onArrayAdd = (args?: unknown) => {
      if (args === null || typeof args !== 'object') return;
      const event = args as CollectionEventArgs;

      // Bind before announcing: a downstream node that reacts to Item Added by editing the
      // item must find it already watched, or the first Item Changed is lost.
      this._watchItem(event.item);

      report(event.index, event.item, null);
      this.sendSignalOnOutput('itemAdded');
    };

    this._onArrayRemove = (args?: unknown) => {
      if (args === null || typeof args !== 'object') return;
      const event = args as CollectionEventArgs;

      this._unwatchItem(event.item);

      report(event.index, event.item, null);
      this.sendSignalOnOutput('itemRemoved');
    };

    // The narrow use of the payload-free `change`: repair `Count` after a reorder or a
    // `length` write, neither of which emits a structural event. No signal is sent from here.
    this._onArrayChanged = () => {
      const array = this._internal.array;
      const count = Array.isArray(array) ? (array as unknown[]).length : 0;
      if (count === this._internal.count) return;
      this._internal.count = count;
      this.flagOutputDirty('count');
    };

    /**
     * ⚠️ One listener **per member**, kept in `watchers` alongside `watched`.
     *
     * `Model.prototype.notify` calls its listeners with the change payload and nothing else
     * (`model.ts:292-300`) — it does not pass the model. So a single shared listener cannot
     * tell which member fired, and the item has to be closed over. That makes the listener a
     * per-member object, which is exactly the thing `Dropdown` failed to keep track of: the
     * two arrays are maintained in lockstep by `_watchItem` / `_unwatchItem` /
     * `_unwatchAllItems`, and nothing else in this file is allowed to call `on` or `off`.
     */
    this._onItemChanged = (item: unknown, change: ModelChangeArgs) => {
      const array = this._internal.array;
      if (!Array.isArray(array)) return;

      const index = (array as unknown[]).indexOf(item);
      // Left the array between the write and here — `_unwatchItem` will not have run yet if
      // the removal is what triggered the write, so this is a real case, not a paranoid one.
      if (index === -1) return;

      report(index, item, change.name);
      this.sendSignalOnOutput('itemChanged');
    };

    this._watchItem = (item: unknown) => {
      if (!isWatchableItem(item)) return;
      if (this._internal.watched.indexOf(item) !== -1) return;

      const listener = (args?: unknown) => {
        if (args === null || typeof args !== 'object') return;
        this._onItemChanged(item, args as ModelChangeArgs);
      };

      this._internal.watched.push(item);
      this._internal.watchers.push(listener);
      (item as { on(e: string, l: unknown): void }).on('change', listener);
    };

    this._unwatchItem = (item: unknown) => {
      // Only when it has really gone: an array may legally hold the same object twice, and
      // one `remove` must not stop watching a member that is still present.
      const array = this._internal.array;
      if (Array.isArray(array) && (array as unknown[]).indexOf(item) !== -1) return;

      const at = this._internal.watched.indexOf(item);
      if (at === -1) return;

      const listener = this._internal.watchers[at];
      this._internal.watched.splice(at, 1);
      this._internal.watchers.splice(at, 1);
      (item as { off(e: string, l: unknown): void }).off('change', listener);
    };

    this._unwatchAllItems = () => {
      const watched = this._internal.watched;
      const watchers = this._internal.watchers;
      for (let i = 0; i < watched.length; i++) {
        (watched[i] as { off(e: string, l: unknown): void }).off('change', watchers[i]);
      }
      this._internal.watched = [];
      this._internal.watchers = [];
    };

    this._unbindArray = () => {
      const array = this._internal.array;
      if (isWatchableArray(array)) {
        const target = array as { off(e: string, l: unknown): void };
        target.off('add', this._onArrayAdd);
        target.off('remove', this._onArrayRemove);
        target.off('change', this._onArrayChanged);
      }
      this._unwatchAllItems();
    };

    // The fourth unsubscribe case, and the one `Dropdown` did not have at all (NDA-012 H1).
    // `Drag` is the shape.
    this.addDeleteListener(() => {
      this._unbindArray();
      this._internal.array = undefined;
    });
  },

  getInspectInfo(this: ArrayChangedInstance) {
    if (this._internal.changeCount) {
      return (
        'Reported ' +
        this._internal.changeCount +
        (this._internal.changeCount === 1 ? ' change' : ' changes') +
        ', ' +
        this._internal.count +
        ' items, watching ' +
        this._internal.watched.length
      );
    }
    return 'No changes reported';
  },

  inputs: {
    array: {
      type: 'array',
      displayName: 'Array',
      description:
        'The Array to watch. Items arriving and leaving are reported as they happen, and edits to the Objects inside it are reported as Item Changed; sending a different Array reports Array Replaced',
      set: function (this: ArrayChangedInstance, newValue: unknown) {
        // `undefined` abstains, `null` clears — the empty-value contract, and the second of
        // §3's four unsubscribe cases ("input cleared") is the `null` branch below.
        if (newValue === undefined) return;
        if (this._internal.array === newValue) return;

        this._unbindArray();
        this._internal.array = newValue;

        if (isWatchableArray(newValue)) {
          const target = newValue as { on(e: string, l: unknown): void };
          target.on('add', this._onArrayAdd);
          target.on('remove', this._onArrayRemove);
          target.on('change', this._onArrayChanged);

          const items = newValue as unknown[];
          for (let i = 0; i < items.length; i++) this._watchItem(items[i]);
        }

        // A replacement is about no single item, so Index, Item and Key are cleared rather
        // than left stale. Count is the array-level fact and is the useful one here.
        this._internal.changeCount++;
        this._internal.index = null;
        this._internal.item = null;
        this._internal.key = null;
        this._internal.count = Array.isArray(newValue) ? (newValue as unknown[]).length : 0;
        this.flagOutputDirty('index');
        this.flagOutputDirty('item');
        this.flagOutputDirty('key');
        this.flagOutputDirty('count');

        this.sendSignalOnOutput('arrayReplaced');
      }
    }
  },

  outputs: {
    itemAdded: {
      type: 'signal',
      displayName: 'Item Added',
      description: 'Fires when an item is added to the watched Array; Index and Item describe it'
    },
    itemRemoved: {
      type: 'signal',
      displayName: 'Item Removed',
      description: 'Fires when an item is removed from the watched Array; Index is the position it occupied'
    },
    itemChanged: {
      type: 'signal',
      displayName: 'Item Changed',
      description:
        'Fires when one of the Objects inside the watched Array is edited in place; Key names the property that changed. Items that are not Noodl Objects cannot be watched'
    },
    arrayReplaced: {
      type: 'signal',
      displayName: 'Array Replaced',
      description:
        'Fires when a different Array arrives on the input, including the first one and including an explicit clear; Index, Item and Key are empty and Count is the new length'
    },
    index: {
      type: 'number',
      displayName: 'Index',
      group: 'Change',
      description:
        'The position the last signal was about; empty after Array Replaced, which is about no single item',
      getter: function (this: ArrayChangedInstance) {
        return this._internal.index;
      }
    },
    item: {
      type: '*',
      displayName: 'Item',
      group: 'Change',
      description: 'The item the last signal was about; empty after Array Replaced',
      getter: function (this: ArrayChangedInstance) {
        return this._internal.item;
      }
    },
    key: {
      type: 'string',
      displayName: 'Key',
      group: 'Change',
      description:
        'The property of Item that changed, after Item Changed; empty after the other signals, which are about the item as a whole',
      getter: function (this: ArrayChangedInstance) {
        return this._internal.key;
      }
    },
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'Array',
      description:
        'How many items the watched Array holds now. Kept accurate through reordering and length changes, which send no signal because they add and remove nothing',
      getter: function (this: ArrayChangedInstance) {
        return this._internal.count;
      }
    }
  }
};

export default {
  node: ArrayChangedNode
};
