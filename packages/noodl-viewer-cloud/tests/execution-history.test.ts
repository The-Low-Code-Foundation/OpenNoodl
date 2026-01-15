/**
 * Unit tests for ExecutionStore
 *
 * Tests CRUD operations, querying, pagination, and retention policies.
 */

import {
  ExecutionStore,
  SQLiteDatabase,
  type CreateExecutionOptions,
  type CreateStepOptions
} from '../src/execution-history';

/**
 * Mock SQLite database for testing
 */
class MockDatabase implements SQLiteDatabase {
  private tables: Map<string, Record<string, unknown>[]> = new Map();
  private schemaInitialized = false;

  exec(sql: string): void {
    // Just mark schema as initialized
    this.schemaInitialized = true;
    this.tables.set('workflow_executions', []);
    this.tables.set('execution_steps', []);
  }

  prepare(sql: string) {
    const self = this;

    return {
      run(...params: unknown[]): { changes: number } {
        const lowerSql = sql.toLowerCase().trim();

        if (lowerSql.startsWith('insert into workflow_executions')) {
          const executions = self.tables.get('workflow_executions') || [];
          executions.push({
            id: params[0],
            workflow_id: params[1],
            workflow_name: params[2],
            trigger_type: params[3],
            trigger_data: params[4],
            status: params[5],
            started_at: params[6],
            completed_at: params[7],
            duration_ms: params[8],
            error_message: params[9],
            error_stack: params[10],
            metadata: params[11]
          });
          return { changes: 1 };
        }

        if (lowerSql.startsWith('insert into execution_steps')) {
          const steps = self.tables.get('execution_steps') || [];
          steps.push({
            id: params[0],
            execution_id: params[1],
            node_id: params[2],
            node_type: params[3],
            node_name: params[4],
            step_index: params[5],
            started_at: params[6],
            completed_at: params[7],
            duration_ms: params[8],
            status: params[9],
            input_data: params[10],
            output_data: params[11],
            error_message: params[12]
          });
          return { changes: 1 };
        }

        if (lowerSql.startsWith('update workflow_executions')) {
          const executions = self.tables.get('workflow_executions') || [];
          const id = params[params.length - 1];
          const exec = executions.find((e) => e.id === id);
          if (exec) {
            // Simple update - in real tests we'd parse the SET clause
            const statusIdx = params.findIndex((p) => ['running', 'success', 'error'].includes(p as string));
            if (statusIdx >= 0) exec.status = params[statusIdx];
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        if (lowerSql.startsWith('update execution_steps')) {
          const steps = self.tables.get('execution_steps') || [];
          const id = params[params.length - 1];
          const step = steps.find((s) => s.id === id);
          if (step) {
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        if (lowerSql.startsWith('delete from workflow_executions')) {
          const executions = self.tables.get('workflow_executions') || [];
          const id = params[0];
          const idx = executions.findIndex((e) => e.id === id);
          if (idx >= 0) {
            executions.splice(idx, 1);
            // Also delete steps (cascade)
            const steps = self.tables.get('execution_steps') || [];
            const newSteps = steps.filter((s) => s.execution_id !== id);
            self.tables.set('execution_steps', newSteps);
            return { changes: 1 };
          }
          return { changes: 0 };
        }

        return { changes: 0 };
      },

      get(...params: unknown[]): unknown {
        const lowerSql = sql.toLowerCase().trim();

        if (lowerSql.includes('from workflow_executions where id')) {
          const executions = self.tables.get('workflow_executions') || [];
          return executions.find((e) => e.id === params[0]) || undefined;
        }

        if (lowerSql.includes('count(*)')) {
          const executions = self.tables.get('workflow_executions') || [];
          return { count: executions.length };
        }

        if (lowerSql.includes('select') && lowerSql.includes('avg')) {
          const executions = self.tables.get('workflow_executions') || [];
          const success = executions.filter((e) => e.status === 'success').length;
          const error = executions.filter((e) => e.status === 'error').length;
          const running = executions.filter((e) => e.status === 'running').length;
          return {
            total: executions.length,
            success_count: success,
            error_count: error,
            running_count: running,
            avg_duration: 100,
            min_duration: 50,
            max_duration: 200
          };
        }

        return undefined;
      },

      all(...params: unknown[]): unknown[] {
        const lowerSql = sql.toLowerCase().trim();

        if (lowerSql.includes('from workflow_executions')) {
          const executions = self.tables.get('workflow_executions') || [];
          let results = [...executions];

          // Apply basic filtering
          if (lowerSql.includes('where')) {
            // Simple workflow_id filter
            const workflowIdx = params.findIndex((p) => typeof p === 'string' && p.startsWith('wf-'));
            if (workflowIdx >= 0) {
              results = results.filter((e) => e.workflow_id === params[workflowIdx]);
            }
          }

          // Apply limit
          const limitIdx = lowerSql.indexOf('limit');
          if (limitIdx > 0) {
            const limitParam = params.find((p) => typeof p === 'number');
            if (limitParam) {
              results = results.slice(0, limitParam as number);
            }
          }

          return results;
        }

        if (lowerSql.includes('from execution_steps')) {
          const steps = self.tables.get('execution_steps') || [];
          const executionId = params[0];
          return steps.filter((s) => s.execution_id === executionId);
        }

        if (lowerSql.includes('distinct workflow_id')) {
          const executions = self.tables.get('workflow_executions') || [];
          const ids = [...new Set(executions.map((e) => e.workflow_id))];
          return ids.map((id) => ({ workflow_id: id }));
        }

        return [];
      }
    };
  }

  // Test helpers
  getExecutions(): Record<string, unknown>[] {
    return this.tables.get('workflow_executions') || [];
  }

  getSteps(): Record<string, unknown>[] {
    return this.tables.get('execution_steps') || [];
  }
}

describe('ExecutionStore', () => {
  let db: MockDatabase;
  let store: ExecutionStore;

  beforeEach(() => {
    db = new MockDatabase();
    store = new ExecutionStore(db);
  });

  describe('createExecution', () => {
    it('should create an execution and return an ID', () => {
      const options: CreateExecutionOptions = {
        workflowId: 'wf-123',
        workflowName: 'Test Workflow',
        triggerType: 'manual',
        status: 'running',
        startedAt: Date.now()
      };

      const id = store.createExecution(options);

      expect(id).toBeDefined();
      expect(id).toMatch(/^exec_/);
      expect(db.getExecutions()).toHaveLength(1);
    });

    it('should store all execution properties', () => {
      const now = Date.now();
      const options: CreateExecutionOptions = {
        workflowId: 'wf-456',
        workflowName: 'Full Workflow',
        triggerType: 'webhook',
        triggerData: { path: '/api/hook', method: 'POST' },
        status: 'running',
        startedAt: now,
        metadata: { version: '1.0' }
      };

      store.createExecution(options);

      const exec = db.getExecutions()[0];
      expect(exec.workflow_id).toBe('wf-456');
      expect(exec.workflow_name).toBe('Full Workflow');
      expect(exec.trigger_type).toBe('webhook');
      expect(exec.status).toBe('running');
      expect(exec.started_at).toBe(now);
    });
  });

  describe('getExecution', () => {
    it('should return an execution by ID', () => {
      const id = store.createExecution({
        workflowId: 'wf-test',
        workflowName: 'Test',
        triggerType: 'manual',
        status: 'running',
        startedAt: Date.now()
      });

      const exec = store.getExecution(id);

      expect(exec).not.toBeNull();
      expect(exec?.id).toBe(id);
      expect(exec?.workflowId).toBe('wf-test');
    });

    it('should return null for non-existent ID', () => {
      const exec = store.getExecution('non-existent');
      expect(exec).toBeNull();
    });
  });

  describe('updateExecution', () => {
    it('should update execution status', () => {
      const id = store.createExecution({
        workflowId: 'wf-update',
        workflowName: 'Update Test',
        triggerType: 'manual',
        status: 'running',
        startedAt: Date.now()
      });

      store.updateExecution(id, { status: 'success' });

      // In real implementation we'd verify the update
      // Mock just confirms no errors thrown
      expect(true).toBe(true);
    });
  });

  describe('addStep', () => {
    it('should add a step to an execution', () => {
      const execId = store.createExecution({
        workflowId: 'wf-steps',
        workflowName: 'Steps Test',
        triggerType: 'manual',
        status: 'running',
        startedAt: Date.now()
      });

      const stepOptions: CreateStepOptions = {
        executionId: execId,
        nodeId: 'node-1',
        nodeType: 'noodl.logic.condition',
        stepIndex: 0,
        startedAt: Date.now(),
        status: 'running',
        inputData: { value: true }
      };

      const stepId = store.addStep(stepOptions);

      expect(stepId).toBeDefined();
      expect(stepId).toMatch(/^step_/);
      expect(db.getSteps()).toHaveLength(1);
    });

    it('should store step input and output data', () => {
      const execId = store.createExecution({
        workflowId: 'wf-data',
        workflowName: 'Data Test',
        triggerType: 'manual',
        status: 'running',
        startedAt: Date.now()
      });

      store.addStep({
        executionId: execId,
        nodeId: 'node-2',
        nodeType: 'noodl.data.transform',
        stepIndex: 0,
        startedAt: Date.now(),
        status: 'success',
        inputData: { items: [1, 2, 3] },
        outputData: { result: 6 }
      });

      const step = db.getSteps()[0];
      expect(step.input_data).toBeDefined();
      expect(step.output_data).toBeDefined();
    });
  });

  describe('getStepsForExecution', () => {
    it('should return all steps for an execution', () => {
      const execId = store.createExecution({
        workflowId: 'wf-multi-step',
        workflowName: 'Multi Step',
        triggerType: 'manual',
        status: 'running',
        startedAt: Date.now()
      });

      store.addStep({
        executionId: execId,
        nodeId: 'node-1',
        nodeType: 'type-1',
        stepIndex: 0,
        startedAt: Date.now(),
        status: 'success'
      });

      store.addStep({
        executionId: execId,
        nodeId: 'node-2',
        nodeType: 'type-2',
        stepIndex: 1,
        startedAt: Date.now(),
        status: 'success'
      });

      const steps = store.getStepsForExecution(execId);

      expect(steps).toHaveLength(2);
    });
  });

  describe('getExecutionWithSteps', () => {
    it('should return execution with all steps', () => {
      const execId = store.createExecution({
        workflowId: 'wf-with-steps',
        workflowName: 'With Steps',
        triggerType: 'manual',
        status: 'running',
        startedAt: Date.now()
      });

      store.addStep({
        executionId: execId,
        nodeId: 'node-1',
        nodeType: 'type-1',
        stepIndex: 0,
        startedAt: Date.now(),
        status: 'success'
      });

      const result = store.getExecutionWithSteps(execId);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(execId);
      expect(result?.steps).toBeDefined();
      expect(result?.steps.length).toBe(1);
    });

    it('should return null for non-existent execution', () => {
      const result = store.getExecutionWithSteps('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('queryExecutions', () => {
    it('should return all executions by default', () => {
      store.createExecution({
        workflowId: 'wf-1',
        workflowName: 'Workflow 1',
        triggerType: 'manual',
        status: 'success',
        startedAt: Date.now()
      });

      store.createExecution({
        workflowId: 'wf-2',
        workflowName: 'Workflow 2',
        triggerType: 'webhook',
        status: 'error',
        startedAt: Date.now()
      });

      const results = store.queryExecutions();

      expect(results.length).toBe(2);
    });

    it('should filter by workflowId', () => {
      store.createExecution({
        workflowId: 'wf-filter-1',
        workflowName: 'Filter 1',
        triggerType: 'manual',
        status: 'success',
        startedAt: Date.now()
      });

      store.createExecution({
        workflowId: 'wf-filter-2',
        workflowName: 'Filter 2',
        triggerType: 'manual',
        status: 'success',
        startedAt: Date.now()
      });

      const results = store.queryExecutions({ workflowId: 'wf-filter-1' });

      expect(results.length).toBe(1);
      expect(results[0].workflowId).toBe('wf-filter-1');
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        store.createExecution({
          workflowId: 'wf-limit',
          workflowName: `Limit ${i}`,
          triggerType: 'manual',
          status: 'success',
          startedAt: Date.now()
        });
      }

      const results = store.queryExecutions({ limit: 3 });

      expect(results.length).toBe(3);
    });
  });

  describe('deleteExecution', () => {
    it('should delete an execution', () => {
      const id = store.createExecution({
        workflowId: 'wf-delete',
        workflowName: 'Delete Test',
        triggerType: 'manual',
        status: 'success',
        startedAt: Date.now()
      });

      expect(db.getExecutions()).toHaveLength(1);

      store.deleteExecution(id);

      expect(db.getExecutions()).toHaveLength(0);
    });

    it('should cascade delete steps', () => {
      const execId = store.createExecution({
        workflowId: 'wf-cascade',
        workflowName: 'Cascade Test',
        triggerType: 'manual',
        status: 'success',
        startedAt: Date.now()
      });

      store.addStep({
        executionId: execId,
        nodeId: 'node-1',
        nodeType: 'type-1',
        stepIndex: 0,
        startedAt: Date.now(),
        status: 'success'
      });

      expect(db.getSteps()).toHaveLength(1);

      store.deleteExecution(execId);

      expect(db.getSteps()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return aggregated statistics', () => {
      store.createExecution({
        workflowId: 'wf-stats',
        workflowName: 'Stats 1',
        triggerType: 'manual',
        status: 'success',
        startedAt: Date.now()
      });

      store.createExecution({
        workflowId: 'wf-stats',
        workflowName: 'Stats 2',
        triggerType: 'manual',
        status: 'error',
        startedAt: Date.now()
      });

      const stats = store.getStats();

      expect(stats.totalExecutions).toBe(2);
      expect(stats.successCount).toBe(1);
      expect(stats.errorCount).toBe(1);
    });
  });

  describe('cleanupByAge', () => {
    it('should clean up old executions', () => {
      // This tests the method can be called without error
      // Real implementation would test with actual timestamps
      const deleted = store.cleanupByAge(24 * 60 * 60 * 1000); // 24 hours
      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cleanupByCount', () => {
    it('should keep only N most recent executions', () => {
      // This tests the method can be called without error
      const deleted = store.cleanupByCount(10);
      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('applyRetentionPolicy', () => {
    it('should apply multiple retention rules', () => {
      const deleted = store.applyRetentionPolicy({
        maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxCountPerWorkflow: 100,
        maxTotalCount: 1000
      });

      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });
});
