/**
 * WFA-003 — the value language for step params, and the one run payload shape.
 *
 * Two properties matter most here and both are about NOT surprising an author:
 *
 *   1. Params and conditions speak the SAME language. The resolver was extracted
 *      from `conditions.ts` rather than reimplemented, so `-1` means last and a
 *      missing key is `undefined` in a param exactly as it is in a comparison.
 *      `workflow-conditions.test.ts` passing untouched is the other half of that
 *      evidence.
 *   2. A reference to a step that cannot have run is a WRITE-TIME 400, not a
 *      silent `undefined` found halfway through a production run. The engine
 *      cannot know a function's output shape, so a path INTO an output is
 *      allowed; a path naming a step that does not exist, or one that is not
 *      upstream, is a typo and is rejected.
 */
import { buildRunPayload, spreadableBody } from '../src/workflow/runPayload';
import { validateWorkflowDefinition } from '../src/workflow/WorkflowEngine';
import { rawParamNames, STEP_KIND_SPECS, stepKindCatalog } from '../src/workflow/steps/kinds';
import {
  collectValuePaths,
  exceedsValueDepth,
  MAX_VALUE_DEPTH,
  resolveStepParams,
  resolveValueDeep
} from '../src/workflow/steps/values';
import type { WorkflowDefinition, WorkflowStep } from '../src/workflow/types';

const scope = {
  body: { total: 120, lines: [{ id: 'a' }, { id: 'b' }] },
  previous: { result: { orderId: 'ord_1' } },
  upstream: { save: { result: { orderId: 'ord_1' } }, quote: { result: { total: 99 } } },
  zero: 0
};

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

describe('WFA-003 param value resolution', () => {
  it('resolves a literal, a $path and a $literal escape', () => {
    expect(resolveStepParams({ currency: 'GBP' }, scope)).toEqual({ currency: 'GBP' });
    expect(resolveStepParams({ amount: { $path: 'body.total' } }, scope)).toEqual({ amount: 120 });
    // $literal must mean exactly what it means in a condition: the wrapped value
    // verbatim, NOT descended into. Two dialects of one syntax is the trap.
    expect(resolveStepParams({ note: { $literal: { $path: 'not a path' } } }, scope)).toEqual({
      note: { $path: 'not a path' }
    });
  });

  it('addresses an earlier step by id, not only `previous`', () => {
    expect(resolveStepParams({ id: { $path: 'upstream.save.result.orderId' } }, scope)).toEqual({ id: 'ord_1' });
    expect(resolveStepParams({ t: { $path: 'upstream.quote.result.total' } }, scope)).toEqual({ t: 99 });
  });

  it('leaves an unresolvable path undefined rather than failing', () => {
    // This matches how the payload has always behaved and is what keeps an
    // optional param possible. The canvas surfaces a dangling reference at
    // author time (WFA-004); the engine does not invent an error at run time.
    expect(resolveStepParams({ x: { $path: 'upstream.nope.y' } }, scope)).toEqual({ x: undefined });
  });

  it('resolves specs nested inside objects and arrays', () => {
    const resolved = resolveStepParams(
      {
        order: { id: { $path: 'previous.result.orderId' }, currency: 'GBP' },
        ids: [{ $path: 'body.lines.0.id' }, { $path: 'body.lines.-1.id' }, 'literal']
      },
      scope
    );
    expect(resolved).toEqual({
      order: { id: 'ord_1', currency: 'GBP' },
      ids: ['a', 'b', 'literal']
    });
  });

  it('keeps a genuine zero — the resolver returns values, it does not test them', () => {
    expect(resolveStepParams({ n: { $path: 'zero' } }, scope)).toEqual({ n: 0 });
  });

  it('passes DSL params through untouched', () => {
    // A branch's condition resolved eagerly would be rewritten into its own
    // answer in the execution record, reading as if the author had written a
    // boolean where they wrote a comparison.
    const condition = { left: { $path: 'body.total' }, op: 'gt', right: 100 };
    const out = resolveStepParams({ condition }, scope, rawParamNames('branch'));
    expect(out.condition).toEqual(condition);
    // …and without the raw set, it WOULD be resolved — so the marker is load-bearing.
    expect(resolveStepParams({ condition }, scope).condition).toEqual({ left: 120, op: 'gt', right: 100 });
  });

  it('marks exactly the DSL params raw', () => {
    expect([...rawParamNames('branch')]).toEqual(['condition']);
    expect([...rawParamNames('for-each')]).toEqual(['filter']);
    expect([...rawParamNames('switch')]).toEqual(['cases']);
    expect([...rawParamNames('call-function')]).toEqual([]);
  });

  it('stops descending past the documented depth instead of recursing forever', () => {
    let deep: unknown = { $path: 'body.total' };
    for (let i = 0; i < MAX_VALUE_DEPTH + 2; i++) deep = { nested: deep };
    expect(exceedsValueDepth(deep)).toBe(true);
    // Left verbatim rather than throwing mid-run; write-time validation rejects it.
    expect(() => resolveValueDeep(deep, scope)).not.toThrow();

    let shallow: unknown = { $path: 'body.total' };
    for (let i = 0; i < 5; i++) shallow = { nested: shallow };
    expect(exceedsValueDepth(shallow)).toBe(false);
  });

  it('collects every $path with its location, and never inside a $literal', () => {
    const found = collectValuePaths(
      {
        amount: { $path: 'body.total' },
        order: { id: { $path: 'upstream.save.id' } },
        list: [{ $path: 'body.lines.0.id' }],
        escaped: { $literal: { $path: 'body.ignored' } }
      },
      'params'
    );
    expect(found.map((f) => f.path).sort()).toEqual(['body.lines.0.id', 'body.total', 'upstream.save.id']);
    expect(found.find((f) => f.path === 'upstream.save.id')?.where).toBe('params.order.id');
  });
});

// ---------------------------------------------------------------------------
// Write-time validation
// ---------------------------------------------------------------------------

function def(steps: WorkflowStep[], entry = steps[0].id): WorkflowDefinition {
  return {
    version: 1,
    id: 'wf_test',
    entry,
    concurrency: 1,
    steps,
    createdAt: 'now',
    updatedAt: 'now'
  };
}

describe('WFA-003 write-time validation of step references', () => {
  const chain = (chargeParams: Record<string, unknown>): WorkflowStep[] => [
    { id: 'save', kind: 'call-function', ref: 'saveOrder', next: ['decide'] },
    {
      id: 'decide',
      kind: 'branch',
      params: { condition: { left: { $path: 'previous.result.total' }, op: 'gt', right: 100 } },
      routes: { ontrue: ['charge'], onfalse: ['skip'] }
    },
    { id: 'charge', kind: 'call-function', ref: 'chargeCard', params: chargeParams },
    { id: 'skip', kind: 'stop', params: { isError: false } }
  ];

  it('accepts a reference to a step that is upstream, even at a distance', () => {
    // `save` is two steps back with a branch in between — which is exactly when
    // `previous` is the wrong tool and this feature is the point.
    expect(validateWorkflowDefinition(def(chain({ id: { $path: 'upstream.save.result.orderId' } })))).toEqual([]);
  });

  it('rejects a reference to a step that does not exist, naming it', () => {
    const errors = validateWorkflowDefinition(def(chain({ id: { $path: 'upstream.svae.result.orderId' } })));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"svae"');
    expect(errors[0]).toContain('not a step in this workflow');
    expect(errors[0]).toContain('step "charge".params.id');
  });

  it('rejects a reference to a step that cannot have run yet', () => {
    // `skip` is on the other branch — never a predecessor of `charge`.
    const errors = validateWorkflowDefinition(def(chain({ id: { $path: 'upstream.skip.x' } })));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('not upstream of "charge"');
  });

  it('rejects `upstream` with no step id', () => {
    const errors = validateWorkflowDefinition(def(chain({ id: { $path: 'upstream' } })));
    expect(errors[0]).toContain('needs a step id');
  });

  it('allows any path INTO an upstream output — the engine cannot know its shape', () => {
    expect(
      validateWorkflowDefinition(def(chain({ id: { $path: 'upstream.save.whatever.the.function.returns.0' } })))
    ).toEqual([]);
  });

  it('checks paths inside conditions too — a typo is a typo wherever it is written', () => {
    const steps = chain({});
    steps[1] = {
      ...steps[1],
      params: { condition: { left: { $path: 'upstream.ghost.total' }, op: 'gt', right: 100 } }
    };
    const errors = validateWorkflowDefinition(def(steps));
    expect(errors.some((e) => e.includes('"ghost"'))).toBe(true);
  });

  it('rejects params nested past the resolution depth', () => {
    let deep: unknown = { $path: 'body.total' };
    for (let i = 0; i < MAX_VALUE_DEPTH + 2; i++) deep = { nested: deep };
    const errors = validateWorkflowDefinition(def(chain({ amount: deep })));
    expect(errors.some((e) => e.includes(`deeper than ${MAX_VALUE_DEPTH}`))).toBe(true);
  });

  it('lets a wait duration be a reference, which the executor already resolved', () => {
    // Write-time validation used to demand a literal number here, which made
    // WaitStepExecutor's own resolveValue unreachable from a saved definition.
    expect(
      validateWorkflowDefinition(
        def([{ id: 'hold', kind: 'wait', params: { duration: { $path: 'body.delayMs' } } }])
      )
    ).toEqual([]);
    // A literal is still range-checked.
    expect(
      validateWorkflowDefinition(def([{ id: 'hold', kind: 'wait', params: { duration: -1 } }]))
    ).toEqual(['step "hold".params.duration must be a number > 0']);
  });
});

// ---------------------------------------------------------------------------
// The one payload shape
// ---------------------------------------------------------------------------

describe('WFA-003 one run payload shape', () => {
  it('always delivers the caller data under `body`', () => {
    const p = buildRunPayload({ type: 'webhook', triggerId: 't1', slug: 'github', body: { total: 5 } });
    expect(p.body).toEqual({ total: 5 });
    expect(p.trigger).toEqual({ type: 'webhook', id: 't1', firedAt: expect.any(String), slug: 'github' });
    expect(p.triggerType).toBe('webhook');
  });

  it('delivers `body: {}` when there was no caller data', () => {
    // A schedule. This is what lets one definition read `body.x` whether it was
    // started by a cron or by a webhook — phase 19's exit criterion in one line.
    const p = buildRunPayload({ type: 'schedule', triggerId: 't2', cron: '0 * * * *' });
    expect(p.body).toEqual({});
    expect((p.trigger as { cron?: string }).cron).toBe('0 * * * *');
  });

  it('omits contextual keys rather than carrying them as undefined', () => {
    const trigger = buildRunPayload({ type: 'manual', body: {} }).trigger as Record<string, unknown>;
    expect(Object.keys(trigger).sort()).toEqual(['firedAt', 'type']);
  });

  it('keeps the deprecated top-level keys, and canonical wins a collision', () => {
    // The precedence is decided here rather than left to spread order: `body`
    // must be the caller's data even when the caller's data has a `body` key.
    const p = buildRunPayload({
      type: 'manual',
      triggerId: 't3',
      body: { body: 'inner', total: 7 },
      legacy: { triggerId: 't3', body: 'inner', total: 7 }
    });
    expect(p.total).toBe(7); // legacy view intact
    expect(p.triggerId).toBe('t3');
    expect(p.body).toEqual({ body: 'inner', total: 7 }); // canonical won
    expect((p.body as Record<string, unknown>).body).toBe('inner'); // still reachable
  });

  it('does not spread a non-object body into numeric keys', () => {
    // A webhook may post raw text. Spreading a string scatters its characters
    // across the payload, which is worse than omitting the legacy view.
    expect(spreadableBody('hello')).toEqual({});
    expect(spreadableBody([1, 2])).toEqual({});
    expect(spreadableBody({ a: 1 })).toEqual({ a: 1 });
    expect(buildRunPayload({ type: 'webhook', body: 'hello' }).body).toBe('hello');
  });

  it('carries db-change context on the trigger', () => {
    const p = buildRunPayload({
      type: 'db_change',
      triggerId: 't4',
      change: { action: 'create', collection: 'Orders', id: 'row1' },
      body: { objectId: 'row1', total: 10 }
    });
    expect(p.trigger).toEqual({
      type: 'db_change',
      id: 't4',
      firedAt: expect.any(String),
      collection: 'Orders',
      action: 'create',
      recordId: 'row1'
    });
    expect(p.body).toEqual({ objectId: 'row1', total: 10 });
  });
});

// ---------------------------------------------------------------------------
// The served spec (coverage extends the WF-002 gate to the value language)
// ---------------------------------------------------------------------------

describe('WFA-003 the served spec describes the value language', () => {
  const catalog = stepKindCatalog();

  it('serves the three value forms', () => {
    expect(catalog.valueLanguage.forms.map((f) => f.form)).toEqual(['literal', '$path', '$literal']);
    for (const f of catalog.valueLanguage.forms) expect(f.description.length).toBeGreaterThan(20);
  });

  it('names everything a $path may address, including upstream', () => {
    const names = catalog.valueLanguage.scope.map((s) => s.name);
    expect(names).toContain('body');
    expect(names).toContain('trigger');
    expect(names).toContain('previous');
    expect(names).toContain('upstream.<stepId>');
    for (const s of catalog.valueLanguage.scope) expect(s.description.length).toBeGreaterThan(20);
  });

  it('states the path rules a client would otherwise guess wrong', () => {
    const rules = catalog.valueLanguage.pathRules.join(' ');
    expect(rules).toMatch(/-1/); // negative index
    expect(rules).toMatch(/undefined/); // missing segment
    expect(catalog.valueLanguage.maxDepth).toBe(MAX_VALUE_DEPTH);
  });

  it('says which key could not be kept, so a migration is possible from the spec alone', () => {
    expect(catalog.valueLanguage.payload.deprecatedTopLevel).toMatch(/trigger/);
    expect(catalog.valueLanguage.payload.canonical.body).toMatch(/Always present/);
    expect(catalog.valueLanguage.payload.canonical.triggerType).toBeDefined();
  });

  it('refuses to promise expressions', () => {
    expect(catalog.valueLanguage.limits.join(' ')).toMatch(/No arithmetic/);
  });

  it('is pinned to a version, so a shape change has to be a decision', () => {
    // WF-002 shipped 1.0.0; WFA-003 added `valueLanguage` and `raw`; WFA-004
    // added `conditionLanguage`, because the workflow canvas renders a
    // condition from the served operator set rather than a bundled copy;
    // CWF-001 added `paramMapping`, so a client can render a row for the
    // author-named params the engine has merged in since WFA-003; CWF-005 added
    // `displayName` and `control`, because two of retry's knobs lied in the
    // field NAME and the name is the wire contract and cannot change; CWF-005
    // then folded `retry` into `call-function` and added `migratedKinds`, so a
    // client can tell "cannot run that" from "accepts and converts that";
    // CWF-004 added `transformLanguage`, the closed operation vocabulary a
    // `transform` step's `output` may use — served for the same reason the
    // operators are, so an editor cannot offer an operation this backend does
    // not perform and an agent cannot invent one.
    // CWF-004 slice 2 then added `validateLanguage`, the closed type vocabulary
    // a `validate` step's path rules may assert — the third served language, and
    // served for the third time for the same reason. Its four sibling kinds
    // (`filter`, `sort`, `deduplicate`, `split`) needed NO new language, which is
    // why four new kinds are not four bumps: a shape bump is for a shape change.
    // Bumping this line is the deliberate act the catalog's `version` is for.
    expect(catalog.version).toBe('1.7.0');
  });

  it('marks every DSL param raw, and nothing else', () => {
    const raw: string[] = [];
    for (const spec of Object.values(STEP_KIND_SPECS)) {
      for (const p of spec.params) if (p.raw) raw.push(`${spec.kind}.${p.name}`);
    }
    // CWF-004's `transform.output` is the fourth. `raw` there means what it has
    // always meant — the engine does NOT value-resolve it — and it is load-
    // bearing in a way CWF-001's proposed `raw` param would not have been: only
    // the transform executor holds the operation table, so only it can walk it.
    // CWF-004 slice 2 added the fifth and sixth: `validate.rules` (an array of
    // rules the executor evaluates lazily, exactly as `switch.cases` is) and
    // `filter.condition` (a condition, evaluated once per item against a scope
    // the engine cannot build).
    expect(raw.sort()).toEqual([
      'branch.condition',
      'filter.condition',
      'for-each.filter',
      'switch.cases',
      'transform.output',
      'validate.rules'
    ]);
    // Every raw param is one the value language calls a structure, which is what
    // the served note tells a property editor to render differently.
    expect(stepKindCatalog().valueLanguage.rawParamNote).toMatch(/raw: true/);
  });
});
