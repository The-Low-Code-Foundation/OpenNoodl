/**
 * Cross-component resolution utilities for tracing connections through component boundaries
 */

import { ComponentModel } from '@noodl-models/componentmodel';
import { ProjectModel } from '@noodl-models/projectmodel';

import type { ComponentUsage, ExternalConnection } from './types';

/**
 * Find all places where a component is instantiated across the project.
 *
 * @param project - Project to search
 * @param componentName - Name of the component to find usages of
 * @returns Array of component usage information
 *
 * @example
 * ```typescript
 * const usages = findComponentUsages(project, 'UserCard');
 * usages.forEach(usage => {
 *   console.log(`Used in ${usage.usedIn.name} as node ${usage.instanceNodeId}`);
 * });
 * ```
 */
export function findComponentUsages(project: ProjectModel, componentName: string): ComponentUsage[] {
  const usages: ComponentUsage[] = [];
  const targetComponent = project.getComponentWithName(componentName);

  if (!targetComponent) {
    return usages;
  }

  // Iterate through all components in the project
  project.forEachComponent((component: ComponentModel) => {
    // Skip the component itself
    if (component.name === componentName) {
      return;
    }

    // Check all nodes in this component
    component.graph.nodeMap.forEach((node) => {
      // Check if this node is an instance of the target component
      if (node.type instanceof ComponentModel && node.type.name === componentName) {
        // Find all connections to this component instance
        const connectedPorts: ComponentUsage['connectedPorts'] = [];
        const ports = node.getPorts('input');

        ports.forEach((port) => {
          const connections = component.graph.connections.filter(
            (conn) => conn.toId === node.id && conn.toProperty === port.name
          );

          if (connections.length > 0) {
            connectedPorts.push({
              port: port.name,
              connectedTo: connections.map((conn) => ({
                nodeId: conn.fromId,
                port: conn.fromProperty
              }))
            });
          }
        });

        usages.push({
          component: targetComponent,
          usedIn: component,
          instanceNodeId: node.id,
          connectedPorts
        });
      }
    });
  });

  return usages;
}

/**
 * Resolve a Component Input/Output port to its external connections.
 * Given a Component Inputs node, find what feeds into it from the parent component.
 * Given a Component Outputs node, find what it feeds into in the parent component.
 *
 * @param project - Project containing the components
 * @param component - Component containing the boundary node
 * @param boundaryNodeId - ID of the Component Inputs or Component Outputs node
 * @param portName - Name of the port on the boundary node
 * @returns Array of external connections (empty if not found or no parent)
 *
 * @example
 * ```typescript
 * // Inside a "UserCard" component, find what connects to Component Inputs "userId" port
 * const external = resolveComponentBoundary(
 *   project,
 *   userCardComponent,
 *   componentInputsNodeId,
 *   'userId'
 * );
 * external.forEach(conn => {
 *   console.log(`Parent connects from node ${conn.parentNodeId}`);
 * });
 * ```
 */
export function resolveComponentBoundary(
  project: ProjectModel,
  component: ComponentModel,
  boundaryNodeId: string,
  portName: string
): ExternalConnection[] {
  const boundaryNode = component.graph.nodeMap.get(boundaryNodeId);
  if (!boundaryNode) {
    return [];
  }

  const connections: ExternalConnection[] = [];

  // Determine if this is an input or output boundary
  const isInput = boundaryNode.typename === 'Component Inputs';
  const isOutput = boundaryNode.typename === 'Component Outputs';

  if (!isInput && !isOutput) {
    return [];
  }

  // Find all instances of this component in other components
  const usages = findComponentUsages(project, component.name);

  for (const usage of usages) {
    const parentComponent = usage.usedIn;
    const instanceNode = parentComponent.graph.nodeMap.get(usage.instanceNodeId);

    if (!instanceNode) continue;

    if (isInput) {
      // For Component Inputs, find connections in parent that feed into this port
      const parentConnections = parentComponent.graph.connections.filter(
        (conn) => conn.toId === usage.instanceNodeId && conn.toProperty === portName
      );

      for (const conn of parentConnections) {
        connections.push({
          parentNodeId: conn.fromId,
          parentPort: conn.fromProperty,
          childComponent: component,
          childBoundaryNodeId: boundaryNodeId,
          childPort: portName
        });
      }
    } else if (isOutput) {
      // For Component Outputs, find connections in parent that this port feeds into
      const parentConnections = parentComponent.graph.connections.filter(
        (conn) => conn.fromId === usage.instanceNodeId && conn.fromProperty === portName
      );

      for (const conn of parentConnections) {
        connections.push({
          parentNodeId: conn.toId,
          parentPort: conn.toProperty,
          childComponent: component,
          childBoundaryNodeId: boundaryNodeId,
          childPort: portName
        });
      }
    }
  }

  return connections;
}

/**
 * Build a complete component dependency graph for the project.
 * Shows which components use which other components.
 *
 * @param project - Project to analyze
 * @returns Object with nodes (components) and edges (usage relationships)
 *
 * @example
 * ```typescript
 * const graph = buildComponentDependencyGraph(project);
 * console.log('Components:', graph.nodes.map(c => c.name));
 * graph.edges.forEach(edge => {
 *   console.log(`${edge.from} uses ${edge.to} ${edge.count} times`);
 * });
 * ```
 */
export function buildComponentDependencyGraph(project: ProjectModel): {
  nodes: ComponentModel[];
  edges: { from: string; to: string; count: number }[];
} {
  const nodes: ComponentModel[] = [];
  const edgeMap = new Map<string, { from: string; to: string; count: number }>();

  // Collect all components as nodes
  project.forEachComponent((component: ComponentModel) => {
    nodes.push(component);
  });

  // Build edges by finding component instances
  project.forEachComponent((component: ComponentModel) => {
    component.graph.nodeMap.forEach((node) => {
      if (node.type instanceof ComponentModel) {
        const usedComponentName = node.type.name;
        const key = `${component.name}→${usedComponentName}`;

        if (edgeMap.has(key)) {
          const edge = edgeMap.get(key)!;
          edge.count++;
        } else {
          edgeMap.set(key, {
            from: component.name,
            to: usedComponentName,
            count: 1
          });
        }
      }
    });
  });

  const edges = Array.from(edgeMap.values());

  return { nodes, edges };
}

/**
 * Check if a component is used (instantiated) anywhere in the project.
 *
 * @param project - Project to search
 * @param componentName - Name of the component to check
 * @returns True if the component is used at least once
 *
 * @example
 * ```typescript
 * if (!isComponentUsed(project, 'OldWidget')) {
 *   console.log('This component is not used and can be deleted');
 * }
 * ```
 */
export function isComponentUsed(project: ProjectModel, componentName: string): boolean {
  return findComponentUsages(project, componentName).length > 0;
}

/**
 * Find all components that are not used anywhere in the project.
 * These might be candidates for cleanup.
 *
 * @param project - Project to analyze
 * @returns Array of unused component names
 *
 * @example
 * ```typescript
 * const unused = findUnusedComponents(project);
 * console.log('Unused components:', unused);
 * ```
 */
export function findUnusedComponents(project: ProjectModel): string[] {
  const unused: string[] = [];

  project.forEachComponent((component: ComponentModel) => {
    // Skip special components that might not be directly instantiated
    // but are used via routing (like App Shell)
    const rootComponent = project.getRootComponent();
    if (rootComponent && component.name === rootComponent.name) {
      return; // Skip root component
    }

    if (!isComponentUsed(project, component.name)) {
      unused.push(component.name);
    }
  });

  return unused;
}

/**
 * Get the depth of a component in the component hierarchy.
 * Depth 0 = root component
 * Depth 1 = components used by root
 * Depth 2 = components used by depth 1 components, etc.
 *
 * @param project - Project to analyze
 * @param componentName - Name of the component
 * @returns Depth in the hierarchy (0 for root, -1 if unused/unreachable)
 *
 * @example
 * ```typescript
 * const depth = getComponentDepth(project, 'UserCard');
 * console.log(`UserCard is at depth ${depth} in the hierarchy`);
 * ```
 */
export function getComponentDepth(project: ProjectModel, componentName: string): number {
  const rootComponent = project.getRootComponent();
  const rootName = rootComponent?.name;

  if (!rootName || componentName === rootName) {
    return componentName === rootName ? 0 : -1;
  }

  const visited = new Set<string>();
  const queue: { name: string; depth: number }[] = [{ name: rootName, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current.name)) {
      continue;
    }
    visited.add(current.name);

    const component = project.getComponentWithName(current.name);
    if (!component) continue;

    // Check all nodes in this component
    component.graph.nodeMap.forEach((node) => {
      if (node.type instanceof ComponentModel) {
        const usedName = node.type.name;

        if (usedName === componentName) {
          return current.depth + 1; // Found it!
        }

        queue.push({ name: usedName, depth: current.depth + 1 });
      }
    });
  }

  return -1; // Not reachable from root
}
