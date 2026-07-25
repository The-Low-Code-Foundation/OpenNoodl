/**
 * Trigger Chain Debugger Module
 *
 * Exports recorder, chain builder, and types for the Trigger Chain Debugger feature.
 *
 * @module triggerChain
 */

// Recorder
export { TriggerChainRecorder, triggerChainRecorder } from './TriggerChainRecorder';
export type { TriggerEvent, TriggerEventType, RecorderOptions, RecorderState } from './types';

// Chain Builder
export {
  buildChainFromEvents,
  groupByComponent,
  groupByInteraction,
  collapseSameFrame,
  buildTree,
  calculateTiming,
  calculateStatistics,
  INTERACTION_GAP_MS,
  SAME_FRAME_MS
} from './chainBuilder';
export type { TriggerChain, TriggerChainNode, EventTiming, ChainStatistics, InteractionGroup } from './chainTypes';

// Pure snapshot edge-detection (exported for testing / reuse)
export { diffPulseSnapshot } from './snapshotDiff';
export type { SnapshotDiff } from './snapshotDiff';
