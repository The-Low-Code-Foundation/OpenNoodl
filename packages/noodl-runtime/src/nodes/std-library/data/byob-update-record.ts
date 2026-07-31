/**
 * BYOB Update Record Node
 *
 * Updates an existing record in a BYOB backend collection.
 * Supports Directus system tables and user collections.
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

import type { ResolvedBackend, SchemaField } from './byob-types';

import * as SchemaPorts from './schema-ports';

import ByobUtils = require('./byob-utils');

console.log('[BYOB Update Record] 📦 Module loaded');

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
 * `this` inside the BYOB Update Record node — Create Record's twin, plus a required
 * `recordId` and a `PATCH` rather than a `POST`.
 */
interface UpdateRecordInstance extends NodeInstance {
  _internal: {
    fieldValues: Record<string, unknown>;
    loading: boolean;
    apiPathMode: string;
    backendId?: string;
    collection?: string;
    recordId?: string;
    record?: Record<string, unknown> | null;
    error?: ByobError | null;
    lastResult?: Record<string, unknown>;
    hasScheduledUpdate?: boolean;
    /**
     * DEFECT (PLAT-003 NOTES §27.3), left verbatim. Nothing ever writes this.
     *
     * The `setup` function at the bottom builds a field schema and assigns it to
     * `node._internal.fieldSchema` — but `node` there is the **`GraphNodeModel`**, an editor-
     * side object, while this is the runtime **node instance**. They are different objects,
     * and the `if (!node._internal) node._internal = {}` guard next to that assignment is the
     * tell: the graph model has no `_internal`, so one was invented to hold a value nobody
     * reads. The consequence is that `normalizeValue` is always called with an `undefined`
     * schema, so date fields are never converted to ISO 8601 and `json`/`array` columns are
     * never parsed out of their editor text. And `setup` only runs against a live editor at
     * all, so a deployed app could not have had it either way.
     */
    fieldSchema?: Record<string, SchemaField>;
  };
  resolveBackend(): ResolvedBackend | null;
  scheduleUpdate(): void;
  doUpdate(): void;
}

const UpdateRecordNode: NodeDefinitionOptions = {
  name: 'noodl.byob.UpdateRecord',
  displayNodeName: 'Update Record',
  docs: 'https://docs.noodl.net/nodes/data/byob/update-record',
  category: 'Data',
  color: 'data',
  searchTags: ['byob', 'update', 'edit', 'modify', 'data', 'database', 'records', 'directus', 'api', 'backend'],

  initialize: function (this: UpdateRecordInstance) {
    this._internal.fieldValues = {};
    this._internal.loading = false;
    this._internal.apiPathMode = 'items';
  },

  getInspectInfo(this: UpdateRecordInstance): InspectInfo {
    if (!this._internal.lastResult) {
      return { type: 'text', value: '[Not executed yet]' };
    }
    return { type: 'value', value: this._internal.lastResult };
  },

  inputs: {
    update: {
      type: 'signal',
      displayName: 'Update',
      group: 'Actions',
      valueChangedToTrue: function (this: UpdateRecordInstance) {
        this.scheduleUpdate();
      }
    }
  },

  outputs: {
    record: {
      type: 'object',
      displayName: 'Record',
      group: 'Results',
      getter: function (this: UpdateRecordInstance) {
        return this._internal.record;
      }
    },
    loading: {
      type: 'boolean',
      displayName: 'Loading',
      group: 'Status',
      getter: function (this: UpdateRecordInstance) {
        return this._internal.loading;
      }
    },
    error: {
      type: 'object',
      displayName: 'Error',
      group: 'Status',
      getter: function (this: UpdateRecordInstance) {
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
    /**
     * Resolve the backend configuration from metadata
     */
    resolveBackend: function (this: UpdateRecordInstance) {
      const backendId = this._internal.backendId || '_active_';
      return ByobUtils.resolveBackend(backendId);
    },

    scheduleUpdate: function (this: UpdateRecordInstance) {
      console.log('[BYOB Update Record] scheduleUpdate called');
      if (this._internal.hasScheduledUpdate) {
        console.log('[BYOB Update Record] Already scheduled, skipping');
        return;
      }
      this._internal.hasScheduledUpdate = true;
      this.scheduleAfterInputsHaveUpdated(this.doUpdate.bind(this));
    },

    doUpdate: function (this: UpdateRecordInstance) {
      console.log('[BYOB Update Record] doUpdate executing');
      this._internal.hasScheduledUpdate = false;

      // Resolve the backend configuration
      const backendConfig = this.resolveBackend();
      if (!backendConfig) {
        console.log('[BYOB Update Record] No backend configured');
        this._internal.error = {
          message: 'No backend configured. Please add a backend in the Backend Services panel.'
        };
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      const collection = this._internal.collection;
      const recordId = this._internal.recordId;
      const apiPathMode = this._internal.apiPathMode || 'items';

      if (!collection) {
        console.log('[BYOB Update Record] No collection specified');
        this._internal.error = { message: 'Collection is required' };
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      if (!recordId) {
        console.log('[BYOB Update Record] No record ID specified');
        this._internal.error = { message: 'Record ID is required' };
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      // Build URL with record ID
      const url = ByobUtils.buildUrl(backendConfig, collection, apiPathMode, recordId);
      if (!url) {
        console.log('[BYOB Update Record] Failed to build URL');
        this._internal.error = { message: 'Failed to build request URL' };
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      // Build headers
      const headers = ByobUtils.buildHeaders(backendConfig.token);

      // Get field schema for value normalization
      const fieldSchema = this._internal.fieldSchema || {};

      // Collect field values from dynamic inputs and normalize them (especially dates)
      const body: Record<string, unknown> = {};
      for (const [fieldName, value] of Object.entries(this._internal.fieldValues)) {
        body[fieldName] = ByobUtils.normalizeValue(value, fieldSchema[fieldName]);
      }

      console.log('[BYOB Update Record] Request:', {
        url,
        backendType: backendConfig.type,
        recordId,
        fieldCount: Object.keys(body).length
      });

      // Set loading state
      this._internal.loading = true;
      this.flagOutputDirty('loading');

      // Perform fetch
      fetch(url, {
        method: 'PATCH',
        headers: headers,
        body: JSON.stringify(body)
      })
        .then((response) => {
          if (!response.ok) {
            return response
              .json()
              .then((errorBody: { errors?: { message: string }[] }) => {
                throw {
                  status: response.status,
                  statusText: response.statusText,
                  body: errorBody
                };
              })
              .catch((parseError: ByobFetchError) => {
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
        .then((data: { data?: Record<string, unknown> } & Record<string, unknown>) => {
          console.log('[BYOB Update Record] Response received');

          // Directus response format: { data: {...} }
          this._internal.record = data.data || data;
          this._internal.error = null;
          this._internal.loading = false;

          // Store for inspect
          this._internal.lastResult = {
            url,
            collection,
            recordId,
            record: this._internal.record
          };

          // Flag outputs dirty
          this.flagOutputDirty('record');
          this.flagOutputDirty('loading');
          this.flagOutputDirty('error');

          this.sendSignalOnOutput('success');
        })
        .catch((error: ByobFetchError) => {
          console.error('[BYOB Update Record] Error:', error);

          this._internal.loading = false;
          this._internal.record = null;

          // Format error for output
          if (error.body && error.body.errors) {
            this._internal.error = {
              status: error.status,
              message: error.body.errors.map((e: { message: string }) => e.message).join(', '),
              errors: error.body.errors
            };
          } else {
            this._internal.error = {
              status: error.status || 0,
              message: error.message || error.statusText || 'Network error'
            };
          }

          // Store for inspect
          this._internal.lastResult = {
            url,
            collection,
            recordId,
            error: this._internal.error
          };

          this.flagOutputDirty('record');
          this.flagOutputDirty('loading');
          this.flagOutputDirty('error');

          this.sendSignalOnOutput('failure');
        });
    },

    registerInputIfNeeded: function (this: UpdateRecordInstance, name: string) {
      if (this.hasInput(name)) return;

      // Map of configuration input names to their setters
      const configSetters: Record<string, (value: never) => void> = {
        backendId: (value: never) => {
          this._internal.backendId = value;
        },
        collection: (value: never) => {
          this._internal.collection = value;
        },
        recordId: (value: never) => {
          this._internal.recordId = value;
        },
        apiPathMode: (value: never) => {
          this._internal.apiPathMode = value;
        }
      };

      // Register configuration inputs
      if (configSetters[name]) {
        return this.registerInput(name, {
          set: configSetters[name]
        });
      }

      // Register dynamic field inputs (field_<fieldname>)
      if (name.startsWith('field_')) {
        const fieldName = name.substring(6); // Remove 'field_' prefix
        return this.registerInput(name, {
          set: (value: unknown) => {
            this._internal.fieldValues[fieldName] = value;
          }
        });
      }
    }
  }
};

/**
 * Update dynamic ports based on node configuration.
 *
 * Composed from the shared schema-driven port generator (BCN-004 step 4). The
 * read-only list is one entry shorter than Create's: an update may legitimately
 * write `date_updated`/`user_updated`.
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
    ...SchemaPorts.apiPathModePorts(ctx),
    ...SchemaPorts.collectionPorts(ctx),
    // Record ID input (required for update)
    {
      name: 'recordId',
      displayName: 'Record ID',
      type: 'string',
      plug: 'input',
      group: 'Configuration'
    },
    ...SchemaPorts.fieldPorts(ctx, { readOnlyFields: ['id', 'date_created', 'user_created'] })
  ];

  SchemaPorts.sendSchemaPorts(editorConnection, nodeId, ports, {
    staticPorts: SchemaPorts.staticPortNames(UpdateRecordNode)
  });
}

const UpdateRecordNodeModule: NodeModule = {
  node: UpdateRecordNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    /**
     * The field-schema stash below is dead code, kept verbatim — see the DEFECT note on
     * `_internal.fieldSchema` in the instance type. It writes onto the editor-side
     * `GraphNodeModel`, not the runtime instance that reads it. Left as it was because
     * removing it and making it work are two different changes, and only one of them is
     * BCN-004 step 4's.
     */
    function _managePortsForNode(node: GraphNodeModel & { _internal?: Record<string, unknown> }) {
      function _stashFieldSchema() {
        const ctx = SchemaPorts.resolveSchemaPortContext({ graphModel, parameters: node.parameters || {} });
        if (!ctx.selectedCollection || !ctx.selectedCollection.fields) return;

        const fieldSchema: Record<string, SchemaField> = {};
        ctx.selectedCollection.fields.forEach((field: SchemaField) => {
          fieldSchema[field.name] = field;
        });
        if (!node._internal) {
          node._internal = {};
        }
        node._internal.fieldSchema = fieldSchema;
      }

      _stashFieldSchema();
      updatePorts(node.id, node.parameters || {}, context.editorConnection, graphModel);

      node.on('parameterUpdated', function () {
        _stashFieldSchema();
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.backendServices', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.noodl.byob.UpdateRecord', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('noodl.byob.UpdateRecord')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = UpdateRecordNodeModule;
