/**
 * ExecutionStore - SQLite-backed execution history storage
 *
 * Provides CRUD operations for workflow executions and steps,
 * query filtering, pagination, and retention management.
 *
 * @module execution-history/store
 */

// Read schema SQL for initialization
import * as fs from 'fs';
import * as path from 'path';

import type {
  WorkflowExecution,
  ExecutionStep,
  ExecutionQuery,
  ExecutionWithSteps,
  ExecutionStats,
  RetentionPolicy,
  CreateExecutionOptions,
  CreateStepOptions,
  UpdateExecutionOptions,
  UpdateStepOptions
} from './types';

/** Maximum size for JSON data fields (bytes) */
const MAX_DATA_SIZE = 50 * 1024; // 50KB

/** Default limit for queries */
const DEFAULT_QUERY_LIMIT = 100;

/**
 * Generate a unique ID (similar to CUID)
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `exec_${timestamp}${random}`;
}

/**
 * Truncate JSON data if too large
 */
function truncateData(data: unknown, maxSize: number = MAX_DATA_SIZE): string | null {
  if (data === undefined || data === null) {
    return null;
  }

  try {
    const json = JSON.stringify(data);
    if (json.length <= maxSize) {
      return json;
    }

    // Truncate and add marker
    return JSON.stringify({
      __truncated: true,
      __originalSize: json.length,
      __preview: JSON.stringify(data).substring(0, 1000)
    });
  } catch (e) {
    return JSON.stringify({ __error: 'Failed to serialize data' });
  }
}

/**
 * Parse JSON data from database
 */
function parseData(json: string | null): Record<string, unknown> | undefined {
  if (!json) {
    return undefined;
  }

  try {
    return JSON.parse(json);
  } catch (e) {
    return undefined;
  }
}

/**
 * SQLite Database interface
 * Compatible with better-sqlite3
 */
export interface SQLiteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
}

/**
 * ExecutionStore class
 *
 * Uses better-sqlite3 for synchronous SQLite access.
 */
export class ExecutionStore {
  private db: SQLiteDatabase;
  private initialized = false;

  /**
   * Create an ExecutionStore
   *
   * @param db - SQLite Database instance (better-sqlite3 compatible)
   */
  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  /**
   * Initialize the database schema
   */
  initSchema(): void {
    if (this.initialized) {
      return;
    }

    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    let schema: string;

    try {
      schema = fs.readFileSync(schemaPath, 'utf-8');
    } catch (e) {
      // Fallback: inline schema for bundled environments
      schema = this.getInlineSchema();
    }

    this.db.exec(schema);
    this.initialized = true;
  }

  /**
   * Inline schema for bundled environments
   */
  private getInlineSchema(): string {
    return `
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        workflow_name TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_data TEXT,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER,
        error_message TEXT,
        error_stack TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS execution_steps (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        node_type TEXT NOT NULL,
        node_name TEXT,
        step_index INTEGER NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER,
        status TEXT NOT NULL,
        input_data TEXT,
        output_data TEXT,
        error_message TEXT,
        FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_executions_workflow ON workflow_executions(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions(status);
      CREATE INDEX IF NOT EXISTS idx_executions_started ON workflow_executions(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_executions_workflow_started ON workflow_executions(workflow_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_steps_execution ON execution_steps(execution_id);
      CREATE INDEX IF NOT EXISTS idx_steps_node ON execution_steps(node_id);
      CREATE INDEX IF NOT EXISTS idx_steps_execution_order ON execution_steps(execution_id, step_index);
    `;
  }

  // ===========================================================================
  // EXECUTION CRUD
  // ===========================================================================

  /**
   * Create a new execution record
   */
  createExecution(options: CreateExecutionOptions): string {
    this.initSchema();

    const id = generateId();
    const stmt = this.db.prepare(`
      INSERT INTO workflow_executions (
        id, workflow_id, workflow_name, trigger_type, trigger_data,
        status, started_at, completed_at, duration_ms,
        error_message, error_stack, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      options.workflowId,
      options.workflowName,
      options.triggerType,
      truncateData(options.triggerData),
      options.status,
      options.startedAt,
      options.completedAt ?? null,
      options.durationMs ?? null,
      options.errorMessage ?? null,
      options.errorStack ?? null,
      truncateData(options.metadata)
    );

    return id;
  }

  /**
   * Update an existing execution
   */
  updateExecution(id: string, updates: UpdateExecutionOptions): void {
    this.initSchema();

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt);
    }
    if (updates.durationMs !== undefined) {
      fields.push('duration_ms = ?');
      values.push(updates.durationMs);
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }
    if (updates.errorStack !== undefined) {
      fields.push('error_stack = ?');
      values.push(updates.errorStack);
    }
    if (updates.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(truncateData(updates.metadata));
    }

    if (fields.length === 0) {
      return;
    }

    values.push(id);
    const sql = `UPDATE workflow_executions SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);
  }

  /**
   * Get a single execution by ID
   */
  getExecution(id: string): WorkflowExecution | null {
    this.initSchema();

    const stmt = this.db.prepare('SELECT * FROM workflow_executions WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    return this.rowToExecution(row);
  }

  /**
   * Get execution with all its steps
   */
  getExecutionWithSteps(id: string): ExecutionWithSteps | null {
    const execution = this.getExecution(id);
    if (!execution) {
      return null;
    }

    const steps = this.getStepsForExecution(id);

    return {
      ...execution,
      steps
    };
  }

  /**
   * Query executions with filters and pagination
   */
  queryExecutions(query: ExecutionQuery = {}): WorkflowExecution[] {
    this.initSchema();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.workflowId) {
      conditions.push('workflow_id = ?');
      params.push(query.workflowId);
    }
    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    if (query.triggerType) {
      conditions.push('trigger_type = ?');
      params.push(query.triggerType);
    }
    if (query.startedAfter !== undefined) {
      conditions.push('started_at >= ?');
      params.push(query.startedAfter);
    }
    if (query.startedBefore !== undefined) {
      conditions.push('started_at <= ?');
      params.push(query.startedBefore);
    }

    let sql = 'SELECT * FROM workflow_executions';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    // Order
    const orderBy = query.orderBy || 'started_at';
    const orderDir = query.orderDir || 'desc';
    sql += ` ORDER BY ${orderBy} ${orderDir.toUpperCase()}`;

    // Pagination
    const limit = query.limit ?? DEFAULT_QUERY_LIMIT;
    sql += ' LIMIT ?';
    params.push(limit);

    if (query.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];

    return rows.map((row) => this.rowToExecution(row));
  }

  /**
   * Delete an execution and its steps
   */
  deleteExecution(id: string): void {
    this.initSchema();

    // Steps will be deleted via CASCADE
    const stmt = this.db.prepare('DELETE FROM workflow_executions WHERE id = ?');
    stmt.run(id);
  }

  // ===========================================================================
  // STEP CRUD
  // ===========================================================================

  /**
   * Add a step to an execution
   */
  addStep(options: CreateStepOptions): string {
    this.initSchema();

    const id = generateId().replace('exec_', 'step_');
    const stmt = this.db.prepare(`
      INSERT INTO execution_steps (
        id, execution_id, node_id, node_type, node_name,
        step_index, started_at, completed_at, duration_ms,
        status, input_data, output_data, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      options.executionId,
      options.nodeId,
      options.nodeType,
      options.nodeName ?? null,
      options.stepIndex,
      options.startedAt,
      options.completedAt ?? null,
      options.durationMs ?? null,
      options.status,
      truncateData(options.inputData),
      truncateData(options.outputData),
      options.errorMessage ?? null
    );

    return id;
  }

  /**
   * Update a step
   */
  updateStep(id: string, updates: UpdateStepOptions): void {
    this.initSchema();

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt);
    }
    if (updates.durationMs !== undefined) {
      fields.push('duration_ms = ?');
      values.push(updates.durationMs);
    }
    if (updates.outputData !== undefined) {
      fields.push('output_data = ?');
      values.push(truncateData(updates.outputData));
    }
    if (updates.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(updates.errorMessage);
    }

    if (fields.length === 0) {
      return;
    }

    values.push(id);
    const sql = `UPDATE execution_steps SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);
  }

  /**
   * Get all steps for an execution
   */
  getStepsForExecution(executionId: string): ExecutionStep[] {
    this.initSchema();

    const stmt = this.db.prepare('SELECT * FROM execution_steps WHERE execution_id = ? ORDER BY step_index ASC');
    const rows = stmt.all(executionId) as Record<string, unknown>[];

    return rows.map((row) => this.rowToStep(row));
  }

  // ===========================================================================
  // RETENTION / CLEANUP
  // ===========================================================================

  /**
   * Clean up old executions by age
   */
  cleanupByAge(maxAgeMs: number): number {
    this.initSchema();

    const cutoff = Date.now() - maxAgeMs;
    const stmt = this.db.prepare('DELETE FROM workflow_executions WHERE started_at < ?');
    const result = stmt.run(cutoff);

    return result.changes;
  }

  /**
   * Clean up executions, keeping only N most recent per workflow
   */
  cleanupByCount(maxCount: number, workflowId?: string): number {
    this.initSchema();

    let totalDeleted = 0;

    if (workflowId) {
      // Clean up specific workflow
      totalDeleted = this.cleanupWorkflowByCount(workflowId, maxCount);
    } else {
      // Clean up all workflows
      const workflows = this.db.prepare('SELECT DISTINCT workflow_id FROM workflow_executions').all() as {
        workflow_id: string;
      }[];

      for (const { workflow_id } of workflows) {
        totalDeleted += this.cleanupWorkflowByCount(workflow_id, maxCount);
      }
    }

    return totalDeleted;
  }

  /**
   * Clean up a specific workflow by count
   */
  private cleanupWorkflowByCount(workflowId: string, maxCount: number): number {
    // Get IDs to keep
    const keepStmt = this.db.prepare(`
      SELECT id FROM workflow_executions 
      WHERE workflow_id = ? 
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    const keepIds = (keepStmt.all(workflowId, maxCount) as { id: string }[]).map((r) => r.id);

    if (keepIds.length === 0) {
      return 0;
    }

    // Delete others
    const placeholders = keepIds.map(() => '?').join(',');
    const deleteStmt = this.db.prepare(`
      DELETE FROM workflow_executions 
      WHERE workflow_id = ? AND id NOT IN (${placeholders})
    `);
    const result = deleteStmt.run(workflowId, ...keepIds);

    return result.changes;
  }

  /**
   * Apply retention policy
   */
  applyRetentionPolicy(policy: RetentionPolicy): number {
    let totalDeleted = 0;

    if (policy.maxAgeMs) {
      totalDeleted += this.cleanupByAge(policy.maxAgeMs);
    }

    if (policy.maxCountPerWorkflow) {
      totalDeleted += this.cleanupByCount(policy.maxCountPerWorkflow);
    }

    if (policy.maxTotalCount) {
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM workflow_executions');
      const { count } = countStmt.get() as { count: number };

      if (count > policy.maxTotalCount) {
        // Delete oldest executions
        const toDelete = count - policy.maxTotalCount;
        const deleteStmt = this.db.prepare(`
          DELETE FROM workflow_executions 
          WHERE id IN (
            SELECT id FROM workflow_executions 
            ORDER BY started_at ASC 
            LIMIT ?
          )
        `);
        const result = deleteStmt.run(toDelete);
        totalDeleted += result.changes;
      }
    }

    return totalDeleted;
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get aggregated execution statistics
   */
  getStats(workflowId?: string): ExecutionStats {
    this.initSchema();

    let sql = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_count,
        AVG(duration_ms) as avg_duration,
        MIN(duration_ms) as min_duration,
        MAX(duration_ms) as max_duration
      FROM workflow_executions
    `;

    const params: unknown[] = [];
    if (workflowId) {
      sql += ' WHERE workflow_id = ?';
      params.push(workflowId);
    }

    const row = this.db.prepare(sql).get(...params) as Record<string, number | null>;

    const total = row.total ?? 0;
    const successCount = row.success_count ?? 0;

    return {
      totalExecutions: total,
      successCount,
      errorCount: row.error_count ?? 0,
      runningCount: row.running_count ?? 0,
      avgDurationMs: row.avg_duration ?? 0,
      minDurationMs: row.min_duration ?? 0,
      maxDurationMs: row.max_duration ?? 0,
      successRate: total > 0 ? successCount / total : 0
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Convert database row to WorkflowExecution
   */
  private rowToExecution(row: Record<string, unknown>): WorkflowExecution {
    return {
      id: row.id as string,
      workflowId: row.workflow_id as string,
      workflowName: row.workflow_name as string,
      triggerType: row.trigger_type as WorkflowExecution['triggerType'],
      triggerData: parseData(row.trigger_data as string | null),
      status: row.status as WorkflowExecution['status'],
      startedAt: row.started_at as number,
      completedAt: (row.completed_at as number) || undefined,
      durationMs: (row.duration_ms as number) || undefined,
      errorMessage: (row.error_message as string) || undefined,
      errorStack: (row.error_stack as string) || undefined,
      metadata: parseData(row.metadata as string | null)
    };
  }

  /**
   * Convert database row to ExecutionStep
   */
  private rowToStep(row: Record<string, unknown>): ExecutionStep {
    return {
      id: row.id as string,
      executionId: row.execution_id as string,
      nodeId: row.node_id as string,
      nodeType: row.node_type as string,
      nodeName: (row.node_name as string) || undefined,
      stepIndex: row.step_index as number,
      startedAt: row.started_at as number,
      completedAt: (row.completed_at as number) || undefined,
      durationMs: (row.duration_ms as number) || undefined,
      status: row.status as ExecutionStep['status'],
      inputData: parseData(row.input_data as string | null),
      outputData: parseData(row.output_data as string | null),
      errorMessage: (row.error_message as string) || undefined
    };
  }
}
