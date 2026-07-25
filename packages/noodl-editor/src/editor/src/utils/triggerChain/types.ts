/**
 * Type definitions for the Trigger Chain Debugger
 *
 * These types define the structure of events captured during runtime
 * execution and how they're organized into chains for debugging.
 *
 * @module triggerChain
 */

/**
 * Types of events that can be captured during execution
 */
export type TriggerEventType =
  | 'signal' // Signal fired (e.g., onClick)
  | 'value-change' // Value changed on a port
  | 'component-enter' // Entering a child component
  | 'component-exit' // Exiting a child component
  | 'api-call' // API request started (REST, etc.)
  | 'api-response' // API response received
  | 'navigation' // Page navigation
  | 'error'; // Error occurred

/**
 * A single event captured during execution
 */
export interface TriggerEvent {
  /** Unique event ID */
  id: string;

  /** High-resolution timestamp (performance.now()) */
  timestamp: number;

  /** Type of event */
  type: TriggerEventType;

  /** Node that triggered this event */
  nodeId: string;

  /** Node type (e.g., 'Button', 'Variable', 'REST') */
  nodeType: string;

  /** User-visible node label */
  nodeLabel: string;

  /** Component containing this node */
  componentName: string;

  /** Full component path for nested components */
  componentPath: string[];

  /** Port that triggered this event (if applicable) */
  port?: string;

  /** Data flowing through this event */
  data?: unknown;

  /** Error information (if type === 'error') */
  error?: {
    message: string;
    stack?: string;
  };

  /** ID of event that caused this one (for causal chain) */
  triggeredBy?: string;

  /**
   * How many same-frame propagation pulses this row collapses (>=1). Set by the
   * chain builder's noise filter when identical adjacent pulses fire within one
   * frame; absent/1 means a single pulse. Purely presentational.
   */
  repeatCount?: number;
}

/**
 * State of the recorder
 */
export interface RecorderState {
  /** Is recording active? */
  isRecording: boolean;

  /** When recording started */
  startTime?: number;

  /** Captured events */
  events: TriggerEvent[];

  /** Maximum events to store (prevents memory issues) */
  maxEvents: number;
}

/**
 * Configuration options for the recorder
 */
export interface RecorderOptions {
  /** Maximum events to store (default: 1000) */
  maxEvents?: number;

  /** Auto-stop after duration (ms) (default: none) */
  autoStopAfter?: number;
}
