/**
 * CWF-001 — the param mapping is DECLARED, so a UI can author it.
 *
 * ⚠️ The finding that shaped this suite: the mapping already WORKED. The engine
 * has merged a step's params into its input by name since WFA-003, and
 * `workflow-data-mapping.test.ts` has proved it end-to-end since then. CWF-001's
 * doc said "you cannot pass data into a cloud function at all"; what was actually
 * missing was the *declaration* — the editor builds one property row per DECLARED
 * param and `call-function` declared only `ref`, so the mapping was reachable by
 * no route in the product.
 *
 * So this suite asserts the two things that ARE new:
 *   1. the catalog says `call-function` takes author-named params, in a form a
 *      client can render a row from, and
 *   2. a name whose value would be silently LOST is refused at write time —
 *      exactly one, `previous`, and not the longer list this task was drafted
 *      with (see the ALLOWS test for why that draft was wrong).
 *
 * The end-to-end "the function receives it" claim is deliberately NOT duplicated
 * here — `workflow-data-mapping.test.ts` already makes it against a real
 * BackendService and a real function graph, and a second copy would be a second
 * thing to keep true.
 */
import {
  RESERVED_STEP_INPUT_KEYS,
  STEP_KIND_SPECS,
  stepKindCatalog,
  validateStepShape
} from '../src/workflow/steps/kinds';
import type { WorkflowStep } from '../src/workflow/types';

function callFunction(params: Record<string, unknown>): WorkflowStep {
  return { id: 'charge', kind: 'call-function', ref: 'charge', params };
}

describe('CWF-001 — call-function declares its param mapping', () => {
  it('says so on the kind, with everything a row needs', () => {
    const mapping = STEP_KIND_SPECS['call-function'].paramMapping;
    expect(mapping).toBeDefined();
    expect(mapping!.displayName.length).toBeGreaterThan(0);
    // The tooltip has to teach the two rules an author cannot infer: where the
    // names land, and that a param cannot read a sibling param.
    expect(mapping!.description).toMatch(/top level/i);
    expect(mapping!.description).toMatch(/cannot reference another name/i);
    expect([...mapping!.reserved].sort()).toEqual([...RESERVED_STEP_INPUT_KEYS].sort());
    expect(mapping!.shadows).toContain('body');
  });

  it('is served, so an editor never holds its own copy of the reserved list', () => {
    // Same doctrine as the operator set: a bundled copy could warn about a name
    // this backend allows, or stay quiet about one it refuses.
    const wire = JSON.parse(JSON.stringify(stepKindCatalog())) as ReturnType<typeof stepKindCatalog>;
    const call = wire.kinds.find((k) => k.kind === 'call-function');
    expect(call?.paramMapping?.reserved).toContain('previous');
  });

  it('is the only kind that declares one, for now', () => {
    // `for-each` and `retry` also invoke a function, but their per-item input is
    // shaped by their own declared params. Widening the mapping to them is a
    // decision, not an oversight — fail here rather than let it happen quietly.
    const withMapping = Object.values(STEP_KIND_SPECS)
      .filter((s) => s.paramMapping)
      .map((s) => s.kind);
    expect(withMapping).toEqual(['call-function']);
  });
});

describe('CWF-001 — a mapping name whose value could not arrive is refused', () => {
  it('accepts author-named params, which is the whole feature', () => {
    expect(validateStepShape(callFunction({ amount: { $path: 'previous.result.total' }, currency: 'GBP' }))).toEqual([]);
  });

  it('refuses `previous`, because the engine writes it AFTER the params', () => {
    const errors = validateStepShape(callFunction({ previous: { $path: 'body.thing' } }));
    expect(errors).toHaveLength(1);
    // The message has to say the value is DISCARDED. "Reserved" alone would read
    // as a naming rule, and the author would rename it and move on without
    // learning that their value was never going to arrive.
    expect(errors[0]).toMatch(/discarded/i);
  });

  it('ALLOWS a run-payload root, because the author\'s value wins there', () => {
    // ⚠️ Drafted as a refusal, and that was wrong. Params merge AFTER the run
    // payload, so `{ body: … }` is an override rather than a loss — and
    // `workflow-data-mapping.test.ts` has passed `{ body: {"$path":"body"} }`
    // since WFA-003 to make a function's Request node declare it. The editor
    // says it replaces the payload key; the backend does not refuse it.
    for (const name of ['body', 'trigger', 'triggerType', 'headers', 'query']) {
      expect(validateStepShape(callFunction({ [name]: 1 }))).toEqual([]);
    }
  });

  it('leaves the kind\'s OWN declared params alone', () => {
    // `ref` is declared by the kind and is a step field. A mapping check that
    // treated every param key as the author's would flag it.
    expect(validateStepShape({ id: 's', kind: 'call-function', ref: 'f', params: { ref: 'f' } })).toEqual([]);
  });

  it('does not police a kind that declares no mapping', () => {
    // `wait` has no mapping, so its params are its own vocabulary and an odd key
    // there is not this check's business.
    const errors = validateStepShape({ id: 'w', kind: 'wait', params: { duration: 5, body: 'x' } });
    expect(errors).toEqual([]);
  });
});
