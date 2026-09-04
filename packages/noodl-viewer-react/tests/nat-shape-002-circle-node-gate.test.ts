/**
 * §1 of NOTES-UNOWNED-NODE-WORK.md — the node definition's half of stage 1.
 *
 * The two traps the notes name, graded directly against what `circle.ts` actually declares:
 *
 *   1. the port gate must read `'shape = circle OR shape NOT SET'`, not just `'shape = circle'`
 *      — every Circle saved before this shipped has no `shape` parameter, and the two prefabs
 *      pinned to it would lose Start/End Angle from the panel without the `NOT SET` clause.
 *   2. the gate must be the editor's clause mini-language, not `#js` — a `#js` condition gets no
 *      "why is this hidden" sentence and no validation diagnostic.
 *
 * `Circle.tsx`'s own render tests (`nat-shape-001-…`) cover what gets DRAWN; this covers what the
 * editor is TOLD about the ports, which no render test can see.
 */
import CircleNodeModule from '../src/nodes/visual/circle';

// ⚠️ `createNodeFromReactComponent` (react-component-node.ts:2039) returns `{ node, setup }`, and
// `ReactNodeModule`'s type does not declare `dynamicports` on `.node` either, though it is
// assigned there (line 1022) — a type gap on a field this file exists to grade, not a reason to
// skip grading it.
const CircleNode = CircleNodeModule as unknown as {
  node: { dynamicports?: Array<{ condition?: string; inputs?: string[] }> };
};

// ⚠️ Not the only group: `addPointerEventOutputs`/`addFileDropPorts` push their own after this
// one, via the same `dynamicports` array `NodeSharedPortDefinitions`'s `addDynamicInputPorts`
// shares with every node. This file grades the one Circle itself declares, found by its
// condition rather than assumed to be alone or first.
function shapeGroup(): { condition?: string; inputs?: string[] } {
  const found = (CircleNode.node.dynamicports ?? []).find((g) => (g.condition ?? '').includes('shape'));
  if (!found) throw new Error('circle.ts declared no dynamic-port group mentioning "shape"');
  return found;
}

describe('the shape port gates the arc-only ports, and reads the vocabulary the editor expects', () => {
  it('declares a group for it, among whatever the shared mixins add after', () => {
    expect(shapeGroup()).toBeDefined();
  });

  it('🔴 the condition includes "shape NOT SET" — every saved Circle has no shape parameter yet', () => {
    expect(shapeGroup().condition).toContain('shape NOT SET');
    expect(shapeGroup().condition).toContain('shape = circle');
  });

  it('🔴 the condition is the clause mini-language, never `#js`', () => {
    expect(shapeGroup().condition).not.toContain('#js');
  });

  it('gates Start Angle, End Angle and Line Cap together — all three are arc-only', () => {
    expect(shapeGroup().inputs).toEqual(expect.arrayContaining(['startAngle', 'endAngle', 'strokeLineCap']));
    expect(shapeGroup().inputs).toHaveLength(3);
  });

  it('does NOT gate Size, Fill or Stroke — every shape uses those', () => {
    expect(shapeGroup().inputs).not.toEqual(expect.arrayContaining(['size', 'fillEnabled', 'strokeEnabled']));
  });
});
