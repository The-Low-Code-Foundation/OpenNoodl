/**
 * LocalSQLAdapter - SQLite-based CloudStore adapter
 *
 * Implements the CloudStore interface using SQLite for local storage.
 * Provides the same API as the Parse-based CloudStore but stores
 * data locally using better-sqlite3.
 *
 * @module adapters/local-sql/LocalSQLAdapter
 */

const EventEmitter = require('../../../events');
const QueryBuilder = require('./QueryBuilder');
const SchemaManager = require('./SchemaManager');

/**
 * Generate a UUID v4
 *
 * @returns {string} UUID string (e.g., "123e4567-e89b-12d3-a456-426614174000")
 */
function generateUUID() {
  // RFC 4122 version 4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * LocalSQLAdapter class
 *
 * Implements the same interface as CloudStore but uses SQLite
 */
class LocalSQLAdapter {
  /**
   * @param {string} dbPath - Path to SQLite database file
   * @param {Object} [options] - Configuration options
   * @param {boolean} [options.autoCreateTables=true] - Auto-create tables on first access
   * @param {Object} [options.collections] - Collection schemas (same as dbCollections metadata)
   */
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.options = {
      autoCreateTables: true,
      ...options
    };

    this.db = null;
    this.schemaManager = null;
    this.events = new EventEmitter();
    this.events.setMaxListeners(10000);

    // Collection schemas (like CloudStore._collections)
    this._collections = options.collections || {};
  }

  /**
   * Connect to the database
   *
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.db) {
      return; // Already connected
    }

    // Dynamic import of better-sqlite3 (Node.js only)
    // Falls back to in-memory mock when not available
    try {
      const Database = require('better-sqlite3');
      this.db = new Database(this.dbPath);
      this._usingMock = false;

      // Enable WAL mode for better concurrent access
      this.db.pragma('journal_mode = WAL');

      // Initialize schema manager
      this.schemaManager = new SchemaManager(this.db);
      this.schemaManager.ensureSchemaTable();

      // Create tables from collections if provided
      if (this.options.autoCreateTables && this._collections) {
        for (const [name, collection] of Object.entries(this._collections)) {
          if (collection.schema) {
            this.schemaManager.createTable({
              name,
              columns: Object.entries(collection.schema.properties || {}).map(([colName, colDef]) => ({
                name: colName,
                type: colDef.type,
                required: colDef.required,
                targetClass: colDef.targetClass
              }))
            });
          }
        }
      }
    } catch (e) {
      // Fallback to in-memory mock when better-sqlite3 not available
      console.warn('[LocalSQLAdapter] better-sqlite3 not available, using in-memory mock');
      this._usingMock = true;
      this._mockData = {}; // { tableName: { objectId: record } }
      this._mockSchema = {};
      this.db = this._createMockDb();
      this.schemaManager = this._createMockSchemaManager();
    }
  }

  /**
   * Create a mock database object that stores data in memory
   * @private
   */
  _createMockDb() {
    const self = this;
    return {
      prepare: (sql) => ({
        get: (...params) => self._mockExec(sql, params, 'get'),
        all: (...params) => self._mockExec(sql, params, 'all'),
        run: (...params) => self._mockExec(sql, params, 'run')
      }),
      exec: () => {},
      close: () => {},
      pragma: () => {},
      transaction: (fn) => fn
    };
  }

  /**
   * Create a mock schema manager
   * @private
   */
  _createMockSchemaManager() {
    const self = this;
    return {
      ensureSchemaTable: () => {},
      createTable: ({ name, columns }) => {
        if (!self._mockData[name]) {
          self._mockData[name] = {};
          self._mockSchema[name] = { name, columns: columns || [] };
        }
        return true;
      },
      addColumn: (table, col) => {
        if (!self._mockSchema[table]) self._mockSchema[table] = { name: table, columns: [] };
        if (!self._mockSchema[table].columns) self._mockSchema[table].columns = [];
        // Check if column already exists
        const exists = self._mockSchema[table].columns.some((c) => c.name === col.name);
        if (!exists) {
          self._mockSchema[table].columns.push(col);
        }
      },
      getTableSchema: (table) => self._mockSchema[table] || null,
      listTables: () => Object.keys(self._mockData).filter((name) => !name.startsWith('_')),
      exportSchemas: () => Object.values(self._mockSchema).filter((s) => s && !s.name?.startsWith('_')),
      addRelation: () => {},
      removeRelation: () => {}
    };
  }

  /**
   * Execute mock SQL operations
   * @private
   */
  _mockExec(sql, params, mode) {
    // Parse SQL patterns for mock execution
    // Match SELECT with optional WHERE, ORDER BY, LIMIT, OFFSET
    const selectMatch = sql.match(/SELECT\s+\*\s+FROM\s+"?(\w+)"?/i);
    const insertMatch = sql.match(/INSERT INTO "?(\w+)"?/i);
    const updateMatch = sql.match(/UPDATE "?(\w+)"?\s+SET/i);
    const deleteMatch = sql.match(/DELETE FROM "?(\w+)"?/i);

    if (selectMatch) {
      const table = selectMatch[1];
      if (!this._mockData[table]) this._mockData[table] = {};

      let records = Object.values(this._mockData[table]);

      // Check for WHERE id = ? or WHERE objectId = ?
      const idMatch = sql.match(/WHERE\s+"?(?:id|objectId)"?\s*=\s*\?/i);
      if (idMatch && params.length > 0) {
        const recordId = params[0];
        const record = this._mockData[table][recordId];
        return mode === 'get' ? record || null : record ? [record] : [];
      }

      // Handle ORDER BY
      const orderMatch = sql.match(/ORDER BY\s+"?(\w+)"?\s+(ASC|DESC)?/i);
      if (orderMatch) {
        const orderCol = orderMatch[1];
        const orderDir = (orderMatch[2] || 'ASC').toUpperCase();
        records = records.sort((a, b) => {
          const aVal = a[orderCol];
          const bVal = b[orderCol];
          if (aVal < bVal) return orderDir === 'ASC' ? -1 : 1;
          if (aVal > bVal) return orderDir === 'ASC' ? 1 : -1;
          return 0;
        });
      }

      // Handle LIMIT and OFFSET
      // Find position of LIMIT in params (it comes after WHERE params if any)
      let paramIndex = 0;
      if (sql.includes('LIMIT')) {
        // Find LIMIT param position - it's after WHERE params
        const limitIdx = sql.indexOf('LIMIT');
        const whereClause = sql.substring(0, limitIdx);
        const whereParams = (whereClause.match(/\?/g) || []).length;
        paramIndex = whereParams;

        const limit = params[paramIndex];
        const skip = sql.includes('OFFSET') ? params[paramIndex + 1] || 0 : 0;
        records = records.slice(skip, skip + limit);
      }

      return mode === 'get' ? records[0] || null : records;
    }

    if (insertMatch) {
      const table = insertMatch[1];
      if (!this._mockData[table]) this._mockData[table] = {};

      // Parse column names from SQL: INSERT INTO table (col1, col2, ...) VALUES (?, ?, ...)
      const columnsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
      if (columnsMatch) {
        const columns = columnsMatch[1].split(',').map((c) => c.trim().replace(/"/g, ''));
        const record = {};
        columns.forEach((col, idx) => {
          record[col] = params[idx];
        });
        // Ensure id exists
        if (!record.id && params[0]) {
          record.id = params[0];
        }
        const recordId = record.id;
        this._mockData[table][recordId] = record;
        return { changes: 1 };
      }

      // Fallback: simple record creation
      const now = new Date().toISOString();
      const record = { id: params[0], createdAt: now, updatedAt: now };
      this._mockData[table][params[0]] = record;
      return { changes: 1 };
    }

    if (updateMatch) {
      const table = updateMatch[1];
      // Last param is typically the id in WHERE clause
      const recordId = params[params.length - 1];
      if (this._mockData[table] && this._mockData[table][recordId]) {
        // Parse SET clauses to update actual fields
        const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
        if (setMatch) {
          const setParts = setMatch[1].split(',');
          let paramIdx = 0;
          setParts.forEach((part) => {
            const colMatch = part.match(/"?(\w+)"?\s*=/);
            if (colMatch) {
              this._mockData[table][recordId][colMatch[1]] = params[paramIdx];
              paramIdx++;
            }
          });
        }
        this._mockData[table][recordId].updatedAt = new Date().toISOString();
      }
      return { changes: 1 };
    }

    if (deleteMatch) {
      const table = deleteMatch[1];
      const recordId = params[0];
      if (this._mockData[table]) {
        delete this._mockData[table][recordId];
      }
      return { changes: 1 };
    }

    // Count query
    if (sql.includes('COUNT(*)')) {
      const countMatch = sql.match(/FROM\s+"?(\w+)"?/i);
      if (countMatch) {
        const table = countMatch[1];
        const count = Object.keys(this._mockData[table] || {}).length;
        return mode === 'get' ? { count } : [{ count }];
      }
    }

    return mode === 'get' ? null : [];
  }

  /**
   * Disconnect from the database
   *
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.schemaManager = null;
    }
  }

  /**
   * Ensure table exists (auto-create if needed)
   *
   * @private
   * @param {string} collection - Collection name
   */
  _ensureTable(collection) {
    if (!this.schemaManager) {
      throw new Error('Database not connected');
    }

    // Check if table exists
    const exists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(collection);

    if (!exists && this.options.autoCreateTables) {
      // Auto-create table with basic schema
      this.schemaManager.createTable({
        name: collection,
        columns: []
      });
    }
  }

  /**
   * Get schema for a collection
   *
   * @private
   * @param {string} collection - Collection name
   * @returns {Object|null}
   */
  _getSchema(collection) {
    if (this._collections[collection]) {
      return this._collections[collection].schema;
    }
    return this.schemaManager?.getTableSchema(collection);
  }

  /**
   * Convert a database row to a record object
   *
   * @private
   * @param {Object} row - Database row
   * @param {string} collection - Collection name
   * @returns {Object}
   */
  _rowToRecord(row, collection) {
    if (!row) return null;

    const schema = this._getSchema(collection);
    const record = {};

    for (const [key, value] of Object.entries(row)) {
      const colType = schema?.properties?.[key]?.type;
      record[key] = QueryBuilder.deserializeValue(value, colType);
    }

    return record;
  }

  // =========================================================================
  // CloudStore Interface Methods
  // =========================================================================

  /**
   * Subscribe to events
   *
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} [context] - Context for handler
   */
  on(event, handler, context) {
    this.events.on(event, handler, context);
  }

  /**
   * Unsubscribe from events
   *
   * @param {string} [event] - Event name (optional - removes all if not provided)
   * @param {Function} [handler] - Event handler
   * @param {Object} [context] - Context
   */
  off(event, handler, context) {
    if (event) {
      this.events.off(event, handler, context);
    } else {
      this.events.removeAllListeners();
    }
  }

  /**
   * Query records
   *
   * @param {Object} options - Query options
   */
  query(options) {
    try {
      this._ensureTable(options.collection);

      const schema = this._getSchema(options.collection);
      const { sql, params } = QueryBuilder.buildSelect(options, schema);

      const rows = this.db.prepare(sql).all(...params);
      const results = rows.map((row) => this._rowToRecord(row, options.collection));

      // Handle count if requested
      let count;
      if (options.count) {
        const { sql: countSQL, params: countParams } = QueryBuilder.buildCount(options, schema);
        const countRow = this.db.prepare(countSQL).get(...countParams);
        count = countRow?.count || 0;
      }

      options.success(results, count);
    } catch (e) {
      console.error('LocalSQLAdapter.query error:', e);
      options.error(e.message);
    }
  }

  /**
   * Fetch a single record
   *
   * @param {Object} options - Fetch options
   */
  fetch(options) {
    try {
      this._ensureTable(options.collection);

      const sql = `SELECT * FROM ${QueryBuilder.escapeTable(options.collection)} WHERE "objectId" = ?`;
      const recordId = options.id || options.objectId;
      const row = this.db.prepare(sql).get(recordId);

      if (!row) {
        options.error('Object not found');
        return;
      }

      const record = this._rowToRecord(row, options.collection);

      options.success(record);

      this.events.emit('fetch', {
        type: 'fetch',
        id: recordId,
        object: record,
        collection: options.collection
      });
    } catch (e) {
      console.error('LocalSQLAdapter.fetch error:', e);
      options.error(e.message);
    }
  }

  /**
   * Create a new record
   *
   * @param {Object} options - Create options
   */
  create(options) {
    try {
      this._ensureTable(options.collection);

      // Auto-add columns for new fields
      if (this.options.autoCreateTables && this.schemaManager) {
        for (const [key, value] of Object.entries(options.data)) {
          if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
            const type = this._inferType(value);
            this.schemaManager.addColumn(options.collection, { name: key, type });
          }
        }
      }

      const recordId = generateUUID();
      const { sql, params } = QueryBuilder.buildInsert(options, recordId);

      this.db.prepare(sql).run(...params);

      // Fetch the created record to get all fields
      const createdRow = this.db
        .prepare(`SELECT * FROM ${QueryBuilder.escapeTable(options.collection)} WHERE "objectId" = ?`)
        .get(recordId);

      const record = this._rowToRecord(createdRow, options.collection);

      options.success(record);

      this.events.emit('create', {
        type: 'create',
        id: recordId,
        object: record,
        collection: options.collection
      });
    } catch (e) {
      console.error('LocalSQLAdapter.create error:', e);
      options.error(e.message);
    }
  }

  /**
   * Save (update) an existing record
   *
   * @param {Object} options - Save options
   */
  save(options) {
    try {
      this._ensureTable(options.collection);

      // Auto-add columns for new fields
      if (this.options.autoCreateTables && this.schemaManager) {
        for (const [key, value] of Object.entries(options.data)) {
          if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
            const type = this._inferType(value);
            this.schemaManager.addColumn(options.collection, { name: key, type });
          }
        }
      }

      const recordId = options.id || options.objectId;
      const { sql, params } = QueryBuilder.buildUpdate(options);
      this.db.prepare(sql).run(...params);

      // Fetch the updated record
      const updatedRow = this.db
        .prepare(`SELECT * FROM ${QueryBuilder.escapeTable(options.collection)} WHERE "objectId" = ?`)
        .get(recordId);

      const record = this._rowToRecord(updatedRow, options.collection);

      options.success(record);

      this.events.emit('save', {
        type: 'save',
        id: recordId,
        object: record,
        collection: options.collection
      });
    } catch (e) {
      console.error('LocalSQLAdapter.save error:', e);
      options.error(e.message);
    }
  }

  /**
   * Delete a record
   *
   * @param {Object} options - Delete options
   */
  delete(options) {
    try {
      this._ensureTable(options.collection);

      const { sql, params } = QueryBuilder.buildDelete(options);
      this.db.prepare(sql).run(...params);

      options.success();

      const recordId = options.id || options.objectId;
      this.events.emit('delete', {
        type: 'delete',
        id: recordId,
        collection: options.collection
      });
    } catch (e) {
      console.error('LocalSQLAdapter.delete error:', e);
      options.error(e.message);
    }
  }

  /**
   * Count records
   *
   * @param {Object} options - Count options
   */
  count(options) {
    try {
      this._ensureTable(options.collection);

      const schema = this._getSchema(options.collection);
      const { sql, params } = QueryBuilder.buildCount(options, schema);

      const row = this.db.prepare(sql).get(...params);
      options.success(row?.count || 0);
    } catch (e) {
      console.error('LocalSQLAdapter.count error:', e);
      options.error(e.message);
    }
  }

  /**
   * Aggregate records
   *
   * @param {Object} options - Aggregate options
   */
  aggregate(options) {
    try {
      this._ensureTable(options.collection);

      const { sql, params } = QueryBuilder.buildAggregate(options);
      const row = this.db.prepare(sql).get(...params);

      // Format result like Parse Server
      const result = {};
      if (row) {
        for (const key of Object.keys(options.group)) {
          result[key] = row[key];
        }
      }

      options.success(result);
    } catch (e) {
      console.error('LocalSQLAdapter.aggregate error:', e);
      options.error(e.message);
    }
  }

  /**
   * Get distinct values
   *
   * @param {Object} options - Distinct options
   */
  distinct(options) {
    try {
      this._ensureTable(options.collection);

      const { sql, params } = QueryBuilder.buildDistinct(options);
      const rows = this.db.prepare(sql).all(...params);

      const results = rows.map((r) => r[options.property]);
      options.success(results);
    } catch (e) {
      console.error('LocalSQLAdapter.distinct error:', e);
      options.error(e.message);
    }
  }

  /**
   * Increment properties
   *
   * @param {Object} options - Increment options
   */
  increment(options) {
    try {
      this._ensureTable(options.collection);

      const { sql, params } = QueryBuilder.buildIncrement(options);
      this.db.prepare(sql).run(...params);

      // Fetch the updated record
      const recordId = options.id || options.objectId;
      const updatedRow = this.db
        .prepare(`SELECT * FROM ${QueryBuilder.escapeTable(options.collection)} WHERE "objectId" = ?`)
        .get(recordId);

      const record = this._rowToRecord(updatedRow, options.collection);
      options.success(record);
    } catch (e) {
      console.error('LocalSQLAdapter.increment error:', e);
      options.error(e.message);
    }
  }

  /**
   * Add a relation
   *
   * @param {Object} options - Relation options
   */
  addRelation(options) {
    try {
      this.schemaManager.addRelation(options.collection, options.objectId, options.key, options.targetObjectId);

      options.success({});
    } catch (e) {
      console.error('LocalSQLAdapter.addRelation error:', e);
      options.error(e.message);
    }
  }

  /**
   * Remove a relation
   *
   * @param {Object} options - Relation options
   */
  removeRelation(options) {
    try {
      this.schemaManager.removeRelation(options.collection, options.objectId, options.key, options.targetObjectId);

      options.success({});
    } catch (e) {
      console.error('LocalSQLAdapter.removeRelation error:', e);
      options.error(e.message);
    }
  }

  // =========================================================================
  // Additional LocalSQL-specific methods
  // =========================================================================

  /**
   * Get the schema manager instance
   *
   * @returns {SchemaManager}
   */
  getSchemaManager() {
    return this.schemaManager;
  }

  /**
   * Get the raw database instance
   *
   * @returns {import('better-sqlite3').Database}
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Execute raw SQL (use with caution!)
   *
   * @param {string} sql - SQL statement
   * @param {Array} [params] - Parameters
   * @returns {any}
   */
  exec(sql, params = []) {
    if (params.length > 0) {
      return this.db.prepare(sql).all(...params);
    }
    return this.db.exec(sql);
  }

  /**
   * Run a transaction
   *
   * @param {Function} fn - Function to run in transaction
   * @returns {any}
   */
  transaction(fn) {
    return this.db.transaction(fn)();
  }

  /**
   * Infer type from a JavaScript value
   *
   * @private
   * @param {*} value
   * @returns {string}
   */
  _inferType(value) {
    if (value === null || value === undefined) {
      return 'String';
    }
    if (typeof value === 'string') {
      return 'String';
    }
    if (typeof value === 'number') {
      return 'Number';
    }
    if (typeof value === 'boolean') {
      return 'Boolean';
    }
    if (value instanceof Date) {
      return 'Date';
    }
    if (Array.isArray(value)) {
      return 'Array';
    }
    if (typeof value === 'object') {
      if (value.__type === 'Date') return 'Date';
      if (value.__type === 'Pointer') return 'Pointer';
      if (value.__type === 'File') return 'File';
      if (value.__type === 'GeoPoint') return 'GeoPoint';
      return 'Object';
    }
    return 'String';
  }
}

module.exports = LocalSQLAdapter;
