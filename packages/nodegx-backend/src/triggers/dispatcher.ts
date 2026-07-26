/**
 * TriggerDispatcher — the ONE firing contract shared by all three trigger types
 * (WF-005 implementation step 1).
 *
 * Every trigger — cron, webhook, db-change — arrives here. There is exactly one
 * path from "trigger fired" to "execution started, record written":
 *
 *   fire()            — the target exists → run it (WorkflowRunner logs the
 *                       execution record), then stamp the trigger's status.
 *   recordRejection() — the fire was refused (bad webhook secret, oversize body,
 *                       missing target, disabled hook) → write a LOUD failed
 *                       execution record and stamp status. Never a silent drop
 *                       (RUN-004 loud-failure doctrine, restated for triggers).
 *
 * Both paths produce an execution record and both update the registry, so the
 * History Panel and the trigger UI agree by construction. Workflows (WF-001)
 * become a second target `kind` here and nothing else changes — the "designed
 * twice" risk closed by one contract.
 *
 * @module nodegx-backend/triggers/dispatcher
 */

import type { ExecutionHistory } from '../execution/ExecutionStore';
import type { WorkflowRunner, RunTriggerContext } from '../workflow/WorkflowRunner';
import type { WorkflowSubsystem } from '../workflow/WorkflowSubsystem';
import type { TriggerDef, TriggerResult, TriggerRegistry } from './registry';

export interface DispatcherDeps {
  registry: TriggerRegistry;
  executions: ExecutionHistory;
  getRunner: () => WorkflowRunner | null;
  /** WF-001: resolves the workflow subsystem for `target.kind === 'workflow'`. */
  getWorkflows?: () => WorkflowSubsystem | null;
  backendId: string;
  backendName: string;
}

export interface FireInput {
  trigger: TriggerDef;
  triggerType: RunTriggerContext['type'];
  /** Human-readable origin recorded on the execution. */
  source: string;
  /** Becomes the function request body (JSON). */
  payload: Record<string, unknown>;
  /** Extra request headers passed to the function (webhook forwards a subset). */
  headers?: Record<string, unknown>;
}

export interface RejectionInput {
  triggerType: RunTriggerContext['type'];
  /** Trigger id when a trigger matched; omitted for an unmatched hook. */
  triggerId?: string;
  /** workflowId recorded (target function name, or a `hook:<slug>` sentinel). */
  workflowId: string;
  source: string;
  reason: string;
  triggerData: Record<string, unknown>;
}

/** Everything a fire produced: the persisted status plus the HTTP response the
 *  webhook route relays back to the caller. */
export interface FireOutcome {
  result: TriggerResult;
  statusCode: number;
  body: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class TriggerDispatcher {
  constructor(private readonly deps: DispatcherDeps) {}

  /**
   * Fire a trigger at its target. Returns the trigger result (also stamped onto
   * the registry). A missing runner or missing target function is a loud failed
   * record, not a thrown error — one fire never crashes the scheduler/bus.
   */
  async fire(input: FireInput): Promise<FireOutcome> {
    const { trigger, triggerType, source, payload, headers } = input;
    const firedAt = nowIso();
    const targetName = trigger.target.name;

    // WF-001: a workflow target runs through the engine (which writes its own
    // workflow-level + per-step execution records). Same dispatcher path, second
    // target kind — no second dispatch path.
    if (trigger.target.kind === 'workflow') {
      return this.fireWorkflow(trigger, triggerType, source, targetName, payload, firedAt);
    }

    const runner = this.deps.getRunner();
    if (!runner) {
      const result = this.finishRejected(trigger.id, {
        triggerType,
        triggerId: trigger.id,
        workflowId: targetName,
        source,
        reason: 'Backend workflow runner is not ready — trigger fire dropped',
        triggerData: payload
      });
      return { result, statusCode: 503, body: JSON.stringify({ error: result.error }) };
    }

    // A trigger pointing at a function that does not exist must be LOUD: run()
    // would 404 without writing any record, so we write the failed record here.
    if (!runner.hasFunction(targetName)) {
      const result = this.finishRejected(trigger.id, {
        triggerType,
        triggerId: trigger.id,
        workflowId: targetName,
        source,
        reason: `Trigger target function "${targetName}" not found on this backend`,
        triggerData: payload
      });
      return { result, statusCode: 404, body: JSON.stringify({ error: result.error }) };
    }

    let result: TriggerResult;
    let statusCode = 500;
    let body = '';
    try {
      const response = await runner.run(
        targetName,
        { body: JSON.stringify(payload), headers: headers || {} },
        { type: triggerType, source, triggerId: trigger.id }
      );
      statusCode = response.statusCode;
      body = response.body;
      const ok = response.statusCode >= 200 && response.statusCode < 300;
      result = {
        ok,
        at: nowIso(),
        statusCode: response.statusCode,
        error: ok ? undefined : `Target returned HTTP ${response.statusCode}`
      };
    } catch (e) {
      // run() already logs its own failure record; we only record status here.
      const message = e instanceof Error ? e.message : String(e);
      result = { ok: false, at: nowIso(), error: message };
      body = JSON.stringify({ error: message });
    }

    this.deps.registry.recordFire(trigger.id, { firedAt, result });
    return { result, statusCode, body };
  }

  /** The `target.kind === 'workflow'` branch of fire(). */
  private async fireWorkflow(
    trigger: TriggerDef,
    triggerType: RunTriggerContext['type'],
    source: string,
    workflowId: string,
    payload: Record<string, unknown>,
    firedAt: string
  ): Promise<FireOutcome> {
    const workflows = this.deps.getWorkflows ? this.deps.getWorkflows() : null;
    if (!workflows) {
      const result = this.finishRejected(trigger.id, {
        triggerType,
        triggerId: trigger.id,
        workflowId,
        source,
        reason: 'Workflow engine is not ready — trigger fire dropped',
        triggerData: payload
      });
      return { result, statusCode: 503, body: JSON.stringify({ error: result.error }) };
    }

    const { found, result: runResult } = await workflows.run(workflowId, { type: triggerType, source, triggerId: trigger.id }, payload);
    if (!found || !runResult) {
      const result = this.finishRejected(trigger.id, {
        triggerType,
        triggerId: trigger.id,
        workflowId,
        source,
        reason: `Trigger target workflow "${workflowId}" not found on this backend`,
        triggerData: payload
      });
      return { result, statusCode: 404, body: JSON.stringify({ error: result.error }) };
    }

    // The engine already wrote the execution records; we only stamp trigger status.
    const ok = runResult.status === 'success';
    const result: TriggerResult = {
      ok,
      at: nowIso(),
      statusCode: ok ? 200 : 500,
      error: ok ? undefined : runResult.error || `workflow ${runResult.status}`
    };
    this.deps.registry.recordFire(trigger.id, { firedAt, result });
    return {
      result,
      statusCode: ok ? 200 : 500,
      body: JSON.stringify({ executionId: runResult.executionId, status: runResult.status })
    };
  }

  /**
   * Record a refused fire loudly: a failed execution record + status stamp,
   * without running the target. This is how an unauthenticated webhook, an
   * oversize body, or an unmatched hook becomes visible in the History Panel
   * instead of vanishing.
   */
  recordRejection(input: RejectionInput): TriggerResult {
    const result: TriggerResult = { ok: false, at: nowIso(), error: input.reason };
    this.writeFailedRecord(input);
    if (input.triggerId) {
      this.deps.registry.recordFire(input.triggerId, { firedAt: result.at, result });
    }
    return result;
  }

  /** Shared tail of fire()'s early-out branches. */
  private finishRejected(triggerId: string, input: RejectionInput): TriggerResult {
    return this.recordRejection({ ...input, triggerId });
  }

  private writeFailedRecord(input: RejectionInput): void {
    const logger = this.deps.executions.createLogger();
    if (!logger) return;
    try {
      logger.startExecution({
        workflowId: input.workflowId,
        workflowName: input.workflowId,
        triggerType: input.triggerType,
        triggerData: input.triggerData,
        metadata: {
          backendId: this.deps.backendId,
          backendName: this.deps.backendName,
          triggerSource: input.source,
          ...(input.triggerId ? { triggerId: input.triggerId } : {}),
          rejected: true
        }
      });
      logger.completeExecution(false, new Error(input.reason));
    } catch {
      // A logging failure must never propagate into the fire path.
    }
  }
}
