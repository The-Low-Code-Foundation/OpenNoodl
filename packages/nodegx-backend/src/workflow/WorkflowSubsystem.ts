/**
 * WorkflowSubsystem — the composition root for the WF-001 engine, owned by the
 * BackendService (mirrors TriggerSubsystem's shape).
 *
 * It wires the three pieces the service needs together and exposes what the rest
 * of the service talks to:
 *   - `registry` — CRUD over workflow definitions (admin routes + MCP);
 *   - `run()` / `cancel()` — start / stop a run (admin routes, and the trigger
 *     dispatcher's `target.kind === 'workflow'` path);
 *   - `start()` — recover interrupted runs at startup (durability policy).
 *
 * The step executor is `FunctionStepExecutor` (real cloud functions via the
 * shared WorkflowRunner/CloudRunner), so the engine schedules real nodes and
 * never invents a second node abstraction.
 *
 * @module nodegx-backend/workflow/WorkflowSubsystem
 */

import type { ExecutionHistory } from '../execution/ExecutionStore';
import type { WorkflowRunner, RunTriggerContext } from './WorkflowRunner';
import { WorkflowEngine } from './WorkflowEngine';
import { FunctionStepExecutor, StepExecutor } from './StepExecutor';
import { WorkflowRegistry } from './WorkflowRegistry';
import type { WorkflowRunResult } from './types';

export interface WorkflowSubsystemDeps {
  dataDir: string;
  executions: ExecutionHistory;
  getRunner: () => WorkflowRunner | null;
  backendId: string;
  backendName: string;
  /** Test hook: inject a deterministic executor instead of the function one. */
  executor?: StepExecutor;
}

export interface RunByIdResult {
  found: boolean;
  result?: WorkflowRunResult;
}

export class WorkflowSubsystem {
  readonly registry: WorkflowRegistry;
  readonly engine: WorkflowEngine;

  constructor(deps: WorkflowSubsystemDeps) {
    this.registry = new WorkflowRegistry(deps.dataDir);
    this.engine = new WorkflowEngine({
      executions: deps.executions,
      executor: deps.executor || new FunctionStepExecutor(deps.getRunner),
      backendId: deps.backendId,
      backendName: deps.backendName
    });
  }

  /** Recover interrupted runs. Call once at startup. Returns the count. */
  start(): number {
    return this.engine.recoverInterrupted();
  }

  /** Run a workflow by id with a payload. `found:false` if no such workflow. */
  async run(id: string, trigger: RunTriggerContext, payload?: Record<string, unknown>): Promise<RunByIdResult> {
    const def = this.registry.get(id);
    if (!def) return { found: false };
    const result = await this.engine.run(def, { trigger, payload });
    return { found: true, result };
  }

  /** Cancel a run by execution id. */
  cancel(executionId: string): boolean {
    return this.engine.cancel(executionId);
  }
}
