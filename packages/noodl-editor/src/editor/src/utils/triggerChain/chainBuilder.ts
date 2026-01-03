/**
 * Chain Builder
 *
 * Transforms raw TriggerEvents into structured TriggerChain objects
 * that can be visualized in the timeline UI.
 *
 * @module triggerChain
 */

import { TriggerChain, TriggerChainNode, EventTiming, ChainStatistics } from './chainTypes';
import { TriggerEvent } from './types';

/**
 * Build a complete chain from an array of events
 *
 * @param events - Raw events from the recorder
 * @param name - Optional name for the chain (auto-generated if not provided)
 * @returns Structured trigger chain
 *
 * @example
 * ```typescript
 * const events = recorder.stopRecording();
 * const chain = buildChainFromEvents(events);
 * console.log(`Chain duration: ${chain.duration}ms`);
 * ```
 */
export function buildChainFromEvents(events: TriggerEvent[], name?: string): TriggerChain {
  if (events.length === 0) {
    throw new Error('Cannot build chain from empty events array');
  }

  // Sort by timestamp
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

  const startTime = sortedEvents[0].timestamp;
  const endTime = sortedEvents[sortedEvents.length - 1].timestamp;
  const duration = endTime - startTime;

  // Build component grouping
  const byComponent = groupByComponent(sortedEvents);

  // Build tree structure
  const tree = buildTree(sortedEvents);

  // Generate name if not provided
  const chainName = name || generateChainName(sortedEvents);

  return {
    id: `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: chainName,
    startTime,
    endTime,
    duration,
    eventCount: sortedEvents.length,
    events: sortedEvents,
    byComponent,
    tree
  };
}

/**
 * Group events by component name
 *
 * @param events - Events to group
 * @returns Map of component name to events
 */
export function groupByComponent(events: TriggerEvent[]): Map<string, TriggerEvent[]> {
  const grouped = new Map<string, TriggerEvent[]>();

  for (const event of events) {
    const componentName = event.componentName;
    if (!grouped.has(componentName)) {
      grouped.set(componentName, []);
    }
    grouped.get(componentName)!.push(event);
  }

  return grouped;
}

/**
 * Build hierarchical tree structure from flat event list
 *
 * @param events - Sorted events
 * @returns Root node of the tree
 */
export function buildTree(events: TriggerEvent[]): TriggerChainNode {
  if (events.length === 0) {
    throw new Error('Cannot build tree from empty events array');
  }

  // For now, create a simple linear tree
  // TODO: In the future, use triggeredBy relationships to build proper tree
  const root: TriggerChainNode = {
    event: events[0],
    children: [],
    depth: 0,
    deltaFromParent: 0
  };

  let currentNode = root;

  for (let i = 1; i < events.length; i++) {
    const node: TriggerChainNode = {
      event: events[i],
      children: [],
      depth: i, // Simple linear depth for now
      deltaFromParent: events[i].timestamp - events[i - 1].timestamp
    };

    currentNode.children.push(node);
    currentNode = node;
  }

  return root;
}

/**
 * Calculate timing information for all events in a chain
 *
 * @param chain - The trigger chain
 * @returns Array of timing info for each event
 */
export function calculateTiming(chain: TriggerChain): EventTiming[] {
  const timings: EventTiming[] = [];
  const startTime = chain.startTime;

  for (let i = 0; i < chain.events.length; i++) {
    const event = chain.events[i];
    const sinceStart = event.timestamp - startTime;
    const sincePrevious = i === 0 ? 0 : event.timestamp - chain.events[i - 1].timestamp;

    timings.push({
      eventId: event.id,
      sinceStart,
      sincePrevious,
      durationLabel: formatDuration(sincePrevious)
    });
  }

  return timings;
}

/**
 * Calculate statistics about a chain
 *
 * @param chain - The trigger chain
 * @returns Statistics object
 */
export function calculateStatistics(chain: TriggerChain): ChainStatistics {
  const eventsByType = new Map<string, number>();
  const eventsByComponent = new Map<string, number>();
  const components = new Set<string>();

  for (const event of chain.events) {
    // Count by type
    const typeCount = eventsByType.get(event.type) || 0;
    eventsByType.set(event.type, typeCount + 1);

    // Count by component
    const compCount = eventsByComponent.get(event.componentName) || 0;
    eventsByComponent.set(event.componentName, compCount + 1);

    components.add(event.componentName);
  }

  // Calculate gaps
  const gaps: number[] = [];
  for (let i = 1; i < chain.events.length; i++) {
    gaps.push(chain.events[i].timestamp - chain.events[i - 1].timestamp);
  }

  const averageEventGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const longestGap = gaps.length > 0 ? Math.max(...gaps) : 0;

  return {
    totalEvents: chain.events.length,
    eventsByType,
    eventsByComponent,
    averageEventGap,
    longestGap,
    componentsInvolved: Array.from(components)
  };
}

/**
 * Generate a descriptive name for a chain based on its events
 *
 * @param events - Events in the chain
 * @returns Generated name
 */
function generateChainName(events: TriggerEvent[]): string {
  if (events.length === 0) return 'Empty Chain';

  const firstEvent = events[0];
  const eventCount = events.length;

  // Try to create meaningful name from first event
  if (firstEvent.nodeLabel && firstEvent.nodeLabel !== 'Unknown') {
    return `${firstEvent.nodeLabel} (${eventCount} events)`;
  }

  // Fallback to type-based name
  return `${firstEvent.type} chain (${eventCount} events)`;
}

/**
 * Format duration as human-readable string
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "2ms", "1.5s")
 */
function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
