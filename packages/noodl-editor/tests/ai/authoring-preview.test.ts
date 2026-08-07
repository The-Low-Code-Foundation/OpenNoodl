/**
 * AIX-002 — live preview graph: the detached component the canvas renders
 * while the agent is still writing. Tolerance is under test — out-of-order
 * parents, connections ahead of their endpoints, missing coordinates — plus
 * the pacing queue and the one invariant that matters: the preview component
 * is never part of any project.
 */

import { PreviewGraphBuilder, RevealQueue, type RevealItem } from '../../src/editor/src/models/AiAssistant/authoring/preview';
import type { SubmittedNode } from '../../src/editor/src/models/AiAssistant/authoring/types';

const GROUP: SubmittedNode = { id: 'root', type: 'Group', x: 10, y: 10 };

describe('AIX-002 preview graph builder', () => {
  it('places roots and children as they arrive, in order', () => {
    const builder = new PreviewGraphBuilder('/Pages/Preview');
    builder.addNode(GROUP, 0);
    builder.addNode({ id: 'text', type: 'Text', parent: 'root' }, 1);

    const roots = builder.component.graph.getRoots();
    expect(roots.length).toBe(1);
    expect(roots[0].id).toBe('root');
    expect(roots[0].children.map((c) => c.id)).toEqual(['text']);
    expect(builder.component.owner).toBeFalsy(); // detached — never in a project
  });

  it('holds a child whose parent has not arrived, and attaches it when it does', () => {
    const builder = new PreviewGraphBuilder('/Pages/Preview');
    builder.addNode({ id: 'text', type: 'Text', parent: 'root' }, 0);
    expect(builder.component.graph.getRoots().length).toBe(0);

    builder.addNode(GROUP, 1);
    const roots = builder.component.graph.getRoots();
    expect(roots.length).toBe(1);
    expect(roots[0].children.map((c) => c.id)).toEqual(['text']);
  });

  it('resolves whole waiting chains: grandchild → child → root', () => {
    const builder = new PreviewGraphBuilder('/Pages/Preview');
    builder.addNode({ id: 'leaf', type: 'Text', parent: 'mid' }, 0);
    builder.addNode({ id: 'mid', type: 'Group', parent: 'root' }, 1);
    expect(builder.component.graph.getRoots().length).toBe(0);

    builder.addNode(GROUP, 2);
    const roots = builder.component.graph.getRoots();
    expect(roots.length).toBe(1);
    expect(roots[0].children[0].id).toBe('mid');
    expect(roots[0].children[0].children[0].id).toBe('leaf');
  });

  it('wires a connection only once both endpoints exist', () => {
    const builder = new PreviewGraphBuilder('/Pages/Preview');
    builder.addConnection({ fromId: 'a', fromProperty: 'out', toId: 'b', toProperty: 'in' });
    expect(builder.component.graph.connections.length).toBe(0);

    builder.addNode({ id: 'a', type: 'Group' }, 0);
    expect(builder.component.graph.connections.length).toBe(0);

    builder.addNode({ id: 'b', type: 'Group' }, 1);
    expect(builder.component.graph.connections.length).toBe(1);
    expect(builder.component.graph.connections[0].fromId).toBe('a');
  });

  it('flushOrphans roots what still waits on a parent that never arrived', () => {
    const builder = new PreviewGraphBuilder('/Pages/Preview');
    builder.addNode({ id: 'lost', type: 'Text', parent: 'never' }, 0);
    builder.addNode({ id: 'also-lost', type: 'Text', parent: 'lost' }, 1);
    expect(builder.component.graph.getRoots().length).toBe(0);

    builder.flushOrphans();
    const roots = builder.component.graph.getRoots();
    // "lost" becomes a root; "also-lost" finds its real parent in the process.
    expect(roots.map((r) => r.id)).toEqual(['lost']);
    expect(roots[0].children.map((c) => c.id)).toEqual(['also-lost']);
  });

  it('drops id-less and duplicate-id nodes instead of corrupting the picture', () => {
    const builder = new PreviewGraphBuilder('/Pages/Preview');
    builder.addNode({ type: 'Group' } as SubmittedNode, 0);
    builder.addNode(GROUP, 1);
    builder.addNode({ id: 'root', type: 'Text' }, 2); // duplicate id — first wins
    const roots = builder.component.graph.getRoots();
    expect(roots.length).toBe(1);
    expect(roots[0].typename).toBe('Group');
  });

  it('gives coordinate-less nodes a fallback layout instead of stacking at the origin', () => {
    const builder = new PreviewGraphBuilder('/Pages/Preview');
    builder.addNode({ id: 'a', type: 'Group' }, 0);
    builder.addNode({ id: 'b', type: 'Group' }, 1);
    const [a, b] = builder.component.graph.getRoots();
    expect(a.x).not.toBe(b.x);
    expect(Number.isFinite(a.x)).toBe(true);
    expect(Number.isFinite(a.y)).toBe(true);
  });

  it('preserves submitted parameters and instance ports', () => {
    const builder = new PreviewGraphBuilder('/Pages/Preview');
    builder.addNode(
      {
        id: 'in',
        type: 'Component Inputs',
        parameters: { greeting: 'hello' },
        ports: [{ name: 'Trigger', plug: 'output', type: '*' }]
      },
      0
    );
    const node = builder.component.graph.getRoots()[0];
    expect(node.parameters.greeting).toBe('hello');
    expect(node.ports.some((p) => p.name === 'Trigger')).toBe(true);
  });
});

describe('AIX-002 reveal queue', () => {
  it('applies one item per tick, in order, and flush drains the rest', () => {
    const applied: string[] = [];
    const queue = new RevealQueue((item: RevealItem) => {
      applied.push(item.kind === 'node' ? `node:${item.node.id}` : `conn:${item.connection.fromId}`);
    });

    queue.enqueue([
      { kind: 'node', node: { id: 'a', type: 'Group' }, order: 0 },
      { kind: 'node', node: { id: 'b', type: 'Text' }, order: 1 },
      { kind: 'connection', connection: { fromId: 'a', fromProperty: 'x', toId: 'b', toProperty: 'y' } }
    ]);

    expect(queue.tick()).toBe(true);
    expect(applied).toEqual(['node:a']);
    expect(queue.pending).toBe(2);

    queue.flush();
    expect(applied).toEqual(['node:a', 'node:b', 'conn:a']);
    expect(queue.tick()).toBe(false);
  });
});
