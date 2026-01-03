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
import { RecorderOptions, RecorderState, TriggerEvent } from './types';

/**
 * Singleton recorder for capturing runtime execution events
 */
export class TriggerChainRecorder {
  private static _instance: TriggerChainRecorder;

  private state: RecorderState;
  private recentEventKeys: Map<string, number>; // Key: nodeId+port, Value: timestamp
  private readonly DUPLICATE_THRESHOLD_MS = 5; // Consider events within 5ms as duplicates

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.state = {
      isRecording: false,
      events: [],
      maxEvents: 1000
    };
    this.recentEventKeys = new Map();
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
    this.recentEventKeys.clear(); // Clear deduplication map
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
   * Helper: Create and capture an event from connection pulse data
   * This bridges the existing DebugInspector connection pulse to our recorder
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

    // Deduplication: Create a unique key for this event
    // Using connectionId directly as it contains both node IDs and port info
    const eventKey = connectionId;

    // Check if we recently captured the same event
    const lastEventTime = this.recentEventKeys.get(eventKey);
    if (lastEventTime !== undefined) {
      const timeSinceLastEvent = currentTime - lastEventTime;
      if (timeSinceLastEvent < this.DUPLICATE_THRESHOLD_MS) {
        // This is a duplicate event - skip it
        return;
      }
    }

    // Update the timestamp for this event key
    this.recentEventKeys.set(eventKey, currentTime);

    // Clean up old entries periodically (keep map from growing too large)
    if (this.recentEventKeys.size > 100) {
      const cutoffTime = currentTime - this.DUPLICATE_THRESHOLD_MS * 2;
      for (const [key, timestamp] of this.recentEventKeys.entries()) {
        if (timestamp < cutoffTime) {
          this.recentEventKeys.delete(key);
        }
      }
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
