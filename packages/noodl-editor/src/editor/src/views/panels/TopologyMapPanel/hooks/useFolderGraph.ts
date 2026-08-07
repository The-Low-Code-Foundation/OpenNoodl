/**
 * useFolderGraph Hook
 *
 * Builds the folder-level topology graph from the current project.
 * This replaces useTopologyGraph for the folder-first architecture.
 */

import { useEventListener } from '@noodl-hooks/useEventListener';
import { useMemo, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';

import { buildFolderGraph } from '../utils/folderAggregation';
import { FolderGraph } from '../utils/topologyTypes';

/**
 * Hook that builds and returns the folder graph for the current project.
 *
 * @returns The complete folder graph with folders, connections, and metadata
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const folderGraph = useFolderGraph();
 *
 *   return (
 *     <div>
 *       <p>Total folders: {folderGraph.totalFolders}</p>
 *       <p>Total components: {folderGraph.totalComponents}</p>
 *       <p>Orphans: {folderGraph.orphanComponents.length}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFolderGraph(): FolderGraph {
  const project = ProjectModel.instance;
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Rebuild graph when components change
  useEventListener(ProjectModel.instance, 'componentAdded', () => {
    setUpdateTrigger((prev) => prev + 1);
  });

  useEventListener(ProjectModel.instance, 'componentRemoved', () => {
    setUpdateTrigger((prev) => prev + 1);
  });

  useEventListener(ProjectModel.instance, 'componentRenamed', () => {
    setUpdateTrigger((prev) => prev + 1);
  });

  const folderGraph = useMemo<FolderGraph>(() => {
    console.log('[useFolderGraph] Building folder graph...');
    const graph = buildFolderGraph(project);

    // Log summary
    console.log(`[useFolderGraph] Summary:`);
    console.log(`  - ${graph.totalFolders} folders`);
    console.log(`  - ${graph.totalComponents} components`);
    console.log(`  - ${graph.connections.length} folder connections`);
    console.log(`  - ${graph.orphanComponents.length} orphans`);

    // Log folder breakdown by type
    const typeBreakdown = graph.folders.reduce((acc, folder) => {
      acc[folder.type] = (acc[folder.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[useFolderGraph] Folder types:`, typeBreakdown);

    return graph;
  }, [project, updateTrigger]);

  return folderGraph;
}
