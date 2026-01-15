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

    switch (format) {
      case 'postgres':
        return adapter.schemaManager.generatePostgresSQL();
      case 'supabase':
        return adapter.schemaManager.generateSupabaseSQL();
      case 'json':
      default:
        const schema = await adapter.schemaManager.exportSchema();
        return JSON.stringify(schema, null, 2);
    }
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
}

// Singleton instance
const backendManager = new BackendManager();

module.exports = {
  BackendManager,
  backendManager,
  setupBackendIPC: () => backendManager.setupIPC()
};
