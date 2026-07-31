/**
 * The REST write path's `serializeObject` hook — BCN-004 step 5.
 *
 * ⚠️ **This closes a live correctness gap, not a nicety.** `RestDataAdapter` defaults its
 * `serializeObject` to the identity, and its own notes say so:
 *
 * > The schema-aware normalisation `byob-utils::normalizeValue` did — parsing a JSON
 * > column's text, coercing a date column to ISO 8601 — **has not been ported**, so a
 * > `json`-typed Directus column written from an object-typed port will double-encode
 * > exactly as it did before RUN-003 fixed it. Whoever wires the nodes must pass the hook.
 *
 * This is that hook. {@link normalizeValue} is the *same function* RUN-003 shipped, moved
 * here from `byob-utils.ts` (which re-exports it, so the four BYOB nodes and the tests
 * that pin it are untouched) because the layering runs the other way: `api/` may not
 * import `nodes/`, and both families now need it.
 *
 * The second half of the hook is the Noodl object model. A Record node's property port can
 * hold a `Model` or a `Collection` rather than a plain value — `_serializeObject` in
 * `cloudstore.js` unwraps those for the Parse wire, and a REST backend handed one would
 * `JSON.stringify` a class instance. The unwrapping function is passed in rather than
 * imported so this module does not have to require `cloudstore.js`, which requires the
 * adapters, which would require this.
 *
 * @module api/backends/restSerialize
 */

import type { FilterSchema } from '@noodl/backend-contract/translators';

import type { SchemaCollection, SchemaField } from '../../nodes/std-library/data/schema-types';

/**
 * Normalize a value for API submission.
 *
 * Handles date conversion to ISO 8601 format, and JSON text for json/array columns.
 * Moved verbatim from `byob-utils.ts` in BCN-004 step 5; the comments are RUN-003's.
 *
 * @param {*} value - The value to normalize
 * @param {Object} fieldSchema - Field schema information
 * @returns {*} Normalized value
 */
export function normalizeValue(value: unknown, fieldSchema: SchemaField | undefined): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // A json/array column's port is object-typed (getEnhancedFieldType), and object-typed
  // ports are now editable in the property panel as a literal — so what arrives here for
  // such a field may be the *text* the author typed. Sending that on would double-encode
  // it: the column would hold the string `{"a":1}` rather than the object. Parsed here
  // rather than in each node's setter because this is the one funnel every write path
  // shares, and because the setter has no schema to consult.
  //
  // Text that does not parse is passed through untouched: a `json` column can legitimately
  // hold a JSON string, and guessing is worse than sending what was asked for.
  if (fieldSchema && (fieldSchema.type === 'json' || fieldSchema.type === 'array') && typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return value;
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      return value;
    }
  }

  // Handle date/datetime fields - convert to ISO 8601
  if (
    fieldSchema &&
    (fieldSchema.type === 'dateTime' ||
      fieldSchema.type === 'date' ||
      fieldSchema.type === 'timestamp' ||
      fieldSchema.type === 'time')
  ) {
    // If already an ISO string, return as-is
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value;
    }

    // Try to parse as date
    try {
      const date = new Date(value as string | number | Date);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (e) {
      console.warn('[BYOB Utils] Failed to convert date value:', value);
    }
  }

  return value;
}

/** One collection's columns, by name. */
export function fieldsByName(
  collections: readonly SchemaCollection[] | undefined,
  collectionName: string | undefined
): Record<string, SchemaField> {
  const collection = (collections || []).find((candidate) => candidate.name === collectionName);
  const fields: Record<string, SchemaField> = {};
  for (const field of collection?.fields || []) fields[field.name] = field;
  return fields;
}

export interface RestSerializerOptions {
  /** The selected backend's cached schema. Read per call, so a re-introspection lands. */
  collections: () => readonly SchemaCollection[];
  /** Unwrap a Noodl `Model`/`Collection` into plain JSON. `cloudstore.js` owns it. */
  toJSON: (value: unknown) => unknown;
}

/**
 * The `serializeObject` hook to hand `RestDataAdapter`.
 *
 * Returns a **copy**. The Parse-wire serialiser mutates its argument in place — a
 * pre-existing wart that is survivable there because the caller built the object for the
 * call, and not worth reproducing in a new one.
 */
export function makeRestSerializer(options: RestSerializerOptions) {
  return function serializeObject(data: Record<string, unknown>, collection: string): Record<string, unknown> {
    const fields = fieldsByName(options.collections(), collection);
    const out: Record<string, unknown> = {};

    for (const key in data) {
      out[key] = normalizeValue(options.toJSON(data[key]), fields[key]);
    }

    return out;
  };
}

/**
 * The cached schema as the filter translators want it.
 *
 * ⚠️ **BCN-004's note here said "nothing reads it today". BCN-005 made that false**, and
 * in the one way that mattered: `pocketbase.ts` now reads `cardinality` to decide between
 * `tags.label = 'x'` (every related record must match) and `tags.label ?= 'x'` (at least
 * one must). Measured on a live PocketBase, the first returns **no rows** where the second
 * returns the right one — so a `RestDataAdapter` constructed without `schemaFor` will
 * quietly return an empty result set for any filter across a multi-valued relation. The
 * one place that builds the adapter passes it; this comment is for the second.
 *
 * The rest of the note still holds: `directus.ts` and `postgrest.ts` do not read the
 * schema, and the Parse translator reads `targetClass` for `pointsTo`.
 */
export function filterSchemaFor(
  collections: readonly SchemaCollection[] | undefined,
  collectionName: string | undefined
): FilterSchema | undefined {
  if (!collectionName) return undefined;
  const fields = fieldsByName(collections, collectionName);
  if (Object.keys(fields).length === 0) return undefined;

  const properties: FilterSchema['properties'] = {};
  for (const name of Object.keys(fields)) {
    const field = fields[name];
    properties[name] = {
      // `nativeType` is the backend's own spelling and is what a translator would key on;
      // the neutral `type` is the fallback for a schema that did not record one.
      type: field.nativeType || field.type,
      ...(field.relationTarget ? { targetClass: field.relationTarget } : {}),
      // `relationType` is the cached schema's word for cardinality. Only the
      // to-many spellings become `'many'`; anything else — including a relation
      // whose type was never recorded — stays undefined, which the translators
      // treat as `'one'`, i.e. exactly what they did before this field existed.
      ...(field.relationType === 'many-to-many' || field.relationType === 'one-to-many'
        ? { cardinality: 'many' as const }
        : field.relationType
          ? { cardinality: 'one' as const }
          : {})
    };
  }

  return { collection: collectionName, properties };
}
