/**
 * Realtime filter matcher (BAK-001).
 *
 * A subscription may carry a `filter` in the SAME Parse-style operator grammar
 * the query routes use (QueryBuilder.buildWhereClause / translateOperator). For
 * realtime, that filter must be evaluated in JS against a single changed record
 * BEFORE delivery — the SQL query has already run, there is no table to re-scan.
 *
 * The one hard requirement is that this matcher and the SQL WHERE clause never
 * disagree: a record a paired query would return MUST match here, and vice
 * versa. `filter.property.test.ts` enforces exactly that against a real
 * node:sqlite database (matcher verdict === query membership) across a
 * generated matrix, so the two forms cannot drift.
 *
 * Semantics deliberately mirrored from QueryBuilder:
 *   - Pointer/Date envelopes on the *filter* side are unwrapped to their
 *     objectId / ISO string (records arrive storage-shaped: pointers are bare
 *     objectId strings, dates are ISO strings).
 *   - NULL/absent field semantics follow SQL three-valued logic: `col > ?`,
 *     `col != ?`, `col IN (...)` are all *false* when the column is NULL (the
 *     row is not selected). `$eq: null` / `$ne: null` / `$exists` are the
 *     explicit NULL tests.
 *   - `$in`/`$nin` on empty arrays follow QueryBuilder's `'0'` (never) / `'1'`
 *     (always) shortcuts.
 *   - `$regex` is a **real regular expression**, evaluated by the same
 *     `regexpMatch` the SQL side now registers as a SQLite function (BCN-003).
 *     `$contains`/`$text` remain the ASCII-case-insensitive substring test,
 *     because those two still lower to `LIKE '%term%'` in SQL.
 *   - The three geo operators are real conditions too, evaluated by the same
 *     `distanceKm` / `pointInPolygon` the SQL side calls (BCN-003).
 *
 * ⚠️ **BCN-003 changed three of these, and the property test is what said so.**
 * `$regex` used to be `LIKE '%term%'` on both sides, so both agreed that `DA`
 * matched `Date`. Fixing the SQL side to a real regex made the two disagree on
 * the very first generated case, which is exactly what a twin with a property
 * test is for. The geo operators used to contribute no constraint on either
 * side — agreeing, and both wrong. Sharing the implementation rather than
 * mirroring it a second time is what stops the next change re-opening this.
 *
 * Known limits (documented, and rejected at subscription time by
 * `assertFilterSupported` so they can never silently mis-match):
 *   - `$relatedTo` needs a junction-table subquery; it cannot be decided against
 *     a lone record and is refused for realtime filters.
 *   - Non-ASCII ordering and `LIKE` collation can differ from SQLite; keep
 *     realtime filters to the documented subset.
 *
 * @module nodegx-backend/realtime/filter
 */

import {
  distanceKm,
  pointInPolygon,
  regexpMatch,
  EARTH_RADIUS_KM,
  KM_PER_MILE
} from '@noodl/runtime/src/api/adapters/local-sql/sqlFunctions';

export type Where = Record<string, unknown>;

/** A filter used an operator this build cannot faithfully evaluate for realtime. */
export class UnsupportedFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFilterError';
  }
}

/** Unwrap Parse Pointer/Date envelopes exactly as QueryBuilder.convert* does. */
function convertValue(value: unknown): unknown {
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (v.__type === 'Pointer' && typeof v.objectId === 'string') return v.objectId;
    if (v.__type === 'Date' && typeof v.iso === 'string') return v.iso;
  }
  return value;
}

function isNil(value: unknown): boolean {
  return value === null || value === undefined;
}

/** SQL `=` for same-storage-class scalars (the generator keeps types aligned). */
function sqlEq(a: unknown, b: unknown): boolean {
  return a === b;
}

/** Fold only ASCII A–Z, matching SQLite's default LIKE case-insensitivity. */
function asciiLower(s: string): string {
  return s.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

function likeContains(field: unknown, term: string): boolean {
  if (isNil(field)) return false; // NULL LIKE ? → NULL → not selected
  return asciiLower(String(field)).includes(asciiLower(term));
}

function order(field: unknown, value: unknown, op: (a: number | string, b: number | string) => boolean): boolean {
  // NULL on either side of an ordered comparison → NULL → row not selected.
  if (isNil(field) || isNil(value)) return false;
  return op(field as number | string, value as number | string);
}

/** The three spellings Parse accepts for a `$nearSphere` radius, in kilometres. */
function maxDistanceKm(siblings: Record<string, unknown> | undefined): number | null {
  if (!siblings) return null;
  if (typeof siblings.$maxDistanceInMiles === 'number') return siblings.$maxDistanceInMiles * KM_PER_MILE;
  if (typeof siblings.$maxDistanceInKilometers === 'number') return siblings.$maxDistanceInKilometers;
  if (typeof siblings.$maxDistanceInRadians === 'number') return siblings.$maxDistanceInRadians * EARTH_RADIUS_KM;
  return null;
}

function matchOperator(
  field: unknown,
  op: string,
  rawValue: unknown,
  siblings?: Record<string, unknown>
): boolean {
  const value = convertValue(rawValue);

  switch (op) {
    case '$eq':
      return isNil(value) ? isNil(field) : sqlEq(field, value);

    case '$ne':
      if (isNil(value)) return !isNil(field); // IS NOT NULL
      if (isNil(field)) return false; // NULL != v → NULL → not selected
      return !sqlEq(field, value);

    case '$gt':
      return order(field, value, (a, b) => a > b);
    case '$gte':
      return order(field, value, (a, b) => a >= b);
    case '$lt':
      return order(field, value, (a, b) => a < b);
    case '$lte':
      return order(field, value, (a, b) => a <= b);

    case '$in': {
      if (!Array.isArray(rawValue) || rawValue.length === 0) return false; // SQL '0'
      if (isNil(field)) return false;
      return rawValue.map(convertValue).some((v) => sqlEq(field, v));
    }
    case '$nin': {
      if (!Array.isArray(rawValue) || rawValue.length === 0) return true; // SQL '1'
      if (isNil(field)) return false; // NULL NOT IN (...) → NULL → not selected
      return !rawValue.map(convertValue).some((v) => sqlEq(field, v));
    }

    case '$exists':
      return rawValue ? !isNil(field) : isNil(field);

    // A real regular expression since BCN-003, evaluated by the same function
    // the SQL side registers — not a second implementation of it. `$options`
    // is read from the sibling key, as it is in the WHERE-clause builder.
    case '$regex': {
      if (isNil(field)) return false; // NULL never matches, as in SQL
      const flags = typeof siblings?.$options === 'string' ? siblings.$options : '';
      return regexpMatch(String(value ?? ''), flags, field) === 1;
    }

    // These two still lower to LIKE in SQL, so they still fold ASCII case here.
    case '$contains':
    case 'contains':
      return likeContains(field, String(value ?? ''));

    case '$text': {
      const v = rawValue as { $search?: unknown } | undefined;
      if (v && v.$search !== undefined) {
        const search = v.$search as { $term?: unknown } | string;
        const term = typeof search === 'string' ? search : String((search && search.$term) ?? '');
        return likeContains(field, term);
      }
      return true; // no $search → no clause
    }

    case '$options':
    case '$maxDistanceInMiles':
    case '$maxDistanceInKilometers':
    case '$maxDistanceInRadians':
      return true; // modifiers, consumed by the operator they sit beside

    // ── Geo (BCN-003) ──────────────────────────────────────────────────────
    //
    // These used to return `true` here because SQL dropped the condition. Both
    // sides agreed, and both were wrong: a "within 5 km" subscription received
    // every change in the collection.

    case '$nearSphere': {
      const centre = value as { latitude?: number; longitude?: number } | null;
      if (!centre || typeof centre.latitude !== 'number' || typeof centre.longitude !== 'number') return true;
      const distance = distanceKm(field, centre.latitude, centre.longitude);
      if (distance === null) return false; // no usable point → excluded, as in SQL
      const radiusKm = maxDistanceKm(siblings);
      return radiusKm === null ? true : distance <= radiusKm;
    }

    case '$within': {
      const box = (value as { $box?: Array<{ latitude?: number; longitude?: number }> } | null)?.$box;
      if (!Array.isArray(box) || box.length !== 2) return true;
      const [sw, ne] = box;
      if (
        typeof sw?.latitude !== 'number' ||
        typeof sw?.longitude !== 'number' ||
        typeof ne?.latitude !== 'number' ||
        typeof ne?.longitude !== 'number'
      ) {
        return true;
      }
      const point = readStoredPoint(field);
      if (!point) return false;
      return (
        point.latitude >= Math.min(sw.latitude, ne.latitude) &&
        point.latitude <= Math.max(sw.latitude, ne.latitude) &&
        point.longitude >= Math.min(sw.longitude, ne.longitude) &&
        point.longitude <= Math.max(sw.longitude, ne.longitude)
      );
    }

    case '$geoWithin': {
      const polygon = (value as { $polygon?: unknown[] } | null)?.$polygon;
      if (!Array.isArray(polygon) || polygon.length < 3) return true;
      return pointInPolygon(field, JSON.stringify(polygon)) === 1;
    }

    // An operator with no branch here would impose no constraint and deliver
    // changes a paired query would exclude — the widening failure BCN-003 is
    // about. The SQL side throws on an unknown operator now, so this refuses
    // too, and `assertFilterSupported` catches it at subscribe time rather
    // than on the first delivery.
    default:
      throw new UnsupportedFilterError(
        `"${op}" is not an operator a realtime filter can be matched against. ` +
          'Refusing rather than ignoring it, because an ignored condition delivers changes the filter excluded.'
      );
  }
}

/** A stored GeoPoint, as JSON text or an already-parsed object. */
function readStoredPoint(raw: unknown): { latitude: number; longitude: number } | null {
  let point = raw;
  if (typeof point === 'string') {
    try {
      point = JSON.parse(point);
    } catch {
      return null;
    }
  }
  if (!point || typeof point !== 'object') return null;
  const { latitude, longitude } = point as { latitude?: unknown; longitude?: unknown };
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return { latitude, longitude };
}

/**
 * Does `record` satisfy `where`? True for an empty/absent filter (subscribe to
 * every change in the collection). Mirrors QueryBuilder.buildWhereClause:
 * top-level keys are AND-ed; `$and`/`$or` recurse.
 */
export function matchesFilter(where: Where | null | undefined, record: Record<string, unknown>): boolean {
  if (!where || Object.keys(where).length === 0) return true;

  for (const [key, condition] of Object.entries(where)) {
    if (key === '$and') {
      if (!Array.isArray(condition)) continue;
      const subs = condition as Where[];
      if (subs.length === 0) continue; // buildWhereClause drops an empty $and
      if (!subs.every((sub) => matchesFilter(sub, record))) return false;
      continue;
    }

    if (key === '$or') {
      if (!Array.isArray(condition)) continue;
      const subs = condition as Where[];
      if (subs.length === 0) continue; // buildWhereClause drops an empty $or
      if (!subs.some((sub) => matchesFilter(sub, record))) return false;
      continue;
    }

    if (key === '$relatedTo') {
      throw new UnsupportedFilterError('$relatedTo cannot be evaluated for a realtime filter');
    }

    const fieldValue = record[key];

    // Direct equality — a plain value, not an operator object. Mirrors
    // QueryBuilder: `typeof condition !== 'object' || condition === null` is the
    // direct-equality path; an array falls through to the operator loop (its
    // indices become unknown operators → no constraint), exactly as SQL does.
    if (condition === null || typeof condition !== 'object') {
      const target = convertValue(condition);
      // buildWhereClause emits a bare `col = ?`; a null param means `col = NULL`,
      // which is NULL (never true) for EVERY row — including null columns. This
      // differs from `{$eq: null}` (→ `IS NULL`), and the property test proves it.
      if (isNil(target)) return false;
      if (!sqlEq(fieldValue, target)) return false;
      continue;
    }

    const siblings = condition as Record<string, unknown>;
    for (const [op, raw] of Object.entries(siblings)) {
      if (!matchOperator(fieldValue, op, raw, siblings)) return false;
    }
  }

  return true;
}

/**
 * Reject a filter that uses an operator this build cannot faithfully match for
 * realtime (currently only `$relatedTo`). Called at subscription-creation time
 * so a subscriber never silently receives events a paired query would exclude.
 * @throws UnsupportedFilterError
 */
export function assertFilterSupported(where: Where | null | undefined): void {
  if (!where || typeof where !== 'object') return;
  for (const [key, condition] of Object.entries(where)) {
    if (key === '$relatedTo') {
      throw new UnsupportedFilterError('$relatedTo is not supported in realtime subscription filters');
    }
    if ((key === '$and' || key === '$or') && Array.isArray(condition)) {
      for (const sub of condition) assertFilterSupported(sub as Where);
      continue;
    }
    // BCN-003: an operator with no branch in `matchOperator` used to impose no
    // constraint, so a subscription carrying one silently received changes a
    // paired query would have excluded. It throws now — and throwing at
    // subscribe time is the difference between a clear refusal and a delivery
    // loop that fails on whichever record happens to change first.
    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
      for (const op of Object.keys(condition as Record<string, unknown>)) {
        if (op.startsWith('$') && !SUPPORTED_OPERATORS.has(op)) {
          throw new UnsupportedFilterError(`"${op}" is not supported in realtime subscription filters`);
        }
      }
    }
  }
}

/**
 * Every operator `matchOperator` has a branch for.
 *
 * Kept beside `assertFilterSupported` rather than derived from the switch,
 * because a `switch` cannot be enumerated at runtime — and the property test
 * against a real database is what actually proves the two lists agree.
 */
const SUPPORTED_OPERATORS = new Set([
  '$eq',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$nin',
  '$exists',
  '$regex',
  '$options',
  '$contains',
  '$text',
  '$nearSphere',
  '$maxDistanceInMiles',
  '$maxDistanceInKilometers',
  '$maxDistanceInRadians',
  '$within',
  '$geoWithin'
]);
