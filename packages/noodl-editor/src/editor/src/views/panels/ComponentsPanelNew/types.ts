/**
 * TypeScript type definitions for ComponentsPanel
 */

import { ComponentModel } from '@noodl-models/componentmodel';

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
  hasWarnings: boolean;
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
}
