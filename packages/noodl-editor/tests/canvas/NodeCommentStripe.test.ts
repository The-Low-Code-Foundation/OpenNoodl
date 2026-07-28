import { CanvasTheme } from '../../src/editor/src/views/nodegrapheditor/canvas/CanvasTheme';
import { NodeGraphEditorNode } from '../../src/editor/src/views/nodegrapheditor/NodeGraphEditorNode';
import { paintNode } from '../../src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter';

/**
 * CAN-004 — the comment gutter stripe.
 *
 * Pixel assertions rather than call spies: the whole point of the stripe is
 * that it is visible without hovering and that it does not sit on top of the
 * title, and both of those are claims about what ends up on the canvas.
 */

const CARD = { x: 20, y: 30 };
const TITLEBAR_HEIGHT = 36;

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 200;
  return canvas;
}

function stubNode({ hasComment, comment = 'why this node exists' }: { hasComment: boolean; comment?: string }) {
  return {
    global: { ...CARD },
    nodeSize: { width: NodeGraphEditorNode.size.width, height: 80 },
    children: [],
    plugs: [],
    selected: false,
    icon: undefined,
    updateIcon() {
      /* icons need a live editor; the stripe does not */
    },
    titlebarHeight: () => TITLEBAR_HEIGHT,
    titlebarLabelHeight: () => 14,
    typeDisplayName: () => 'Group',
    owner: { isHighlighted: () => false },
    model: {
      label: 'Group',
      type: { name: 'Group', displayName: 'Group', color: 'visual' },
      metadata: {},
      annotation: undefined,
      hasComment: () => hasComment,
      getComment: () => (hasComment ? comment : undefined),
      getHealth: () => ({ healthy: true })
    }
  } as TSFixme;
}

function paint(node: TSFixme) {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  paintNode(node, ctx, { minX: 0, minY: 0, maxX: 300, maxY: 200 });
  return ctx;
}

/** The pixel one point into the gutter, halfway down the titlebar. */
function gutterPixel(ctx: CanvasRenderingContext2D) {
  const d = ctx.getImageData(CARD.x + 1, CARD.y + TITLEBAR_HEIGHT / 2, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

function expectedStripeColor() {
  const parsed = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(CanvasTheme.instance.colors.commentIndicator);
  if (!parsed) return undefined;
  return { r: parseInt(parsed[1], 16), g: parseInt(parsed[2], 16), b: parseInt(parsed[3], 16) };
}

describe('CAN-004 node comment stripe', () => {
  it('paints the stripe in the gutter when the node has a comment', () => {
    const ctx = paint(stubNode({ hasComment: true }));
    const px = gutterPixel(ctx);
    const expected = expectedStripeColor();

    expect(px.a).toBe(255);
    if (expected) {
      // Tolerance for the canvas' own rounding, not for a different colour.
      expect(Math.abs(px.r - expected.r)).toBeLessThan(3);
      expect(Math.abs(px.g - expected.g)).toBeLessThan(3);
      expect(Math.abs(px.b - expected.b)).toBeLessThan(3);
    }
  });

  it('leaves the gutter as card body when the node has no comment', () => {
    const withComment = gutterPixel(paint(stubNode({ hasComment: true })));
    const without = gutterPixel(paint(stubNode({ hasComment: false })));

    expect(without.r === withComment.r && without.g === withComment.g && without.b === withComment.b).toBe(false);
  });

  it('does not paint the stripe merely because the node is highlighted (F51)', () => {
    const node = stubNode({ hasComment: false });
    node.owner = { isHighlighted: () => true };

    const highlighted = gutterPixel(paint(node));
    const commented = gutterPixel(paint(stubNode({ hasComment: true })));

    expect(
      highlighted.r === commented.r && highlighted.g === commented.g && highlighted.b === commented.b
    ).toBe(false);
  });

  it('keeps the stripe clear of the title text inset', () => {
    // The gutter ends well before the header chip, which is itself before the
    // title — so the stripe can never overlap the title (F50).
    expect(NodeGraphEditorNode.commentStripeWidth).toBeLessThan(NodeGraphEditorNode.headerChipInset);
    expect(NodeGraphEditorNode.headerChipInset).toBeLessThan(NodeGraphEditorNode.headerTextInset);
  });
});
