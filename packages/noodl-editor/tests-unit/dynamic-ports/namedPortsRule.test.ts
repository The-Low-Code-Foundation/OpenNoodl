/**
 * WFA-009 — value-derived ports, graded against the **committed** node library.
 *
 * The behaviour under test is the one F27 is about: *typing a name into a
 * Response node's `params` makes an input port of that name appear, with no
 * backend running*. It is asserted here over `cloud-node-library.json` — the
 * generated artifact the editor actually serves — rather than over a fixture,
 * so a regeneration that dropped the rule fails this suite rather than passing
 * it against a hand-written copy of what the rule used to say.
 *
 * What is NOT here: the adapter that calls `setDynamicPorts` when a parameter
 * changes. It reaches `ProjectModel`, so it belongs to the jasmine-in-Electron
 * suite; see WFA-009-NOTES.md for what that leaves unverified.
 */
import library from '../../src/editor/src/models/nodelibrary/cloud-node-library.json';
import {
  generatedPortsForNode,
  namesFromListParameter,
  typeGeneratesNamedPorts
} from '../../src/editor/src/models/nodelibrary/dynamicPortRules';

interface LibraryType {
  name: string;
  dynamicports?: unknown[];
}

function nodeType(name: string): LibraryType {
  const type = (library.nodetypes as LibraryType[]).find((t) => t.name === name);
  if (!type) throw new Error(`${name} is not in the committed cloud node library`);
  return type;
}

/** A node as the rule reads one: a type, and the parameters an author has set. */
function nodeOfType(name: string, parameters: Record<string, unknown>) {
  return {
    type: nodeType(name),
    parameters,
    getParameter: (p: string) => parameters[p]
  };
}

const portNames = (parameters: Record<string, unknown>, type = 'noodl.cloud.response') =>
  generatedPortsForNode(nodeOfType(type, parameters)).map((p) => p.name);

describe('WFA-009: a Response node offers a port per response parameter', () => {
  it('has none before anything is typed', () => {
    expect(portNames({})).toEqual([]);
  });

  it('offers one input to fill in as soon as a name is typed', () => {
    const ports = generatedPortsForNode(nodeOfType('noodl.cloud.response', { params: 'total' }));
    expect(ports).toEqual([
      { name: 'pm-total', displayName: 'total', type: '*', plug: 'input', group: 'Parameters' }
    ]);
  });

  it('changing the value changes the ports — added, removed, reordered', () => {
    expect(portNames({ params: 'id' })).toEqual(['pm-id']);
    expect(portNames({ params: 'id,total' })).toEqual(['pm-id', 'pm-total']);
    expect(portNames({ params: 'total' })).toEqual(['pm-total']);
    expect(portNames({ params: 'total,id' })).toEqual(['pm-total', 'pm-id']);
    expect(portNames({ params: '' })).toEqual([]);
  });

  it('answers with an error instead, and the parameters are no longer on offer', () => {
    expect(portNames({ params: 'id,total', status: 'failure' })).toEqual([]);
    expect(portNames({ params: 'id,total', status: 'success' })).toEqual(['pm-id', 'pm-total']);
    // Unset means success — the node's own default, and the condition says so.
    expect(portNames({ params: 'id,total' })).toEqual(['pm-id', 'pm-total']);
  });
});

describe('WFA-009: a Request node offers a port per request parameter', () => {
  /** The value ports only — CWF-014 added three declaration rows beside each. */
  const valuePorts = (parameters: Record<string, unknown>) =>
    portNames(parameters, 'noodl.cloud.request').filter((n) => n.startsWith('pm-'));

  it('offers an output to read, not an input to fill', () => {
    const ports = generatedPortsForNode(nodeOfType('noodl.cloud.request', { params: 'total' }));
    expect(ports[0]).toEqual({
      name: 'pm-total',
      displayName: 'total',
      type: '*',
      plug: 'output',
      group: 'Parameters'
    });
  });

  it('changing the value changes the ports', () => {
    expect(valuePorts({ params: 'a,b' })).toEqual(['pm-a', 'pm-b']);
    expect(valuePorts({ params: 'b' })).toEqual(['pm-b']);
  });

  it('is not conditioned on anything — a Request has no status to answer with', () => {
    expect(valuePorts({ params: 'a', status: 'failure' })).toEqual(['pm-a']);
  });

  /**
   * CWF-014 — the declaration rows, read off the same committed library the
   * editor serves. Four rules over one parameter, rule-major, which is the order
   * `request.ts`'s `setup()` has to reproduce (see the parity suite).
   */
  it('CWF-014: offers a Type, Required and Default row beside every value port', () => {
    expect(portNames({ params: 'id,total' }, 'noodl.cloud.request')).toEqual([
      'pm-id',
      'pm-total',
      'ptype-id',
      'ptype-total',
      'preq-id',
      'preq-total',
      'pdef-id',
      'pdef-total'
    ]);
  });

  it('CWF-014: a declared type reaches the value port, and never leaks the rule that put it there', () => {
    const [value, typeRow] = generatedPortsForNode(
      nodeOfType('noodl.cloud.request', { params: 'total', 'ptype-total': 'number' })
    );
    expect(value.type).toBe('number');
    expect(value).not.toHaveProperty('typeFromParameter');
    // The picker itself is an ordinary enum port, which is why this needed no
    // new property-editor control.
    expect((typeRow.type as { name: string }).name).toBe('enum');
  });

  it('CWF-014: an undeclared parameter is `*`, which is every function written before the task', () => {
    const [value] = generatedPortsForNode(nodeOfType('noodl.cloud.request', { params: 'total' }));
    expect(value.type).toBe('*');
  });
});

describe('WFA-009: which types the mechanism claims', () => {
  it('claims the two cloud nodes whose ports come from a list', () => {
    expect(typeGeneratesNamedPorts(nodeType('noodl.cloud.response'))).toBe(true);
    expect(typeGeneratesNamedPorts(nodeType('noodl.cloud.request'))).toBe(true);
  });

  it('claims nothing else — a node with only conditionalports is untouched', () => {
    // Aggregate Records' ports come from a database schema, not a list, so it is
    // deliberately out (WFA-009-ASSESSMENT.md §3). `sendemail` has no rule either.
    expect(typeGeneratesNamedPorts(nodeType('noodl.cloud.aggregate'))).toBe(false);
    expect(typeGeneratesNamedPorts(nodeType('noodl.cloud.sendemail'))).toBe(false);

    // A snapshot of who uses the mechanism, so a rule that starts matching by
    // accident fails here. It grows when a node adopts it deliberately —
    // CWF-015's user nodes did, and that is a diff worth reading, not a leak.
    const claimed = (library.nodetypes as LibraryType[]).filter((t) => typeGeneratesNamedPorts(t)).map((t) => t.name);
    expect(claimed.sort()).toEqual([
      'noodl.cloud.createuser',
      'noodl.cloud.request',
      'noodl.cloud.response',
      'noodl.cloud.updateuser'
    ]);
  });

  it('generates nothing for a type with no rule, however its parameters are set', () => {
    expect(portNames({ params: 'a,b' }, 'noodl.cloud.aggregate')).toEqual([]);
  });
});

describe('WFA-009: reading the list the way the rest of the editor does', () => {
  it('is `decodeStringList` — split on commas, drop the empties, do not trim', () => {
    expect(namesFromListParameter(undefined)).toEqual([]);
    expect(namesFromListParameter('')).toEqual([]);
    expect(namesFromListParameter('a')).toEqual(['a']);
    expect(namesFromListParameter('a,b')).toEqual(['a', 'b']);
    expect(namesFromListParameter('a,,b')).toEqual(['a', 'b']);
    expect(namesFromListParameter('a,b,')).toEqual(['a', 'b']);
    // A name may contain a space; the property panel refuses commas, not spaces.
    expect(namesFromListParameter('order id')).toEqual(['order id']);
  });

  it('also reads an array, in case a list ever arrives as one', () => {
    expect(namesFromListParameter(['a', 'b'])).toEqual(['a', 'b']);
    expect(namesFromListParameter([])).toEqual([]);
  });

  it('collapses a repeat rather than offering the same port twice', () => {
    expect(portNames({ params: 'a,a,b' })).toEqual(['pm-a', 'pm-b']);
  });
});
