/**
 * Chain Builder Type Definitions
 *
 * Types for organizing raw TriggerEvents into structured chains
 * that can be displayed in the timeline UI.
 *
 * @module triggerChain
 */

import { TriggerEvent } from './types';

/**
 * A complete trigger chain - represents one recorded interaction
 */
export interface TriggerChain {
  /** Unique chain ID */
  id: string;

  /** User-friendly name (auto-generated or user-provided) */
  name: string;

  /** When the chain started (first event timestamp) */
  startTime: number;

  /** When the chain ended (last event timestamp) */
  endTime: number;

  /** Total duration in milliseconds */
  duration: number;

  /** Total number of events */
  eventCount: number;

  /** All events in chronological order */
  events: TriggerEvent[];

  /** Events grouped by component name */
  byComponent: Map<string, TriggerEvent[]>;

  /** Hierarchical tree structure for rendering */
  tree: TriggerChainNode;
}

/**
 * Tree node for hierarchical chain visualization
 */
export interface TriggerChainNode {
  /** The event at this node */
  event: TriggerEvent;

  /** Child events triggered by this one */
  children: TriggerChainNode[];

  /** Depth in the tree (0 = root) */
  depth: number;

  /** Time delta from parent (ms) */
  deltaFromParent: number;
}

/**
 * Timing information for display
 */
export interface EventTiming {
  /** Event ID */
  eventId: string;

  /** Time since chain start (ms) */
  sinceStart: number;

  /** Time since previous event (ms) */
  sincePrevious: number;

  /** Duration as human-readable string */
  durationLabel: string;
}

/**
 * Statistics about a chain
 */
export interface ChainStatistics {
  /** Total events */
  totalEvents: number;

  /** Events by type */
  eventsByType: Map<string, number>;

  /** Events by component */
  eventsByComponent: Map<string, number>;

  /** Average time between events (ms) */
  averageEventGap: number;

  /** Longest gap between events (ms) */
  longestGap: number;

  /** Components involved */
  componentsInvolved: string[];
}
