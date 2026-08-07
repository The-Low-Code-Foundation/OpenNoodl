# TASK-007B: Local Backend Server

## Overview

Implement an Express-based backend server that runs alongside the Nodegex editor, providing REST API endpoints, WebSocket realtime updates, and visual workflow execution via CloudRunner.

**Parent Task:** TASK-007 (Integrated Local Backend)
**Phase:** B (Backend Server)
**Effort:** 12-16 hours
**Priority:** HIGH
**Depends On:** TASK-007A (LocalSQL Adapter)

---

## Objectives

1. Create Express server with REST API for database operations
2. Implement WebSocket server for realtime change notifications
3. Integrate CloudRunner for visual workflow execution
4. Build BackendManager for lifecycle control
5. Set up IPC communication with editor renderer process
6. Support multiple simultaneous backend instances

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LocalBackendServer                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Express Application                           │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Middleware: CORS, JSON parsing, Error handling                      │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  Routes:                                                             │   │
│  │  ├── GET  /health              → Health check                        │   │
│  │  ├── GET  /api/_schema         → Get schema                          │   │
│  │  ├── POST /api/_schema         → Update schema                       │   │
│  │  ├── GET  /api/_export         → Export data                         │   │
│  │  ├── GET  /api/:table          → Query records                       │   │
│  │  ├── GET  /api/:table/:id      → Fetch single record                 │   │
│  │  ├── POST /api/:table          → Create record                       │   │
│  │  ├── PUT  /api/:table/:id      → Update record                       │   │
│  │  ├── DELETE /api/:table/:id    → Delete record                       │   │
│  │  ├── POST /api/_batch          → Batch operations                    │   │
│  │  └── POST /functions/:name     → Execute visual workflow             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        WebSocket Server                              │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  • Client subscription management                                    │   │
│  │  • Broadcast on adapter events (create/save/delete)                  │   │
│  │  • Per-collection filtering                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                          CloudRunner                                 │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  • Visual workflow execution                                         │   │
│  │  • Hot reload on workflow changes                                    │   │
│  │  • Access to LocalSQLAdapter                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        LocalSQLAdapter                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  • SQLite database operations                                        │   │
│  │  • Event emission for realtime                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Server Core (3 hours)

**File:** `packages/noodl-editor/src/main/src/local-backend/LocalBackendServer.ts`

```typescript
import express, { Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { LocalSQLAdapter } from '@noodl/runtime/src/api/adapters/local-sql/LocalSQLAdapter';
import { CloudRunner } from '@noodl/cloud-runtime';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface LocalBackendConfig {
  id: string;
  name: string;
  dbPath: string;
  port: number;
  workflowsPath: string;
}

export class LocalBackendServer {
  private app: Express;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private adapter: LocalSQLAdapter | null = null;
  private cloudRunner: CloudRunner | null = null;
  private clients = new Set<WebSocket>();
  private subscriptions = new Map<WebSocket, Set<string>>();

  constructor(private config: LocalBackendConfig) {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // JSON body parsing
    this.app.use(express.json({ limit: '10mb' }));

    // CORS for local development
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', '*');
      
      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }
      next();
    });

    // Request logging (development)
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[${this.config.name}] ${req.method} ${req.path}`);
      next();
    });

    // Error handling
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error(`[${this.config.name}] Error:`, err);
      res.status(500).json({ error: err.message });
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        backend: this.config.name,
        id: this.config.id,
        uptime: process.uptime()
      });
    });

    // Schema endpoints
    this.app.get('/api/_schema', this.handleGetSchema.bind(this));
    this.app.post('/api/_schema', this.handleUpdateSchema.bind(this));
    this.app.get('/api/_export', this.handleExport.bind(this));

    // Batch operations
    this.app.post('/api/_batch', this.handleBatch.bind(this));

    // Visual workflow functions
    this.app.post('/functions/:name', this.handleFunction.bind(this));

    // Generic CRUD routes (must be last due to :table param)
    this.app.get('/api/:table', this.handleQuery.bind(this));
    this.app.get('/api/:table/:id', this.handleFetch.bind(this));
    this.app.post('/api/:table', this.handleCreate.bind(this));
    this.app.put('/api/:table/:id', this.handleSave.bind(this));
    this.app.delete('/api/:table/:id', this.handleDelete.bind(this));
  }

  // Route Handlers

  private async handleGetSchema(req: Request, res: Response): Promise<void> {
    try {
      const schema = await this.adapter!.getSchema();
      res.json(schema);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  private async handleUpdateSchema(req: Request, res: Response): Promise<void> {
    try {
      const { table, column } = req.body;
      
      if (table && !column) {
        await this.adapter!.createTable(table);
      } else if (table && column) {
        await this.adapter!.addColumn(table.name, column);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private async handleExport(req: Request, res: Response): Promise<void> {
    try {
      const format = (req.query.format as string) || 'json';
      const includeData = req.query.includeData === 'true';

      let result = '';

      if (format === 'postgres' || format === 'supabase') {
        result = await this.adapter!.exportToSQL('postgres');
        if (format === 'supabase') {
          // Add RLS policies
          const schema = await this.adapter!.getSchema();
          for (const table of schema.tables) {
            result += `\n\nALTER TABLE "${table.name}" ENABLE ROW LEVEL SECURITY;`;
          }
        }
      } else {
        result = JSON.stringify(await this.adapter!.getSchema(), null, 2);
      }

      if (includeData) {
        const data = await this.adapter!.exportData(format === 'json' ? 'json' : 'sql');
        result += '\n\n-- DATA\n' + data;
      }

      res.type(format === 'json' ? 'application/json' : 'text/plain').send(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  private async handleQuery(req: Request, res: Response): Promise<void> {
    try {
      const { table } = req.params;
      const { where, sort, limit, skip, count } = req.query;

      const result = await this.adapter!.query({
        collection: table,
        where: where ? JSON.parse(where as string) : undefined,
        sort: sort ? JSON.parse(sort as string) : undefined,
        limit: limit ? parseInt(limit as string) : 100,
        skip: skip ? parseInt(skip as string) : 0,
        count: count === 'true'
      });

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private async handleFetch(req: Request, res: Response): Promise<void> {
    try {
      const { table, id } = req.params;
      const record = await this.adapter!.fetch({
        collection: table,
        objectId: id
      });
      res.json(record);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }

  private async handleCreate(req: Request, res: Response): Promise<void> {
    try {
      const { table } = req.params;
      const record = await this.adapter!.create({
        collection: table,
        data: req.body
      });
      res.status(201).json(record);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private async handleSave(req: Request, res: Response): Promise<void> {
    try {
      const { table, id } = req.params;
      const record = await this.adapter!.save({
        collection: table,
        objectId: id,
        data: req.body
      });
      res.json(record);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private async handleDelete(req: Request, res: Response): Promise<void> {
    try {
      const { table, id } = req.params;
      await this.adapter!.delete({
        collection: table,
        objectId: id
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private async handleBatch(req: Request, res: Response): Promise<void> {
    try {
      const { requests } = req.body;
      const results: any[] = [];

      for (const request of requests) {
        const { method, path: reqPath, body } = request;
        const [, , table, id] = reqPath.split('/');

        switch (method.toUpperCase()) {
          case 'POST':
            results.push(await this.adapter!.create({ collection: table, data: body }));
            break;
          case 'PUT':
            results.push(await this.adapter!.save({ collection: table, objectId: id, data: body }));
            break;
          case 'DELETE':
            await this.adapter!.delete({ collection: table, objectId: id });
            results.push({ success: true });
            break;
          default:
            results.push({ error: `Unknown method: ${method}` });
        }
      }

      res.json({ results });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  private async handleFunction(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      if (!this.cloudRunner) {
        throw new Error('CloudRunner not initialized');
      }

      const result = await this.cloudRunner.run(name, {
        body: JSON.stringify(req.body),
        headers: req.headers as Record<string, string>
      });

      res
        .status(result.statusCode)
        .type('application/json')
        .send(result.body);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  // WebSocket handling

  private setupWebSocket(): void {
    this.wss = new WebSocketServer({ server: this.server! });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log(`[${this.config.name}] WebSocket client connected`);
      this.clients.add(ws);
      this.subscriptions.set(ws, new Set());

      ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleWebSocketMessage(ws, msg);
        } catch (e) {
          // Ignore invalid messages
        }
      });

      ws.on('close', () => {
        console.log(`[${this.config.name}] WebSocket client disconnected`);
        this.clients.delete(ws);
        this.subscriptions.delete(ws);
      });

      ws.on('error', (err) => {
        console.error(`[${this.config.name}] WebSocket error:`, err);
      });
    });
  }

  private handleWebSocketMessage(ws: WebSocket, msg: any): void {
    const subs = this.subscriptions.get(ws);
    if (!subs) return;

    switch (msg.type) {
      case 'subscribe':
        subs.add(msg.collection);
        ws.send(JSON.stringify({
          type: 'subscribed',
          collection: msg.collection
        }));
        break;

      case 'unsubscribe':
        subs.delete(msg.collection);
        ws.send(JSON.stringify({
          type: 'unsubscribed',
          collection: msg.collection
        }));
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }

  private broadcast(event: string, data: any): void {
    const message = JSON.stringify({
      event,
      data,
      timestamp: Date.now()
    });

    for (const client of this.clients) {
      if (client.readyState !== WebSocket.OPEN) continue;

      const subs = this.subscriptions.get(client);
      // Broadcast if no subscriptions (all) or subscribed to this collection
      if (!subs?.size || subs.has(data.collection)) {
        client.send(message);
      }
    }
  }

  // Lifecycle

  async start(): Promise<void> {
    // Initialize database adapter
    this.adapter = new LocalSQLAdapter(this.config.dbPath);
    await this.adapter.connect();

    // Subscribe to adapter events for realtime
    this.adapter.on('create', (e) => this.broadcast('create', e));
    this.adapter.on('save', (e) => this.broadcast('save', e));
    this.adapter.on('delete', (e) => this.broadcast('delete', e));

    // Initialize CloudRunner
    await this.initializeCloudRunner();

    // Start HTTP server
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        console.log(`[${this.config.name}] Backend running on port ${this.config.port}`);
        
        // Start WebSocket server
        this.setupWebSocket();
        
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    // Close all WebSocket connections
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    this.subscriptions.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    // Disconnect database
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
    }

    console.log(`[${this.config.name}] Backend stopped`);
  }

  private async initializeCloudRunner(): Promise<void> {
    this.cloudRunner = new CloudRunner({
      // No editor connection for standalone backend
    });

    // Inject local adapter into runtime context
    (this.cloudRunner as any).runtime.context.getLocalAdapter = () => this.adapter;

    // Load workflows
    await this.loadWorkflows();
  }

  async loadWorkflows(): Promise<void> {
    if (!this.cloudRunner) return;

    try {
      const files = await fs.readdir(this.config.workflowsPath);
      
      for (const file of files) {
        if (!file.endsWith('.workflow.json')) continue;

        const content = await fs.readFile(
          path.join(this.config.workflowsPath, file),
          'utf-8'
        );
        
        const workflow = JSON.parse(content);
        await this.cloudRunner.load(workflow);
        
        console.log(`[${this.config.name}] Loaded workflow: ${file}`);
      }
    } catch (e) {
      // No workflows directory yet, that's fine
    }
  }

  async reloadWorkflows(): Promise<void> {
    // Re-initialize CloudRunner to reload all workflows
    await this.initializeCloudRunner();
  }

  getPort(): number {
    return this.config.port;
  }

  isRunning(): boolean {
    return this.server !== null;
  }
}
```

---

### Step 2: Implement Backend Manager (3 hours)

**File:** `packages/noodl-editor/src/main/src/local-backend/BackendManager.ts`

```typescript
import { ipcMain, app } from 'electron';
import { LocalBackendServer, LocalBackendConfig } from './LocalBackendServer';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as net from 'net';

export interface BackendMetadata {
  id: string;
  name: string;
  createdAt: string;
  port: number;
  projectIds: string[];
}

export class BackendManager {
  private static instance: BackendManager;
  private backends = new Map<string, LocalBackendServer>();
  private backendsPath: string;
  private initialized = false;

  static getInstance(): BackendManager {
    if (!this.instance) {
      this.instance = new BackendManager();
    }
    return this.instance;
  }

  private constructor() {
    this.backendsPath = path.join(
      app.getPath('home'),
      '.noodl',
      'backends'
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure backends directory exists
    await fs.mkdir(this.backendsPath, { recursive: true });

    // Set up IPC handlers
    this.setupIPC();

    this.initialized = true;
    console.log('[BackendManager] Initialized');
  }

  private setupIPC(): void {
    // List all backends
    ipcMain.handle('backend:list', async () => {
      return this.listBackends();
    });

    // Create new backend
    ipcMain.handle('backend:create', async (_, name: string) => {
      return this.createBackend(name);
    });

    // Delete backend
    ipcMain.handle('backend:delete', async (_, id: string) => {
      return this.deleteBackend(id);
    });

    // Start backend
    ipcMain.handle('backend:start', async (_, id: string) => {
      return this.startBackend(id);
    });

    // Stop backend
    ipcMain.handle('backend:stop', async (_, id: string) => {
      return this.stopBackend(id);
    });

    // Get backend status
    ipcMain.handle('backend:status', async (_, id: string) => {
      return this.getStatus(id);
    });

    // Export schema
    ipcMain.handle('backend:export-schema', async (_, id: string, format: string) => {
      return this.exportSchema(id, format);
    });

    // Export data
    ipcMain.handle('backend:export-data', async (_, id: string, format: string) => {
      return this.exportData(id, format);
    });

    // Update workflow
    ipcMain.handle('backend:update-workflow', async (_, params: {
      backendId: string;
      name: string;
      workflow: any;
    }) => {
      return this.updateWorkflow(params.backendId, params.name, params.workflow);
    });

    // Reload workflows
    ipcMain.handle('backend:reload-workflows', async (_, id: string) => {
      return this.reloadWorkflows(id);
    });

    // Import Parse schema
    ipcMain.handle('backend:import-parse-schema', async (_, params: {
      backendId: string;
      schema: any;
    }) => {
      return this.importParseSchema(params.backendId, params.schema);
    });

    // Import records
    ipcMain.handle('backend:import-records', async (_, params: {
      backendId: string;
      collection: string;
      records: any[];
    }) => {
      return this.importRecords(params.backendId, params.collection, params.records);
    });
  }

  // Backend Operations

  async listBackends(): Promise<BackendMetadata[]> {
    const entries = await fs.readdir(this.backendsPath, { withFileTypes: true });
    const backends: BackendMetadata[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      try {
        const configPath = path.join(this.backendsPath, entry.name, 'config.json');
        const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
        backends.push(config);
      } catch (e) {
        // Invalid backend directory, skip
      }
    }

    return backends.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createBackend(name: string): Promise<BackendMetadata> {
    const id = this.generateId();
    const backendPath = path.join(this.backendsPath, id);

    // Create directory structure
    await fs.mkdir(backendPath, { recursive: true });
    await fs.mkdir(path.join(backendPath, 'data'));
    await fs.mkdir(path.join(backendPath, 'workflows'));

    // Find available port
    const port = await this.findAvailablePort();

    // Create config
    const metadata: BackendMetadata = {
      id,
      name,
      createdAt: new Date().toISOString(),
      port,
      projectIds: []
    };

    await fs.writeFile(
      path.join(backendPath, 'config.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Create empty schema
    await fs.writeFile(
      path.join(backendPath, 'schema.json'),
      JSON.stringify({ version: 1, tables: [] }, null, 2)
    );

    console.log(`[BackendManager] Created backend: ${name} (${id})`);
    return metadata;
  }

  async deleteBackend(id: string): Promise<void> {
    // Stop if running
    await this.stopBackend(id);

    // Delete directory
    const backendPath = path.join(this.backendsPath, id);
    await fs.rm(backendPath, { recursive: true, force: true });

    console.log(`[BackendManager] Deleted backend: ${id}`);
  }

  async startBackend(id: string): Promise<void> {
    if (this.backends.has(id)) {
      return; // Already running
    }

    const backendPath = path.join(this.backendsPath, id);
    const config: BackendMetadata = JSON.parse(
      await fs.readFile(path.join(backendPath, 'config.json'), 'utf-8')
    );

    // Check if port is available, find new one if not
    const portAvailable = await this.isPortAvailable(config.port);
    if (!portAvailable) {
      config.port = await this.findAvailablePort();
      await fs.writeFile(
        path.join(backendPath, 'config.json'),
        JSON.stringify(config, null, 2)
      );
    }

    const server = new LocalBackendServer({
      id,
      name: config.name,
      dbPath: path.join(backendPath, 'data', 'local.db'),
      port: config.port,
      workflowsPath: path.join(backendPath, 'workflows')
    });

    await server.start();
    this.backends.set(id, server);

    console.log(`[BackendManager] Started backend: ${config.name} on port ${config.port}`);
  }

  async stopBackend(id: string): Promise<void> {
    const server = this.backends.get(id);
    if (server) {
      await server.stop();
      this.backends.delete(id);
      console.log(`[BackendManager] Stopped backend: ${id}`);
    }
  }

  getStatus(id: string): { running: boolean; port?: number } {
    const server = this.backends.get(id);
    if (server && server.isRunning()) {
      return { running: true, port: server.getPort() };
    }
    return { running: false };
  }

  async stopAll(): Promise<void> {
    for (const [id, server] of this.backends) {
      await server.stop();
    }
    this.backends.clear();
    console.log('[BackendManager] Stopped all backends');
  }

  // Export Operations

  async exportSchema(id: string, format: string): Promise<string> {
    const server = this.backends.get(id);
    if (!server) {
      throw new Error('Backend must be running to export schema');
    }

    // Access adapter through server (would need to expose this)
    const adapter = (server as any).adapter;
    
    switch (format) {
      case 'postgres':
        return adapter.exportToSQL('postgres');
      case 'supabase':
        let sql = await adapter.exportToSQL('postgres');
        const schema = await adapter.getSchema();
        for (const table of schema.tables) {
          sql += `\n\nALTER TABLE "${table.name}" ENABLE ROW LEVEL SECURITY;`;
        }
        return sql;
      case 'json':
        return JSON.stringify(await adapter.getSchema(), null, 2);
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  async exportData(id: string, format: string): Promise<string> {
    const server = this.backends.get(id);
    if (!server) {
      throw new Error('Backend must be running to export data');
    }

    const adapter = (server as any).adapter;
    return adapter.exportData(format === 'json' ? 'json' : 'sql');
  }

  // Workflow Operations

  async updateWorkflow(backendId: string, name: string, workflow: any): Promise<void> {
    const backendPath = path.join(this.backendsPath, backendId);
    const workflowPath = path.join(backendPath, 'workflows', `${name}.workflow.json`);

    await fs.writeFile(workflowPath, JSON.stringify(workflow, null, 2));
    console.log(`[BackendManager] Updated workflow: ${name}`);
  }

  async reloadWorkflows(id: string): Promise<void> {
    const server = this.backends.get(id);
    if (server) {
      await server.reloadWorkflows();
    }
  }

  // Import Operations

  async importParseSchema(backendId: string, parseSchema: any[]): Promise<void> {
    const server = this.backends.get(backendId);
    if (!server) {
      throw new Error('Backend must be running to import schema');
    }

    const adapter = (server as any).adapter;

    for (const cls of parseSchema) {
      const columns = [];
      
      for (const [fieldName, fieldDef] of Object.entries(cls.fields || {})) {
        if (['objectId', 'createdAt', 'updatedAt', 'ACL'].includes(fieldName)) continue;

        const fd = fieldDef as any;
        columns.push({
          name: fieldName,
          type: this.parseTypeToNoodlType(fd.type),
          required: fd.required || false,
          targetClass: fd.targetClass
        });
      }

      await adapter.createTable({
        name: cls.className,
        columns
      });
    }
  }

  async importRecords(backendId: string, collection: string, records: any[]): Promise<void> {
    const server = this.backends.get(backendId);
    if (!server) {
      throw new Error('Backend must be running to import records');
    }

    const adapter = (server as any).adapter;

    for (const record of records) {
      // Clean up Parse-specific fields
      const data = { ...record };
      delete data.ACL;
      delete data.__type;
      delete data.className;

      // Convert pointers
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && (value as any).__type === 'Pointer') {
          data[key] = (value as any).objectId;
        }
      }

      await adapter.create({ collection, data });
    }
  }

  // Helper methods

  private generateId(): string {
    return 'backend-' + Math.random().toString(36).substring(2, 15);
  }

  private async findAvailablePort(): Promise<number> {
    const existingBackends = await this.listBackends();
    const usedPorts = new Set(existingBackends.map(b => b.port));

    // Start from 8577 and find next available
    let port = 8577;
    while (usedPorts.has(port) || !(await this.isPortAvailable(port))) {
      port++;
      if (port > 9000) {
        throw new Error('No available ports found');
      }
    }
    return port;
  }

  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', () => {
        resolve(false);
      });
      
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      
      server.listen(port, '127.0.0.1');
    });
  }

  private parseTypeToNoodlType(parseType: string): string {
    switch (parseType) {
      case 'String': return 'String';
      case 'Number': return 'Number';
      case 'Boolean': return 'Boolean';
      case 'Date': return 'Date';
      case 'Object': return 'Object';
      case 'Array': return 'Array';
      case 'Pointer': return 'Pointer';
      case 'Relation': return 'Relation';
      case 'File': return 'File';
      case 'GeoPoint': return 'GeoPoint';
      default: return 'String';
    }
  }
}
```

---

### Step 3: Wire into Main Process (2 hours)

**File:** `packages/noodl-editor/src/main/main.js` (modifications)

```javascript
// Add import at top
const { BackendManager } = require('./src/local-backend/BackendManager');

// In launchApp() function, after app is ready:
async function launchApp() {
  // ... existing code ...

  // Initialize BackendManager
  const backendManager = BackendManager.getInstance();
  await backendManager.initialize();

  // Stop all backends when app quits
  app.on('before-quit', async () => {
    await backendManager.stopAll();
  });

  // ... rest of existing code ...
}
```

---

### Step 4: Create Type Definitions (1 hour)

**File:** `packages/noodl-editor/src/main/src/local-backend/types.ts`

```typescript
export interface BackendConfig {
  id: string;
  name: string;
  dbPath: string;
  port: number;
  workflowsPath: string;
}

export interface BackendMetadata {
  id: string;
  name: string;
  createdAt: string;
  port: number;
  projectIds: string[];
}

export interface BackendStatus {
  running: boolean;
  port?: number;
  uptime?: number;
  error?: string;
}

export interface WorkflowDefinition {
  name: string;
  components: any;
  metadata?: any;
}

// IPC Channel types for type-safe communication
export interface BackendIPCChannels {
  'backend:list': () => Promise<BackendMetadata[]>;
  'backend:create': (name: string) => Promise<BackendMetadata>;
  'backend:delete': (id: string) => Promise<void>;
  'backend:start': (id: string) => Promise<void>;
  'backend:stop': (id: string) => Promise<void>;
  'backend:status': (id: string) => Promise<BackendStatus>;
  'backend:export-schema': (id: string, format: string) => Promise<string>;
  'backend:export-data': (id: string, format: string) => Promise<string>;
  'backend:update-workflow': (params: {
    backendId: string;
    name: string;
    workflow: WorkflowDefinition;
  }) => Promise<void>;
  'backend:reload-workflows': (id: string) => Promise<void>;
}
```

**File:** `packages/noodl-editor/src/main/src/local-backend/index.ts`

```typescript
export { LocalBackendServer } from './LocalBackendServer';
export { BackendManager } from './BackendManager';
export * from './types';
```

---

### Step 5: Add Editor Preload Bindings (2 hours)

**File:** `packages/noodl-editor/src/main/src/preload.ts` (modifications)

```typescript
// Add to contextBridge.exposeInMainWorld

const electronAPI = {
  // ... existing methods ...

  // Backend IPC
  backend: {
    list: () => ipcRenderer.invoke('backend:list'),
    create: (name: string) => ipcRenderer.invoke('backend:create', name),
    delete: (id: string) => ipcRenderer.invoke('backend:delete', id),
    start: (id: string) => ipcRenderer.invoke('backend:start', id),
    stop: (id: string) => ipcRenderer.invoke('backend:stop', id),
    status: (id: string) => ipcRenderer.invoke('backend:status', id),
    exportSchema: (id: string, format: string) => 
      ipcRenderer.invoke('backend:export-schema', id, format),
    exportData: (id: string, format: string) => 
      ipcRenderer.invoke('backend:export-data', id, format),
    updateWorkflow: (params: any) => 
      ipcRenderer.invoke('backend:update-workflow', params),
    reloadWorkflows: (id: string) => 
      ipcRenderer.invoke('backend:reload-workflows', id),
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
```

**File:** `packages/noodl-editor/src/shared/types/electron.d.ts` (new or modifications)

```typescript
interface ElectronAPI {
  // ... existing ...

  backend: {
    list(): Promise<BackendMetadata[]>;
    create(name: string): Promise<BackendMetadata>;
    delete(id: string): Promise<void>;
    start(id: string): Promise<void>;
    stop(id: string): Promise<void>;
    status(id: string): Promise<{ running: boolean; port?: number }>;
    exportSchema(id: string, format: string): Promise<string>;
    exportData(id: string, format: string): Promise<string>;
    updateWorkflow(params: {
      backendId: string;
      name: string;
      workflow: any;
    }): Promise<void>;
    reloadWorkflows(id: string): Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

---

## Files to Create

```
packages/noodl-editor/src/main/src/local-backend/
├── LocalBackendServer.ts
├── BackendManager.ts
├── types.ts
└── index.ts
```

## Files to Modify

```
packages/noodl-editor/src/main/main.js
  - Initialize BackendManager
  - Stop backends on app quit

packages/noodl-editor/src/main/src/preload.ts
  - Add backend IPC bindings

packages/noodl-editor/package.json
  - Add ws dependency (if not present)
```

---

## Testing Checklist

### Server Lifecycle
- [ ] Backend starts successfully
- [ ] Backend stops cleanly
- [ ] Multiple backends can run simultaneously
- [ ] Port conflicts are handled gracefully
- [ ] Backends restart after crash

### REST API
- [ ] Health check returns correct info
- [ ] Query endpoint with all parameters
- [ ] Fetch single record
- [ ] Create record
- [ ] Update record
- [ ] Delete record
- [ ] Batch operations work
- [ ] Schema export works
- [ ] Data export works

### WebSocket
- [ ] Clients can connect
- [ ] Subscribe to collections
- [ ] Unsubscribe from collections
- [ ] Receive create events
- [ ] Receive update events
- [ ] Receive delete events
- [ ] Multiple clients work
- [ ] Disconnection cleanup

### CloudRunner Integration
- [ ] Workflows load from disk
- [ ] Workflow execution works
- [ ] Hot reload works
- [ ] Error handling

### IPC Communication
- [ ] All handlers registered
- [ ] List backends works
- [ ] Create backend works
- [ ] Delete backend works
- [ ] Start/stop works
- [ ] Status returns correctly

---

## Success Criteria

1. Backend server starts in <2 seconds
2. REST API handles 100 requests/second
3. WebSocket broadcasts to 100 clients in <50ms
4. No memory leaks over 24-hour runtime
5. Clean shutdown without data loss
6. IPC commands respond in <100ms

---

## Dependencies

**NPM packages:**
- `express` (likely already present)
- `ws` - WebSocket server

**Internal:**
- TASK-007A (LocalSQLAdapter)
- `@noodl/cloud-runtime` (CloudRunner)

**Blocks:** 
- TASK-007C (Workflow Runtime)
- TASK-007D (Launcher Integration)

---

## Estimated Session Breakdown

| Session | Focus | Hours |
|---------|-------|-------|
| 1 | Server core + REST routes | 4 |
| 2 | WebSocket + realtime | 3 |
| 3 | BackendManager + IPC | 4 |
| 4 | Integration + testing | 3 |
| **Total** | | **14** |
