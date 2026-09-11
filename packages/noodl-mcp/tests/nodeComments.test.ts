/**
 * LEG-001 — `comment` through the MCP door, end to end.
 *
 * The field is authored flat and stored at `metadata.comment`, and both of those
 * sentences have to be true at once: a caller that never names the bag, and a
 * file whose bag is exactly what CAN-004's gutter stripe, hover tooltip and
 * context menu already read.
 *
 * ⚠️ The bag is shared, and the spec's warning is the first thing asserted here:
 * `merge.soureCodePorts` — written by the editor for every node with a
 * source-code port, and the SUB-007 merge driver's input — must be exactly where
 * it was after a comment is written to the same node. A mapping that rebuilt the
 * bag instead of copying it would pass every "the comment is there" check ever
 * written and lose the merge info in silence.
 *
 * The doors covered: `create_component`, `update_component` with `set`, and both
 * delta operations (`add_node`, `update_node`). The read direction is
 * `get_component`, and the property that matters there is that read → hand back
 * → write is a **fixed point** rather than a graph that changed because it was
 * looked at.
 */

import * as fs from 'fs';
import * as path from 'path';

import { call, connect, copyFixture, type TestSession } from './helpers';
import type { NodeV2 } from '../src/editor-deps';
import type { CreateComponentResponse, GetComponentResponse, UpdateComponentResponse } from '../src/tools/responses';

/** §4's first case: a decision with an alternative. */
const WHY = 'Deliberately not a Repeater — the three cards differ in more than data.';
const MERGE = { soureCodePorts: ['functionScript'] };

let session: TestSession;
let projectDir: string;

beforeEach(async () => {
  projectDir = copyFixture();
  session = await connect(projectDir);
});

afterEach(async () => {
  await session.close();
});

/** The nodes exactly as they sit on disk — not as a tool reports them. */
function nodesOnDisk(componentPath: string): NodeV2[] {
  const file = path.join(projectDir, 'components', componentPath, 'nodes.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')).nodes as NodeV2[];
}

async function createProbe(nodes: Array<Record<string, unknown>>): Promise<void> {
  const res = await call<CreateComponentResponse>(session, 'create_component', {
    path: 'Components/Probe',
    nodes
  });
  expect(res.isError).toBe(false);
}

describe('LEG-001 — a comment authored through create_component reaches the bag', () => {
  it('stores it at metadata.comment and nowhere else', async () => {
    await createProbe([{ id: 'root', type: 'Group', comment: WHY }]);

    const [node] = nodesOnDisk('Components/Probe');
    expect(node.metadata).toEqual({ comment: WHY });
    // A top-level `comment` on a stored node is read by nothing: every reader
    // CAN-004 shipped looks in the bag. Passthrough would happily have written
    // one, which is the failure this mapping exists to prevent.
    expect('comment' in node).toBe(false);
  });

  it('writes no metadata key at all for a node with no comment', async () => {
    await createProbe([{ id: 'root', type: 'Group', label: 'Root' }]);

    const [node] = nodesOnDisk('Components/Probe');
    expect('metadata' in node).toBe(false);
  });

  it('trims, and treats whitespace as no comment', async () => {
    await createProbe([
      { id: 'root', type: 'Group', comment: `  ${WHY}  ` },
      { id: 'blank', type: 'Group', parent: 'root', comment: '   ' }
    ]);

    const nodes = nodesOnDisk('Components/Probe');
    expect(nodes.find((n) => n.id === 'root')!.metadata).toEqual({ comment: WHY });
    expect('metadata' in nodes.find((n) => n.id === 'blank')!).toBe(false);
  });
});

describe('LEG-001 — the metadata bag is not disturbed', () => {
  it('keeps merge.soureCodePorts when a comment is written to the same node', async () => {
    // The node arrives with the bag it already had — which is what a
    // read-modify-write hands back, `.passthrough()` being the reason it
    // survives at all — plus the flat field this task added.
    await createProbe([{ id: 'fn', type: 'Group', metadata: { merge: MERGE }, comment: WHY }]);

    const [node] = nodesOnDisk('Components/Probe');
    expect(node.metadata).toEqual({ merge: MERGE, comment: WHY });
  });

  it('keeps it through update_node too, and clears only the comment', async () => {
    await createProbe([{ id: 'fn', type: 'Group', metadata: { merge: MERGE }, comment: WHY }]);

    const cleared = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      operations: [{ op: 'update_node', id: 'fn', set: { comment: '' } }]
    });
    expect(cleared.isError).toBe(false);

    const [node] = nodesOnDisk('Components/Probe');
    expect(node.metadata).toEqual({ merge: MERGE });
  });

  it('leaves no empty bag behind when the comment was all it held', async () => {
    await createProbe([{ id: 'fn', type: 'Group', comment: WHY }]);
    await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      operations: [{ op: 'update_node', id: 'fn', set: { comment: '' } }]
    });

    const [node] = nodesOnDisk('Components/Probe');
    expect('metadata' in node).toBe(false);
  });
});

describe('LEG-001 — every write door folds the same way', () => {
  it('update_component set', async () => {
    await createProbe([{ id: 'root', type: 'Group' }]);
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      set: { nodes: [{ id: 'root', type: 'Group', comment: WHY }] }
    });
    expect(res.isError).toBe(false);

    expect(nodesOnDisk('Components/Probe')[0].metadata).toEqual({ comment: WHY });
  });

  it('add_node', async () => {
    await createProbe([{ id: 'root', type: 'Group' }]);
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      operations: [{ op: 'add_node', node: { id: 'child', type: 'Group', parent: 'root', comment: WHY } }]
    });
    expect(res.isError).toBe(false);

    const child = nodesOnDisk('Components/Probe').find((n) => n.id === 'child')!;
    expect(child.metadata).toEqual({ comment: WHY });
    expect('comment' in child).toBe(false);
  });

  it('update_node — the door a 60-node page actually uses', async () => {
    // Without this, an agent adding one sentence to one node has to resend the
    // whole graph. A field zod does not name is a field zod strips, silently,
    // which is how `update_node.set.children` lost a hero in P58.
    await createProbe([{ id: 'root', type: 'Group' }]);
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      operations: [{ op: 'update_node', id: 'root', set: { comment: WHY } }]
    });
    expect(res.isError).toBe(false);

    const [node] = nodesOnDisk('Components/Probe');
    expect(node.metadata).toEqual({ comment: WHY });
    expect('comment' in node).toBe(false);
  });
});

describe('LEG-001 — the read direction', () => {
  it('get_component reports the comment flat, and not twice', async () => {
    await createProbe([{ id: 'fn', type: 'Group', metadata: { merge: MERGE }, comment: WHY }]);

    const res = await call<GetComponentResponse>(session, 'get_component', { path: 'Components/Probe' });
    const node = res.data.nodes.find((n) => n.id === 'fn') as NodeV2 & { comment?: string };

    expect(node.comment).toBe(WHY);
    // Out of the bag on the way out: the same sentence twice on the wire is
    // paid on every read, and leaves a caller guessing which copy to edit.
    expect(node.metadata).toEqual({ merge: MERGE });
  });

  it('read → hand the graph back → write is a fixed point', async () => {
    // The round trip an external agent performs constantly. Anything but
    // equality here is a file that changes because it was looked at.
    await createProbe([
      { id: 'root', type: 'Group', comment: WHY },
      { id: 'fn', type: 'Group', parent: 'root', metadata: { merge: MERGE }, comment: 'Kept for the merge driver.' }
    ]);
    const before = nodesOnDisk('Components/Probe');

    const read = await call<GetComponentResponse>(session, 'get_component', { path: 'Components/Probe' });
    const written = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      set: { nodes: read.data.nodes }
    });
    expect(written.isError).toBe(false);

    expect(nodesOnDisk('Components/Probe')).toEqual(before);
  });

  it('a graph with no comments round-trips byte-identically', async () => {
    await createProbe([{ id: 'root', type: 'Group', label: 'Root' }]);
    const before = nodesOnDisk('Components/Probe');

    const read = await call<GetComponentResponse>(session, 'get_component', { path: 'Components/Probe' });
    await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Probe',
      set: { nodes: read.data.nodes }
    });

    expect(nodesOnDisk('Components/Probe')).toEqual(before);
  });
});

describe('LEG-001 — the tool surface says the field exists', () => {
  it('names comment on create_component with the sentence both doors share', async () => {
    const tools = (await session.client.listTools()).tools;
    const create = tools.find((t) => t.name === 'create_component')!;
    const schema = create.inputSchema as unknown as {
      properties: { nodes: { items: { properties: Record<string, { description?: string }> } } };
    };
    const comment = schema.properties.nodes.items.properties.comment;

    expect(comment).toBeDefined();
    expect(comment.description).toBe(
      'Why this node is the way it is — a constraint, a rule, or a decision with an alternative. ' +
        'Omit when the type and label already say it.'
    );
  });
});
