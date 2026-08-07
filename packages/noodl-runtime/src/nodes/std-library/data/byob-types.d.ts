/**
 * The vocabulary the BYOB (Bring Your Own Backend) nodes speak.
 *
 * The schema half moved to `schema-types.d.ts` in BCN-004 step 4, alongside the port
 * generator that reads it — the Parse-family Record nodes need the same shapes, and a
 * file named for one node family is the wrong home for a vocabulary five families share.
 * It is re-exported here so the six `byob-*` files keep importing what they always did.
 * The note about the cached vs raw `SchemaField` shapes, and the RUN-003 bug that note
 * exists to prevent, lives with the definitions.
 *
 * What remains below is BYOB's own: the resolved-backend shape its request builders take,
 * and the Directus list `meta` block its query node reads.
 */

export type {
  BackendServiceEntry,
  BackendServicesMetaData,
  EnhancedFieldType,
  EnhancedPortType,
  RelationField,
  SchemaCollection,
  SchemaField
} from './schema-types';

import type { SchemaCollection } from './schema-types';

/** What `resolveBackend` hands back — the subset of a backend's config the nodes need. */
export interface ResolvedBackend {
  url: string;
  /** The public token, or `''`. Never the admin token: this runs in the browser. */
  token: string;
  type?: string;
  endpoints?: Record<string, unknown>;
  collections: SchemaCollection[];
}

/** The `meta` block a Directus list response carries alongside its records. */
export interface DirectusListMeta {
  filter_count?: number | null;
  total_count?: number | null;
}
