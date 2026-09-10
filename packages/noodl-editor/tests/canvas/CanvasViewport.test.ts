import { CanvasViewport } from '../../src/editor/src/views/nodegrapheditor/canvas/CanvasViewport';
import { PanAndScale } from '../../src/editor/src/views/nodegrapheditor/canvas/types';

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

  // ------------------------------------------------------------------ FLD-006
  //
  // "Fit view" (#33). The reverted arm is not a patched copy of the source —
  // the pre-fix behaviour is still a method on this class. `centerOn` IS what
  // the button used to call, so every fit assertion below is paired with the
  // same fixture through `centerOn`, and the pair is what distinguishes the two
  // separate faults: the literal `scale: 1`, and the centroid-instead-of-box.

  /** Where the bounding box lands on the canvas, in CSS pixels. */
  function boxOnCanvas(rects: { x: number; y: number; width: number; height: number }[], ps: PanAndScale) {
    const aabb = CanvasViewport.rectsAABB(rects);
    return {
      left: (aabb.minX + ps.x) * ps.scale,
      right: (aabb.maxX + ps.x) * ps.scale,
      top: (aabb.minY + ps.y) * ps.scale,
      bottom: (aabb.maxY + ps.y) * ps.scale
    };
  }

  /** The graph point the camera has put in the middle of the canvas. */
  function graphPointAtCanvasCenter(ps: PanAndScale) {
    return vp.canvasToGraph({ x: vp.cssWidth / 2, y: vp.cssHeight / 2 }, ps);
  }

  describe('fitTo (FLD-006 — fit view actually fits)', () => {
    // Wider than the 400x800 pane, so a fit MUST leave scale 1.
    const wide = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 1100, y: 100, width: 100, height: 100 }
    ];

    it('returns a scale below 1 and puts the whole box inside the pane', () => {
      vp.updateGraphAABB(wide);

      const ps = vp.fitTo(wide);

      expect(ps.scale).toBeLessThan(1);

      const box = boxOnCanvas(wide, ps);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(vp.cssWidth);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(vp.cssHeight);
    });

    it('REVERTED ARM: the same fixture through centerOn is at scale 1 and hangs off both edges', () => {
      const reverted = vp.centerOn(wide);

      expect(reverted.scale).toBe(1);

      const box = boxOnCanvas(wide, reverted);
      expect(box.left).toBeLessThan(0);
      expect(box.right).toBeGreaterThan(vp.cssWidth);
    });

    it('leaves the requested screen-space margin when the zoom floor does not bind', () => {
      // 500 graph units wide: both paddings below stay above minScale, so the
      // margin is the one that was asked for.
      const moderate = [
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 400, y: 0, width: 100, height: 100 }
      ];
      vp.updateGraphAABB(moderate);

      const box = boxOnCanvas(moderate, vp.fitTo(moderate, 40));
      expect(box.left).toBeCloseTo(40, 6);
      expect(box.right).toBeCloseTo(vp.cssWidth - 40, 6);

      // The padding is in canvas pixels, so a bigger one is a bigger *screen*
      // margin regardless of the scale it forces.
      const tighter = boxOnCanvas(moderate, vp.fitTo(moderate, 80));
      expect(tighter.left).toBeCloseTo(80, 6);
      expect(tighter.right).toBeCloseTo(vp.cssWidth - 80, 6);
    });

    it('gives up margin, never the floor, when the two disagree', () => {
      // `wide` is 1200 units in a 400px pane. 40px of padding asks for 0.2667
      // and clears the floor of 0.25; 80px asks for 0.2, which does not — and
      // the floor wins. That is the documented trade: the margin shrinks, the
      // box still fits, and the camera stays somewhere the zoom buttons agree
      // with. Asserting the full 80px here would be asserting the wrong side
      // of the decision this task made on purpose.
      vp.updateGraphAABB(wide);

      const asked = boxOnCanvas(wide, vp.fitTo(wide, 40));
      expect(asked.left).toBeCloseTo(40, 6); // floor clear: margin honoured

      const floored = vp.fitTo(wide, 80);
      expect(floored.scale).toBeCloseTo(vp.minScale(), 10);

      const box = boxOnCanvas(wide, floored);
      expect(box.left).toBeGreaterThan(0);
      expect(box.left).toBeLessThan(80); // margin given up...
      expect(box.right).toBeLessThanOrEqual(vp.cssWidth); // ...box still fits
    });

    it('centres the bounding box, not the centroid, on an asymmetric graph', () => {
      // Eight nodes in a dense cluster on the left, two far outliers on the
      // right. The centroid of the node centres sits inside the cluster; the
      // centre of the bounding box is nowhere near it.
      const asymmetric = [];
      for (let i = 0; i < 8; i++) asymmetric.push({ x: i * 10, y: i * 10, width: 40, height: 40 });
      asymmetric.push({ x: 1000, y: 0, width: 40, height: 40 });
      asymmetric.push({ x: 1100, y: 0, width: 40, height: 40 });

      vp.updateGraphAABB(asymmetric);

      const aabb = CanvasViewport.rectsAABB(asymmetric);
      const boxCenterX = (aabb.minX + aabb.maxX) / 2; // 570
      const boxCenterY = (aabb.minY + aabb.maxY) / 2;

      const fitted = graphPointAtCanvasCenter(vp.fitTo(asymmetric));
      expect(fitted.x).toBeCloseTo(boxCenterX, 6);
      expect(fitted.y).toBeCloseTo(boxCenterY, 6);

      // REVERTED ARM: centerOn lands on the centroid, hundreds of graph units
      // away — this is the fault a scale-only fix would leave in place.
      const centroid = graphPointAtCanvasCenter(vp.centerOn(asymmetric));
      expect(Math.abs(centroid.x - boxCenterX)).toBeGreaterThan(200);

      // And the box still does not fit, even though the camera moved.
      const box = boxOnCanvas(asymmetric, vp.centerOn(asymmetric));
      expect(box.right).toBeGreaterThan(vp.cssWidth);
    });

    it('never returns a scale below the floor the zoom buttons enforce', () => {
      // 4000 graph units wide in a 400px pane: 40px of padding each side asks
      // for a scale under zoomAtPoint's minScale.
      const huge = [
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 3900, y: 0, width: 100, height: 100 }
      ];
      vp.updateGraphAABB(huge);

      const floor = vp.minScale();
      const unflooredScale = (vp.cssWidth - 80) / 4000; // what the padding alone asks for
      expect(unflooredScale).toBeLessThan(floor); // the floor is load-bearing here, not decoration

      const ps = vp.fitTo(huge);
      expect(ps.scale).toBeGreaterThanOrEqual(floor);
      expect(ps.scale).toBeCloseTo(floor, 10);

      // A zoom-out step from the fit does not jump *in* — the whole point of
      // the floor. Without it the camera sits below minScale and the first
      // click of the minus button zooms the user back in.
      const afterZoomOut = vp.zoomAtPoint(vp.cssWidth / 2, vp.cssHeight / 2, -1, ps);
      expect(afterZoomOut.scale).toBeLessThanOrEqual(ps.scale);

      // REVERTED ARM: the unfloored scale is exactly the jump.
      const unfloored = { scale: unflooredScale, x: 0, y: 0 };
      expect(vp.zoomAtPoint(vp.cssWidth / 2, vp.cssHeight / 2, -1, unfloored).scale).toBeGreaterThan(unflooredScale);

      // The floor still fits the box — a tighter margin, never an overflow.
      const box = boxOnCanvas(huge, ps);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(vp.cssWidth);
    });

    it('is deterministic — a second fit returns the same camera, computed rather than literal', () => {
      vp.updateGraphAABB(wide);

      const once = vp.fitTo(wide);
      const twice = vp.fitTo(wide);
      expect(twice).toEqual(once);
      // ...but it got there by computing, not by returning a literal.
      expect(once.scale).not.toBe(1);
    });

    it('does not zoom in past 1 on a graph smaller than the pane', () => {
      const small = [{ x: 0, y: 0, width: 40, height: 40 }];
      vp.updateGraphAABB(small);

      const ps = vp.fitTo(small);
      expect(ps.scale).toBe(1);
      expect(graphPointAtCanvasCenter(ps).x).toBeCloseTo(20, 6);
    });

    it('an empty component returns the identity camera instead of NaN', () => {
      const ps = vp.fitTo([]);
      expect(ps).toEqual({ x: 0, y: 0, scale: 1 });

      // REVERTED ARM: centerOn divides by zero on the same input.
      expect(Number.isNaN(vp.centerOn([]).x)).toBe(true);
    });

    it('imposes no floor before a layout has filled in the graph bounds', () => {
      // graphAABB is inverted until CanvasPainter.calculateAABB runs. minScale
      // is meaningless there, so fitTo must not read it.
      expect(vp.hasGraphBounds()).toBe(false);

      const ps = vp.fitTo(wide);
      const box = boxOnCanvas(wide, ps);
      expect(box.left).toBeCloseTo(40, 6);
      expect(box.right).toBeCloseTo(vp.cssWidth - 40, 6);
    });
  });

  it('minScale is the same number zoomAtPoint clamps to', () => {
    // The extraction is only worth anything if the two cannot drift.
    vp.updateGraphAABB([{ x: 0, y: 0, width: 4000, height: 100 }]);
    expect(vp.minScale()).toBeCloseTo(400 / 4400, 10);

    let ps = { scale: 1, x: 0, y: 0 };
    for (let i = 0; i < 100; i++) ps = vp.zoomAtPoint(200, 400, -3, ps);
    expect(ps.scale).toBeCloseTo(vp.minScale(), 10);
  });
});
