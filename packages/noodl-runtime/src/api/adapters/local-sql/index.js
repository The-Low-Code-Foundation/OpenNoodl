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

module.exports = {
  LocalSQLAdapter,
  QueryBuilder,
  SchemaManager
};
