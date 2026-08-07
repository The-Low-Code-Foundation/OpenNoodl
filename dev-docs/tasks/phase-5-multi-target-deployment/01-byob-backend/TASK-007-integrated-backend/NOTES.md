# TASK-007: Integrated Local Backend - Working Notes

## Quick Links

- [README.md](./README.md) - Full specification
- [CHECKLIST.md](./CHECKLIST.md) - Implementation checklist
- [CHANGELOG.md](./CHANGELOG.md) - Progress tracking

---

## Key Code Locations

### Existing Code to Study

```
# CloudStore (current implementation)
packages/noodl-runtime/src/api/cloudstore.js

# Cloud Runtime
packages/noodl-viewer-cloud/src/index.ts
packages/noodl-viewer-cloud/src/sandbox.isolate.js
packages/noodl-viewer-cloud/src/sandbox.viewer.js

# Cloud Function Server
packages/noodl-editor/src/main/src/cloud-function-server.js

# Parse Dashboard
packages/noodl-parse-dashboard/

# Existing Data Nodes
packages/noodl-runtime/src/nodes/std-library/data/dbcollectionnode2.js
packages/noodl-runtime/src/api/records.js

# Cloud Nodes
packages/noodl-viewer-cloud/src/nodes/cloud/request.ts
packages/noodl-viewer-cloud/src/nodes/cloud/response.ts
packages/noodl-viewer-cloud/src/nodes/data/aggregatenode.js
```

### Key Interfaces to Implement

```typescript
// From cloudstore.js - methods to implement in LocalSQLAdapter
interface CloudStoreMethods {
  query(options): void;           // Query records
  fetch(options): void;           // Fetch single record
  count(options): void;           // Count records
  aggregate(options): void;       // Aggregate query
  create(options): void;          // Create record
  save(options): void;            // Update record
  delete(options): void;          // Delete record
  addRelation(options): void;     // Add relation
  removeRelation(options): void;  // Remove relation
  increment(options): void;       // Increment field
}
```

---

## Parse Query Syntax Reference

The LocalSQL adapter needs to translate these Parse query operators:

```javascript
// Comparison
{ field: { equalTo: value } }
{ field: { notEqualTo: value } }
{ field: { greaterThan: value } }
{ field: { lessThan: value } }
{ field: { greaterThanOrEqualTo: value } }
{ field: { lessThanOrEqualTo: value } }

// Array
{ field: { containedIn: [values] } }
{ field: { notContainedIn: [values] } }
{ field: { containsAll: [values] } }

// String
{ field: { contains: "substring" } }
{ field: { startsWith: "prefix" } }
{ field: { endsWith: "suffix" } }
{ field: { regex: "pattern" } }

// Existence
{ field: { exists: true/false } }

// Logical
{ and: [conditions] }
{ or: [conditions] }

// Relations
{ field: { pointsTo: objectId } }
{ field: { relatedTo: { object, key } } }

// Sorting
{ sort: ['field'] }        // Ascending
{ sort: ['-field'] }       // Descending

// Pagination
{ limit: 100, skip: 0 }
```

---

## SQLite Type Mapping

```
Noodl Type      → SQLite Type      → Notes
─────────────────────────────────────────────
String          → TEXT             → UTF-8 strings
Number          → REAL             → 64-bit float
Boolean         → INTEGER          → 0 or 1
Date            → TEXT             → ISO8601 format
Object          → TEXT             → JSON stringified
Array           → TEXT             → JSON stringified
Pointer         → TEXT             → objectId reference
Relation        → (junction table) → Separate table
File            → TEXT             → URL or base64
GeoPoint        → TEXT             → JSON {lat, lng}
```

---

## Backend Storage Structure

```
~/.noodl/
├── backends/
│   ├── backend-abc123/
│   │   ├── config.json          # Backend configuration
│   │   │   {
│   │   │     "id": "backend-abc123",
│   │   │     "name": "My Backend",
│   │   │     "createdAt": "2024-01-15T...",
│   │   │     "port": 8577,
│   │   │     "projectIds": ["proj-1", "proj-2"]
│   │   │   }
│   │   │
│   │   ├── schema.json          # Schema definition (git-trackable)
│   │   │   {
│   │   │     "version": 1,
│   │   │     "tables": [
│   │   │       {
│   │   │         "name": "todos",
│   │   │         "columns": [
│   │   │           { "name": "title", "type": "String" },
│   │   │           { "name": "completed", "type": "Boolean" }
│   │   │         ]
│   │   │       }
│   │   │     ]
│   │   │   }
│   │   │
│   │   ├── workflows/           # Compiled visual workflows
│   │   │   ├── GetTodos.workflow.json
│   │   │   └── CreateTodo.workflow.json
│   │   │
│   │   └── data/
│   │       └── local.db         # SQLite database
│   │
│   └── backend-xyz789/
│       └── ...
│
├── projects/
│   └── my-project/
│       └── noodl.project.json
│           {
│             "name": "My Project",
│             "backend": {
│               "type": "local",
│               "id": "backend-abc123",
│               "settings": {
│                 "autoStart": true
│               }
│             }
│           }
│
└── launcher-config.json         # Global launcher settings
```

---

## IPC API Design

```typescript
// Main Process Handlers (BackendManager)

// List all backends
ipcMain.handle('backend:list', async () => {
  return BackendMetadata[];
});

// Create new backend
ipcMain.handle('backend:create', async (_, name: string) => {
  return BackendMetadata;
});

// Delete backend
ipcMain.handle('backend:delete', async (_, id: string) => {
  return void;
});

// Start backend server
ipcMain.handle('backend:start', async (_, id: string) => {
  return void;
});

// Stop backend server
ipcMain.handle('backend:stop', async (_, id: string) => {
  return void;
});

// Get backend status
ipcMain.handle('backend:status', async (_, id: string) => {
  return { running: boolean; port?: number };
});

// Export schema
ipcMain.handle('backend:export-schema', async (_, id: string, format: string) => {
  return string; // SQL or JSON
});

// Export data
ipcMain.handle('backend:export-data', async (_, id: string, format: string) => {
  return string; // SQL or JSON
});

// Update workflow
ipcMain.handle('backend:update-workflow', async (_, params: {
  backendId: string;
  name: string;
  workflow: object;
}) => {
  return void;
});

// Reload all workflows
ipcMain.handle('backend:reload-workflows', async (_, id: string) => {
  return void;
});

// Import Parse schema
ipcMain.handle('backend:import-parse-schema', async (_, params: {
  backendId: string;
  schema: object;
}) => {
  return void;
});

// Import records
ipcMain.handle('backend:import-records', async (_, params: {
  backendId: string;
  collection: string;
  records: object[];
}) => {
  return void;
});
```

---

## REST API Design

```
Base URL: http://localhost:{port}

# Health Check
GET /health
Response: { "status": "ok", "backend": "name" }

# Schema
GET /api/_schema
Response: { "tables": [...] }

POST /api/_schema
Body: { "tables": [...] }
Response: { "success": true }

# Export
GET /api/_export?format=postgres|supabase|json&includeData=true
Response: string (SQL or JSON)

# Query Records
GET /api/{table}?where={json}&sort={json}&limit=100&skip=0
Response: { "results": [...] }

# Fetch Single Record
GET /api/{table}/{id}
Response: { "objectId": "...", ... }

# Create Record
POST /api/{table}
Body: { "field": "value", ... }
Response: { "objectId": "...", "createdAt": "..." }

# Update Record
PUT /api/{table}/{id}
Body: { "field": "newValue", ... }
Response: { "updatedAt": "..." }

# Delete Record
DELETE /api/{table}/{id}
Response: { "success": true }

# Execute Workflow
POST /functions/{name}
Body: { ... }
Response: { "result": ... }

# Batch Operations
POST /api/_batch
Body: {
  "requests": [
    { "method": "POST", "path": "/api/todos", "body": {...} },
    { "method": "PUT", "path": "/api/todos/abc", "body": {...} }
  ]
}
Response: { "results": [...] }
```

---

## WebSocket Protocol

```typescript
// Client → Server: Subscribe to collection
{
  "type": "subscribe",
  "collection": "todos"
}

// Client → Server: Unsubscribe
{
  "type": "unsubscribe",
  "collection": "todos"
}

// Server → Client: Record created
{
  "event": "create",
  "data": {
    "collection": "todos",
    "object": { "objectId": "...", ... }
  },
  "timestamp": 1234567890
}

// Server → Client: Record updated
{
  "event": "save",
  "data": {
    "collection": "todos",
    "objectId": "...",
    "object": { ... }
  },
  "timestamp": 1234567890
}

// Server → Client: Record deleted
{
  "event": "delete",
  "data": {
    "collection": "todos",
    "objectId": "..."
  },
  "timestamp": 1234567890
}
```

---

## Node Definitions

### noodl.local.query

```typescript
{
  name: 'noodl.local.query',
  displayNodeName: 'Query Records',
  category: 'Local Database',
  
  inputs: {
    collection: { type: 'string' },
    where: { type: 'query-filter' },
    sort: { type: 'array' },
    limit: { type: 'number', default: 100 },
    skip: { type: 'number', default: 0 },
    fetch: { type: 'signal' }
  },
  
  outputs: {
    results: { type: 'array' },
    count: { type: 'number' },
    success: { type: 'signal' },
    failure: { type: 'signal' },
    error: { type: 'string' }
  }
}
```

### noodl.trigger.schedule

```typescript
{
  name: 'noodl.trigger.schedule',
  displayNodeName: 'Schedule Trigger',
  category: 'Triggers',
  singleton: true,
  
  inputs: {
    cron: { type: 'string', default: '0 * * * *' },
    enabled: { type: 'boolean', default: true }
  },
  
  outputs: {
    triggered: { type: 'signal' },
    lastRun: { type: 'date' }
  }
}
```

### noodl.trigger.dbChange

```typescript
{
  name: 'noodl.trigger.dbChange',
  displayNodeName: 'Database Change Trigger',
  category: 'Triggers',
  singleton: true,
  
  inputs: {
    collection: { type: 'string' },
    events: { 
      type: 'enum',
      enums: ['all', 'create', 'save', 'delete'],
      default: 'all'
    }
  },
  
  outputs: {
    triggered: { type: 'signal' },
    eventType: { type: 'string' },
    record: { type: 'object' },
    recordId: { type: 'string' }
  }
}
```

---

## Testing Scenarios

### Unit Tests

- [ ] QueryBuilder translates all operators correctly
- [ ] SchemaManager creates valid SQLite tables
- [ ] SchemaManager exports valid PostgreSQL
- [ ] LocalSQLAdapter handles concurrent access
- [ ] WebSocket broadcasts to correct subscribers

### Integration Tests

- [ ] Full CRUD cycle via REST API
- [ ] Workflow execution with database access
- [ ] Realtime updates via WebSocket
- [ ] Backend start/stop lifecycle
- [ ] Multiple simultaneous backends

### End-to-End Tests

- [ ] New user creates backend in launcher
- [ ] Project uses backend for data storage
- [ ] Visual workflow saves data to database
- [ ] Frontend receives realtime updates
- [ ] Export schema and migrate to Supabase
- [ ] Deploy Electron app with embedded backend

---

## Performance Targets

| Scenario | Target | Notes |
|----------|--------|-------|
| Query 1K records | < 10ms | With index |
| Query 100K records | < 100ms | With index |
| Insert single record | < 5ms | |
| Batch insert 1K records | < 500ms | Within transaction |
| WebSocket broadcast | < 10ms | To 100 clients |
| Workflow hot reload | < 1s | Including compile |
| Backend startup | < 2s | Cold start |

---

## Security Considerations

1. **Local only**: Backend only binds to localhost by default
2. **No auth required**: Local development doesn't need authentication
3. **Master key in memory**: Don't persist sensitive keys to disk
4. **SQL injection**: Use parameterized queries exclusively
5. **Path traversal**: Validate all file paths
6. **Data export**: Warn about exposing sensitive data

---

## Session Notes

_Use this space for notes during implementation sessions_

### Session 1 Notes

```
Date: TBD
Focus: Phase A.1 - SQLite Integration

Notes:
- 
- 
- 

Issues encountered:
- 
- 

Next session:
- 
```

### Session 2 Notes

```
Date: TBD
Focus: Phase A.2 - Query Translation

Notes:
- 
- 
- 

Issues encountered:
- 
- 

Next session:
- 
```

---

## Questions & Decisions to Make

- [ ] Should we support full-text search in SQLite? (FTS5)
- [ ] How to handle file uploads in local backend?
- [ ] Should triggers persist across backend restarts?
- [ ] What's the backup/restore strategy for local databases?
- [ ] Should we support multiple databases per backend?
