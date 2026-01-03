/**
 * Graph Analysis Utilities
 *
 * This module provides utilities for analyzing node graphs, tracing connections,
 * resolving cross-component relationships, and detecting potential issues.
 *
 * @module graphAnalysis
 * @since 1.3.0
 */

// Export all types
export type * from './types';

// Export traversal utilities
export {
  traceConnectionChain,
  getConnectedNodes,
  getPortConnections,
  buildAdjacencyList,
  getAllConnections,
  findNodesOfType,
  type TraceOptions
} from './traversal';

// Export cross-component utilities
export {
  findComponentUsages,
  resolveComponentBoundary,
  buildComponentDependencyGraph,
  isComponentUsed,
  findUnusedComponents,
  getComponentDepth
} from './crossComponent';

// Export categorization utilities
export {
  categorizeNodes,
  getNodeCategory,
  isVisualNode,
  isDataSourceNode,
  isLogicNode,
  isEventNode,
  getNodeCategorySummary,
  getNodeTypeSummary
} from './categorization';

// Export duplicate detection utilities
export {
  findDuplicatesInComponent,
  findDuplicatesInProject,
  analyzeDuplicateConflicts,
  findSimilarlyNamedNodes
} from './duplicateDetection';
