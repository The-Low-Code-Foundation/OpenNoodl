/**
 * LEG-004's acceptance criteria, as a suite.
 *
 * Every test here is written against the *rendered text*, because that is what
 * git diffs. Three of them are worded as "produces no diff" / "one line": those
 * compare two renderings line by line, which is the same question git's line
 * differ asks.
 */

'use strict';

const { renderGraphText } = require('./renderGraph');

const NODES = {
  $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
  componentId: 'c_checkout',
  version: 1,
  nodes: [
    {
      id: 'grp',
      type: 'Group',
      label: 'Order summary',
      x: 40,
      y: 40,
      parameters: { width: { value: 100, unit: '%' }, paddingTop: 8 },
      children: ['btn', 'txt']
    },
    { id: 'btn', type: 'Button', label: 'Submit Order', parent: 'grp', x: 60, y: 200, parameters: { label: 'Submit' } },
    { id: 'txt', type: 'Text', label: 'Total', parent: 'grp', x: 60, y: 300, parameters: { text: '0.00' } }
  ],
  visualRoots: ['grp']
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function render(doc, options) {
  return renderGraphText(JSON.stringify(doc, null, 2), options);
}

/** The lines git would mark `-` or `+`, as a count of changed line pairs. */
function changedLines(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  const removed = a.filter((line) => !b.includes(line));
  const added = b.filter((line) => !a.includes(line));
  return { removed, added };
}

describe('LEG-004 textconv rendering', () => {
  it('names nodes, their labels and their ports', () => {
    const doc = clone(NODES);
    doc.nodes[1].ports = [
      { name: 'onClick', plug: 'output', type: 'signal' },
      { name: 'label', plug: 'input', type: 'string' }
    ];
    const text = render(doc);
    expect(text).toContain('Group ~grp "Order summary"');
    expect(text).toContain('Button ~btn "Submit Order"');
    expect(text).toContain('Button ~btn · ports["onClick"].plug = "output"');
    expect(text).toContain('Button ~btn · ports["label"].type = "string"');
  });

  it('renames a label in exactly one line', () => {
    const before = render(NODES);
    const doc = clone(NODES);
    doc.nodes[0].label = 'Order summary v2';
    const { removed, added } = changedLines(before, render(doc));
    expect(removed).toEqual(['  Group ~grp "Order summary"']);
    expect(added).toEqual(['  Group ~grp "Order summary v2"']);
  });

  it('renames a label of a node with many parameters in exactly one line', () => {
    // The case a renderer that repeats the label in every line's prefix fails.
    const doc = clone(NODES);
    doc.nodes[0].parameters = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };
    const before = render(doc);
    doc.nodes[0].label = 'Renamed';
    const { removed, added } = changedLines(before, render(doc));
    expect(removed).toHaveLength(1);
    expect(added).toHaveLength(1);
  });

  it('produces no diff when a node moves on the canvas', () => {
    const doc = clone(NODES);
    doc.nodes[0].x = 900;
    doc.nodes[0].y = -120;
    expect(render(doc)).toBe(render(NODES));
  });

  it('produces no diff when the nodes array is reordered', () => {
    const doc = clone(NODES);
    doc.nodes.reverse();
    expect(render(doc)).toBe(render(NODES));
  });

  it('produces no diff when a parameter object is re-keyed in a different order', () => {
    const doc = clone(NODES);
    doc.nodes[0].parameters = { paddingTop: 8, width: { unit: '%', value: 100 } };
    expect(render(doc)).toBe(render(NODES));
  });

  it('keeps the authored child order and shows a reorder', () => {
    const doc = clone(NODES);
    doc.nodes[0].children = ['txt', 'btn'];
    const text = render(doc);
    expect(text.indexOf('Text ~txt')).toBeLessThan(text.indexOf('Button ~btn'));
    expect(text).not.toBe(render(NODES));
  });

  it('changes one line per changed parameter', () => {
    const before = render(NODES);
    const doc = clone(NODES);
    doc.nodes[0].parameters.paddingTop = 24;
    const { removed, added } = changedLines(before, render(doc));
    expect(removed).toEqual(['  Group ~grp · paddingTop = 8']);
    expect(added).toEqual(['  Group ~grp · paddingTop = 24']);
  });

  it('splits a multi-line code parameter so one edited line is one changed line', () => {
    const doc = clone(NODES);
    doc.nodes[1].parameters.functionScript = 'const a = 1;\nconst b = 2;\nOutputs.C = a + b;\n';
    const before = render(doc);
    doc.nodes[1].parameters.functionScript = 'const a = 1;\nconst b = 3;\nOutputs.C = a + b;\n';
    const { removed, added } = changedLines(before, render(doc));
    expect(removed).toHaveLength(1);
    expect(added).toHaveLength(1);
    expect(added[0]).toContain('functionScript | const b = 3;');
  });

  it('sorts connections and never invents a name it cannot know', () => {
    const text = renderGraphText(
      JSON.stringify({
        componentId: 'c_checkout',
        version: 1,
        connections: [
          { fromId: 'txt', fromProperty: 'a', toId: 'grp', toProperty: 'b' },
          { fromId: 'btn', fromProperty: 'onClick', toId: 'nav', toProperty: 'navigate' }
        ]
      })
    );
    const lines = text.trim().split('\n');
    expect(lines[2]).toBe('  ~btn.onClick → ~nav.navigate');
    expect(lines[3]).toBe('  ~txt.a → ~grp.b');
  });

  it('renders a component file without its save stamp', () => {
    const text = renderGraphText(
      JSON.stringify({
        $schema: 's',
        id: 'c_checkout',
        name: 'Checkout',
        path: '/Pages/Checkout',
        type: 'visual',
        modified: '2026-08-11T09:00:00.000Z'
      })
    );
    expect(text).toContain('component /Pages/Checkout');
    expect(text).not.toContain('modified');
  });

  it('falls through to the raw bytes for a partially written file', () => {
    const truncated = JSON.stringify(NODES).slice(0, 120);
    expect(renderGraphText(truncated)).toBe(truncated);
  });

  it('falls through to the raw bytes for JSON that is not a graph file', () => {
    const other = '{"hello":"world"}';
    expect(renderGraphText(other)).toBe(other);
  });

  it('never throws, whatever the shape', () => {
    const shapes = ['', 'null', '[]', '{"nodes":null}', '{"nodes":[null,1,"x"]}', '{"components":[{}]}'];
    for (const shape of shapes) expect(() => renderGraphText(shape)).not.toThrow();
  });

  it('uses a display name when one is supplied and the raw type when it is not', () => {
    const doc = clone(NODES);
    doc.nodes[0].type = 'net.noodl.visual.columns';
    expect(render(doc, { displayName: (t) => (t === 'net.noodl.visual.columns' ? 'Columns' : undefined) })).toContain(
      'Columns ~grp'
    );
    expect(render(doc)).toContain('net.noodl.visual.columns ~grp');
  });

  it('survives a display name provider that throws', () => {
    expect(() =>
      render(NODES, {
        displayName: () => {
          throw new Error('catalog missing');
        }
      })
    ).not.toThrow();
  });

  it('renders a legacy monolithic project with the component on every line', () => {
    const text = renderGraphText(
      JSON.stringify({
        name: 'Demo',
        components: [
          {
            name: '/App',
            id: 'c_app',
            graph: {
              roots: [{ id: 'r', type: 'Router', label: 'Main', x: 1, y: 2, parameters: { name: 'Main' } }],
              connections: []
            }
          }
        ]
      })
    );
    expect(text).toContain('component /App');
    expect(text).toContain('  /App · Router ~r "Main"');
    expect(text).toContain('  /App · Router ~r · name = "Main"');
  });
});
