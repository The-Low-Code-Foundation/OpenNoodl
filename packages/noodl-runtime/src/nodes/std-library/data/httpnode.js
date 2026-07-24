/**
 * HTTP Node
 *
 * A modern, declarative HTTP node that makes API integration accessible to
 * no-coders while remaining powerful for developers. This replaces the
 * script-based REST node for most use cases.
 *
 * Features:
 * - URL with path parameter detection (/users/{userId})
 * - Visual headers, query params, and body configuration
 * - Authentication presets (Bearer, Basic, API Key)
 * - Response mapping with JSONPath
 * - cURL import support
 * - Pagination strategies
 *
 * @module noodl-runtime
 * @since 2.0.0
 */

// Note: This file uses CommonJS module format to match the noodl-runtime pattern

// DEBUG: Confirm module is loaded
console.log('[HTTP Node Module] 📦 httpnode.js MODULE LOADED');

/**
 * Extract value from object using JSONPath-like syntax
 * Supports: $.data.users, $.items[0].name, $.meta.pagination.total
 *
 * @param {object} obj - The object to extract from
 * @param {string} path - JSONPath expression starting with $
 * @returns {*} The extracted value or undefined
 */
function extractByPath(obj, path) {
  if (!path || !path.startsWith('$')) return undefined;
  if (obj === undefined || obj === null) return undefined;

  const parts = path.substring(2).split('.').filter(Boolean);
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;

    // Handle array access: items[0]
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Configure authentication headers/params based on preset type
 */
const authConfigurators = {
  none: () => ({}),

  bearer: (inputs) => ({
    headers: inputs.authToken ? { Authorization: `Bearer ${inputs.authToken}` } : {}
  }),

  basic: (inputs) => {
    if (!inputs.authUsername || !inputs.authPassword) return {};
    const encoded =
      typeof btoa !== 'undefined'
        ? btoa(inputs.authUsername + ':' + inputs.authPassword)
        : Buffer.from(inputs.authUsername + ':' + inputs.authPassword).toString('base64');
    return {
      headers: { Authorization: `Basic ${encoded}` }
    };
  },

  apiKey: (inputs) => {
    if (!inputs.authApiKeyName || !inputs.authApiKeyValue) return {};
    if (inputs.authApiKeyLocation === 'query') {
      return { queryParams: { [inputs.authApiKeyName]: inputs.authApiKeyValue } };
    }
    return { headers: { [inputs.authApiKeyName]: inputs.authApiKeyValue } };
  }
};

var HttpNode = {
  name: 'net.noodl.HTTP',
  displayNodeName: 'HTTP Request',
  docs: 'https://docs.noodl.net/nodes/data/http-request',
  category: 'Data',
  color: 'data',
  searchTags: ['http', 'request', 'fetch', 'api', 'rest', 'curl'],

  initialize: function () {
    this._internal.inputValues = {};
    this._internal.outputValues = {};
    this._internal.headers = '';
    this._internal.queryParams = '';
    this._internal.bodyFields = '';
    this._internal.responseMapping = '';
    this._internal.inspectData = null;
  },

  getInspectInfo() {
    if (!this._internal.inspectData) {
      return { type: 'text', value: '[Not executed yet]' };
    }
    return { type: 'value', value: this._internal.inspectData };
  },

  inputs: {
    // Static inputs - these don't need to trigger port regeneration
    url: {
      type: 'string',
      displayName: 'URL',
      group: 'Request',
      default: '',
      set: function (value) {
        this._internal.url = value;
      }
    },
    fetch: {
      type: 'signal',
      displayName: 'Fetch',
      group: 'Actions',
      valueChangedToTrue: function () {
        this.scheduleFetch();
      }
    },
    cancel: {
      type: 'signal',
      displayName: 'Cancel',
      group: 'Actions',
      valueChangedToTrue: function () {
        this.cancelFetch();
      }
    }
    // Note: method, timeout, and config ports are now dynamic (in updatePorts)
  },

  outputs: {
    response: {
      type: '*',
      displayName: 'Response',
      group: 'Response',
      getter: function () {
        return this._internal.response;
      }
    },
    statusCode: {
      type: 'number',
      displayName: 'Status Code',
      group: 'Response',
      getter: function () {
        return this._internal.statusCode;
      }
    },
    responseHeaders: {
      type: 'object',
      displayName: 'Response Headers',
      group: 'Response',
      getter: function () {
        return this._internal.responseHeaders;
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
    },
    canceled: {
      type: 'signal',
      displayName: 'Canceled',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter: function () {
        return this._internal.error;
      }
    }
  },

  prototypeExtensions: {
    // Store values for dynamic inputs only - static inputs (including signals)
    // use the base Node.prototype.setInputValue which calls input.set()
    _storeInputValue: function (name, value) {
      this._internal.inputValues[name] = value;
    },

    getOutputValue: function (name) {
      return this._internal.outputValues[name];
    },

    registerOutputIfNeeded: function (name) {
      if (this.hasOutput(name)) return;

      if (name.startsWith('out-')) {
        this.registerOutput(name, {
          getter: this.getOutputValue.bind(this, name)
        });
      }
    },

    registerInputIfNeeded: function (name) {
      if (this.hasInput(name)) return;

      // Configuration inputs - these set internal state
      const configSetters = {
        method: this.setMethod.bind(this),
        timeout: this.setTimeout.bind(this),
        headers: this.setHeaders.bind(this),
        queryParams: this.setQueryParams.bind(this),
        bodyType: this.setBodyType.bind(this),
        bodyFields: this.setBodyFields.bind(this),
        authType: this.setAuthType.bind(this),
        responseMapping: this.setResponseMapping.bind(this)
      };

      if (configSetters[name]) {
        return this.registerInput(name, {
          set: configSetters[name]
        });
      }

      // Dynamic inputs for path params, headers, query params, body fields, auth, mapping paths
      // These use _storeInputValue to just store values (no signal trigger needed)
      const dynamicPrefixes = ['path-', 'header-', 'query-', 'body-', 'auth-', 'mapping-path-'];

      for (const prefix of dynamicPrefixes) {
        if (name.startsWith(prefix)) {
          return this.registerInput(name, {
            set: this._storeInputValue.bind(this, name)
          });
        }
      }
    },

    scheduleFetch: function () {
      console.log('[HTTP Node] scheduleFetch called');
      if (this._internal.hasScheduledFetch) {
        console.log('[HTTP Node] Already scheduled, skipping');
        return;
      }
      this._internal.hasScheduledFetch = true;
      console.log('[HTTP Node] Scheduling doFetch after inputs update');
      this.scheduleAfterInputsHaveUpdated(this.doFetch.bind(this));
    },

    cancelFetch: function () {
      if (this._internal.abortController) {
        this._internal.abortController.abort();
        this._internal.abortController = null;
      }
    },

    buildUrl: function () {
      let url = this._internal.url || '';

      // Replace path parameters: /users/{userId} → /users/123
      const pathParams = url.match(/\{([A-Za-z0-9_]+)\}/g) || [];
      for (const param of pathParams) {
        const name = param.replace(/[{}]/g, '');
        const value = this._internal.inputValues['path-' + name];
        if (value !== undefined && value !== null) {
          url = url.replace(param, encodeURIComponent(String(value)));
        }
      }

      // Add query parameters
      const queryParams = {};

      // From visual config (stringlist format)
      if (this._internal.queryParams) {
        const queryList = this._internal.queryParams
          .split(',')
          .map((q) => q.trim())
          .filter(Boolean);
        for (const qp of queryList) {
          const value = this._internal.inputValues['query-' + qp];
          if (value !== undefined && value !== null && value !== '') {
            queryParams[qp] = value;
          }
        }
      }

      // From auth (API Key in query)
      const authType = this._internal.authType;
      if (authType && authConfigurators[authType]) {
        const authConfig = authConfigurators[authType](this._internal.inputValues);
        if (authConfig.queryParams) {
          Object.assign(queryParams, authConfig.queryParams);
        }
      }

      // Append query string
      const queryString = Object.entries(queryParams)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join('&');

      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }

      return url;
    },

    buildHeaders: function () {
      const headers = {};

      // From visual config (stringlist format)
      if (this._internal.headers) {
        const headerList = this._internal.headers
          .split(',')
          .map((h) => h.trim())
          .filter(Boolean);
        for (const h of headerList) {
          const value = this._internal.inputValues['header-' + h];
          if (value !== undefined && value !== null) {
            headers[h] = String(value);
          }
        }
      }

      // From auth
      const authType = this._internal.authType;
      if (authType && authConfigurators[authType]) {
        const authConfig = authConfigurators[authType](this._internal.inputValues);
        if (authConfig.headers) {
          Object.assign(headers, authConfig.headers);
        }
      }

      return headers;
    },

    buildBody: function () {
      const method = this._internal.method || 'GET';
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return undefined;
      }

      const bodyType = this._internal.bodyType || 'json';
      const bodyFieldsStr = this._internal.bodyFields || '';

      // Parse stringlist format
      const bodyFields = bodyFieldsStr
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

      if (bodyType === 'json') {
        const body = {};
        for (const field of bodyFields) {
          const value = this._internal.inputValues['body-' + field];
          if (value !== undefined) {
            body[field] = value;
          }
        }
        return Object.keys(body).length > 0 ? JSON.stringify(body) : undefined;
      } else if (bodyType === 'form') {
        const formData = new FormData();
        for (const field of bodyFields) {
          const value = this._internal.inputValues['body-' + field];
          if (value !== undefined && value !== null) {
            formData.append(field, value);
          }
        }
        return formData;
      } else if (bodyType === 'urlencoded') {
        const params = new URLSearchParams();
        for (const field of bodyFields) {
          const value = this._internal.inputValues['body-' + field];
          if (value !== undefined && value !== null) {
            params.append(field, String(value));
          }
        }
        return params.toString();
      } else if (bodyType === 'raw') {
        return this._internal.inputValues['body-raw'];
      }

      return undefined;
    },

    processResponse: function (response, responseBody) {
      // Store raw response
      this._internal.response = responseBody;
      this._internal.statusCode = response.status;

      // Extract response headers
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      this._internal.responseHeaders = responseHeaders;

      // Process response mappings
      // Output names are in responseMapping (comma-separated)
      // Path for each output is in inputValues['mapping-path-{name}']
      const mappingStr = this._internal.responseMapping || '';
      const outputNames = mappingStr
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);

      for (const name of outputNames) {
        // Get the path from the corresponding input port
        const path = this._internal.inputValues['mapping-path-' + name] || '$';

        const outputName = 'out-' + name;
        const value = extractByPath(responseBody, path);

        this.registerOutputIfNeeded(outputName);
        this._internal.outputValues[outputName] = value;
        this.flagOutputDirty(outputName);
      }

      // Flag standard outputs
      this.flagOutputDirty('response');
      this.flagOutputDirty('statusCode');
      this.flagOutputDirty('responseHeaders');

      // Update inspect data
      this._internal.inspectData = {
        url: this._internal.lastRequestUrl,
        method: this._internal.method,
        status: response.status,
        response: responseBody
      };
    },

    doFetch: function () {
      console.log('[HTTP Node] doFetch executing');
      this._internal.hasScheduledFetch = false;

      const url = this.buildUrl();
      const method = this._internal.method || 'GET';
      const headers = this.buildHeaders();
      const body = this.buildBody();
      const timeout = this._internal.timeout || 30000;

      console.log('[HTTP Node] Request details:', {
        url,
        method,
        headers,
        body: body ? '(has body)' : '(no body)',
        timeout
      });

      // Store for inspect
      this._internal.lastRequestUrl = url;

      // Validate URL
      if (!url) {
        console.log('[HTTP Node] No URL provided, sending failure');
        this._internal.error = 'URL is required';
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
        return;
      }

      // Set up abort controller for timeout and cancel
      const abortController = new AbortController();
      this._internal.abortController = abortController;

      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, timeout);

      // Set Content-Type for JSON body if not already set
      const bodyType = this._internal.bodyType || 'json';
      if (body && bodyType === 'json' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      } else if (body && bodyType === 'urlencoded' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }

      // Perform fetch
      fetch(url, {
        method: method,
        headers: headers,
        body: body,
        signal: abortController.signal
      })
        .then((response) => {
          clearTimeout(timeoutId);
          this._internal.abortController = null;

          // Parse response based on content type
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            return response.json().then((json) => ({ response, body: json }));
          } else {
            return response.text().then((text) => ({ response, body: text }));
          }
        })
        .then(({ response, body }) => {
          this.processResponse(response, body);

          // Send success/failure signal based on status
          if (response.ok) {
            this.sendSignalOnOutput('success');
          } else {
            this._internal.error = `HTTP ${response.status}: ${response.statusText}`;
            this.flagOutputDirty('error');
            this.sendSignalOnOutput('failure');
          }
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          this._internal.abortController = null;

          if (error.name === 'AbortError') {
            this.sendSignalOnOutput('canceled');
          } else {
            this._internal.error = error.message || 'Network error';
            this.flagOutputDirty('error');
            this.sendSignalOnOutput('failure');
          }

          this._internal.inspectData = {
            url: this._internal.lastRequestUrl,
            method: method,
            error: this._internal.error
          };
        });
    },

    // Configuration setters called from setup function
    setHeaders: function (value) {
      this._internal.headers = value || '';
    },

    setQueryParams: function (value) {
      this._internal.queryParams = value || '';
    },

    setBodyType: function (value) {
      this._internal.bodyType = value;
    },

    setBodyFields: function (value) {
      this._internal.bodyFields = value || '';
    },

    setResponseMapping: function (value) {
      this._internal.responseMapping = value || '';
    },

    setAuthType: function (value) {
      this._internal.authType = value;
    },

    setMethod: function (value) {
      this._internal.method = value || 'GET';
    },

    setTimeout: function (value) {
      this._internal.timeout = value || 30000;
    }
  }
};

/**
 * Update dynamic ports based on node configuration
 */
function updatePorts(nodeId, parameters, editorConnection) {
  const ports = [];

  // Parse URL for path parameters: /users/{userId} → userId port
  if (parameters.url) {
    const pathParams = parameters.url.match(/\{([A-Za-z0-9_]+)\}/g) || [];
    const uniqueParams = [...new Set(pathParams.map((p) => p.replace(/[{}]/g, '')))];

    for (const name of uniqueParams) {
      ports.push({
        name: 'path-' + name,
        displayName: name,
        type: 'string',
        plug: 'input',
        group: 'Path Parameters'
      });
    }
  }

  // Headers configuration - comma-separated list
  ports.push({
    name: 'headers',
    displayName: 'Headers',
    type: { name: 'stringlist', allowEditOnly: true },
    plug: 'input',
    group: 'Headers'
  });

  // Generate input ports for each header
  if (parameters.headers) {
    const headerList = parameters.headers
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    for (const header of headerList) {
      ports.push({
        name: 'header-' + header,
        displayName: header,
        type: 'string',
        plug: 'input',
        group: 'Headers'
      });
    }
  }

  // Query parameters configuration - comma-separated list
  ports.push({
    name: 'queryParams',
    displayName: 'Query Parameters',
    type: { name: 'stringlist', allowEditOnly: true },
    plug: 'input',
    group: 'Query Parameters'
  });

  // Generate input ports for each query param
  if (parameters.queryParams) {
    const queryList = parameters.queryParams
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean);
    for (const param of queryList) {
      ports.push({
        name: 'query-' + param,
        displayName: param,
        type: 'string',
        plug: 'input',
        group: 'Query Parameters'
      });
    }
  }

  // Method selector as dynamic port (so we can track parameter changes properly)
  ports.push({
    name: 'method',
    displayName: 'Method',
    type: {
      name: 'enum',
      enums: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'PATCH', value: 'PATCH' },
        { label: 'DELETE', value: 'DELETE' },
        { label: 'HEAD', value: 'HEAD' },
        { label: 'OPTIONS', value: 'OPTIONS' }
      ],
      allowEditOnly: true
    },
    default: 'GET',
    plug: 'input',
    group: 'Request'
  });

  // Body type selector (only shown for POST/PUT/PATCH)
  const method = parameters.method || 'GET';
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    ports.push({
      name: 'bodyType',
      displayName: 'Body Type',
      type: {
        name: 'enum',
        enums: [
          { label: 'JSON', value: 'json' },
          { label: 'Form Data', value: 'form' },
          { label: 'URL Encoded', value: 'urlencoded' },
          { label: 'Raw', value: 'raw' }
        ],
        allowEditOnly: true
      },
      default: 'json',
      plug: 'input',
      group: 'Body'
    });

    // Body fields configuration - comma-separated list
    const bodyType = parameters.bodyType || 'json';
    if (bodyType === 'json' || bodyType === 'form' || bodyType === 'urlencoded') {
      ports.push({
        name: 'bodyFields',
        displayName: 'Body Fields',
        type: { name: 'stringlist', allowEditOnly: true },
        plug: 'input',
        group: 'Body'
      });

      // Type options for body fields
      const _types = [
        { label: 'String', value: 'string' },
        { label: 'Number', value: 'number' },
        { label: 'Boolean', value: 'boolean' },
        { label: 'Array', value: 'array' },
        { label: 'Object', value: 'object' },
        { label: 'Any', value: '*' }
      ];

      // Generate type selector and value input ports for each body field
      if (parameters.bodyFields) {
        const fieldList = parameters.bodyFields
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
        for (const field of fieldList) {
          // Get the selected type for this field (default to string)
          const fieldType = parameters['body-type-' + field] || 'string';

          // Type selector for this field
          ports.push({
            name: 'body-type-' + field,
            displayName: field + ' Type',
            type: {
              name: 'enum',
              enums: _types,
              allowEditOnly: true
            },
            default: 'string',
            plug: 'input',
            group: 'Body'
          });

          // Value input for this field (type matches selected type)
          ports.push({
            name: 'body-' + field,
            displayName: field,
            type: fieldType,
            plug: 'input',
            group: 'Body'
          });
        }
      }
    } else if (bodyType === 'raw') {
      // Raw body - use code editor with JSON syntax
      ports.push({
        name: 'body-raw',
        displayName: 'Body',
        type: { name: 'string', allowEditOnly: true, codeeditor: 'json' },
        plug: 'input',
        group: 'Body'
      });
    }
  }

  // Authentication
  ports.push({
    name: 'authType',
    displayName: 'Authentication',
    type: {
      name: 'enum',
      enums: [
        { label: 'None', value: 'none' },
        { label: 'Bearer Token', value: 'bearer' },
        { label: 'Basic Auth', value: 'basic' },
        { label: 'API Key', value: 'apiKey' }
      ],
      allowEditOnly: true
    },
    default: 'none',
    plug: 'input',
    group: 'Authentication'
  });

  // Auth-specific inputs
  const authType = parameters.authType || 'none';
  if (authType === 'bearer') {
    ports.push({
      name: 'auth-authToken',
      displayName: 'Token',
      type: 'string',
      plug: 'input',
      group: 'Authentication'
    });
  } else if (authType === 'basic') {
    ports.push({
      name: 'auth-authUsername',
      displayName: 'Username',
      type: 'string',
      plug: 'input',
      group: 'Authentication'
    });
    ports.push({
      name: 'auth-authPassword',
      displayName: 'Password',
      type: 'string',
      plug: 'input',
      group: 'Authentication'
    });
  } else if (authType === 'apiKey') {
    ports.push({
      name: 'auth-authApiKeyName',
      displayName: 'Key Name',
      type: 'string',
      plug: 'input',
      group: 'Authentication'
    });
    ports.push({
      name: 'auth-authApiKeyValue',
      displayName: 'Key Value',
      type: 'string',
      plug: 'input',
      group: 'Authentication'
    });
    ports.push({
      name: 'auth-authApiKeyLocation',
      displayName: 'Add To',
      type: {
        name: 'enum',
        enums: [
          { label: 'Header', value: 'header' },
          { label: 'Query Parameter', value: 'query' }
        ]
      },
      default: 'header',
      plug: 'input',
      group: 'Authentication'
    });
  }

  // Timeout setting
  ports.push({
    name: 'timeout',
    displayName: 'Timeout (ms)',
    type: 'number',
    default: 30000,
    plug: 'input',
    group: 'Request'
  });

  // Response mapping - add output names, then specify JSONPath for each
  // User adds output names like: userId, userName, totalCount
  // For each name, we generate a "Path" input and an output port
  ports.push({
    name: 'responseMapping',
    displayName: 'Output Fields',
    type: { name: 'stringlist', allowEditOnly: true },
    plug: 'input',
    group: 'Response Mapping'
  });

  // Signal inputs - MUST be in dynamic ports for editor to show them
  ports.push({
    name: 'fetch',
    displayName: 'Fetch',
    type: 'signal',
    plug: 'input',
    group: 'Actions'
  });

  ports.push({
    name: 'cancel',
    displayName: 'Cancel',
    type: 'signal',
    plug: 'input',
    group: 'Actions'
  });

  // URL input - also needs to be in dynamic ports
  ports.push({
    name: 'url',
    displayName: 'URL',
    type: 'string',
    plug: 'input',
    group: 'Request'
  });

  // Generate path input ports and output ports for each response mapping
  if (parameters.responseMapping && typeof parameters.responseMapping === 'string') {
    const outputNames = parameters.responseMapping
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    for (const name of outputNames) {
      // Path input port for specifying JSONPath (e.g., $.data.id)
      ports.push({
        name: 'mapping-path-' + name,
        displayName: name + ' Path',
        type: 'string',
        default: '$',
        plug: 'input',
        group: 'Response Mapping'
      });

      // Output port for the extracted value
      ports.push({
        name: 'out-' + name,
        displayName: name,
        type: '*',
        plug: 'output',
        group: 'Response'
      });
    }
  }

  // Standard outputs
  ports.push({
    name: 'response',
    displayName: 'Response',
    type: '*',
    plug: 'output',
    group: 'Response'
  });

  ports.push({
    name: 'statusCode',
    displayName: 'Status Code',
    type: 'number',
    plug: 'output',
    group: 'Response'
  });

  ports.push({
    name: 'responseHeaders',
    displayName: 'Response Headers',
    type: 'object',
    plug: 'output',
    group: 'Response'
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

  ports.push({
    name: 'canceled',
    displayName: 'Canceled',
    type: 'signal',
    plug: 'output',
    group: 'Events'
  });

  ports.push({
    name: 'error',
    displayName: 'Error',
    type: 'string',
    plug: 'output',
    group: 'Events'
  });

  editorConnection.sendDynamicPorts(nodeId, ports);
}

module.exports = {
  node: HttpNode,
  setup: function (context, graphModel) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node) {
      updatePorts(node.id, node.parameters || {}, context.editorConnection);

      node.on('parameterUpdated', function (event) {
        // Update ports when configuration changes
        if (
          event.name === 'url' ||
          event.name === 'method' ||
          event.name === 'headers' ||
          event.name === 'queryParams' ||
          event.name === 'bodyType' ||
          event.name === 'bodyFields' ||
          event.name === 'authType' ||
          event.name === 'responseMapping' ||
          event.name.startsWith('body-type-') // Body field type changes
        ) {
          updatePorts(node.id, node.parameters, context.editorConnection);
        }
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.net.noodl.HTTP', function (node) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('net.noodl.HTTP')) {
        _managePortsForNode(node);
      }
    });
  }
};
