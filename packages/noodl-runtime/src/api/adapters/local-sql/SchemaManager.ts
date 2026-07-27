/**
 * SchemaManager - Handles SQLite schema creation, migration, and export
 *
 * Manages table creation based on Noodl collection schemas,
 * handles migrations when schema changes, and can export
 * schemas to other database formats (Postgres, Supabase, etc.)
 *
 * @module adapters/local-sql/SchemaManager
 */

import type { EngineDatabase } from './engine';
import { escapeTable, escapeColumn } from './QueryBuilder';

/** One column of a collection schema, as the editor's data model persists it. */
interface SchemaColumn {
  name: string;
  type: string;
  /** Relations only: the class on the other side of the junction table. */
  targetClass?: string;
  required?: boolean;
  defaultValue?: unknown;
}

/** A collection's schema as tracked in the `_Schema` table. */
interface TableSchema {
  name: string;
  columns?: SchemaColumn[];
  [extra: string]: unknown;
}

/**
 * Map Noodl/Parse types to SQLite types
 */
const TYPE_MAP: Record<string, string | null> = {
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
 */
const POSTGRES_TYPE_MAP: Record<string, string | null> = {
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
  db: EngineDatabase;
  _schemaCache: Map<string, TableSchema>;

  /**
   * @param db - SQLite database instance (better-sqlite3 shape; see engine.ts)
   */
  constructor(db: EngineDatabase) {
    this.db = db;
    this._schemaCache = new Map();
  }

  /**
   * Ensure the internal schema tracking table exists
   */
  ensureSchemaTable(): void {
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
   * @returns Whether table was created (false if already existed)
   */
  createTable(schema: TableSchema): boolean {
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
   */
  addColumn(tableName: string, column: SchemaColumn): void {
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
   * @returns Whether table was deleted
   */
  deleteTable(tableName: string): boolean {
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
      .all(`_Join_%_${tableName}`) as Array<{ name: string }>;

    for (const jt of junctionTables) {
      this.db.exec(`DROP TABLE IF EXISTS ${escapeTable(jt.name)}`);
    }

    return true;
  }

  /**
   * Rename a column in a table (SQLite 3.25.0+)
   *
   * @returns Whether column was renamed
   */
  renameColumn(tableName: string, oldName: string, newName: string): boolean {
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
   */
  getTableSchema(tableName: string): TableSchema | null {
    if (this._schemaCache.has(tableName)) {
      return this._schemaCache.get(tableName);
    }

    this.ensureSchemaTable();

    const row = this.db.prepare('SELECT "schema" FROM "_Schema" WHERE "name" = ?').get(tableName) as
      | { schema: string }
      | undefined;

    if (row) {
      const schema = JSON.parse(row.schema);
      this._schemaCache.set(tableName, schema);
      return schema;
    }

    return null;
  }

  /**
   * List all tables
   */
  listTables(): string[] {
    // NB: `_` is a LIKE wildcard matching any single character — unescaped,
    // `NOT LIKE '_%'` excludes EVERY table, not just underscore-prefixed ones.
    // Latent for as long as only the in-memory mock ran; surfaced by the real
    // engine (WF-004).
    const rows = this.db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite%' AND name NOT LIKE '\\_%' ESCAPE '\\'"
      )
      .all() as Array<{ name: string }>;

    return rows.map((r) => r.name);
  }

  /**
   * Export all schemas
   */
  exportSchemas(): TableSchema[] {
    this.ensureSchemaTable();

    // Same wildcard-escape fix as listTables() — `_%` unescaped matches everything.
    const rows = this.db
      .prepare('SELECT "name", "schema" FROM "_Schema" WHERE "name" NOT LIKE \'\\_%\' ESCAPE \'\\\'')
      .all() as Array<{ name: string; schema: string }>;

    return rows.map((r) => JSON.parse(r.schema));
  }

  /**
   * Generate PostgreSQL-compatible SQL for migration
   */
  generatePostgresSQL(): string {
    const schemas = this.exportSchemas();
    const statements: string[] = [];

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
   */
  generateSupabaseSQL(): string {
    const baseSQL = this.generatePostgresSQL();
    const schemas = this.exportSchemas();
    const rlsStatements: string[] = [];

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
   */
  exportAsJSON(): { version: string; exportedAt: string; tables: TableSchema[] } {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tables: this.exportSchemas()
    };
  }

  /**
   * Import schema from JSON
   *
   * @param jsonSchema - Schema definition from exportAsJSON
   */
  importFromJSON(jsonSchema: { tables?: TableSchema[] }): void {
    const tables = jsonSchema.tables || [];

    for (const tableSchema of tables) {
      this.createTable(tableSchema);
    }
  }

  /**
   * Check if a table needs migration (schema changed)
   *
   * @returns Migration info with added/removed columns
   */
  checkMigration(
    tableName: string,
    newSchema: TableSchema
  ): { needsMigration: boolean; tableExists: boolean; added?: string[]; removed?: string[] } {
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
   */
  _columnToSQL(col: SchemaColumn): string | null {
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
   */
  _createJunctionTable(owningClass: string, relationName: string, targetClass: string): void {
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
   */
  addRelation(owningClass: string, owningId: string, relationName: string, targetId: string): void {
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
   */
  removeRelation(owningClass: string, owningId: string, relationName: string, targetId: string): void {
    const junctionTable = `_Join_${relationName}_${owningClass}`;

    this.db
      .prepare(`DELETE FROM ${escapeTable(junctionTable)} WHERE "owningId" = ? AND "relatedId" = ?`)
      .run(owningId, targetId);
  }

  /**
   * Get related IDs from a relation
   */
  getRelatedIds(owningClass: string, owningId: string, relationName: string): string[] {
    const junctionTable = `_Join_${relationName}_${owningClass}`;

    try {
      const rows = this.db
        .prepare(`SELECT "relatedId" FROM ${escapeTable(junctionTable)} WHERE "owningId" = ?`)
        .all(owningId) as Array<{ relatedId: string }>;
      return rows.map((r) => r.relatedId);
    } catch (e) {
      if (e.message.includes('no such table')) {
        return [];
      }
      throw e;
    }
  }

  // ===========================================================================
  // Full-text search (BAK-008)
  //
  // An FTS5 shadow table per opted-in collection, in "external content" mode
  // against the real table so the indexed text is never duplicated on disk.
  // Sync is done by SQL triggers generated here — the database's job, not
  // application code's, so no write path (classes route, BYOB route, workflow
  // step, import) can forget it. See dev-docs/tasks/phase-22-production-backend/
  // BAK-008-NOTES.md for the design writeup.
  // ===========================================================================

  /**
   * Probe whether this SQLite build has the FTS5 extension compiled in.
   * Cheap (creates and drops a throwaway virtual table) and side-effect-free
   * on the caller's schema. Callers use this to fail loudly and explicitly
   * BEFORE attempting to enable search — never a silent LIKE fallback.
   */
  hasFts5Support(): boolean {
    try {
      this.db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS "__fts5_probe" USING fts5(x)');
      this.db.exec('DROP TABLE IF EXISTS "__fts5_probe"');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Whether a collection currently has a search (FTS5 shadow table) index.
   */
  hasSearchIndex(tableName: string): boolean {
    const ftsTable = `${tableName}_fts`;
    const exists = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(ftsTable);
    return !!exists;
  }

  /**
   * Create the FTS5 shadow table (external content, `content_rowid='rowid'`)
   * and its sync triggers for a collection. Does NOT backfill existing rows —
   * FTS5 external-content tables start empty regardless of what the content
   * table already holds; callers that need existing data indexed must follow
   * with the 'rebuild' command (see rebuildSearchIndex, the normal entry point).
   *
   * @param tableName
   * @param fields - real column names on tableName to index
   * @param tokenizer
   */
  createSearchIndex(tableName: string, fields: string[], tokenizer = 'unicode61'): void {
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error('createSearchIndex requires at least one field to index');
    }

    const ftsTable = `${tableName}_fts`;
    const cols = fields.map((f) => escapeColumn(f)).join(', ');
    // Tokenizer name is validated by the caller (nodegx-backend's search
    // config model); still sanitize defensively since it lands in raw SQL.
    const safeTokenizer = String(tokenizer || 'unicode61').replace(/[^a-zA-Z0-9_]/g, '');

    this.db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${escapeTable(ftsTable)} USING fts5(` +
        `${cols}, content=${escapeTable(tableName)}, content_rowid='rowid', tokenize='${safeTokenizer}')`
    );

    this._createSearchTriggers(tableName, fields);
  }

  /**
   * (Re)create the three sync triggers (AFTER INSERT/UPDATE/DELETE) that keep
   * the FTS5 shadow table in lockstep with the content table. Idempotent.
   *
   * @private
   */
  _createSearchTriggers(tableName: string, fields: string[]): void {
    const ftsTable = `${tableName}_fts`;
    const colList = fields.map((f) => escapeColumn(f)).join(', ');
    const newVals = fields.map((f) => `new.${escapeColumn(f)}`).join(', ');
    const oldVals = fields.map((f) => `old.${escapeColumn(f)}`).join(', ');
    const aiTrigger = `${tableName}_fts_ai`;
    const adTrigger = `${tableName}_fts_ad`;
    const auTrigger = `${tableName}_fts_au`;

    this.db.exec(`DROP TRIGGER IF EXISTS ${escapeTable(aiTrigger)}`);
    this.db.exec(`DROP TRIGGER IF EXISTS ${escapeTable(adTrigger)}`);
    this.db.exec(`DROP TRIGGER IF EXISTS ${escapeTable(auTrigger)}`);

    // INSERT: mirror the new row into the shadow table.
    this.db.exec(
      `CREATE TRIGGER ${escapeTable(aiTrigger)} AFTER INSERT ON ${escapeTable(tableName)} BEGIN ` +
        `INSERT INTO ${escapeTable(ftsTable)}(rowid, ${colList}) VALUES (new.rowid, ${newVals}); ` +
        `END`
    );

    // DELETE: the FTS5 'delete' special command — the first two values are
    // fixed ('delete', old rowid), the rest mirror the deleted column values
    // (FTS5 needs them to remove the exact posting-list entries).
    this.db.exec(
      `CREATE TRIGGER ${escapeTable(adTrigger)} AFTER DELETE ON ${escapeTable(tableName)} BEGIN ` +
        `INSERT INTO ${escapeTable(ftsTable)}(${escapeTable(ftsTable)}, rowid, ${colList}) ` +
        `VALUES('delete', old.rowid, ${oldVals}); ` +
        `END`
    );

    // UPDATE: delete-then-reinsert (the documented FTS5 external-content
    // update pattern) so a change to any indexed field is reflected exactly
    // once, regardless of which columns actually changed.
    this.db.exec(
      `CREATE TRIGGER ${escapeTable(auTrigger)} AFTER UPDATE ON ${escapeTable(tableName)} BEGIN ` +
        `INSERT INTO ${escapeTable(ftsTable)}(${escapeTable(ftsTable)}, rowid, ${colList}) ` +
        `VALUES('delete', old.rowid, ${oldVals}); ` +
        `INSERT INTO ${escapeTable(ftsTable)}(rowid, ${colList}) VALUES (new.rowid, ${newVals}); ` +
        `END`
    );
  }

  /**
   * Drop a collection's search index and its sync triggers. Safe to call when
   * no index exists.
   */
  dropSearchIndex(tableName: string): void {
    const ftsTable = `${tableName}_fts`;
    this.db.exec(`DROP TRIGGER IF EXISTS ${escapeTable(`${tableName}_fts_ai`)}`);
    this.db.exec(`DROP TRIGGER IF EXISTS ${escapeTable(`${tableName}_fts_ad`)}`);
    this.db.exec(`DROP TRIGGER IF EXISTS ${escapeTable(`${tableName}_fts_au`)}`);
    this.db.exec(`DROP TABLE IF EXISTS ${escapeTable(ftsTable)}`);
  }

  /**
   * The explicit, progress-reported, idempotent rebuild path (BAK-008 desired
   * state): drop-and-recreate the shadow table + triggers for the CURRENT
   * field list, then run FTS5's 'rebuild' command to repopulate it from the
   * live content table. Safe to call repeatedly (each call is a full,
   * consistent re-derivation, never a delta applied on top of drift) and is
   * how both "enable search" and "fields changed" are implemented — one path,
   * not two similar ones that could disagree.
   */
  rebuildSearchIndex(
    tableName: string,
    fields: string[],
    tokenizer = 'unicode61'
  ): { tableName: string; fields: string[]; tokenizer: string; rowsIndexed: number; elapsedMs: number } {
    if (!this.hasFts5Support()) {
      throw new Error(
        'Full-text search requires the SQLite FTS5 extension, which this engine build does not have. ' +
          'Refusing to enable search — no degraded/LIKE fallback is offered.'
      );
    }

    const start = Date.now();
    this.dropSearchIndex(tableName);
    this.createSearchIndex(tableName, fields, tokenizer);

    const ftsTable = `${tableName}_fts`;
    this.db.exec(`INSERT INTO ${escapeTable(ftsTable)}(${escapeTable(ftsTable)}) VALUES('rebuild')`);

    const countRow = this.db.prepare(`SELECT COUNT(*) as count FROM ${escapeTable(tableName)}`).get() as
      | { count: number }
      | undefined;

    return {
      tableName,
      fields: [...fields],
      tokenizer: String(tokenizer || 'unicode61').replace(/[^a-zA-Z0-9_]/g, ''),
      rowsIndexed: countRow ? countRow.count : 0,
      elapsedMs: Date.now() - start
    };
  }
}

export = SchemaManager;
