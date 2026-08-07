/**
 * AAQ-011/F12 — node ids written through this server cannot collide with ids the
 * project already uses.
 *
 * These drive the **tool path**, not the allocator, and they are the red-then-green
 * record of the finding. Before `project/nodeIds.ts`, the first spec here failed
 * exactly as F12 describes: `create_component` returned
 * `validation.summary.errors: 0` and the immediately following
 * `validate_project --strict` returned 3, all `duplicate-node-id`, because the
 * fixture's own `/Pages/Home` already carries `page`, `layout` and `title`.
 *
 * The gate itself is untouched — it is still component-scoped, and a *different*
 * project-wide rule would still fire only after a write. That class is left open
 * deliberately (Richard's call); what is closed is that this rule has nothing to
 * report on anything this server writes.
 */

import * as fs from 'fs';

import type { ConnectionsV2File, NodesV2File } from '../src/editor-deps';
import type { CreateComponentResponse, UpdateComponentResponse, ValidateProjectResponse } from '../src/tools/responses';
import { call, connect, copyFixture, readJson } from './helpers';
import type { TestSession } from './helpers';

/** The three ids `/Pages/Home` already uses in the fixture. */
const COLLIDING = ['page', 'layout', 'title'];

interface PlanResponse {
  planId: string;
  operations: Array<{ id: string; target: string }>;
}

interface StagePlanResponse {
  staged: string;
  remappedNodeIds?: Array<{ from: string; to: string }>;
  remapNote?: string;
}

describe('node id allocation (AAQ-011/F12)', () => {
  let session: TestSession;
  let dir: string;

  beforeEach(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function duplicateIdErrors(): Promise<string[]> {
    const res = await call<ValidateProjectResponse>(session, 'validate_project', { strict: true });
    return res.data.diagnostics.filter((d) => d.code === 'duplicate-node-id').map((d) => d.message);
  }

  it('the fixture starts clean, so anything below is what this write did', async () => {
    expect(await duplicateIdErrors()).toEqual([]);
  });

  it('create_component reallocates ids the project already uses, and rewires the graph', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Dash',
      nodes: [
        { id: 'page', type: 'Page', label: 'Dash', parameters: { title: 'Dash', urlPath: 'dash' }, children: ['layout'] },
        { id: 'layout', type: 'Group', label: 'Layout', parent: 'page', children: ['title', 'sub'] },
        { id: 'title', type: 'Text', label: 'Title', parent: 'layout', parameters: { text: 'Dash' } },
        { id: 'sub', type: 'Text', label: 'Sub', parent: 'layout', parameters: { text: 'Numbers' } }
      ],
      connections: [{ fromId: 'title', fromProperty: 'text', toId: 'sub', toProperty: 'text' }],
      visual_roots: ['page']
    });
    expect(res.isError).toBe(false);

    // The write reports what it moved — three colliding ids, `sub` untouched.
    const moved = res.data.remappedNodeIds ?? [];
    expect(moved.map((r) => r.from).sort()).toEqual([...COLLIDING].sort());
    expect(res.data.remapNote).toContain('reallocated');

    // The rule now has nothing to report. This is the assertion F12 is about.
    expect(await duplicateIdErrors()).toEqual([]);

    // And the graph on disk is coherent: every reference followed its node.
    const nodes = readJson<NodesV2File>(dir, 'components/Pages/Dash/nodes.json');
    const connections = readJson<ConnectionsV2File>(dir, 'components/Pages/Dash/connections.json');
    const ids = nodes.nodes.map((n) => n.id);
    for (const old of COLLIDING) expect(ids).not.toContain(old);
    expect(ids).toContain('sub');

    const byLabel = (label: string) => nodes.nodes.find((n) => n.label === label)!;
    const page = byLabel('Dash');
    const layout = byLabel('Layout');
    const title = byLabel('Title');
    expect(page.children).toEqual([layout.id]);
    expect(layout.parent).toBe(page.id);
    expect(layout.children).toEqual([title.id, 'sub']);
    expect(title.parent).toBe(layout.id);
    expect(nodes.visualRoots).toEqual([page.id]);
    expect(connections.connections).toEqual([
      { fromId: title.id, fromProperty: 'text', toId: 'sub', toProperty: 'text' }
    ]);

    // The reallocated ids still read like what the caller asked for.
    expect(page.id).toBe('page-2');
  });

  it('leaves non-colliding ids exactly as the caller wrote them, and says nothing', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Quiet',
      nodes: [
        { id: 'quiet-page', type: 'Page', label: 'Quiet', parameters: { title: 'Quiet', urlPath: 'quiet' } }
      ],
      visual_roots: ['quiet-page']
    });
    expect(res.isError).toBe(false);
    expect(res.data.remappedNodeIds).toBeUndefined();
    expect(res.data.remapNote).toBeUndefined();
    const nodes = readJson<NodesV2File>(dir, 'components/Pages/Quiet/nodes.json');
    expect(nodes.nodes.map((n) => n.id)).toEqual(['quiet-page']);
  });

  it('update_component (set) reallocates only the ids this write introduces', async () => {
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Card',
      set: {
        nodes: [
          // `card_root` is /Card's own id in the fixture and must survive untouched.
          { id: 'card_root', type: 'Group', label: 'Card', children: ['title'] },
          { id: 'title', type: 'Text', label: 'Added', parent: 'card_root', parameters: { text: 'x' } }
        ],
        visual_roots: ['card_root']
      }
    });
    expect(res.isError).toBe(false);
    expect((res.data.remappedNodeIds ?? []).map((r) => r.from)).toEqual(['title']);
    expect(await duplicateIdErrors()).toEqual([]);

    const nodes = readJson<NodesV2File>(dir, 'components/Card/nodes.json');
    expect(nodes.nodes.map((n) => n.id)).toEqual(['card_root', 'title-2']);
    expect(nodes.nodes[0].children).toEqual(['title-2']);
  });

  it('update_component (operations) reallocates an added node that collides', async () => {
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Card',
      operations: [
        {
          op: 'add_node',
          node: { id: 'layout', type: 'Text', label: 'Late', parent: 'card_root', parameters: { text: 'y' } }
        }
      ]
    });
    expect(res.isError).toBe(false);
    expect((res.data.remappedNodeIds ?? []).map((r) => r.from)).toEqual(['layout']);
    expect(await duplicateIdErrors()).toEqual([]);

    const nodes = readJson<NodesV2File>(dir, 'components/Card/nodes.json');
    const late = nodes.nodes.find((n) => n.label === 'Late')!;
    expect(late.id).toBe('layout-2');
    expect(nodes.nodes.find((n) => n.id === 'card_root')!.children).toContain('layout-2');
  });

  it('a pre-existing collision is never rewritten — the gate does not make it worse, and does not tidy', async () => {
    // Plant a collision the way a hand-edit or an import would: /Card reuses an id
    // that /Pages/Home also has. This server did not write it and must not touch it.
    const cardNodes = readJson<NodesV2File>(dir, 'components/Card/nodes.json');
    cardNodes.nodes.push({ id: 'title', type: 'Text', label: 'Planted', parameters: { text: 'z' } });
    fs.writeFileSync(`${dir}/components/Card/nodes.json`, JSON.stringify(cardNodes, null, 2));

    const before = await duplicateIdErrors();
    expect(before.length).toBe(1);

    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Card',
      operations: [{ op: 'update_node', id: 'title', set: { label: 'Renamed' } }]
    });
    expect(res.isError).toBe(false);
    expect(res.data.remappedNodeIds).toBeUndefined();

    const after = readJson<NodesV2File>(dir, 'components/Card/nodes.json');
    expect(after.nodes.find((n) => n.label === 'Renamed')!.id).toBe('title');
    // Still exactly one, still not ours: reported by validate_project, not by the write.
    expect(await duplicateIdErrors()).toEqual(before);
  });

  it('two staged plan operations cannot collide with each other', async () => {
    const plan = await call<PlanResponse>(session, 'create_plan', {
      request: 'two pages',
      operations: [
        { kind: 'create', target: 'Pages/One', intent: 'first' },
        { kind: 'create', target: 'Pages/Two', intent: 'second' }
      ]
    });
    expect(plan.isError).toBe(false);
    const [first, second] = plan.data.operations;

    const nodesFor = (label: string) => [
      { id: 'root', type: 'Page', label, parameters: { title: label, urlPath: label.toLowerCase() } }
    ];

    const a = await call<StagePlanResponse>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: first.id,
      nodes: nodesFor('One'),
      visual_roots: ['root']
    });
    expect(a.isError).toBe(false);
    expect(a.data.remappedNodeIds).toBeUndefined();

    // Same id, second operation — the first is staged but unwritten, and still counts.
    const b = await call<StagePlanResponse>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: second.id,
      nodes: nodesFor('Two'),
      visual_roots: ['root']
    });
    expect(b.isError).toBe(false);
    expect((b.data.remappedNodeIds ?? []).map((r) => r.from)).toEqual(['root']);

    const applied = await call<{ applied?: unknown }>(session, 'apply_plan', { plan_id: plan.data.planId });
    expect(applied.isError).toBe(false);
    expect(await duplicateIdErrors()).toEqual([]);
    expect(readJson<NodesV2File>(dir, 'components/Pages/One/nodes.json').nodes[0].id).toBe('root');
    expect(readJson<NodesV2File>(dir, 'components/Pages/Two/nodes.json').nodes[0].id).toBe('root-2');
  });

  it('restaging one operation does not collide with its own earlier staging', async () => {
    const plan = await call<PlanResponse>(session, 'create_plan', {
      request: 'one page',
      operations: [{ kind: 'create', target: 'Pages/Solo', intent: 'only' }]
    });
    const op = plan.data.operations[0];
    const nodes = [{ id: 'solo', type: 'Page', label: 'Solo', parameters: { title: 'Solo', urlPath: 'solo' } }];

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await call<StagePlanResponse>(session, 'stage_plan_operation', {
        plan_id: plan.data.planId,
        operation_id: op.id,
        nodes,
        visual_roots: ['solo']
      });
      expect(res.isError).toBe(false);
      expect(res.data.remappedNodeIds).toBeUndefined();
    }

    await call(session, 'apply_plan', { plan_id: plan.data.planId });
    expect(readJson<NodesV2File>(dir, 'components/Pages/Solo/nodes.json').nodes[0].id).toBe('solo');
  });

  it('a duplicate id inside one payload is still a refusal, not a reallocation', async () => {
    // Within a component the collision is genuinely ambiguous — this payload's own
    // connection cannot be resolved to one of the two nodes, so nothing can guess it.
    const res = await call<{ error?: { code: string; details?: { errors?: string[] } } }>(
      session,
      'create_component',
      {
        path: 'Pages/Ambiguous',
        nodes: [
          { id: 'twin', type: 'Group', label: 'A' },
          { id: 'twin', type: 'Group', label: 'B' }
        ]
      }
    );
    expect(res.isError).toBe(true);
    expect(res.data.error?.code).toBe('invalid-argument');
    expect(res.data.error?.details?.errors?.join(' ')).toContain('Duplicate node id "twin"');
  });
});
