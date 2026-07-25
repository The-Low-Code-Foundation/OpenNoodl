/**
 * BYOB Query Data Node
 *
 * A universal data node for querying records from any BYOB (Bring Your Own Backend) service.
 * Works with Directus, Supabase, Appwrite, custom REST APIs, and more.
 * Integrates with the Backend Services system for schema-aware dropdowns
 * and supports the Visual Filter Builder.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

const NoodlRuntime = require('../../../../noodl-runtime');
const ByobUtils = require('./byob-utils');

console.log('[BYOB Query Data] 📦 Module loaded');

var QueryDataNode = {
  name: 'noodl.byob.QueryData',
  displayNodeName: 'Query Data',
  docs: 'https://docs.noodl.net/nodes/data/byob/query-data',
  category: 'Data',
  color: 'data',
  searchTags: ['byob', 'query', 'data', 'database', 'records', 'directus', 'supabase', 'api', 'backend', 'rest'],

  initialize: function () {
    this._internal.inputValues = {};
    this._internal.loading = false;
    this._internal.records = [];
    this._internal.totalCount = 0;
    this._internal.inspectData = null;
    this._internal.apiPathMode = 'items'; // 'items' or 'system'
  },

  getInspectInfo() {
    if (!this._internal.inspectData) {
      return { type: 'text', value: '[Not executed yet]' };
    }
    return { type: 'value', value: this._internal.inspectData };
  },

  // NOTE: Most inputs are defined dynamically in updatePorts() to support schema-driven dropdowns.
  // Only keep the fetch signal here as a static input.
  inputs: {
    fetch: {
      type: 'signal',
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function () {
        this.scheduleFetch();
      }
    }
  },

  outputs: {
    records: {
      type: 'array',
      displayName: 'Records',
      group: 'Results',
      getter: function () {
        return this._internal.records;
      }
    },
    firstRecord: {
      type: 'object',
      displayName: 'First Record',
      group: 'Results',
      getter: function () {
        return this._internal.records && this._internal.records.length > 0 ? this._internal.records[0] : null;
      }
    },
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'Results',
      getter: function () {
        return this._internal.records ? this._internal.records.length : 0;
      }
    },
    totalCount: {
      type: 'number',
      displayName: 'Total Count',
      group: 'Results',
      getter: function () {
        return this._internal.totalCount;
      }
    },
    loading: {
      type: 'boolean',
      displayName: 'Loading',
      group: 'Status',
      getter: function () {
        return this._internal.loading;
      }
    },
    error: {
      type: 'object',
      displayName: 'Error',
      group: 'Status',
      getter: function () {
        return this._internal.error;
      }
    },
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    }
  },

  prototypeExtensions: {
    _storeInputValue: function (name, value) {
      this._internal.inputValues[name] = value;
    },

    /**
     * Store filter port value (for connected filter conditions)
     */
    _storeFilterPortValue: function (name, value) {
      if (!this._internal.filterPortValues) {
        this._internal.filterPortValues = {};
      }
      this._internal.filterPortValues[name] = value;
    },

    /**
     * Store an Include-<relation> toggle (include_<field> ports)
     */
    _storeIncludeRelationValue: function (relationName, value) {
      if (!this._internal.includeRelations) {
        this._internal.includeRelations = {};
      }
      this._internal.includeRelations[relationName] = value;
    },

    /**
     * Relation field names whose Include toggle is on.
     * Include parameters survive a collection switch even though their port
     * is gone from the editor — validate against the current collection's
     * schema so a stale toggle can't poison the fields param.
     */
    getIncludedRelations: function () {
      const includes = this._internal.includeRelations || {};
      const active = Object.keys(includes).filter((name) => !!includes[name]);
      if (active.length === 0) return active;

      const backend = this.resolveBackend();
      const collection = backend?.collections?.find((c) => c.name === this._internal.collection);
      if (!collection) return active;

      const valid = ByobUtils.getRelationFields(collection, backend.collections).map((r) => r.field.name);
      return active.filter((name) => valid.includes(name));
    },

    /**
     * Resolve the backend configuration from metadata
     * Returns { url, token, type } or null if not found
     */
    resolveBackend: function () {
      const backendId = this._internal.backendId || '_active_';
      return ByobUtils.resolveBackend(backendId);
    },

    scheduleFetch: function () {
      console.log('[BYOB Query Data] scheduleFetch called');
      if (this._internal.hasScheduledFetch) {
        console.log('[BYOB Query Data] Already scheduled, skipping');
        return;
      }
      this._internal.hasScheduledFetch = true;
      this.scheduleAfterInputsHaveUpdated(this.doFetch.bind(this));
    },

    buildUrl: function (backendConfig) {
      const collection = this._internal.collection || '';
      const apiPathMode = this._internal.apiPathMode || 'items';

      if (!backendConfig?.url || !collection) {
        return null;
      }

      // Build base URL with system table support
      let url = ByobUtils.buildUrl(backendConfig, collection, apiPathMode);

      if (!url) {
        return null;
      }

      // Build query parameters
      const params = new URLSearchParams();

      // Fields — expand toggled-on relations (fields=*,author.*) so related
      // records come back as nested objects instead of raw foreign keys
      const fields = ByobUtils.buildFieldsParam(this._internal.fields, this.getIncludedRelations());
      if (fields && fields !== '*') {
        params.append('fields', fields);
      }

      // Filter - resolve connected values and convert to Directus format
      const resolvedFilter = this.resolveFilterWithConnectedValues();
      if (resolvedFilter) {
        try {
          const filterJson = JSON.stringify(resolvedFilter);
          console.log('[BYOB Query Data] Resolved filter:', filterJson);
          params.append('filter', filterJson);
        } catch (e) {
          console.warn('[BYOB Query Data] Error serializing filter:', e);
        }
      }

      // Sort
      const sortField = this._internal.sortField;
      const sortOrder = this._internal.sortOrder || 'asc';
      if (sortField) {
        const sortValue = sortOrder === 'desc' ? `-${sortField}` : sortField;
        params.append('sort', sortValue);
      }

      // Pagination
      const limit = this._internal.limit;
      if (limit !== undefined && limit !== null && limit > 0) {
        params.append('limit', String(limit));
      }

      const offset = this._internal.offset;
      if (offset !== undefined && offset !== null && offset > 0) {
        params.append('offset', String(offset));
      }

      // Request counts for pagination. total_count is the whole collection;
      // filter_count is the count after the filter is applied — the one
      // pagination over a filtered list actually needs.
      params.append('meta', 'total_count,filter_count');

      const queryString = params.toString();
      if (queryString) {
        url += '?' + queryString;
      }

      return url;
    },

    buildHeaders: function (backendConfig) {
      return ByobUtils.buildHeaders(backendConfig?.token);
    },

    doFetch: function () {
      console.log('[BYOB Query Data] doFetch executing');
      this._internal.hasScheduledFetch = false;

      // Resolve the backend configuration
      const backendConfig = this.resolveBackend();
      if (!backendConfig) {
        console.log('[BYOB Query Data] No backend configured');
        this._internal.error = {
          message: 'No backend configured. Please add a backend in the Backend Services panel.'
        };
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      const url = this.buildUrl(backendConfig);
      const headers = this.buildHeaders(backendConfig);

      console.log('[BYOB Query Data] Request:', {
        url,
        backendType: backendConfig.type,
        headers: Object.keys(headers)
      });

      // Validate inputs
      if (!url) {
        console.log('[BYOB Query Data] Missing URL or collection');
        this._internal.error = { message: 'Backend URL and Collection are required' };
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      // Set loading state
      this._internal.loading = true;
      this.flagOutputDirty('loading');

      // Store for inspect
      this._internal.lastRequestUrl = url;

      // Perform fetch
      fetch(url, {
        method: 'GET',
        headers: headers
      })
        .then((response) => {
          if (!response.ok) {
            return response
              .json()
              .then((errorBody) => {
                throw {
                  status: response.status,
                  statusText: response.statusText,
                  body: errorBody
                };
              })
              .catch((parseError) => {
                // If JSON parsing fails, throw basic error
                if (parseError.status) throw parseError;
                throw {
                  status: response.status,
                  statusText: response.statusText,
                  body: null
                };
              });
          }
          return response.json();
        })
        .then((data) => {
          console.log('[BYOB Query Data] Response received:', {
            dataLength: data.data ? data.data.length : 0,
            meta: data.meta
          });

          // Directus response format: { data: [...], meta: { total_count, filter_count } }
          this._internal.records = data.data || [];
          this._internal.totalCount = ByobUtils.pickTotalCount(data.meta, this._internal.records);
          this._internal.error = null;
          this._internal.loading = false;

          // Update inspect data
          this._internal.inspectData = {
            url: this._internal.lastRequestUrl,
            collection: this._internal.collection,
            recordCount: this._internal.records.length,
            totalCount: this._internal.totalCount,
            records: this._internal.records.slice(0, 5) // Show first 5 for preview
          };

          // Flag all outputs dirty
          this.flagOutputDirty('records');
          this.flagOutputDirty('firstRecord');
          this.flagOutputDirty('count');
          this.flagOutputDirty('totalCount');
          this.flagOutputDirty('loading');
          this.flagOutputDirty('error');

          this.sendSignalOnOutput('success');
        })
        .catch((error) => {
          console.error('[BYOB Query Data] Error:', error);

          this._internal.loading = false;
          this._internal.records = [];
          this._internal.totalCount = 0;

          // Format error for output
          if (error.body && error.body.errors) {
            this._internal.error = {
              status: error.status,
              message: error.body.errors.map((e) => e.message).join(', '),
              errors: error.body.errors
            };
          } else {
            this._internal.error = {
              status: error.status || 0,
              message: error.message || error.statusText || 'Network error'
            };
          }

          // Update inspect data
          this._internal.inspectData = {
            url: this._internal.lastRequestUrl,
            collection: this._internal.collection,
            error: this._internal.error
          };

          this.flagOutputDirty('records');
          this.flagOutputDirty('firstRecord');
          this.flagOutputDirty('count');
          this.flagOutputDirty('totalCount');
          this.flagOutputDirty('loading');
          this.flagOutputDirty('error');

          this.sendSignalOnOutput('failure');
        });
    },

    registerInputIfNeeded: function (name) {
      if (this.hasInput(name)) return;

      // Map of dynamic input names to their setters
      const dynamicInputSetters = {
        backendId: (value) => {
          this._internal.backendId = value;
        },
        collection: (value) => {
          this._internal.collection = value;
        },
        apiPathMode: (value) => {
          this._internal.apiPathMode = value;
        },
        filter: (value) => {
          this._internal.filter = value;
        },
        sortField: (value) => {
          this._internal.sortField = value;
        },
        sortOrder: (value) => {
          this._internal.sortOrder = value;
        },
        limit: (value) => {
          this._internal.limit = value;
        },
        offset: (value) => {
          this._internal.offset = value;
        },
        fields: (value) => {
          this._internal.fields = value;
        }
      };

      // Register standard dynamic inputs
      if (dynamicInputSetters[name]) {
        return this.registerInput(name, {
          set: dynamicInputSetters[name]
        });
      }

      // Register dynamic filter port inputs (filter_<field>_<id>)
      if (name.startsWith('filter_')) {
        return this.registerInput(name, {
          set: this._storeFilterPortValue.bind(this, name)
        });
      }

      // Register Include-<relation> toggles (include_<field>)
      if (name.startsWith('include_')) {
        return this.registerInput(name, {
          set: this._storeIncludeRelationValue.bind(this, name.substring('include_'.length))
        });
      }
    },

    /**
     * Resolve connected filter values and build final filter JSON
     * Replaces placeholder values in the filter structure with actual port values
     */
    resolveFilterWithConnectedValues: function () {
      const filterJson = this._internal.filter;
      if (!filterJson || !filterJson.trim()) return null;

      try {
        const parsed = JSON.parse(filterJson);

        // If this is a visual filter builder format, resolve connected values
        if (parsed.conditions) {
          const resolved = this._resolveFilterGroupValues(parsed);
          // Convert to Directus filter format
          return this._toDirectusFilter(resolved);
        }

        // If it's already a Directus filter, return as-is
        return parsed;
      } catch (e) {
        console.warn('[BYOB Query Data] Error parsing filter:', e);
        return null;
      }
    },

    /**
     * Recursively resolve connected values in a filter group
     */
    _resolveFilterGroupValues: function (group) {
      if (!group || !group.conditions) return group;

      const resolvedConditions = group.conditions.map((item) => {
        if (item.type === 'and' || item.type === 'or') {
          // Recurse into nested groups
          return this._resolveFilterGroupValues(item);
        } else {
          // This is a condition - resolve connected value if needed
          if (item.valueSource === 'connected' && item.valuePortName) {
            const portValue = this._internal.filterPortValues?.[item.valuePortName];
            return {
              ...item,
              value: portValue !== undefined ? portValue : item.value
            };
          }
          return item;
        }
      });

      return {
        ...group,
        conditions: resolvedConditions
      };
    },

    /**
     * Convert visual filter builder format to Directus filter format
     */
    _toDirectusFilter: function (group) {
      return toDirectusFilter(group);
    }
  }
};

/**
 * Convert the visual filter builder format to the Directus filter format.
 * Mirrors the editor-side converter (ByobFilterBuilder/converter.ts) — the
 * runtime re-converts at fetch time because connected port values are only
 * known here.
 */
function toDirectusFilter(group) {
  if (!group || !group.conditions || group.conditions.length === 0) {
    return null;
  }

  const combinator = group.type === 'or' ? '_or' : '_and';
  const filterItems = [];

  for (const item of group.conditions) {
    if (item.type === 'and' || item.type === 'or') {
      // Nested group
      const nestedFilter = toDirectusFilter(item);
      if (nestedFilter) {
        filterItems.push(nestedFilter);
      }
    } else {
      // Condition - convert to Directus format
      if (item.field && item.operator) {
        // Null/empty checks take a literal true, not the (absent) value
        const noValueOperators = ['_null', '_nnull', '_empty', '_nempty'];
        const operatorValue = noValueOperators.includes(item.operator) ? true : item.value;

        // Relation paths (author.name) must nest: { author: { name: { _eq: ... } } }.
        // A flat "author.name" key is rejected by Directus (live 403, slice 6).
        let condition = { [item.operator]: operatorValue };
        const parts = item.field.split('.');
        for (let i = parts.length - 1; i >= 0; i--) {
          condition = { [parts[i]]: condition };
        }
        filterItems.push(condition);
      }
    }
  }

  if (filterItems.length === 0) return null;
  if (filterItems.length === 1) return filterItems[0];

  const result = {};
  result[combinator] = filterItems;
  return result;
}

/**
 * Helper to find all connected filter conditions in a filter group
 * Returns array of { portName, field, operator } for each connected condition
 */
function findConnectedConditions(filterGroup, connected = []) {
  if (!filterGroup || !filterGroup.conditions) return connected;

  for (const item of filterGroup.conditions) {
    if (item.type === 'and' || item.type === 'or') {
      // Recurse into nested groups
      findConnectedConditions(item, connected);
    } else if (item.valueSource === 'connected' && item.valuePortName) {
      // This is a connected condition
      connected.push({
        portName: item.valuePortName,
        field: item.field,
        operator: item.operator,
        conditionId: item.id
      });
    }
  }

  return connected;
}

/**
 * Parse filter JSON string and extract connected conditions
 */
function parseFilterForConnectedPorts(filterJson) {
  if (!filterJson || !filterJson.trim()) return [];

  try {
    const parsed = JSON.parse(filterJson);
    // Check if this is a visual filter builder format (has 'conditions' array)
    if (parsed.conditions) {
      return findConnectedConditions(parsed);
    }
    return [];
  } catch (e) {
    return [];
  }
}

/**
 * Update dynamic ports based on node configuration
 * This will be extended to support schema-driven collection/field dropdowns
 */
function updatePorts(nodeId, parameters, editorConnection, graphModel) {
  const ports = [];

  // Get backend services metadata
  const backendServices = graphModel.getMetaData('backendServices') || { backends: [] };
  const backends = backendServices.backends || [];

  // Backend selection dropdown
  const backendEnums = [{ label: 'Active Backend', value: '_active_' }];
  backends.forEach((b) => {
    backendEnums.push({ label: b.name, value: b.id });
  });

  ports.push({
    name: 'backendId',
    displayName: 'Backend',
    type: {
      name: 'enum',
      enums: backendEnums,
      allowEditOnly: true
    },
    default: '_active_',
    plug: 'input',
    group: 'Backend'
  });

  // Resolve the selected backend
  const selectedBackendId =
    parameters.backendId === '_active_' || !parameters.backendId
      ? backendServices.activeBackendId
      : parameters.backendId;
  const selectedBackend = backends.find((b) => b.id === selectedBackendId);
  const allCollections = selectedBackend?.schema?.collections || [];

  // API Path Mode dropdown - MUST come before Collection for proper UX
  const isSystemTable = ByobUtils.isSystemCollection(parameters.collection);

  ports.push({
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
    group: 'Query'
  });

  // Filter collections based on selected API path mode
  const apiPathMode = parameters.apiPathMode || (isSystemTable ? 'system' : 'items');
  const filteredCollections = ByobUtils.filterCollectionsByMode(allCollections, apiPathMode);

  // Collection dropdown (filtered by API path mode)
  const collectionEnums = [{ label: '(Select collection)', value: '' }];
  filteredCollections.forEach((c) => {
    collectionEnums.push({ label: c.displayName || c.name, value: c.name });
  });

  ports.push({
    name: 'collection',
    displayName: 'Collection',
    type: {
      name: 'enum',
      enums: collectionEnums,
      allowEditOnly: true
    },
    plug: 'input',
    group: 'Query'
  });

  // Get selected collection for field-based dropdowns
  const selectedCollection = allCollections.find((c) => c.name === parameters.collection);

  // Expand M2O/O2O relations one hop (author.name) so the filter builder and
  // sort dropdown can traverse into related collections (Directus supports
  // dotted paths in both filter and sort)
  const fields = selectedCollection?.fields || [];
  const relationFields = selectedCollection ? ByobUtils.getRelationFields(selectedCollection, allCollections) : [];
  const expandedRelationFields = selectedCollection
    ? ByobUtils.expandRelationFields(selectedCollection, allCollections)
    : [];
  const filterFields = fields.concat(expandedRelationFields);

  // Filter port - uses Visual Filter Builder when schema is available
  ports.push({
    name: 'filter',
    displayName: 'Filter',
    type: {
      name: 'byob-filter',
      // Pass schema fields (own + relation paths) to the filter builder
      schema: selectedCollection
        ? {
            collection: selectedCollection.name,
            fields: filterFields
          }
        : null
    },
    plug: 'input',
    group: 'Query'
  });

  const sortFieldEnums = [{ label: '(None)', value: '' }];
  filterFields.forEach((f) => {
    sortFieldEnums.push({ label: f.displayName || f.name, value: f.name });
  });

  ports.push({
    name: 'sortField',
    displayName: 'Sort Field',
    type: {
      name: 'enum',
      enums: sortFieldEnums
    },
    plug: 'input',
    group: 'Query'
  });

  ports.push({
    name: 'sortOrder',
    displayName: 'Sort Order',
    type: {
      name: 'enum',
      enums: [
        { label: 'Ascending', value: 'asc' },
        { label: 'Descending', value: 'desc' }
      ]
    },
    default: 'asc',
    plug: 'input',
    group: 'Query'
  });

  ports.push({
    name: 'limit',
    displayName: 'Limit',
    type: 'number',
    default: 100,
    plug: 'input',
    group: 'Pagination'
  });

  ports.push({
    name: 'offset',
    displayName: 'Offset',
    type: 'number',
    default: 0,
    plug: 'input',
    group: 'Pagination'
  });

  ports.push({
    name: 'fields',
    displayName: 'Fields',
    type: 'string',
    default: '*',
    plug: 'input',
    group: 'Query'
  });

  // One Include toggle per traversable relation — when on, the request expands
  // the relation in the fields param (fields=*,author.*) so records carry the
  // related record as a nested object instead of a raw foreign key
  relationFields.forEach(({ field, targetCollection }) => {
    ports.push({
      name: `include_${field.name}`,
      displayName: `Include ${field.displayName || field.name}`,
      type: 'boolean',
      default: false,
      plug: 'input',
      group: 'Related Data',
      tooltip: `Fetch the related ${targetCollection.displayName || targetCollection.name} record as a nested object`
    });
  });

  // Parse filter to find connected conditions and add dynamic ports
  const connectedConditions = parseFilterForConnectedPorts(parameters.filter);
  if (connectedConditions.length > 0) {
    connectedConditions.forEach((condition) => {
      // Find the field info for better display name (relation paths included)
      const fieldInfo = filterFields.find((f) => f.name === condition.field);
      const displayName = fieldInfo?.displayName || condition.field || condition.portName;

      ports.push({
        name: condition.portName,
        displayName: `Filter: ${displayName}`,
        type: '*', // Accept any type
        plug: 'input',
        group: 'Filter Values'
      });
    });
  }

  // NOTE: 'fetch' signal is defined in static inputs (with valueChangedToTrue handler)
  // DO NOT add it here again or it will appear twice in the connection popup

  // Outputs
  ports.push({
    name: 'records',
    displayName: 'Records',
    type: 'array',
    plug: 'output',
    group: 'Results'
  });

  ports.push({
    name: 'firstRecord',
    displayName: 'First Record',
    type: 'object',
    plug: 'output',
    group: 'Results'
  });

  ports.push({
    name: 'count',
    displayName: 'Count',
    type: 'number',
    plug: 'output',
    group: 'Results'
  });

  ports.push({
    name: 'totalCount',
    displayName: 'Total Count',
    type: 'number',
    plug: 'output',
    group: 'Results'
  });

  ports.push({
    name: 'loading',
    displayName: 'Loading',
    type: 'boolean',
    plug: 'output',
    group: 'Status'
  });

  ports.push({
    name: 'error',
    displayName: 'Error',
    type: 'object',
    plug: 'output',
    group: 'Status'
  });

  ports.push({
    name: 'success',
    displayName: 'Success',
    type: 'signal',
    plug: 'output',
    group: 'Events'
  });

  ports.push({
    name: 'failure',
    displayName: 'Failure',
    type: 'signal',
    plug: 'output',
    group: 'Events'
  });

  editorConnection.sendDynamicPorts(nodeId, ports);
}

module.exports = {
  node: QueryDataNode,
  // Exported for unit tests: pure parser that finds connected filter conditions
  // in a stored filter parameter and derives their dynamic input ports.
  parseFilterForConnectedPorts,
  // Exported for unit tests: builder-format → Directus filter conversion
  // (relation-path nesting, null/empty operator mapping).
  toDirectusFilter,
  setup: function (context, graphModel) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node) {
      updatePorts(node.id, node.parameters || {}, context.editorConnection, graphModel);

      node.on('parameterUpdated', function () {
        // Update ports when backendId or collection changes
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      // Listen for backend services changes (schema updates, backend added/removed)
      graphModel.on('metadataChanged.backendServices', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.noodl.byob.QueryData', function (node) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('noodl.byob.QueryData')) {
        _managePortsForNode(node);
      }
    });
  }
};
