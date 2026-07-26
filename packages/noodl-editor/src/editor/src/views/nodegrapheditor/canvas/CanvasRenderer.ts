import _ from 'underscore';

import type { NodeGraphEditorConnection } from '../NodeGraphEditorConnection';
import { NodeGraphEditorNode } from '../NodeGraphEditorNode';
import { CanvasTheme } from './CanvasTheme';
import { AABB, IVector2, PanAndScale } from './types';

/**
 * Everything the canvas paints in one frame (PLAT-001 extraction).
 *
 * The editor assembles this snapshot in `paint()` and hands it over; the
 * renderer has no back-reference to the editor. Node and connection views
 * keep their own `paint()` methods — this module owns frame orchestration
 * (ordering, culling rect, drag ghosting) and the editor-level decorations
 * (hierarchy lines, insert indicator, connection-drag line, multiselect box).
 */
export type FrameState = {
  panAndScale: PanAndScale;
  /** Device pixels + ratio, used to derive the culling rect. */
  canvasWidth: number;
  canvasHeight: number;
  ratio: number;

  roots: readonly NodeGraphEditorNode[];
  connections: readonly NodeGraphEditorConnection[];

  /** Nodes being dragged are painted last, semi-transparent. */
  draggingNodes?: readonly NodeGraphEditorNode[];

  draggingConnection?: {
    fromNode: TSFixme;
    toNode?: TSFixme;
    mouseTarget?: { global: IVector2 };
  };

  insertLocation?: { pos: IVector2 };

  /** AABB around a multi-selection, when one should be drawn. */
  multiselectAABB?: AABB;

  /** Rect-select drag in progress. */
  multiselectMouseDown?: IVector2;
  multiselectMouseMove?: IVector2;
};

export class CanvasRenderer {
  /**
   * Paint one frame. The context is expected to be cleared already; the
   * editor keeps ownership of clearing and of syncing DOM-layer transforms.
   */
  paint(ctx: CanvasRenderingContext2D, frame: FrameState) {
    const panAndScale = frame.panAndScale;
    const scale = panAndScale.scale;

    ctx.save();
    ctx.scale(frame.ratio * scale, frame.ratio * scale);
    ctx.translate(panAndScale.x, panAndScale.y);

    const paintRect = {
      minX: -panAndScale.x,
      maxX: frame.canvasWidth / (frame.ratio * scale) - panAndScale.x,
      minY: -panAndScale.y,
      maxY: frame.canvasHeight / (frame.ratio * scale) - panAndScale.y
    };

    // Ground dot grid (UIX-005): a repeating pattern filled in graph space so
    // it pans and zooms with the content — one fillRect, never per-dot draws.
    // Skipped at low zoom where the dots collapse into sub-pixel noise.
    if (scale >= 0.4) {
      const gridPattern = CanvasTheme.instance.gridPattern(ctx);
      if (gridPattern) {
        ctx.fillStyle = gridPattern;
        ctx.fillRect(paintRect.minX, paintRect.minY, paintRect.maxX - paintRect.minX, paintRect.maxY - paintRect.minY);
      }
    }

    ctx.font = '10px Helvetica';

    // Paint hierarchy
    _.each(frame.roots, (root) => this.paintHierarchy(ctx, root));

    // Paint connections
    _.each(frame.connections, function (con) {
      con.paint(ctx, paintRect);
    });

    // Paint all highlighted connections (so they always show up on top)
    _.each(frame.connections, function (con) {
      if (con.isHighlighted()) con.paint(ctx, paintRect);
    });

    // Paint nodes
    _.each(frame.roots, function (node) {
      if (!frame.draggingNodes || frame.draggingNodes.indexOf(node) === -1) {
        node.paint(ctx, paintRect);
      }
    });

    if (frame.insertLocation) {
      // Indicate that we have an insert location when
      // dragging this node
      ctx.fillStyle = CanvasTheme.instance.colors.insertIndicator;
      ctx.fillRect(
        frame.insertLocation.pos.x,
        frame.insertLocation.pos.y + (NodeGraphEditorNode.childSpacing - 5) / 2,
        NodeGraphEditorNode.size.width,
        5
      );
    }

    // Paint multiselect box
    if (frame.multiselectAABB) {
      this.paintMultiselectBox(ctx, frame.multiselectAABB);
    }

    ctx.globalAlpha = 0.5;

    // Paint nodes that are being dragged
    _.each(frame.draggingNodes, function (node) {
      node.paint(ctx, paintRect);
    });

    ctx.globalAlpha = 1;

    // Paint the new connection indicator if we have one
    if (frame.draggingConnection) {
      this.paintDraggingConnection(ctx, frame, paintRect);
    }

    // Paint multiselect
    if (frame.multiselectMouseMove) {
      ctx.strokeStyle = CanvasTheme.instance.colors.multiselect;
      ctx.setLineDash([5]);
      ctx.beginPath();
      ctx.rect(
        frame.multiselectMouseDown.x,
        frame.multiselectMouseDown.y,
        frame.multiselectMouseMove.x - frame.multiselectMouseDown.x,
        frame.multiselectMouseMove.y - frame.multiselectMouseDown.y
      );
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private paintHierarchy(ctx: CanvasRenderingContext2D, node: TSFixme) {
    const x = node.global.x;
    const y = node.global.y;

    // Draw hierarchy indicators
    let hy = y + node.nodeSize.height + 5;
    ctx.strokeStyle = CanvasTheme.instance.colors.hierarchyLine;
    ctx.lineWidth = 1;
    for (const i in node.children) {
      const child = node.children[i];

      ctx.beginPath();
      ctx.moveTo(x + NodeGraphEditorNode.childMargin / 2, hy);

      hy = child.global.y + child.nodeSize.height / 2;
      ctx.lineTo(x + NodeGraphEditorNode.childMargin / 2, hy);

      ctx.lineTo(x + NodeGraphEditorNode.childMargin - 5, hy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    _.each(node.children, (child) => this.paintHierarchy(ctx, child));
  }

  private paintDraggingConnection(
    ctx: CanvasRenderingContext2D,
    frame: FrameState,
    paintRect: { minX: number; maxX: number; minY: number; maxY: number }
  ) {
    const draggingConnection = frame.draggingConnection;

    // Make background darker
    if (draggingConnection.fromNode !== undefined && draggingConnection.toNode !== undefined) {
      ctx.fillStyle = CanvasTheme.instance.colors.scrim;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(paintRect.minX, paintRect.minY, paintRect.maxX - paintRect.minX, paintRect.maxY - paintRect.minY);
      ctx.globalAlpha = 1;

      // First the two nodes where a connection is being made
      _.each([draggingConnection.fromNode, draggingConnection.toNode], function (node) {
        node.paint(ctx, paintRect, { dontPaintChildren: true });
      });

      // Draw all connections between these nodes
      _.each(frame.connections, (con) => {
        if (con.fromNode === draggingConnection.fromNode && con.toNode === draggingConnection.toNode)
          con.paint(ctx, paintRect);
      });
    }

    ctx.globalAlpha = 1;

    // Draw line between from node and mouse position, if a target node is hovered
    // draw to the center of the target node
    ctx.strokeStyle = CanvasTheme.instance.colors.dragLine;
    ctx.setLineDash([5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const from = {
      x: draggingConnection.fromNode.global.x + draggingConnection.fromNode.nodeSize.width,
      y: draggingConnection.fromNode.global.y + draggingConnection.fromNode.titlebarHeight() / 2
    };
    let to: IVector2;
    if (draggingConnection.toNode) {
      to = {
        x: draggingConnection.toNode.global.x + draggingConnection.toNode.nodeSize.width / 2,
        y: draggingConnection.toNode.global.y + draggingConnection.toNode.nodeSize.height / 2
      };
    } else {
      to = draggingConnection.mouseTarget.global;
    }

    const d = { x: to.x - from.x, y: to.y - from.y };
    const dl = Math.sqrt(d.x * d.x + d.y * d.y);
    d.x /= dl;
    d.y /= dl;
    const n = { x: d.y, y: -d.x };

    ctx.moveTo(from.x + d.x * 4, from.y + d.y * 4); // Don't draw over source circle, looks weird when alpha is down
    ctx.lineTo(to.x - d.x * 6, to.y - d.y * 6);
    ctx.stroke();

    // Draw the circle at the source node and the arrow head
    // at the target node
    ctx.beginPath();
    ctx.fillStyle = CanvasTheme.instance.colors.dragLine;
    ctx.arc(from.x, from.y, 4, 0, 2 * Math.PI, false);

    ctx.moveTo(to.x + d.x * 2, to.y + d.y * 2);
    ctx.lineTo(to.x - d.x * 6 - n.x * 4, to.y - d.y * 6 - n.y * 4);
    ctx.lineTo(to.x - d.x * 6 + n.x * 4, to.y - d.y * 6 + n.y * 4);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  paintMultiselectBox(ctx: CanvasRenderingContext2D, aabb: AABB) {
    const pad = 8;

    const shadowSize = 150;

    //draw a shadow
    //mask away everything inside the selection bounding box...
    const w = aabb.maxX - aabb.minX;
    const h = aabb.maxY - aabb.minY;
    ctx.save();
    ctx.beginPath();
    ctx.rect(aabb.minX - shadowSize, aabb.minY - shadowSize, 2 * shadowSize + w, shadowSize - pad);
    ctx.rect(aabb.minX - shadowSize, aabb.minY - pad, shadowSize - pad, h + 2 * pad + 2 * shadowSize);
    ctx.rect(aabb.maxX + pad, aabb.minY - pad, shadowSize, h + 2 * pad);
    ctx.rect(aabb.minX - shadowSize, aabb.maxY + pad, 2 * shadowSize + w, shadowSize);
    ctx.clip();

    //...and draw a shadow
    ctx.shadowColor = 'black';
    ctx.shadowBlur = shadowSize;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.fillStyle = 'white'; //the color doesn't matter, just need full opacity. The rect is clipped and just the shadow remains
    ctx.beginPath();
    ctx.fillRect(aabb.minX - pad, aabb.minY - pad, w + 2 * pad, h + 2 * pad);

    //draw selection box
    ctx.lineWidth = 1;
    ctx.strokeStyle = CanvasTheme.instance.colors.multiselectBox;
    ctx.strokeRect(aabb.minX - pad, aabb.minY - pad, w + 2 * pad, h + 2 * pad);

    ctx.restore();
  }
}
