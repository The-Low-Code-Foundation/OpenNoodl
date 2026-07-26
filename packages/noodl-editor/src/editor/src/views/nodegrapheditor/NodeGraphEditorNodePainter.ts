import _ from 'underscore';

import { NodeLibrary } from '../../models/nodelibrary';
import { CanvasFonts, CanvasTheme } from './canvas/CanvasTheme';
import { fillRoundRect, roundRect, strokeRoundRect, truncateText } from './canvasHelpers';
import { NodeGraphEditorNode } from './NodeGraphEditorNode';

function _getColorForAnnotation(annotation) {
  const theme = CanvasTheme.instance.colors;
  if (annotation === 'Deleted') return theme.annotationDeleted;
  else if (annotation === 'Changed') return theme.annotationChanged;
  else if (annotation === 'Created') return theme.annotationCreated;
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

/**
 * Simple category glyph inside the header chip (UIX-005; UIX-007 may refine
 * the glyph set). Drawn with strokes in the category accent, centred on
 * (cx, cy). Sized for the 22px chip.
 */
function paintCategoryGlyph(ctx: CanvasRenderingContext2D, category: string, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (category) {
    case 'visual': {
      // Nested rectangles (frame-in-frame, like the mock's Group glyph)
      roundRect(ctx, cx - 5.5, cy - 5.5, 11, 11, 2);
      ctx.stroke();
      roundRect(ctx, cx - 2.5, cy - 2.5, 5, 5, 1);
      ctx.stroke();
      break;
    }
    case 'data': {
      // Database cylinder
      const rx = 4.5;
      const ry = 1.8;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 3.2, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy - 3.2);
      ctx.lineTo(cx - rx, cy + 3.2);
      ctx.ellipse(cx, cy + 3.2, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(cx + rx, cy - 3.2);
      ctx.stroke();
      break;
    }
    case 'javascript': {
      // Function glyph
      ctx.font = 'italic 600 12px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ƒ', cx, cy + 0.5);
      break;
    }
    case 'component': {
      // Diamond
      const r = 5.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    default: {
      // Neutral circle
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
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
    const theme = CanvasTheme.instance.colors;
    node.updateIcon();

    // Category (UIX-005): existing taxonomy keys only — component / visual /
    // data / javascript / default. colorOverride (AiAssistant metadata) wins,
    // matching the old colorSchemeForNodeColorName precedence.
    const categoryName: string =
      node.model.metadata?.colorOverride || (node.model.type as TSFixme).color || 'default';
    const cat = CanvasTheme.instance.categoryColors(categoryName);

    const isHighligthed = node.owner.isHighlighted(node);
    const horizontalSpacing = 10,
      connectionDragAreaWidth = 10; //the circle icon where you can drag connection from

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.save();

    // Clip to rounded rectangle
    roundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);
    ctx.clip();

    // Card body: neutral, slightly raised on hover (mock: bg-1 / bg-2)
    ctx.fillStyle = isHighligthed ? theme.cardBgHover : theme.cardBg;
    fillRoundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);

    const titlebarHeight = node.titlebarHeight();

    // Ports section separator (mock: border-top on the port rows)
    if (node.plugs && node.plugs.length > 0 && node.nodeSize.height > titlebarHeight) {
      ctx.fillStyle = theme.cardBorder;
      ctx.fillRect(x, y + titlebarHeight, node.nodeSize.width, 1);
    }

    // Header chip: category-soft fill + category glyph
    const chipSize = NodeGraphEditorNode.headerChipSize;
    const chipX = x + NodeGraphEditorNode.headerChipInset;
    const chipY = y + NodeGraphEditorNode.headerChipInset;
    ctx.fillStyle = cat.chipFill;
    fillRoundRect(ctx, chipX, chipY, chipSize, chipSize, 6);
    paintCategoryGlyph(ctx, categoryName, chipX + chipSize / 2, chipY + chipSize / 2, cat.accent);

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

    // Title (node name — fg-1, semibold). The text inset and max width MUST
    // match NodeGraphEditorNode.titlebarLabelHeight or wrap math and paint
    // disagree.
    ctx.fillStyle = theme.cardText;

    ctx.font = CanvasFonts.nodeLabel;
    ctx.textBaseline = 'top';
    textWordWrap(
      ctx,
      node.model.label,
      x + NodeGraphEditorNode.headerTextInset,
      y + NodeGraphEditorNode.verticalSpacing + 5,
      14,
      node.nodeSize.width -
        NodeGraphEditorNode.headerTextInset -
        horizontalSpacing -
        connectionDragAreaWidth -
        iconOffset,
      (text, x, y) => ctx.fillText(text, x, y)
    );

    //If this node has a label set by the user, render the type name as a sub label
    if (hasUserLabel) {
      ctx.save();
      ctx.fillStyle = theme.cardSubText;
      ctx.font = CanvasFonts.nodeSubLabel;
      ctx.textBaseline = 'top';
      textWordWrap(
        ctx,
        node.typeDisplayName(),
        x + NodeGraphEditorNode.headerTextInset,
        y + node.titlebarLabelHeight() + 14,
        14,
        node.nodeSize.width - NodeGraphEditorNode.headerTextInset - horizontalSpacing - connectionDragAreaWidth,
        (text, x, y) => ctx.fillText(text, x, y)
      );
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
      ctx.fillStyle = theme.cardSubText;
      ctx.strokeStyle = theme.cardSubText;
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
      ctx.fillStyle = node.borderHighlighted ? theme.selection : theme.portText;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x + node.nodeSize.width, y + titlebarHeight / 2, 4, 0, 2 * Math.PI, false);
      ctx.fill();
    }

    // Card outline (mock: 1px border-1, border-2 on hover)
    ctx.strokeStyle = isHighligthed ? theme.cardBorderHover : theme.cardBorder;
    ctx.lineWidth = 1;
    strokeRoundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);

    // Unhealthy: dashed danger ring (red is an error here, allowed)
    const health = node.model.getHealth();
    if (!health.healthy) {
      ctx.setLineDash([5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = theme.danger;
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

    // Selection: accent ring + soft outer glow (mock: accent border +
    // 3px accent-soft box-shadow — a 6px glow stroke centres 3px outside).
    // Border/drag-area hover keeps the accent ring without the glow.
    if (node.selected) {
      ctx.strokeStyle = theme.selectionGlow;
      ctx.lineWidth = 6;
      strokeRoundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);
      ctx.strokeStyle = theme.selection;
      ctx.lineWidth = 1.5;
      strokeRoundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);
    } else if (node.borderHighlighted || node.connectionDragAreaHighlighted) {
      ctx.strokeStyle = theme.selection;
      ctx.lineWidth = 1.5;
      strokeRoundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);
    }

    if (node.model.annotation) {
      const annotationColor = _getColorForAnnotation(node.model.annotation);
      ctx.strokeStyle = annotationColor;
      ctx.lineWidth = 2;
      // Shape as well as colour (AIX-003): deletions get a dashed border...
      if (node.model.annotation === 'Deleted') ctx.setLineDash([6, 4]);
      strokeRoundRect(ctx, x, y, node.nodeSize.width, node.nodeSize.height, NodeGraphEditorNode.cornerRadius);
      ctx.setLineDash([]);

      // ...and every annotation a corner badge with a glyph: + added, - removed,
      // ~ changed.
      const glyph = node.model.annotation === 'Deleted' ? '-' : node.model.annotation === 'Created' ? '+' : '~';
      ctx.save();
      ctx.fillStyle = annotationColor;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI, false);
      ctx.fill();
      ctx.fillStyle = theme.annotationBadgeGlyph;
      ctx.font = CanvasFonts.annotationBadge;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, x, y + 1);
      ctx.restore();
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
      const radius = 3.5; // mock: flat 7px port dots

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, ty, radius, 0, 2 * Math.PI, false);
      ctx.fill();
    }

    function drawPlugs(plugs, offset) {
      ctx.font = CanvasFonts.portLabel;
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

        ctx.fillStyle = theme.portText;
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
          var connectionColors = CanvasTheme.instance.connectionColors(
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
          connectionColors = CanvasTheme.instance.connectionColors(
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
