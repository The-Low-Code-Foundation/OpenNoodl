/**
 * LocalSQL Adapter Module
 *
 * SQLite-based implementation of the CloudStore adapter interface.
 * Provides local storage with the same API as Parse-based CloudStore.
 *
 * @module adapters/local-sql
 */

const LocalSQLAdapter = require('./LocalSQLAdapter');
const QueryBuilder = require('./QueryBuilder');
const SchemaManager = require('./SchemaManager');
const engine = require('./engine');

module.exports = {
  LocalSQLAdapter,
  LocalBackendPersistenceError: LocalSQLAdapter.LocalBackendPersistenceError,
  QueryBuilder,
  SchemaManager,
  resolveEngine: engine.resolveEngine,
  engine
};
