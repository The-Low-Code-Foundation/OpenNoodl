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

/**
 * Where the history shown in the dropdown comes from.
 *
 * `noodl-core-ui` is the design system and is also consumed by Storybook, so it must
 * not reach into the editor app for its data. Before CED-001 (B4) this folder did a
 * dynamic import of the editor's history model, with a `.catch(console.warn)` that
 * made the feature silently disappear anywhere that import did not resolve. The
 * consumer supplies this instead, already bound to the node and parameter being edited.
 */
export interface CodeHistoryProvider {
  /** Snapshots for the parameter under edit, oldest first. */
  getHistory(): CodeSnapshot[] | Promise<CodeSnapshot[]>;
}
