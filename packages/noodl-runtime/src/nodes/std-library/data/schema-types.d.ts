/**
 * The schema vocabulary the **schema-driven port generator** speaks.
 *
 * These shapes arrive in the runtime through project metadata: the editor introspects a
 * backend, caches a normalised schema, and the data nodes build their ports from what it
 * cached. They were declared in `byob-types.d.ts` when only the five `noodl.byob.*` nodes
 * used them; BCN-004 step 4 moves the generator to a shared home that the Parse-family
 * record nodes will use as well, so the vocabulary moves with it and `byob-types.d.ts`
 * re-exports what its own nodes still name.
 *
 * **They are a second description of an existing contract.** The authoritative one is
 * `noodl-editor/src/editor/src/models/BackendServices/types.ts`, which is what *writes*
 * this metadata. The runtime cannot import it — nothing in `@noodl/runtime` may depend on
 * the editor — and it is not node-definition API, so it does not belong in `@noodl/types`
 * either. Declared here, deliberately narrow: only the members the nodes actually read,
 * so a change on the editor side shows up as a missing property rather than as silence.
 * (There is a *third* copy in the editor's own `ByobFilterBuilder/types.ts`.)
 *
 * A note on `SchemaField`, because the port generator turns on it: the nodes see the
 * *cached* shape, with `hidden` and `enumValues` already resolved at parse time. The raw
 * Directus `/fields` shape — `meta.hidden`, `meta.options.choices` — reaches them only when
 * something feeds a live introspection response straight through. Both are matched, and
 * RUN-003 found that matching only `meta` had left hidden-field filtering and enum
 * dropdowns dead in the real flow while every unit test passed.
 */

/** One column. See the note above about the cached vs raw shapes. */
export interface SchemaField {
  name: string;
  displayName?: string;
  type?: string;
  nativeType?: string;
  required?: boolean;
  primaryKey?: boolean;
  /** Resolved at parse time in the cached shape. */
  enumValues?: string[];
  relationTarget?: string;
  relationType?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  /** Resolved at parse time in the cached shape; `meta.hidden` in the raw one. */
  hidden?: boolean;
  /** Set by `expandRelationFields` on the dotted pseudo-fields it synthesises. */
  relationPath?: boolean;
  /** The raw Directus shape, present only when an introspection response is passed through. */
  meta?: {
    interface?: string;
    hidden?: boolean;
    options?: { choices?: { text?: string; value: string }[] };
  };
}

/** One table. */
export interface SchemaCollection {
  name: string;
  displayName?: string;
  fields?: SchemaField[];
  primaryKey?: string;
  isSystem?: boolean;
}

/** One backend as stored in the `backendServices` metadata. */
export interface BackendServiceEntry {
  id: string;
  name?: string;
  type?: string;
  url: string;
  auth?: { publicToken?: string; [extra: string]: unknown };
  endpoints?: Record<string, unknown>;
  schema?: { collections?: SchemaCollection[] };
  [extra: string]: unknown;
}

/** The project metadata the editor publishes under `backendServices`. */
export interface BackendServicesMetaData {
  backends?: BackendServiceEntry[];
  activeBackendId?: string;
  /**
   * The convergence marker — BCN-009 step 2.
   *
   * Absent (or `1`) means **legacy**: `cloudservices` binds the record/auth/file nodes and
   * `activeBackendId` binds the BYOB ones, two independent selections. `2` means the editor
   * has converged them and `activeBackendId` is the project's single answer, which may be
   * the literal `'_endpoint_'`.
   *
   * ⚠️ The marker is required rather than decorative, and this is the case that makes it so:
   * legacy and converged metadata are **byte-identical** when a project has an endpoint and
   * `activeBackendId: 'backend_x'`, and the two readings are opposite. Legacy means "record
   * nodes use the endpoint, BYOB nodes use backend_x"; converged means "everything uses
   * backend_x". Reading the converged meaning off legacy bytes moves every Record node in
   * the project.
   */
  version?: number;
}

/** A port type as `getEnhancedFieldType` describes it — a name, or an enum spec. */
export type EnhancedPortType =
  | string
  | { name: string; enums?: { label: string; value: string }[]; [k: string]: unknown };

/** What `getEnhancedFieldType` returns for one field. */
export interface EnhancedFieldType {
  type: EnhancedPortType;
  options: unknown;
  placeholder: string | null;
}

/** One traversable relation, as `getRelationFields` reports it. */
export interface RelationField {
  field: SchemaField;
  targetCollection: SchemaCollection;
}

/**
 * One field of a Parse class, in either of the two shapes the Parse wire hands us —
 * they are the same object under `fields` (`GET /schemas`) and under `schema.properties`
 * (the legacy `dbCollections` project metadata the Record nodes read today).
 */
export interface ParseFieldSchema {
  /** Parse's own type name: `String`, `Number`, `Date`, `Pointer`, `Relation`, … */
  type?: string;
  /** Set on `Pointer` and `Relation` — the class the field points at. */
  targetClass?: string;
  required?: boolean;
  defaultValue?: unknown;
  [extra: string]: unknown;
}

/**
 * One Parse-typed class, in any of the three shapes it reaches us in.
 *
 * | Source | Envelope | Class | Fields |
 * |---|---|---|---|
 * | Parse `GET /schemas` | `{results}` | `className` | `fields` map |
 * | legacy `dbCollections` metadata | bare array | `name` | `schema.properties` map |
 * | our backend `GET /api/_schema` | `{tables}` | `name` | `columns` array |
 *
 * All three are accepted deliberately. The exact bug class RUN-003 paid for was a
 * utility that understood only one of two live shapes; the Parse side has three, and
 * the third was found by reading `nodegx-backend`'s routes rather than by trusting the
 * preset — which points `nodegx`'s schema endpoint at `/schemas`, a route
 * `parse-wire.ts` says in its own header it does **not** implement.
 */
export interface ParseClassSchema {
  /** `GET /schemas` spelling. */
  className?: string;
  /** `dbCollections` metadata and `/api/_schema` spelling. */
  name?: string;
  /** `GET /schemas` spelling. */
  fields?: Record<string, ParseFieldSchema>;
  /** `dbCollections` metadata spelling. */
  schema?: { properties?: Record<string, ParseFieldSchema> };
  /** `GET /api/_schema` spelling — the name rides inside each entry. */
  columns?: ({ name?: string } & ParseFieldSchema)[];
}
