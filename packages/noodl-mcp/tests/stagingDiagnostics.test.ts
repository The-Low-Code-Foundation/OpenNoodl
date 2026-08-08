/**
 * LAS-002 — staging speaks: diagnostics, not counts.
 *
 * `repeated-sibling-subtree` is the only architecture gate in the system, and
 * in all three of phase 55's measured builds it fired at exactly the moment the
 * agent could still act on it — while a component was STAGED, before anything
 * reached disk — and was delivered as `{"warnings": 1}`. An integer. Haiku
 * shipped two hand-duplicated trios; the baseline shipped three. Nothing ever
 * saw the words.
 *
 * The audit's central measurement is that rejections carrying a suggestion were
 * self-corrected on the next turn, even by the mid-tier model, while prose was
 * dropped. A warning is only worth emitting if it is legible at the moment it
 * fires, so these specs pin the TEXT reaching the caller — code, message and
 * location — on every authoring door, and pin the silence on a clean candidate,
 * because a door that always says something is a door nobody reads.
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
    diagnostics?: Array<{ code: string; severity: string; message: string; location: { nodeId?: string } }>;
  };
}

interface ApplyResponse {
  applied: Array<{ target: string }>;
  validation?: {
    summary: { errors: number; warnings: number; infos: number };
    diagnostics?: Array<{ code: string; message: string; location: { component?: string } }>;
  };
}

/**
 * Three structurally identical `Group > Text × 2` siblings — the shape the rule
 * matches, and the shape every measured replay hand-laid. Values differ on
 * purpose: the rule compares STRUCTURE, so identical-looking copies with
 * different copy are exactly the case it must still catch.
 */
function trioOfSiblings(): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [
    { id: 'page', type: 'Page', parameters: { title: 'Trio' } },
    { id: 'row', type: 'Group', parent: 'page' }
  ];
  for (let i = 0; i < 3; i++) {
    nodes.push({ id: `item${i}`, type: 'Group', parent: 'row' });
    nodes.push({ id: `item${i}_a`, type: 'Text', parent: `item${i}`, parameters: { text: `Heading ${i}` } });
    nodes.push({ id: `item${i}_b`, type: 'Text', parent: `item${i}`, parameters: { text: `Body copy ${i}` } });
  }
  return nodes;
}

/** The same page with one item — nothing for the rule to match. */
const CLEAN_NODES = [
  { id: 'page', type: 'Page', parameters: { title: 'Clean' } },
  { id: 'row', type: 'Group', parent: 'page' },
  { id: 'only', type: 'Text', parent: 'row', parameters: { text: 'One of a kind' } }
];

describe('LAS-002 — every authoring door returns the warning text', () => {
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

  async function planFor(target: string): Promise<CreatePlanResponse> {
    const res = await call<CreatePlanResponse>(session, 'create_plan', {
      request: `Add ${target}`,
      operations: [{ kind: 'create', target, intent: 'A page built from repeated siblings.' }]
    });
    expect(res.isError).toBe(false);
    return res.data;
  }

  it('stage_plan_operation returns the repeated-sibling-subtree message, not just a count', async () => {
    const plan = await planFor('Pages/Trio');
    const res = await call<StageResponse>(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: plan.operations[0].id,
      nodes: trioOfSiblings(),
      visual_roots: ['page']
    });

    expect(res.isError).toBe(false);
    // The count stays — anything already parsing it keeps working.
    expect(res.data.warnings).toBeGreaterThanOrEqual(1);

    const diagnostics = res.data.validation?.diagnostics ?? [];
    const sibling = diagnostics.find((d) => d.code === 'repeated-sibling-subtree');
    expect(sibling).toBeDefined();

    // Structured entries, not a pre-joined string: LAS-007 keys its example
    // attachments on `code`, and a location is what makes a warning actionable.
    expect(sibling!.severity).toBe('warning');
    expect(sibling!.message).toContain('structurally identical');
    expect(sibling!.message).toContain('Make one component and instantiate it');
    expect(sibling!.location.nodeId).toBeTruthy();
  });

  it('stays silent on a clean candidate', async () => {
    const plan = await planFor('Pages/Clean');
    const res = await call<StageResponse>(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: plan.operations[0].id,
      nodes: CLEAN_NODES,
      visual_roots: ['page']
    });

    expect(res.isError).toBe(false);
    expect(res.data.warnings).toBe(0);
    expect(res.data.validation?.diagnostics ?? []).toEqual([]);
  });

  it('apply_plan reports the warnings that survived into the written project', async () => {
    const plan = await planFor('Pages/Trio');
    await call<StageResponse>(session, 'stage_plan_operation', {
      plan_id: plan.planId,
      operation_id: plan.operations[0].id,
      nodes: trioOfSiblings(),
      visual_roots: ['page']
    });

    const res = await call<ApplyResponse>(session, 'apply_plan', { plan_id: plan.planId });
    expect(res.isError).toBe(false);
    expect(res.data.applied.length).toBe(1);

    const sibling = (res.data.validation?.diagnostics ?? []).find((d) => d.code === 'repeated-sibling-subtree');
    expect(sibling).toBeDefined();
    // Which component it landed in — an apply writes a set, so a bare message
    // would leave the caller guessing which of them it is about.
    expect(sibling!.location.component).toBe('/Pages/Trio');
  });

  it('create_component already speaks, and speaks the same dialect', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Trio',
      nodes: trioOfSiblings(),
      visual_roots: ['page']
    });

    expect(res.isError).toBe(false);
    const sibling = (res.data.validation.diagnostics ?? []).find((d) => d.code === 'repeated-sibling-subtree');
    expect(sibling).toBeDefined();
    expect(sibling!.message).toContain('structurally identical');
  });
});
