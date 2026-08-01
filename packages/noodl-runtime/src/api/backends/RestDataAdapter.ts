/**
 * `RestDataAdapter` — Directus, Supabase and PocketBase behind `IDataAdapter`.
 *
 * One adapter, three wires, no third translator. What varies per backend is a
 * {@link RestWireProfile} (measured, in `@noodl/backend-contract/wire`), a
 * filter dialect (BCN-003, in `@noodl/backend-contract/translators`) and a
 * capability descriptor (BCN-001). What does not vary is in this file.
 *
 * ## Three things this file refuses to do, and why each one matters
 *
 * **1. It is not configured from the editor's `BackendPreset`.** The spec says
 * it should be. The BCN-004 probe says the preset is wrong in three places, so
 * doing what the spec says would ship a known bug: Directus's
 * `totalCountPath: 'meta.total_count'` is a number that *ignores the filter*
 * (the RUN-003 defect, back again), PocketBase's `offsetParam: 'page'` is a
 * 1-based page number wearing a row offset's name, and Supabase's total is a
 * response header no body path can reach. Worse, preset values are **copied
 * into project metadata** when a backend is added, so a project saved today
 * would keep the wrong total after the preset was fixed. The profiles are code
 * that ships. See `BCN-004-WIRE-FACTS.md` and the module comment in `wire.ts`.
 *
 * **2. It refuses rather than guesses.** Two cases, both measured:
 *
 * - **`aggregate` on PocketBase.** BCN-001 found PocketBase does not reject an
 *   aggregate — it *ignores* it, answering `200` with ordinary un-aggregated
 *   rows for every spelling there is. An Aggregate Records node pointed at
 *   PocketBase would show wrong numbers with nothing anywhere to catch. The
 *   descriptor gate below is the only thing that can stop that, which is the
 *   single strongest argument for the capability model in the whole phase.
 * - **A row offset a page-based wire cannot express.** `skip=5, limit=10` is
 *   not any page. {@link paginationParams} reports that as `inexact`, and this
 *   adapter turns it into an error rather than returning rows 0–9 labelled as
 *   rows 5–14. See {@link RestDataAdapter.query}.
 *
 * **3. It never calls `success` with nothing.** ⚠️ PostgREST answers a create
 * *and an update* with `201`/`204` and an **empty body** unless
 * `Prefer: return=representation` is sent. `IDataAdapter.create` hands
 * `success` an `AdapterRecord`, so an adapter that omits the header calls back
 * with `undefined` on a success status, with no error anywhere — the same shape
 * as the `convertFilterOp` defect BCN-003 found. The header is sent (from the
 * profile) and a missing record is an **error**, never an empty success.
 *
 * ## Relations — BCN-005
 *
 * `addRelation`/`removeRelation` were blanket refusals here. They are
 * implementations now, on the three write shapes `RelationWrite` names, and
 * every one was measured before it was written. **Two refusals stayed**: a
 * relation the synced schema does not describe (relation metadata is admin-only
 * on all three backends — 403/403/401 measured — so the runtime cannot look one
 * up), and `custom`. See {@link RestDataAdapter.addRelation}.
 *
 * The read half gained two corrections a unit test could not have found:
 * Directus's M2M `include` is **two hops** (one hop returns junction rows with a
 * 200), and a PostgREST embed nests under the *table* name unless it is aliased.
 *
 * ## Files — BCN-007 steps 2–7
 *
 * `uploadFile`/`signFileUrl`/`deleteFile` were blanket refusals here. They are
 * implementations now, on wires that were **probed before they were written**,
 * and the probes contradicted the spec twice: Directus does **not** refuse to
 * delete a referenced file (204, and it nulls the reference), and PocketBase's
 * `protected: true` does **not** make a file private on its own. Both are
 * written up at their call sites and in the descriptors.
 *
 * The one structural thing to know: **two of these three cannot store a file
 * without being told where.** Supabase needs a bucket and a path, PocketBase
 * needs a collection, a field and (optionally) a record. `FileTarget` carries
 * it, the other three backends ignore it, and a missing one is a **refusal with
 * a sentence** rather than a guessed bucket name — see {@link
 * RestDataAdapter.uploadFile}.
 *
 * ## What is not here
 *
 * **Upload progress.** `fetch` cannot report it; `XMLHttpRequest` can, which is
 * why the Parse wire does. Nothing synthetic is emitted and the three
 * `files.progress` cells were corrected to `degraded` — two of them read
 * `supported` on the strength of an XHR path this adapter does not use.
 *
 * @module api/backends/RestDataAdapter
 */

import {
  descriptorFor,
  findRelation,
  paginationParams,
  readRecord,
  readRows,
  readTotalCount,
  relationTarget,
  restWireProfileFor,
  type AdapterRecord,
  type AggregateOptions,
  type BackendHandle,
  type Capability,
  type CapabilityKey,
  type CountOptions,
  type CreateOptions,
  type DeleteFileOptions,
  type DeleteOptions,
  type DistinctOptions,
  type FetchOptions,
  type FileError,
  type IDataAdapter,
  type IncrementOptions,
  type ListOption,
  type QueryOptions,
  type RelationDescriptor,
  type RecordId,
  type RelationOptions,
  type RestWireProfile,
  type SaveOptions,
  type SignFileUrlOptions,
  type UploadFileOptions
} from '@noodl/backend-contract';

import {
  bindPocketBaseFilter,
  toDirectusFilter,
  toPocketBaseFilter,
  toPostgrest,
  type FilterOperator,
  type FilterSchema,
  type PostgrestFilter
} from '@noodl/backend-contract/translators';

import { AdapterEvents } from './AdapterEvents';
import { directusPathOverride } from './directusSystem';
import {
  DIRECTUS_FILE_FIELDS,
  POCKETBASE_FILE_FIELDS,
  SUPABASE_FILE_FIELDS,
  jwtExpiry,
  normalizeFileRef
} from './fileRef';
import { normalizeRecordIdentities, normalizeRecordIdentity } from './recordIdentity';

/** Query-string parameters as **pairs**, not a record — PostgREST repeats keys. */
type Params = Array<[string, string]>;

/**
 * What may go on the wire as a request body.
 *
 * ⚠️ **Widened by BCN-007, and the widening is load-bearing.** Every data method
 * sends JSON, so `string` was enough — but all three of these backends take an
 * upload as either raw bytes or `multipart/form-data`, and both of those are
 * *binary*. A `JSON.stringify` in the middle of an upload path turns a PNG into
 * the string `{}` and the backend stores it, answers 200, and serves back four
 * bytes of nothing. The type is what stops that being possible.
 *
 * `Blob` and `FormData` only, deliberately — not the whole of `BodyInit`. Those
 * are the two shapes the upload paths here produce (`File extends Blob`), and
 * every wider member brings a variance problem with `fetch`'s own `BodyInit`
 * that has to be cast away, which is the opposite of what this type is for.
 */
export type RequestBody = string | Blob | FormData;

/** The subset of `fetch` this adapter uses, so a test can inject one. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: RequestBody }
) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface RestDataAdapterOptions {
  /**
   * The `fetch` to use. Injected rather than captured so the unit suite can
   * drive every branch without a server, and so a cloud runtime can supply its
   * own. Defaults to the ambient `fetch`.
   */
  fetchImpl?: FetchLike;

  /**
   * `conditional` capability cells a live probe has settled **affirmatively**.
   *
   * The contract's rule is that `conditional` is treated as unsupported until
   * proven, so without this a Supabase aggregate is refused — which is correct,
   * because stock PostgREST 12.2.3 answers `PGRST123 "Use of aggregate
   * functions is not allowed"` and Supabase sets that flag per project. Passing
   * the key here is how a caller that has run the probe says it may proceed.
   */
  probedCapabilities?: readonly CapabilityKey[];
  /** The same, for `conditional` **filter operator** cells. */
  probedFilterOperators?: readonly FilterOperator[];

  /**
   * The collection schema a filter translation may need, by collection name.
   *
   * Optional throughout: a filter on a plain field translates with no schema at
   * all. It exists because `FilterSchema` is what tells `pointsTo` its target
   * collection, and because the port generator already holds this data — the
   * adapter should not fetch a second copy.
   */
  schemaFor?: (collection: string, handle: BackendHandle) => FilterSchema | undefined;

  /**
   * Last chance to shape a record's data before it goes on the wire.
   *
   * The same hook `ParseWireAdapter` takes, and for the same reason: the
   * schema-aware normalisation the BYOB path did (`byob-utils::normalizeValue`
   * parses a JSON column's text, coerces a date column to ISO 8601) needs the
   * project's schema cache, and an adapter that imported that would drag the
   * whole runtime in behind every backend. Defaults to the identity.
   */
  serializeObject?: (data: Record<string, unknown>, collection: string, handle: BackendHandle) => Record<string, unknown>;

  /**
   * The backend's relations, as parsed at schema-sync time.
   *
   * ⚠️ **This cannot be fetched here, and that is a measured constraint rather
   * than a design preference.** Relation metadata is admin-only on all three
   * backends: Directus answers `GET /relations` and `GET /fields` with **403**
   * unauthenticated, and PocketBase answers `GET /api/collections` with
   * **401**. A runtime holds an end user's session token or a project's public
   * token — never an admin key — so a relation the editor did not record at
   * sync time is a relation the runtime cannot discover.
   *
   * Which makes the absence of a descriptor a **refusal**, not a fallback: see
   * {@link RestDataAdapter.addRelation}. Guessing "the junction is probably
   * called `articles_tags`" is exactly the plausible-wrong-request this phase
   * exists to stop.
   */
  relationsFor?: (handle: BackendHandle) => readonly RelationDescriptor[] | undefined;
}

/**
 * Fields a `save` must not send back, per backend.
 *
 * `SaveOptions` says why this is per-adapter and not a constant on the
 * contract: every adapter needs a server-owned-field exclusion and the *names*
 * differ. The identity fields are stripped for all three because `save`
 * addresses the record by id in the URL — a body that also carries the primary
 * key is at best redundant and at worst a request to change it.
 *
 * ⚠️ **Residual risk, recorded rather than solved.** These are conventional
 * names, and a user is free to create a Directus column genuinely called
 * `date_created`. Stripping it would silently drop that write. Directus's own
 * special fields carry exactly these names and are read-only, so the trade is
 * the same one `cloudstore.js:350` has always made for `createdAt`/`updatedAt`;
 * the schema-driven answer belongs with the port generator, which knows which
 * fields are writable.
 */
const SERVER_OWNED_FIELDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  directus: ['date_created', 'date_updated', 'user_created', 'user_updated'],
  // PostgREST has no server-owned-column convention: a `created_at` there is an
  // ordinary column the app may well be writing on purpose. Only the identity
  // is stripped, which the caller adds below.
  supabase: [],
  // Every PocketBase record carries these back on a read, so a read-modify-write
  // (`increment` on a backend without an atomic one) would otherwise send the
  // collection's own metadata back as if it were data.
  pocketbase: ['collectionId', 'collectionName', 'expand', 'created', 'updated']
});

/** `-name` → descending, the Parse/Directus/PocketBase spelling the contract uses. */
function splitSort(entry: string): { field: string; descending: boolean } {
  const trimmed = entry.trim();
  return trimmed.startsWith('-')
    ? { field: trimmed.slice(1), descending: true }
    : { field: trimmed, descending: false };
}

/**
 * `include`/`select`/`sort` arrive as an array **or** a comma string.
 *
 * `ListOption`'s comment says the contract layer normalises once rather than
 * five adapters each remembering to — this is that, for the REST family.
 */
function toList(option: ListOption | undefined): string[] {
  if (option === undefined || option === null) return [];
  const parts = Array.isArray(option) ? option : String(option).split(',');
  return parts.map((part) => String(part).trim()).filter((part) => part.length > 0);
}

/**
 * A sentence for the user out of whatever the backend sent.
 *
 * Three different error envelopes, all measured against the live rig:
 * Directus `{errors:[{message, extensions:{code}}]}`, PostgREST
 * `{code, details, hint, message}`, PocketBase `{status, message, data}`. The
 * status line is the fallback, because a backend answering with a shape none of
 * these describes is a real thing and "HTTP 500" beats `undefined`.
 */
function errorMessage(status: number, body: unknown, text: string): string {
  const envelope = body as Record<string, unknown> | undefined;

  if (envelope && Array.isArray(envelope.errors) && envelope.errors.length > 0) {
    const first = envelope.errors[0] as Record<string, unknown>;
    if (typeof first?.message === 'string') return first.message;
  }
  if (envelope && typeof envelope.message === 'string' && envelope.message.length > 0) {
    // PostgREST puts the actionable half in `hint`/`details` more often than not.
    const hint = typeof envelope.hint === 'string' && envelope.hint ? ` (${envelope.hint})` : '';
    return envelope.message + hint;
  }
  if (text && text.length > 0 && text.length < 400) return `HTTP ${status}: ${text}`;
  return `HTTP ${status}`;
}

export class RestDataAdapter extends AdapterEvents implements IDataAdapter {
  private readonly fetchImpl: FetchLike;
  private readonly probedCapabilities: readonly CapabilityKey[];
  private readonly probedFilterOperators: readonly FilterOperator[];
  private readonly schemaFor: RestDataAdapterOptions['schemaFor'];
  private readonly serializeObject: NonNullable<RestDataAdapterOptions['serializeObject']>;
  private readonly relationsFor: RestDataAdapterOptions['relationsFor'];

  constructor(options: RestDataAdapterOptions = {}) {
    super();
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init) as unknown as ReturnType<FetchLike>);
    this.probedCapabilities = options.probedCapabilities ?? [];
    this.probedFilterOperators = options.probedFilterOperators ?? [];
    this.schemaFor = options.schemaFor;
    this.serializeObject = options.serializeObject ?? ((data) => data);
    this.relationsFor = options.relationsFor;
  }

  /** The relation this collection/field names, or `undefined` when it is not in the synced schema. */
  private relation(handle: BackendHandle, collection: string, field: string): RelationDescriptor | undefined {
    return findRelation(this.relationsFor?.(handle), collection, field);
  }

  // ── Resolution and gating ────────────────────────────────────────────────

  /**
   * The profile for this handle, or `undefined` for a backend this adapter does
   * not serve.
   *
   * `undefined` is the honest answer for `nodegx`/`parse` (served by
   * `ParseWireAdapter`) and for `custom` (whose endpoints are genuinely the
   * user's configuration and are read from the saved metadata — not this
   * task's).
   */
  private profileFor(handle: BackendHandle): RestWireProfile | undefined {
    return restWireProfileFor(handle.type);
  }

  /**
   * May this backend attempt this operation right now?
   *
   * The gate is the descriptor's, not this file's opinion, which is what makes
   * the sentence a user reads at runtime the *same* sentence the editor shows
   * on a greyed-out port. `conditional` counts as no unless a probe said yes —
   * see {@link RestDataAdapterOptions.probedCapabilities}.
   */
  private capability(handle: BackendHandle, key: CapabilityKey): Capability {
    return descriptorFor(handle.type).capabilities[key];
  }

  private allows(handle: BackendHandle, key: CapabilityKey): boolean {
    const capability = this.capability(handle, key);
    if (capability.state === 'supported' || capability.state === 'degraded') return true;
    if (capability.state === 'conditional') return this.probedCapabilities.includes(key);
    return false;
  }

  /**
   * Resolve profile and capability, or call `error` and return `undefined`.
   *
   * Every method starts with this. Returning `undefined` rather than throwing
   * keeps the callback contract: a node that passed an `error` callback gets it
   * called, once, with a sentence.
   */
  private begin(
    handle: BackendHandle,
    key: CapabilityKey,
    error: (message?: string) => void
  ): RestWireProfile | undefined {
    const profile = this.profileFor(handle);
    if (!profile) {
      error(
        `The "${handle.type}" backend is not served by the REST adapter. ` +
          'Directus, Supabase and PocketBase are; the Parse-wire backends use their own adapter.'
      );
      return undefined;
    }

    const capability = this.capability(handle, key);
    if (this.allows(handle, key)) return profile;

    const reason = capability.state === 'supported' ? '' : capability.reason;
    error(reason || `${handle.type} does not support ${key}.`);
    return undefined;
  }

  // ── The wire ─────────────────────────────────────────────────────────────

  /**
   * Fill a profile path template — with one substitution the profile cannot
   * express.
   *
   * ⚠️ **Directus's system collections are not under `/items`.** `directus_users`
   * is served from `/users`, and `/items/directus_users` answers **403** with
   * *"You don't have permission to access this"* — measured, with an admin
   * token. That message reaching a user whose permissions are fine is the
   * plausible-wrong-answer this phase exists to remove, which is why it is
   * handled here rather than left as a gap.
   *
   * This is the capability BYOB had and this adapter did not, and it is
   * **BCN-010's stated precondition** for deleting the four `noodl.byob.*`
   * types. See `directusSystem.ts` for the measurements, for why `apiPathMode`
   * is derived rather than carried as a port, and for the duplicate map.
   *
   * The `{id}` suffix is preserved: `/users/{id}` and `/files/{id}` are the same
   * shape as `/items/{collection}/{id}`, so a record template keeps working.
   *
   * Gated on the template being an `/items/` one rather than on
   * `profile.type === 'directus'`, for the reason {@link recordTarget} gives for
   * the same choice: the branch then names the wire fact it depends on. It also
   * means a PocketBase collection someone chose to call `directus_users` is
   * untouched, which a type-free prefix test would not have managed.
   */
  // `id` is `RecordId`: Directus and PostgREST hand back JSON numbers, and this
  // interpolates into a URL path where a number is a perfectly good segment.
  private path(template: string, collection: string, id?: RecordId): string {
    const override = template.startsWith('/items/') ? directusPathOverride(collection) : undefined;
    const effective =
      override === undefined
        ? template
        : // `/items/{collection}` -> `/users`; `/items/{collection}/{id}` -> `/users/{id}`.
          override + (template.includes('{id}') ? '/{id}' : '');

    return effective
      .replace('{collection}', encodeURIComponent(collection))
      .replace('{id}', encodeURIComponent(id ?? ''));
  }

  /**
   * Address one record.
   *
   * Two shapes, and the profile says which: a path carrying `{id}` (Directus,
   * PocketBase), or — where the template has no `{id}` — a **filter on the
   * primary key**, which is how PostgREST addresses a row (`?id=eq.4`). Keyed
   * on the template rather than on `type === 'supabase'` so that the branch
   * describes the wire fact it depends on.
   */
  private recordTarget(profile: RestWireProfile, collection: string, objectId: RecordId): { path: string; params: Params } {
    if (profile.recordPath.includes('{id}')) {
      return { path: this.path(profile.recordPath, collection, objectId), params: [] };
    }
    return {
      path: this.path(profile.recordPath, collection),
      params: [[profile.idField, `eq.${objectId}`]]
    };
  }

  private headers(profile: RestWireProfile, handle: BackendHandle, extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // `sessionToken` is the signed-in end user and outranks the project's public
    // token: on all three of these backends a request made as the user is the
    // one their row rules were written for.
    const token = handle.sessionToken || handle.publicToken;
    if (token) {
      headers.Authorization = profile.auth === 'bearer' ? `Bearer ${token}` : token;
      // Supabase wants the anon key under `apikey` as well as a bearer.
      for (const name of profile.tokenHeaders ?? []) headers[name] = token;
    }

    return Object.assign(headers, extra || {});
  }

  private url(handle: BackendHandle, path: string, params: Params): string {
    const base = (handle.url || '').replace(/\/$/, '');
    const search = new URLSearchParams();
    for (const [key, value] of params) search.append(key, value);
    const query = search.toString();
    return base + path + (query ? '?' + query : '');
  }

  /**
   * One request, one callback.
   *
   * Any 2xx is success. That is wider than the Parse wire's `200 || 201` on
   * purpose and every widening was measured: all three backends answer a
   * `DELETE` with **204 and no body**, and PostgREST answers `?limit=0` with
   * **206** and a `Content-Range` that still carries the total.
   */
  private request(
    handle: BackendHandle,
    init: {
      method?: string;
      path: string;
      params?: Params;
      headers?: Record<string, string>;
      body?: unknown;
      /**
       * Send `body` as-is instead of `JSON.stringify`-ing it — the upload path.
       *
       * ⚠️ A separate flag rather than an `instanceof` sniff on the body. The
       * sniff would have to know every binary type the platform offers
       * (`Blob`, `File`, `FormData`, `ArrayBuffer`, every `TypedArray`, Node's
       * `Buffer`), and the one it forgot would be silently JSON-stringified
       * into `{}` — a 200 that stores four bytes of nothing. The caller always
       * knows which it is sending.
       */
      raw?: boolean;
    },
    callbacks: { ok: (body: unknown, headers: { get(name: string): string | null }) => void; fail: (message: string) => void }
  ): void {
    const url = this.url(handle, init.path, init.params ?? []);

    this.fetchImpl(url, {
      method: init.method || 'GET',
      headers: init.headers,
      body:
        init.body === undefined
          ? undefined
          : init.raw
            ? (init.body as RequestBody)
            : JSON.stringify(init.body)
    })
      .then((response) =>
        response.text().then((text) => {
          let body: unknown;
          try {
            body = text === '' ? undefined : JSON.parse(text);
          } catch {
            body = undefined;
          }

          if (response.status >= 200 && response.status < 300) {
            callbacks.ok(body, response.headers);
          } else {
            callbacks.fail(errorMessage(response.status, body, text));
          }
        })
      )
      .catch((e: unknown) => callbacks.fail(e instanceof Error ? e.message : String(e)));
  }

  private normalize(profile: RestWireProfile, record: AdapterRecord): AdapterRecord {
    return normalizeRecordIdentity(record, profile.idField);
  }

  private normalizeAll(profile: RestWireProfile, records: AdapterRecord[]): AdapterRecord[] {
    return normalizeRecordIdentities(records, profile.idField);
  }

  // ── Filters ──────────────────────────────────────────────────────────────

  /**
   * Translate a neutral filter with **the** translator for this backend.
   *
   * BCN-003's hard rule, restated where it would be tempting to break: no
   * backend has two translators. RUN-003 shipped a second Directus converter in
   * the runtime and it emitted a flat `"author.name"` key that live Directus
   * answers with a 403 — invisible to every unit test, because only a real
   * fetch exercised that copy.
   *
   * A `FilterTranslationError` is allowed to escape to the caller, which
   * catches it and turns it into the node's error output. It must never be
   * swallowed: a dropped condition widens the query instead of failing it, and
   * a filter meant to show one user their own records returns everybody's.
   */
  private translateOptions(handle: BackendHandle, collection: string) {
    return {
      backend: handle.type,
      schema: this.filterSchema(handle, collection),
      probed: this.probedFilterOperators
    };
  }

  /**
   * The schema a translator sees, with the relation facts folded in.
   *
   * ⚠️ **Both of the facts merged here were found by a live request failing**,
   * and neither is reachable from the cached field schema alone:
   *
   * - **`cardinality`** decides whether PocketBase gets `tags.label = 'x'` or
   *   `tags.label ?= 'x'`. The first returns **no rows** against a record with
   *   two tags — 200, empty, no warning.
   * - **`path`** turns a Directus M2M prefix into its junction path. Without it
   *   the filter answers **403**, indistinguishable from a permission failure.
   *
   * Merged here rather than asked of `schemaFor` because the relation
   * descriptors are the authority on both, and a caller that supplied a schema
   * without them would otherwise be silently wrong in the two worst ways. The
   * relation entry wins on those two keys and leaves everything else alone.
   */
  private filterSchema(handle: BackendHandle, collection: string): FilterSchema | undefined {
    const base = this.schemaFor ? this.schemaFor(collection, handle) : undefined;
    const relations = (this.relationsFor?.(handle) ?? []).filter((relation) => relation.collection === collection);
    if (relations.length === 0) return base;

    const properties: NonNullable<FilterSchema['properties']> = Object.assign({}, base?.properties);
    for (const relation of relations) {
      properties[relation.field] = Object.assign({}, properties[relation.field], {
        targetClass: relation.target,
        cardinality: relation.cardinality,
        ...(relation.readPath ? { path: relation.readPath } : {})
      });
    }
    return { collection: base?.collection ?? collection, properties };
  }

  // ── Query & read ─────────────────────────────────────────────────────────

  query(handle: BackendHandle, options: QueryOptions): void {
    const profile = this.begin(handle, 'data.query', options.error);
    if (!profile) return;

    let params: Params;
    let extraHeaders: Record<string, string> | undefined;
    try {
      const built = this.buildQuery(profile, handle, options);
      params = built.params;
      extraHeaders = built.headers;
    } catch (e) {
      options.error(e instanceof Error ? e.message : String(e));
      return;
    }

    this.request(
      handle,
      { path: this.path(profile.listPath, options.collection), params, headers: this.headers(profile, handle, extraHeaders) },
      {
        ok: (body, headers) => {
          const rows = readRows(profile, body) as AdapterRecord[];
          const records = this.normalizeAll(profile, rows).map((record) =>
            this.unwrapIncludes(handle, options.collection, toList(options.include), record)
          );
          // Only reported when asked for. PocketBase volunteers `totalItems` on
          // every list response and Directus volunteers nothing without
          // `meta=`, so passing it unconditionally would give a node a count on
          // one backend and not another — exactly the per-backend divergence
          // this phase exists to remove.
          const total = options.count ? readTotalCount(profile, body, headers, rows.length) : undefined;
          options.success(records, total);
        },
        fail: (message) => options.error(message)
      }
    );
  }

  /**
   * The per-backend half of a list request.
   *
   * Separate from {@link query} and returning rather than requesting, so that
   * `count` can reuse it and so the unit suite can assert the *parameters* for
   * all three backends without a fake server per case.
   *
   * Throws rather than returning an error: every throw here is a filter or a
   * pagination the backend genuinely cannot express, and the caller turns it
   * into one `error` call.
   */
  private buildQuery(
    profile: RestWireProfile,
    handle: BackendHandle,
    options: QueryOptions
  ): { params: Params; headers?: Record<string, string> } {
    const params: Params = [];
    let headers: Record<string, string> | undefined;

    const select = toList(options.select);
    const include = toList(options.include);
    const sort = toList(options.sort);
    const translate = this.translateOptions(handle, options.collection);

    switch (profile.type) {
      case 'directus': {
        const filter = toDirectusFilter(options.where, translate);
        if (Object.keys(filter).length > 0) params.push(['filter', JSON.stringify(filter)]);

        // `fields=*,author.*` — the relation expansion RUN-003 built, kept, plus
        // the M2M correction {@link includePath} exists for.
        const fields = select.length > 0 ? select.slice() : include.length > 0 ? ['*'] : [];
        for (const relation of include) {
          const path = `${this.includePath(handle, options.collection, relation)}.*`;
          if (!fields.includes(path)) fields.push(path);
        }
        if (fields.length > 0) params.push(['fields', fields.join(',')]);

        if (sort.length > 0) params.push(['sort', sort.join(',')]);
        if (options.search) params.push(['search', options.search]);
        // ⚠️ `filter_count`, not `total_count`. Measured on the live rig:
        // 5 rows, 3 matching, `{"total_count":5,"filter_count":3}`. The profile
        // points at the right one; asking for both is what makes it available.
        if (options.count) params.push(['meta', 'total_count,filter_count']);
        break;
      }

      case 'supabase': {
        const filter: PostgrestFilter = toPostgrest(options.where, translate);
        for (const pair of filter.params) params.push([pair[0], pair[1]]);

        // A filter on a related record narrows the *embedded* rows unless the
        // embed is `!inner`, which is why the translator reports them.
        const selectParts = select.length > 0 ? select.slice() : ['*'];
        for (const embed of filter.embeds) selectParts.push(`${embed}!inner(*)`);
        for (const relation of include) {
          if (!filter.embeds.includes(relation)) selectParts.push(this.postgrestEmbed(handle, options.collection, relation));
        }
        params.push(['select', selectParts.join(',')]);

        if (sort.length > 0) {
          params.push([
            'order',
            sort
              .map((entry) => {
                const { field, descending } = splitSort(entry);
                return `${field}.${descending ? 'desc' : 'asc'}`;
              })
              .join(',')
          ]);
        }

        if (options.search) {
          // `data.search` is `conditional` here and needs a tsvector index —
          // but even settled affirmatively, PostgREST's `fts` operator is
          // *per column* and `QueryOptions.search` names no column. Refused
          // rather than aimed at a guess.
          throw new Error(
            'Supabase has no whole-record search. Add a text-search filter on a specific column instead, ' +
              'or use the built-in backend for ranked search.'
          );
        }

        // ⚠️ The total is a header, and only if asked for: without this
        // PostgREST answers `Content-Range: 0-0/*` — literally "I did not
        // count", which is not zero.
        if (options.count) headers = Object.assign({}, profile.countRequestHeaders);
        break;
      }

      case 'pocketbase': {
        const filter = toPocketBaseFilter(options.where, translate);
        if (filter.expression) params.push(['filter', bindPocketBaseFilter(filter)]);

        if (select.length > 0) params.push(['fields', select.join(',')]);
        if (sort.length > 0) params.push(['sort', sort.join(',')]);
        if (include.length > 0) params.push(['expand', include.join(',')]);

        if (options.search) {
          // The descriptor marks `data.search` degraded and says NodeGX lowers
          // it to ORed `~` conditions — which needs the collection's text
          // fields, and the adapter has no schema. Refused rather than dropped;
          // recorded in BCN-004-NOTES-TRANSPORT.md as a gap between the cell
          // and this implementation.
          throw new Error(
            'PocketBase has no search parameter. NodeGX cannot search every field without the collection schema — ' +
              'filter on a specific field with "contains" instead.'
          );
        }
        // `totalItems` is on every list response and is filter-aware (measured).
        break;
      }
    }

    for (const pair of this.paginationFor(profile, options.limit, options.skip)) params.push(pair);
    return { params, headers };
  }

  /**
   * Pagination, or a refusal.
   *
   * ⚠️ **A page-based wire cannot express an arbitrary row offset**, and this is
   * where the adapter decides what to do about it. `skip=5, limit=10` is not
   * any PocketBase page. Rounding to page 1 returns rows 0–9 *as if* they were
   * rows 5–14: right count, right shape, wrong rows, green tick — the exact
   * class of failure this phase keeps finding.
   *
   * So it refuses, and the sentence names the fix. The alternative considered
   * and rejected was fetching `gcd(skip, limit)`-sized pages and concatenating,
   * which is correct but turns one request into up to `limit` of them when the
   * two are coprime — a pagination control that silently costs seven round
   * trips is a worse thing to ship than one that says it cannot do this.
   *
   * In practice nothing reaches it: every paging node computes
   * `skip = page * limit`, which is exact by construction. The refusal is for
   * the hand-set offset, which is the case that would otherwise lie.
   */
  private paginationFor(profile: RestWireProfile, limit: number | undefined, skip: number | undefined): Params {
    const { params, inexact } = paginationParams(profile, limit, skip);

    if (inexact) {
      throw new Error(
        `${profile.type} pages results rather than taking a row offset, so it cannot start at row ${skip} ` +
          `with a page size of ${limit ?? 'none'}. Use an offset that is a whole number of pages ` +
          `(0, ${limit ?? 'n'}, ${(limit ?? 1) * 2}, …), or set a page size.`
      );
    }

    return Object.keys(params).map((key) => [key, params[key]] as [string, string]);
  }

  /**
   * `count` is `query` with no rows asked for.
   *
   * A separate contract method rather than sugar, and `CountOptions`' comment
   * says why: counting works on backends where aggregation does not, and a
   * merged method could not have said so.
   */
  count(handle: BackendHandle, options: CountOptions): void {
    const profile = this.begin(handle, 'data.count', options.error);
    if (!profile) return;

    let built: { params: Params; headers?: Record<string, string> };
    try {
      built = this.buildQuery(profile, handle, {
        collection: options.collection,
        where: options.where,
        count: true,
        // `limit=0` on Directus and PostgREST returns the count with no rows
        // (measured: Directus `{"meta":{...},"data":[]}`; PostgREST `206` with
        // `Content-Range: */1`). PocketBase has no zero page size, so it asks
        // for the smallest one and throws the row away.
        limit: profile.pagination.kind === 'page' ? 1 : 0,
        success: () => undefined,
        error: () => undefined
      });
    } catch (e) {
      options.error(e instanceof Error ? e.message : String(e));
      return;
    }

    this.request(
      handle,
      {
        path: this.path(profile.listPath, options.collection),
        params: built.params,
        headers: this.headers(profile, handle, built.headers)
      },
      {
        ok: (body, headers) => {
          const rows = readRows(profile, body);
          const total = readTotalCount(profile, body, headers, rows.length);
          if (total === undefined) {
            // Different from zero, and saying so is the point: PostgREST
            // reports `*` when it was not asked to count.
            options.error(`${handle.type} did not report a total for this query.`);
            return;
          }
          options.success(total);
        },
        fail: (message) => options.error(message)
      }
    );
  }

  /**
   * The distinct values of one property.
   *
   * Directus alone. `?groupBy=tag` with nothing else returns one row per
   * distinct value (`[{"tag":"x"},{"tag":"y"}]`, measured), which is exactly
   * the question. Supabase and PocketBase are `unsupported` in their
   * descriptors and refuse with the sentence the editor shows — and PocketBase
   * is the one that matters: `?distinct=status` there returns **all** the rows,
   * quietly.
   */
  distinct(handle: BackendHandle, options: DistinctOptions): void {
    const profile = this.begin(handle, 'data.distinct', options.error);
    if (!profile) return;

    if (profile.type !== 'directus') {
      options.error(`${handle.type} cannot list the distinct values of a field.`);
      return;
    }

    const params: Params = [
      ['groupBy', options.property],
      // Directus's own spelling for "no page limit".
      ['limit', '-1']
    ];
    try {
      const filter = toDirectusFilter(options.where, this.translateOptions(handle, options.collection));
      if (Object.keys(filter).length > 0) params.push(['filter', JSON.stringify(filter)]);
    } catch (e) {
      options.error(e instanceof Error ? e.message : String(e));
      return;
    }

    this.request(
      handle,
      { path: this.path(profile.listPath, options.collection), params, headers: this.headers(profile, handle) },
      {
        ok: (body) => {
          const rows = readRows(profile, body) as Array<Record<string, unknown>>;
          options.success(rows.map((row) => row[options.property]));
        },
        fail: (message) => options.error(message)
      }
    );
  }

  /**
   * Server-side totals.
   *
   * ⚠️ **PocketBase refuses here, and that refusal is the point.** BCN-001
   * measured that every aggregate spelling returns `200` with ordinary
   * un-aggregated rows — it does not fail, it lies. There is nothing for a
   * runtime error handler to catch, so the descriptor gate in {@link begin} is
   * the only thing between a user and wrong numbers on a dashboard.
   *
   * Supabase is `conditional`: stock PostgREST answers `PGRST123 "Use of
   * aggregate functions is not allowed"` and the same binary with
   * `db-aggregates-enabled` answers properly, so it is refused unless a probe
   * settled the cell — see {@link RestDataAdapterOptions.probedCapabilities}.
   */
  aggregate(handle: BackendHandle, options: AggregateOptions): void {
    const profile = this.begin(handle, 'data.aggregate', options.error);
    if (!profile) return;

    if (!options.group || Object.keys(options.group).length === 0) {
      options.error('You need to provide group option.');
      return;
    }

    const params: Params = [];
    const outputs = Object.keys(options.group);

    try {
      if (profile.type === 'directus') {
        for (const key of outputs) {
          const { fn, field } = readGroupMember(options.group[key], key);
          // Directus's `aggregate[count]=*` answers flat (`{"count":5}`) while
          // `aggregate[count]=id` answers nested (`{"count":{"id":5}}`).
          // Both measured; `readAggregateValue` handles the pair.
          params.push([`aggregate[${fn}]`, field]);
        }
        const filter = toDirectusFilter(options.where, this.translateOptions(handle, options.collection));
        if (Object.keys(filter).length > 0) params.push(['filter', JSON.stringify(filter)]);
        if (options.limit) params.push(['limit', String(options.limit)]);
      } else if (profile.type === 'supabase') {
        // `?select=total:rating.sum(),n:count()` — aliased so the response keys
        // are the caller's output names. Measured against PostgREST 12.2.3 with
        // aggregates enabled; composes with a filter.
        const select = outputs.map((key) => {
          const { fn, field } = readGroupMember(options.group[key], key);
          return field === '*' ? `${key}:count()` : `${key}:${field}.${fn}()`;
        });
        params.push(['select', select.join(',')]);
        const filter = toPostgrest(options.where, this.translateOptions(handle, options.collection));
        for (const pair of filter.params) params.push([pair[0], pair[1]]);
      } else {
        // Unreachable: the descriptor gate refuses PocketBase above. Kept so a
        // future profile cannot arrive here silently.
        options.error(`${handle.type} cannot total or average records on the server.`);
        return;
      }
    } catch (e) {
      options.error(e instanceof Error ? e.message : String(e));
      return;
    }

    this.request(
      handle,
      { path: this.path(profile.listPath, options.collection), params, headers: this.headers(profile, handle) },
      {
        ok: (body) => {
          const rows = readRows(profile, body) as Array<Record<string, unknown>>;
          if (rows.length !== 1) {
            // Parse's adapter answers `{}` for "no result" and the nodes are
            // written to it.
            options.success({});
            return;
          }
          const result: Record<string, unknown> = {};
          for (const key of outputs) {
            const { fn, field } = readGroupMember(options.group[key], key);
            result[key] = profile.type === 'directus' ? readAggregateValue(rows[0], fn, field) : rows[0][key];
          }
          options.success(result);
        },
        fail: (message) => options.error(message)
      }
    );
  }

  fetch(handle: BackendHandle, options: FetchOptions): void {
    const profile = this.begin(handle, 'data.fetch', options.error);
    if (!profile) return;

    const target = this.recordTarget(profile, options.collection, options.objectId);
    const params = target.params.slice();
    const include = toList(options.include);

    if (profile.type === 'supabase') {
      const select = ['*'];
      for (const relation of include) select.push(this.postgrestEmbed(handle, options.collection, relation));
      params.push(['select', select.join(',')]);
    } else if (profile.type === 'directus' && include.length > 0) {
      params.push([
        'fields',
        ['*'].concat(include.map((relation) => `${this.includePath(handle, options.collection, relation)}.*`)).join(',')
      ]);
    } else if (profile.type === 'pocketbase' && include.length > 0) {
      params.push(['expand', include.join(',')]);
    }

    this.request(
      handle,
      { path: target.path, params, headers: this.headers(profile, handle) },
      {
        ok: (body) => {
          const raw = readRecord(profile, body);
          if (!raw) {
            options.error(`No record with id ${options.objectId} in ${options.collection}.`);
            return;
          }
          const record = this.unwrapIncludes(handle, options.collection, include, this.normalize(profile, raw));
          options.success(record);
          this.emitAdapterEvent({
            type: 'fetch',
            objectId: options.objectId,
            object: record,
            collection: options.collection
          });
        },
        fail: (message) => options.error(message)
      }
    );
  }

  // ── Write ────────────────────────────────────────────────────────────────

  /**
   * ⚠️ **The empty-body trap lives here.** PostgREST answers a create with
   * `201` and no body at all unless `Prefer: return=representation` is sent
   * (measured, both ways), and then returns the row **wrapped in an array of
   * one**. Both facts are in the profile; what this method adds is the rule
   * that a missing record is an **error**. Calling `success(undefined)` on a
   * `201` would leave the node's created-record output silently empty with
   * nothing anywhere reporting a failure.
   */
  create(handle: BackendHandle, options: CreateOptions): void {
    const profile = this.begin(handle, 'data.create', options.error);
    if (!profile) return;

    if (options.acl && !this.allows(handle, 'data.acl')) {
      // Not fatal — the record is still created. A per-record ACL is a
      // Parse-family concept and these three control access with roles, RLS or
      // API rules instead, which is what the descriptor cell says. Dropping it
      // *silently* would be the failure; saying so is not.
      const acl = this.capability(handle, 'data.acl');
      console.warn(`[RestDataAdapter] ACL ignored on ${handle.type}. ${acl.state === 'supported' ? '' : acl.reason}`);
    }

    const body = this.serializeObject(options.data, options.collection, handle);

    this.request(
      handle,
      {
        method: 'POST',
        path: this.path(profile.createPath, options.collection),
        headers: this.headers(profile, handle, representationHeaders(profile)),
        body
      },
      {
        ok: (responseBody) => {
          const raw = readRecord(profile, responseBody);
          if (!raw) {
            options.error(
              `${handle.type} created the record but returned nothing to identify it. ` +
                'The record may exist; reload the collection to see it.'
            );
            return;
          }
          const record = this.normalize(profile, Object.assign({}, options.data, raw));
          options.success(record);
          this.emitAdapterEvent({
            type: 'create',
            objectId: record.objectId,
            object: record,
            collection: options.collection
          });
        },
        fail: (message) => options.error(message)
      }
    );
  }

  save(handle: BackendHandle, options: SaveOptions): void {
    const profile = this.begin(handle, 'data.save', options.error);
    if (!profile) return;

    const target = this.recordTarget(profile, options.collection, options.objectId);
    const body = stripServerOwned(profile, this.serializeObject(options.data, options.collection, handle));

    this.request(
      handle,
      {
        method: 'PATCH',
        path: target.path,
        params: target.params,
        // ⚠️ The same `Prefer: return=representation` a create needs. Measured:
        // a PostgREST `PATCH` without it answers **204 with an empty body**, so
        // `save`'s success callback would receive nothing on a success status —
        // the identical trap, on the method the profile does not name.
        headers: this.headers(profile, handle, representationHeaders(profile)),
        body
      },
      {
        ok: (responseBody) => {
          const raw = readRecord(profile, responseBody);
          if (!raw) {
            options.error(`${handle.type} saved the record but returned nothing back.`);
            return;
          }
          const record = this.normalize(profile, raw);
          options.success(record);
          this.emitAdapterEvent({
            type: 'save',
            objectId: options.objectId,
            object: record,
            collection: options.collection
          });
        },
        fail: (message) => options.error(message)
      }
    );
  }

  /**
   * Add to a number.
   *
   * One of the three does this atomically and two do not, and the difference is
   * declared rather than hidden:
   *
   * - **PocketBase** has the `+`/`-` field modifier — `{'rating+': 1}` is
   *   applied server-side. Verified live: 5 + 3 came back 8 in one request.
   * - **Directus and Supabase** are `degraded` in their descriptors, which says
   *   in the user's own words that NodeGX reads the value and writes it back,
   *   and that a simultaneous increment from two devices can lose one of them.
   *   Implemented here as exactly that read-modify-write, because the honest
   *   racy version with a warning on the port beats a method that refuses a
   *   thing the backend can nearly do.
   */
  increment(handle: BackendHandle, options: IncrementOptions): void {
    const profile = this.begin(handle, 'data.increment', options.error);
    if (!profile) return;

    if (profile.type === 'pocketbase') {
      const body: Record<string, unknown> = {};
      for (const key of Object.keys(options.properties)) body[`${key}+`] = options.properties[key];
      const target = this.recordTarget(profile, options.collection, options.objectId);

      this.request(
        handle,
        { method: 'PATCH', path: target.path, params: target.params, headers: this.headers(profile, handle), body },
        {
          ok: (responseBody) => {
            const raw = readRecord(profile, responseBody);
            if (!raw) {
              options.error(`${handle.type} incremented the record but returned nothing back.`);
              return;
            }
            options.success(this.normalize(profile, raw));
          },
          fail: (message) => options.error(message)
        }
      );
      return;
    }

    // The degraded path. Two round trips, and the window between them is the
    // race the descriptor warns about.
    this.fetch(handle, {
      collection: options.collection,
      objectId: options.objectId,
      success: (current) => {
        const data: Record<string, unknown> = {};
        for (const key of Object.keys(options.properties)) {
          const before = Number(current[key] ?? 0);
          data[key] = (Number.isFinite(before) ? before : 0) + options.properties[key];
        }
        this.save(handle, {
          collection: options.collection,
          objectId: options.objectId,
          data,
          success: options.success,
          error: options.error
        });
      },
      error: options.error
    });
  }

  delete(handle: BackendHandle, options: DeleteOptions): void {
    const profile = this.begin(handle, 'data.delete', options.error);
    if (!profile) return;

    const target = this.recordTarget(profile, options.collection, options.objectId);

    this.request(
      handle,
      { method: 'DELETE', path: target.path, params: target.params, headers: this.headers(profile, handle) },
      {
        // All three answer 204 with no body. ⚠️ Directus and PostgREST also
        // answer 204 for an id that does not exist — a delete of nothing is
        // indistinguishable from a delete of something on two of the three, and
        // no status code the adapter can read says otherwise.
        ok: () => {
          options.success();
          this.emitAdapterEvent({ type: 'delete', objectId: options.objectId, collection: options.collection });
        },
        fail: (message) => options.error(message)
      }
    );
  }

  // ── Relations — BCN-005 ──────────────────────────────────────────────────

  /**
   * Relate two records.
   *
   * ## Where the refusals went, and where they stayed
   *
   * BCN-004 shipped this method as an unconditional refusal carrying the
   * descriptor's reason. BCN-005's third constraint is that a refusal may only
   * be replaced *where the wire has been measured*, and it has been, for the
   * three shapes {@link RelationWrite} names:
   *
   * | Backend | Add | Measured |
   * |---|---|---|
   * | PocketBase | `PATCH {"tags+": id}` — one request, server-side, set-shaped | yes |
   * | PostgREST | `POST` the junction pair with `resolution=merge-duplicates` | yes |
   * | Directus | `POST` the junction row, or `PATCH` the FK for a to-one | yes |
   *
   * Two refusals **stay**, and neither is a gap in this file:
   *
   * - **No relation descriptor.** Relation metadata is admin-only on all three
   *   backends (403/403/401 measured), so the runtime cannot look one up. A
   *   relation the editor never synced is one this adapter refuses by name — the
   *   alternative is guessing a junction table's name and writing to it.
   * - **`custom`.** No profile, no relation model. `begin` refuses first.
   *
   * ## The one place this is not atomic, said out loud
   *
   * A Directus junction has a surrogate `id` and no unique constraint on the
   * pair, so `POST`ing the same pair twice stores it twice — and then the
   * relation contains one member and the collection contains two rows, which is
   * a difference a user cannot see until a count is wrong. Parse's `Relation` is
   * a *set*, and the contract's shape is Parse's, so this method makes Directus
   * behave like a set: it looks for the pair first and succeeds without writing
   * when it is already there. Two devices adding the same pair at the same
   * moment can still both miss, and the `directus` descriptor's
   * `relations.addRemove` cell says exactly that in the user's own words. It is
   * the same trade `data.increment` already makes there, for the same reason.
   */
  addRelation(handle: BackendHandle, options: RelationOptions): void {
    this.mutateRelation(handle, options, 'add');
  }

  removeRelation(handle: BackendHandle, options: RelationOptions): void {
    this.mutateRelation(handle, options, 'remove');
  }

  private mutateRelation(handle: BackendHandle, options: RelationOptions, direction: 'add' | 'remove'): void {
    const profile = this.begin(handle, 'relations.addRemove', options.error);
    if (!profile) return;

    const relation = this.relation(handle, options.collection, options.key);
    if (!relation) {
      options.error(relationNotFound(handle, options));
      return;
    }

    const write = relation.write;

    // `op` is the Parse shape and reaching it here means a Parse-family
    // descriptor was handed to the REST adapter — a resolution bug, not a
    // capability gap, so it says so rather than pretending to try.
    if (write.kind === 'op') {
      options.error(
        `"${options.key}" on ${options.collection} is a Parse-style relation, which the ${handle.type} ` +
          'adapter cannot write. This is a wiring mistake rather than a missing feature.'
      );
      return;
    }

    if (write.kind === 'arrayField') {
      this.relationViaArrayField(handle, profile, options, write.field, direction);
      return;
    }

    if (write.kind === 'foreignKey') {
      this.relationViaForeignKey(handle, options, relation, write, direction);
      return;
    }

    this.relationViaJunction(handle, profile, options, write, direction);
  }

  /**
   * PocketBase: the `+` / `-` field operators.
   *
   * ⚠️ **The spec's trap for this backend is a stale premise.** It says a
   * multi-valued relation is "a read-modify-write with a lost-update window" and
   * asks for that to be declared as a caveat. It is not one: `PATCH {"tags+":
   * id}` is applied server-side in a single request, appending a value already
   * present leaves the array unchanged, and both directions were measured on a
   * live 0.30.0. There is no window to declare.
   *
   * ⚠️ What *is* worth knowing: on a `maxSelect: 1` relation, `+` **replaces**
   * the current value rather than refusing, and `-` clears the field to `""`
   * whether or not the id given is the one that was set. So `removeRelation`
   * with the wrong target id still clears the relation. That is PocketBase's
   * behaviour, it answers 200, and the descriptor cell names it — an adapter
   * cannot detect it without a read it would then have to race.
   */
  private relationViaArrayField(
    handle: BackendHandle,
    profile: RestWireProfile,
    options: RelationOptions,
    field: string,
    direction: 'add' | 'remove'
  ): void {
    const target = this.recordTarget(profile, options.collection, options.objectId);
    const body: Record<string, unknown> = { [`${field}${direction === 'add' ? '+' : '-'}`]: options.targetObjectId };

    this.request(
      handle,
      { method: 'PATCH', path: target.path, params: target.params, headers: this.headers(profile, handle), body },
      {
        ok: (responseBody) => {
          const raw = readRecord(profile, responseBody);
          if (!raw) {
            options.error(`${handle.type} changed the relation but returned nothing back.`);
            return;
          }
          this.relationChanged(handle, options, this.normalize(profile, raw), direction);
        },
        fail: (message) => options.error(message)
      }
    );
  }

  /**
   * A foreign-key relation: an ordinary `save` on whichever record holds the
   * column.
   *
   * `write.on` is the whole of it. A many-to-one writes the column on the record
   * the node named as the source; its one-to-many reverse writes the column on
   * the record the node named as the *target*, because that is where the column
   * lives. Getting this backwards writes a valid id into the wrong row and
   * answers 200, so it is data on the descriptor rather than an `if` here.
   *
   * `remove` writes `null`. ⚠️ It does not check that the column currently holds
   * `targetObjectId` first: doing so is a second round trip whose result is
   * stale by the time the write lands, and the honest single request matches
   * what {@link relationViaArrayField} measured PocketBase doing anyway.
   */
  private relationViaForeignKey(
    handle: BackendHandle,
    options: RelationOptions,
    relation: RelationDescriptor,
    write: { kind: 'foreignKey'; field: string; on: 'source' | 'target' },
    direction: 'add' | 'remove'
  ): void {
    const onSource = write.on === 'source';
    const collection = onSource ? options.collection : relation.target;
    const objectId = onSource ? options.objectId : options.targetObjectId;
    const value = direction === 'add' ? (onSource ? options.targetObjectId : options.objectId) : null;

    this.save(handle, {
      collection,
      objectId,
      data: { [write.field]: value },
      success: (record) => this.relationChanged(handle, options, record, direction),
      error: options.error
    });
  }

  /**
   * A junction collection: one row per pair.
   *
   * Three measured facts decide the shape of this method:
   *
   * 1. **PostgREST rejects a duplicate pair** with `409 23505` when the pair is
   *    the primary key, and `Prefer: resolution=merge-duplicates` turns the
   *    insert into an upsert that answers `200`. So the add is one request and
   *    genuinely idempotent — `write.idempotent` is that fact.
   * 2. **Directus stores the pair twice**, because its junction has a surrogate
   *    `id`. So when `write.idempotent` is false the add reads first, which is
   *    the racy set-semantics the descriptor declares.
   * 3. **A delete of a pair that never existed reports success** — Directus
   *    answers `204` and PostgREST `200 []`. PostgREST's representation is
   *    actually enough to tell the two apart; Directus's is not, and the
   *    contract cannot express a per-backend difference in what `removeRelation`
   *    means, so both report success. Recorded in `BCN-005-NOTES.md` under
   *    "could not verify" rather than papered over.
   */
  private relationViaJunction(
    handle: BackendHandle,
    profile: RestWireProfile,
    options: RelationOptions,
    write: { kind: 'junction'; collection: string; sourceField: string; targetField: string; idempotent: boolean },
    direction: 'add' | 'remove'
  ): void {
    const pair = { [write.sourceField]: options.objectId, [write.targetField]: options.targetObjectId };

    if (direction === 'remove') {
      this.deleteJunctionRows(handle, profile, write, pair, options);
      return;
    }

    const insert = () => {
      const headers = this.headers(
        profile,
        handle,
        // `resolution=merge-duplicates` is only meaningful where a duplicate is
        // an error, which is where the pair is the key.
        write.idempotent && profile.createRequestHeaders
          ? Object.assign({}, profile.createRequestHeaders, {
              Prefer: [profile.createRequestHeaders.Prefer, 'resolution=merge-duplicates'].filter(Boolean).join(',')
            })
          : representationHeaders(profile)
      );

      this.request(
        handle,
        { method: 'POST', path: this.path(profile.createPath, write.collection), headers, body: pair },
        {
          // The junction row is not the record the caller asked about, so the
          // success callback gets the *pair*, keyed by the contract's names, not
          // a junction row a node has no idea what to do with.
          ok: () => this.relationChanged(handle, options, this.relationResult(options), direction),
          fail: (message) => options.error(message)
        }
      );
    };

    if (write.idempotent) {
      insert();
      return;
    }

    // The read-first path. Set semantics on a junction that permits duplicates.
    this.findJunctionRows(handle, profile, write, pair, {
      ok: (rows) => {
        if (rows.length > 0) {
          this.relationChanged(handle, options, this.relationResult(options), direction);
          return;
        }
        insert();
      },
      fail: (message) => options.error(message)
    });
  }

  private junctionParams(profile: RestWireProfile, pair: Record<string, RecordId>): Params {
    if (profile.type === 'supabase') {
      return Object.keys(pair).map((field) => [field, `eq.${pair[field]}`] as [string, string]);
    }
    if (profile.type === 'pocketbase') {
      const expression = Object.keys(pair)
        .map((field) => `${field} = ${JSON.stringify(pair[field])}`)
        .join(' && ');
      return [['filter', expression]];
    }
    const filter: Record<string, unknown> = {};
    for (const field of Object.keys(pair)) filter[field] = { _eq: pair[field] };
    return [['filter', JSON.stringify(filter)]];
  }

  private findJunctionRows(
    handle: BackendHandle,
    profile: RestWireProfile,
    write: { collection: string },
    pair: Record<string, RecordId>,
    callbacks: { ok: (rows: AdapterRecord[]) => void; fail: (message: string) => void }
  ): void {
    this.request(
      handle,
      {
        path: this.path(profile.listPath, write.collection),
        params: this.junctionParams(profile, pair),
        headers: this.headers(profile, handle)
      },
      {
        ok: (body) => callbacks.ok(this.normalizeAll(profile, readRows(profile, body) as AdapterRecord[])),
        fail: callbacks.fail
      }
    );
  }

  /**
   * Remove every junction row for the pair.
   *
   * "Every", not "the one", because a junction that permits duplicates may hold
   * more than one — and a remove that left a second copy behind would report
   * success while the relation was still there, which is the failure this whole
   * file is written against.
   *
   * PostgREST can delete by predicate in one request. Directus and PocketBase
   * address a delete by id, so the rows are found first; there is no request
   * that avoids it.
   */
  private deleteJunctionRows(
    handle: BackendHandle,
    profile: RestWireProfile,
    write: { collection: string; sourceField: string; targetField: string },
    pair: Record<string, RecordId>,
    options: RelationOptions
  ): void {
    const done = () => this.relationChanged(handle, options, this.relationResult(options), 'remove');

    if (profile.type === 'supabase') {
      this.request(
        handle,
        {
          method: 'DELETE',
          path: this.path(profile.recordPath, write.collection),
          params: this.junctionParams(profile, pair),
          headers: this.headers(profile, handle)
        },
        { ok: done, fail: (message) => options.error(message) }
      );
      return;
    }

    this.findJunctionRows(handle, profile, write, pair, {
      ok: (rows) => {
        if (rows.length === 0) {
          // Nothing to delete is success: the relation is not there, which is
          // what the caller asked for. Both backends answer the same way for a
          // row that never existed anyway (204 / 200 []), so distinguishing
          // would be a claim the wire cannot support.
          done();
          return;
        }
        let remaining = rows.length;
        let failed = false;
        for (const row of rows) {
          const target = this.recordTarget(profile, write.collection, String(row.objectId));
          this.request(
            handle,
            { method: 'DELETE', path: target.path, params: target.params, headers: this.headers(profile, handle) },
            {
              ok: () => {
                if (failed) return;
                if (--remaining === 0) done();
              },
              fail: (message) => {
                if (failed) return;
                failed = true;
                options.error(message);
              }
            }
          );
        }
      },
      fail: (message) => options.error(message)
    });
  }

  /**
   * What `success` receives when the write did not return the source record.
   *
   * `RelationOptions.success` takes an `AdapterRecord`, and both relation nodes
   * copy every key of it onto their `Model` — so handing back a junction row
   * would write `article_id` and `tag_id` onto the user's record as if they were
   * its own fields. The identity alone is the honest answer, and it is what the
   * nodes need to re-read.
   */
  private relationResult(options: RelationOptions): AdapterRecord {
    return { objectId: options.objectId };
  }

  private relationChanged(
    handle: BackendHandle,
    options: RelationOptions,
    record: AdapterRecord,
    direction: 'add' | 'remove'
  ): void {
    options.success(record);
    // `save` is the event `AdapterEvents` has for "this record changed"; a
    // relation change is one, and the Query Records nodes listening for it need
    // to re-run for the same reason an ordinary field write makes them.
    this.emitAdapterEvent({
      type: 'save',
      objectId: options.objectId,
      object: record,
      collection: options.collection
    });
    void direction;
  }

  // ── Relation reads ───────────────────────────────────────────────────────

  /**
   * The path a Directus `include` must actually ask for.
   *
   * ⚠️ **The finding that made this function exist.** `fields=*,tags.*` on a
   * many-to-many returns the **junction rows** —
   * `[{"id":1,"article_id":1,"tag_id":1}]` — with a 200 and no hint that they
   * are not the tags. Only `fields=*,tags.tag_id.*` returns
   * `[{"tag_id":{"id":1,"label":"algebra"}}]`. Both measured on Directus 11.
   *
   * RUN-003's one-hop rule is therefore *wrong for M2M specifically*, in the
   * plausible-wrong-value direction: a repeater bound to `tags` would render
   * one item per tag, each carrying two integers and no label. The descriptor's
   * `readPath` is the correction, and {@link unwrapIncludes} puts the shape back.
   */
  private includePath(handle: BackendHandle, collection: string, field: string): string {
    return this.relation(handle, collection, field)?.readPath ?? field;
  }

  /**
   * A PostgREST embed, aliased to the name the caller asked for.
   *
   * `select=*,bcn005_authors(*)` nests the author under `bcn005_authors` — the
   * *table* name, because PostgREST has no field to name it after. So a node
   * asking to include `author` would find nothing under `author`. Measured:
   * `select=*,author:bcn005_authors(*)` answers 200 with the record under
   * `author`, which is what every other backend does, so the alias is always
   * emitted when the descriptor knows the target.
   *
   * Without a descriptor the name is passed through unchanged, which is the
   * pre-BCN-005 behaviour and is correct whenever the caller named the table or
   * the foreign-key column (both measured working).
   */
  private postgrestEmbed(handle: BackendHandle, collection: string, field: string): string {
    const relation = this.relation(handle, collection, field);
    if (!relation || relation.target === field) return `${field}(*)`;
    return `${field}:${relation.target}(*)`;
  }

  /**
   * Undo the junction nesting, so an included relation looks the same on every
   * backend.
   *
   * Only Directus M2M needs it, and only because its include is two hops. The
   * contract option is one — `include: ['tags']` — so the record a node receives
   * has to carry tags under `tags`, not junction wrappers.
   */
  private unwrapIncludes(
    handle: BackendHandle,
    collection: string,
    include: string[],
    record: AdapterRecord
  ): AdapterRecord {
    if (include.length === 0) return record;
    let result = record;
    const copy = () => {
      if (result === record) result = Object.assign({}, record);
      return result;
    };

    // ⚠️ **PocketBase does not nest the related record onto the field.** It
    // leaves the field holding the id and puts the record under a sibling
    // `expand` object — so `article.author` is a 15-character string where
    // Directus and PostgREST both give the author. Measured; it is what the
    // first live run of this adapter found. The contract's `include` promises
    // "the related record nested", one option, one shape, so it is hoisted.
    // `expand` is left in place: it is stripped on the way back out by
    // `SERVER_OWNED_FIELDS`, and anything already reading it keeps working.
    const expand = record.expand as Record<string, unknown> | undefined;
    if (expand && typeof expand === 'object') {
      for (const field of include) {
        if (!(field in expand)) continue;
        copy()[field] = expand[field];
      }
    }

    for (const field of include) {
      const relation = this.relation(handle, collection, field);
      const key = relation?.readUnwrapKey;
      if (!key) continue;
      const value = result[field];
      if (!Array.isArray(value)) continue;
      copy()[field] = value.map((entry) =>
        entry && typeof entry === 'object' && key in (entry as Record<string, unknown>)
          ? (entry as Record<string, unknown>)[key]
          : entry
      );
    }
    return result;
  }

  // ── Files — BCN-007 steps 2–7 ────────────────────────────────────────────

  /**
   * `beginFile` is `begin` with the file callbacks' error envelope.
   *
   * The eleven data methods take `error(message: string)`; the three file
   * methods take `error({error, status})` — a BCN-002 correction that two node
   * call sites depend on to tell a 403 from a 500. Rather than let each file
   * method remember to wrap, the wrapping is here once.
   */
  private beginFile(
    handle: BackendHandle,
    key: CapabilityKey,
    error: (err?: FileError) => void
  ): RestWireProfile | undefined {
    return this.begin(handle, key, (message) => error({ error: message }));
  }

  /**
   * Upload a file. Three genuinely different operations behind one name.
   *
   * | Backend | What an upload *is* |
   * |---|---|
   * | Directus | `POST /files`, multipart, field `file`. A file is its own object. |
   * | Supabase | `POST /storage/v1/object/{bucket}/{path}`, raw bytes. A file is an object in a bucket. |
   * | PocketBase | multipart create-or-update of a **record**. A file is a field. |
   *
   * All three measured — `BCN-007-FILES-PROBE-OUTPUT.txt` and
   * `BCN-007-SUPABASE-STORAGE-OUTPUT.txt`.
   *
   * ⚠️ **`onUploadProgress` is never called on any of them, and that is not an
   * oversight.** `fetch` has no upload-progress event; only `XMLHttpRequest`
   * does, which is why the Parse wire has one. Rather than fire a single
   * synthetic 100% event — which is worse than nothing, because a progress bar
   * that jumps from 0 to 100 tells the author their instrumentation works when
   * it does not — nothing is emitted and the three `files.progress` cells were
   * corrected from `supported` to `degraded`. Two of them claimed *"the XHR
   * upload path is client-side"*, which was written before this adapter existed.
   */
  uploadFile(handle: BackendHandle, options: UploadFileOptions): void {
    const profile = this.beginFile(handle, 'files.upload', options.error);
    if (!profile) return;

    const blob = options.file as unknown as Blob;
    // `UploadFileOptions.file` is typed `{name, type?}` — the structural subset
    // of `File` the Parse wire needed. A real `File`/`Blob` is what every caller
    // passes; anything else has no bytes and would upload an empty object with a
    // 200 to show for it.
    if (typeof (blob as { arrayBuffer?: unknown })?.arrayBuffer !== 'function' && typeof Blob !== 'undefined' && !(blob instanceof Blob)) {
      options.error({
        error:
          'Upload File was given something that is not a file. Wire the File output of an Open File Picker node into it.'
      });
      return;
    }

    const contentType = options.file.type || 'application/octet-stream';

    switch (profile.type) {
      case 'directus':
        return this.uploadDirectus(handle, profile, options, blob);
      case 'supabase':
        return this.uploadSupabase(handle, profile, options, blob, contentType);
      case 'pocketbase':
        return this.uploadPocketBase(handle, profile, options, blob);
    }
  }

  /**
   * Directus: `POST /files`, `multipart/form-data`, the part named `file`.
   *
   * ⚠️ **The `Content-Type` header must be *removed*, not set.** `headers()`
   * sets `application/json` for every data request; a multipart POST carrying
   * that header sends a body the server cannot parse and gets a 400 that names
   * the wrong thing. The boundary is `fetch`'s to choose and it only chooses one
   * when no header is present.
   *
   * The synthesised `url` is `/assets/{id}` **without a credential**. That URL
   * 403s in an `<img>` (BCN-004-FILE-FACTS §2.1) and is still the right thing to
   * put on the `FileRef`, because a `FileRef.url` is **persisted into a record
   * property** by `_serializeObject`. Baking the caller's access token into it
   * would write a live credential into the user's database, where it would
   * outlive the session and be readable by everyone who can read the row. The
   * usable link comes from {@link signFileUrl}, is minted per use, and is never
   * stored.
   */
  private uploadDirectus(
    handle: BackendHandle,
    profile: RestWireProfile,
    options: UploadFileOptions,
    blob: Blob
  ): void {
    const form = new FormData();
    form.append('file', blob, options.file.name);

    this.request(
      handle,
      {
        method: 'POST',
        path: '/files',
        headers: multipartHeaders(this.headers(profile, handle)),
        body: form,
        raw: true
      },
      {
        ok: (body) => {
          const file = readRecord(profile, body);
          if (!file) {
            options.error({ error: 'Directus accepted the upload but did not describe the stored file.' });
            return;
          }
          options.success(
            normalizeFileRef(file, DIRECTUS_FILE_FIELDS, (name) => (name ? `${baseOf(handle)}/assets/${name}` : undefined))
          );
        },
        fail: (message) => options.error({ error: message })
      }
    );
  }

  /**
   * Supabase Storage: raw bytes to `POST /storage/v1/object/{bucket}/{path}`.
   *
   * ⚠️ **A different service from PostgREST, on the same origin in a real
   * Supabase project and on a different port in our rig.** `handle.url` is the
   * project origin, which is correct for a deployed project; the rig runs
   * `supabase/storage-api` separately, which is why the live driver points a
   * second handle at it. The spec's own trap says this: *"a file 403 will look
   * like a data 403 and have a different cause"*.
   *
   * The response is `{Key, Id}` and carries **no URL, no size and no content
   * type** — measured. `Key` is `{bucket}/{path}`, so the public URL is
   * `/storage/v1/object/public/{Key}`. That URL works only for a bucket created
   * `public: true`; on a private bucket it answers **400** and the usable link
   * comes from {@link signFileUrl}.
   */
  private uploadSupabase(
    handle: BackendHandle,
    profile: RestWireProfile,
    options: UploadFileOptions,
    blob: Blob,
    contentType: string
  ): void {
    const target = options.target;
    if (target?.kind !== 'bucket') {
      options.error({ error: SUPABASE_NEEDS_BUCKET });
      return;
    }

    this.request(
      handle,
      {
        method: 'POST',
        path: `${STORAGE_ROOT}/object/${storagePath(target.bucket, target.path)}`,
        headers: Object.assign(this.headers(profile, handle), { 'Content-Type': contentType }),
        body: blob,
        raw: true
      },
      {
        ok: (body) => {
          const file = (body ?? {}) as Record<string, unknown>;
          options.success(
            normalizeFileRef(
              file,
              SUPABASE_FILE_FIELDS,
              (key) => (key ? `${baseOf(handle)}${STORAGE_ROOT}/object/public/${encodePath(key)}` : undefined),
              target
            )
          );
        },
        fail: (message) => options.error({ error: message })
      }
    );
  }

  /**
   * PocketBase: a multipart create-or-update of the **record** the file hangs
   * off.
   *
   * `recordId` present → `PATCH .../records/{id}`; absent → `POST .../records`,
   * which creates the record as part of the upload. Both measured.
   *
   * ⚠️ **Deliberately not the `field+` append form.** PocketBase's multi-file
   * fields take `gallery+` to *add* and `gallery` to *replace* (both observed).
   * The plain form is used, so `record[field]` after the write contains exactly
   * what was just uploaded and the filename can be read back without guessing
   * which entry is ours. An append would leave the adapter picking an element
   * out of a list it did not fully author.
   */
  private uploadPocketBase(
    handle: BackendHandle,
    profile: RestWireProfile,
    options: UploadFileOptions,
    blob: Blob
  ): void {
    const target = options.target;
    if (target?.kind !== 'record') {
      options.error({ error: POCKETBASE_NEEDS_RECORD });
      return;
    }

    const form = new FormData();
    form.append(target.field, blob, options.file.name);

    const creating = !target.recordId;
    const path = creating
      ? this.path(profile.createPath, target.collection)
      : this.path(profile.recordPath, target.collection, target.recordId);

    this.request(
      handle,
      {
        method: creating ? 'POST' : 'PATCH',
        path,
        headers: multipartHeaders(this.headers(profile, handle)),
        body: form,
        raw: true
      },
      {
        ok: (body) => {
          const record = readRecord(profile, body);
          const stored = readPocketBaseFileName(record, target.field);
          const recordId = typeof record?.id === 'string' ? record.id : undefined;

          if (!record || !stored || !recordId) {
            options.error({
              error: `PocketBase accepted the upload but "${target.field}" on the saved record does not name a file. Check that it is a file-typed field.`
            });
            return;
          }

          options.success(
            normalizeFileRef(
              { name: stored },
              POCKETBASE_FILE_FIELDS,
              () => `${baseOf(handle)}/api/files/${encodeURIComponent(target.collection)}/${encodeURIComponent(recordId)}/${encodeURIComponent(stored)}`,
              { kind: 'record', collection: target.collection, recordId, field: target.field }
            )
          );
        },
        fail: (message) => options.error({ error: message })
      }
    );
  }

  /**
   * A usable link to a file — and, on two of these three, **not a signed one**.
   *
   * This is step 4's substance. The three backends answer the same question with
   * two different kinds of link, and the difference is the whole reason
   * `SignedFileUrl.kind` exists:
   *
   * | Backend | Mechanism | `kind` | Expiry |
   * |---|---|---|---|
   * | Supabase | `POST /object/sign/{bucket}/{path}` with `expiresIn` | `signed` | asked for, and real — 400 `jwt expired` after it |
   * | Directus | `?access_token=` on `/assets/{id}` | `token` | the **session's**, ~900s, read out of the JWT |
   * | PocketBase | `POST /api/files/token`, then `?token=` | `token` | the **file token's**, 180s in the rig |
   *
   * ⚠️ **A `token` URL carries the caller's own credential.** Pasting a Directus
   * asset URL to a colleague hands them the session token; pasting a Supabase
   * signed URL hands them a link that works for the file and nothing else. Those
   * are different enough that the node publishes the distinction on its outputs
   * rather than leaving it to a doc page — `signfileurl.ts`.
   *
   * ⚠️ **Directus's is the caller's *session* token, not a per-file one.**
   * Directus has no per-asset token to mint, so this is the strongest link the
   * API offers and its expiry is whenever the session ends. `ttlSeconds` is
   * therefore reported from the JWT rather than from any request this made —
   * an honest number, but a number about the session.
   */
  signFileUrl(handle: BackendHandle, options: SignFileUrlOptions): void {
    const profile = this.beginFile(handle, 'files.sign', options.error);
    if (!profile) return;

    const token = handle.sessionToken || handle.publicToken;

    switch (profile.type) {
      case 'directus': {
        if (!token) {
          options.error({
            error:
              'A Directus asset link needs a signed-in session or a public token — the backend has neither right now.'
          });
          return;
        }
        const expiry = jwtExpiry(token);
        options.success({
          url: `${baseOf(handle)}/assets/${encodeURIComponent(options.name)}?access_token=${encodeURIComponent(token)}`,
          kind: 'token',
          ...(expiry ?? {})
        });
        return;
      }

      case 'supabase': {
        const target = options.target;
        if (target?.kind !== 'bucket') {
          options.error({ error: LOST_TARGET });
          return;
        }
        this.request(
          handle,
          {
            method: 'POST',
            path: `${STORAGE_ROOT}/object/sign/${storagePath(target.bucket, target.path)}`,
            headers: this.headers(profile, handle),
            body: { expiresIn: SIGNED_URL_TTL_SECONDS }
          },
          {
            ok: (body) => {
              // ⚠️ `signedURL` is **relative** — `/object/sign/{bucket}/{path}?token=…`
              // — so it needs the origin AND the `/storage/v1` mount putting
              // back. Handing it to an `<img src>` as returned resolves against
              // the *app's* origin and 404s there, which reads as a broken file.
              const relative = (body as { signedURL?: unknown } | undefined)?.signedURL;
              if (typeof relative !== 'string' || relative.length === 0) {
                options.error({ error: 'Supabase Storage signed the file but did not return a URL.' });
                return;
              }
              const url = `${baseOf(handle)}${STORAGE_ROOT}${relative}`;
              const expiry = jwtExpiry(tokenParam(url));
              options.success({ url, kind: 'signed', ...(expiry ?? {}) });
            },
            fail: (message) => options.error({ error: message })
          }
        );
        return;
      }

      case 'pocketbase': {
        const target = options.target;
        if (target?.kind !== 'record') {
          options.error({ error: LOST_TARGET });
          return;
        }
        this.request(
          handle,
          { method: 'POST', path: '/api/files/token', headers: this.headers(profile, handle) },
          {
            ok: (body) => {
              const fileToken = (body as { token?: unknown } | undefined)?.token;
              if (typeof fileToken !== 'string' || fileToken.length === 0) {
                options.error({ error: 'PocketBase did not return a file token.' });
                return;
              }
              const base = `${baseOf(handle)}/api/files/${encodeURIComponent(target.collection)}/${encodeURIComponent(target.recordId ?? '')}/${encodeURIComponent(options.name)}`;
              const expiry = jwtExpiry(fileToken);
              options.success({
                url: `${base}?token=${encodeURIComponent(fileToken)}`,
                kind: 'token',
                ...(expiry ?? {})
              });
            },
            fail: (message) => options.error({ error: message })
          }
        );
        return;
      }
    }
  }

  /**
   * Delete a file. Three different meanings, all three now measured, and **two
   * of the spec's three sentences about them were wrong**.
   *
   * | Backend | What deletion does |
   * |---|---|
   * | Directus | `DELETE /files/{id}` → 204. Succeeds **even when referenced**, and Directus nulls the reference. |
   * | Supabase | `DELETE /storage/v1/object/{bucket}/{path}` → 200. A path that never existed is a **400**, not a no-op. |
   * | PocketBase | `PATCH` the record with the field cleared → 200. The blob goes; the record stays. |
   *
   * ⚠️ **The spec's trap — *"Directus will not delete a file that is
   * referenced"* — is false.** Measured with a real `directus_files` relation
   * created through `POST /relations`: the delete answers **204**, the file is
   * gone, and the referencing row's field becomes `null`
   * (`BCN-007-FILES-PROBE2-OUTPUT.txt` §1). The trap warned that a `deleteFile`
   * reporting success from a different code path *"will look correct and leave
   * the file"*; the real hazard turned out to be the opposite one, and an
   * adapter written to the spec would have added a defensive pre-check for a
   * refusal that never comes.
   *
   * ⚠️ **PocketBase deletion is not symmetric with ours.** Clearing the field
   * removes the blob but leaves the record, so a Delete File node on PocketBase
   * silently edits a record — which is why the `files.delete` cell says so.
   */
  deleteFile(handle: BackendHandle, options: DeleteFileOptions): void {
    const profile = this.beginFile(handle, 'files.delete', options.error);
    if (!profile) return;

    switch (profile.type) {
      case 'directus':
        this.request(
          handle,
          { method: 'DELETE', path: `/files/${encodeURIComponent(options.file.name)}`, headers: this.headers(profile, handle) },
          {
            ok: (body) => options.success((body ?? {}) as Record<string, unknown>),
            fail: (message) => options.error({ error: message })
          }
        );
        return;

      case 'supabase': {
        const target = options.target;
        if (target?.kind !== 'bucket') {
          options.error({ error: LOST_TARGET });
          return;
        }
        this.request(
          handle,
          {
            method: 'DELETE',
            path: `${STORAGE_ROOT}/object/${storagePath(target.bucket, target.path)}`,
            headers: this.headers(profile, handle)
          },
          {
            ok: (body) => options.success((body ?? {}) as Record<string, unknown>),
            fail: (message) => options.error({ error: message })
          }
        );
        return;
      }

      case 'pocketbase': {
        const target = options.target;
        if (target?.kind !== 'record' || !target.recordId) {
          options.error({ error: LOST_TARGET });
          return;
        }
        this.request(
          handle,
          {
            method: 'PATCH',
            path: this.path(profile.recordPath, target.collection, target.recordId),
            headers: this.headers(profile, handle),
            body: { [target.field]: null }
          },
          {
            ok: (body) => options.success((body ?? {}) as Record<string, unknown>),
            fail: (message) => options.error({ error: message })
          }
        );
        return;
      }
    }
  }
}

// ── File helpers, exported for the unit suite ──────────────────────────────

/** Supabase Storage's mount, on the project origin. Not PostgREST's `/rest/v1`. */
const STORAGE_ROOT = '/storage/v1';

/**
 * How long a Supabase signed URL lasts.
 *
 * Matches `nodegx-backend`'s own `signedUrlTtlSeconds` default (300, see
 * `storage/config.ts`), so the two backends that genuinely sign behave alike
 * rather than differing by whichever number each adapter's author picked.
 */
const SIGNED_URL_TTL_SECONDS = 300;

const SUPABASE_NEEDS_BUCKET =
  'Supabase keeps files in a Storage bucket. Set Bucket and Path on the node — there is no default, ' +
  'and a guessed bucket name fails with an error that does not say so.';

const POCKETBASE_NEEDS_RECORD =
  'On PocketBase a file is a field on a record. Set Collection and Field on the node (and Record ID to ' +
  'attach to an existing record rather than create a new one) — a file with no record has nowhere to live.';

/**
 * The sentence for a **later** operation that lost the file's location.
 *
 * ⚠️ Not the upload sentence, and the difference matters. Sign File URL and
 * Delete File have no Collection or Bucket inputs to set, so telling the user to
 * "set Collection and Field on the node" names ports that are not there —
 * exactly the plausible-looking wrong message this phase exists to remove.
 *
 * The real cause is one thing and it is worth saying: `cloudstore.js`'s
 * `_serializeObject` persists a File-typed record property as
 * `{__type: 'File', url, name}`, so a file **read back off a saved record** has
 * no `target` and cannot be addressed on these two backends. A file still held
 * from the Upload File node that produced it works fine.
 */
const LOST_TARGET =
  'This file came from a saved record, and on this backend a record only stores the file\'s name — not the ' +
  'bucket or collection it lives in, which is what a link or a delete needs. Wire the Cloud File straight ' +
  'from the Upload File node that produced it, or use a cloud function that knows where the file is.';

/** The origin to compose file URLs against, without a trailing slash. */
function baseOf(handle: BackendHandle): string {
  return (handle.url || '').replace(/\/$/, '');
}

/**
 * `bucket/path`, each segment escaped, `/` left as a separator.
 *
 * `encodeURIComponent` on the whole thing would turn the path separators into
 * `%2F` and address one object whose name contains slashes — which Storage
 * treats as a different object and answers 400 for. Only the segments are
 * escaped.
 */
function storagePath(bucket: string, path: string): string {
  return `${encodeURIComponent(bucket)}/${encodePath(path)}`;
}

function encodePath(path: string): string {
  return String(path)
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent)
    .join('/');
}

/**
 * The headers for a multipart request: everything the data path sends **except**
 * `Content-Type`.
 *
 * ⚠️ Deleting it is the point. `fetch` picks the `multipart/form-data` boundary
 * itself and only does so when the header is absent; an inherited
 * `application/json` produces a body the server reads as JSON, fails to parse,
 * and reports as a malformed request naming the wrong thing entirely.
 */
function multipartHeaders(headers: Record<string, string>): Record<string, string> {
  const copy = Object.assign({}, headers);
  delete copy['Content-Type'];
  return copy;
}

/**
 * The filename PocketBase stored, out of the saved record.
 *
 * A single-file field holds a string; a `maxSelect > 1` field holds an array.
 * The **last** entry is taken: this adapter always writes with the replacing
 * form (never `field+`), so on a multi-file field the array holds exactly what
 * was just uploaded, and `last` is right for both shapes without a branch that
 * only one of them exercises.
 */
export function readPocketBaseFileName(record: Record<string, unknown> | undefined, field: string): string | undefined {
  const value = record?.[field];
  if (typeof value === 'string') return value.length > 0 ? value : undefined;
  if (Array.isArray(value) && value.length > 0) {
    const last = value[value.length - 1];
    return typeof last === 'string' && last.length > 0 ? last : undefined;
  }
  return undefined;
}

/** The `token` query parameter of a URL, without needing a `URL` polyfill. */
export function tokenParam(url: string): string | undefined {
  const query = url.split('?')[1];
  if (!query) return undefined;
  for (const pair of query.split('&')) {
    const [key, value] = pair.split('=');
    if (key === 'token' && value) return decodeURIComponent(value);
  }
  return undefined;
}

// ── Free functions, exported for the unit suite ────────────────────────────

/**
 * Read one member of an `AggregateOptions.group` map.
 *
 * The shape is Parse's — `{ total: { sum: 'rating' } }` — because that is what
 * twenty-five nodes already pass. `count` may name `*` for "all rows", which is
 * the one Directus answers with a flat key.
 */
export function readGroupMember(member: unknown, outputKey: string): { fn: string; field: string } {
  const group = member as Record<string, unknown> | undefined;
  for (const fn of ['count', 'sum', 'avg', 'min', 'max']) {
    const field = group?.[fn];
    if (typeof field === 'string' && field.length > 0) return { fn, field };
  }
  if (group && typeof group.distinct === 'string') {
    throw new Error(
      `"${outputKey}" asks for the distinct values of "${group.distinct}" inside an aggregate, ` +
        'which these backends cannot do. Use the Distinct operation instead.'
    );
  }
  throw new Error(`"${outputKey}" needs one of count, sum, avg, min or max.`);
}

/**
 * Pull one aggregate out of a Directus response row.
 *
 * Two shapes, both measured: `aggregate[count]=*` answers `{"count":5}` and
 * `aggregate[count]=id` answers `{"count":{"id":5}}`. Deriving one from the
 * other would be wrong exactly half the time.
 */
export function readAggregateValue(row: Record<string, unknown>, fn: string, field: string): unknown {
  const value = row[fn];
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return (value as Record<string, unknown>)[field];
  }
  return value;
}

/**
 * The headers that make a write answer with the written row.
 *
 * Named for what it does rather than for the profile field it reads: the field
 * is called `createRequestHeaders` because the probe found the trap on a
 * create, and the same header turns out to be needed on an update. Measured:
 * a PostgREST `PATCH` without it answers **204 with an empty body**.
 */
function representationHeaders(profile: RestWireProfile): Record<string, string> | undefined {
  return profile.createRequestHeaders ? Object.assign({}, profile.createRequestHeaders) : undefined;
}

/**
 * Remove the fields a backend owns before writing a record back.
 *
 * Always strips the identity — both the wire's name and the contract's — since
 * `save` addresses the record in the URL. See {@link SERVER_OWNED_FIELDS} for
 * the rest and for the residual risk this carries.
 */
/**
 * The sentence for a relation the synced schema does not describe.
 *
 * Named rather than inlined because it is the refusal that replaces BCN-004's
 * blanket one, and the whole argument of the phase is that a refusal carries a
 * sentence the user can act on. It names the field, the collection, and the one
 * thing that fixes it.
 */
export function relationNotFound(handle: BackendHandle, options: RelationOptions): string {
  const target = relationTarget(options);
  return (
    `NodeGX does not know how "${options.key}" relates ${options.collection} to ` +
    `${target ? `"${target}"` : 'another collection'} on this ${handle.type} backend. ` +
    'Refresh the backend schema in the Backend Services panel — relation details are only readable with ' +
    'admin credentials, so they are read when you connect and not while the app runs.'
  );
}

export function stripServerOwned(profile: RestWireProfile, data: Record<string, unknown>): Record<string, unknown> {
  const copy = Object.assign({}, data);
  delete copy.objectId;
  delete copy[profile.idField];
  for (const field of SERVER_OWNED_FIELDS[profile.type] ?? []) delete copy[field];
  return copy;
}
