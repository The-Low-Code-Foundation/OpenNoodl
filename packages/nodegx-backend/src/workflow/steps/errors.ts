/**
 * CF11-002 error-handling step kinds: `retry` and `stop`.
 *
 * TRY/CATCH IS DELIBERATELY ABSENT — IT ALREADY SHIPPED
 * -----------------------------------------------------
 * CF11-002's third node was Try/Catch, with `try` / `catch` / `finally` signal
 * outputs. WF-001 shipped that capability as first-class graph structure rather
 * than as a node: `onError` edges ARE the catch, and WF-001-SEMANTICS §2 says
 * so explicitly — "Errors are routed, not merely thrown … supporting CF11-002's
 * catch/retry designs". Adding a Try/Catch step kind on top would mean two ways
 * to express one thing, with the node version unable to actually wrap anything
 * (a step has no body to guard — its "block" is its successor steps, which the
 * engine already schedules).
 *
 *   CF11-002 Try/Catch          WF-001 equivalent
 *   ─────────────────────────   ────────────────────────────────────────────
 *   `try` output                the step's own `next` edges
 *   `catch` output              the step's `onError` edges
 *   `error` output object       `previous.error` on the handler step
 *   `finally` output            a `merge` step (mode "any") fed by both paths
 *   `success` boolean           which edge was taken; also in the step record
 *
 * The one thing WF-001 was missing for this to work was the error DATA: a
 * failed step recorded no output, so a handler reached by `onError` got
 * `previous: undefined` and could not tell what had gone wrong. That is fixed in
 * the engine (a failed step's outcome now carries `{ error: {...} }`), per
 * WF-002's brief — "if that routing turns out to be inadequate for CF11-002's
 * design, fix it in the runtime rather than working around it in node
 * implementations".
 *
 * @module nodegx-backend/workflow/steps/errors
 */

import type { StepExecContext, StepExecutor, StepExecResult } from '../StepExecutor';
import { StepExecutionError, invokeCloudFunction, stepResult } from '../StepExecutor';
import type { WorkflowRunner } from '../WorkflowRunner';
import { sleep } from './sleep';

function params(ctx: StepExecContext): Record<string, unknown> {
  return (ctx.step.params || {}) as Record<string, unknown>;
}

function numberParam(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

// ---------------------------------------------------------------------------
// retry
// ---------------------------------------------------------------------------

export interface RetryDeps {
  getRunner: () => WorkflowRunner | null;
}

export class RetryStepExecutor implements StepExecutor {
  constructor(private readonly deps: RetryDeps) {}

  async execute(ctx: StepExecContext): Promise<Record<string, unknown>> {
    const p = params(ctx);
    const ref = ctx.step.ref;
    if (!ref) throw new StepExecutionError(`Step "${ctx.step.id}" is a retry step with no ref`);

    const maxAttempts = Math.max(1, Math.floor(numberParam(p.maxAttempts, 3)));
    const baseDelay = Math.max(0, numberParam(p.delayMs, 1000));
    const multiplier = Math.max(1, numberParam(p.backoffMultiplier, 2));
    const maxDelay = Math.max(0, numberParam(p.maxDelayMs, 60000));
    const jitter = p.jitter === true;
    const retryOnStatus = Array.isArray(p.retryOnStatus) ? (p.retryOnStatus as number[]) : null;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // The engine's abort race has already ended the run; do not start
      // another attempt against a cancelled/timed-out workflow.
      if (ctx.signal.aborted) break;

      try {
        const output = await invokeCloudFunction(this.deps.getRunner, ref, {
          ...ctx.input,
          attempt
        });
        return { ...output, attempts: attempt, retried: attempt > 1 };
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));

        // A selective retry list means everything else fails NOW. A 400 will
        // not become a 200 on the third attempt, and pretending otherwise just
        // burns the backoff budget before reporting the same error.
        if (retryOnStatus) {
          const status = e instanceof StepExecutionError ? e.statusCode : undefined;
          if (status === undefined || !retryOnStatus.includes(status)) {
            throw new StepExecutionError(
              `Step "${ctx.step.id}" attempt ${attempt}/${maxAttempts} failed with a non-retryable error: ${lastError.message}`,
              status
            );
          }
        }

        if (attempt < maxAttempts) {
          const raw = Math.min(baseDelay * Math.pow(multiplier, attempt - 1), maxDelay);
          const delay = jitter ? raw * (0.5 + Math.random() * 0.5) : raw;
          const { aborted } = await sleep(delay, ctx.signal);
          if (aborted) break;
        }
      }
    }

    throw new StepExecutionError(
      `Step "${ctx.step.id}" failed after ${maxAttempts} attempt(s): ${lastError ? lastError.message : 'aborted'}`,
      lastError instanceof StepExecutionError ? lastError.statusCode : undefined
    );
  }
}

// ---------------------------------------------------------------------------
// stop
// ---------------------------------------------------------------------------

export class StopStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<StepExecResult> {
    const p = params(ctx);
    const message = typeof p.message === 'string' ? p.message : 'Workflow stopped';
    const isError = p.isError !== false;

    if (isError) {
      // A normal step failure: subject to `onError` routing, or the
      // unrouted-halt rule. That is what "explicitly fail a workflow with a
      // message" means under WF-001, and it is recorded loudly either way.
      throw new StepExecutionError(message);
    }

    // A quiet stop: the step SUCCEEDS but takes no outgoing edges, so
    // everything downstream is recorded `skipped` rather than silently absent.
    return stepResult({ stopped: true, message }, { halt: true });
  }
}
