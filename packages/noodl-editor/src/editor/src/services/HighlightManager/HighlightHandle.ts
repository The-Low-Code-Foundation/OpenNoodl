/**
 * HighlightHandle - Control interface for individual highlights
 *
 * Provides methods to update, dismiss, and query highlights.
 * Handles are returned when creating highlights and should be kept
 * for later manipulation.
 */

import type { IHighlightHandle, ConnectionRef } from './types';

/**
 * Implementation of the highlight control interface
 */
export class HighlightHandle implements IHighlightHandle {
  private _active: boolean = true;
  private _nodeIds: string[];
  private _connections: ConnectionRef[];
  private _label: string | undefined;

  /**
   * Callback to notify manager of updates
   */
  private readonly onUpdate: (handle: HighlightHandle) => void;

  /**
   * Callback to notify manager of dismissal
   */
  private readonly onDismiss: (handle: HighlightHandle) => void;

  constructor(
    public readonly id: string,
    public readonly channel: string,
    nodeIds: string[],
    connections: ConnectionRef[],
    label: string | undefined,
    onUpdate: (handle: HighlightHandle) => void,
    onDismiss: (handle: HighlightHandle) => void
  ) {
    this._nodeIds = [...nodeIds];
    this._connections = [...connections];
    this._label = label;
    this.onUpdate = onUpdate;
    this.onDismiss = onDismiss;
  }

  /**
   * Update the highlighted nodes
   */
  update(nodeIds: string[]): void {
    if (!this._active) {
      console.warn(`HighlightHandle: Cannot update inactive highlight ${this.id}`);
      return;
    }

    this._nodeIds = [...nodeIds];
    this.onUpdate(this);
  }

  /**
   * Update the label displayed near the highlight
   */
  setLabel(label: string): void {
    if (!this._active) {
      console.warn(`HighlightHandle: Cannot update label on inactive highlight ${this.id}`);
      return;
    }

    this._label = label;
    this.onUpdate(this);
  }

  /**
   * Remove this highlight
   */
  dismiss(): void {
    if (!this._active) {
      return;
    }

    this._active = false;
    this.onDismiss(this);
  }

  /**
   * Check if this highlight is still active
   */
  isActive(): boolean {
    return this._active;
  }

  /**
   * Get the current node IDs
   */
  getNodeIds(): string[] {
    return [...this._nodeIds];
  }

  /**
   * Get the current connection refs
   */
  getConnections(): ConnectionRef[] {
    return [...this._connections];
  }

  /**
   * Get the current label
   * @internal Used by HighlightManager
   */
  getLabel(): string | undefined {
    return this._label;
  }

  /**
   * Update connections (internal method called by manager)
   * @internal
   */
  setConnections(connections: ConnectionRef[]): void {
    this._connections = [...connections];
  }

  /**
   * Mark this handle as inactive (internal method called by manager)
   * @internal
   */
  deactivate(): void {
    this._active = false;
  }
}
