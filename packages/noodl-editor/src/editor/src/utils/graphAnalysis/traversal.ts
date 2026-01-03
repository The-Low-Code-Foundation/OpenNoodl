/**
 * Graph traversal utilities for analyzing node connections and data flow
 */

import type { ComponentModel } from '@noodl-models/componentmodel';
import type { NodeGraphNode } from '@noodl-models/nodegraphmodel';

import type { ConnectionPath, ConnectionRef, ComponentCrossing, TraversalResult } from './types';

/**
 * Options for connection chain tracing
 */
export interface TraceOptions {
  /** Maximum depth to traverse (default: 100) */
  maxDepth?: number;

  /** Whether to cross component boundaries via Component Inputs/Outputs (default: false) */
  crossComponents?: boolean;

  /** Node types to stop at (e.g., ['Variable', 'Object']) */
  stopAtTypes?: string[];

  /** Stop at first branch (default: false, follows all branches) */
  stopAtBranch?: boolean;
}

/**
 * Trace a connection chain from a starting point.
 * Follows connections upstream (to sources) or downstream (to sinks).
 *
 * @param component - Component containing the starting node
 * @param startNodeId - ID of the node to start from
 * @param startPort - Port name to start from
 * @param direction - 'upstream' (find sources) or 'downstream' (find sinks)
 * @param options - Traversal options
 * @returns Traversal result with path and metadata
 *
 * @example
 * ```typescript
 * // Find what feeds into a Text node's 'text' input
 * const result = traceConnectionChain(
 *   component,
 *   textNodeId,
 *   'text',
 *   'upstream'
 * );
 * console.log('Path:', result.path.map(p => p.node.label));
 * ```
 */
export function traceConnectionChain(
  component: ComponentModel,
  startNodeId: string,
  startPort: string,
  direction: 'upstream' | 'downstream',
  options: TraceOptions = {}
): TraversalResult {
  const maxDepth = options.maxDepth ?? 100;
  const crossComponents = options.crossComponents ?? false;
  const stopAtTypes = options.stopAtTypes ?? [];
  const stopAtBranch = options.stopAtBranch ?? false;

  const path: ConnectionPath[] = [];
  const crossedComponents: ComponentCrossing[] = [];
  const visited = new Set<string>();

  const startNode = component.graph.nodeMap.get(startNodeId);
  if (!startNode) {
    return {
      path: [],
      crossedComponents: [],
      terminatedAt: 'source'
    };
  }

  // Add starting point
  path.push({
    node: startNode,
    port: startPort,
    direction: direction === 'upstream' ? 'input' : 'output'
  });

  let currentNodes: { nodeId: string; port: string }[] = [{ nodeId: startNodeId, port: startPort }];
  let depth = 0;

  while (currentNodes.length > 0 && depth < maxDepth) {
    const nextNodes: { nodeId: string; port: string }[] = [];

    for (const current of currentNodes) {
      const key = `${current.nodeId}:${current.port}`;
      if (visited.has(key)) {
        continue; // Skip cycles
      }
      visited.add(key);

      const connections = getPortConnections(
        component,
        current.nodeId,
        current.port,
        direction === 'upstream' ? 'input' : 'output'
      );

      if (connections.length === 0) {
        // Dead end - no more connections
        continue;
      }

      if (stopAtBranch && connections.length > 1) {
        // Multiple branches - stop here if requested
        return {
          path,
          crossedComponents,
          terminatedAt: 'sink'
        };
      }

      for (const conn of connections) {
        const targetNodeId = direction === 'upstream' ? conn.fromNodeId : conn.toNodeId;
        const targetPort = direction === 'upstream' ? conn.fromPort : conn.toPort;

        const targetNode = component.graph.nodeMap.get(targetNodeId);
        if (!targetNode) continue;

        // Check if we should stop at this node type
        if (stopAtTypes.includes(targetNode.typename)) {
          path.push({
            node: targetNode,
            port: targetPort,
            direction: direction === 'upstream' ? 'output' : 'input',
            connection: conn
          });
          return {
            path,
            crossedComponents,
            terminatedAt: 'source'
          };
        }

        // Check for component boundary
        if (targetNode.typename === 'Component Inputs' || targetNode.typename === 'Component Outputs') {
          if (crossComponents) {
            // TODO: Cross component boundary resolution
            // This requires finding the parent component instance and resolving connections
            return {
              path,
              crossedComponents,
              terminatedAt: 'component-boundary'
            };
          } else {
            path.push({
              node: targetNode,
              port: targetPort,
              direction: direction === 'upstream' ? 'output' : 'input',
              connection: conn
            });
            return {
              path,
              crossedComponents,
              terminatedAt: 'component-boundary'
            };
          }
        }

        // Add to path and continue
        path.push({
          node: targetNode,
          port: targetPort,
          direction: direction === 'upstream' ? 'output' : 'input',
          connection: conn
        });

        nextNodes.push({ nodeId: targetNodeId, port: targetPort });
      }
    }

    currentNodes = nextNodes;
    depth++;
  }

  // Determine termination reason
  if (depth >= maxDepth) {
    return { path, crossedComponents, terminatedAt: 'cycle' };
  }

  return {
    path,
    crossedComponents,
    terminatedAt: direction === 'upstream' ? 'source' : 'sink'
  };
}

/**
 * Get all nodes directly connected to a given node.
 *
 * @param component - Component containing the node
 * @param nodeId - ID of the node to check
 * @returns Object with arrays of connected input and output nodes
 *
 * @example
 * ```typescript
 * const neighbors = getConnectedNodes(component, nodeId);
 * console.log('Inputs from:', neighbors.inputs.map(n => n.label));
 * console.log('Outputs to:', neighbors.outputs.map(n => n.label));
 * ```
 */
export function getConnectedNodes(
  component: ComponentModel,
  nodeId: string
): { inputs: NodeGraphNode[]; outputs: NodeGraphNode[] } {
  const inputs: NodeGraphNode[] = [];
  const outputs: NodeGraphNode[] = [];
  const inputSet = new Set<string>();
  const outputSet = new Set<string>();

  for (const conn of component.graph.connections) {
    // Find nodes that feed into this node (inputs)
    if (conn.toId === nodeId) {
      if (!inputSet.has(conn.fromId)) {
        const node = component.graph.nodeMap.get(conn.fromId);
        if (node) {
          inputs.push(node);
          inputSet.add(conn.fromId);
        }
      }
    }

    // Find nodes that this node feeds into (outputs)
    if (conn.fromId === nodeId) {
      if (!outputSet.has(conn.toId)) {
        const node = component.graph.nodeMap.get(conn.toId);
        if (node) {
          outputs.push(node);
          outputSet.add(conn.toId);
        }
      }
    }
  }

  return { inputs, outputs };
}

/**
 * Get all connections for a specific port.
 *
 * @param component - Component containing the node
 * @param nodeId - ID of the node
 * @param portName - Name of the port
 * @param direction - Port direction ('input' or 'output')
 * @returns Array of connection references
 *
 * @example
 * ```typescript
 * const connections = getPortConnections(component, nodeId, 'value', 'output');
 * console.log('Sends to:', connections.map(c => c.toNodeId));
 * ```
 */
export function getPortConnections(
  component: ComponentModel,
  nodeId: string,
  portName: string,
  direction: 'input' | 'output'
): ConnectionRef[] {
  const connections: ConnectionRef[] = [];

  for (const conn of component.graph.connections) {
    if (direction === 'input' && conn.toId === nodeId && conn.toProperty === portName) {
      connections.push({
        fromNodeId: conn.fromId,
        fromPort: conn.fromProperty,
        toNodeId: conn.toId,
        toPort: conn.toProperty
      });
    } else if (direction === 'output' && conn.fromId === nodeId && conn.fromProperty === portName) {
      connections.push({
        fromNodeId: conn.fromId,
        fromPort: conn.fromProperty,
        toNodeId: conn.toId,
        toPort: conn.toProperty
      });
    }
  }

  return connections;
}

/**
 * Build an adjacency list representation of the node graph.
 * Useful for graph algorithms and analysis.
 *
 * @param component - Component to analyze
 * @returns Map of node IDs to their connected node IDs (inputs and outputs)
 *
 * @example
 * ```typescript
 * const adjacency = buildAdjacencyList(component);
 * const nodeConnections = adjacency.get(nodeId);
 * console.log('Inputs:', nodeConnections.inputs);
 * console.log('Outputs:', nodeConnections.outputs);
 * ```
 */
export function buildAdjacencyList(component: ComponentModel): Map<string, { inputs: string[]; outputs: string[] }> {
  const adjacency = new Map<string, { inputs: string[]; outputs: string[] }>();

  // Initialize all nodes
  component.graph.nodeMap.forEach((node) => {
    adjacency.set(node.id, { inputs: [], outputs: [] });
  });

  // Add connections
  for (const conn of component.graph.connections) {
    const fromEntry = adjacency.get(conn.fromId);
    const toEntry = adjacency.get(conn.toId);

    if (fromEntry) {
      fromEntry.outputs.push(conn.toId);
    }

    if (toEntry) {
      toEntry.inputs.push(conn.fromId);
    }
  }

  return adjacency;
}

/**
 * Get all connections in a component.
 *
 * @param component - Component to analyze
 * @returns Array of all connection references
 */
export function getAllConnections(component: ComponentModel): ConnectionRef[] {
  return component.graph.connections.map((conn) => ({
    fromNodeId: conn.fromId,
    fromPort: conn.fromProperty,
    toNodeId: conn.toId,
    toPort: conn.toProperty
  }));
}

/**
 * Find all nodes of a specific type in a component.
 *
 * @param component - Component to search
 * @param typename - Node type name to find
 * @returns Array of matching nodes
 *
 * @example
 * ```typescript
 * const variables = findNodesOfType(component, 'Variable');
 * console.log('Variables:', variables.map(n => n.label));
 * ```
 */
export function findNodesOfType(component: ComponentModel, typename: string): NodeGraphNode[] {
  const nodes: NodeGraphNode[] = [];

  component.graph.nodeMap.forEach((node) => {
    if (node.typename === typename) {
      nodes.push(node);
    }
  });

  return nodes;
}
