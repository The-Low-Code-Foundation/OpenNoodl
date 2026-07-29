"use strict";

/**
 * Noodl Arrays: ordered, observable lists of {@link ModelLike} records.
 *
 * The implementation is unusual and load-bearing. A Noodl Array **is** a real JavaScript
 * `Array` — `class Collection extends Array` — and the collection API (`items`, `size`,
 * `get`, `add`, `remove`, `on`, `notify`, …) is installed on `Array.prototype` by the
 * `Object.defineProperty` block below. That is why {@link CollectionLike} is published as
 * `extends Array<ModelLike>`: user JavaScript can hand a plain array to anything that
 * wants a collection, and `Repeater`s can iterate one directly.
 *
 * The patch is global at runtime but is **not** declared globally here. Declaring
 * `Array.prototype.get` in ambient scope would make `[1,2,3].get(0)` compile in every file
 * in every consuming package, which would hide far more mistakes than it documents. The
 * implementations below are typed through a local `this` annotation instead.
 *
 * ## The reactivity Proxy (NDA-002 §2)
 *
 * See `dev-docs/reference/REACTIVITY-CONTRACT.md`. Historically exactly five verbs notified
 * — `add`, `addAtIndex`, `remove`, `removeAtIndex`, `set` — and every native mutation
 * (`push`, `splice`, `arr[0] = x`, `arr.length = 0`, …) was silent, because `items` handed
 * out the raw backing array. Consumers now receive a **Proxy** instead, exactly as
 * `Model.get` already does:
 *
 * - `Collection.get` / `Collection.create` return the Proxy;
 * - `items` returns the Proxy (its `set`ter still delegates to `set(data)`);
 * - the Proxy's `set` / `deleteProperty` traps cover index and `length` assignment, and its
 *   `get` trap swaps the nine mutating `Array.prototype` methods for wrappers that mutate
 *   the raw target and then announce exactly what changed.
 *
 * The Proxy is memoised on the array (`PROXY_BACKREF`), so `arr.items === arr.items` and
 * `Collection.get(name) === Collection.get(name)`. Every `===` guard in the node library
 * (`foreach.tsx`'s `items` input, `runtasks.ts`, `options.ts`) depends on that. The one
 * behaviour change is that `arr.items === arr` is now **false**.
 *
 * ⚠️ The existing `Array.prototype` patches are load-bearing (PLAT-003). The Proxy is added
 * *alongside* them; nothing was removed. Internally every method resolves `this` back to the
 * raw array with {@link rawOf} and mutates that, so a verb called through the Proxy notifies
 * once, not twice.
 *
 * Everything above the `// ----` marker in the previous revision was a commented-out
 * earlier implementation; it is preserved unchanged.
 *
 * @module noodl-runtime
 */

import type { CollectionChangeEvent, CollectionLike, ModelLike } from '@noodl/types';

import Model = require('./model');
import WeakRegistry = require('./weak-registry');

/**
 * A collection as its own method bodies see it — {@link CollectionLike} plus the two
 * non-enumerable slots the patch hides on each instance.
 */
interface PatchedArray extends CollectionLike {
  _id?: string;
  _listeners?: Record<string, Array<(args?: unknown) => unknown>>;
}

interface CollectionConstructor {
  new (): CollectionLike;
  prototype: CollectionLike;

  /**
   * The process-wide table of **named** collections. Anonymous ones (`Collection.create`, and
   * `Collection.get()` with no name) are not in here — see DEBT-014 and
   * {@link CollectionConstructor._registrySize}.
   *
   * The table holds the *raw* arrays; the Proxy is minted on the way out of
   * {@link CollectionConstructor.get}, and is memoised, so identity is still stable.
   */
  _collections: Record<string, CollectionLike>;

  create(items?: ArrayLike<ModelLike | Record<string, unknown>>): CollectionLike;
  get(name?: string): CollectionLike;
  /** A plain `instanceof` test: null-safe, and narrower than "has the patched members". */
  instanceOf(collection: unknown): boolean;
  exists(name: string): boolean;

  /**
   * Live entry counts per tier. Diagnostic/test-facing: the DEBT-014 success criterion is
   * stated in terms of registry size, so it has to be observable.
   */
  _registrySize(): { named: number; anonymous: number };
}

// ---------------------------------------------------------------------------
// Proxy plumbing — NDA-002 §2
// ---------------------------------------------------------------------------

/** Reads back the raw array a Proxy wraps. Only the `get` trap answers it. */
const RAW_TARGET = Symbol('noodl.collection.raw');
/** Array → its one Proxy, so identity is stable for every `===` guard in the library. */
const PROXY_BACKREF = Symbol('noodl.collection.proxy');
/** Array → its change-coalescing state, so one logical mutation emits one `change`. */
const BATCH_STATE = Symbol('noodl.collection.batch');

/**
 * A batched operation emits its `add`/`remove` events as they happen and exactly one
 * `change` when it finishes — "a bulk operation notifies per change, not per call *and* per
 * change" (the contract's second clause).
 */
interface BatchState {
  depth: number;
  pendingChange: boolean;
}

/** The three symbol slots, as the helpers below index them. */
type Slotted = {
  [RAW_TARGET]?: PatchedArray;
  [PROXY_BACKREF]?: CollectionLike;
  [BATCH_STATE]?: BatchState;
};

/**
 * The raw array behind `value`, or `value` itself if it is not one of our Proxies.
 *
 * Every patched method starts with this. Without it a verb invoked through the Proxy would
 * mutate *through* the Proxy — firing the traps as well as its own explicit `notify`, i.e.
 * notifying twice and, for `add`, recursing.
 */
function rawOf(value: unknown): PatchedArray {
  if (value === null || value === undefined) return value as PatchedArray;
  const target = (value as Slotted)[RAW_TARGET];
  return (target === undefined ? value : target) as PatchedArray;
}

/** The one Proxy for `self`, minting and memoising it on first use. */
function proxyOf(self: PatchedArray): CollectionLike {
  const existing = (self as Slotted)[PROXY_BACKREF];
  if (existing !== undefined) return existing;

  const proxy = new Proxy(self, collectionProxyHandler) as unknown as CollectionLike;
  try {
    // Symbol-keyed and non-enumerable so it cannot collide with an element or show up in any
    // key listing; `configurable: true` for the same reason `model.ts` needs it.
    Object.defineProperty(self, PROXY_BACKREF, {
      value: proxy,
      enumerable: false,
      writable: false,
      configurable: true
    });
  } catch (e) {
    // Frozen or sealed: an unmemoised Proxy still writes through, it just loses `===`.
  }
  return proxy;
}

function batchStateOf(self: PatchedArray): BatchState {
  const existing = (self as Slotted)[BATCH_STATE];
  if (existing !== undefined) return existing;

  const state: BatchState = { depth: 0, pendingChange: false };
  try {
    Object.defineProperty(self, BATCH_STATE, {
      value: state,
      enumerable: false,
      writable: false,
      configurable: true
    });
  } catch (e) {
    // Frozen: batching degrades to one `change` per structural event, never to none.
  }
  return state;
}

/** Runs `body`, holding back its `change` notifications until it returns. */
function withBatch<T>(self: PatchedArray, body: () => T): T {
  const state = batchStateOf(self);
  state.depth++;
  try {
    return body();
  } finally {
    state.depth--;
    if (state.depth === 0 && state.pendingChange) {
      state.pendingChange = false;
      self.notify("change");
    }
  }
}

/** `change`, coalesced to one per batched operation. */
function notifyChange(self: PatchedArray) {
  const state = (self as Slotted)[BATCH_STATE];
  if (state !== undefined && state.depth > 0) {
    state.pendingChange = true;
    return;
  }
  self.notify("change");
}

/**
 * Tells a member it joined or left. Guarded because a Proxy mutation can carry a plain
 * object — `arr.push({})` is legal JavaScript and must not throw.
 */
function notifyMember(item: unknown, event: string, args: unknown) {
  if (item === null || item === undefined) return;
  const notify = (item as { notify?: unknown }).notify;
  if (typeof notify === "function") (notify as (e: string, a?: unknown) => void).call(item, event, args);
}

function announceAdd(self: PatchedArray, item: unknown, index: number) {
  self.notify("add", { item: item, index: index });
  notifyChange(self);
  notifyMember(item, "add", { collection: proxyOf(self), index: index });
}

function announceRemove(self: PatchedArray, item: unknown, index: number) {
  self.notify("remove", { item: item, index: index });
  notifyChange(self);
  notifyMember(item, "remove", { collection: proxyOf(self) });
}

/** `prop` as an array index, or `undefined` if it is an ordinary property name. */
function asIndex(prop: string): number | undefined {
  const index = Number(prop);
  if (!Number.isInteger(index) || index < 0) return undefined;
  if (String(index) !== prop) return undefined; // '01', '1.0', ' 1' are property names
  return index;
}

/** `Array.prototype.splice`'s own start-index normalisation. */
function normaliseStart(value: unknown, length: number): number {
  let start = Math.trunc(Number(value));
  if (!Number.isFinite(start)) start = 0;
  if (start < 0) return Math.max(length + start, 0);
  return Math.min(start, length);
}

function contentsChanged(before: unknown[], self: PatchedArray): boolean {
  if (before.length !== self.length) return true;
  for (let i = 0; i < before.length; i++) if (before[i] !== self[i]) return true;
  return false;
}

/**
 * The nine mutating `Array.prototype` methods, re-expressed so that each *call* is one
 * logical mutation.
 *
 * Letting them run through the `set`/`deleteProperty` traps would also notify — `splice`
 * would just emit three or four `change`s for one call, which is a notification storm on the
 * Repeater and Cloud Data paths. So they apply the native method to the **raw** array (no
 * traps fire) and then announce precisely what moved.
 */
const MUTATOR_NAMES = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin"
]);

type Mutators = Record<string, (...args: unknown[]) => unknown>;

const mutatorCache = new WeakMap<object, Mutators>();

function mutatorsFor(self: PatchedArray): Mutators {
  const cached = mutatorCache.get(self);
  if (cached !== undefined) return cached;
  const built = buildMutators(self);
  mutatorCache.set(self, built);
  return built;
}

function buildMutators(self: PatchedArray): Mutators {
  /** sort / reverse / fill / copyWithin: reordered or overwritten in place, never structural. */
  function inPlace(method: (...args: unknown[]) => unknown, args: unknown[]) {
    const before = Array.prototype.slice.call(self) as unknown[];
    method.apply(self, args);
    if (contentsChanged(before, self)) notifyChange(self);
    return proxyOf(self);
  }

  return {
    push(...items: unknown[]) {
      if (items.length === 0) return self.length;
      const start = self.length;
      const result = Array.prototype.push.apply(self, items);
      withBatch(self, () => {
        for (let i = 0; i < items.length; i++) announceAdd(self, items[i], start + i);
      });
      return result;
    },

    pop() {
      if (self.length === 0) return undefined;
      const index = self.length - 1;
      const item = Array.prototype.pop.call(self);
      withBatch(self, () => announceRemove(self, item, index));
      return item;
    },

    shift() {
      if (self.length === 0) return undefined;
      const item = Array.prototype.shift.call(self);
      withBatch(self, () => announceRemove(self, item, 0));
      return item;
    },

    unshift(...items: unknown[]) {
      if (items.length === 0) return self.length;
      const result = Array.prototype.unshift.apply(self, items);
      withBatch(self, () => {
        for (let i = 0; i < items.length; i++) announceAdd(self, items[i], i);
      });
      return result;
    },

    splice(...args: unknown[]) {
      const lengthBefore = self.length;
      const removed = Array.prototype.splice.apply(self, args) as unknown[];
      const inserted = args.length > 2 ? args.slice(2) : [];
      if (removed.length === 0 && inserted.length === 0) return removed;

      const start = normaliseStart(args[0], lengthBefore);
      withBatch(self, () => {
        // Descending, so each reported index is the one the item actually occupied.
        for (let i = removed.length - 1; i >= 0; i--) announceRemove(self, removed[i], start + i);
        for (let i = 0; i < inserted.length; i++) announceAdd(self, inserted[i], start + i);
      });
      return removed;
    },

    sort(...args: unknown[]) {
      return inPlace(Array.prototype.sort as (...a: unknown[]) => unknown, args);
    },
    reverse(...args: unknown[]) {
      return inPlace(Array.prototype.reverse as (...a: unknown[]) => unknown, args);
    },
    fill(...args: unknown[]) {
      return inPlace(Array.prototype.fill as (...a: unknown[]) => unknown, args);
    },
    copyWithin(...args: unknown[]) {
      return inPlace(Array.prototype.copyWithin as (...a: unknown[]) => unknown, args);
    }
  };
}

/**
 * The handler is shared by every collection — nothing in it closes over a particular array,
 * which is what keeps `proxyOf` cheap.
 *
 * Deliberately *not* trapped: `getPrototypeOf` (so `Collection.instanceOf` and `instanceof`
 * keep answering through to `CollectionImpl`), `ownKeys` / `getOwnPropertyDescriptor` (so
 * `Array.isArray`, spread and `JSON.stringify` behave exactly as on the raw array), and
 * `defineProperty` (so `on()`'s `_listeners` slot lands on the target, where `off()` called
 * through any reference will find it).
 */
const collectionProxyHandler: ProxyHandler<PatchedArray> = {
  get(target, prop, receiver) {
    if (prop === RAW_TARGET) return target;
    if (typeof prop === "string" && MUTATOR_NAMES.has(prop)) return mutatorsFor(target)[prop];
    return Reflect.get(target, prop, receiver);
  },

  set(target, prop, value) {
    if (typeof prop === "string") {
      if (prop === "length") {
        const oldLength = target.length;
        const newLength = Number(value);
        if (Number.isInteger(newLength) && newLength !== oldLength) {
          const dropped: Array<{ item: unknown; index: number }> = [];
          for (let i = newLength; i < oldLength; i++) dropped.push({ item: target[i], index: i });

          if (!Reflect.set(target, prop, value)) return false;

          withBatch(target, () => {
            for (let i = dropped.length - 1; i >= 0; i--) announceRemove(target, dropped[i].item, dropped[i].index);
            // Growing an array leaves holes rather than items, so there is nothing structural
            // to announce — but the length is observable, so it is still a change.
            notifyChange(target);
          });
          return true;
        }
        return Reflect.set(target, prop, value);
      }

      const index = asIndex(prop);
      if (index !== undefined) {
        const existed = index < target.length;
        const old = target[index];
        // "Setting a value to the value it already holds is not a mutation."
        if (existed && old === value) return true;

        if (!Reflect.set(target, prop, value)) return false;

        withBatch(target, () => {
          // A replacement is one item leaving and another arriving at the same index, which
          // is what `splice(i, 1, x)` emits too — the two spellings agree on purpose.
          if (existed) announceRemove(target, old, index);
          announceAdd(target, value, index);
        });
        return true;
      }
    }

    // Ordinary property names, including the `items` setter, which delegates to `set(data)`.
    // The receiver is the target, not the Proxy, so an accessor cannot re-enter these traps.
    return Reflect.set(target, prop, value);
  },

  deleteProperty(target, prop) {
    const index = typeof prop === "string" ? asIndex(prop) : undefined;
    if (index === undefined) return Reflect.deleteProperty(target, prop);

    const existed = Object.prototype.hasOwnProperty.call(target, prop);
    const old = target[index];
    if (!Reflect.deleteProperty(target, prop)) return false;
    if (existed) withBatch(target, () => announceRemove(target, old, index));
    return true;
  }
};

// ----
Object.defineProperty(Array.prototype, "items", {
  enumerable: false,
  // NDA-002: the canonical leak. This used to `return this` — the raw, patched array — so
  // every mutation a caller made through it was invisible. It returns the Proxy now, which
  // is the actual fix for corpus row R4.
  get(this: PatchedArray) {
    return proxyOf(rawOf(this));
  },
  set(this: PatchedArray, data: CollectionLike | undefined) {
    rawOf(this).set(data);
  },
});
Object.defineProperty(Array.prototype, "each", {
  enumerable: false,
  writable: false,
  value: Array.prototype.forEach,
});
Object.defineProperty(Array.prototype, "size", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray) {
    return this.length;
  },
});
Object.defineProperty(Array.prototype, "get", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, index: number) {
    return this[index];
  },
});
Object.defineProperty(Array.prototype, "getId", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray) {
    return this._id;
  },
});
Object.defineProperty(Array.prototype, "id", {
  enumerable: false,
  get(this: PatchedArray) {
    return this.getId();
  },
});
Object.defineProperty(Array.prototype, "set", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, src?: ArrayLike<ModelLike | Record<string, unknown>>) {
    var length: number, i: number;

    const self = rawOf(this);
    // `src` may be this collection reached through its Proxy, which is still a self-set.
    if (rawOf(src) === self) return;

    src = src || []; //handle if src is undefined

    function keyIndex(a: ArrayLike<ModelLike>) {
      var keys: Record<string, ModelLike> = {};
      var length = a.length;
      for (var i = 0; i < length; i++) {
        var item = a[i];
        keys[item.getId()] = item;
      }
      return keys;
    }

    // Src can be a collection, or an array
    var bItems: ModelLike[] = [];
    length = src.length;
    for (i = 0; i < length; i++) {
      var item = src[i];
      if (Model.instanceOf(item)) bItems.push(item as ModelLike);
      else bItems.push(Model.create(item as Record<string, unknown>));
    }

    // NDA-002, the contract's second clause: `set` is *one* logical mutation, however many
    // items it moves. The diff below reaches `removeAtIndex`/`addAtIndex`/`add`, each of
    // which used to emit its own `change` on top of its `add`/`remove` — so replacing a
    // 100-item collection emitted 200 notifications and every `on('change')` consumer in the
    // library re-ran 100 times. The structural events still fire per item, which is what the
    // Repeater queues from; the `change` is emitted once, when the diff has settled.
    withBatch(self, () => {
      // The raw array, deliberately: this stays a live view while `removeAtIndex` mutates it
      // below, and reaching it through the Proxy would only add trap overhead.
      var aItems = self;
      var aKeys = keyIndex(aItems);
      var bKeys = keyIndex(bItems);

      // First remove all items not in the new collection
      length = aItems.length;
      for (i = 0; i < length; i++) {
        if (!bKeys.hasOwnProperty(aItems[i].getId())) {
          // This item is not present in new collection, remove it
          self.removeAtIndex(i);
          i--;
          length--;
        }
      }

      // Reorder items
      for (i = 0; i < Math.min(aItems.length, bItems.length); i++) {
        if (aItems[i] !== bItems[i]) {
          if (aKeys.hasOwnProperty(bItems[i].getId())) {
            // The bItem exist in the collection but is in the wrong place
            self.remove(bItems[i]);
          }

          // This is a new item, add it at correct index
          self.addAtIndex(bItems[i], i);
        }
      }

      // Add remaining items
      for (i = aItems.length; i < bItems.length; i++) {
        self.add(bItems[i]);
      }
    });
  },
});

Object.defineProperty(Array.prototype, "notify", {
  enumerable: false,
  writable: false,
  // NDA-002: synchronous, like `Model.prototype.notify`. It used to be `async` and to `await`
  // each listener, so `arr.add(x)` settled a turn after the caller expected and a throwing
  // listener rejected a promise nobody held.
  value: function (this: PatchedArray, event: string, args?: unknown) {
    const self = rawOf(this);
    if (!self._listeners) return;
    if (!self._listeners[event]) return;

    var l = self._listeners[event].slice(); //clone in case listeners array is modified in the callbacks
    for (var i = 0; i < l.length; i++) {
      try {
        l[i](args);
      } catch (e) {
        // TODO(NDA-004): route this through the runtime error channel described in
        // `dev-docs/reference/FAILURE-CONTRACT.md` (`raiseRuntimeError`) once it exists.
        // Until then it is logged rather than swallowed — what must not happen is one bad
        // listener silently stopping the rest, which is what the `await` loop used to do.
        console.error("Noodl.Array: a '" + event + "' listener threw.", e);
      }
    }
  },
});

Object.defineProperty(Array.prototype, "contains", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, item: ModelLike) {
    return this.indexOf(item) !== -1;
  },
});

Object.defineProperty(Array.prototype, "add", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, item: ModelLike) {
    const self = rawOf(this);
    if (self.contains(item)) return; // Already contains item

    // Applied to the raw array on purpose: going through `items` would hit the Proxy traps
    // and notify a second time.
    Array.prototype.push.call(self, item);
    self.notify("add", { item: item, index: self.length - 1 });
    notifyChange(self);
    notifyMember(item, "add", { collection: proxyOf(self) });
  },
});

Object.defineProperty(Array.prototype, "remove", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, item: ModelLike) {
    const self = rawOf(this);
    var idx = Array.prototype.indexOf.call(self, item);
    if (idx !== -1) self.removeAtIndex(idx);
  },
});

Object.defineProperty(Array.prototype, "addAtIndex", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, item: ModelLike, index: number) {
    const self = rawOf(this);
    if (self.contains(item)) return; // Already contains item

    Array.prototype.splice.call(self, index, 0, item);
    self.notify("add", { item: item, index: index });
    notifyChange(self);
    notifyMember(item, "add", { collection: proxyOf(self), index: index });
  },
});

Object.defineProperty(Array.prototype, "removeAtIndex", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, idx: number) {
    const self = rawOf(this);
    var item = self[idx];
    Array.prototype.splice.call(self, idx, 1);
    self.notify("remove", { item: item, index: idx });
    notifyChange(self);
    notifyMember(item, "remove", { collection: proxyOf(self) });
  },
});

Object.defineProperty(Array.prototype, "on", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, event: string, listener: (args?: CollectionChangeEvent) => void) {
    const self = rawOf(this);
    if (!self._listeners)
      Object.defineProperty(self, "_listeners", {
        enumerable: false,
        writable: false,
        value: {},
      });
    if (!self._listeners[event]) self._listeners[event] = [];
    self._listeners[event].push(listener);
  },
});

Object.defineProperty(Array.prototype, "off", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, event: string, listener: (args?: CollectionChangeEvent) => void) {
    const self = rawOf(this);
    if (!self._listeners) return;
    if (!self._listeners[event]) return;
    var idx = self._listeners[event].indexOf(listener);
    if (idx !== -1) self._listeners[event].splice(idx, 1);
  },
});

class CollectionImpl extends Array {}

const Collection = CollectionImpl as unknown as CollectionConstructor;

var collections = (Collection._collections = {} as Record<string, CollectionLike>);

/**
 * The anonymous tier — DEBT-014. See `weak-registry.ts` for the reasoning; the split here is
 * the same one `model.ts` draws, and for this table it matters *more*.
 *
 * A collection holds its member Models strongly (it is a real `Array` of them), so a
 * permanently-registered collection pins every record it ever contained. `Collection.create`
 * and the no-argument `Collection.get` both mint a random guid name, and the call sites that
 * use them are the highest-volume paths in the runtime: one per filter run
 * (`filtercollectionnode`), one per map run (`mapcollectionnode`), one per query execution
 * (`dbcollectionnode2.fetch`), one per Repeater instance (`foreach.tsx`), and one per nested
 * array per record per deserialize (`cloudstore._deserializeJSON`). None of those names is
 * ever published, so nothing could reach them by name — the table was pinning graphs of
 * records that no part of the program could observe.
 *
 * Named collections (`Collection.get('myArray')`, the `identifierOf: 'CollectionName'` port)
 * keep the old strong behaviour, and an anonymous name that is later spelled explicitly is
 * promoted, so an id captured from `getId()` and re-resolved becomes durable at that point.
 *
 * Only the *raw* array is registered. It points at its Proxy through {@link PROXY_BACKREF}
 * and the Proxy points at it as its target, so the pair is mutually reachable and a caller
 * holding only the Proxy keeps the entry alive — the same argument `model.ts` makes.
 */
const weakCollections = new WeakRegistry<CollectionLike>();

function _newCollection(name: string): PatchedArray {
  const collection = new Collection();
  Object.defineProperty(collection, "_id", {
    enumerable: false,
    writable: false,
    value: name,
  });
  return collection as PatchedArray;
}

Collection.create = function (items?: ArrayLike<ModelLike | Record<string, unknown>>): CollectionLike {
  // Always anonymous: there is no overload that names a created collection.
  const collection = _newCollection(Model.guid());
  weakCollections.add(collection.getId(), collection);
  if (items) {
    collection.set(items);
  }
  return proxyOf(collection);
};

Collection.get = function (name?: string): CollectionLike {
  if (name === undefined) {
    // Anonymous: the caller's reference is the only thing that should keep this alive.
    const collection = _newCollection(Model.guid());
    weakCollections.add(collection.getId(), collection);
    return proxyOf(collection);
  }
  if (collections[name]) return proxyOf(collections[name] as PatchedArray);

  // An explicit name is a rendezvous token; take ownership from here on.
  const promoted = weakCollections.take(name);
  if (promoted !== undefined) {
    collections[name] = promoted;
    return proxyOf(promoted as PatchedArray);
  }

  collections[name] = _newCollection(name);
  return proxyOf(collections[name] as PatchedArray);
};

Collection.instanceOf = function (collection: unknown) {
  // A Proxy with no `getPrototypeOf` trap forwards to its target, so this answers the same
  // for a collection reached either way.
  return collection instanceof CollectionImpl;
};

Collection.exists = function (name: string) {
  // Both tiers — an anonymous collection that is still referenced does exist. `cloudstore`'s
  // reference discriminator asks exactly that question of a string-valued property.
  return collections[name] !== undefined || weakCollections.peek(name) !== undefined;
};

Collection._registrySize = function () {
  return { named: Object.keys(collections).length, anonymous: weakCollections.size() };
};

// Legacy-module compatibility (DEBT-008). Backbone-era Noodl modules subclass
// Collection in ES5 style and chain the base constructor with
// `Noodl.Collection.apply(this, arguments)` — which throws against a class
// constructor. The class body is empty (everything lives on the patched
// Array.prototype), so being invoked as a function is a supported no-op: the
// subclass instance keeps its own prototype chain and picks the methods up
// from Array.prototype. `new`, statics, `instanceof` and `extends` all pass
// through the proxy untouched, and real instances stay genuine Arrays (which
// a function-style constructor could not provide — that is why Collection is
// a class in the first place).
const CallableCollection = new Proxy(Collection, {
  apply() {
    return undefined;
  }
}) as CollectionConstructor;

export = CallableCollection;
