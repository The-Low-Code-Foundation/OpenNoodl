/**
 * Unit tests for ExecutionLogger
 *
 * Tests lifecycle methods, configuration, and data handling.
 */

import { ExecutionLogger, ExecutionStore, SQLiteDatabase } from '../src/execution-history';

/**
 * Mock ExecutionStore that tracks calls for testing
 */
class MockExecutionStore {
  public executions: Map<string, Record<string, unknown>> = new Map();
  public steps: Map<string, Record<string, unknown>> = new Map();
  public calls: Array<{ method: string; args: unknown[] }> = [];
  private executionCounter = 0;
  private stepCounter = 0;

  createExecution(options: Record<string, unknown>): string {
    const id = `exec_${++this.executionCounter}`;
    this.executions.set(id, { id, ...options });
    this.calls.push({ method: 'createExecution', args: [options] });
    return id;
  }

  updateExecution(id: string, updates: Record<string, unknown>): void {
    const exec = this.executions.get(id);
    if (exec) {
      Object.assign(exec, updates);
    }
    this.calls.push({ method: 'updateExecution', args: [id, updates] });
  }

  addStep(options: Record<string, unknown>): string {
    const id = `step_${++this.stepCounter}`;
    this.steps.set(id, { id, ...options });
    this.calls.push({ method: 'addStep', args: [options] });
    return id;
  }

  updateStep(id: string, updates: Record<string, unknown>): void {
    const step = this.steps.get(id);
    if (step) {
      Object.assign(step, updates);
    }
    this.calls.push({ method: 'updateStep', args: [id, updates] });
  }

  cleanupByAge(maxAgeMs: number): number {
    this.calls.push({ method: 'cleanupByAge', args: [maxAgeMs] });
    return 0;
  }

  // Test helpers
  reset(): void {
    this.executions.clear();
    this.steps.clear();
    this.calls = [];
    this.executionCounter = 0;
    this.stepCounter = 0;
  }
}

describe('ExecutionLogger', () => {
  let store: MockExecutionStore;
  let logger: ExecutionLogger;

  beforeEach(() => {
    store = new MockExecutionStore();
    logger = new ExecutionLogger(store as unknown as ExecutionStore);
  });

  describe('configuration', () => {
    it('should be enabled by default', () => {
      expect(logger.isEnabled).toBe(true);
    });

    it('should allow disabling logging', () => {
      logger.setEnabled(false);
      expect(logger.isEnabled).toBe(false);
    });

    it('should return default config values', () => {
      const config = logger.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.captureInputs).toBe(true);
      expect(config.captureOutputs).toBe(true);
      expect(config.maxDataSize).toBe(100_000);
      expect(config.retentionDays).toBe(30);
    });

    it('should allow custom config on construction', () => {
      const customLogger = new ExecutionLogger(store as unknown as ExecutionStore, {
        captureInputs: false,
        retentionDays: 7
      });
      const config = customLogger.getConfig();
      expect(config.captureInputs).toBe(false);
      expect(config.retentionDays).toBe(7);
    });

    it('should allow updating config', () => {
      logger.updateConfig({ maxDataSize: 50_000 });
      expect(logger.getConfig().maxDataSize).toBe(50_000);
    });
  });

  describe('execution lifecycle', () => {
    it('should create an execution on start', () => {
      const execId = logger.startExecution({
        workflowId: 'wf-123',
        workflowName: 'Test Workflow',
        triggerType: 'manual'
      });

      expect(execId).toBe('exec_1');
      expect(store.executions.size).toBe(1);

      const exec = store.executions.get(execId);
      expect(exec?.workflowId).toBe('wf-123');
      expect(exec?.workflowName).toBe('Test Workflow');
      expect(exec?.triggerType).toBe('manual');
      expect(exec?.status).toBe('running');
    });

    it('should return empty string when disabled', () => {
      logger.setEnabled(false);
      const execId = logger.startExecution({
        workflowId: 'wf-123',
        workflowName: 'Test',
        triggerType: 'manual'
      });
      expect(execId).toBe('');
      expect(store.executions.size).toBe(0);
    });

    it('should complete execution with success', () => {
      const execId = logger.startExecution({
        workflowId: 'wf-123',
        workflowName: 'Test',
        triggerType: 'manual'
      });

      logger.completeExecution(true);

      const exec = store.executions.get(execId);
      expect(exec?.status).toBe('success');
      expect(exec?.completedAt).toBeDefined();
      expect(exec?.durationMs).toBeDefined();
    });

    it('should complete execution with error', () => {
      const execId = logger.startExecution({
        workflowId: 'wf-123',
        workflowName: 'Test',
        triggerType: 'manual'
      });

      const error = new Error('Test error');
      logger.completeExecution(false, error);

      const exec = store.executions.get(execId);
      expect(exec?.status).toBe('error');
      expect(exec?.errorMessage).toBe('Test error');
    });

    it('should track current execution ID', () => {
      expect(logger.hasActiveExecution()).toBe(false);
      expect(logger.getCurrentExecutionId()).toBeNull();

      logger.startExecution({
        workflowId: 'wf-123',
        workflowName: 'Test',
        triggerType: 'manual'
      });

      expect(logger.hasActiveExecution()).toBe(true);
      expect(logger.getCurrentExecutionId()).toBe('exec_1');

      logger.completeExecution(true);

      expect(logger.hasActiveExecution()).toBe(false);
      expect(logger.getCurrentExecutionId()).toBeNull();
    });

    it('should store trigger data', () => {
      logger.startExecution({
        workflowId: 'wf-123',
        workflowName: 'Test',
        triggerType: 'webhook',
        triggerData: { path: '/api/hook', method: 'POST' }
      });

      const exec = store.executions.get('exec_1');
      expect(exec?.triggerData).toEqual({ path: '/api/hook', method: 'POST' });
    });

    it('should store metadata', () => {
      logger.startExecution({
        workflowId: 'wf-123',
        workflowName: 'Test',
        triggerType: 'manual',
        metadata: { version: '1.0', user: 'test@example.com' }
      });

      const exec = store.executions.get('exec_1');
      expect(exec?.metadata).toEqual({ version: '1.0', user: 'test@example.com' });
    });
  });

  describe('node lifecycle', () => {
    beforeEach(() => {
      logger.startExecution({
        workflowId: 'wf-123',
        workflowName: 'Test',
        triggerType: 'manual'
      });
    });

    it('should create a step on startNode', () => {
      const stepId = logger.startNode({
        nodeId: 'node-1',
        nodeType: 'noodl.logic.condition',
        nodeName: 'Check Condition'
      });

      expect(stepId).toBe('step_1');
      expect(store.steps.size).toBe(1);

      const step = store.steps.get(stepId);
      expect(step?.nodeId).toBe('node-1');
      expect(step?.nodeType).toBe('noodl.logic.condition');
      expect(step?.nodeName).toBe('Check Condition');
      expect(step?.status).toBe('running');
      expect(step?.stepIndex).toBe(0);
    });

    it('should capture input data when enabled', () => {
      logger.startNode({
        nodeId: 'node-1',
        nodeType: 'test',
        inputData: { value: 42, name: 'test' }
      });

      const step = store.steps.get('step_1');
      expect(step?.inputData).toEqual({ value: 42, name: 'test' });
    });

    it('should not capture input data when disabled', () => {
      logger.updateConfig({ captureInputs: false });

      logger.startNode({
        nodeId: 'node-1',
        nodeType: 'test',
        inputData: { value: 42 }
      });

      const step = store.steps.get('step_1');
      expect(step?.inputData).toBeUndefined();
    });

    it('should complete node with success', () => {
      const stepId = logger.startNode({
        nodeId: 'node-1',
        nodeType: 'test'
      });

      logger.completeNode(stepId, true, { result: 'done' });

      const step = store.steps.get(stepId);
      expect(step?.status).toBe('success');
      expect(step?.outputData).toEqual({ result: 'done' });
      expect(step?.completedAt).toBeDefined();
    });

    it('should complete node with error', () => {
      const stepId = logger.startNode({
        nodeId: 'node-1',
        nodeType: 'test'
      });

      const error = new Error('Node failed');
      logger.completeNode(stepId, false, undefined, error);

      const step = store.steps.get(stepId);
      expect(step?.status).toBe('error');
      expect(step?.errorMessage).toBe('Node failed');
    });

    it('should not capture output data when disabled', () => {
      logger.updateConfig({ captureOutputs: false });

      const stepId = logger.startNode({
        nodeId: 'node-1',
        nodeType: 'test'
      });

      logger.completeNode(stepId, true, { secret: 'data' });

      const step = store.steps.get(stepId);
      expect(step?.outputData).toBeUndefined();
    });

    it('should increment step index for each node', () => {
      logger.startNode({ nodeId: 'node-1', nodeType: 'test' });
      logger.startNode({ nodeId: 'node-2', nodeType: 'test' });
      logger.startNode({ nodeId: 'node-3', nodeType: 'test' });

      const step1 = store.steps.get('step_1');
      const step2 = store.steps.get('step_2');
      const step3 = store.steps.get('step_3');

      expect(step1?.stepIndex).toBe(0);
      expect(step2?.stepIndex).toBe(1);
      expect(step3?.stepIndex).toBe(2);
    });

    it('should return empty string for startNode without active execution', () => {
      logger.completeExecution(true);

      const stepId = logger.startNode({
        nodeId: 'node-1',
        nodeType: 'test'
      });

      expect(stepId).toBe('');
    });

    it('should handle skipNode', () => {
      const stepId = logger.skipNode({
        nodeId: 'node-1',
        nodeType: 'noodl.logic.branch',
        nodeName: 'Skip Branch'
      });

      const step = store.steps.get(stepId);
      expect(step?.status).toBe('skipped');
      expect(step?.durationMs).toBe(0);
    });
  });

  describe('data truncation', () => {
    beforeEach(() => {
      logger.startExecution({
        workflowId: 'wf-123',
        workflowName: 'Test',
        triggerType: 'manual'
      });
    });

    it('should truncate large input data', () => {
      // Set small max size for testing
      logger.updateConfig({ maxDataSize: 100 });

      const largeData = { bigValue: 'x'.repeat(200) };
      logger.startNode({
        nodeId: 'node-1',
        nodeType: 'test',
        inputData: largeData
      });

      const step = store.steps.get('step_1');
      const inputData = step?.inputData as Record<string, unknown> | undefined;
      expect(inputData?.__truncated).toBe(true);
      expect(inputData?.__originalSize).toBeGreaterThan(100);
    });

    it('should not truncate small data', () => {
      const smallData = { value: 'small' };
      logger.startNode({
        nodeId: 'node-1',
        nodeType: 'test',
        inputData: smallData
      });

      const step = store.steps.get('step_1');
      expect(step?.inputData).toEqual(smallData);
    });
  });

  describe('retention', () => {
    it('should call cleanupByAge with correct value', () => {
      logger.updateConfig({ retentionDays: 7 });
      logger.runRetentionCleanup();

      expect(store.calls).toContainEqual({
        method: 'cleanupByAge',
        args: [7 * 24 * 60 * 60 * 1000]
      });
    });
  });

  describe('getStore', () => {
    it('should return the underlying store', () => {
      const returnedStore = logger.getStore();
      expect(returnedStore).toBe(store);
    });
  });

  describe('state management', () => {
    it('should reset state between executions', () => {
      // First execution
      logger.startExecution({
        workflowId: 'wf-1',
        workflowName: 'First',
        triggerType: 'manual'
      });
      logger.startNode({ nodeId: 'node-1', nodeType: 'test' });
      logger.startNode({ nodeId: 'node-2', nodeType: 'test' });
      logger.completeExecution(true);

      // Second execution should start fresh
      logger.startExecution({
        workflowId: 'wf-2',
        workflowName: 'Second',
        triggerType: 'manual'
      });
      logger.startNode({ nodeId: 'node-3', nodeType: 'test' });

      // Step index should be 0 for new execution
      const step = store.steps.get('step_3');
      expect(step?.stepIndex).toBe(0);
    });

    it('should handle multiple executions sequentially', () => {
      for (let i = 1; i <= 3; i++) {
        logger.startExecution({
          workflowId: `wf-${i}`,
          workflowName: `Workflow ${i}`,
          triggerType: 'manual'
        });
        logger.startNode({ nodeId: `node-${i}`, nodeType: 'test' });
        logger.completeExecution(true);
      }

      expect(store.executions.size).toBe(3);
      expect(store.steps.size).toBe(3);
    });
  });
});
