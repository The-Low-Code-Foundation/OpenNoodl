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

import type { BackendServicesMetaData, DirectusListMeta, ResolvedBackend, SchemaField } from './byob-types';

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
 * @param {string} backendId - Backend ID or '_active_' for active backend
 * @returns {Object|null} Backend config with { url, token, type, endpoints } or null
 */
function resolveBackend(backendId: string): ResolvedBackend | null {
  const backendServices = NoodlRuntime.instance.getMetaData('backendServices') as BackendServicesMetaData | undefined;

  if (!backendServices || !backendServices.backends) {
    console.log('[BYOB Utils] No backend services metadata found');
    return null;
  }

  const backends = backendServices.backends || [];
  let backend;

  if (backendId === '_active_') {
    backend = backends.find((b) => b.id === backendServices.activeBackendId);
  } else {
    backend = backends.find((b) => b.id === backendId);
  }

  if (!backend) {
    console.log('[BYOB Utils] Backend not found:', backendId);
    return null;
  }

  return {
    url: backend.url,
    token: backend.auth?.publicToken || '',
    type: backend.type,
    endpoints: backend.endpoints,
    collections: backend.schema?.collections || []
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
 * Normalize a value for API submission
 * Handles date conversion to ISO 8601 format, and JSON text for json/array columns
 * @param {*} value - The value to normalize
 * @param {Object} fieldSchema - Field schema information
 * @returns {*} Normalized value
 */
function normalizeValue(value: unknown, fieldSchema: SchemaField | undefined): unknown {
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
