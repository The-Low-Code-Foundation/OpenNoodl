/**
 * CF11-002's error-handling step kind: `stop`.
 *
 * `retry` used to live here too. CWF-005 folded it into `call-function` as a
 * policy — it took its own `ref` and invoked a function directly, so it was a
 * call-function with backoff rather than a wrapper — and the loop moved to
 * `steps/retryPolicy.ts` unchanged.
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
import { StepExecutionError, stepResult } from '../StepExecutor';

function params(ctx: StepExecContext): Record<string, unknown> {
  return (ctx.step.params || {}) as Record<string, unknown>;
}

function numberParam(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
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
