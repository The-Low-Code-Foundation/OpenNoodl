/**
 * SchemaManager - Handles SQLite schema creation, migration, and export
 *
 * Manages table creation based on Noodl collection schemas,
 * handles migrations when schema changes, and can export
 * schemas to other database formats (Postgres, Supabase, etc.)
 *
 * @module adapters/local-sql/SchemaManager
 */

const { escapeTable, escapeColumn } = require('./QueryBuilder');

/**
 * Map Noodl/Parse types to SQLite types
 *
 * @type {Object<string, string>}
 */
const TYPE_MAP = {
  String: 'TEXT',
  Number: 'REAL',
  Boolean: 'INTEGER', // SQLite uses 0/1
  Date: 'TEXT', // ISO8601 string
  Object: 'TEXT', // JSON string
  Array: 'TEXT', // JSON string
  Pointer: 'TEXT', // objectId reference
  Relation: null, // Handled via junction tables
  GeoPoint: 'TEXT', // JSON string
  File: 'TEXT' // JSON string with url/name
};

/**
 * Map Noodl types to PostgreSQL types (for export)
 *
 * @type {Object<string, string>}
 */
const POSTGRES_TYPE_MAP = {
  String: 'TEXT',
  Number: 'NUMERIC',
  Boolean: 'BOOLEAN',
  Date: 'TIMESTAMPTZ',
  Object: 'JSONB',
  Array: 'JSONB',
  Pointer: 'TEXT', // or UUID with FK
  Relation: null,
  GeoPoint: 'POINT', // or use PostGIS
  File: 'JSONB'
};

/**
 * SchemaManager class
 */
class SchemaManager {
  /**
   * @param {import('better-sqlite3').Database} db - SQLite database instance
   */
  constructor(db) {
    this.db = db;
    this._schemaCache = new Map();
  }

  /**
   * Ensure the internal schema tracking table exists
   */
  ensureSchemaTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "_Schema" (
        "name" TEXT PRIMARY KEY,
        "schema" TEXT NOT NULL,
        "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Create a table from a schema definition
   *
   * @param {Object} schema - Table schema
   * @param {string} schema.name - Table name
   * @param {Array<Object>} schema.columns - Column definitions
   * @returns {boolean} Whether table was created (false if already existed)
   */
  createTable(schema) {
    const tableName = schema.name;

    // Check if table exists
    const exists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);

    if (exists) {
      return false;
    }

    // Build column definitions
    const columnDefs = [
      '"objectId" TEXT PRIMARY KEY',
      '"createdAt" TEXT DEFAULT CURRENT_TIMESTAMP',
      '"updatedAt" TEXT DEFAULT CURRENT_TIMESTAMP',
      '"ACL" TEXT' // Access control list as JSON
    ];

    // Add user-defined columns
    for (const col of schema.columns || []) {
      const colDef = this._columnToSQL(col);
      if (colDef) {
        columnDefs.push(colDef);
      }
    }

    // Create main table
    const createSQL = `CREATE TABLE ${escapeTable(tableName)} (${columnDefs.join(', ')})`;
    this.db.exec(createSQL);

    // Create standard indexes
    this.db.exec(`CREATE INDEX IF NOT EXISTS "idx_${tableName}_createdAt" ON ${escapeTable(tableName)}("createdAt")`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS "idx_${tableName}_updatedAt" ON ${escapeTable(tableName)}("updatedAt")`);

    // Create junction tables for relations
    for (const col of schema.columns || []) {
      if (col.type === 'Relation' && col.targetClass) {
        this._createJunctionTable(tableName, col.name, col.targetClass);
      }
    }

    // Store schema in tracking table
    this.ensureSchemaTable();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO "_Schema" ("name", "schema", "updatedAt") 
       VALUES (?, ?, CURRENT_TIMESTAMP)`
      )
      .run(tableName, JSON.stringify(schema));

    this._schemaCache.set(tableName, schema);

    return true;
  }

  /**
   * Add a column to an existing table
   *
   * @param {string} tableName - Table name
   * @param {Object} column - Column definition
   */
  addColumn(tableName, column) {
    const colDef = this._columnToSQL(column);
    if (!colDef) {
      return;
    }

    try {
      this.db.exec(`ALTER TABLE ${escapeTable(tableName)} ADD COLUMN ${colDef}`);

      // Update schema tracking
      const schema = this.getTableSchema(tableName);
      if (schema) {
        schema.columns = schema.columns || [];
        schema.columns.push(column);
        this.db
          .prepare(`UPDATE "_Schema" SET "schema" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = ?`)
          .run(JSON.stringify(schema), tableName);
        this._schemaCache.set(tableName, schema);
      }
    } catch (e) {
      // Column may already exist
      if (!e.message.includes('duplicate column name')) {
        throw e;
      }
    }
  }

  /**
   * Delete a table and all its data
   *
   * @param {string} tableName - Table name
   * @returns {boolean} Whether table was deleted
   */
  deleteTable(tableName) {
    // Check if table exists
    const exists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);

    if (!exists) {
      return false;
    }

    // Drop the table
    this.db.exec(`DROP TABLE IF EXISTS ${escapeTable(tableName)}`);

    // Remove from schema tracking
    this.ensureSchemaTable();
    this.db.prepare('DELETE FROM "_Schema" WHERE "name" = ?').run(tableName);

    // Clear cache
    this._schemaCache.delete(tableName);

    // Drop any junction tables for relations
    const junctionTables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?")
      .all(`_Join_%_${tableName}`);

    for (const jt of junctionTables) {
      this.db.exec(`DROP TABLE IF EXISTS ${escapeTable(jt.name)}`);
    }

    return true;
  }

  /**
   * Rename a column in a table (SQLite 3.25.0+)
   *
   * @param {string} tableName - Table name
   * @param {string} oldName - Current column name
   * @param {string} newName - New column name
   * @returns {boolean} Whether column was renamed
   */
  renameColumn(tableName, oldName, newName) {
    // Validate new name
    if (!newName || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(newName)) {
      throw new Error('Invalid column name');
    }

    // Can't rename system columns
    const systemCols = ['objectId', 'createdAt', 'updatedAt', 'ACL'];
    if (systemCols.includes(oldName)) {
      throw new Error('Cannot rename system columns');
    }

    try {
      this.db.exec(
        `ALTER TABLE ${escapeTable(tableName)} RENAME COLUMN ${escapeColumn(oldName)} TO ${escapeColumn(newName)}`
      );

      // Update schema tracking
      const schema = this.getTableSchema(tableName);
      if (schema && schema.columns) {
        const col = schema.columns.find((c) => c.name === oldName);
        if (col) {
          col.name = newName;
          this.db
            .prepare(`UPDATE "_Schema" SET "schema" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "name" = ?`)
            .run(JSON.stringify(schema), tableName);
          this._schemaCache.set(tableName, schema);
        }
      }

      return true;
    } catch (e) {
      if (e.message.includes('no such column')) {
        throw new Error(`Column "${oldName}" does not exist`);
      }
      throw e;
    }
  }

  /**
   * Get schema for a table
   *
   * @param {string} tableName - Table name
   * @returns {Object|null} Schema definition or null
   */
  getTableSchema(tableName) {
    if (this._schemaCache.has(tableName)) {
      return this._schemaCache.get(tableName);
    }

    this.ensureSchemaTable();

    const row = this.db.prepare('SELECT "schema" FROM "_Schema" WHERE "name" = ?').get(tableName);

    if (row) {
      const schema = JSON.parse(row.schema);
      this._schemaCache.set(tableName, schema);
      return schema;
    }

    return null;
  }

  /**
   * List all tables
   *
   * @returns {string[]} Table names
   */
  listTables() {
    // NB: `_` is a LIKE wildcard matching any single character — unescaped,
    // `NOT LIKE '_%'` excludes EVERY table, not just underscore-prefixed ones.
    // Latent for as long as only the in-memory mock ran; surfaced by the real
    // engine (WF-004).
    const rows = this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite%' AND name NOT LIKE '\\_%' ESCAPE '\\'"
      )
      .all();

    return rows.map((r) => r.name);
  }

  /**
   * Export all schemas
   *
   * @returns {Object[]} Array of schema definitions
   */
  exportSchemas() {
    this.ensureSchemaTable();

    // Same wildcard-escape fix as listTables() — `_%` unescaped matches everything.
    const rows = this.db.prepare('SELECT "name", "schema" FROM "_Schema" WHERE "name" NOT LIKE \'\\_%\' ESCAPE \'\\\'').all();

    return rows.map((r) => JSON.parse(r.schema));
  }

  /**
   * Generate PostgreSQL-compatible SQL for migration
   *
   * @returns {string} SQL statements
   */
  generatePostgresSQL() {
    const schemas = this.exportSchemas();
    const statements = [];

    statements.push('-- Generated by Noodl LocalSQL Export');
    statements.push('-- PostgreSQL Schema');
    statements.push('');

    for (const schema of schemas) {
      statements.push(`-- Table: ${schema.name}`);

      const columnDefs = [
        '"objectId" TEXT PRIMARY KEY',
        '"createdAt" TIMESTAMPTZ DEFAULT NOW()',
        '"updatedAt" TIMESTAMPTZ DEFAULT NOW()',
        '"ACL" JSONB'
      ];

      for (const col of schema.columns || []) {
        const pgType = POSTGRES_TYPE_MAP[col.type];
        if (pgType) {
          let def = `"${col.name}" ${pgType}`;
          if (col.required) def += ' NOT NULL';
          columnDefs.push(def);
        }
      }

      statements.push(`CREATE TABLE IF NOT EXISTS "${schema.name}" (`);
      statements.push(`  ${columnDefs.join(',\n  ')}`);
      statements.push(');');
      statements.push('');

      // Indexes
      statements.push(`CREATE INDEX IF NOT EXISTS "idx_${schema.name}_createdAt" ON "${schema.name}"("createdAt");`);
      statements.push(`CREATE INDEX IF NOT EXISTS "idx_${schema.name}_updatedAt" ON "${schema.name}"("updatedAt");`);
      statements.push('');

      // Add updatedAt trigger
      statements.push(`-- Trigger for auto-updating updatedAt`);
      statements.push(`CREATE OR REPLACE FUNCTION update_updated_at_column()`);
      statements.push(`RETURNS TRIGGER AS $$`);
      statements.push(`BEGIN`);
      statements.push(`  NEW."updatedAt" = NOW();`);
      statements.push(`  RETURN NEW;`);
      statements.push(`END;`);
      statements.push(`$$ language 'plpgsql';`);
      statements.push('');
      statements.push(`DROP TRIGGER IF EXISTS "update_${schema.name}_updated_at" ON "${schema.name}";`);
      statements.push(`CREATE TRIGGER "update_${schema.name}_updated_at" BEFORE UPDATE ON "${schema.name}"`);
      statements.push(`  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`);
      statements.push('');
    }

    return statements.join('\n');
  }

  /**
   * Generate Supabase-compatible SQL (includes RLS policies)
   *
   * @returns {string} SQL statements
   */
  generateSupabaseSQL() {
    const baseSQL = this.generatePostgresSQL();
    const schemas = this.exportSchemas();
    const rlsStatements = [];

    rlsStatements.push('');
    rlsStatements.push('-- Row Level Security Policies');
    rlsStatements.push('');

    for (const schema of schemas) {
      const tableName = schema.name;

      rlsStatements.push(`-- RLS for ${tableName}`);
      rlsStatements.push(`ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;`);
      rlsStatements.push('');

      // Default policy: allow authenticated users
      rlsStatements.push(`-- Allow authenticated users to read all records`);
      rlsStatements.push(
        `CREATE POLICY "Allow authenticated read" ON "${tableName}" FOR SELECT TO authenticated USING (true);`
      );
      rlsStatements.push('');

      rlsStatements.push(`-- Allow users to insert their own records`);
      rlsStatements.push(
        `CREATE POLICY "Allow insert" ON "${tableName}" FOR INSERT TO authenticated WITH CHECK (true);`
      );
      rlsStatements.push('');

      rlsStatements.push(`-- Allow users to update their own records (customize based on ACL)`);
      rlsStatements.push(
        `CREATE POLICY "Allow update" ON "${tableName}" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);`
      );
      rlsStatements.push('');

      rlsStatements.push(`-- Allow users to delete their own records (customize based on ACL)`);
      rlsStatements.push(`CREATE POLICY "Allow delete" ON "${tableName}" FOR DELETE TO authenticated USING (true);`);
      rlsStatements.push('');
    }

    return baseSQL + rlsStatements.join('\n');
  }

  /**
   * Generate JSON schema export
   *
   * @returns {Object} JSON schema definition
   */
  exportAsJSON() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tables: this.exportSchemas()
    };
  }

  /**
   * Import schema from JSON
   *
   * @param {Object} jsonSchema - Schema definition from exportAsJSON
   */
  importFromJSON(jsonSchema) {
    const tables = jsonSchema.tables || [];

    for (const tableSchema of tables) {
      this.createTable(tableSchema);
    }
  }

  /**
   * Check if a table needs migration (schema changed)
   *
   * @param {string} tableName - Table name
   * @param {Object} newSchema - New schema definition
   * @returns {Object} Migration info with added/removed columns
   */
  checkMigration(tableName, newSchema) {
    const currentSchema = this.getTableSchema(tableName);

    if (!currentSchema) {
      return { needsMigration: false, tableExists: false };
    }

    const currentCols = new Set((currentSchema.columns || []).map((c) => c.name));
    const newCols = new Set((newSchema.columns || []).map((c) => c.name));

    const added = [...newCols].filter((c) => !currentCols.has(c));
    const removed = [...currentCols].filter((c) => !newCols.has(c));

    return {
      needsMigration: added.length > 0 || removed.length > 0,
      tableExists: true,
      added,
      removed
    };
  }

  /**
   * Convert column definition to SQL
   *
   * @private
   * @param {Object} col - Column definition
   * @returns {string|null} SQL column definition
   */
  _columnToSQL(col) {
    const sqlType = TYPE_MAP[col.type];
    if (!sqlType) {
      return null; // Relations handled separately
    }

    let def = `${escapeColumn(col.name)} ${sqlType}`;
    if (col.required) {
      def += ' NOT NULL';
    }
    if (col.defaultValue !== undefined) {
      if (typeof col.defaultValue === 'string') {
        def += ` DEFAULT '${col.defaultValue}'`;
      } else if (typeof col.defaultValue === 'boolean') {
        def += ` DEFAULT ${col.defaultValue ? 1 : 0}`;
      } else {
        def += ` DEFAULT ${col.defaultValue}`;
      }
    }

    return def;
  }

  /**
   * Create a junction table for many-to-many relations
   *
   * @private
   * @param {string} owningClass - Source class name
   * @param {string} relationName - Relation field name
   * @param {string} targetClass - Target class name
   */
  _createJunctionTable(owningClass, relationName, targetClass) {
    const junctionTable = `_Join_${relationName}_${owningClass}`;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${escapeTable(junctionTable)} (
        "owningId" TEXT NOT NULL,
        "relatedId" TEXT NOT NULL,
        PRIMARY KEY ("owningId", "relatedId")
      )
    `);

    // Create indexes for efficient lookups
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS "idx_${junctionTable}_owning" ON ${escapeTable(junctionTable)}("owningId")`
    );
    this.db.exec(
      `CREATE INDEX IF NOT EXISTS "idx_${junctionTable}_related" ON ${escapeTable(junctionTable)}("relatedId")`
    );
  }

  /**
   * Add to a relation (junction table)
   *
   * @param {string} owningClass - Source class name
   * @param {string} owningId - Source record ID
   * @param {string} relationName - Relation field name
   * @param {string} targetId - Target record ID
   */
  addRelation(owningClass, owningId, relationName, targetId) {
    const junctionTable = `_Join_${relationName}_${owningClass}`;

    try {
      this.db
        .prepare(`INSERT OR IGNORE INTO ${escapeTable(junctionTable)} ("owningId", "relatedId") VALUES (?, ?)`)
        .run(owningId, targetId);
    } catch (e) {
      // Table might not exist
      if (e.message.includes('no such table')) {
        this._createJunctionTable(owningClass, relationName, 'Unknown');
        this.db
          .prepare(`INSERT OR IGNORE INTO ${escapeTable(junctionTable)} ("owningId", "relatedId") VALUES (?, ?)`)
          .run(owningId, targetId);
      } else {
        throw e;
      }
    }
  }

  /**
   * Remove from a relation (junction table)
   *
   * @param {string} owningClass - Source class name
   * @param {string} owningId - Source record ID
   * @param {string} relationName - Relation field name
   * @param {string} targetId - Target record ID
   */
  removeRelation(owningClass, owningId, relationName, targetId) {
    const junctionTable = `_Join_${relationName}_${owningClass}`;

    this.db
      .prepare(`DELETE FROM ${escapeTable(junctionTable)} WHERE "owningId" = ? AND "relatedId" = ?`)
      .run(owningId, targetId);
  }

  /**
   * Get related IDs from a relation
   *
   * @param {string} owningClass - Source class name
   * @param {string} owningId - Source record ID
   * @param {string} relationName - Relation field name
   * @returns {string[]} Related record IDs
   */
  getRelatedIds(owningClass, owningId, relationName) {
    const junctionTable = `_Join_${relationName}_${owningClass}`;

    try {
      const rows = this.db
        .prepare(`SELECT "relatedId" FROM ${escapeTable(junctionTable)} WHERE "owningId" = ?`)
        .all(owningId);
      return rows.map((r) => r.relatedId);
    } catch (e) {
      if (e.message.includes('no such table')) {
        return [];
      }
      throw e;
    }
  }
}

module.exports = SchemaManager;
