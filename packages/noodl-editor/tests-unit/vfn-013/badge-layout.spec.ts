/**
 * VFN-013 — the badge placement, graded by **intersecting rectangles**, and graded against the
 * anchor it replaces.
 *
 * ## Why this file leads with a negative control
 *
 * Every acceptance criterion in Phase 64 is an absence — *no badge overlaps any block* — and a
 * suite of absences is indistinguishable from an instrument that measured nothing. So the first
 * `describe` here runs the overlap test against {@link legacyBadgeAnchor}, the formula that was
 * in `BlockValueBadges.ts:207-210` when the report came in, and **requires it to report the
 * collision Richard photographed**. Only then does the same test mean anything applied to the
 * new layout.
 *
 * ## What the fixture is, and what it is not
 *
 * The geometry below is a *model* of the reported screenshot — `set output total to [price] ×
 * [qty]` — written in workspace units with the proportions Blockly's renderer produces: a
 * statement whose own box is its label (Blockly's `getBoundingRectangleWithoutChildren` excludes
 * whatever is plugged in), an inline `×` whose operands sit inside it, and two leaf blocks.
 *
 * ⚠️ **It is a model, not a measurement of a running editor.** `layoutBadges` is arithmetic and
 * this file grades the arithmetic exhaustively; what it cannot grade is whether
 * `BlockValueBadges.blockBox` hands the real renderer's numbers in correctly. That half is a
 * `getBoundingClientRect()` intersection in a driven editor and it is owed — see VFN-013's
 * "How to prove it".
 *
 * ## ✅ The live sweep this file is calibrated against (2026-08-13, `vfn64-drive`, node `c6`)
 *
 * Bench run with `price=7, quantity=3`; every badge's `getBoundingClientRect()` intersected with
 * every `.blocklyPath` / `.blocklyText` / `.blocklyEditableText`, largest area per badge:
 *
 * ```
 * badge "3"   [843,400,17,16]   worst overlap 266 px²  (blocklyPath)   ← nested, on the × dropdown
 * badge "21"  [629,394,23,16]   worst overlap 371 px²  (blocklyPath)   ← nested, over the word "to"
 * badge "7"   [608,599,17,16]   worst overlap NONE                     ← orphan top-level value block
 * badge "7"   [632,498,17,16]   worst overlap NONE                     ← orphan top-level value block
 * ```
 *
 * 🔴 **It splits on the nesting line and on nothing else**, which is the task file's claim,
 * measured. Two things follow and both are asserted below: the nested overlaps must go to zero,
 * and the two nulls must stay null — those badges belong to *orphan top-level value blocks* sitting
 * on empty canvas, which are exactly the case LGC-003 §5.1's anchor was designed for. A value block
 * is not automatically nested; a value block that is *plugged in* is.
 *
 * The widths above also confirm `badgeBoxWidth`: `"3"` → 17 ≈ 1 × 6.6 + 10, `"21"` → 23 ≈ 2 × 6.6 + 10.
 */

import {
  BADGE_GUTTER,
  BadgeRequest,
  BlockBox,
  layoutBadges,
  legacyBadgeAnchor,
  nestingDepth,
  rectsOverlap
} from '../../src/editor/src/views/BlocklyEditor/badgeLayout';

const BADGE_HEIGHT = 16;

/**
 * `set output total to [price] × [qty]`, as one top-level statement.
 *
 * Boxes are each block's *own* painted surface — the thing a badge must not cover. The `×`
 * block's box is left-anchored and narrower than the expression it renders, because that is
 * what `getBoundingRectangleWithoutChildren` measures; the operands carry their own boxes.
 */
function multiplyFixture(): BlockBox[] {
  return [
    { id: 'setTotal', x: 0, y: 0, width: 112, height: 28, surroundId: null },
    { id: 'mul', x: 112, y: 4, width: 30, height: 20, surroundId: 'setTotal' },
    { id: 'price', x: 120, y: 6, width: 56, height: 16, surroundId: 'mul' },
    { id: 'qty', x: 182, y: 6, width: 48, height: 16, surroundId: 'mul' }
  ];
}

/**
 * The live fixture: the statement above, plus the two **orphan** `get input price` blocks that
 * sit on empty canvas beside it and whose badges measured no overlap at all.
 *
 * They are value blocks with an output plug and nothing plugged into — `surroundId: null` — and
 * they are the reason the nesting test is "is my left edge inside someone's body", not "am I a
 * value block".
 */
function liveFixture(): BlockBox[] {
  return multiplyFixture().concat([
    { id: 'orphanA', x: 400, y: 200, width: 96, height: 24, surroundId: null },
    { id: 'orphanB', x: 400, y: 300, width: 96, height: 24, surroundId: null }
  ]);
}

/** The same statement twice, stacked — the case a single-statement fixture cannot see. */
function stackedFixture(): BlockBox[] {
  const first = multiplyFixture();
  const second = multiplyFixture().map((box) => ({
    ...box,
    id: box.id + '2',
    surroundId: box.surroundId ? box.surroundId + '2' : null,
    y: box.y + 28
  }));
  return first.concat(second);
}

/** Badge widths as `badgeBoxWidth` would compute them: `chars * 6.6 + 10`. */
function badge(blockId: string, text: string): BadgeRequest {
  return { blockId, width: text.length * 6.6 + 10, height: BADGE_HEIGHT };
}

function requestsFor(ids: string[], text = '21'): BadgeRequest[] {
  return ids.map((id) => badge(id, text));
}

/** Every (badge, block) pair that shares area. The instrument, used on both anchors. */
function overlapsWithBlocks(
  placed: { blockId: string; x: number; y: number; width: number; height: number }[],
  blocks: BlockBox[]
): string[] {
  const hits: string[] = [];
  for (const badgeRect of placed) {
    for (const block of blocks) {
      if (rectsOverlap(badgeRect, block)) hits.push(badgeRect.blockId + ' badge ∩ ' + block.id);
    }
  }
  return hits;
}

function overlapsBetweenBadges(
  placed: { blockId: string; x: number; y: number; width: number; height: number }[]
): string[] {
  const hits: string[] = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (rectsOverlap(placed[i], placed[j])) hits.push(placed[i].blockId + ' badge ∩ ' + placed[j].blockId + ' badge');
    }
  }
  return hits;
}

describe('VFN-013 — NEGATIVE CONTROL: the anchor as it shipped', () => {
  /**
   * 🔴 If this ever goes green, the instrument below has stopped working and every "no overlap"
   * assertion in this file is vacuous.
   */
  it('puts a nested block’s badge on top of the block it is plugged into', () => {
    const blocks = multiplyFixture();
    const byId = new Map(blocks.map((b) => [b.id, b]));

    const placed = requestsFor(['mul', 'price', 'qty']).map((request) => {
      const box = byId.get(request.blockId)!;
      const at = legacyBadgeAnchor(box, request.width);
      return { blockId: request.blockId, x: at.x, y: at.y, width: request.width, height: request.height };
    });

    const hits = overlapsWithBlocks(placed, blocks);

    // Printed rather than merely counted: the report is about *which* block gets covered.
    // eslint-disable-next-line no-console
    console.log('[VFN-013 negative control] legacy anchor overlaps:', hits);

    expect(hits.length).toBeGreaterThan(0);
    // The `21` on `set output total to […]`, sitting on the statement's own label.
    expect(hits).toContain('price badge ∩ setTotal');
    // The `21` on the multiply block's right operand, half behind the `×` field.
    expect(hits).toContain('qty badge ∩ price');
  });

  it('and pushes a nested badge to the LEFT of its own block, which is what runs off-canvas', () => {
    const price = multiplyFixture().find((b) => b.id === 'price')!;
    const request = badge('price', '21');

    expect(legacyBadgeAnchor(price, request.width).x).toBeLessThan(price.x);
  });
});

describe('VFN-013 criterion 1 — no badge overlaps any block', () => {
  it('on nested arithmetic inside a set-output statement', () => {
    const blocks = multiplyFixture();
    const placements = layoutBadges(blocks, requestsFor(['setTotal', 'mul', 'price', 'qty']));
    const placed = Array.from(placements.values());

    expect(placed.length).toBe(4);

    const hits = overlapsWithBlocks(placed, blocks);
    // eslint-disable-next-line no-console
    console.log(
      '[VFN-013] placements:',
      placed.map((p) => p.blockId + ' → (' + p.dx.toFixed(1) + ',' + p.dy + ') row ' + p.row)
    );

    expect(hits).toEqual([]);
  });

  it('and no badge lands on another badge', () => {
    const blocks = multiplyFixture();
    const placed = Array.from(layoutBadges(blocks, requestsFor(['setTotal', 'mul', 'price', 'qty'])).values());

    expect(overlapsBetweenBadges(placed)).toEqual([]);
  });

  it('with long values, which are the ones that collide', () => {
    const blocks = multiplyFixture();
    const placed = Array.from(
      layoutBadges(blocks, [
        badge('setTotal', '1234567890123'),
        badge('mul', '1234567890123'),
        badge('price', '1234567890123'),
        badge('qty', '1234567890123')
      ]).values()
    );

    expect(overlapsWithBlocks(placed, blocks)).toEqual([]);
    expect(overlapsBetweenBadges(placed)).toEqual([]);
  });

  it('in a two-statement stack, where "above" is another statement', () => {
    const blocks = stackedFixture();
    const placed = Array.from(
      layoutBadges(blocks, requestsFor(['setTotal', 'mul', 'price', 'qty', 'setTotal2', 'mul2', 'price2', 'qty2'])).values()
    );

    // eslint-disable-next-line no-console
    console.log(
      '[VFN-013] stacked placements:',
      placed.map((p) => p.blockId + ' → (' + p.dx.toFixed(1) + ',' + p.dy + ') row ' + p.row)
    );

    expect(overlapsWithBlocks(placed, blocks)).toEqual([]);
    expect(overlapsBetweenBadges(placed)).toEqual([]);
  });

  /**
   * 🔴 The bound that caught the first version of this layout.
   *
   * Climbing straight upwards satisfied every overlap assertion above and put the second
   * statement's operands **76px** from their blocks — legal, and unreadable. "No overlap" is
   * necessary and is not sufficient; a value badge that is four rows away from its value has
   * stopped being a value badge. Interleaving below-before-far-above holds it to one row.
   */
  it('and no badge ends up more than two badge-rows from the block it belongs to', () => {
    const blocks = stackedFixture();
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const placed = Array.from(
      layoutBadges(blocks, requestsFor(['setTotal', 'mul', 'price', 'qty', 'setTotal2', 'mul2', 'price2', 'qty2'])).values()
    );

    const twoRows = 2 * (BADGE_HEIGHT + 3);
    for (const placement of placed) {
      const box = byId.get(placement.blockId)!;
      const gap = placement.y < box.y ? box.y - (placement.y + placement.height) : placement.y - (box.y + box.height);
      expect(gap).toBeLessThanOrEqual(twoRows);
    }
  });
});

describe('VFN-013 criterion 2 — a top-level statement keeps the LGC-003 §5.1 anchor', () => {
  it('to the pixel', () => {
    const blocks = multiplyFixture();
    const request = badge('setTotal', '21');
    const placement = layoutBadges(blocks, [request])!.get('setTotal')!;

    const legacy = legacyBadgeAnchor(blocks[0], request.width);

    expect(placement.x).toBe(legacy.x);
    expect(placement.y).toBe(legacy.y);
    expect(placement.dx).toBe(-(request.width + BADGE_GUTTER));
    expect(placement.dy).toBe(0);
    expect(placement.nested).toBe(false);
    expect(placement.row).toBe(0);
  });

  /**
   * ✅ The two `"7"` badges from the live sweep, the ones that measured NONE. If the fix moved
   * these, it would have discarded the reading the report did not complain about.
   */
  it('and so does an ORPHAN top-level value block, which is what the live sweep measured clean', () => {
    const blocks = liveFixture();
    const placements = layoutBadges(blocks, [badge('orphanA', '7'), badge('orphanB', '7')]);

    for (const id of ['orphanA', 'orphanB']) {
      const placement = placements.get(id)!;
      const box = blocks.find((b) => b.id === id)!;

      expect(placement.nested).toBe(false);
      expect(placement).toMatchObject(legacyBadgeAnchor(box, badge(id, '7').width));
      expect(placement.dy).toBe(0);
    }

    expect(overlapsWithBlocks(Array.from(placements.values()), blocks)).toEqual([]);
  });

  it('and so does a statement stacked under another one — a neighbour is not a container', () => {
    const blocks = stackedFixture();
    const request = badge('setTotal2', '21');
    const placement = layoutBadges(blocks, [request])!.get('setTotal2')!;

    expect(placement.nested).toBe(false);
    expect(placement.dx).toBe(-(request.width + BADGE_GUTTER));
    expect(placement.dy).toBe(0);
  });
});

describe('VFN-013 criterion 4 — a nested badge never reaches left of its own block', () => {
  it('however deep it is, and however wide the badge', () => {
    const blocks = multiplyFixture();
    const placements = layoutBadges(blocks, [
      badge('mul', 'a-very-long-value'),
      badge('price', 'a-very-long-value'),
      badge('qty', 'a-very-long-value')
    ]);

    for (const placement of placements.values()) {
      expect(placement.nested).toBe(true);
      expect(placement.dx).toBeGreaterThanOrEqual(0);
    }
  });

  it('so a block at the workspace origin cannot push its badge off-canvas', () => {
    // The whole program shifted hard left: the statement starts at x = 0.
    const blocks = multiplyFixture();
    const placements = layoutBadges(blocks, requestsFor(['mul', 'price', 'qty']));

    for (const placement of placements.values()) {
      expect(placement.x).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('VFN-013 — the layout is a function, not a state', () => {
  it('is deterministic: the same input twice gives the same answer', () => {
    const blocks = multiplyFixture();
    const requests = requestsFor(['setTotal', 'mul', 'price', 'qty']);

    const first = layoutBadges(blocks, requests);
    const second = layoutBadges(blocks, requests);

    expect(Array.from(second.entries())).toEqual(Array.from(first.entries()));
  });

  it('does not depend on the order requests arrive in', () => {
    const blocks = multiplyFixture();
    const forwards = layoutBadges(blocks, requestsFor(['setTotal', 'mul', 'price', 'qty']));
    const backwards = layoutBadges(blocks, requestsFor(['qty', 'price', 'mul', 'setTotal']));

    for (const id of ['setTotal', 'mul', 'price', 'qty']) {
      expect(backwards.get(id)).toEqual(forwards.get(id));
    }
  });

  it('drops a request for a block that is not in the workspace, silently', () => {
    // LGC-007 inlines a definition's body ids and all, so probes arrive for blocks nobody can
    // see. `BlockValueBadgeLayer.paint` already skips those; the layout must not invent a box.
    const placements = layoutBadges(multiplyFixture(), requestsFor(['price', 'a-block-from-an-inlined-definition']));

    expect(placements.has('price')).toBe(true);
    expect(placements.has('a-block-from-an-inlined-definition')).toBe(false);
  });

  it('counts nesting depth through the surround chain', () => {
    const byId = new Map(multiplyFixture().map((b) => [b.id, b]));

    expect(nestingDepth('setTotal', byId)).toBe(0);
    expect(nestingDepth('mul', byId)).toBe(1);
    expect(nestingDepth('price', byId)).toBe(2);
  });

  it('survives a malformed surround chain rather than hanging the paint', () => {
    const cyclic: BlockBox[] = [
      { id: 'a', x: 0, y: 0, width: 10, height: 10, surroundId: 'b' },
      { id: 'b', x: 0, y: 0, width: 10, height: 10, surroundId: 'a' }
    ];

    expect(nestingDepth('a', new Map(cyclic.map((b) => [b.id, b])))).toBeLessThan(5);
    expect(() => layoutBadges(cyclic, requestsFor(['a', 'b']))).not.toThrow();
  });
});
