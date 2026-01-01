# TASK-007F: Standalone Deployment

## Overview

Implement the ability to bundle the local backend with deployed applications, enabling self-contained Electron apps that include their own database and workflow execution without requiring external services.

**Parent Task:** TASK-007 (Integrated Local Backend)
**Phase:** F (Standalone Deployment)
**Effort:** 8-10 hours
**Priority:** MEDIUM
**Depends On:** TASK-007A, TASK-007B, TASK-007C

---

## Objectives

1. Create backend bundler that packages server + database for distribution
2. Integrate bundled backend into Electron deployment workflow
3. Implement backend startup from packaged app
4. Support optional data inclusion in bundles
5. Handle backend updates and migrations in deployed apps

---

## Architecture

### Bundled App Structure

```
MyApp.app/                          # macOS
├── Contents/
│   ├── MacOS/
│   │   └── MyApp                   # Main Electron executable
│   └── Resources/
│       ├── app/                    # Frontend bundle
│       │   ├── index.html
│       │   ├── main.js
│       │   └── viewer/
│       └── backend/                # ← NEW: Bundled backend
│           ├── server.bundle.js    # Compiled Express server
│           ├── schema.json         # Database schema
│           ├── workflows/          # Compiled visual workflows
│           │   └── *.workflow.json
│           ├── data.db            # Optional: Seed data
│           └── package.json

MyApp/                              # Windows
├── MyApp.exe
├── resources/
│   ├── app/
│   └── backend/                    # Same structure
```

### Runtime Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Electron Main Process                            │
│                                                                             │
│  app.on('ready') ──────┐                                                    │
│                        ↓                                                    │
│           ┌────────────────────────┐                                        │
│           │ Check for bundled      │                                        │
│           │ backend in resources/  │                                        │
│           └───────────┬────────────┘                                        │
│                       │                                                     │
│              Has backend?                                                   │
│              ↓        ↓                                                     │
│            Yes        No                                                    │
│              │         └──→ Continue normal startup                         │
│              ↓                                                              │
│  ┌──────────────────────────┐                                               │
│  │ Fork backend process     │                                               │
│  │ with environment config  │                                               │
│  └────────────┬─────────────┘                                               │
│               ↓                                                             │
│  ┌──────────────────────────┐     ┌─────────────────────────────────────┐  │
│  │ Backend Child Process    │     │ Renderer Process                    │  │
│  │ ┌──────────────────────┐ │     │ ┌─────────────────────────────────┐ │  │
│  │ │ Express Server       │ │ ←──→│ │ Noodl Viewer                    │ │  │
│  │ │ - REST API           │ │HTTP │ │ - CloudStore → LocalHTTPAdapter │ │  │
│  │ │ - WebSocket          │ │ WS  │ │ - Data nodes fetch from backend │ │  │
│  │ │ - CloudRunner        │ │     │ └─────────────────────────────────┘ │  │
│  │ └──────────────────────┘ │     └─────────────────────────────────────┘  │
│  │ SQLite: userData/data.db │                                               │
│  └──────────────────────────┘                                               │
│                                                                             │
│  app.on('before-quit') ──→ Kill backend process                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Backend Bundler (3 hours)

**File:** `packages/noodl-editor/src/editor/src/utils/deployment/backend-bundler.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

export interface BundleOptions {
  backendId: string;
  outputPath: string;
  includeData: boolean;
  platform: 'darwin' | 'win32' | 'linux';
}

export interface BundleResult {
  success: boolean;
  outputPath: string;
  size: number;
  error?: string;
}

export async function bundleBackend(options: BundleOptions): Promise<BundleResult> {
  const { backendId, outputPath, includeData, platform } = options;

  try {
    // Get backend path
    const backendsPath = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.noodl',
      'backends',
      backendId
    );

    // Create output directory
    const backendOutputPath = path.join(outputPath, 'backend');
    await fs.mkdir(backendOutputPath, { recursive: true });

    // 1. Copy pre-compiled server bundle
    const serverBundlePath = getServerBundlePath();
    await fs.copyFile(
      serverBundlePath,
      path.join(backendOutputPath, 'server.bundle.js')
    );

    // 2. Copy schema
    await fs.copyFile(
      path.join(backendsPath, 'schema.json'),
      path.join(backendOutputPath, 'schema.json')
    );

    // 3. Copy workflows
    const workflowsPath = path.join(backendsPath, 'workflows');
    const workflowsOutputPath = path.join(backendOutputPath, 'workflows');
    await fs.mkdir(workflowsOutputPath, { recursive: true });
    
    try {
      const workflows = await fs.readdir(workflowsPath);
      for (const workflow of workflows) {
        if (workflow.endsWith('.workflow.json')) {
          await fs.copyFile(
            path.join(workflowsPath, workflow),
            path.join(workflowsOutputPath, workflow)
          );
        }
      }
    } catch (e) {
      // No workflows directory, that's fine
    }

    // 4. Optionally copy seed data
    if (includeData) {
      const dbPath = path.join(backendsPath, 'data', 'local.db');
      try {
        await fs.access(dbPath);
        await fs.copyFile(
          dbPath,
          path.join(backendOutputPath, 'seed-data.db')
        );
      } catch (e) {
        // No data file, that's fine
      }
    }

    // 5. Generate package.json for the bundle
    const packageJson = {
      name: 'nodegex-backend-bundle',
      version: '1.0.0',
      main: 'server.bundle.js',
      private: true
    };
    
    await fs.writeFile(
      path.join(backendOutputPath, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // 6. Generate backend config
    const backendConfig = {
      version: 1,
      bundledAt: new Date().toISOString(),
      hasWorkflows: (await fs.readdir(workflowsOutputPath).catch(() => [])).length > 0,
      hasSeedData: includeData
    };

    await fs.writeFile(
      path.join(backendOutputPath, 'config.json'),
      JSON.stringify(backendConfig, null, 2)
    );

    // Calculate total size
    const size = await getDirectorySize(backendOutputPath);

    return {
      success: true,
      outputPath: backendOutputPath,
      size
    };
  } catch (error: any) {
    return {
      success: false,
      outputPath: '',
      size: 0,
      error: error.message
    };
  }
}

function getServerBundlePath(): string {
  // In production, this would be in the app resources
  // During development, it's in the build output
  const possiblePaths = [
    path.join(__dirname, '..', '..', '..', 'resources', 'local-backend', 'server.bundle.js'),
    path.join(process.resourcesPath || '', 'local-backend', 'server.bundle.js'),
    path.join(__dirname, '..', '..', '..', 'build', 'local-backend', 'server.bundle.js')
  ];

  for (const p of possiblePaths) {
    try {
      require.resolve(p);
      return p;
    } catch (e) {
      // Try next path
    }
  }

  throw new Error('Server bundle not found. Run build:backend first.');
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let size = 0;
  const files = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dirPath, file.name);
    if (file.isDirectory()) {
      size += await getDirectorySize(filePath);
    } else {
      const stat = await fs.stat(filePath);
      size += stat.size;
    }
  }
  
  return size;
}
```

---

### Step 2: Server Bundle Build Script (2 hours)

**File:** `packages/noodl-editor/scripts/build-backend-bundle.js`

```javascript
const webpack = require('webpack');
const path = require('path');
const fs = require('fs');

const config = {
  mode: 'production',
  target: 'node',
  entry: path.resolve(__dirname, '../src/main/src/local-backend/standalone-server.ts'),
  output: {
    path: path.resolve(__dirname, '../build/local-backend'),
    filename: 'server.bundle.js',
    libraryTarget: 'commonjs2'
  },
  resolve: {
    extensions: ['.ts', '.js', '.json']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  externals: {
    // better-sqlite3 must be external - it has native bindings
    'better-sqlite3': 'commonjs better-sqlite3'
  },
  optimization: {
    minimize: true
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.STANDALONE': JSON.stringify(true)
    })
  ]
};

console.log('Building backend bundle...');

webpack(config, (err, stats) => {
  if (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }

  if (stats.hasErrors()) {
    console.error('Build errors:', stats.toJson().errors);
    process.exit(1);
  }

  console.log('Backend bundle built successfully!');
  console.log(`Output: ${config.output.path}/${config.output.filename}`);
  
  // Also copy the native better-sqlite3 bindings
  copyNativeModules();
});

function copyNativeModules() {
  const sqliteSource = require.resolve('better-sqlite3');
  const sqliteDir = path.dirname(sqliteSource);
  const bindingDir = path.join(sqliteDir, '..', 'build', 'Release');
  const outputDir = path.join(config.output.path, 'native');

  if (fs.existsSync(bindingDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    
    const files = fs.readdirSync(bindingDir);
    for (const file of files) {
      if (file.endsWith('.node')) {
        fs.copyFileSync(
          path.join(bindingDir, file),
          path.join(outputDir, file)
        );
        console.log(`Copied native module: ${file}`);
      }
    }
  }
}
```

**File:** `packages/noodl-editor/src/main/src/local-backend/standalone-server.ts`

```typescript
/**
 * Standalone backend server for bundled Electron apps.
 * This is compiled into a single bundle for distribution.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs';

// Import adapter and runtime
import { LocalSQLAdapter } from '@noodl/runtime/src/api/adapters/local-sql/LocalSQLAdapter';
import { LocalCloudRunner } from '@noodl/cloud-runtime/src/LocalCloudRunner';

const app: Express = express();
let server: http.Server;
let wss: WebSocketServer;
let adapter: LocalSQLAdapter;
let cloudRunner: LocalCloudRunner;
const clients = new Set<WebSocket>();

// Configuration from environment
const PORT = parseInt(process.env.PORT || '8577', 10);
const DB_PATH = process.env.DB_PATH || './data.db';
const WORKFLOWS_PATH = process.env.WORKFLOWS_PATH || './workflows';
const SCHEMA_PATH = process.env.SCHEMA_PATH || './schema.json';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', standalone: true, uptime: process.uptime() });
});

app.get('/api/_schema', async (req, res) => {
  try {
    const schema = await adapter.getSchema();
    res.json(schema);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { where, sort, limit, skip, count } = req.query;

    const result = await adapter.query({
      collection: table,
      where: where ? JSON.parse(where as string) : undefined,
      sort: sort ? JSON.parse(sort as string) : undefined,
      limit: limit ? parseInt(limit as string) : 100,
      skip: skip ? parseInt(skip as string) : 0,
      count: count === 'true'
    });

    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const record = await adapter.fetch({ collection: table, objectId: id });
    res.json(record);
  } catch (e: any) {
    res.status(404).json({ error: e.message });
  }
});

app.post('/api/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const record = await adapter.create({ collection: table, data: req.body });
    broadcast('create', { collection: table, object: record });
    res.status(201).json(record);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const record = await adapter.save({ collection: table, objectId: id, data: req.body });
    broadcast('save', { collection: table, objectId: id, object: record });
    res.json(record);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    await adapter.delete({ collection: table, objectId: id });
    broadcast('delete', { collection: table, objectId: id });
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/functions/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await cloudRunner.run(name, {
      body: JSON.stringify(req.body),
      headers: req.headers as Record<string, string>
    });
    res.status(result.statusCode).type('application/json').send(result.body);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// WebSocket
function setupWebSocket() {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);
    
    ws.on('close', () => {
      clients.delete(ws);
    });
  });
}

function broadcast(event: string, data: any) {
  const message = JSON.stringify({ event, data, timestamp: Date.now() });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Startup
async function start() {
  console.log('[Backend] Starting standalone server...');

  // Ensure data directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Initialize database
  adapter = new LocalSQLAdapter(DB_PATH);
  await adapter.connect();
  console.log(`[Backend] Database connected: ${DB_PATH}`);

  // Load schema if exists
  if (fs.existsSync(SCHEMA_PATH)) {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));
    for (const table of schema.tables || []) {
      await adapter.createTable(table);
    }
    console.log('[Backend] Schema loaded');
  }

  // Initialize CloudRunner
  cloudRunner = new LocalCloudRunner({ adapter });

  // Load workflows
  if (fs.existsSync(WORKFLOWS_PATH)) {
    const files = fs.readdirSync(WORKFLOWS_PATH);
    for (const file of files) {
      if (file.endsWith('.workflow.json')) {
        const content = fs.readFileSync(path.join(WORKFLOWS_PATH, file), 'utf-8');
        await cloudRunner.load(JSON.parse(content));
        console.log(`[Backend] Loaded workflow: ${file}`);
      }
    }
  }

  // Start server
  server = app.listen(PORT, () => {
    console.log(`[Backend] Server running on port ${PORT}`);
  });

  setupWebSocket();

  // Handle shutdown
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Signal ready to parent process
  if (process.send) {
    process.send({ type: 'ready', port: PORT });
  }
}

async function shutdown() {
  console.log('[Backend] Shutting down...');
  
  for (const client of clients) {
    client.close();
  }
  clients.clear();

  if (wss) wss.close();
  if (server) server.close();
  if (adapter) await adapter.disconnect();

  process.exit(0);
}

start().catch((err) => {
  console.error('[Backend] Failed to start:', err);
  process.exit(1);
});
```

---

### Step 3: Electron Integration (2 hours)

**File:** `packages/noodl-editor/src/editor/src/utils/deployment/electron-backend-launcher.ts`

```typescript
/**
 * Launches the bundled backend when running as a packaged Electron app.
 * This code runs in the Electron main process.
 */

import { fork, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

let backendProcess: ChildProcess | null = null;
let backendPort: number | null = null;

export interface BackendLaunchResult {
  success: boolean;
  port?: number;
  error?: string;
}

/**
 * Check if bundled backend exists in app resources
 */
export function hasBundledBackend(): boolean {
  const backendPath = getBundledBackendPath();
  return backendPath !== null;
}

/**
 * Get path to bundled backend, or null if not present
 */
function getBundledBackendPath(): string | null {
  const possiblePaths = [
    // Production: inside app resources
    path.join(process.resourcesPath || '', 'backend', 'server.bundle.js'),
    // Development: local build
    path.join(__dirname, '..', '..', '..', 'build', 'local-backend', 'server.bundle.js')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Launch the bundled backend server
 */
export async function launchBundledBackend(): Promise<BackendLaunchResult> {
  const serverPath = getBundledBackendPath();
  
  if (!serverPath) {
    return { success: false, error: 'No bundled backend found' };
  }

  // Determine data directory (in user data for persistence)
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'backend-data');
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Check for seed data
  const bundleDir = path.dirname(serverPath);
  const seedDataPath = path.join(bundleDir, 'seed-data.db');
  const dbPath = path.join(dataDir, 'data.db');

  // Copy seed data if exists and no existing data
  if (fs.existsSync(seedDataPath) && !fs.existsSync(dbPath)) {
    fs.copyFileSync(seedDataPath, dbPath);
    console.log('[Backend Launcher] Copied seed data');
  }

  // Find available port
  const port = await findAvailablePort(8577);

  return new Promise((resolve) => {
    // Fork the backend process
    backendProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: String(port),
        DB_PATH: dbPath,
        WORKFLOWS_PATH: path.join(bundleDir, 'workflows'),
        SCHEMA_PATH: path.join(bundleDir, 'schema.json'),
        NODE_ENV: 'production'
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    // Handle stdout/stderr
    backendProcess.stdout?.on('data', (data) => {
      console.log(`[Backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr?.on('data', (data) => {
      console.error(`[Backend Error] ${data.toString().trim()}`);
    });

    // Wait for ready signal
    const timeout = setTimeout(() => {
      resolve({ success: false, error: 'Backend startup timeout' });
    }, 30000);

    backendProcess.on('message', (msg: any) => {
      if (msg.type === 'ready') {
        clearTimeout(timeout);
        backendPort = msg.port;
        console.log(`[Backend Launcher] Backend ready on port ${backendPort}`);
        resolve({ success: true, port: backendPort });
      }
    });

    backendProcess.on('error', (err) => {
      clearTimeout(timeout);
      console.error('[Backend Launcher] Failed to start:', err);
      resolve({ success: false, error: err.message });
    });

    backendProcess.on('exit', (code) => {
      console.log(`[Backend Launcher] Process exited with code ${code}`);
      backendProcess = null;
      backendPort = null;
    });
  });
}

/**
 * Stop the bundled backend
 */
export async function stopBundledBackend(): Promise<void> {
  if (backendProcess) {
    console.log('[Backend Launcher] Stopping backend...');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if not responding
        backendProcess?.kill('SIGKILL');
        resolve();
      }, 5000);

      backendProcess!.once('exit', () => {
        clearTimeout(timeout);
        backendProcess = null;
        backendPort = null;
        resolve();
      });

      backendProcess!.kill('SIGTERM');
    });
  }
}

/**
 * Get the port of the running backend
 */
export function getBackendPort(): number | null {
  return backendPort;
}

/**
 * Check if backend is running
 */
export function isBackendRunning(): boolean {
  return backendProcess !== null && !backendProcess.killed;
}

/**
 * Find an available port
 */
async function findAvailablePort(startPort: number): Promise<number> {
  const net = require('net');
  
  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '127.0.0.1');
    });
  };

  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
    if (port > startPort + 100) {
      throw new Error('No available ports found');
    }
  }

  return port;
}
```

**File:** Modifications to `packages/noodl-editor/src/main/main.js`

```javascript
// Add to main.js for viewer/deployed app mode

const { hasBundledBackend, launchBundledBackend, stopBundledBackend } = require('./utils/deployment/electron-backend-launcher');

async function launchDeployedApp() {
  // ... existing viewer launch code ...

  // Check for bundled backend
  if (hasBundledBackend()) {
    console.log('[Main] Bundled backend detected, starting...');
    
    const result = await launchBundledBackend();
    
    if (result.success) {
      // Set backend URL for the viewer to use
      global.bundledBackendUrl = `http://localhost:${result.port}`;
      console.log(`[Main] Backend URL: ${global.bundledBackendUrl}`);
    } else {
      console.error('[Main] Failed to start bundled backend:', result.error);
      // App can still work without backend, but data won't persist
    }
  }

  // ... rest of launch code ...
}

// Stop backend on quit
app.on('before-quit', async () => {
  await stopBundledBackend();
});
```

---

### Step 4: Deploy Wizard Integration (2 hours)

**File:** `packages/noodl-editor/src/editor/src/views/Deploy/DeployWizard.tsx` (modifications)

```tsx
// Add to existing DeployWizard component

import { bundleBackend } from '../../utils/deployment/backend-bundler';

interface DeployOptions {
  // ... existing options ...
  includeBackend: boolean;
  includeBackendData: boolean;
  backendId?: string;
}

// In the Electron deployment section:

function ElectronDeployStep({ options, setOptions, project }: StepProps) {
  const [backends, setBackends] = useState([]);
  
  useEffect(() => {
    loadBackends();
  }, []);

  const loadBackends = async () => {
    const list = await window.electronAPI.backend.list();
    setBackends(list);
  };

  const projectBackendId = project.getMetaData('backend')?.id;

  return (
    <div className={styles.step}>
      <h3>Electron Desktop App</h3>
      
      {/* ... existing Electron options ... */}

      <div className={styles.section}>
        <h4>Backend Options</h4>
        
        <Checkbox
          checked={options.includeBackend}
          onChange={(v) => setOptions({ ...options, includeBackend: v })}
          label="Include local backend"
        />
        <p className={styles.hint}>
          Bundle the backend server with your app for offline functionality.
          The app will have its own database that persists between sessions.
        </p>

        {options.includeBackend && (
          <>
            <div className={styles.field}>
              <label>Backend to bundle</label>
              <select
                value={options.backendId || projectBackendId || ''}
                onChange={(e) => setOptions({ ...options, backendId: e.target.value })}
              >
                {backends.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.id === projectBackendId ? '(current)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <Checkbox
              checked={options.includeBackendData}
              onChange={(v) => setOptions({ ...options, includeBackendData: v })}
              label="Include current data as seed data"
            />
            <p className={styles.hint}>
              Pre-populate the app's database with your current data.
              Users will start with this data on first launch.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// In the build process:

async function buildElectronApp(project: any, options: DeployOptions) {
  // ... existing build steps ...

  // Bundle backend if requested
  if (options.includeBackend && options.backendId) {
    console.log('Bundling backend...');
    
    const bundleResult = await bundleBackend({
      backendId: options.backendId,
      outputPath: path.join(outputPath, 'resources'),
      includeData: options.includeBackendData,
      platform: options.platform
    });

    if (!bundleResult.success) {
      throw new Error(`Failed to bundle backend: ${bundleResult.error}`);
    }

    console.log(`Backend bundled (${formatBytes(bundleResult.size)})`);
  }

  // ... continue with Electron packaging ...
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
```

---

### Step 5: Viewer Runtime Integration (1 hour)

**File:** `packages/noodl-viewer/src/runtime-config.ts` (modifications)

```typescript
/**
 * Configure the viewer to use bundled backend when available.
 */

export function getBackendUrl(): string | null {
  // In Electron, check for bundled backend URL
  if (typeof window !== 'undefined' && (window as any).bundledBackendUrl) {
    return (window as any).bundledBackendUrl;
  }

  // Check global from main process
  if (typeof global !== 'undefined' && (global as any).bundledBackendUrl) {
    return (global as any).bundledBackendUrl;
  }

  // Check for env variable (set during development)
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }

  return null;
}

export function configureCloudStore(cloudStore: any): void {
  const backendUrl = getBackendUrl();
  
  if (backendUrl) {
    // Use HTTP adapter pointing to bundled backend
    cloudStore.setAdapter(new LocalHTTPAdapter(backendUrl));
    console.log(`[Viewer] Using bundled backend at ${backendUrl}`);
  }
}
```

**File:** `packages/noodl-runtime/src/api/adapters/local-http/LocalHTTPAdapter.ts`

```typescript
/**
 * HTTP adapter that connects to a local backend server.
 * Used by deployed Electron apps to communicate with bundled backend.
 */

import { CloudStoreAdapter, QueryOptions, CreateOptions, SaveOptions, DeleteOptions } from '../cloudstore-adapter';

export class LocalHTTPAdapter implements CloudStoreAdapter {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private eventHandlers = new Map<string, Set<Function>>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws');
    this.ws = new WebSocket(wsUrl);

    this.ws.onmessage = (event) => {
      try {
        const { event: eventType, data } = JSON.parse(event.data);
        const handlers = this.eventHandlers.get(eventType);
        if (handlers) {
          handlers.forEach(h => h(data));
        }
      } catch (e) {
        // Ignore invalid messages
      }
    };

    this.ws.onclose = () => {
      // Reconnect after 5 seconds
      setTimeout(() => this.connectWebSocket(), 5000);
    };
  }

  async connect(): Promise<void> {
    // HTTP doesn't need explicit connection
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return true;
  }

  async query(options: QueryOptions): Promise<{ results: any[]; count?: number }> {
    const params = new URLSearchParams();
    if (options.where) params.set('where', JSON.stringify(options.where));
    if (options.sort) params.set('sort', JSON.stringify(options.sort));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.skip) params.set('skip', String(options.skip));
    if (options.count) params.set('count', 'true');

    const response = await fetch(`${this.baseUrl}/api/${options.collection}?${params}`);
    return response.json();
  }

  async fetch(options: { collection: string; objectId: string }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/${options.collection}/${options.objectId}`);
    if (!response.ok) throw new Error('Record not found');
    return response.json();
  }

  async count(options: any): Promise<number> {
    const result = await this.query({ ...options, count: true, limit: 0 });
    return result.count || 0;
  }

  async create(options: CreateOptions): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/${options.collection}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options.data)
    });
    return response.json();
  }

  async save(options: SaveOptions): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/${options.collection}/${options.objectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options.data)
    });
    return response.json();
  }

  async delete(options: DeleteOptions): Promise<void> {
    await fetch(`${this.baseUrl}/api/${options.collection}/${options.objectId}`, {
      method: 'DELETE'
    });
  }

  // ... implement remaining interface methods ...

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    this.eventHandlers.get(event)?.delete(handler);
  }
}
```

---

## Files to Create

```
packages/noodl-editor/
├── scripts/
│   └── build-backend-bundle.js
├── src/
│   ├── main/src/local-backend/
│   │   └── standalone-server.ts
│   └── editor/src/utils/deployment/
│       ├── backend-bundler.ts
│       └── electron-backend-launcher.ts

packages/noodl-runtime/src/api/adapters/local-http/
└── LocalHTTPAdapter.ts
```

## Files to Modify

```
packages/noodl-editor/src/main/main.js
  - Add bundled backend launch logic
  - Add shutdown cleanup

packages/noodl-editor/src/editor/src/views/Deploy/DeployWizard.tsx
  - Add backend bundling options

packages/noodl-editor/package.json
  - Add build:backend script

packages/noodl-viewer/src/runtime-config.ts
  - Configure for bundled backend
```

---

## Testing Checklist

### Backend Bundler
- [ ] Copies server bundle correctly
- [ ] Copies schema.json
- [ ] Copies workflow files
- [ ] Optionally copies seed data
- [ ] Generates correct package.json
- [ ] Reports correct bundle size

### Standalone Server
- [ ] Starts without editor
- [ ] Loads schema on startup
- [ ] Loads workflows on startup
- [ ] REST API works
- [ ] WebSocket works
- [ ] Shuts down cleanly

### Electron Integration
- [ ] Detects bundled backend
- [ ] Launches backend on app start
- [ ] Finds available port
- [ ] Copies seed data on first run
- [ ] Stops backend on app quit
- [ ] Handles backend crash gracefully

### Deploy Wizard
- [ ] Shows backend options for Electron
- [ ] Lists available backends
- [ ] Bundles selected backend
- [ ] Include data option works
- [ ] Build completes successfully

### Viewer Integration
- [ ] Detects bundled backend URL
- [ ] Configures CloudStore correctly
- [ ] Data operations work
- [ ] Realtime updates work

### End-to-End
- [ ] Build Electron app with backend
- [ ] App starts and backend runs
- [ ] Data persists between sessions
- [ ] Seed data loads on first run
- [ ] App works offline

---

## Success Criteria

1. Bundled backend adds <10MB to app size (excluding native modules)
2. Backend starts in <2 seconds on app launch
3. Data persists correctly in user data directory
4. App works fully offline with bundled backend
5. Seed data provides consistent starting point

---

## Dependencies

**NPM packages:**
- `better-sqlite3` - Must be rebuilt for target platform during packaging

**Internal:**
- TASK-007A (LocalSQLAdapter)
- TASK-007B (Server architecture)
- TASK-007C (CloudRunner)

**Blocks:**
- None (final phase)

---

## Platform Considerations

### Native Module Handling

`better-sqlite3` has native Node.js bindings that must be compiled for each platform:

```json
// package.json electron-builder config
{
  "build": {
    "extraResources": [
      {
        "from": "build/local-backend",
        "to": "backend"
      }
    ],
    "asarUnpack": [
      "**/better-sqlite3/**"
    ]
  }
}
```

### Data Location by Platform

| Platform | User Data Path |
|----------|----------------|
| macOS | `~/Library/Application Support/AppName/backend-data/` |
| Windows | `%APPDATA%/AppName/backend-data/` |
| Linux | `~/.config/AppName/backend-data/` |

---

## Estimated Session Breakdown

| Session | Focus | Hours |
|---------|-------|-------|
| 1 | Backend bundler + build script | 3 |
| 2 | Standalone server + testing | 2 |
| 3 | Electron launcher integration | 2 |
| 4 | Deploy wizard + viewer integration | 2 |
| **Total** | | **9** |
