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

const NoodlRuntime = require('../../../../noodl-runtime');

/**
 * Directus system collection endpoint mappings
 * Maps internal collection names to their API endpoints
 */
const SYSTEM_ENDPOINTS = {
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
function resolveBackend(backendId) {
  const backendServices = NoodlRuntime.instance.getMetaData('backendServices');

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
    endpoints: backend.endpoints
  };
}

/**
 * Build endpoint path for a collection
 * @param {string} collection - Collection name
 * @param {string} apiPathMode - 'items' or 'system'
 * @returns {string} Endpoint path (e.g., 'items/posts' or 'users')
 */
function buildEndpoint(collection, apiPathMode) {
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
function buildHeaders(token) {
  const headers = {
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
function isSystemCollection(collection) {
  return collection && collection.startsWith('directus_');
}

/**
 * Auto-detect the appropriate API path mode for a collection
 * @param {string} collection - Collection name
 * @returns {string} 'system' or 'items'
 */
function detectApiPathMode(collection) {
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
function buildUrl(backendConfig, collection, apiPathMode, recordId = null) {
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
 * Handles date conversion to ISO 8601 format
 * @param {*} value - The value to normalize
 * @param {Object} fieldSchema - Field schema information
 * @returns {*} Normalized value
 */
function normalizeValue(value, fieldSchema) {
  if (value === null || value === undefined) {
    return value;
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
      const date = new Date(value);
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
function filterCollectionsByMode(collections, apiPathMode) {
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
function shouldShowField(field) {
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
function getEnhancedFieldType(field) {
  const result = {
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
 * Pick the record count to expose as Total Count from a Directus meta block.
 * filter_count (the count after the filter is applied) wins over total_count
 * (the whole collection) — pagination over a filtered list needs the former.
 * Falls back to the page length when no meta was returned.
 */
function pickTotalCount(meta, records) {
  if (meta && meta.filter_count !== undefined && meta.filter_count !== null) return meta.filter_count;
  if (meta && meta.total_count !== undefined && meta.total_count !== null) return meta.total_count;
  return records ? records.length : 0;
}

module.exports = {
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
  pickTotalCount
};
