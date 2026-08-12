/**
 * LGC-008 §1 — where the second splitter sits.
 *
 * The split is stored as a **percentage** of the node-graph shell, written to a CSS custom
 * property on the shell root. A percentage rather than a pixel count so that resizing the
 * window, or dragging the outer preview/graph divider, keeps the two panes in proportion
 * instead of leaving the blocks pane a fixed width and eating the canvas.
 *
 * The DOM is the store: one value, on the element it describes. There is no React state for the
 * split, deliberately — a `mousemove` that goes through a state update re-renders the whole tab
 * content on every frame of a drag, and while that is safe now (F4), it is safe by a property
 * that has to keep holding rather than by construction.
 */

/**
 * The narrowest either pane may be dragged to, in CSS pixels.
 *
 * Blockly's toolbox alone is ~90 px before any block is visible beside it, and the node graph
 * needs enough room to show a node and the wire leaving it. Below this a drag is not resizing a
 * pane, it is closing one — and closing a pane is what the tab's close button is for.
 */
export const LOGIC_PANE_MIN_PX = 240;

/** Where the split sits when the pane first opens: down the middle. */
export const LOGIC_PANE_DEFAULT_PERCENT = 50;

export interface SplitBounds {
  /** The shell's left edge in client coordinates. */
  left: number;
  /** The shell's width in CSS pixels. */
  width: number;
}

/**
 * The canvas pane's width, as a percentage of the shell, for a pointer at `pointerClientX`.
 *
 * Clamped so **both** panes keep {@link LOGIC_PANE_MIN_PX}. When the shell is too narrow to
 * give both of them that, the clamp collapses to the middle rather than picking a side: an
 * arrangement where one pane is legible and the other is a sliver is worse than two cramped
 * ones, and it is recoverable by widening the window, which a sliver is not.
 *
 * Rounded to two decimals because the number is printed into CSS — a percentage carried to
 * fifteen digits is a string nobody can read in the inspector and it buys nothing at any
 * plausible screen width.
 */
export function logicPaneSplitPercent(pointerClientX: number, bounds: SplitBounds): number {
  if (!(bounds.width > 0)) return LOGIC_PANE_DEFAULT_PERCENT;

  const min = Math.min(LOGIC_PANE_MIN_PX, bounds.width / 2);
  const max = bounds.width - min;

  const canvasWidth = Math.min(Math.max(pointerClientX - bounds.left, min), max);
  return Math.round((canvasWidth / bounds.width) * 10000) / 100;
}
