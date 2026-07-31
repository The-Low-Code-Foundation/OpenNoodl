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
 * ## What is not here
 *
 * Files (`uploadFile`/`signFileUrl`/`deleteFile`) and relation mutation
 * (`addRelation`/`removeRelation`) are BCN-007's and BCN-005's. They are
 * implemented as explicit refusals carrying the reason, not as silent no-ops:
 * the contract requires all fourteen methods and a method that quietly does
 * nothing is the failure this phase exists to remove.
 *
 * @module api/backends/RestDataAdapter
 */

import {
  descriptorFor,
  paginationParams,
  readRecord,
  readRows,
  readTotalCount,
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
  type IDataAdapter,
  type IncrementOptions,
  type ListOption,
  type QueryOptions,
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
import { normalizeRecordIdentities, normalizeRecordIdentity } from './recordIdentity';

/** Query-string parameters as **pairs**, not a record — PostgREST repeats keys. */
type Params = Array<[string, string]>;

/** The subset of `fetch` this adapter uses, so a test can inject one. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
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

  constructor(options: RestDataAdapterOptions = {}) {
    super();
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init) as unknown as ReturnType<FetchLike>);
    this.probedCapabilities = options.probedCapabilities ?? [];
    this.probedFilterOperators = options.probedFilterOperators ?? [];
    this.schemaFor = options.schemaFor;
    this.serializeObject = options.serializeObject ?? ((data) => data);
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

  private path(template: string, collection: string, id?: string): string {
    return template.replace('{collection}', encodeURIComponent(collection)).replace('{id}', encodeURIComponent(id ?? ''));
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
  private recordTarget(profile: RestWireProfile, collection: string, objectId: string): { path: string; params: Params } {
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
    init: { method?: string; path: string; params?: Params; headers?: Record<string, string>; body?: unknown },
    callbacks: { ok: (body: unknown, headers: { get(name: string): string | null }) => void; fail: (message: string) => void }
  ): void {
    const url = this.url(handle, init.path, init.params ?? []);

    this.fetchImpl(url, {
      method: init.method || 'GET',
      headers: init.headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
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
      schema: this.schemaFor ? this.schemaFor(collection, handle) : undefined,
      probed: this.probedFilterOperators
    };
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
          const records = this.normalizeAll(profile, rows);
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

        // `fields=*,author.*` — the relation expansion RUN-003 built, kept.
        const fields = select.length > 0 ? select.slice() : include.length > 0 ? ['*'] : [];
        for (const relation of include) if (!fields.includes(`${relation}.*`)) fields.push(`${relation}.*`);
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
          if (!filter.embeds.includes(relation)) selectParts.push(`${relation}(*)`);
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
      for (const relation of include) select.push(`${relation}(*)`);
      params.push(['select', select.join(',')]);
    } else if (profile.type === 'directus' && include.length > 0) {
      params.push(['fields', ['*'].concat(include.map((relation) => `${relation}.*`)).join(',')]);
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
          const record = this.normalize(profile, raw);
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
   * `relations.addRemove` is `unsupported` on all three descriptors, and this
   * is the refusal rather than a no-op. The reason string is the descriptor's,
   * so what a developer reads in the console is what the editor writes on the
   * port.
   */
  addRelation(handle: BackendHandle, options: RelationOptions): void {
    this.refuseRelation(handle, options);
  }

  removeRelation(handle: BackendHandle, options: RelationOptions): void {
    this.refuseRelation(handle, options);
  }

  private refuseRelation(handle: BackendHandle, options: RelationOptions): void {
    const capability = this.capability(handle, 'relations.addRemove');
    options.error(
      capability.state === 'supported'
        ? `Relation editing is not implemented for ${handle.type} yet.`
        : capability.reason
    );
  }

  // ── Files — BCN-007 ──────────────────────────────────────────────────────

  /**
   * The three file methods are BCN-007's, and BCN-004's Out of Scope says so.
   *
   * They refuse loudly rather than silently, and they refuse with the
   * `FileError` envelope the file callbacks actually declare (`{error, status}`)
   * rather than the bare string the eleven data methods take — a BCN-002
   * correction that two node call sites depend on to tell a 403 from a 500.
   *
   * ⚠️ Note the descriptor disagreement, recorded rather than papered over: all
   * three backends have `files.upload` **supported** because their APIs do
   * support it. The gap is this adapter, not the backend, and a cell that says
   * so would be a lie about Directus.
   */
  uploadFile(handle: BackendHandle, options: UploadFileOptions): void {
    options.error({ error: `Uploading files to ${handle.type} is not available yet.` });
  }

  signFileUrl(handle: BackendHandle, options: SignFileUrlOptions): void {
    options.error({ error: `File links for ${handle.type} are not available yet.` });
  }

  deleteFile(handle: BackendHandle, options: DeleteFileOptions): void {
    options.error({ error: `Deleting files from ${handle.type} is not available yet.` });
  }
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
export function stripServerOwned(profile: RestWireProfile, data: Record<string, unknown>): Record<string, unknown> {
  const copy = Object.assign({}, data);
  delete copy.objectId;
  delete copy[profile.idField];
  for (const field of SERVER_OWNED_FIELDS[profile.type] ?? []) delete copy[field];
  return copy;
}
