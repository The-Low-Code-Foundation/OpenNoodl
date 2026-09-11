import { NodeGraphEditorNode } from '../../src/editor/src/views/nodegrapheditor/NodeGraphEditorNode';
import { paintNode } from '../../src/editor/src/views/nodegrapheditor/NodeGraphEditorNodePainter';

/**
 * FIX-018 — a component says it can be entered.
 *
 * Pixel assertions, for the same reason CAN-004's stripe test uses them: the
 * claim is about what a user can see on the canvas, and both halves of this fix
 * are pure paint. Spying on the calls would prove the painter was *asked* to
 * draw a mark, which is not the thing that was broken.
 *
 * The two halves are tested apart because they fail apart. The **chip** says
 * "component"; before the fix it inherited the hue of the component's own root
 * node, so a component wrapping a Group was pixel-identical to a Group. The
 * **stacked edge** says "and you can open it"; it is the only mark that
 * distinguishes an instance from the component *plumbing* nodes, which keep
 * their purple by ruling.
 */

const CARD = { x: 20, y: 30 };
const CARD_HEIGHT = 80;
const TITLEBAR_HEIGHT = 36;

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 200;
  return canvas;
}

/**
 * @param isComponent  whether the node is a component *instance*
 * @param color        the node type's own colour — for an instance this is what
 *                     `ComponentModel.get color()` inherited from its root node,
 *                     which is exactly what the fix has to override
 */
function stubNode({
  isComponent,
  color = 'visual',
  healthy = true,
  colorOverride
}: {
  isComponent: boolean;
  color?: string;
  healthy?: boolean;
  colorOverride?: string;
}) {
  return {
    global: { ...CARD },
    nodeSize: { width: NodeGraphEditorNode.size.width, height: CARD_HEIGHT },
    children: [],
    plugs: [],
    selected: false,
    icon: undefined,
    updateIcon() {
      /* icons need a live editor; the marks under test do not */
    },
    titlebarHeight: () => TITLEBAR_HEIGHT,
    titlebarLabelHeight: () => 14,
    typeDisplayName: () => 'Card',
    labelText: () => 'Card',
    isComponent: () => isComponent,
    owner: { isHighlighted: () => false },
    model: {
      label: 'Card',
      type: { name: 'Card', displayName: 'Card', color },
      metadata: colorOverride ? { colorOverride } : {},
      annotation: undefined,
      hasComment: () => false,
      getComment: () => undefined,
      getHealth: () => (healthy ? { healthy: true } : { healthy: false, level: 'warning' })
    }
  } as TSFixme;
}

function paint(node: TSFixme) {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  paintNode(node, ctx, { minX: 0, minY: 0, maxX: 300, maxY: 200 });
  return ctx;
}

function pixel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const d = ctx.getImageData(x, y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

const OFFSET = NodeGraphEditorNode.stackedCardEdgeOffset;
const WIDTH = NodeGraphEditorNode.size.width;

/** In the band right of the card, level with its middle — back card, not front. */
const rightBand = (ctx: CanvasRenderingContext2D) => pixel(ctx, CARD.x + WIDTH + 1, CARD.y + CARD_HEIGHT / 2);
/** In the band below the card, halfway across. */
const bottomBand = (ctx: CanvasRenderingContext2D) => pixel(ctx, CARD.x + WIDTH / 2, CARD.y + CARD_HEIGHT + 1);
/** Outside the card's left edge — the stacked edge must never appear here. */
const leftOfCard = (ctx: CanvasRenderingContext2D) => pixel(ctx, CARD.x - 2, CARD.y + CARD_HEIGHT / 2);
/** Above the card's top edge — likewise. */
const aboveCard = (ctx: CanvasRenderingContext2D) => pixel(ctx, CARD.x + WIDTH / 2, CARD.y - 2);
/**
 * Inside the header chip, left of centre so the category glyph (drawn within
 * ±5.5px of the chip centre) cannot be what is sampled.
 */
const chipFill = (ctx: CanvasRenderingContext2D) =>
  pixel(ctx, CARD.x + NodeGraphEditorNode.headerChipInset + 4, CARD.y + NodeGraphEditorNode.headerChipInset + 11);

const sameColor = (a: TSFixme, b: TSFixme) => a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;

describe('FIX-018 component instance mark', () => {
  describe('the stacked-card edge', () => {
    it('paints a band right of and below a component instance', () => {
      const ctx = paint(stubNode({ isComponent: true }));

      expect(rightBand(ctx).a).toBe(255);
      expect(bottomBand(ctx).a).toBe(255);
    });

    it('leaves that band empty for a node that cannot be opened', () => {
      const ctx = paint(stubNode({ isComponent: false }));

      expect(rightBand(ctx).a).toBe(0);
      expect(bottomBand(ctx).a).toBe(0);
    });

    it('stays bottom-right, clear of the unhealthy ring and the selection glow', () => {
      // Those two are painted later and centred on the card edge; an edge on the
      // left or top would be drawn over rather than merely tinted.
      const ctx = paint(stubNode({ isComponent: true }));

      expect(leftOfCard(ctx).a).toBe(0);
      expect(aboveCard(ctx).a).toBe(0);
    });

    it('survives selection, which paints its glow at 15% alpha over the band', () => {
      const node = stubNode({ isComponent: true });
      node.selected = true;

      expect(rightBand(paint(node)).a).toBe(255);
    });

    it('still marks an unhealthy component — the two facts are independent now', () => {
      // The regression this replaces: component-ness and unhealthiness shared one
      // icon slot, so a broken component stopped looking enterable.
      const ctx = paint(stubNode({ isComponent: true, healthy: false }));

      expect(rightBand(ctx).a).toBe(255);
    });

    it('is paint, not hit area — the offset stays well inside the grab border', () => {
      expect(OFFSET).toBeLessThan(NodeGraphEditorNode.borderSize);
    });
  });

  describe('the header chip', () => {
    it('paints a component instance as component, not as the hue it inherited', () => {
      const instance = chipFill(paint(stubNode({ isComponent: true, color: 'visual' })));
      const plainVisual = chipFill(paint(stubNode({ isComponent: false, color: 'visual' })));

      expect(sameColor(instance, plainVisual)).toBe(false);
    });

    it('paints it the same as anything else in the component category', () => {
      // Purple means "component-related" by ruling: the plumbing nodes keep it,
      // and the stacked edge above is what separates an instance from them.
      const instance = chipFill(paint(stubNode({ isComponent: true, color: 'visual' })));
      const plumbing = chipFill(paint(stubNode({ isComponent: false, color: 'component' })));

      expect(sameColor(instance, plumbing)).toBe(true);
    });

    it('reaches a logic-only component too, which used to paint grey', () => {
      const logicOnly = chipFill(paint(stubNode({ isComponent: true, color: undefined })));
      const plainDefault = chipFill(paint(stubNode({ isComponent: false, color: undefined })));

      expect(sameColor(logicOnly, plainDefault)).toBe(false);
    });

    it('yields to an explicit colorOverride, which is somebody saying so on purpose', () => {
      const overridden = paint(stubNode({ isComponent: true, color: 'visual', colorOverride: 'data' }));
      const plainData = chipFill(paint(stubNode({ isComponent: false, color: 'data' })));

      expect(sameColor(chipFill(overridden), plainData)).toBe(true);
      // ...but the affordance is structural and survives the override.
      expect(rightBand(overridden).a).toBe(255);
    });
  });
});
