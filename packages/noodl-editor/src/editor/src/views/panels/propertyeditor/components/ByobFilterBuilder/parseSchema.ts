/**
 * The Parse-family schema, in the shape the filter builder reads.
 *
 * `QueryEditor` and `ByobFilterBuilder` were handed two entirely different
 * descriptions of the same idea, and BCN-003b kept the builder's:
 *
 * | | Shape |
 * |---|---|
 * | Parse family (`query-filter`) | `{properties: {Name: {type: 'String'}}, relations: {Team: [{property: 'members'}]}}` |
 * | BYOB (`byob-filter`) | `{collection, fields: [{name, type: 'string'}]}` |
 *
 * Converting here rather than teaching the builder both is the same separation
 * `translators/saved.ts` makes for the saved format: one shape inside, adapters
 * at the edges. The alternative — a builder that branches on which backend
 * family it was given — is how the two builders came to exist in the first
 * place.
 *
 * ## What is deliberately dropped
 *
 * Parse has property types this filter cannot ask questions about: `File`,
 * `GeoPoint`, `Array`, `Object`, and `Relation` *as a column*. `QueryEditor`
 * dropped them too (`utils.ts::_supportedTypes`), and `filterdbmodelsnode`
 * prunes them before the port is even declared. They are dropped rather than
 * offered-and-broken, which is this phase's rule about capability: a thing that
 * cannot be expressed must be visibly absent, not silently ineffective.
 *
 * ⚠️ A `Relation` column is not the same as a relation *rule*. The column is
 * dropped; the rule — "which records is this one related to" — is what
 * `relations` below carries, and it reads the other way round. See
 * {@link SchemaRelation}.
 */

import type { FieldType, SchemaCollection, SchemaField, SchemaRelation } from './types';

/** The Parse-side schema as `dbcollectionnode2` and `filterdbmodelsnode` build it. */
export interface ParseCollectionSchema {
  properties?: Record<string, { type?: string; targetClass?: string }>;
  /** Collections holding a `Relation` that points at this one. */
  relations?: Record<string, { property: string }[]>;
}

/**
 * Parse property type → the builder's field type.
 *
 * `Number` becomes `float` rather than `integer` because Parse has one numeric
 * type and it is a double; calling it `integer` would only change the label,
 * and both get the same operator list.
 */
const PARSE_TYPES: Readonly<Record<string, FieldType>> = Object.freeze({
  String: 'string',
  Number: 'float',
  Boolean: 'boolean',
  Date: 'datetime',
  Pointer: 'pointer'
});

/** Is this shape the Parse-family schema rather than the builder's own? */
export function isParseSchema(schema: unknown): schema is ParseCollectionSchema {
  if (!schema || typeof schema !== 'object') return false;
  const candidate = schema as ParseCollectionSchema & { fields?: unknown };
  if (Array.isArray(candidate.fields)) return false;
  return typeof candidate.properties === 'object' && candidate.properties !== null;
}

/** Convert a Parse-family collection schema into the one the builder reads. */
export function parseSchemaToCollection(
  schema: ParseCollectionSchema | null | undefined,
  collectionName?: string
): SchemaCollection | null {
  if (!schema || !schema.properties) return null;

  const fields: SchemaField[] = [];
  for (const [name, property] of Object.entries(schema.properties)) {
    const type = PARSE_TYPES[property?.type ?? ''];
    if (!type) continue;
    fields.push(type === 'pointer' ? { name, type, relatedCollection: property.targetClass } : { name, type });
  }

  const relations: SchemaRelation[] = Object.entries(schema.relations ?? {})
    .map(([className, entries]) => ({
      className,
      properties: (entries ?? []).map((entry) => entry.property)
    }))
    .filter((relation) => relation.properties.length > 0);

  return {
    name: collectionName ?? '',
    fields,
    ...(relations.length > 0 ? { relations } : {})
  };
}
