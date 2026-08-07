import { CanvasViewport } from '../../src/editor/src/views/nodegrapheditor/canvas/CanvasViewport';

describe('CanvasViewport', () => {
  let vp: CanvasViewport;

  beforeEach(() => {
    vp = new CanvasViewport();
    // 400x800 CSS pixels at a device pixel ratio of 2
    vp.setCanvasMetrics(800, 1600, 2);
  });

  it('exposes CSS dimensions from device pixels and ratio', () => {
    expect(vp.cssWidth).toBe(400);
    expect(vp.cssHeight).toBe(800);
  });

  it('canvasToGraph divides by scale then subtracts pan', () => {
    expect(vp.canvasToGraph({ x: 200, y: 400 }, { scale: 0.5, x: 100, y: 50 })).toEqual({ x: 300, y: 750 });
    expect(vp.canvasToGraph({ x: 123, y: 456 }, { scale: 1, x: 0, y: 0 })).toEqual({ x: 123, y: 456 });
  });

  it('updateGraphAABB unions rects and stores the result', () => {
    const aabb = vp.updateGraphAABB([
      { x: 49, y: 75, width: 120, height: 40 },
      { x: 49, y: 267, width: 100, height: 30 }
    ]);
    expect(aabb).toEqual({ minX: 49, minY: 75, maxX: 169, maxY: 297 });
    expect(vp.graphAABB).toBe(aabb);
  });

  it('updateGraphAABB with no rects leaves an inverted (empty) AABB', () => {
    const aabb = vp.updateGraphAABB([]);
    expect(aabb.minX).toBe(Number.MAX_VALUE);
    expect(aabb.maxX).toBe(-Number.MAX_VALUE);
  });

  it('rectsAABB unions node rects', () => {
    const aabb = CanvasViewport.rectsAABB([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 50, y: -20, width: 10, height: 10 }
    ]);
    expect(aabb).toEqual({ minX: 0, minY: -20, maxX: 60, maxY: 10 });
  });

  it('centerOn returns the pan that centers the average rect center at scale 1', () => {
    const ps = vp.centerOn([
      { x: 0, y: 0, width: 100, height: 100 }, // center (50, 50)
      { x: 100, y: 100, width: 100, height: 100 } // center (150, 150)
    ]);
    // average center (100, 100); canvas center (200, 400)
    expect(ps).toEqual({ x: 100, y: 300, scale: 1 });
  });

  it('zoomAtPoint scales by 0.95^-deltaZ and keeps the cursor point fixed', () => {
    vp.updateGraphAABB([{ x: 49, y: 75, width: 120, height: 240 }]);

    const ps = vp.zoomAtPoint(200, 400, -1, { scale: 1, x: 0, y: 0 });
    expect(ps.scale).toBeCloseTo(0.95, 10);
    expect(ps.x).toBeCloseTo(200 / 0.95 - 200, 6);
    expect(ps.y).toBeCloseTo(400 / 0.95 - 400, 6);

    // The graph point under the cursor is invariant
    const before = vp.canvasToGraph({ x: 200, y: 400 }, { scale: 1, x: 0, y: 0 });
    const after = vp.canvasToGraph({ x: 200, y: 400 }, ps);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('zoomAtPoint clamps zoom-in at scale 1', () => {
    vp.updateGraphAABB([{ x: 49, y: 75, width: 120, height: 240 }]);
    const ps = vp.zoomAtPoint(200, 400, 5, { scale: 1, x: 0, y: 0 });
    expect(ps.scale).toBe(1);
    expect(ps.x).toBe(0);
    expect(ps.y).toBe(0);
  });

  it('zoomAtPoint clamps zoom-out at 0.33 when the graph is smaller than the canvas', () => {
    vp.updateGraphAABB([{ x: 49, y: 75, width: 120, height: 240 }]);
    let ps = { scale: 1, x: 0, y: 0 };
    for (let i = 0; i < 50; i++) {
      ps = vp.zoomAtPoint(200, 400, -3, ps);
    }
    expect(ps.scale).toBeCloseTo(0.33, 10);
  });

  it('zoomAtPoint lets a huge graph zoom out past 0.33 to fit with padding', () => {
    vp.updateGraphAABB([{ x: 0, y: 0, width: 4000, height: 100 }]);
    let ps = { scale: 1, x: 0, y: 0 };
    for (let i = 0; i < 100; i++) {
      ps = vp.zoomAtPoint(200, 400, -3, ps);
    }
    // minXScale = 400 / (4000 + 400)
    expect(ps.scale).toBeCloseTo(400 / 4400, 10);
  });

  it('clamp keeps 100 visible pixels of graph at each border and mutates in place', () => {
    vp.updateGraphAABB([{ x: 49, y: 75, width: 120, height: 240 }]);

    const far = { scale: 1, x: 10000, y: 0 };
    const clamped = vp.clamp(far);
    expect(clamped).toBe(far); // in-place semantics
    expect(clamped.x).toBe(400 - 49 - 100);
    expect(clamped.y).toBe(0);

    expect(vp.clamp({ scale: 1, x: -10000, y: 0 }).x).toBe(100 - 169);
    expect(vp.clamp({ scale: 1, x: 0, y: 10000 }).y).toBe(800 - 75 - 100);
    expect(vp.clamp({ scale: 1, x: 0, y: -10000 }).y).toBe(100 - 315);
  });

  it('clamp accounts for scale when computing the visible canvas size', () => {
    vp.updateGraphAABB([{ x: 49, y: 75, width: 120, height: 240 }]);
    // at scale 0.5 the canvas covers 800 graph units horizontally
    expect(vp.clamp({ scale: 0.5, x: 10000, y: 0 }).x).toBe(800 - 49 - 100);
  });

  it('a no-op clamp leaves the pan untouched', () => {
    vp.updateGraphAABB([{ x: 49, y: 75, width: 120, height: 240 }]);
    expect(vp.clamp({ scale: 1, x: 0, y: 0 })).toEqual({ scale: 1, x: 0, y: 0 });
  });
});
