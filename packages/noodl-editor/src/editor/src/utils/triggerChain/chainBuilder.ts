/**
 * Chain Builder
 *
 * Transforms raw TriggerEvents into structured TriggerChain objects
 * that can be visualized in the timeline UI.
 *
 * @module triggerChain
 */

import { TriggerChain, TriggerChainNode, EventTiming, ChainStatistics, InteractionGroup } from './chainTypes';
import { TriggerEvent } from './types';

/**
 * Quiet gap (ms) that separates one interaction from the next. Two pulses closer
 * than this belong to the same propagation run; a longer gap starts a new
 * interaction. The runtime coalesces re-fires within a ~100ms pulse window, and
 * distinct user actions are typically >250ms apart, so 250ms segments cleanly.
 */
export const INTERACTION_GAP_MS = 250;

/**
 * Window (ms) within which two identical adjacent pulses (same node + type +
 * port) are treated as one same-frame propagation and collapsed into a single
 * row with a repeatCount. One animation frame is ~16ms.
 */
export const SAME_FRAME_MS = 16;

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

  // Segment into readable interaction groups (the noise filter)
  const interactions = groupByInteraction(sortedEvents);

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
    interactions,
    tree
  };
}

/**
 * Collapse identical adjacent same-frame pulses into a single event.
 *
 * Rising-edge detection in the recorder already removes lingering re-emissions,
 * but a node can legitimately re-pulse the same wire several times inside one
 * frame. Those add rows without adding meaning, so fold a run of identical
 * adjacent pulses (same node + type + port, within {@link SAME_FRAME_MS}) into
 * one row carrying a repeatCount.
 *
 * @param events - Chronologically sorted events
 * @returns Events with same-frame identical runs collapsed
 */
export function collapseSameFrame(events: TriggerEvent[]): TriggerEvent[] {
  if (events.length === 0) return [];

  const out: TriggerEvent[] = [];

  for (const event of events) {
    const prev = out[out.length - 1];
    const isSameStep =
      prev &&
      prev.nodeId === event.nodeId &&
      prev.nodeType === event.nodeType &&
      prev.port === event.port &&
      event.timestamp - prev.timestamp <= SAME_FRAME_MS;

    if (isSameStep) {
      prev.repeatCount = (prev.repeatCount ?? 1) + 1;
    } else {
      out.push({ ...event, repeatCount: event.repeatCount ?? 1 });
    }
  }

  return out;
}

/**
 * Segment a flat event list into interaction groups by quiet-gap detection.
 *
 * A run of pulses with no gap longer than {@link INTERACTION_GAP_MS} is one
 * interaction (a user action + its propagation cascade). This is what makes a
 * button-click recording readable: one grouped interaction instead of dozens of
 * loose rows. Within each group, same-frame identical pulses are collapsed.
 *
 * @param events - Events to segment (sorted internally by timestamp)
 * @param gapMs - Quiet gap that starts a new interaction (default INTERACTION_GAP_MS)
 * @returns Ordered interaction groups
 */
export function groupByInteraction(events: TriggerEvent[], gapMs: number = INTERACTION_GAP_MS): InteractionGroup[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Split into runs separated by a quiet gap
  const runs: TriggerEvent[][] = [];
  let current: TriggerEvent[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
    if (gap > gapMs) {
      runs.push(current);
      current = [];
    }
    current.push(sorted[i]);
  }
  runs.push(current);

  return runs.map((run, i) => {
    const collapsed = collapseSameFrame(run);
    const startTime = run[0].timestamp;
    const endTime = run[run.length - 1].timestamp;
    return {
      id: `interaction_${startTime}_${i}`,
      index: i + 1,
      label: generateInteractionLabel(collapsed),
      startTime,
      endTime,
      duration: endTime - startTime,
      events: collapsed
    };
  });
}

/**
 * Build a short label for an interaction from its first meaningful event.
 */
function generateInteractionLabel(events: TriggerEvent[]): string {
  const stepCount = events.length;
  const first = events[0];
  const stepLabel = stepCount === 1 ? '1 step' : `${stepCount} steps`;

  if (first && first.nodeLabel && first.nodeLabel !== 'Unknown') {
    return `${first.nodeLabel} (${stepLabel})`;
  }
  if (first && first.nodeType && first.nodeType !== 'Unknown') {
    return `${first.nodeType} (${stepLabel})`;
  }
  return `Interaction (${stepLabel})`;
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
