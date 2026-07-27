/**
 * BYOB Delete Record Node
 *
 * Deletes a record from a BYOB backend collection.
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

import type { BackendServicesMetaData, ResolvedBackend, SchemaField } from './byob-types';

import ByobUtils = require('./byob-utils');

console.log('[BYOB Delete Record] 📦 Module loaded');

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

/** `this` inside the BYOB Delete Record node. */
interface DeleteRecordInstance extends NodeInstance {
  _internal: {
    loading: boolean;
    apiPathMode: string;
    backendId?: string;
    collection?: string;
    recordId?: string;
    error?: ByobError | null;
    lastResult?: Record<string, unknown>;
    hasScheduledDelete?: boolean;
  };
  resolveBackend(): ResolvedBackend | null;
  scheduleDelete(): void;
  doDelete(): void;
}

const DeleteRecordNode: NodeDefinitionOptions = {
  name: 'noodl.byob.DeleteRecord',
  displayNodeName: 'Delete Record',
  docs: 'https://docs.noodl.net/nodes/data/byob/delete-record',
  category: 'Data',
  color: 'data',
  searchTags: ['byob', 'delete', 'remove', 'data', 'database', 'records', 'directus', 'api', 'backend'],

  initialize: function (this: DeleteRecordInstance) {
    this._internal.loading = false;
    this._internal.apiPathMode = 'items';
  },

  getInspectInfo(this: DeleteRecordInstance): InspectInfo {
    if (!this._internal.lastResult) {
      return { type: 'text', value: '[Not executed yet]' };
    }
    return { type: 'value', value: this._internal.lastResult };
  },

  inputs: {
    delete: {
      type: 'signal',
      displayName: 'Delete',
      group: 'Actions',
      valueChangedToTrue: function (this: DeleteRecordInstance) {
        this.scheduleDelete();
      }
    }
  },

  outputs: {
    loading: {
      type: 'boolean',
      displayName: 'Loading',
      group: 'Status',
      getter: function (this: DeleteRecordInstance) {
        return this._internal.loading;
      }
    },
    error: {
      type: 'object',
      displayName: 'Error',
      group: 'Status',
      getter: function (this: DeleteRecordInstance) {
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
    resolveBackend: function (this: DeleteRecordInstance) {
      const backendId = this._internal.backendId || '_active_';
      return ByobUtils.resolveBackend(backendId);
    },

    scheduleDelete: function (this: DeleteRecordInstance) {
      console.log('[BYOB Delete Record] scheduleDelete called');
      if (this._internal.hasScheduledDelete) {
        console.log('[BYOB Delete Record] Already scheduled, skipping');
        return;
      }
      this._internal.hasScheduledDelete = true;
      this.scheduleAfterInputsHaveUpdated(this.doDelete.bind(this));
    },

    doDelete: function (this: DeleteRecordInstance) {
      console.log('[BYOB Delete Record] doDelete executing');
      this._internal.hasScheduledDelete = false;

      // Resolve the backend configuration
      const backendConfig = this.resolveBackend();
      if (!backendConfig) {
        console.log('[BYOB Delete Record] No backend configured');
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
        console.log('[BYOB Delete Record] No collection specified');
        this._internal.error = { message: 'Collection is required' };
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      if (!recordId) {
        console.log('[BYOB Delete Record] No record ID specified');
        this._internal.error = { message: 'Record ID is required' };
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      // Build URL with record ID
      const url = ByobUtils.buildUrl(backendConfig, collection, apiPathMode, recordId);
      if (!url) {
        console.log('[BYOB Delete Record] Failed to build URL');
        this._internal.error = { message: 'Failed to build request URL' };
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      // Build headers
      const headers = ByobUtils.buildHeaders(backendConfig.token);

      console.log('[BYOB Delete Record] Request:', {
        url,
        backendType: backendConfig.type,
        recordId
      });

      // Set loading state
      this._internal.loading = true;
      this.flagOutputDirty('loading');

      // Perform fetch
      fetch(url, {
        method: 'DELETE',
        headers: headers
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
          // DELETE may return 204 No Content or empty response
          if (response.status === 204) {
            return null;
          }
          return response.json().catch(() => null);
        })
        .then(() => {
          console.log('[BYOB Delete Record] Delete successful');

          this._internal.error = null;
          this._internal.loading = false;

          // Store for inspect
          this._internal.lastResult = {
            url,
            collection,
            recordId,
            deleted: true
          };

          // Flag outputs dirty
          this.flagOutputDirty('loading');
          this.flagOutputDirty('error');

          this.sendSignalOnOutput('success');
        })
        .catch((error: ByobFetchError) => {
          console.error('[BYOB Delete Record] Error:', error);

          this._internal.loading = false;

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

          this.flagOutputDirty('loading');
          this.flagOutputDirty('error');

          this.sendSignalOnOutput('failure');
        });
    },

    registerInputIfNeeded: function (this: DeleteRecordInstance, name: string) {
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
    }
  }
};

/**
 * Update dynamic ports based on node configuration
 */
function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: NodeContextLike['editorConnection'],
  graphModel: GraphModelLike
) {
  const ports: RuntimeDiscoveredPort[] = [];

  // Get backend services metadata
  const backendServices = (graphModel.getMetaData('backendServices') as BackendServicesMetaData) || {
    backends: []
  };
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
  const isSystemTable = ByobUtils.isSystemCollection(parameters.collection as string);

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
    group: 'Configuration'
  });

  // Filter collections based on selected API path mode
  const apiPathMode = (parameters.apiPathMode as string) || (isSystemTable ? 'system' : 'items');
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
    group: 'Configuration'
  });

  // Record ID input (required for delete)
  ports.push({
    name: 'recordId',
    displayName: 'Record ID',
    type: 'string',
    plug: 'input',
    group: 'Configuration'
  });

  // NOTE: 'delete' signal is defined in static inputs.
  // Outputs are all static too — pushing them here would list each twice in getPorts().

  editorConnection.sendDynamicPorts(nodeId, ports);
}

const DeleteRecordNodeModule: NodeModule = {
  node: DeleteRecordNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel & { _internal?: Record<string, unknown> }) {
      updatePorts(node.id, node.parameters || {}, context.editorConnection, graphModel);

      node.on('parameterUpdated', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.backendServices', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.noodl.byob.DeleteRecord', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('noodl.byob.DeleteRecord')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = DeleteRecordNodeModule;
