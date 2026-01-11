/**
 * CodeHistoryManager
 *
 * Manages automatic code snapshots for Expression, Function, and Script nodes.
 * Allows users to view history and restore previous versions.
 *
 * @module models
 */

import { NodeGraphNode } from '@noodl-models/nodegraphmodel/NodeGraphNode';
import { ProjectModel } from '@noodl-models/projectmodel';

import Model from '../../../shared/model';

/**
 * A single code snapshot
 */
export interface CodeSnapshot {
  code: string;
  timestamp: string; // ISO 8601 format
  hash: string; // For deduplication
}

/**
 * Metadata structure for code history
 */
export interface CodeHistoryMetadata {
  codeHistory?: CodeSnapshot[];
}

/**
 * Manages code history for nodes
 */
export class CodeHistoryManager extends Model {
  public static instance = new CodeHistoryManager();

  private readonly MAX_SNAPSHOTS = 20;

  /**
   * Save a code snapshot for a node
   * Only saves if code has actually changed (hash comparison)
   */
  saveSnapshot(nodeId: string, parameterName: string, code: string): void {
    const node = this.getNode(nodeId);
    if (!node) {
      console.warn('CodeHistoryManager: Node not found:', nodeId);
      return;
    }

    // Don't save empty code
    if (!code || code.trim() === '') {
      return;
    }

    // Compute hash for deduplication
    const hash = this.hashCode(code);

    // Get existing history
    const history = this.getHistory(nodeId, parameterName);

    // Check if last snapshot is identical (deduplication)
    if (history.length > 0) {
      const lastSnapshot = history[history.length - 1];
      if (lastSnapshot.hash === hash) {
        // Code hasn't changed, don't create duplicate snapshot
        return;
      }
    }

    // Create new snapshot
    const snapshot: CodeSnapshot = {
      code,
      timestamp: new Date().toISOString(),
      hash
    };

    // Add to history
    history.push(snapshot);

    // Prune old snapshots
    if (history.length > this.MAX_SNAPSHOTS) {
      history.splice(0, history.length - this.MAX_SNAPSHOTS);
    }

    // Save to node metadata
    this.saveHistory(node, parameterName, history);

    console.log(`📸 Code snapshot saved for node ${nodeId}, param ${parameterName} (${history.length} total)`);
  }

  /**
   * Get code history for a node parameter
   */
  getHistory(nodeId: string, parameterName: string): CodeSnapshot[] {
    const node = this.getNode(nodeId);
    if (!node) {
      return [];
    }

    const historyKey = this.getHistoryKey(parameterName);
    const metadata = node.metadata as CodeHistoryMetadata | undefined;

    if (!metadata || !metadata[historyKey]) {
      return [];
    }

    return metadata[historyKey] as CodeSnapshot[];
  }

  /**
   * Restore a snapshot by timestamp
   * Returns the code from that snapshot
   */
  restoreSnapshot(nodeId: string, parameterName: string, timestamp: string): string | undefined {
    const history = this.getHistory(nodeId, parameterName);
    const snapshot = history.find((s) => s.timestamp === timestamp);

    if (!snapshot) {
      console.warn('CodeHistoryManager: Snapshot not found:', timestamp);
      return undefined;
    }

    console.log(`↩️ Restoring snapshot from ${timestamp}`);
    return snapshot.code;
  }

  /**
   * Get a specific snapshot by timestamp
   */
  getSnapshot(nodeId: string, parameterName: string, timestamp: string): CodeSnapshot | undefined {
    const history = this.getHistory(nodeId, parameterName);
    return history.find((s) => s.timestamp === timestamp);
  }

  /**
   * Clear all history for a node parameter
   */
  clearHistory(nodeId: string, parameterName: string): void {
    const node = this.getNode(nodeId);
    if (!node) {
      return;
    }

    const historyKey = this.getHistoryKey(parameterName);

    if (node.metadata) {
      delete node.metadata[historyKey];
    }

    console.log(`🗑️ Cleared history for node ${nodeId}, param ${parameterName}`);
  }

  /**
   * Get the node from the current project
   */
  private getNode(nodeId: string): NodeGraphNode | undefined {
    const project = ProjectModel.instance;
    if (!project) {
      return undefined;
    }

    // Search all components for the node
    for (const component of project.getComponents()) {
      const graph = component.graph;
      if (!graph) continue;

      const node = graph.findNodeWithId(nodeId);
      if (node) {
        return node;
      }
    }

    return undefined;
  }

  /**
   * Save history to node metadata
   */
  private saveHistory(node: NodeGraphNode, parameterName: string, history: CodeSnapshot[]): void {
    const historyKey = this.getHistoryKey(parameterName);

    if (!node.metadata) {
      node.metadata = {};
    }

    node.metadata[historyKey] = history;

    // Notify that metadata changed (triggers project save)
    node.notifyListeners('metadataChanged');
  }

  /**
   * Get the metadata key for a parameter's history
   * Uses a prefix to avoid conflicts with other metadata
   */
  private getHistoryKey(parameterName: string): string {
    return `codeHistory_${parameterName}`;
  }

  /**
   * Compute a simple hash of code for deduplication
   * Not cryptographic, just for detecting changes
   */
  private hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Format a timestamp for display
   * Returns human-readable relative time ("5 minutes ago", "Yesterday")
   */
  formatTimestamp(timestamp: string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) {
      return 'just now';
    } else if (diffMin < 60) {
      return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    } else if (diffDay === 1) {
      return 'yesterday at ' + then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDay < 7) {
      return `${diffDay} days ago`;
    } else {
      // Full date for older snapshots
      return then.toLocaleDateString() + ' at ' + then.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }
}
