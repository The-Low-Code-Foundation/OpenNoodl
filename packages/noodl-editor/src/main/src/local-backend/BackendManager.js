/**
 * BackendManager
 *
 * Manages the lifecycle of local backends - creation, starting, stopping, deletion.
 * Provides IPC handlers for the renderer process to interact with backends.
 *
 * @module local-backend/BackendManager
 */

const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const { LocalBackendServer } = require('./LocalBackendServer');

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
    this.runningBackends = new Map(); // id -> LocalBackendServer
    this.ipcHandlersSetup = false;
  }

  /**
   * Setup IPC handlers for renderer process
   */
  setupIPC() {
    if (this.ipcHandlersSetup) return;

    safeLog('Setting up IPC handlers');

    // List all backends
    ipcMain.handle('backend:list', async () => {
      return this.listBackends();
    });

    // Create a new backend
    ipcMain.handle('backend:create', async (_, name) => {
      return this.createBackend(name);
    });

    // Delete a backend
    ipcMain.handle('backend:delete', async (_, id) => {
      return this.deleteBackend(id);
    });

    // Start a backend
    ipcMain.handle('backend:start', async (_, id) => {
      return this.startBackend(id);
    });

    // Stop a backend
    ipcMain.handle('backend:stop', async (_, id) => {
      return this.stopBackend(id);
    });

    // Get backend status
    ipcMain.handle('backend:status', async (_, id) => {
      return this.getStatus(id);
    });

    // Get backend config
    ipcMain.handle('backend:get', async (_, id) => {
      return this.getBackend(id);
    });

    // Export schema
    ipcMain.handle('backend:export-schema', async (_, id, format) => {
      return this.exportSchema(id, format);
    });

    // Get full schema
    ipcMain.handle('backend:getSchema', async (_, id) => {
      return this.getSchema(id);
    });

    // Get single table schema
    ipcMain.handle('backend:getTableSchema', async (_, id, tableName) => {
      return this.getTableSchema(id, tableName);
    });

    // Get record count for a table
    ipcMain.handle('backend:getRecordCount', async (_, id, tableName) => {
      return this.getRecordCount(id, tableName);
    });

    // Create a new table
    ipcMain.handle('backend:createTable', async (_, id, tableSchema) => {
      return this.createTable(id, tableSchema);
    });

    // Add column to existing table
    ipcMain.handle('backend:addColumn', async (_, id, tableName, column) => {
      return this.addColumn(id, tableName, column);
    });

    // Rename column in existing table
    ipcMain.handle('backend:renameColumn', async (_, id, tableName, oldName, newName) => {
      return this.renameColumn(id, tableName, oldName, newName);
    });

    // Delete a table
    ipcMain.handle('backend:deleteTable', async (_, id, tableName) => {
      return this.deleteTable(id, tableName);
    });

    // ==========================================================================
    // DATA OPERATIONS (for Data Browser)
    // ==========================================================================

    // Query records with pagination, search, filters
    ipcMain.handle('backend:queryRecords', async (_, id, options) => {
      return this.queryRecords(id, options);
    });

    // Create a new record
    ipcMain.handle('backend:createRecord', async (_, id, collection, data) => {
      return this.createRecord(id, collection, data);
    });

    // Update an existing record
    ipcMain.handle('backend:saveRecord', async (_, id, collection, objectId, data) => {
      return this.saveRecord(id, collection, objectId, data);
    });

    // Delete a record
    ipcMain.handle('backend:deleteRecord', async (_, id, collection, objectId) => {
      return this.deleteRecord(id, collection, objectId);
    });

    // Workflow management
    ipcMain.handle('backend:update-workflow', async (_, args) => {
      return this.updateWorkflow(args.backendId, args.name, args.workflow);
    });

    ipcMain.handle('backend:reload-workflows', async (_, id) => {
      return this.reloadWorkflows(id);
    });

    ipcMain.handle('backend:workflow-status', async (_, id) => {
      return this.getWorkflowStatus(id);
    });

    this.ipcHandlersSetup = true;
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

    safeLog(`Deleted backend: ${id}`);
    return { deleted: true, id };
  }

  /**
   * Start a backend
   * @param {string} id
   */
  async startBackend(id) {
    // Already running?
    if (this.runningBackends.has(id)) {
      safeLog(`Backend ${id} already running`);
      return this.getStatus(id);
    }

    // Load config
    const config = await this.getBackend(id);
    if (!config) {
      throw new Error(`Backend not found: ${id}`);
    }

    const backendPath = path.join(this.backendsPath, id);

    // Create and start server
    const server = new LocalBackendServer({
      id: config.id,
      name: config.name,
      dbPath: path.join(backendPath, 'data', 'local.db'),
      workflowsPath: path.join(backendPath, 'workflows'),
      port: config.port
    });

    await server.start();
    this.runningBackends.set(id, server);

    safeLog(`Started backend: ${id} on port ${config.port}`);
    return this.getStatus(id);
  }

  /**
   * Stop a backend
   * @param {string} id
   */
  async stopBackend(id) {
    const server = this.runningBackends.get(id);
    if (!server) {
      safeLog(`Backend ${id} not running`);
      return { running: false };
    }

    await server.stop();
    this.runningBackends.delete(id);

    safeLog(`Stopped backend: ${id}`);
    return { running: false };
  }

  /**
   * Get backend status
   * @param {string} id
   * @returns {{ running: boolean, port?: number, endpoint?: string }}
   */
  getStatus(id) {
    const server = this.runningBackends.get(id);
    if (!server) {
      return { running: false };
    }

    return {
      running: true,
      port: server.config.port,
      endpoint: `http://localhost:${server.config.port}`
    };
  }

  /**
   * Export backend schema
   * @param {string} id
   * @param {'postgres'|'supabase'|'json'} format
   */
  async exportSchema(id, format = 'json') {
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to export schema');
    }

    const adapter = server.getAdapter();
    if (!adapter || !adapter.schemaManager) {
      throw new Error('Adapter or schema manager not available');
    }

    if (format === 'postgres') {
      return adapter.schemaManager.generatePostgresSQL();
    }
    if (format === 'supabase') {
      return adapter.schemaManager.generateSupabaseSQL();
    }
    // Default: json
    const exportedSchema = await adapter.schemaManager.exportSchema();
    return JSON.stringify(exportedSchema, null, 2);
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
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to get schema');
    }

    const adapter = server.getAdapter();
    if (!adapter || !adapter.schemaManager) {
      throw new Error('Adapter or schema manager not available');
    }

    const tables = adapter.schemaManager.listTables();
    const schemas = adapter.schemaManager.exportSchemas();

    // Build response with table info
    return {
      tables: tables.map((tableName) => {
        const schema = schemas.find((s) => s.name === tableName);
        return {
          name: tableName,
          columns: schema?.columns || [],
          createdAt: schema?.createdAt || null
        };
      })
    };
  }

  /**
   * Get schema for a single table
   * @param {string} id - Backend ID
   * @param {string} tableName - Table name
   * @returns {Promise<Object|null>} Table schema
   */
  async getTableSchema(id, tableName) {
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to get table schema');
    }

    const adapter = server.getAdapter();
    if (!adapter || !adapter.schemaManager) {
      throw new Error('Adapter or schema manager not available');
    }

    const schema = adapter.schemaManager.getTableSchema(tableName);
    if (!schema) {
      return null;
    }

    return {
      name: tableName,
      columns: schema.columns || []
    };
  }

  /**
   * Get record count for a table
   * @param {string} id - Backend ID
   * @param {string} tableName - Table name
   * @returns {Promise<number>} Record count
   */
  async getRecordCount(id, tableName) {
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to get record count');
    }

    const adapter = server.getAdapter();
    if (!adapter) {
      throw new Error('Adapter not available');
    }

    return new Promise((resolve, reject) => {
      adapter.count({
        collection: tableName,
        success: (count) => resolve(count),
        error: (err) => reject(new Error(err))
      });
    });
  }

  /**
   * Create a new table
   * @param {string} id - Backend ID
   * @param {Object} tableSchema - Table schema { name, columns }
   * @returns {Promise<Object>} Result with success status
   */
  async createTable(id, tableSchema) {
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to create table');
    }

    const adapter = server.getAdapter();
    if (!adapter || !adapter.schemaManager) {
      throw new Error('Adapter or schema manager not available');
    }

    const created = adapter.schemaManager.createTable(tableSchema);
    safeLog(`Created table: ${tableSchema.name} (created: ${created})`);

    return { success: true, created, tableName: tableSchema.name };
  }

  /**
   * Add a column to an existing table
   * @param {string} id - Backend ID
   * @param {string} tableName - Table name
   * @param {Object} column - Column definition { name, type, required, default }
   * @returns {Promise<Object>} Result with success status
   */
  async addColumn(id, tableName, column) {
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to add column');
    }

    const adapter = server.getAdapter();
    if (!adapter || !adapter.schemaManager) {
      throw new Error('Adapter or schema manager not available');
    }

    adapter.schemaManager.addColumn(tableName, column);
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
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to rename column');
    }

    const adapter = server.getAdapter();
    if (!adapter || !adapter.schemaManager) {
      throw new Error('Adapter or schema manager not available');
    }

    adapter.schemaManager.renameColumn(tableName, oldName, newName);
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
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to delete table');
    }

    const adapter = server.getAdapter();
    if (!adapter || !adapter.schemaManager) {
      throw new Error('Adapter or schema manager not available');
    }

    const deleted = adapter.schemaManager.deleteTable(tableName);
    safeLog(`Deleted table: ${tableName} (deleted: ${deleted})`);

    return { success: true, deleted, tableName };
  }

  /**
   * Find an available port starting from 8578
   * (8577 is used by cloud-function-server)
   */
  async findAvailablePort() {
    const backends = await this.listBackends();
    const usedPorts = new Set(backends.map((b) => b.port));

    // Also check running backends in case config ports changed
    for (const server of this.runningBackends.values()) {
      usedPorts.add(server.config.port);
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
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to query records');
    }

    const adapter = server.getAdapter();
    if (!adapter) {
      throw new Error('Adapter not available');
    }

    return new Promise((resolve, reject) => {
      adapter.query({
        collection: options.collection,
        limit: options.limit || 50,
        skip: options.skip || 0,
        where: options.where,
        sort: options.sort,
        count: options.count,
        success: (results, count) => {
          resolve({
            results,
            count: options.count ? count : undefined
          });
        },
        error: (err) => reject(new Error(err))
      });
    });
  }

  /**
   * Create a new record
   * @param {string} id - Backend ID
   * @param {string} collection - Table/collection name
   * @param {Object} data - Record data
   * @returns {Promise<Object>} Created record with objectId
   */
  async createRecord(id, collection, data) {
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to create records');
    }

    const adapter = server.getAdapter();
    if (!adapter) {
      throw new Error('Adapter not available');
    }

    return new Promise((resolve, reject) => {
      adapter.create({
        collection,
        data,
        success: (record) => {
          safeLog(`Created record in ${collection}:`, record.objectId);
          resolve(record);
        },
        error: (err) => reject(new Error(err))
      });
    });
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
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to save records');
    }

    const adapter = server.getAdapter();
    if (!adapter) {
      throw new Error('Adapter not available');
    }

    return new Promise((resolve, reject) => {
      adapter.save({
        collection,
        objectId,
        data,
        success: (record) => {
          safeLog(`Updated record in ${collection}:`, objectId);
          resolve(record);
        },
        error: (err) => reject(new Error(err))
      });
    });
  }

  /**
   * Delete a record
   * @param {string} id - Backend ID
   * @param {string} collection - Table/collection name
   * @param {string} objectId - Record ID to delete
   * @returns {Promise<{success: boolean}>}
   */
  async deleteRecord(id, collection, objectId) {
    const server = this.runningBackends.get(id);
    if (!server) {
      throw new Error('Backend must be running to delete records');
    }

    const adapter = server.getAdapter();
    if (!adapter) {
      throw new Error('Adapter not available');
    }

    return new Promise((resolve, reject) => {
      adapter.delete({
        collection,
        objectId,
        success: () => {
          safeLog(`Deleted record from ${collection}:`, objectId);
          resolve({ success: true });
        },
        error: (err) => reject(new Error(err))
      });
    });
  }

  /**
   * Stop all running backends (for cleanup on app exit)
   */
  async stopAll() {
    safeLog(`Stopping ${this.runningBackends.size} backends`);

    for (const [id, server] of this.runningBackends) {
      try {
        await server.stop();
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
    const server = this.runningBackends.get(backendId);
    if (!server) {
      throw new Error('Backend must be running to update workflows');
    }

    return server.updateWorkflow(name, workflow);
  }

  /**
   * Reload all workflows for a backend
   * @param {string} backendId - Backend ID
   */
  async reloadWorkflows(backendId) {
    const server = this.runningBackends.get(backendId);
    if (!server) {
      throw new Error('Backend must be running to reload workflows');
    }

    return server.reloadWorkflows();
  }

  /**
   * Get workflow status for a backend
   * @param {string} backendId - Backend ID
   */
  getWorkflowStatus(backendId) {
    const server = this.runningBackends.get(backendId);
    if (!server) {
      return { initialized: false, workflowCount: 0, functions: [] };
    }

    return server.getWorkflowStatus();
  }
}

// Singleton instance
const backendManager = new BackendManager();

module.exports = {
  BackendManager,
  backendManager,
  setupBackendIPC: () => backendManager.setupIPC()
};
