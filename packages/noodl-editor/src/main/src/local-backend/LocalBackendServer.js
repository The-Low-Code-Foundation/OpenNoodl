/**
 * LocalBackendServer
 *
 * Express server providing REST API for local SQLite database operations.
 * This server runs alongside the editor and provides:
 * - Auto-REST endpoints for database tables (/api/:table)
 * - Schema management endpoints
 * - Health check
 * - WebSocket for realtime updates
 *
 * @module local-backend/LocalBackendServer
 */

const http = require('http');
const path = require('path');
const EventEmitter = require('events');

const { WorkflowRunner } = require('./WorkflowRunner');

// Using native http.IncomingMessage handling instead of Express for lighter weight
// This keeps the main process simple and avoids additional dependencies

/**
 * Generate a unique ID for database records
 */
function generateObjectId() {
  return 'obj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Safe console.log wrapper to prevent EPIPE errors
 */
function safeLog(...args) {
  try {
    console.log('[LocalBackend]', ...args);
  } catch (e) {
    // Ignore EPIPE errors
  }
}

/**
 * LocalBackendServer class
 */
class LocalBackendServer {
  /**
   * @param {Object} config
   * @param {string} config.id - Backend ID
   * @param {string} config.name - Backend display name
   * @param {string} config.dbPath - Path to SQLite database
   * @param {number} config.port - Port to listen on
   * @param {string} config.workflowsPath - Path to workflows directory
   * @param {boolean} [config.allowEphemeral] - Opt in to in-memory mode when the
   *   native SQLite engine is unavailable (data will NOT persist). Default false.
   */
  constructor(config) {
    this.config = config;
    this.server = null;
    this.adapter = null;
    this.workflowRunner = null;
    this.events = new EventEmitter();
    this.wsClients = new Set();
  }

  /**
   * Initialize the database adapter
   */
  async initAdapter() {
    // Import adapter dynamically using absolute path to avoid resolution issues
    const adapterPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      '..',
      'noodl-runtime',
      'src',
      'api',
      'adapters',
      'local-sql'
    );
    const { LocalSQLAdapter } = require(adapterPath);
    this.adapter = new LocalSQLAdapter(this.config.dbPath, {
      allowEphemeral: this.config.allowEphemeral === true
    });

    // connect() throws LocalBackendPersistenceError when the native engine is
    // unavailable and ephemeral mode was not opted into. Let it propagate so
    // start() — and therefore backend:start — fails loudly instead of silently
    // running on a mock that loses data on restart.
    await this.adapter.connect();

    // Forward adapter events to WebSocket clients
    this.adapter.on('create', (data) => this.broadcast('create', data));
    this.adapter.on('save', (data) => this.broadcast('save', data));
    this.adapter.on('delete', (data) => this.broadcast('delete', data));
  }

  /**
   * Report how this backend's adapter is persisting data.
   * @returns {{ mode: string, persistent: boolean, ephemeral: boolean, engine: string, error: object|null }}
   */
  getPersistenceStatus() {
    if (this.adapter && typeof this.adapter.getPersistenceStatus === 'function') {
      return this.adapter.getPersistenceStatus();
    }
    return { mode: 'unknown', persistent: false, ephemeral: false, engine: 'better-sqlite3', error: null };
  }

  /**
   * Parse JSON body from request
   */
  parseBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        // Limit body size to 10MB
        if (body.length > 10 * 1024 * 1024) {
          reject(new Error('Request body too large'));
        }
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * Send JSON response
   */
  sendJSON(res, status, data, headers = {}) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Content-Length': Buffer.byteLength(body),
      ...headers
    });
    res.end(body);
  }

  /**
   * Send error response
   */
  sendError(res, status, message) {
    this.sendJSON(res, status, { error: message });
  }

  /**
   * Parse URL and query parameters
   */
  parseURL(url) {
    const [pathname, queryString] = url.split('?');
    const query = {};
    if (queryString) {
      queryString.split('&').forEach((pair) => {
        const [key, value] = pair.split('=');
        query[decodeURIComponent(key)] = decodeURIComponent(value || '');
      });
    }
    return { pathname, query };
  }

  /**
   * Handle incoming HTTP requests
   */
  async handleRequest(req, res) {
    const { pathname, query } = this.parseURL(req.url);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
    }

    try {
      // Route: Health check
      if (pathname === '/health' && req.method === 'GET') {
        return this.sendJSON(res, 200, {
          status: 'ok',
          backend: this.config.name,
          id: this.config.id,
          port: this.config.port
        });
      }

      // Route: Schema
      if (pathname === '/api/_schema') {
        if (req.method === 'GET') {
          return await this.handleGetSchema(res);
        }
        if (req.method === 'POST') {
          const body = await this.parseBody(req);
          return await this.handleUpdateSchema(res, body);
        }
      }

      // Route: Batch operations
      if (pathname === '/api/_batch' && req.method === 'POST') {
        const body = await this.parseBody(req);
        return await this.handleBatch(res, body);
      }

      // Route: Table operations (/api/:table)
      const tableMatch = pathname.match(/^\/api\/([^/]+)$/);
      if (tableMatch) {
        const table = decodeURIComponent(tableMatch[1]);

        if (req.method === 'GET') {
          return await this.handleQuery(res, table, query);
        }
        if (req.method === 'POST') {
          const body = await this.parseBody(req);
          return await this.handleCreate(res, table, body);
        }
      }

      // Route: Record operations (/api/:table/:id)
      const recordMatch = pathname.match(/^\/api\/([^/]+)\/([^/]+)$/);
      if (recordMatch) {
        const table = decodeURIComponent(recordMatch[1]);
        const id = decodeURIComponent(recordMatch[2]);

        if (req.method === 'GET') {
          return await this.handleFetch(res, table, id);
        }
        if (req.method === 'PUT') {
          const body = await this.parseBody(req);
          return await this.handleSave(res, table, id, body);
        }
        if (req.method === 'DELETE') {
          return await this.handleDelete(res, table, id);
        }
      }

      // Route: Cloud Functions (/functions/:name) - placeholder for CloudRunner
      const functionMatch = pathname.match(/^\/functions\/([^/]+)$/);
      if (functionMatch && req.method === 'POST') {
        const functionName = decodeURIComponent(functionMatch[1]);
        const body = await this.parseBody(req);
        return await this.handleFunction(res, functionName, body, req.headers);
      }

      // 404 for unmatched routes
      this.sendError(res, 404, 'Not found');
    } catch (error) {
      safeLog('Request error:', error);
      this.sendError(res, 500, error.message);
    }
  }

  // ==========================================================================
  // ROUTE HANDLERS
  // ==========================================================================

  /**
   * GET /api/:table - Query records
   */
  async handleQuery(res, table, query) {
    const options = {
      collection: table,
      limit: query.limit ? parseInt(query.limit) : 100,
      skip: query.skip ? parseInt(query.skip) : 0
    };

    if (query.where) {
      try {
        options.where = JSON.parse(query.where);
      } catch (e) {
        return this.sendError(res, 400, 'Invalid where parameter');
      }
    }

    if (query.sort) {
      try {
        options.sort = JSON.parse(query.sort);
      } catch (e) {
        return this.sendError(res, 400, 'Invalid sort parameter');
      }
    }

    if (query.include) {
      options.include = query.include.split(',');
    }

    const results = await this.adapter.query(options);
    this.sendJSON(res, 200, { results, count: results.length });
  }

  /**
   * GET /api/:table/:id - Fetch single record
   */
  async handleFetch(res, table, id) {
    const record = await this.adapter.fetch({
      collection: table,
      objectId: id
    });

    if (!record) {
      return this.sendError(res, 404, 'Record not found');
    }

    this.sendJSON(res, 200, record);
  }

  /**
   * POST /api/:table - Create record
   */
  async handleCreate(res, table, data) {
    const record = await this.adapter.create({
      collection: table,
      data
    });

    this.sendJSON(res, 201, record);
  }

  /**
   * PUT /api/:table/:id - Update record
   */
  async handleSave(res, table, id, data) {
    await this.adapter.save({
      collection: table,
      objectId: id,
      data
    });

    // Fetch updated record
    const record = await this.adapter.fetch({
      collection: table,
      objectId: id
    });

    this.sendJSON(res, 200, record);
  }

  /**
   * DELETE /api/:table/:id - Delete record
   */
  async handleDelete(res, table, id) {
    await this.adapter.delete({
      collection: table,
      objectId: id
    });

    this.sendJSON(res, 200, { deleted: true, objectId: id });
  }

  /**
   * GET /api/_schema - Get schema
   */
  async handleGetSchema(res) {
    const schema = await this.adapter.getSchema();
    this.sendJSON(res, 200, schema);
  }

  /**
   * POST /api/_schema - Update schema
   */
  async handleUpdateSchema(res, body) {
    const { table, columns, action } = body;

    if (action === 'createTable') {
      await this.adapter.schemaManager.createTable({ name: table, columns });
      return this.sendJSON(res, 200, { success: true, action: 'createTable', table });
    }

    if (action === 'addColumn') {
      await this.adapter.schemaManager.addColumn(table, body.column);
      return this.sendJSON(res, 200, { success: true, action: 'addColumn', table });
    }

    this.sendError(res, 400, 'Unknown schema action');
  }

  /**
   * POST /api/_batch - Batch operations
   */
  async handleBatch(res, body) {
    const { operations } = body;
    if (!Array.isArray(operations)) {
      return this.sendError(res, 400, 'operations must be an array');
    }

    const results = [];
    for (const op of operations) {
      try {
        let result;
        switch (op.method) {
          case 'create':
            result = await this.adapter.create({
              collection: op.collection,
              data: op.data
            });
            break;
          case 'save':
            await this.adapter.save({
              collection: op.collection,
              objectId: op.objectId,
              data: op.data
            });
            result = { success: true };
            break;
          case 'delete':
            await this.adapter.delete({
              collection: op.collection,
              objectId: op.objectId
            });
            result = { deleted: true };
            break;
          default:
            result = { error: `Unknown method: ${op.method}` };
        }
        results.push(result);
      } catch (e) {
        results.push({ error: e.message });
      }
    }

    this.sendJSON(res, 200, { results });
  }

  /**
   * POST /functions/:name - Execute cloud function
   * Executes a visual workflow via the WorkflowRunner
   */
  async handleFunction(res, functionName, body, headers) {
    if (!this.workflowRunner) {
      return this.sendError(res, 501, 'Workflows not initialized');
    }

    safeLog(`Cloud function called: ${functionName}`);

    // Build request object matching CloudRunner's expected format
    const request = {
      body: JSON.stringify(body),
      headers: headers
    };

    try {
      const response = await this.workflowRunner.run(functionName, request);
      res.writeHead(response.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      res.end(response.body);
    } catch (error) {
      safeLog('Function execution error:', error);
      this.sendError(res, 500, error.message);
    }
  }

  // ==========================================================================
  // WEBSOCKET (TODO - Basic implementation)
  // ==========================================================================

  /**
   * Broadcast event to all WebSocket clients
   */
  broadcast(event, data) {
    const message = JSON.stringify({
      event,
      data,
      timestamp: Date.now()
    });

    for (const client of this.wsClients) {
      try {
        client.send(message);
      } catch (e) {
        // Client disconnected
        this.wsClients.delete(client);
      }
    }
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Start the server
   */
  async start() {
    // Initialize adapter
    await this.initAdapter();

    // Initialize WorkflowRunner if workflows path is provided
    if (this.config.workflowsPath) {
      this.workflowRunner = new WorkflowRunner({
        workflowsPath: this.config.workflowsPath,
        adapter: this.adapter,
        enableDebugInspectors: false
      });

      try {
        await this.workflowRunner.initialize();
        await this.workflowRunner.loadWorkflows();
        safeLog(`WorkflowRunner initialized with ${this.workflowRunner.getAvailableFunctions().length} functions`);
      } catch (e) {
        safeLog('WorkflowRunner initialization failed (workflows disabled):', e.message);
        // Don't fail server startup if workflows can't be initialized
      }
    }

    // Create HTTP server
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    // Start listening
    return new Promise((resolve, reject) => {
      this.server.on('error', (e) => {
        safeLog('Server error:', e);
        reject(e);
      });

      this.server.listen(this.config.port, () => {
        safeLog(`Server running on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop() {
    // Close WebSocket clients
    for (const client of this.wsClients) {
      try {
        client.close();
      } catch (e) {
        // Ignore
      }
    }
    this.wsClients.clear();

    // Close HTTP server
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(resolve);
      });
    }

    // Disconnect adapter
    if (this.adapter) {
      await this.adapter.disconnect();
    }
  }

  /**
   * Get adapter for direct access
   */
  getAdapter() {
    return this.adapter;
  }

  /**
   * Get WorkflowRunner for direct access
   */
  getWorkflowRunner() {
    return this.workflowRunner;
  }

  /**
   * Update a workflow (hot reload)
   * @param {string} name - Workflow name
   * @param {Object} exportData - Workflow export data
   */
  async updateWorkflow(name, exportData) {
    if (!this.workflowRunner) {
      return { success: false, error: 'Workflows not initialized' };
    }
    return this.workflowRunner.loadWorkflow(name, exportData);
  }

  /**
   * Reload all workflows
   */
  async reloadWorkflows() {
    if (!this.workflowRunner) {
      return { success: false, error: 'Workflows not initialized' };
    }
    return this.workflowRunner.reloadWorkflows();
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus() {
    if (!this.workflowRunner) {
      return { initialized: false, workflowCount: 0, functions: [] };
    }
    return this.workflowRunner.getStatus();
  }
}

module.exports = { LocalBackendServer, generateObjectId };
