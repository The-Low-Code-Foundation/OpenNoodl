/**
 * ExecutionLogger - High-level API for logging workflow executions
 *
 * Provides lifecycle methods for tracking workflow and node executions.
 * Wraps ExecutionStore with additional features like:
 * - Configuration for enabling/disabling capture
 * - Automatic data truncation
 * - State management for current execution
 * - Retention policy enforcement
 *
 * @module execution-history/ExecutionLogger
 *
 * @example
 * ```typescript
 * const logger = new ExecutionLogger(store, { enabled: true });
 *
 * // Start a workflow execution
 * const execId = logger.startExecution({
 *   workflowId: 'wf-123',
 *   workflowName: 'My Workflow',
 *   triggerType: 'webhook',
 *   triggerData: { path: '/api/hook' }
 * });
 *
 * // Log node executions
 * const stepId = logger.startNode({
 *   nodeId: 'node-1',
 *   nodeType: 'noodl.logic.condition',
 *   inputData: { value: true }
 * });
 * logger.completeNode(stepId, true, { result: false });
 *
 * // Complete the workflow
 * logger.completeExecution(true);
 * ```
 */

import type { ExecutionStore } from './store';
import type { TriggerType } from './types';

/**
 * Configuration for ExecutionLogger
 */
export interface LoggerConfig {
  /** Whether logging is enabled (default: true) */
  enabled: boolean;

  /** Whether to capture input data for nodes (default: true) */
  captureInputs: boolean;

  /** Whether to capture output data for nodes (default: true) */
  captureOutputs: boolean;

  /** Maximum size for JSON data in bytes (default: 100KB) */
  maxDataSize: number;

  /** Number of days to retain execution records (default: 30) */
  retentionDays: number;
}

/**
 * Parameters for starting an execution
 */
export interface StartExecutionParams {
  /** ID of the workflow component */
  workflowId: string;

  /** Display name of the workflow */
  workflowName: string;

  /** Type of trigger that started the workflow */
  triggerType: TriggerType;

  /** Trigger-specific data */
  triggerData?: Record<string, unknown>;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for starting a node execution
 */
export interface StartNodeParams {
  /** ID of the node in the graph */
  nodeId: string;

  /** Type of node */
  nodeType: string;

  /** Display name of the node */
  nodeName?: string;

  /** Input data received by the node */
  inputData?: Record<string, unknown>;
}

/** Default logger configuration */
const DEFAULT_CONFIG: LoggerConfig = {
  enabled: true,
  captureInputs: true,
  captureOutputs: true,
  maxDataSize: 100_000, // 100KB
  retentionDays: 30
};

/**
 * ExecutionLogger class
 *
 * High-level API for logging workflow executions with lifecycle management.
 */
export class ExecutionLogger {
  private store: ExecutionStore;
  private config: LoggerConfig;

  // Current execution state
  private currentExecutionId: string | null = null;
  private executionStartTime: number = 0;
  private stepIndex: number = 0;

  // Track active steps for timing
  private activeSteps: Map<string, number> = new Map();

  /**
   * Create an ExecutionLogger
   *
   * @param store - ExecutionStore instance
   * @param config - Optional configuration overrides
   */
  constructor(store: ExecutionStore, config?: Partial<LoggerConfig>) {
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /**
   * Check if logging is enabled
   */
  get isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }

  // ===========================================================================
  // EXECUTION LIFECYCLE
  // ===========================================================================

  /**
   * Start logging a workflow execution
   *
   * @param params - Execution parameters
   * @returns Execution ID (empty string if logging is disabled)
   */
  startExecution(params: StartExecutionParams): string {
    if (!this.config.enabled) {
      return '';
    }

    // Clean up any previous execution state
    this.resetState();

    const now = Date.now();
    this.executionStartTime = now;

    const executionId = this.store.createExecution({
      workflowId: params.workflowId,
      workflowName: params.workflowName,
      triggerType: params.triggerType,
      triggerData: this.truncateData(params.triggerData),
      status: 'running',
      startedAt: now,
      metadata: this.truncateData(params.metadata)
    });

    this.currentExecutionId = executionId;
    return executionId;
  }

  /**
   * Complete the current workflow execution
   *
   * @param success - Whether the execution succeeded
   * @param error - Error if execution failed
   */
  completeExecution(success: boolean, error?: Error): void {
    if (!this.config.enabled || !this.currentExecutionId) {
      return;
    }

    const now = Date.now();
    const durationMs = now - this.executionStartTime;

    this.store.updateExecution(this.currentExecutionId, {
      status: success ? 'success' : 'error',
      completedAt: now,
      durationMs,
      errorMessage: error?.message,
      errorStack: error?.stack
    });

    // Clean up state
    this.resetState();
  }

  /**
   * Get the current execution ID
   */
  getCurrentExecutionId(): string | null {
    return this.currentExecutionId;
  }

  /**
   * Check if there's an active execution
   */
  hasActiveExecution(): boolean {
    return this.currentExecutionId !== null;
  }

  // ===========================================================================
  // NODE LIFECYCLE
  // ===========================================================================

  /**
   * Start logging a node execution
   *
   * @param params - Node parameters
   * @returns Step ID (empty string if logging is disabled or no active execution)
   */
  startNode(params: StartNodeParams): string {
    if (!this.config.enabled || !this.currentExecutionId) {
      return '';
    }

    const now = Date.now();

    const stepId = this.store.addStep({
      executionId: this.currentExecutionId,
      nodeId: params.nodeId,
      nodeType: params.nodeType,
      nodeName: params.nodeName,
      stepIndex: this.stepIndex++,
      startedAt: now,
      status: 'running',
      inputData: this.config.captureInputs ? this.truncateData(params.inputData) : undefined
    });

    // Track start time for duration calculation
    this.activeSteps.set(stepId, now);

    return stepId;
  }

  /**
   * Complete a node execution
   *
   * @param stepId - Step ID returned from startNode
   * @param success - Whether the node execution succeeded
   * @param outputData - Output data produced by the node
   * @param error - Error if node failed
   */
  completeNode(stepId: string, success: boolean, outputData?: Record<string, unknown>, error?: Error): void {
    if (!this.config.enabled || !stepId) {
      return;
    }

    const now = Date.now();
    const startTime = this.activeSteps.get(stepId);
    const durationMs = startTime ? now - startTime : undefined;

    this.store.updateStep(stepId, {
      status: success ? 'success' : 'error',
      completedAt: now,
      durationMs,
      outputData: this.config.captureOutputs ? this.truncateData(outputData) : undefined,
      errorMessage: error?.message
    });

    // Clean up tracking
    this.activeSteps.delete(stepId);
  }

  /**
   * Mark a node as skipped
   *
   * @param params - Node parameters
   * @returns Step ID
   */
  skipNode(params: StartNodeParams): string {
    if (!this.config.enabled || !this.currentExecutionId) {
      return '';
    }

    const now = Date.now();

    return this.store.addStep({
      executionId: this.currentExecutionId,
      nodeId: params.nodeId,
      nodeType: params.nodeType,
      nodeName: params.nodeName,
      stepIndex: this.stepIndex++,
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      status: 'skipped'
    });
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  /**
   * Truncate data if it exceeds the maximum size
   */
  private truncateData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (data === undefined || data === null) {
      return undefined;
    }

    try {
      const json = JSON.stringify(data);
      if (json.length <= this.config.maxDataSize) {
        return data;
      }

      // Return truncated indicator
      return {
        __truncated: true,
        __originalSize: json.length,
        __maxSize: this.config.maxDataSize,
        __preview: json.substring(0, 1000) + '...'
      };
    } catch (e) {
      return {
        __error: 'Failed to serialize data',
        __message: e instanceof Error ? e.message : 'Unknown error'
      };
    }
  }

  /**
   * Reset internal state
   */
  private resetState(): void {
    this.currentExecutionId = null;
    this.executionStartTime = 0;
    this.stepIndex = 0;
    this.activeSteps.clear();
  }

  // ===========================================================================
  // RETENTION
  // ===========================================================================

  /**
   * Run retention cleanup based on configured policy
   *
   * @returns Number of executions deleted
   */
  runRetentionCleanup(): number {
    const maxAgeMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    return this.store.cleanupByAge(maxAgeMs);
  }

  /**
   * Get the underlying store for advanced queries
   */
  getStore(): ExecutionStore {
    return this.store;
  }
}
