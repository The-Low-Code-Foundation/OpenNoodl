-- Execution History Schema
-- SQLite schema for storing workflow execution history
--
-- CF11-004: Execution Storage Schema

-- ============================================================================
-- WORKFLOW EXECUTIONS TABLE
-- ============================================================================
-- Stores one record per workflow run

CREATE TABLE IF NOT EXISTS workflow_executions (
  -- Primary key: unique execution ID
  id TEXT PRIMARY KEY,
  
  -- Reference to the workflow component
  workflow_id TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  
  -- Trigger information
  trigger_type TEXT NOT NULL,  -- 'webhook', 'schedule', 'manual', 'db_change', 'internal_event', 'test'
  trigger_data TEXT,           -- JSON: request body, cron expression, etc.
  
  -- Execution status
  status TEXT NOT NULL,        -- 'running', 'success', 'error'
  
  -- Timing
  started_at INTEGER NOT NULL, -- Unix timestamp (ms)
  completed_at INTEGER,        -- Unix timestamp (ms)
  duration_ms INTEGER,         -- Computed: completed_at - started_at
  
  -- Error information (if status = 'error')
  error_message TEXT,
  error_stack TEXT,
  
  -- Additional context
  metadata TEXT                -- JSON: any additional context
);

-- ============================================================================
-- EXECUTION STEPS TABLE
-- ============================================================================
-- Stores one record per node execution within a workflow

CREATE TABLE IF NOT EXISTS execution_steps (
  -- Primary key: unique step ID
  id TEXT PRIMARY KEY,
  
  -- Foreign key to parent execution
  execution_id TEXT NOT NULL,
  
  -- Node information
  node_id TEXT NOT NULL,       -- ID of the node in the graph
  node_type TEXT NOT NULL,     -- Type of node (e.g., 'noodl.logic.condition')
  node_name TEXT,              -- Display name of the node
  
  -- Execution order
  step_index INTEGER NOT NULL, -- 0-based order of execution
  
  -- Timing
  started_at INTEGER NOT NULL, -- Unix timestamp (ms)
  completed_at INTEGER,        -- Unix timestamp (ms)
  duration_ms INTEGER,         -- Computed: completed_at - started_at
  
  -- Status
  status TEXT NOT NULL,        -- 'running', 'success', 'error', 'skipped'
  
  -- Data (JSON, may be truncated for large payloads)
  input_data TEXT,             -- JSON: inputs received by the node
  output_data TEXT,            -- JSON: outputs produced by the node
  
  -- Error information (if status = 'error')
  error_message TEXT,
  
  -- Cascade delete when parent execution is deleted
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Optimize common query patterns

-- Query executions by workflow
CREATE INDEX IF NOT EXISTS idx_executions_workflow 
  ON workflow_executions(workflow_id);

-- Query executions by status
CREATE INDEX IF NOT EXISTS idx_executions_status 
  ON workflow_executions(status);

-- Query executions by start time (most common: newest first)
CREATE INDEX IF NOT EXISTS idx_executions_started 
  ON workflow_executions(started_at DESC);

-- Combined index for filtered + sorted queries
CREATE INDEX IF NOT EXISTS idx_executions_workflow_started 
  ON workflow_executions(workflow_id, started_at DESC);

-- Query steps by execution
CREATE INDEX IF NOT EXISTS idx_steps_execution 
  ON execution_steps(execution_id);

-- Query steps by node (for debugging specific nodes)
CREATE INDEX IF NOT EXISTS idx_steps_node 
  ON execution_steps(node_id);

-- Query steps by execution in order
CREATE INDEX IF NOT EXISTS idx_steps_execution_order 
  ON execution_steps(execution_id, step_index);

-- ============================================================================
-- CLEANUP HELPER VIEW
-- ============================================================================
-- View for identifying old executions

CREATE VIEW IF NOT EXISTS old_executions AS
SELECT 
  id,
  workflow_id,
  started_at,
  status,
  (strftime('%s', 'now') * 1000 - started_at) as age_ms
FROM workflow_executions
ORDER BY started_at ASC;
