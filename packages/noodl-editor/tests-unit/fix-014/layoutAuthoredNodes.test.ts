/**
 * FIX-014 — the layout pass, as pure functions.
 *
 * The ruling under test (2026-08-14): model-supplied x/y is AUTHORITATIVE.
 * The pass fills gaps and separates exact collisions only — the
 * "never moved" specs are the load-bearing control, not a formality.
 */

import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import {
  COLLISION_STEP,
  COLLISION_STEP_FLOOR,
  HIERARCHY_INDENT_X,
  LOGIC_COLUMN_GUTTER,
  ROW_SPACING,
  VISUAL_COLUMN_TOP,
  VISUAL_COLUMN_X,
  layoutAuthoredNodes,
  positionsUnchangedFrom
} from '../../src/editor/src/models/AiAssistant/authoring/layout';
import type { NodeV2 } from '../../src/editor/src/schemas';

/** The catalog's answer, faked: these type names draw, everything else does not. */
const VISUAL_TYPES = new Set(['Group', 'Text', 'Image', 'Page']);
const isVisual = (t: string) => VISUAL_TYPES.has(t);

const byId = (nodes: NodeV2[]) => new Map(nodes.map((n) => [n.id, n]));

describe('FIX-014 — the collision step is a clearance floor, not layout rhythm', () => {
  /**
   * Ruled 2026-08-15 after the drive: the original 40 was shorter than a node is
   * tall (measured heights ran 64–190px), so "separated" nodes still visibly
   * overlapped. The step is now ROW_SPACING-sized.
   *
   * 🔴 This spec exists because the two constants have DIFFERENT JOBS and equal
   * values. ROW_SPACING is layout rhythm; COLLISION_STEP is clearance. Someone
   * tightening rows for density (120 → 100 is a plausible visual tweak) would
   * otherwise silently cut clearance and re-open the defect, and every other
   * spec here would stay green because they all assert `y + COLLISION_STEP`
   * symbolically. Nothing else in the suite names this relationship.
   */
  it('never falls below the floor, whatever happens to ROW_SPACING', () => {
    expect(COLLISION_STEP).toBeGreaterThanOrEqual(COLLISION_STEP_FLOOR);
    expect(COLLISION_STEP_FLOOR).toBe(120);
  });

  it('clears the node height that made 40 the wrong number', () => {
    // The tallest node measured on a real canvas during the session-16 drive.
    // The pass is size-blind, so this is a documented approximation, not a
    // guarantee — a 190px node still overlaps at 120, which the module says.
    expect(COLLISION_STEP).toBeGreaterThan(64);
  });
});

describe('FIX-014 — layoutAuthoredNodes', () => {
  it('flows an unpositioned visual tree down the left column, indented by depth', () => {
    const nodes: NodeV2[] = [
      { id: 'root', type: 'Group', children: ['title', 'list'] },
      { id: 'title', type: 'Text', parent: 'root' },
      { id: 'list', type: 'Group', parent: 'root', children: ['item'] },
      { id: 'item', type: 'Text', parent: 'list' }
    ];
    const out = byId(layoutAuthoredNodes(nodes, isVisual));

    expect(out.get('root')).toMatchObject({ x: VISUAL_COLUMN_X, y: VISUAL_COLUMN_TOP });
    expect(out.get('title')).toMatchObject({
      x: VISUAL_COLUMN_X + HIERARCHY_INDENT_X,
      y: VISUAL_COLUMN_TOP + ROW_SPACING
    });
    expect(out.get('list')).toMatchObject({
      x: VISUAL_COLUMN_X + HIERARCHY_INDENT_X,
      y: VISUAL_COLUMN_TOP + 2 * ROW_SPACING
    });
    expect(out.get('item')).toMatchObject({
      x: VISUAL_COLUMN_X + 2 * HIERARCHY_INDENT_X,
      y: VISUAL_COLUMN_TOP + 3 * ROW_SPACING
    });
  });

  it('an all-visual graph produces no logic column and every node is positioned', () => {
    const nodes: NodeV2[] = [
      { id: 'a', type: 'Group', children: ['b'] },
      { id: 'b', type: 'Text', parent: 'a' }
    ];
    const out = layoutAuthoredNodes(nodes, isVisual);
    for (const n of out) {
      expect(n.x).toBeDefined();
      expect(n.y).toBeDefined();
    }
  });

  it('an all-logic component flows down a single column at the left', () => {
    const nodes: NodeV2[] = [
      { id: 's1', type: 'States' },
      { id: 's2', type: 'Expression' },
      { id: 's3', type: 'Function' }
    ];
    const out = layoutAuthoredNodes(nodes, isVisual);
    // No visual x exists, so the "right column" is the left one.
    expect(out.map((n) => n.x)).toEqual([VISUAL_COLUMN_X, VISUAL_COLUMN_X, VISUAL_COLUMN_X]);
    expect(out[0].y!).toBeLessThan(out[1].y!);
    expect(out[1].y!).toBeLessThan(out[2].y!);
  });

  it('places logic right of the widest visual x, beside the visual node each feeds', () => {
    const nodes: NodeV2[] = [
      { id: 'root', type: 'Group', children: ['title', 'body'] },
      { id: 'title', type: 'Text', parent: 'root' },
      { id: 'body', type: 'Text', parent: 'root' },
      // Submitted in the "wrong" order: feeds body (lower), then title (upper).
      { id: 'exprB', type: 'Expression' },
      { id: 'exprT', type: 'Expression' }
    ];
    const connections = [
      { fromId: 'exprB', toId: 'body' },
      { fromId: 'exprT', toId: 'title' }
    ];
    const out = byId(layoutAuthoredNodes(nodes, isVisual, { connections }));

    const maxVisualX = Math.max(out.get('root')!.x!, out.get('title')!.x!, out.get('body')!.x!);
    expect(out.get('exprT')!.x).toBe(maxVisualX + LOGIC_COLUMN_GUTTER);
    expect(out.get('exprB')!.x).toBe(maxVisualX + LOGIC_COLUMN_GUTTER);
    // Ordered by the y of the node each feeds, not by submission order:
    expect(out.get('exprT')!.y!).toBeLessThan(out.get('exprB')!.y!);
    // "Beside": each starts at its target's y (no collision forced a step here).
    expect(out.get('exprT')!.y).toBe(out.get('title')!.y);
  });

  it('a logic node with no outbound wire anchors on the node feeding it; one with no wires goes last', () => {
    const nodes: NodeV2[] = [
      { id: 'root', type: 'Group', children: ['t'] },
      { id: 't', type: 'Text', parent: 'root' },
      { id: 'sink', type: 'Function' }, // fed by t, feeds nothing
      { id: 'loose', type: 'Function' } // no wires at all
    ];
    const connections = [{ fromId: 't', toId: 'sink' }];
    const out = byId(layoutAuthoredNodes(nodes, isVisual, { connections }));
    expect(out.get('sink')!.y).toBe(out.get('t')!.y);
    expect(out.get('loose')!.y!).toBeGreaterThan(out.get('sink')!.y!);
  });

  it('CONTROL: a model-positioned node is never moved', () => {
    const nodes: NodeV2[] = [
      { id: 'root', type: 'Group', x: 777, y: -50, children: ['t'] },
      { id: 't', type: 'Text', x: 13.5, y: 900, parent: 'root' },
      { id: 'fn', type: 'Function', x: -300, y: 42 }
    ];
    const out = byId(layoutAuthoredNodes(nodes, isVisual, { connections: [{ fromId: 'fn', toId: 't' }] }));
    expect(out.get('root')).toMatchObject({ x: 777, y: -50 });
    expect(out.get('t')).toMatchObject({ x: 13.5, y: 900 });
    expect(out.get('fn')).toMatchObject({ x: -300, y: 42 });
  });

  it('mixed omitted/positioned: gaps fill around the placed nodes, which do not move', () => {
    const nodes: NodeV2[] = [
      { id: 'root', type: 'Group', x: 100, y: 100, children: ['a', 'b'] },
      { id: 'a', type: 'Text', parent: 'root' }, // gap
      { id: 'b', type: 'Text', parent: 'root', x: 400, y: 500 } // placed
    ];
    const out = byId(layoutAuthoredNodes(nodes, isVisual));
    expect(out.get('root')).toMatchObject({ x: 100, y: 100 });
    expect(out.get('b')).toMatchObject({ x: 400, y: 500 });
    // The gap fills below the placed root, in the flow:
    expect(out.get('a')).toMatchObject({ x: VISUAL_COLUMN_X + HIERARCHY_INDENT_X, y: 100 + ROW_SPACING });
  });

  it('separates two nodes emitted at identical coordinates — the first occupant stays', () => {
    const nodes: NodeV2[] = [
      { id: 'one', type: 'Group', x: 200, y: 200 },
      { id: 'two', type: 'Group', x: 200, y: 200 },
      { id: 'three', type: 'Group', x: 200, y: 200 }
    ];
    const out = layoutAuthoredNodes(nodes, isVisual);
    expect(out[0]).toMatchObject({ x: 200, y: 200 });
    expect(out[1]).toMatchObject({ x: 200, y: 200 + COLLISION_STEP });
    expect(out[2]).toMatchObject({ x: 200, y: 200 + 2 * COLLISION_STEP });
    const keys = new Set(out.map((n) => `${n.x},${n.y}`));
    expect(keys.size).toBe(3);
  });

  it('a locked node is never nudged, even out of a collision — the unlocked collider moves', () => {
    const nodes: NodeV2[] = [
      { id: 'kept', type: 'Group', x: 200, y: 200 },
      { id: 'incoming', type: 'Group', x: 200, y: 200 }
    ];
    const out = byId(layoutAuthoredNodes(nodes, isVisual, { lockedIds: new Set(['kept']) }));
    expect(out.get('kept')).toMatchObject({ x: 200, y: 200 });
    expect(out.get('incoming')).toMatchObject({ x: 200, y: 200 + COLLISION_STEP });
  });

  it('two LOCKED nodes sharing a coordinate both stay — a pre-existing arrangement is not this pass\'s to fix', () => {
    const nodes: NodeV2[] = [
      { id: 'a', type: 'Group', x: 200, y: 200 },
      { id: 'b', type: 'Group', x: 200, y: 200 }
    ];
    const out = layoutAuthoredNodes(nodes, isVisual, { lockedIds: new Set(['a', 'b']) });
    expect(out[0]).toMatchObject({ x: 200, y: 200 });
    expect(out[1]).toMatchObject({ x: 200, y: 200 });
  });

  it('half-positioned (x without y, or y without x) counts as omitted and gets both assigned', () => {
    const nodes: NodeV2[] = [
      { id: 'a', type: 'Group', x: 500 },
      { id: 'b', type: 'Function', y: 300 }
    ];
    const out = byId(layoutAuthoredNodes(nodes, isVisual));
    expect(out.get('a')!.x).toBeDefined();
    expect(out.get('a')!.y).toBeDefined();
    expect(out.get('b')!.x).toBeDefined();
    expect(out.get('b')!.y).toBeDefined();
  });

  it('a component instance (type unknown to the predicate) with a parent stays in the visual tree', () => {
    const nodes: NodeV2[] = [
      { id: 'root', type: 'Group', children: ['card'] },
      { id: 'card', type: '/Components/ProductCard', parent: 'root' },
      { id: 'fn', type: 'Function' }
    ];
    const out = byId(layoutAuthoredNodes(nodes, isVisual, { connections: [{ fromId: 'fn', toId: 'card' }] }));
    // The instance flows in the left column at depth 1…
    expect(out.get('card')).toMatchObject({
      x: VISUAL_COLUMN_X + HIERARCHY_INDENT_X,
      y: VISUAL_COLUMN_TOP + ROW_SPACING
    });
    // …and the logic node lands to its right, not on top of it.
    expect(out.get('fn')!.x!).toBeGreaterThan(out.get('card')!.x!);
  });

  it('never mutates its input', () => {
    const nodes: NodeV2[] = [{ id: 'a', type: 'Group' }];
    const frozen = JSON.stringify(nodes);
    layoutAuthoredNodes(nodes, isVisual);
    expect(JSON.stringify(nodes)).toBe(frozen);
  });
});

describe('FIX-014 — positionsUnchangedFrom', () => {
  const baseline: NodeV2[] = [
    { id: 'kept', type: 'Group', x: 10, y: 20 },
    { id: 'moved', type: 'Text', x: 30, y: 40 },
    { id: 'never-placed', type: 'Function' }
  ];

  it('locks exactly the ids whose defined position is resubmitted verbatim', () => {
    const submitted: NodeV2[] = [
      { id: 'kept', type: 'Group', x: 10, y: 20 }, // unchanged → locked
      { id: 'moved', type: 'Text', x: 999, y: 40 }, // changed → not locked
      { id: 'never-placed', type: 'Function' }, // baseline had no position → a gap, not an arrangement
      { id: 'new', type: 'Text' } // not in baseline
    ];
    expect(positionsUnchangedFrom(submitted, baseline)).toEqual(new Set(['kept']));
  });
});

describe('FIX-014 — buildCandidate runs the pass (the editor door)', () => {
  const REQUEST = { componentPath: 'Pages/Home', description: 'test' } as never;

  it('an unpositioned submission comes out fully positioned, two-family', () => {
    const result = buildCandidate(
      REQUEST,
      {
        nodes: [
          { id: 'root', type: 'Group' },
          { id: 'title', type: 'Text', parent: 'root' },
          { id: 'fn', type: 'Function' }
        ],
        connections: [{ fromId: 'fn', fromProperty: 'result', toId: 'title', toProperty: 'text' }]
      } as never,
      undefined,
      undefined,
      isVisual
    );
    expect(result.errors).toEqual([]);
    const out = byId(result.files!.nodes.nodes);
    expect(out.get('root')).toMatchObject({ x: VISUAL_COLUMN_X, y: VISUAL_COLUMN_TOP });
    expect(out.get('fn')!.x!).toBeGreaterThan(out.get('title')!.x!);
    expect(out.get('fn')!.y).toBe(out.get('title')!.y);
  });

  it('CONTROL: a fully positioned submission is written byte-for-byte where the model put it', () => {
    const result = buildCandidate(
      REQUEST,
      {
        nodes: [
          { id: 'a', type: 'Group', x: 1, y: 2 },
          { id: 'b', type: 'Text', parent: 'a', x: 3, y: 4 }
        ]
      } as never,
      undefined,
      undefined,
      isVisual
    );
    const out = byId(result.files!.nodes.nodes);
    expect(out.get('a')).toMatchObject({ x: 1, y: 2 });
    expect(out.get('b')).toMatchObject({ x: 3, y: 4 });
  });

  it('update mode: positions carried unchanged from the base are locked against the nudge', () => {
    const base = buildCandidate(
      REQUEST,
      { nodes: [{ id: 'root', type: 'Group', x: 200, y: 200 }] } as never,
      '2026-01-01T00:00:00.000Z',
      undefined,
      isVisual
    ).files!;
    // The revision keeps root exactly where the user had it and adds a node
    // the model dropped onto the same spot.
    const result = buildCandidate(
      REQUEST,
      {
        nodes: [
          { id: 'root', type: 'Group', x: 200, y: 200 },
          { id: 'clash', type: 'Text', parent: 'root', x: 200, y: 200 }
        ]
      } as never,
      undefined,
      base,
      isVisual
    );
    const out = byId(result.files!.nodes.nodes);
    expect(out.get('root')).toMatchObject({ x: 200, y: 200 });
    expect(out.get('clash')).toMatchObject({ x: 200, y: 200 + COLLISION_STEP });
  });
});
