/**
 * Channel Configuration for Canvas Highlighting System
 *
 * Defines the visual appearance and behavior of each highlighting channel.
 * Channels are used to organize different types of highlights:
 * - lineage: Data flow traces (blue)
 * - impact: Change impact visualization (orange)
 * - selection: User selection state (white)
 * - warning: Errors and validation warnings (red)
 */

import { ChannelConfig } from './types';

/**
 * Channel definitions with colors, styles, and metadata
 */
export const CHANNELS: Record<string, ChannelConfig> = {
  /**
   * Data Lineage traces - shows how data flows through the graph
   * Blue color with glow effect for visibility without being distracting
   */
  lineage: {
    color: '#4A90D9',
    style: 'glow',
    description: 'Data flow traces showing how data propagates through nodes',
    zIndex: 10
  },

  /**
   * Impact Radar - shows which nodes would be affected by a change
   * Orange color with pulse effect to draw attention
   */
  impact: {
    color: '#F5A623',
    style: 'pulse',
    description: 'Downstream impact visualization for change analysis',
    zIndex: 15
  },

  /**
   * Selection state - temporary highlight for hover/focus states
   * White color with solid effect for clarity
   */
  selection: {
    color: '#FFFFFF',
    style: 'solid',
    description: 'Temporary selection and hover states',
    zIndex: 20
  },

  /**
   * Warnings and errors - highlights problematic nodes/connections
   * Red color with pulse effect for urgency
   */
  warning: {
    color: '#FF6B6B',
    style: 'pulse',
    description: 'Error and validation warning indicators',
    zIndex: 25
  }
};

/**
 * Get channel configuration by name
 * Returns default configuration if channel doesn't exist
 */
export function getChannelConfig(channel: string): ChannelConfig {
  return (
    CHANNELS[channel] || {
      color: '#FFFFFF',
      style: 'solid',
      description: 'Custom channel',
      zIndex: 5
    }
  );
}

/**
 * Check if a channel exists
 */
export function isValidChannel(channel: string): boolean {
  return channel in CHANNELS;
}

/**
 * Get all available channel names
 */
export function getAvailableChannels(): string[] {
  return Object.keys(CHANNELS);
}

/**
 * Default z-index for highlights when not specified
 */
export const DEFAULT_HIGHLIGHT_Z_INDEX = 10;

/**
 * Animation durations for different styles (in milliseconds)
 */
export const ANIMATION_DURATIONS = {
  glow: 1000,
  pulse: 1500,
  solid: 0
};
