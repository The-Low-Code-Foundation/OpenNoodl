/**
 * Component Stats Utility
 *
 * Lightweight extraction of component statistics for display in Topology Map.
 * Optimized for performance - doesn't compute full X-Ray data.
 */

import { ComponentModel } from '@noodl-models/componentmodel';
import { NodeGraphNode } from '@noodl-models/nodegraphmodel';

/**
 * Quick stats for a component
 */
export interface ComponentQuickStats {
  nodeCount: number;
  subcomponentCount: number;
  hasRestCalls: boolean;
  hasEvents: boolean;
  hasState: boolean;
}

/**
 * Extract lightweight stats from a component.
 * Used for quick display in topology cards.
 */
export function getComponentQuickStats(component: ComponentModel): ComponentQuickStats {
  let nodeCount = 0;
  let subcomponentCount = 0;
  let hasRestCalls = false;
  let hasEvents = false;
  let hasState = false;

  component.graph.forEachNode((node: NodeGraphNode) => {
    nodeCount++;

    // Check for subcomponents
    if (node.type instanceof ComponentModel) {
      subcomponentCount++;
    }

    // Check for REST calls
    if (node.typename === 'REST' || node.typename === 'REST2') {
      hasRestCalls = true;
    }

    // Check for events
    if (node.typename === 'Send Event' || node.typename === 'Receive Event') {
      hasEvents = true;
    }

    // Check for state
    if (
      node.typename === 'Variable' ||
      node.typename === 'Variable2' ||
      node.typename === 'Object' ||
      node.typename === 'States'
    ) {
      hasState = true;
    }
  });

  return {
    nodeCount,
    subcomponentCount,
    hasRestCalls,
    hasEvents,
    hasState
  };
}

/**
 * Format stats as a short display string.
 * Example: "24 nodes • 3 sub • REST • Events"
 */
export function formatStatsShort(stats: ComponentQuickStats): string {
  const parts: string[] = [];

  parts.push(`${stats.nodeCount} nodes`);

  if (stats.subcomponentCount > 0) {
    parts.push(`${stats.subcomponentCount} sub`);
  }

  if (stats.hasRestCalls) {
    parts.push('REST');
  }

  if (stats.hasEvents) {
    parts.push('Events');
  }

  if (stats.hasState) {
    parts.push('State');
  }

  return parts.join(' • ');
}
