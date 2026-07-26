/**
 * The step-execution seam (WF-001).
 *
 * The engine owns ordering, error routing, cancellation, timeouts, durability
 * and concurrency; it delegates "actually run this one step" to a StepExecutor.
 * This is the seam that keeps the binding rule — *a workflow node is a node* —
 * honest: the engine never learns how a node runs, only that a step produces
 * output or throws. WF-002's Series-1 nodes add step kinds here without touching
 * the engine.
 *
 * The one shipped executor, `FunctionStepExecutor`, runs a `call-function` step
 * by invoking an existing cloud function through the SAME WorkflowRunner /
 * CloudRunner path the request/response surface uses — real, catalogued nodes in
 * the existing cloud execution context. It calls `invokeFunction` (the unlogged
 * variant) so the ONLY execution record is the engine's per-step one; the
 * function does not additionally write its own function-level record when run as
 * a workflow step (no double-record, one execution-record path).
 *
 * @module nodegx-backend/workflow/StepExecutor
 */

import type { WorkflowRunner } from './WorkflowRunner';
import type { WorkflowDefinition, WorkflowStep } from './types';

/** Everything a step executor is handed for one step. */
export interface StepExecContext {
  workflow: WorkflowDefinition;
  step: WorkflowStep;
  /**
   * The step's resolved input: the run payload plus the step's static `params`
   * plus the immediately-upstream step's output under `previous`. See
   * WF-001-SEMANTICS.md §Data.
   */
  input: Record<string, unknown>;
  /**
   * Aborts when the run is cancelled or the workflow timeout trips. An executor
   * SHOULD stop cooperatively when it can; the engine also races the executor
   * against this signal so cancellation is prompt even for a non-cooperative
   * executor (the orphaned work then completes in the background, ignored — see
   * the durability/cancellation honesty notes in the semantics doc).
   */
  signal: AbortSignal;
}

export interface StepExecutor {
  /** Run one step. Resolve with its output; reject to signal a step FAILURE. */
  execute(ctx: StepExecContext): Promise<Record<string, unknown>>;
}

/** Thrown by a step executor when the underlying unit reports a failure. */
export class StepExecutionError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number
  ) {
    super(message);
    this.name = 'StepExecutionError';
  }
}

/**
 * v1's real executor: a `call-function` step invokes a cloud function.
 *
 * The function receives `{ body: JSON(input), headers }`; a non-2xx response is
 * a step FAILURE (so error routing / halt applies), a 2xx response's parsed body
 * is the step output. A missing target function is a loud failure, not a silent
 * skip.
 */
export class FunctionStepExecutor implements StepExecutor {
  constructor(private readonly getRunner: () => WorkflowRunner | null) {}

  async execute(ctx: StepExecContext): Promise<Record<string, unknown>> {
    if (ctx.step.kind !== 'call-function') {
      throw new StepExecutionError(
        `Unsupported step kind "${ctx.step.kind}" (v1 supports only 'call-function'; WF-002 adds more)`
      );
    }
    const name = ctx.step.ref;
    if (!name) throw new StepExecutionError(`Step "${ctx.step.id}" is a call-function step with no ref`);

    const runner = this.getRunner();
    if (!runner) throw new StepExecutionError('Workflow runner is not ready', 503);
    if (!runner.hasFunction(name)) {
      throw new StepExecutionError(`Step target function "${name}" not found on this backend`, 404);
    }

    // Unlogged invoke: the engine writes the per-step record, so the function
    // does NOT also write a function-level execution record here.
    const response = await runner.invokeFunction(name, {
      body: JSON.stringify(ctx.input),
      headers: {}
    });

    let parsed: unknown = {};
    if (response.body) {
      try {
        parsed = JSON.parse(response.body);
      } catch {
        parsed = { raw: response.body };
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const err = new StepExecutionError(
        `Function "${name}" returned HTTP ${response.statusCode}`,
        response.statusCode
      );
      throw err;
    }

    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : { value: parsed };
  }
}
