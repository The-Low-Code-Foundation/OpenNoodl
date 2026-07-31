/// <reference path="../../globals.d.ts" />
//
// The reference is load-bearing, and PLAT-003 slice 13 is why.
//
// `_noodl_cloud_runtime_version` and `_noodl_cloudservices` are ambient globals
// declared in `src/globals.d.ts`. That declaration is in *this* package's
// program, and it was enough while the wire lived in `cloudstore.js`: a `.js`
// file under `checkJs: false` is never typechecked, and consumers' `ts-jest`
// passes it through untransformed.
//
// Moving the wire into a `.ts` file changes both halves. `cloudstore.js` now
// requires a TypeScript module, so every consumer's `ts-jest` compiles *this*
// file with *their* tsconfig — where `src/globals.d.ts` is not in scope, and
// nine `typeof` guards become nine `TS2304`s. `noodl-viewer-react`'s tsconfig
// already carries a long comment about this exact failure; the reference is what
// makes the file carry its own ambients into whichever program picks it up.
//
// The bare identifiers must stay bare. `globalThis._noodl_cloudservices` would
// satisfy the compiler and quietly break the deploy bundles, where webpack's
// DefinePlugin substitutes the *identifier* — a property access is not a
// substitution site.
/**
 * `ParseWireAdapter` — the Parse wire, behind `IDataAdapter`.
 *
 * This is `CloudStore`'s body, moved and not rewritten. Every request path,
 * every header, every argument order and every callback signature below is what
 * `cloudstore.js` did before BCN-002, including the parts that look like
 * mistakes. That restraint is the whole point of the task: the seam is only
 * proven if putting it in changes nothing, and "changes nothing" is only a
 * testable claim if nothing was tidied on the way through.
 *
 * ## Why this folder is not `api/adapters/`
 *
 * `api/adapters/` already exists and is **a different layer**. Its
 * `CloudStoreAdapter` interface and `LocalSQLAdapter` are the *server-side*
 * persistence stack `nodegx-backend` runs behind its Parse wire — they answer
 * requests, they do not make them. The two shapes resemble each other because
 * both sides of one protocol resemble each other, and filing a client adapter in
 * there would make that coincidence look like a hierarchy. `api/backends/` holds
 * adapters that *talk to* a backend.
 *
 * (`dbcollectionnode2.ts:25` imports `WhereClause` from those server-side types,
 * which is a genuine cross-layer leak. Recorded rather than fixed here: the type
 * it wants is the contract's `Filter`, and BCN-003 owns the filter model.)
 *
 * ## The Parse-ness, in one place
 *
 * `_makeRequest` is the seam every other adapter replaces. It holds the
 * `X-Parse-Application-Id` header taken from `handle.publicToken`, the
 * master-key header (**cloud-runtime only** — see below), the
 * `localStorage['Parse/<appId>/currentUser']` session lookup, and the
 * `{_method: 'GET'}` POST tunnel that lets a query carry a body. The `/classes/`
 * and `/files/` path prefixes live in the callers, one line above each request.
 *
 * ## Preserved deliberately, because this task may not improve anything
 *
 * - **`_noodl_cloudservices` is a cloud-runtime global.** In a browser both it
 *   and `_noodl_cloud_runtime_version` are absent, so the master-key header is
 *   never set there. Both branches keep their own guard and a test asserts the
 *   browser path never sends a master key.
 * - **The `{_method: 'GET'}` POST tunnel is not cruft.** It exists so a query can
 *   send a body. "Simplifying" it to a real GET truncates large filters at the
 *   URL length limit, silently.
 * - **`uploadFile` passes a `contentType` option `_makeRequest` never reads.**
 *   Dead before this move, dead after it.
 * - **`create` emits its event with `objectId: options.objectId`**, and
 *   `CreateOptions` has no `objectId` — so a create event's `objectId` is always
 *   `undefined`. Pre-existing.
 * - **The session header is set whenever the stored user parses**, even when the
 *   stored object has no `sessionToken` — which sends the literal string
 *   `undefined`. Guarding it would be a fix, and a fix here would spend the only
 *   signal this task produces.
 * - **`create`/`save` serialise through the module-scope serialiser, which
 *   ignores `modelScope`**, though the constructor builds a scope-bound copy. A
 *   sandboxed preview therefore serialises against the process-wide Model store.
 *   Pre-existing (PLAT-006 records the sibling case in `_fromJSON`); the
 *   injected hook below preserves it exactly.
 *
 * @module api/backends/ParseWireAdapter
 */

import type {
  AdapterRecord,
  AggregateOptions,
  BackendHandle,
  CountOptions,
  CreateOptions,
  DeleteFileOptions,
  DeleteOptions,
  DistinctOptions,
  FetchOptions,
  IDataAdapter,
  IncrementOptions,
  QueryOptions,
  RelationOptions,
  SaveOptions,
  SignFileUrlOptions,
  UploadFileOptions
} from '@noodl/backend-contract';

import { AdapterEvents } from './AdapterEvents';
import { normalizeFileRef, normalizeSignedFileUrl, PARSE_FILE_FIELDS } from './fileRef';
import { normalizeRecordIdentities, normalizeRecordIdentity } from './recordIdentity';

/**
 * A decoded Parse response body.
 *
 * Loose on purpose — it is the backend's shape, not ours, and the four fields
 * named here are the only ones any caller below reads.
 */
interface WireResponse {
  results?: AdapterRecord[];
  count?: number;
  error?: string;
  [field: string]: unknown;
}

/** What the wire hands an error callback. `status` only on the XHR path. */
interface WireError {
  error?: string;
  status?: number;
  [field: string]: unknown;
}

/** The shape `_makeRequest` takes. Internal to this adapter. */
interface WireRequest {
  method?: string;
  content?: unknown;
  /** Dead — `_makeRequest` never reads it. See the module note. */
  contentType?: string;
  headers?: Record<string, string>;
  onUploadProgress?: (progress: { loaded: number; total: number }) => void;
  success: (response?: WireResponse) => void;
  error: (err?: WireError) => void;
}

export interface ParseWireAdapterOptions {
  /**
   * Turn a record's data into Parse wire JSON — pointers, dates, geopoints and
   * files into their `__type` envelopes.
   *
   * Injected rather than owned, because the conversion needs the Noodl `Model`
   * and `Collection` classes and the project's schema cache; an adapter that
   * imported those would drag the whole runtime in behind every backend.
   * BCN-004's adapters get their own serialiser through the same hook.
   */
  serializeObject: (data: Record<string, unknown>, collection: string) => Record<string, unknown>;
  /**
   * Parse Server's major version, for the one place the wire forked.
   *
   * `cloudstore.js:212` switched `$group`/`$match` to `group`/`match` and the
   * grouping key from `_id` to `objectId` above version 4. That is
   * Parse-server-version knowledge, so it lives inside the Parse adapter rather
   * than on `BackendHandle` — no other backend has an opinion about it.
   */
  getServerVersionMajor: () => number | undefined;
}

const _protectedFields: Record<string, string[]> = {
  _common: ['_createdAt', '_updatedAt', 'objectId'],
  _User: ['_email_verify_token']
};

function _removeProtectedFields(data: Record<string, unknown>, className: string): Record<string, unknown> {
  const _data = Object.assign({}, data);
  _protectedFields._common.forEach((f) => delete _data[f]);
  if (className && _protectedFields[className]) _protectedFields[className].forEach((f) => delete _data[f]);

  return _data;
}

export class ParseWireAdapter extends AdapterEvents implements IDataAdapter {
  /**
   * What this wire calls a record's identity — the contract's own name, so
   * {@link normalizeRecordIdentity} is the identity function here and returns
   * records by reference. Declared anyway, because the declaration is the rule
   * BCN-004's adapters will implement with a different answer.
   */
  static readonly wireIdField = 'objectId';

  private readonly serializeObject: ParseWireAdapterOptions['serializeObject'];
  private readonly getServerVersionMajor: ParseWireAdapterOptions['getServerVersionMajor'];

  constructor(options: ParseWireAdapterOptions) {
    super();
    this.serializeObject = options.serializeObject;
    this.getServerVersionMajor = options.getServerVersionMajor;
  }

  private normalize(record: AdapterRecord): AdapterRecord {
    return normalizeRecordIdentity(record, ParseWireAdapter.wireIdField);
  }

  private normalizeAll(records: AdapterRecord[]): AdapterRecord[] {
    return normalizeRecordIdentities(records, ParseWireAdapter.wireIdField);
  }

  // ── The wire ─────────────────────────────────────────────────────────────

  /**
   * The Parse seam. Moved from `cloudstore.js:54` with one substitution:
   * `this.endpoint`/`this.appId` became `handle.url`/`handle.publicToken`.
   *
   * `publicToken` carries the Parse Application Id because that is precisely
   * what the field is for — the non-secret identifier that ships with a deployed
   * app. The privileged `adminToken` the editor holds for schema introspection
   * is a different field and must never arrive here.
   */
  _makeRequest(handle: BackendHandle, path: string, options: WireRequest): void {
    if (typeof _noodl_cloud_runtime_version === 'undefined') {
      // Running in browser
      var xhr = new XMLHttpRequest();

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          var json;
          try {
            // In SSR, we dont have xhr.response
            json = JSON.parse(xhr.response || xhr.responseText);
          } catch (e) {}

          if (xhr.status === 200 || xhr.status === 201) {
            options.success(json);
          } else options.error(json || { error: xhr.responseText, status: xhr.status });
        }
      };

      xhr.open(options.method || 'GET', handle.url + path, true);

      xhr.setRequestHeader('X-Parse-Application-Id', handle.publicToken);
      // The second half of this guard is BCN-002's live-pass fix: `masterKey` is
      // optional on `_noodl_cloudservices`, and setting a header to `undefined`
      // sends the four-letter string, not nothing. See the fetch branch.
      if (typeof _noodl_cloudservices !== 'undefined' && _noodl_cloudservices.masterKey !== undefined)
        xhr.setRequestHeader('X-Parse-Master-Key', _noodl_cloudservices.masterKey);

      // Check for current users.
      //
      // A session token already on the handle wins; nothing sets one yet, so
      // today this is byte-for-byte the old path. The branch exists so BCN-006
      // has somewhere to land that is not a second session store invented here.
      if (handle.sessionToken !== undefined) {
        xhr.setRequestHeader('X-Parse-Session-Token', handle.sessionToken);
      } else {
        var _cu = readStoredCurrentUser(handle);
        if (_cu !== undefined) {
          xhr.setRequestHeader('X-Parse-Session-Token', _cu.sessionToken);
        }
      }

      // BAK-006 follow-up: caller-supplied headers (e.g. the Upload File node's
      // Private input setting `X-NodeGX-File-Private`). Never overrides the
      // Parse/session headers above — a caller has no reason to, and none of
      // this module's callers try to.
      if (options.headers) {
        for (var headerName in options.headers) {
          if (options.headers[headerName] !== undefined) xhr.setRequestHeader(headerName, options.headers[headerName]);
        }
      }

      if (options.onUploadProgress) {
        xhr.upload.onprogress = (pe) => options.onUploadProgress(pe);
      }

      if (options.content instanceof File) {
        xhr.send(options.content);
      } else {
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(options.content));
      }
    } else {
      // Running in cloud runtime
      const endpoint = typeof _noodl_cloudservices !== 'undefined' ? _noodl_cloudservices.endpoint : handle.url;
      const appId = typeof _noodl_cloudservices !== 'undefined' ? _noodl_cloudservices.appId : handle.publicToken;
      const masterKey = typeof _noodl_cloudservices !== 'undefined' ? _noodl_cloudservices.masterKey : undefined;

      // BCN-002 live-pass fix. This used to be one object literal with
      // `'X-Parse-Master-Key': masterKey` in it, and when there is no master key
      // that property is `undefined` — which `JSON.stringify` drops but
      // `new Headers()` keeps, as the literal four-letter string `undefined`.
      // A cloud runtime without baked credentials (a configuration
      // `globals.d.ts` describes explicitly) therefore sent
      // `X-Parse-Master-Key: undefined` on *every* request, and
      // `nodegx-backend` counts each one as a failed credential attempt and
      // locks the caller out for 300 seconds after a handful.
      //
      // Found by the live pass, on the very first run, and by nothing else: the
      // unit suites all take the XHR branch, and upstream Parse ignores a
      // master-key header it does not recognise rather than rejecting it. The
      // one server that fails loudly here is our own.
      const headers: Record<string, string> = Object.assign(
        { 'X-Parse-Application-Id': appId, 'Content-Type': 'application/json' },
        masterKey !== undefined ? { 'X-Parse-Master-Key': masterKey } : {},
        options.headers || {}
      );

      fetch(endpoint + path, {
        method: options.method || 'GET',
        headers,
        body: JSON.stringify(options.content)
      })
        .then((r) => {
          if (r.status === 200 || r.status === 201) {
            if (options.method === 'DELETE') {
              options.success(undefined);
            } else {
              r.json()
                .then((json) => options.success(json))
                .catch((e) =>
                  options.error({
                    error: 'CloudStore: Failed to get json result.'
                  })
                );
            }
          } else {
            if (options.method === 'DELETE') {
              options.error({ error: 'Failed to delete.' });
            } else {
              r.json()
                .then((json) => options.error(json))
                .catch((e) => options.error({ error: 'Failed to fetch.' }));
            }
          }
        })
        .catch((e) => {
          options.error({ error: e.message });
        });
    }
  }

  // ── Query & read ─────────────────────────────────────────────────────────

  query(handle: BackendHandle, options: QueryOptions): void {
    const _this = this;

    this._makeRequest(handle, '/classes/' + options.collection, {
      method: 'POST',
      content: {
        _method: 'GET',
        where: options.where,
        limit: options.limit,
        skip: options.skip,
        include: Array.isArray(options.include) ? options.include.join(',') : options.include,
        keys: Array.isArray(options.select) ? options.select.join(',') : options.select,
        order: Array.isArray(options.sort) ? options.sort.join(',') : options.sort,
        count: options.count,
        // BAK-008: a non-empty search term switches the server from a plain
        // query to an FTS5-ranked search (still composed with `where` and the
        // caller's ACL). A dedicated `search` param, not Parse's `$text`
        // operator — the ranking/snippet response shape doesn't fit inside a
        // boolean WHERE predicate, and no runtime client ever emitted `$text`
        // to preserve compatibility with. See BAK-008-NOTES.md.
        search: options.search || undefined
      },
      success: function (response) {
        options.success(_this.normalizeAll(response.results), response.count);
      },
      error: function () {
        options.error();
      }
    });
  }

  aggregate(handle: BackendHandle, options: AggregateOptions): void {
    const args: string[] = [];

    if (!options.group) {
      options.error('You need to provide group option.');
      return;
    }

    if (options.limit) args.push('limit=' + options.limit);
    if (options.skip) args.push('skip=' + options.skip);

    const grouping: Record<string, unknown> = {};

    Object.keys(options.group).forEach((k) => {
      const _g: Record<string, unknown> = {};
      const group = options.group[k] as Record<string, string>;
      if (group['avg'] !== undefined) _g['$avg'] = '$' + group['avg'];
      else if (group['sum'] !== undefined) _g['$sum'] = '$' + group['sum'];
      else if (group['max'] !== undefined) _g['$max'] = '$' + group['max'];
      else if (group['min'] !== undefined) _g['$min'] = '$' + group['min'];
      else if (group['distinct'] !== undefined) _g['$addToSet'] = '$' + group['distinct'];

      grouping[k] = _g;
    });

    // I don't know which version the API was changed, lets just say above 4 for now.
    const dbVersionMajor = this.getServerVersionMajor();
    if (dbVersionMajor && dbVersionMajor > 4) {
      grouping._id = null;

      if (options.where) args.push('$match=' + encodeURIComponent(JSON.stringify(options.where)));

      args.push('$group=' + JSON.stringify(grouping));
    } else {
      grouping.objectId = null;

      if (options.where) args.push('match=' + encodeURIComponent(JSON.stringify(options.where)));

      args.push('group=' + JSON.stringify(grouping));
    }

    this._makeRequest(handle, '/aggregate/' + options.collection + (args.length > 0 ? '?' + args.join('&') : ''), {
      success: function (response) {
        const res: Record<string, unknown> = {};

        if (!response.results || response.results.length !== 1) {
          options.success({}); // No result
          return;
        }

        Object.keys(options.group).forEach((k) => {
          res[k] = response.results[0][k];
        });

        options.success(res);
      },
      error: function () {
        options.error();
      }
    });
  }

  count(handle: BackendHandle, options: CountOptions): void {
    const args: string[] = [];

    if (options.where) args.push('where=' + encodeURIComponent(JSON.stringify(options.where)));
    args.push('limit=0');
    args.push('count=1');

    this._makeRequest(handle, '/classes/' + options.collection + (args.length > 0 ? '?' + args.join('&') : ''), {
      success: function (response) {
        options.success(response.count);
      },
      error: function () {
        options.error();
      }
    });
  }

  distinct(handle: BackendHandle, options: DistinctOptions): void {
    const args: string[] = [];

    if (options.where) args.push('where=' + encodeURIComponent(JSON.stringify(options.where)));
    args.push('distinct=' + options.property);

    this._makeRequest(handle, '/aggregate/' + options.collection + (args.length > 0 ? '?' + args.join('&') : ''), {
      success: function (response) {
        options.success(response.results);
      },
      error: function () {
        options.error();
      }
    });
  }

  fetch(handle: BackendHandle, options: FetchOptions): void {
    const args: string[] = [];

    if (options.include)
      args.push('include=' + (Array.isArray(options.include) ? options.include.join(',') : options.include));

    this._makeRequest(
      handle,
      '/classes/' + options.collection + '/' + options.objectId + (args.length > 0 ? '?' + args.join('&') : ''),
      {
        method: 'GET',
        success: (response) => {
          const record = this.normalize(response);
          options.success(record);
          this.emitAdapterEvent({
            type: 'fetch',
            objectId: options.objectId,
            object: record,
            collection: options.collection
          });
        },
        error: function (res) {
          options.error(res.error);
        }
      }
    );
  }

  // ── Write ────────────────────────────────────────────────────────────────

  create(handle: BackendHandle, options: CreateOptions): void {
    this._makeRequest(handle, '/classes/' + options.collection, {
      method: 'POST',
      content: Object.assign(
        _removeProtectedFields(this.serializeObject(options.data, options.collection), options.collection),
        { ACL: options.acl }
      ),
      success: (response) => {
        const _obj = this.normalize(Object.assign({}, options.data, response));
        options.success(_obj);
        this.emitAdapterEvent({
          type: 'create',
          // Always `undefined` — `CreateOptions` has no `objectId`. Pre-existing;
          // see the module note.
          objectId: (options as { objectId?: string }).objectId,
          object: _obj,
          collection: options.collection
        });
      },
      error: function (res) {
        options.error(res.error);
      }
    });
  }

  increment(handle: BackendHandle, options: IncrementOptions): void {
    const data: Record<string, unknown> = {};

    for (let key in options.properties) {
      data[key] = { __op: 'Increment', amount: options.properties[key] };
    }

    this._makeRequest(handle, '/classes/' + options.collection + '/' + options.objectId, {
      method: 'PUT',
      content: data,
      success: (response) => {
        options.success(this.normalize(response));
      },
      error: function (res) {
        options.error(res.error);
      }
    });
  }

  save(handle: BackendHandle, options: SaveOptions): void {
    const _data = Object.assign({}, options.data);
    delete _data.createdAt;
    delete _data.updatedAt;

    this._makeRequest(handle, '/classes/' + options.collection + '/' + options.objectId, {
      method: 'PUT',
      content: Object.assign(
        _removeProtectedFields(this.serializeObject(_data, options.collection), options.collection),
        { ACL: options.acl }
      ),
      success: (response) => {
        options.success(this.normalize(response));
        this.emitAdapterEvent({
          type: 'save',
          objectId: options.objectId,
          object: this.normalize(Object.assign({}, options.data, response)),
          collection: options.collection
        });
      },
      error: function (res) {
        options.error(res.error);
      }
    });
  }

  delete(handle: BackendHandle, options: DeleteOptions): void {
    this._makeRequest(handle, '/classes/' + options.collection + '/' + options.objectId, {
      method: 'DELETE',
      success: () => {
        options.success();
        this.emitAdapterEvent({
          type: 'delete',
          objectId: options.objectId,
          collection: options.collection
        });
      },
      error: function (res) {
        options.error(res.error);
      }
    });
  }

  // ── Relations ────────────────────────────────────────────────────────────

  addRelation(handle: BackendHandle, options: RelationOptions): void {
    const _content: Record<string, unknown> = {};
    _content[options.key] = {
      __op: 'AddRelation',
      objects: [
        {
          __type: 'Pointer',
          objectId: options.targetObjectId,
          className: options.targetClass
        }
      ]
    };
    this._makeRequest(handle, '/classes/' + options.collection + '/' + options.objectId, {
      method: 'PUT',
      content: _content,
      success: (response) => {
        options.success(this.normalize(response));
      },
      error: function (res) {
        options.error(res.error);
      }
    });
  }

  removeRelation(handle: BackendHandle, options: RelationOptions): void {
    const _content: Record<string, unknown> = {};
    _content[options.key] = {
      __op: 'RemoveRelation',
      objects: [
        {
          __type: 'Pointer',
          objectId: options.targetObjectId,
          className: options.targetClass
        }
      ]
    };
    this._makeRequest(handle, '/classes/' + options.collection + '/' + options.objectId, {
      method: 'PUT',
      content: _content,
      success: (response) => {
        options.success(this.normalize(response));
      },
      error: function (res) {
        options.error(res.error);
      }
    });
  }

  // ── Files ────────────────────────────────────────────────────────────────

  uploadFile(handle: BackendHandle, options: UploadFileOptions): void {
    this._makeRequest(handle, '/files/' + options.file.name, {
      method: 'POST',
      content: options.file,
      // Dead — `_makeRequest` never reads `contentType`. See the module note.
      contentType: options.file.type,
      // BAK-006 follow-up: the Upload File node's Private input. The backend
      // reads this exact header (files.ts, case-insensitively) to ACL the
      // upload to its owner instead of leaving it public.
      headers: options.private ? { 'X-NodeGX-File-Private': 'true' } : undefined,
      // BCN-007 step 1. This used to be
      // `Object.assign({}, options.data, response)` cast to `{name, url}` —
      // whatever the backend sent, spread over a caller-supplied object no
      // caller has ever supplied, asserted to be the right shape. Now it is
      // normalised, which on this wire is close to the identity: the four
      // fields `nodegx-backend`'s `FileUploadResult` returns are the four the
      // contract names, so `contentType` and `size` simply stop being discarded.
      // Upstream Parse returns `{name, url}` only and both come out absent,
      // which is the honest answer for that backend rather than a zero.
      success: (response) => options.success(normalizeFileRef(response, PARSE_FILE_FIELDS)),
      error: (err) => options.error(err),
      onUploadProgress: options.onUploadProgress
    });
  }

  /**
   * BAK-006 follow-up: mint a short-TTL signed URL for a (typically private)
   * file — `GET /files/:name/sign`. Gated server-side by the same row-ACL check
   * reading the file itself would use; this call fails the same way an
   * unauthorized read would if the caller cannot already read the file.
   *
   * **`kind` is `signed` unconditionally on this wire, and that is measured, not
   * assumed.** This adapter serves two backend types. Ours mints
   * `?exp=&sig=` — a real, self-proving, expiring URL. Upstream Parse has no
   * route here at all: BCN-002 probed it and got 403 code 119 with the master
   * key as well as without, and `parse`'s `files.sign` cell was corrected from
   * `conditional` to `unsupported` on that evidence. So the only server that
   * ever reaches this `success` callback is the one that signs, and stamping
   * `signed` here cannot be wrong for want of a `parse` branch.
   */
  signFileUrl(handle: BackendHandle, options: SignFileUrlOptions): void {
    this._makeRequest(handle, '/files/' + options.name + '/sign', {
      method: 'GET',
      success: (response) => options.success(normalizeSignedFileUrl(response, 'signed')),
      error: (err) => options.error(err)
    });
  }

  // ── Not contract, and deliberately so ────────────────────────────────────

  /**
   * The signed-in end user's id, from wherever this wire keeps the session.
   *
   * **Not an `IDataAdapter` method.** It is here because `dbmodelcrudbase.ts`'s
   * `_getCurrentUser` used to read `localStorage['Parse/' + appId +
   * '/currentUser']` itself and pick `objectId` out of it — node code that knew
   * the storage key, the key's Parse-shaped name, and the singleton it needed
   * an `appId` from. That is the one genuine leak among BCN-002's nine
   * Parse-concept references, and the rule is that a leak moves into the adapter
   * rather than being documented where it sits.
   *
   * It stops here rather than becoming a contract method because auth is
   * BCN-006's and `IAuthAdapter` is where a real answer belongs. Adding a
   * fifteenth data method for it would make the contract's shape a matter of
   * whichever task needed something next.
   */
  currentUserId(handle: BackendHandle): string | undefined {
    const currentUser = readStoredCurrentUser(handle);
    return currentUser !== undefined ? currentUser.objectId : undefined;
  }

  /** Users holding the master key are allowed to delete files. */
  deleteFile(handle: BackendHandle, options: DeleteFileOptions): void {
    this._makeRequest(handle, '/files/' + options.file.name, {
      method: 'DELETE',
      success: (response) => options.success(Object.assign({}, (options as { data?: unknown }).data, response)),
      error: (err) => options.error(err)
    });
  }
}

/** What `userservice.ts` stores. Only two of its fields are ever read back out. */
interface StoredCurrentUser {
  objectId?: string;
  sessionToken?: string;
}

/**
 * The browser session seam, unchanged: `userservice.ts` writes the signed-in
 * user under `Parse/<appId>/currentUser`, and every request reads it back per
 * call — so a login or a logout takes effect on the next request without
 * anything having to be told.
 *
 * Returning the stored object rather than only its token preserves a detail
 * that matters: the caller can tell "no stored user" from "stored user with no
 * `sessionToken`", and the second case has always set the header to the literal
 * string `undefined`. Guarding that would be a fix, and a fix here would spend
 * the only signal this task produces.
 *
 * BCN-006 owns replacing all of it. Inventing a shared session store now would
 * be wrong before auth lands, which is why this is still a `localStorage` read
 * keyed by a Parse-shaped name.
 */
function readStoredCurrentUser(handle: BackendHandle): StoredCurrentUser | undefined {
  const _cu = localStorage['Parse/' + handle.publicToken + '/currentUser'];
  if (_cu === undefined) return undefined;

  try {
    return JSON.parse(_cu);
  } catch (e) {
    // Failed to extract session token
    return undefined;
  }
}
