/**
 * useFolderLayout Hook
 *
 * Applies tiered layout algorithm to folder nodes.
 * Replaces dagre auto-layout with semantic positioning.
 */

import { useMemo } from 'react';

import { calculateFolderHeight } from '../utils/folderCardHeight';
import { getTierYPosition } from '../utils/tierAssignment';
import { FolderGraph, FolderNode, PositionedFolderGraph } from '../utils/topologyTypes';

/**
 * Layout configuration
 */
const LAYOUT_CONFIG = {
  NODE_WIDTH: 140,
  NODE_HEIGHT: 110,
  COMPONENT_WIDTH: 140,
  COMPONENT_HEIGHT: 110,
  HORIZONTAL_SPACING: 60,
  TIER_MARGIN: 150,
  ORPHAN_X: 50,
  ORPHAN_Y: 700
};

/**
 * Positions folders in horizontal tiers based on their semantic tier.
 *
 * @param folderGraph The folder graph to layout
 * @returns Positioned folder graph with x,y coordinates
 */
function layoutFolderGraph(folderGraph: FolderGraph): PositionedFolderGraph {
  // Position top-level components on tier 0
  const tier0Y = getTierYPosition(0);
  let currentX = LAYOUT_CONFIG.TIER_MARGIN;

  // Position top-level components first (they go on tier 0)
  folderGraph.topLevelComponents.forEach((topLevel) => {
    topLevel.x = currentX;
    topLevel.y = tier0Y;
    topLevel.width = LAYOUT_CONFIG.COMPONENT_WIDTH;
    topLevel.height = LAYOUT_CONFIG.COMPONENT_HEIGHT;
    currentX += LAYOUT_CONFIG.COMPONENT_WIDTH + LAYOUT_CONFIG.HORIZONTAL_SPACING;
  });

  // Group folders by tier
  const foldersByTier = new Map<number, FolderNode[]>();
  for (const folder of folderGraph.folders) {
    if (!foldersByTier.has(folder.tier)) {
      foldersByTier.set(folder.tier, []);
    }
    foldersByTier.get(folder.tier)!.push(folder);
  }

  // Position folders within each tier
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  // Track bounds from top-level components
  if (folderGraph.topLevelComponents.length > 0) {
    minX = LAYOUT_CONFIG.TIER_MARGIN;
    maxX = currentX - LAYOUT_CONFIG.HORIZONTAL_SPACING + LAYOUT_CONFIG.COMPONENT_WIDTH;
    minY = tier0Y;
    maxY = tier0Y + LAYOUT_CONFIG.COMPONENT_HEIGHT;
  }

  for (const [tier, folders] of foldersByTier.entries()) {
    const y = getTierYPosition(tier);

    // Start position for this tier
    // If tier 0, continue after top-level components
    const startX = tier === 0 ? currentX : LAYOUT_CONFIG.TIER_MARGIN;

    folders.forEach((folder, index) => {
      folder.x = startX + index * (LAYOUT_CONFIG.NODE_WIDTH + LAYOUT_CONFIG.HORIZONTAL_SPACING);
      folder.y = y;
      folder.width = LAYOUT_CONFIG.NODE_WIDTH;
      // Calculate dynamic height based on content
      folder.height = calculateFolderHeight(folder);

      // Track bounds
      minX = Math.min(minX, folder.x);
      maxX = Math.max(maxX, folder.x + folder.width);
      minY = Math.min(minY, folder.y);
      maxY = Math.max(maxY, folder.y + folder.height);
    });
  }

  // Handle orphans separately (bottom-left corner)
  if (folderGraph.orphanComponents.length > 0) {
    minX = Math.min(minX, LAYOUT_CONFIG.ORPHAN_X);
    maxX = Math.max(maxX, LAYOUT_CONFIG.ORPHAN_X + LAYOUT_CONFIG.NODE_WIDTH);
    minY = Math.min(minY, LAYOUT_CONFIG.ORPHAN_Y);
    maxY = Math.max(maxY, LAYOUT_CONFIG.ORPHAN_Y + LAYOUT_CONFIG.NODE_HEIGHT);
  }

  // Add padding to bounds
  const padding = 50;
  const bounds = {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2
  };

  return {
    ...folderGraph,
    folders: folderGraph.folders,
    bounds
  };
}

/**
 * Hook that applies layout to a folder graph.
 *
 * @param folderGraph The folder graph to layout
 * @returns Positioned folder graph with coordinates
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const folderGraph = useFolderGraph();
 *   const positionedGraph = useFolderLayout(folderGraph);
 *
 *   return (
 *     <svg viewBox={`0 0 ${positionedGraph.bounds.width} ${positionedGraph.bounds.height}`}>
 *       {positionedGraph.folders.map(folder => (
 *         <rect key={folder.id} x={folder.x} y={folder.y} width={folder.width} height={folder.height} />
 *       ))}
 *     </svg>
 *   );
 * }
 * ```
 */
export function useFolderLayout(folderGraph: FolderGraph): PositionedFolderGraph {
  const positionedGraph = useMemo(() => {
    console.log('[useFolderLayout] Applying tiered layout...');
    const positioned = layoutFolderGraph(folderGraph);

    console.log(`[useFolderLayout] Bounds: ${positioned.bounds.width}x${positioned.bounds.height}`);
    console.log(`[useFolderLayout] Positioned ${positioned.folders.length} folders`);

    return positioned;
  }, [folderGraph]);

  return positionedGraph;
}
