/**
 * BYOB Create Record Node
 *
 * Creates a new record in a BYOB backend collection.
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

console.log('[BYOB Create Record] 📦 Module loaded');

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
 * `this` inside the BYOB Create Record node.
 *
 * The collection dropdown, and one input port per writable column, come from the schema the
 * editor cached when it introspected the backend — so the node's shape is the backend's
 * shape. Read-only columns (`id`, `date_created`, …) and hidden fields are filtered out in
 * `updatePorts` below.
 */
interface CreateRecordInstance extends NodeInstance {
  _internal: {
    fieldValues: Record<string, unknown>;
    loading: boolean;
    apiPathMode: string;
    backendId?: string;
    collection?: string;
    record?: Record<string, unknown> | null;
    recordId?: string | null;
    error?: ByobError | null;
    lastResult?: Record<string, unknown>;
    hasScheduledCreate?: boolean;
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
  _storeFieldValue(name: string, value: unknown): void;
  resolveBackend(): ResolvedBackend | null;
  scheduleCreate(): void;
  doCreate(): void;
}

const CreateRecordNode: NodeDefinitionOptions = {
  name: 'noodl.byob.CreateRecord',
  displayNodeName: 'Create Record',
  docs: 'https://docs.noodl.net/nodes/data/byob/create-record',
  category: 'Data',
  color: 'data',
  searchTags: ['byob', 'create', 'insert', 'add', 'data', 'database', 'records', 'directus', 'api', 'backend'],

  initialize: function (this: CreateRecordInstance) {
    this._internal.fieldValues = {};
    this._internal.loading = false;
    this._internal.apiPathMode = 'items';
  },

  getInspectInfo(this: CreateRecordInstance): InspectInfo {
    if (!this._internal.lastResult) {
      return { type: 'text', value: '[Not executed yet]' };
    }
    return { type: 'value', value: this._internal.lastResult };
  },

  inputs: {
    create: {
      type: 'signal',
      displayName: 'Create',
      group: 'Actions',
      valueChangedToTrue: function (this: CreateRecordInstance) {
        this.scheduleCreate();
      }
    }
  },

  outputs: {
    record: {
      type: 'object',
      displayName: 'Record',
      group: 'Results',
      getter: function (this: CreateRecordInstance) {
        return this._internal.record;
      }
    },
    recordId: {
      type: 'string',
      displayName: 'Record ID',
      group: 'Results',
      getter: function (this: CreateRecordInstance) {
        return this._internal.recordId;
      }
    },
    loading: {
      type: 'boolean',
      displayName: 'Loading',
      group: 'Status',
      getter: function (this: CreateRecordInstance) {
        return this._internal.loading;
      }
    },
    error: {
      type: 'object',
      displayName: 'Error',
      group: 'Status',
      getter: function (this: CreateRecordInstance) {
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
     * Store field value (for dynamic field inputs)
     */
    _storeFieldValue: function (this: CreateRecordInstance, name: string, value: unknown) {
      this._internal.fieldValues[name] = value;
    },

    /**
     * Resolve the backend configuration from metadata
     */
    resolveBackend: function (this: CreateRecordInstance) {
      const backendId = this._internal.backendId || '_active_';
      return ByobUtils.resolveBackend(backendId);
    },

    scheduleCreate: function (this: CreateRecordInstance) {
      console.log('[BYOB Create Record] scheduleCreate called');
      if (this._internal.hasScheduledCreate) {
        console.log('[BYOB Create Record] Already scheduled, skipping');
        return;
      }
      this._internal.hasScheduledCreate = true;
      this.scheduleAfterInputsHaveUpdated(this.doCreate.bind(this));
    },

    doCreate: function (this: CreateRecordInstance) {
      console.log('[BYOB Create Record] doCreate executing');
      this._internal.hasScheduledCreate = false;

      // Resolve the backend configuration
      const backendConfig = this.resolveBackend();
      if (!backendConfig) {
        console.log('[BYOB Create Record] No backend configured');
        this._internal.error = {
          message: 'No backend configured. Please add a backend in the Backend Services panel.'
        };
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      const collection = this._internal.collection;
      const apiPathMode = this._internal.apiPathMode || 'items';

      if (!collection) {
        console.log('[BYOB Create Record] No collection specified');
        this._internal.error = { message: 'Collection is required' };
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      // Build URL
      const url = ByobUtils.buildUrl(backendConfig, collection, apiPathMode);
      if (!url) {
        console.log('[BYOB Create Record] Failed to build URL');
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

      console.log('[BYOB Create Record] Request:', {
        url,
        backendType: backendConfig.type,
        fieldCount: Object.keys(body).length
      });

      // Set loading state
      this._internal.loading = true;
      this.flagOutputDirty('loading');

      // Perform fetch
      fetch(url, {
        method: 'POST',
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
          console.log('[BYOB Create Record] Response received');

          // Directus response format: { data: {...} }
          this._internal.record = data.data || data;
          this._internal.recordId = (this._internal.record?.id as string) || null;
          this._internal.error = null;
          this._internal.loading = false;

          // Store for inspect
          this._internal.lastResult = {
            url,
            collection,
            record: this._internal.record
          };

          // Flag outputs dirty
          this.flagOutputDirty('record');
          this.flagOutputDirty('recordId');
          this.flagOutputDirty('loading');
          this.flagOutputDirty('error');

          this.sendSignalOnOutput('success');
        })
        .catch((error: ByobFetchError) => {
          console.error('[BYOB Create Record] Error:', error);

          this._internal.loading = false;
          this._internal.record = null;
          this._internal.recordId = null;

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
            error: this._internal.error
          };

          this.flagOutputDirty('record');
          this.flagOutputDirty('recordId');
          this.flagOutputDirty('loading');
          this.flagOutputDirty('error');

          this.sendSignalOnOutput('failure');
        });
    },

    registerInputIfNeeded: function (this: CreateRecordInstance, name: string) {
      if (this.hasInput(name)) return;

      // Map of configuration input names to their setters
      const configSetters: Record<string, (value: never) => void> = {
        backendId: (value: never) => {
          this._internal.backendId = value;
        },
        collection: (value: never) => {
          this._internal.collection = value;
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

  // Dynamic field inputs based on selected collection schema
  const selectedCollection = allCollections.find((c) => c.name === parameters.collection);
  const fields = selectedCollection?.fields || [];

  // Read-only fields that should never be editable
  const readOnlyFields = ['id', 'date_created', 'date_updated', 'user_created', 'user_updated'];

  fields.forEach((field) => {
    // Skip read-only fields
    if (readOnlyFields.includes(field.name)) {
      return;
    }

    // Skip presentation elements and hidden fields
    if (!ByobUtils.shouldShowField(field)) {
      return;
    }

    // Get enhanced field type (with enum support, placeholders, etc.)
    const fieldType = ByobUtils.getEnhancedFieldType(field);

    ports.push({
      name: `field_${field.name}`,
      displayName: field.displayName || field.name,
      type: fieldType.type,
      plug: 'input',
      group: 'Fields'
    });
  });

  // NOTE: 'create' signal is defined in static inputs.
  // Outputs are all static too — pushing them here would list each twice in getPorts().

  editorConnection.sendDynamicPorts(nodeId, ports);
}

const CreateRecordNodeModule: NodeModule = {
  node: CreateRecordNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel & { _internal?: Record<string, unknown> }) {
      // Store field schema in node for value normalization
      const backendServices = (graphModel.getMetaData('backendServices') as BackendServicesMetaData) || {
        backends: []
      };
      const backends = backendServices.backends || [];
      const selectedBackendId =
        node.parameters.backendId === '_active_' || !node.parameters.backendId
          ? backendServices.activeBackendId
          : node.parameters.backendId;
      const selectedBackend = backends.find((b) => b.id === selectedBackendId);
      const allCollections = selectedBackend?.schema?.collections || [];
      const selectedCollection = allCollections.find((c) => c.name === node.parameters.collection);

      if (selectedCollection && selectedCollection.fields) {
        const fieldSchema: Record<string, SchemaField> = {};
        selectedCollection.fields.forEach((field: SchemaField) => {
          fieldSchema[field.name] = field;
        });
        // Ensure _internal exists before setting properties
        if (!node._internal) {
          node._internal = {};
        }
        node._internal.fieldSchema = fieldSchema;
      }

      updatePorts(node.id, node.parameters || {}, context.editorConnection, graphModel);

      node.on('parameterUpdated', function () {
        // Update field schema when collection changes
        const backendServices = (graphModel.getMetaData('backendServices') as BackendServicesMetaData) || {
          backends: []
        };
        const backends = backendServices.backends || [];
        const selectedBackendId =
          node.parameters.backendId === '_active_' || !node.parameters.backendId
            ? backendServices.activeBackendId
            : node.parameters.backendId;
        const selectedBackend = backends.find((b) => b.id === selectedBackendId);
        const allCollections = selectedBackend?.schema?.collections || [];
        const selectedCollection = allCollections.find((c) => c.name === node.parameters.collection);

        if (selectedCollection && selectedCollection.fields) {
          const fieldSchema: Record<string, SchemaField> = {};
          selectedCollection.fields.forEach((field: SchemaField) => {
            fieldSchema[field.name] = field;
          });
          // Ensure _internal exists before setting properties
          if (!node._internal) {
            node._internal = {};
          }
          node._internal.fieldSchema = fieldSchema;
        }

        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.backendServices', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.noodl.byob.CreateRecord', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('noodl.byob.CreateRecord')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = CreateRecordNodeModule;
