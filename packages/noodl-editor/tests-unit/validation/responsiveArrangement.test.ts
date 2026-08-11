/**
 * DSG-004 §2.1 — doctrine `§7` had no gate, and the doctrine's own author broke
 * it three commits after writing it.
 *
 * The graphs here are not invented. The firing cases are the shapes read off
 * disk in `ecommerce-example` (the reference build), `phase55-replay-sonnet` and
 * `Puppy test 3`; the silent cases are the shapes the same corpus scan showed
 * are legitimate and common — a pair, a control cluster, a content-sized row,
 * and the `Columns` node that is the whole point.
 *
 * Pure structure and parameters plus a catalog, so it belongs in `tests-unit/`
 * (and therefore in `test:main`) rather than the Electron suite.
 */

import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import {
  checkResponsiveArrangement,
  type ArrangementNode
} from '../../src/editor/src/validation/responsiveArrangement';

const catalog = loadDefaultCatalog();

function run(nodes: ArrangementNode[]) {
  return checkResponsiveArrangement(nodes, { component: '/Pages/Home', catalog });
}

/** A track of `size` nodes rooted at a Group, as a card or a footer column is. */
function track(prefix: string, size: number, type = 'Group'): ArrangementNode[] {
  const children = Array.from({ length: size - 1 }, (_, i) => `${prefix}-t${i}`);
  return [
    { id: prefix, type, children, parameters: {} },
    ...children.map((id) => ({ id, type: 'Text', children: [], parameters: { text: 'x' } }))
  ];
}

function row(id: string, parameters: Record<string, unknown>, trackIds: string[]): ArrangementNode {
  return { id, type: 'Group', label: id, children: trackIds, parameters };
}

describe('uncollapsible-multi-column (DSG-004 §2.1)', () => {
  describe('fires on the arrangement that cannot collapse', () => {
    it('reports the reference build’s three-up category row', () => {
      // `ecommerce-example` `/Pages/Home` "Category row": a row Group of three
      // 5-node category cards at width 100%.
      const found = run([
        row('Category row', { flexDirection: 'row', width: { value: 100, unit: '%' }, columnGap: 'var(--space-6)' }, [
          'card-a',
          'card-b',
          'card-c'
        ]),
        ...track('card-a', 5),
        ...track('card-b', 5),
        ...track('card-c', 5)
      ]);

      expect(found).toHaveLength(1);
      expect(found[0].code).toBe(DiagnosticCode.UncollapsibleMultiColumn);
      expect(found[0].severity).toBe('warning');
      expect(found[0].location.nodeId).toBe('Category row');
      expect(found[0].location.port).toBe('flexDirection');
    });

    it('names the defect and the exit in the same sentence', () => {
      const [found] = run([
        row('Footer top', { flexDirection: 'row', width: { value: 100, unit: '%' } }, ['a', 'b', 'c', 'd']),
        ...track('a', 4),
        ...track('b', 4),
        ...track('c', 4),
        ...track('d', 4)
      ]);

      // The defect, measured: four columns and the reason they stay four.
      expect(found.message).toContain('4 columns');
      expect(found.message).toContain('never responds to width');
      // The exit, with the parameters that make it work — a rejection with no
      // suggested fix is a rejection a model argues with.
      expect(found.message).toContain('layoutString');
      expect(found.message).toContain('smallLayout');
      expect(found.suggestion).toBe('net.noodl.visual.columns');
    });

    it('offers autoFit rather than a layout string for a wrapped grid over a Repeater', () => {
      // `Puppy test 3` `/Pages/Landing` "Puppy card grid" and the reference
      // build's "Featured grid", which are the same node twice.
      const [found] = run([
        row('Puppy card grid', { flexDirection: 'row', flexWrap: 'wrap', columnGap: 'var(--space-6)' }, ['rep']),
        { id: 'rep', type: 'For Each', children: [], parameters: { template: '/Components/PuppyCard' } }
      ]);

      expect(found.code).toBe(DiagnosticCode.UncollapsibleMultiColumn);
      expect(found.location.port).toBe('flexWrap');
      expect(found.message).toContain('autoFit');
      expect(found.message).toContain('260-320px');
      expect(found.message).not.toContain('layoutString');
    });

    it('counts component instances as tracks, because a card band is made of them', () => {
      const found = run([
        row('Product row', { flexDirection: 'row', width: { value: 100, unit: '%' } }, ['i1', 'i2', 'i3']),
        { id: 'i1', type: '/Components/ProductCard', children: ['i1a', 'i1b'], parameters: {} },
        { id: 'i1a', type: 'Text', children: [], parameters: {} },
        { id: 'i1b', type: 'Text', children: [], parameters: {} },
        { id: 'i2', type: '/Components/ProductCard', children: ['i2a', 'i2b'], parameters: {} },
        { id: 'i2a', type: 'Text', children: [], parameters: {} },
        { id: 'i2b', type: 'Text', children: [], parameters: {} },
        { id: 'i3', type: '/Components/ProductCard', children: ['i3a', 'i3b'], parameters: {} },
        { id: 'i3a', type: 'Text', children: [], parameters: {} },
        { id: 'i3b', type: 'Text', children: [], parameters: {} }
      ]);
      expect(found).toHaveLength(1);
    });

    it('says it once per Group, not once per column', () => {
      const found = run([
        row('band', { flexDirection: 'row', width: { value: 100, unit: '%' } }, ['a', 'b', 'c', 'd', 'e']),
        ...track('a', 3),
        ...track('b', 3),
        ...track('c', 3),
        ...track('d', 3),
        ...track('e', 3)
      ]);
      expect(found).toHaveLength(1);
    });
  });

  describe('stays silent on the arrangements the corpus says are legitimate', () => {
    it('says nothing about a column, which is what an unset Group already is', () => {
      expect(
        run([row('stack', {}, ['a', 'b', 'c']), ...track('a', 5), ...track('b', 5), ...track('c', 5)])
      ).toEqual([]);
    });

    it('says nothing about a pair — 304 of the corpus’s 516 rows', () => {
      expect(
        run([
          row('label and value', { flexDirection: 'row', width: { value: 100, unit: '%' } }, ['a', 'b']),
          ...track('a', 5),
          ...track('b', 5)
        ])
      ).toEqual([]);
    });

    it('says nothing about an icon-and-label row, where every track is one node', () => {
      // The floor that exists because at a per-track size of 1 the rule fires on
      // almost every real graph.
      expect(
        run([
          row('meta', { flexDirection: 'row', width: { value: 100, unit: '%' } }, ['i', 't', 'b']),
          { id: 'i', type: 'net.noodl.visual.icon', children: [], parameters: {} },
          { id: 't', type: 'Text', children: [], parameters: {} },
          { id: 'b', type: 'Text', children: [], parameters: {} }
        ])
      ).toEqual([]);
    });

    it('says nothing about a control cluster, which is as wide as its contents', () => {
      // `big-merge-test-mine`'s stepper and star-rating rows: three tracks of
      // three nodes each, and content-sized. A band owns the page's width.
      expect(
        run([
          row('Item Counter', { flexDirection: 'row', sizeMode: 'contentSize' }, ['minus', 'count', 'plus']),
          ...track('minus', 3),
          ...track('count', 3),
          ...track('plus', 3)
        ])
      ).toEqual([]);
    });

    it('says nothing when the row is already inside the node that reflows', () => {
      expect(
        run([
          { id: 'cols', type: 'net.noodl.visual.columns', children: ['band'], parameters: { sizing: 'autoFit' } },
          row('band', { flexDirection: 'row', width: { value: 100, unit: '%' } }, ['a', 'b', 'c']),
          ...track('a', 4),
          ...track('b', 4),
          ...track('c', 4)
        ])
      ).toEqual([]);
    });

    it('says nothing about a wrapped chip list, which has no gutter of its own', () => {
      // 36 of the 45 corpus rows that parent a `For Each` are this: pills, tags
      // and carousels whose spacing comes from the items.
      expect(
        run([
          row('Selection Pills', { flexDirection: 'row', flexWrap: 'wrap', sizeMode: 'contentHeight' }, ['rep']),
          { id: 'rep', type: 'For Each', children: [], parameters: { template: '/Pill' } }
        ])
      ).toEqual([]);
    });

    it('says nothing about a Columns node, which is the answer', () => {
      expect(
        run([
          {
            id: 'cols',
            type: 'net.noodl.visual.columns',
            children: ['a', 'b', 'c'],
            parameters: { layoutString: '1 1 1', smallBreakpoint: { value: 700, unit: 'px' }, smallLayout: '1' }
          },
          ...track('a', 5),
          ...track('b', 5),
          ...track('c', 5)
        ])
      ).toEqual([]);
    });

    it('survives a graph whose parent links form a cycle', () => {
      // A corrupt graph is a bad report, not a stack overflow.
      expect(() =>
        run([
          row('a', { flexDirection: 'row', width: { value: 100, unit: '%' } }, ['b']),
          { id: 'b', type: 'Group', children: ['a'], parameters: {} }
        ])
      ).not.toThrow();
    });
  });
});
