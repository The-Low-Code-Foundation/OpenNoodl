/**
 * SUB-007: three-way merge semantics. Includes parity scenarios ported from
 * tests/projectmerger/projectmerger.js and the deliberate improvements over
 * the legacy merger (explicit conflicts where legacy silently picked ours).
 */

import {
  applyResolution,
  connectionKey,
  mergeGraphs,
  mergeProjectSnapshots,
  resolveAll
} from '../../src/editor/src/versioning';
import { checkInvariants, comp, conn, node } from './helpers';

describe('GraphMerge', () => {
  it('merges disjoint edits to the same node automatically', () => {
    const base = comp([node('a', 'Text', { label: 'old', parameters: { text: 'x' } })]);
    const ours = comp([node('a', 'Text', { label: 'new', parameters: { text: 'x' } })]);
    const theirs = comp([node('a', 'Text', { label: 'old', parameters: { text: 'y' } })]);
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(conflicts).toEqual([]);
    const nodeA = merged.nodes.get('a');
    expect(nodeA.label).toBe('new');
    expect(nodeA.parameters.text).toBe('y');
  });

  it('raises a parameter conflict when both sides change the same value (legacy parity)', () => {
    const base = comp([node('a', 'Text', { parameters: { p1: 'some-string', p3: 'delete-me' } })]);
    const ours = comp([node('a', 'Text', { parameters: { p1: 'changed', p2: 'added-string', p3: 'delete-me' } })]);
    const theirs = comp([node('a', 'Text', { parameters: { p1: 10 } })]);
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].kind).toBe('parameter');
    expect(conflicts[0].name).toBe('p1');
    expect(conflicts[0].ours).toBe('changed');
    expect(conflicts[0].theirs).toBe(10);
    const nodeA = merged.nodes.get('a');
    expect(nodeA.parameters.p1).toBe('changed'); // ours-flavored while unresolved
    expect(nodeA.parameters.p2).toBe('added-string');
    expect('p3' in nodeA.parameters).toBe(false); // theirs' delete applied
  });

  it('applies a resolution choice', () => {
    const base = comp([node('a', 'Text', { parameters: { p: 1 } })]);
    const ours = comp([node('a', 'Text', { parameters: { p: 2 } })]);
    const theirs = comp([node('a', 'Text', { parameters: { p: 3 } })]);
    const result = mergeGraphs(base, ours, theirs);
    applyResolution(result, result.conflicts[0].id, 'theirs');
    expect(result.merged.nodes.get('a').parameters.p).toBe(3);
    expect(result.conflicts[0].resolution).toBe('theirs');
  });

  it('takes the remote position when only they moved a node (legacy parity)', () => {
    const base = comp([node('a', 'Group', { x: 0, y: 0 })]);
    const ours = comp([node('a', 'Group', { x: 0, y: 0 })]);
    const theirs = comp([node('a', 'Group', { x: 123, y: 456 })]);
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(conflicts).toEqual([]);
    expect(merged.nodes.get('a').x).toBe(123);
    expect(merged.nodes.get('a').y).toBe(456);
  });

  it('lets a deletion win over a purely cosmetic move (legacy parity)', () => {
    const base = comp([node('a', 'Group', { x: 0, y: 0 }), node('b', 'Group')]);
    const ours = comp([node('a', 'Group', { x: 50, y: 50 }), node('b', 'Group')]);
    const theirs = comp([node('b', 'Group')]);
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(conflicts).toEqual([]);
    expect(merged.nodes.has('a')).toBe(false);
  });

  it('raises delete-vs-edit instead of silently keeping an edited node (improvement)', () => {
    const base = comp([node('a', 'Text', { parameters: { text: 'x' } }), node('b', 'Group')]);
    const ours = comp([node('a', 'Text', { parameters: { text: 'edited' } }), node('b', 'Group')]);
    const theirs = comp([node('b', 'Group')]);
    const result = mergeGraphs(base, ours, theirs);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].kind).toBe('delete-vs-edit');
    expect(result.conflicts[0].deletedBy).toBe('theirs');
    // Ours-flavored: the edited node survives until resolved.
    expect(result.merged.nodes.has('a')).toBe(true);
    applyResolution(result, result.conflicts[0].id, 'theirs');
    expect(result.merged.nodes.has('a')).toBe(false);
  });

  it('keeps a deletion when we deleted and they edited, restorable via resolution', () => {
    const base = comp([node('a', 'Text', { parameters: { text: 'x' } }), node('b', 'Group')]);
    const ours = comp([node('b', 'Group')]);
    const theirs = comp([node('a', 'Text', { parameters: { text: 'edited' } }), node('b', 'Group')]);
    const result = mergeGraphs(base, ours, theirs);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].kind).toBe('delete-vs-edit');
    expect(result.conflicts[0].deletedBy).toBe('ours');
    expect(result.merged.nodes.has('a')).toBe(false);
    applyResolution(result, result.conflicts[0].id, 'theirs');
    expect(result.merged.nodes.get('a').parameters.text).toBe('edited');
  });

  it('merges same-id nodes added on both sides, conflicting on differing parameters (legacy parity)', () => {
    const base = comp([node('a', 'Group')]);
    const ours = comp([node('a', 'Group'), node('b', 'Text', { parameters: { p: 'ours' } })]);
    const theirs = comp([node('a', 'Group'), node('b', 'Text', { parameters: { p: 'theirs' } })]);
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(merged.nodes.has('b')).toBe(true);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].kind).toBe('parameter');
    expect(conflicts[0].node.id).toBe('b');
  });

  it('keeps identical both-side additions without conflict (legacy parity)', () => {
    const base = comp([node('a', 'Group')]);
    const ours = comp([node('a', 'Group'), node('b', 'Text', { parameters: { p: 1 } })]);
    const theirs = comp([node('a', 'Group'), node('b', 'Text', { parameters: { p: 1 } })]);
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(conflicts).toEqual([]);
    expect(merged.nodes.get('b').parameters.p).toBe(1);
  });

  it('raises add-add when both sides added the same id with different types', () => {
    const base = comp([]);
    const ours = comp([node('x', 'Text')]);
    const theirs = comp([node('x', 'Group')]);
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].kind).toBe('add-add');
    expect(merged.nodes.get('x').type).toBe('Text');
  });

  it('raises typename conflict when both sides changed a node type (legacy parity)', () => {
    const base = comp([node('a', '0')]);
    const ours = comp([node('a', '1')]);
    const theirs = comp([node('a', '2')]);
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].kind).toBe('typename');
    expect(merged.nodes.get('a').type).toBe('1');
  });

  it('merges independent connection edits (legacy parity scenario)', () => {
    const nodes = [node('A', '0'), node('B', '0'), node('C', '0')];
    const base = comp(nodes, [conn('A', '0', 'B', '1')]);
    const ours = comp(nodes, [conn('A', '0', 'C', '1')]); // removed A-B, added A-C
    const theirs = comp(nodes, [conn('A', '0', 'B', '1'), conn('A', '0', 'B', '2')]); // added A-B:2
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(conflicts).toEqual([]);
    const keys = merged.connections.map(connectionKey).sort();
    expect(keys).toEqual(['A:0->B:2', 'A:0->C:1']);
  });

  it('raises a conflict when both sides rewired the same input differently', () => {
    const nodes = [node('a', '0'), node('b', '0'), node('c', '0'), node('d', '0')];
    const base = comp(nodes, [conn('a', 'out', 'c', 'in')]);
    const ours = comp(nodes, [conn('b', 'out', 'c', 'in')]);
    const theirs = comp(nodes, [conn('d', 'out', 'c', 'in')]);
    const result = mergeGraphs(base, ours, theirs);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].kind).toBe('connection-rewire');
    expect(result.merged.connections.map(connectionKey)).toEqual(['b:out->c:in']);
    applyResolution(result, result.conflicts[0].id, 'theirs');
    expect(result.merged.connections.map(connectionKey)).toEqual(['d:out->c:in']);
  });

  it('conflicts on a connection added to a node the other side deleted (improvement over silent drop)', () => {
    const base = comp([node('a', '0'), node('b', '0')]);
    const ours = comp([node('a', '0'), node('b', '0')], [conn('a', '0', 'b', '1')]);
    const theirs = comp([]); // deleted both nodes
    const result = mergeGraphs(base, ours, theirs);
    // Nodes deleted cleanly (unchanged by us); our added connection conflicts.
    expect(result.merged.nodes.size).toBe(0);
    expect(result.merged.connections).toEqual([]);
    const connectionConflicts = result.conflicts.filter((c) => c.kind === 'connection-to-deleted');
    expect(connectionConflicts.length).toBe(1);
    expect(connectionConflicts[0].deletedBy).toBe('theirs');
    // Keeping our wiring restores the endpoint node.
    applyResolution(result, connectionConflicts[0].id, 'ours');
    expect(result.merged.connections.length).toBe(1);
    expect(result.merged.nodes.has('a') || result.merged.nodes.has('b')).toBe(true);
  });

  it('merges source code line-by-line when edits do not overlap', () => {
    // diff3 needs stable context between hunks, so the two edits are separated.
    const script = (a: string, b: string) =>
      `function f() {\n${a}\nconst mid1 = 0;\nconst mid2 = 0;\nconst mid3 = 0;\n${b}\nreturn out;\n}`;
    const withCode = (a: string, b: string) =>
      comp([
        node('f', 'JavaScriptFunction', {
          parameters: { code: script(a, b) },
          metadata: { merge: { soureCodePorts: ['code'] } }
        })
      ]);
    const base = withCode('const a = 1;', 'const b = 2;');
    const ours = withCode('const a = 100;', 'const b = 2;');
    const theirs = withCode('const a = 1;', 'const b = 200;');
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(conflicts).toEqual([]);
    expect(merged.nodes.get('f').parameters.code).toBe(script('const a = 100;', 'const b = 200;'));
  });

  it('keeps conflict markers out of parameter values on source-code conflicts (improvement)', () => {
    const withCode = (line: string) =>
      comp([
        node('f', 'JavaScriptFunction', {
          parameters: { code: line },
          metadata: { merge: { soureCodePorts: ['code'] } }
        })
      ]);
    const base = withCode('return 1;');
    const ours = withCode('return 2;');
    const theirs = withCode('return 3;');
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].kind).toBe('source-code');
    expect(conflicts[0].mergedWithMarkers).toContain('------------- Ours -------------');
    // The merged value is loadable code (ours), not marker soup.
    expect(merged.nodes.get('f').parameters.code).toBe('return 2;');
  });

  it('conflicts on instance ports unless the node already has parameter conflicts', () => {
    const withPort = (type: string) => comp([node('a', 'X', { ports: [{ name: 'A', type }] })]);
    const result = mergeGraphs(withPort('*'), withPort('string'), withPort('number'));
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].kind).toBe('ports');

    const withBoth = (type: string, p: string) =>
      comp([node('a', 'X', { parameters: { p }, ports: [{ name: 'A', type }] })]);
    const suppressed = mergeGraphs(withBoth('*', 'x'), withBoth('string', 'o'), withBoth('number', 't'));
    const kinds = suppressed.conflicts.map((c) => c.kind);
    expect(kinds).toEqual(['parameter']);
  });

  it('merges component metadata additively and conflicts on both-changed leaves', () => {
    const withMeta = (metadata: Record<string, unknown>) => comp([node('a', 'Group')], [], { metadata });
    const base = withMeta({ styles: {} });
    const ours = withMeta({ styles: { colors: { primary: '#111' } } });
    const theirs = withMeta({ styles: { colors: { accent: '#222' } } });
    const { merged, conflicts } = mergeGraphs(base, ours, theirs);
    expect(conflicts).toEqual([]);
    expect(merged.metadata).toEqual({ styles: { colors: { primary: '#111', accent: '#222' } } });

    const clash = mergeGraphs(
      withMeta({ styles: { colors: { primary: '#000' } } }),
      withMeta({ styles: { colors: { primary: '#111' } } }),
      withMeta({ styles: { colors: { primary: '#222' } } })
    );
    expect(clash.conflicts.length).toBe(1);
    expect(clash.conflicts[0].kind).toBe('component-metadata');
    expect(clash.conflicts[0].name).toBe('metadata.styles.colors.primary');
  });

  it('conflicts when both sides renamed the component (legacy TODO fixed)', () => {
    const named = (name: string) => comp([node('a', 'Group')], [], { name });
    const result = mergeGraphs(named('Original'), named('OursName'), named('TheirsName'));
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].kind).toBe('component-rename');
    expect(result.merged.name).toBe('OursName');
    applyResolution(result, result.conflicts[0].id, 'theirs');
    expect(result.merged.name).toBe('TheirsName');
  });

  it('conflicts when both sides reordered the same children differently', () => {
    const ordered = (ids: string[]) => comp([node('g', 'Group', {}, ids.map((id) => node(id, 'Text')))]);
    const result = mergeGraphs(ordered(['a', 'b', 'c']), ordered(['b', 'a', 'c']), ordered(['a', 'c', 'b']));
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0].kind).toBe('child-order');
  });

  it('breaks parent cycles created by cross-side reparents with a conflict', () => {
    const base = comp([node('A', 'Group'), node('B', 'Group')]);
    const ours = comp([node('B', 'Group', {}, [node('A', 'Group')])]);
    const theirs = comp([node('A', 'Group', {}, [node('B', 'Group')])]);
    const result = mergeGraphs(base, ours, theirs);
    expect(result.conflicts.some((c) => c.kind === 'reparent')).toBe(true);
    expect(checkInvariants(result.merged)).toEqual([]);
  });

  it('resolveAll(theirs) is a clean escape hatch', () => {
    const base = comp([node('a', 'Text', { parameters: { p: 1 } }), node('b', 'Group')]);
    const ours = comp([node('a', 'Text', { parameters: { p: 2 } }), node('b', 'Group', { label: 'ours' })]);
    const theirs = comp([node('b', 'Group', { label: 'theirs' })]); // deleted a, renamed b
    const result = mergeGraphs(base, ours, theirs);
    resolveAll(result, 'theirs');
    expect(result.merged.nodes.has('a')).toBe(false);
    expect(result.merged.nodes.get('b').label).toBe('theirs');
    expect(result.conflicts.every((c) => c.resolution === 'theirs')).toBe(true);
    expect(checkInvariants(result.merged)).toEqual([]);
  });

  it('merges projects at component granularity (legacy parity: added and removed)', () => {
    const snap = (name: string) => comp([node(`${name}-n`, 'Group')], [], { name });
    const base = new Map([
      ['comp1', snap('comp1')],
      ['comp3', snap('comp3')]
    ]);
    const ours = new Map([['comp3', comp([node('comp3-n', 'Group'), node('extra', 'Text')], [], { name: 'comp3' })]]);
    const theirs = new Map([
      ['comp1', snap('comp1')],
      ['comp2', snap('comp2')]
    ]);
    const result = mergeProjectSnapshots(base, ours, theirs);
    expect([...result.merged.keys()].sort()).toEqual(['comp2', 'comp3']);
    // Legacy silently kept our edited comp3 over their deletion; we keep it too
    // but surface the disagreement as a component-level conflict.
    expect(result.componentConflicts.length).toBe(1);
    expect(result.componentConflicts[0].name).toBe('comp3');
  });

  it('raises a component-level conflict when one side deleted an edited component', () => {
    const base = new Map([['comp1', comp([node('n', 'Group')], [], { name: 'comp1' })]]);
    const ours = new Map([['comp1', comp([node('n', 'Group', { label: 'edited' })], [], { name: 'comp1' })]]);
    const theirs = new Map();
    const result = mergeProjectSnapshots(base, ours, theirs);
    expect(result.componentConflicts.length).toBe(1);
    expect(result.componentConflicts[0].kind).toBe('delete-vs-edit');
    expect(result.componentConflicts[0].deletedBy).toBe('theirs');
    expect(result.merged.has('comp1')).toBe(true); // ours-flavored until resolved
  });
});
