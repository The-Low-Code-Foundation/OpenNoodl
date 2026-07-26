/**
 * Node picker geometry — the single source of truth (UIX-013).
 *
 * The panel used to be sized twice: `800px × 600px` hardcoded in
 * `createnewnodepanel.ts` (PopupLayer measures the element before React has
 * rendered into it) and again in `NodePicker.module.scss`, with a comment
 * asking whoever changed one to remember the other.
 *
 * The UIX-013 mock is 1000 × 660, but the editor window's minimum is 600 × 300
 * (`main/main.js`), so a fixed panel that size does not fit the smallest
 * supported window. The size is therefore a *maximum*, clamped to the viewport
 * here and consumed by both the wrapper and the stylesheet (as a CSS custom
 * property) so it can only be stated once.
 */

/** The mock's panel size — an upper bound, not a fixed size. */
export const NODE_PICKER_MAX_WIDTH = 1000;
export const NODE_PICKER_MAX_HEIGHT = 660;

/** Below these the layout stops being usable; the panel scrolls instead. */
export const NODE_PICKER_MIN_WIDTH = 460;
export const NODE_PICKER_MIN_HEIGHT = 320;

/** Breathing room kept between the panel and the window edge. */
const VIEWPORT_MARGIN_X = 48;
const VIEWPORT_MARGIN_Y = 64;

/**
 * Below this the docs preview column is dropped — at that width it would take
 * the space the results grid needs, and the preview is the least essential of
 * the three columns.
 */
export const NODE_PICKER_PREVIEW_MIN_WIDTH = 760;

/** Below this the category rail is dropped too, leaving the results only. */
export const NODE_PICKER_RAIL_MIN_WIDTH = 560;

/** Results grid columns, by available panel width. */
export function getResultColumns(panelWidth: number): number {
  if (panelWidth >= NODE_PICKER_PREVIEW_MIN_WIDTH) return 3;
  if (panelWidth >= NODE_PICKER_RAIL_MIN_WIDTH) return 2;
  return 1;
}

export interface NodePickerSize {
  width: number;
  height: number;
}

/**
 * The panel size for a given viewport, clamped so it always fits.
 *
 * Called once by `CreateNewNodePanel.render()` (which needs pixels for
 * PopupLayer) and handed to the React tree, so both agree by construction.
 */
export function getNodePickerSize(viewport?: NodePickerSize): NodePickerSize {
  const available = viewport ?? {
    width: typeof window === 'undefined' ? NODE_PICKER_MAX_WIDTH : window.innerWidth,
    height: typeof window === 'undefined' ? NODE_PICKER_MAX_HEIGHT : window.innerHeight
  };

  return {
    width: Math.max(NODE_PICKER_MIN_WIDTH, Math.min(NODE_PICKER_MAX_WIDTH, available.width - VIEWPORT_MARGIN_X)),
    height: Math.max(NODE_PICKER_MIN_HEIGHT, Math.min(NODE_PICKER_MAX_HEIGHT, available.height - VIEWPORT_MARGIN_Y))
  };
}
