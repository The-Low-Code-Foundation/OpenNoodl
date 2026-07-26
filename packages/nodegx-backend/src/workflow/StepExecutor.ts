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
   *
   * When the upstream step FAILED and routed here via `onError`, `previous` is
   * `{ error: { message, name, statusCode? } }` — which is what lets CF11-002's
   * catch branches see what went wrong (WF-002 engine extension).
   */
  input: Record<string, unknown>;
  /**
   * Outputs of EVERY predecessor that took an edge into this step, keyed by
   * step id (WF-002 engine extension, for the `merge` kind). Topological order
   * guarantees they have all finished by the time this step runs. A predecessor
   * that failed appears with its `{ error }` output.
   */
  upstream: Record<string, Record<string, unknown> | undefined>;
  /**
   * Aborts when the run is cancelled or the workflow timeout trips. An executor
   * SHOULD stop cooperatively when it can; the engine also races the executor
   * against this signal so cancellation is prompt even for a non-cooperative
   * executor (the orphaned work then completes in the background, ignored — see
   * the durability/cancellation honesty notes in the semantics doc).
   */
  signal: AbortSignal;
}

/**
 * The brand that distinguishes a routing result from a plain output object.
 * A symbol (not a `__field`) so it can never collide with a function's response
 * body, which is arbitrary user JSON.
 */
const STEP_RESULT_BRAND = Symbol.for('nodegx.workflow.stepResult');

/**
 * A step's outcome WITH routing information (WF-002 engine extension).
 *
 * WF-001's executors returned a bare output object and the engine took every
 * `next` edge. Routing kinds need to take a SUBSET of their outgoing edges,
 * which the semantics doc already allows for — §1 defines a step as eligible
 * "only when its incoming edge has been *taken* by a completed predecessor",
 * and selective taking is exactly that. Nothing about ordering, error routing,
 * cancellation, timeouts or concurrency changes.
 *
 * Returning a bare `Record<string, unknown>` remains valid and means "take all
 * `next` edges, no routes" — so `FunctionStepExecutor` is untouched.
 */
export interface StepExecResult {
  readonly [STEP_RESULT_BRAND]: true;
  output: Record<string, unknown>;
  /** Names of `step.routes` entries to take, in addition to `next`. */
  select?: string[];
  /** Take NO outgoing edges at all — this path ends here (`stop`, isError:false). */
  halt?: boolean;
}

export type StepExecReturn = Record<string, unknown> | StepExecResult;

/** Build a routing result. */
export function stepResult(
  output: Record<string, unknown>,
  opts: { select?: string[]; halt?: boolean } = {}
): StepExecResult {
  return { [STEP_RESULT_BRAND]: true, output, ...opts };
}

export function isStepResult(v: unknown): v is StepExecResult {
  return typeof v === 'object' && v !== null && (v as Record<symbol, unknown>)[STEP_RESULT_BRAND] === true;
}

/** Normalise either return form into the routing form. */
export function normalizeStepReturn(v: StepExecReturn): StepExecResult {
  return isStepResult(v) ? v : stepResult(v);
}

export interface StepExecutor {
  /**
   * Run one step. Resolve with its output (optionally wrapped by `stepResult`
   * to select routes); reject to signal a step FAILURE.
   */
  execute(ctx: StepExecContext): Promise<StepExecReturn>;
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
        `FunctionStepExecutor cannot run step kind "${ctx.step.kind}" — the composite executor routes kinds`
      );
    }
    const name = ctx.step.ref;
    if (!name) throw new StepExecutionError(`Step "${ctx.step.id}" is a call-function step with no ref`);
    return invokeCloudFunction(this.getRunner, name, ctx.input);
  }
}

/**
 * Invoke a cloud function as a workflow step's unit of work and return its
 * parsed output, throwing `StepExecutionError` on any failure.
 *
 * Shared by `call-function` and by WF-002's `for-each` / `retry`, which are
 * *scheduling policies over the same unit of work* rather than new kinds of
 * work. Keeping one invocation path is what keeps the "a workflow node is a
 * node" rule true for the new kinds too: they still run real, catalogued node
 * graphs through the same CloudRunner, and they still use the UNLOGGED
 * `invokeFunction`, so the engine's per-step record stays the only record.
 */
export async function invokeCloudFunction(
  getRunner: () => WorkflowRunner | null,
  name: string,
  input: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const runner = getRunner();
  if (!runner) throw new StepExecutionError('Workflow runner is not ready', 503);
  if (!runner.hasFunction(name)) {
    throw new StepExecutionError(`Step target function "${name}" not found on this backend`, 404);
  }

  const response = await runner.invokeFunction(name, {
    body: JSON.stringify(input),
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
    throw new StepExecutionError(`Function "${name}" returned HTTP ${response.statusCode}`, response.statusCode);
  }

  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : { value: parsed };
}
