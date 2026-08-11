import _ from 'underscore';

import { NodeLibrary } from '../../models/nodelibrary';
import { Rect } from './canvas/types';

import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * The layout/paint pipeline (PLAT-001 wave 3 — bodies moved verbatim from the
 * editor): measure + position the node views, compute the graph AABB, and
 * assemble the per-frame FrameState for `canvas/CanvasRenderer`. Scheduling
 * (relayout/repaint/layoutAndPaint) stays on the editor — scene items call it
 * through the owner contract on every mutation.
 */
export class CanvasPainter {
  constructor(private editor: NodeGraphEditor) {}

  layout() {
    const editor = this.editor;

    if (!editor.model) {
      return;
    }

    editor.forEachNode(function (node) {
      node.measuredSize = undefined;
    });

    _.each(editor.roots, function (node) {
      node.measure();
      node.setPosition(node.x, node.y);
      node.layout();
    });

    this.calculateAABB();
  }

  calculateAABB() {
    const editor = this.editor;

    const rects: Rect[] = editor.roots.map((node) => ({
      x: node.x,
      y: node.y,
      width: node.measuredSize.width,
      height: node.measuredSize.height
    }));

    for (const comment of editor.model.commentsModel.comments) {
      rects.push({ x: comment.x, y: comment.y, width: comment.width, height: comment.height });
    }

    editor.viewport.updateGraphAABB(rects);
  }

  paint() {
    const editor = this.editor;

    if (!editor.canvas.width || !editor.canvas.height) {
      return;
    }

    const ctx = editor.canvas.ctx;
    const panAndScale = editor.getPanAndScale();

    const transform = `scale(${panAndScale.scale}) translate(${panAndScale.x}px, ${panAndScale.y}px)`;
    editor.domElementContainer.style.transform = transform;

    editor.commentLayer && editor.commentLayer.setPanAndScale(panAndScale);

    ctx.clearRect(0, 0, editor.canvas.width, editor.canvas.height);

    if (!NodeLibrary.instance.isLoaded()) {
      // Don't paint if we don't have a node library yet
      return;
    }

    // Draw a multiselect box when there is a multi-selection (single-node
    // selections draw their own highlight)
    const showMultiselectBox = editor.selector.nodes.length > 0 && !editor.selector.nodes[0].selected;

    editor.renderer.paint(ctx, {
      panAndScale,
      canvasWidth: editor.canvas.width,
      canvasHeight: editor.canvas.height,
      ratio: editor.canvas.ratio,
      roots: editor.roots,
      connections: editor.connections,
      draggingNodes: editor.interaction.draggingNodes,
      draggingConnection: editor.interaction.draggingConnection,
      insertLocation: editor.interaction.insertLocation,
      multiselectAABB: showMultiselectBox ? editor.calculateNodesAABB(editor.selector.nodes) : undefined,
      multiselectMouseDown: editor.interaction.multiselectMouseDown,
      multiselectMouseMove: editor.interaction.multiselectMouseMove
    });
  }

  /**
   * Who currently needs the canvas repainting every frame.
   *
   * ⚠️ SIG-006: this used to be the bare boolean `isPlayingNodeAnimations`, with
   * one caller — the AI assistant's spinning node icons. A second animated thing
   * (the hover direction mark) makes that boolean wrong in both directions: the
   * pointer leaving a wire would `stopNodeAnimations()` and freeze the
   * assistant's icons mid-spin, and the assistant finishing would freeze the
   * hover mark under the cursor. Reasons are counted; the loop runs while any
   * are held.
   */
  private animationHolds = new Set<string>();

  //A request animation frame timer that renders the entire node graph while there are animations to play
  //TODO: only render when an animated node is visible
  startNodeAnimations(reason = 'nodes') {
    const editor = this.editor;

    this.animationHolds.add(reason);

    if (editor.isPlayingNodeAnimations) {
      return;
    }

    editor.isPlayingNodeAnimations = true;

    const animate = () => {
      this.paint();

      if (editor.isPlayingNodeAnimations) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  stopNodeAnimations(reason = 'nodes') {
    this.animationHolds.delete(reason);
    if (this.animationHolds.size === 0) {
      this.editor.isPlayingNodeAnimations = false;
    }
  }
}
