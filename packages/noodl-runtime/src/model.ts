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

  /** The process-wide record table. `Model.Scope` gives each sandbox its own instead. */
  _models: Record<string, ModelInstance>;
  Scope: ModelScopeConstructor;

  get(id?: string): ModelLike;
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

Model.get = function (id?: string): ModelLike {
  if (id === undefined) id = Model.guid();
  if (!models[id]) {
    models[id] = new Model(id, {});
    proxies[id] = new Proxy(models[id], _modelProxyHandler) as unknown as ModelLike;
  }
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
  return models[id] !== undefined;
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
} as unknown as ModelScopeConstructor;

Model.Scope.prototype.get = function (id?: string): ModelLike {
  if (id === undefined) id = Model.guid();
  if (!this.models[id]) {
    this.models[id] = new Model(id, {});
    this.proxies[id] = new Proxy(this.models[id], _modelProxyHandler) as unknown as ModelLike;
  }
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
  return this.models[id] !== undefined;
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
  delete this._cloudStore;
};

export = Model;
