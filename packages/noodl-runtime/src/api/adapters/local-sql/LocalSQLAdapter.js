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
const { resolveEngine } = require('./engine');

/**
 * Thrown when the native SQLite engine cannot be loaded and the caller has not
 * opted in to the ephemeral (non-persisting) in-memory mode.
 *
 * Historically the adapter swallowed this failure and silently substituted an
 * in-memory mock, so records appeared to save and then vanished on restart —
 * the worst possible behaviour for a persistence layer. Failing loudly bounds
 * the damage: a clear error costs minutes, a silent one costs a weekend of work.
 *
 * @augments Error
 */
class LocalBackendPersistenceError extends Error {
  /**
   * @param {string} message - Human-readable, actionable message
   * @param {Error} [cause] - The underlying module-load error
   */
  constructor(message, cause) {
    super(message);
    this.name = 'LocalBackendPersistenceError';
    this.code = 'PERSISTENCE_ENGINE_UNAVAILABLE';
    if (cause) {
      this.cause = cause;
      this.causeMessage = cause.message;
    }
  }
}

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
   * @param {boolean} [options.allowEphemeral=false] - When the native SQLite engine
   *   cannot load, opt in to an in-memory mock instead of throwing. Data written in
   *   this mode is NOT persisted and is lost on restart; the caller is responsible
   *   for making that ephemerality visible to the user.
   */
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.options = {
      autoCreateTables: true,
      allowEphemeral: false,
      ...options
    };

    this.db = null;
    this.schemaManager = null;
    this.events = new EventEmitter();
    this.events.setMaxListeners(10000);

    // BAK-001: the post-commit change tap. `create`/`save`/`delete` are change
    // events consumed by the standalone backend's realtime (SSE) hub and by
    // WF-005 DB-change triggers — one tap, two consumers. Inside a transaction
    // they are BUFFERED and released only when the transaction commits; a
    // rollback drops them, so no change event can escape an uncommitted write.
    // Outside a transaction they emit immediately, exactly as before.
    this._txnDepth = 0;
    this._txnChangeBuffer = [];

    // Persistence state, queryable via getPersistenceStatus().
    // 'unknown' until connect() runs, then 'persistent' | 'ephemeral' | 'failed'.
    this._persistenceMode = 'unknown';
    this._loadError = null;
    this._usingMock = false;

    // Name of the resolved SQLite engine ('node:sqlite' | 'better-sqlite3' |
    // null before connect / on failure). Reported by getPersistenceStatus().
    this._engineName = null;

    // Test/embedding seam: callers (and the standalone backend package) may
    // inject a pre-resolved engine ({ name, open(dbPath) }) instead of letting
    // connect() resolve one. Defaults to the shared resolver (node:sqlite first).
    this._resolveEngine = options.engine ? () => options.engine : resolveEngine;

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

    // Resolve the SQLite engine (WF-004: node:sqlite preferred, better-sqlite3
    // as a legacy fallback — see ./engine.js). On failure we EITHER throw
    // (default) OR, if the caller explicitly opted in via options.allowEphemeral,
    // fall back to a clearly-labelled in-memory mock. We never silently
    // substitute the mock — see LocalBackendPersistenceError.
    let engine;
    try {
      engine = this._resolveEngine();
    } catch (e) {
      this._loadError = e;
      return this._handleEngineLoadFailure(e);
    }
    if (!engine) {
      const e = new Error(
        `No SQLite engine available. Node ${process.versions.node} lacks a usable ` +
          'node:sqlite (needs >= 22.13) and better-sqlite3 is not installed.'
      );
      this._loadError = e;
      return this._handleEngineLoadFailure(e);
    }

    try {
      this.db = engine.open(this.dbPath);
      this._engineName = engine.name;
      this._usingMock = false;
      this._persistenceMode = 'persistent';

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
      // The native module loaded but the database could not be opened (e.g. a
      // corrupt file or an ABI mismatch surfacing at instantiation). Treat this
      // the same way as a load failure: throw, or opt-in ephemeral — never silent.
      this._loadError = e;
      return this._handleEngineLoadFailure(e);
    }
  }

  /**
   * Handle the native SQLite engine being unavailable.
   *
   * Default: throw a clear, actionable error so the failure is visible.
   * Opt-in (options.allowEphemeral === true): fall back to an in-memory mock,
   * marked as ephemeral so callers can label it in the UI.
   *
   * @private
   * @param {Error} cause - The underlying load/open error
   */
  _handleEngineLoadFailure(cause) {
    if (!this.options.allowEphemeral) {
      this._persistenceMode = 'failed';
      throw new LocalBackendPersistenceError(
        'The local SQLite engine (better-sqlite3) could not be loaded, so the ' +
          'local backend cannot persist data. Data would be lost on restart, so ' +
          'the backend refused to start silently.\n' +
          `  Underlying error: ${cause && cause.message}\n` +
          '  What to do: rebuild the native module for this environment, or start ' +
          'the backend in explicit ephemeral mode (data will NOT persist) if you ' +
          'only need a throwaway session. Native-engine setup is tracked by WF-004.',
        cause
      );
    }

    // Explicit opt-in to ephemeral mode. Loud about what it is, not silent.
    console.warn(
      '[LocalSQLAdapter] Native SQLite engine unavailable — running in EPHEMERAL ' +
        'in-memory mode. Data will NOT be persisted and is lost on restart. ' +
        `(cause: ${cause && cause.message})`
    );
    this._usingMock = true;
    this._persistenceMode = 'ephemeral';
    this._mockData = {}; // { tableName: { objectId: record } }
    this._mockSchema = {};
    this.db = this._createMockDb();
    this.schemaManager = this._createMockSchemaManager();
  }

  /**
   * Report how this adapter is persisting data.
   *
   * @returns {{ mode: 'unknown'|'persistent'|'ephemeral'|'failed', persistent: boolean,
   *   ephemeral: boolean, engine: string, error: ({ message: string, code: string }|null) }}
   */
  getPersistenceStatus() {
    return {
      mode: this._persistenceMode,
      persistent: this._persistenceMode === 'persistent',
      ephemeral: this._persistenceMode === 'ephemeral',
      engine: this._engineName || (this._persistenceMode === 'ephemeral' ? 'ephemeral-mock' : null),
      error: this._loadError
        ? { message: this._loadError.message, code: this._loadError.code || 'ENGINE_LOAD_FAILED' }
        : null
    };
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
      removeRelation: () => {},
      // BAK-008: the mock cannot evaluate FTS5 (it regex-parses plain SQL),
      // same reasoning as _guardAclSupport — loud, specific errors instead of
      // a generic "not a function" TypeError or, worse, silent no-ops.
      hasFts5Support: () => false,
      hasSearchIndex: () => false,
      createSearchIndex: () => {
        throw new Error('Full-text search is not available in ephemeral (in-memory mock) mode.');
      },
      dropSearchIndex: () => {},
      rebuildSearchIndex: () => {
        throw new Error('Full-text search is not available in ephemeral (in-memory mock) mode.');
      }
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
   * Emit a post-write change event (`create` | `save` | `delete`). Inside an
   * open transaction the event is buffered and released only on commit; a
   * rollback discards it. This is the single post-commit change tap BAK-001
   * (realtime/SSE) and WF-005 (DB-change triggers) both subscribe to.
   *
   * @private
   * @param {{ type: string, id: string, collection: string, object?: Object }} event
   */
  _emitChange(event) {
    if (this._txnDepth > 0) {
      this._txnChangeBuffer.push(event);
      return;
    }
    this.events.emit(event.type, event);
  }

  /**
   * The ephemeral in-memory mock regex-parses SQL and cannot evaluate the ACL
   * predicate. Enforcing callers must never get silent non-enforcement, so an
   * acl option against the mock is a hard error (loud-failure doctrine).
   *
   * @private
   * @param {Object} options
   */
  _guardAclSupport(options) {
    if (options.acl && this._usingMock) {
      throw new Error(
        'ACL enforcement is not available in ephemeral (in-memory mock) mode — ' +
          'refusing to run an access-controlled operation without enforcement.'
      );
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
      this._guardAclSupport(options);

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
   * The ephemeral in-memory mock cannot evaluate FTS5 MATCH queries (it
   * regex-parses plain SQL, not virtual-table syntax). Loud-failure doctrine:
   * refuse explicitly rather than silently returning nothing or degrading to
   * a substring scan the caller never asked for.
   *
   * @private
   */
  _guardSearchSupport() {
    if (this._usingMock) {
      throw new Error(
        'Full-text search is not available in ephemeral (in-memory mock) mode — the mock cannot evaluate FTS5 queries.'
      );
    }
  }

  /**
   * Full-text search a collection (BAK-008): the FTS5 MATCH predicate joined
   * with the normal structured filter and the row-level ACL predicate (the
   * same buildAclPredicate() query() uses — search results are filtered by
   * ACL exactly like any other query, never post-filtered in JS), ranked by
   * BM25, with a highlighted snippet. `options.search` is required and must be
   * a non-empty string; there is no bare-query fallback here (callers decide
   * whether to call query() or search()).
   *
   * @param {Object} options - Same shape as query(), plus options.search (string).
   */
  search(options) {
    try {
      this._ensureTable(options.collection);
      this._guardAclSupport(options);
      this._guardSearchSupport();

      if (!options.search || typeof options.search !== 'string') {
        options.error('search() requires a non-empty "search" term');
        return;
      }

      const schema = this._getSchema(options.collection);
      const { sql, params } = QueryBuilder.buildSearchSelect(options, schema);

      const rows = this.db.prepare(sql).all(...params);
      const results = rows.map((row) => {
        const { _rank, _snippet, ...rest } = row;
        const record = this._rowToRecord(rest, options.collection);
        // bm25() is lower-is-better (often negative) in SQLite; flip the sign
        // so callers see the more intuitive higher-is-better "_score".
        record._score = typeof _rank === 'number' ? -_rank : undefined;
        record._snippet = _snippet;
        return record;
      });

      let count;
      if (options.count) {
        const { sql: countSQL, params: countParams } = QueryBuilder.buildSearchCount(options, schema);
        const countRow = this.db.prepare(countSQL).get(...countParams);
        count = countRow?.count || 0;
      }

      options.success(results, count);
    } catch (e) {
      if (/no such table/i.test(e.message || '')) {
        options.error(
          `Search is not enabled for collection "${options.collection}" (no search index). ` +
            'Enable search for this collection first.'
        );
        return;
      }
      console.error('LocalSQLAdapter.search error:', e);
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
      this._guardAclSupport(options);

      const params = [options.id || options.objectId];
      let sql = `SELECT * FROM ${QueryBuilder.escapeTable(options.collection)} WHERE "objectId" = ?`;
      // Row-level read check: an unreadable row answers exactly like a missing
      // one (existence hiding).
      const aclClause = QueryBuilder.buildAclPredicate(options.collection, options.acl, params);
      if (aclClause) {
        sql += ` AND ${aclClause}`;
      }
      const recordId = params[0];
      const row = this.db.prepare(sql).get(...params);

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

      this._emitChange({
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

      this._guardAclSupport(options);
      const recordId = options.id || options.objectId;
      const { sql, params } = QueryBuilder.buildUpdate(options);
      const result = this.db.prepare(sql).run(...params);

      // With an ACL context, 0 rows changed means not-found or forbidden —
      // deliberately indistinguishable (the write predicate is compiled into
      // the UPDATE itself, so there is no read-then-write race).
      if (options.acl && (!result || result.changes === 0)) {
        options.error('Object not found');
        return;
      }

      // Fetch the updated record
      const updatedRow = this.db
        .prepare(`SELECT * FROM ${QueryBuilder.escapeTable(options.collection)} WHERE "objectId" = ?`)
        .get(recordId);

      const record = this._rowToRecord(updatedRow, options.collection);

      options.success(record);

      this._emitChange({
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
      this._guardAclSupport(options);

      const recordId = options.id || options.objectId;

      // Capture the row before deletion so change consumers (BAK-001 realtime,
      // WF-005 triggers) receive the deleted record — including its ACL, which
      // delivery-time permission checks need. This read is unfiltered; the
      // DELETE itself carries the ACL predicate and decides whether the row is
      // actually removed.
      let removedRecord = null;
      try {
        const existingRow = this.db
          .prepare(`SELECT * FROM ${QueryBuilder.escapeTable(options.collection)} WHERE "objectId" = ?`)
          .get(recordId);
        removedRecord = this._rowToRecord(existingRow, options.collection);
      } catch (e) {
        removedRecord = null;
      }

      const { sql, params } = QueryBuilder.buildDelete(options);
      const result = this.db.prepare(sql).run(...params);

      if (options.acl && (!result || result.changes === 0)) {
        options.error('Object not found');
        return;
      }

      options.success();

      this._emitChange({
        type: 'delete',
        id: recordId,
        object: removedRecord || { objectId: recordId },
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
      this._guardAclSupport(options);

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
      this._guardAclSupport(options);

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
      this._guardAclSupport(options);

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
      this._guardAclSupport(options);

      const { sql, params } = QueryBuilder.buildIncrement(options);
      const result = this.db.prepare(sql).run(...params);

      if (options.acl && (!result || result.changes === 0)) {
        options.error('Object not found');
        return;
      }

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
    // Track transaction depth so change events emitted by create/save/delete
    // inside `fn` are buffered (see _emitChange) and released only if the
    // transaction commits. A rollback (fn throws) discards the buffer — the
    // post-commit contract the realtime/trigger consumers rely on.
    this._txnDepth++;
    let result;
    try {
      result = this.db.transaction(fn)();
    } catch (e) {
      this._txnDepth--;
      if (this._txnDepth === 0) this._txnChangeBuffer = [];
      throw e;
    }
    this._txnDepth--;
    if (this._txnDepth === 0 && this._txnChangeBuffer.length > 0) {
      const buffered = this._txnChangeBuffer;
      this._txnChangeBuffer = [];
      for (const ev of buffered) this.events.emit(ev.type, ev);
    }
    return result;
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

LocalSQLAdapter.LocalBackendPersistenceError = LocalBackendPersistenceError;

module.exports = LocalSQLAdapter;
module.exports.LocalBackendPersistenceError = LocalBackendPersistenceError;
