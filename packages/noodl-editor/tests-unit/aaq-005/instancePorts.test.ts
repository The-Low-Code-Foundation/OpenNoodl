/**
 * AAQ-005 — `checkInstancePorts`, the fifth precondition check.
 *
 * The calibration numbers asserted in prose here were measured, not assumed: over
 * the 96 real projects in the corpus there are 1483 declared instance ports and
 * 1483 of them carry a `plug`, and three values occur — `input` (512), `output`
 * (879) and `input/output` (92). That last one is why this spec exists in the
 * shape it does: a check that recognised only `input`/`output` would have flagged
 * 92 legitimate ports, and the corpus is what says so.
 */

import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { checkInstancePorts } from '../../src/editor/src/validation/instancePorts';
import type { PortDeclaringNode } from '../../src/editor/src/validation/instancePorts';

const COMPONENT = '/Pages/Settings';

function check(nodes: PortDeclaringNode[]) {
  return checkInstancePorts(nodes, { component: COMPONENT });
}

describe('checkInstancePorts — a port with no plug is inert', () => {
  it('reports a declared port with no plug', () => {
    const diagnostics = check([{ id: 'in', type: 'Component Inputs', ports: [{ name: 'Title', type: '*' }] }]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(DiagnosticCode.PortWithoutPlug);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].location).toEqual({
      component: COMPONENT,
      nodeId: 'in',
      nodeType: 'Component Inputs',
      port: 'Title'
    });
    expect(diagnostics[0].message).toContain('no "plug"');
    expect(diagnostics[0].suggestion).toContain('Component Inputs');
  });

  it('says which port, using the node label when it has one', () => {
    const diagnostics = check([
      { id: 'in', type: 'Component Inputs', label: 'Card inputs', ports: [{ name: 'Title' }] }
    ]);
    expect(diagnostics[0].message).toContain('"Card inputs"');
    expect(diagnostics[0].message).toContain('"Title"');
  });

  it('names an unnamed port rather than saying nothing about it', () => {
    const diagnostics = check([{ id: 'in', type: 'Component Inputs', ports: [{ type: '*' }] }]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('(unnamed)');
    expect(diagnostics[0].location.port).toBeUndefined();
  });

  it('reports one diagnostic per offending port, across nodes', () => {
    const diagnostics = check([
      { id: 'in', type: 'Component Inputs', ports: [{ name: 'A' }, { name: 'B', plug: 'output' }, { name: 'C' }] },
      { id: 'out', type: 'Component Outputs', ports: [{ name: 'Done' }] }
    ]);
    expect(diagnostics.map((d) => d.location.port)).toEqual(['A', 'C', 'Done']);
  });
});

describe('checkInstancePorts — what it must not flag', () => {
  for (const plug of ['input', 'output', 'input/output']) {
    it(`accepts plug "${plug}" — a value real projects use`, () => {
      expect(check([{ id: 'in', type: 'Component Inputs', ports: [{ name: 'Title', plug }] }])).toEqual([]);
    });
  }

  it('accepts a node with no ports at all', () => {
    expect(check([{ id: 'g', type: 'Group' }])).toEqual([]);
  });

  it('accepts an empty ports array', () => {
    expect(check([{ id: 'g', type: 'Group', ports: [] }])).toEqual([]);
  });

  it('skips a non-array ports value rather than throwing on it', () => {
    // Model output. `buildCandidate` already reports this as a shape error, and
    // iterating it here would throw out of the session — the one failure mode the
    // repair loop is built not to have.
    const nodes = [{ id: 'g', type: 'Group', ports: { name: 'Label' } as never }] as unknown as PortDeclaringNode[];
    expect(() => checkInstancePorts(nodes, { component: COMPONENT })).not.toThrow();
    expect(checkInstancePorts(nodes, { component: COMPONENT })).toEqual([]);
  });

  it('skips a null entry inside the ports array', () => {
    const nodes = [{ id: 'g', type: 'Group', ports: [null] }] as unknown as PortDeclaringNode[];
    expect(checkInstancePorts(nodes, { component: COMPONENT })).toEqual([]);
  });
});

describe('checkInstancePorts — a plug that is not a direction', () => {
  it('reports a plug the port filter cannot match', () => {
    // `getPorts` does `p.plug.indexOf(filter) !== -1`, so "in" matches neither
    // "input" nor "output" and behaves exactly like an absent plug.
    const diagnostics = check([{ id: 'in', type: 'Component Inputs', ports: [{ name: 'Title', plug: 'in' }] }]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('plug "in", which is not a direction');
  });

  it('reports a non-string plug', () => {
    const nodes = [
      { id: 'in', type: 'Component Inputs', ports: [{ name: 'Title', plug: true }] }
    ] as unknown as PortDeclaringNode[];
    expect(checkInstancePorts(nodes, { component: COMPONENT })).toHaveLength(1);
  });
});

describe('checkInstancePorts — severity is the caller’s', () => {
  it('defaults to error and can be overridden', () => {
    const nodes: PortDeclaringNode[] = [{ id: 'in', type: 'Component Inputs', ports: [{ name: 'Title' }] }];
    expect(checkInstancePorts(nodes, { component: COMPONENT })[0].severity).toBe('error');
    expect(checkInstancePorts(nodes, { component: COMPONENT, severity: 'warning' })[0].severity).toBe('warning');
  });
});
