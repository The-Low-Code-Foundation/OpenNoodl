/**
 * CF11-001 logic step kinds: `branch` (IF), `switch`, `for-each`, `merge`.
 *
 * HOW THESE DIFFER FROM CF11-001's SKETCH, AND WHY
 * ------------------------------------------------
 * CF11-001 was written against the browser node model — signal ports,
 * `triggerOutput`, `triggerOutputAndWait`, per-instance mutable state. WF-001
 * shipped a different (and, on a server, more honest) model: an explicit step
 * DAG with edge-driven scheduling and no frames. WF-001-SEMANTICS is the
 * contract, so the *behaviour* CF11-001 asked for is preserved and the
 * *mechanism* is translated:
 *
 *   CF11-001                          WF-002 here
 *   ────────────────────────────────  ──────────────────────────────────────
 *   `triggerOutput('onTrue')`         select the `ontrue` route
 *   dynamic `case_0..n` output ports  `routes` keyed by case label
 *   `triggerOutputAndWait` per item   invoke a cloud function per item
 *   branch-arrival tracking + reset   read predecessors' outputs (topo order
 *                                      already guarantees they finished)
 *
 * Port names follow the REAL client nodes rather than CF11-001's sketch where
 * they differ — the client Condition node's ports are `ontrue`/`onfalse`/
 * `result`/`isfalse`, not the sketch's `onTrue`/`onFalse` — because a user who
 * knows the client node should not have to relearn it.
 *
 * @module nodegx-backend/workflow/steps/logic
 */

import type { StepExecContext, StepExecutor, StepExecResult } from '../StepExecutor';
import { StepExecutionError, invokeCloudFunction, stepResult } from '../StepExecutor';
import type { WorkflowRunner } from '../WorkflowRunner';
import type { Condition } from './conditions';
import { evaluateCondition, resolveValue } from './conditions';

function params(ctx: StepExecContext): Record<string, unknown> {
  return (ctx.step.params || {}) as Record<string, unknown>;
}

/** Wrap a condition-language failure as a loud step failure. */
function evaluate(cond: unknown, ctx: StepExecContext, where: string): boolean {
  try {
    return evaluateCondition(cond as Condition, ctx.scope);
  } catch (e) {
    throw new StepExecutionError(`Step "${ctx.step.id}" ${where}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ---------------------------------------------------------------------------
// branch (IF)
// ---------------------------------------------------------------------------

export class BranchStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<StepExecResult> {
    const result = evaluate(params(ctx).condition, ctx, 'condition failed to evaluate');
    return stepResult({ result, isfalse: !result }, { select: [result ? 'ontrue' : 'onfalse'] });
  }
}

// ---------------------------------------------------------------------------
// switch
// ---------------------------------------------------------------------------

interface SwitchCase {
  label: string;
  equals?: unknown;
  when?: Condition;
}

export class SwitchStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<StepExecResult> {
    const p = params(ctx);
    const value = resolveValue(p.value, ctx.scope);
    const cases = (p.cases || []) as SwitchCase[];

    // FIRST match wins — ordered, not "most specific". Deterministic and
    // readable straight off the definition, which matters when an agent wrote it.
    for (const c of cases) {
      const hit =
        'when' in c && c.when !== undefined
          ? evaluate(c.when, ctx, `case "${c.label}" failed to evaluate`)
          : deepEqualValue(value, resolveValue(c.equals, ctx.scope));
      if (hit) return stepResult({ matched: c.label, value }, { select: [c.label] });
    }
    return stepResult({ matched: null, value }, { select: ['default'] });
  }
}

function deepEqualValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// for-each
// ---------------------------------------------------------------------------

export interface ForEachDeps {
  getRunner: () => WorkflowRunner | null;
}

interface ForEachError {
  index: number;
  message: string;
}

export class ForEachStepExecutor implements StepExecutor {
  constructor(private readonly deps: ForEachDeps) {}

  async execute(ctx: StepExecContext): Promise<StepExecResult> {
    const p = params(ctx);
    const ref = ctx.step.ref;
    if (!ref) throw new StepExecutionError(`Step "${ctx.step.id}" is a for-each step with no ref`);

    const itemsSpec = p.items === undefined ? { $path: 'previous.items' } : p.items;
    const resolved = resolveValue(itemsSpec, ctx.scope);
    if (!Array.isArray(resolved)) {
      // Loud: "no items" and "items was a string / undefined" are different
      // bugs, and quietly treating the second as the first hides a wiring error.
      throw new StepExecutionError(
        `Step "${ctx.step.id}": for-each "items" resolved to ${resolved === undefined ? 'undefined' : typeof resolved}, not an array`
      );
    }

    const maxIterations = numberParam(p.maxIterations, 1000);
    if (resolved.length > maxIterations) {
      throw new StepExecutionError(
        `Step "${ctx.step.id}": ${resolved.length} items exceeds maxIterations ${maxIterations}. ` +
          'Raise the cap deliberately or narrow the list — a runaway iteration is real money on a metered host.'
      );
    }

    const itemKey = typeof p.itemKey === 'string' ? p.itemKey : 'item';
    const indexKey = typeof p.indexKey === 'string' ? p.indexKey : 'index';
    const concurrency = Math.max(1, numberParam(p.concurrency, 1));
    const continueOnError = p.continueOnError === true;

    // Pre-filter so `index` refers to the position in the ORIGINAL array — an
    // index that shifts under a filter is a debugging trap.
    const selected: { item: unknown; index: number }[] = [];
    let skipped = 0;
    for (let i = 0; i < resolved.length; i++) {
      if (p.filter !== undefined) {
        const scope = { ...ctx.scope, [itemKey]: resolved[i], [indexKey]: i };
        let keep: boolean;
        try {
          keep = evaluateCondition(p.filter as Condition, scope);
        } catch (e) {
          throw new StepExecutionError(
            `Step "${ctx.step.id}" filter failed on item ${i}: ${e instanceof Error ? e.message : String(e)}`
          );
        }
        if (!keep) {
          skipped++;
          continue;
        }
      }
      selected.push({ item: resolved[i], index: i });
    }

    const results: unknown[] = new Array(selected.length);
    const errors: ForEachError[] = [];

    let cursor = 0;
    const runOne = async (): Promise<void> => {
      for (;;) {
        const slot = cursor++;
        if (slot >= selected.length) return;
        // Cooperative cancellation: stop starting new items once the run is
        // aborted. The engine's race already ended the run; this stops us
        // burning through the rest of a long list in the background.
        if (ctx.signal.aborted) return;
        const { item, index } = selected[slot];
        try {
          results[slot] = await invokeCloudFunction(this.deps.getRunner, ref, {
            ...ctx.input,
            [itemKey]: item,
            [indexKey]: index
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          errors.push({ index, message });
          if (!continueOnError) throw e;
          results[slot] = null;
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(selected.length, 1)) }, runOne));

    const output = {
      results,
      count: selected.length,
      skipped,
      errors,
      failed: errors.length
    };
    return stepResult(output, { select: [selected.length === 0 ? 'empty' : 'nonempty'] });
  }
}

function numberParam(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

// ---------------------------------------------------------------------------
// merge
// ---------------------------------------------------------------------------

export class MergeStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<Record<string, unknown>> {
    const p = params(ctx);
    const mode = p.mode === 'any' ? 'any' : 'all';
    const strategy = typeof p.strategy === 'string' ? p.strategy : 'object';

    // Default sources = every step in the definition with an edge into this one.
    // Derived from the graph rather than hand-listed, so it stays right when the
    // workflow is edited.
    const declared: string[] = Array.isArray(p.sources)
      ? (p.sources as string[])
      : ctx.workflow.steps
          .filter((s) => edgeTargets(s).includes(ctx.step.id))
          .map((s) => s.id);

    const present = declared.filter((id) => Object.prototype.hasOwnProperty.call(ctx.upstream, id));
    const missing = declared.filter((id) => !present.includes(id));

    if (mode === 'all' && missing.length > 0) {
      throw new StepExecutionError(
        `Step "${ctx.step.id}": merge mode "all" expected ${declared.length} source(s) but ` +
          `${missing.join(', ')} did not reach it. Use mode "any" if a partial merge is intended.`
      );
    }

    let merged: unknown;
    if (strategy === 'array') {
      merged = present.map((id) => ctx.upstream[id]);
    } else if (strategy === 'shallow') {
      merged = present.reduce<Record<string, unknown>>((acc, id) => Object.assign(acc, ctx.upstream[id] || {}), {});
    } else {
      merged = present.reduce<Record<string, unknown>>((acc, id) => {
        acc[id] = ctx.upstream[id];
        return acc;
      }, {});
    }

    return { merged, sources: present, missing };
  }
}

function edgeTargets(step: { next?: string[]; onError?: string[]; routes?: Record<string, string[]> }): string[] {
  return [...(step.next || []), ...(step.onError || []), ...Object.values(step.routes || {}).flat()];
}
