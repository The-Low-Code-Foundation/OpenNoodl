/**
 * Backend schema parsers
 *
 * Pure functions that turn a backend's native schema-introspection response
 * into the normalized CachedSchema the BYOB system stores in project metadata
 * and the byob-* runtime nodes build ports from.
 *
 * Extracted from BackendServices.ts (RUN-003) so the ship logic is unit-testable
 * without the editor singletons. No imports beyond the local types.
 *
 * @module BackendServices
 */

import { CachedSchema, SchemaField } from './types';

/**
 * Raw field entry as served by Directus GET /fields.
 * `schema` is null for presentation-only fields (dividers, notices);
 * `meta` is null for some system fields.
 */
interface DirectusRawField {
  collection: string;
  field: string;
  type: string;
  schema?: {
    is_nullable?: boolean;
    is_primary_key?: boolean;
    is_unique?: boolean;
    default_value?: unknown;
    foreign_key_table?: string | null;
    foreign_key_column?: string | null;
  } | null;
  meta?: {
    options?: { choices?: Array<{ text?: string; value: string }> } | null;
    special?: string[] | null;
    interface?: string | null;
    hidden?: boolean;
  } | null;
}

/** Create the empty schema envelope all parsers fill. */
export function emptySchema(): CachedSchema {
  const now = new Date();
  return {
    version: now.getTime().toString(),
    fetchedAt: now,
    collections: []
  };
}

/**
 * Whether a Directus field is presentation-only or explicitly hidden —
 * preserved onto SchemaField.hidden so the runtime nodes can skip it when
 * building ports (the cached SchemaField no longer carries raw `meta`).
 */
function isDirectusFieldHidden(field: DirectusRawField): boolean {
  if (field.meta?.hidden === true) return true;
  if (field.meta?.interface && field.meta.interface.startsWith('presentation-')) return true;
  return false;
}

/**
 * Parse Directus schema from the GET /fields response.
 *
 * Relations: Directus marks a many-to-one foreign key directly on the field's
 * column schema (`foreign_key_table`/`foreign_key_column`), so M2O relations —
 * including file fields, which are FKs to `directus_files` — are recovered here.
 * One-to-many / many-to-many relations only exist in GET /relations (junction
 * tables) and are not parsed yet; when relation traversal lands they should be
 * merged in from that endpoint.
 */
export function parseDirectusSchema(data: unknown, schema: CachedSchema = emptySchema()): CachedSchema {
  // Directus returns: { data: [{ collection, field, type, ... }] }
  const fieldsData = ((data as { data?: unknown[] })?.data || []) as DirectusRawField[];

  const collectionMap = new Map<string, CachedSchema['collections'][0]>();

  for (const field of fieldsData) {
    // Only skip if collection name is missing - include system tables (directus_*)
    if (!field.collection) continue;

    if (!collectionMap.has(field.collection)) {
      collectionMap.set(field.collection, {
        name: field.collection,
        displayName: field.collection,
        fields: [],
        primaryKey: 'id'
      });
    }

    const collection = collectionMap.get(field.collection)!;

    const foreignKeyTable = field.schema?.foreign_key_table || undefined;
    const parsed: SchemaField = {
      name: field.field,
      displayName: field.field,
      type: field.type,
      nativeType: field.type,
      required: field.schema?.is_nullable === false,
      primaryKey: field.schema?.is_primary_key,
      unique: field.schema?.is_unique,
      defaultValue: field.schema?.default_value,
      enumValues: field.meta?.options?.choices?.map((c) => c.value),
      relationTarget: foreignKeyTable,
      relationType: foreignKeyTable ? 'many-to-one' : undefined
    };
    if (isDirectusFieldHidden(field)) parsed.hidden = true;

    collection.fields.push(parsed);

    if (field.schema?.is_primary_key) {
      collection.primaryKey = field.field;
    }
  }

  schema.collections = Array.from(collectionMap.values());
  return schema;
}

/**
 * Parse Supabase schema from the OpenAPI spec served at /rest/v1/.
 */
export function parseSupabaseSchema(data: unknown, schema: CachedSchema = emptySchema()): CachedSchema {
  // Supabase returns OpenAPI spec with definitions/paths
  const openApi = (data ?? {}) as {
    definitions?: Record<string, { properties?: Record<string, { type?: string; format?: string }> }>;
  };

  if (openApi.definitions) {
    for (const [tableName, tableDef] of Object.entries(openApi.definitions)) {
      const fields =
        tableDef.properties &&
        Object.entries(tableDef.properties).map(([fieldName, fieldDef]) => ({
          name: fieldName,
          displayName: fieldName,
          type: fieldDef.type || 'unknown',
          nativeType: fieldDef.format || fieldDef.type || 'unknown',
          required: false
        }));

      schema.collections.push({
        name: tableName,
        displayName: tableName,
        fields: fields || [],
        primaryKey: 'id'
      });
    }
  }

  return schema;
}

/**
 * Parse Pocketbase schema from /api/collections.
 */
export function parsePocketbaseSchema(data: unknown, schema: CachedSchema = emptySchema()): CachedSchema {
  // Pocketbase returns: [{ id, name, schema: [{ name, type, required, ... }] }]
  const collections = Array.isArray(data) ? data : (data as { items?: unknown[] })?.items || [];

  for (const col of collections as Array<{
    name: string;
    schema?: Array<{ name: string; type: string; required?: boolean; options?: { values?: string[] } }>;
    system?: boolean;
  }>) {
    if (col.system) continue;

    schema.collections.push({
      name: col.name,
      displayName: col.name,
      fields:
        col.schema?.map((f) => ({
          name: f.name,
          displayName: f.name,
          type: f.type,
          nativeType: f.type,
          required: f.required || false,
          enumValues: f.options?.values
        })) || [],
      primaryKey: 'id'
    });
  }

  return schema;
}

/**
 * Parse a generic schema format (custom REST backends): an array of
 * collections, or an object with a `collections`/`tables` array.
 */
export function parseGenericSchema(data: unknown, schema: CachedSchema = emptySchema()): CachedSchema {
  const collections = Array.isArray(data)
    ? data
    : (data as { collections?: unknown[]; tables?: unknown[] })?.collections ||
      (data as { tables?: unknown[] })?.tables ||
      [];

  for (const col of collections as Array<{
    name: string;
    fields?: Array<{ name: string; type?: string }>;
  }>) {
    if (!col.name) continue;

    schema.collections.push({
      name: col.name,
      displayName: col.name,
      fields:
        col.fields?.map((f) => ({
          name: f.name,
          displayName: f.name,
          type: f.type || 'unknown',
          nativeType: f.type || 'unknown',
          required: false
        })) || [],
      primaryKey: 'id'
    });
  }

  return schema;
}

/**
 * Dispatch to the right parser for a backend type.
 */
export function parseSchemaResponse(type: string, data: unknown): CachedSchema {
  const schema = emptySchema();

  if (type === 'directus') return parseDirectusSchema(data, schema);
  if (type === 'supabase') return parseSupabaseSchema(data, schema);
  if (type === 'pocketbase') return parsePocketbaseSchema(data, schema);

  // For custom, try to parse as a generic schema format
  return parseGenericSchema(data, schema);
}
