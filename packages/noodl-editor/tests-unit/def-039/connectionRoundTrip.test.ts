/**
 * DEF-039 (phase 80) — **a `connections.json` the editor cannot read must not be a file it
 * destroys.**
 *
 * Promoted from `UNOWNED-ROWS-TO-MEASURE.md §7`. A component whose connections carried field
 * names the v2 loader does not know loaded with no error, drew, and was then **written back to
 * disk as empty objects** — the author's wires gone from the file, not merely ignored in memory.
 *
 * The three arms are the ones the row's measurement used, and the control is load-bearing: arm B
 * round-trips byte-identically through the same two functions in the same run, so arm A's loss
 * was a fact about the input rather than about the harness.
 *
 * ⚠️ **Graded here rather than in the jasmine suite because these modules are pure.** The guard
 * itself lives in `connectionEnds.ts` for the same reason — `NodeGraphModel` reads
 * `platform.getUserDataPath()` at module scope and cannot be imported outside Electron, so a
 * guard written inside it could only ever be graded by a copy of itself.
 */

import { reconstructLegacyComponent } from '../../src/editor/src/io/ProjectImporter';
import { buildComponentV2Files } from '../../src/editor/src/io/ProjectExporter';
import { resolveConnectionEnds } from '../../src/editor/src/models/nodegraphmodel/connectionEnds';
import type { ComponentV2File, NodesV2File, ConnectionsV2File } from '../../src/editor/src/schemas';

const NOW = '2026-09-03T00:00:00.000Z';

const componentFile = {
  id: 'cmp-1',
  name: 'Home',
  path: '/Home',
  type: 'page',
  ports: {}
} as ComponentV2File;

const nodesFile = {
  componentId: 'cmp-1',
  version: 1,
  nodes: [
    { id: 'n1', type: 'Group', parentId: null, index: 0, parameters: {} },
    { id: 'n2', type: 'Text', parentId: 'n1', index: 0, parameters: {} }
  ]
} as unknown as NodesV2File;

function connectionsFile(connections: unknown[]): ConnectionsV2File {
  return { componentId: 'cmp-1', version: 1, connections } as unknown as ConnectionsV2File;
}

/** Load then save, exactly as `ComponentLoader` and `ComponentSaver` do. */
function roundTrip(connections: unknown[]) {
  const warnings: string[] = [];
  const legacy = reconstructLegacyComponent('Home', componentFile, nodesFile, connectionsFile(connections), (m) =>
    warnings.push(m)
  );
  const files = buildComponentV2Files(legacy, NOW);
  return { warnings, inMemory: legacy.graph.connections, written: files.connections.connections };
}

const UNKNOWN_FIELD_NAMES = [
  { sourceId: 'n1', sourcePort: 'hoverStart', targetId: 'n2', targetPort: 'visible' },
  { sourceId: 'n1', sourcePort: 'clicked', targetId: 'n2', targetPort: 'hidden' }
];

const CORRECT_FIELD_NAMES = [
  { fromId: 'n1', fromProperty: 'hoverStart', toId: 'n2', toProperty: 'visible' },
  { fromId: 'n1', fromProperty: 'clicked', toId: 'n2', toProperty: 'hidden' }
];

const UNRESOLVABLE_IDS = [
  { fromId: 'GONE-9999', fromProperty: 'hoverStart', toId: 'n2', toProperty: 'visible' },
  { fromId: 'n1', fromProperty: 'clicked', toId: 'GONE-8888', toProperty: 'hidden' }
];

describe('DEF-039 — opening a project must not destroy connections it cannot read', () => {
  it('arm A: unknown field names survive the round trip verbatim', () => {
    const { written } = roundTrip(UNKNOWN_FIELD_NAMES);

    // The recorded defect, in one line: this was `[{}, {}]`.
    expect(written).toEqual(UNKNOWN_FIELD_NAMES);
    expect(written.some((c) => Object.keys(c).length === 0)).toBe(false);
  });

  it('arm A: and the person is told which wire, and what it actually carries', () => {
    const { warnings } = roundTrip(UNKNOWN_FIELD_NAMES);

    expect(warnings.length).toBe(2);
    // The three things the original `TypeError` named none of.
    expect(warnings[0]).toContain('/Home');
    expect(warnings[0]).toContain('connection 0');
    expect(warnings[0]).toContain('sourceId, sourcePort, targetId, targetPort');
  });

  it('arm B (CONTROL): correct field names round-trip byte-identically and warn about nothing', () => {
    const { written, warnings, inMemory } = roundTrip(CORRECT_FIELD_NAMES);

    expect(written).toEqual(CORRECT_FIELD_NAMES);
    expect(inMemory).toEqual(CORRECT_FIELD_NAMES);
    expect(warnings).toEqual([]);
  });

  it('arm C: an id naming no node in the component is preserved, not rewritten', () => {
    const { written, warnings } = roundTrip(UNRESOLVABLE_IDS);

    expect(written).toEqual(UNRESOLVABLE_IDS);
    // It is well-formed: the loader has nothing to complain about, and does not.
    expect(warnings).toEqual([]);
  });
});

/**
 * The guard `getConnectionHealth` now calls. Both caller shapes are graded because **each is
 * missing what the other relies on**, and the original expression dereferenced `undefined` in
 * both directions for different inputs:
 *
 *  - `exportComponent` sends ids and no nodes → arm A (no `fromId` at all) landed on it;
 *  - the canvas sends nodes and no ids → arm C (an id that resolves to nothing) lands on it.
 */
describe('DEF-039 — an end that is not there is an unhealthy wire, not a TypeError', () => {
  const known: Record<string, { id: string }> = { n1: { id: 'n1' }, n2: { id: 'n2' } };
  const exportShape = (c: { fromId?: string; toId?: string }) => ({ sourceId: c.fromId, targetId: c.toId });
  const canvasShape = (c: { fromId?: string; toId?: string }) => ({
    sourceNode: c.fromId ? known[c.fromId] : undefined,
    targetNode: c.toId ? known[c.toId] : undefined
  });

  it('resolves both ends when both are there, in either shape', () => {
    for (const shape of [exportShape, canvasShape]) {
      const r = resolveConnectionEnds(shape({ fromId: 'n1', toId: 'n2' }));
      expect(r.unresolved).toBeUndefined();
      expect(r.sourceId).toBe('n1');
      expect(r.targetId).toBe('n2');
    }
  });

  it('arm A through the export shape: no throw, an unhealthy verdict naming both ends', () => {
    const r = resolveConnectionEnds(exportShape({}));
    expect(r.unresolved).toBe('Neither end of this connection could be resolved.');
  });

  it('arm C through the canvas shape: the missing end is named, and only that end', () => {
    expect(resolveConnectionEnds(canvasShape({ fromId: 'GONE-9999', toId: 'n2' })).unresolved).toBe(
      'The source of this connection could not be resolved.'
    );
    expect(resolveConnectionEnds(canvasShape({ fromId: 'n1', toId: 'GONE-8888' })).unresolved).toBe(
      'The target of this connection could not be resolved.'
    );
  });

  it('a truthy id the component does not contain still resolves — that is a DIFFERENT defect', () => {
    // `evaluateConnectionHealth` reports it as `con-no-source-port`. This guard is about an end
    // that cannot be *named*, not one that cannot be *found*; conflating them would hide it.
    const r = resolveConnectionEnds(exportShape({ fromId: 'GONE-9999', toId: 'n2' }));
    expect(r.unresolved).toBeUndefined();
    expect(r.sourceId).toBe('GONE-9999');
  });
});
