/**
 * Shared types for Code History components
 *
 * @module code-editor/CodeHistory
 */

/**
 * A single code snapshot
 */
export interface CodeSnapshot {
  code: string;
  timestamp: string; // ISO 8601 format
  hash: string; // For deduplication
}
