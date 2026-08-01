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

import {
  RelationDescriptor,
  relationsFromDirectus,
  relationsFromParseClasses,
  relationsFromPocketBase,
  relationsFromPostgrestSpec
} from '@noodl/backend-contract';

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

/** One field of a PocketBase collection, in either of the two shapes it has had. */
interface PocketbaseRawField {
  name: string;
  type: string;
  required?: boolean;
  /** ≤ 0.22: select options were nested. */
  options?: { values?: string[]; collectionId?: string; maxSelect?: number };
  /** 0.23+: the same options were flattened onto the field. */
  values?: string[];
  system?: boolean;
  /**
   * 0.23+. `true` on `password` and `tokenKey` in every auth collection, and on
   * anything the user has hidden. Measured on the rig's 0.30.0 — see
   * {@link parsePocketbaseSchema}.
   */
  hidden?: boolean;
  /** 0.23+ marks the primary key on the field itself rather than by its name. */
  primaryKey?: boolean;
  /** On a `relation` field: the **id** of the target collection, never its name. */
  collectionId?: string;
  /** On a `relation` field: `1` for a single-valued relation. */
  maxSelect?: number;
}

/**
 * Parse Pocketbase schema from `/api/collections`.
 *
 * ⚠️ **PocketBase renamed `collection.schema` to `collection.fields` in 0.23**, and this
 * function read only the old name — so against any modern PocketBase every collection came
 * back with **zero fields**, silently. Not a degraded result: `col.schema?.map(...)` on an
 * absent property is `undefined`, `|| []` turns it into an empty array, and the collection
 * is still pushed. So the Backend Services panel showed the collection, the Class dropdown
 * listed it, and every field-derived port — the filter schema included — was empty, with no
 * error anywhere. Found by BCN-005 and confirmed against the rig's PocketBase 0.30.0, whose
 * collection payload has `fields` and no `schema` at all.
 *
 * Both names are read, newest first. Supporting the old one costs one `??` and PocketBase
 * 0.22 is a version a user may still be running; refusing to read it would turn a silent
 * empty result into a silent empty result for a different reason.
 *
 * The select-options move is the same story one level down: `options.values` became a
 * flattened `values` in the same release, so `enumValues` reads both or a select field
 * offers no choices.
 *
 * ## BCN-005 schema sync: three more things a live 0.30.0 said and the fixture did not
 *
 * The `schema`→`fields` rename survived two releases because the test fixture only ever
 * carried the old shape, so the parser and its test agreed with each other and with
 * nothing else. Re-auditing the same function against the rig's real payload — rather
 * than against the fixture that had already been wrong once — found three more:
 *
 * 1. ⚠️ **A `relation` field's target was dropped entirely.** `bcn005_articles.author`
 *    arrived as `{type: 'relation', collectionId: 'pbc_1390417582', maxSelect: 1}` and
 *    came out with `relationTarget: undefined` — so on PocketBase, alone of the four
 *    backends, no relation was visible to anything downstream. The target is named by
 *    **collection id**, never by name, which is why resolving it needs the whole
 *    collection list and not one collection.
 * 2. ⚠️ **`hidden` was not propagated**, so `password` and `tokenKey` — both
 *    `hidden: true`, `system: true` on every auth collection — became ordinary ports.
 *    `SchemaField.hidden` is exactly the flag the runtime's `shouldShowField` reads to
 *    skip them.
 * 3. **The primary key marks itself.** 0.23+ carries `primaryKey: true` on the field;
 *    `f.name === 'id'` happened to agree on every collection measured, and is kept as
 *    the fallback for the old shape, which had no such flag.
 *
 * ⚠️ **`col.system` does not mean "not a user collection".** PocketBase's `users`
 * collection is `system: false` with `type: 'auth'`; skipping it would remove the one
 * collection an auth-bound app most needs. It is kept, and (2) is what makes keeping it
 * safe.
 */
export function parsePocketbaseSchema(data: unknown, schema: CachedSchema = emptySchema()): CachedSchema {
  const collections = (Array.isArray(data) ? data : (data as { items?: unknown[] })?.items || []) as Array<{
    id?: string;
    name: string;
    /** 0.23+ */
    fields?: PocketbaseRawField[];
    /** ≤ 0.22 */
    schema?: PocketbaseRawField[];
    system?: boolean;
  }>;

  // A relation field names its target by id, so the whole list has to be indexed
  // before any one collection can be parsed.
  const nameByCollectionId = new Map<string, string>();
  for (const col of collections) {
    if (col.id && col.name) nameByCollectionId.set(col.id, col.name);
  }

  for (const col of collections) {
    if (col.system) continue;

    const rawFields = col.fields ?? col.schema ?? [];

    schema.collections.push({
      name: col.name,
      displayName: col.name,
      fields: rawFields.map((f) => {
        const field: SchemaField = {
          name: f.name,
          displayName: f.name,
          type: f.type,
          nativeType: f.type,
          required: f.required || false,
          // `id` is present in the 0.23+ `fields` array and was absent from the old
          // `schema` array. Marking it is what keeps the primary key from reading as an
          // ordinary editable text column now that it is visible.
          primaryKey: f.primaryKey || f.name === 'id' || undefined,
          enumValues: f.values ?? f.options?.values
        };

        if (f.hidden === true) field.hidden = true;

        if (f.type === 'relation') {
          const targetId = f.collectionId ?? f.options?.collectionId;
          const target = targetId ? nameByCollectionId.get(targetId) : undefined;
          if (target) {
            field.relationTarget = target;
            const maxSelect = f.maxSelect ?? f.options?.maxSelect;
            field.relationType = maxSelect === 1 ? 'many-to-one' : 'many-to-many';
          }
        }

        return field;
      }),
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

/**
 * The class list, from whichever envelope arrived.
 *
 * Exported because {@link parseRelationsResponse} feeds the same list to the contract's
 * `relationsFromParseClasses`: the Parse family's relation metadata *is* its schema
 * response, so unwrapping the envelope twice in two places is exactly the drift this
 * phase keeps finding.
 */
export function parseClassList(data: unknown): ParseRawClass[] {
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

// ============================================================================
// Relation metadata — BCN-005's parsers, given a caller
// ============================================================================

/**
 * Does this backend need a **second** request to describe its relations?
 *
 * ⚠️ **Only Directus does**, and the call site BCN-005 wrote out for this task says
 * otherwise. Its sketch asks for `get('/')` on Supabase and `get('/api/collections')`
 * on PocketBase — but those are the *same URLs* `fetchSchema` has already fetched
 * (`presets.ts` points `endpoints.schema` at `/rest/v1/` and `/api/collections`
 * respectively), so following it literally would double every schema sync's request
 * count and, worse, introduce a window in which the two halves of one sync describe two
 * different states of the backend. Three of the four backends publish their relation
 * metadata **inside** the schema response:
 *
 * | Backend | Schema response | Relations |
 * |---|---|---|
 * | Directus | `GET /fields` | ⚠️ `GET /relations` — a genuinely separate document |
 * | Supabase / PostgREST | `GET /rest/v1/` (OpenAPI) | the same document's `<fk .../>` annotations |
 * | PocketBase | `GET /api/collections` | the same list's `relation` fields |
 * | Parse / NodeGX | `GET /schemas` | the same classes' `Pointer` / `Relation` fields |
 *
 * `custom` has no relation model at all (BCN-005 §3.4) and returns `undefined` rather
 * than an empty array, so "this backend cannot describe relations" and "this backend
 * has none" stay different answers.
 */
export function relationEndpointFor(type: string): string | undefined {
  return type === 'directus' ? '/relations' : undefined;
}

/**
 * PocketBase's default page size for `GET /api/collections`, measured on 0.30.0.
 *
 * ⚠️ **`GET /api/collections` is paginated and the preset never said otherwise.**
 * Measured against the rig:
 *
 * ```
 * /api/collections            -> page 1, perPage 30,  totalItems 12, items 12
 * /api/collections?perPage=5  -> page 1, perPage 5,   totalItems 12, items 5
 * ```
 *
 * The rig has twelve collections, so the sync has never seen the cliff — but any
 * PocketBase project with more than thirty collections syncs the first thirty and drops
 * the rest, silently, with a 200. And it is worse than a truncated list: a relation
 * field names its target by **collection id**, resolved against the list, so a relation
 * pointing at collection thirty-one has an unresolvable target and is dropped too. A
 * project would lose collections *and* relations between collections that did sync,
 * with nothing anywhere reporting a problem.
 *
 * This is the `col.schema` → `col.fields` rename all over again: a request whose answer
 * looks complete because nothing in it says it is not.
 */
const POCKETBASE_COLLECTION_PAGE_SIZE = 500;

/**
 * The schema path to actually request, given the one the backend is configured with.
 *
 * Applied on top of `endpoints.schema` rather than fixed in `presets.ts` because the
 * preset is copied into each `BackendConfig` **when the backend is created** — editing
 * the preset would leave every already-configured PocketBase backend asking the old
 * question forever. A user who has deliberately set their own `perPage` keeps it.
 */
export function schemaRequestPath(type: string, configuredPath: string): string {
  if (type !== 'pocketbase') return configuredPath;
  if (/[?&]perPage=/.test(configuredPath)) return configuredPath;
  return `${configuredPath}${configuredPath.includes('?') ? '&' : '?'}perPage=${POCKETBASE_COLLECTION_PAGE_SIZE}`;
}

/**
 * Relation metadata → the neutral descriptors, for whichever backend this is.
 *
 * `schemaData` is the schema response `parseSchemaResponse` was given; `relationData`
 * is the answer from {@link relationEndpointFor}, when there was one. Every backend
 * except Directus reads the first and ignores the second.
 *
 * The parsers themselves are `@noodl/backend-contract`'s, not copies — BCN-005 tested
 * them against verbatim payloads from all four servers and drove them live, and the one
 * thing missing was a caller. This is the caller. A second implementation here would be
 * the third copy of a rule this phase exists to have exactly one of.
 */
export function parseRelationsResponse(
  type: string,
  schemaData: unknown,
  relationData?: unknown
): RelationDescriptor[] | undefined {
  if (type === 'directus') {
    // `{data: [...]}`, or a bare array if someone configured the endpoint to return one.
    const rows = Array.isArray(relationData)
      ? relationData
      : ((relationData as { data?: unknown[] })?.data as unknown[] | undefined);
    // ⚠️ `undefined`, not `[]`: the request can 403 (relation metadata is admin-only),
    // and "we could not ask" must not be stored as "there are none" — the runtime's
    // fallback is worth more than an empty list.
    if (!Array.isArray(rows)) return undefined;
    return relationsFromDirectus(rows);
  }

  if (type === 'supabase') return relationsFromPostgrestSpec(schemaData as never);

  if (type === 'pocketbase') {
    const items = Array.isArray(schemaData) ? schemaData : (schemaData as { items?: unknown[] })?.items;
    return relationsFromPocketBase((items ?? []) as never);
  }

  if (type === 'parse' || type === 'nodegx') return relationsFromParseClasses(parseClassList(schemaData) as never);

  return undefined;
}

/**
 * Store the descriptors on the schema, and back-fill the fields they describe.
 *
 * Two separate jobs, and the split is the deviation worth reading:
 *
 * - **The descriptors are stored whole**, on `schema.relations`, because they carry
 *   facts no `SchemaField` has anywhere to put — the junction collection and its two
 *   columns, whether a duplicate write is idempotent, Directus's two-hop `readPath`.
 *   That is what a running app needs and what it cannot ask for itself.
 * - **The field list is only ever *enriched*, never invented.** Where the schema
 *   already has a field of that name, `relationTarget` and `relationType` are filled
 *   in; where it does not, nothing is added.
 *
 * ⚠️ The second half is deliberate and it costs something. PostgREST names a
 * many-to-many after the target table (`bcn005_tags`) and there is no such column, so
 * that relation appears in `schema.relations` and **not** in `bcn005_articles.fields`.
 * Synthesising the column would put a writable port on the record nodes for something
 * that is not a column, and a write to it would 400 — the plausible-wrong-value failure
 * class this phase exists to remove. A relation that is described but has no field is
 * still reachable by every relation *method*; a field that is not a column is reachable
 * by everything and works nowhere.
 *
 * What enrichment does buy, measured against the rig:
 *
 * - Directus's M2M alias `tags` arrives from `GET /fields` as `{type: 'alias',
 *   schema: null}` with no relation information at all — an ordinary-looking port of
 *   type `alias`. It becomes `many-to-many → bcn005_tags`, which is what makes the
 *   runtime's `skipRelations` and one-hop traversal rules apply to it.
 * - Directus's reverse one-to-many (`bcn005_authors.articles`) has no field either, so
 *   it is stored and not enriched — see above.
 */
export function applyRelationsToSchema(schema: CachedSchema, relations: RelationDescriptor[] | undefined): CachedSchema {
  if (!relations) return schema;

  schema.relations = relations;

  for (const relation of relations) {
    const collection = schema.collections.find((candidate) => candidate.name === relation.collection);
    if (!collection) continue;

    const field = collection.fields.find((candidate) => candidate.name === relation.field);
    if (!field) continue;

    // Never overwrite a target the schema response itself established — a foreign key
    // Directus and PostgREST both report on the column is the more specific fact, and
    // the two agree wherever both exist.
    if (!field.relationTarget) field.relationTarget = relation.target;
    if (!field.relationType) field.relationType = relationTypeOf(relation);
  }

  return schema;
}

/**
 * A descriptor's cardinality as the four-value `SchemaField.relationType`.
 *
 * ⚠️ `RelationCardinality` has two values and `relationType` has four, so the missing
 * bit comes from **`write.kind`**, not from the cardinality: a to-many whose write is a
 * plain foreign key is the *reverse* of a many-to-one — a one-to-many — while a
 * junction, an array field or a Parse `Relation` op is a genuine many-to-many. Reading
 * `cardinality` alone would label every reverse one-to-many `many-to-many`, which is
 * the shape of fact that later reads as "NodeGX thinks this needs a junction table".
 */
function relationTypeOf(relation: RelationDescriptor): SchemaField['relationType'] {
  if (relation.cardinality === 'one') return 'many-to-one';
  return relation.write.kind === 'foreignKey' ? 'one-to-many' : 'many-to-many';
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
