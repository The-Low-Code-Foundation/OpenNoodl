import _ from 'underscore';

import { NodeLibrary } from '../../models/nodelibrary';
import { CanvasFonts, CanvasTheme } from './canvas/CanvasTheme';
import { fillRoundRect, roundRect, strokeRoundRect, truncateText } from './canvasHelpers';
import { NodeGraphEditorNode } from './NodeGraphEditorNode';
import { arrowheadPolygon, diamondPolygon, glyphForPlugIcon, glyphScaleFor, WIRE_ENDPOINT } from './wireEndpoints';

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

/**
 * The comment stripe's width in *graph* units, widened at low zoom so it never
 * falls below one device pixel (CAN-004 — a mark you must zoom in to see is not
 * a mark). The context transform's horizontal scale is device pixels per graph
 * unit; contexts without `getTransform` (headless/jsdom) get the nominal width.
 */
function commentStripeWidth(ctx: CanvasRenderingContext2D): number {
  const nominal = NodeGraphEditorNode.commentStripeWidth;
  if (typeof ctx.getTransform !== 'function') return nominal;

  const scale = ctx.getTransform().a;
  if (!scale || scale <= 0) return nominal;

  return Math.max(nominal, 1 / scale);
}

// Stateless: draws one node (and recurses to children via node.paint). Holds no
// references — reads node state per call.
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

    // `labelText()` and not `model.label`: the title has to be compared as a string, or an
    // expression-valued label (an object) never equals the type name and every such node paints
    // a sub-label it did not earn (FH-003).
    const labelText = node.labelText();
    const hasUserLabel = node.typeDisplayName() && labelText !== node.typeDisplayName();

    // Title (node name — fg-1, semibold). The text inset and max width MUST
    // match NodeGraphEditorNode.titlebarLabelHeight or wrap math and paint
    // disagree.
    ctx.fillStyle = theme.cardText;

    ctx.font = CanvasFonts.nodeLabel;
    ctx.textBaseline = 'top';
    textWordWrap(
      ctx,
      labelText,
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

    // Comment gutter stripe (CAN-004). Presence means presence of a comment —
    // there is no highlighted state to interpret, and no glyph, because the
    // titlebar has no free horizontal room at a fixed 150px card width.
    // Painted inside the rounded-rect clip, so the top-left corner is rounded
    // for free, and keyed off titlebarHeight rather than centred in it, so it
    // cannot drift when a wrapped title grows the titlebar.
    if (node.model.hasComment()) {
      ctx.save();
      ctx.fillStyle = theme.commentIndicator;
      ctx.fillRect(x, y, commentStripeWidth(ctx), titlebarHeight);
      ctx.restore();
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

    // Unhealthy: a dashed ring, in the colour the *level* earns.
    //
    // ⚠️ BCN-010. Red is danger-only under phase 23's colour law, and until this
    // task every node warning was in practice an error — a missing type, an
    // illegal child — so one `theme.danger` ring was right by accident. A
    // capability gap is the first routine `warning`: the node works, it is the
    // *backend* that will refuse. Drawn in red it reads as a broken node, which
    // is the exact misreading this task exists to prevent, one layer up.
    const health = node.model.getHealth();
    if (!health.healthy) {
      ctx.setLineDash([5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = health.level === 'warning' ? theme.warning : theme.danger;
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

    // SIG-006: the node-side direction glyphs. Circle = it leaves here,
    // arrowhead = it arrives here, diamond = both. The shapes and their sizes
    // come from `wireEndpoints.ts`, which the *wire's* own ends read too, so the
    // two statements of the same fact cannot drift apart.
    //
    // ⚠️ Painted at constant screen size below 100% zoom. The old pair was a 7px
    // disc against an 8px triangle — one pixel of extent apart, in the same
    // colour, and halving with the zoom.
    const plugGlyphScale = glyphScaleFor(_this.owner?.getPanAndScale?.().scale ?? 1);

    const fillPolygon = (points) => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
      ctx.fill();
    }

    const plugCentre = (side) => {
      return { x: x + (side === 'left' ? 0 : _this.nodeSize.width), y: ty };
    }

    const arrow = (side, color) => {
      // Pointing *into* the node: a wire arriving on the left side comes from
      // the left, so its head points right.
      const direction = { x: side === 'left' ? 1 : -1, y: 0 };
      ctx.fillStyle = color;
      fillPolygon(
        arrowheadPolygon(
          plugCentre(side),
          direction,
          WIRE_ENDPOINT.arrowLength * plugGlyphScale,
          WIRE_ENDPOINT.arrowHalfWidth * plugGlyphScale
        )
      );
    }

    const dot = (side, color) => {
      const c = plugCentre(side);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, WIRE_ENDPOINT.sourceRadius * plugGlyphScale, 0, 2 * Math.PI, false);
      ctx.fill();
    }

    const diamond = (side, color) => {
      ctx.fillStyle = color;
      fillPolygon(diamondPolygon(plugCentre(side), WIRE_ENDPOINT.diamondRadius * plugGlyphScale));
    }

    /**
     * SIG-006 item 3, decided rather than inherited.
     *
     * `'both'` used to fall into the arrow branch — `leftIcon === 'to' ||
     * leftIcon === 'both'` — so an arrow did not actually mean "input", and the
     * ports where direction is hardest to read were the ones being told a small
     * lie. A port that is the source of one wire and the target of another is a
     * third fact and gets a third silhouette.
     */
    const paintPlugGlyph = (side, icon, color) => {
      const glyph = glyphForPlugIcon(icon);
      if (glyph === 'circle') dot(side, color);
      else if (glyph === 'arrowhead') arrow(side, color);
      else if (glyph === 'diamond') diamond(side, color);
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

          paintPlugGlyph('left', p.leftIcon, color);
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

          paintPlugGlyph('right', p.rightIcon, color);
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
