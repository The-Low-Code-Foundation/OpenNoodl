/**
 * Folder Aggregation Utilities
 *
 * Functions to group components into folders and build folder-level connections.
 */

import { ComponentModel } from '@noodl-models/componentmodel';
import { ProjectModel } from '@noodl-models/projectmodel';
import { buildComponentDependencyGraph } from '@noodl-utils/graphAnalysis';

import { detectFolderType } from './folderTypeDetection';
import { assignFolderTier } from './tierAssignment';
import { FolderNode, FolderConnection, FolderGraph, TopLevelComponent } from './topologyTypes';

/**
 * Extracts the folder path from a component's full name.
 *
 * Examples:
 * - "/#Directus/Query" → "/#Directus"
 * - "/App" → "/" (root)
 * - "MyComponent" → "/" (root)
 *
 * @param componentFullName The full component path
 * @returns The folder path
 */
export function extractFolderPath(componentFullName: string): string {
  // Handle root-level components
  if (!componentFullName.includes('/')) {
    return '/';
  }

  // Find the last slash
  const lastSlashIndex = componentFullName.lastIndexOf('/');

  if (lastSlashIndex === 0) {
    // Component is at root like "/App"
    return '/';
  }

  // Return everything up to (and including) the last folder separator
  return componentFullName.substring(0, lastSlashIndex);
}

/**
 * Extracts a display name from a folder path.
 *
 * Examples:
 * - "/#Directus" → "Directus"
 * - "/#Directus Prefab/Components/Admin" → "Directus Prefab/Components/Admin"
 * - "/" → "Pages"
 *
 * @param folderPath The folder path
 * @returns A human-readable folder name (full breadcrumb path)
 */
export function getFolderDisplayName(folderPath: string): string {
  if (folderPath === '/') {
    return 'Pages';
  }

  // Remove leading slash and any # prefix, return full path
  const cleaned = folderPath.replace(/^\/+/, '').replace(/^#/, '');

  return cleaned || 'Unknown';
}

/**
 * Groups components by their folder path.
 *
 * @param components Array of component models
 * @returns Map of folder path to components in that folder
 */
export function groupComponentsByFolder(components: ComponentModel[]): Map<string, ComponentModel[]> {
  const folderMap = new Map<string, ComponentModel[]>();

  for (const component of components) {
    const folderPath = extractFolderPath(component.fullName);

    if (!folderMap.has(folderPath)) {
      folderMap.set(folderPath, []);
    }

    folderMap.get(folderPath)!.push(component);
  }

  return folderMap;
}

/**
 * Builds folder-level connections by aggregating component-to-component relationships.
 *
 * @param project The project model
 * @param folders Array of folder nodes
 * @returns Array of folder connections
 */
export function buildFolderConnections(project: ProjectModel, folders: FolderNode[]): FolderConnection[] {
  // Build component-level dependency graph
  const componentGraph = buildComponentDependencyGraph(project);

  // Create a map from component fullName to folder id
  const componentToFolder = new Map<string, string>();
  for (const folder of folders) {
    for (const component of folder.components) {
      componentToFolder.set(component.fullName, folder.id);
    }
  }

  // Aggregate edges by folder-to-folder relationships
  const folderConnectionMap = new Map<string, FolderConnection>();

  for (const edge of componentGraph.edges) {
    const fromFolder = componentToFolder.get(edge.from);
    const toFolder = componentToFolder.get(edge.to);

    // Skip if either component isn't in a folder or if it's same-folder connection
    if (!fromFolder || !toFolder || fromFolder === toFolder) {
      continue;
    }

    // Create connection key
    const connectionKey = `${fromFolder}→${toFolder}`;

    if (!folderConnectionMap.has(connectionKey)) {
      folderConnectionMap.set(connectionKey, {
        from: fromFolder,
        to: toFolder,
        count: 0,
        componentPairs: []
      });
    }

    const connection = folderConnectionMap.get(connectionKey)!;
    connection.count += edge.count;
    connection.componentPairs.push({
      from: edge.from,
      to: edge.to
    });
  }

  return Array.from(folderConnectionMap.values());
}

/**
 * Determines if a component is a page component that should be displayed at the top level.
 *
 * @param component The component to check
 * @returns True if this is a page component
 */
export function isPageComponent(component: ComponentModel): boolean {
  // Must be at root level (path starts with "/" and has no subdirectories)
  const isRootLevel = component.fullName.startsWith('/') && component.fullName.lastIndexOf('/') === 0;
  if (!isRootLevel) {
    return false;
  }

  const name = component.name.toLowerCase();

  // App component is always a page
  if (name === 'app') {
    return true;
  }

  // Check if name contains "page"
  if (name.includes('page')) {
    return true;
  }

  // Check if component contains Page Router nodes (indicating it's a page)
  let hasPageRouter = false;
  component.graph?.forEachNode((node) => {
    if (node.type?.fullName === 'Page Router' || node.type?.name === 'Page Router') {
      hasPageRouter = true;
    }
  });

  return hasPageRouter;
}

/**
 * Identifies orphaned components (not used by anything and at max depth).
 *
 * @param project The project model
 * @param allComponents All components in the project
 * @returns Array of orphaned components
 */
export function identifyOrphanComponents(project: ProjectModel, allComponents: ComponentModel[]): ComponentModel[] {
  const componentGraph = buildComponentDependencyGraph(project);

  // Find components with no incoming edges
  const usedComponents = new Set(componentGraph.edges.map((edge) => edge.to));

  return allComponents.filter((component) => {
    return !usedComponents.has(component.fullName);
  });
}

/**
 * Builds the complete folder graph from a project.
 * This is the main entry point for folder aggregation.
 *
 * @param project The project model
 * @returns Complete folder graph
 */
export function buildFolderGraph(project: ProjectModel): FolderGraph {
  console.log('[FolderAggregation] Building folder graph...');

  // Get all components
  const allComponents = project.getComponents();
  console.log(`[FolderAggregation] Total components: ${allComponents.length}`);

  // Identify orphans first
  const orphans = identifyOrphanComponents(project, allComponents);
  console.log(`[FolderAggregation] Orphaned components: ${orphans.length}`);

  // Filter out orphans from folder grouping
  const activeComponents = allComponents.filter((c) => !orphans.includes(c));

  // Group components by folder
  const folderMap = groupComponentsByFolder(activeComponents);
  console.log(`[FolderAggregation] Unique folders: ${folderMap.size}`);

  // Extract page components from root folder
  const topLevelComponents: TopLevelComponent[] = [];
  const rootComponents = folderMap.get('/') || [];
  const pageComponents = rootComponents.filter((c) => isPageComponent(c));
  const nonPageRootComponents = rootComponents.filter((c) => !isPageComponent(c));

  console.log(`[FolderAggregation] Page components: ${pageComponents.length}`);

  // Create TopLevelComponent objects for page components
  for (const pageComp of pageComponents) {
    topLevelComponents.push({
      component: pageComp,
      isAppComponent: pageComp.name.toLowerCase() === 'app'
    });
  }

  // Update folderMap to only include non-page root components
  if (nonPageRootComponents.length > 0) {
    folderMap.set('/', nonPageRootComponents);
  } else {
    folderMap.delete('/'); // Remove root folder if all components are pages
  }

  // Build folder nodes
  const folders: FolderNode[] = [];
  let folderIdCounter = 0;

  for (const [folderPath, components] of folderMap.entries()) {
    const folderId = `folder-${folderIdCounter++}`;
    const displayName = getFolderDisplayName(folderPath);
    const folderType = detectFolderType(folderPath, components);

    const folderNode: FolderNode = {
      id: folderId,
      name: displayName,
      path: folderPath,
      type: folderType,
      componentCount: components.length,
      components: components,
      componentNames: components.slice(0, 5).map((c) => c.name), // First 5 for preview
      connectionCount: {
        incoming: 0, // Will be calculated after connections are built
        outgoing: 0
      },
      tier: 0 // Will be assigned later
    };

    folders.push(folderNode);
  }

  // Build folder-to-folder connections
  const connections = buildFolderConnections(project, folders);

  // Calculate connection counts for each folder
  for (const connection of connections) {
    const sourceFolder = folders.find((f) => f.id === connection.from);
    const targetFolder = folders.find((f) => f.id === connection.to);

    if (sourceFolder) {
      sourceFolder.connectionCount.outgoing += connection.count;
    }
    if (targetFolder) {
      targetFolder.connectionCount.incoming += connection.count;
    }
  }
  console.log(`[FolderAggregation] Folder connections: ${connections.length}`);

  // Assign tiers for semantic layout
  for (const folder of folders) {
    folder.tier = assignFolderTier(folder, folders, connections);
  }

  // Log tier distribution
  const tierCounts = folders.reduce((acc, f) => {
    acc[f.tier] = (acc[f.tier] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  console.log('[FolderAggregation] Tier distribution:', tierCounts);

  return {
    folders,
    topLevelComponents,
    connections,
    orphanComponents: orphans,
    totalFolders: folders.length,
    totalComponents: allComponents.length
  };
}
