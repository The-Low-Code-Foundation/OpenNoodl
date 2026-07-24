import _ from 'underscore';

import { NodeLibrary } from '../../models/nodelibrary';
import { fillRoundRect, roundRect, strokeRoundRect, truncateText } from './canvasHelpers';
import { NodeGraphEditorNode } from './NodeGraphEditorNode';

function _getColorForAnnotation(annotation) {
  if (annotation === 'Deleted') return '#F57569';
  else if (annotation === 'Changed') return '#83B8BA';
  else if (annotation === 'Created') return '#5BF59E';
}

export function measureTextHeight(text, font, lineHeight, maxWidth) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  ctx.font = font;
  ctx.textBaseline = 'top';

  // Defensive: convert to string (handles expression objects, numbers, etc.)
  const textString = typeof text === 'string' ? text : String(text || '');

  return textWordWrap(ctx, textString, 0, 0, lineHeight, maxWidth);
}

export function textWordWrap(context, text, x, y, lineHeight, maxWidth, cb?) {
  // Defensive: ensure we have a string
  const textString = typeof text === 'string' ? text : String(text || '');

  // Empty string still has height (return lineHeight, not undefined)
  if (!textString) {
    return lineHeight;
  }

  let words = textString.split(' ');
  let currentLine = 0;
  let idx = 1;
  while (words.length > 0 && idx <= words.length) {
    const str = words.slice(0, idx).join(' ');
    const w = context.measureText(str).width;
    if (w > maxWidth) {
      if (idx == 1) {
        idx = 2;
      }
      cb && cb(words.slice(0, idx - 1).join(' '), x, y + lineHeight * currentLine);
      currentLine++;
      words = words.splice(idx - 1);
      idx = 1;
    } else {
      idx++;
    }
  }
  if (idx > 0) {
    cb && cb(words.slice(0, idx - 1).join(' '), x, y + lineHeight * currentLine);
  }

  return lineHeight * currentLine + lineHeight;
}

// Stateless: draws one node (and recurses to children via node.paint). Holds no
// references — reads node state per call. Writes back the geometry caches that
// hit-testing depends on (commentIconBounds); do not remove those writes.
export function paintNode(node: NodeGraphEditorNode, ctx: CanvasRenderingContext2D, paintRect, options?) {
  const _this = node;

  const x = node.global.x;
  const y = node.global.y;

  const isOutsidePaintArea =
    x > paintRect.maxX ||
    y > paintRect.maxY ||
    x + node.nodeSize.width < paintRect.minX ||
    y + node.nodeSize.height < paintRect.minY;

  if (isOutsidePaintArea === false) {
    node.updateIcon();
    const nc = node.model.metadata?.colorOverride
      ? NodeLibrary.instance.colorSchemeForNodeColorName(node.model.metadata.colorOverride)
      : NodeLibrary.instance.colorSchemeForNodeType(node.model.type);

    const isHighligthed = node.owner.isHighlighted(node);
    const horizontalSpacing = 10,
      connectionDragAreaWidth = 10; //the circle icon where you can drag connection from

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.save();

    // Clip to rounded rectangle
    roundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);
    ctx.clip();

    // Bg - Use rounded rectangle for modern appearance
    ctx.fillStyle = nc.header;
    fillRoundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);

    const titlebarHeight = node.titlebarHeight();

    // Darken plate (body area below title)
    ctx.fillStyle = nc.base;
    ctx.fillRect(x, y + titlebarHeight, node.nodeSize.width, node.nodeSize.height - titlebarHeight);

    // Highlight plate
    if (isHighligthed || node.selected) {
      const prevCompOperation = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'hard-light'; // additive blending looks better
      ctx.globalAlpha = 0.19;
      ctx.fillStyle = nc.text;
      fillRoundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);
      ctx.globalCompositeOperation = prevCompOperation;
      ctx.globalAlpha = 1;
    }

    if (node.icon && node.icon.complete && node.icon.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const offset = Math.abs(node.iconSize - 18);

      try {
        ctx.drawImage(
          node.icon,
          x + horizontalSpacing + node.nodeSize.width - horizontalSpacing - connectionDragAreaWidth - 16 - offset,
          y + NodeGraphEditorNode.verticalSpacing + 1 - offset / 2,
          node.iconSize,
          node.iconSize
        );
      } catch (e) {
        // Icon failed to load, skip drawing
        console.warn('Failed to draw node icon:', e);
      }

      if (node.rotatingIcon && node.rotatingIcon.complete && node.rotatingIcon.naturalWidth > 0) {
        ctx.save();
        ctx.translate(
          x +
            horizontalSpacing +
            node.nodeSize.width -
            horizontalSpacing -
            connectionDragAreaWidth -
            16 -
            offset +
            node.iconSize / 2,
          y + NodeGraphEditorNode.verticalSpacing + 1 - offset / 2 + node.iconSize / 2
        );
        ctx.rotate(node.iconRotation);

        try {
          ctx.drawImage(node.rotatingIcon, -node.iconSize / 2, -node.iconSize / 2, node.iconSize, node.iconSize);
        } catch (e) {
          // Rotating icon failed to load, skip drawing
          console.warn('Failed to draw rotating icon:', e);
        }

        ctx.restore();
      }
    }

    const iconOffset = node.icon ? 12 : 0;

    const hasUserLabel = node.typeDisplayName() && node.model.label !== node.typeDisplayName();

    // Title
    ctx.fillStyle = nc.text;

    ctx.font = '12px Inter-Medium';
    ctx.textBaseline = 'top';
    textWordWrap(
      ctx,
      node.model.label,
      x + horizontalSpacing,
      y + NodeGraphEditorNode.verticalSpacing + 5,
      14,
      node.nodeSize.width - 2 * horizontalSpacing - connectionDragAreaWidth - iconOffset,
      (text, x, y) => ctx.fillText(text, x, y)
    );

    //If this node has a label set by the user, render the type name as a sub label
    if (hasUserLabel) {
      ctx.save();
      ctx.fillStyle = nc.text;
      ctx.globalAlpha = 0.65;
      ctx.font = '12px Inter-Medium';
      ctx.textBaseline = 'top';
      textWordWrap(
        ctx,
        node.typeDisplayName(),
        x + horizontalSpacing,
        y + node.titlebarLabelHeight() + 14,
        14,
        node.nodeSize.width - 2 * horizontalSpacing - connectionDragAreaWidth,
        (text, x, y) => ctx.fillText(text, x, y)
      );
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Draw comment icon (if node has comment OR is highlighted)
    // Position on right side, before the node icon area if present
    const hasComment = node.model.hasComment();
    if (hasComment || isHighligthed) {
      const commentIconSize = 14;
      // Adjust offset based on whether node icon is present
      // If icon exists, offset more to avoid overlap; if not, position closer to edge
      const commentIconRightOffset = node.icon ? 30 : 10;
      const commentIconX = x + node.nodeSize.width - connectionDragAreaWidth - commentIconSize - commentIconRightOffset;
      const commentIconY = y + titlebarHeight / 2 - commentIconSize / 2;

      // Store bounds for click detection
      node.commentIconBounds = {
        x: commentIconX,
        y: commentIconY,
        width: commentIconSize,
        height: commentIconSize
      };

      ctx.save();

      // Set opacity based on whether comment exists
      ctx.globalAlpha = hasComment ? 1.0 : 0.4;
      ctx.fillStyle = nc.text;
      ctx.strokeStyle = nc.text;
      ctx.lineWidth = 1.5;

      // Draw speech bubble (rounded rectangle)
      const bubbleWidth = commentIconSize;
      const bubbleHeight = commentIconSize * 0.8;
      const bubbleRadius = 2;

      // Main bubble body
      ctx.beginPath();
      ctx.moveTo(commentIconX + bubbleRadius, commentIconY);
      ctx.lineTo(commentIconX + bubbleWidth - bubbleRadius, commentIconY);
      ctx.quadraticCurveTo(
        commentIconX + bubbleWidth,
        commentIconY,
        commentIconX + bubbleWidth,
        commentIconY + bubbleRadius
      );
      ctx.lineTo(commentIconX + bubbleWidth, commentIconY + bubbleHeight - bubbleRadius);
      ctx.quadraticCurveTo(
        commentIconX + bubbleWidth,
        commentIconY + bubbleHeight,
        commentIconX + bubbleWidth - bubbleRadius,
        commentIconY + bubbleHeight
      );

      // Draw tail (small triangle at bottom)
      const tailWidth = 3;
      const tailHeight = 3;
      const tailX = commentIconX + bubbleWidth * 0.7;
      ctx.lineTo(tailX + tailWidth, commentIconY + bubbleHeight);
      ctx.lineTo(tailX, commentIconY + bubbleHeight + tailHeight);
      ctx.lineTo(tailX - tailWidth / 2, commentIconY + bubbleHeight);

      // Complete the bubble
      ctx.lineTo(commentIconX + bubbleRadius, commentIconY + bubbleHeight);
      ctx.quadraticCurveTo(
        commentIconX,
        commentIconY + bubbleHeight,
        commentIconX,
        commentIconY + bubbleHeight - bubbleRadius
      );
      ctx.lineTo(commentIconX, commentIconY + bubbleRadius);
      ctx.quadraticCurveTo(commentIconX, commentIconY, commentIconX + bubbleRadius, commentIconY);
      ctx.closePath();

      ctx.stroke();

      ctx.restore();
    } else {
      // Clear bounds when not visible
      node.commentIconBounds = undefined;
    }

    ctx.restore(); // Restore clip so we can draw border

    if (isHighligthed) {
      ctx.fillStyle = node.borderHighlighted ? '#ffffff' : nc.text;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x + node.nodeSize.width, y + titlebarHeight / 2, 4, 0, 2 * Math.PI, false);
      ctx.fill();

      // ctx.font = '10px FontAwesome';

      // ctx.fillText(
      //   // @ts-expect-error
      //   String.fromCharCode('0xf111'),
      //   x + node.nodeSize.width - 5,
      //   y + titlebarHeight / 2
      // );
    }

    // Border - Use rounded rectangles for modern appearance
    const health = node.model.getHealth();
    if (!health.healthy) {
      ctx.setLineDash([5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#F57569';
      ctx.globalAlpha = 0.7;
      strokeRoundRect(
        ctx,
        x - 1,
        y - 1,
        node.nodeSize.width + 2,
        node.nodeSize.height + 2,
        NodeGraphEditorNode.cornerRadius + 1
      );
      ctx.setLineDash([]); // Restore line dash
      ctx.globalAlpha = 1;
    }

    if (node.selected || node.borderHighlighted || node.connectionDragAreaHighlighted) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      strokeRoundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);
    }

    if (node.model.annotation) {
      if (node.model.annotation === 'Deleted') ctx.strokeStyle = '#F57569';
      else if (node.model.annotation === 'Changed') ctx.strokeStyle = '#83B8BA';
      else if (node.model.annotation === 'Created') ctx.strokeStyle = '#5BF59E';

      ctx.lineWidth = 2;
      strokeRoundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);
    }

    // Paint plugs
    let tx, ty;

    function arrow(side, color) {
      const dx = side === 'left' ? 4 : -4;
      const cx = x + (side === 'left' ? 0 : _this.nodeSize.width);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx - dx, ty - 4);
      ctx.lineTo(cx + dx, ty);
      ctx.lineTo(cx - dx, ty + 4);
      ctx.fill();
    }

    function dot(side, color) {
      const cx = x + (side === 'left' ? 0 : _this.nodeSize.width);
      const radius = 6; // Back to normal size

      // Draw main port indicator
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, ty, radius, 0, 2 * Math.PI, false);
      ctx.fill();

      // Add subtle inner highlight for depth
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(cx - 0.5, ty - 0.5, radius * 0.4, 0, 2 * Math.PI, false);
      ctx.fill();
    }

    function drawPlugs(plugs, offset) {
      ctx.font = '11px Inter-Medium';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 1;

      for (const i in plugs) {
        const p = plugs[i];

        // Calculate Y position for this port
        ty = p.index * NodeGraphEditorNode.propertyConnectionHeight + offset;

        // Draw labels at normal positions
        if (p.loc === 'left' || p.loc === 'middle') {
          // Left-aligned labels
          tx = x + horizontalSpacing;
        } else if (p.loc === 'right') {
          // Right-aligned labels
          tx = x + _this.nodeSize.width - horizontalSpacing;
        } else {
          tx = x + _this.nodeSize.width / 2;
        }

        ctx.fillStyle = nc.text;
        ctx.textAlign = p.loc === 'right' ? 'right' : 'left';

        // Truncate port labels to prevent overflow
        const label = p.displayName ? p.displayName : p.property;
        const portAreaWidth =
          p.loc === 'middle'
            ? _this.nodeSize.width - 2 * horizontalSpacing
            : _this.nodeSize.width - horizontalSpacing - 8;
        const truncatedLabel = truncateText(ctx, label, portAreaWidth);

        ctx.fillText(truncatedLabel, tx, ty);

        // Plug - Left side
        if (p.leftCons.length || p.leftIcon) {
          var connectionColors = NodeLibrary.instance.colorSchemeForConnectionType(
            NodeLibrary.nameForPortType(p.leftCons[0]?.fromPort ? p.leftCons[0].fromPort.type : undefined)
          );
          var color = _.find(p.leftCons, function (p) {
            return p.isHighlighted();
          })
            ? connectionColors.highlighted
            : connectionColors.normal;

          var topConnection =
            _.find(p.leftCons, function (p) {
              return p.isHighlighted();
            }) || p.leftCons[p.leftCons.length - 1];

          if (topConnection && topConnection.model.annotation) {
            color = _getColorForAnnotation(topConnection.model.annotation);
          }

          if (p.leftIcon === 'from') {
            dot('left', color);
          } else if (p.leftIcon === 'to' || p.leftIcon === 'both') {
            arrow('left', color);
          }
        }

        // Plug - Right side
        if (p.rightCons.length || p.rightIcon) {
          connectionColors = NodeLibrary.instance.colorSchemeForConnectionType(
            NodeLibrary.nameForPortType(p.rightCons[0]?.fromPort ? p.rightCons[0].fromPort.type : undefined)
          );
          color = _.find(p.rightCons, function (p) {
            return p.isHighlighted();
          })
            ? connectionColors.highlighted
            : connectionColors.normal;

          var topConnection =
            _.find(p.rightCons, function (p) {
              return p.isHighlighted();
            }) || p.rightCons[p.rightCons.length - 1];

          if (topConnection && topConnection.model.annotation) {
            color = _getColorForAnnotation(topConnection.model.annotation);
          }

          if (p.rightIcon === 'from') {
            dot('right', color);
          } else if (p.rightIcon === 'to' || p.rightIcon === 'both') {
            arrow('right', color);
          }
        }
      }
    }

    // If there is only one 'Other' group, draw just plugs
    drawPlugs(
      node.plugs,
      y + titlebarHeight + NodeGraphEditorNode.propertyConnectionHeight / 2 + NodeGraphEditorNode.verticalSpacing
    );

    ctx.textBaseline = 'middle';
  }

  // Paint children
  if (!(options && options.dontPaintChildren)) {
    for (const i in node.children) {
      node.children[i].paint(ctx, paintRect);
    }
  }
}
