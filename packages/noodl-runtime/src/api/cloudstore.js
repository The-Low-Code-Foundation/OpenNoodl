/**
 * `CloudStore` — resolution, and the Noodl `Model` glue. **The wire moved out.**
 *
 * BCN-002 put the Parse client behind `IDataAdapter` as
 * [`ParseWireAdapter`](./backends/ParseWireAdapter.ts). What is left here is the
 * two jobs that are not the wire's:
 *
 * 1. **Resolution.** The adapter takes a `BackendHandle` as its first argument;
 *    this class is what produces one. Today that is "whatever `cloudservices`
 *    metadata says", which is the singleton behaviour the runtime has always
 *    had — see `_handle()` for why that is a floor rather than a design.
 * 2. **The Model glue.** `_fromJSON`, `_deserializeJSON` and `_serializeObject`
 *    convert between backend JSON and Noodl `Model`/`Collection` objects. They
 *    stay because twenty-five nodes reach them through this class, and because
 *    the serialiser is handed to the adapter as a hook rather than owned by it.
 *
 * Every one of the fourteen data methods is now a one-line forward. That is the
 * point: there is exactly one live copy of the request layer, and the diff that
 * proves it is this file getting shorter rather than a second one appearing.
 *
 * The class keeps its old *shape* deliberately — `query(options)`, not
 * `query(handle, options)` — so no node call site changed in this task. Nothing
 * about "no observable behaviour change" would be provable if the callers moved
 * at the same time as the implementation. BCN-004 and BCN-009 are what repoint
 * them at a resolver.
 */
const NoodlRuntime = require('../../noodl-runtime');
const Model = require('../model');
const Collection = require('../collection');
const CloudFile = require('./cloudfile');
const { ParseWireAdapter } = require('./backends/ParseWireAdapter');

class CloudStore {
  constructor(modelScope) {
    this._initCloudServices();

    this.modelScope = modelScope;

    this._adapter = new ParseWireAdapter({
      // The module-scope serialiser, not the scope-bound `this._serializeObject`
      // below — which is what `create` and `save` called before this move, so
      // `modelScope` is ignored during serialisation exactly as it always was.
      // Pre-existing and preserved; PLAT-006 records the sibling case in
      // `_fromJSON`.
      serializeObject: (data, collectionName) => _serializeObject(data, collectionName),
      // Read per call rather than captured, because `_initCloudServices()` can
      // re-run (`dbcollectionnode2.ts:913`) and change it under a live adapter.
      getServerVersionMajor: () => this.dbVersionMajor
    });

    // The same emitter, reachable at the same property. The adapter owns it now
    // — `AdapterEvents` implements the contract's event surface once for every
    // adapter — but `cloudstore.events` is read by name in the wild.
    this.events = this._adapter.events;

    this._fromJSON = (item, collectionName) => CloudStore._fromJSON(item, collectionName, modelScope);
    this._deserializeJSON = (data, type) => CloudStore._deserializeJSON(data, type, modelScope);
    this._serializeObject = (data, collectionName) => CloudStore._serializeObject(data, collectionName, modelScope);
  }

  _initCloudServices() {
    _collections = undefined; // clear collection cache, so it's refetched

    const cloudServices = NoodlRuntime.instance.getMetaData('cloudservices');
    if (cloudServices) {
      this.appId = cloudServices.appId;
      this.endpoint = cloudServices.endpoint;
    }

    const dbVersionMajor = NoodlRuntime.instance.getMetaData('dbVersionMajor');
    this.dbVersionMajor = dbVersionMajor;
  }

  /**
   * The resolved backend the adapter is handed, built fresh on every call.
   *
   * Fresh because `_initCloudServices()` re-reads project metadata at runtime
   * and a captured handle would go stale the moment it did.
   *
   * `type: 'nodegx'` is an assumption and is marked as one. This class cannot
   * tell our backend from an upstream Parse Server — both answer the same wire
   * on the same headers, which is exactly why BCN-001 gave them separate
   * descriptor columns. Nothing in *this* task reads `type`; BCN-009's picker is
   * what will make it a fact rather than a default, and BCN-010's gating is what
   * will make being wrong about it matter.
   */
  _handle() {
    return {
      id: '_active_',
      type: 'nodegx',
      name: 'Built-in',
      url: this.endpoint,
      // The Parse Application Id is precisely what `publicToken` describes: the
      // non-secret identifier that ships with a deployed app.
      publicToken: this.appId
    };
  }

  on() {
    this.events.on.apply(this.events, arguments);
  }

  off() {
    this.events.off.apply(this.events, arguments);
  }

  /**
   * Kept as a two-argument method so the handle-binding is the only difference
   * from the old signature. `test/cloudstore-files.test.ts` drives it directly
   * and is left untouched on purpose — a wire test that still passes against the
   * moved wire is the cheapest evidence this task can produce.
   */
  _makeRequest(path, options) {
    this._adapter._makeRequest(this._handle(), path, options);
  }

  // ── The fourteen contract methods ────────────────────────────────────────
  //
  // Each one binds the resolved handle and forwards. Nothing else happens here:
  // paths, headers, payload shaping, the `{_method: 'GET'}` tunnel and the
  // adapter events all live in `ParseWireAdapter`, which is the only live copy.

  query(options) {
    this._adapter.query(this._handle(), options);
  }

  aggregate(options) {
    this._adapter.aggregate(this._handle(), options);
  }

  count(options) {
    this._adapter.count(this._handle(), options);
  }

  distinct(options) {
    this._adapter.distinct(this._handle(), options);
  }

  fetch(options) {
    this._adapter.fetch(this._handle(), options);
  }

  create(options) {
    this._adapter.create(this._handle(), options);
  }

  increment(options) {
    this._adapter.increment(this._handle(), options);
  }

  save(options) {
    this._adapter.save(this._handle(), options);
  }

  delete(options) {
    this._adapter.delete(this._handle(), options);
  }

  addRelation(options) {
    this._adapter.addRelation(this._handle(), options);
  }

  removeRelation(options) {
    this._adapter.removeRelation(this._handle(), options);
  }

  uploadFile(options) {
    this._adapter.uploadFile(this._handle(), options);
  }

  signFileUrl(options) {
    this._adapter.signFileUrl(this._handle(), options);
  }

  deleteFile(options) {
    this._adapter.deleteFile(this._handle(), options);
  }

  /**
   * The signed-in end user's id — **not one of the fourteen**.
   *
   * Forwarded because `dbmodelcrudbase.ts`'s access-control mixin needs it and
   * used to dig it out of `localStorage` itself. See the adapter's own note for
   * why it stops at the adapter rather than becoming a contract method.
   */
  currentUserId() {
    return this._adapter.currentUserId(this._handle());
  }
}

function _isArrayOfObjects(a) {
  if (!Array.isArray(a)) return false;
  for (var i = 0; i < a.length; i++) if (typeof a[i] !== 'object' || a[i] === null) return false;

  return true;
}

function _toJSON(obj) {
  if (obj instanceof Model) {
    var res = {};
    for (var key in obj.data) {
      res[key] = _toJSON(obj.data[key]);
    }
    return res;
  } else if (obj instanceof Collection) {
    var res = [];
    obj.items.forEach((m) => {
      res.push(_toJSON(m));
    });
    return res;
  }
  return obj;
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} collectionName
 * @param {import('@noodl/types').ModelScopeLike} [modelScope] omit for the process-wide store
 * @returns {Record<string, unknown>}
 */
function _serializeObject(data, collectionName, modelScope) {
  if (CloudStore._collections[collectionName]) var schema = CloudStore._collections[collectionName].schema;

  for (var key in data) {
    var _type = schema && schema.properties && schema.properties[key] ? schema.properties[key].type : undefined;

    if (data[key] === undefined || data[key] === null) {
      // Keep null and undefined as is
    } else if (_type === 'Pointer' && typeof data[key] === 'string') {
      // This is a string pointer to an object
      data[key] = {
        __type: 'Pointer',
        className: schema.properties[key].targetClass,
        objectId: data[key]
      };
    } else if (_type === 'Pointer' && typeof data[key] === 'object' && (modelScope || Model).instanceOf(data[key])) {
      // This is an embedded object that should be stored as pointer
      data[key] = {
        __type: 'Pointer',
        className: schema.properties[key].targetClass,
        objectId: data[key].getId()
      };
    } else if (_type === 'Date' && (typeof data[key] === 'string' || data[key] instanceof Date)) {
      data[key] = {
        __type: 'Date',
        iso: data[key] instanceof Date ? data[key].toISOString() : data[key]
      };
    } else if (_type === 'File' && data[key] instanceof CloudFile) {
      const cloudFile = data[key];
      data[key] = {
        __type: 'File',
        url: cloudFile.getUrl(),
        name: cloudFile.getName()
      };
    } else if (_type === 'Array' && typeof data[key] === 'string' && Collection.exists(data[key])) {
      data[key] = _toJSON(Collection.get(data[key]));
    } else if (_type === 'Object' && typeof data[key] === 'string' && (modelScope || Model).exists(data[key])) {
      data[key] = _toJSON((modelScope || Model).get(data[key]));
    } else if (_type === 'GeoPoint' && typeof data[key] === 'object') {
      data[key] = {
        __type: 'GeoPoint',
        latitude: Number(data[key].latitude),
        longitude: Number(data[key].longitude)
      };
    } else data[key] = _toJSON(data[key]);
  }

  return data;
}

/**
 * @param {unknown} data
 * @param {string} [type] the schema type, when the caller knows it
 * @param {import('@noodl/types').ModelScopeLike} [modelScope] omit for the process-wide store
 * @returns {unknown}
 */
function _deserializeJSON(data, type, modelScope) {
  if (data === undefined) return;
  if (data === null) return null;

  if (type === 'Relation' && data.__type === 'Relation') {
    return undefined; // Ignore relation fields
  } else if (type === 'Pointer' && data.__type === 'Pointer') {
    // This is a pointer type, resolve into id
    return data.objectId;
  } else if (type === 'Date' && data.__type === 'Date') {
    return new Date(data.iso);
  } else if (type === 'Date' && typeof data === 'string') {
    return new Date(data);
  } else if (type === 'File' && data.__type === 'File') {
    return new CloudFile(data);
  } else if (type === 'GeoPoint' && data.__type === 'GeoPoint') {
    return {
      latitude: data.latitude,
      longitude: data.longitude
    };
  } else if (_isArrayOfObjects(data)) {
    var a = [];
    for (var i = 0; i < data.length; i++) {
      a.push(_deserializeJSON(data[i], undefined, modelScope));
    }
    var c = Collection.get();
    c.set(a);
    return c;
  } else if (Array.isArray(data)) return data;
  // This is an array with mixed data, just return it
  else if (data && data.__type === 'Object' && data.className !== undefined && data.objectId !== undefined) {
    const _data = Object.assign({}, data);
    delete _data.className;
    delete _data.__type;
    return _fromJSON(_data, data.className, modelScope);
  } else if (typeof data === 'object' && data !== null) {
    var m = (modelScope || Model).get();
    for (var key in data) {
      m.set(key, _deserializeJSON(data[key], undefined, modelScope));
    }
    return m;
  } else return data;
}

/**
 * Turns one backend record into a Noodl Object, recursively.
 *
 * `modelScope` is optional by construction — every read of it is `(modelScope || Model)` —
 * and omitting it puts the record in the process-wide store instead of a sandbox's. The
 * five call sites in the viewer that omit it are therefore not broken, but a sandboxed
 * preview driving those nodes shares records with the host page. See PLAT-006 notes.
 *
 * @param {{ objectId?: string } & Record<string, unknown>} item
 * @param {string} [collectionName]
 * @param {import('@noodl/types').ModelScopeLike} [modelScope] omit for the process-wide store
 * @returns {import('@noodl/types').ModelLike}
 */
function _fromJSON(item, collectionName, modelScope) {
  const m = (modelScope || Model).get(item.objectId);
  m._class = collectionName;

  if (collectionName !== undefined && CloudStore._collections[collectionName] !== undefined)
    var schema = CloudStore._collections[collectionName].schema;

  for (var key in item) {
    if (key === 'objectId' || key === 'ACL') continue;

    var _type = schema && schema.properties && schema.properties[key] ? schema.properties[key].type : undefined;

    m.set(key, _deserializeJSON(item[key], _type, modelScope));
  }

  return m;
}

CloudStore._fromJSON = _fromJSON;
CloudStore._deserializeJSON = _deserializeJSON;
CloudStore._serializeObject = _serializeObject;

CloudStore.forScope = (modelScope) => {
  if (modelScope === undefined) return CloudStore.instance;
  if (modelScope._cloudStore) return modelScope._cloudStore;

  modelScope._cloudStore = new CloudStore(modelScope);
  return modelScope._cloudStore;
};

var _instance;
Object.defineProperty(CloudStore, 'instance', {
  get: function () {
    if (_instance === undefined) _instance = new CloudStore();
    return _instance;
  }
});

var _collections;
Object.defineProperty(CloudStore, '_collections', {
  get: function () {
    if (_collections === undefined) {
      _collections = {};
      const dbCollections = NoodlRuntime.instance.getMetaData('dbCollections') || [];
      dbCollections.forEach((c) => {
        _collections[c.name] = c;
      });

      const systemCollections = NoodlRuntime.instance.getMetaData('systemCollections') || [];
      systemCollections.forEach((c) => {
        _collections[c.name] = c;
      });
    }
    return _collections;
  }
});

CloudStore.invalidateCollections = () => {
  _collections = undefined;
};

module.exports = CloudStore;
