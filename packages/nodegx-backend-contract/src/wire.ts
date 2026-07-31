/**
 * `RestWireProfile` — how each REST backend's HTTP surface actually behaves.
 *
 * **Every value in this file was measured, not read.** The probe is
 * `dev-docs/tasks/phase-16-runtime-deploy-health/uba-e2e/bcn-004-wire-probe.mjs`
 * and its findings are written up in `BCN-004-WIRE-FACTS.md`. That ordering is
 * the phase's rule rather than diligence for its own sake: BCN-002 found all
 * three of Parse's carefully-documented file cells wrong, BCN-003 found four
 * descriptor cells a real server contradicted, and both were wrong in the
 * direction that only surfaces in a user's app.
 *
 * ## Why this is not the editor's `BackendPreset`
 *
 * BCN-004's spec says the adapter is *"configured per backend type by the
 * existing `BackendPreset` (endpoints, response envelope, pagination style)"*.
 * Doing that literally would ship a known bug, and the probe is what showed it:
 *
 * - The Directus preset's `totalCountPath` is `meta.total_count`, and
 *   `total_count` **ignores the filter** — three rows, two matching, it still
 *   says three. The number pagination needs is `meta.filter_count`. This is
 *   precisely the defect RUN-003 fixed in `byob-utils.ts::pickTotalCount`.
 * - The PocketBase preset's `offsetParam` is `'page'`, but `page` is a **1-based
 *   page number**, not a row offset. Passing a `skip` through gives page 10
 *   rather than rows 10–19 — and `page=0` clamps to page 1, so the first page
 *   looks right and hides it.
 * - `ResponseConfig` has no way to say "the total is in the `Content-Range`
 *   header", "you must send `Prefer: count=exact` to get it", or "a create
 *   returns an empty body unless you send `Prefer: return=representation`" —
 *   all three of which are true of Supabase.
 *
 * Two consequences follow, and the second is the load-bearing one:
 *
 * 1. Widening `ResponseConfig` to express all of that turns it into a
 *    description of five specific servers — which is this file, with extra
 *    steps and a worse name.
 * 2. **Preset values are copied into project metadata when a backend is added.**
 *    A project saved before a preset is corrected keeps the old values forever,
 *    so the wrong Directus total would outlive the fix. For a *known* backend
 *    the wire is a fact about the backend, not a user's configuration, and facts
 *    belong in code that ships. This is the same argument BCN-009 made in its
 *    deviation #2 for referencing the capability descriptor rather than copying
 *    it onto the preset.
 *
 * `custom` has **no profile here on purpose**: there the endpoints and envelope
 * genuinely are user configuration, and the phase already decided `custom` is a
 * *declared* backend whose owner fills in its own capabilities. It reads the
 * saved `endpoints`/`responseConfig`; see {@link REST_WIRE_PROFILES}.
 *
 * @module backend-contract/wire
 */

import type { BackendType } from './backends';

/**
 * Where the total number of matching rows comes back.
 *
 * Three genuinely different mechanisms, which is why this is a discriminated
 * union rather than a path string:
 *
 * - `body-path` — a dotted path into the response body (Directus, PocketBase).
 * - `content-range` — the `Content-Range` response header, `first-last/total`
 *   (PostgREST). Requires {@link RestWireProfile.countRequestHeaders} to be sent,
 *   or the total reads `*` — literally unknown, not zero.
 * - `page-length` — the backend does not report one; fall back to the number of
 *   rows returned. Honest rather than absent: a caller can tell "this is all of
 *   them" from "this is a page of an unknown number".
 */
export type TotalCountSource =
  | { readonly kind: 'body-path'; readonly path: string }
  | { readonly kind: 'content-range' }
  | { readonly kind: 'page-length' };

/**
 * How a row offset is expressed.
 *
 * `offset` takes a row count directly. `page` takes a page number and needs the
 * conversion `floor(skip / perPage) + base` — which is the whole reason this is
 * modelled rather than left as a parameter name. See
 * {@link RestWireProfile.pagination}.
 */
export type PaginationStyle =
  | { readonly kind: 'offset'; readonly offsetParam: string; readonly limitParam: string }
  | {
      readonly kind: 'page';
      readonly pageParam: string;
      readonly perPageParam: string;
      /** The number of the first page. PocketBase 0.30.0 is 1-based, measured. */
      readonly firstPage: number;
    };

/** What a successful create hands back, which is not the same everywhere. */
export type CreateResponseShape =
  /** The record, at the top level or under {@link RestWireProfile.dataPath}. */
  | { readonly kind: 'record' }
  /** An array containing the one created record — PostgREST. Unwrap `[0]`. */
  | { readonly kind: 'array-of-one' };

/**
 * One backend's HTTP surface, as observed.
 *
 * Path templates use `{collection}` and `{id}`. They are deliberately the same
 * spelling the editor's `BackendEndpoints` already uses, so the two can be
 * compared by eye when BCN-009's step 2 converges the metadata.
 */
export interface RestWireProfile {
  readonly type: Exclude<BackendType, 'custom'>;

  /** `GET` a page of records. */
  readonly listPath: string;
  /** `GET`/`PATCH`/`DELETE` one record. */
  readonly recordPath: string;
  /** `POST` a new record. */
  readonly createPath: string;

  /**
   * How the public token is presented.
   *
   * `bearer` sends `Authorization: Bearer <token>`. `token` sends the bare
   * token. PocketBase 0.30.0 accepts **both** (measured — 200 for each, 401 with
   * neither), so it takes `bearer` and the note is here rather than in a code
   * comment nobody reads.
   */
  readonly auth: 'bearer' | 'token';
  /**
   * Extra headers carrying the token under another name. Supabase wants the anon
   * key as `apikey` *as well as* a bearer.
   */
  readonly tokenHeaders?: readonly string[];

  /**
   * Dotted path to the row array in a **list** response, or `''` when the body
   * **is** the array. PostgREST returns a bare array — no envelope to look
   * inside.
   */
  readonly dataPath: string;

  /**
   * Dotted path to the record in a **single-record** response (create, fetch,
   * update), or `''` when the record is the body.
   *
   * Separate from {@link dataPath}, and not a tidiness split: the two genuinely
   * differ. Directus wraps both a list and a single record in `data`, so they
   * agree there — but PocketBase wraps a list in `items` and returns a single
   * record at the **top level**. Deriving one from the other looked right and
   * made `create` return `undefined` on PocketBase, which is the failure this
   * whole file exists to avoid.
   */
  readonly recordDataPath: string;

  readonly totalCount: TotalCountSource;
  /**
   * Headers that must be sent for {@link totalCount} to be answerable at all.
   * PostgREST reports `*` for the total without `Prefer: count=exact`.
   */
  readonly countRequestHeaders?: Readonly<Record<string, string>>;

  readonly pagination: PaginationStyle;

  readonly createResponse: CreateResponseShape;
  /**
   * Headers a create must send to get a body back.
   *
   * ⚠️ Without `Prefer: return=representation` PostgREST answers `201` with an
   * **empty body**. `IDataAdapter.create` hands `success` an `AdapterRecord`, so
   * an adapter that omits this calls back with nothing, on a success status,
   * with no error anywhere — the same shape as the `convertFilterOp` defect
   * BCN-003 found.
   */
  readonly createRequestHeaders?: Readonly<Record<string, string>>;

  /** The primary-key field, before `recordIdentity` normalises it to `objectId`. */
  readonly idField: string;
}

// ── The measured profiles ──────────────────────────────────────────────────

const DIRECTUS: RestWireProfile = {
  type: 'directus',
  listPath: '/items/{collection}',
  recordPath: '/items/{collection}/{id}',
  createPath: '/items/{collection}',
  auth: 'bearer',
  dataPath: 'data',
  // Directus wraps a single record in `data` too, so these agree here.
  recordDataPath: 'data',
  // ⚠️ `filter_count`, NOT `total_count`. Measured: three rows, two matching
  // `tag = x`, and the response says `{"total_count":3,"filter_count":2}`.
  // The preset says `meta.total_count` and is wrong; RUN-003 fixed this once
  // already in `pickTotalCount` and the comment there says the same thing.
  totalCount: { kind: 'body-path', path: 'meta.filter_count' },
  pagination: { kind: 'offset', offsetParam: 'offset', limitParam: 'limit' },
  createResponse: { kind: 'record' },
  idField: 'id'
};

const SUPABASE: RestWireProfile = {
  type: 'supabase',
  listPath: '/rest/v1/{collection}',
  recordPath: '/rest/v1/{collection}',
  createPath: '/rest/v1/{collection}',
  auth: 'bearer',
  // Supabase authenticates with the anon key in `apikey` as well as a bearer.
  tokenHeaders: ['apikey'],
  // A bare array. There is no envelope and no path into one.
  dataPath: '',
  recordDataPath: '',
  totalCount: { kind: 'content-range' },
  countRequestHeaders: { Prefer: 'count=exact' },
  pagination: { kind: 'offset', offsetParam: 'offset', limitParam: 'limit' },
  createResponse: { kind: 'array-of-one' },
  createRequestHeaders: { Prefer: 'return=representation' },
  idField: 'id'
};

const POCKETBASE: RestWireProfile = {
  type: 'pocketbase',
  listPath: '/api/collections/{collection}/records',
  recordPath: '/api/collections/{collection}/records/{id}',
  createPath: '/api/collections/{collection}/records',
  auth: 'bearer',
  dataPath: 'items',
  // ⚠️ A single record comes back at the TOP LEVEL, not under `items`.
  recordDataPath: '',
  // Measured filter-aware: `totalItems` is 2 of 3 under `tag='x'`.
  totalCount: { kind: 'body-path', path: 'totalItems' },
  // ⚠️ 1-based, measured: page=1 -> Ada, page=2 -> Alan, and page=0 CLAMPS to
  // page 1 rather than erroring. The preset calls this an `offsetParam`, which
  // invites passing a row offset straight through — correct-looking on the first
  // page and wrong on every one after it.
  pagination: { kind: 'page', pageParam: 'page', perPageParam: 'perPage', firstPage: 1 },
  createResponse: { kind: 'record' },
  idField: 'id'
};

/**
 * The Parse-wire backends are **not** here.
 *
 * `nodegx` and `parse` already have an adapter — `ParseWireAdapter`, from
 * BCN-002, exercised against a real Parse Server. This file describes the REST
 * family that `RestDataAdapter` serves. Adding rows for them would create a
 * second description of a wire that already has a working one, which is the
 * duplication this phase exists to remove.
 */
export const REST_WIRE_PROFILES: Readonly<Record<'directus' | 'supabase' | 'pocketbase', RestWireProfile>> =
  Object.freeze({
    directus: DIRECTUS,
    supabase: SUPABASE,
    pocketbase: POCKETBASE
  });

/**
 * The profile for a backend type, or `undefined` when there is not one.
 *
 * `undefined` is the answer for `custom` (configured by its owner, read from the
 * saved `endpoints`/`responseConfig`) and for `nodegx`/`parse` (served by
 * `ParseWireAdapter`). A caller that cannot handle `undefined` is asking the
 * wrong object.
 */
export function restWireProfileFor(type: BackendType): RestWireProfile | undefined {
  return (REST_WIRE_PROFILES as Record<string, RestWireProfile | undefined>)[type];
}

/**
 * Convert a row offset to this wire's pagination parameters.
 *
 * Split out and exported because it is the one piece of arithmetic in the
 * profile that can be wrong without erroring, and it deserves its own test.
 *
 * ⚠️ **A page-based wire cannot express an arbitrary row offset.** `skip=5` with
 * `limit=10` is not any page. Rather than silently rounding to page 1 and
 * returning rows 0–9 as if they were 5–14, this reports the rounding in
 * `inexact` so the adapter can degrade honestly.
 */
export function paginationParams(
  profile: RestWireProfile,
  limit: number | undefined,
  skip: number | undefined
): { params: Record<string, string>; inexact: boolean } {
  const params: Record<string, string> = {};

  if (profile.pagination.kind === 'offset') {
    if (limit !== undefined) params[profile.pagination.limitParam] = String(limit);
    if (skip) params[profile.pagination.offsetParam] = String(skip);
    return { params, inexact: false };
  }

  const { pageParam, perPageParam, firstPage } = profile.pagination;
  const perPage = limit;
  if (perPage !== undefined) params[perPageParam] = String(perPage);

  if (!skip) return { params, inexact: false };

  // Without a page size there is no page to compute; asking for a page anyway
  // would invent one.
  if (!perPage) return { params, inexact: true };

  params[pageParam] = String(Math.floor(skip / perPage) + firstPage);
  return { params, inexact: skip % perPage !== 0 };
}

/**
 * Read the total out of a response, given the profile.
 *
 * `undefined` means the backend did not say — which is different from zero, and
 * is what PostgREST reports (`*`) when `Prefer: count=exact` was not sent.
 */
export function readTotalCount(
  profile: RestWireProfile,
  body: unknown,
  headers: { get(name: string): string | null } | undefined,
  rowCount: number
): number | undefined {
  switch (profile.totalCount.kind) {
    case 'page-length':
      return rowCount;

    case 'content-range': {
      const range = headers?.get('content-range');
      if (!range) return undefined;
      const total = range.split('/')[1];
      // `*` is PostgREST for "you did not ask, so I did not count".
      if (!total || total === '*') return undefined;
      const n = Number(total);
      return Number.isFinite(n) ? n : undefined;
    }

    case 'body-path': {
      let cursor: unknown = body;
      for (const segment of profile.totalCount.path.split('.')) {
        if (cursor === null || typeof cursor !== 'object') return undefined;
        cursor = (cursor as Record<string, unknown>)[segment];
      }
      return typeof cursor === 'number' ? cursor : undefined;
    }
  }
}

/**
 * Pull the row array out of a response body.
 *
 * An empty `dataPath` means the body *is* the array (PostgREST). A path that
 * does not lead to an array yields `[]` rather than throwing: a backend that
 * answers 200 with an unexpected shape is a real thing, and the caller's error
 * channel is a better place to notice it than a TypeError here.
 */
export function readRows(profile: RestWireProfile, body: unknown): unknown[] {
  if (profile.dataPath === '') return Array.isArray(body) ? body : [];

  let cursor: unknown = body;
  for (const segment of profile.dataPath.split('.')) {
    if (cursor === null || typeof cursor !== 'object') return [];
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return Array.isArray(cursor) ? cursor : [];
}

/**
 * Pull the single record out of a create/fetch/update response.
 *
 * Handles the three shapes the probe found: the record at the top level
 * (PocketBase), the record under `dataPath` (Directus), and an array of one
 * (PostgREST). Returns `undefined` when the body carried no record at all —
 * which is what a PostgREST create answers without
 * `Prefer: return=representation`, and is the case that must not be mistaken
 * for success with an empty record.
 */
export function readRecord(profile: RestWireProfile, body: unknown): Record<string, unknown> | undefined {
  if (body === null || body === undefined || body === '') return undefined;

  if (profile.createResponse.kind === 'array-of-one') {
    const rows = Array.isArray(body) ? body : readRows(profile, body);
    const first = rows[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : undefined;
  }

  let cursor: unknown = body;
  if (profile.recordDataPath !== '') {
    for (const segment of profile.recordDataPath.split('.')) {
      if (cursor === null || typeof cursor !== 'object') return undefined;
      cursor = (cursor as Record<string, unknown>)[segment];
    }
  }
  return cursor && typeof cursor === 'object' && !Array.isArray(cursor)
    ? (cursor as Record<string, unknown>)
    : undefined;
}
