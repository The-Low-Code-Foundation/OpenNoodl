/**
 * LAS-006 — the shared plan model's structured half.
 *
 * `plan.ts` is the one plan model: the editor's `PlanningSession`/`PlanRun` and
 * `noodl-mcp`'s plan tools both import it, so these specs are the substrate's
 * own, and the MCP suite's `structuredPlans.test.ts` pins the same behaviour
 * arriving through a tool call. Two clients, one set of rules, tested at both
 * ends because that is the only way "one substrate" stays a fact.
 *
 * The advisory predicate is the part worth reading twice. The task file proposed
 * keying it on a path prefix (`Components/`, `Cards/`, `Sections/`); the corpus
 * scan (`measurements/scan-component-paths.js`) put **16 of 256**
 * interface-bearing components inside those folders and the other 240 outside.
 * What separates cleanly is shape, not location: 0 of 51 pages declare an input,
 * and 178 of 236 instantiated non-pages do. So the specs below assert on
 * page-ness, and one of them exists purely to pin that a page is never nagged.
 */
import {
  planAdvisories,
  planInterfaceContract,
  renderPlanContext,
  validatePlan,
  type AuthoringPlan,
  type PlanOperation
} from '../../src/editor/src/models/AiAssistant/authoring/plan';

function plan(operations: Array<Partial<PlanOperation> & Pick<PlanOperation, 'kind' | 'target'>>): AuthoringPlan {
  return {
    request: 'build a storefront',
    operations: operations.map((op, index) => ({
      id: op.id ?? `op-${index + 1}`,
      intent: op.intent ?? 'Do the thing.',
      ...op
    })) as PlanOperation[]
  };
}

const NO_COMPONENTS = { existingComponents: new Set<string>() };

describe('LAS-006 — validatePlan and the structured fields', () => {
  it('accepts a plan that declares nothing, exactly as before', () => {
    const errors = validatePlan(plan([{ kind: 'create', target: 'Components/Card' }]), NO_COMPONENTS);
    expect(errors).toEqual([]);
  });

  it('accepts declared inputs, outputs, repeats and a resolvable instantiates', () => {
    const errors = validatePlan(
      plan([
        { kind: 'create', target: 'Components/Card', inputs: [{ name: 'name' }, { name: 'price', type: 'string' }] },
        {
          kind: 'create',
          target: 'Sections/Featured',
          repeats: { source: 'static', rowFields: ['name', 'price'] },
          instantiates: ['Components/Card']
        }
      ]),
      NO_COMPONENTS
    );
    expect(errors).toEqual([]);
  });

  it('resolves instantiates against components the project already has', () => {
    const errors = validatePlan(
      plan([{ kind: 'create', target: 'Sections/Featured', instantiates: ['Components/Card'] }]),
      { existingComponents: new Set(['/Components/Card']) }
    );
    expect(errors).toEqual([]);
  });

  it('refuses an instantiates that names nothing the plan or project provides', () => {
    const errors = validatePlan(
      plan([{ kind: 'create', target: 'Sections/Featured', instantiates: ['Components/Card'] }]),
      NO_COMPONENTS
    );
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('instantiates "Components/Card"');
  });

  it('refuses an unnamed port, a duplicated port and an empty repeats', () => {
    const errors = validatePlan(
      plan([
        { kind: 'create', target: 'Components/A', inputs: [{ name: '  ' }] },
        { kind: 'create', target: 'Components/B', inputs: [{ name: 'x' }, { name: 'x' }] },
        { kind: 'create', target: 'Components/C', repeats: { source: 'static', rowFields: [] } }
      ]),
      NO_COMPONENTS
    );
    expect(errors.some((e) => e.includes('unnamed input'))).toBe(true);
    expect(errors.some((e) => e.includes('declares "x" twice in inputs'))).toBe(true);
    expect(errors.some((e) => e.includes('names no rowFields'))).toBe(true);
  });

  it('refuses structured fields on a doc operation', () => {
    const errors = validatePlan(
      plan([{ kind: 'doc', target: 'docs/ARCHITECTURE.md', outputs: [{ name: 'nope' }] }]),
      NO_COMPONENTS
    );
    expect(errors.some((e) => e.includes('cannot declare inputs, outputs, repeats or instantiates'))).toBe(true);
  });
});

describe('LAS-006 — planAdvisories keys on shape, not on path', () => {
  it('advises a non-page create that declares no interface', () => {
    const advisories = planAdvisories(
      plan([
        { kind: 'create', target: 'Components/Card' },
        { kind: 'create', target: 'Pages/Shop' }
      ])
    );
    expect(advisories.length).toBe(1);
    expect(advisories[0].operation).toBe('op-1');
    expect(advisories[0].message).toContain('an interface that will not line up');
  });

  it('says nothing about a page — 0 of 51 corpus pages declare an input', () => {
    const advisories = planAdvisories(
      plan([
        { kind: 'create', target: 'Pages/Shop' },
        { kind: 'create', target: 'Pages/Cart' }
      ])
    );
    expect(advisories).toEqual([]);
  });

  it('fires outside the folders the task file guessed — the corpus\'s real shape', () => {
    // 240 of 256 interface-bearing corpus components live in folders like these.
    for (const target of ['UI Components/Card', 'Product Details Page/Gallery', 'Bare']) {
      const advisories = planAdvisories(plan([{ kind: 'create', target }]));
      expect(advisories.some((a) => a.message.includes(target))).toBe(true);
    }
  });

  it('stays quiet once an interface is declared, by any of the three fields', () => {
    expect(planAdvisories(plan([{ kind: 'create', target: 'C/A', inputs: [{ name: 'x' }] }]))).toEqual([]);
    expect(planAdvisories(plan([{ kind: 'create', target: 'C/A', outputs: [{ name: 'x' }] }]))).toEqual([]);
    const repeating = planAdvisories(
      plan([{ kind: 'create', target: 'C/A', repeats: { source: 'query', rowFields: ['name'] } }])
    );
    // `repeats` answers the interface question, and adds the row-field contract.
    expect(repeating.length).toBe(1);
    expect(repeating[0].message).toContain('Those field names are the contract');
  });

  it('does not advise on updates — an existing component already has its interface', () => {
    expect(planAdvisories(plan([{ kind: 'update', target: 'Components/Card' }]))).toEqual([]);
  });

  it('calls out a plan that is one page and nothing else', () => {
    const advisories = planAdvisories(plan([{ kind: 'create', target: 'Pages/Landing' }]));
    expect(advisories.length).toBe(1);
    expect(advisories[0].message).toContain('plan its sections as their own create operations');
  });
});

describe('LAS-006 §3 — the plan as a contract', () => {
  const op = { id: 'op-1', target: 'Components/Card', inputs: [{ name: 'name' }, { name: 'price' }] };

  it('holds when the component exposes exactly what was planned', () => {
    expect(planInterfaceContract(op, ['name', 'price'])).toEqual([]);
  });

  it('holds when the component exposes more — the plan is a floor, not a ceiling', () => {
    expect(planInterfaceContract(op, ['name', 'price', 'variant'])).toEqual([]);
  });

  it('refuses a missing input, and names both halves of the diff', () => {
    const [line] = planInterfaceContract(op, ['name']);
    expect(line).toContain('Missing: "price"');
    expect(line).toContain('it exposes "name"');
  });

  it('says "none at all" when the component exposed no interface whatsoever', () => {
    expect(planInterfaceContract(op, [])[0]).toContain('it exposes none at all');
  });

  it('checks nothing when the operation promised nothing', () => {
    expect(planInterfaceContract({ id: 'op-1', target: 'Components/Card' }, [])).toEqual([]);
  });
});

describe('LAS-006 — the sibling context carries the declared interface', () => {
  it('puts inputs, repeats and places under the intent, for the operation that will place it', () => {
    const rendered = renderPlanContext(
      plan([
        { kind: 'create', target: 'Components/Card', inputs: [{ name: 'name', type: 'string' }] },
        {
          kind: 'create',
          target: 'Sections/Featured',
          repeats: { source: 'static', rowFields: ['name'] },
          instantiates: ['Components/Card']
        }
      ]),
      'op-2'
    );
    expect(rendered).toContain('inputs:  name: string');
    expect(rendered).toContain('repeats: one row per static item — fields name');
    expect(rendered).toContain('places:  Components/Card');
    expect(rendered).toContain('those names are binding in both directions');
  });

  it('adds nothing to a plan that declared nothing', () => {
    const rendered = renderPlanContext(plan([{ kind: 'create', target: 'Pages/Shop' }]), 'op-1');
    expect(rendered).not.toContain('inputs:');
    expect(rendered).not.toContain('binding in both directions');
  });
});
