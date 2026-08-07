# CF11-005: Execution Logger Integration

## Metadata

| Field              | Value                                        |
| ------------------ | -------------------------------------------- |
| **ID**             | CF11-005                                     |
| **Phase**          | Phase 11                                     |
| **Series**         | 2 - Execution History                        |
| **Priority**       | 🔴 Critical                                  |
| **Difficulty**     | 🟡 Medium                                    |
| **Estimated Time** | 8-10 hours                                   |
| **Prerequisites**  | CF11-004 (Storage Schema), Phase 5 TASK-007C |
| **Branch**         | `feature/cf11-005-execution-logger`          |

## Objective

Integrate execution logging into the CloudRunner workflow engine so that every workflow execution is automatically captured with full node-by-node data.

## Background

CF11-004 provides the storage layer for execution history. This task connects that storage to the actual workflow execution engine, capturing:

- When workflows start/complete
- Input/output data for each node
- Timing information
- Error details when failures occur

This is the "bridge" between runtime and storage - without it, the database remains empty.

## Current State

- ExecutionStore exists (from CF11-004)
- CloudRunner executes workflows
- **No connection between them** - executions are not logged

## Desired State

- Every workflow execution creates a record
- Each node execution creates a step record
- Data flows automatically without explicit logging calls
- Configurable data capture (can disable for performance)

## Scope

### In Scope

- [ ] ExecutionLogger class wrapping ExecutionStore
- [ ] Integration hooks in CloudRunner
- [ ] Node execution instrumentation
- [ ] Configuration for capture settings
- [ ] Data truncation for large payloads
- [ ] Unit tests

### Out of Scope

- UI components (CF11-006)
- Canvas overlay (CF11-007)
- Real-time streaming (future enhancement)

## Technical Approach

### ExecutionLogger Class

```typescript
// packages/noodl-viewer-cloud/src/execution-history/ExecutionLogger.ts

export interface LoggerConfig {
  enabled: boolean;
  captureInputs: boolean;
  captureOutputs: boolean;
  maxDataSize: number; // bytes, truncate above this
  retentionDays: number;
}

export class ExecutionLogger {
  private store: ExecutionStore;
  private config: LoggerConfig;
  private currentExecution: string | null = null;
  private stepIndex: number = 0;

  constructor(store: ExecutionStore, config?: Partial<LoggerConfig>) {
    this.store = store;
    this.config = {
      enabled: true,
      captureInputs: true,
      captureOutputs: true,
      maxDataSize: 100_000, // 100KB default
      retentionDays: 30,
      ...config
    };
  }

  // === Execution Lifecycle ===

  async startExecution(params: {
    workflowId: string;
    workflowName: string;
    triggerType: TriggerType;
    triggerData?: Record<string, unknown>;
  }): Promise<string> {
    if (!this.config.enabled) return '';

    const executionId = await this.store.createExecution({
      workflowId: params.workflowId,
      workflowName: params.workflowName,
      triggerType: params.triggerType,
      triggerData: params.triggerData,
      status: 'running',
      startedAt: Date.now()
    });

    this.currentExecution = executionId;
    this.stepIndex = 0;
    return executionId;
  }

  async completeExecution(success: boolean, error?: Error): Promise<void> {
    if (!this.config.enabled || !this.currentExecution) return;

    await this.store.updateExecution(this.currentExecution, {
      status: success ? 'success' : 'error',
      completedAt: Date.now(),
      durationMs: Date.now() - /* startedAt */,
      errorMessage: error?.message,
      errorStack: error?.stack
    });

    this.currentExecution = null;
  }

  // === Node Lifecycle ===

  async startNode(params: {
    nodeId: string;
    nodeType: string;
    nodeName?: string;
    inputData?: Record<string, unknown>;
  }): Promise<string> {
    if (!this.config.enabled || !this.currentExecution) return '';

    const stepId = await this.store.addStep({
      executionId: this.currentExecution,
      nodeId: params.nodeId,
      nodeType: params.nodeType,
      nodeName: params.nodeName,
      stepIndex: this.stepIndex++,
      startedAt: Date.now(),
      status: 'running',
      inputData: this.config.captureInputs
        ? this.truncateData(params.inputData)
        : undefined
    });

    return stepId;
  }

  async completeNode(
    stepId: string,
    success: boolean,
    outputData?: Record<string, unknown>,
    error?: Error
  ): Promise<void> {
    if (!this.config.enabled || !stepId) return;

    await this.store.updateStep(stepId, {
      status: success ? 'success' : 'error',
      completedAt: Date.now(),
      outputData: this.config.captureOutputs
        ? this.truncateData(outputData)
        : undefined,
      errorMessage: error?.message
    });
  }

  // === Utilities ===

  private truncateData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!data) return undefined;
    const json = JSON.stringify(data);
    if (json.length <= this.config.maxDataSize) return data;

    return {
      _truncated: true,
      _originalSize: json.length,
      _preview: json.substring(0, 1000) + '...'
    };
  }

  async runRetentionCleanup(): Promise<number> {
    const maxAge = this.config.retentionDays * 24 * 60 * 60 * 1000;
    return this.store.cleanupOldExecutions(maxAge);
  }
}
```

### CloudRunner Integration Points

The CloudRunner needs hooks at these points:

```typescript
// packages/noodl-viewer-cloud/src/cloudrunner.ts

class CloudRunner {
  private logger: ExecutionLogger;

  async executeWorkflow(workflow: Component, trigger: TriggerInfo): Promise<void> {
    // 1. Start execution logging
    const executionId = await this.logger.startExecution({
      workflowId: workflow.id,
      workflowName: workflow.name,
      triggerType: trigger.type,
      triggerData: trigger.data
    });

    try {
      // 2. Execute nodes (with per-node logging)
      for (const node of this.getExecutionOrder(workflow)) {
        await this.executeNode(node, executionId);
      }

      // 3. Complete successfully
      await this.logger.completeExecution(true);
    } catch (error) {
      // 4. Complete with error
      await this.logger.completeExecution(false, error);
      throw error;
    }
  }

  private async executeNode(node: RuntimeNode, executionId: string): Promise<void> {
    // Get input data from connected nodes
    const inputData = this.collectNodeInputs(node);

    // Start node logging
    const stepId = await this.logger.startNode({
      nodeId: node.id,
      nodeType: node.type,
      nodeName: node.label,
      inputData
    });

    try {
      // Actually execute the node
      await node.execute();

      // Get output data
      const outputData = this.collectNodeOutputs(node);

      // Complete node logging
      await this.logger.completeNode(stepId, true, outputData);
    } catch (error) {
      await this.logger.completeNode(stepId, false, undefined, error);
      throw error;
    }
  }
}
```

### Key Files to Modify/Create

| File                                   | Action | Purpose              |
| -------------------------------------- | ------ | -------------------- |
| `execution-history/ExecutionLogger.ts` | Create | Logger wrapper class |
| `execution-history/index.ts`           | Update | Export logger        |
| `cloudrunner.ts`                       | Modify | Add logging hooks    |
| `tests/execution-logger.test.ts`       | Create | Unit tests           |

## Implementation Steps

### Step 1: Create ExecutionLogger Class (3h)

1. Create `ExecutionLogger.ts`
2. Implement execution lifecycle methods
3. Implement node lifecycle methods
4. Implement data truncation
5. Add configuration handling

### Step 2: Integrate with CloudRunner (3h)

1. Identify hook points in CloudRunner
2. Add logger initialization
3. Instrument workflow execution
4. Instrument individual node execution
5. Handle errors properly

### Step 3: Add Configuration (1h)

1. Add project-level settings for logging
2. Environment variable overrides
3. Runtime toggle capability

### Step 4: Write Tests (2h)

1. Test logger with mock store
2. Test data truncation
3. Test error handling
4. Integration test with CloudRunner

## Testing Plan

### Unit Tests

- [ ] Logger creates execution on start
- [ ] Logger updates execution on complete
- [ ] Logger handles success path
- [ ] Logger handles error path
- [ ] Node steps are recorded correctly
- [ ] Data truncation works for large payloads
- [ ] Disabled logger is a no-op
- [ ] Retention cleanup works

### Integration Tests

- [ ] Full workflow execution is captured
- [ ] All nodes have step records
- [ ] Input/output data is captured
- [ ] Error workflows have error details
- [ ] Multiple concurrent workflows work

## Success Criteria

- [ ] ExecutionLogger class implemented
- [ ] CloudRunner integration complete
- [ ] All workflow executions create records
- [ ] Node steps are captured with data
- [ ] Errors are captured with details
- [ ] Data truncation prevents storage bloat
- [ ] Configuration allows disabling
- [ ] All tests pass

## Risks & Mitigations

| Risk                            | Mitigation                         |
| ------------------------------- | ---------------------------------- |
| Performance overhead            | Make logging async, configurable   |
| Large data payloads             | Truncation with configurable limit |
| Failed logging crashes workflow | Wrap in try/catch, fail gracefully |
| CloudRunner changes in Phase 5  | Coordinate with Phase 5 TASK-007C  |

## References

- [CF11-004 Execution Storage Schema](../CF11-004-execution-storage-schema/README.md)
- [Phase 5 TASK-007C Workflow Runtime](../../phase-5-multi-target-deployment/01-byob-backend/TASK-007-integrated-backend/TASK-007C-workflow-runtime.md)
