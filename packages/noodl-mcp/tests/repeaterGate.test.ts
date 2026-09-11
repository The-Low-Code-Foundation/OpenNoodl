/**
 * LAS-012 — the repeater contract, through the real doors.
 *
 * The unit specs (`noodl-editor/tests-unit/phase-55/repeaterTemplate.test.ts`)
 * pin the check; these pin that it *reaches* the doors. That distinction is not
 * theoretical here — F14 is the standing finding that `validate:project` runs
 * `rules/` only and no precondition check has ever reached it, so a check can
 * be correct, tested, and never asked. Every door below is one an agent
 * actually walked through in session 6.
 *
 * What it is defending: haiku's replay wrote three `For Each` nodes with a
 * correct inline `items` array, no `template`, and the item content nested
 * underneath as a child. `create_component` accepted all three,
 * `validate:project` reported `0 error(s)`, `render_report` reported `0 errors`,
 * and the page drew a header, a hero, an info strip and then nothing.
 *
 * Qwen hit the same joint from the other side — it nested a child whose id did
 * not exist — and got `Node "products-repeater" lists unknown child
 * "product-card"`, a shape error thrown as `invalid-argument` on a path that
 * carries no recipe. The last spec pins the sentence that door now says.
 */
import * as fs from 'fs';

import { call, connect, copyFixture, TestSession } from './helpers';
import type { CreateComponentResponse } from '../src/tools/responses';

/** A minimal item component with a real interface, so only the repeater is wrong. */
const PRODUCT_CARD_NODES = [
  {
    id: 'card_inputs',
    type: 'Component Inputs',
    ports: [
      { name: 'name', plug: 'output', type: 'string' },
      { name: 'price', plug: 'output', type: 'string' }
    ]
  },
  { id: 'card', type: 'Group', parameters: { flexDirection: 'column' } },
  { id: 'product-name', type: 'Text', parent: 'card' }
];

const ITEMS = [
  { name: 'Handmade Ceramic Bowl', price: '£35.00' },
  { name: 'Specialty Coffee Blend', price: '£18.00' }
];

/** haiku's shape: items, no template, the card nested underneath. */
const HAIKU_SECTION_NODES = [
  { id: 'section', type: 'Group', parameters: { flexDirection: 'column' } },
  { id: 'repeater', type: 'For Each', parent: 'section', parameters: { items: ITEMS } },
  { id: 'card', type: '/Components/ProductCard', parent: 'repeater', parameters: { name: '', price: '' } }
];

/** The same section done right: the card named on `template`, nothing nested. */
const CORRECT_SECTION_NODES = [
  { id: 'section', type: 'Group', parameters: { flexDirection: 'column' } },
  {
    id: 'repeater',
    type: 'For Each',
    parent: 'section',
    parameters: { items: ITEMS, template: '/Components/ProductCard' }
  }
];

function body(res: { data?: unknown; text?: unknown }): string {
  return JSON.stringify(res.data ?? res.text);
}

describe('LAS-012 — the repeater template contract at the write gate', () => {
  let dir: string;
  let session: TestSession;

  beforeEach(async () => {
    dir = copyFixture();
    session = await connect(dir);
    const card = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/ProductCard',
      nodes: PRODUCT_CARD_NODES,
      visual_roots: ['card']
    });
    expect(card.isError).toBe(false);
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("rejects haiku's section — the one create_component used to accept", async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/FeaturedProducts',
      nodes: HAIKU_SECTION_NODES,
      visual_roots: ['section']
    });

    expect(res.isError).toBe(true);
    const text = body(res);
    expect(text).toContain('repeater-with-visual-children');
    // The instruction, not the complaint: the child it should promote.
    expect(text).toContain('/Components/ProductCard');
    expect(text).toContain('is not a container');
  });

  it('rejects a repeater with items and no template at all', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/BareList',
      nodes: [
        { id: 'section', type: 'Group' },
        { id: 'repeater', type: 'For Each', parent: 'section', parameters: { items: ITEMS } }
      ],
      visual_roots: ['section']
    });

    expect(res.isError).toBe(true);
    const text = body(res);
    expect(text).toContain('repeater-without-template');
    expect(text).toContain('items alone are not enough');
  });

  it('accepts the shape sonnet wrote', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/FeaturedProducts',
      nodes: CORRECT_SECTION_NODES,
      visual_roots: ['section']
    });
    expect(res.isError).toBe(false);
  });

  it('rejects a template naming a component that does not exist, and names the ones that do', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/StaleList',
      nodes: [
        { id: 'section', type: 'Group' },
        {
          id: 'repeater',
          type: 'For Each',
          parent: 'section',
          parameters: { items: ITEMS, template: '/Components/ProductCards' }
        }
      ],
      visual_roots: ['section']
    });

    expect(res.isError).toBe(true);
    const text = body(res);
    expect(text).toContain('repeater-template-unresolved');
    expect(text).toContain('/Components/ProductCard');
  });

  it('attaches the recipe that shows the shape, per LAS-007', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/BareList',
      nodes: [
        { id: 'section', type: 'Group' },
        { id: 'repeater', type: 'For Each', parent: 'section', parameters: { items: ITEMS } }
      ],
      visual_roots: ['section']
    });

    expect(res.isError).toBe(true);
    expect(body(res)).toContain('data-static-array-filter-repeater');
  });

  it("tells qwen's door what a template is, instead of only that the child is unknown", async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/DanglingList',
      nodes: [
        { id: 'section', type: 'Group' },
        // The child id names a *component*, which is not a node in this payload
        // — the exact rejection qwen received, twice, before giving up.
        { id: 'products-repeater', type: 'For Each', parent: 'section', children: ['product-card'] }
      ],
      visual_roots: ['section']
    });

    expect(res.isError).toBe(true);
    const text = body(res);
    expect(text).toContain('lists unknown child');
    expect(text).toContain('A For Each is not a container');
    expect(text).toContain('template');
  });
});
