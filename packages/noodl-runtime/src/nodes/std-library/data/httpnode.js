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
    this._internal.headers = [];
    this._internal.queryParams = [];
    this._internal.bodyFields = [];
    this._internal.responseMapping = [];
    this._internal.inspectData = null;
  },

  getInspectInfo() {
    if (!this._internal.inspectData) {
      return { type: 'text', value: '[Not executed yet]' };
    }
    return { type: 'value', value: this._internal.inspectData };
  },

  inputs: {
    url: {
      type: 'string',
      displayName: 'URL',
      group: 'Request',
      default: '',
      set: function (value) {
        this._internal.url = value;
      }
    },
    method: {
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
        ]
      },
      displayName: 'Method',
      group: 'Request',
      default: 'GET',
      set: function (value) {
        this._internal.method = value;
      }
    },
    timeout: {
      type: 'number',
      displayName: 'Timeout (ms)',
      group: 'Request',
      default: 30000,
      set: function (value) {
        this._internal.timeout = value;
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
    setInputValue: function (name, value) {
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

      // Dynamic inputs for path params, headers, query params, body fields, auth
      const inputSetters = {
        path: this.setInputValue.bind(this),
        header: this.setInputValue.bind(this),
        query: this.setInputValue.bind(this),
        body: this.setInputValue.bind(this),
        auth: this.setInputValue.bind(this)
      };

      for (const [prefix, setter] of Object.entries(inputSetters)) {
        if (name.startsWith(prefix + '-')) {
          return this.registerInput(name, { set: setter.bind(this, name) });
        }
      }
    },

    scheduleFetch: function () {
      if (this._internal.hasScheduledFetch) return;
      this._internal.hasScheduledFetch = true;
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

      // From visual config
      if (this._internal.queryParams) {
        for (const qp of this._internal.queryParams) {
          const value = this._internal.inputValues['query-' + qp.key];
          if (value !== undefined && value !== null && value !== '') {
            queryParams[qp.key] = value;
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

      // From visual config
      if (this._internal.headers) {
        for (const h of this._internal.headers) {
          const value = this._internal.inputValues['header-' + h.key];
          if (value !== undefined && value !== null) {
            headers[h.key] = String(value);
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
      const bodyFields = this._internal.bodyFields || [];

      if (bodyType === 'json') {
        const body = {};
        for (const field of bodyFields) {
          const value = this._internal.inputValues['body-' + field.key];
          if (value !== undefined) {
            body[field.key] = value;
          }
        }
        return Object.keys(body).length > 0 ? JSON.stringify(body) : undefined;
      } else if (bodyType === 'form') {
        const formData = new FormData();
        for (const field of bodyFields) {
          const value = this._internal.inputValues['body-' + field.key];
          if (value !== undefined && value !== null) {
            formData.append(field.key, value);
          }
        }
        return formData;
      } else if (bodyType === 'urlencoded') {
        const params = new URLSearchParams();
        for (const field of bodyFields) {
          const value = this._internal.inputValues['body-' + field.key];
          if (value !== undefined && value !== null) {
            params.append(field.key, String(value));
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
      const mappings = this._internal.responseMapping || [];
      for (const mapping of mappings) {
        const outputName = 'out-' + mapping.name;
        const value = extractByPath(responseBody, mapping.path);

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
      this._internal.hasScheduledFetch = false;

      const url = this.buildUrl();
      const method = this._internal.method || 'GET';
      const headers = this.buildHeaders();
      const body = this.buildBody();
      const timeout = this._internal.timeout || 30000;

      // Store for inspect
      this._internal.lastRequestUrl = url;

      // Validate URL
      if (!url) {
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
      this._internal.headers = value || [];
    },

    setQueryParams: function (value) {
      this._internal.queryParams = value || [];
    },

    setBodyType: function (value) {
      this._internal.bodyType = value;
    },

    setBodyFields: function (value) {
      this._internal.bodyFields = value || [];
    },

    setResponseMapping: function (value) {
      this._internal.responseMapping = value || [];
    },

    setAuthType: function (value) {
      this._internal.authType = value;
    }
  }
};

/**
 * Update dynamic ports based on node configuration
 */
function updatePorts(nodeId, parameters, editorConnection) {
  const ports = [];

  // URL input (already defined in static inputs, but we want it first)
  ports.push({
    name: 'url',
    displayName: 'URL',
    type: 'string',
    plug: 'input',
    group: 'Request'
  });

  // Method input
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
      ]
    },
    default: 'GET',
    plug: 'input',
    group: 'Request'
  });

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

  // Headers configuration
  ports.push({
    name: 'headers',
    displayName: 'Headers',
    type: { name: 'stringlist', allowEditOnly: true },
    plug: 'input',
    group: 'Headers'
  });

  // Generate input ports for each header
  if (parameters.headers && Array.isArray(parameters.headers)) {
    for (const header of parameters.headers) {
      if (header.key) {
        ports.push({
          name: 'header-' + header.key,
          displayName: header.key,
          type: 'string',
          plug: 'input',
          group: 'Headers'
        });
      }
    }
  }

  // Query parameters configuration
  ports.push({
    name: 'queryParams',
    displayName: 'Query Parameters',
    type: { name: 'stringlist', allowEditOnly: true },
    plug: 'input',
    group: 'Query Parameters'
  });

  // Generate input ports for each query param
  if (parameters.queryParams && Array.isArray(parameters.queryParams)) {
    for (const param of parameters.queryParams) {
      if (param.key) {
        ports.push({
          name: 'query-' + param.key,
          displayName: param.key,
          type: '*',
          plug: 'input',
          group: 'Query Parameters'
        });
      }
    }
  }

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

    // Body fields configuration
    const bodyType = parameters.bodyType || 'json';
    if (bodyType === 'json' || bodyType === 'form' || bodyType === 'urlencoded') {
      ports.push({
        name: 'bodyFields',
        displayName: 'Body Fields',
        type: { name: 'stringlist', allowEditOnly: true },
        plug: 'input',
        group: 'Body'
      });

      // Generate input ports for each body field
      if (parameters.bodyFields && Array.isArray(parameters.bodyFields)) {
        for (const field of parameters.bodyFields) {
          if (field.key) {
            ports.push({
              name: 'body-' + field.key,
              displayName: field.key,
              type: '*',
              plug: 'input',
              group: 'Body'
            });
          }
        }
      }
    } else if (bodyType === 'raw') {
      ports.push({
        name: 'body-raw',
        displayName: 'Body',
        type: 'string',
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

  // Response mapping
  ports.push({
    name: 'responseMapping',
    displayName: 'Response Mapping',
    type: { name: 'stringlist', allowEditOnly: true },
    plug: 'input',
    group: 'Response Mapping'
  });

  // Generate output ports for each response mapping
  if (parameters.responseMapping && Array.isArray(parameters.responseMapping)) {
    for (const mapping of parameters.responseMapping) {
      if (mapping.name) {
        ports.push({
          name: 'out-' + mapping.name,
          displayName: mapping.name,
          type: '*',
          plug: 'output',
          group: 'Response'
        });
      }
    }
  }

  // Timeout
  ports.push({
    name: 'timeout',
    displayName: 'Timeout (ms)',
    type: 'number',
    default: 30000,
    plug: 'input',
    group: 'Settings'
  });

  // Actions
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
          event.name === 'responseMapping'
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
