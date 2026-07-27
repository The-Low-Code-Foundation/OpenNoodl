/**
 * BYOB Utilities
 *
 * Shared utilities for all BYOB (Bring Your Own Backend) data nodes.
 * Provides common functionality for backend resolution, URL building,
 * and Directus system table handling.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

import type {
  BackendServicesMetaData,
  DirectusListMeta,
  EnhancedFieldType,
  RelationField,
  ResolvedBackend,
  SchemaCollection,
  SchemaField
} from './byob-types';

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
 * Check if a collection is a Directus system collection
 * @param {string} collection - Collection name
 * @returns {boolean} True if it's a system collection
 */
function isSystemCollection(collection: string | undefined): boolean {
  return collection && collection.startsWith('directus_');
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
 * Filter collections based on API path mode
 * @param {Array} collections - All collections from schema
 * @param {string} apiPathMode - 'items' or 'system'
 * @returns {Array} Filtered collections
 */
function filterCollectionsByMode(collections: SchemaCollection[], apiPathMode: string): SchemaCollection[] {
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
 * The cached shape is what the byob-* nodes actually receive — matching only
 * `meta` left hidden-field filtering dead in the real flow (RUN-003).
 * @param {Object} field - Field schema (cached SchemaField or raw Directus field)
 * @returns {boolean} True if field should be shown
 */
function shouldShowField(field: SchemaField | undefined): boolean {
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
 * Maps Directus field types to Noodl port types with additional metadata
 *
 * Accepts BOTH field shapes (see shouldShowField): cached SchemaField
 * (`enumValues: string[]`) and raw Directus (`meta.options.choices`). The
 * cached shape is what the nodes receive from backendServices metadata —
 * matching only `meta` left enum dropdowns dead in the real flow (RUN-003).
 * @param {Object} field - Field schema (cached SchemaField or raw Directus field)
 * @returns {Object} Port type definition { type, options, placeholder }
 */
function getEnhancedFieldType(field: SchemaField): EnhancedFieldType {
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

  // Map basic field types
  if (field.type === 'integer' || field.type === 'bigInteger' || field.type === 'float' || field.type === 'decimal') {
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
const TRAVERSABLE_RELATION_TYPES: string[] = ['many-to-one', 'one-to-one'];

/**
 * Get the traversable relation fields of a collection: visible fields whose
 * relationTarget resolves to a collection we have schema for.
 * @param {Object} collection - SchemaCollection (cached shape)
 * @param {Array} allCollections - All SchemaCollections in the backend schema
 * @returns {Array} [{ field, targetCollection }]
 */
function getRelationFields(collection: SchemaCollection, allCollections: SchemaCollection[]): RelationField[] {
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
function expandRelationFields(collection: SchemaCollection, allCollections: SchemaCollection[]): SchemaField[] {
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
  isSystemCollection,
  detectApiPathMode,
  normalizeValue,
  filterCollectionsByMode,
  shouldShowField,
  getEnhancedFieldType,
  getRelationFields,
  expandRelationFields,
  buildFieldsParam,
  pickTotalCount
};

export = ByobUtils;
