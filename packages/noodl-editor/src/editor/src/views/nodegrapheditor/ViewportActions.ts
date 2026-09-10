import { CanvasViewport } from './canvas/CanvasViewport';
import { AABB, CenterToFitMode, PanAndScale, Rect } from './canvas/types';

import type { NodeGraphEditorNode } from './NodeGraphEditorNode';
import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * Viewport-sync coordination (PLAT-001 wave 3 — bodies moved verbatim from
 * the editor). The math lives on `canvas/CanvasViewport`; this module owns the
 * side effects every pan/zoom change must carry: syncing the comment layer and
 * the viewport-tracking overlays, clamping against the graph bounds, and
 * scheduling relayout/repaint. The editor keeps delegating stubs for all
 * public/owner-contract names (resize, centerToFit, getPanAndScale, ...).
 */
export class ViewportActions {
  constructor(private editor: NodeGraphEditor) {}

  // Called by the parent view (frames view) when the size and position changes
  resize(layout: TSFixme) {
    const editor = this.editor;

    editor.currentLayout = layout;

    //make sure the canvas is bound and rendering happens at the same frame, otherwise it'll flicker
    editor.bindCanvas();
    editor.layout();
    editor.paint();

    if (editor.model && editor.canvas.width && editor.canvas.height) {
      let panAndScale = this.getPanAndScale();
      panAndScale = this.clampPanAndScale(panAndScale);
      this.setPanAndScale(panAndScale);
    }
  }

  updateZoomLevel(x: number, y: number, deltaZ: number) {
    const editor = this.editor;

    let panAndScale = editor.viewport.zoomAtPoint(x, y, deltaZ, this.getPanAndScale());
    panAndScale = this.clampPanAndScale(panAndScale);
    this.setPanAndScale(panAndScale);
    editor.overlayViews.updateHighlightOverlay();

    editor.relayout();
    editor.repaint();
  }

  moveRoots(dx: number, dy: number) {
    let panAndScale = this.getPanAndScale();
    panAndScale.x += dx;
    panAndScale.y += dy;
    panAndScale = this.clampPanAndScale(panAndScale);
    this.setPanAndScale(panAndScale);
    this.editor.overlayViews.updateHighlightOverlay();
  }

  /**
   * @returns The center of all the root nodes in the graph.
   */
  getCenterRootPanAndScale(): PanAndScale {
    return this.editor.viewport.centerOn(
      this.editor.roots.map((root) => ({
        x: root.x,
        y: root.y,
        width: root.nodeSize.width,
        height: root.nodeSize.height
      }))
    );
  }

  /**
   * @returns The center of all the nodes in the graph, at scale 1.
   *
   * ⚠️ Kept for the editor's public delegate. "Fit view" no longer routes here
   * — see `getFitPanAndScale`.
   */
  getCenterPanAndScale(): PanAndScale {
    return this.editor.viewport.centerOn(
      this.editor.roots.map((root) => ({
        x: root.x,
        y: root.y,
        width: root.measuredSize.width,
        height: root.measuredSize.height
      }))
    );
  }

  /**
   * Every rectangle the graph draws: the root nodes at their *measured* size
   * (which includes their children) plus the comments.
   *
   * This is deliberately the same rect set `CanvasPainter.calculateAABB` feeds
   * to `updateGraphAABB`, so "fit view" and the zoom floor cannot disagree
   * about where the graph ends. A comment parked far from the nodes is part of
   * the graph you are asking to see, exactly as a stray node is.
   */
  private allGraphRects(): Rect[] {
    const editor = this.editor;

    const rects: Rect[] = editor.roots.map((root) => ({
      x: root.x,
      y: root.y,
      width: root.measuredSize.width,
      height: root.measuredSize.height
    }));

    const comments = editor.model && editor.model.commentsModel ? editor.model.commentsModel.comments : [];
    for (const comment of comments) {
      rects.push({ x: comment.x, y: comment.y, width: comment.width, height: comment.height });
    }

    return rects;
  }

  /**
   * @returns The pan and scale that put the whole graph inside the canvas.
   */
  getFitPanAndScale(): PanAndScale {
    return this.editor.viewport.fitTo(this.allGraphRects());
  }

  /**
   * Center the camera on the nodes — or, for `AllNodes`, actually fit them.
   *
   * 🔴 FLD-006 (#33) deliberately changes only the `AllNodes` arm. That is the
   * "Fit view" button (`OverlayViews.renderCanvasHud`) and the screenshot
   * helper, and it used to route to `centerOn`, whose scale is the literal 1 —
   * so on a graph wider than the pane it reported 100%, left most of the graph
   * offscreen, and did nothing at all when clicked again.
   *
   * `RootNodes` is left on `centerOn` on purpose: it is the camera **every
   * project opens with** (`getPanAndScale` falls back to it), and moving that
   * to a fit would change how every project looks the moment it is opened.
   * The characterisation spec pins it at scale 1, and it stays there. Changing
   * it is a separate, deliberate decision — not a side effect of this one.
   *
   * The fit is clamped like every other viewport mutation; `centerToFit` was
   * the only one that skipped `clampPanAndScale`. On a correct fit the clamp is
   * a no-op (the whole graph is on screen, so every border is well past its
   * 100px minimum), which is why the `RootNodes` arm can be left untouched
   * without the two arms drifting.
   *
   * @returns The current pan and scale.
   */
  centerToFit(mode: CenterToFitMode) {
    switch (mode) {
      default:
      case CenterToFitMode.RootNodes: {
        this.setPanAndScale(this.getCenterRootPanAndScale());
        break;
      }

      case CenterToFitMode.AllNodes: {
        this.setPanAndScale(this.clampPanAndScale(this.getFitPanAndScale()));
        break;
      }
    }

    return this.editor.viewport.panAndScale;
  }

  getPanAndScale() {
    const editor = this.editor;

    if (editor.viewport.panAndScale) {
      return editor.viewport.panAndScale;
    }

    if (!editor.model || !editor.canvas.width || !editor.canvas.height || !editor.roots.length) {
      return { scale: 1, x: 0, y: 0 };
    }

    return this.centerToFit(CenterToFitMode.RootNodes);
  }

  setPanAndScale(panAndScale: PanAndScale) {
    const editor = this.editor;

    editor.viewport.panAndScale = panAndScale;
    editor.commentLayer && editor.commentLayer.setPanAndScale(panAndScale);
    editor.overlayViews.updateHighlightOverlay();
    editor.overlayViews.updateExecutionOverlay();
    // HUD-001: the recording badges are positioned in canvas space, so they follow pan and
    // zoom by the same route the execution badges do.
    editor.overlayViews.updateRecordingOverlay();
    // PAR-003: keep the HUD zoom percentage live.
    editor.overlayViews.updateCanvasHud();
  }

  clampPanAndScale(panAndScale: PanAndScale) {
    if (!this.editor.model || this.editor.model.roots.length === 0) return panAndScale;

    return this.editor.viewport.clamp(panAndScale);
  }

  calculateNodesAABB(nodes: readonly NodeGraphEditorNode[]): AABB {
    return CanvasViewport.rectsAABB(
      nodes.map((n) => ({ x: n.global.x, y: n.global.y, width: n.nodeSize.width, height: n.nodeSize.height }))
    );
  }
}
