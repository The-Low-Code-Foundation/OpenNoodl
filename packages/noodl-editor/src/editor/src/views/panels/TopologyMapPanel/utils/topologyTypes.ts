/**
 * Topology Map Types
 *
 * Type definitions for the Project Topology Map visualization.
 */

import { ComponentModel } from '@noodl-models/componentmodel';

/**
 * A node in the topology graph representing a component.
 */
export interface TopologyNode {
  /** Component model instance */
  component: ComponentModel;
  /** Component name (display) */
  name: string;
  /** Full component path */
  fullName: string;
  /** Component type classification */
  type: 'page' | 'component';
  /** Number of times this component is used */
  usageCount: number;
  /** Component names that use this component */
  usedBy: string[];
  /** Component names that this component uses */
  uses: string[];
  /** Nesting depth from root (0 = root, 1 = used by root, etc.) */
  depth: number;
  /** Whether this is the currently active component */
  isCurrentComponent: boolean;
  /** X position (set by layout engine) */
  x?: number;
  /** Y position (set by layout engine) */
  y?: number;
  /** Node width (set by layout engine) */
  width?: number;
  /** Node height (set by layout engine) */
  height?: number;
}

/**
 * Positioned folder graph with layout coordinates
 */
export interface PositionedFolderGraph extends FolderGraph {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * View mode for topology map
 */
export type TopologyViewMode = 'overview' | 'expanded';

/**
 * View state for topology map
 */
export interface TopologyViewState {
  mode: TopologyViewMode;
  expandedFolderId: string | null;
  selectedComponentId: string | null;
}

/**
 * A connection between two topology nodes (components).
 */
export interface TopologyEdge {
  /** Source component full name */
  from: string;
  /** Target component full name */
  to: string;
  /** Connection type (e.g., 'children', 'component') */
  type?: string;
  /** Number of connections between these components (for aggregated edges) */
  count?: number;
}

/**
 * The complete topology graph structure.
 */
export interface TopologyGraph {
  /** All nodes in the graph */
  nodes: TopologyNode[];
  /** All edges in the graph */
  edges: TopologyEdge[];
  /** Breadcrumb path from root to current component */
  currentPath: string[];
  /** The currently active component fullName */
  currentComponentName: string | null;
  /** Total node count */
  totalNodes: number;
  /** Count by type */
  counts: {
    pages: number;
    components: number;
    shared: number; // Used 2+ times
    orphans: number; // Never used
  };
}

/**
 * Configuration for the topology layout.
 */
export interface TopologyLayoutConfig {
  /** Direction of flow */
  rankdir: 'TB' | 'LR' | 'BT' | 'RL';
  /** Vertical separation between ranks */
  ranksep: number;
  /** Horizontal separation between nodes */
  nodesep: number;
  /** Margins around the graph */
  margin: { x: number; y: number };
}

/**
 * Positioned topology graph ready for rendering.
 */
export interface PositionedTopologyGraph extends TopologyGraph {
  /** Nodes with layout positions */
  nodes: TopologyNode[];
  /** Bounding box of the entire graph */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Folder type classification for semantic grouping.
 */
export type FolderType = 'page' | 'feature' | 'integration' | 'ui' | 'utility' | 'orphan';

/**
 * A folder node representing a group of components.
 * This is the primary unit in the folder-first topology view.
 */
export interface FolderNode {
  /** Unique folder identifier */
  id: string;
  /** Display name (e.g., "Directus", "Forms") */
  name: string;
  /** Full folder path (e.g., "/#Directus") */
  path: string;
  /** Folder type classification */
  type: FolderType;
  /** Number of components in this folder */
  componentCount: number;
  /** Component models in this folder */
  components: ComponentModel[];
  /** Component names for preview (first few names) */
  componentNames: string[];
  /** Connection statistics */
  connectionCount: {
    incoming: number;
    outgoing: number;
  };
  /** Semantic tier for layout (0=pages, 1=features, 2=shared, 3=utilities, -1=orphans) */
  tier: number;
  /** X position (set by layout engine or custom position) */
  x?: number;
  /** Y position (set by layout engine or custom position) */
  y?: number;
  /** Node width (set by layout engine) */
  width?: number;
  /** Node height (set by layout engine) */
  height?: number;
}

/**
 * A top-level component to display as an individual card (e.g., pages).
 */
export interface TopLevelComponent {
  /** The component model */
  component: ComponentModel;
  /** Whether this is the App component (for special styling) */
  isAppComponent: boolean;
  /** X position (set by layout engine) */
  x?: number;
  /** Y position (set by layout engine) */
  y?: number;
  /** Node width (set by layout engine) */
  width?: number;
  /** Node height (set by layout engine) */
  height?: number;
}

/**
 * A connection between two folders, aggregating component-level connections.
 */
export interface FolderConnection {
  /** Source folder id */
  from: string;
  /** Target folder id */
  to: string;
  /** Number of component-to-component connections between these folders */
  count: number;
  /** Individual component pairs that create this connection */
  componentPairs: Array<{ from: string; to: string }>;
}

/**
 * The complete folder-level topology graph.
 */
export interface FolderGraph {
  /** All folder nodes */
  folders: FolderNode[];
  /** Top-level components to display as individual cards (e.g., pages) */
  topLevelComponents: TopLevelComponent[];
  /** All folder-to-folder connections */
  connections: FolderConnection[];
  /** Components that don't belong to any folder or are unused */
  orphanComponents: ComponentModel[];
  /** Total folder count */
  totalFolders: number;
  /** Total component count across all folders */
  totalComponents: number;
}

/**
 * Positioned folder graph ready for rendering.
 */
export interface PositionedFolderGraph extends FolderGraph {
  /** Folders with layout positions */
  folders: FolderNode[];
  /** Bounding box of the entire graph */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Sticky note color options (fixed palette)
 */
export type StickyNoteColor = 'yellow' | 'blue' | 'pink' | 'green';

/**
 * A sticky note annotation on the topology map
 */
export interface StickyNote {
  /** Unique identifier */
  id: string;
  /** X position */
  x: number;
  /** Y position */
  y: number;
  /** Note width */
  width: number;
  /** Note height */
  height: number;
  /** Note text content */
  text: string;
  /** Note color */
  color: StickyNoteColor;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Custom position override for a node
 */
export interface CustomPosition {
  x: number;
  y: number;
}

/**
 * Topology map metadata stored in project.json
 */
export interface TopologyMapMetadata {
  /** Schema version for migrations */
  version: number;
  /** Custom positions by node ID */
  customPositions: Record<string, CustomPosition>;
  /** Sticky notes */
  stickyNotes: StickyNote[];
}
