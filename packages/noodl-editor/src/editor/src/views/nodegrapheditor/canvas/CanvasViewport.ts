import { AABB, PanAndScale, Rect } from './types';

/**
 * Pan/zoom state and coordinate math for the node graph canvas.
 *
 * Pure model — no DOM, no jQuery, no back-reference to the editor. The editor
 * owns side effects (repainting, syncing the comment layer and overlays) and
 * calls in here for the math. All formulas are characterised by
 * tests/nodegraph/canvas-characterisation.spec.js and unit-tested directly in
 * tests/canvas/CanvasViewport.test.ts.
 *
 * Conventions (unchanged from the pre-decomposition code):
 * - `panAndScale` maps graph coordinates to canvas CSS pixels:
 *   canvas = (graph + pan) * scale, so graph = canvas / scale - pan.
 * - `canvasWidth`/`canvasHeight` are device pixels; divide by `ratio` for CSS
 *   pixels.
 * - Zoom is clamped to [minScale, 1] where minScale fits the whole graph plus
 *   padding, but never above 0.33 (so some zoom-out is always possible).
 */
export class CanvasViewport {
  /** Undefined means "not set yet" — the editor falls back to center-to-fit. */
  panAndScale?: PanAndScale;

  /** Canvas size in device pixels, and the device pixel ratio. */
  canvasWidth = NaN;
  canvasHeight = NaN;
  ratio = NaN;

  /** Bounds of the whole graph (nodes + comments) in graph coordinates. */
  graphAABB: AABB = CanvasViewport.emptyAABB();

  static readonly ZoomStep = 0.95;
  static readonly MinScale = 0.33;
  static readonly MaxScale = 1;
  static readonly ScalePadding = 200;
  static readonly ClampPadding = 100;

  static emptyAABB(): AABB {
    return {
      minX: Number.MAX_VALUE,
      maxX: -Number.MAX_VALUE,
      minY: Number.MAX_VALUE,
      maxY: -Number.MAX_VALUE
    };
  }

  static devicePixelRatio(ctx: CanvasRenderingContext2D): number {
    const dpr = window.devicePixelRatio || 1;
    const anyCtx = ctx as TSFixme;
    const bsr =
      anyCtx.webkitBackingStorePixelRatio ||
      anyCtx.mozBackingStorePixelRatio ||
      anyCtx.msBackingStorePixelRatio ||
      anyCtx.oBackingStorePixelRatio ||
      anyCtx.backingStorePixelRatio ||
      1;
    return dpr / bsr;
  }

  setCanvasMetrics(width: number, height: number, ratio: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.ratio = ratio;
  }

  /** Canvas size in CSS pixels. */
  get cssWidth() {
    return this.canvasWidth / this.ratio;
  }

  get cssHeight() {
    return this.canvasHeight / this.ratio;
  }

  /** Convert canvas-relative CSS pixel coordinates to graph coordinates. */
  canvasToGraph(pos: { x: number; y: number }, panAndScale: PanAndScale): { x: number; y: number } {
    return {
      x: pos.x / panAndScale.scale - panAndScale.x,
      y: pos.y / panAndScale.scale - panAndScale.y
    };
  }

  /**
   * Recompute the graph AABB from node and comment rectangles.
   * Rects are in graph coordinates (nodes: root position + measured size).
   */
  updateGraphAABB(rects: Rect[]) {
    const aabb = CanvasViewport.emptyAABB();
    for (const r of rects) {
      if (r.x < aabb.minX) aabb.minX = r.x;
      if (r.x + r.width > aabb.maxX) aabb.maxX = r.x + r.width;
      if (r.y < aabb.minY) aabb.minY = r.y;
      if (r.y + r.height > aabb.maxY) aabb.maxY = r.y + r.height;
    }
    this.graphAABB = aabb;
    return aabb;
  }

  /** Union AABB of a non-empty list of rects (does not touch stored state). */
  static rectsAABB(rects: readonly Rect[]): AABB {
    const first = rects[0];
    const aabb = {
      minX: first.x,
      minY: first.y,
      maxX: first.x + first.width,
      maxY: first.y + first.height
    };
    for (let i = 1; i < rects.length; i++) {
      const r = rects[i];
      aabb.minX = Math.min(aabb.minX, r.x);
      aabb.minY = Math.min(aabb.minY, r.y);
      aabb.maxX = Math.max(aabb.maxX, r.x + r.width);
      aabb.maxY = Math.max(aabb.maxY, r.y + r.height);
    }
    return aabb;
  }

  /**
   * Pan that puts the average center of the given rects in the middle of the
   * canvas, at scale 1.
   */
  centerOn(rects: readonly Rect[]): PanAndScale {
    let centerX = 0;
    let centerY = 0;
    let count = 0;

    for (const r of rects) {
      centerX += r.x + r.width / 2;
      centerY += r.y + r.height / 2;
      count++;
    }

    return {
      x: this.cssWidth / 2 - centerX / count,
      y: this.cssHeight / 2 - centerY / count,
      scale: 1
    };
  }

  /**
   * Zoom by `deltaZ` steps keeping the graph point under the canvas position
   * (x, y) stationary. Returns the new pan and scale, unclamped — the caller
   * clamps, because clamping is guarded on the model being non-empty and that
   * guard lives with the editor. Mirrors the original `updateZoomLevel`.
   */
  zoomAtPoint(x: number, y: number, deltaZ: number, panAndScale: PanAndScale): PanAndScale {
    const oldScale = panAndScale.scale;

    // Scale by multiplying with a factor to make zooming linear
    // (e.g. 0.5->0.6 is 20% increase, 1.0 -> 1.1 is only 10%)
    let scale = oldScale * Math.pow(CanvasViewport.ZoomStep, -deltaZ);

    // Restrict scaling to max 1, and minimum so you can see the entire
    // component plus some padding OR 0.33 (to always allow some zoom)
    const graphAABB = this.graphAABB;
    const padding = CanvasViewport.ScalePadding;

    const minXScale = this.cssWidth / (graphAABB.maxX - graphAABB.minX + 2 * padding);
    const minYScale = this.cssHeight / (graphAABB.maxY - graphAABB.minY + 2 * padding);
    const minScale = Math.min(minXScale, minYScale, CanvasViewport.MinScale);
    scale = Math.max(minScale, Math.min(CanvasViewport.MaxScale, scale));

    return {
      scale: scale,
      x: panAndScale.x + (x / scale - x / oldScale),
      y: panAndScale.y + (y / scale - y / oldScale)
    };
  }

  /**
   * Clamp a pan so at least `ClampPadding` pixels of graph stay visible at
   * every border. Mutates and returns the given object (callers rely on
   * in-place semantics, unchanged from the original `clampPanAndScale`).
   */
  clamp(panAndScale: PanAndScale): PanAndScale {
    const padding = CanvasViewport.ClampPadding;
    const graphAABB = this.graphAABB;

    const canvasWidth = this.canvasWidth / (this.ratio * panAndScale.scale);
    const canvasHeight = this.canvasHeight / (this.ratio * panAndScale.scale);

    const visiblePixelsAtLeftBorder = panAndScale.x + graphAABB.maxX;
    const visiblePixelsAtTopBorder = panAndScale.y + graphAABB.maxY;
    const visiblePixelsAtRightBorder = canvasWidth - panAndScale.x - graphAABB.minX;
    const visiblePixelsAtBottomBorder = canvasHeight - panAndScale.y - graphAABB.minY;

    if (visiblePixelsAtLeftBorder < padding) {
      panAndScale.x = padding - graphAABB.maxX;
    }
    if (visiblePixelsAtRightBorder < padding) {
      panAndScale.x = canvasWidth - graphAABB.minX - padding;
    }

    if (visiblePixelsAtTopBorder < padding) {
      panAndScale.y = padding - graphAABB.maxY;
    }
    if (visiblePixelsAtBottomBorder < padding) {
      panAndScale.y = canvasHeight - graphAABB.minY - padding;
    }

    return panAndScale;
  }
}
