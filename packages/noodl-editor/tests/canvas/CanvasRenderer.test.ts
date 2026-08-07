import { CanvasRenderer, FrameState } from '../../src/editor/src/views/nodegrapheditor/canvas/CanvasRenderer';

function makeCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 800;
  return canvas.getContext('2d');
}

type PaintCall = { kind: string; alpha: number };

function stubNode(id: string, calls: PaintCall[], children: TSFixme[] = []) {
  return {
    id,
    global: { x: 0, y: 0 },
    nodeSize: { width: 100, height: 40 },
    children,
    titlebarHeight: () => 20,
    paint(ctx: CanvasRenderingContext2D) {
      calls.push({ kind: `node:${id}`, alpha: ctx.globalAlpha });
    }
  } as TSFixme;
}

function stubConnection(id: string, calls: PaintCall[], highlighted = false) {
  return {
    isHighlighted: () => highlighted,
    fromNode: undefined,
    toNode: undefined,
    paint(ctx: CanvasRenderingContext2D) {
      calls.push({ kind: `con:${id}`, alpha: ctx.globalAlpha });
    }
  } as TSFixme;
}

function baseFrame(overrides: Partial<FrameState>): FrameState {
  return {
    panAndScale: { scale: 1, x: 0, y: 0 },
    canvasWidth: 400,
    canvasHeight: 800,
    ratio: 1,
    roots: [],
    connections: [],
    ...overrides
  };
}

describe('CanvasRenderer', () => {
  let renderer: CanvasRenderer;
  let ctx: CanvasRenderingContext2D;
  let calls: PaintCall[];

  beforeEach(() => {
    renderer = new CanvasRenderer();
    ctx = makeCtx();
    calls = [];
  });

  it('paints connections before nodes, and highlighted connections again on top', () => {
    const n1 = stubNode('n1', calls);
    const c1 = stubConnection('c1', calls);
    const c2 = stubConnection('c2', calls, true);

    renderer.paint(ctx, baseFrame({ roots: [n1], connections: [c1, c2] }));

    expect(calls.map((c) => c.kind)).toEqual(['con:c1', 'con:c2', 'con:c2', 'node:n1']);
  });

  it('skips dragging nodes in the main pass and ghosts them at half alpha afterwards', () => {
    const n1 = stubNode('n1', calls);
    const n2 = stubNode('n2', calls);

    renderer.paint(ctx, baseFrame({ roots: [n1, n2], draggingNodes: [n2] }));

    expect(calls.map((c) => c.kind)).toEqual(['node:n1', 'node:n2']);
    expect(calls[0].alpha).toBe(1);
    expect(calls[1].alpha).toBe(0.5);
  });

  it('restores globalAlpha to 1 after painting a frame with drag ghosts', () => {
    const n1 = stubNode('n1', calls);
    renderer.paint(ctx, baseFrame({ roots: [n1], draggingNodes: [n1] }));
    expect(ctx.globalAlpha).toBe(1);
  });

  it('draws the rubber-band rect only while a rect-select is in progress', () => {
    const rectSpy = spyOn(ctx, 'rect').and.callThrough();

    renderer.paint(ctx, baseFrame({}));
    expect(rectSpy).not.toHaveBeenCalled();

    renderer.paint(
      ctx,
      baseFrame({ multiselectMouseDown: { x: 10, y: 20 }, multiselectMouseMove: { x: 110, y: 220 } })
    );
    expect(rectSpy).toHaveBeenCalledWith(10, 20, 100, 200);
  });

  it('draws the multiselect box when a multiselect AABB is provided', () => {
    const strokeRectSpy = spyOn(ctx, 'strokeRect').and.callThrough();

    renderer.paint(ctx, baseFrame({ multiselectAABB: { minX: 0, minY: 0, maxX: 100, maxY: 50 } }));

    // box is drawn with 8px padding around the AABB
    expect(strokeRectSpy).toHaveBeenCalledWith(-8, -8, 116, 66);
  });

  it('paints a dragging connection line toward the mouse when there is no target node', () => {
    const from = stubNode('from', calls);
    const strokeSpy = spyOn(ctx, 'stroke').and.callThrough();

    renderer.paint(
      ctx,
      baseFrame({
        roots: [from],
        draggingConnection: { fromNode: from, mouseTarget: { global: { x: 300, y: 300 } } }
      })
    );

    expect(strokeSpy).toHaveBeenCalled();
  });
});
