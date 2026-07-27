/**
 * TypeScript type definitions for ComponentsPanel
 */

import { ComponentModel } from '@noodl-models/componentmodel';

import { ComponentKind } from './componentKind';

/**
 * Data structure for a component item in the tree
 */
export interface ComponentItemData {
  id: string;
  name: string;
  localName: string;
  component: ComponentModel;
  isRoot: boolean;
  isPage: boolean;
  isCloudFunction: boolean;
  isVisual: boolean;
  /** PNL-006: what this component is — see `componentKind.ts`. */
  kind: ComponentKind;
  /**
   * PNL-006: the canvas category name (`ComponentModel.color`). Drives the
   * glyph's colour via the same `--theme-color-node-category-*` token the canvas
   * painter resolves through `CanvasTheme`.
   */
  category: string;
  hasWarnings: boolean;
  /** PNL-006: real count from `WarningsModel`, for the dot's tooltip. */
  warningCount: number;
  path: string;
}

/**
 * Data structure for a folder item in the tree
 */
export interface FolderItemData {
  name: string;
  path: string;
  isOpen: boolean;
  isComponentFolder: boolean;
  component?: ComponentModel;
  children: TreeNode[];
  // Component type flags (only set when isComponentFolder is true)
  isRoot?: boolean;
  isPage?: boolean;
  isCloudFunction?: boolean;
  isVisual?: boolean;
  /** PNL-006, only meaningful when `isComponentFolder`. */
  kind?: ComponentKind;
  category?: string;
  warningCount?: number;
}

/**
 * Union type representing either a component or folder in the tree
 */
export type TreeNode = { type: 'component'; data: ComponentItemData } | { type: 'folder'; data: FolderItemData };

/**
 * Props for ComponentsPanel component
 */
export interface ComponentsPanelProps {
  options?: ComponentsPanelOptions;
}

/**
 * Configuration options for ComponentsPanel
 */
export interface ComponentsPanelOptions {
  showSheetList?: boolean;
  hideSheets?: string[];
  /** Lock to a specific sheet (e.g., for Cloud Functions panel) */
  lockToSheet?: string;
}

/**
 * Represents a sheet (top-level organizational folder)
 * Sheets are folders with names starting with # (e.g., #Pages, #Components)
 */
export interface Sheet {
  /** Display name (without # prefix) */
  name: string;
  /** Original folder name with # prefix, empty string for default sheet */
  folderName: string;
  /** Whether this is the default sheet (components not in any # folder) */
  isDefault: boolean;
  /** Number of components in this sheet */
  componentCount: number;
}
