/**
 * AWP-002 A19/A20 — the `operations` door, which lied twice.
 *
 * `update_component` has two doors onto one vocabulary. AWP-001 hardened the
 * `set` door and the `operations` door was not in its scope, so both of these
 * shipped: a key the schema does not name was **stripped and reported applied**,
 * and `visualRoots` was **never re-derived while the response said it had been**.
 *
 * Neither is visible from inside the server. `applied` listed the operation,
 * `validation` said 0 errors and 0 warnings, and `visualRootsDerived: true` was
 * printed over a stale array — so P58's re-replay lost a whole hero section with
 * every instrument green. The tests below are the task file's own minimal
 * reproduction, which is why they are shaped as one component called `Probe`
 * with one node called `band`.
 *
 * ⚠️ Both assert **on disk**, not on the tool's response. Reading the response
 * is how these went unnoticed for two phases: the response was the thing that
 * was wrong.
 */

import * as fs from 'fs';
import * as path from 'path';

import { call, connect, copyFixture, type TestSession } from './helpers';
import type { ConnectionsV2File, ConnectionV2, NodesV2File, NodeV2 } from '../src/editor-deps';
import type { CreateComponentResponse, ToolErrorPayload, UpdateComponentResponse } from '../src/tools/responses';

let session: TestSession;
let projectDir: string;

beforeEach(async () => {
  projectDir = copyFixture();
  session = await connect(projectDir);
});

afterEach(async () => {
  await session.close();
});

/** The file as written, not as reported. */
function nodesFileOnDisk(componentPath: string): NodesV2File {
  const file = path.join(projectDir, 'components', componentPath, 'nodes.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as NodesV2File;
}

function nodeOnDisk(componentPath: string, id: string): NodeV2 | undefined {
  return nodesFileOnDisk(componentPath).nodes.find((n) => n.id === id);
}

function connectionsFileOnDisk(componentPath: string): ConnectionsV2File {
  const file = path.join(projectDir, 'components', componentPath, 'connections.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ConnectionsV2File;
}

/**
 * Put a wire label on disk the way the *editor* does — MCP's schema cannot
 * express one (SIG-007 R3 keeps the four-field rule deliberately), so a label
 * can only ever arrive from the other client. That is precisely the scenario
 * worth protecting: a human labels a wire, an agent edits the component later.
 */
function labelConnectionOnDisk(componentPath: string, label: string): void {
  const file = path.join(projectDir, 'components', componentPath, 'connections.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as ConnectionsV2File;
  const first = (parsed.connections ?? [])[0] as ConnectionV2 & { label?: string; route?: unknown };
  if (!first) throw new Error(`${componentPath} has no connection to label`);
  first.label = label;
  first.route = { xs: [120], ys: [] };
  fs.writeFileSync(file, JSON.stringify(parsed, null, 2));
}

async function createProbe(): Promise<void> {
  const res = await call<CreateComponentResponse>(session, 'create_component', {
    path: 'Components/Probe',
    nodes: [{ id: 'band', type: 'Group' }]
  });
  expect(res.isError).toBe(false);
}

describe('A19 — a key the schema does not name is refused, not silently dropped', () => {
  it('update_node.set.children is rejected rather than reported applied', async () => {
    await createProbe();

    const res = await call<ToolErrorPayload>(session, 'update_component', {
      path: 'Components/Probe',
      operations: [
        { op: 'add_node', node: { id: 'wrap', type: 'Group' }, index: 0 },
        { op: 'update_node', id: 'band', set: { children: ['wrap'] } }
      ]
    });

    // The defect returned isError:false with applied:["add_node wrap (Group)",
    // "update_node band"], 0 errors and 0 warnings, having changed nothing.
    expect(res.isError).toBe(true);

    // And nothing was written — an operation batch is all-or-nothing, so the
    // refusal must not leave `wrap` behind either.
    expect(nodeOnDisk('Components/Probe', 'wrap')).toBeUndefined();
  });

  it('names the offending key, so the agent can reach for `parent` instead', async () => {
    await createProbe();
    const res = await call<ToolErrorPayload>(session, 'update_component', {
      path: 'Components/Probe',
      operations: [{ op: 'update_node', id: 'band', set: { children: ['wrap'] } }]
    });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.data)).toContain('children');
  });

  it('still accepts every key the vocabulary does name', async () => {
    await createProbe();
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      operations: [
        { op: 'add_node', node: { id: 'inner', type: 'Group' } },
        { op: 'update_node', id: 'inner', set: { label: 'Inner', x: 10, y: 20, parent: 'band' } }
      ]
    });
    expect(res.isError).toBe(false);
    const inner = nodeOnDisk('Components/Probe', 'inner');
    expect(inner?.label).toBe('Inner');
    expect(inner?.parent).toBe('band');
    expect(nodeOnDisk('Components/Probe', 'band')?.children).toContain('inner');
  });
});

describe('A20 — the operations door re-derives visualRoots', () => {
  it('a parentless visual node added by add_node becomes a root', async () => {
    await createProbe();
    expect(nodesFileOnDisk('Components/Probe').visualRoots).toEqual(['band']);

    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      operations: [{ op: 'add_node', node: { id: 'wrap', type: 'Group' } }]
    });
    expect(res.isError).toBe(false);

    // The defect left this as ["band"], so `wrap` was neither parented nor a
    // root — present in the file and unable to draw, which is F43 exactly.
    expect(nodesFileOnDisk('Components/Probe').visualRoots).toEqual(expect.arrayContaining(['band', 'wrap']));
  });

  it('a node parented by update_node stops being a root', async () => {
    await createProbe();
    await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      operations: [{ op: 'add_node', node: { id: 'wrap', type: 'Group' } }]
    });

    // ⚠️ Asserted before the interesting half, because without it this test
    // passes **vacuously** on the broken build: `wrap` never became a root
    // there, so "no longer a root" was true for the wrong reason. Confirmed by
    // running the file against the unfixed source — it was one of the three
    // that stayed green.
    expect(nodesFileOnDisk('Components/Probe').visualRoots).toContain('wrap');

    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      operations: [{ op: 'update_node', id: 'wrap', set: { parent: 'band' } }]
    });
    expect(res.isError).toBe(false);

    // The other direction matters just as much: a stale root naming a node that
    // is now a child is the same class of defect pointing the other way.
    expect(nodesFileOnDisk('Components/Probe').visualRoots).toEqual(['band']);
  });

  it('removing the last root removes the key rather than writing an empty array', async () => {
    await createProbe();
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      operations: [{ op: 'remove_node', id: 'band' }]
    });
    expect(res.isError).toBe(false);
    // `buildComponentV2Files` only writes the field when non-empty, so `[]`
    // would put MCP output outside what the editor's own writer can produce.
    expect(nodesFileOnDisk('Components/Probe').visualRoots).toBeUndefined();
  });
});

describe('SIG-007 R3 — the operations door keeps what it did not author', () => {
  // ✅ **A guard, not a defect proof.** `carryConnectionPresentation` closed R3 on
  // the `set` branch and `connectionPresentation.test.ts` pins it there; this door
  // was never broken, because `applyOperations` mutates a copy of the baseline and
  // therefore leaves untouched wires alone. It is asserted anyway because
  // "hardened on `set`, untouched on `operations`" is exactly what A20 turned out
  // to be, and this test is what would notice if the door ever grew its own
  // connection-rebuilding path. Unlike the specs above, it passes on the unfixed
  // source too — that is what makes it a guard.
  it('a wire an editor labelled survives an unrelated operations edit', async () => {
    const created = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/Wired',
      nodes: [
        { id: 'wiredBtn', type: 'net.noodl.controls.button', parameters: { label: 'Go' } },
        { id: 'wiredNav', type: 'RouterNavigate', parameters: { target: '/Pages/Home' } }
      ],
      connections: [{ fromId: 'wiredBtn', fromProperty: 'onClick', toId: 'wiredNav', toProperty: 'navigate' }]
    });
    expect(created.isError).toBe(false);

    labelConnectionOnDisk('Components/Wired', 'the primary action');

    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Wired',
      operations: [{ op: 'update_node', id: 'wiredBtn', set: { label: 'Renamed' } }]
    });
    if (res.isError) throw new Error(`update refused: ${JSON.stringify(res.data)}`);

    const wire = connectionsFileOnDisk('Components/Wired').connections?.[0] as ConnectionV2 & {
      label?: string;
      route?: { xs: number[]; ys: number[] };
    };
    expect(wire.label).toBe('the primary action');
    expect(wire.route).toEqual({ xs: [120], ys: [] });
  });
});
