/**
 * LocalSQL Adapter Module
 *
 * SQLite-based implementation of the CloudStore adapter interface.
 * Provides local storage with the same API as Parse-based CloudStore.
 *
 * @module adapters/local-sql
 */

import LocalSQLAdapter = require('./LocalSQLAdapter');
import QueryBuilder = require('./QueryBuilder');
import SchemaManager = require('./SchemaManager');
import engine = require('./engine');

export = {
  LocalSQLAdapter,
  LocalBackendPersistenceError: LocalSQLAdapter.LocalBackendPersistenceError,
  QueryBuilder,
  SchemaManager,
  resolveEngine: engine.resolveEngine,
  engine
};
