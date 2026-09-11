/**
 * DEF-025 — the MCP half of "flip at creation, in BOTH doors".
 *
 * Richard's ruling (2026-08-30) names both doors deliberately: the editor
 * palette and this package are the two ways a toggle gets created, and fixing
 * only one leaves the other producing controls whose words are not a tap
 * target — at which point the advisory `label-not-a-click-target` warning
 * fires **on the product's own output**, which is exactly the situation s17 hit
 * when `catalog:examples` went 61/62 on a shipped recipe.
 *
 * The decision itself (which types, which parameter, the explicit-choice guard)
 * is graded once, in the editor's `tests-unit/def-025/creation-defaults`. This
 * package imports that decision rather than restating it, so what belongs HERE
 * is that each of this package's doors actually runs it — and, just as
 * important, that the one door which re-sends an existing graph does **not**.
 *
 * Asserted on disk, not on the response — AWP-002's lesson.
 */

import * as fs from 'fs';
import * as path from 'path';

import { call, connect, copyFixture, type TestSession } from './helpers';
import type { NodesV2File, NodeV2 } from '../src/editor-deps';
import type { CreateComponentResponse, UpdateComponentResponse } from '../src/tools/responses';

let session: TestSession;
let projectDir: string;

const CHECKBOX = 'net.noodl.controls.checkbox';
const RADIO = 'net.noodl.controls.radiobutton';

beforeEach(async () => {
  projectDir = copyFixture();
  session = await connect(projectDir);
});

afterEach(async () => {
  await session.close();
});

function nodesOnDisk(componentPath: string): NodeV2[] {
  const file = path.join(projectDir, 'components', componentPath, 'nodes.json');
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as NodesV2File).nodes;
}

function nodeOnDisk(componentPath: string, id: string): NodeV2 {
  const node = nodesOnDisk(componentPath).find((n) => n.id === id);
  if (!node) throw new Error(`${componentPath} has no node "${id}" on disk`);
  return node;
}

/** A page holding one toggle, authored through the create door. */
async function createWithToggle(componentPath: string, toggle: Partial<NodeV2> & { id: string; type: string }) {
  const res = await call<CreateComponentResponse>(session, 'create_component', {
    path: componentPath,
    nodes: [{ id: 'def025-root', type: 'Group' }, { ...toggle, parent: 'def025-root' }]
  });
  expect(res.isError).toBe(false);
  return res;
}

describe('DEF-025 — create_component', () => {
  it('a newly authored Checkbox arrives with its own label as the click target', async () => {
    await createWithToggle('Components/Def025Create', { id: 'cb', type: CHECKBOX });
    expect(nodeOnDisk('Components/Def025Create', 'cb').parameters?.useLabel).toBe(true);
  });

  it('a newly authored Radio Button gets the same', async () => {
    await createWithToggle('Components/Def025Radio', { id: 'rb', type: RADIO });
    expect(nodeOnDisk('Components/Def025Radio', 'rb').parameters?.useLabel).toBe(true);
  });

  it('🔴 an explicit useLabel: false survives the door', async () => {
    // The bare box is a legitimate thing to ask for. A door that silently
    // corrects the caller is worse than one with no default at all.
    await createWithToggle('Components/Def025Explicit', {
      id: 'cb',
      type: CHECKBOX,
      parameters: { useLabel: false }
    });
    expect(nodeOnDisk('Components/Def025Explicit', 'cb').parameters?.useLabel).toBe(false);
  });

  it('writes nothing but useLabel, and touches no other node', async () => {
    await createWithToggle('Components/Def025Narrow', { id: 'cb', type: CHECKBOX });
    const cb = nodeOnDisk('Components/Def025Narrow', 'cb');
    expect(Object.keys(cb.parameters ?? {})).toEqual(['useLabel']);
    // The placeholder is the port's own default and is deliberately NOT
    // written to disk: 178 projects' worth of graphs carrying the product's
    // placeholder string is not a default, it is content.
    expect(cb.parameters?.label).toBeUndefined();
    expect(nodeOnDisk('Components/Def025Narrow', 'def025-root').parameters?.useLabel).toBeUndefined();
  });
});

describe('DEF-025 — update_component', () => {
  it('add_node flips a toggle added to an existing component', async () => {
    await createWithToggle('Components/Def025Add', { id: 'cb', type: CHECKBOX, parameters: { useLabel: false } });

    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Def025Add',
      operations: [{ op: 'add_node', node: { id: 'cb2', type: CHECKBOX, parent: 'def025-root' } }]
    });
    expect(res.isError).toBe(false);
    expect(nodeOnDisk('Components/Def025Add', 'cb2').parameters?.useLabel).toBe(true);
    // ...and left the one that was already there exactly as it was.
    expect(nodeOnDisk('Components/Def025Add', 'cb').parameters?.useLabel).toBe(false);
  });

  it('🔴 the `set` door does NOT flip a checkbox that was already on disk', async () => {
    // This is the whole "no existing rendering moves" half of the ruling, and
    // the reason the door needs the component's current ids rather than a flag.
    // `set` re-sends the ENTIRE graph on every call, so a node arriving here
    // without `useLabel` is usually a node someone deliberately left bare —
    // not a node being created.
    await createWithToggle('Components/Def025Set', { id: 'cb', type: CHECKBOX, parameters: { useLabel: false } });

    // Re-send the graph the way a client that read it back would: bare.
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Def025Set',
      set: {
        nodes: [
          { id: 'def025-root', type: 'Group' },
          { id: 'cb', type: CHECKBOX, parent: 'def025-root' }
        ]
      }
    });
    expect(res.isError).toBe(false);
    expect(nodeOnDisk('Components/Def025Set', 'cb').parameters?.useLabel).toBeUndefined();
  });

  it('the `set` door DOES flip a toggle it is adding for the first time', async () => {
    // Same door, same call shape — the only variable is whether the id was
    // already in the component. That is the discriminator, so it gets a pair.
    await createWithToggle('Components/Def025SetNew', { id: 'cb', type: CHECKBOX, parameters: { useLabel: false } });

    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Def025SetNew',
      set: {
        nodes: [
          { id: 'def025-root', type: 'Group' },
          { id: 'cb', type: CHECKBOX, parent: 'def025-root' },
          { id: 'cb-new', type: CHECKBOX, parent: 'def025-root' }
        ]
      }
    });
    expect(res.isError).toBe(false);
    expect(nodeOnDisk('Components/Def025SetNew', 'cb').parameters?.useLabel).toBeUndefined();
    expect(nodeOnDisk('Components/Def025SetNew', 'cb-new').parameters?.useLabel).toBe(true);
  });
});

describe('DEF-025 — the plan door', () => {
  it('a staged create flips, and a staged update leaves an existing toggle alone', async () => {
    await createWithToggle('Components/Def025Planned', { id: 'cb', type: CHECKBOX, parameters: { useLabel: false } });

    const plan = await call<{ planId: string; operations: Array<{ id: string; target: string }> }>(
      session,
      'create_plan',
      {
        request: 'DEF-025 — both plan kinds in one plan',
        operations: [
          { kind: 'create', target: 'Components/Def025PlanNew', intent: 'a page with a fresh checkbox' },
          { kind: 'update', target: 'Components/Def025Planned', intent: 're-send the existing graph' }
        ]
      }
    );
    expect(plan.isError).toBe(false);

    const [createOp, updateOp] = plan.data.operations;

    const staged = await call(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: createOp.id,
      nodes: [
        { id: 'plan-root', type: 'Group' },
        { id: 'plan-cb', type: CHECKBOX, parent: 'plan-root' }
      ]
    });
    expect(staged.isError).toBe(false);

    const stagedUpdate = await call(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: updateOp.id,
      nodes: [
        { id: 'def025-root', type: 'Group' },
        { id: 'cb', type: CHECKBOX, parent: 'def025-root' }
      ]
    });
    expect(stagedUpdate.isError).toBe(false);

    const applied = await call(session, 'apply_plan', { plan_id: plan.data.planId });
    expect(applied.isError).toBe(false);

    expect(nodeOnDisk('Components/Def025PlanNew', 'plan-cb').parameters?.useLabel).toBe(true);
    expect(nodeOnDisk('Components/Def025Planned', 'cb').parameters?.useLabel).toBeUndefined();
  });
});
