/**
 * Shared types for the canvas subsystem (PLAT-001 decomposition).
 *
 * `nodegrapheditor.ts` re-exports the public ones (`IVector2`,
 * `CenterToFitMode`) so existing import sites keep working.
 */

export type IVector2 = {
  x: number;
  y: number;
};

export type PanAndScale = {
  scale: number;
  x: number;
  y: number;
};

export type AABB = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/** A rectangle in graph space, used for centering and AABB math. */
export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export enum CenterToFitMode {
  RootNodes,
  AllNodes
}

export type MouseEventType = 'down' | 'up' | 'move' | 'over' | 'out';

export const SnapSpacing = 8;
