/**
 * Execution History Module
 *
 * Provides storage and querying for workflow execution history.
 * Uses SQLite for local storage with support for retention policies.
 *
 * @module execution-history
 *
 * @example
 * ```typescript
 * import Database from 'better-sqlite3';
 * import { ExecutionStore } from './execution-history';
 *
 * const db = new Database('./executions.db');
 * const store = new ExecutionStore(db);
 *
 * // Create an execution
 * const execId = store.createExecution({
 *   workflowId: 'wf-123',
 *   workflowName: 'My Workflow',
 *   triggerType: 'manual',
 *   status: 'running',
 *   startedAt: Date.now()
 * });
 *
 * // Add steps as nodes execute
 * store.addStep({
 *   executionId: execId,
 *   nodeId: 'node-1',
 *   nodeType: 'noodl.logic.condition',
 *   stepIndex: 0,
 *   startedAt: Date.now(),
 *   status: 'running',
 *   inputData: { condition: true }
 * });
 *
 * // Complete the execution
 * store.updateExecution(execId, {
 *   status: 'success',
 *   completedAt: Date.now(),
 *   durationMs: 1234
 * });
 *
 * // Query executions
 * const recent = store.queryExecutions({
 *   workflowId: 'wf-123',
 *   status: 'error',
 *   limit: 10
 * });
 * ```
 */

// Export store
export { ExecutionStore } from './store';
export type { SQLiteDatabase } from './store';

// Export logger
export { ExecutionLogger } from './ExecutionLogger';
export type { LoggerConfig, StartExecutionParams, StartNodeParams } from './ExecutionLogger';

// Export types
export type {
  // Status types
  ExecutionStatus,
  StepStatus,
  TriggerType,
  // Main interfaces
  WorkflowExecution,
  ExecutionStep,
  ExecutionWithSteps,
  // Query interfaces
  ExecutionQuery,
  ExecutionStats,
  RetentionPolicy,
  // Option types
  CreateExecutionOptions,
  CreateStepOptions,
  UpdateExecutionOptions,
  UpdateStepOptions
} from './types';

// Export request scrubbing (WF-004: shared by the editor and the standalone
// backend service so both log with the same redaction rules; BAK-009 made it
// the single rule for the service's structured logs and audit trail too)
export { scrubHeaders, scrubValue, scrubRequestForLogging, SENSITIVE_KEY_PATTERN } from './scrub';
export type { ScrubbedRequestSummary } from './scrub';
