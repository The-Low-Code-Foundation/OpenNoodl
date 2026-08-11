/**
 * SIG-007 R3 — the AI write path must not destroy what it cannot describe.
 *
 * `connectionSchema` declares exactly four fields and zod's default is **strip**,
 * so read-modify-write — read the component, change one thing, hand the graph
 * back — returned it with every wire label and every hand-drawn route gone, and
 * nothing errored anywhere. That is P58's `update_node.set.children` one object
 * over, and it is why SIG-007's acceptance asks for export → import separately
 * from save → reopen.
 *
 * The fix keeps the four-field authoring rule and carries the rest over from the
 * baseline, which is what the editor already does for nodes. These specs pin
 * both halves: what survives, and what still does not become authorable.
 */
import type { ComponentFiles } from '../src/graph';
import { assembleSetFiles } from '../src/tools/author';
import { carryConnectionPresentation } from '../src/tools/author';
import type { ConnectionV2 } from '../src/types';

function wire(over: Partial<ConnectionV2> = {}): ConnectionV2 {
  return { fromId: 'a', fromProperty: 'out', toId: 'b', toProperty: 'in', ...over } as ConnectionV2;
}

describe('SIG-007 R3 — connection presentation survives read-modify-write', () => {
  it('restores a label, its position and the routing the schema stripped', () => {
    const baseline = [
      wire({
        label: 'the retry path',
        labelT: 0.3,
        anchors: [
          { u: 0.25, v: 120 },
          { u: 0.7, v: -60 }
        ]
      })
    ];

    // What zod hands the handler: the four fields, and nothing else.
    const [carried] = carryConnectionPresentation(baseline, [wire()]);

    expect(carried.label).toBe('the retry path');
    expect(carried.labelT).toBe(0.3);
    expect(carried.anchors).toEqual([
      { u: 0.25, v: 120 },
      { u: 0.7, v: -60 }
    ]);
  });

  it('carries nothing onto a wire the caller re-pointed', () => {
    // A connection's identity is its four endpoints everywhere else in this
    // package. Move one and it is a different wire, which has no routing yet.
    const baseline = [wire({ label: 'old', anchors: [{ u: 0.5, v: 90 }] })];
    const [carried] = carryConnectionPresentation(baseline, [wire({ toProperty: 'somewhereElse' })]);

    expect(carried.label).toBeUndefined();
    expect(carried.anchors).toBeUndefined();
  });

  it('carries nothing onto a newly added wire', () => {
    const [carried] = carryConnectionPresentation([], [wire()]);
    expect(carried.label).toBeUndefined();
    expect(carried.anchors).toBeUndefined();
  });

  it('leaves a wire the caller deleted deleted', () => {
    const baseline = [wire({ label: 'gone' }), wire({ toId: 'c', label: 'kept' })];
    const out = carryConnectionPresentation(baseline, [wire({ toId: 'c' })]);

    expect(out).toHaveLength(1);
    expect(out[0].toId).toBe('c');
    expect(out[0].label).toBe('kept');
  });

  it('does not mutate the baseline or the incoming list', () => {
    const baseline = [wire({ anchors: [{ u: 0.5, v: 10 }] })];
    const incoming = [wire()];
    carryConnectionPresentation(baseline, incoming);

    expect(incoming[0].anchors).toBeUndefined();
    expect(baseline[0].anchors).toEqual([{ u: 0.5, v: 10 }]);
  });

  /**
   * ⚠️ The one above tests the helper; this tests the **seam the defect was
   * actually at**. Revert `assembleSetFiles`'s one changed line to
   * `candidate.connections.connections = set.connections` and this goes red,
   * which is the only version of the claim worth making.
   */
  it('survives the whole `set` branch, which is where it was being lost', () => {
    const baseline: ComponentFiles = {
      component: { id: 'c1', name: 'Home', path: 'Pages/Home' } as ComponentFiles['component'],
      nodes: { componentId: 'c1', nodes: [{ id: 'a', type: 'Group' }] } as ComponentFiles['nodes'],
      connections: {
        componentId: 'c1',
        connections: [wire({ label: 'the retry path', anchors: [{ u: 0.4, v: 75 }] })]
      } as ComponentFiles['connections']
    };

    const out = assembleSetFiles(
      baseline,
      { nodes: [{ id: 'a', type: 'Group' }] as ComponentFiles['nodes']['nodes'], connections: [wire()] },
      () => false
    );

    expect(out.connections.connections[0].label).toBe('the retry path');
    expect(out.connections.connections[0].anchors).toEqual([{ u: 0.4, v: 75 }]);
  });

  it('prefers what the caller did send over the baseline', () => {
    // Nothing in the shipped schema can produce this today — zod strips these
    // fields before the handler sees them — but the carry must not be the thing
    // that stops a future authorable field from being set.
    const baseline = [wire({ label: 'old' })];
    const [carried] = carryConnectionPresentation(baseline, [wire({ label: 'new' })]);
    expect(carried.label).toBe('new');
  });
});
