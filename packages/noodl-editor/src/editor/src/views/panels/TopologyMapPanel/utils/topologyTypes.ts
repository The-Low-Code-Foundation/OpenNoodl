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
 * An edge in the topology graph representing component usage.
 */
export interface TopologyEdge {
  /** Source component fullName */
  from: string;
  /** Target component fullName */
  to: string;
  /** Number of instances of this relationship */
  count: number;
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
