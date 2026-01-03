/**
 * Shared type definitions for graph analysis utilities
 */

import type { ComponentModel } from '@noodl-models/componentmodel';
import type { NodeGraphNode } from '@noodl-models/nodegraphmodel';

/**
 * Node category for semantic grouping
 */
export type NodeCategory =
  | 'visual' // Groups, Text, Image, etc.
  | 'data' // Variables, Objects, Arrays
  | 'logic' // Conditions, Expressions, Switches
  | 'events' // Send Event, Receive Event, Component I/O
  | 'api' // REST, Function, Cloud Functions
  | 'navigation' // Page Router, Navigate
  | 'animation' // Transitions, States (animation-related)
  | 'utility'; // Other/misc

/**
 * Reference to a connection between ports
 */
export interface ConnectionRef {
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
}

/**
 * A point in a connection path
 */
export interface ConnectionPath {
  node: NodeGraphNode;
  port: string;
  direction: 'input' | 'output';
  connection?: ConnectionRef;
}

/**
 * Result of tracing a connection chain
 */
export interface TraversalResult {
  path: ConnectionPath[];
  crossedComponents: ComponentCrossing[];
  terminatedAt: 'source' | 'sink' | 'cycle' | 'component-boundary';
}

/**
 * Information about crossing a component boundary
 */
export interface ComponentCrossing {
  fromComponent: ComponentModel;
  toComponent: ComponentModel;
  viaPort: string;
  direction: 'into' | 'outof';
}

/**
 * Summary of a node's basic properties
 */
export interface NodeSummary {
  id: string;
  type: string;
  displayName: string;
  label: string | null;
  category: NodeCategory;
  inputCount: number;
  outputCount: number;
  connectedInputs: number;
  connectedOutputs: number;
  hasChildren: boolean;
  childCount: number;
}

/**
 * Summary of a connection
 */
export interface ConnectionSummary {
  fromNode: NodeSummary;
  fromPort: string;
  toNode: NodeSummary;
  toPort: string;
}

/**
 * Summary of a component
 */
export interface ComponentSummary {
  name: string;
  fullName: string;
  nodeCount: number;
  connectionCount: number;
  inputPorts: string[];
  outputPorts: string[];
  usedComponents: string[];
  usedByComponents: string[];
  categories: { category: NodeCategory; count: number }[];
}

/**
 * Component usage information
 */
export interface ComponentUsage {
  component: ComponentModel;
  usedIn: ComponentModel;
  instanceNodeId: string;
  connectedPorts: {
    port: string;
    connectedTo: { nodeId: string; port: string }[];
  }[];
}

/**
 * External connection resolved across component boundary
 */
export interface ExternalConnection {
  parentNodeId: string;
  parentPort: string;
  childComponent: ComponentModel;
  childBoundaryNodeId: string;
  childPort: string;
}

/**
 * Group of duplicate nodes
 */
export interface DuplicateGroup {
  name: string;
  type: string;
  instances: {
    node: NodeGraphNode;
    component: ComponentModel;
    connectionCount: number;
  }[];
  severity: 'info' | 'warning' | 'error';
  reason: string;
}

/**
 * Conflict analysis for duplicates
 */
export interface ConflictAnalysis {
  group: DuplicateGroup;
  conflictType: 'name-collision' | 'state-conflict' | 'data-race';
  description: string;
  affectedNodes: string[];
}

/**
 * Categorized nodes by type
 */
export interface CategorizedNodes {
  byCategory: Map<NodeCategory, NodeGraphNode[]>;
  byType: Map<string, NodeGraphNode[]>;
  totals: { category: NodeCategory; count: number }[];
}
