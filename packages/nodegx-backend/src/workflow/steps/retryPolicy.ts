/**
 * The retry policy — a `call-function` step's optional backoff (CWF-005).
 *
 * WHY THIS IS NOT A STEP KIND ANY MORE
 * ------------------------------------
 * `retry` took `ref` and `invokesFunction: true`: it did not *wrap* a
 * neighbouring step, it *was* a call-function with backoff. On a canvas that read
 * as "a retry card that mysteriously needs to know a function name", and an
 * author who wanted to retry an existing Call Function had to delete it and
 * rebuild it as a Retry. TALK-001 Q7 folded it in, and this module is the part
 * that survived: the loop, unchanged, now reachable from the one kind that
 * invokes a function directly.
 *
 * THE POLICY IS OFF UNLESS `maxAttempts` > 1
 * ------------------------------------------
 * A call-function step with no policy is invoked exactly once, through exactly
 * the code path it always used — so every workflow written before the fold
 * behaves identically, and the extra output fields do not appear on a step that
 * never retried.
 *
 * ⚠️ That gate is why migration MATERIALISES the defaults. A `retry` step written
 * as `{"kind":"retry","ref":"charge"}` with no params retried three times,
 * because `RetryStepExecutor` supplied 3 as its own fallback — the catalog's
 * `default` never set anything (the repo's most-repeated trap). Migrating that
 * step to `call-function` without writing `maxAttempts: 3` into it would gate the
 * policy off and silently turn three attempts into one. See `migrate.ts`.
 *
 * @module nodegx-backend/workflow/steps/retryPolicy
 */

import type { StepExecContext } from '../StepExecutor';
import { StepExecutionError, invokeCloudFunction } from '../StepExecutor';
import type { WorkflowRunner } from '../WorkflowRunner';
import { sleep } from './sleep';

/** The executor's own fallbacks. NOT the catalog's — see the module note. */
export const RETRY_DEFAULTS = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 60000
} as const;

/** Every param the policy reads. Also the list `migrate.ts` carries across. */
export const RETRY_POLICY_PARAMS = [
  'maxAttempts',
  'delayMs',
  'backoffMultiplier',
  'maxDelayMs',
  'jitter',
  'retryOnStatus'
] as const;

function numberParam(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * Is the policy on for this step?
 *
 * One question, one place, because "off" has to mean the byte-identical
 * pre-fold path and not merely "a loop that happens to run once".
 */
export function retryPolicyActive(params: Record<string, unknown> | undefined): boolean {
  return numberParam(params?.maxAttempts, 1) > 1;
}

/**
 * Invoke a function with backoff, returning the successful attempt's output plus
 * `attempts` and `retried`.
 *
 * Those two extra fields are what a downstream `$path` into `previous.attempts`
 * reads, and they are why migration is safe: a workflow that read them off a
 * `retry` step keeps reading them off the `call-function` step it became.
 */
export async function invokeWithRetryPolicy(
  getRunner: () => WorkflowRunner | null,
  ref: string,
  ctx: StepExecContext
): Promise<Record<string, unknown>> {
  const p = (ctx.step.params || {}) as Record<string, unknown>;

  const maxAttempts = Math.max(1, Math.floor(numberParam(p.maxAttempts, RETRY_DEFAULTS.maxAttempts)));
  const baseDelay = Math.max(0, numberParam(p.delayMs, RETRY_DEFAULTS.delayMs));
  const multiplier = Math.max(1, numberParam(p.backoffMultiplier, RETRY_DEFAULTS.backoffMultiplier));
  const maxDelay = Math.max(0, numberParam(p.maxDelayMs, RETRY_DEFAULTS.maxDelayMs));
  const jitter = p.jitter === true;
  const retryOnStatus = Array.isArray(p.retryOnStatus) ? (p.retryOnStatus as number[]) : null;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // The engine's abort race has already ended the run; do not start another
    // attempt against a cancelled/timed-out workflow.
    if (ctx.signal.aborted) break;

    try {
      const output = await invokeCloudFunction(getRunner, ref, { ...ctx.input, attempt });
      return { ...output, attempts: attempt, retried: attempt > 1 };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      // A selective retry list means everything else fails NOW. A 400 will not
      // become a 200 on the third attempt, and pretending otherwise just burns
      // the backoff budget before reporting the same error.
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
        // Cancellable: cancelling the run or tripping the workflow timeout
        // aborts the wait rather than sleeping it out.
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
