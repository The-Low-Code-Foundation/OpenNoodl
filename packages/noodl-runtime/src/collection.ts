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

// ----
Object.defineProperty(Array.prototype, "items", {
  enumerable: false,
  get(this: PatchedArray) {
    return this;
  },
  set(this: PatchedArray, data: CollectionLike | undefined) {
    this.set(data);
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

    if (src === this) return;

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

    var aItems = this.items;
    var aKeys = keyIndex(aItems);
    var bKeys = keyIndex(bItems);

    // First remove all items not in the new collection
    length = aItems.length;
    for (i = 0; i < length; i++) {
      if (!bKeys.hasOwnProperty(aItems[i].getId())) {
        // This item is not present in new collection, remove it
        this.removeAtIndex(i);
        i--;
        length--;
      }
    }

    // Reorder items
    for (i = 0; i < Math.min(aItems.length, bItems.length); i++) {
      if (aItems[i] !== bItems[i]) {
        if (aKeys.hasOwnProperty(bItems[i].getId())) {
          // The bItem exist in the collection but is in the wrong place
          this.remove(bItems[i]);
        }

        // This is a new item, add it at correct index
        this.addAtIndex(bItems[i], i);
      }
    }

    // Add remaining items
    for (i = aItems.length; i < bItems.length; i++) {
      this.add(bItems[i]);
    }
  },
});

Object.defineProperty(Array.prototype, "notify", {
  enumerable: false,
  writable: false,
  value: async function (this: PatchedArray, event: string, args?: unknown) {
    if (!this._listeners) return;
    if (!this._listeners[event]) return;

    var l = this._listeners[event].slice(); //clone in case listeners array is modified in the callbacks
    for (var i = 0; i < l.length; i++) {
      await l[i](args);
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
  value: async function (this: PatchedArray, item: ModelLike) {
    if (this.contains(item)) return; // Already contains item

    this.items.push(item);
    await this.notify("add", { item: item, index: this.items.length - 1 });
    await this.notify("change");
    await item.notify("add", { collection: this });
  },
});

Object.defineProperty(Array.prototype, "remove", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, item: ModelLike) {
    var idx = this.items.indexOf(item);
    if (idx !== -1) this.removeAtIndex(idx);
  },
});

Object.defineProperty(Array.prototype, "addAtIndex", {
  enumerable: false,
  writable: false,
  value: async function (this: PatchedArray, item: ModelLike, index: number) {
    if (this.contains(item)) return; // Already contains item

    this.items.splice(index, 0, item);
    await this.notify("add", { item: item, index: index });
    await this.notify("change");
    await item.notify("add", { collection: this, index: index });
  },
});

Object.defineProperty(Array.prototype, "removeAtIndex", {
  enumerable: false,
  writable: false,
  value: async function (this: PatchedArray, idx: number) {
    var item = this.items[idx];
    this.items.splice(idx, 1);
    await this.notify("remove", { item: item, index: idx });
    await this.notify("change");
    await item.notify("remove", { collection: this });
  },
});

Object.defineProperty(Array.prototype, "on", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, event: string, listener: (args?: CollectionChangeEvent) => void) {
    if (!this._listeners)
      Object.defineProperty(this, "_listeners", {
        enumerable: false,
        writable: false,
        value: {},
      });
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(listener);
  },
});

Object.defineProperty(Array.prototype, "off", {
  enumerable: false,
  writable: false,
  value: function (this: PatchedArray, event: string, listener: (args?: CollectionChangeEvent) => void) {
    if (!this._listeners) return;
    if (!this._listeners[event]) return;
    var idx = this._listeners[event].indexOf(listener);
    if (idx !== -1) this._listeners[event].splice(idx, 1);
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
 */
const weakCollections = new WeakRegistry<CollectionLike>();

function _newCollection(name: string): CollectionLike {
  const collection = new Collection();
  Object.defineProperty(collection, "_id", {
    enumerable: false,
    writable: false,
    value: name,
  });
  return collection;
}

Collection.create = function (items?: ArrayLike<ModelLike | Record<string, unknown>>): CollectionLike {
  // Always anonymous: there is no overload that names a created collection.
  const collection = _newCollection(Model.guid());
  weakCollections.add(collection.getId(), collection);
  if (items) {
    collection.set(items);
  }
  return collection;
};

Collection.get = function (name?: string): CollectionLike {
  if (name === undefined) {
    // Anonymous: the caller's reference is the only thing that should keep this alive.
    const collection = _newCollection(Model.guid());
    weakCollections.add(collection.getId(), collection);
    return collection;
  }
  if (collections[name]) return collections[name];

  // An explicit name is a rendezvous token; take ownership from here on.
  const promoted = weakCollections.take(name);
  if (promoted !== undefined) {
    collections[name] = promoted;
    return promoted;
  }

  collections[name] = _newCollection(name);
  return collections[name];
};

Collection.instanceOf = function (collection: unknown) {
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
