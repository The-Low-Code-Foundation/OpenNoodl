/**
 * FIX-014 — the layout pass on this package's write doors.
 *
 * The pure function's own behaviour lives with it, in the editor's
 * `tests-unit/fix-014/layoutAuthoredNodes.test.ts` — one engine, tested once.
 * What belongs HERE is that each MCP door actually runs it, with the ruling's
 * guarantees intact: gaps filled, exact collisions separated, model-supplied
 * x/y written verbatim, and a hand-arranged component untouched by an update
 * that did not ask to move anything.
 *
 * Asserted on disk, not on the response — AWP-002's lesson, one suite over.
 */

import * as fs from 'fs';
import * as path from 'path';

import { call, connect, copyFixture, type TestSession } from './helpers';
import type { NodesV2File, NodeV2 } from '../src/editor-deps';
import { LOGIC_COLUMN_GUTTER } from '../src/editor-deps';
import type { CreateComponentResponse, UpdateComponentResponse } from '../src/tools/responses';

let session: TestSession;
let projectDir: string;

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

describe('FIX-014 — create_component lays out what the model left unpositioned', () => {
  it('every node lands positioned, logic in its own column right of the visuals', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Components/Laid',
      nodes: [
        { id: 'fx14-root', type: 'Group' },
        { id: 'fx14-title', type: 'Text', parent: 'fx14-root', parameters: { text: 'T' } },
        { id: 'fx14-expr', type: 'Expression', parameters: { expression: '1 + 1' } }
      ],
      connections: [{ fromId: 'fx14-expr', fromProperty: 'result', toId: 'fx14-title', toProperty: 'text' }]
    });
    expect(res.isError).toBe(false);

    const written = nodesOnDisk('Components/Laid');
    for (const n of written) {
      expect(n.x).toBeDefined();
      expect(n.y).toBeDefined();
    }
    const maxVisualX = Math.max(nodeOnDisk('Components/Laid', 'fx14-root').x!, nodeOnDisk('Components/Laid', 'fx14-title').x!);
    const expr = nodeOnDisk('Components/Laid', 'fx14-expr');
    expect(expr.x).toBe(maxVisualX + LOGIC_COLUMN_GUTTER);
    // Beside the visual node it feeds:
    expect(expr.y).toBe(nodeOnDisk('Components/Laid', 'fx14-title').y);
    // No two nodes share a coordinate:
    expect(new Set(written.map((n) => `${n.x},${n.y}`)).size).toBe(written.length);
  });

  it('CONTROL: model-supplied x/y is written verbatim', async () => {
    await call(session, 'create_component', {
      path: 'Components/Placed',
      nodes: [
        { id: 'fx14-root', type: 'Group', x: 777, y: -50 },
        { id: 'fx14-title', type: 'Text', parent: 'fx14-root', x: 13.5, y: 900 }
      ]
    });
    expect(nodeOnDisk('Components/Placed', 'fx14-root')).toMatchObject({ x: 777, y: -50 });
    expect(nodeOnDisk('Components/Placed', 'fx14-title')).toMatchObject({ x: 13.5, y: 900 });
  });

  it('two nodes emitted at identical coordinates are separated on disk', async () => {
    await call(session, 'create_component', {
      path: 'Components/Clash',
      nodes: [
        { id: 'fx14-one', type: 'Group', x: 200, y: 200 },
        { id: 'fx14-two', type: 'Group', parent: 'fx14-one', x: 200, y: 200 }
      ]
    });
    const one = nodeOnDisk('Components/Clash', 'fx14-one');
    const two = nodeOnDisk('Components/Clash', 'fx14-two');
    expect(one).toMatchObject({ x: 200, y: 200 }); // first occupant keeps the spot
    expect(`${two.x},${two.y}`).not.toBe('200,200');
  });
});

describe('FIX-014 — update_component never moves a hand arrangement', () => {
  const ARRANGED = [
    { id: 'fx14-root', type: 'Group', x: 321, y: 45 },
    { id: 'fx14-title', type: 'Text', parent: 'fx14-root', x: 800, y: 700, parameters: { text: 'T' } }
  ];

  beforeEach(async () => {
    const res = await call(session, 'create_component', { path: 'Components/Arranged', nodes: ARRANGED });
    expect(res.isError).toBe(false);
  });

  it('a full `set` resubmission carrying the same positions repositions nothing', async () => {
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Arranged',
      set: {
        nodes: [
          ...ARRANGED,
          // One genuinely new, unpositioned node — the only thing the pass may place.
          { id: 'fx14-expr', type: 'Expression', parameters: { expression: '2' } }
        ]
      }
    });
    expect(res.isError).toBe(false);
    expect(nodeOnDisk('Components/Arranged', 'fx14-root')).toMatchObject({ x: 321, y: 45 });
    expect(nodeOnDisk('Components/Arranged', 'fx14-title')).toMatchObject({ x: 800, y: 700 });
    const expr = nodeOnDisk('Components/Arranged', 'fx14-expr');
    expect(expr.x).toBeDefined();
    expect(expr.y).toBeDefined();
    // In the logic column, right of the widest visual x:
    expect(expr.x!).toBeGreaterThan(800);
  });

  it('the operations door places an added node without x/y and touches nothing else', async () => {
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Arranged',
      operations: [{ op: 'add_node', node: { id: 'fx14-expr', type: 'Expression', parameters: { expression: '3' } } }]
    });
    expect(res.isError).toBe(false);
    expect(nodeOnDisk('Components/Arranged', 'fx14-root')).toMatchObject({ x: 321, y: 45 });
    expect(nodeOnDisk('Components/Arranged', 'fx14-title')).toMatchObject({ x: 800, y: 700 });
    const expr = nodeOnDisk('Components/Arranged', 'fx14-expr');
    expect(expr.x).toBeDefined();
    expect(expr.y).toBeDefined();
  });

  it('an explicit reposition through update_node is honoured verbatim — that is "explicitly asked"', async () => {
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Components/Arranged',
      operations: [{ op: 'update_node', id: 'fx14-title', set: { x: 111, y: 222 } }]
    });
    expect(res.isError).toBe(false);
    expect(nodeOnDisk('Components/Arranged', 'fx14-title')).toMatchObject({ x: 111, y: 222 });
    expect(nodeOnDisk('Components/Arranged', 'fx14-root')).toMatchObject({ x: 321, y: 45 });
  });
});
