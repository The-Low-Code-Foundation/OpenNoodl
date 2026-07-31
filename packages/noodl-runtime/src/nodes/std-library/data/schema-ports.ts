/**
 * The schema-driven port generator.
 *
 * A data node's shape is the backend's shape: the collection dropdown, one input port per
 * writable column, an enum dropdown where the column is an enum, an Include toggle per
 * traversable relation. That machinery was written four times over inside the
 * `noodl.byob.*` nodes; BCN-004 step 4 moves it here so the Parse-family Record nodes can
 * build their ports the same way, against every backend the project can reach.
 *
 * **It is backend-agnostic on purpose.** It consumes a *normalised* schema — the
 * `SchemaCollection[]` the editor cached — and knows nothing about HTTP, endpoints, or
 * response envelopes. Reaching a backend is `RestDataAdapter`'s job (BCN-004 steps 1–2);
 * turning what came back into `SchemaCollection[]` is the editor's `schemaParsers.ts` for
 * the REST wires and `collectionsFromParseClasses` below for the Parse wire.
 *
 * Two fixes RUN-003 paid for live here and must not be undone:
 *
 * 1. **Both field shapes.** `shouldShowField` / `getEnhancedFieldType` accept the *cached*
 *    `SchemaField` (parsed `hidden` / `enumValues`, no `meta`) **and** a raw Directus
 *    `/fields` entry (`meta.hidden`, `meta.options.choices`). The cached shape is the one
 *    the nodes actually receive; matching only `meta` left enum dropdowns and hidden-field
 *    filtering silently dead in the real editor flow while every unit test passed.
 * 2. **No static port re-pushed as a dynamic one.** `sendSchemaPorts` drops any generated
 *    port that collides with a name the node already declares statically — `getPorts()`
 *    once listed every output twice because `updatePorts` pushed them again. The guard is
 *    structural rather than a comment, so the next node to adopt this generator inherits
 *    it; the generated node catalog is the end-to-end check.
 *
 * @module noodl-runtime
 */

import type { GraphModelLike, NodeContextLike, RuntimeDiscoveredPort } from '@noodl/types';

import type {
  BackendServiceEntry,
  BackendServicesMetaData,
  EnhancedFieldType,
  ParseClassSchema,
  ParseFieldSchema,
  RelationField,
  SchemaCollection,
  SchemaField
} from './schema-types';

// ---------------------------------------------------------------------------
// Field-level helpers (moved verbatim from byob-utils.ts, which now re-exports
// them — see the RUN-003 note in the module docblock)
// ---------------------------------------------------------------------------

/**
 * Check if a collection is a Directus system collection
 * @param {string} collection - Collection name
 * @returns {boolean} True if it's a system collection
 */
export function isSystemCollection(collection: string | undefined): boolean {
  return collection && collection.startsWith('directus_');
}

/**
 * Filter collections based on API path mode
 * @param {Array} collections - All collections from schema
 * @param {string} apiPathMode - 'items' or 'system'
 * @returns {Array} Filtered collections
 */
export function filterCollectionsByMode(collections: SchemaCollection[], apiPathMode: string): SchemaCollection[] {
  if (!apiPathMode || apiPathMode === 'items') {
    // Items mode: exclude system tables
    return collections.filter((c) => !isSystemCollection(c.name));
  } else {
    // System mode: only system tables
    return collections.filter((c) => isSystemCollection(c.name));
  }
}

/**
 * Check if a field should be shown in the property editor
 * Filters out presentation elements, hidden fields, and readonly meta fields
 *
 * Accepts BOTH field shapes: the cached SchemaField the editor stores in
 * backendServices metadata (which carries a parsed `hidden` flag and no `meta`),
 * and a raw Directus /fields entry (`meta.hidden` / presentation-* interface).
 * The cached shape is what the data nodes actually receive — matching only
 * `meta` left hidden-field filtering dead in the real flow (RUN-003).
 * @param {Object} field - Field schema (cached SchemaField or raw Directus field)
 * @returns {boolean} True if field should be shown
 */
export function shouldShowField(field: SchemaField | undefined): boolean {
  if (!field || !field.name) return false;

  // Cached SchemaField shape: hidden resolved at parse time
  if (field.hidden === true) {
    return false;
  }

  // Raw Directus shape: skip presentation interfaces (dividers, notices, etc.)
  if (field.meta?.interface && field.meta.interface.startsWith('presentation-')) {
    return false;
  }

  // Raw Directus shape: skip explicitly hidden fields
  if (field.meta?.hidden === true) {
    return false;
  }

  return true;
}

/**
 * Get enhanced field type for property editor
 * Maps schema field types to Noodl port types with additional metadata
 *
 * Accepts BOTH field shapes (see shouldShowField): cached SchemaField
 * (`enumValues: string[]`) and raw Directus (`meta.options.choices`). The
 * cached shape is what the nodes receive from backendServices metadata —
 * matching only `meta` left enum dropdowns dead in the real flow (RUN-003).
 * @param {Object} field - Field schema (cached SchemaField or raw Directus field)
 * @returns {Object} Port type definition { type, options, placeholder }
 */
export function getEnhancedFieldType(field: SchemaField): EnhancedFieldType {
  const result: EnhancedFieldType = {
    type: 'string',
    options: null,
    placeholder: null
  };

  // Cached SchemaField shape: enum values resolved at parse time
  if (Array.isArray(field.enumValues) && field.enumValues.length > 0) {
    result.type = {
      name: 'enum',
      enums: field.enumValues.map((value) => ({ label: value, value })),
      allowEditOnly: false
    };
    return result;
  }

  // Raw Directus shape: enum/select fields via meta
  if (field.meta?.interface === 'select-dropdown' || field.meta?.interface === 'select-dropdown-m2o') {
    const choices = field.meta?.options?.choices;
    if (choices && Array.isArray(choices)) {
      result.type = {
        name: 'enum',
        enums: choices.map((choice) => ({
          label: choice.text || choice.value,
          value: choice.value
        })),
        allowEditOnly: false
      };
      return result;
    }
  }

  // Map basic field types.
  //
  // `number` joined the numeric list in BCN-004 step 4, and it is a fix rather than a
  // tidy-up: the list was written against Directus' type names, where the neutral word
  // `number` never appears. Supabase's OpenAPI spells a numeric column `number` or
  // `integer`, and the Parse map below spells one `number` too — so every such column
  // was falling through to a **string** port. Directus is unaffected (it says `integer`,
  // `bigInteger`, `float`, `decimal`).
  //
  // ⚠️ The same class of gap remains for PocketBase, whose type names are `text`,
  // `bool`, `json`, `select`, `relation`, `file` — `bool` is not `boolean`, so a
  // PocketBase checkbox still gets a string port. Left alone deliberately: it wants a
  // per-backend type map with a live PocketBase to check it against, which is BCN-004's
  // live pass (step 6), not a guess made here.
  if (
    field.type === 'integer' ||
    field.type === 'bigInteger' ||
    field.type === 'float' ||
    field.type === 'decimal' ||
    field.type === 'number'
  ) {
    result.type = 'number';
  } else if (field.type === 'boolean') {
    result.type = 'boolean';
  } else if (field.type === 'json' || field.type === 'array') {
    result.type = 'object';
  } else if (field.type === 'dateTime' || field.type === 'timestamp') {
    result.type = 'string';
    result.placeholder = 'YYYY-MM-DDTHH:mm:ss.sssZ';
  } else if (field.type === 'date') {
    result.type = 'string';
    result.placeholder = 'YYYY-MM-DD';
  } else if (field.type === 'time') {
    result.type = 'string';
    result.placeholder = 'HH:mm:ss';
  } else if (field.type === 'uuid') {
    result.type = 'string';
    result.placeholder = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
  } else {
    result.type = 'string';
  }

  return result;
}

/**
 * Relation types that can be traversed with a dotted field path (author.name).
 * One-to-many / many-to-many point at record SETS — a dotted path into them
 * means "any related record matches" in Directus, but the schema parsers only
 * recover M2O/O2O today (see schemaParsers.ts), so that is what we expand.
 */
export const TRAVERSABLE_RELATION_TYPES: string[] = ['many-to-one', 'one-to-one'];

/**
 * Get the traversable relation fields of a collection: visible fields whose
 * relationTarget resolves to a collection we have schema for.
 * @param {Object} collection - SchemaCollection (cached shape)
 * @param {Array} allCollections - All SchemaCollections in the backend schema
 * @returns {Array} [{ field, targetCollection }]
 */
export function getRelationFields(collection: SchemaCollection, allCollections: SchemaCollection[]): RelationField[] {
  if (!collection || !Array.isArray(collection.fields)) return [];

  const result: RelationField[] = [];
  for (const field of collection.fields) {
    if (!shouldShowField(field)) continue;
    if (!field.relationTarget) continue;
    if (field.relationType && !TRAVERSABLE_RELATION_TYPES.includes(field.relationType)) continue;

    const targetCollection = (allCollections || []).find((c) => c.name === field.relationTarget);
    if (!targetCollection) continue;

    result.push({ field, targetCollection });
  }
  return result;
}

/**
 * Expand a collection's M2O/O2O relations into dotted pseudo-fields, one hop
 * deep: articles.author (FK → authors) yields author.name, author.email, …
 * with type/enumValues carried over from the target field so the filter
 * builder picks the right operators and value editors.
 *
 * The returned fields are additive — callers append them to the collection's
 * own fields. The FK field itself stays in the list (filtering on the raw id
 * is still valid). Hidden fields are skipped on both sides; target fields
 * that are themselves relations are not expanded (no depth-2 paths).
 * @param {Object} collection - SchemaCollection (cached shape)
 * @param {Array} allCollections - All SchemaCollections in the backend schema
 * @returns {Array} Pseudo SchemaFields with dotted names and relationPath: true
 */
export function expandRelationFields(
  collection: SchemaCollection,
  allCollections: SchemaCollection[]
): SchemaField[] {
  const expanded: SchemaField[] = [];

  for (const { field, targetCollection } of getRelationFields(collection, allCollections)) {
    const relationLabel = field.displayName || field.name;

    for (const targetField of targetCollection.fields || []) {
      if (!shouldShowField(targetField)) continue;
      // No depth-2 traversal: a relation inside the target stays a scalar FK
      if (targetField.relationTarget) continue;

      expanded.push({
        name: `${field.name}.${targetField.name}`,
        displayName: `${relationLabel} → ${targetField.displayName || targetField.name}`,
        type: targetField.type,
        nativeType: targetField.nativeType,
        required: false,
        enumValues: targetField.enumValues,
        relationPath: true
      });
    }
  }

  return expanded;
}

// ---------------------------------------------------------------------------
// The Parse wire's schema, normalised
// ---------------------------------------------------------------------------

/**
 * Parse's own type names, mapped onto the neutral field types the rest of this
 * module already speaks (`getEnhancedFieldType` reads `field.type`).
 *
 * ⚠️ **This table has a twin** in the editor's `schemaParsers.ts::parseParseSchema`,
 * which turns a live `GET /schemas` response into the cached schema. The runtime
 * cannot import the editor and the editor cannot import the runtime, so the twin is
 * unavoidable; both sides are tested against the same fixture shape so a drift shows
 * up as a failing expectation rather than as a wrong port type. If a third copy is
 * ever needed, that is the signal to promote it into `@noodl/backend-contract`.
 */
export const PARSE_TYPE_MAP: Record<string, string> = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Date: 'dateTime',
  Object: 'json',
  Array: 'array',
  GeoPoint: 'json',
  Polygon: 'json',
  Bytes: 'string',
  // A Parse File is `{__type: 'File', name, url}` on the wire — an object port until
  // BCN-007 gives files a port type of their own.
  File: 'json',
  // A Pointer is a foreign key; its own value is the target's objectId.
  Pointer: 'string',
  // A Relation is a record SET, not a value. It keeps a type of its own so a caller
  // can tell it apart (the Record family offers it as a `relationProperty` choice
  // rather than as a value port).
  Relation: 'relation'
};

/**
 * The Parse fields no user writes: the server owns all four.
 *
 * Exported rather than applied here because it is a *write-path* rule — the same
 * fields are perfectly legitimate to filter or sort on, so hiding them from the
 * schema outright would be wrong. Create/update port builders pass it as
 * `readOnlyFields`.
 */
export const PARSE_READONLY_FIELDS: string[] = ['objectId', 'createdAt', 'updatedAt', 'ACL'];

/**
 * The Parse class list, whichever of its three envelopes it arrived in:
 * `{results}` (Parse `GET /schemas`), `{tables}` (our own backend's
 * `GET /api/_schema`), or a bare array (the legacy `dbCollections` metadata).
 */
function parseClassList(data: unknown): ParseClassSchema[] {
  if (Array.isArray(data)) return data as ParseClassSchema[];
  const results = (data as { results?: unknown })?.results;
  if (Array.isArray(results)) return results as ParseClassSchema[];
  const tables = (data as { tables?: unknown })?.tables;
  if (Array.isArray(tables)) return tables as ParseClassSchema[];
  return [];
}

/**
 * The fields of one Parse class, whichever of its three spellings it used.
 *
 * `fields` and `schema.properties` are maps keyed by field name; `columns` is an
 * array carrying the name inside each entry. All three hold the same Parse type
 * names — our backend's SchemaManager stores `String`/`Number`/`Pointer` with a
 * `targetClass`, exactly as Parse reports them.
 */
function parseClassFields(cls: ParseClassSchema): Record<string, ParseFieldSchema> {
  if (cls.fields) return cls.fields;
  if (cls.schema?.properties) return cls.schema.properties;
  if (Array.isArray(cls.columns)) {
    const map: Record<string, ParseFieldSchema> = {};
    for (const column of cls.columns) {
      if (column && column.name) map[column.name] = column;
    }
    return map;
  }
  return {};
}

/**
 * Normalise one Parse field onto the neutral `SchemaField`.
 * `Pointer` and `Relation` carry their target so relation traversal and the
 * Record family's relation dropdown both find it.
 */
export function parseFieldToSchemaField(name: string, field: ParseFieldSchema | undefined): SchemaField {
  const parseType = field?.type;
  const normalised: SchemaField = {
    name,
    displayName: name,
    type: PARSE_TYPE_MAP[parseType] || 'string',
    nativeType: parseType,
    required: field?.required === true
  };

  if (parseType === 'Pointer') {
    normalised.relationTarget = field?.targetClass;
    normalised.relationType = 'many-to-one';
  } else if (parseType === 'Relation') {
    normalised.relationTarget = field?.targetClass;
    normalised.relationType = 'many-to-many';
  }

  if (name === 'objectId') normalised.primaryKey = true;
  // The ACL is access control, not data — no port has ever been useful for it.
  if (name === 'ACL') normalised.hidden = true;

  return normalised;
}

/**
 * Turn a Parse `GET /schemas` response — or the legacy `dbCollections` project
 * metadata, which is the same objects under different keys — into the normalised
 * collections every port builder below consumes.
 *
 * This is the fourth schema shape, beside the editor's Directus / PostgREST /
 * PocketBase parsers, and the reason the generator can now serve a Parse or NodeGX
 * backend rather than only the three REST ones.
 */
export function collectionsFromParseClasses(data: unknown): SchemaCollection[] {
  return parseClassList(data)
    .map((cls) => {
      const name = cls.className || cls.name;
      if (!name) return null;
      const fields = parseClassFields(cls);
      return {
        name,
        displayName: name,
        primaryKey: 'objectId',
        isSystem: name.startsWith('_'),
        fields: Object.keys(fields).map((key) => parseFieldToSchemaField(key, fields[key]))
      } as SchemaCollection;
    })
    .filter((c): c is SchemaCollection => c !== null);
}

/** Backend types that speak the Parse wire, and so introspect through `/schemas`. */
export const PARSE_WIRE_BACKEND_TYPES: string[] = ['parse', 'nodegx'];

// ---------------------------------------------------------------------------
// Context resolution — which backend, which collections, which collection
// ---------------------------------------------------------------------------

/** What a node's port generator needs to know before it can build a single port. */
export interface SchemaPortContext {
  /** Every backend the project has configured, for the picker. */
  backends: BackendServiceEntry[];
  activeBackendId?: string;
  selectedBackend?: BackendServiceEntry;
  /** `directus` / `supabase` / `pocketbase` / `parse` / `nodegx` / `custom`. */
  backendType?: string;
  /** The selected backend's schema, normalised. */
  collections: SchemaCollection[];
  /** The collection the node is pointed at, as the parameter spells it. */
  collectionName?: string;
  selectedCollection?: SchemaCollection;
  /** Directus' items-vs-system split; `'items'` everywhere else. */
  apiPathMode: string;
  /** Where `collections` came from — useful in tests and when diagnosing an empty dropdown. */
  source: 'backendServices' | 'dbCollections' | 'none';
}

export interface ResolveSchemaPortContextOptions {
  graphModel: GraphModelLike;
  parameters: Record<string, unknown>;
  /** The parameter naming the backend. Defaults to `backendId`. */
  backendIdParam?: string;
  /** The parameter naming the collection. `collection` for BYOB, `collectionName` for the Record family. */
  collectionParam?: string;
}

/**
 * Read the project metadata and work out what the node is pointed at.
 *
 * `backendServices` is the primary source. A Parse-wire backend that has not been
 * introspected through Backend Services falls back to the project's legacy
 * `dbCollections` / `systemCollections` metadata — the same classes, cached by the
 * older path the Record nodes read today. The fallback is gated on the backend's
 * *type* so a Directus backend with an empty cache can never pick up Parse classes.
 */
export function resolveSchemaPortContext(options: ResolveSchemaPortContextOptions): SchemaPortContext {
  const { graphModel, parameters } = options;
  const backendIdParam = options.backendIdParam || 'backendId';
  const collectionParam = options.collectionParam || 'collection';

  const backendServices = (graphModel.getMetaData('backendServices') as BackendServicesMetaData) || {
    backends: []
  };
  const backends = backendServices.backends || [];

  const backendIdParameter = parameters[backendIdParam];
  const selectedBackendId =
    backendIdParameter === '_active_' || !backendIdParameter ? backendServices.activeBackendId : backendIdParameter;
  const selectedBackend = backends.find((b) => b.id === selectedBackendId);

  let collections = selectedBackend?.schema?.collections || [];
  let source: SchemaPortContext['source'] = collections.length > 0 ? 'backendServices' : 'none';

  const backendType = selectedBackend?.type;
  if (collections.length === 0 && (!backendType || PARSE_WIRE_BACKEND_TYPES.includes(backendType))) {
    // The Parse wire's own cache. `dbCollections` holds the user classes and
    // `systemCollections` the `_User`/`_Role` ones; the generator wants both, and
    // `isSystem` on each collection is what tells them apart afterwards.
    const dbCollections = graphModel.getMetaData('dbCollections');
    const systemCollections = graphModel.getMetaData('systemCollections');
    const parseCollections = collectionsFromParseClasses(dbCollections).concat(
      collectionsFromParseClasses(systemCollections)
    );
    if (parseCollections.length > 0) {
      collections = parseCollections;
      source = 'dbCollections';
    }
  }

  const collectionName = parameters[collectionParam] as string | undefined;
  const isSystemTable = isSystemCollection(collectionName);
  const apiPathMode = (parameters.apiPathMode as string) || (isSystemTable ? 'system' : 'items');

  return {
    backends,
    activeBackendId: backendServices.activeBackendId,
    selectedBackend,
    backendType,
    collections,
    collectionName,
    selectedCollection: collections.find((c) => c.name === collectionName),
    apiPathMode,
    source
  };
}

// ---------------------------------------------------------------------------
// Port builders — each returns the ports it owns, so a node composes what it needs
// ---------------------------------------------------------------------------

export interface BackendPickerOptions {
  name?: string;
  displayName?: string;
  group?: string;
  /**
   * Hide the picker when the project has exactly one backend (phase decision for
   * the Record family, BCN-004 step 5). Off by default: the BYOB nodes have always
   * shown it, and changing that here would change ports the catalog records.
   */
  hideWhenSingleBackend?: boolean;
}

/** The Backend dropdown: `Active Backend` plus one entry per configured backend. */
export function backendPickerPorts(
  ctx: SchemaPortContext,
  options: BackendPickerOptions = {}
): RuntimeDiscoveredPort[] {
  if (options.hideWhenSingleBackend && ctx.backends.length <= 1) return [];

  const backendEnums = [{ label: 'Active Backend', value: '_active_' }];
  ctx.backends.forEach((b) => {
    backendEnums.push({ label: b.name, value: b.id });
  });

  return [
    {
      name: options.name || 'backendId',
      displayName: options.displayName || 'Backend',
      type: {
        name: 'enum',
        enums: backendEnums,
        allowEditOnly: true
      },
      default: '_active_',
      plug: 'input',
      group: options.group || 'Backend'
    }
  ];
}

/**
 * Directus' items-vs-system path switch.
 *
 * Only Directus has this split, but the port is emitted whenever a caller asks for
 * it rather than gated on the resolved backend type: the port a node offers must not
 * depend on which backend happens to be selected at catalog-generation time, when
 * there is no project metadata at all.
 */
export function apiPathModePorts(ctx: SchemaPortContext, options: { group?: string } = {}): RuntimeDiscoveredPort[] {
  const isSystemTable = isSystemCollection(ctx.collectionName);

  return [
    {
      name: 'apiPathMode',
      displayName: 'API Path',
      type: {
        name: 'enum',
        enums: [
          { label: 'Items (User Collections)', value: 'items' },
          { label: 'System (Directus Tables)', value: 'system' }
        ],
        allowEditOnly: true
      },
      default: isSystemTable ? 'system' : 'items',
      plug: 'input',
      group: options.group || 'Configuration'
    }
  ];
}

export interface CollectionPortOptions {
  name?: string;
  displayName?: string;
  group?: string;
  /** The leading `(Select collection)` entry. Pass `null` to omit it. */
  placeholderLabel?: string | null;
  /** Apply the Directus items/system split. On by default. */
  filterByApiPathMode?: boolean;
  /** Entries prepended to the dropdown — the Record family's `User`/`Role`, say. */
  extraEnums?: { label: string; value: string }[];
}

/** The Collection dropdown, built from the introspected schema. */
export function collectionPorts(
  ctx: SchemaPortContext,
  options: CollectionPortOptions = {}
): RuntimeDiscoveredPort[] {
  const filtered =
    options.filterByApiPathMode === false
      ? ctx.collections
      : filterCollectionsByMode(ctx.collections, ctx.apiPathMode);

  const enums: { label: string; value: string }[] = [];
  if (options.placeholderLabel !== null) {
    enums.push({ label: options.placeholderLabel || '(Select collection)', value: '' });
  }
  if (options.extraEnums) enums.push(...options.extraEnums);
  filtered.forEach((c) => {
    enums.push({ label: c.displayName || c.name, value: c.name });
  });

  return [
    {
      name: options.name || 'collection',
      displayName: options.displayName || 'Collection',
      type: {
        name: 'enum',
        enums,
        allowEditOnly: true
      },
      plug: 'input',
      group: options.group || 'Configuration'
    }
  ];
}

export interface FieldPortOptions {
  /** Prefixed onto the port name: `field_` for BYOB, `prop-` for the Record family. */
  prefix?: string;
  group?: string;
  /** Columns the server owns — skipped entirely. */
  readOnlyFields?: string[];
  /** Skip relation fields (a Pointer/Relation is not a scalar the user types). */
  skipRelations?: boolean;
}

/**
 * One input port per writable column of the selected collection.
 *
 * This is where the two RUN-003 fixes earn their keep: `shouldShowField` skips hidden
 * and presentation-only columns **in either field shape**, and `getEnhancedFieldType`
 * turns an enum column into a dropdown **in either field shape**.
 */
export function fieldPorts(ctx: SchemaPortContext, options: FieldPortOptions = {}): RuntimeDiscoveredPort[] {
  const prefix = options.prefix === undefined ? 'field_' : options.prefix;
  const readOnlyFields = options.readOnlyFields || [];
  const ports: RuntimeDiscoveredPort[] = [];

  for (const field of ctx.selectedCollection?.fields || []) {
    if (readOnlyFields.includes(field.name)) continue;
    if (!shouldShowField(field)) continue;
    if (options.skipRelations && field.relationType) continue;

    const fieldType = getEnhancedFieldType(field);

    ports.push({
      name: `${prefix}${field.name}`,
      displayName: field.displayName || field.name,
      type: fieldType.type,
      plug: 'input',
      group: options.group || 'Fields'
    });
  }

  return ports;
}

/**
 * One Include toggle per traversable relation — when on, the request expands
 * the relation so records carry the related record as a nested object instead
 * of a raw foreign key.
 */
export function relationIncludePorts(
  ctx: SchemaPortContext,
  options: { group?: string; prefix?: string } = {}
): RuntimeDiscoveredPort[] {
  if (!ctx.selectedCollection) return [];
  const prefix = options.prefix === undefined ? 'include_' : options.prefix;

  return getRelationFields(ctx.selectedCollection, ctx.collections).map(({ field, targetCollection }) => ({
    name: `${prefix}${field.name}`,
    displayName: `Include ${field.displayName || field.name}`,
    type: 'boolean',
    default: false,
    plug: 'input',
    group: options.group || 'Related Data',
    tooltip: `Fetch the related ${targetCollection.displayName || targetCollection.name} record as a nested object`
  }));
}

/**
 * The fields a filter or a sort may name: the collection's own, plus the dotted
 * one-hop relation paths (`author.name`).
 */
export function getFilterFields(ctx: SchemaPortContext): SchemaField[] {
  if (!ctx.selectedCollection) return [];
  return (ctx.selectedCollection.fields || []).concat(
    expandRelationFields(ctx.selectedCollection, ctx.collections)
  );
}

// ---------------------------------------------------------------------------
// Sending — where the doubled-port fix lives
// ---------------------------------------------------------------------------

/** The names a node declares statically, so generated ports cannot collide with them. */
export interface StaticPortNames {
  inputs?: string[];
  outputs?: string[];
}

export interface SendSchemaPortsOptions {
  staticPorts?: StaticPortNames;
}

/**
 * Drop generated ports that would duplicate something.
 *
 * Two ways a port doubles, and the second one shipped:
 *
 * - the same generated port pushed twice (two builders both claiming a name);
 * - a port the node already declares in its static `inputs`/`outputs`. `updatePorts`
 *   once re-pushed every static output as a dynamic port, so `getPorts()` listed each
 *   output twice — fixed in RUN-003 slice 8 by a comment saying "do not do this".
 *   A comment does not travel; this does.
 *
 * Kept as a pure function so the guard is unit-testable without an editor connection.
 */
export function dedupeSchemaPorts(
  ports: RuntimeDiscoveredPort[],
  staticPorts?: StaticPortNames
): RuntimeDiscoveredPort[] {
  const staticInputs = new Set(staticPorts?.inputs || []);
  const staticOutputs = new Set(staticPorts?.outputs || []);
  const seen = new Set<string>();
  const result: RuntimeDiscoveredPort[] = [];

  for (const port of ports) {
    if (!port || !port.name) continue;

    const isStatic = port.plug === 'output' ? staticOutputs.has(port.name) : staticInputs.has(port.name);
    if (isStatic) {
      console.warn(
        `[Schema Ports] Dropping dynamic port "${port.name}" (${port.plug}) — the node already declares it statically, ` +
          'and pushing it again lists it twice in getPorts().'
      );
      continue;
    }

    const key = `${port.plug}:${port.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push(port);
  }

  return result;
}

/**
 * Announce the generated ports to the editor. The one place a schema-driven node
 * calls `sendDynamicPorts`, so the de-duplication above cannot be skipped.
 */
export function sendSchemaPorts(
  editorConnection: NodeContextLike['editorConnection'],
  nodeId: string,
  ports: RuntimeDiscoveredPort[],
  options: SendSchemaPortsOptions = {}
): RuntimeDiscoveredPort[] {
  const deduped = dedupeSchemaPorts(ports, options.staticPorts);
  editorConnection.sendDynamicPorts(nodeId, deduped);
  return deduped;
}

/**
 * The names a node definition declares statically, ready for `sendSchemaPorts`.
 * Derived from the definition rather than hand-listed so a port added later is
 * covered without anyone remembering to update a list.
 */
export function staticPortNames(nodeDefinition: {
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}): StaticPortNames {
  return {
    inputs: Object.keys(nodeDefinition.inputs || {}),
    outputs: Object.keys(nodeDefinition.outputs || {})
  };
}
