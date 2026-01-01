# TASK-007: Integrated Local Backend - Implementation Checklist

## Pre-Implementation

- [ ] Review existing CloudStore implementation (`packages/noodl-runtime/src/api/cloudstore.js`)
- [ ] Review existing CloudRunner implementation (`packages/noodl-viewer-cloud/src/`)
- [ ] Review existing cloud-function-server (`packages/noodl-editor/src/main/src/cloud-function-server.js`)
- [ ] Create feature branch: `feature/007-integrated-local-backend`
- [ ] Set up development environment with SQLite tools

---

## Phase A: Foundation - LocalSQL Adapter (16-20 hours)

### A.1: SQLite Integration (4 hours)

- [ ] Install `better-sqlite3` dependency in `noodl-runtime`
- [ ] Create adapter directory structure:
  ```
  packages/noodl-runtime/src/api/adapters/
  ├── index.ts
  ├── cloudstore-adapter.ts
  └── local-sql/
      ├── LocalSQLAdapter.ts
      ├── SQLiteConnection.ts
      ├── QueryBuilder.ts
      ├── SchemaManager.ts
      └── types.ts
  ```
- [ ] Define `CloudStoreAdapter` interface with all required methods
- [ ] Implement `SQLiteConnection` wrapper class
- [ ] Implement basic `LocalSQLAdapter` constructor and connection
- [ ] Add WAL mode pragma for better concurrency
- [ ] Test: Database file creation and basic connection

### A.2: Query Translation (4 hours)

- [ ] Implement `QueryBuilder.buildSelect()` for basic queries
- [ ] Implement WHERE clause translation for operators:
  - [ ] `equalTo` / `notEqualTo`
  - [ ] `greaterThan` / `lessThan` / `greaterThanOrEqualTo` / `lessThanOrEqualTo`
  - [ ] `containedIn` / `notContainedIn`
  - [ ] `exists`
  - [ ] `contains` / `startsWith` / `endsWith`
  - [ ] `regex` (via GLOB)
- [ ] Implement ORDER BY clause translation
- [ ] Implement LIMIT/OFFSET translation
- [ ] Implement `QueryBuilder.buildInsert()`
- [ ] Implement `QueryBuilder.buildUpdate()`
- [ ] Implement `QueryBuilder.buildDelete()`
- [ ] Test: Complex queries with multiple operators
- [ ] Test: Query performance with 10,000+ records

### A.3: Schema Management (4 hours)

- [ ] Define `TableSchema` and `ColumnDefinition` interfaces
- [ ] Implement `SchemaManager.createTable()`
- [ ] Map Noodl types to SQLite types:
  - [ ] String → TEXT
  - [ ] Number → REAL
  - [ ] Boolean → INTEGER (0/1)
  - [ ] Date → TEXT (ISO8601)
  - [ ] Object/Array → TEXT (JSON)
  - [ ] Pointer → TEXT (objectId reference)
  - [ ] Relation → Junction table
- [ ] Implement `SchemaManager.addColumn()`
- [ ] Implement `SchemaManager.exportSchema()`
- [ ] Implement `SchemaManager.generatePostgresSQL()`
- [ ] Implement `SchemaManager.generateSupabaseSQL()`
- [ ] Create automatic indexes for `createdAt`, `updatedAt`
- [ ] Test: Schema creation and migration
- [ ] Test: Export to PostgreSQL format

### A.4: Adapter Registration & Selection (4 hours)

- [ ] Create `AdapterRegistry` singleton class
- [ ] Implement `createAdapter()` factory method
- [ ] Refactor existing `CloudStore` to use adapter pattern
- [ ] Create `ParseAdapter` wrapper around existing code
- [ ] Implement adapter switching based on project config
- [ ] Add adapter lifecycle methods (connect/disconnect)
- [ ] Test: Adapter switching between local and Parse
- [ ] Test: Multiple simultaneous adapters

### Phase A Verification

- [ ] All query operators work correctly
- [ ] Schema creation handles all Noodl data types
- [ ] Export generates valid PostgreSQL SQL
- [ ] No regressions in Parse adapter functionality
- [ ] Performance benchmarks documented

---

## Phase B: Local Backend Server (12-16 hours)

### B.1: Server Architecture (4 hours)

- [ ] Create `local-backend` directory in `noodl-editor/src/main/src/`
- [ ] Implement `LocalBackendServer` class
- [ ] Set up Express middleware (CORS, JSON parsing)
- [ ] Implement REST routes:
  - [ ] `GET /health` - Health check
  - [ ] `GET /api/_schema` - Get schema
  - [ ] `POST /api/_schema` - Update schema
  - [ ] `GET /api/_export` - Export data
  - [ ] `GET /api/:table` - Query records
  - [ ] `GET /api/:table/:id` - Fetch single record
  - [ ] `POST /api/:table` - Create record
  - [ ] `PUT /api/:table/:id` - Update record
  - [ ] `DELETE /api/:table/:id` - Delete record
  - [ ] `POST /functions/:name` - Execute workflow
  - [ ] `POST /api/_batch` - Batch operations
- [ ] Test: All REST endpoints with curl/Postman

### B.2: WebSocket Realtime (3 hours)

- [ ] Add `ws` dependency
- [ ] Implement WebSocket server on same HTTP server
- [ ] Implement client subscription tracking
- [ ] Implement `broadcast()` method for events
- [ ] Wire adapter events to WebSocket broadcast
- [ ] Handle client disconnection cleanup
- [ ] Test: Subscribe and receive realtime updates
- [ ] Test: Multiple clients receive broadcasts

### B.3: Backend Manager (4 hours)

- [ ] Create `BackendManager` singleton class
- [ ] Implement backend storage structure:
  ```
  ~/.noodl/backends/{id}/
  ├── config.json
  ├── schema.json
  ├── workflows/
  └── data/local.db
  ```
- [ ] Implement IPC handlers:
  - [ ] `backend:list` - List all backends
  - [ ] `backend:create` - Create new backend
  - [ ] `backend:delete` - Delete backend
  - [ ] `backend:start` - Start backend server
  - [ ] `backend:stop` - Stop backend server
  - [ ] `backend:status` - Get backend status
  - [ ] `backend:export-schema` - Export schema
  - [ ] `backend:export-data` - Export data
- [ ] Implement automatic port allocation
- [ ] Wire BackendManager into main process
- [ ] Test: Create/start/stop backend from IPC

### B.4: Editor Integration (3 hours)

- [ ] Create `BackendModel` in editor
- [ ] Implement `loadProjectBackend()` method
- [ ] Add backend status to project model
- [ ] Create backend indicator in editor header
- [ ] Implement start/stop controls in UI
- [ ] Test: Backend starts with project if autoStart enabled
- [ ] Test: Backend stops when project closes

### Phase B Verification

- [ ] Backend server starts and responds to requests
- [ ] Realtime WebSocket updates work
- [ ] Multiple backends can run simultaneously
- [ ] IPC commands work from renderer process
- [ ] Editor shows correct backend status

---

## Phase C: Visual Workflow Runtime (12-16 hours)

### C.1: Runtime Adaptation (4 hours)

- [ ] Review existing `CloudRunner` implementation
- [ ] Modify CloudRunner to accept local adapter
- [ ] Remove Parse-specific dependencies from base runtime
- [ ] Add adapter injection to runtime context
- [ ] Ensure `sandbox.isolate.js` works in pure Node.js
- [ ] Test: CloudRunner executes workflows with local adapter

### C.2: Database Nodes (4 hours)

- [ ] Create `noodl.local.query` node
- [ ] Create `noodl.local.insert` node
- [ ] Create `noodl.local.update` node
- [ ] Create `noodl.local.delete` node
- [ ] Create `noodl.local.transaction` node (optional)
- [ ] Add nodes to cloud viewer node registry
- [ ] Test: Each node type in isolation
- [ ] Test: Nodes work in visual workflow

### C.3: Trigger Nodes (4 hours)

- [ ] Create `noodl.trigger.schedule` node (cron-based)
- [ ] Create `noodl.trigger.dbChange` node
- [ ] Create `noodl.trigger.webhook` node
- [ ] Implement trigger registration system
- [ ] Implement trigger cleanup on node deletion
- [ ] Test: Schedule triggers at specified intervals
- [ ] Test: DB change triggers fire correctly
- [ ] Test: Webhook triggers receive HTTP requests

### C.4: Workflow Hot Reload (4 hours)

- [ ] Create `WorkflowCompiler` class
- [ ] Implement debounced compilation on component change
- [ ] Export workflows to backend workflows directory
- [ ] Implement `backend:update-workflow` IPC handler
- [ ] Implement `backend:reload-workflows` IPC handler
- [ ] Test: Workflow changes reflect immediately
- [ ] Test: No service interruption during reload

### Phase C Verification

- [ ] CloudRunner executes workflows with local database
- [ ] All database node types work correctly
- [ ] All trigger types fire at appropriate times
- [ ] Hot reload works without restarting backend
- [ ] No memory leaks in long-running workflows

---

## Phase D: Launcher Integration (8-10 hours)

### D.1: Backend List UI (3 hours)

- [ ] Create `BackendManager` directory in Launcher views
- [ ] Create `BackendList.tsx` component
- [ ] Create `BackendCard.tsx` component
- [ ] Implement backend loading from IPC
- [ ] Implement status indicators (running/stopped)
- [ ] Add start/stop controls per backend
- [ ] Add delete button with confirmation
- [ ] Test: List displays all backends correctly

### D.2: Create Backend UI (2 hours)

- [ ] Create `CreateBackendDialog.tsx` component
- [ ] Implement name input with validation
- [ ] Call `backend:create` on confirmation
- [ ] Refresh list after creation
- [ ] Test: New backend appears in list

### D.3: Backend Selector (3 hours)

- [ ] Create `BackendSelector.tsx` dropdown component
- [ ] Show in project card when editing settings
- [ ] Implement backend association saving
- [ ] Update project config on selection
- [ ] Option to create new backend from selector
- [ ] Test: Backend association persists
- [ ] Test: Switching backends works correctly

### D.4: Backend Admin Panel (2 hours)

- [ ] Create basic data viewer component
- [ ] Show tables and record counts
- [ ] Allow basic CRUD operations
- [ ] Show recent activity/logs
- [ ] Test: Data displays correctly
- [ ] Test: CRUD operations work

### Phase D Verification

- [ ] Launcher shows all backends with status
- [ ] Can create/delete backends from launcher
- [ ] Can start/stop backends independently
- [ ] Projects can be associated with backends
- [ ] Basic data administration works

---

## Phase E: Migration & Export (8-10 hours)

### E.1: Schema Export Wizard (4 hours)

- [ ] Create `ExportWizard.tsx` component
- [ ] Implement format selection (Postgres, Supabase, PocketBase, JSON)
- [ ] Implement include data option
- [ ] Generate export via IPC
- [ ] Display result in code viewer
- [ ] Implement copy to clipboard
- [ ] Implement download as file
- [ ] Test: Each export format generates valid output

### E.2: Parse Migration Wizard (4 hours)

- [ ] Create `ParseMigrationWizard.tsx` component
- [ ] Implement Parse schema fetching
- [ ] Display schema review with record counts
- [ ] Implement migration progress UI
- [ ] Create local backend during migration
- [ ] Import schema structure
- [ ] Import data in batches
- [ ] Handle migration errors gracefully
- [ ] Test: Full migration from Parse to local

### E.3: External Migration Guide (2 hours)

- [ ] Create migration documentation
- [ ] Document Supabase migration steps
- [ ] Document PocketBase migration steps
- [ ] Add links from export wizard
- [ ] Test: Following guide successfully migrates

### Phase E Verification

- [ ] Schema exports to all target formats
- [ ] Parse migration preserves all data
- [ ] Migration can be cancelled/resumed
- [ ] Export documentation is complete

---

## Phase F: Standalone Deployment (8-10 hours)

### F.1: Backend Bundler (4 hours)

- [ ] Create `backend-bundler.ts` utility
- [ ] Pre-compile server bundle for Node.js
- [ ] Pre-compile server bundle for Electron
- [ ] Implement schema copying
- [ ] Implement workflows copying
- [ ] Implement optional data copying
- [ ] Generate package.json for standalone
- [ ] Generate startup script
- [ ] Test: Bundled backend runs standalone

### F.2: Electron Deployment Integration (4 hours)

- [ ] Modify Electron deployer to support backend
- [ ] Add "Include Backend" option to deploy wizard
- [ ] Add "Include Data" sub-option
- [ ] Integrate backend bundle into Electron package
- [ ] Modify Electron main.js to start backend
- [ ] Handle backend cleanup on app quit
- [ ] Test: Electron app with embedded backend works
- [ ] Test: App starts backend on launch

### F.3: Documentation (2 hours)

- [ ] Document standalone deployment process
- [ ] Document backend configuration options
- [ ] Document production considerations
- [ ] Add troubleshooting guide
- [ ] Test: Follow docs to deploy successfully

### Phase F Verification

- [ ] Backend can be bundled for standalone use
- [ ] Electron apps include working backend
- [ ] Deployed apps work offline
- [ ] Documentation covers all scenarios

---

## Final Verification

### Functional Testing

- [ ] New user can create backend with zero configuration
- [ ] Visual workflows execute correctly in local backend
- [ ] Realtime updates work via WebSocket
- [ ] All database operations work correctly
- [ ] All trigger types fire correctly
- [ ] Schema export produces valid output
- [ ] Parse migration preserves data
- [ ] Electron deployment works with backend

### Backward Compatibility

- [ ] Existing Parse projects load without errors
- [ ] Parse adapter functions correctly
- [ ] Can switch from Parse to local backend
- [ ] No regressions in existing functionality

### Performance

- [ ] Query performance acceptable with 100K records
- [ ] WebSocket can handle 100 simultaneous clients
- [ ] Hot reload completes within 1 second
- [ ] Memory usage stable over time

### Documentation

- [ ] README covers all features
- [ ] API documentation complete
- [ ] Migration guides complete
- [ ] Troubleshooting guide complete

---

## Post-Implementation

- [ ] Update main phase documentation with completion status
- [ ] Create PR with comprehensive description
- [ ] Request code review
- [ ] Address review feedback
- [ ] Merge to development branch
- [ ] Update CHANGELOG.md
- [ ] Plan Phase 5 follow-up tasks (external adapters)

---

## Quick Reference: Key Files

| Purpose | File Path |
|---------|-----------|
| Adapter Interface | `packages/noodl-runtime/src/api/adapters/cloudstore-adapter.ts` |
| LocalSQL Adapter | `packages/noodl-runtime/src/api/adapters/local-sql/LocalSQLAdapter.ts` |
| Backend Server | `packages/noodl-editor/src/main/src/local-backend/LocalBackendServer.ts` |
| Backend Manager | `packages/noodl-editor/src/main/src/local-backend/BackendManager.ts` |
| Backend Model | `packages/noodl-editor/src/editor/src/models/BackendModel.ts` |
| Launcher UI | `packages/noodl-editor/src/editor/src/views/Launcher/BackendManager/` |
| Database Nodes | `packages/noodl-viewer-cloud/src/nodes/database/` |
| Trigger Nodes | `packages/noodl-viewer-cloud/src/nodes/triggers/` |
| Workflow Compiler | `packages/noodl-editor/src/editor/src/utils/workflow-compiler.ts` |
| Backend Bundler | `packages/noodl-editor/src/editor/src/utils/deployment/backend-bundler.ts` |

---

## Estimated Time by Phase

| Phase | Description | Estimated Hours |
|-------|-------------|-----------------|
| A | LocalSQL Adapter | 16-20 |
| B | Backend Server | 12-16 |
| C | Workflow Runtime | 12-16 |
| D | Launcher Integration | 8-10 |
| E | Migration & Export | 8-10 |
| F | Standalone Deployment | 8-10 |
| **Total** | | **64-82 hours** |

**Recommended Session Structure:** 4-6 hour Cline sessions, one sub-phase per session
