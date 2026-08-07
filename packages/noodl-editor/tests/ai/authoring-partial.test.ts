/**
 * AIX-002 — partial-submission scanner: complete nodes and connections are
 * yielded from *streaming* (unterminated, invalid) `submit_component` JSON,
 * exactly as they close, regardless of how the text is fragmented.
 */

import { PartialPayloadScanner } from '../../src/editor/src/models/AiAssistant/authoring/partial';

/** A realistic submit payload as the model would stream it. */
const FULL_ARGS = JSON.stringify({
  nodes: [
    { id: 'root', type: 'Group', x: 100, y: 60, parameters: { flexDirection: 'column' } },
    {
      id: 'title',
      type: 'Text',
      parent: 'root',
      label: 'Title with "quotes" and {braces} and [brackets]',
      parameters: { text: 'Customers, e.g. \\ escaped' }
    },
    {
      id: 'in',
      type: 'Component Inputs',
      ports: [{ name: 'Trigger', plug: 'output', type: '*' }]
    }
  ],
  connections: [{ fromId: 'in', fromProperty: 'Trigger', toId: 'title', toProperty: 'text' }],
  visual_roots: ['root'],
  description: 'A page. Note: "nodes": [ appears in this string and must not confuse the scanner.'
});

describe('AIX-002 partial payload scanner', () => {
  it('yields the same result fed whole or one character at a time', () => {
    const oneShot = new PartialPayloadScanner().update(FULL_ARGS);

    const charByChar = new PartialPayloadScanner();
    let last: ReturnType<PartialPayloadScanner['update']> | undefined;
    for (let i = 1; i <= FULL_ARGS.length; i++) {
      last = charByChar.update(FULL_ARGS.slice(0, i));
    }

    expect(oneShot.nodes).toEqual(last!.nodes);
    expect(oneShot.connections).toEqual(last!.connections);
    expect(oneShot.nodes.map((n) => n.id)).toEqual(['root', 'title', 'in']);
    expect(oneShot.connections.length).toBe(1);
  });

  it('yields each node the moment its brace closes, not before', () => {
    const scanner = new PartialPayloadScanner();
    const firstNodeEnd = FULL_ARGS.indexOf('}') + 1; // end of parameters of node 1? No — first '}' closes parameters.

    // Feed up to just inside the first node: nothing complete yet.
    const early = scanner.update(FULL_ARGS.slice(0, FULL_ARGS.indexOf('"title"')));
    expect(early.nodes.length).toBeLessThanOrEqual(1);

    // By the time the second node's object closes, two nodes exist.
    const secondClose = FULL_ARGS.indexOf('"in"');
    const mid = scanner.update(FULL_ARGS.slice(0, secondClose));
    expect(mid.nodes.map((n) => n.id)).toEqual(['root', 'title']);
    expect(mid.connections.length).toBe(0);

    const done = scanner.update(FULL_ARGS);
    expect(done.nodes.length).toBe(3);
    expect(done.connections.length).toBe(1);
    expect(firstNodeEnd).toBeGreaterThan(0);
  });

  it('reports changed only when new elements completed', () => {
    const scanner = new PartialPayloadScanner();
    const cut = FULL_ARGS.indexOf('"title"');
    const first = scanner.update(FULL_ARGS.slice(0, cut));
    expect(first.changed).toBe(true); // the root node completed
    const second = scanner.update(FULL_ARGS.slice(0, cut + 3));
    expect(second.changed).toBe(false);
  });

  it('ignores nodes/connections keys that are not at the payload root', () => {
    const args = JSON.stringify({
      nodes: [{ id: 'a', type: 'Group', parameters: { nodes: [{ id: 'fake', type: 'X' }], connections: [{}] } }],
      connections: []
    });
    const result = new PartialPayloadScanner().update(args);
    expect(result.nodes.map((n) => n.id)).toEqual(['a']);
    expect(result.connections.length).toBe(0);
  });

  it('skips a malformed element and keeps capturing after it', () => {
    // Hand-built text: the second element has a naked identifier — JSON.parse fails.
    const args = '{"nodes": [{"id": "a", "type": "Group"}, {"id": b}, {"id": "c", "type": "Text"}]}';
    const result = new PartialPayloadScanner().update(args);
    expect(result.nodes.map((n) => n.id)).toEqual(['a', 'c']);
  });

  it('drops nodes without a type and connections missing endpoints', () => {
    const args = JSON.stringify({
      nodes: [{ id: 'no-type' }, { id: 'ok', type: 'Group' }],
      connections: [{ fromId: 'x', fromProperty: 'y' }, { fromId: 'a', fromProperty: 'p', toId: 'b', toProperty: 'q' }]
    });
    const result = new PartialPayloadScanner().update(args);
    expect(result.nodes.map((n) => n.id)).toEqual(['ok']);
    expect(result.connections).toEqual([{ fromId: 'a', fromProperty: 'p', toId: 'b', toProperty: 'q' }]);
  });

  it('never throws on truncation anywhere in the text', () => {
    for (let i = 0; i <= FULL_ARGS.length; i += 7) {
      expect(() => new PartialPayloadScanner().update(FULL_ARGS.slice(0, i))).not.toThrow();
    }
  });
});
