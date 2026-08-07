/**
 * CWF-004 slice 2 — `validate`, `filter`, `sort`, `deduplicate`, `split`, and
 * the two JSON operations that finished the transform vocabulary.
 *
 * The same three things are under test as in slice 1, because they are the
 * things that make declarative data steps allowable at the workflow tier at all:
 *
 *  1. **Every vocabulary is closed, from both ends.** A validate `type` this
 *     backend does not check is refused when the definition is SAVED and is
 *     still loud if one reaches a RUN. Nothing here is a passthrough.
 *  2. **Nothing gained the ability to compute.** `filter` and `sort` borrow the
 *     condition language and its ordering; the op table is still a parameter of
 *     the shared resolver, so a condition cannot reach `$parseJson`.
 *  3. **The end-to-end case** — an awkward supplier payload guarded, narrowed,
 *     ordered and batched into what a rate-limited function accepts, through the
 *     real engine.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { WorkflowEngine, validateWorkflowDefinition } from '../src/workflow/WorkflowEngine';
import { CompositeStepExecutor } from '../src/workflow/steps/CompositeStepExecutor';
import { evaluateCondition } from '../src/workflow/steps/conditions';
import {
  DeduplicateStepExecutor,
  FilterStepExecutor,
  SortStepExecutor,
  SplitStepExecutor
} from '../src/workflow/steps/data';
import { stepKindCatalog, STEP_KIND_SPECS, validateStepShape } from '../src/workflow/steps/kinds';
import { TRANSFORM_OP_NAMES, TransformStepExecutor } from '../src/workflow/steps/transform';
import { VALIDATE_LANGUAGE, VALIDATE_TYPE_NAMES, VALIDATE_TYPES, ValidateStepExecutor } from '../src/workflow/steps/validate';
import { resolveStepParams, resolveValueDeep } from '../src/workflow/steps/values';
import type { StepExecContext, StepExecResult } from '../src/workflow/StepExecutor';
import type { StepKind, WorkflowDefinition, WorkflowStep } from '../src/workflow/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXECUTORS = {
  validate: () => new ValidateStepExecutor(),
  filter: () => new FilterStepExecutor(),
  sort: () => new SortStepExecutor(),
  deduplicate: () => new DeduplicateStepExecutor(),
  split: () => new SplitStepExecutor(),
  transform: () => new TransformStepExecutor()
} as const;

/** Run one step directly, the way the engine would. */
async function run(
  kind: keyof typeof EXECUTORS,
  params: Record<string, unknown>,
  scope: Record<string, unknown> = {}
): Promise<Record<string, unknown> & { $routes?: string[] }> {
  const step: WorkflowStep = { id: 's', kind: kind as StepKind, params };
  const ctx = {
    workflow: {} as WorkflowDefinition,
    step,
    input: scope,
    scope,
    upstream: {},
    signal: new AbortController().signal
  } as StepExecContext;
  const result = await EXECUTORS[kind]().execute(ctx);
  const asResult = result as StepExecResult;
  if (asResult && typeof asResult === 'object' && 'output' in asResult) {
    return { ...(asResult.output as Record<string, unknown>), $routes: asResult.select };
  }
  return result as Record<string, unknown>;
}

async function failure(
  kind: keyof typeof EXECUTORS,
  params: Record<string, unknown>,
  scope: Record<string, unknown> = {}
): Promise<string> {
  try {
    await run(kind, params, scope);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  throw new Error('expected the step to fail loudly, and it did not');
}

function shapeErrors(kind: StepKind, params: Record<string, unknown>, extra: Partial<WorkflowStep> = {}): string[] {
  return validateStepShape({ id: 's', kind, params, ...extra } as WorkflowStep);
}

// ---------------------------------------------------------------------------
// validate
// ---------------------------------------------------------------------------

describe('CWF-004 slice 2 — validate', () => {
  const RULES = [
    { path: 'body.customer.email', type: 'string' },
    { path: 'body.orders', type: 'array' },
    { path: 'body.note', required: false, type: 'string' }
  ];

  it('passes data that is the shape it was told to expect', async () => {
    const out = await run(
      'validate',
      { rules: RULES },
      { body: { customer: { email: 'a@b.c' }, orders: [{ id: 1 }] } }
    );
    expect(out).toEqual({ ok: true, checked: 3 });
  });

  it('requires a path by DEFAULT — the decision that makes the common rule short', async () => {
    // A rule naming a path normally means "this must be here". `required: false`
    // is the case that needs the extra word, not the other one.
    const message = await failure('validate', { rules: [{ path: 'body.email' }] }, { body: {} });
    expect(message).toMatch(/"body\.email" is required/);
    expect(await run('validate', { rules: [{ path: 'body.email', required: false, type: 'string' }] }, { body: {} })).toEqual({
      ok: true,
      checked: 1
    });
  });

  it('checks the JSON type and says what it got', async () => {
    const message = await failure('validate', { rules: [{ path: 'body.total', type: 'number' }] }, { body: { total: '42' } });
    // A numeric STRING is not a number here, and the message shows the quotes so
    // the difference is visible rather than inferred.
    expect(message).toMatch(/"body\.total" must be a number, got "42"/);
    expect(await failure('validate', { rules: [{ path: 'body.o', type: 'object' }] }, { body: { o: [1] } })).toMatch(
      /must be an object, got an array/
    );
  });

  it('reports EVERY broken rule by default, and only the first in mode "first"', async () => {
    const rules = [
      { path: 'body.a', type: 'string' },
      { path: 'body.b', type: 'number' },
      { path: 'body.c' }
    ];
    const scope = { body: { a: 1, b: 'x' } };
    const all = await failure('validate', { rules }, scope);
    expect(all).toContain('"body.a" must be text');
    expect(all).toContain('"body.b" must be a number');
    expect(all).toContain('"body.c" is required');

    const first = await failure('validate', { rules, mode: 'first' }, scope);
    expect(first).toContain('"body.a" must be text');
    expect(first).not.toContain('"body.b"');
    expect(first).toMatch(/mode "first": 2 later rules not checked/);
  });

  it('counts the unchecked tail rather than assuming there is one', async () => {
    // "later rules were not checked" when the LAST rule broke sends someone
    // looking for a rule that did in fact run.
    const message = await failure(
      'validate',
      { rules: [{ path: 'body.a' }, { path: 'body.b' }], mode: 'first' },
      { body: { a: 1 } }
    );
    expect(message).toContain('"body.b" is required');
    expect(message).not.toMatch(/not checked/);
  });

  it('takes a condition rule in the SAME language branch uses', async () => {
    const rules = [{ when: { left: { $path: 'body.total' }, op: 'gt', right: 0 }, message: 'Total must be positive.' }];
    expect(await run('validate', { rules }, { body: { total: 5 } })).toEqual({ ok: true, checked: 1 });
    expect(await failure('validate', { rules }, { body: { total: 0 } })).toContain('Total must be positive.');
  });

  it('reports an UNEVALUABLE condition as a broken rule, not as a different failure', async () => {
    // Which is what keeps mode "all" useful: one unevaluable rule must not hide
    // the four ordinary ones that also broke.
    const message = await failure(
      'validate',
      {
        rules: [
          { when: { left: { $path: 'body.thing' }, op: 'gt', right: 5 } },
          { path: 'body.missing' }
        ]
      },
      { body: { thing: { nested: true } } }
    );
    expect(message).toMatch(/rule 1 could not be evaluated/);
    expect(message).toMatch(/Cannot order-compare/);
    expect(message).toMatch(/"body\.missing" is required/);
  });

  it("uses the author's message when there is one", async () => {
    const message = await failure(
      'validate',
      { rules: [{ path: 'body.customer.email', message: 'The supplier sent no email address.' }] },
      { body: {} }
    );
    expect(message).toContain('The supplier sent no email address.');
    expect(message).not.toContain('is required and the data has');
  });

  it('refuses an unknown TYPE loudly at write time, naming what this backend checks', () => {
    const errors = shapeErrors('validate', { rules: [{ path: 'body.email', type: 'email' }] });
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/unknown type "email"/);
    for (const name of VALIDATE_TYPE_NAMES) expect(errors[0]).toContain(name);
    expect(errors[0]).toContain('validateLanguage');
  });

  it('is loud at RUN time too, rather than skipping a check it cannot perform', async () => {
    // Unreachable for a persisted definition. Asserted anyway: a silently
    // skipped check is worse than no check, because the step still says `ok`.
    expect(await failure('validate', { rules: [{ path: 'body.x', type: 'email' }] }, { body: { x: 1 } })).toMatch(
      /type "email", which this backend does not check/
    );
  });

  it('refuses rules that assert nothing, in all three ways they can', () => {
    expect(shapeErrors('validate', {})[0]).toMatch(/needs a "rules" array/);
    expect(shapeErrors('validate', { rules: [] })[0]).toMatch(/non-empty array/);
    expect(shapeErrors('validate', { rules: [{ path: 'a', when: { left: 1, op: 'truthy' } }] })[0]).toMatch(
      /exactly one of "path".*or "when"/
    );
    expect(shapeErrors('validate', { rules: [{}] })[0]).toMatch(/exactly one of/);
    // The quiet one: optional, and nothing asserted about it when present.
    expect(shapeErrors('validate', { rules: [{ path: 'a', required: false }] })[0]).toMatch(/asserts nothing/);
  });

  it('validates a condition rule with the condition validator, so one dialect is checked one way', () => {
    const errors = shapeErrors('validate', { rules: [{ when: { left: 1, op: 'nope', right: 2 } }] });
    expect(errors[0]).toMatch(/op must be one of/);
  });

  it('checks $path references inside a rule like every other param', () => {
    const def = {
      version: 1,
      id: 'wf',
      entry: 'guard',
      concurrency: 1,
      createdAt: '',
      updatedAt: '',
      steps: [
        {
          id: 'guard',
          kind: 'validate',
          params: { rules: [{ when: { left: { $path: 'upstream.ghost.total' }, op: 'gt', right: 0 } }] }
        }
      ]
    } as unknown as WorkflowDefinition;
    expect(validateWorkflowDefinition(def).join('\n')).toMatch(/references step "ghost"/);
  });

  it('has no routes at all — error edges already are try/catch', () => {
    expect(STEP_KIND_SPECS.validate.routes).toEqual([]);
    expect(shapeErrors('validate', { rules: [{ path: 'a' }] }, { routes: { invalid: ['x'] } })[0]).toMatch(
      /has no routes/
    );
  });
});

// ---------------------------------------------------------------------------
// filter
// ---------------------------------------------------------------------------

describe('CWF-004 slice 2 — filter', () => {
  const ORDERS = [
    { id: 1, status: 'paid' },
    { id: 2, status: 'unpaid' },
    { id: 3, status: 'unpaid' }
  ];

  it('keeps what matches, in the original order, and counts what it dropped', async () => {
    const out = await run('filter', {
      items: ORDERS,
      condition: { left: { $path: 'item.status' }, op: 'eq', right: 'unpaid' }
    });
    expect(out.items).toEqual([ORDERS[1], ORDERS[2]]);
    expect(out.count).toBe(2);
    expect(out.dropped).toBe(1);
    expect(out.total).toBe(3);
  });

  it('selects the route that says whether anything survived', async () => {
    const none = await run('filter', { items: ORDERS, condition: { left: { $path: 'item.id' }, op: 'gt', right: 99 } });
    expect(none.$routes).toEqual(['empty']);
    const some = await run('filter', { items: ORDERS, condition: { left: { $path: 'item.id' }, op: 'gt', right: 1 } });
    expect(some.$routes).toEqual(['nonempty']);
  });

  it('puts the item and its index in scope under author-chosen keys, like for-each', async () => {
    const out = await run('filter', {
      items: ['a', 'b', 'c'],
      itemKey: 'row',
      indexKey: 'n',
      condition: { left: { $path: 'n' }, op: 'gte', right: 1 }
    });
    expect(out.items).toEqual(['b', 'c']);
  });

  it('defaults items to previous.items, and the DECLARED default says the same thing', async () => {
    const out = await run('filter', { condition: { left: { $path: 'item' }, op: 'neq', right: 'b' } }, {
      previous: { items: ['a', 'b'] }
    });
    expect(out.items).toEqual(['a']);
    // CWF-005's lesson applied: the executor's fallback is what ever actually
    // applies, so it must not be able to drift from the documented one.
    const declared = STEP_KIND_SPECS.filter.params.find((p) => p.name === 'items')?.default;
    expect(declared).toEqual({ $path: 'previous.items' });
  });

  it('fails loudly when items is not an array — an absent list is not an empty one', async () => {
    const message = await failure('filter', { items: { $path: 'body.nope' }, condition: { left: 1, op: 'truthy' } });
    expect(message).toMatch(/"items" resolved to undefined, not an array/);
    expect(message).toMatch(/an absent list is not an empty one/i);
  });

  it('fails loudly naming the index when a condition cannot be evaluated on an item', async () => {
    expect(
      await failure('filter', {
        items: [1, { nested: true }],
        condition: { left: { $path: 'item' }, op: 'gt', right: 0 }
      })
    ).toMatch(/filter failed on item 1/);
  });

  it('is refused at write time with no condition, or with a route it does not have', () => {
    expect(shapeErrors('filter', {})[0]).toMatch(/needs a "condition" param/);
    expect(shapeErrors('filter', { condition: { left: 1, op: 'nope' } })[0]).toMatch(/op must be one of/);
    expect(
      shapeErrors('filter', { condition: { left: 1, op: 'truthy' } }, { routes: { ontrue: ['x'] } })[0]
    ).toMatch(/must be "empty" or "nonempty"/);
  });
});

// ---------------------------------------------------------------------------
// sort
// ---------------------------------------------------------------------------

describe('CWF-004 slice 2 — sort', () => {
  it('orders by a path inside each item, both ways', async () => {
    const items = [{ n: 3 }, { n: 1 }, { n: 2 }];
    expect((await run('sort', { items, by: 'n' })).items).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    expect((await run('sort', { items, by: 'n', order: 'descending' })).items).toEqual([{ n: 3 }, { n: 2 }, { n: 1 }]);
  });

  it('orders the items themselves when there is no path', async () => {
    expect((await run('sort', { items: ['pear', 'apple', 'fig'] })).items).toEqual(['apple', 'fig', 'pear']);
  });

  it("uses the CONDITION language's order, so a sort and a `gt` can never disagree", async () => {
    // Numeric strings compare numerically — `"10" > "9"` is true for `gt`, and
    // this must put them in that order or an author has learned two rules.
    expect((await run('sort', { items: ['10', '9', '100'] })).items).toEqual(['9', '10', '100']);
    // ISO dates order as instants, not as text.
    expect((await run('sort', { items: ['2026-01-02', '2025-12-31'] })).items).toEqual(['2025-12-31', '2026-01-02']);
  });

  it('is stable, so equal keys keep the order the supplier sent them in', async () => {
    const items = [
      { n: 1, tag: 'a' },
      { n: 1, tag: 'b' },
      { n: 0, tag: 'c' }
    ];
    expect((await run('sort', { items, by: 'n' })).items).toEqual([items[2], items[0], items[1]]);
  });

  it('sorts an absent key LAST in BOTH directions — reversing must not move absence', async () => {
    const items = [{ n: 2 }, {}, { n: 1 }, { n: null }];
    expect((await run('sort', { items, by: 'n' })).items).toEqual([{ n: 1 }, { n: 2 }, {}, { n: null }]);
    expect((await run('sort', { items, by: 'n', order: 'descending' })).items).toEqual([
      { n: 2 },
      { n: 1 },
      {},
      { n: null }
    ]);
  });

  it('fails loudly on two items that have no order', async () => {
    expect(await failure('sort', { items: [1, { a: 1 }] })).toMatch(/cannot sort these items/);
    expect(await failure('sort', { items: [{ n: 1 }, { n: { deep: true } }], by: 'n' })).toMatch(/cannot sort by "n"/);
  });

  it('never reorders the array it was given', async () => {
    const items = [{ n: 3 }, { n: 1 }];
    const out = await run('sort', { items, by: 'n' });
    expect(items).toEqual([{ n: 3 }, { n: 1 }]);
    expect(out.items).not.toBe(items);
  });

  it('is refused at write time with a bad order or a non-string path', () => {
    expect(shapeErrors('sort', { order: 'sideways' })[0]).toMatch(/"ascending" or "descending"/);
    expect(shapeErrors('sort', { by: 42 })[0]).toMatch(/must be a dotted path string/);
  });
});

// ---------------------------------------------------------------------------
// deduplicate
// ---------------------------------------------------------------------------

describe('CWF-004 slice 2 — deduplicate', () => {
  it('drops repeats by a path, keeping the first', async () => {
    const items = [
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
      { id: 'a', v: 3 }
    ];
    const out = await run('deduplicate', { items, by: 'id' });
    expect(out.items).toEqual([items[0], items[1]]);
    expect(out.removed).toBe(1);
    expect(out.count).toBe(2);
  });

  it('keeps the LAST value in its FIRST position, so the order does not shuffle', async () => {
    const items = [
      { id: 'a', v: 1 },
      { id: 'b', v: 2 },
      { id: 'a', v: 3 }
    ];
    const out = await run('deduplicate', { items, by: 'id', keep: 'last' });
    expect(out.items).toEqual([{ id: 'a', v: 3 }, { id: 'b', v: 2 }]);
  });

  it('compares whole items BY VALUE, so key order is not identity', async () => {
    const out = await run('deduplicate', { items: [{ a: 1, b: 2 }, { b: 2, a: 1 }, { a: 2 }] });
    expect(out.count).toBe(2);
  });

  it('does not confuse the string "1" with the number 1', async () => {
    expect((await run('deduplicate', { items: [1, '1', 1] })).items).toEqual([1, '1']);
  });

  it('ALWAYS keeps an item whose key is absent, and counts them', async () => {
    // The alternative silently deletes every row a supplier forgot an id for,
    // which is exactly the data you want when you go looking for what happened.
    const items = [{ id: 'a' }, {}, { id: null }, { id: 'a' }, {}];
    const out = await run('deduplicate', { items, by: 'id' });
    expect(out.items).toEqual([{ id: 'a' }, {}, { id: null }, {}]);
    expect(out.keyless).toBe(3);
    expect(out.removed).toBe(1);
  });

  it('is refused at write time with a bad keep or a non-string path', () => {
    expect(shapeErrors('deduplicate', { keep: 'both' })[0]).toMatch(/"first" or "last"/);
    expect(shapeErrors('deduplicate', { by: [] })[0]).toMatch(/must be a dotted path string/);
  });
});

// ---------------------------------------------------------------------------
// split
// ---------------------------------------------------------------------------

describe('CWF-004 slice 2 — split', () => {
  it('chunks into batches, with a short last one', async () => {
    const out = await run('split', { items: [1, 2, 3, 4, 5], size: 2 });
    expect(out.batches).toEqual([[1, 2], [3, 4], [5]]);
    expect(out.count).toBe(3);
    expect(out.total).toBe(5);
    expect(out.size).toBe(2);
  });

  it('produces zero batches from an empty list, and succeeds', async () => {
    const out = await run('split', { items: [], size: 10 });
    expect(out.batches).toEqual([]);
    expect(out.count).toBe(0);
  });

  it('FAILS rather than truncating past maxBatches', async () => {
    const message = await failure('split', { items: [1, 2, 3, 4], size: 1, maxBatches: 3 });
    expect(message).toMatch(/is 4 batches, over the maxBatches cap of 3/);
    expect(message).toMatch(/Raise the cap deliberately/);
  });

  it('fails loudly on a size that is not a whole number of 1 or more', async () => {
    expect(await failure('split', { items: [1], size: 0 })).toMatch(/whole number of 1 or more/);
    expect(await failure('split', { items: [1], size: 1.5 })).toMatch(/whole number of 1 or more/);
    expect(await failure('split', { items: [1] })).toMatch(/whole number of 1 or more/);
  });

  it('RESOLVES a size written as a reference, rather than only accepting one', async () => {
    // The half-bug this pins: write-time validation deliberately allows a
    // `{"$path": …}` size (the value does not exist yet, so it cannot be
    // range-checked), and an executor that read the param RAW would then fail
    // every one of them at run time — a definition accepted at write time that
    // could never run. That is exactly the bug `wait.duration` had.
    const out = await run('split', { items: [1, 2, 3], size: { $path: 'body.batchSize' } }, { body: { batchSize: 2 } });
    expect(out.batches).toEqual([[1, 2], [3]]);
    expect(await failure('split', { items: [1], size: { $path: 'body.nope' } }, { body: {} })).toMatch(
      /"size" resolved to undefined/
    );
  });

  it('accepts a size written as a REFERENCE at write time, like wait.duration', () => {
    expect(shapeErrors('split', { size: { $path: 'body.batchSize' } })).toEqual([]);
    expect(shapeErrors('split', {})[0]).toMatch(/needs a "size" param/);
    expect(shapeErrors('split', { size: 0 })[0]).toMatch(/whole number of 1 or more/);
    expect(shapeErrors('split', { size: 10, maxBatches: 0 })[0]).toMatch(/must be a number >= 1/);
  });
});

// ---------------------------------------------------------------------------
// The JSON operations
// ---------------------------------------------------------------------------

describe('CWF-004 slice 2 — the JSON operations finish the transform vocabulary', () => {
  it('reads a string that is really JSON, and composes with $get', async () => {
    const out = await run(
      'transform',
      {
        output: {
          order: { $parseJson: { $path: 'body.payload' } },
          orderId: { $get: [{ $parseJson: { $path: 'body.payload' } }, 'order.id'] }
        }
      },
      { body: { payload: '{"order":{"id":"ord_1"}}' } }
    );
    expect(out.order).toEqual({ order: { id: 'ord_1' } });
    expect(out.orderId).toBe('ord_1');
  });

  it('writes a value as JSON text', async () => {
    const out = await run('transform', { output: { blob: { $stringifyJson: { $path: 'body.o' } } } }, {
      body: { o: { a: 1 } }
    });
    expect(out.blob).toBe('{"a":1}');
  });

  it('fails loudly on JSON it cannot read, and SHOWS the text', async () => {
    const step: Record<string, unknown> = { output: { x: { $parseJson: '{"a":' } } };
    const message = await failure('transform', step);
    expect(message).toMatch(/"\$parseJson" could not read/);
    // The offending text is QUOTED into the message: "invalid JSON" with nothing
    // to look at is the least useful failure a webhook can produce.
    expect(message).toContain(JSON.stringify('{"a":'));
    expect(message).toMatch(/Unexpected end of JSON input/);
  });

  it('refuses a non-string to parse and an absent value to write, naming $default', async () => {
    expect(await failure('transform', { output: { x: { $parseJson: 42 } } })).toMatch(/needs text holding JSON/);
    expect(await failure('transform', { output: { x: { $parseJson: 42 } } })).toContain('$default');
    expect(await failure('transform', { output: { x: { $stringifyJson: { $path: 'nope' } } } })).toContain('$default');
  });

  it('is served in the vocabulary, so the editor picker and an agent both see it', () => {
    const { transformLanguage } = stepKindCatalog();
    const names = transformLanguage.ops.map((o) => o.name);
    expect(names).toContain('$parseJson');
    expect(names).toContain('$stringifyJson');
    expect(TRANSFORM_OP_NAMES).toContain('$parseJson');
    // Every served op is named in the card's own description — the property
    // that makes a Transform card self-explaining without a round trip.
    const description = STEP_KIND_SPECS.transform.params[0].description;
    for (const name of TRANSFORM_OP_NAMES) expect(description).toContain(name);
  });
});

describe('CWF-004 slice 2 — still nothing else can compute', () => {
  it('leaves the new operations as plain data for a condition and an ordinary param', () => {
    // The op table is STILL a parameter of the shared resolver with no default.
    // Adding two operations to the transform table must not widen a condition,
    // and the type system is what enforces it — this pins the behaviour.
    const scope = { body: { raw: '{"a":1}' } };
    expect(resolveValueDeep({ $parseJson: { $path: 'body.raw' } }, scope)).toEqual({ $parseJson: '{"a":1}' });
    expect(evaluateCondition({ left: { $parseJson: { $path: 'body.raw' } }, op: 'eq', right: { a: 1 } }, scope)).toBe(
      false
    );
    expect(resolveStepParams({ p: { $parseJson: { $path: 'body.raw' } } }, scope).p).toEqual({ $parseJson: '{"a":1}' });
  });
});

// ---------------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------------

describe('CWF-004 slice 2 — the catalog', () => {
  it('bumps the shape version and serves the validate vocabulary over the wire', () => {
    const wire = JSON.parse(JSON.stringify(stepKindCatalog())) as ReturnType<typeof stepKindCatalog>;
    expect(wire.version).toBe('1.7.0');
    expect(wire.validateLanguage.types.map((t) => t.name)).toEqual(VALIDATE_TYPE_NAMES);
    expect(wire.validateLanguage.ruleForms.map((f) => f.form)).toEqual(['path', 'when']);
    expect(wire.validateLanguage.notes.length).toBeGreaterThan(2);
  });

  it('generates the served type list from the ONE table that implements it', () => {
    // The property CWF-004 asks for by name: removing a type from the backend
    // removes it from the editor's picker with NO editor change. That only holds
    // while the served description and the implementation come from one list.
    expect(VALIDATE_LANGUAGE.types.map((t) => t.name)).toEqual(Object.keys(VALIDATE_TYPES));
    for (const t of VALIDATE_LANGUAGE.types) expect(typeof VALIDATE_TYPES[t.name].test).toBe('function');
  });

  it('declares `rules` as required, raw, and wearing a bespoke control', () => {
    const spec = STEP_KIND_SPECS.validate;
    const rules = spec.params.find((p) => p.name === 'rules');
    expect(spec.invokesFunction).toBe(false);
    expect(rules?.required).toBe(true);
    expect(rules?.raw).toBe(true);
    // No declared default and no executor fallback — CWF-005's finding applied
    // rather than repeated. A validate step with no rules is refused.
    expect(rules?.default).toBeUndefined();
    expect(rules?.control).toBe('validate-rules');
  });

  it('gives every new kind a control the editor can already render', () => {
    // `control` is a served STRING so a newer backend can name one an older
    // editor never heard of — which only degrades gracefully while the param
    // also declares a `type` that editor knows.
    const known = new Set(['string', 'number', 'boolean', 'enum', 'array', 'object', 'condition', 'path', 'any']);
    for (const kind of ['validate', 'filter', 'sort', 'deduplicate', 'split'] as StepKind[]) {
      for (const param of STEP_KIND_SPECS[kind].params) expect(known.has(param.type)).toBe(true);
    }
  });

  it('puts the whole family in one category, and gives only filter routes', () => {
    for (const kind of ['transform', 'validate', 'filter', 'sort', 'deduplicate', 'split'] as StepKind[]) {
      expect(STEP_KIND_SPECS[kind].category).toBe('Workflow Data');
      expect(STEP_KIND_SPECS[kind].invokesFunction).toBe(false);
    }
    // Filter is the one that can change whether the list is empty, which is the
    // whole reason it is the one with ports for it.
    const withRoutes = (['transform', 'validate', 'filter', 'sort', 'deduplicate', 'split'] as StepKind[]).filter(
      (k) => STEP_KIND_SPECS[k].routes.length > 0
    );
    expect(withRoutes).toEqual(['filter']);
  });
});

// ---------------------------------------------------------------------------
// End to end
// ---------------------------------------------------------------------------

describe('CWF-004 slice 2 — end to end, through the engine', () => {
  const tempDirs: string[] = [];

  function engineWith(executor: CompositeStepExecutor): WorkflowEngine {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf004b-'));
    tempDirs.push(dir);
    const history = new ExecutionHistory();
    history.open(dir);
    return new WorkflowEngine({ executions: history, executor, backendId: 'b1', backendName: 'B1' });
  }

  afterAll(() => {
    for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
  });

  /** Guard, narrow, order, de-duplicate and batch — one supplier delivery. */
  const DEF = {
    version: 1,
    id: 'intake',
    name: 'intake',
    entry: 'guard',
    concurrency: 1,
    createdAt: '',
    updatedAt: '',
    steps: [
      {
        id: 'guard',
        kind: 'validate',
        params: {
          rules: [
            { path: 'body.orders', type: 'array', message: 'The supplier sent no orders.' },
            { when: { left: { $path: 'body.orders' }, op: 'notEmpty' }, message: 'The order list was empty.' }
          ]
        },
        next: ['unpaid'],
        onError: ['giveUp']
      },
      {
        id: 'unpaid',
        kind: 'filter',
        params: {
          items: { $path: 'body.orders' },
          condition: { left: { $path: 'item.status' }, op: 'neq', right: 'paid' }
        },
        routes: { nonempty: ['once'], empty: ['giveUp'] }
      },
      { id: 'once', kind: 'deduplicate', params: { items: { $path: 'previous.items' }, by: 'id' }, next: ['oldest'] },
      { id: 'oldest', kind: 'sort', params: { items: { $path: 'previous.items' }, by: 'createdAt' }, next: ['batch'] },
      { id: 'batch', kind: 'split', params: { items: { $path: 'previous.items' }, size: 2 }, next: ['charge'] },
      {
        id: 'charge',
        kind: 'call-function',
        ref: 'chargeBatch',
        params: { batches: { $path: 'previous.batches' }, howMany: { $path: 'previous.count' } }
      },
      { id: 'giveUp', kind: 'stop', params: { message: 'nothing to do', isError: false } }
    ]
  } as unknown as WorkflowDefinition;

  it('is a definition this backend would actually accept', () => {
    expect(validateWorkflowDefinition(DEF)).toEqual([]);
  });

  it('guards, narrows, de-duplicates, orders and batches one supplier delivery', async () => {
    const seen: Record<string, unknown>[] = [];
    const executor = new CompositeStepExecutor({
      getRunner: () => null as never,
      overrides: {
        'call-function': {
          async execute(ctx) {
            seen.push(ctx.input);
            return { ok: true };
          }
        }
      }
    });

    const result = await engineWith(executor).run(DEF, {
      trigger: { type: 'webhook' },
      payload: {
        body: {
          orders: [
            { id: 'c', status: 'unpaid', createdAt: '2026-03-01' },
            { id: 'a', status: 'paid', createdAt: '2026-01-01' },
            { id: 'b', status: 'unpaid', createdAt: '2026-02-01' },
            { id: 'b', status: 'unpaid', createdAt: '2026-02-01' },
            { id: 'd', status: 'unpaid', createdAt: '2026-04-01' }
          ]
        }
      }
    });

    expect(result.status).toBe('success');
    expect(seen.length).toBe(1);
    // Paid dropped, the repeat collapsed, oldest first, two per batch.
    expect(seen[0].howMany).toBe(2);
    expect(seen[0].batches).toEqual([
      [
        { id: 'b', status: 'unpaid', createdAt: '2026-02-01' },
        { id: 'c', status: 'unpaid', createdAt: '2026-03-01' }
      ],
      [{ id: 'd', status: 'unpaid', createdAt: '2026-04-01' }]
    ]);
  });

  it('routes a failed validate down onError like any other step failure', async () => {
    const executor = new CompositeStepExecutor({ getRunner: () => null as never });
    const result = await engineWith(executor).run(DEF, {
      trigger: { type: 'webhook' },
      payload: { body: { orders: 'not-a-list' } }
    });
    expect(result.status).toBe('success'); // the failure was ROUTED
    expect(result.stepsRun).toBe(2); // guard, then giveUp
  });

  it('takes the empty route when the filter leaves nothing', async () => {
    const executor = new CompositeStepExecutor({ getRunner: () => null as never });
    const result = await engineWith(executor).run(DEF, {
      trigger: { type: 'webhook' },
      payload: { body: { orders: [{ id: 'a', status: 'paid' }] } }
    });
    expect(result.status).toBe('success');
    expect(result.stepsRun).toBe(3); // guard, unpaid, giveUp
  });
});
