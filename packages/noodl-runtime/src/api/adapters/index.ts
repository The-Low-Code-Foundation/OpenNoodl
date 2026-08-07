/**
 * CloudStore Adapters Registry
 *
 * Provides a unified interface for creating and managing CloudStore adapters.
 * Supports local SQLite, Parse Server, and future external adapters.
 *
 * @module adapters
 */

import LocalSQLAdapterImport = require('./local-sql/LocalSQLAdapter');
import QueryBuilder = require('./local-sql/QueryBuilder');
import SchemaManager = require('./local-sql/SchemaManager');

import type { TableSchema } from './types';

/**
 * Imported from the leaf modules rather than the `local-sql` barrel: the barrel also
 * re-exports `engine` and `LocalBackendPersistenceError`, neither of which this file uses,
 * and going through it would make the two indexes mutually dependent for no gain.
 */
const LocalSQLAdapter = LocalSQLAdapterImport;

type LocalSQLAdapterInstance = InstanceType<typeof LocalSQLAdapter>;

export type AdapterType = 'local' | 'parse' | 'external';

export interface AdapterConfig {
  type: AdapterType;
  /** For local: path to SQLite database */
  dbPath?: string;
  /** For parse/external: server endpoint */
  endpoint?: string;
  /** For parse: application ID */
  appId?: string;
  /** For parse: master key */
  masterKey?: string;
  /** Collection schemas */
  collections?: Record<string, TableSchema>;
  /**
   * For local: opt in to in-memory mode when the native SQLite engine is unavailable
   * (data will NOT persist). Default false.
   */
  allowEphemeral?: boolean;
}

/**
 * Adapter Registry - manages adapter instances
 */
export class AdapterRegistry {
  adapters: Map<string, LocalSQLAdapterInstance>;

  constructor() {
    this.adapters = new Map();
  }

  /** Create and register an adapter. Returns the existing one if `id` is already taken. */
  async createAdapter(id: string, config: AdapterConfig): Promise<LocalSQLAdapterInstance> {
    if (this.adapters.has(id)) {
      return this.adapters.get(id);
    }

    let adapter: LocalSQLAdapterInstance;

    switch (config.type) {
      case 'local':
        if (!config.dbPath) {
          throw new Error('dbPath is required for local adapter');
        }
        adapter = new LocalSQLAdapter(config.dbPath, {
          collections: config.collections,
          // Default false: if the native engine can't load, connect() throws a
          // LocalBackendPersistenceError rather than silently losing data.
          allowEphemeral: config.allowEphemeral === true
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

  getAdapter(id: string): LocalSQLAdapterInstance | undefined {
    return this.adapters.get(id);
  }

  hasAdapter(id: string): boolean {
    return this.adapters.has(id);
  }

  /** Disconnect and remove an adapter. Silently does nothing if `id` is unknown. */
  async removeAdapter(id: string): Promise<void> {
    const adapter = this.adapters.get(id);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(id);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.disconnect();
    }
    this.adapters.clear();
  }

  listAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }
}

// Singleton instance
let _registryInstance: AdapterRegistry;

/** Get the singleton registry instance. */
export function getRegistry(): AdapterRegistry {
  if (!_registryInstance) {
    _registryInstance = new AdapterRegistry();
  }
  return _registryInstance;
}

export { LocalSQLAdapter, QueryBuilder, SchemaManager };

/** Convenience function — the `type: 'local'` case of {@link AdapterRegistry.createAdapter}. */
export const createLocalAdapter = async (
  id: string,
  dbPath: string,
  options: Partial<AdapterConfig> = {}
): Promise<LocalSQLAdapterInstance> => {
  return getRegistry().createAdapter(id, {
    type: 'local',
    dbPath,
    ...options
  });
};
