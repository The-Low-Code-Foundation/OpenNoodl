/**
 * VIB-007 / register **V22** — the component-interface port that is wired and never declared.
 *
 * 🔴 **The behaviour under test was ruled by a render, not by reading the source.**
 * `packages/nodegx-backend/tests/vib007-v22.look.ts` draws two components identical but for the
 * `ports` array, each under a `For Each` over three records: the declared arm renders its records'
 * values, the undeclared arm renders its own placeholder three times, at all four widths. This
 * spec encodes what that render established; it does not re-argue it.
 *
 * ⚠️ **The corpus check is a MUTATION, not a census.** Asserting "the corpus is clean" would pass
 * just as happily against a check that returns `[]` for every input — the exact hole this family
 * keeps finding. So the corpus test removes a port that the repair added and requires the gate to
 * red on that file *and only that file*.
 */
import * as fs from 'fs';
import * as path from 'path';

import { checkUndeclaredComponentPorts } from '../../src/editor/src/validation';

const REPO = path.join(__dirname, '..', '..', '..', '..');
const EXAMPLES = path.join(REPO, 'docs', 'node-catalog', 'examples');

const ROW = { id: 'row', type: 'Group' };
const TEXT = { id: 'label_text', type: 'Text' };
const WIRE = [{ fromId: 'row_inputs', fromProperty: 'title', toId: 'label_text', toProperty: 'text' }];

describe('V22 — a Component Inputs port with a connection and no declaration', () => {
  it('reports the undeclared port, and says what to add', () => {
    const d = checkUndeclaredComponentPorts(
      [ROW, TEXT, { id: 'row_inputs', type: 'Component Inputs', label: 'Item in' }],
      WIRE,
      { component: '/Rows/Undeclared' }
    );
    expect(d).toHaveLength(1);
    expect(d[0].code).toBe('undeclared-component-port');
    expect(d[0].severity).toBe('error');
    expect(d[0].location.port).toBe('title');
    expect(d[0].suggestion).toContain('"plug": "output"');
    // The repeater half of the message is the half a reader needs: all 15 corpus hits were
    // repeater item components, and "an instance parameter is discarded" alone reads as
    // not-my-case to someone who places no instances by hand.
    expect(d[0].message).toMatch(/Repeater/);
  });

  it('is silent once the port is declared — the control the render supplied', () => {
    const d = checkUndeclaredComponentPorts(
      [ROW, TEXT, { id: 'row_inputs', type: 'Component Inputs', ports: [{ name: 'title', plug: 'output' }] }],
      WIRE,
      { component: '/Rows/Declared' }
    );
    expect(d).toEqual([]);
  });

  it('measures wired-minus-declared, not "has no ports array"', () => {
    // A node declaring two of the three ports it wires is the same defect for the third. The
    // narrower predicate — which is the one the register row's own wording suggests — calls
    // this clean.
    const d = checkUndeclaredComponentPorts(
      [
        {
          id: 'row_inputs',
          type: 'Component Inputs',
          ports: [
            { name: 'title', plug: 'output' },
            { name: 'subtitle', plug: 'output' }
          ]
        }
      ],
      [
        { fromId: 'row_inputs', fromProperty: 'title', toId: 'a', toProperty: 'text' },
        { fromId: 'row_inputs', fromProperty: 'subtitle', toId: 'b', toProperty: 'text' },
        { fromId: 'row_inputs', fromProperty: 'badge', toId: 'c', toProperty: 'text' }
      ],
      { component: '/c' }
    );
    expect(d.map((x) => x.location.port)).toEqual(['badge']);
  });

  it('covers Component Outputs, reading the other end of the connection', () => {
    const d = checkUndeclaredComponentPorts(
      [{ id: 'outs', type: 'Component Outputs' }],
      [{ fromId: 'fn', fromProperty: 'success', toId: 'outs', toProperty: 'success' }],
      { component: '/c' }
    );
    expect(d).toHaveLength(1);
    expect(d[0].suggestion).toContain('"plug": "input"');
  });

  it('says nothing about a node that is not an interface node', () => {
    // Every OTHER node's ports are the node type's business. A check that fired on a Text node
    // wired into a port it does not declare would fire on the whole graph.
    expect(
      checkUndeclaredComponentPorts([{ id: 'g', type: 'Group' }], [{ fromId: 'g', fromProperty: 'x', toId: 'y', toProperty: 'z' }], {
        component: '/c'
      })
    ).toEqual([]);
  });

  it('says nothing about an interface node with no connections at all', () => {
    // An interface node someone has dropped on the canvas and not wired yet is not a defect.
    expect(
      checkUndeclaredComponentPorts([{ id: 'row_inputs', type: 'Component Inputs' }], [], { component: '/c' })
    ).toEqual([]);
  });
});

describe('V22 — the corpus, by mutation', () => {
  type Example = {
    id: string;
    components: { name: string; nodes: { id: string; type: string; ports?: { name: string; plug?: string }[] }[]; connections?: [] }[];
  };

  const load = (): { file: string; example: Example }[] =>
    fs
      .readdirSync(EXAMPLES)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((file) => ({ file, example: JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), 'utf-8')) }));

  const sweep = (examples: { file: string; example: Example }[]) => {
    const hits: string[] = [];
    for (const { file, example } of examples) {
      for (const c of example.components ?? []) {
        const d = checkUndeclaredComponentPorts(c.nodes ?? [], c.connections ?? [], { component: c.name });
        if (d.length) hits.push(`${file}:${c.name}:${d.length}`);
      }
    }
    return hits;
  };

  it('is clean — and the population is asserted, so an empty read is not mistaken for a pass', () => {
    const examples = load();
    // 🔴 Cardinality before the verdict. A `readdirSync` pointed at the wrong directory returns
    // [], and `sweep([])` is [] — the answer this test wants, for the wrong reason.
    expect(examples.length).toBeGreaterThanOrEqual(67);
    const interfaceNodes = examples.flatMap(({ example }) =>
      (example.components ?? []).flatMap((c) => (c.nodes ?? []).filter((n) => n.type === 'Component Inputs' || n.type === 'Component Outputs'))
    );
    expect(interfaceNodes.length).toBeGreaterThanOrEqual(30);

    expect(sweep(examples)).toEqual([]);
  });

  it('reddens when the repair is undone on ONE file, and only that file', () => {
    const examples = load();
    const subject = 'data-static-array-filter-repeater.json';
    const target = examples.find((e) => e.file === subject)!;
    const node = target.example.components
      .flatMap((c) => c.nodes)
      .find((n) => n.id === 'row_inputs' && n.type === 'Component Inputs')!;

    // The mutation IS the pre-repair corpus: this file shipped `row_inputs` with no ports and a
    // connection out of `row_inputs.label`, and passed this gate 67/67 strict.
    expect(node.ports).toEqual([{ name: 'label', plug: 'output', type: '*' }]);
    delete node.ports;

    expect(sweep(examples)).toEqual([`${subject}:/Product Row:1`]);
  });
});
