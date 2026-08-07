/**
 * useTopologyLayout Hook
 *
 * Applies Dagre layout algorithm to position topology graph nodes.
 * Returns a positioned graph ready for SVG rendering.
 */

import dagre from 'dagre';
import { useMemo } from 'react';

import { TopologyGraph, TopologyLayoutConfig, PositionedTopologyGraph, TopologyNode } from '../utils/topologyTypes';

/**
 * Default layout configuration.
 */
const DEFAULT_LAYOUT_CONFIG: TopologyLayoutConfig = {
  rankdir: 'TB', // Top to bottom
  ranksep: 100, // Vertical spacing between ranks (increased from 80)
  nodesep: 200, // Horizontal spacing between nodes (increased from 50 for better spread)
  margin: { x: 50, y: 50 } // More breathing room (increased from 20)
};

/**
 * Node dimensions based on type and content.
 */
function getNodeDimensions(node: TopologyNode): { width: number; height: number } {
  const baseWidth = 120;
  const baseHeight = 60;

  // Pages are slightly larger
  if (node.type === 'page') {
    return { width: baseWidth + 20, height: baseHeight };
  }

  // Shared components (used multiple times) are slightly wider for badge
  if (node.usageCount >= 2) {
    return { width: baseWidth + 10, height: baseHeight };
  }

  return { width: baseWidth, height: baseHeight };
}

/**
 * Hook that applies Dagre layout to a topology graph.
 *
 * @param graph - The topology graph to layout
 * @param config - Optional layout configuration
 * @returns Positioned topology graph with node coordinates and bounds
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const graph = useTopologyGraph();
 *   const positionedGraph = useTopologyLayout(graph);
 *
 *   return (
 *     <svg viewBox={`0 0 ${positionedGraph.bounds.width} ${positionedGraph.bounds.height}`}>
 *       {positionedGraph.nodes.map(node => (
 *         <rect key={node.fullName} x={node.x} y={node.y} width={node.width} height={node.height} />
 *       ))}
 *     </svg>
 *   );
 * }
 * ```
 */
export function useTopologyLayout(
  graph: TopologyGraph,
  config: Partial<TopologyLayoutConfig> = {}
): PositionedTopologyGraph {
  const layoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...config };

  const positionedGraph = useMemo<PositionedTopologyGraph>(() => {
    console.log('[TopologyLayout] Calculating layout...');

    // Create a new directed graph
    const g = new dagre.graphlib.Graph();

    // Set graph options
    g.setGraph({
      rankdir: layoutConfig.rankdir,
      ranksep: layoutConfig.ranksep,
      nodesep: layoutConfig.nodesep,
      marginx: layoutConfig.margin.x,
      marginy: layoutConfig.margin.y
    });

    // Default edge label
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes with their dimensions
    graph.nodes.forEach((node) => {
      const dimensions = getNodeDimensions(node);
      g.setNode(node.fullName, {
        width: dimensions.width,
        height: dimensions.height,
        ...node // Store original node data
      });
    });

    // Add edges
    graph.edges.forEach((edge) => {
      g.setEdge(edge.from, edge.to);
    });

    // Run layout algorithm
    dagre.layout(g);

    // Extract positioned nodes
    const positionedNodes: TopologyNode[] = graph.nodes.map((node) => {
      const dagreNode = g.node(node.fullName);

      // Dagre returns center coordinates, we need top-left
      const x = dagreNode.x - dagreNode.width / 2;
      const y = dagreNode.y - dagreNode.height / 2;

      return {
        ...node,
        x,
        y,
        width: dagreNode.width,
        height: dagreNode.height
      };
    });

    // Calculate bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    positionedNodes.forEach((node) => {
      if (node.x === undefined || node.y === undefined) return;

      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + (node.width || 0));
      maxY = Math.max(maxY, node.y + (node.height || 0));
    });

    // Add some padding to bounds
    const padding = 40;
    const bounds = {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2
    };

    console.log(`[TopologyLayout] Layout complete: ${bounds.width}x${bounds.height}`);

    return {
      ...graph,
      nodes: positionedNodes,
      bounds
    };
  }, [
    graph,
    layoutConfig.rankdir,
    layoutConfig.ranksep,
    layoutConfig.nodesep,
    layoutConfig.margin.x,
    layoutConfig.margin.y
  ]);

  return positionedGraph;
}
