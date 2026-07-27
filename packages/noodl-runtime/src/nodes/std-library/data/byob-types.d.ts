/**
 * The vocabulary the BYOB (Bring Your Own Backend) nodes speak.
 *
 * These are the shapes that arrive in the runtime through the project's `backendServices`
 * metadata: the editor introspects a backend, caches its schema, and the six `byob-*` files
 * build their ports and requests from what it cached.
 *
 * **They are a second description of an existing contract.** The authoritative one is
 * `noodl-editor/src/editor/src/models/BackendServices/types.ts`, which is what *writes*
 * this metadata. The runtime cannot import it — nothing in `@noodl/runtime` may depend on
 * the editor — and it is not node-definition API, so it does not belong in `@noodl/types`
 * either. Declared here, deliberately narrow: only the members the nodes actually read,
 * so a change on the editor side shows up as a missing property rather than as silence.
 * (There is a *third* copy in the editor's own `ByobFilterBuilder/types.ts`.)
 *
 * A note on `SchemaField`, because two comments in `byob-utils.ts` turn on it: the nodes see
 * the *cached* shape, with `hidden` and `enumValues` already resolved at parse time. The
 * raw Directus `/fields` shape — `meta.hidden`, `meta.options.choices` — reaches them only
 * when something feeds a live introspection response straight through. Both are matched, and
 * RUN-003 found that matching only `meta` had left hidden-field filtering and enum dropdowns
 * dead in the real flow.
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

/** What `resolveBackend` hands back — the subset of a backend's config the nodes need. */
export interface ResolvedBackend {
  url: string;
  /** The public token, or `''`. Never the admin token: this runs in the browser. */
  token: string;
  type?: string;
  endpoints?: Record<string, unknown>;
  collections: SchemaCollection[];
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

/** The `meta` block a Directus list response carries alongside its records. */
export interface DirectusListMeta {
  filter_count?: number | null;
  total_count?: number | null;
}
