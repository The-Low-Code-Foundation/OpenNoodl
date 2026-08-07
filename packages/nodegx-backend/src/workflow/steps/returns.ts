/**
 * CWF-002's `return` step kind: what the caller gets back.
 *
 * WHY A STEP AND NOT JUST A TRANSPORT FIX
 * ---------------------------------------
 * The engine has always carried a run output — the output of whichever step
 * finished LAST. On a straight line that is obvious. On a branch, or a
 * `for-each` with concurrency, it is not something an author can read off the
 * canvas, so "what does this workflow answer with?" had no answer you could
 * point at. This kind is that answer, written down.
 *
 * It deliberately rhymes with the cloud function **Response** node rather than
 * inventing a second vocabulary: a function's graph ends at Response, a
 * workflow's path ends at Return, and both mean "this is the value that leaves".
 * The difference in name is the difference in direction — a function *responds*
 * to a request it was handed; a workflow *returns* to whoever ran it, which may
 * be a schedule with nobody listening at all.
 *
 * SEMANTICS
 * ---------
 *  - `value` is a value-language value: a literal, or `{"$path": "…"}` into the
 *    run payload / `previous` / `upstream.<stepId>`. Omitted, it returns the
 *    upstream step's output (`previous`) — the useful default, and the one that
 *    matches what the run would have answered anyway.
 *  - It **terminates its path** like a non-error `stop`: no outgoing edges are
 *    taken, so anything downstream is recorded `skipped` rather than quietly
 *    absent. A `return` with a `next` edge is refused at write time.
 *  - TWO Return steps on two branches (a success path and an error path) is
 *    legal and normal, and is NOT validated as an error. Two that both RUN — a
 *    parallel merge — is **first-wins**, recorded on the execution record as
 *    `returnConflict` so the ambiguity is visible rather than silent.
 *
 * @module nodegx-backend/workflow/steps/returns
 */

import type { StepExecContext, StepExecutor, StepExecResult } from '../StepExecutor';
import { stepResult } from '../StepExecutor';
import { resolveValueDeep } from './values';

/**
 * Resolve what a `return` step hands back.
 *
 * Resolved from the RAW param against `ctx.scope`, and not read off
 * `ctx.input.value`: `input` is the run payload merged with the resolved params,
 * so a workflow whose payload happens to carry a `value` key would have that
 * returned by a Return step that declares none. A step must return what its own
 * definition says, or nothing at all.
 *
 * DEEP, not shallow. `{"total": {"$path": "previous.result.total"}, "ok": true}`
 * is the shape an author actually writes — a returned object is usually
 * assembled from several places — and a shallow resolve would hand the caller
 * the literal `{"$path": …}` object back, which looks like data and is not.
 */
export function resolveReturnValue(ctx: StepExecContext): unknown {
  const params = (ctx.step.params || {}) as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(params, 'value')) {
    // No `value` declared: hand back the upstream step's output. `previous` is
    // absent on the entry step, in which case the workflow returns null — an
    // explicit "nothing", not an accident.
    const previous = ctx.input.previous;
    return previous === undefined ? null : previous;
  }
  return resolveValueDeep(params.value, ctx.scope);
}

export class ReturnStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<StepExecResult> {
    const value = resolveReturnValue(ctx);
    // The step's OUTPUT stays an object (the engine's per-step contract, and
    // what `previous`/`upstream.<id>` are typed as); the RUN's answer travels
    // separately in `returns`, where it may be any JSON value at all.
    return stepResult({ returned: true, value }, { halt: true, returns: { value } });
  }
}
