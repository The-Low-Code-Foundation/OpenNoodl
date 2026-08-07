# TASK-007: Integrated Local Backend

## Overview

Implement a zero-configuration local backend that runs alongside the Nodegex editor, enabling users to build full-stack applications immediately without Docker, cloud services, or external database setup. The system reuses Noodl's existing visual workflow paradigm for backend logic, providing a seamless experience from prototyping to production migration.

**Phase:** 5 (BYOB - Bring Your Own Backend)
**Priority:** HIGH (Major differentiator, addresses #1 user friction point)
**Effort:** 60-80 hours (across multiple sub-phases)
**Risk:** Medium (architectural changes, but builds on existing infrastructure)

---

## Strategic Context

### The Problem

New users consistently hit a wall when they need backend functionality:

- They don't want to immediately learn Docker
- They don't want to pay for cloud backends before validating their idea
- The cognitive overhead of "choose and configure a backend" kills momentum

### The Solution

An integrated, zero-config local backend that:

1. Starts automatically with the editor (optional)
2. Uses the **same visual node paradigm** for backend workflows
3. Provides instant full-stack development capability
4. Offers clear migration paths to production backends

### Why This Is a Game-Changer

| Current State                               | With Local Backend                       |
| ------------------------------------------- | ---------------------------------------- |
| "How do I add a database?" → Complex answer | "It's built in, just use Database nodes" |
| Requires external services for testing      | 100% offline development                 |
| Backend = different paradigm/tools          | Backend = same Noodl visual nodes        |
| Prototype → Production = migration pain     | Clear, assisted migration path           |

---

## Architecture Overview

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NODEGEX EDITOR                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Frontend Canvas          │  Backend Canvas (/#__cloud__/ or /#__local__/)  │
│  ┌─────────────────────┐  │  ┌──────────────────────────────────────────┐  │
│  │ Visual Components   │  │  │ Visual Workflows (same node paradigm)    │  │
│  │ UI Nodes            │  │  │ - Triggers (HTTP, Schedule, DB Change)   │  │
│  │ HTTP Node → ────────┼──┼──┼─→ Request/Response Nodes                 │  │
│  │ Data Nodes          │  │  │ - Database CRUD Nodes                    │  │
│  └─────────────────────┘  │  │ - Logic/Transform Nodes                  │  │
│                           │  └──────────────────────────────────────────┘  │
├───────────────────────────┴─────────────────────────────────────────────────┤
│                        CloudStore Abstraction Layer                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │ Parse Adapter   │  │ LocalSQL Adapter │  │ External Adapter (future)  │ │
│  │ (Legacy compat) │  │ (NEW - Default)  │  │ (Supabase, PocketBase...)  │ │
│  └────────┬────────┘  └────────┬─────────┘  └─────────────┬──────────────┘ │
└───────────┼────────────────────┼──────────────────────────┼─────────────────┘
            │                    │                          │
            ▼                    ▼                          ▼
    ┌───────────────┐  ┌─────────────────────┐    ┌─────────────────────┐
    │ Parse Server  │  │ Local Express Server│    │ External BaaS API   │
    │ (External)    │  │ + SQLite Database   │    │                     │
    └───────────────┘  └─────────────────────┘    └─────────────────────┘
```

### Backend Storage Architecture

```
~/.noodl/
├── backends/
│   ├── {backend-uuid-1}/
│   │   ├── config.json           # Name, created date, port, settings
│   │   ├── schema.json           # Schema definition (git-trackable)
│   │   ├── schema.sql            # Generated migrations
│   │   ├── workflows/            # Compiled visual workflows
│   │   │   └── *.workflow.json
│   │   └── data/
│   │       └── local.db          # SQLite database (gitignored)
│   └── {backend-uuid-2}/
│       └── ...
├── projects/
│   └── {project}/
│       └── noodl.project.json    # References backend by ID
└── launcher-config.json          # Global backend registry
```

### Project-Backend Relationship

```json
// noodl.project.json
{
  "name": "My Todo App",
  "version": "2.0",
  "backend": {
    "type": "local", // "local" | "parse" | "external"
    "id": "backend-uuid-1", // Reference to ~/.noodl/backends/{id}
    "settings": {
      "autoStart": true, // Start with editor
      "port": 8577
    }
  }
}
```

---

## Backward Compatibility Strategy

### Preserving Noodl Cloud Service Support

Existing users with Parse-based cloud services MUST continue to work:

```
Project Open Flow:
├── Load project.json
├── Check backend configuration
│   ├── Has "cloudServices" (legacy)?
│   │   ├── Show migration banner: "Migrate to Local Backend?"
│   │   ├── [Continue with Parse] → Use existing ParseAdapter
│   │   └── [Migrate] → Run Migration Wizard
│   ├── Has "backend.type": "local"?
│   │   └── Start LocalBackend, use LocalSQLAdapter
│   ├── Has "backend.type": "external"?
│   │   └── Use ExternalAdapter with configured endpoint
│   └── No backend configured?
│       └── Prompt: "Add a backend to your project?"
```

### Adapter Interface (CloudStore Abstraction)

The existing `CloudStore` class already abstracts database operations. We extend this:

```typescript
// packages/noodl-runtime/src/api/cloudstore-adapter.ts

interface CloudStoreAdapter {
  // Query operations
  query(options: QueryOptions): Promise<QueryResult>;
  fetch(options: FetchOptions): Promise<Record>;
  count(options: CountOptions): Promise<number>;
  aggregate(options: AggregateOptions): Promise<AggregateResult>;

  // Mutation operations
  create(options: CreateOptions): Promise<Record>;
  save(options: SaveOptions): Promise<void>;
  delete(options: DeleteOptions): Promise<void>;

  // Relation operations
  addRelation(options: RelationOptions): Promise<void>;
  removeRelation(options: RelationOptions): Promise<void>;

  // Schema operations
  getSchema(): Promise<SchemaDefinition>;
  updateSchema(schema: SchemaDefinition): Promise<void>;

  // Event subscription (for realtime)
  on(event: 'create' | 'save' | 'delete', handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;

  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}
```

---

## Implementation Phases

### Phase A: Foundation - LocalSQL Adapter (16-20 hours)

Create the SQLite-based CloudStore adapter that implements the existing interface.

#### A.1: SQLite Integration (4 hours)

**Files to create:**

```
packages/noodl-runtime/src/api/adapters/
├── index.ts                    # Adapter registry
├── local-sql/
│   ├── LocalSQLAdapter.ts      # Main adapter class
│   ├── SQLiteConnection.ts     # Database connection wrapper
│   ├── QueryBuilder.ts         # Convert CloudStore queries to SQL
│   ├── SchemaManager.ts        # Schema creation/migration
│   └── types.ts                # TypeScript interfaces
```

**Key implementation details:**

```typescript
// LocalSQLAdapter.ts

import { EventEmitter } from 'events';
import Database from 'better-sqlite3';

import { CloudStoreAdapter } from '../cloudstore-adapter';

export class LocalSQLAdapter implements CloudStoreAdapter {
  private db: Database.Database;
  private events = new EventEmitter();

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better concurrent access
  }

  async query(options: QueryOptions): Promise<QueryResult> {
    const { sql, params } = QueryBuilder.buildSelect(options);
    const rows = this.db.prepare(sql).all(...params);
    return rows.map((row) => this.rowToRecord(row, options.collection));
  }

  async create(options: CreateOptions): Promise<Record> {
    const id = generateObjectId();
    const { sql, params } = QueryBuilder.buildInsert(options, id);
    this.db.prepare(sql).run(...params);

    // Emit event for realtime subscribers
    const record = { objectId: id, ...options.data };
    this.events.emit('create', {
      type: 'create',
      collection: options.collection,
      object: record
    });

    return record;
  }

  // ... other methods
}
```

#### A.2: Query Translation (4 hours)

Translate CloudStore/Parse query syntax to SQL:

```typescript
// QueryBuilder.ts

// Parse-style query:
// { completed: { equalTo: true }, priority: { greaterThan: 5 } }

// Becomes SQL:
// SELECT * FROM todos WHERE completed = ? AND priority > ?

export class QueryBuilder {
  static buildSelect(options: QueryOptions): { sql: string; params: any[] } {
    const params: any[] = [];
    let sql = `SELECT * FROM ${this.escapeTable(options.collection)}`;

    if (options.where) {
      const whereClause = this.buildWhereClause(options.where, params);
      if (whereClause) sql += ` WHERE ${whereClause}`;
    }

    if (options.sort) {
      sql += ` ORDER BY ${this.buildOrderClause(options.sort)}`;
    }

    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options.skip) {
      sql += ` OFFSET ?`;
      params.push(options.skip);
    }

    return { sql, params };
  }

  private static buildWhereClause(where: any, params: any[]): string {
    const conditions: string[] = [];

    for (const [field, condition] of Object.entries(where)) {
      if (typeof condition === 'object') {
        for (const [op, value] of Object.entries(condition)) {
          conditions.push(this.translateOperator(field, op, value, params));
        }
      } else {
        // Direct equality
        conditions.push(`${this.escapeColumn(field)} = ?`);
        params.push(condition);
      }
    }

    return conditions.join(' AND ');
  }

  private static translateOperator(field: string, op: string, value: any, params: any[]): string {
    const col = this.escapeColumn(field);

    switch (op) {
      case 'equalTo':
        params.push(value);
        return `${col} = ?`;
      case 'notEqualTo':
        params.push(value);
        return `${col} != ?`;
      case 'greaterThan':
        params.push(value);
        return `${col} > ?`;
      case 'lessThan':
        params.push(value);
        return `${col} < ?`;
      case 'greaterThanOrEqualTo':
        params.push(value);
        return `${col} >= ?`;
      case 'lessThanOrEqualTo':
        params.push(value);
        return `${col} <= ?`;
      case 'containedIn':
        const placeholders = value.map(() => '?').join(', ');
        params.push(...value);
        return `${col} IN (${placeholders})`;
      case 'notContainedIn':
        const ph = value.map(() => '?').join(', ');
        params.push(...value);
        return `${col} NOT IN (${ph})`;
      case 'exists':
        return value ? `${col} IS NOT NULL` : `${col} IS NULL`;
      case 'contains':
        params.push(`%${value}%`);
        return `${col} LIKE ?`;
      case 'startsWith':
        params.push(`${value}%`);
        return `${col} LIKE ?`;
      case 'endsWith':
        params.push(`%${value}`);
        return `${col} LIKE ?`;
      case 'regex':
        // SQLite doesn't have native regex, use LIKE or GLOB
        params.push(value);
        return `${col} GLOB ?`;
      default:
        throw new Error(`Unknown query operator: ${op}`);
    }
  }
}
```

#### A.3: Schema Management (4 hours)

```typescript
// SchemaManager.ts

export interface ColumnDefinition {
  name: string;
  type: 'String' | 'Number' | 'Boolean' | 'Date' | 'Object' | 'Array' | 'Pointer' | 'Relation';
  required?: boolean;
  targetClass?: string; // For Pointer/Relation
}

export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
}

export class SchemaManager {
  constructor(private db: Database.Database) {}

  async createTable(schema: TableSchema): Promise<void> {
    const columns = [
      'objectId TEXT PRIMARY KEY',
      'createdAt TEXT DEFAULT CURRENT_TIMESTAMP',
      'updatedAt TEXT DEFAULT CURRENT_TIMESTAMP',
      ...schema.columns.map((col) => this.columnToSQL(col))
    ];

    const sql = `CREATE TABLE IF NOT EXISTS ${schema.name} (${columns.join(', ')})`;
    this.db.exec(sql);

    // Create indexes for common query patterns
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_${schema.name}_createdAt ON ${schema.name}(createdAt)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_${schema.name}_updatedAt ON ${schema.name}(updatedAt)`);
  }

  private columnToSQL(col: ColumnDefinition): string {
    let sqlType: string;

    switch (col.type) {
      case 'String':
        sqlType = 'TEXT';
        break;
      case 'Number':
        sqlType = 'REAL';
        break;
      case 'Boolean':
        sqlType = 'INTEGER'; // 0/1
        break;
      case 'Date':
        sqlType = 'TEXT'; // ISO8601 string
        break;
      case 'Object':
      case 'Array':
        sqlType = 'TEXT'; // JSON string
        break;
      case 'Pointer':
        sqlType = 'TEXT'; // objectId reference
        break;
      case 'Relation':
        // Relations are stored in a junction table
        return null;
      default:
        sqlType = 'TEXT';
    }

    let def = `${col.name} ${sqlType}`;
    if (col.required) def += ' NOT NULL';

    return def;
  }

  async addColumn(table: string, column: ColumnDefinition): Promise<void> {
    const colSQL = this.columnToSQL(column);
    if (colSQL) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${colSQL}`);
    }
  }

  async exportSchema(): Promise<TableSchema[]> {
    const tables = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];

    return tables.map((t) => this.getTableSchema(t.name));
  }

  async generatePostgresSQL(): Promise<string> {
    // Export schema as Postgres-compatible SQL for migration
    const schemas = await this.exportSchema();
    return schemas.map((s) => this.tableToPostgresSQL(s)).join('\n\n');
  }
}
```

#### A.4: Adapter Registration & Selection (4 hours)

```typescript
// packages/noodl-runtime/src/api/adapters/index.ts

import { CloudStoreAdapter } from '../cloudstore-adapter';
import { LocalSQLAdapter } from './local-sql/LocalSQLAdapter';
import { ParseAdapter } from './parse/ParseAdapter';

// Existing, refactored

export type AdapterType = 'local' | 'parse' | 'external';

export interface AdapterConfig {
  type: AdapterType;

  // For local
  dbPath?: string;

  // For parse
  endpoint?: string;
  appId?: string;
  masterKey?: string;

  // For external (future)
  provider?: string;
  apiKey?: string;
}

export class AdapterRegistry {
  private static instance: AdapterRegistry;
  private adapters = new Map<string, CloudStoreAdapter>();

  static getInstance(): AdapterRegistry {
    if (!this.instance) {
      this.instance = new AdapterRegistry();
    }
    return this.instance;
  }

  async createAdapter(id: string, config: AdapterConfig): Promise<CloudStoreAdapter> {
    let adapter: CloudStoreAdapter;

    switch (config.type) {
      case 'local':
        adapter = new LocalSQLAdapter(config.dbPath!);
        break;
      case 'parse':
        adapter = new ParseAdapter(config.endpoint!, config.appId!, config.masterKey);
        break;
      case 'external':
        throw new Error('External adapters not yet implemented');
      default:
        throw new Error(`Unknown adapter type: ${config.type}`);
    }

    await adapter.connect();
    this.adapters.set(id, adapter);
    return adapter;
  }

  getAdapter(id: string): CloudStoreAdapter | undefined {
    return this.adapters.get(id);
  }

  async disconnectAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.disconnect();
    }
    this.adapters.clear();
  }
}
```

### Phase B: Local Backend Server (12-16 hours)

Extend the existing Express server to handle local backend operations.

#### B.1: Server Architecture (4 hours)

```typescript
// packages/noodl-editor/src/main/src/local-backend/LocalBackendServer.ts

import http from 'http';
import express, { Express, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { CloudRunner } from '@noodl/cloud-runtime';
import { LocalSQLAdapter } from '@noodl/runtime/src/api/adapters/local-sql/LocalSQLAdapter';

export interface LocalBackendConfig {
  id: string;
  name: string;
  dbPath: string;
  port: number;
  workflowsPath: string;
}

export class LocalBackendServer {
  private app: Express;
  private server: http.Server;
  private wss: WebSocketServer;
  private adapter: LocalSQLAdapter;
  private cloudRunner: CloudRunner;
  private clients = new Set<WebSocket>();

  constructor(private config: LocalBackendConfig) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));

    // CORS for local development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', '*');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', backend: this.config.name });
    });

    // Schema endpoints
    this.app.get('/api/_schema', this.handleGetSchema.bind(this));
    this.app.post('/api/_schema', this.handleUpdateSchema.bind(this));
    this.app.get('/api/_export', this.handleExport.bind(this));

    // Auto-REST for tables
    this.app.get('/api/:table', this.handleQuery.bind(this));
    this.app.get('/api/:table/:id', this.handleFetch.bind(this));
    this.app.post('/api/:table', this.handleCreate.bind(this));
    this.app.put('/api/:table/:id', this.handleSave.bind(this));
    this.app.delete('/api/:table/:id', this.handleDelete.bind(this));

    // Visual workflow functions (CloudRunner)
    this.app.post('/functions/:name', this.handleFunction.bind(this));

    // Batch operations
    this.app.post('/api/_batch', this.handleBatch.bind(this));
  }

  private async handleQuery(req: Request, res: Response): Promise<void> {
    try {
      const { table } = req.params;
      const { where, sort, limit, skip } = req.query;

      const results = await this.adapter.query({
        collection: table,
        where: where ? JSON.parse(where as string) : undefined,
        sort: sort ? JSON.parse(sort as string) : undefined,
        limit: limit ? parseInt(limit as string) : 100,
        skip: skip ? parseInt(skip as string) : 0
      });

      res.json({ results });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  private async handleCreate(req: Request, res: Response): Promise<void> {
    try {
      const { table } = req.params;
      const data = req.body;

      const record = await this.adapter.create({
        collection: table,
        data
      });

      // Broadcast to WebSocket clients
      this.broadcast('create', { collection: table, object: record });

      res.status(201).json(record);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  private async handleFunction(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      const result = await this.cloudRunner.run(name, {
        body: req.body,
        headers: req.headers
      });

      res.status(result.statusCode).json(JSON.parse(result.body));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // WebSocket for realtime updates
  private setupWebSocket(): void {
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      // Handle subscription messages
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'subscribe') {
            // Track subscriptions per client
            (ws as any).subscriptions = (ws as any).subscriptions || new Set();
            (ws as any).subscriptions.add(msg.collection);
          }
        } catch (e) {
          // Ignore invalid messages
        }
      });
    });
  }

  private broadcast(event: string, data: any): void {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        // Check if client is subscribed to this collection
        const subs = (client as any).subscriptions;
        if (!subs || subs.has(data.collection)) {
          client.send(message);
        }
      }
    }
  }

  async start(): Promise<void> {
    // Initialize database adapter
    this.adapter = new LocalSQLAdapter(this.config.dbPath);
    await this.adapter.connect();

    // Initialize CloudRunner for visual workflows
    this.cloudRunner = new CloudRunner({});
    await this.loadWorkflows();

    // Subscribe to adapter events for realtime
    this.adapter.on('create', (data) => this.broadcast('create', data));
    this.adapter.on('save', (data) => this.broadcast('save', data));
    this.adapter.on('delete', (data) => this.broadcast('delete', data));

    // Start HTTP server
    this.server = this.app.listen(this.config.port, () => {
      console.log(`Local backend "${this.config.name}" running on port ${this.config.port}`);
    });

    // Start WebSocket server
    this.setupWebSocket();
  }

  async stop(): Promise<void> {
    // Close all WebSocket connections
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();

    // Close servers
    if (this.wss) this.wss.close();
    if (this.server) this.server.close();

    // Disconnect database
    if (this.adapter) await this.adapter.disconnect();
  }

  private async loadWorkflows(): Promise<void> {
    // Load compiled visual workflows from disk
    // These are exported from the editor when workflows change
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const files = await fs.readdir(this.config.workflowsPath);
      for (const file of files) {
        if (file.endsWith('.workflow.json')) {
          const content = await fs.readFile(path.join(this.config.workflowsPath, file), 'utf-8');
          const workflow = JSON.parse(content);
          await this.cloudRunner.load(workflow);
        }
      }
    } catch (e) {
      // No workflows yet, that's fine
    }
  }
}
```

#### B.2: Backend Manager (4 hours)

```typescript
// packages/noodl-editor/src/main/src/local-backend/BackendManager.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import { ipcMain } from 'electron';

import { LocalBackendServer, LocalBackendConfig } from './LocalBackendServer';

export interface BackendMetadata {
  id: string;
  name: string;
  createdAt: string;
  port: number;
  projectIds: string[]; // Projects using this backend
}

export class BackendManager {
  private static instance: BackendManager;
  private backends = new Map<string, LocalBackendServer>();
  private backendsPath: string;

  static getInstance(): BackendManager {
    if (!this.instance) {
      this.instance = new BackendManager();
    }
    return this.instance;
  }

  constructor() {
    this.backendsPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.noodl', 'backends');
    this.setupIPC();
  }

  private setupIPC(): void {
    // IPC handlers for renderer process
    ipcMain.handle('backend:list', () => this.listBackends());
    ipcMain.handle('backend:create', (_, name: string) => this.createBackend(name));
    ipcMain.handle('backend:delete', (_, id: string) => this.deleteBackend(id));
    ipcMain.handle('backend:start', (_, id: string) => this.startBackend(id));
    ipcMain.handle('backend:stop', (_, id: string) => this.stopBackend(id));
    ipcMain.handle('backend:status', (_, id: string) => this.getStatus(id));
    ipcMain.handle('backend:export-schema', (_, id: string, format: string) => this.exportSchema(id, format));
  }

  async listBackends(): Promise<BackendMetadata[]> {
    await fs.mkdir(this.backendsPath, { recursive: true });

    const entries = await fs.readdir(this.backendsPath, { withFileTypes: true });
    const backends: BackendMetadata[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const configPath = path.join(this.backendsPath, entry.name, 'config.json');
          const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
          backends.push(config);
        } catch (e) {
          // Invalid backend directory, skip
        }
      }
    }

    return backends;
  }

  async createBackend(name: string): Promise<BackendMetadata> {
    const id = this.generateId();
    const backendPath = path.join(this.backendsPath, id);

    await fs.mkdir(backendPath, { recursive: true });
    await fs.mkdir(path.join(backendPath, 'data'));
    await fs.mkdir(path.join(backendPath, 'workflows'));

    const metadata: BackendMetadata = {
      id,
      name,
      createdAt: new Date().toISOString(),
      port: await this.findAvailablePort(),
      projectIds: []
    };

    await fs.writeFile(path.join(backendPath, 'config.json'), JSON.stringify(metadata, null, 2));

    // Create empty schema
    await fs.writeFile(path.join(backendPath, 'schema.json'), JSON.stringify({ tables: [] }, null, 2));

    return metadata;
  }

  async startBackend(id: string): Promise<void> {
    if (this.backends.has(id)) {
      return; // Already running
    }

    const backendPath = path.join(this.backendsPath, id);
    const config = JSON.parse(await fs.readFile(path.join(backendPath, 'config.json'), 'utf-8'));

    const server = new LocalBackendServer({
      id,
      name: config.name,
      dbPath: path.join(backendPath, 'data', 'local.db'),
      port: config.port,
      workflowsPath: path.join(backendPath, 'workflows')
    });

    await server.start();
    this.backends.set(id, server);
  }

  async stopBackend(id: string): Promise<void> {
    const server = this.backends.get(id);
    if (server) {
      await server.stop();
      this.backends.delete(id);
    }
  }

  getStatus(id: string): { running: boolean; port?: number } {
    const server = this.backends.get(id);
    if (server) {
      return { running: true, port: (server as any).config.port };
    }
    return { running: false };
  }

  async exportSchema(id: string, format: 'postgres' | 'supabase' | 'json'): Promise<string> {
    const backendPath = path.join(this.backendsPath, id);
    const server = this.backends.get(id);

    if (!server) {
      throw new Error('Backend must be running to export schema');
    }

    const adapter = (server as any).adapter;

    switch (format) {
      case 'postgres':
        return adapter.schemaManager.generatePostgresSQL();
      case 'supabase':
        return adapter.schemaManager.generateSupabaseSQL();
      case 'json':
        return JSON.stringify(await adapter.schemaManager.exportSchema(), null, 2);
      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  private generateId(): string {
    return 'backend-' + Math.random().toString(36).substring(2, 15);
  }

  private async findAvailablePort(): Promise<number> {
    // Start from 8577 and find next available
    const existingBackends = await this.listBackends();
    const usedPorts = new Set(existingBackends.map((b) => b.port));

    let port = 8577;
    while (usedPorts.has(port)) {
      port++;
    }
    return port;
  }
}
```

#### B.3: Editor Integration (4 hours)

Wire up the backend manager to the editor:

```typescript
// packages/noodl-editor/src/editor/src/models/BackendModel.ts

import { Model } from '@noodl-models/Model';

export interface BackendInfo {
  id: string;
  name: string;
  type: 'local' | 'parse' | 'external';
  status: 'running' | 'stopped' | 'error';
  port?: number;
  endpoint?: string;
}

export class BackendModel extends Model {
  static instance = new BackendModel();

  private currentBackend: BackendInfo | null = null;

  async loadProjectBackend(projectConfig: any): Promise<void> {
    if (!projectConfig.backend) {
      this.currentBackend = null;
      this.notifyListeners('backendChanged');
      return;
    }

    const { type, id, settings } = projectConfig.backend;

    if (type === 'local') {
      // Start local backend if autoStart enabled
      if (settings?.autoStart) {
        await window.electronAPI.invoke('backend:start', id);
      }

      const status = await window.electronAPI.invoke('backend:status', id);
      this.currentBackend = {
        id,
        name: '', // Will be filled from config
        type: 'local',
        status: status.running ? 'running' : 'stopped',
        port: status.port,
        endpoint: status.port ? `http://localhost:${status.port}` : undefined
      };
    } else if (type === 'parse') {
      // Legacy Parse backend
      this.currentBackend = {
        id,
        name: projectConfig.cloudServices?.name || 'Parse Backend',
        type: 'parse',
        status: 'running', // External, assume running
        endpoint: projectConfig.cloudServices?.url
      };
    }

    this.notifyListeners('backendChanged');
  }

  getCurrentBackend(): BackendInfo | null {
    return this.currentBackend;
  }

  async startBackend(): Promise<void> {
    if (this.currentBackend?.type === 'local') {
      await window.electronAPI.invoke('backend:start', this.currentBackend.id);
      this.currentBackend.status = 'running';
      this.notifyListeners('backendStatusChanged');
    }
  }

  async stopBackend(): Promise<void> {
    if (this.currentBackend?.type === 'local') {
      await window.electronAPI.invoke('backend:stop', this.currentBackend.id);
      this.currentBackend.status = 'stopped';
      this.notifyListeners('backendStatusChanged');
    }
  }
}
```

### Phase C: Visual Workflow Runtime (12-16 hours)

Adapt the existing CloudRunner to work with the local backend.

#### C.1: Runtime Adaptation (4 hours)

The existing `noodl-viewer-cloud` package has most of what we need. We need to:

1. Remove Parse Server dependencies from cloud nodes
2. Add LocalSQL-aware database nodes
3. Ensure the isolate runtime works in pure Node.js

```typescript
// packages/noodl-viewer-cloud/src/nodes/database/local-query.ts

export const node = {
  name: 'noodl.local.query',
  displayNodeName: 'Query Records',
  category: 'Local Database',
  color: 'data',
  docs: 'https://docs.nodegex.com/nodes/local-database/query',

  inputs: {
    collection: {
      type: 'string',
      displayName: 'Collection',
      group: 'General'
    },
    where: {
      type: { name: 'query-filter', allowEditOnly: true },
      displayName: 'Filter',
      group: 'Filter'
    },
    limit: {
      type: 'number',
      displayName: 'Limit',
      default: 100,
      group: 'Pagination'
    },
    skip: {
      type: 'number',
      displayName: 'Skip',
      default: 0,
      group: 'Pagination'
    },
    fetch: {
      type: 'signal',
      displayName: 'Fetch',
      group: 'Actions'
    }
  },

  outputs: {
    results: {
      type: 'array',
      displayName: 'Results',
      group: 'General'
    },
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'General'
    },
    success: {
      type: 'signal',
      displayName: 'Success',
      group: 'Events'
    },
    failure: {
      type: 'signal',
      displayName: 'Failure',
      group: 'Events'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error'
    }
  },

  methods: {
    async doQuery() {
      try {
        const adapter = this.context.getLocalAdapter();
        const results = await adapter.query({
          collection: this._internal.collection,
          where: this._internal.where,
          limit: this._internal.limit,
          skip: this._internal.skip
        });

        this._internal.results = results;
        this._internal.count = results.length;
        this.flagOutputDirty('results');
        this.flagOutputDirty('count');
        this.sendSignalOnOutput('success');
      } catch (e) {
        this._internal.error = e.message;
        this.flagOutputDirty('error');
        this.sendSignalOnOutput('failure');
      }
    }
  }
};
```

#### C.2: Trigger Nodes (4 hours)

```typescript
// packages/noodl-viewer-cloud/src/nodes/triggers/schedule.ts

export const node = {
  name: 'noodl.trigger.schedule',
  displayNodeName: 'Schedule Trigger',
  category: 'Triggers',
  color: 'data',
  singleton: true,

  inputs: {
    cron: {
      type: 'string',
      displayName: 'Cron Expression',
      group: 'Schedule',
      default: '0 * * * *' // Every hour
    },
    enabled: {
      type: 'boolean',
      displayName: 'Enabled',
      group: 'Schedule',
      default: true
    }
  },

  outputs: {
    triggered: {
      type: 'signal',
      displayName: 'Triggered',
      group: 'Events'
    },
    lastRun: {
      type: 'date',
      displayName: 'Last Run',
      group: 'Info'
    }
  },

  initialize() {
    this._internal.job = null;
  },

  methods: {
    startSchedule() {
      if (this._internal.job) {
        this._internal.job.stop();
      }

      if (this._internal.enabled && this._internal.cron) {
        const cron = require('node-cron');
        this._internal.job = cron.schedule(this._internal.cron, () => {
          this._internal.lastRun = new Date();
          this.flagOutputDirty('lastRun');
          this.sendSignalOnOutput('triggered');
        });
      }
    },

    _onNodeDeleted() {
      if (this._internal.job) {
        this._internal.job.stop();
      }
    }
  }
};
```

```typescript
// packages/noodl-viewer-cloud/src/nodes/triggers/db-change.ts

export const node = {
  name: 'noodl.trigger.dbChange',
  displayNodeName: 'Database Change Trigger',
  category: 'Triggers',
  color: 'data',
  singleton: true,

  inputs: {
    collection: {
      type: 'string',
      displayName: 'Collection',
      group: 'General'
    },
    events: {
      type: {
        name: 'enum',
        enums: [
          { label: 'All Changes', value: 'all' },
          { label: 'Create Only', value: 'create' },
          { label: 'Update Only', value: 'save' },
          { label: 'Delete Only', value: 'delete' }
        ]
      },
      displayName: 'Events',
      default: 'all',
      group: 'General'
    }
  },

  outputs: {
    triggered: {
      type: 'signal',
      displayName: 'Triggered',
      group: 'Events'
    },
    eventType: {
      type: 'string',
      displayName: 'Event Type',
      group: 'Data'
    },
    record: {
      type: 'object',
      displayName: 'Record',
      group: 'Data'
    },
    recordId: {
      type: 'string',
      displayName: 'Record ID',
      group: 'Data'
    }
  },

  initialize() {
    this._internal.handler = null;
  },

  methods: {
    setupListener() {
      const adapter = this.context.getLocalAdapter();

      this._internal.handler = (event) => {
        if (event.collection !== this._internal.collection) return;

        const eventFilter = this._internal.events;
        if (eventFilter !== 'all' && event.type !== eventFilter) return;

        this._internal.eventType = event.type;
        this._internal.record = event.object;
        this._internal.recordId = event.objectId;

        this.flagOutputDirty('eventType');
        this.flagOutputDirty('record');
        this.flagOutputDirty('recordId');
        this.sendSignalOnOutput('triggered');
      };

      adapter.on('create', this._internal.handler);
      adapter.on('save', this._internal.handler);
      adapter.on('delete', this._internal.handler);
    },

    _onNodeDeleted() {
      if (this._internal.handler) {
        const adapter = this.context.getLocalAdapter();
        adapter.off('create', this._internal.handler);
        adapter.off('save', this._internal.handler);
        adapter.off('delete', this._internal.handler);
      }
    }
  }
};
```

#### C.3: Workflow Compilation & Hot Reload (4 hours)

```typescript
// packages/noodl-editor/src/editor/src/utils/workflow-compiler.ts

import { ProjectModel } from '@noodl-models/projectmodel';
import { exportComponentsToJSON } from '@noodl-utils/exporter';

export class WorkflowCompiler {
  static instance = new WorkflowCompiler();

  private debounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Listen for component changes
    ProjectModel.instance.on('componentChanged', this.scheduleCompile.bind(this));
    ProjectModel.instance.on('componentAdded', this.scheduleCompile.bind(this));
    ProjectModel.instance.on('componentRemoved', this.scheduleCompile.bind(this));
  }

  private scheduleCompile(): void {
    // Debounce compilation
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.compile();
    }, 1000);
  }

  async compile(): Promise<void> {
    const project = ProjectModel.instance;
    const backend = project.getMetaData('backend');

    if (!backend || backend.type !== 'local') {
      return; // No local backend to compile for
    }

    // Get all cloud/local workflow components
    const workflowComponents = project
      .getComponents()
      .filter((c) => c.name.startsWith('/#__cloud__/') || c.name.startsWith('/#__local__/'));

    if (workflowComponents.length === 0) {
      return;
    }

    // Export each workflow
    for (const component of workflowComponents) {
      const exported = exportComponentsToJSON(project, [component], {
        useBundles: false
      });

      // Clean up unnecessary metadata
      delete exported.metadata?.variants;
      delete exported.metadata?.styles;
      delete exported.componentIndex;

      const workflowName = component.name.replace('/#__cloud__/', '').replace('/#__local__/', '');

      // Send to backend
      await window.electronAPI.invoke('backend:update-workflow', {
        backendId: backend.id,
        name: workflowName,
        workflow: exported
      });
    }

    // Notify backend to reload workflows
    await window.electronAPI.invoke('backend:reload-workflows', backend.id);
  }
}
```

### Phase D: Launcher Integration (8-10 hours)

Add backend management to the project launcher.

#### D.1: Launcher UI Components (4 hours)

```typescript
// packages/noodl-editor/src/editor/src/views/Launcher/BackendManager/BackendList.tsx

import React, { useState, useEffect } from 'react';

import { BackendCard } from './BackendCard';
import styles from './BackendList.module.scss';
import { CreateBackendDialog } from './CreateBackendDialog';

interface Backend {
  id: string;
  name: string;
  status: 'running' | 'stopped';
  port?: number;
  projectCount: number;
}

export function BackendList() {
  const [backends, setBackends] = useState<Backend[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBackends();
  }, []);

  async function loadBackends() {
    setLoading(true);
    const list = await window.electronAPI.invoke('backend:list');

    // Get status for each
    const withStatus = await Promise.all(
      list.map(async (b) => {
        const status = await window.electronAPI.invoke('backend:status', b.id);
        return {
          ...b,
          status: status.running ? 'running' : 'stopped',
          port: status.port,
          projectCount: b.projectIds?.length || 0
        };
      })
    );

    setBackends(withStatus);
    setLoading(false);
  }

  async function handleStart(id: string) {
    await window.electronAPI.invoke('backend:start', id);
    loadBackends();
  }

  async function handleStop(id: string) {
    await window.electronAPI.invoke('backend:stop', id);
    loadBackends();
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this backend? Data will be lost.')) {
      await window.electronAPI.invoke('backend:delete', id);
      loadBackends();
    }
  }

  async function handleCreate(name: string) {
    await window.electronAPI.invoke('backend:create', name);
    setShowCreate(false);
    loadBackends();
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Local Backends</h2>
        <button onClick={() => setShowCreate(true)}>+ New Backend</button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : backends.length === 0 ? (
        <div className={styles.empty}>
          <p>No local backends yet.</p>
          <p>Create one to start building full-stack apps!</p>
        </div>
      ) : (
        <div className={styles.list}>
          {backends.map((backend) => (
            <BackendCard
              key={backend.id}
              backend={backend}
              onStart={() => handleStart(backend.id)}
              onStop={() => handleStop(backend.id)}
              onDelete={() => handleDelete(backend.id)}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateBackendDialog onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
    </div>
  );
}
```

#### D.2: Project-Backend Association (4 hours)

```typescript
// packages/noodl-editor/src/editor/src/views/Launcher/ProjectCard/BackendSelector.tsx

import React, { useState, useEffect } from 'react';

import styles from './BackendSelector.module.scss';

interface Props {
  projectId: string;
  currentBackendId?: string;
  onSelect: (backendId: string | null) => void;
}

export function BackendSelector({ projectId, currentBackendId, onSelect }: Props) {
  const [backends, setBackends] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadBackends();
  }, []);

  async function loadBackends() {
    const list = await window.electronAPI.invoke('backend:list');
    setBackends(list);
  }

  const currentBackend = backends.find((b) => b.id === currentBackendId);

  return (
    <div className={styles.selector}>
      <button className={styles.trigger} onClick={() => setIsOpen(!isOpen)}>
        <span className={styles.icon}>⚡</span>
        {currentBackend ? <span>{currentBackend.name}</span> : <span className={styles.placeholder}>No backend</span>}
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <button
            className={styles.option}
            onClick={() => {
              onSelect(null);
              setIsOpen(false);
            }}
          >
            No Backend
          </button>

          <div className={styles.divider} />

          {backends.map((backend) => (
            <button
              key={backend.id}
              className={styles.option}
              onClick={() => {
                onSelect(backend.id);
                setIsOpen(false);
              }}
            >
              {backend.name}
              {backend.id === currentBackendId && ' ✓'}
            </button>
          ))}

          <div className={styles.divider} />

          <button
            className={styles.option}
            onClick={() => {
              // Open create dialog
              setIsOpen(false);
            }}
          >
            + Create New Backend
          </button>
        </div>
      )}
    </div>
  );
}
```

### Phase E: Migration & Export Tools (8-10 hours)

#### E.1: Schema Export (4 hours)

```typescript
// packages/noodl-editor/src/editor/src/views/BackendPanel/ExportWizard.tsx

import React, { useState } from 'react';

import styles from './ExportWizard.module.scss';

type ExportFormat = 'postgres' | 'supabase' | 'pocketbase' | 'json';

interface Props {
  backendId: string;
  onClose: () => void;
}

export function ExportWizard({ backendId, onClose }: Props) {
  const [format, setFormat] = useState<ExportFormat>('postgres');
  const [includeData, setIncludeData] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);

    try {
      const schema = await window.electronAPI.invoke('backend:export-schema', backendId, format);

      let data = '';
      if (includeData) {
        data = await window.electronAPI.invoke('backend:export-data', backendId, format === 'json' ? 'json' : 'sql');
      }

      setResult(schema + (data ? '\n\n-- DATA\n' + data : ''));
    } catch (e) {
      setResult(`Error: ${e.message}`);
    }

    setLoading(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(result || '');
  }

  function handleDownload() {
    const ext = format === 'json' ? 'json' : 'sql';
    const blob = new Blob([result || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schema.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.wizard}>
      <h2>Export Schema</h2>

      <div className={styles.section}>
        <label>Export Format</label>
        <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
          <option value="postgres">PostgreSQL</option>
          <option value="supabase">Supabase (with RLS)</option>
          <option value="pocketbase">PocketBase</option>
          <option value="json">JSON Schema</option>
        </select>
      </div>

      <div className={styles.section}>
        <label>
          <input type="checkbox" checked={includeData} onChange={(e) => setIncludeData(e.target.checked)} />
          Include sample data (for testing)
        </label>
      </div>

      {!result ? (
        <button className={styles.exportBtn} onClick={handleExport} disabled={loading}>
          {loading ? 'Exporting...' : 'Generate Export'}
        </button>
      ) : (
        <>
          <div className={styles.result}>
            <pre>{result}</pre>
          </div>

          <div className={styles.actions}>
            <button onClick={handleCopy}>Copy to Clipboard</button>
            <button onClick={handleDownload}>Download File</button>
          </div>
        </>
      )}

      <button className={styles.closeBtn} onClick={onClose}>
        Close
      </button>
    </div>
  );
}
```

#### E.2: Parse Migration Wizard (4 hours)

```typescript
// packages/noodl-editor/src/editor/src/views/Migration/ParseMigrationWizard.tsx

import React, { useState } from 'react';

import styles from './ParseMigrationWizard.module.scss';

interface Props {
  projectId: string;
  parseConfig: {
    endpoint: string;
    appId: string;
    masterKey?: string;
  };
  onComplete: (newBackendId: string) => void;
  onCancel: () => void;
}

type Step = 'confirm' | 'fetching' | 'review' | 'migrating' | 'complete';

export function ParseMigrationWizard({ projectId, parseConfig, onComplete, onCancel }: Props) {
  const [step, setStep] = useState<Step>('confirm');
  const [schema, setSchema] = useState<any>(null);
  const [dataStats, setDataStats] = useState<any>(null);
  const [newBackendId, setNewBackendId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function fetchSchema() {
    setStep('fetching');

    try {
      // Fetch schema from Parse Server
      const response = await fetch(`${parseConfig.endpoint}/schemas`, {
        headers: {
          'X-Parse-Application-Id': parseConfig.appId,
          'X-Parse-Master-Key': parseConfig.masterKey || ''
        }
      });

      const data = await response.json();
      setSchema(data.results);

      // Get record counts
      const stats: any = {};
      for (const cls of data.results) {
        const countRes = await fetch(`${parseConfig.endpoint}/classes/${cls.className}?count=1&limit=0`, {
          headers: {
            'X-Parse-Application-Id': parseConfig.appId,
            'X-Parse-Master-Key': parseConfig.masterKey || ''
          }
        });
        const countData = await countRes.json();
        stats[cls.className] = countData.count;
      }
      setDataStats(stats);

      setStep('review');
    } catch (e) {
      setError(`Failed to fetch schema: ${e.message}`);
    }
  }

  async function startMigration() {
    setStep('migrating');
    setProgress(0);

    try {
      // Create new local backend
      const backend = await window.electronAPI.invoke('backend:create', `Migrated from ${parseConfig.appId}`);
      setNewBackendId(backend.id);

      // Start it
      await window.electronAPI.invoke('backend:start', backend.id);

      // Migrate schema
      setProgress(10);
      await window.electronAPI.invoke('backend:import-parse-schema', {
        backendId: backend.id,
        schema
      });

      // Migrate data (if requested)
      const totalRecords = Object.values(dataStats).reduce((a: number, b: number) => a + b, 0);
      let migratedRecords = 0;

      for (const cls of schema) {
        const className = cls.className;
        const count = dataStats[className];

        // Fetch in batches
        let skip = 0;
        const batchSize = 100;

        while (skip < count) {
          const response = await fetch(`${parseConfig.endpoint}/classes/${className}?limit=${batchSize}&skip=${skip}`, {
            headers: {
              'X-Parse-Application-Id': parseConfig.appId,
              'X-Parse-Master-Key': parseConfig.masterKey || ''
            }
          });

          const data = await response.json();

          await window.electronAPI.invoke('backend:import-records', {
            backendId: backend.id,
            collection: className,
            records: data.results
          });

          skip += batchSize;
          migratedRecords += data.results.length;
          setProgress(10 + (migratedRecords / totalRecords) * 80);
        }
      }

      setProgress(100);
      setStep('complete');
    } catch (e) {
      setError(`Migration failed: ${e.message}`);
    }
  }

  // Render different steps...
  return <div className={styles.wizard}>{/* Step UI here */}</div>;
}
```

### Phase F: Standalone Deployment (8-10 hours)

#### F.1: Backend Bundler (4 hours)

```typescript
// packages/noodl-editor/src/editor/src/utils/deployment/backend-bundler.ts

import * as fs from 'fs/promises';
import * as path from 'path';

export interface BundleOptions {
  backendId: string;
  outputPath: string;
  includeData: boolean;
  platform: 'node' | 'electron';
}

export async function bundleBackend(options: BundleOptions): Promise<void> {
  const { backendId, outputPath, includeData, platform } = options;

  // Create output directory structure
  await fs.mkdir(path.join(outputPath, 'backend'), { recursive: true });

  // Get backend config
  const backendPath = path.join(process.env.HOME || '', '.noodl/backends', backendId);

  // Copy server code (pre-bundled)
  const serverBundle = await getServerBundle(platform);
  await fs.writeFile(path.join(outputPath, 'backend', 'server.js'), serverBundle);

  // Copy schema
  await fs.copyFile(path.join(backendPath, 'schema.json'), path.join(outputPath, 'backend', 'schema.json'));

  // Copy workflows
  await fs.cp(path.join(backendPath, 'workflows'), path.join(outputPath, 'backend', 'workflows'), { recursive: true });

  // Optionally copy data
  if (includeData) {
    await fs.copyFile(path.join(backendPath, 'data', 'local.db'), path.join(outputPath, 'backend', 'data.db'));
  }

  // Generate package.json
  const packageJson = {
    name: 'nodegex-backend',
    version: '1.0.0',
    main: 'server.js',
    scripts: {
      start: 'node server.js'
    },
    dependencies: {
      'better-sqlite3': '^9.0.0',
      express: '^4.18.0',
      ws: '^8.0.0',
      'node-cron': '^3.0.0'
    }
  };

  await fs.writeFile(path.join(outputPath, 'backend', 'package.json'), JSON.stringify(packageJson, null, 2));

  // Generate startup script
  const startupScript = `
const { spawn } = require('child_process');
const path = require('path');

const backend = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, 'backend'),
  env: {
    ...process.env,
    PORT: process.env.BACKEND_PORT || 8577,
    DB_PATH: path.join(__dirname, 'backend', 'data.db')
  }
});

backend.stdout.on('data', (data) => console.log('[Backend]', data.toString()));
backend.stderr.on('data', (data) => console.error('[Backend]', data.toString()));

module.exports = { backend };
`;

  await fs.writeFile(path.join(outputPath, 'start-backend.js'), startupScript);
}

async function getServerBundle(platform: string): Promise<string> {
  // Return pre-compiled server bundle
  // This would be generated during editor build
  const bundlePath = path.join(__dirname, '..', 'resources', 'local-backend', `server.${platform}.bundle.js`);
  return fs.readFile(bundlePath, 'utf-8');
}
```

#### F.2: Electron Deployment Integration (4 hours)

```typescript
// packages/noodl-editor/src/editor/src/utils/deployment/electron-deployer.ts

import { bundleBackend } from './backend-bundler';

export interface ElectronDeployOptions {
  projectPath: string;
  outputPath: string;
  backendId?: string;
  includeBackend: boolean;
  includeData: boolean;
}

export async function deployElectron(options: ElectronDeployOptions): Promise<void> {
  const { projectPath, outputPath, backendId, includeBackend, includeData } = options;

  // Standard Electron deployment first
  await buildElectronApp(projectPath, outputPath);

  // Add backend if requested
  if (includeBackend && backendId) {
    await bundleBackend({
      backendId,
      outputPath: path.join(outputPath, 'resources'),
      includeData,
      platform: 'electron'
    });

    // Modify main.js to start backend
    const mainPath = path.join(outputPath, 'resources', 'app', 'main.js');
    const mainContent = await fs.readFile(mainPath, 'utf-8');

    const backendStartup = `
// Start local backend
const { backend } = require('./start-backend.js');
app.on('before-quit', () => {
  backend.kill();
});
`;

    await fs.writeFile(mainPath, backendStartup + mainContent);
  }
}
```

---

## Files to Create

### New Packages/Modules

```
packages/noodl-runtime/src/api/
├── adapters/
│   ├── index.ts
│   ├── cloudstore-adapter.ts        # Interface definition
│   ├── local-sql/
│   │   ├── LocalSQLAdapter.ts
│   │   ├── SQLiteConnection.ts
│   │   ├── QueryBuilder.ts
│   │   ├── SchemaManager.ts
│   │   └── types.ts
│   └── parse/
│       └── ParseAdapter.ts          # Refactored from existing

packages/noodl-editor/src/main/src/local-backend/
├── LocalBackendServer.ts
├── BackendManager.ts
├── WorkflowLoader.ts
└── types.ts

packages/noodl-editor/src/editor/src/
├── models/
│   └── BackendModel.ts
├── views/
│   ├── Launcher/
│   │   └── BackendManager/
│   │       ├── BackendList.tsx
│   │       ├── BackendCard.tsx
│   │       ├── CreateBackendDialog.tsx
│   │       └── BackendManager.module.scss
│   ├── BackendPanel/
│   │   ├── BackendPanel.tsx
│   │   ├── SchemaEditor.tsx
│   │   ├── ExportWizard.tsx
│   │   └── BackendPanel.module.scss
│   └── Migration/
│       ├── ParseMigrationWizard.tsx
│       └── ParseMigrationWizard.module.scss
└── utils/
    ├── workflow-compiler.ts
    └── deployment/
        ├── backend-bundler.ts
        └── electron-deployer.ts

packages/noodl-viewer-cloud/src/nodes/
├── database/
│   ├── local-query.ts
│   ├── local-insert.ts
│   ├── local-update.ts
│   └── local-delete.ts
└── triggers/
    ├── schedule.ts
    ├── db-change.ts
    └── webhook.ts
```

### Files to Modify

```
packages/noodl-runtime/src/api/cloudstore.js
  - Refactor to use adapter pattern

packages/noodl-editor/src/main/main.js
  - Initialize BackendManager
  - Setup IPC handlers

packages/noodl-editor/src/editor/src/views/Launcher/Launcher.tsx
  - Add backend management section

packages/noodl-viewer-cloud/src/index.ts
  - Register new database nodes
  - Register new trigger nodes

packages/noodl-viewer-cloud/src/nodes/index.ts
  - Export new nodes
```

---

## Testing Checklist

### LocalSQL Adapter ✅ COMPLETE (TASK-007A)

- [x] Query with all operator types (equalTo, greaterThan, contains, etc.)
- [x] Create/Save/Delete operations
- [x] Relation operations
- [x] Schema creation and migration
- [x] In-memory fallback when better-sqlite3 unavailable
- [ ] Concurrent access handling (needs real SQLite)
- [ ] Large dataset performance (needs real SQLite)

### Local Backend Server ✅ COMPLETE (TASK-007B)

- [x] REST endpoints respond correctly
- [x] Health check endpoint works
- [x] IPC handlers for create/start/stop/list
- [x] Server starts and responds on dynamic port
- [ ] WebSocket connections (basic structure, needs testing)
- [ ] Realtime events broadcast
- [ ] CloudRunner executes workflows (needs TASK-007C)
- [ ] Multiple backends can run simultaneously (needs testing)

### Editor Integration (Partial)

- [x] Backend status available via IPC
- [x] Start/Stop from DevTools works
- [ ] Backend status shows in UI (needs UI)
- [ ] Start/Stop from launcher works (needs UI)
- [ ] Project-backend association persists
- [ ] Workflow hot reload works (needs TASK-007C)

### Backward Compatibility

- [ ] Existing Parse projects load correctly
- [ ] Parse adapter still functions
- [ ] Migration wizard works
- [ ] No regressions in existing functionality

### Deployment

- [ ] Schema export to Postgres works
- [ ] Schema export to Supabase works
- [ ] Electron bundle includes backend
- [ ] Standalone backend runs independently

---

## Success Criteria

1. **Zero-config experience**: New users can build full-stack apps without any external setup
2. **Backward compatibility**: Existing Noodl Cloud users can import and continue their projects
3. **Same paradigm**: Backend workflows use the same visual node system as frontend
4. **Clear migration path**: Users can export schema/data to production backends
5. **Standalone deployment**: Apps can be deployed as self-contained packages with backend
6. **Future-proof**: Architecture supports adding new backend adapters (Supabase, PocketBase, etc.)

---

## Risks & Mitigations

### Risk: SQLite concurrency limitations

**Mitigation**: Use WAL mode, implement connection pooling, document limitations

### Risk: Parse query syntax gaps

**Mitigation**: Comprehensive query translation layer with fallback warnings

### Risk: Workflow runtime differences

**Mitigation**: Extensive testing, clear documentation of node compatibility

### Risk: Migration data loss

**Mitigation**: Backup prompts, rollback capability, staged migration

---

## Dependencies

**Blocked by:** None (can start immediately)

**Blocks:**

- Phase 5 external adapter implementations (Supabase, PocketBase)
- Future marketplace backend templates
- **Phase 11: Cloud Functions & Workflow Automation**

### Phase 11 Dependency Note

Phase 11 (Cloud Functions) depends on TASK-007 sub-tasks A, B, and C:

| This Sub-task                  | Phase 11 Needs                                        |
| ------------------------------ | ----------------------------------------------------- |
| **TASK-007A** (LocalSQL)       | CF11-004 reuses SQLite patterns for execution history |
| **TASK-007B** (Backend Server) | Execution APIs will be added to this server           |
| **TASK-007C** (CloudRunner)    | All Phase 11 workflow nodes require this runtime      |
| TASK-007D/E/F                  | Not blocking - can be done after Phase 11 starts      |

**Recommended sequencing:**

1. Complete TASK-007A, 007B, 007C first (~45h)
2. Start Phase 11 Series 1 & 2 (Advanced Nodes + Execution History)
3. Return to TASK-007D/E/F later OR continue Phase 11

See: [Phase 11 README](../../../../phase-11-cloud-functions/README.md) for full details.

---

## References

- Existing CloudStore: `packages/noodl-runtime/src/api/cloudstore.js`
- Cloud Runtime: `packages/noodl-viewer-cloud/src/`
- Cloud Function Server: `packages/noodl-editor/src/main/src/cloud-function-server.js`
- Parse Dashboard: `packages/noodl-parse-dashboard/`
