/**
 * JSON Editor Component Types
 *
 * Type definitions for the unified JSON editor component with
 * Easy Mode (visual builder) and Advanced Mode (text editor).
 *
 * @module json-editor
 */

/**
 * JSON value types supported by the editor
 */
export type JSONValueType = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object';

/**
 * Validation result with detailed error information and fix suggestions
 */
export interface ValidationResult {
  /** Whether the JSON is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Line number where error occurred (1-indexed) */
  line?: number;
  /** Column number where error occurred (1-indexed) */
  column?: number;
  /** Suggested fix for the error */
  suggestion?: string;
  /** Parsed value if valid */
  value?: unknown;
}

/**
 * Editor mode: Easy (visual) or Advanced (text)
 */
export type EditorMode = 'easy' | 'advanced';

/**
 * Props for the main JSONEditor component
 */
export interface JSONEditorProps {
  /** Initial value (JSON string or parsed object/array) */
  value: string | object | unknown[];

  /** Called when value changes (debounced) */
  onChange: (value: string) => void;

  /** Called on explicit save (Cmd+S or button) */
  onSave?: (value: string) => void;

  /** Initial mode - defaults to 'easy' */
  defaultMode?: EditorMode;

  /** Force a specific mode (no toggle shown) */
  mode?: EditorMode;

  /**
   * Re-spell the JSON for the mode being switched to, before that mode renders it.
   *
   * 🔴 **The two modes may legitimately show the same value differently.** `optionslist` is the
   * case this exists for: Easy mode shows an option whose Value mirrors its Label as the bare
   * label, and Advanced mode shows `{ Label, Value }` so the value can be edited (Richard,
   * 2026-09-06). Without this hook the editor holds ONE json string and Easy mode's spelling
   * silently became Advanced mode's too.
   *
   * Receives the current draft text — not the `value` prop — so unsaved edits survive the switch,
   * and its result is emitted through `onChange` so the host's draft stays in step. Return the
   * input unchanged to say "nothing to re-spell"; that is also what an implementation must do for
   * text it cannot read.
   */
  transformForMode?: (json: string, mode: EditorMode) => string;

  /** Type constraint for validation */
  expectedType?: 'array' | 'object' | 'any';

  /** Readonly mode */
  disabled?: boolean;

  /** Height constraint */
  height?: number | string;

  /** Custom placeholder for empty state */
  placeholder?: string;
}

/**
 * Internal tree node representation for Easy Mode
 */
export interface JSONTreeNode {
  /** Unique identifier for this node */
  id: string;
  /** Node type */
  type: JSONValueType;
  /** For object keys */
  key?: string;
  /** For array indices */
  index?: number;
  /** The actual value (primitives) or undefined (arrays/objects) */
  value?: string | number | boolean | null;
  /** Child nodes for arrays/objects */
  children?: JSONTreeNode[];
  /** Whether this node is expanded */
  isExpanded?: boolean;
  /** Path to this node (for editing) */
  path: (string | number)[];
}

/**
 * Action types for tree node operations
 */
export type TreeAction =
  | { type: 'add'; path: (string | number)[]; valueType: JSONValueType; key?: string }
  | { type: 'edit'; path: (string | number)[]; value: unknown }
  | { type: 'delete'; path: (string | number)[] }
  | { type: 'toggle'; path: (string | number)[] }
  | { type: 'reorder'; path: (string | number)[]; fromIndex: number; toIndex: number };
