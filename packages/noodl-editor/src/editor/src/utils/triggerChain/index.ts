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
  buildTree,
  calculateTiming,
  calculateStatistics
} from './chainBuilder';
export type { TriggerChain, TriggerChainNode, EventTiming, ChainStatistics } from './chainTypes';
