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
  /**
   * WFA-001: the cloud sheet (`#__cloud__`) — components that run on the
   * backend, not in the browser. It is always listed even when empty (there
   * would otherwise be no way to author the first cloud function), it cannot be
   * renamed or deleted, and its components are kept out of the flattened "All"
   * tree. See `CLOUD_SHEET` below and WFA-001-NOTES.md decision 1.
   */
  isCloud?: boolean;
}

/**
 * WFA-001 — the one place the cloud sheet's identity is written down.
 *
 * `RuntimeType` is resolved from this same prefix (`utils/NodeGraph/index.ts`),
 * so this is a runtime boundary rather than an ordinary organisational folder.
 */
export const CLOUD_SHEET = {
  /** Folder name as it appears in a component path: `/#__cloud__/saveOrder`. */
  folderName: '#__cloud__',
  /** Path prefix, including the leading slash and trailing slash. */
  pathPrefix: '/#__cloud__/',
  /** What a user sees in the sheet list. */
  displayName: 'Cloud Functions'
} as const;
