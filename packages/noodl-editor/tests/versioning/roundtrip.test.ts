/**
 * SUB-007: snapshot adapters must round-trip both formats without losing
 * fields the engine does not understand (merge output is written back to disk).
 */

import {
  deepEqual,
  fromLegacyComponent,
  fromV2Files,
  toLegacyComponent,
  toV2Files
} from '../../src/editor/src/versioning';

describe('GraphSnapshot round-trip', () => {
  const legacyComponent = {
    id: 'comp-id-1',
    name: '/Pages/Home',
    graph: {
      roots: [
        {
          id: 'g1',
          type: 'Group',
          x: 0,
          y: 0,
          parameters: { clip: true },
          customUnknownField: { keep: 'me' },
          children: [
            {
              id: 't1',
              type: 'Text',
              label: 'Title',
              x: 10,
              y: 20,
              variant: 'Heading',
              parameters: { text: 'hello' },
              stateParameters: { hover: { opacity: 0.5 } },
              stateTransitions: { hover: { opacity: { dur: 300, curve: [0, 0, 0.58, 1] } } },
              defaultStateTransitions: { hover: { dur: 100 } },
              ports: [{ name: 'p', type: 'string', plug: 'input' }],
              dynamicports: [{ name: 'dyn', type: '*' }],
              metadata: { merge: { soureCodePorts: [] } }
            }
          ]
        },
        { id: 'solo', type: 'Image' }
      ],
      connections: [{ fromId: 't1', fromProperty: 'out', toId: 'solo', toProperty: 'in', annotation: 'Created' }],
      comments: [{ id: 'c1', text: 'note', x: 5, y: 6, width: 100, height: 50, fill: true }],
      futureGraphField: 42
    },
    metadata: { some: 'meta' },
    futureComponentField: 'preserved'
  };

  it('legacy → snapshot → legacy preserves structure and unknown fields', () => {
    const snapshot = fromLegacyComponent(legacyComponent as Record<string, unknown>);
    const back = toLegacyComponent(snapshot) as typeof legacyComponent;
    expect(back.name).toBe('/Pages/Home');
    expect(back.id).toBe('comp-id-1');
    expect(back.futureComponentField).toBe('preserved');
    expect((back.graph as Record<string, unknown>).futureGraphField).toBe(42);
    const g1 = back.graph.roots.find((r) => r.id === 'g1');
    expect(g1.customUnknownField).toEqual({ keep: 'me' });
    const t1 = g1.children[0];
    expect(t1.id).toBe('t1');
    expect(t1.label).toBe('Title');
    expect(t1.variant).toBe('Heading');
    expect(t1.stateParameters).toEqual({ hover: { opacity: 0.5 } });
    expect(t1.dynamicports).toEqual([{ name: 'dyn', type: '*' }]);
    const expectedConnections: unknown = legacyComponent.graph.connections.map(({ annotation, ...c }) => c);
    expect(deepEqual(back.graph.connections, expectedConnections)).toBe(true);
    expect(back.graph.comments[0].text).toBe('note');
    expect(back.graph.comments[0].width).toBe(100);
    expect(back.metadata).toEqual({ some: 'meta' });
    // The transient diff annotation is intentionally dropped.
    expect((back.graph.connections[0] as Record<string, unknown>).annotation).toBeUndefined();
  });

  it('v2 files → snapshot → v2 files preserves ids, hierarchy and ordering', () => {
    const files = {
      component: {
        id: 'cid',
        name: 'Home',
        path: '/Pages/Home',
        type: 'page',
        ports: { inputs: [{ name: 'in1', type: 'string' }], outputs: [] },
        metadata: { a: 1 },
        modified: '2026-01-01T00:00:00Z'
      },
      nodes: {
        componentId: 'cid',
        version: 1,
        nodes: [
          { id: 'root1', type: 'Group', children: ['child1', 'child2'] },
          { id: 'child1', type: 'Text', parent: 'root1', parameters: { text: 'a' } },
          { id: 'child2', type: 'Text', parent: 'root1', parameters: { text: 'b' } },
          { id: 'root2', type: 'Group' }
        ],
        visualRoots: ['root1'],
        comments: [{ id: 'c1', text: 'v2 comment', x: 1, y: 2 }]
      },
      connections: {
        componentId: 'cid',
        version: 1,
        connections: [{ fromId: 'child1', fromProperty: 'out', toId: 'child2', toProperty: 'in' }]
      }
    };
    const snapshot = fromV2Files(files as never);
    expect(snapshot.name).toBe('/Pages/Home');
    expect(snapshot.nodes.get('child2').parent).toBe('root1');
    expect(snapshot.nodes.get('child2').childIndex).toBe(1);

    const back = toV2Files(snapshot);
    expect(back.component.path).toBe('/Pages/Home');
    expect(back.component.type).toBe('page');
    expect(back.component.modified).toBe('2026-01-01T00:00:00Z');
    expect(deepEqual(back.component.ports, files.component.ports)).toBe(true);
    const nodes = (back.nodes as { nodes: { id: string; parent?: string; children?: string[] }[] }).nodes;
    const root1 = nodes.find((n) => n.id === 'root1');
    expect(root1.children).toEqual(['child1', 'child2']);
    expect(nodes.find((n) => n.id === 'child1').parent).toBe('root1');
    expect((back.nodes as Record<string, unknown>).visualRoots).toEqual(['root1']);
    expect((back.connections as { connections: unknown[] }).connections).toEqual(
      files.connections.connections
    );
  });

  it('legacy and v2 adapters produce equivalent snapshots for the same graph', () => {
    const legacy = {
      name: '/Pages/Home',
      graph: {
        roots: [
          {
            id: 'root1',
            type: 'Group',
            children: [
              { id: 'child1', type: 'Text', parameters: { text: 'a' } },
              { id: 'child2', type: 'Text', parameters: { text: 'b' } }
            ]
          },
          { id: 'root2', type: 'Group' }
        ],
        connections: [{ fromId: 'child1', fromProperty: 'out', toId: 'child2', toProperty: 'in' }]
      }
    };
    const v2 = {
      component: { path: '/Pages/Home' },
      nodes: {
        componentId: 'x',
        version: 1,
        nodes: [
          { id: 'root1', type: 'Group', children: ['child1', 'child2'] },
          { id: 'child1', type: 'Text', parent: 'root1', parameters: { text: 'a' } },
          { id: 'child2', type: 'Text', parent: 'root1', parameters: { text: 'b' } },
          { id: 'root2', type: 'Group' }
        ]
      },
      connections: {
        componentId: 'x',
        version: 1,
        connections: [{ fromId: 'child1', fromProperty: 'out', toId: 'child2', toProperty: 'in' }]
      }
    };
    const fromLegacy = fromLegacyComponent(legacy as Record<string, unknown>);
    const fromV2 = fromV2Files(v2 as never);
    for (const id of ['root1', 'child1', 'child2', 'root2']) {
      const a = fromLegacy.nodes.get(id);
      const b = fromV2.nodes.get(id);
      expect(a.type).toBe(b.type);
      expect(a.parent).toBe(b.parent);
      expect(a.childIndex).toBe(b.childIndex);
      expect(deepEqual(a.parameters, b.parameters)).toBe(true);
    }
    expect(fromLegacy.connections).toEqual(fromV2.connections);
  });
});
