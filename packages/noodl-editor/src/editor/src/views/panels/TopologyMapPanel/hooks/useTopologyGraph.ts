/**
 * useTopologyGraph Hook
 *
 * Builds the topology graph data structure from the current project.
 * Uses VIEW-000 graph analysis utilities to extract component relationships.
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import { useEventListener } from '@noodl-hooks/useEventListener';
import { useMemo, useState } from 'react';

import { ComponentModel } from '@noodl-models/componentmodel';
import { ProjectModel } from '@noodl-models/projectmodel';
import { buildComponentDependencyGraph, findComponentUsages, getComponentDepth } from '@noodl-utils/graphAnalysis';

import { TopologyGraph, TopologyNode, TopologyEdge } from '../utils/topologyTypes';

/**
 * Determines if a component should be classified as a page.
 * Pages typically have 'Page' in their name or are at the root level.
 */
function isPageComponent(component: ComponentModel): boolean {
  const name = component.name.toLowerCase();
  return (
    name.includes('page') ||
    name.includes('screen') ||
    name === 'app' ||
    name === 'root' ||
    component.fullName === component.name // Root level component
  );
}

/**
 * Builds the breadcrumb path from root to the current component.
 */
function buildBreadcrumbPath(currentComponent: ComponentModel | null, project: ProjectModel): string[] {
  if (!currentComponent) return [];

  const path: string[] = [];
  const visited = new Set<string>();

  // Start from current and work backwards to find a path to root
  let current = currentComponent;
  path.unshift(current.fullName);
  visited.add(current.fullName);

  // Find parent components (components that use the current one)
  while (current) {
    const usages = findComponentUsages(project, current.fullName);

    if (usages.length === 0) {
      // No parent found, we're at a root
      break;
    }

    // Pick the first parent (could be multiple paths, we just show one)
    const parent = usages[0].usedIn;
    if (!parent || visited.has(parent.fullName)) {
      // Avoid cycles
      break;
    }

    path.unshift(parent.fullName);
    visited.add(parent.fullName);
    current = parent;
  }

  return path;
}

/**
 * Hook that builds and returns the topology graph for the current project.
 *
 * @returns The complete topology graph with nodes, edges, and metadata
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const graph = useTopologyGraph();
 *
 *   return (
 *     <div>
 *       <p>Total components: {graph.totalNodes}</p>
 *       <p>Pages: {graph.counts.pages}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTopologyGraph(): TopologyGraph {
  const project = ProjectModel.instance;
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Get current component from NodeGraphContext
  const currentComponent = NodeGraphContextTmp.nodeGraph?.activeComponent || null;

  // Rebuild graph when components change
  useEventListener(ProjectModel.instance, 'componentAdded', () => {
    setUpdateTrigger((prev) => prev + 1);
  });

  useEventListener(ProjectModel.instance, 'componentRemoved', () => {
    setUpdateTrigger((prev) => prev + 1);
  });

  // Listen to node graph for component switches
  useEventListener(NodeGraphContextTmp.nodeGraph, 'activeComponentChanged', () => {
    setUpdateTrigger((prev) => prev + 1);
  });

  const graph = useMemo<TopologyGraph>(() => {
    console.log('[TopologyMap] Building topology graph...');

    // Use VIEW-000 utility to build the base graph
    const dependencyGraph = buildComponentDependencyGraph(project);

    // Build nodes with enhanced metadata
    const nodes: TopologyNode[] = dependencyGraph.nodes.map((component) => {
      const fullName = component.fullName;
      const usages = findComponentUsages(project, fullName);
      const depth = getComponentDepth(project, fullName);

      // Find edges to/from this component
      const usedBy = dependencyGraph.edges.filter((edge) => edge.to === fullName).map((edge) => edge.from);

      const uses = dependencyGraph.edges.filter((edge) => edge.from === fullName).map((edge) => edge.to);

      return {
        component,
        name: component.name,
        fullName: fullName,
        type: isPageComponent(component) ? 'page' : 'component',
        usageCount: usages.length,
        usedBy,
        uses,
        depth: depth >= 0 ? depth : 999, // Put unreachable components at the bottom
        isCurrentComponent: currentComponent?.fullName === fullName
      };
    });

    // Copy edges from dependency graph
    const edges: TopologyEdge[] = dependencyGraph.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      count: edge.count
    }));

    // Build breadcrumb path
    const currentPath = buildBreadcrumbPath(currentComponent, project);

    // Calculate counts
    const pages = nodes.filter((n) => n.type === 'page').length;
    const components = nodes.filter((n) => n.type === 'component').length;
    const shared = nodes.filter((n) => n.usageCount >= 2).length;
    const orphans = nodes.filter((n) => n.usageCount === 0 && n.depth === 999).length;

    console.log(`[TopologyMap] Built graph: ${nodes.length} nodes, ${edges.length} edges`);
    console.log(`[TopologyMap] Stats: ${pages} pages, ${components} components, ${shared} shared, ${orphans} orphans`);

    return {
      nodes,
      edges,
      currentPath,
      currentComponentName: currentComponent?.fullName || null,
      totalNodes: nodes.length,
      counts: {
        pages,
        components,
        shared,
        orphans
      }
    };
  }, [project, currentComponent, updateTrigger]);

  return graph;
}
