/**
 * CWF-004 — the `transform` step kind.
 *
 * Three things are under test and they are not the same thing:
 *
 *  1. **The vocabulary is closed.** An operation this backend does not perform
 *     is refused when the definition is saved, and would still be loud if one
 *     reached a run. The whole security argument for allowing reshaping at the
 *     workflow level rests on that being true, so it is asserted from both ends.
 *  2. **Conditions did not gain the ability to compute.** The op table is a
 *     PARAMETER of the shared resolver, and the specs below pin that a condition
 *     and an ordinary step param still see `{"$lower": …}` as plain data.
 *  3. **The end-to-end case the task exists for** — an awkward supplier payload
 *     reshaped into the flat object a function accepts, through the real engine.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ExecutionHistory } from '../src/execution/ExecutionStore';
import { WorkflowEngine, validateWorkflowDefinition } from '../src/workflow/WorkflowEngine';
import { CompositeStepExecutor } from '../src/workflow/steps/CompositeStepExecutor';
import { evaluateCondition } from '../src/workflow/steps/conditions';
import { stepKindCatalog, STEP_KIND_SPECS, validateStepShape } from '../src/workflow/steps/kinds';
import {
  TRANSFORM_LANGUAGE,
  TRANSFORM_OPS,
  TRANSFORM_OP_NAMES,
  TransformStepExecutor,
  validateTransformOutput
} from '../src/workflow/steps/transform';
import { resolveStepParams, resolveValueDeep } from '../src/workflow/steps/values';
import type { StepExecContext } from '../src/workflow/StepExecutor';
import type { WorkflowDefinition, WorkflowStep } from '../src/workflow/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve one transform `output` against a scope, the way the executor does. */
async function run(output: unknown, scope: Record<string, unknown>): Promise<Record<string, unknown>> {
  const step: WorkflowStep = { id: 'shape', kind: 'transform', params: { output } };
  const ctx = {
    workflow: {} as WorkflowDefinition,
    step,
    input: scope,
    scope,
    upstream: {},
    signal: new AbortController().signal
  } as StepExecContext;
  return new TransformStepExecutor().execute(ctx);
}

async function failure(output: unknown, scope: Record<string, unknown> = {}): Promise<string> {
  try {
    await run(output, scope);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  throw new Error('expected the step to fail loudly, and it did not');
}

function shapeErrors(output: unknown): string[] {
  return validateStepShape({ id: 'shape', kind: 'transform', params: { output } } as WorkflowStep);
}

/** The supplier payload from CWF-004's own argument: nested, wrapped, awkward. */
const SUPPLIER = {
  body: {
    Envelope: {
      customer: { FIRST: '  Ada ', LAST: 'LOVELACE', email: 'ADA@Example.COM  ' },
      orders: [
        { id: 'ord_1', tags: ['rush', 'gift'], payment: { method: 'card', total: '42.50' } },
        { id: 'ord_2', tags: [], payment: { method: 'invoice', total: '7' } }
      ]
    }
  }
};

// ---------------------------------------------------------------------------

describe('CWF-004 the operation vocabulary', () => {
  it('reads a path out of the run and renames it — the case the step exists for', async () => {
    const out = await run({ paymentObject: { $path: 'body.Envelope.orders.0.payment' } }, SUPPLIER);
    expect(out).toEqual({ paymentObject: { method: 'card', total: '42.50' } });
  });

  it('joins, trims and lowercases without a line of code', async () => {
    const out = await run(
      {
        fullName: {
          $concat: [{ $trim: { $path: 'body.Envelope.customer.FIRST' } }, ' ', { $path: 'body.Envelope.customer.LAST' }]
        },
        email: { $lower: { $trim: { $path: 'body.Envelope.customer.email' } } }
      },
      SUPPLIER
    );
    expect(out).toEqual({ fullName: 'Ada LOVELACE', email: 'ada@example.com' });
  });

  it('takes a one-operand value VERBATIM, so an array operand is not an argument list', async () => {
    // The ambiguity a fixed arity buys away: `{"$length": [1,2,3]}` is the
    // length of that array, never a botched three-argument call.
    expect(await run({ n: { $length: [1, 2, 3] } }, {})).toEqual({ n: 3 });
    expect(await run({ n: { $length: 'abcd' } }, {})).toEqual({ n: 4 });
    expect(await run({ n: { $length: { a: 1, b: 2 } } }, {})).toEqual({ n: 2 });
  });

  it('coerces, defaults, picks, splits and reads a path INTO a computed value', async () => {
    const out = await run(
      {
        total: { $number: { $path: 'body.Envelope.orders.0.payment.total' } },
        currency: { $default: [{ $path: 'body.Envelope.currency' }, 'GBP'] },
        payment: { $pick: [{ $path: 'body.Envelope.orders.0.payment' }, ['method']] },
        firstTag: { $get: [{ $path: 'body.Envelope.orders.0.tags' }, '0'] },
        lastTag: { $get: [{ $path: 'body.Envelope.orders.0.tags' }, '-1'] },
        tagList: { $join: [{ $path: 'body.Envelope.orders.0.tags' }, ', '] },
        parts: { $split: ['a|b|c', '|'] }
      },
      SUPPLIER
    );
    expect(out).toEqual({
      total: 42.5,
      currency: 'GBP',
      payment: { method: 'card' },
      firstTag: 'rush',
      lastTag: 'gift',
      tagList: 'rush, gift',
      parts: ['a', 'b', 'c']
    });
  });

  it('keeps a nested object shape and a literal escape intact', async () => {
    const out = await run(
      {
        order: { id: { $path: 'body.Envelope.orders.1.id' }, source: 'supplier-x' },
        raw: { $literal: { $path: 'not a path' } }
      },
      SUPPLIER
    );
    expect(out).toEqual({
      order: { id: 'ord_2', source: 'supplier-x' },
      raw: { $path: 'not a path' }
    });
  });

  it('never descends into a $literal, so an operation inside one stays data', async () => {
    const out = await run({ shape: { $literal: { $lower: 'NOT AN OP HERE' } } }, {});
    expect(out).toEqual({ shape: { $lower: 'NOT AN OP HERE' } });
  });
});

describe('CWF-004 loudness — decided once, for every operation', () => {
  it('fails the step when an operation cannot be performed', async () => {
    expect(await failure({ x: { $number: { $path: 'body.nope' } } }, { body: { nope: 'twelvish' } })).toMatch(
      /\$number.*cannot read/i
    );
    expect(await failure({ x: { $upper: { $path: 'missing' } } }, {})).toMatch(/needs text/i);
    expect(await failure({ x: { $join: ['not-an-array', ','] } }, {})).toMatch(/needs an array/i);
    expect(await failure({ x: { $pick: [42, ['a']] } }, {})).toMatch(/needs an object/i);
    expect(await failure({ x: { $length: 42 } }, {})).toMatch(/\$length/);
  });

  it('names $default in the message, because that is the fix for an absent field', async () => {
    expect(await failure({ x: { $lower: { $path: 'body.optional' } } }, { body: {} })).toContain('$default');
  });

  it('treats ABSENCE as ordinary — the one deliberate exception', async () => {
    // `getPath` has always answered `undefined` for a missing segment, and
    // `$get` past the end matches it. A field that is sometimes absent is what
    // `$default` is for; making absence loud would make `$default` unreachable.
    const out = await run(
      {
        maybe: { $get: [{ $path: 'body.list' }, '9'] },
        orElse: { $default: [{ $get: [{ $path: 'body.list' }, '9'] }, 'none'] }
      },
      { body: { list: ['a'] } }
    );
    expect(out.maybe).toBeUndefined();
    expect(out.orElse).toBe('none');
  });

  it('refuses an unknown operation at RUN time too, rather than passing it through', async () => {
    // Unreachable for a persisted definition (write-time validation refuses it),
    // and asserted anyway: a silent passthrough would hand a cloud function a
    // literal `{"$lowr": …}` object as if the author had meant it as data.
    expect(await failure({ x: { $lowr: 'ADA' } }, {})).toMatch(/unknown operation "\$lowr"/i);
  });
});

describe('CWF-004 write-time validation', () => {
  it('requires an output object, and says what it is for', () => {
    expect(shapeErrors(undefined)[0]).toMatch(/needs an "output" object/);
    expect(shapeErrors('nope')[0]).toMatch(/must be an object/);
    // Empty is legal: a step producing `{}` is useless, not broken, and
    // refusing it would 400 an author mid-edit for no run-time benefit.
    expect(shapeErrors({})).toEqual([]);
  });

  it('refuses an unknown operation LOUDLY, naming what this backend does perform', () => {
    const errors = shapeErrors({ email: { $lowr: { $path: 'body.email' } } });
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/unknown operation "\$lowr"/);
    expect(errors[0]).toContain('$lower');
    expect(errors[0]).toContain('transformLanguage');
  });

  it('checks arity, which is what makes the vocabulary closed rather than merely small', () => {
    expect(shapeErrors({ x: { $join: [{ $path: 'a' }] } })[0]).toMatch(/exactly 2 operands, got 1/);
    expect(shapeErrors({ x: { $concat: [] } })[0]).toMatch(/at least one operand/);
    expect(shapeErrors({ x: { $join: 'nope' } })[0]).toMatch(/array of 2 operands/);
    expect(shapeErrors({ x: { $concat: 'nope' } })[0]).toMatch(/non-empty array/);
  });

  it('refuses an operation object that carries anything else', () => {
    const errors = shapeErrors({ x: { $lower: 'A', extra: 1 } });
    expect(errors[0]).toMatch(/must be the only key/);
    expect(errors[0]).toContain('$literal');
  });

  it('refuses a field with no name and a $path that is not a path', () => {
    expect(shapeErrors({ '  ': 1 })[0]).toMatch(/a field needs a name/);
    expect(shapeErrors({ x: { $path: 42 } })[0]).toMatch(/must be a dotted path string/);
  });

  it('validates operands recursively, so a typo nested three deep is still caught', () => {
    const errors = shapeErrors({
      a: { $concat: [{ $upper: { $trimm: { $path: 'body.x' } } }, '!'] }
    });
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('$trimm');
    expect(errors[0]).toContain('output.a.$concat[0].$upper');
  });

  it('leaves a realistic supplier reshape far inside the depth ceiling', () => {
    // CWF-004's trap: nested ops eat depth fast. They do not eat much of it —
    // this is deeper than anything an author writes and it is still legal.
    const errors = validateTransformOutput(
      {
        customer: {
          name: { $concat: [{ $trim: { $path: 'body.a.b.c.first' } }, ' ', { $upper: { $path: 'body.a.b.c.last' } }] },
          email: { $default: [{ $lower: { $trim: { $path: 'body.a.b.c.email' } } }, 'unknown@example.com'] }
        }
      },
      'step "s"'
    );
    expect(errors).toEqual([]);
  });

  it('checks $path references inside a transform like every other param', async () => {
    // `output` is `raw`, so the engine does not resolve it — but write-time
    // reference checking walks EVERY param, and a dangling `upstream.<id>` in a
    // transform must be the same 400 it is anywhere else.
    const def = {
      version: 1,
      id: 'wf',
      entry: 'shape',
      concurrency: 1,
      createdAt: '',
      updatedAt: '',
      steps: [{ id: 'shape', kind: 'transform', params: { output: { x: { $path: 'upstream.ghost.total' } } } }]
    } as unknown as WorkflowDefinition;
    const errors = validateWorkflowDefinition(def);
    expect(errors.join('\n')).toMatch(/references step "ghost"/);
  });
});

describe('CWF-004 the shared resolver did NOT gain the ability to compute', () => {
  it('leaves an operation as plain data for an ordinary step param', () => {
    // The op table is a PARAMETER with no default. A `call-function` param
    // carrying `{"$lower": …}` is an object with a `$lower` key, exactly as it
    // was before this task, and the function receives it verbatim.
    const resolved = resolveStepParams({ note: { $lower: { $path: 'body.name' } } }, { body: { name: 'ADA' } });
    expect(resolved.note).toEqual({ $lower: 'ADA' });
  });

  it('leaves an operation as plain data for a condition', () => {
    // If ops had gone into the shared resolver, this comparison would be true —
    // and a condition would have started computing, which is the widening
    // CWF-004's third design question exists to refuse.
    const scope = { body: { name: 'ADA' } };
    expect(evaluateCondition({ left: { $lower: { $path: 'body.name' } }, op: 'eq', right: 'ada' }, scope)).toBe(false);
    expect(resolveValueDeep({ $lower: { $path: 'body.name' } }, scope)).toEqual({ $lower: 'ADA' });
  });
});

describe('CWF-004 the catalog', () => {
  it('serves the vocabulary, with arity and operand labels, over the wire', () => {
    const wire = JSON.parse(JSON.stringify(stepKindCatalog())) as ReturnType<typeof stepKindCatalog>;
    // 1.6.0 when slice 1 shipped; 1.7.0 since slice 2 added `validateLanguage`.
    // Kept as a literal rather than read from the constant, so a shape change
    // has to be a deliberate edit here as well as there.
    expect(wire.version).toBe('1.7.0');
    expect(wire.transformLanguage.ops.map((o) => o.name).sort()).toEqual([...TRANSFORM_OP_NAMES].sort());
    // The table and its served description cannot drift: removing an op from
    // the backend has to remove it from the editor's picker with no editor
    // change, which only holds while these two are generated from one list.
    for (const op of wire.transformLanguage.ops) {
      expect(TRANSFORM_OPS[op.name].arity).toEqual(op.arity);
    }
    expect(wire.transformLanguage.notes.join(' ')).toMatch(/no arithmetic/i);
  });

  it('declares `output` as required, raw, and wearing a bespoke control', () => {
    const spec = STEP_KIND_SPECS.transform;
    const output = spec.params.find((p) => p.name === 'output');
    expect(spec.invokesFunction).toBe(false);
    expect(output?.required).toBe(true);
    // `raw` is what tells the engine NOT to value-resolve it — the opposite of
    // CWF-001's case, where `raw` would have broken the feature. Here the
    // executor owns the walk because only it has the op table.
    expect(output?.raw).toBe(true);
    // ⚠️ No `default`: a declared default never runs a setter in this codebase,
    // and the executor has no fallback either (CWF-005's finding).
    expect(output?.default).toBeUndefined();
    expect(output?.control).toBe('transform-output');
  });

  it('names every op it serves in the catalog description, so a card is self-explaining', () => {
    const description = STEP_KIND_SPECS.transform.params[0].description;
    for (const name of TRANSFORM_OP_NAMES) expect(description).toContain(name);
    expect(TRANSFORM_LANGUAGE.summary).toMatch(/closed/i);
  });
});

describe('CWF-004 end to end, through the engine', () => {
  const tempDirs: string[] = [];

  function engineWith(executor: CompositeStepExecutor): WorkflowEngine {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cwf004-'));
    tempDirs.push(dir);
    const history = new ExecutionHistory();
    history.open(dir);
    return new WorkflowEngine({ executions: history, executor, backendId: 'b1', backendName: 'B1' });
  }

  afterAll(() => {
    for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
  });

  it('reshapes a supplier payload into the flat object the next step reads', async () => {
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

    const def = {
      version: 1,
      id: 'supplier',
      name: 'supplier',
      entry: 'shape',
      concurrency: 1,
      createdAt: '',
      updatedAt: '',
      steps: [
        {
          id: 'shape',
          kind: 'transform',
          params: {
            output: {
              name: {
                $concat: [
                  { $trim: { $path: 'body.Envelope.customer.FIRST' } },
                  ' ',
                  { $path: 'body.Envelope.customer.LAST' }
                ]
              },
              email: { $lower: { $trim: { $path: 'body.Envelope.customer.email' } } },
              total: { $number: { $path: 'body.Envelope.orders.0.payment.total' } },
              currency: { $default: [{ $path: 'body.Envelope.currency' }, 'GBP'] }
            }
          },
          next: ['charge']
        },
        {
          id: 'charge',
          kind: 'call-function',
          ref: 'chargeCard',
          params: {
            amount: { $path: 'previous.total' },
            payer: { $path: 'previous.email' }
          }
        }
      ]
    } as unknown as WorkflowDefinition;

    // It has to be a definition the backend would actually accept.
    expect(validateWorkflowDefinition(def)).toEqual([]);

    const result = await engineWith(executor).run(def, { trigger: { type: 'manual' }, payload: SUPPLIER });

    expect(result.status).toBe('success');
    expect(seen.length).toBe(1);
    // The function is handed a stable input contract — no Envelope, no nesting,
    // no knowledge of which supplier this run came from.
    expect(seen[0].amount).toBe(42.5);
    expect(seen[0].payer).toBe('ada@example.com');
    expect(seen[0].previous).toEqual({
      name: 'Ada LOVELACE',
      email: 'ada@example.com',
      total: 42.5,
      currency: 'GBP'
    });
  });

  it('routes a failed transform down onError like any other step failure', async () => {
    const executor = new CompositeStepExecutor({ getRunner: () => null as never });
    const def = {
      version: 1,
      id: 'bad',
      entry: 'shape',
      concurrency: 1,
      createdAt: '',
      updatedAt: '',
      steps: [
        {
          id: 'shape',
          kind: 'transform',
          params: { output: { total: { $number: { $path: 'body.total' } } } },
          onError: ['giveUp']
        },
        { id: 'giveUp', kind: 'stop', params: { message: 'bad supplier payload', isError: false } }
      ]
    } as unknown as WorkflowDefinition;

    const result = await engineWith(executor).run(def, {
      trigger: { type: 'manual' },
      payload: { body: { total: 'twelvish' } }
    });
    expect(result.status).toBe('success');
    expect(result.stepsRun).toBe(2);
  });
});
