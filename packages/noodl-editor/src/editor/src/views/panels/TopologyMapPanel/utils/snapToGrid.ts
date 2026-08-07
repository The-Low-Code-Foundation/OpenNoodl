/**
 * Snap-to-Grid Utility
 *
 * Snaps coordinates to a grid for clean alignment of draggable elements.
 */

/**
 * Snaps a coordinate to the nearest grid point.
 *
 * @param value - The coordinate value to snap
 * @param gridSize - The size of the grid (default: 20px)
 * @returns The snapped coordinate
 */
export function snapToGrid(value: number, gridSize: number = 20): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snaps an x,y position to the nearest grid point.
 *
 * @param x - The x coordinate
 * @param y - The y coordinate
 * @param gridSize - The size of the grid (default: 20px)
 * @returns Object with snapped x and y coordinates
 */
export function snapPositionToGrid(x: number, y: number, gridSize: number = 20): { x: number; y: number } {
  return {
    x: snapToGrid(x, gridSize),
    y: snapToGrid(y, gridSize)
  };
}
