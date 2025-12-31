/**
 * BYOB Create Record Node
 *
 * Creates a new record in a BYOB backend collection.
 * Supports Directus system tables and user collections.
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

const ByobUtils = require('./byob-utils');

console.log('[BYOB Create Record] 📦 Module loaded');

var CreateRecordNode = {
  name: 'noodl.byob.CreateRecord',
  displayNodeName: 'Create Record',
  docs: 'https://docs.noodl.net/nodes/data/byob/create-record',
  category: 'Data',
  color: 'data',
  searchTags: ['byob', 'create', 'insert', 'add', 'data', 'database', 'records', 'directus', 'api', 'backend'],

  initialize: function () {
    console.log('[BYOB Create Record] 🚀 INITIALIZE called');
    this._internal.fieldValues = {};
    this._internal.loading = false;
    this._internal.apiPathMode = 'items';
  },

  getInspectInfo() {
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
      valueChangedToTrue: function () {
        console.log('[BYOB Create Record] ⚡ CREATE SIGNAL RECEIVED');
        this.scheduleCreate();
      }
    }
  },

  outputs: {
    record: {
      type: 'object',
      displayName: 'Record',
      group: 'Results',
      getter: function () {
        return this._internal.record;
      }
    },
    recordId: {
      type: 'string',
      displayName: 'Record ID',
      group: 'Results',
      getter: function () {
        return this._internal.recordId;
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
    /**
     * Store field value (for dynamic field inputs)
     */
    _storeFieldValue: function (name, value) {
      this._internal.fieldValues[name] = value;
    },

    /**
     * Resolve the backend configuration from metadata
     */
    resolveBackend: function () {
      const backendId = this._internal.backendId || '_active_';
      return ByobUtils.resolveBackend(backendId);
    },

    scheduleCreate: function () {
      console.log('[BYOB Create Record] scheduleCreate called');
      if (this._internal.hasScheduledCreate) {
        console.log('[BYOB Create Record] Already scheduled, skipping');
        return;
      }
      this._internal.hasScheduledCreate = true;
      this.scheduleAfterInputsHaveUpdated(this.doCreate.bind(this));
    },

    doCreate: function () {
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
      const body = {};
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
              .then((errorBody) => {
                throw {
                  status: response.status,
                  statusText: response.statusText,
                  body: errorBody
                };
              })
              .catch((parseError) => {
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
          console.log('[BYOB Create Record] Response received');

          // Directus response format: { data: {...} }
          this._internal.record = data.data || data;
          this._internal.recordId = this._internal.record?.id || null;
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
        .catch((error) => {
          console.error('[BYOB Create Record] Error:', error);

          this._internal.loading = false;
          this._internal.record = null;
          this._internal.recordId = null;

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

    registerInputIfNeeded: function (name) {
      if (this.hasInput(name)) return;

      // Map of configuration input names to their setters
      const configSetters = {
        backendId: (value) => {
          this._internal.backendId = value;
        },
        collection: (value) => {
          this._internal.collection = value;
        },
        apiPathMode: (value) => {
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
          set: (value) => {
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
    group: 'Configuration'
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

  // NOTE: 'create' signal is defined in static inputs
  // Outputs
  ports.push({
    name: 'record',
    displayName: 'Record',
    type: 'object',
    plug: 'output',
    group: 'Results'
  });

  ports.push({
    name: 'recordId',
    displayName: 'Record ID',
    type: 'string',
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
  node: CreateRecordNode,
  setup: function (context, graphModel) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node) {
      // Store field schema in node for value normalization
      const backendServices = graphModel.getMetaData('backendServices') || { backends: [] };
      const backends = backendServices.backends || [];
      const selectedBackendId =
        node.parameters.backendId === '_active_' || !node.parameters.backendId
          ? backendServices.activeBackendId
          : node.parameters.backendId;
      const selectedBackend = backends.find((b) => b.id === selectedBackendId);
      const allCollections = selectedBackend?.schema?.collections || [];
      const selectedCollection = allCollections.find((c) => c.name === node.parameters.collection);

      if (selectedCollection && selectedCollection.fields) {
        const fieldSchema = {};
        selectedCollection.fields.forEach((field) => {
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
        const backendServices = graphModel.getMetaData('backendServices') || { backends: [] };
        const backends = backendServices.backends || [];
        const selectedBackendId =
          node.parameters.backendId === '_active_' || !node.parameters.backendId
            ? backendServices.activeBackendId
            : node.parameters.backendId;
        const selectedBackend = backends.find((b) => b.id === selectedBackendId);
        const allCollections = selectedBackend?.schema?.collections || [];
        const selectedCollection = allCollections.find((c) => c.name === node.parameters.collection);

        if (selectedCollection && selectedCollection.fields) {
          const fieldSchema = {};
          selectedCollection.fields.forEach((field) => {
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
      graphModel.on('nodeAdded.noodl.byob.CreateRecord', function (node) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('noodl.byob.CreateRecord')) {
        _managePortsForNode(node);
      }
    });
  }
};
