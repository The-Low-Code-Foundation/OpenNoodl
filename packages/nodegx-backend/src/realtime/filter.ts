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
 *   - `$regex`/`$contains`/`$text` become an ASCII-case-insensitive substring
 *     test — SQLite's default `LIKE '%term%'` folds only ASCII A–Z.
 *   - Unknown / geo operators contribute no constraint in SQL (translateOperator
 *     returns null), so they contribute none here either (match = true).
 *
 * Known limits (documented, and rejected at subscription time by
 * `assertFilterSupported` so they can never silently mis-match):
 *   - `$relatedTo` needs a junction-table subquery; it cannot be decided against
 *     a lone record and is refused for realtime filters.
 *   - Non-ASCII ordering/`LIKE` and `%`/`_` wildcards inside a `$regex` value
 *     can differ from SQLite; keep realtime filters to the documented subset.
 *
 * @module nodegx-backend/realtime/filter
 */

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

function matchOperator(field: unknown, op: string, rawValue: unknown): boolean {
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

    case '$regex':
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
      return true; // paired with $regex; contributes nothing on its own

    // $nearSphere / $within / $geoWithin and any unknown operator: SQL
    // translateOperator returns null (no clause), so they impose no constraint.
    default:
      return true;
  }
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

    for (const [op, raw] of Object.entries(condition as Record<string, unknown>)) {
      if (!matchOperator(fieldValue, op, raw)) return false;
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
    }
  }
}
