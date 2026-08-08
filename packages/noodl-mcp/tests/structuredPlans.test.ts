/**
 * LAS-006 — structured plans: the tree as a form, not an essay.
 *
 * The measured failure this pins: haiku's very first `create_plan` was a correct
 * nine-operation decomposition, and every card it produced rendered the literal
 * word "Text". The plan could not be wrong, because a plan whose operations are
 * `{kind, target, intent}` cannot say anything an authoring turn is obliged to
 * honour. Its intents never mentioned interfaces, so no turn built
 * `Component Inputs`, so every instance parameter reached nothing.
 *
 * Three claims are pinned here, in the order the task builds them:
 *
 *  1. **The fields exist and survive the round trip.** An operation may declare
 *     `inputs`/`outputs`/`repeats`/`instantiates`, and a plan that declares none
 *     behaves exactly as it did before — the compatibility half of the task, and
 *     the one a schema change silently breaks.
 *  2. **The advisories fire on the shapes the corpus says are worth flagging**
 *     — and stay quiet on a page, which is the shape that must never be nagged
 *     (0 of 51 corpus pages declare an input).
 *  3. **The plan is a contract.** A component staged against an operation that
 *     promised inputs must expose them, and the refusal carries the diff.
 *     Extra inputs beyond the plan are fine — recorded as a decision, pinned as
 *     a spec, because "the plan is a floor" is invisible in the code otherwise.
 */
import * as fs from 'fs';

import { call, connect, copyFixture, TestSession } from './helpers';

interface PlanAdvisory {
  operation?: string;
  message: string;
}

interface CreatePlanResponse {
  planId: string;
  operations: Array<{
    id: string;
    kind: string;
    target: string;
    inputs?: Array<{ name: string; type?: string }>;
    repeats?: { source: string; rowFields: string[] };
    instantiates?: string[];
  }>;
  advisories?: PlanAdvisory[];
  advisoryNote?: string;
}

interface StageResponse {
  staged: string;
  warnings: number;
}

/**
 * A card component with a real interface: a `Component Inputs` node whose ports
 * are plugged "output" (the inversion LAS-001 documents — a component INPUT is a
 * port plugged "output"), feeding the Text that displays it.
 */
function cardWithInputs(names: string[]): Array<Record<string, unknown>> {
  return [
    {
      id: 'inputs',
      type: 'Component Inputs',
      ports: names.map((name) => ({ name, plug: 'output', type: 'string' }))
    },
    { id: 'root', type: 'Group' },
    { id: 'label', type: 'Text', parent: 'root', parameters: { text: 'Card' } }
  ];
}

describe('LAS-006 — plan operations carry structure', () => {
  let dir: string;
  let session: TestSession;

  beforeEach(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // ── 1. The fields, and the old shape still working ────────────────────────

  it('round-trips inputs, repeats and instantiates through create_plan', async () => {
    const res = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A storefront',
      operations: [
        {
          kind: 'create',
          target: 'Components/ProductCard',
          intent: 'One product, as a card.',
          inputs: [
            { name: 'name', type: 'string' },
            { name: 'price', type: 'string' },
            { name: 'image', type: 'an image URL' }
          ],
          outputs: [{ name: 'addToCart', type: 'signal' }]
        },
        {
          kind: 'create',
          target: 'Sections/FeaturedProducts',
          intent: 'The featured band.',
          repeats: { source: 'static', rowFields: ['name', 'price', 'image'] },
          instantiates: ['Components/ProductCard']
        }
      ]
    });

    expect(res.isError).toBe(false);
    const card = res.data.operations.find((op) => op.target === 'Components/ProductCard');
    expect(card?.inputs?.map((p) => p.name)).toEqual(['name', 'price', 'image']);
    const band = res.data.operations.find((op) => op.target === 'Sections/FeaturedProducts');
    expect(band?.repeats).toEqual({ source: 'static', rowFields: ['name', 'price', 'image'] });
    expect(band?.instantiates).toEqual(['Components/ProductCard']);
  });

  it('accepts an old-shape plan unchanged, and says nothing extra about a page', async () => {
    const res = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'Update the home page',
      operations: [
        { kind: 'create', target: 'Pages/Landing', intent: 'A landing page.' },
        { kind: 'create', target: 'Sections/Hero', intent: 'The hero band.', inputs: [{ name: 'headline' }] }
      ]
    });

    expect(res.isError).toBe(false);
    expect(res.data.operations).toHaveLength(2);
    // Neither operation draws the interface advisory: one is a page (which never
    // has inputs), the other declared them.
    expect(res.data.advisories ?? []).toEqual([]);
  });

  it('refuses an instantiates naming a component nothing provides', async () => {
    const res = await call<{ error: { details: { errors: string[] } } }>(session, 'create_plan', {
      request: 'A storefront',
      operations: [
        {
          kind: 'create',
          target: 'Sections/FeaturedProducts',
          intent: 'The featured band.',
          instantiates: ['Components/ProdcutCard']
        }
      ]
    });

    expect(res.isError).toBe(true);
    expect(res.data.error.details.errors.join('\n')).toContain('instantiates "Components/ProdcutCard"');
  });

  it('refuses structured fields on a doc operation', async () => {
    const res = await call<unknown>(session, 'create_plan', {
      request: 'Write it down',
      operations: [
        { kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'Record it.', inputs: [{ name: 'nope' }] }
      ]
    });

    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.data)).toContain('cannot declare inputs');
  });

  // ── 2. The advisories ─────────────────────────────────────────────────────

  it('advises when a non-page create declares no interface', async () => {
    const res = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A storefront',
      operations: [
        { kind: 'create', target: 'Components/ProductCard', intent: 'One product, as a card.' },
        { kind: 'create', target: 'Pages/Shop', intent: 'The shop page.' }
      ]
    });

    expect(res.isError).toBe(false);
    const messages = (res.data.advisories ?? []).map((a) => a.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Components/ProductCard');
    expect(messages[0]).toContain('an interface that will not line up');
    // The page is not nagged. 0 of 51 corpus pages declare an input.
    expect(messages[0]).not.toContain('Pages/Shop');
  });

  it('advises when the whole plan is a single page', async () => {
    const res = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'Build me a landing page',
      operations: [{ kind: 'create', target: 'Pages/Landing', intent: 'The whole thing.' }]
    });

    expect(res.isError).toBe(false);
    const messages = (res.data.advisories ?? []).map((a) => a.message);
    expect(messages.some((m) => m.includes('plan its sections as their own create operations'))).toBe(true);
  });

  it('states the row-field contract where repeats is declared', async () => {
    const res = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A storefront',
      operations: [
        { kind: 'create', target: 'Components/Row', intent: 'One row.', inputs: [{ name: 'label' }] },
        {
          kind: 'create',
          target: 'Sections/List',
          intent: 'The list.',
          repeats: { source: 'static', rowFields: ['label', 'value'] },
          instantiates: ['Components/Row']
        }
      ]
    });

    expect(res.isError).toBe(false);
    const messages = (res.data.advisories ?? []).map((a) => a.message);
    expect(messages.some((m) => m.includes('"label", "value"') && m.includes('Component Inputs'))).toBe(true);
  });

  // ── 3. The plan as a contract (needs LAS-001's interface index) ────────────

  it('rejects a staged component that did not expose the inputs it planned', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A storefront',
      operations: [
        {
          kind: 'create',
          target: 'Components/ProductCard',
          intent: 'One product, as a card.',
          inputs: [{ name: 'name' }, { name: 'price' }, { name: 'image' }]
        }
      ]
    });
    expect(plan.isError).toBe(false);

    const res = await call<{ error: { details: { readable: string[] } } }>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: plan.data.operations[0].id,
      // Exposes two of the three. `image` is the one the instances will set and
      // nothing will receive — F2's mechanism, caught at the plan's own promise.
      nodes: cardWithInputs(['name', 'price']),
      visual_roots: ['root']
    });

    expect(res.isError).toBe(true);
    const readable = res.data.error.details.readable.join('\n');
    // The diff, both halves: what was promised and what actually arrived.
    expect(readable).toContain('Missing: "image"');
    expect(readable).toContain('it exposes "name", "price"');
    expect(readable).toContain('plug "output"');
  });

  it('accepts a staged component that exposes MORE than it planned — the plan is a floor', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A storefront',
      operations: [
        {
          kind: 'create',
          target: 'Components/ProductCard',
          intent: 'One product, as a card.',
          inputs: [{ name: 'name' }]
        }
      ]
    });
    expect(plan.isError).toBe(false);

    const res = await call<StageResponse>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: plan.data.operations[0].id,
      nodes: cardWithInputs(['name', 'variant']),
      visual_roots: ['root']
    });

    expect(res.isError).toBe(false);
    expect(res.data.staged).toBe(plan.data.operations[0].id);
  });

  // ── 4. The order, pushed where a page is most often built without one ─────

  it('points create_component of a page at the plan door, once, when no plan exists', async () => {
    const res = await call<{ planAdvisory?: string }>(session, 'create_component', {
      path: 'Pages/Solo',
      nodes: [
        { id: 'page', type: 'Page', parameters: { title: 'Solo' } },
        { id: 'body', type: 'Text', parent: 'page', parameters: { text: 'Hello' } }
      ],
      visual_roots: ['page']
    });

    expect(res.isError).toBe(false);
    expect(res.data.planAdvisory).toContain('create_plan');
    expect(res.data.planAdvisory).toContain('`inputs`');
  });

  it('says nothing to a non-page component, or to anyone who did open a plan', async () => {
    const visual = await call<{ planAdvisory?: string }>(session, 'create_component', {
      path: 'Components/Chip',
      nodes: [{ id: 'root', type: 'Group' }],
      visual_roots: ['root']
    });
    expect(visual.isError).toBe(false);
    expect(visual.data.planAdvisory).toBeUndefined();

    // A plan in flight means the agent has already met the plan door.
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A shop',
      operations: [{ kind: 'create', target: 'Pages/Shop', intent: 'The shop page.' }]
    });
    expect(plan.isError).toBe(false);

    const page = await call<{ planAdvisory?: string }>(session, 'create_component', {
      path: 'Pages/Aside',
      nodes: [
        { id: 'page', type: 'Page', parameters: { title: 'Aside' } },
        { id: 'body', type: 'Text', parent: 'page', parameters: { text: 'Hello' } }
      ],
      visual_roots: ['page']
    });
    expect(page.isError).toBe(false);
    expect(page.data.planAdvisory).toBeUndefined();
  });

  it('leaves a plan that declared nothing exactly as staging always behaved', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A storefront',
      operations: [{ kind: 'create', target: 'Components/ProductCard', intent: 'One product, as a card.' }]
    });
    expect(plan.isError).toBe(false);

    const res = await call<StageResponse>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: plan.data.operations[0].id,
      // No Component Inputs at all. Legal: nothing promised any.
      nodes: [
        { id: 'root', type: 'Group' },
        { id: 'label', type: 'Text', parent: 'root', parameters: { text: 'Card' } }
      ],
      visual_roots: ['root']
    });

    expect(res.isError).toBe(false);
  });
});
