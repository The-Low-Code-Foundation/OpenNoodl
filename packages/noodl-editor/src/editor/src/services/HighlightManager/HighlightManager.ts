/**
 * HighlightManager - Core service for canvas highlighting
 *
 * Singleton service that manages multi-channel highlights on the node graph canvas.
 * Extends EventDispatcher to notify listeners of highlight changes.
 *
 * Features:
 * - Multi-channel organization (lineage, impact, selection, warning)
 * - Persistent highlights that survive component navigation
 * - Path highlighting across multiple nodes/connections
 * - Event-based notifications for UI updates
 *
 * @example
 * ```typescript
 * const handle = HighlightManager.instance.highlightNodes(['node1', 'node2'], {
 *   channel: 'lineage',
 *   label: 'Data flow from Input'
 * });
 *
 * // Later...
 * handle.update(['node1', 'node2', 'node3']);
 * handle.dismiss();
 * ```
 */

import { EventDispatcher } from '../../../../shared/utils/EventDispatcher';
import { getChannelConfig, isValidChannel } from './channels';
import { HighlightHandle } from './HighlightHandle';
import type {
  HighlightOptions,
  ConnectionRef,
  PathDefinition,
  IHighlightHandle,
  HighlightInfo,
  HighlightState,
  HighlightManagerEvent,
  HighlightEventCallback,
  ComponentBoundary
} from './types';

/**
 * Main highlighting service - manages all highlights across all channels
 */
export class HighlightManager extends EventDispatcher {
  private static _instance: HighlightManager;

  /**
   * Get the singleton instance
   */
  static get instance(): HighlightManager {
    if (!HighlightManager._instance) {
      HighlightManager._instance = new HighlightManager();
    }
    return HighlightManager._instance;
  }

  /**
   * Internal state tracking all active highlights
   */
  private highlights: Map<string, HighlightState> = new Map();

  /**
   * Counter for generating unique highlight IDs
   */
  private nextId: number = 1;

  /**
   * Current component being viewed (for persistence tracking)
   * Set by NodeGraphEditor when navigating components
   */
  private currentComponentId: string | null = null;

  private constructor() {
    super();
  }

  /**
   * Highlight specific nodes
   *
   * @param nodeIds - Array of node IDs to highlight
   * @param options - Highlight configuration
   * @returns Handle to control the highlight
   *
   * @example
   * ```typescript
   * const handle = HighlightManager.instance.highlightNodes(
   *   ['textNode', 'outputNode'],
   *   { channel: 'lineage', label: 'Text data flow' }
   * );
   * ```
   */
  highlightNodes(nodeIds: string[], options: HighlightOptions): IHighlightHandle {
    if (!isValidChannel(options.channel)) {
      console.warn(`HighlightManager: Unknown channel "${options.channel}"`);
    }

    const id = `highlight-${this.nextId++}`;
    const channelConfig = getChannelConfig(options.channel);

    // Create the highlight state
    const state: HighlightState = {
      id,
      channel: options.channel,
      allNodeIds: [...nodeIds],
      allConnections: [],
      visibleNodeIds: [...nodeIds], // Will be filtered in Phase 3
      visibleConnections: [],
      options: {
        ...options,
        color: options.color || channelConfig.color,
        style: options.style || channelConfig.style,
        persistent: options.persistent !== false // Default to true
      },
      createdAt: new Date(),
      active: true
    };

    this.highlights.set(id, state);

    // Create the handle
    const handle = new HighlightHandle(
      id,
      options.channel,
      nodeIds,
      [],
      options.label,
      (h) => this.handleUpdate(h),
      (h) => this.handleDismiss(h)
    );

    // Notify listeners
    this.notifyListeners('highlightAdded', {
      highlightId: id,
      channel: options.channel,
      highlight: this.getHighlightInfo(state)
    });

    return handle;
  }

  /**
   * Highlight specific connections between nodes
   *
   * @param connections - Array of connection references
   * @param options - Highlight configuration
   * @returns Handle to control the highlight
   *
   * @example
   * ```typescript
   * const handle = HighlightManager.instance.highlightConnections(
   *   [{ fromNodeId: 'a', fromPort: 'out', toNodeId: 'b', toPort: 'in' }],
   *   { channel: 'warning', label: 'Invalid connection' }
   * );
   * ```
   */
  highlightConnections(connections: ConnectionRef[], options: HighlightOptions): IHighlightHandle {
    if (!isValidChannel(options.channel)) {
      console.warn(`HighlightManager: Unknown channel "${options.channel}"`);
    }

    const id = `highlight-${this.nextId++}`;
    const channelConfig = getChannelConfig(options.channel);

    // Extract unique node IDs from connections
    const nodeIds = new Set<string>();
    connections.forEach((conn) => {
      nodeIds.add(conn.fromNodeId);
      nodeIds.add(conn.toNodeId);
    });

    const state: HighlightState = {
      id,
      channel: options.channel,
      allNodeIds: Array.from(nodeIds),
      allConnections: [...connections],
      visibleNodeIds: Array.from(nodeIds), // Will be filtered in Phase 3
      visibleConnections: [...connections], // Will be filtered in Phase 3
      options: {
        ...options,
        color: options.color || channelConfig.color,
        style: options.style || channelConfig.style,
        persistent: options.persistent !== false
      },
      createdAt: new Date(),
      active: true
    };

    this.highlights.set(id, state);

    const handle = new HighlightHandle(
      id,
      options.channel,
      Array.from(nodeIds),
      connections,
      options.label,
      (h) => this.handleUpdate(h),
      (h) => this.handleDismiss(h)
    );

    this.notifyListeners('highlightAdded', {
      highlightId: id,
      channel: options.channel,
      highlight: this.getHighlightInfo(state)
    });

    return handle;
  }

  /**
   * Clear all highlights in a specific channel
   *
   * @param channel - Channel to clear
   *
   * @example
   * ```typescript
   * HighlightManager.instance.clearChannel('selection');
   * ```
   */
  clearChannel(channel: string): void {
    const toRemove: string[] = [];

    this.highlights.forEach((state, id) => {
      if (state.channel === channel) {
        state.active = false;
        toRemove.push(id);
      }
    });

    toRemove.forEach((id) => this.highlights.delete(id));

    if (toRemove.length > 0) {
      this.notifyListeners('channelCleared', { channel });
    }
  }

  /**
   * Clear all highlights across all channels
   */
  clearAll(): void {
    this.highlights.clear();
    this.notifyListeners('allCleared', {});
  }

  /**
   * Get all active highlights, optionally filtered by channel
   *
   * @param channel - Optional channel filter
   * @returns Array of highlight information
   */
  getHighlights(channel?: string): HighlightInfo[] {
    const results: HighlightInfo[] = [];

    this.highlights.forEach((state) => {
      if (state.active && (!channel || state.channel === channel)) {
        results.push(this.getHighlightInfo(state));
      }
    });

    return results;
  }

  /**
   * Set the current component being viewed
   * Called by NodeGraphEditor when navigating
   * Filters highlights to show only nodes/connections in the current component
   *
   * @internal
   */
  setCurrentComponent(componentId: string | null): void {
    if (this.currentComponentId === componentId) {
      return; // No change
    }

    this.currentComponentId = componentId;

    // Re-filter all active highlights for the new component
    this.highlights.forEach((state) => {
      this.filterVisibleElements(state);
    });

    // Notify listeners that highlights have changed
    this.notifyListeners('highlightUpdated', {
      channel: 'all'
    });
  }

  /**
   * Get the current component ID
   * @internal
   */
  getCurrentComponent(): string | null {
    return this.currentComponentId;
  }

  /**
   * Highlight a path through the node graph
   *
   * Supports cross-component paths with boundary detection.
   *
   * @param path - Path definition with nodes and connections
   * @param options - Highlight configuration
   * @returns Handle to control the highlight
   */
  highlightPath(path: PathDefinition, options: HighlightOptions): IHighlightHandle {
    if (!isValidChannel(options.channel)) {
      console.warn(`HighlightManager: Unknown channel "${options.channel}"`);
    }

    const id = `highlight-${this.nextId++}`;
    const channelConfig = getChannelConfig(options.channel);

    // Detect component boundaries in the path
    const boundaries = path.componentBoundaries || this.detectComponentBoundaries(path);

    const state: HighlightState = {
      id,
      channel: options.channel,
      allNodeIds: [...path.nodes],
      allConnections: [...path.connections],
      visibleNodeIds: [...path.nodes], // Will be filtered
      visibleConnections: [...path.connections], // Will be filtered
      componentBoundaries: boundaries,
      options: {
        ...options,
        color: options.color || channelConfig.color,
        style: options.style || channelConfig.style,
        persistent: options.persistent !== false
      },
      createdAt: new Date(),
      active: true
    };

    // Filter for current component
    this.filterVisibleElements(state);

    this.highlights.set(id, state);

    const handle = new HighlightHandle(
      id,
      options.channel,
      path.nodes,
      path.connections,
      options.label,
      (h) => this.handleUpdate(h),
      (h) => this.handleDismiss(h)
    );

    this.notifyListeners('highlightAdded', {
      highlightId: id,
      channel: options.channel,
      highlight: this.getHighlightInfo(state)
    });

    return handle;
  }

  /**
   * Get visible highlights for the current component
   * Returns only highlights with elements visible in the current component
   *
   * @internal
   */
  getVisibleHighlights(): HighlightState[] {
    return Array.from(this.highlights.values())
      .filter((s) => s.active)
      .filter((s) => s.visibleNodeIds.length > 0 || s.visibleConnections.length > 0);
  }

  /**
   * Handle highlight update from a HighlightHandle
   * @private
   */
  private handleUpdate(handle: HighlightHandle): void {
    const state = this.highlights.get(handle.id);
    if (!state) return;

    state.allNodeIds = handle.getNodeIds();
    state.allConnections = handle.getConnections();

    // Re-filter for current component
    this.filterVisibleElements(state);

    this.notifyListeners('highlightUpdated', {
      highlightId: handle.id,
      channel: handle.channel,
      highlight: this.getHighlightInfo(state)
    });
  }

  /**
   * Handle highlight dismissal from a HighlightHandle
   * @private
   */
  private handleDismiss(handle: HighlightHandle): void {
    const state = this.highlights.get(handle.id);
    if (!state) return;

    state.active = false;
    this.highlights.delete(handle.id);

    this.notifyListeners('highlightRemoved', {
      highlightId: handle.id,
      channel: handle.channel
    });
  }

  /**
   * Detect component boundaries in a path
   * Identifies where the path crosses between parent and child components
   *
   * @private
   */
  private detectComponentBoundaries(_path: PathDefinition): ComponentBoundary[] {
    // This is a simplified implementation
    // In a full implementation, we would:
    // 1. Get the component owner for each node from the model
    // 2. Detect transitions between different components
    // 3. Identify entry/exit nodes (Component Input/Output nodes)

    // For now, return empty array - will be enhanced when integrated with node models
    return [];
  }

  /**
   * Filter visible nodes and connections based on current component
   * Updates the state's visibleNodeIds and visibleConnections arrays
   *
   * @private
   */
  private filterVisibleElements(state: HighlightState): void {
    if (!this.currentComponentId) {
      // No component context - show everything
      state.visibleNodeIds = [...state.allNodeIds];
      state.visibleConnections = [...state.allConnections];
      return;
    }

    // Filter nodes - for now, show all (will be enhanced with component ownership checks)
    state.visibleNodeIds = [...state.allNodeIds];
    state.visibleConnections = [...state.allConnections];

    // TODO: When integrated with NodeGraphModel:
    // - Check node.model.owner to determine component
    // - Filter to only nodes belonging to currentComponentId
    // - Filter connections to only those where both nodes are visible
  }

  /**
   * Convert internal state to public HighlightInfo
   * @private
   */
  private getHighlightInfo(state: HighlightState): HighlightInfo {
    return {
      id: state.id,
      channel: state.channel,
      nodeIds: [...state.allNodeIds],
      connections: [...state.allConnections],
      options: { ...state.options },
      createdAt: state.createdAt
    };
  }

  /**
   * Subscribe to highlight events
   *
   * @example
   * ```typescript
   * const context = {};
   * HighlightManager.instance.on('highlightAdded', (data) => {
   *   console.log('New highlight:', data.highlightId);
   * }, context);
   * ```
   */
  on(event: HighlightManagerEvent, callback: HighlightEventCallback, context: object): void {
    // EventDispatcher expects a generic callback, cast to compatible type
    super.on(event, callback as (data: unknown) => void, context);
  }

  /**
   * Unsubscribe from highlight events
   */
  off(context: object): void {
    super.off(context);
  }
}
