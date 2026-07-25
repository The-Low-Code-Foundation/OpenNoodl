/**
 * BackendManager
 *
 * Manages the lifecycle of local backends — creation, starting, stopping,
 * deletion — and provides the IPC surface the renderer's Backend Services
 * panel / Data Browser call.
 *
 * WF-004: backends no longer run inside the editor's main process. Each
 * running backend is a supervised `nodegx-backend` child process
 * (ServiceSupervisor), and every data/schema/workflow IPC handler proxies over
 * HTTP to it. The IPC channel names and payload shapes are unchanged — the
 * renderer UI does not know the process boundary moved.
 *
 * Config/metadata persistence stays here (it is editor state, not service
 * state): `~/.noodl/backends/<id>/{config.json,data/,workflows/}`.
 *
 * @module local-backend/BackendManager
 */

const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const { ServiceSupervisor } = require('./ServiceSupervisor');

/**
 * Safe console.log wrapper
 */
function safeLog(...args) {
  try {
    console.log('[BackendManager]', ...args);
  } catch (e) {
    // Ignore EPIPE errors
  }
}

/**
 * Generate a unique backend ID
 */
function generateBackendId() {
  return 'backend_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Backend metadata stored in config.json
 * @typedef {Object} BackendMetadata
 * @property {string} id - Unique backend ID
 * @property {string} name - Display name
 * @property {string} createdAt - ISO8601 timestamp
 * @property {number} port - HTTP port
 * @property {string[]} projectIds - Projects using this backend
 */

/**
 * BackendManager singleton class
 */
class BackendManager {
  constructor() {
    this.backendsPath = path.join(os.homedir(), '.noodl', 'backends');
    this.runningBackends = new Map(); // id -> ServiceSupervisor
    // id -> { code, message } — remembers why the last start attempt failed so
    // the UI can show "persistence unavailable" for a backend that isn't running.
    this.startErrors = new Map();
    this.ipcHandlersSetup = false;
  }

  /**
   * Setup IPC handlers for renderer process
   */
  setupIPC() {
    if (this.ipcHandlersSetup) return;

    safeLog('Setting up IPC handlers');

    ipcMain.handle('backend:list', async () => this.listBackends());
    ipcMain.handle('backend:create', async (_, name) => this.createBackend(name));
    ipcMain.handle('backend:delete', async (_, id) => this.deleteBackend(id));
    // Start a backend. options.ephemeral opts in to non-persisting in-memory mode.
    ipcMain.handle('backend:start', async (_, id, options) => this.startBackend(id, options));
    ipcMain.handle('backend:stop', async (_, id) => this.stopBackend(id));
    ipcMain.handle('backend:status', async (_, id) => this.getStatus(id));
    ipcMain.handle('backend:get', async (_, id) => this.getBackend(id));
    ipcMain.handle('backend:export-schema', async (_, id, format) => this.exportSchema(id, format));
    ipcMain.handle('backend:getSchema', async (_, id) => this.getSchema(id));
    ipcMain.handle('backend:getTableSchema', async (_, id, tableName) => this.getTableSchema(id, tableName));
    ipcMain.handle('backend:getRecordCount', async (_, id, tableName) => this.getRecordCount(id, tableName));
    ipcMain.handle('backend:createTable', async (_, id, tableSchema) => this.createTable(id, tableSchema));
    ipcMain.handle('backend:addColumn', async (_, id, tableName, column) => this.addColumn(id, tableName, column));
    ipcMain.handle('backend:renameColumn', async (_, id, tableName, oldName, newName) =>
      this.renameColumn(id, tableName, oldName, newName)
    );
    ipcMain.handle('backend:deleteTable', async (_, id, tableName) => this.deleteTable(id, tableName));

    // ==========================================================================
    // DATA OPERATIONS (for Data Browser)
    // ==========================================================================

    ipcMain.handle('backend:queryRecords', async (_, id, options) => this.queryRecords(id, options));
    ipcMain.handle('backend:createRecord', async (_, id, collection, data) => this.createRecord(id, collection, data));
    ipcMain.handle('backend:saveRecord', async (_, id, collection, objectId, data) =>
      this.saveRecord(id, collection, objectId, data)
    );
    ipcMain.handle('backend:deleteRecord', async (_, id, collection, objectId) =>
      this.deleteRecord(id, collection, objectId)
    );

    // Workflow management
    ipcMain.handle('backend:update-workflow', async (_, args) =>
      this.updateWorkflow(args.backendId, args.name, args.workflow)
    );
    ipcMain.handle('backend:reload-workflows', async (_, id) => this.reloadWorkflows(id));
    ipcMain.handle('backend:workflow-status', async (_, id) => this.getWorkflowStatus(id));

    // ==========================================================================
    // ACCESS CONTROL (BAK-003) — the permissions panel proxies to /admin/*
    // ==========================================================================

    ipcMain.handle('backend:getPermissions', async (_, id) =>
      this.requireRunning(id, 'read permissions').request('GET', '/admin/permissions')
    );
    ipcMain.handle('backend:setPermissions', async (_, id, config) =>
      this.requireRunning(id, 'set permissions').request('PUT', '/admin/permissions', config)
    );
    ipcMain.handle('backend:setCollectionPermissions', async (_, id, collection, rules) =>
      this.requireRunning(id, 'set collection permissions').request(
        'PUT',
        `/admin/permissions/collections/${encodeURIComponent(collection)}`,
        rules
      )
    );
    ipcMain.handle('backend:resetCollectionPermissions', async (_, id, collection) =>
      this.requireRunning(id, 'reset collection permissions').request(
        'DELETE',
        `/admin/permissions/collections/${encodeURIComponent(collection)}`
      )
    );
    ipcMain.handle('backend:checkAccess', async (_, id, query) =>
      this.requireRunning(id, 'check access').request('POST', '/admin/permissions/check', query)
    );
    ipcMain.handle('backend:listRoles', async (_, id) =>
      this.requireRunning(id, 'list roles').request('GET', '/admin/roles')
    );
    ipcMain.handle('backend:createRole', async (_, id, name) =>
      this.requireRunning(id, 'create role').request('POST', '/admin/roles', { name })
    );
    ipcMain.handle('backend:deleteRole', async (_, id, name) =>
      this.requireRunning(id, 'delete role').request('DELETE', `/admin/roles/${encodeURIComponent(name)}`)
    );
    ipcMain.handle('backend:addRoleUser', async (_, id, role, userId) =>
      this.requireRunning(id, 'assign role').request('POST', `/admin/roles/${encodeURIComponent(role)}/users`, { userId })
    );
    ipcMain.handle('backend:removeRoleUser', async (_, id, role, userId) =>
      this.requireRunning(id, 'remove role member').request(
        'DELETE',
        `/admin/roles/${encodeURIComponent(role)}/users/${encodeURIComponent(userId)}`
      )
    );
    ipcMain.handle('backend:listApiKeys', async (_, id) =>
      this.requireRunning(id, 'list API keys').request('GET', '/admin/keys')
    );
    ipcMain.handle('backend:createApiKey', async (_, id, name, scopes) =>
      this.requireRunning(id, 'create API key').request('POST', '/admin/keys', { name, scopes })
    );
    ipcMain.handle('backend:revokeApiKey', async (_, id, objectId) =>
      this.requireRunning(id, 'revoke API key').request('DELETE', `/admin/keys/${encodeURIComponent(objectId)}`)
    );

    this.ipcHandlersSetup = true;
  }

  /**
   * The supervisor for a running backend, or throw the message every proxied
   * handler used to throw when the server wasn't running.
   * @private
   */
  requireRunning(id, action) {
    const supervisor = this.runningBackends.get(id);
    if (!supervisor || !supervisor.isRunning()) {
      throw new Error(`Backend must be running to ${action}`);
    }
    return supervisor;
  }

  /**
   * Ensure backends directory exists
   */
  async ensureBackendsDir() {
    await fs.mkdir(this.backendsPath, { recursive: true });
  }

  /**
   * List all backends
   * @returns {Promise<BackendMetadata[]>}
   */
  async listBackends() {
    await this.ensureBackendsDir();

    const entries = await fs.readdir(this.backendsPath, { withFileTypes: true });
    const backends = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      try {
        const configPath = path.join(this.backendsPath, entry.name, 'config.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configData);
        backends.push(config);
      } catch (e) {
        // Invalid backend directory, skip
        safeLog(`Skipping invalid backend: ${entry.name}`, e.message);
      }
    }

    return backends;
  }

  /**
   * Get a single backend by ID
   * @param {string} id
   * @returns {Promise<BackendMetadata|null>}
   */
  async getBackend(id) {
    const backendPath = path.join(this.backendsPath, id);

    try {
      const configPath = path.join(backendPath, 'config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configData);
    } catch (e) {
      return null;
    }
  }

  /**
   * Create a new backend
   * @param {string} name - Display name
   * @returns {Promise<BackendMetadata>}
   */
  async createBackend(name) {
    await this.ensureBackendsDir();

    const id = generateBackendId();
    const backendPath = path.join(this.backendsPath, id);

    // Create directory structure
    await fs.mkdir(backendPath, { recursive: true });
    await fs.mkdir(path.join(backendPath, 'data'));
    await fs.mkdir(path.join(backendPath, 'workflows'));

    // Find available port
    const port = await this.findAvailablePort();

    // Create config
    const config = {
      id,
      name,
      createdAt: new Date().toISOString(),
      port,
      projectIds: []
    };

    await fs.writeFile(path.join(backendPath, 'config.json'), JSON.stringify(config, null, 2));

    // Create empty schema
    await fs.writeFile(path.join(backendPath, 'schema.json'), JSON.stringify({ tables: [] }, null, 2));

    safeLog(`Created backend: ${id} (${name}) on port ${port}`);
    return config;
  }

  /**
   * Delete a backend
   * @param {string} id
   */
  async deleteBackend(id) {
    // Stop if running
    if (this.runningBackends.has(id)) {
      await this.stopBackend(id);
    }

    const backendPath = path.join(this.backendsPath, id);

    // Remove directory recursively
    await fs.rm(backendPath, { recursive: true, force: true });

    this.startErrors.delete(id);

    safeLog(`Deleted backend: ${id}`);
    return { deleted: true, id };
  }

  /**
   * Start a backend as a supervised child process.
   * @param {string} id
   * @param {Object} [options]
   * @param {boolean} [options.ephemeral] - Opt in to non-persisting in-memory mode
   *   when the native SQLite engine is unavailable. Data will NOT persist.
   */
  async startBackend(id, options = {}) {
    // Already running?
    const existing = this.runningBackends.get(id);
    if (existing && existing.isRunning()) {
      safeLog(`Backend ${id} already running`);
      return this.getStatus(id);
    }

    // Load config
    const config = await this.getBackend(id);
    if (!config) {
      throw new Error(`Backend not found: ${id}`);
    }

    const backendPath = path.join(this.backendsPath, id);
    const supervisor = new ServiceSupervisor({
      id: config.id,
      name: config.name,
      // The service owns the whole data dir: SQLite files, uploads, workflows.
      dataDir: backendPath,
      port: config.port,
      ephemeral: options.ephemeral === true
    });

    try {
      await supervisor.start();
    } catch (e) {
      // Remember the failure so getStatus() can report "persistence unavailable"
      // for this stopped backend, and rethrow so backend:start rejects loudly.
      this.startErrors.set(id, {
        code: e.code || 'BACKEND_START_FAILED',
        message: e.message
      });
      safeLog(`Failed to start backend ${id}: ${e.message}`);
      throw e;
    }

    this.startErrors.delete(id);
    this.runningBackends.set(id, supervisor);

    safeLog(`Started backend: ${id} on ${supervisor.endpoint}`);
    return this.getStatus(id);
  }

  /**
   * Stop a backend
   * @param {string} id
   */
  async stopBackend(id) {
    const supervisor = this.runningBackends.get(id);
    if (!supervisor) {
      safeLog(`Backend ${id} not running`);
      return { running: false };
    }

    await supervisor.stop();
    this.runningBackends.delete(id);

    safeLog(`Stopped backend: ${id}`);
    return { running: false };
  }

  /**
   * Get backend status, including how it is persisting data — live from the
   * service's /health endpoint when running.
   * @param {string} id
   * @returns {Promise<{ running: boolean, port?: number, endpoint?: string, persistence: object }>}
   */
  async getStatus(id) {
    const supervisor = this.runningBackends.get(id);
    if (!supervisor || !supervisor.isRunning()) {
      // Not running. If the last start attempt failed, surface why so the UI
      // can distinguish "stopped" from "could not persist". A child that died
      // after starting shows its exit + log tail.
      const lastError = this.startErrors.get(id);
      const died = supervisor && supervisor.lastExit;
      const error = lastError
        ? lastError
        : died
        ? {
            code: 'BACKEND_EXITED',
            message:
              `Backend process exited (code=${died.code}, signal=${died.signal}).\n` +
              `Last output:\n${supervisor.logTail()}`
          }
        : null;
      if (died) this.runningBackends.delete(id);
      return {
        running: false,
        persistence: error
          ? { mode: 'failed', persistent: false, ephemeral: false, error }
          : { mode: 'unknown', persistent: false, ephemeral: false, error: null }
      };
    }

    const health = await supervisor.fetchHealth();
    const port = (supervisor.ready && supervisor.ready.port) || supervisor.config.port;
    return {
      running: true,
      port,
      endpoint: supervisor.endpoint,
      pid: supervisor.child ? supervisor.child.pid : undefined,
      persistence: health
        ? health.persistence
        : { mode: 'unknown', persistent: false, ephemeral: false, error: { message: 'health check unreachable' } },
      workflows: health ? health.workflows : undefined
    };
  }

  /**
   * Endpoints of all currently-running backends (used by the execution-history
   * IPC merge — the services own their execution stores now).
   * @returns {{ id: string, name: string, endpoint: string }[]}
   */
  getRunningEndpoints() {
    const result = [];
    for (const [id, supervisor] of this.runningBackends) {
      if (supervisor.isRunning()) {
        result.push({ id, name: supervisor.config.name, endpoint: supervisor.endpoint });
      }
    }
    return result;
  }

  /**
   * Export backend schema
   * @param {string} id
   * @param {'postgres'|'supabase'|'json'} format
   */
  async exportSchema(id, format = 'json') {
    const supervisor = this.requireRunning(id, 'export schema');
    const result = await supervisor.request('GET', `/admin/schema-export?format=${encodeURIComponent(format)}`);
    return result.content;
  }

  // ==========================================================================
  // SCHEMA MANAGEMENT
  // ==========================================================================

  /**
   * Get full schema for a backend
   * @param {string} id - Backend ID
   * @returns {Promise<Object>} Schema with tables array
   */
  async getSchema(id) {
    const supervisor = this.requireRunning(id, 'get schema');
    return supervisor.request('GET', '/admin/schema');
  }

  /**
   * Get schema for a single table
   * @param {string} id - Backend ID
   * @param {string} tableName - Table name
   * @returns {Promise<Object|null>} Table schema
   */
  async getTableSchema(id, tableName) {
    const supervisor = this.requireRunning(id, 'get table schema');
    try {
      return await supervisor.request('GET', `/admin/schema/${encodeURIComponent(tableName)}`);
    } catch (e) {
      return null;
    }
  }

  /**
   * Get record count for a table
   * @param {string} id - Backend ID
   * @param {string} tableName - Table name
   * @returns {Promise<number>} Record count
   */
  async getRecordCount(id, tableName) {
    const supervisor = this.requireRunning(id, 'get record count');
    const result = await supervisor.request('GET', `/api/${encodeURIComponent(tableName)}?limit=0&count=1`);
    return result.count || 0;
  }

  /**
   * Create a new table
   * @param {string} id - Backend ID
   * @param {Object} tableSchema - Table schema { name, columns }
   * @returns {Promise<Object>} Result with success status
   */
  async createTable(id, tableSchema) {
    const supervisor = this.requireRunning(id, 'create table');
    const result = await supervisor.request('POST', '/admin/schema', {
      action: 'createTable',
      table: tableSchema.name,
      columns: tableSchema.columns
    });
    safeLog(`Created table: ${tableSchema.name} (created: ${result.created})`);
    return { success: true, created: result.created, tableName: tableSchema.name };
  }

  /**
   * Add a column to an existing table
   * @param {string} id - Backend ID
   * @param {string} tableName - Table name
   * @param {Object} column - Column definition { name, type, required, default }
   * @returns {Promise<Object>} Result with success status
   */
  async addColumn(id, tableName, column) {
    const supervisor = this.requireRunning(id, 'add column');
    await supervisor.request('POST', '/admin/schema', { action: 'addColumn', table: tableName, column });
    safeLog(`Added column: ${column.name} to table ${tableName}`);
    return { success: true, tableName, columnName: column.name };
  }

  /**
   * Rename a column in an existing table
   * @param {string} id - Backend ID
   * @param {string} tableName - Table name
   * @param {string} oldName - Current column name
   * @param {string} newName - New column name
   * @returns {Promise<Object>} Result with success status
   */
  async renameColumn(id, tableName, oldName, newName) {
    const supervisor = this.requireRunning(id, 'rename column');
    await supervisor.request('POST', '/admin/schema', { action: 'renameColumn', table: tableName, oldName, newName });
    safeLog(`Renamed column: ${oldName} -> ${newName} in table ${tableName}`);
    return { success: true, tableName, oldName, newName };
  }

  /**
   * Delete a table and all its data
   * @param {string} id - Backend ID
   * @param {string} tableName - Table name
   * @returns {Promise<Object>} Result with success status
   */
  async deleteTable(id, tableName) {
    const supervisor = this.requireRunning(id, 'delete table');
    const result = await supervisor.request('POST', '/admin/schema', { action: 'deleteTable', table: tableName });
    safeLog(`Deleted table: ${tableName} (deleted: ${result.deleted})`);
    return { success: true, deleted: result.deleted, tableName };
  }

  /**
   * Find an available port starting from 8578
   * (8577 is used by cloud-function-server)
   */
  async findAvailablePort() {
    const backends = await this.listBackends();
    const usedPorts = new Set(backends.map((b) => b.port));

    // Also check running backends in case config ports changed
    for (const supervisor of this.runningBackends.values()) {
      usedPorts.add(supervisor.config.port);
    }

    let port = 8578;
    while (usedPorts.has(port)) {
      port++;
    }

    return port;
  }

  // ==========================================================================
  // DATA OPERATIONS (for Data Browser)
  // ==========================================================================

  /**
   * Query records with pagination, search, and filters
   * @param {string} id - Backend ID
   * @param {Object} options - Query options
   * @param {string} options.collection - Table/collection name
   * @param {number} [options.limit=50] - Max records to return
   * @param {number} [options.skip=0] - Records to skip (for pagination)
   * @param {Object} [options.where] - Filter conditions
   * @param {Array} [options.sort] - Sort order (e.g., ['-createdAt'])
   * @param {boolean} [options.count] - Include total count
   * @returns {Promise<{results: Object[], count?: number}>}
   */
  async queryRecords(id, options) {
    const supervisor = this.requireRunning(id, 'query records');

    const params = new URLSearchParams();
    params.set('limit', String(options.limit || 50));
    params.set('skip', String(options.skip || 0));
    if (options.where) params.set('where', JSON.stringify(options.where));
    if (options.sort) params.set('sort', JSON.stringify(options.sort));
    if (options.count) params.set('count', '1');

    const result = await supervisor.request('GET', `/api/${encodeURIComponent(options.collection)}?${params}`);
    return {
      results: result.results,
      count: options.count ? result.count : undefined
    };
  }

  /**
   * Create a new record
   * @param {string} id - Backend ID
   * @param {string} collection - Table/collection name
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Created record with objectId
   */
  async createRecord(id, collection, data) {
    const supervisor = this.requireRunning(id, 'create records');
    const record = await supervisor.request('POST', `/api/${encodeURIComponent(collection)}`, data);
    safeLog(`Created record in ${collection}:`, record.objectId);
    return record;
  }

  /**
   * Update an existing record
   * @param {string} id - Backend ID
   * @param {string} collection - Table/collection name
   * @param {string} objectId - Record ID to update
   * @param {Object} data - Fields to update
   * @returns {Promise<Object>} Updated record
   */
  async saveRecord(id, collection, objectId, data) {
    const supervisor = this.requireRunning(id, 'save records');
    const record = await supervisor.request(
      'PUT',
      `/api/${encodeURIComponent(collection)}/${encodeURIComponent(objectId)}`,
      data
    );
    safeLog(`Updated record in ${collection}:`, objectId);
    return record;
  }

  /**
   * Delete a record
   * @param {string} id - Backend ID
   * @param {string} collection - Table/collection name
   * @param {string} objectId - Record ID to delete
   * @returns {Promise<{success: boolean}>}
   */
  async deleteRecord(id, collection, objectId) {
    const supervisor = this.requireRunning(id, 'delete records');
    await supervisor.request('DELETE', `/api/${encodeURIComponent(collection)}/${encodeURIComponent(objectId)}`);
    safeLog(`Deleted record from ${collection}:`, objectId);
    return { success: true };
  }

  /**
   * Stop all running backends (for cleanup on app exit)
   */
  async stopAll() {
    safeLog(`Stopping ${this.runningBackends.size} backends`);

    for (const [id, supervisor] of this.runningBackends) {
      try {
        await supervisor.stop();
        safeLog(`Stopped backend: ${id}`);
      } catch (e) {
        safeLog(`Error stopping backend ${id}:`, e);
      }
    }

    this.runningBackends.clear();
  }

  // ==========================================================================
  // WORKFLOW MANAGEMENT
  // ==========================================================================

  /**
   * Update/deploy a workflow to a backend
   * @param {string} backendId - Backend ID
   * @param {string} name - Workflow name
   * @param {Object} workflow - Workflow export data
   */
  async updateWorkflow(backendId, name, workflow) {
    const supervisor = this.requireRunning(backendId, 'update workflows');
    return supervisor.request('PUT', `/admin/workflows/${encodeURIComponent(name)}`, workflow);
  }

  /**
   * Reload all workflows for a backend
   * @param {string} backendId - Backend ID
   */
  async reloadWorkflows(backendId) {
    const supervisor = this.requireRunning(backendId, 'reload workflows');
    return supervisor.request('POST', '/admin/workflows/reload');
  }

  /**
   * Get workflow status for a backend
   * @param {string} backendId - Backend ID
   */
  async getWorkflowStatus(backendId) {
    const supervisor = this.runningBackends.get(backendId);
    if (!supervisor || !supervisor.isRunning()) {
      return { initialized: false, workflowCount: 0, functions: [] };
    }
    return supervisor.request('GET', '/admin/workflows');
  }
}

// Singleton instance
const backendManager = new BackendManager();

module.exports = {
  BackendManager,
  backendManager,
  setupBackendIPC: () => backendManager.setupIPC()
};
