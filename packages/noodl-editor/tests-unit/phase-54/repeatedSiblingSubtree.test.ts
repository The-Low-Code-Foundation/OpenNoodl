/**
 * Phase 54 — the rule that turns the decomposition doctrine into a check.
 *
 * The doctrine ("two or more structurally identical siblings become one
 * component") shipped to both clients and was still ignored by the reference
 * build that produced this rule: a 66-node page carrying three hand-duplicated
 * trust items, three section heads and three category cards.
 *
 * These specs pin the two decisions that keep the rule trustworthy — it matches
 * STRUCTURE rather than values, and it is deliberately more conservative than
 * the prose it enforces. The rule is exercised directly rather than through
 * `SemanticValidator`: rules are pure functions of a `RuleContext` by contract,
 * and driving the whole engine would make these specs a test of the fixture's
 * completeness instead of a test of the rule.
 */
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { NormComponent, NormNode } from '../../src/editor/src/validation/model';
import { repeatedSiblingSubtree } from '../../src/editor/src/validation/rules/repeatedSiblingSubtree';
import { RuleContext } from '../../src/editor/src/validation/rules/types';

const node = (id: string, type: string, children: string[] = [], parent?: string): NormNode =>
  ({ id, type, parameters: {}, children, parent } as unknown as NormNode);

/** `count` identical `Group > (Text × leaves)` subtrees under one row. */
function rowOfRepeats(count: number, leaves = 2): NormNode[] {
  const nodes: NormNode[] = [];
  const itemIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const itemId = `item${i}`;
    itemIds.push(itemId);
    const leafIds: string[] = [];
    for (let l = 0; l < leaves; l++) {
      leafIds.push(`${itemId}_t${l}`);
      // Different text per copy on purpose: instances are meant to differ in
      // their values, which is exactly why the rule cannot compare them.
      nodes.push({ ...node(`${itemId}_t${l}`, 'Text', [], itemId), parameters: { text: `copy ${i}-${l}` } } as NormNode);
    }
    nodes.push(node(itemId, 'Group', leafIds, 'row'));
  }
  nodes.unshift(node('row', 'Group', itemIds));
  return nodes;
}

function ctxFor(nodes: NormNode[]): RuleContext {
  const component = { name: '/Pages/Test', nodes, connections: [] } as unknown as NormComponent;
  return {
    project: { components: [component] } as never,
    catalog: {} as never,
    options: {},
    components: [{ component, nodeById: new Map(nodes.map((n) => [n.id, n])) }],
    counters: { nodesChecked: 0, endpointsChecked: 0 }
  };
}

const hits = (nodes: NormNode[]) => repeatedSiblingSubtree.run(ctxFor(nodes));

describe('repeatedSiblingSubtree', () => {
  it('reports three identical sibling subtrees', () => {
    const found = hits(rowOfRepeats(3));
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe(DiagnosticCode.RepeatedSiblingSubtree);
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('3 sibling subtrees');
  });

  it('matches structure, not parameter values', () => {
    // Every copy carries different `text`. A value-based comparison would find
    // nothing here, which would miss the only case worth reporting.
    expect(hits(rowOfRepeats(3))).toHaveLength(1);
  });

  it('stays quiet at two — a pair is not a component', () => {
    expect(hits(rowOfRepeats(2))).toHaveLength(0);
  });

  it('ignores repeats smaller than three nodes, which are list items', () => {
    // Group + one Text = 2 nodes per item, repeated four times. At a floor of 2
    // this fired on icon+label pairs across the corpus.
    expect(hits(rowOfRepeats(4, 1))).toHaveLength(0);
  });

  it('does not fire when one sibling has a different shape', () => {
    const nodes = rowOfRepeats(3);
    nodes.push(node('extra', 'Text', [], 'item0'));
    (nodes.find((n) => n.id === 'item0') as NormNode).children.push('extra');
    expect(hits(nodes)).toHaveLength(0);
  });

  it('reports each repeating parent separately', () => {
    const first = rowOfRepeats(3);
    const second = rowOfRepeats(3).map((n) => ({
      ...n,
      id: `b_${n.id}`,
      parent: n.parent ? `b_${n.parent}` : undefined,
      children: n.children.map((c) => `b_${c}`)
    })) as NormNode[];
    expect(hits([...first, ...second])).toHaveLength(2);
  });
});

/**
 * VIB-004 — register **V12**, measured instead of argued.
 *
 * The row read: *"`repeated-sibling-subtree` fires on structure alone at 3 — three DIFFERENT
 * feature cards trip it; richness costs a component file."* Half of that is right and the half that
 * decides the ruling is not, so the phase-81 marketing kit is built on the corrected reading.
 *
 * 🔴 **The rule cannot see a component instance at all.** An instance is ONE node with no children,
 * so its structural signature has `size: 1`, which is below `MIN_SUBTREE_NODES` and skipped before
 * any grouping happens. Three instances of `/Components/FeatureCard` are therefore invisible to it —
 * and that matters because the rule's own message tells the author to *"make one component and
 * instantiate it N times"*. A rule that then fired on the result would be teaching a fix it punishes,
 * which is precisely the shape phase 81 was opened to find.
 *
 * So V12's true residue is narrower than the row: the warning fires on **hand-duplicated subtrees**,
 * which is what it says it does, and the marketing kit's recipes all factor — `ui-icon-feature-strip`,
 * `ui-stat-tile-row`, `ui-testimonial-row` and `ui-footer-columns` each ship an item component. A page
 * assembled from the kit draws no warning at all.
 *
 * These two rows exist so that stays true. Without them nothing anywhere pins the behaviour the
 * message promises, and the rule could regress into punishing the factored form with every spec green.
 */
describe('repeatedSiblingSubtree — the factored form is the fix, not a second defect (V12)', () => {
  /** Three instances of one component under a row — what the warning asks the author to build. */
  const rowOfInstances = (count: number, type = '/Components/FeatureCard'): NormNode[] => {
    const ids = Array.from({ length: count }, (_, i) => `card${i}`);
    return [
      node('row', 'Group', ids),
      ...ids.map((id, i) => ({
        ...node(id, type, [], 'row'),
        // Different content per placement — three DIFFERENT feature cards, which is the exact case
        // the register row said would trip the rule.
        parameters: { title: `Feature ${i}`, body: `Body ${i}` }
      })) as NormNode[]
    ];
  };

  it('stays silent on three instances of one component — the shape the message recommends', () => {
    expect(hits(rowOfInstances(3))).toHaveLength(0);
  });

  it('stays silent however many placements there are', () => {
    // Four stat tiles is `ui-stat-tile-row` exactly, and six is a footer link column.
    expect(hits(rowOfInstances(4))).toHaveLength(0);
    expect(hits(rowOfInstances(6))).toHaveLength(0);
  });

  it('⚠️ CONTROL — the same three cards written out by hand DO draw the warning', () => {
    // Without this the two rows above would pass on a rule that had stopped working entirely.
    expect(hits(rowOfRepeats(3))).toHaveLength(1);
  });
});
