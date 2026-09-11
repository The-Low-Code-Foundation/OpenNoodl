/**
 * DEF-013 (SB-012 §1) — RE-DRIVE at HEAD, 2026-08-30.
 *
 * SB-012's table was measured 2026-08-26. Richard's ruling: re-drive before
 * deciding anything, because the door's component list has moved underneath it.
 *
 * The scenario is SB-012's verbatim: two throwaway pages that navigate to each
 * OTHER, staged into ONE plan. Neither exists on disk. Whichever is staged
 * first names a sibling that is declared in the plan but not yet staged.
 */
import * as fs from 'fs';

import { call, connect, copyFixture, TestSession } from './helpers';

interface CreatePlanResponse {
  planId: string;
  operations: Array<{ id: string; kind: string; target: string; intent: string }>;
}

/** A page whose button navigates to `target`. */
function pageNavigatingTo(prefix: string, title: string, target: string) {
  return {
    nodes: [
      { id: `${prefix}_page`, type: 'Page', parameters: { title, urlPath: title.toLowerCase() } },
      { id: `${prefix}_btn`, type: 'Button', parent: `${prefix}_page`, parameters: { label: `To ${target}` } },
      { id: `${prefix}_go`, type: 'RouterNavigate', label: 'go', parameters: { target } }
    ],
    connections: [
      { fromId: `${prefix}_btn`, fromProperty: 'onClick', toId: `${prefix}_go`, toProperty: 'navigate' }
    ],
    visual_roots: [`${prefix}_page`]
  };
}

describe('DEF-013 — sibling resolution across one plan (re-drive)', () => {
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

  it('THE MEASUREMENT: stages two mutually-navigating pages in one plan', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'Two pages that link to each other',
      operations: [
        { kind: 'create', target: 'Pages/A', intent: 'Page A, links to B.' },
        { kind: 'create', target: 'Pages/B', intent: 'Page B, links to A.' }
      ]
    });
    expect(plan.isError).toBe(false);

    const opFor = (t: string) => plan.data.operations.find((o) => o.target === t)!.id;
    const a = pageNavigatingTo('a', 'A', '/Pages/B');
    const b = pageNavigatingTo('b', 'B', '/Pages/A');

    const stageA = await call<any>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: opFor('Pages/A'),
      nodes: a.nodes,
      connections: a.connections,
      visual_roots: a.visual_roots
    });
    // eslint-disable-next-line no-console
    console.log('STAGE A →', stageA.isError ? 'REFUSED' : 'ok', JSON.stringify(stageA.data).slice(0, 900));

    const stageB = await call<any>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: opFor('Pages/B'),
      nodes: b.nodes,
      connections: b.connections,
      visual_roots: b.visual_roots
    });
    // eslint-disable-next-line no-console
    console.log('STAGE B →', stageB.isError ? 'REFUSED' : 'ok', JSON.stringify(stageB.data).slice(0, 900));

    const applied = await call<any>(session, 'apply_plan', { plan_id: plan.data.planId });
    // eslint-disable-next-line no-console
    console.log('APPLY   →', applied.isError ? 'REFUSED' : 'ok', JSON.stringify(applied.data).slice(0, 900));

    expect({ a: stageA.isError, b: stageB.isError, apply: applied.isError }).toEqual({
      a: false,
      b: false,
      apply: false
    });
  });

  it('CONTROL: a target that resolves to nothing at all is still refused', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'One page linking nowhere',
      operations: [{ kind: 'create', target: 'Pages/C', intent: 'Page C, links to a page nobody plans.' }]
    });
    expect(plan.isError).toBe(false);

    const c = pageNavigatingTo('c', 'C', '/Pages/NeverPlanned');
    const stageC = await call<any>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: plan.data.operations[0].id,
      nodes: c.nodes,
      connections: c.connections,
      visual_roots: c.visual_roots
    });
    // eslint-disable-next-line no-console
    console.log('CONTROL →', stageC.isError ? 'REFUSED' : 'ok', JSON.stringify(stageC.data).slice(0, 700));

    // The control must FIRE, and for the RIGHT REASON. The first run of this
    // drive had every arm "refused" by ARGUMENT-SCHEMA validation, which would
    // have read as the door working while the rule was never reached.
    expect(stageC.isError).toBe(true);
    expect(JSON.stringify(stageC.data)).toContain('unresolved-navigation');
    expect(JSON.stringify(stageC.data)).not.toContain('Input validation error');
  });

  it('SCOPE: a node-TYPE cycle across one plan (SB-012 says type resolves)', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'Two components that place each other',
      operations: [
        { kind: 'create', target: 'Widgets/D', intent: 'D places E.' },
        { kind: 'create', target: 'Widgets/E', intent: 'E places D.' }
      ]
    });
    expect(plan.isError).toBe(false);
    const opFor = (t: string) => plan.data.operations.find((o) => o.target === t)!.id;

    const stageD = await call<any>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: opFor('Widgets/D'),
      nodes: [
        { id: 'd_root', type: 'Group' },
        { id: 'd_e', type: '/Widgets/E', parent: 'd_root' }
      ],
      visual_roots: ['d_root']
    });
    // eslint-disable-next-line no-console
    console.log('TYPE D  →', stageD.isError ? 'REFUSED' : 'ok', JSON.stringify(stageD.data).slice(0, 600));
    // 🔴 This line was `expect(typeof stageD.isError).toBe('boolean')` while the
    // arm was an exploratory probe, and it survived its own mutant: the door
    // refused and the arm still read green. An arm that cannot fail is not a
    // gate. It asserts the outcome now.
    expect(stageD.isError).toBe(false);
  });

  it('THE THIRD SPELLING: a For Each whose template is a planned sibling', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A list and the row it repeats',
      operations: [
        { kind: 'create', target: 'Pages/List', intent: 'Repeats a Row.' },
        { kind: 'create', target: 'Widgets/Row', intent: 'One row.' }
      ]
    });
    expect(plan.isError).toBe(false);
    const opFor = (t: string) => plan.data.operations.find((o) => o.target === t)!.id;

    // Staged FIRST, before its template sibling is staged — the whole point.
    const stageList = await call<any>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: opFor('Pages/List'),
      nodes: [
        { id: 'l_page', type: 'Page', parameters: { title: 'List', urlPath: 'list' } },
        { id: 'l_each', type: 'For Each', parent: 'l_page', parameters: { template: '/Widgets/Row' } }
      ],
      visual_roots: ['l_page']
    });
    // eslint-disable-next-line no-console
    console.log('TEMPLATE →', stageList.isError ? 'REFUSED' : 'ok', JSON.stringify(stageList.data).slice(0, 700));
    expect(stageList.isError).toBe(false);
  });

  it('CONTROL 2: a For Each template nobody plans is still refused', async () => {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'A list repeating nothing',
      operations: [{ kind: 'create', target: 'Pages/List2', intent: 'Repeats a row nobody plans.' }]
    });
    expect(plan.isError).toBe(false);
    const stage = await call<any>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: plan.data.operations[0].id,
      nodes: [
        { id: 'l2_page', type: 'Page', parameters: { title: 'List2', urlPath: 'list2' } },
        { id: 'l2_each', type: 'For Each', parent: 'l2_page', parameters: { template: '/Widgets/NeverPlanned' } }
      ],
      visual_roots: ['l2_page']
    });
    // eslint-disable-next-line no-console
    console.log('CONTROL2 →', stage.isError ? 'REFUSED' : 'ok', JSON.stringify(stage.data).slice(0, 500));
    expect(stage.isError).toBe(true);
    expect(JSON.stringify(stage.data)).toContain('repeater-template-unresolved');
  });
});
