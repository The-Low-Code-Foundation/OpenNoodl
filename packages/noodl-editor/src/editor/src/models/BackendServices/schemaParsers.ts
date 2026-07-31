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
 * A property entry in the OpenAPI spec PostgREST serves (Supabase's /rest/v1/
 * root is exactly this document). PostgREST annotates keys in the description:
 *   PK: "Note:\nThis is a Primary Key.<pk/>"
 *   FK: "Note:\nThis is a Foreign Key to `authors.id`.<fk table='authors' column='id'/>"
 * and carries postgres ENUM types as an `enum` values array.
 */
interface SupabaseOpenApiProperty {
  type?: string;
  format?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
}

const SUPABASE_FK_RE = /<fk table='([^']+)' column='[^']*'\/>/;

/**
 * Parse Supabase schema from the OpenAPI spec served at /rest/v1/.
 * Recovers enums, primary keys, required columns, defaults, and M2O relations
 * from PostgREST's annotations (verified against a live PostgREST instance —
 * see uba-e2e/SUPABASE-CONTACT-OUTPUT.txt).
 */
export function parseSupabaseSchema(data: unknown, schema: CachedSchema = emptySchema()): CachedSchema {
  // Supabase returns OpenAPI spec with definitions/paths
  const openApi = (data ?? {}) as {
    definitions?: Record<
      string,
      { properties?: Record<string, SupabaseOpenApiProperty>; required?: string[] }
    >;
  };

  if (openApi.definitions) {
    for (const [tableName, tableDef] of Object.entries(openApi.definitions)) {
      const requiredColumns = tableDef.required || [];
      let primaryKey = 'id';

      const fields =
        tableDef.properties &&
        Object.entries(tableDef.properties).map(([fieldName, fieldDef]) => {
          const isPrimaryKey = fieldDef.description?.includes('<pk/>') || undefined;
          if (isPrimaryKey) primaryKey = fieldName;
          const fkTable = fieldDef.description?.match(SUPABASE_FK_RE)?.[1];

          const field: SchemaField = {
            name: fieldName,
            displayName: fieldName,
            type: fieldDef.type || 'unknown',
            nativeType: fieldDef.format || fieldDef.type || 'unknown',
            required: requiredColumns.includes(fieldName),
            primaryKey: isPrimaryKey,
            defaultValue: fieldDef.default,
            enumValues: Array.isArray(fieldDef.enum) && fieldDef.enum.length > 0 ? fieldDef.enum : undefined,
            relationTarget: fkTable,
            relationType: fkTable ? 'many-to-one' : undefined
          };
          return field;
        });

      schema.collections.push({
        name: tableName,
        displayName: tableName,
        fields: fields || [],
        primaryKey
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
 * One field of a Parse class, as `GET /schemas` reports it.
 * `targetClass` is set on `Pointer` and `Relation` and on nothing else.
 */
interface ParseRawField {
  type?: string;
  targetClass?: string;
  required?: boolean;
  defaultValue?: unknown;
}

/**
 * One class of a Parse-typed schema response.
 *
 * Two envelopes, because two servers speak the Parse wire and they do not agree on
 * this route: upstream Parse answers `GET /schemas` with `{results: [{className,
 * fields}]}`, while our own `nodegx-backend` does **not** implement `/schemas` at all
 * (`parse-wire.ts` lists it under "Explicitly NOT implemented") and serves
 * `GET /api/_schema` with `{tables: [{name, columns}]}` instead. The *types* inside
 * are the same words — its SchemaManager stores `String`/`Number`/`Pointer` with a
 * `targetClass` — so only the envelope has to be unwrapped twice.
 */
interface ParseRawClass {
  /** `GET /schemas` spelling. */
  className?: string;
  /** `GET /api/_schema` spelling. */
  name?: string;
  /** `GET /schemas` spelling: a map keyed by field name. */
  fields?: Record<string, ParseRawField>;
  /** `GET /api/_schema` spelling: an array carrying the name inside each entry. */
  columns?: ({ name?: string } & ParseRawField)[];
  classLevelPermissions?: unknown;
}

/** The class list, from whichever envelope arrived. */
function parseClassList(data: unknown): ParseRawClass[] {
  if (Array.isArray(data)) return data as ParseRawClass[];
  const results = (data as { results?: unknown })?.results;
  if (Array.isArray(results)) return results as ParseRawClass[];
  const tables = (data as { tables?: unknown })?.tables;
  if (Array.isArray(tables)) return tables as ParseRawClass[];
  return [];
}

/** The fields of one class, from whichever spelling arrived. */
function parseClassFields(cls: ParseRawClass): Record<string, ParseRawField> {
  if (cls.fields) return cls.fields;
  if (Array.isArray(cls.columns)) {
    const map: Record<string, ParseRawField> = {};
    for (const column of cls.columns) {
      if (column && column.name) map[column.name] = column;
    }
    return map;
  }
  return {};
}

/**
 * Parse's own type names, mapped onto the neutral field types the runtime's port
 * generator reads.
 *
 * ⚠️ **This table has a twin** in `noodl-runtime/src/nodes/std-library/data/schema-ports.ts`
 * (`PARSE_TYPE_MAP`), which normalises the same classes when they arrive through the
 * legacy `dbCollections` project metadata instead of through Backend Services. The editor
 * cannot import the runtime and the runtime cannot import the editor, so the twin is
 * unavoidable; both sides are tested against the same fixture so a drift fails a test
 * rather than producing a quietly wrong port type. A third copy would be the signal to
 * promote it into `@noodl/backend-contract`.
 */
const PARSE_TYPE_MAP: Record<string, string> = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Date: 'dateTime',
  Object: 'json',
  Array: 'array',
  GeoPoint: 'json',
  Polygon: 'json',
  Bytes: 'string',
  // `{__type: 'File', name, url}` on the wire — an object port until BCN-007 gives
  // files a port type of their own.
  File: 'json',
  // A Pointer's own value is the target's objectId.
  Pointer: 'string',
  // A Relation is a record SET, not a value, and keeps a type of its own so callers
  // can tell it apart.
  Relation: 'relation'
};

/**
 * Parse the Parse-wire schema from `GET /schemas` — the fourth backend shape, and the
 * one that lets the Record nodes' ports be schema-driven like the BYOB nodes' are
 * (BCN-004 step 4, Desired State 3).
 *
 * `Pointer` and `Relation` carry `targetClass`, so M2O relations are recovered here the
 * way Directus' `foreign_key_table` and PostgREST's `<fk .../>` annotation are. A
 * `Relation` is a record set, marked many-to-many, so relation *traversal* skips it —
 * the same rule the other parsers already follow.
 */
export function parseParseSchema(data: unknown, schema: CachedSchema = emptySchema()): CachedSchema {
  // Parse returns: { results: [{ className, fields: {name: {type, targetClass}} }] }
  // NodeGX returns: { tables: [{ name, columns: [{name, type, targetClass}] }] }
  for (const cls of parseClassList(data)) {
    const className = cls?.className || cls?.name;
    if (!className) continue;

    const rawFields = parseClassFields(cls);
    const fields: SchemaField[] = Object.keys(rawFields).map((name) => {
      const raw = rawFields[name] || {};
      const field: SchemaField = {
        name,
        displayName: name,
        type: PARSE_TYPE_MAP[raw.type] || 'string',
        nativeType: raw.type,
        required: raw.required === true,
        primaryKey: name === 'objectId' || undefined,
        defaultValue: raw.defaultValue
      };

      if (raw.type === 'Pointer') {
        field.relationTarget = raw.targetClass;
        field.relationType = 'many-to-one';
      } else if (raw.type === 'Relation') {
        field.relationTarget = raw.targetClass;
        field.relationType = 'many-to-many';
      }

      // The ACL is access control, not data — no port has ever been useful for it.
      if (name === 'ACL') field.hidden = true;

      return field;
    });

    schema.collections.push({
      name: className,
      displayName: className,
      fields,
      primaryKey: 'objectId'
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
  // Both presets point `endpoints.schema` at Parse's `/schemas`, and both answer the
  // same envelope — one wire, two rows in the preset table (BCN-002).
  if (type === 'parse' || type === 'nodegx') return parseParseSchema(data, schema);

  // For custom, try to parse as a generic schema format
  return parseGenericSchema(data, schema);
}
