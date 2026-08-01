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

import type {
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  RuntimeDiscoveredPort
} from '@noodl/types';

import {
  migrateSavedFilter,
  needsOperatorMigration,
  savedFilterToNeutral,
  toDirectusFilter as translateToDirectus,
  type SavedFilterGroup,
  type SavedFilterItem
} from '@noodl/backend-contract/translators';

import type { ResolvedBackend, SchemaCollection } from './byob-types';

import * as SchemaPorts from './schema-ports';

import Node = require('../../../node');
import ByobUtils = require('./byob-utils');

// BCN-008 retired `byob-realtime.ts`: there is one set of transports now, in
// `api/backends/realtime`, and this node uses the same one Query Records does.
import { createRealtimeSubscription, isNodeGXRealtime } from '../../../api/backends/realtime';
import type { RealtimeSubscription } from '../../../api/backends/realtime';

/** The shape the `error` output carries. */
interface ByobError {
  status?: number;
  message: string;
  errors?: { message: string }[];
}

/** A rejected fetch, as this file throws and re-reads it. */
interface ByobFetchError {
  status?: number;
  statusText?: string;
  message?: string;
  body?: { errors?: { message: string }[] } | null;
}

/**
 * One node of the editor's visual filter tree.
 *
 * Group and condition are **one shape, not two**, and deliberately so: `type` is `'and'` or
 * `'or'` on a group and the operator name on a leaf, and the code everywhere tests exactly
 * that (`item.type === 'and' || item.type === 'or'`). Splitting this into a discriminated
 * union would not narrow — the group's own `type` is a string too — and would put a cast at
 * every branch. What arrives here is `JSON.parse` output, so every member is optional.
 *
 * `valueSource: 'connected'` is why the runtime re-converts the filter at fetch time rather
 * than reusing what the editor serialised: that value comes from a wire, and only the
 * runtime knows it.
 */
interface FilterGroup {
  id?: string;
  type?: 'and' | 'or' | (string & {});
  /** Present on a group. */
  conditions?: FilterGroup[];
  /** Present on a leaf. */
  field?: string;
  operator?: string;
  value?: unknown;
  valueSource?: 'literal' | 'connected' | (string & {});
  valuePortName?: string;
}

/** One connected condition, as `findConnectedConditions` reports it. */
interface ConnectedCondition {
  portName: string;
  field?: string;
  operator?: string;
  conditionId?: string;
}

/**
 * `this` inside the BYOB Query Data node.
 *
 * The node is a Directus (or NodeGX) list query built from dynamic ports: the collection
 * comes from the cached schema, the filter from the editor's visual builder, and each
 * condition whose value is *wired* rather than typed gets its own `filter_<port>` input —
 * which is why the filter is re-converted here at fetch time instead of being reused as the
 * editor serialised it (`resolveFilterWithConnectedValues`).
 *
 * With `live` on and a NodeGX backend it also holds an SSE subscription and re-runs the
 * query on any change, including the `resync` frame that means "you may have missed some".
 */
interface QueryDataInstance extends NodeInstance {
  _internal: {
    inputValues: Record<string, unknown>;
    loading: boolean;
    records: unknown[];
    totalCount: number;
    inspectData: Record<string, unknown> | null;
    apiPathMode: string;
    filterPortValues?: Record<string, unknown>;
    includeRelations?: Record<string, unknown>;
    backendId?: string;
    collection?: string;
    live?: boolean;
    filter?: string;
    sortField?: string;
    sortOrder?: string;
    limit?: number;
    offset?: number;
    fields?: string;
    error?: ByobError | null;
    lastRequestUrl?: string;
    hasScheduledFetch?: boolean;
    hasScheduledLiveReconfigure?: boolean;
    liveConnection?: RealtimeSubscription | null;
  };
  _storeInputValue(name: string, value: unknown): void;
  _storeFilterPortValue(name: string, value: unknown): void;
  _storeIncludeRelationValue(relationName: string, value: unknown): void;
  getIncludedRelations(): string[];
  resolveBackend(): ResolvedBackend | null;
  scheduleFetch(): void;
  scheduleLiveReconfigure(): void;
  reconfigureLive(): void;
  teardownLive(): void;
  buildUrl(backendConfig: ResolvedBackend | null): string | null;
  buildHeaders(backendConfig: ResolvedBackend | null): Record<string, string>;
  doFetch(): void;
  resolveFilterWithConnectedValues(): unknown;
  _resolveFilterGroupValues(group: FilterGroup): FilterGroup;
  _toDirectusFilter(group: FilterGroup): unknown;
}

console.log('[BYOB Query Data] 📦 Module loaded');

const QueryDataNode: NodeDefinitionOptions = {
  name: 'noodl.byob.QueryData',
  displayNodeName: 'Query Data',
  docs: 'https://docs.noodl.net/nodes/data/byob/query-data',
  category: 'Data',
  color: 'data',
  searchTags: ['byob', 'query', 'data', 'database', 'records', 'directus', 'supabase', 'api', 'backend', 'rest'],

  initialize: function (this: QueryDataInstance) {
    this._internal.inputValues = {};
    this._internal.loading = false;
    this._internal.records = [];
    this._internal.totalCount = 0;
    this._internal.inspectData = null;
    this._internal.apiPathMode = 'items'; // 'items' or 'system'
  },

  getInspectInfo(this: QueryDataInstance): InspectInfo {
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
      valueChangedToTrue: function (this: QueryDataInstance) {
        this.scheduleFetch();
      }
    }
  },

  outputs: {
    records: {
      type: 'array',
      displayName: 'Records',
      group: 'Results',
      getter: function (this: QueryDataInstance) {
        return this._internal.records;
      }
    },
    firstRecord: {
      type: 'object',
      displayName: 'First Record',
      group: 'Results',
      getter: function (this: QueryDataInstance) {
        return this._internal.records && this._internal.records.length > 0 ? this._internal.records[0] : null;
      }
    },
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'Results',
      getter: function (this: QueryDataInstance) {
        return this._internal.records ? this._internal.records.length : 0;
      }
    },
    totalCount: {
      type: 'number',
      displayName: 'Total Count',
      group: 'Results',
      getter: function (this: QueryDataInstance) {
        return this._internal.totalCount;
      }
    },
    loading: {
      type: 'boolean',
      displayName: 'Loading',
      group: 'Status',
      getter: function (this: QueryDataInstance) {
        return this._internal.loading;
      }
    },
    error: {
      type: 'object',
      displayName: 'Error',
      group: 'Status',
      getter: function (this: QueryDataInstance) {
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
    _storeInputValue: function (this: QueryDataInstance, name: string, value: unknown) {
      this._internal.inputValues[name] = value;
    },

    /**
     * Store filter port value (for connected filter conditions)
     */
    _storeFilterPortValue: function (this: QueryDataInstance, name: string, value: unknown) {
      if (!this._internal.filterPortValues) {
        this._internal.filterPortValues = {};
      }
      this._internal.filterPortValues[name] = value;
    },

    /**
     * Store an Include-<relation> toggle (include_<field> ports)
     */
    _storeIncludeRelationValue: function (this: QueryDataInstance, relationName: string, value: unknown) {
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
    getIncludedRelations: function (this: QueryDataInstance) {
      const includes = this._internal.includeRelations || {};
      const active = Object.keys(includes).filter((name) => !!includes[name]);
      if (active.length === 0) return active;

      const backend = this.resolveBackend();
      const collection = backend?.collections?.find((c: SchemaCollection) => c.name === this._internal.collection);
      if (!collection) return active;

      const valid = ByobUtils.getRelationFields(collection, backend.collections).map((r) => r.field.name);
      return active.filter((name) => valid.includes(name));
    },

    /**
     * Resolve the backend configuration from metadata
     * Returns { url, token, type } or null if not found
     */
    resolveBackend: function (this: QueryDataInstance) {
      const backendId = this._internal.backendId || '_active_';
      return ByobUtils.resolveBackend(backendId);
    },

    scheduleFetch: function (this: QueryDataInstance) {
      console.log('[BYOB Query Data] scheduleFetch called');
      if (this._internal.hasScheduledFetch) {
        console.log('[BYOB Query Data] Already scheduled, skipping');
        return;
      }
      this._internal.hasScheduledFetch = true;
      this.scheduleAfterInputsHaveUpdated(this.doFetch.bind(this));
    },

    // ------------------------------------------------------------------------
    // Live (BAK-001): keep results current via the NodeGX realtime SSE stream.
    // A collection-level subscription drives a DEBOUNCED re-run of the same
    // query (scheduleFetch coalesces bursts), so the server re-applies the real
    // filter/sort/limit — no client-side filter translation needed. Only the
    // NodeGX backend speaks SSE; for Directus and other BYOB backends the
    // dedicated Subscribe To Changes node (WebSocket) is the live path.
    // ------------------------------------------------------------------------
    scheduleLiveReconfigure: function (this: QueryDataInstance) {
      if (this._internal.hasScheduledLiveReconfigure) return;
      this._internal.hasScheduledLiveReconfigure = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        this._internal.hasScheduledLiveReconfigure = false;
        this.reconfigureLive();
      });
    },

    reconfigureLive: function (this: QueryDataInstance) {
      this.teardownLive();

      if (!this._internal.live) return;
      const collection = this._internal.collection;
      if (!collection) return;

      const backendConfig = this.resolveBackend();
      if (!backendConfig || !isNodeGXRealtime(backendConfig.type)) return;

      this._internal.liveConnection = createRealtimeSubscription(
        {
          id: 'byob',
          type: backendConfig.type as never,
          name: 'Backend',
          url: backendConfig.url,
          sessionToken: backendConfig.token
        },
        {
          collection,
          primaryKey: 'objectId',
          onEvent: (change) => {
            // Any create/update/delete/resync means the result set may have moved;
            // re-run the query (debounced). `init` is a confirmation snapshot, not a
            // change, and re-fetching on it would double every connect.
            if (change.type !== 'init') this.scheduleFetch();
          },
          onError: (err) => {
            console.warn('[BYOB Query Data] Live subscription error:', err);
          }
        }
      );
    },

    teardownLive: function (this: QueryDataInstance) {
      if (this._internal.liveConnection) {
        this._internal.liveConnection.dispose();
        this._internal.liveConnection = null;
      }
    },

    _onNodeDeleted: function (this: QueryDataInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.teardownLive();
    },

    buildUrl: function (this: QueryDataInstance, backendConfig: ResolvedBackend | null) {
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

    buildHeaders: function (this: QueryDataInstance, backendConfig: ResolvedBackend | null) {
      return ByobUtils.buildHeaders(backendConfig?.token);
    },

    doFetch: function (this: QueryDataInstance) {
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

    registerInputIfNeeded: function (this: QueryDataInstance, name: string) {
      if (this.hasInput(name)) return;

      // Map of dynamic input names to their setters
      const dynamicInputSetters = {
        backendId: (value) => {
          this._internal.backendId = value;
          this.scheduleLiveReconfigure();
        },
        collection: (value) => {
          this._internal.collection = value;
          this.scheduleLiveReconfigure();
        },
        live: (value) => {
          this._internal.live = !!value;
          this.scheduleLiveReconfigure();
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
    resolveFilterWithConnectedValues: function (this: QueryDataInstance) {
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
    _resolveFilterGroupValues: function (this: QueryDataInstance, group: FilterGroup): FilterGroup {
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
    _toDirectusFilter: function (this: QueryDataInstance, group: FilterGroup) {
      return toDirectusFilter(group);
    }
  }
};

/**
 * Convert the builder's saved format to a Directus filter.
 *
 * ⚠️ **This used to be a second implementation**, mirroring the editor's
 * converter by hand. RUN-003 shipped that pair and its runtime copy emitted a
 * flat `"author.name"` key that live Directus rejects with a 403 — invisible to
 * every unit test, because only a real fetch exercised this side. BCN-003's
 * hard rule is that one backend never has two translators, so both copies are
 * gone and this is the shared one.
 *
 * Three steps, and the middle one is the point:
 *
 * 1. **Migrate.** A filter saved before BCN-003 spells its operators the
 *    Directus way (`_eq`), verbatim in project data. The editor migrates on
 *    load, but a deployed app never opens the editor, so the runtime migrates
 *    too. Idempotent, so a filter already neutral is untouched.
 * 2. **To the neutral model**, which is what the translators take.
 * 3. **To Directus**, gated by the Directus capability table — so an operator
 *    Directus cannot express raises rather than vanishing from the query.
 *
 * The backend is `directus` unconditionally, and that is honest rather than
 * lazy: this node builds a Directus-shaped URL and Directus-shaped parameters
 * for every BYOB backend type. Making the other three real is BCN-004's, and
 * pretending here by passing the resolved backend's type would gate operators
 * against a table describing a request we do not send.
 */
function toDirectusFilter(group: FilterGroup): unknown {
  if (!group || !group.conditions || group.conditions.length === 0) return null;

  const migrated = needsOperatorMigration(group as unknown as SavedFilterItem)
    ? migrateSavedFilter(group as unknown as SavedFilterGroup)
    : (group as unknown as SavedFilterGroup);

  const neutral = savedFilterToNeutral(migrated);
  if (!neutral) return null;

  const directus = translateToDirectus(neutral, { backend: 'directus' });
  return Object.keys(directus).length === 0 ? null : directus;
}

/**
 * Helper to find all connected filter conditions in a filter group
 * Returns array of { portName, field, operator } for each connected condition
 */
function findConnectedConditions(filterGroup: FilterGroup, connected: ConnectedCondition[] = []): ConnectedCondition[] {
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
function parseFilterForConnectedPorts(filterJson: string | undefined): ConnectedCondition[] {
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
 * Update dynamic ports based on node configuration.
 *
 * Composed from the shared schema-driven port generator (BCN-004 step 4). What is
 * left here is what only a query node has: the visual filter builder's port, the
 * sort dropdown, pagination, and one `filter_*` input per condition whose value is
 * wired rather than typed.
 */
function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: NodeContextLike['editorConnection'],
  graphModel: GraphModelLike
) {
  const ctx = SchemaPorts.resolveSchemaPortContext({ graphModel, parameters });

  const ports: RuntimeDiscoveredPort[] = [
    ...SchemaPorts.backendPickerPorts(ctx),
    // API Path Mode MUST come before Collection for proper UX
    ...SchemaPorts.apiPathModePorts(ctx, { group: 'Query' }),
    ...SchemaPorts.collectionPorts(ctx, { group: 'Query' })
  ];

  // Own fields plus the one-hop dotted relation paths (author.name) — Directus
  // supports those in both filter and sort
  const filterFields = SchemaPorts.getFilterFields(ctx);
  const selectedCollection = ctx.selectedCollection;

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

  // Live (BAK-001): opt-in realtime refresh. When on (NodeGX backend), the node
  // opens an SSE subscription to the collection and re-runs the query whenever a
  // matching record changes — no manual Fetch needed.
  ports.push({
    name: 'live',
    displayName: 'Live',
    type: 'boolean',
    default: false,
    plug: 'input',
    group: 'Query',
    tooltip: 'Keep results live via the NodeGX realtime stream (SSE). Re-runs the query when records change.'
  });

  // One Include toggle per traversable relation — when on, the request expands
  // the relation in the fields param (fields=*,author.*)
  ports.push(...SchemaPorts.relationIncludePorts(ctx));

  // Parse filter to find connected conditions and add dynamic ports
  const connectedConditions = parseFilterForConnectedPorts(parameters.filter as string);
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

  // The `fetch` signal and every output are declared statically on the node.
  // `sendSchemaPorts` drops any generated port that would collide with one —
  // re-pushing a static output as a dynamic port is what once made `getPorts()`
  // list each output twice (RUN-003 slice 8).
  SchemaPorts.sendSchemaPorts(editorConnection, nodeId, ports, {
    staticPorts: SchemaPorts.staticPortNames(QueryDataNode)
  });
}

/**
 * This module carries two pure functions beyond the node itself, for the unit tests in
 * `test/byob-utils.test.js` to reach. `NodeModule` does not admit extra members, and the
 * runtime ignores them — so the type says what the object is rather than the other way
 * round.
 */
interface QueryDataModule extends NodeModule {
  parseFilterForConnectedPorts(filterJson: string | undefined): ConnectedCondition[];
  toDirectusFilter(group: FilterGroup): unknown;
}

const QueryDataNodeModule: QueryDataModule = {
  node: QueryDataNode,
  // Exported for unit tests: pure parser that finds connected filter conditions
  // in a stored filter parameter and derives their dynamic input ports.
  parseFilterForConnectedPorts,
  // Exported for unit tests: builder-format → Directus filter conversion
  // (relation-path nesting, null/empty operator mapping).
  toDirectusFilter,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
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
      graphModel.on('nodeAdded.noodl.byob.QueryData', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('noodl.byob.QueryData')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = QueryDataNodeModule;
