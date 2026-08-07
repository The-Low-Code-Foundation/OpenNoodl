/**
 * Canvas Helper Utilities for Node Graph Rendering
 *
 * Provides utility functions for drawing rounded rectangles and text truncation
 * on HTML5 Canvas. Used primarily for modernizing node appearance in the graph editor.
 *
 * @module canvasHelpers
 * @since TASK-000I-A
 */

/**
 * Corner radius configuration for rounded rectangles
 * Can be a single number for all corners, or an object specifying each corner
 */
export type CornerRadius =
  | number
  | {
      tl: number; // top-left
      tr: number; // top-right
      br: number; // bottom-right
      bl: number; // bottom-left
    };

/**
 * Draw a rounded rectangle path (does not fill or stroke)
 *
 * Uses arcTo() for drawing rounded corners. This method only creates the path;
 * you must call ctx.fill() or ctx.stroke() afterwards.
 *
 * @param ctx - Canvas rendering context
 * @param x - X coordinate of top-left corner
 * @param y - Y coordinate of top-left corner
 * @param width - Width of rectangle
 * @param height - Height of rectangle
 * @param radius - Corner radius (number for all corners, or object for individual corners)
 *
 * @example
 * ```typescript
 * roundRect(ctx, 10, 10, 100, 50, 6);
 * ctx.fill();
 * ```
 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: CornerRadius
): void {
  // Normalize radius to object format
  const r = typeof radius === 'number' ? { tl: radius, tr: radius, br: radius, bl: radius } : radius;

  // Clamp radius to reasonable values (can't be larger than half the smallest dimension)
  const maxRadius = Math.min(width, height) / 2;
  const tl = Math.min(r.tl, maxRadius);
  const tr = Math.min(r.tr, maxRadius);
  const br = Math.min(r.br, maxRadius);
  const bl = Math.min(r.bl, maxRadius);

  ctx.beginPath();
  ctx.moveTo(x + tl, y);

  // Top edge and top-right corner
  ctx.lineTo(x + width - tr, y);
  ctx.arcTo(x + width, y, x + width, y + tr, tr);

  // Right edge and bottom-right corner
  ctx.lineTo(x + width, y + height - br);
  ctx.arcTo(x + width, y + height, x + width - br, y + height, br);

  // Bottom edge and bottom-left corner
  ctx.lineTo(x + bl, y + height);
  ctx.arcTo(x, y + height, x, y + height - bl, bl);

  // Left edge and top-left corner
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);

  ctx.closePath();
}

/**
 * Fill a rounded rectangle
 *
 * Convenience wrapper that creates a rounded rectangle path and fills it.
 *
 * @param ctx - Canvas rendering context
 * @param x - X coordinate of top-left corner
 * @param y - Y coordinate of top-left corner
 * @param width - Width of rectangle
 * @param height - Height of rectangle
 * @param radius - Corner radius
 *
 * @example
 * ```typescript
 * ctx.fillStyle = '#333';
 * fillRoundRect(ctx, 10, 10, 100, 50, 6);
 * ```
 */
export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: CornerRadius
): void {
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
}

/**
 * Stroke a rounded rectangle
 *
 * Convenience wrapper that creates a rounded rectangle path and strokes it.
 *
 * @param ctx - Canvas rendering context
 * @param x - X coordinate of top-left corner
 * @param y - Y coordinate of top-left corner
 * @param width - Width of rectangle
 * @param height - Height of rectangle
 * @param radius - Corner radius
 *
 * @example
 * ```typescript
 * ctx.strokeStyle = '#fff';
 * ctx.lineWidth = 2;
 * strokeRoundRect(ctx, 10, 10, 100, 50, 6);
 * ```
 */
export function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: CornerRadius
): void {
  roundRect(ctx, x, y, width, height, radius);
  ctx.stroke();
}

/**
 * Truncate text to fit within a maximum width, adding ellipsis if needed
 *
 * Efficiently truncates text by measuring progressively shorter strings
 * until one fits within the specified width. Uses the context's current font settings.
 *
 * @param ctx - Canvas rendering context (with font already set)
 * @param text - Text to truncate
 * @param maxWidth - Maximum width in pixels
 * @returns Truncated text with '…' appended if truncation occurred
 *
 * @example
 * ```typescript
 * ctx.font = '12px Inter-Regular';
 * const displayText = truncateText(ctx, 'Very Long Port Name', 80);
 * // Returns "Very Long Po…" if it doesn't fit
 * ctx.fillText(displayText, x, y);
 * ```
 */
export function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  // If the text already fits, return it as-is
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  const ellipsis = '…';
  const ellipsisWidth = ctx.measureText(ellipsis).width;

  // If even the ellipsis doesn't fit, just return it
  if (ellipsisWidth > maxWidth) {
    return ellipsis;
  }

  // Binary search for the optimal truncation point
  let left = 0;
  let right = text.length;
  let result = '';

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const truncated = text.slice(0, mid);
    const width = ctx.measureText(truncated + ellipsis).width;

    if (width <= maxWidth) {
      result = truncated;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result + ellipsis;
}
