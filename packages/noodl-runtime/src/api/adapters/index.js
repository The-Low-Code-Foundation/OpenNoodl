/**
 * CloudStore Adapters Registry
 *
 * Provides a unified interface for creating and managing CloudStore adapters.
 * Supports local SQLite, Parse Server, and future external adapters.
 *
 * @module adapters
 */

const { LocalSQLAdapter, QueryBuilder, SchemaManager } = require('./local-sql');

/**
 * @typedef {'local' | 'parse' | 'external'} AdapterType
 */

/**
 * @typedef {Object} AdapterConfig
 * @property {AdapterType} type - Adapter type
 * @property {string} [dbPath] - For local: path to SQLite database
 * @property {string} [endpoint] - For parse/external: server endpoint
 * @property {string} [appId] - For parse: application ID
 * @property {string} [masterKey] - For parse: master key
 * @property {Object} [collections] - Collection schemas
 */

/**
 * Adapter Registry - manages adapter instances
 */
class AdapterRegistry {
  constructor() {
    /** @type {Map<string, LocalSQLAdapter>} */
    this.adapters = new Map();
  }

  /**
   * Create and register an adapter
   *
   * @param {string} id - Unique adapter ID
   * @param {AdapterConfig} config - Adapter configuration
   * @returns {Promise<LocalSQLAdapter>}
   */
  async createAdapter(id, config) {
    if (this.adapters.has(id)) {
      return this.adapters.get(id);
    }

    let adapter;

    switch (config.type) {
      case 'local':
        if (!config.dbPath) {
          throw new Error('dbPath is required for local adapter');
        }
        adapter = new LocalSQLAdapter(config.dbPath, {
          collections: config.collections
        });
        await adapter.connect();
        break;

      case 'parse':
        // For parse adapter, we'll use the existing CloudStore
        // This is a placeholder - implement ParseAdapter when needed
        throw new Error('Parse adapter not yet refactored. Use existing CloudStore.');

      case 'external':
        // External adapters (Supabase, PocketBase, etc.) - future work
        throw new Error(`External adapter type not yet implemented`);

      default:
        throw new Error(`Unknown adapter type: ${config.type}`);
    }

    this.adapters.set(id, adapter);
    return adapter;
  }

  /**
   * Get an existing adapter by ID
   *
   * @param {string} id - Adapter ID
   * @returns {LocalSQLAdapter|undefined}
   */
  getAdapter(id) {
    return this.adapters.get(id);
  }

  /**
   * Check if an adapter exists
   *
   * @param {string} id - Adapter ID
   * @returns {boolean}
   */
  hasAdapter(id) {
    return this.adapters.has(id);
  }

  /**
   * Disconnect and remove an adapter
   *
   * @param {string} id - Adapter ID
   * @returns {Promise<void>}
   */
  async removeAdapter(id) {
    const adapter = this.adapters.get(id);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(id);
    }
  }

  /**
   * Disconnect and remove all adapters
   *
   * @returns {Promise<void>}
   */
  async disconnectAll() {
    for (const adapter of this.adapters.values()) {
      await adapter.disconnect();
    }
    this.adapters.clear();
  }

  /**
   * List all registered adapter IDs
   *
   * @returns {string[]}
   */
  listAdapters() {
    return Array.from(this.adapters.keys());
  }
}

// Singleton instance
let _registryInstance;

/**
 * Get the singleton registry instance
 *
 * @returns {AdapterRegistry}
 */
function getRegistry() {
  if (!_registryInstance) {
    _registryInstance = new AdapterRegistry();
  }
  return _registryInstance;
}

module.exports = {
  // Classes
  AdapterRegistry,
  LocalSQLAdapter,
  QueryBuilder,
  SchemaManager,

  // Singleton access
  getRegistry,

  // Convenience function
  createLocalAdapter: async (id, dbPath, options = {}) => {
    return getRegistry().createAdapter(id, {
      type: 'local',
      dbPath,
      ...options
    });
  }
};
