/**
 * Execution History Type Definitions
 *
 * Types for storing and querying workflow execution history.
 * Used by ExecutionStore and the execution history UI.
 *
 * @module execution-history/types
 */

/**
 * Status of a workflow execution
 */
export type ExecutionStatus = 'running' | 'success' | 'error';

/**
 * Status of an individual execution step (node)
 */
export type StepStatus = 'running' | 'success' | 'error' | 'skipped';

/**
 * Type of trigger that started the workflow
 */
export type TriggerType = 'webhook' | 'schedule' | 'manual' | 'db_change' | 'internal_event' | 'test';

/**
 * Workflow execution record
 *
 * Represents a single run of a workflow, from start to completion.
 */
export interface WorkflowExecution {
  /** Unique execution ID */
  id: string;

  /** ID of the workflow component */
  workflowId: string;

  /** Display name of the workflow */
  workflowName: string;

  /** What triggered this execution */
  triggerType: TriggerType;

  /** Trigger-specific data (request body, cron expression, etc.) */
  triggerData?: Record<string, unknown>;

  /** Current execution status */
  status: ExecutionStatus;

  /** Unix timestamp (ms) when execution started */
  startedAt: number;

  /** Unix timestamp (ms) when execution completed */
  completedAt?: number;

  /** Total duration in milliseconds */
  durationMs?: number;

  /** Error message if status is 'error' */
  errorMessage?: string;

  /** Error stack trace if available */
  errorStack?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Execution step record
 *
 * Represents the execution of a single node within a workflow.
 */
export interface ExecutionStep {
  /** Unique step ID */
  id: string;

  /** Parent execution ID */
  executionId: string;

  /** ID of the node in the graph */
  nodeId: string;

  /** Type of node (e.g., 'noodl.logic.condition') */
  nodeType: string;

  /** Display name of the node */
  nodeName?: string;

  /** Order in which this step was executed (0-based) */
  stepIndex: number;

  /** Unix timestamp (ms) when step started */
  startedAt: number;

  /** Unix timestamp (ms) when step completed */
  completedAt?: number;

  /** Step duration in milliseconds */
  durationMs?: number;

  /** Step execution status */
  status: StepStatus;

  /** Input data received by the node (may be truncated) */
  inputData?: Record<string, unknown>;

  /** Output data produced by the node (may be truncated) */
  outputData?: Record<string, unknown>;

  /** Error message if step failed */
  errorMessage?: string;
}

/**
 * Query parameters for filtering executions
 */
export interface ExecutionQuery {
  /** Filter by workflow ID */
  workflowId?: string;

  /** Filter by status */
  status?: ExecutionStatus;

  /** Filter by trigger type */
  triggerType?: TriggerType;

  /** Filter executions started after this timestamp (ms) */
  startedAfter?: number;

  /** Filter executions started before this timestamp (ms) */
  startedBefore?: number;

  /** Maximum number of results to return */
  limit?: number;

  /** Number of results to skip (for pagination) */
  offset?: number;

  /** Field to sort by */
  orderBy?: 'started_at' | 'duration_ms' | 'status';

  /** Sort direction */
  orderDir?: 'asc' | 'desc';
}

/**
 * Execution with all its steps
 */
export interface ExecutionWithSteps extends WorkflowExecution {
  /** All steps in this execution */
  steps: ExecutionStep[];
}

/**
 * Aggregated execution statistics
 */
export interface ExecutionStats {
  /** Total number of executions */
  totalExecutions: number;

  /** Number of successful executions */
  successCount: number;

  /** Number of failed executions */
  errorCount: number;

  /** Number of running executions */
  runningCount: number;

  /** Average execution duration (ms) */
  avgDurationMs: number;

  /** Minimum execution duration (ms) */
  minDurationMs: number;

  /** Maximum execution duration (ms) */
  maxDurationMs: number;

  /** Success rate (0-1) */
  successRate: number;
}

/**
 * Retention policy configuration
 */
export interface RetentionPolicy {
  /** Maximum age of executions to keep (ms) */
  maxAgeMs?: number;

  /** Maximum number of executions to keep per workflow */
  maxCountPerWorkflow?: number;

  /** Maximum total number of executions */
  maxTotalCount?: number;

  /** Whether to keep failed executions longer */
  keepFailedExecutions?: boolean;
}

/**
 * Options for creating an execution
 */
export type CreateExecutionOptions = Omit<WorkflowExecution, 'id'>;

/**
 * Options for adding a step
 */
export type CreateStepOptions = Omit<ExecutionStep, 'id'>;

/**
 * Options for updating an execution
 */
export type UpdateExecutionOptions = Partial<
  Pick<WorkflowExecution, 'status' | 'completedAt' | 'durationMs' | 'errorMessage' | 'errorStack' | 'metadata'>
>;

/**
 * Options for updating a step
 */
export type UpdateStepOptions = Partial<
  Pick<ExecutionStep, 'status' | 'completedAt' | 'durationMs' | 'outputData' | 'errorMessage'>
>;
