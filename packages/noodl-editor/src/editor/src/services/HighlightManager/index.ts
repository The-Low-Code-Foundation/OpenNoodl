/**
 * Canvas Highlighting API
 *
 * Public exports for the HighlightManager service.
 * Import from this file to use the highlighting system.
 *
 * @example
 * ```typescript
 * import { HighlightManager } from '@noodl/services/HighlightManager';
 *
 * const handle = HighlightManager.instance.highlightNodes(
 *   ['node1', 'node2'],
 *   { channel: 'lineage', label: 'Data flow' }
 * );
 * ```
 */

// Main service
export { HighlightManager } from './HighlightManager';

// Type exports
export type {
  HighlightOptions,
  ConnectionRef,
  PathDefinition,
  ComponentBoundary,
  IHighlightHandle,
  HighlightInfo,
  HighlightState,
  ChannelConfig,
  HighlightManagerEvent,
  HighlightEventCallback
} from './types';

// Channel utilities
export { CHANNELS, getChannelConfig, isValidChannel, getAvailableChannels } from './channels';

// Community showcase demo
export { noodlShowcase } from './community-showcase';
