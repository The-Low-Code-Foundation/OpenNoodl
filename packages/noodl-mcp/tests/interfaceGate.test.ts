/**
 * LAS-001 — the interface gate, through the real doors.
 *
 * The audit's finding F2, restated as the thing this suite proves: haiku's cold
 * replay produced the architecturally ideal storefront — one `ProductCard`,
 * instantiated four times with per-instance `image`/`name`/`price` — and every
 * card rendered as the literal word "Text", because `ProductCard` declared no
 * `Component Inputs`. It had put those six ports on the card's root `Group`,
 * where they are ordinary instance ports and never become an interface.
 * `validate:project` reported **0 errors**, `create_component` accepted it, and
 * `apply_plan` wrote it.
 *
 * The candidates below are haiku's, trimmed to the nodes that carry the defect.
 * The unit specs (`noodl-editor/tests-unit/phase-55/instanceInterface.test.ts`)
 * pin the check; these pin that it reaches every door, that the plan overlay
 * sees a sibling staged in the same plan, and that an existing violation does
 * not lock a component out of being edited.
 */
import * as fs from 'fs';

import { call, connect, copyFixture, TestSession } from './helpers';
import type { CreateComponentResponse } from '../src/tools/responses';

interface CreatePlanResponse {
  planId: string;
  operations: Array<{ id: string; kind: string; target: string }>;
}

interface StageResponse {
  staged: string;
  warnings: number;
  validation?: {
    summary: { errors: number; warnings: number; infos: number };
    diagnostics?: Array<{ code: string; severity: string; message: string }>;
  };
}

/** haiku's ProductCard: the six interface ports declared on the card `Group`. */
const HAIKU_CARD_NODES = [
  {
    id: 'card',
    type: 'Group',
    parameters: { flexDirection: 'column', backgroundColor: 'var(--surface)' },
    ports: [
      { name: 'image', plug: 'input', type: 'string' },
      { name: 'name', plug: 'input', type: 'string' },
      { name: 'price', plug: 'input', type: 'string' }
    ]
  },
  { id: 'product-name', type: 'Text', parent: 'card', parameters: { text: 'Text' } }
];

/** The same card done right: a Component Inputs node, ports plugged "output". */
const CORRECT_CARD_NODES = [
  {
    id: 'card_inputs',
    type: 'Component Inputs',
    ports: [
      { name: 'image', plug: 'output', type: 'string' },
      { name: 'name', plug: 'output', type: 'string' },
      { name: 'price', plug: 'output', type: 'string' }
    ]
  },
  { id: 'card', type: 'Group', parameters: { flexDirection: 'column' } },
  { id: 'product-name', type: 'Text', parent: 'card' }
];

/** haiku's FeaturedProducts: four instances, each given the six parameters. */
function featuredProductsNodes(cardRef: string): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [{ id: 'section', type: 'Group', parameters: { flexDirection: 'column' } }];
  for (let i = 1; i <= 4; i++) {
    nodes.push({
      id: `product-${i}`,
      type: cardRef,
      parent: 'section',
      parameters: { image: `https://example.com/${i}.jpg`, name: `Product ${i}`, price: `$${i}9` }
    });
  }
  return nodes;
}

describe('LAS-001 — instance parameters against the component interface', () => {
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

  it("rejects haiku's FeaturedProducts against a ProductCard with no Component Inputs", async () => {
    const card = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/ProductCard',
      nodes: HAIKU_CARD_NODES,
      visual_roots: ['card']
    });
    expect(card.isError).toBe(false);

    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/FeaturedProducts',
      nodes: featuredProductsNodes('/Components/ProductCard'),
      visual_roots: ['section']
    });

    // Blocking: this is the whole point. It used to be accepted with 0 errors.
    expect(res.isError).toBe(true);
    const text = JSON.stringify(res.data ?? res.text);
    expect(text).toContain('interfaceless-instance');
    expect(text).toContain('/Components/ProductCard');
    expect(text).toContain('4 instances');
    // The parameters it tried to set ARE the interface it should have declared.
    for (const parameter of ['image', 'name', 'price']) expect(text).toContain(parameter);
    // And the hint that turns "add an interface" into "move what you wrote".
    expect(text).toContain('Group');
  });

  it('accepts the same section once the card has a real interface', async () => {
    const card = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/ProductCard',
      nodes: CORRECT_CARD_NODES,
      visual_roots: ['card']
    });
    expect(card.isError).toBe(false);

    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/FeaturedProducts',
      nodes: featuredProductsNodes('/Components/ProductCard'),
      visual_roots: ['section']
    });
    expect(res.isError).toBe(false);
  });

  it('names the actual input list when a parameter is one name off', async () => {
    await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/ProductCard',
      nodes: CORRECT_CARD_NODES,
      visual_roots: ['card']
    });

    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/OneOff',
      nodes: [
        { id: 'section', type: 'Group' },
        {
          id: 'card',
          type: '/Components/ProductCard',
          parent: 'section',
          // `width` is sonnet's real mistake: a component instance has no layout
          // ports of its own, so it is discarded exactly like a misspelling.
          parameters: { imag: 'a.jpg', width: { value: 31, unit: '%' } }
        }
      ],
      visual_roots: ['section']
    });

    expect(res.isError).toBe(true);
    const text = JSON.stringify(res.data ?? res.text);
    expect(text).toContain('instance-unknown-parameter');
    expect(text).toContain('"image"');
    expect(text).toContain('width');
  });

  it('rejects a Component Inputs port plugged the wrong way', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/Backwards',
      nodes: [
        { id: 'ins', type: 'Component Inputs', ports: [{ name: 'title', plug: 'input', type: 'string' }] },
        { id: 'root', type: 'Group' }
      ],
      visual_roots: ['root']
    });

    expect(res.isError).toBe(true);
    const text = JSON.stringify(res.data ?? res.text);
    expect(text).toContain('component-port-direction');
    expect(text).toContain('backwards');
  });

  it('sees a sibling staged in the same plan, not just what is on disk', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A featured products section built from a card',
      operations: [
        { kind: 'create', target: 'Components/ProductCard', intent: 'The card.' },
        { kind: 'create', target: 'Components/FeaturedProducts', intent: 'Four of them.' }
      ]
    });
    expect(plan.isError).toBe(false);
    const [cardOp, sectionOp] = plan.data.operations;

    const staged = await call<StageResponse>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: cardOp.id,
      nodes: CORRECT_CARD_NODES,
      visual_roots: ['card']
    });
    expect(staged.isError).toBe(false);

    // Nothing is on disk yet. A gate reading interfaces from disk would reject
    // every correct multi-component plan.
    const res = await call<StageResponse>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: sectionOp.id,
      nodes: featuredProductsNodes('/Components/ProductCard'),
      visual_roots: ['section']
    });
    expect(res.isError).toBe(false);
    const codes = (res.data.validation?.diagnostics ?? []).map((d) => d.code);
    expect(codes).not.toContain('interfaceless-instance');
  });

  it('blocks the staged section when the staged card has no interface', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A featured products section built from a card',
      operations: [
        { kind: 'create', target: 'Components/ProductCard', intent: 'The card.' },
        { kind: 'create', target: 'Components/FeaturedProducts', intent: 'Four of them.' }
      ]
    });
    const [cardOp, sectionOp] = plan.data.operations;

    await call<StageResponse>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: cardOp.id,
      nodes: HAIKU_CARD_NODES,
      visual_roots: ['card']
    });

    const res = await call<StageResponse>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: sectionOp.id,
      nodes: featuredProductsNodes('/Components/ProductCard'),
      visual_roots: ['section']
    });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.data ?? res.text)).toContain('interfaceless-instance');
  });

  it('leaves a component that already violates the gate editable', async () => {
    // The update-baseline contract: `validateStaged` and `validateCandidate`
    // subtract blocking diagnostics the component already carried, so a new gate
    // cannot make an existing component permanently unrevisable. Without it, the
    // only repair available for an unrelated edit is to delete the instances.
    const cardDir = `${dir}/components/Components/ProductCard`;
    const created = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/ProductCard',
      nodes: CORRECT_CARD_NODES,
      visual_roots: ['card']
    });
    expect(created.isError).toBe(false);

    const section = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/FeaturedProducts',
      nodes: featuredProductsNodes('/Components/ProductCard'),
      visual_roots: ['section']
    });
    expect(section.isError).toBe(false);

    // Now break the card behind the section's back — the shape a rename produces.
    const nodesFile = JSON.parse(fs.readFileSync(`${cardDir}/nodes.json`, 'utf8'));
    nodesFile.nodes = nodesFile.nodes.filter((n: { type: string }) => n.type !== 'Component Inputs');
    fs.writeFileSync(`${cardDir}/nodes.json`, JSON.stringify(nodesFile, null, 2));

    // An unrelated edit to the section must still be accepted.
    const res = await call<CreateComponentResponse>(session, 'update_component', {
      path: 'Components/FeaturedProducts',
      set: {
        nodes: [...featuredProductsNodes('/Components/ProductCard'), { id: 'note', type: 'Text', parent: 'section' }],
        visual_roots: ['section']
      }
    });
    expect(res.isError).toBe(false);
    // Reported, not blocking.
    const codes = (res.data.validation.diagnostics ?? []).map((d) => d.code);
    expect(codes).toContain('interfaceless-instance');
  });
});
