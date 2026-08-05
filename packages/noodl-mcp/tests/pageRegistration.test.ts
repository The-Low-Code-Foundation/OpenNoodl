/**
 * AAQ-005 — a page written through the external door is reachable.
 *
 * The property under test is the one Layer 1 established for the editor and
 * never gave this package: a page component is not a page until some Router
 * node lists it in `pages`, so a write that creates one must register it.
 *
 * Before this, `create_component` wrote the component, the shared gate approved
 * it, and no router listed it — Richard's finding #5 (*"page router has no
 * pages"*) reproduced exactly, through the door AAQ-005 exists to make
 * first-class. Slice 1 sharpened it rather than fixing it: `checkNavigation`
 * resolves a Navigate target against **component names**, which is sound in the
 * editor only because the editor's apply registers the page a moment later.
 *
 * ⚠️ The fixture is itself an instance of the defect: `demo-app`'s Router node
 * carries `{ name: "Main" }` and no `pages` key at all, so its own `/Pages/Home`
 * is unregistered. That is what makes it a fair test of the empty-router case,
 * and it is why these specs assert on the router's written value rather than on
 * a diff.
 */
import type { NodesV2File } from '../src/editor-deps';
import type { CreateComponentResponse, UpdateComponentResponse } from '../src/tools/responses';
import { call, connect, copyFixture, readJson, TestSession } from './helpers';

interface CreatePlanResponse {
  planId: string;
  operations: Array<{ id: string; kind: string; target: string }>;
}

interface ApplyPlanResponse {
  applied: Array<{ operation: string; target: string }>;
  registeredPages?: { router: string; added: string[]; startPage?: string; summary: string };
}

const PAGE_NODES = (id: string, title: string) => [
  { id: `${id}_page`, type: 'Page', parameters: { title, urlPath: title.toLowerCase() } },
  { id: `${id}_text`, type: 'Text', parent: `${id}_page`, parameters: { text: title } }
];

/** The `pages` value the App component's Router carries on disk. */
function routerPages(dir: string): { startPage?: string; routes: string[] } | undefined {
  const nodes = readJson<NodesV2File>(dir, 'components/App/nodes.json');
  const router = nodes.nodes.find((n) => n.type === 'Router');
  return router?.parameters?.['pages'] as { startPage?: string; routes: string[] } | undefined;
}

describe('AAQ-005 — page registration through the MCP door', () => {
  let dir: string;
  let session: TestSession;

  beforeEach(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });

  afterEach(async () => {
    await session.close();
  });

  it('lists a created page in the project router — the write that used to be unreachable', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Settings',
      nodes: PAGE_NODES('st', 'Settings')
    });

    expect(res.isError).toBe(false);
    expect(routerPages(dir)?.routes).toContain('/Pages/Settings');
  });

  it('reports what it registered, because it wrote a component the caller did not name', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Settings',
      nodes: PAGE_NODES('st', 'Settings')
    });

    expect(res.data.registeredPages?.router).toBe('/App');
    expect(res.data.registeredPages?.added).toEqual(['/Pages/Settings']);
    expect(res.data.registeredPages?.summary).toContain('Settings');
  });

  it('opens the app on the new page when the router had no start page', async () => {
    await call(session, 'create_component', { path: 'Pages/Settings', nodes: PAGE_NODES('st', 'Settings') });

    expect(routerPages(dir)?.startPage).toBe('/Pages/Settings');
  });

  it('leaves a non-page component alone — registration is not a side effect of every write', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Widgets/Badge',
      nodes: [{ id: 'b_group', type: 'Group', parameters: { text: 'Badge' } }]
    });

    expect(res.isError).toBe(false);
    expect(res.data.registeredPages).toBeUndefined();
    expect(routerPages(dir)?.routes ?? []).not.toContain('/Widgets/Badge');
  });

  it('does not list a page twice when it is updated after being created', async () => {
    await call(session, 'create_component', { path: 'Pages/Settings', nodes: PAGE_NODES('st', 'Settings') });
    const update = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Pages/Settings',
      set: { nodes: PAGE_NODES('st', 'Settings') }
    });

    expect(update.isError).toBe(false);
    const routes = routerPages(dir)?.routes ?? [];
    expect(routes.filter((r) => r === '/Pages/Settings')).toHaveLength(1);
    // Nothing changed, so nothing is claimed to have changed.
    expect(update.data.registeredPages).toBeUndefined();
  });

  it('registers a page that exists but was never listed — the state the task is about', async () => {
    // The fixture's own Home is exactly this: a page component no router lists.
    // `connections: []` because the replacement drops the fixture's button and
    // navigate nodes, and the gate correctly rejects the connection they left
    // behind — a true positive, and not what this spec is about.
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Pages/Home',
      set: { nodes: PAGE_NODES('hm', 'Home'), connections: [] }
    });

    expect(res.isError).toBe(false);
    expect(routerPages(dir)?.routes).toContain('/Pages/Home');
  });

  it('registers every page of an applied plan, in plan order, with the first as home', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'Add a catalogue and a basket',
      operations: [
        { kind: 'create', target: 'Pages/Catalogue', intent: 'The listing page' },
        { kind: 'create', target: 'Pages/Basket', intent: 'The basket page' }
      ]
    });
    for (const op of plan.data.operations) {
      const title = op.target.split('/').pop() as string;
      await call(session, 'stage_plan_operation', {
        plan_id: plan.data.planId,
        operation_id: op.id,
        nodes: PAGE_NODES(op.id.replace('-', '_'), title)
      });
    }

    const applied = await call<ApplyPlanResponse>(session, 'apply_plan', { plan_id: plan.data.planId });

    expect(applied.isError).toBe(false);
    expect(applied.data.registeredPages?.added).toEqual(['/Pages/Catalogue', '/Pages/Basket']);
    expect(routerPages(dir)?.startPage).toBe('/Pages/Catalogue');
    expect(routerPages(dir)?.routes).toEqual(['/Pages/Catalogue', '/Pages/Basket']);
  });

  it('registers nothing when the plan applied no pages', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'Add a badge widget',
      operations: [{ kind: 'create', target: 'Widgets/Badge', intent: 'A badge' }]
    });
    await call(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: plan.data.operations[0].id,
      nodes: [{ id: 'b_group', type: 'Group' }]
    });

    const applied = await call<ApplyPlanResponse>(session, 'apply_plan', { plan_id: plan.data.planId });

    expect(applied.isError).toBe(false);
    expect(applied.data.registeredPages).toBeUndefined();
  });
});
