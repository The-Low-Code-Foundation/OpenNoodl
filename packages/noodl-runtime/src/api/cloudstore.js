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
const { RestDataAdapter } = require('./backends/RestDataAdapter');
const { makeRestSerializer, filterSchemaFor } = require('./backends/restSerialize');
const { relationsFromCachedCollections } = require('@noodl/backend-contract');
const { resolveBackendFromRuntime, ACTIVE_BACKEND, hasStoredRelations } = require('./backends/resolveBackend');

class CloudStore {
  /**
   * @param {import('@noodl/types').ModelScopeLike} [modelScope]
   * @param {import('./backends/resolveBackend').ResolvedBackendTarget} [target]
   *   The backend this store is bound to. Omitted for the legacy singleton, which
   *   resolves `cloudservices` itself and is what every non-Record node still uses.
   */
  constructor(modelScope, target) {
    this._initCloudServices();

    this.modelScope = modelScope;
    this._target = target;

    /**
     * Does this store's adapter want a **neutral** filter rather than a Parse `where`?
     *
     * BCN-004 step 5. `queryutils.convertVisualFilter` translates all the way to Parse,
     * which is right for `ParseWireAdapter` and wrong for `RestDataAdapter` — the REST
     * adapter takes the neutral filter and runs BCN-003's translator for its own dialect.
     * Handing it a Parse document would translate an already-translated filter. The nodes
     * read this flag to decide which of the two they compute; see
     * `queryutils.convertVisualFilterToNeutral`.
     */
    this.usesNeutralFilter = Boolean(target && !target.isParseWire);

    this._adapter = this.usesNeutralFilter
      ? new RestDataAdapter({
          // ⚠️ The hook `RestDataAdapter` defaults to the identity, and whose absence its
          // own notes flag as a live defect: without it a `json` column written from an
          // object-typed port double-encodes, exactly as before RUN-003 fixed it.
          serializeObject: makeRestSerializer({
            collections: () => (this._target ? this._target.collections : []),
            toJSON: _toJSON
          }),
          schemaFor: (collectionName) => filterSchemaFor(this._target ? this._target.collections : [], collectionName),
          // BCN-005. ⚠️ Derived from the **cached** schema, which is a strict
          // subset of what the backends' relation-metadata endpoints describe —
          // and it has to be, because those endpoints are admin-only
          // (Directus 403, PostgREST has none, PocketBase 401) and a running app
          // holds a user token. A relation this cannot see is one the adapter
          // refuses by name rather than guessing a junction table for.
          // BCN-005 schema sync. The editor stores what each backend's relation-metadata
          // endpoint actually described; `relationsFromCachedCollections` is the strict
          // subset derivable without it, and stays as the fallback for a project synced
          // before the editor stored anything. The subset misses PocketBase relation
          // fields and any junction with an extra column, and names a many-to-many after
          // the target collection rather than the parent's own alias.
          //
          // ⚠️ `relations.length &&`, not just `relations &&`. A `custom` backend and an
          // unsynced one both want the fallback, and an empty stored array must not
          // silence it.
          relationsFor: () => {
            const target = this._target;
            if (!target) return [];
            if (hasStoredRelations(target)) return target.relations;
            return relationsFromCachedCollections(target.collections);
          }
        })
      : new ParseWireAdapter({
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
    // BCN-004 step 5: a store bound to a resolved backend answers *that* backend. The
    // legacy singleton keeps the shape below unchanged, including the `nodegx` assumption
    // — `queryutils.backendType()` reads it to pick the filter builder's capability table
    // and would narrow every pre-WF-007 project's operator list if this started guessing
    // `parse`. See `resolveBackend.ts::endpointBackendType`.
    if (this._target) return this._target.handle;

    return {
      id: ACTIVE_BACKEND,
      type: 'nodegx',
      name: 'Built-in',
      url: this.endpoint,
      // The Parse Application Id is precisely what `publicToken` describes: the
      // non-secret identifier that ships with a deployed app.
      publicToken: this.appId
    };
  }

  /** The contract type of the backend this store talks to. */
  backendType() {
    return this._handle().type;
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
 * ⚠️ `objectId` is `string | number`, not `string` — this declaration said `string` while
 * Directus and PostgREST have been handing back JSON numbers all along. See the contract's
 * `RecordId`. `Model.get` keys a plain object, so a numeric id coerces on the way in and
 * that is the reason the mixture has been harmless.
 *
 * @param {{ objectId?: string | number } & Record<string, unknown>} item
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
/** Exported for the REST serialiser, which has to unwrap a `Model`/`Collection` too. */
CloudStore._toJSON = _toJSON;

CloudStore.forScope = (modelScope) => {
  if (modelScope === undefined) return CloudStore.instance;
  if (modelScope._cloudStore) return modelScope._cloudStore;

  modelScope._cloudStore = new CloudStore(modelScope);
  return modelScope._cloudStore;
};

/**
 * The store for one scope **and one backend** — BCN-004 step 5's resolver.
 *
 * `forScope` is the singleton path and is left exactly as it was: it resolves nothing,
 * always speaks the Parse wire, and is what the twenty-odd nodes that have no backend
 * picker still call. This is the path the six Record nodes take, and the only difference
 * is that the backend is an argument.
 *
 * Three rules, all of them load-bearing:
 *
 * 1. **`_active_` and "unset" are the same request**, and both resolve through
 *    `resolveBackend.ts::defaultBackendId` — which answers the project's `cloudservices`
 *    endpoint when there is one. That is what makes this a no-op for every project that
 *    exists today.
 * 2. **A resolution that lands back on the legacy endpoint returns the legacy store.**
 *    Not an equivalent one: `dbcollectionnode2` subscribes to save/create/delete events on
 *    the store it queries through, and two stores for one backend would mean a record
 *    created by one node never reaching the query node watching for it.
 * 3. **A backend id that names nothing returns `undefined`**, so the caller can report a
 *    sentence. Falling back to the default would write to a different backend than the one
 *    the graph names, silently.
 *
 * @param {import('@noodl/types').ModelScopeLike} [modelScope]
 * @param {string} [backendId] a `backendServices` id, `'_endpoint_'`, or `'_active_'`
 * @returns {CloudStore | undefined}
 */
CloudStore.forBackend = (modelScope, backendId) => {
  const target = resolveBackendFromRuntime(backendId);

  // Nothing configured at all: a brand-new project, or a runtime with no metadata. The
  // legacy store is the honest answer — it is what these nodes have always used, and it
  // reads `cloudservices` for itself when the deploy injects it later.
  if (!target) {
    if (!backendId || backendId === ACTIVE_BACKEND) return CloudStore.forScope(modelScope);
    return undefined;
  }

  if (target.isParseWire && target.entry.id === '_endpoint_') return CloudStore.forScope(modelScope);

  const owner = modelScope || CloudStore;
  if (owner._cloudStoresByBackend === undefined) owner._cloudStoresByBackend = {};
  if (owner._cloudStoresByBackend[target.entry.id] === undefined) {
    owner._cloudStoresByBackend[target.entry.id] = new CloudStore(modelScope, target);
  } else {
    // The metadata can change under a live store — a re-introspection, a new token — and
    // the handle is read from `_target` on every call, so refreshing it is enough.
    owner._cloudStoresByBackend[target.entry.id]._target = target;
  }

  return owner._cloudStoresByBackend[target.entry.id];
};

/** Drop the per-backend stores. Used by tests; harmless at runtime. */
CloudStore.invalidateBackends = (modelScope) => {
  const owner = modelScope || CloudStore;
  owner._cloudStoresByBackend = undefined;
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
