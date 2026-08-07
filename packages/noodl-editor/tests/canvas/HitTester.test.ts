import * as HitTester from '../../src/editor/src/views/nodegrapheditor/canvas/HitTester';

/**
 * Stub node views: enough shape for the spatial queries (id, global position,
 * nodeSize, children, and the early-exit forEach contract of
 * NodeGraphEditorNode).
 */
function stubNode(id: string, x: number, y: number, width = 100, height = 40, children: TSFixme[] = []) {
  const node: TSFixme = {
    id,
    global: { x, y },
    nodeSize: { width, height },
    children,
    forEach(callback: (n: TSFixme) => boolean | void) {
      if (callback(node)) return true;
      for (const child of node.children) {
        if (child.forEach(callback)) return true;
      }
      return false;
    }
  };
  return node;
}

function stubConnection(fromId: string, fromProperty: string, toId: string, toProperty: string) {
  return { model: { fromId, fromProperty, toId, toProperty } } as TSFixme;
}

describe('HitTester', () => {
  const child = stubNode('child', 60, 60, 50, 20);
  const a = stubNode('a', 0, 0, 100, 40);
  const b = stubNode('b', 50, 50, 100, 40, [child]);
  const c = stubNode('c', 300, 300, 100, 40);
  const roots = [a, b, c];

  it('forEachNode visits depth-first and stops on true', () => {
    const visited: string[] = [];
    HitTester.forEachNode(roots, (n) => {
      visited.push(n.id);
    });
    expect(visited).toEqual(['a', 'b', 'child', 'c']);

    const partial: string[] = [];
    const stopped = HitTester.forEachNode(roots, (n) => {
      partial.push(n.id);
      return n.id === 'b';
    });
    expect(stopped).toBe(true);
    expect(partial).toEqual(['a', 'b']);
  });

  it('findNodeWithId finds nested nodes and returns undefined for misses', () => {
    expect(HitTester.findNodeWithId(roots, 'child')).toBe(child);
    expect(HitTester.findNodeWithId(roots, 'nope')).toBeUndefined();
  });

  it('findConnectionWithModel matches by identity, findConnectionWithKey by concatenated key', () => {
    const con = stubConnection('a', 'out', 'b', 'in');
    const connections = [con, stubConnection('b', 'x', 'c', 'y')];

    expect(HitTester.findConnectionWithModel(connections, con.model)).toBe(con);
    expect(HitTester.findConnectionWithModel(connections, { ...con.model })).toBeUndefined();

    expect(HitTester.findConnectionWithKey(connections, 'aoutbin')).toBe(con);
    expect(HitTester.findConnectionWithKey(connections, 'bogus')).toBeUndefined();
  });

  it('isPointInsideNodes is edge-inclusive', () => {
    expect(HitTester.isPointInsideNodes({ x: 0, y: 0 }, [a])).toBe(true);
    expect(HitTester.isPointInsideNodes({ x: 100, y: 40 }, [a])).toBe(true);
    expect(HitTester.isPointInsideNodes({ x: 101, y: 0 }, [a])).toBe(false);
    expect(HitTester.isPointInsideNodes({ x: 5, y: 5 }, [])).toBe(false);
  });

  it('findNodeContaining returns the first list entry containing the point', () => {
    // (60, 60) is inside b and child; list order decides
    expect(HitTester.findNodeContaining({ x: 60, y: 60 }, [child, b])).toBe(child);
    expect(HitTester.findNodeContaining({ x: 60, y: 60 }, [b, child])).toBe(b);
    expect(HitTester.findNodeContaining({ x: -5, y: -5 }, [a, b])).toBeUndefined();
  });

  it('findNodeAtPoint returns the first hit in traversal order (parents before children)', () => {
    expect(HitTester.findNodeAtPoint({ x: 60, y: 60 }, roots)).toBe(b);
    expect(HitTester.findNodeAtPoint({ x: 310, y: 310 }, roots)).toBe(c);
    expect(HitTester.findNodeAtPoint({ x: 999, y: 999 }, roots)).toBeNull();
  });

  it('nodesInRect returns all nodes overlapping the rect, including children', () => {
    const hits = HitTester.nodesInRect(roots, { x: 0, y: 0, width: 120, height: 120 });
    expect(hits).toEqual([a, b, child]);

    expect(HitTester.nodesInRect(roots, { x: 500, y: 500, width: 10, height: 10 })).toEqual([]);
  });

  it('resolveMultiselect implements select, union and reduce semantics', () => {
    expect(HitTester.resolveMultiselect('select', [a], [b, c])).toEqual([b, c]);

    expect(HitTester.resolveMultiselect('union', [a, b], [b, c])).toEqual([a, b, c]);
    expect(HitTester.resolveMultiselect('union', undefined, [c])).toEqual([c]);

    expect(HitTester.resolveMultiselect('reduce', [a, b, c], [b])).toEqual([a, c]);
    expect(HitTester.resolveMultiselect('reduce', undefined, [b])).toEqual([]);
  });
});
