/**
 * OBS-003 — layer 3 of the walk, where OBS-002 left the seam.
 *
 * `WalkRow.warnings` shipped with OBS-002 as an always-empty array so the row shape would not
 * move under the panel later. This is what fills it.
 *
 * Runs under plain jest with no Electron and no renderer, which is why the annotator takes a
 * lookup rather than reaching for `WarningsModel`: the algorithm is the part that has to be
 * right, and the model glue lives in `editorDiagnoses.ts` where it costs nothing to leave
 * untested.
 *
 * ## What reverting reddens — predicted before running
 *
 * | Revert | Reddens |
 * |---|---|
 * | the whole call | every row |
 * | the component-set pass (looking up every component) | the bounded-by-topology row only |
 * | assignment → append | the fan-in row only |
 */

import { annotateWarnings } from '../../src/editor/src/utils/provenance/annotateWarnings';
import {
  Topology,
  WalkResult,
  WalkRow,
  backwardWalk,
  buildIndex,
  forEachRow
} from '../../src/editor/src/utils/provenance/walkEngine';

function node(id: string, name: string, type: string, component = '/App') {
  return { id, info: { name, type, component } };
}

function wire(spec: string) {
  const [from, to] = spec.split('->').map((s) => s.trim());
  const [fromNode, fromPort] = from.split('.');
  const [toNode, toPort] = to.split('.');
  return { from: { node: fromNode, port: fromPort }, to: { node: toNode, port: toPort } };
}

function topology(nodes: Array<ReturnType<typeof node>>, wires: string[]): Topology {
  const map: Topology['nodes'] = {};
  for (const n of nodes) map[n.id] = n.info;
  return { nodes: map, edges: wires.map(wire) };
}

/** `Repeater.items <- Query.result <- Button.onClick`, cold — nothing has fired. */
function chainWalk(): { topo: Topology; walk: WalkResult } {
  const topo = topology(
    [node('btn', 'Add To Cart', 'Button'), node('query', 'Cart', 'DbCollection'), node('rep', 'Rows', 'For Each')],
    ['btn.onClick -> query.fetch', 'query.items -> rep.items']
  );
  const index = buildIndex(topo, [], {}, { recording: false });
  return { topo, walk: backwardWalk(index, { node: 'rep', port: 'items' }) };
}

function warningsByNode(walk: WalkResult): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  forEachRow(walk.root, (row: WalkRow) => {
    if (row.warnings.length) out[row.ref.node] = row.warnings;
  });
  return out;
}

describe('OBS-003: annotating a walk with node-local diagnoses', () => {
  test('A diagnosis lands on the row for its own node', () => {
    const { topo, walk } = chainWalk();

    annotateWarnings(topo, walk, () => [{ nodeId: 'rep', message: 'Items expects an array, received a number (42).' }]);

    expect(warningsByNode(walk)).toEqual({
      rep: ['Items expects an array, received a number (42).']
    });
  });

  test('A diagnosis on an upstream node lands upstream, which is the whole point', () => {
    const { topo, walk } = chainWalk();

    annotateWarnings(topo, walk, () => [{ nodeId: 'query', message: 'Nothing to query — Collection Name is empty.' }]);

    // The row that says "it stopped here" is now the row that says why.
    expect(warningsByNode(walk)).toEqual({ query: ['Nothing to query — Collection Name is empty.'] });
  });

  test('Several diagnoses on one node all appear', () => {
    const { topo, walk } = chainWalk();

    annotateWarnings(topo, walk, () => [
      { nodeId: 'rep', message: 'first' },
      { nodeId: 'rep', message: 'second' }
    ]);

    expect(warningsByNode(walk).rep).toEqual(['first', 'second']);
  });

  test('A diagnosis on a node the walk never reaches is not shown', () => {
    const { topo, walk } = chainWalk();

    annotateWarnings(topo, walk, () => [{ nodeId: 'somewhere-else', message: 'not upstream' }]);

    expect(warningsByNode(walk)).toEqual({});
  });

  test('No diagnoses leaves every row exactly as the engine built it', () => {
    const { topo, walk } = chainWalk();

    annotateWarnings(topo, walk, () => []);

    forEachRow(walk.root, (row) => expect(row.warnings).toEqual([]));
  });

  /**
   * ⚠️ The row the design's scale claim rests on. *"Scale comes from topology, not filtering"* —
   * a walk must not pay for warnings on nodes it does not show, or a project with four hundred
   * warned nodes makes every walk expensive for nothing.
   */
  test('Only components the walk touches are asked for diagnoses', () => {
    const topo = topology(
      [node('a', 'A', 'X', '/App'), node('b', 'B', 'X', '/Other')],
      ['a.out -> b.in']
    );
    const index = buildIndex(topo, [], {}, { recording: false });
    // A walk rooted at `a.out` never reaches `b`, so `/Other` must never be looked up.
    const walk = backwardWalk(index, { node: 'a', port: 'out' });

    const asked: string[] = [];
    annotateWarnings(topo, walk, (name) => {
      asked.push(name);
      return [];
    });

    expect(asked).toEqual(['/App']);
  });

  /**
   * ⚠️ One node can appear on several rows through different ports — a Variable read by three
   * downstream nodes is the ordinary case. Appending rather than assigning would have shown the
   * same message once per row.
   */
  test('A node reached through two ports does not have its message multiplied', () => {
    const topo = topology(
      [node('src', 'Source', 'X'), node('sink', 'Sink', 'Y')],
      ['src.a -> sink.one', 'src.b -> sink.two']
    );
    const index = buildIndex(topo, [], {}, { recording: false });
    const walk = backwardWalk(index, { node: 'sink', port: 'one' });

    annotateWarnings(topo, walk, () => [{ nodeId: 'src', message: 'once' }]);
    annotateWarnings(topo, walk, () => [{ nodeId: 'src', message: 'once' }]);

    forEachRow(walk.root, (row) => {
      if (row.ref.node === 'src') expect(row.warnings).toEqual(['once']);
    });
  });

  test('A node missing from the topology does not throw', () => {
    const { walk } = chainWalk();

    expect(() => annotateWarnings({ nodes: {}, edges: [] }, walk, () => [])).not.toThrow();
  });
});
