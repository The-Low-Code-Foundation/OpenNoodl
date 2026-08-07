/**
 * Tier Assignment
 *
 * Logic to assign semantic tiers to folders for hierarchical layout.
 * Tiers represent vertical positioning in the topology view.
 */

import { FolderNode, FolderConnection } from './topologyTypes';

/**
 * Assigns a semantic tier to a folder for hierarchical layout.
 *
 * Tier system:
 * - **Tier 0**: Pages (entry points, top of hierarchy)
 * - **Tier 1**: Features used directly by pages
 * - **Tier 2**: Shared libraries (integrations, UI components)
 * - **Tier 3**: Utilities (foundation, bottom of hierarchy)
 * - **Tier -1**: Orphans (separate, not in main flow)
 *
 * @param folder The folder to assign a tier to
 * @param allFolders All folders in the graph
 * @param connections All folder connections
 * @returns The assigned tier (0-3, or -1 for orphans)
 */
export function assignFolderTier(
  folder: FolderNode,
  allFolders: FolderNode[],
  connections: FolderConnection[]
): number {
  // Orphans get special tier
  if (folder.type === 'orphan') {
    return -1;
  }

  // Pages always at top
  if (folder.type === 'page') {
    return 0;
  }

  // Utilities always at bottom
  if (folder.type === 'utility') {
    return 3;
  }

  // Check what uses this folder
  const usedByConnections = connections.filter((c) => c.to === folder.id);

  // Find the types of folders that use this one
  const usedByTypes = new Set<string>();
  for (const conn of usedByConnections) {
    const sourceFolder = allFolders.find((f) => f.id === conn.from);
    if (sourceFolder) {
      usedByTypes.add(sourceFolder.type);
    }
  }

  // If used by pages, place in tier 1 (features layer)
  if (usedByTypes.has('page')) {
    // Features used by pages go in tier 1
    if (folder.type === 'feature') {
      return 1;
    }
    // Integrations/UI used by pages go in tier 2
    return 2;
  }

  // If used by tier 1 folders, place in tier 2
  const usedByTier1 = usedByConnections.some((conn) => {
    const sourceFolder = allFolders.find((f) => f.id === conn.from);
    return sourceFolder && sourceFolder.type === 'feature';
  });

  if (usedByTier1) {
    return 2;
  }

  // Default tier based on type
  switch (folder.type) {
    case 'integration':
      return 2; // Shared layer
    case 'ui':
      return 2; // Shared layer
    case 'feature':
      return 1; // Feature layer
    default:
      return 2; // Default to shared layer
  }
}

/**
 * Gets the Y position for a given tier.
 *
 * @param tier The tier number
 * @returns Y coordinate in the layout space
 */
export function getTierYPosition(tier: number): number {
  switch (tier) {
    case -1:
      return 600; // Orphans at bottom
    case 0:
      return 100; // Pages at top
    case 1:
      return 250; // Features
    case 2:
      return 400; // Shared (integrations, UI)
    case 3:
      return 550; // Utilities
    default:
      return 400; // Fallback to middle
  }
}

/**
 * Gets a display label for a tier.
 *
 * @param tier The tier number
 * @returns Human-readable tier label
 */
export function getTierLabel(tier: number): string {
  switch (tier) {
    case -1:
      return 'Orphaned';
    case 0:
      return 'Pages';
    case 1:
      return 'Features';
    case 2:
      return 'Shared';
    case 3:
      return 'Utilities';
    default:
      return 'Unknown';
  }
}
