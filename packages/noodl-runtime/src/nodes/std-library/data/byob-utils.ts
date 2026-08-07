/**
 * BYOB Utilities
 *
 * Shared utilities for all BYOB (Bring Your Own Backend) data nodes.
 * Provides common functionality for backend resolution, URL building,
 * and Directus system table handling.
 *
 * **The schema/port half of this file moved to `schema-ports.ts`** in BCN-004 step 4,
 * so the Parse-family Record nodes can build ports from an introspected schema the same
 * way. What stayed is the wire half — resolving a backend, building a URL, normalising a
 * value for submission, reading a total count out of a response. The moved helpers are
 * re-exported below so the four `byob-*` nodes (and the RUN-003 unit tests that pinned
 * their two field-shape contracts) keep reaching them by their existing names.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

import {
  expandRelationFields,
  filterCollectionsByMode,
  getEnhancedFieldType,
  getRelationFields,
  isSystemCollection,
  shouldShowField
} from './schema-ports';

import { isConvergedSelection, resolveBackendTarget } from '../../../api/backends/resolveBackend';
import type { CloudServicesMetaData } from '../../../api/backends/resolveBackend';
// Moved out in BCN-004 step 5 so `RestDataAdapter`'s `serializeObject` hook can reach it
// without `api/` importing `nodes/`. Same function, re-exported below under the same name.
import { normalizeValue } from '../../../api/backends/restSerialize';

import type { BackendServicesMetaData, DirectusListMeta, ResolvedBackend } from './byob-types';

const NoodlRuntime = require('../../../../noodl-runtime');

/**
 * Directus system collection endpoint mappings
 * Maps internal collection names to their API endpoints
 */
const SYSTEM_ENDPOINTS: Record<string, string> = {
  directus_users: 'users',
  directus_roles: 'roles',
  directus_files: 'files',
  directus_folders: 'folders',
  directus_activity: 'activity',
  directus_permissions: 'permissions',
  directus_settings: 'settings',
  directus_webhooks: 'webhooks',
  directus_flows: 'flows',
  directus_operations: 'operations',
  directus_panels: 'panels',
  directus_dashboards: 'dashboards',
  directus_notifications: 'notifications',
  directus_shares: 'shares',
  directus_presets: 'presets',
  directus_revisions: 'revisions',
  directus_translations: 'translations'
};

/**
 * Resolve backend configuration from metadata
 *
 * **BCN-004 step 3: one resolver, not two.** The rules moved to
 * `api/backends/resolveBackend.ts`, which serves every adapter; what is left here is the
 * BYOB-shaped view of the answer, so the four `byob-*` nodes keep the fields they read.
 *
 * ⚠️ **Narrower than the general resolver on a legacy project: `cloudservices` is not
 * passed in.** A BYOB node's `_active_` has always meant `backendServices.activeBackendId`,
 * and a project that also has a `cloudservices` endpoint would otherwise see its BYOB nodes
 * jump onto the Parse wire. The Record family's `_active_` means something different for
 * the same reason, in the other direction — see the resolver's module docblock on the two
 * actives.
 *
 * **On a converged project (BCN-009 step 2) it is passed in, and must be.** Once the editor
 * has written `version: 2` there is one selection, it may be the literal `'_endpoint_'`, and
 * a BYOB node that cannot see `cloudservices` cannot resolve that id at all — so a project
 * whose backend *is* the built-in one would leave every BYOB node resolving nothing.
 *
 * The gate is `isConvergedSelection`, shared with the resolver rather than re-tested here:
 * three call sites have to agree about what "converged" means, and a project where two of
 * them agree resolves one family of nodes differently from another.
 *
 * One behaviour *is* new, and it is the spec's own step 3: with exactly one configured
 * backend and no `activeBackendId` recorded, that backend is the default. This used to
 * return `null`.
 *
 * @param {string} backendId - Backend ID or '_active_' for active backend
 * @returns {Object|null} Backend config with { url, token, type, endpoints } or null
 */
function resolveBackend(backendId: string): ResolvedBackend | null {
  const backendServices = NoodlRuntime.instance.getMetaData('backendServices') as BackendServicesMetaData | undefined;

  if (!backendServices || !backendServices.backends) {
    console.log('[BYOB Utils] No backend services metadata found');
    return null;
  }

  const cloudservices = isConvergedSelection({ backendServices })
    ? (NoodlRuntime.instance.getMetaData('cloudservices') as CloudServicesMetaData | undefined)
    : undefined;

  const target = resolveBackendTarget(backendId, { backendServices, cloudservices });

  if (!target) {
    console.log('[BYOB Utils] Backend not found:', backendId);
    return null;
  }

  return {
    url: target.entry.url,
    token: (target.entry.auth?.publicToken as string) || '',
    type: target.entry.type,
    endpoints: target.entry.endpoints,
    collections: target.collections
  };
}

/**
 * Build endpoint path for a collection
 * @param {string} collection - Collection name
 * @param {string} apiPathMode - 'items' or 'system'
 * @returns {string} Endpoint path (e.g., 'items/posts' or 'users')
 */
function buildEndpoint(collection: string, apiPathMode: string): string {
  if (apiPathMode === 'system' && SYSTEM_ENDPOINTS[collection]) {
    return SYSTEM_ENDPOINTS[collection];
  }
  return `items/${collection}`;
}

/**
 * Build HTTP headers for API requests
 * @param {string} token - Auth token (optional)
 * @returns {Object} Headers object
 */
function buildHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Auto-detect the appropriate API path mode for a collection
 * @param {string} collection - Collection name
 * @returns {string} 'system' or 'items'
 */
function detectApiPathMode(collection: string): string {
  return isSystemCollection(collection) ? 'system' : 'items';
}

/**
 * Build full URL for an API request
 * @param {Object} backendConfig - Backend configuration
 * @param {string} collection - Collection name
 * @param {string} apiPathMode - 'items' or 'system'
 * @param {string} recordId - Optional record ID for specific record
 * @returns {string|null} Full URL or null if invalid
 */
function buildUrl(
  backendConfig: ResolvedBackend | null | undefined,
  collection: string | undefined,
  apiPathMode: string,
  recordId: string | null = null
): string | null {
  const baseUrl = backendConfig?.url;

  if (!baseUrl || !collection) {
    return null;
  }

  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const endpoint = buildEndpoint(collection, apiPathMode);
  let url = `${cleanBaseUrl}/${endpoint}`;

  if (recordId) {
    url += `/${recordId}`;
  }

  return url;
}

/**
 * Build the value for the `fields` query parameter from the user's fields
 * input and the relations toggled on via Include-<relation> ports.
 * '*' + ['author'] → '*,author.*'; 'id,title' + ['author'] → 'id,title,author.*'.
 * Relations already expanded in a custom fields value are not duplicated.
 * @param {string} fieldsValue - The node's fields input ('*' by default)
 * @param {Array<string>} includedRelations - Relation field names to expand
 * @returns {string} The effective fields parameter value
 */
function buildFieldsParam(fieldsValue: string | undefined, includedRelations: string[] | undefined): string {
  const base = (fieldsValue || '*').trim() || '*';
  if (!includedRelations || includedRelations.length === 0) return base;

  const parts = base
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  for (const relation of includedRelations) {
    const expansion = `${relation}.*`;
    if (!parts.includes(expansion)) {
      parts.push(expansion);
    }
  }
  return parts.join(',');
}

/**
 * Pick the record count to expose as Total Count from a Directus meta block.
 * filter_count (the count after the filter is applied) wins over total_count
 * (the whole collection) — pagination over a filtered list needs the former.
 * Falls back to the page length when no meta was returned.
 */
function pickTotalCount(meta: DirectusListMeta | undefined, records: unknown[] | undefined): number {
  if (meta && meta.filter_count !== undefined && meta.filter_count !== null) return meta.filter_count;
  if (meta && meta.total_count !== undefined && meta.total_count !== null) return meta.total_count;
  return records ? records.length : 0;
}

const ByobUtils = {
  SYSTEM_ENDPOINTS,
  resolveBackend,
  buildEndpoint,
  buildHeaders,
  buildUrl,
  detectApiPathMode,
  normalizeValue,
  buildFieldsParam,
  pickTotalCount,

  // Re-exported from schema-ports.ts, which now owns the schema half. Same functions,
  // same behaviour — including the two field-shape contracts RUN-003 paid for, which
  // `test/byob-utils.test.js` still pins through these names.
  isSystemCollection,
  filterCollectionsByMode,
  shouldShowField,
  getEnhancedFieldType,
  getRelationFields,
  expandRelationFields
};

export = ByobUtils;
