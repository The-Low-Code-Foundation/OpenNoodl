/**
 * TriggerChainRecorder
 *
 * Singleton class that records runtime execution events for the
 * Trigger Chain Debugger. Captures node activations, signals,
 * and data flow as they happen in the preview.
 *
 * @module triggerChain
 */

import { ProjectModel } from '../../models/projectmodel';
import { diffPulseSnapshot } from './snapshotDiff';
import { RecorderOptions, RecorderState, TriggerEvent } from './types';

/**
 * Singleton recorder for capturing runtime execution events
 */
export class TriggerChainRecorder {
  private static _instance: TriggerChainRecorder;

  private state: RecorderState;

  /**
   * Connection ids that were pulsing in the last snapshot the runtime sent.
   * A connection is only recorded as a new pulse when it transitions
   * absent -> present in this set (a rising edge). See {@link snapshotDiff}
   * for why this replaces the old 5ms wall-clock dedup.
   */
  private activeConnectionIds: Set<string>;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.state = {
      isRecording: false,
      events: [],
      maxEvents: 1000
    };
    this.activeConnectionIds = new Set();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): TriggerChainRecorder {
    if (!TriggerChainRecorder._instance) {
      TriggerChainRecorder._instance = new TriggerChainRecorder();
    }
    return TriggerChainRecorder._instance;
  }

  /**
   * Start recording events
   *
   * @param options - Recording configuration options
   */
  public startRecording(options?: RecorderOptions): void {
    if (this.state.isRecording) {
      console.warn('TriggerChainRecorder: Already recording');
      return;
    }

    // Apply options
    if (options?.maxEvents) {
      this.state.maxEvents = options.maxEvents;
    }

    // Reset state and start
    this.state.events = [];
    this.activeConnectionIds.clear(); // Clear pulse edge-detection state
    this.state.startTime = performance.now();
    this.state.isRecording = true;

    console.log('TriggerChainRecorder: Recording started');

    // Auto-stop if configured
    if (options?.autoStopAfter) {
      setTimeout(() => {
        this.stopRecording();
      }, options.autoStopAfter);
    }
  }

  /**
   * Stop recording and return captured events
   *
   * @returns Array of captured events
   */
  public stopRecording(): TriggerEvent[] {
    if (!this.state.isRecording) {
      console.warn('TriggerChainRecorder: Not recording');
      return [];
    }

    this.state.isRecording = false;
    const events = [...this.state.events];

    console.log(`TriggerChainRecorder: Recording stopped. Captured ${events.length} events`);

    return events;
  }

  /**
   * Reset recorder state (clear all events)
   */
  public reset(): void {
    this.state.events = [];
    this.state.startTime = undefined;
    this.state.isRecording = false;
    this.activeConnectionIds.clear();

    console.log('TriggerChainRecorder: Reset');
  }

  /**
   * Check if currently recording
   */
  public isRecording(): boolean {
    return this.state.isRecording;
  }

  /**
   * Get current event count
   */
  public getEventCount(): number {
    return this.state.events.length;
  }

  /**
   * Get all recorded events (without stopping)
   */
  public getEvents(): TriggerEvent[] {
    return [...this.state.events];
  }

  /**
   * Get current recorder state
   */
  public getState(): RecorderState {
    return { ...this.state };
  }

  /**
   * Capture a new event (internal method called from ViewerConnection)
   *
   * @param event - Event data from runtime
   */
  public captureEvent(event: TriggerEvent): void {
    // Only capture if recording
    if (!this.state.isRecording) {
      return;
    }

    // Check max events limit
    if (this.state.events.length >= this.state.maxEvents) {
      console.warn(`TriggerChainRecorder: Max events (${this.state.maxEvents}) reached. Oldest event will be dropped.`);
      this.state.events.shift(); // Remove oldest
    }

    // Add event to array
    this.state.events.push(event);
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Capture a full connection-pulse snapshot from the runtime.
   *
   * Each `connectiondebugpulse` message carries the *entire* set of connections
   * currently pulsing, not just newly-fired ones (a single pulse lingers in the
   * set for ~100ms). Recording every membership floods the timeline and the old
   * 5ms threshold could neither collapse the lingers nor tell them apart from a
   * genuine rapid repeat. So we record a connection only on its rising edge:
   * the frame it transitions absent -> present in the snapshot set. A connection
   * that leaves the set and later returns is a new pulse and is recorded again.
   *
   * This is the entry point ViewerConnection should call — it hands the whole
   * `connectionsToPulse` array so the sequence context is preserved.
   *
   * @param connectionIds - The complete set of pulsing connection ids this frame
   */
  public captureConnectionSnapshot(connectionIds: string[]): void {
    if (!this.state.isRecording) {
      return;
    }

    const { edges, active } = diffPulseSnapshot(this.activeConnectionIds, connectionIds);
    this.activeConnectionIds = active;

    for (const connectionId of edges) {
      this.captureConnectionPulse(connectionId);
    }
  }

  /**
   * Helper: Create and capture a single event from one connection pulse.
   * This bridges the existing DebugInspector connection pulse to our recorder.
   *
   * NOTE: this records unconditionally — deduplication of lingering re-emissions
   * is the job of {@link captureConnectionSnapshot}'s rising-edge detection, not
   * a time heuristic here. Callers with a full snapshot should prefer that method.
   *
   * @param connectionId - Connection ID from DebugInspector
   * @param data - Optional data flowing through connection
   */
  public captureConnectionPulse(connectionId: string, data?: unknown): void {
    if (!this.state.isRecording) {
      return;
    }

    const currentTime = performance.now();

    // Extract UUIDs from connectionId using regex
    // OpenNoodl uses standard UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const uuids = connectionId.match(uuidRegex) || [];

    // Try to find a valid node from extracted UUIDs
    let targetNodeId: string | undefined;
    let foundNode: unknown = null;
    let nodeType = 'Unknown';
    let nodeLabel = 'Unknown';
    let componentName = 'Unknown';
    const componentPath: string[] = [];

    try {
      if (ProjectModel.instance && uuids.length > 0) {
        // Try each UUID until we find a valid node
        for (const uuid of uuids) {
          const node = ProjectModel.instance.findNodeWithId(uuid);
          if (node) {
            targetNodeId = uuid;
            foundNode = node;
            break;
          }
        }

        if (foundNode && typeof foundNode === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nodeObj = foundNode as Record<string, any>;

          // Extract node type
          nodeType = nodeObj.type?.name || nodeObj.type || 'Unknown';

          // Extract node label (try different properties)
          nodeLabel = nodeObj.parameters?.label || nodeObj.label || nodeObj.parameters?.name || nodeType;

          // Extract component name
          if (nodeObj.owner?.owner) {
            componentName = nodeObj.owner.owner.name || 'Unknown';
            componentPath.push(componentName);
          }
        }
      }
    } catch (error) {
      console.warn('TriggerChainRecorder: Error looking up node:', error);
    }

    // Use first UUID as fallback if no node found
    if (!targetNodeId && uuids.length > 0) {
      targetNodeId = uuids[0];
    }

    const event: TriggerEvent = {
      id: this.generateEventId(),
      timestamp: currentTime,
      type: 'signal',
      nodeId: targetNodeId,
      nodeType,
      nodeLabel,
      componentName,
      componentPath,
      port: undefined, // Port name extraction not yet implemented
      data
    };

    this.captureEvent(event);
  }
}

// Export singleton instance
export const triggerChainRecorder = TriggerChainRecorder.getInstance();
