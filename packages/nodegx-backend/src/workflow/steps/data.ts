/**
 * CWF-004 slice 2's array steps: `filter`, `sort`, `deduplicate`, `split`.
 *
 * WHAT THEY HAVE IN COMMON, AND WHY THEY SHARE A FILE
 * --------------------------------------------------
 * Each takes ONE array out of the run, does one declarative thing to it, and is
 * the array again. None of them evaluates a string, none introduces a
 * vocabulary of its own, and none can produce a value that was not already in
 * the data — which is the whole test `BACKEND-AUTHORING-MODEL.md` applies:
 * **reference and route, never compute**. `filter` borrows the condition
 * language whole; `sort` borrows the condition language's ORDER (one order for
 * the layer, or `gt` and "ascending" disagree at the edges); `deduplicate` and
 * `split` need no vocabulary at all.
 *
 * They share a file because they share a first line — resolve `items`, insist it
 * is an array, fail loudly if it is not — and four copies of that would be four
 * chances for one of them to start treating "not an array" as "empty".
 *
 * ⚠️ WHY ONLY `filter` HAS ROUTES
 * -------------------------------
 * `filter` is the only one of the four that can CHANGE whether the list is
 * empty, so "nothing matched" is a real branch a workflow wants to take.
 * Sorting cannot empty a list, de-duplicating cannot empty a non-empty one, and
 * splitting a non-empty list always yields at least one batch — so `empty` /
 * `nonempty` ports on those three would be ports whose answer the previous step
 * already knew. `for-each` supplies the same pair downstream where it is needed.
 *
 * @module nodegx-backend/workflow/steps/data
 */

import type { StepExecContext, StepExecutor, StepExecResult } from '../StepExecutor';
import { StepExecutionError, stepResult } from '../StepExecutor';
import type { Condition } from './conditions';
import { compareOrdered, evaluateCondition } from './conditions';
import { getPath, isPlainObject, resolveValueDeep } from './values';

function params(ctx: StepExecContext): Record<string, unknown> {
  return (ctx.step.params || {}) as Record<string, unknown>;
}

/**
 * The array this step works on.
 *
 * The default (`previous.items`) is supplied HERE rather than relied on from the
 * catalog, matching `for-each` — a declared default is documentation, and the
 * executor's fallback is what ever actually applies (CWF-005's finding). Both
 * say `previous.items` and a spec pins that they agree.
 *
 * "Not an array" is LOUD, and deliberately not treated as "empty": a wiring
 * mistake that yields `undefined` and a list that genuinely has no items are
 * different bugs, and quietly conflating them hides the one you can fix.
 *
 * ⚠️ `resolveValueDeep`, not `resolveValue`. `items` is a NON-raw param, so the
 * engine has already deep-resolved its own copy — but these executors read the
 * AUTHORED params (they have to, or the `previous.items` default below would
 * never be reachable), and a shallow resolve there would disagree with the
 * engine for `[{"$path":"body.a"}, {"$path":"body.b"}]`: an array literally
 * built out of two references would arrive as two spec OBJECTS. Deep is what the
 * engine produces, so deep is what this must produce. No op table is passed, so
 * nothing here gained the ability to compute.
 */
function resolveItems(ctx: StepExecContext): unknown[] {
  const p = params(ctx);
  const spec = p.items === undefined ? { $path: 'previous.items' } : p.items;
  const resolved = resolveValueDeep(spec, ctx.scope);
  if (!Array.isArray(resolved)) {
    throw new StepExecutionError(
      `Step "${ctx.step.id}": "items" resolved to ${resolved === undefined ? 'undefined' : typeof resolved}, ` +
        'not an array. Point it at the list you mean — an absent list is not an empty one.'
    );
  }
  return resolved;
}

function stringParam(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

/**
 * The value a `by` path selects out of one item, or the item itself when there
 * is no path.
 *
 * A missing segment is `undefined`, exactly as everywhere else in this language.
 * What each step then DOES with an absent key is its own decision, and each one
 * states it.
 */
function keyOf(item: unknown, by: string | undefined): unknown {
  return by ? getPath(item, by) : item;
}

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

/**
 * Drop the items that do not match a condition.
 *
 * `for-each` has had a `filter` param since WF-002, and this is mostly that
 * capability given a card of its own — which is not cosmetic: as a step the
 * filtered list is a step OUTPUT, so it appears in the execution record, can be
 * read by anything downstream, and can be fed to something other than a
 * per-item function call. Inside `for-each` it is invisible and single-use.
 */
export class FilterStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<StepExecResult> {
    const p = params(ctx);
    const items = resolveItems(ctx);
    const condition = p.condition;
    if (condition === undefined) {
      throw new StepExecutionError(
        `Step "${ctx.step.id}" is a filter step with no condition — it would keep everything. ` +
          'Write-time validation should have refused this definition.'
      );
    }

    const itemKey = stringParam(p.itemKey, 'item');
    const indexKey = stringParam(p.indexKey, 'index');

    const kept: unknown[] = [];
    for (let i = 0; i < items.length; i++) {
      // The item and its index join the scope under author-chosen keys, exactly
      // as `for-each`'s filter does — so a condition written for one works
      // unchanged in the other.
      const scope = { ...ctx.scope, [itemKey]: items[i], [indexKey]: i };
      let keep: boolean;
      try {
        keep = evaluateCondition(condition as Condition, scope);
      } catch (e) {
        throw new StepExecutionError(
          `Step "${ctx.step.id}" filter failed on item ${i}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
      if (keep) kept.push(items[i]);
    }

    return stepResult(
      { items: kept, count: kept.length, dropped: items.length - kept.length, total: items.length },
      { select: [kept.length === 0 ? 'empty' : 'nonempty'] }
    );
  }
}

// ---------------------------------------------------------------------------
// sort
// ---------------------------------------------------------------------------

/**
 * Order an array by a path inside each item.
 *
 * Three properties, each chosen rather than inherited:
 *
 *  - **The order is the condition language's order.** `compareOrdered` is the
 *    same function `gt` / `lt` use, so `"10"` sorts after `"9"` here exactly as
 *    it compares greater there, and an ISO date string sorts as an instant. Two
 *    orders in one layer would disagree at precisely the edges that matter.
 *  - **Absent keys sort LAST, in both directions.** Absence is not a value, so
 *    it has no place in an order; putting it at one end and keeping it there
 *    under `descending` is the only answer that does not make reversing the sort
 *    move data an author never mentioned.
 *  - **Incomparable items FAIL the step.** A list of numbers with one object in
 *    it has no order, and inventing one silently is how a report comes out
 *    wrong rather than missing.
 */
export class SortStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<Record<string, unknown>> {
    const p = params(ctx);
    const items = resolveItems(ctx);
    const by = typeof p.by === 'string' && p.by ? p.by : undefined;
    const descending = p.order === 'descending';

    // Decorate with the original index so the sort is STABLE: two items with
    // equal keys keep the order the supplier sent them in, which is the only
    // order an author can reason about.
    const decorated = items.map((item, index) => ({ item, index, key: keyOf(item, by) }));

    try {
      decorated.sort((a, b) => {
        const aMissing = a.key === undefined || a.key === null;
        const bMissing = b.key === undefined || b.key === null;
        if (aMissing || bMissing) {
          if (aMissing && bMissing) return a.index - b.index;
          return aMissing ? 1 : -1;
        }
        const c = compareOrdered(a.key, b.key);
        if (c !== 0) return descending ? -c : c;
        return a.index - b.index;
      });
    } catch (e) {
      throw new StepExecutionError(
        `Step "${ctx.step.id}" cannot sort ${by ? `by "${by}"` : 'these items'}: ` +
          `${e instanceof Error ? e.message : String(e)}`
      );
    }

    return { items: decorated.map((d) => d.item), count: decorated.length };
  }
}

// ---------------------------------------------------------------------------
// deduplicate
// ---------------------------------------------------------------------------

/**
 * A stable, value-based key for a de-duplication bucket.
 *
 * Object keys are SORTED before serialising, so `{a:1,b:2}` and `{b:2,a:1}` are
 * one value rather than two — which is what "the same data" means to an author
 * and is not what `JSON.stringify` alone would say. The prefix keeps a string
 * `"1"` from colliding with the number `1`.
 */
function canonicalKey(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `a[${v.map(canonicalKey).join(',')}]`;
  if (isPlainObject(v)) {
    return `o{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalKey(v[k])}`)
      .join(',')}}`;
  }
  return `${typeof v}:${JSON.stringify(v)}`;
}

/**
 * Drop repeats.
 *
 * ⚠️ **An item whose key is absent is always kept.** Absence is not a value
 * anywhere in this language, so it cannot be a duplicate — and the alternative
 * is worse than it sounds: bucketing every key-less item together would silently
 * delete every row a supplier forgot to give an id, which is exactly the data
 * you most want to still have when you go looking for what went wrong.
 */
export class DeduplicateStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<Record<string, unknown>> {
    const p = params(ctx);
    const items = resolveItems(ctx);
    const by = typeof p.by === 'string' && p.by ? p.by : undefined;
    const keepLast = p.keep === 'last';

    const seen = new Map<string, number>();
    const out: unknown[] = [];
    const keyless: number[] = [];

    for (const item of items) {
      const key = keyOf(item, by);
      if (key === undefined || key === null) {
        keyless.push(out.length);
        out.push(item);
        continue;
      }
      const k = canonicalKey(key);
      const at = seen.get(k);
      if (at === undefined) {
        seen.set(k, out.length);
        out.push(item);
      } else if (keepLast) {
        out[at] = item;
      }
    }

    return {
      items: out,
      count: out.length,
      removed: items.length - out.length,
      // Said out loud rather than left to be inferred: a run that kept 40 rows
      // with no id is a supplier problem, and it should be visible in the
      // execution record without re-reading the input.
      keyless: keyless.length
    };
  }
}

// ---------------------------------------------------------------------------
// split
// ---------------------------------------------------------------------------

/** The default ceiling on how many batches one split may produce. */
export const DEFAULT_MAX_BATCHES = 1000;

/**
 * Chunk an array into groups of N.
 *
 * The cap is a FAILURE and not a truncation, matching `for-each`'s
 * `maxIterations` and for the same reason: a runaway list on a metered platform
 * must be loud, and silently producing the first thousand batches of a hundred
 * thousand is a data-loss bug that looks like a success.
 */
export class SplitStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<Record<string, unknown>> {
    const p = params(ctx);
    const items = resolveItems(ctx);

    // ⚠️ RESOLVED here, not read raw. `params(ctx)` is the AUTHORED params — the
    // engine's resolved copy is in `ctx.input`, and this executor reads the
    // authored side so that the default `items` spec above is available to it.
    // That means a `{"$path": …}` size arrives here as a spec, and write-time
    // validation deliberately ALLOWS one (a value that does not exist yet cannot
    // be range-checked). Reading it raw would make every referenced size a
    // guaranteed run-time failure — a definition accepted at write time that
    // could never run, which is the exact bug `wait.duration` had.
    const size = resolveValueDeep(p.size, ctx.scope);
    if (typeof size !== 'number' || !Number.isFinite(size) || size < 1 || !Number.isInteger(size)) {
      throw new StepExecutionError(
        `Step "${ctx.step.id}": "size" resolved to ${JSON.stringify(size)} — a batch size must be a whole number of 1 or more.`
      );
    }

    const resolvedMax = resolveValueDeep(p.maxBatches, ctx.scope);
    const maxBatches =
      typeof resolvedMax === 'number' && Number.isFinite(resolvedMax) ? resolvedMax : DEFAULT_MAX_BATCHES;
    const wanted = Math.ceil(items.length / size);
    if (wanted > maxBatches) {
      throw new StepExecutionError(
        `Step "${ctx.step.id}": ${items.length} items at ${size} per batch is ${wanted} batches, over the ` +
          `maxBatches cap of ${maxBatches}. Raise the cap deliberately or narrow the list.`
      );
    }

    const batches: unknown[][] = [];
    for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));

    return { batches, count: batches.length, size, total: items.length };
  }
}
