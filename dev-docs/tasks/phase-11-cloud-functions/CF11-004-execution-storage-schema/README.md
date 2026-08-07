# CF11-004: Execution Storage Schema

## Metadata

| Field              | Value                                       |
| ------------------ | ------------------------------------------- |
| **ID**             | CF11-004                                    |
| **Phase**          | Phase 11                                    |
| **Series**         | 2 - Execution History                       |
| **Priority**       | 🔴 Critical                                 |
| **Difficulty**     | 🟡 Medium                                   |
| **Estimated Time** | 8-10 hours                                  |
| **Prerequisites**  | Phase 5 TASK-007A (LocalSQL Adapter)        |
| **Branch**         | `feature/cf11-004-execution-storage-schema` |

## Objective

Create the SQLite database schema and TypeScript interfaces for storing workflow execution history, enabling full visibility into every workflow run with node-by-node data capture.

## Background

Workflow debugging is currently impossible in OpenNoodl. When a workflow fails, users have no visibility into:

- What data flowed through each node
- Where exactly the failure occurred
- What inputs caused the failure
- How long each step took

n8n provides complete execution history - every workflow run is logged with input/output data for each node. This is the **#1 feature** needed for OpenNoodl to be production-ready.

This task creates the storage foundation. Subsequent tasks (CF11-005, CF11-006, CF11-007) will build the logging integration and UI.

## Current State

- No execution history storage exists
- CloudRunner executes workflows but discards all intermediate data
- Users cannot debug failed workflows
- No performance metrics available

## Desired State

- SQLite tables store all execution data
- TypeScript interfaces define the data structures
- Query APIs enable efficient retrieval
- Retention policies prevent unbounded storage growth
- Foundation ready for CF11-005 logger integration

## Scope

### In Scope

- [ ] SQLite table schema design
- [ ] TypeScript interfaces for execution data
- [ ] ExecutionStore class with CRUD operations
- [ ] Query methods for filtering/pagination
- [ ] Retention/cleanup utilities
- [ ] Unit tests for storage operations

### Out of Scope

- CloudRunner integration (CF11-005)
- UI components (CF11-006)
- Canvas overlay (CF11-007)

## Technical Approach

### Database Schema

```sql
-- Workflow execution records
CREATE TABLE workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,  -- 'webhook', 'schedule', 'manual', 'db_change'
  trigger_data TEXT,           -- JSON: request body, cron expression, etc.
  status TEXT NOT NULL,        -- 'running', 'success', 'error'
  started_at INTEGER NOT NULL, -- Unix timestamp ms
  completed_at INTEGER,
  duration_ms INTEGER,
  error_message TEXT,
  error_stack TEXT,
  metadata TEXT,               -- JSON: additional context
  FOREIGN KEY (workflow_id) REFERENCES components(id)
);

-- Individual node execution steps
CREATE TABLE execution_steps (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  node_name TEXT,
  step_index INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER,
  status TEXT NOT NULL,        -- 'running', 'success', 'error', 'skipped'
  input_data TEXT,             -- JSON (truncated if large)
  output_data TEXT,            -- JSON (truncated if large)
  error_message TEXT,
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_executions_status ON workflow_executions(status);
CREATE INDEX idx_executions_started ON workflow_executions(started_at DESC);
CREATE INDEX idx_steps_execution ON execution_steps(execution_id);
CREATE INDEX idx_steps_node ON execution_steps(node_id);
```

### TypeScript Interfaces

```typescript
// packages/noodl-viewer-cloud/src/execution-history/types.ts

export type ExecutionStatus = 'running' | 'success' | 'error';
export type StepStatus = 'running' | 'success' | 'error' | 'skipped';
export type TriggerType = 'webhook' | 'schedule' | 'manual' | 'db_change' | 'internal_event';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  triggerType: TriggerType;
  triggerData?: Record<string, unknown>;
  status: ExecutionStatus;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  errorMessage?: string;
  errorStack?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionStep {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: string;
  nodeName?: string;
  stepIndex: number;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  status: StepStatus;
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  errorMessage?: string;
}

export interface ExecutionQuery {
  workflowId?: string;
  status?: ExecutionStatus;
  triggerType?: TriggerType;
  startedAfter?: number;
  startedBefore?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'started_at' | 'duration_ms';
  orderDir?: 'asc' | 'desc';
}

export interface ExecutionWithSteps extends WorkflowExecution {
  steps: ExecutionStep[];
}
```

### ExecutionStore Class

```typescript
// packages/noodl-viewer-cloud/src/execution-history/ExecutionStore.ts

export class ExecutionStore {
  constructor(private db: Database.Database) {
    this.initSchema();
  }

  private initSchema(): void {
    // Create tables if not exist
  }

  // === Execution CRUD ===

  async createExecution(execution: Omit<WorkflowExecution, 'id'>): Promise<string> {
    const id = this.generateId();
    // Insert and return ID
    return id;
  }

  async updateExecution(id: string, updates: Partial<WorkflowExecution>): Promise<void> {
    // Update execution record
  }

  async getExecution(id: string): Promise<WorkflowExecution | null> {
    // Get single execution
  }

  async getExecutionWithSteps(id: string): Promise<ExecutionWithSteps | null> {
    // Get execution with all steps
  }

  async queryExecutions(query: ExecutionQuery): Promise<WorkflowExecution[]> {
    // Query with filters and pagination
  }

  async deleteExecution(id: string): Promise<void> {
    // Delete execution and steps (cascade)
  }

  // === Step CRUD ===

  async addStep(step: Omit<ExecutionStep, 'id'>): Promise<string> {
    // Add step to execution
  }

  async updateStep(id: string, updates: Partial<ExecutionStep>): Promise<void> {
    // Update step
  }

  async getStepsForExecution(executionId: string): Promise<ExecutionStep[]> {
    // Get all steps for execution
  }

  // === Retention ===

  async cleanupOldExecutions(maxAgeMs: number): Promise<number> {
    // Delete executions older than maxAge
  }

  async cleanupByCount(maxCount: number, workflowId?: string): Promise<number> {
    // Keep only N most recent executions
  }

  // === Stats ===

  async getExecutionStats(workflowId?: string): Promise<ExecutionStats> {
    // Get aggregated stats
  }
}
```

### Key Files to Create

| File                                                           | Purpose               |
| -------------------------------------------------------------- | --------------------- |
| `packages/noodl-viewer-cloud/src/execution-history/types.ts`   | TypeScript interfaces |
| `packages/noodl-viewer-cloud/src/execution-history/schema.sql` | SQLite schema         |
| `packages/noodl-viewer-cloud/src/execution-history/store.ts`   | ExecutionStore class  |
| `packages/noodl-viewer-cloud/src/execution-history/index.ts`   | Module exports        |
| `packages/noodl-viewer-cloud/tests/execution-history.test.ts`  | Unit tests            |

### Dependencies

- [ ] Phase 5 TASK-007A (LocalSQL Adapter) provides SQLite integration
- [ ] `better-sqlite3` package (already in project)

## Implementation Steps

### Step 1: Create Type Definitions (2h)

1. Create `types.ts` with all interfaces
2. Define enums for status types
3. Add JSDoc documentation

### Step 2: Create Schema (1h)

1. Create `schema.sql` with table definitions
2. Add indexes for performance
3. Document schema decisions

### Step 3: Implement ExecutionStore (4h)

1. Create `store.ts` with ExecutionStore class
2. Implement CRUD operations
3. Implement query with filters
4. Implement retention utilities
5. Add error handling

### Step 4: Write Tests (2h)

1. Test CRUD operations
2. Test query filtering
3. Test retention cleanup
4. Test edge cases (large data, concurrent access)

## Testing Plan

### Unit Tests

- [ ] Create execution record
- [ ] Update execution status
- [ ] Add steps to execution
- [ ] Query with filters
- [ ] Pagination works correctly
- [ ] Cleanup by age
- [ ] Cleanup by count
- [ ] Handle large input/output data (truncation)
- [ ] Concurrent write access

### Manual Testing

- [ ] Schema creates correctly on first run
- [ ] Data persists across restarts
- [ ] Query performance acceptable (<100ms for 1000 records)

## Success Criteria

- [ ] All TypeScript interfaces defined
- [ ] SQLite schema creates tables correctly
- [ ] CRUD operations work for executions and steps
- [ ] Query filtering and pagination work
- [ ] Retention cleanup works
- [ ] All unit tests pass
- [ ] No TypeScript errors
- [ ] Documentation complete

## Risks & Mitigations

| Risk                           | Mitigation                                      |
| ------------------------------ | ----------------------------------------------- |
| Large data causing slow writes | Truncate input/output data at configurable size |
| Unbounded storage growth       | Implement retention policies from day 1         |
| SQLite lock contention         | Use WAL mode, batch writes where possible       |

## References

- [Phase 5 TASK-007A LocalSQL Adapter](../../phase-5-multi-target-deployment/01-byob-backend/TASK-007-integrated-backend/TASK-007A-localsql-adapter.md)
- [Original Cloud Functions Plan](../cloud-functions-revival-plan.md) - Execution History section
- [better-sqlite3 docs](https://github.com/WiseLibs/better-sqlite3)
