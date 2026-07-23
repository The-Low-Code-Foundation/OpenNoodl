/**
 * SUB-007: diff correctness against curated before/after pairs
 * (task testing plan: added, removed, moved, renamed, reparameterised,
 * rewired, reparented, reordered, recreated, comments, component-level).
 */

import { diffGraphs, formatChange, formatComponentDiff } from '../../src/editor/src/versioning';
import { comp, conn, node } from './helpers';

describe('GraphDiff', () => {
  it('detects added and removed nodes', () => {
    const base = comp([node('a', 'Group'), node('b', 'Text')]);
    const target = comp([node('a', 'Group'), node('c', 'Image', { x: 900, y: 900 })]);
    const kinds = diffGraphs(base, target).changes.map((c) => c.kind).sort();
    expect(kinds).toEqual(['node-added', 'node-removed']);
  });

  it('detects renames, variant changes and type changes', () => {
    const base = comp([node('a', 'Group', { label: 'Old', variant: 'v1' })]);
    const target = comp([node('a', 'Text', { label: 'New', variant: 'v2' })]);
    const kinds = diffGraphs(base, target).changes.map((c) => c.kind).sort();
    expect(kinds).toEqual(['node-renamed', 'node-type-changed', 'node-variant-changed']);
  });

  it('groups parameter changes per node with per-key deltas', () => {
    const base = comp([node('a', 'Text', { parameters: { text: 'x', size: 10, gone: true } })]);
    const target = comp([node('a', 'Text', { parameters: { text: 'y', size: 10, fresh: 1 } })]);
    const changes = diffGraphs(base, target).changes;
    expect(changes.length).toBe(1);
    const change = changes[0];
    if (change.kind !== 'node-parameters-changed') throw new Error('wrong kind ' + change.kind);
    expect(change.params.map((p) => p.name).sort()).toEqual(['fresh', 'gone', 'text']);
  });

  it('classifies pure canvas moves as cosmetic', () => {
    const base = comp([node('a', 'Group', { x: 0, y: 0 })]);
    const target = comp([node('a', 'Group', { x: 100, y: 50 })]);
    const changes = diffGraphs(base, target).changes;
    expect(changes.length).toBe(1);
    expect(changes[0].kind).toBe('node-moved');
    expect(changes[0].category).toBe('cosmetic');
  });

  it('detects reparenting as semantic', () => {
    const base = comp([node('g1', 'Group', {}, [node('a', 'Text')]), node('g2', 'Group')]);
    const target = comp([node('g1', 'Group'), node('g2', 'Group', {}, [node('a', 'Text')])]);
    const changes = diffGraphs(base, target).changes;
    expect(changes.length).toBe(1);
    const change = changes[0];
    if (change.kind !== 'node-reparented') throw new Error('wrong kind ' + change.kind);
    expect(change.fromParent.id).toBe('g1');
    expect(change.toParent.id).toBe('g2');
  });

  it('detects sibling reorders without flagging unmoved siblings', () => {
    const base = comp([node('g', 'Group', {}, [node('a', 'Text'), node('b', 'Text'), node('c', 'Text')])]);
    const target = comp([node('g', 'Group', {}, [node('b', 'Text'), node('a', 'Text'), node('c', 'Text')])]);
    const reorders = diffGraphs(base, target).changes.filter((c) => c.kind === 'node-reordered');
    expect(reorders.length).toBe(1); // one of a/b moved relative to the other; c stays put
  });

  it('does not report reorders when a sibling was merely deleted', () => {
    const base = comp([node('g', 'Group', {}, [node('a', 'Text'), node('b', 'Text'), node('c', 'Text')])]);
    const target = comp([node('g', 'Group', {}, [node('b', 'Text'), node('c', 'Text')])]);
    const kinds = diffGraphs(base, target).changes.map((c) => c.kind);
    expect(kinds).toEqual(['node-removed']);
  });

  it('derives connection rewires from remove+add at the same input', () => {
    const base = comp([node('a', 'Text'), node('b', 'Text'), node('c', 'Text')], [conn('a', 'out', 'c', 'in')]);
    const target = comp([node('a', 'Text'), node('b', 'Text'), node('c', 'Text')], [conn('b', 'out', 'c', 'in')]);
    const changes = diffGraphs(base, target).changes;
    expect(changes.length).toBe(1);
    const change = changes[0];
    if (change.kind !== 'connection-rewired') throw new Error('wrong kind ' + change.kind);
    expect(change.at).toBe('target');
    expect(change.before.fromId).toBe('a');
    expect(change.after.fromId).toBe('b');
  });

  it('reports plain connection adds and removes', () => {
    const base = comp([node('a', 'Text'), node('b', 'Text')], [conn('a', 'out', 'b', 'in')]);
    const target = comp([node('a', 'Text'), node('b', 'Text')], [conn('a', 'other', 'b', 'other')]);
    // remove+add share no endpoint (different properties both ends? same nodes but
    // different ports on both sides) — still pairs via source-node grouping only
    // when the source endpoint matches exactly, which it does not here.
    const kinds = diffGraphs(base, target).changes.map((c) => c.kind).sort();
    expect(kinds).toEqual(['connection-added', 'connection-removed']);
  });

  it('matches recreated nodes structurally and reports them as one change', () => {
    const base = comp([node('g', 'Group', {}, [node('old', 'Text', { x: 10, y: 10, parameters: { text: 'hi', size: 12 } })])]);
    const target = comp([node('g', 'Group', {}, [node('new', 'Text', { x: 15, y: 12, parameters: { text: 'hi!', size: 12 } })])]);
    const changes = diffGraphs(base, target).changes;
    expect(changes.length).toBe(1);
    const change = changes[0];
    if (change.kind !== 'node-recreated') throw new Error('wrong kind ' + change.kind);
    expect(change.node.id).toBe('old');
    expect(change.recreatedAs.id).toBe('new');
    expect(change.identity).toBe('structural');
  });

  it('never matches recreated nodes across different types', () => {
    const base = comp([node('old', 'Text', { x: 10, y: 10 })]);
    const target = comp([node('new', 'Group', { x: 10, y: 10 })]);
    const kinds = diffGraphs(base, target).changes.map((c) => c.kind).sort();
    expect(kinds).toEqual(['node-added', 'node-removed']);
  });

  it('can disable structural matching', () => {
    const base = comp([node('old', 'Text', { x: 10, y: 10, parameters: { text: 'hi' } })]);
    const target = comp([node('new', 'Text', { x: 10, y: 10, parameters: { text: 'hi' } })]);
    const kinds = diffGraphs(base, target, { structuralMatching: false }).changes.map((c) => c.kind).sort();
    expect(kinds).toEqual(['node-added', 'node-removed']);
  });

  it('diffs comments and component metadata', () => {
    const base = comp([node('a', 'Group')], [], {
      comments: [{ id: 'c1', text: 'hello', x: 0, y: 0 }],
      metadata: { foo: { bar: 1 } }
    });
    const target = comp([node('a', 'Group')], [], {
      comments: [{ id: 'c1', text: 'goodbye', x: 0, y: 0 }],
      metadata: { foo: { bar: 2 } },
      name: 'Renamed'
    });
    const kinds = diffGraphs(base, target).changes.map((c) => c.kind).sort();
    expect(kinds).toEqual(['comment-changed', 'component-metadata-changed', 'component-renamed']);
  });

  it('diffs state parameter bundles per state', () => {
    const base = comp([node('a', 'Group', { stateParameters: { hover: { opacity: 1 } } })]);
    const target = comp([node('a', 'Group', { stateParameters: { hover: { opacity: 0.5 } } })]);
    const changes = diffGraphs(base, target).changes;
    expect(changes.length).toBe(1);
    const change = changes[0];
    if (change.kind !== 'node-state-changed') throw new Error('wrong kind ' + change.kind);
    expect(change.state).toBe('hover');
    expect(change.params[0].name).toBe('opacity');
  });

  it('formats changes as readable sentences with display names', () => {
    const base = comp([node('a', 'net.noodl.controls.button', { parameters: { label: 'Go' } })]);
    const target = comp([node('a', 'net.noodl.controls.button', { parameters: { label: 'Stop' } })]);
    const diff = diffGraphs(base, target);
    const lines = formatComponentDiff(diff, { displayName: (t) => (t === 'net.noodl.controls.button' ? 'Button' : undefined) });
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('Button');
    expect(lines[0]).toContain("'Go'");
    expect(lines[0]).toContain("'Stop'");
    expect(lines[0]).not.toContain('net.noodl.controls.button');
  });

  it('formats rewires in graph terms', () => {
    const base = comp([node('a', 'Text', { label: 'Source A' }), node('b', 'Text'), node('c', 'Text', { label: 'Sink' })], [conn('a', 'out', 'c', 'in')]);
    const target = comp([node('a', 'Text', { label: 'Source A' }), node('b', 'Text'), node('c', 'Text', { label: 'Sink' })], [conn('b', 'out', 'c', 'in')]);
    const diff = diffGraphs(base, target);
    const line = formatChange(diff.changes[0], {});
    expect(line).toContain('Rewired');
    expect(line).toContain('Sink');
  });
});
