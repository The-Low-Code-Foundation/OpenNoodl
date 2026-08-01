// ------------------------------------------------------------------------------
// Model
// ------------------------------------------------------------------------------
/**
 * A Noodl Object: the id-keyed, observable record behind the Object node, component state
 * and every collection entry.
 *
 * The published contract is {@link ModelLike} / {@link ModelModule} in `@noodl/types`,
 * which several viewer nodes have been asserting this module *to* (`ModelImport as
 * ModelModule`) since before it had types. Those assertions are what this file now has to
 * satisfy honestly rather than by cast.
 *
 * Nothing here is handed out raw: `get` returns a **Proxy**, so `record.title` reads
 * through to `get('title')` and `record.title = 'x'` writes through to `set`. That is why
 * {@link ModelLike} carries an index signature, and why `instanceOf` has to check
 * `value.target` as well as the value itself.
 *
 * @module noodl-runtime
 */
import type { ModelChangeEvent, ModelLike, ModelScopeLike } from '@noodl/types';

import WeakRegistry = require('./weak-registry');

/** The record itself, before the Proxy wraps it. */
interface ModelInstance {
  id: string;
  data: Record<string, unknown>;
  _class?: string;
  listeners?: Record<string, Array<(args?: unknown) => void>>;

  on(event: string, listener: (args: ModelChangeEvent) => void): void;
  off(event: string, listener: (args: ModelChangeEvent) => void): void;
  notify(event: string, args?: unknown): void;
  setAll(obj: Record<string, unknown>): void;
  fill(value?: unknown): void;
  set(name: string, value: unknown, args?: { resolve?: boolean; silent?: boolean; forceChange?: boolean }): void;
  get(name: string, args?: { resolve?: boolean }): unknown;
  getId(): string;
  toJSON(): Record<string, unknown>;
}

interface ModelScope extends ModelScopeLike {
  models: Record<string, ModelInstance>;
  proxies: Record<string, ModelLike>;
  /** This scope's anonymous tier — see DEBT-014. */
  _weak: WeakRegistry<ModelInstance>;
  /** Cached by `CloudStore.forScope`; dropped on `reset`. */
  _cloudStore?: unknown;
}

interface ModelScopeConstructor {
  new (): ModelScope;
  prototype: ModelScope;
}

/**
 * The module object. Wider than the published {@link ModelModule} by two members the
 * runtime itself uses: the process-wide record table and the scope constructor.
 */
interface ModelConstructor {
  new (id: string, data: Record<string, unknown>): ModelInstance;
  prototype: ModelInstance;

  /**
   * The process-wide table of **named** records. `Model.Scope` gives each sandbox its own
   * instead. Anonymously-minted records are not in here — see DEBT-014 and
   * {@link ModelConstructor._registrySize}.
   */
  _models: Record<string, ModelInstance>;
  Scope: ModelScopeConstructor;

  /**
   * Live entry counts per tier. Diagnostic/test-facing: the DEBT-014 success criterion is
   * stated in terms of registry size, so it has to be observable. `anonymous` counts only
   * entries whose record is still reachable.
   */
  _registrySize(): { named: number; anonymous: number };

  /**
   * ⚠️ `id` is `string | number`. Directus and PostgREST hand back JSON numbers, and this
   * keys a **plain object** — so `7` and `'7'` rendezvous on one record. That coercion is
   * what has made the mixture harmless all along, and it is load-bearing: `WeakRegistry`
   * already uses a `Map`, which does not coerce, so converting `models` to one would
   * silently split every integer-keyed record in two. Nine tests object to it; they are
   * right.
   */
  get(id?: string | number): ModelLike;
  create(data?: Record<string, unknown>): ModelLike;
  exists(id: string): boolean;
  /** Throws on `null`/`undefined` — it reads `value.target` when the `instanceof` fails. */
  instanceOf(value: unknown): boolean;
  /** A 10-character random id. The runtime's only id generator for records. */
  guid(): string;
}

const Model = function Model(this: ModelInstance, id: string, data: Record<string, unknown>) {
  this.id = id;
  this.data = data;
} as unknown as ModelConstructor;

const models = (Model._models = {} as Record<string, ModelInstance>);
const proxies: Record<string, ModelLike> = {};

// Get and set proxy
const _modelProxyHandler: ProxyHandler<ModelInstance> = {
  get: function (target, prop, receiver) {
    const member = (target as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof member === 'function') return member.bind(target);
    else if (prop in target) return Reflect.get(target, prop, receiver);
    else return target.get(prop as string);
  },
  set: function (obj, prop, value) {
    if (prop === '_class') {
      obj._class = value as string;
    } else if (prop === 'id') {
      console.log(`Noodl.Object warning: id is readonly (Id is ${obj.id}, trying to set to ${value})`);
      return true; //if a proxy doesn't return true an exception will be thrown
    } else {
      obj.set(prop as string, value);
    }
    return true;
  },
  ownKeys(target) {
    return Reflect.ownKeys(target.data);
  },
  getOwnPropertyDescriptor(target, prop) {
    return Object.getOwnPropertyDescriptor(target.data, prop);
  }
};

// ---------------------------------------------------------------------------
// Registry tiering — DEBT-014
// ---------------------------------------------------------------------------
/**
 * **The registry owns names, not objects.**
 *
 * `Model.get(id)` is create-on-read, so the table serves exactly one purpose: it is the
 * rendezvous point where two unrelated parts of a graph that *spell the same id* reach the
 * same live record. That is a feature — `Model.get('--ndl--global-variables')`, a backend
 * `objectId`, `'componentState' + instanceId`, an author-typed Object-node Id — and it
 * requires the table to keep those records alive for the life of the process.
 *
 * It says nothing about records whose id was generated *inside* `Model.get()`/`Model.create()`.
 * Nobody can spell a random 10-character guid a priori, so for those the table contributes
 * no reachability that the holder of the reference does not already have. Retaining them is
 * pure leak: every plain object handed to `collection.set()` (i.e. every Repeater item) mints
 * one, and nothing ever removed it.
 *
 * So entries are tiered by **who chose the id**:
 *
 * - **Named** — an explicit `id` was passed in. Strong, exactly as before. Every hazard that
 *   depends on `Model.get(sameId)` returning the same live object (CloudStore `_fromJSON`
 *   identity, live-query reconciliation, `Noodl.Records`, component state, the agent global
 *   store, expression subscriptions, Array Insert/Remove-by-id) resolves an explicit id and
 *   is therefore untouched.
 * - **Anonymous** — the id was generated here. Weak: held only as long as something else
 *   holds the record.
 *
 * Spelling an anonymous id later **promotes** it to the named tier (see `Model.get`), so an
 * id captured from `getId()` and re-resolved becomes durable at the moment it is first used
 * as a name. That closes the one way an anonymous id can escape.
 *
 * `Model.exists(id)` answers from both tiers, so it stays true for as long as there is an
 * object to find — which is the only interval in which its one production caller
 * (`cloudstore`'s `typeof data[key] === 'string'` reference discriminator) has anything to
 * serialize.
 *
 * If the host has no `WeakRef` the weak tier degrades to strong retention, i.e. exactly the
 * previous behaviour.
 */
/** Instance → its Proxy, so that reaching either keeps both alive (see below). */
const PROXY_BACKREF = Symbol('noodl.model.proxy');

type ProxyCarrier = ModelInstance & { [PROXY_BACKREF]?: ModelLike };

function _newRecord(id: string): ModelInstance {
  const instance = new Model(id, {});
  const proxy = new Proxy(instance, _modelProxyHandler) as unknown as ModelLike;
  // Non-enumerable so it never shows up in `toJSON`, `setAll` or `fill` iteration, and
  // symbol-keyed so it cannot collide with a data property name.
  //
  // `configurable: true` is REQUIRED, not tidiness. `_modelProxyHandler.ownKeys` reports the
  // keys of `target.data`, not of the instance, and a Proxy must report every
  // *non-configurable* own key of its target — so defining this slot with
  // `Object.defineProperty`'s `configurable: false` default makes `Object.keys(record)`,
  // `{ ...record }` and `Reflect.ownKeys(record)` all throw
  // "'ownKeys' on proxy: trap result did not include Symbol(noodl.model.proxy)".
  // That would break every Function node that spreads or enumerates a Noodl Object.
  Object.defineProperty(instance, PROXY_BACKREF, {
    value: proxy,
    enumerable: false,
    writable: false,
    configurable: true
  });
  return instance;
}

function _proxyOf(instance: ModelInstance): ModelLike {
  return (instance as ProxyCarrier)[PROXY_BACKREF] as ModelLike;
}

/**
 * The anonymous tier.
 *
 * Only the *instance* is weakly referenced. The instance points at its Proxy through
 * {@link PROXY_BACKREF} and the Proxy points at the instance as its target, so the pair is
 * mutually reachable: either one being alive keeps both, and a `deref()` therefore never
 * observes a half-collected record — which would otherwise let `Model.get(id)` mint a second
 * Proxy over a still-referenced instance and silently split identity.
 */
const weakModels = new WeakRegistry<ModelInstance>();

Model.get = function (id?: string): ModelLike {
  if (id === undefined) {
    // Anonymous: the id is minted here, so no other part of the graph can name it. The
    // caller's reference is the only thing that should keep it alive.
    const instance = _newRecord(Model.guid());
    weakModels.add(instance.id, instance);
    return _proxyOf(instance);
  }
  if (models[id]) return proxies[id];

  // An explicit id is a *name*. If this record was minted anonymously and someone has now
  // spelled its id, promote it — from here on it is a rendezvous point like any other.
  const promoted = weakModels.take(id);
  if (promoted !== undefined) {
    models[id] = promoted;
    proxies[id] = _proxyOf(promoted);
    return proxies[id];
  }

  const instance = _newRecord(id);
  models[id] = instance;
  proxies[id] = _proxyOf(instance);
  return proxies[id];
};

Model.create = function (data?: Record<string, unknown>): ModelLike {
  var modelData = data ? data : {};
  var m = Model.get(modelData.id as string | undefined);
  for (var key in modelData) {
    if (key === 'id') continue;
    m.set(key, modelData[key]);
  }

  return m;
};

Model.exists = function (id: string) {
  // Both tiers: an anonymous record that is still referenced does exist. The distinction the
  // tiers draw is about *ownership*, not about visibility.
  return models[id] !== undefined || weakModels.peek(id) !== undefined;
};

Model._registrySize = function () {
  return { named: Object.keys(models).length, anonymous: weakModels.size() };
};

Model.instanceOf = function (collection: unknown) {
  return collection instanceof Model || (collection as { target?: unknown }).target instanceof Model;
};

function _randomString(size: number) {
  if (size === 0) {
    throw new Error('Zero-length randomString is useless.');
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + 'abcdefghijklmnopqrstuvwxyz' + '0123456789';
  let objectId = '';
  for (let i = 0; i < size; ++i) {
    objectId += chars[Math.floor((1 + Math.random()) * 0x10000) % chars.length];
  }
  return objectId;
}

Model.guid = function guid() {
  return _randomString(10);
};

Model.prototype.on = function (event: string, listener: (args: ModelChangeEvent) => void) {
  if (!this.listeners) this.listeners = {};
  if (!this.listeners[event]) this.listeners[event] = [];
  this.listeners[event].push(listener);
};

Model.prototype.off = function (event: string, listener: (args: ModelChangeEvent) => void) {
  if (!this.listeners) return;
  if (!this.listeners[event]) return;
  var idx = this.listeners[event].indexOf(listener);
  if (idx !== -1) this.listeners[event].splice(idx, 1);
};

Model.prototype.notify = function (event: string, args?: unknown) {
  if (!this.listeners) return;
  if (!this.listeners[event]) return;

  var l = this.listeners[event].slice(); //clone in case listeners array is modified in the callbacks
  for (var i = 0; i < l.length; i++) {
    l[i](args);
  }
};

Model.prototype.setAll = function (obj: Record<string, unknown>) {
  for (var i in obj) {
    if (i === 'id') continue; // Skip id
    if (this.data[i] !== obj[i]) {
      var old = this.data[i];
      this.data[i] = obj[i];
      this.notify('change', { name: i, value: obj[i], old: old });
    }
  }
};

Model.prototype.fill = function (value: unknown = null) {
  for (const key in this.data) {
    if (key === 'id') continue; // Skip id
    const temp = this.data[key];
    this.data[key] = value;
    this.notify('change', { name: key, value: this.data[key], old: temp });
  }
};

Model.prototype.set = function (
  name: string,
  value: unknown,
  args?: { resolve?: boolean; silent?: boolean; forceChange?: boolean }
) {
  if (args && args.resolve && name.indexOf('.') !== -1) {
    // We should resolve path references
    var path = name.split('.');
    var model: ModelInstance = this;
    for (var i = 0; i < path.length - 1; i++) {
      var v = model.get(path[i]);
      if (Model.instanceOf(v)) model = v as unknown as ModelInstance;
      else return; // Path resolve failed
    }
    model.set(path[path.length - 1], value);
    return;
  }

  const forceChange = args && args.forceChange;

  var oldValue = this.data[name];
  this.data[name] = value;
  (forceChange || oldValue !== value) &&
    (!args || !args.silent) &&
    this.notify('change', { name: name, value: value, old: oldValue });
};

Model.prototype.getId = function () {
  return this.id;
};

Model.prototype.get = function (name: string, args?: { resolve?: boolean }) {
  if (args && args.resolve && name.indexOf('.') !== -1) {
    // We should resolve path references
    var path = name.split('.');
    var model: ModelInstance = this;
    for (var i = 0; i < path.length - 1; i++) {
      var v = model.get(path[i]);
      if (Model.instanceOf(v)) model = v as unknown as ModelInstance;
      else return; // Path resolve failed
    }
    return model.get(path[path.length - 1]);
  }

  return this.data[name];
};

Model.prototype.toJSON = function () {
  return Object.assign({}, this.data, { id: this.id });
};

Model.Scope = function ModelScope(this: ModelScope) {
  this.models = {};
  this.proxies = {};
  this._weak = new WeakRegistry();
} as unknown as ModelScopeConstructor;

// Same tiering as the module-level registry — see the DEBT-014 note above. A scope is
// already bounded by `reset()` (the cloud runtime resets one per request), but a single
// long-running request that maps or filters a large collection accumulates anonymous
// records within that one scope, so the distinction is worth keeping here too.
Model.Scope.prototype.get = function (id?: string): ModelLike {
  if (id === undefined) {
    const instance = _newRecord(Model.guid());
    this._weak.add(instance.id, instance);
    return _proxyOf(instance);
  }
  if (this.models[id]) return this.proxies[id];

  const promoted = this._weak.take(id);
  if (promoted !== undefined) {
    this.models[id] = promoted;
    this.proxies[id] = _proxyOf(promoted);
    return this.proxies[id];
  }

  const instance = _newRecord(id);
  this.models[id] = instance;
  this.proxies[id] = _proxyOf(instance);
  return this.proxies[id];
};

Model.Scope.prototype.create = function (data?: Record<string, unknown>): ModelLike {
  var modelData = data ? data : {};
  var m = this.get(modelData.id as string | undefined);
  for (var key in modelData) {
    if (key === 'id') continue;
    m.set(key, modelData[key]);
  }

  return m;
};

Model.Scope.prototype.exists = function (id: string) {
  return this.models[id] !== undefined || this._weak.peek(id) !== undefined;
};

Model.Scope.prototype.instanceOf = function (collection: unknown) {
  return collection instanceof Model || (collection as { target?: unknown }).target instanceof Model;
};

Model.Scope.prototype.guid = function guid() {
  return _randomString(10);
};

Model.Scope.prototype.reset = function () {
  this.models = {};
  this.proxies = {};
  this._weak.clear();
  delete this._cloudStore;
};

export = Model;
