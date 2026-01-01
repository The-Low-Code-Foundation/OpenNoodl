# TASK-007A: LocalSQL Adapter

## Overview

Implement a SQLite-based CloudStore adapter that provides the same interface as the existing Parse adapter, enabling seamless switching between local and cloud backends.

**Parent Task:** TASK-007 (Integrated Local Backend)
**Phase:** A (Foundation)
**Effort:** 16-20 hours
**Priority:** CRITICAL (Blocks all other phases)

---

## Objectives

1. Create `CloudStoreAdapter` interface abstracting database operations
2. Implement `LocalSQLAdapter` using SQLite via `better-sqlite3`
3. Build query translator for Parse-style queries → SQL
4. Implement schema management with migration support
5. Refactor existing CloudStore to use adapter pattern
6. Maintain 100% backward compatibility with Parse adapter

---

## Background

### Current CloudStore Implementation

The existing `CloudStore` class in `packages/noodl-runtime/src/api/cloudstore.js` directly implements Parse Server API calls:

```javascript
// Current: Direct Parse API calls
CloudStore.prototype.query = function(options) {
  this._makeRequest('/classes/' + options.collection, {
    method: 'POST',
    content: {
      _method: 'GET',
      where: options.where,
      limit: options.limit,
      // ...
    }
  });
};
```

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CloudStore (Facade)                          │
│                    - Delegates to active adapter                │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ↓                       ↓                       ↓
┌───────────────┐    ┌───────────────────┐    ┌───────────────────┐
│ ParseAdapter  │    │ LocalSQLAdapter   │    │ Future Adapters   │
│ (Refactored)  │    │ (NEW)             │    │ (Supabase, etc)   │
└───────────────┘    └───────────────────┘    └───────────────────┘
```

---

## Implementation Steps

### Step 1: Define Adapter Interface (2 hours)

Create the abstract interface that all adapters must implement.

**File:** `packages/noodl-runtime/src/api/adapters/cloudstore-adapter.ts`

```typescript
import { EventEmitter } from 'events';

// Query Options
export interface QueryOptions {
  collection: string;
  where?: Record<string, any>;
  sort?: string[];
  limit?: number;
  skip?: number;
  include?: string[];
  select?: string[];
  count?: boolean;
}

export interface FetchOptions {
  collection: string;
  objectId: string;
  include?: string[];
}

export interface CreateOptions {
  collection: string;
  data: Record<string, any>;
  acl?: any;
}

export interface SaveOptions {
  collection: string;
  objectId: string;
  data: Record<string, any>;
  acl?: any;
}

export interface DeleteOptions {
  collection: string;
  objectId: string;
}

export interface RelationOptions {
  collection: string;
  objectId: string;
  key: string;
  targetObjectId: string;
  targetClass: string;
}

export interface AggregateOptions {
  collection: string;
  where?: Record<string, any>;
  group: Record<string, any>;
}

// Schema Types
export interface ColumnDefinition {
  name: string;
  type: 'String' | 'Number' | 'Boolean' | 'Date' | 'Object' | 'Array' | 'Pointer' | 'Relation' | 'File' | 'GeoPoint';
  required?: boolean;
  defaultValue?: any;
  targetClass?: string; // For Pointer/Relation
}

export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
}

export interface SchemaDefinition {
  version: number;
  tables: TableSchema[];
}

// Event Types
export interface AdapterEvent {
  type: 'create' | 'save' | 'delete';
  collection: string;
  objectId: string;
  object?: Record<string, any>;
}

// Main Adapter Interface
export interface CloudStoreAdapter {
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Query Operations
  query(options: QueryOptions): Promise<{ results: any[]; count?: number }>;
  fetch(options: FetchOptions): Promise<any>;
  count(options: Omit<QueryOptions, 'limit' | 'skip'>): Promise<number>;
  aggregate(options: AggregateOptions): Promise<any>;

  // Mutation Operations
  create(options: CreateOptions): Promise<any>;
  save(options: SaveOptions): Promise<any>;
  delete(options: DeleteOptions): Promise<void>;
  increment(options: { collection: string; objectId: string; properties: Record<string, number> }): Promise<any>;

  // Relation Operations
  addRelation(options: RelationOptions): Promise<void>;
  removeRelation(options: RelationOptions): Promise<void>;

  // Schema Operations
  getSchema(): Promise<SchemaDefinition>;
  createTable(schema: TableSchema): Promise<void>;
  addColumn(table: string, column: ColumnDefinition): Promise<void>;
  
  // Export Operations
  exportToSQL(dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<string>;
  exportData(format: 'json' | 'sql'): Promise<string>;

  // Event Subscription
  on(event: 'create' | 'save' | 'delete', handler: (e: AdapterEvent) => void): void;
  off(event: 'create' | 'save' | 'delete', handler: (e: AdapterEvent) => void): void;
}
```

**File:** `packages/noodl-runtime/src/api/adapters/index.ts`

```typescript
export * from './cloudstore-adapter';
export { LocalSQLAdapter } from './local-sql/LocalSQLAdapter';
export { ParseAdapter } from './parse/ParseAdapter';
```

---

### Step 2: Implement SQLite Connection (2 hours)

**File:** `packages/noodl-runtime/src/api/adapters/local-sql/SQLiteConnection.ts`

```typescript
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export class SQLiteConnection {
  private db: DatabaseType | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  connect(): void {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    
    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');
    
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    
    // Create system tables
    this.createSystemTables();
  }

  disconnect(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  getDatabase(): DatabaseType {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }

  private createSystemTables(): void {
    // Schema metadata table
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS _schema (
        table_name TEXT PRIMARY KEY,
        schema_json TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Relations junction table template
    // Actual junction tables created per-relation
  }

  // Transaction helpers
  transaction<T>(fn: () => T): T {
    return this.db!.transaction(fn)();
  }

  // Prepared statement cache
  private statementCache = new Map<string, Database.Statement>();

  prepare(sql: string): Database.Statement {
    let stmt = this.statementCache.get(sql);
    if (!stmt) {
      stmt = this.db!.prepare(sql);
      this.statementCache.set(sql, stmt);
    }
    return stmt;
  }

  run(sql: string, ...params: any[]): Database.RunResult {
    return this.prepare(sql).run(...params);
  }

  get<T = any>(sql: string, ...params: any[]): T | undefined {
    return this.prepare(sql).get(...params) as T | undefined;
  }

  all<T = any>(sql: string, ...params: any[]): T[] {
    return this.prepare(sql).all(...params) as T[];
  }

  exec(sql: string): void {
    this.db!.exec(sql);
  }
}
```

---

### Step 3: Implement Query Builder (4 hours)

**File:** `packages/noodl-runtime/src/api/adapters/local-sql/QueryBuilder.ts`

```typescript
export interface BuildResult {
  sql: string;
  params: any[];
}

export class QueryBuilder {
  /**
   * Build SELECT query from Parse-style options
   */
  static buildSelect(options: {
    collection: string;
    where?: Record<string, any>;
    sort?: string[];
    limit?: number;
    skip?: number;
    select?: string[];
  }): BuildResult {
    const params: any[] = [];
    const table = this.escapeIdentifier(options.collection);
    
    // SELECT clause
    const columns = options.select?.length 
      ? options.select.map(c => this.escapeIdentifier(c)).join(', ')
      : '*';
    
    let sql = `SELECT ${columns} FROM ${table}`;

    // WHERE clause
    if (options.where && Object.keys(options.where).length > 0) {
      const whereClause = this.buildWhereClause(options.where, params);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }

    // ORDER BY clause
    if (options.sort?.length) {
      const orderParts = options.sort.map(s => {
        if (s.startsWith('-')) {
          return `${this.escapeIdentifier(s.slice(1))} DESC`;
        }
        return `${this.escapeIdentifier(s)} ASC`;
      });
      sql += ` ORDER BY ${orderParts.join(', ')}`;
    }

    // LIMIT clause
    if (options.limit !== undefined) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    // OFFSET clause
    if (options.skip !== undefined && options.skip > 0) {
      sql += ` OFFSET ?`;
      params.push(options.skip);
    }

    return { sql, params };
  }

  /**
   * Build COUNT query
   */
  static buildCount(options: {
    collection: string;
    where?: Record<string, any>;
  }): BuildResult {
    const params: any[] = [];
    const table = this.escapeIdentifier(options.collection);
    
    let sql = `SELECT COUNT(*) as count FROM ${table}`;

    if (options.where && Object.keys(options.where).length > 0) {
      const whereClause = this.buildWhereClause(options.where, params);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }

    return { sql, params };
  }

  /**
   * Build INSERT query
   */
  static buildInsert(options: {
    collection: string;
    data: Record<string, any>;
    objectId: string;
  }): BuildResult {
    const table = this.escapeIdentifier(options.collection);
    const now = new Date().toISOString();
    
    const data = {
      objectId: options.objectId,
      createdAt: now,
      updatedAt: now,
      ...options.data
    };

    const columns = Object.keys(data).map(c => this.escapeIdentifier(c));
    const placeholders = columns.map(() => '?');
    const values = Object.values(data).map(v => this.serializeValue(v));

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
    
    return { sql, params: values };
  }

  /**
   * Build UPDATE query
   */
  static buildUpdate(options: {
    collection: string;
    objectId: string;
    data: Record<string, any>;
  }): BuildResult {
    const table = this.escapeIdentifier(options.collection);
    const params: any[] = [];
    
    const data = {
      ...options.data,
      updatedAt: new Date().toISOString()
    };

    const setParts = Object.entries(data).map(([key, value]) => {
      params.push(this.serializeValue(value));
      return `${this.escapeIdentifier(key)} = ?`;
    });

    params.push(options.objectId);
    
    const sql = `UPDATE ${table} SET ${setParts.join(', ')} WHERE objectId = ?`;
    
    return { sql, params };
  }

  /**
   * Build DELETE query
   */
  static buildDelete(options: {
    collection: string;
    objectId: string;
  }): BuildResult {
    const table = this.escapeIdentifier(options.collection);
    return {
      sql: `DELETE FROM ${table} WHERE objectId = ?`,
      params: [options.objectId]
    };
  }

  /**
   * Build WHERE clause from Parse-style filter
   */
  private static buildWhereClause(
    where: Record<string, any>,
    params: any[]
  ): string {
    const conditions: string[] = [];

    // Handle logical operators at top level
    if (where.and) {
      const andConditions = (where.and as any[]).map(w => 
        this.buildWhereClause(w, params)
      ).filter(Boolean);
      if (andConditions.length) {
        conditions.push(`(${andConditions.join(' AND ')})`);
      }
    }

    if (where.or) {
      const orConditions = (where.or as any[]).map(w => 
        this.buildWhereClause(w, params)
      ).filter(Boolean);
      if (orConditions.length) {
        conditions.push(`(${orConditions.join(' OR ')})`);
      }
    }

    // Handle field conditions
    for (const [field, condition] of Object.entries(where)) {
      if (field === 'and' || field === 'or') continue;

      if (condition === null || condition === undefined) {
        conditions.push(`${this.escapeIdentifier(field)} IS NULL`);
      } else if (typeof condition !== 'object') {
        // Direct equality
        conditions.push(`${this.escapeIdentifier(field)} = ?`);
        params.push(this.serializeValue(condition));
      } else {
        // Operator-based condition
        const fieldConditions = this.buildFieldCondition(field, condition, params);
        if (fieldConditions) {
          conditions.push(fieldConditions);
        }
      }
    }

    return conditions.join(' AND ');
  }

  /**
   * Build condition for a single field with operators
   */
  private static buildFieldCondition(
    field: string,
    condition: Record<string, any>,
    params: any[]
  ): string {
    const col = this.escapeIdentifier(field);
    const parts: string[] = [];

    for (const [op, value] of Object.entries(condition)) {
      switch (op) {
        case 'equalTo':
          parts.push(`${col} = ?`);
          params.push(this.serializeValue(value));
          break;

        case 'notEqualTo':
          parts.push(`${col} != ?`);
          params.push(this.serializeValue(value));
          break;

        case 'greaterThan':
          parts.push(`${col} > ?`);
          params.push(this.serializeValue(value));
          break;

        case 'greaterThanOrEqualTo':
          parts.push(`${col} >= ?`);
          params.push(this.serializeValue(value));
          break;

        case 'lessThan':
          parts.push(`${col} < ?`);
          params.push(this.serializeValue(value));
          break;

        case 'lessThanOrEqualTo':
          parts.push(`${col} <= ?`);
          params.push(this.serializeValue(value));
          break;

        case 'containedIn':
          if (Array.isArray(value) && value.length > 0) {
            const placeholders = value.map(() => '?').join(', ');
            parts.push(`${col} IN (${placeholders})`);
            params.push(...value.map(v => this.serializeValue(v)));
          }
          break;

        case 'notContainedIn':
          if (Array.isArray(value) && value.length > 0) {
            const placeholders = value.map(() => '?').join(', ');
            parts.push(`${col} NOT IN (${placeholders})`);
            params.push(...value.map(v => this.serializeValue(v)));
          }
          break;

        case 'exists':
          parts.push(value ? `${col} IS NOT NULL` : `${col} IS NULL`);
          break;

        case 'contains':
          parts.push(`${col} LIKE ?`);
          params.push(`%${value}%`);
          break;

        case 'startsWith':
          parts.push(`${col} LIKE ?`);
          params.push(`${value}%`);
          break;

        case 'endsWith':
          parts.push(`${col} LIKE ?`);
          params.push(`%${value}`);
          break;

        case 'regex':
          // SQLite uses GLOB for pattern matching
          parts.push(`${col} GLOB ?`);
          params.push(value);
          break;

        case 'matchesQuery':
          // Subquery - would need to be expanded
          console.warn('matchesQuery not fully implemented for SQLite');
          break;

        case 'pointsTo':
          // Pointer reference
          parts.push(`${col} = ?`);
          params.push(value);
          break;

        default:
          console.warn(`Unknown query operator: ${op}`);
      }
    }

    return parts.join(' AND ');
  }

  /**
   * Escape identifier (table/column name)
   */
  static escapeIdentifier(name: string): string {
    // SQLite uses double quotes for identifiers
    return `"${name.replace(/"/g, '""')}"`;
  }

  /**
   * Serialize value for storage
   */
  static serializeValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }

  /**
   * Deserialize value from storage
   */
  static deserializeValue(value: any, type?: string): any {
    if (value === null || value === undefined) {
      return value;
    }
    
    switch (type) {
      case 'Boolean':
        return value === 1 || value === true;
      case 'Date':
        return new Date(value);
      case 'Object':
      case 'Array':
        return typeof value === 'string' ? JSON.parse(value) : value;
      default:
        return value;
    }
  }
}
```

---

### Step 4: Implement Schema Manager (3 hours)

**File:** `packages/noodl-runtime/src/api/adapters/local-sql/SchemaManager.ts`

```typescript
import { SQLiteConnection } from './SQLiteConnection';
import { QueryBuilder } from './QueryBuilder';
import type { TableSchema, ColumnDefinition, SchemaDefinition } from '../cloudstore-adapter';

export class SchemaManager {
  constructor(private connection: SQLiteConnection) {}

  /**
   * Create a new table from schema definition
   */
  createTable(schema: TableSchema): void {
    const db = this.connection.getDatabase();
    const tableName = QueryBuilder.escapeIdentifier(schema.name);

    // Build column definitions
    const columns = [
      '"objectId" TEXT PRIMARY KEY',
      '"createdAt" TEXT DEFAULT CURRENT_TIMESTAMP',
      '"updatedAt" TEXT DEFAULT CURRENT_TIMESTAMP',
      ...schema.columns
        .filter(col => col.type !== 'Relation')
        .map(col => this.columnToSQL(col))
    ];

    // Create main table
    const createSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns.join(', ')})`;
    db.exec(createSQL);

    // Create indexes
    db.exec(`CREATE INDEX IF NOT EXISTS "idx_${schema.name}_createdAt" ON ${tableName}("createdAt")`);
    db.exec(`CREATE INDEX IF NOT EXISTS "idx_${schema.name}_updatedAt" ON ${tableName}("updatedAt")`);

    // Create relation junction tables
    for (const col of schema.columns.filter(c => c.type === 'Relation')) {
      this.createRelationTable(schema.name, col);
    }

    // Store schema metadata
    this.saveSchemaMetadata(schema);
  }

  /**
   * Add a column to existing table
   */
  addColumn(tableName: string, column: ColumnDefinition): void {
    if (column.type === 'Relation') {
      this.createRelationTable(tableName, column);
    } else {
      const colSQL = this.columnToSQL(column);
      const table = QueryBuilder.escapeIdentifier(tableName);
      this.connection.exec(`ALTER TABLE ${table} ADD COLUMN ${colSQL}`);
    }

    // Update schema metadata
    const schema = this.getTableSchema(tableName);
    if (schema) {
      schema.columns.push(column);
      this.saveSchemaMetadata(schema);
    }
  }

  /**
   * Get schema for a single table
   */
  getTableSchema(tableName: string): TableSchema | null {
    const row = this.connection.get<{ schema_json: string }>(
      'SELECT schema_json FROM _schema WHERE table_name = ?',
      tableName
    );

    if (!row) return null;
    return JSON.parse(row.schema_json);
  }

  /**
   * Get full schema definition
   */
  getSchema(): SchemaDefinition {
    const rows = this.connection.all<{ table_name: string; schema_json: string }>(
      'SELECT table_name, schema_json FROM _schema ORDER BY table_name'
    );

    return {
      version: 1,
      tables: rows.map(r => JSON.parse(r.schema_json))
    };
  }

  /**
   * Export schema to PostgreSQL format
   */
  exportToPostgres(): string {
    const schema = this.getSchema();
    const statements: string[] = [];

    for (const table of schema.tables) {
      const columns = [
        '"objectId" TEXT PRIMARY KEY',
        '"createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
        '"updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
        ...table.columns
          .filter(col => col.type !== 'Relation')
          .map(col => this.columnToPostgres(col))
      ];

      statements.push(
        `CREATE TABLE "${table.name}" (\n  ${columns.join(',\n  ')}\n);`
      );

      // Indexes
      statements.push(
        `CREATE INDEX "idx_${table.name}_createdAt" ON "${table.name}"("createdAt");`
      );
      statements.push(
        `CREATE INDEX "idx_${table.name}_updatedAt" ON "${table.name}"("updatedAt");`
      );

      // Relation tables
      for (const col of table.columns.filter(c => c.type === 'Relation')) {
        const junctionTable = `_Join_${col.name}_${table.name}`;
        statements.push(`
CREATE TABLE "${junctionTable}" (
  "owningId" TEXT NOT NULL,
  "relatedId" TEXT NOT NULL,
  PRIMARY KEY ("owningId", "relatedId")
);`);
      }
    }

    return statements.join('\n\n');
  }

  /**
   * Export schema to Supabase format (Postgres + RLS policies)
   */
  exportToSupabase(): string {
    let sql = this.exportToPostgres();

    // Add RLS policies
    const schema = this.getSchema();
    for (const table of schema.tables) {
      sql += `\n\n-- RLS for ${table.name}\n`;
      sql += `ALTER TABLE "${table.name}" ENABLE ROW LEVEL SECURITY;\n`;
      sql += `CREATE POLICY "Enable read access for all users" ON "${table.name}" FOR SELECT USING (true);\n`;
      sql += `CREATE POLICY "Enable insert for authenticated users only" ON "${table.name}" FOR INSERT WITH CHECK (auth.role() = 'authenticated');\n`;
      sql += `CREATE POLICY "Enable update for users based on objectId" ON "${table.name}" FOR UPDATE USING (auth.uid()::text = "objectId");\n`;
    }

    return sql;
  }

  /**
   * Check if table exists
   */
  tableExists(tableName: string): boolean {
    const result = this.connection.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?",
      tableName
    );
    return (result?.count ?? 0) > 0;
  }

  /**
   * Ensure table exists, creating if needed with inferred schema
   */
  ensureTable(tableName: string, sampleData?: Record<string, any>): void {
    if (this.tableExists(tableName)) return;

    const columns: ColumnDefinition[] = [];
    
    if (sampleData) {
      for (const [key, value] of Object.entries(sampleData)) {
        if (['objectId', 'createdAt', 'updatedAt'].includes(key)) continue;
        columns.push({
          name: key,
          type: this.inferType(value)
        });
      }
    }

    this.createTable({ name: tableName, columns });
  }

  // Private helpers

  private columnToSQL(col: ColumnDefinition): string {
    const name = QueryBuilder.escapeIdentifier(col.name);
    let sqlType: string;

    switch (col.type) {
      case 'String':
        sqlType = 'TEXT';
        break;
      case 'Number':
        sqlType = 'REAL';
        break;
      case 'Boolean':
        sqlType = 'INTEGER';
        break;
      case 'Date':
        sqlType = 'TEXT';
        break;
      case 'Object':
      case 'Array':
        sqlType = 'TEXT'; // JSON
        break;
      case 'Pointer':
        sqlType = 'TEXT'; // objectId reference
        break;
      case 'File':
        sqlType = 'TEXT'; // URL or base64
        break;
      case 'GeoPoint':
        sqlType = 'TEXT'; // JSON {lat, lng}
        break;
      default:
        sqlType = 'TEXT';
    }

    let def = `${name} ${sqlType}`;
    if (col.required) def += ' NOT NULL';
    if (col.defaultValue !== undefined) {
      def += ` DEFAULT ${this.defaultValueToSQL(col.defaultValue)}`;
    }

    return def;
  }

  private columnToPostgres(col: ColumnDefinition): string {
    const name = `"${col.name}"`;
    let sqlType: string;

    switch (col.type) {
      case 'String':
        sqlType = 'TEXT';
        break;
      case 'Number':
        sqlType = 'DOUBLE PRECISION';
        break;
      case 'Boolean':
        sqlType = 'BOOLEAN';
        break;
      case 'Date':
        sqlType = 'TIMESTAMP WITH TIME ZONE';
        break;
      case 'Object':
        sqlType = 'JSONB';
        break;
      case 'Array':
        sqlType = 'JSONB';
        break;
      case 'Pointer':
        sqlType = 'TEXT';
        break;
      case 'File':
        sqlType = 'TEXT';
        break;
      case 'GeoPoint':
        sqlType = 'JSONB';
        break;
      default:
        sqlType = 'TEXT';
    }

    let def = `${name} ${sqlType}`;
    if (col.required) def += ' NOT NULL';

    return def;
  }

  private defaultValueToSQL(value: any): string {
    if (value === null) return 'NULL';
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return String(value);
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }

  private createRelationTable(tableName: string, col: ColumnDefinition): void {
    const junctionTable = `_Join_${col.name}_${tableName}`;
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS "${junctionTable}" (
        "owningId" TEXT NOT NULL,
        "relatedId" TEXT NOT NULL,
        PRIMARY KEY ("owningId", "relatedId")
      )
    `);
    
    this.connection.exec(
      `CREATE INDEX IF NOT EXISTS "idx_${junctionTable}_owning" ON "${junctionTable}"("owningId")`
    );
    this.connection.exec(
      `CREATE INDEX IF NOT EXISTS "idx_${junctionTable}_related" ON "${junctionTable}"("relatedId")`
    );
  }

  private saveSchemaMetadata(schema: TableSchema): void {
    const json = JSON.stringify(schema);
    this.connection.run(
      `INSERT OR REPLACE INTO _schema (table_name, schema_json, updated_at) VALUES (?, ?, ?)`,
      schema.name,
      json,
      new Date().toISOString()
    );
  }

  private inferType(value: any): ColumnDefinition['type'] {
    if (value === null || value === undefined) return 'String';
    if (typeof value === 'string') return 'String';
    if (typeof value === 'number') return 'Number';
    if (typeof value === 'boolean') return 'Boolean';
    if (value instanceof Date) return 'Date';
    if (Array.isArray(value)) return 'Array';
    if (typeof value === 'object') return 'Object';
    return 'String';
  }
}
```

---

### Step 5: Implement LocalSQL Adapter (5 hours)

**File:** `packages/noodl-runtime/src/api/adapters/local-sql/LocalSQLAdapter.ts`

```typescript
import { EventEmitter } from 'events';
import { SQLiteConnection } from './SQLiteConnection';
import { SchemaManager } from './SchemaManager';
import { QueryBuilder } from './QueryBuilder';
import type {
  CloudStoreAdapter,
  QueryOptions,
  FetchOptions,
  CreateOptions,
  SaveOptions,
  DeleteOptions,
  RelationOptions,
  AggregateOptions,
  TableSchema,
  ColumnDefinition,
  SchemaDefinition,
  AdapterEvent
} from '../cloudstore-adapter';

export class LocalSQLAdapter implements CloudStoreAdapter {
  private connection: SQLiteConnection;
  private schemaManager: SchemaManager;
  private events = new EventEmitter();
  private connected = false;

  constructor(dbPath: string) {
    this.connection = new SQLiteConnection(dbPath);
    this.schemaManager = new SchemaManager(this.connection);
  }

  // Lifecycle

  async connect(): Promise<void> {
    this.connection.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connection.disconnect();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Query Operations

  async query(options: QueryOptions): Promise<{ results: any[]; count?: number }> {
    // Ensure table exists
    this.schemaManager.ensureTable(options.collection);

    const { sql, params } = QueryBuilder.buildSelect(options);
    const rows = this.connection.all(sql, ...params);
    
    const results = rows.map(row => this.deserializeRow(row, options.collection));

    let count: number | undefined;
    if (options.count) {
      const countResult = QueryBuilder.buildCount(options);
      const countRow = this.connection.get<{ count: number }>(countResult.sql, ...countResult.params);
      count = countRow?.count;
    }

    return { results, count };
  }

  async fetch(options: FetchOptions): Promise<any> {
    const table = QueryBuilder.escapeIdentifier(options.collection);
    const row = this.connection.get(
      `SELECT * FROM ${table} WHERE "objectId" = ?`,
      options.objectId
    );

    if (!row) {
      throw new Error(`Object not found: ${options.objectId}`);
    }

    return this.deserializeRow(row, options.collection);
  }

  async count(options: Omit<QueryOptions, 'limit' | 'skip'>): Promise<number> {
    this.schemaManager.ensureTable(options.collection);
    const { sql, params } = QueryBuilder.buildCount(options);
    const row = this.connection.get<{ count: number }>(sql, ...params);
    return row?.count ?? 0;
  }

  async aggregate(options: AggregateOptions): Promise<any> {
    // Build aggregation query
    this.schemaManager.ensureTable(options.collection);
    
    const table = QueryBuilder.escapeIdentifier(options.collection);
    const aggParts: string[] = [];
    
    for (const [name, config] of Object.entries(options.group)) {
      const op = (config as any).operation || 'count';
      const prop = (config as any).property;
      
      switch (op) {
        case 'count':
          aggParts.push(`COUNT(*) as "${name}"`);
          break;
        case 'sum':
          aggParts.push(`SUM("${prop}") as "${name}"`);
          break;
        case 'avg':
          aggParts.push(`AVG("${prop}") as "${name}"`);
          break;
        case 'min':
          aggParts.push(`MIN("${prop}") as "${name}"`);
          break;
        case 'max':
          aggParts.push(`MAX("${prop}") as "${name}"`);
          break;
        case 'distinct':
          aggParts.push(`COUNT(DISTINCT "${prop}") as "${name}"`);
          break;
      }
    }

    let sql = `SELECT ${aggParts.join(', ')} FROM ${table}`;
    const params: any[] = [];

    if (options.where) {
      const whereClause = this.buildWhereClause(options.where, params);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }

    return this.connection.get(sql, ...params);
  }

  // Mutation Operations

  async create(options: CreateOptions): Promise<any> {
    // Ensure table exists with inferred schema
    this.schemaManager.ensureTable(options.collection, options.data);

    const objectId = this.generateObjectId();
    const { sql, params } = QueryBuilder.buildInsert({
      collection: options.collection,
      data: options.data,
      objectId
    });

    this.connection.run(sql, ...params);

    const created = await this.fetch({
      collection: options.collection,
      objectId
    });

    // Emit event
    this.events.emit('create', {
      type: 'create',
      collection: options.collection,
      objectId,
      object: created
    } as AdapterEvent);

    return created;
  }

  async save(options: SaveOptions): Promise<any> {
    const { sql, params } = QueryBuilder.buildUpdate(options);
    const result = this.connection.run(sql, ...params);

    if (result.changes === 0) {
      throw new Error(`Object not found: ${options.objectId}`);
    }

    const updated = await this.fetch({
      collection: options.collection,
      objectId: options.objectId
    });

    // Emit event
    this.events.emit('save', {
      type: 'save',
      collection: options.collection,
      objectId: options.objectId,
      object: updated
    } as AdapterEvent);

    return updated;
  }

  async delete(options: DeleteOptions): Promise<void> {
    const { sql, params } = QueryBuilder.buildDelete(options);
    const result = this.connection.run(sql, ...params);

    if (result.changes === 0) {
      throw new Error(`Object not found: ${options.objectId}`);
    }

    // Emit event
    this.events.emit('delete', {
      type: 'delete',
      collection: options.collection,
      objectId: options.objectId
    } as AdapterEvent);
  }

  async increment(options: {
    collection: string;
    objectId: string;
    properties: Record<string, number>;
  }): Promise<any> {
    const table = QueryBuilder.escapeIdentifier(options.collection);
    const setParts: string[] = [];
    const params: any[] = [];

    for (const [key, amount] of Object.entries(options.properties)) {
      const col = QueryBuilder.escapeIdentifier(key);
      setParts.push(`${col} = COALESCE(${col}, 0) + ?`);
      params.push(amount);
    }

    setParts.push(`"updatedAt" = ?`);
    params.push(new Date().toISOString());
    params.push(options.objectId);

    this.connection.run(
      `UPDATE ${table} SET ${setParts.join(', ')} WHERE "objectId" = ?`,
      ...params
    );

    return this.fetch({
      collection: options.collection,
      objectId: options.objectId
    });
  }

  // Relation Operations

  async addRelation(options: RelationOptions): Promise<void> {
    const junctionTable = `_Join_${options.key}_${options.collection}`;
    
    this.connection.run(
      `INSERT OR IGNORE INTO "${junctionTable}" ("owningId", "relatedId") VALUES (?, ?)`,
      options.objectId,
      options.targetObjectId
    );
  }

  async removeRelation(options: RelationOptions): Promise<void> {
    const junctionTable = `_Join_${options.key}_${options.collection}`;
    
    this.connection.run(
      `DELETE FROM "${junctionTable}" WHERE "owningId" = ? AND "relatedId" = ?`,
      options.objectId,
      options.targetObjectId
    );
  }

  // Schema Operations

  async getSchema(): Promise<SchemaDefinition> {
    return this.schemaManager.getSchema();
  }

  async createTable(schema: TableSchema): Promise<void> {
    this.schemaManager.createTable(schema);
  }

  async addColumn(table: string, column: ColumnDefinition): Promise<void> {
    this.schemaManager.addColumn(table, column);
  }

  async exportToSQL(dialect: 'postgres' | 'mysql' | 'sqlite'): Promise<string> {
    switch (dialect) {
      case 'postgres':
        return this.schemaManager.exportToPostgres();
      case 'sqlite':
        return this.schemaManager.exportToPostgres(); // Similar enough
      default:
        throw new Error(`Unsupported dialect: ${dialect}`);
    }
  }

  async exportData(format: 'json' | 'sql'): Promise<string> {
    const schema = await this.getSchema();
    
    if (format === 'json') {
      const data: Record<string, any[]> = {};
      for (const table of schema.tables) {
        const { results } = await this.query({ collection: table.name, limit: 100000 });
        data[table.name] = results;
      }
      return JSON.stringify(data, null, 2);
    }

    // SQL format
    const statements: string[] = [];
    for (const table of schema.tables) {
      const { results } = await this.query({ collection: table.name, limit: 100000 });
      for (const row of results) {
        const columns = Object.keys(row).map(c => `"${c}"`).join(', ');
        const values = Object.values(row).map(v => {
          if (v === null) return 'NULL';
          if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
          return String(v);
        }).join(', ');
        statements.push(`INSERT INTO "${table.name}" (${columns}) VALUES (${values});`);
      }
    }
    return statements.join('\n');
  }

  // Event Subscription

  on(event: 'create' | 'save' | 'delete', handler: (e: AdapterEvent) => void): void {
    this.events.on(event, handler);
  }

  off(event: 'create' | 'save' | 'delete', handler: (e: AdapterEvent) => void): void {
    this.events.off(event, handler);
  }

  // Private helpers

  private generateObjectId(): string {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const random = Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    return timestamp + random;
  }

  private deserializeRow(row: any, collection: string): any {
    const schema = this.schemaManager.getTableSchema(collection);
    const result: any = {};

    for (const [key, value] of Object.entries(row)) {
      const colDef = schema?.columns.find(c => c.name === key);
      result[key] = QueryBuilder.deserializeValue(value, colDef?.type);
    }

    return result;
  }

  private buildWhereClause(where: Record<string, any>, params: any[]): string {
    // Reuse QueryBuilder logic
    const result = QueryBuilder.buildSelect({ collection: '_dummy', where });
    params.push(...result.params);
    const match = result.sql.match(/WHERE (.+)$/);
    return match ? match[1] : '';
  }
}
```

---

### Step 6: Refactor CloudStore to Use Adapters (4 hours)

**File:** `packages/noodl-runtime/src/api/adapters/parse/ParseAdapter.ts`

Wrap existing CloudStore methods into adapter interface (keep existing implementation, just restructure).

**File:** `packages/noodl-runtime/src/api/cloudstore.js` (modifications)

```javascript
// Add at top of file
const { AdapterRegistry } = require('./adapters');

// Modify CloudStore to delegate to adapter when available
CloudStore.prototype._getAdapter = function() {
  return this._adapter || AdapterRegistry.getInstance().getAdapter('default');
};

CloudStore.prototype.setAdapter = function(adapter) {
  this._adapter = adapter;
};

// Modify each method to check for adapter first
CloudStore.prototype.query = function(options) {
  const adapter = this._getAdapter();
  if (adapter) {
    return adapter.query(options)
      .then(result => {
        options.success(result.results, result.count);
      })
      .catch(err => {
        options.error(err.message);
      });
  }
  
  // Existing Parse implementation...
};

// Similar modifications for: fetch, create, save, delete, etc.
```

---

## Files to Create

```
packages/noodl-runtime/src/api/adapters/
├── index.ts
├── cloudstore-adapter.ts
├── local-sql/
│   ├── LocalSQLAdapter.ts
│   ├── SQLiteConnection.ts
│   ├── QueryBuilder.ts
│   ├── SchemaManager.ts
│   └── types.ts
└── parse/
    └── ParseAdapter.ts
```

## Files to Modify

```
packages/noodl-runtime/src/api/cloudstore.js
  - Add adapter delegation pattern
  - Keep backward compatibility

packages/noodl-runtime/package.json
  - Add better-sqlite3 dependency
```

---

## Testing Checklist

### Query Operations
- [ ] Simple equality query
- [ ] Comparison operators (gt, lt, gte, lte)
- [ ] String operators (contains, startsWith, endsWith)
- [ ] Array operators (containedIn, notContainedIn)
- [ ] Logical operators (and, or)
- [ ] Sorting (ascending, descending)
- [ ] Pagination (limit, skip)
- [ ] Count queries

### Mutation Operations
- [ ] Create with all data types
- [ ] Update existing record
- [ ] Delete record
- [ ] Increment numeric fields

### Schema Operations
- [ ] Create table from schema
- [ ] Add column to existing table
- [ ] Export to PostgreSQL
- [ ] Export to Supabase format

### Event Emission
- [ ] Create event fires
- [ ] Save event fires
- [ ] Delete event fires
- [ ] Multiple listeners work

### Edge Cases
- [ ] Empty table query
- [ ] Non-existent record fetch
- [ ] Concurrent writes
- [ ] Large dataset (100K records)
- [ ] Unicode/special characters

---

## Success Criteria

1. All Parse-style queries translate correctly to SQL
2. CRUD operations work identically to Parse adapter
3. Schema export produces valid PostgreSQL
4. Events emit for all mutations
5. No regressions in existing Parse functionality
6. Performance: <100ms for queries on 100K records

---

## Dependencies

**NPM packages to add:**
- `better-sqlite3` - SQLite bindings for Node.js

**Blocked by:** None

**Blocks:** Phase B (Backend Server)

---

## Estimated Session Breakdown

| Session | Focus | Hours |
|---------|-------|-------|
| 1 | Interface + SQLite Connection | 4 |
| 2 | Query Builder (all operators) | 4 |
| 3 | Schema Manager + Export | 3 |
| 4 | LocalSQLAdapter implementation | 5 |
| 5 | CloudStore refactor + testing | 4 |
| **Total** | | **20** |
