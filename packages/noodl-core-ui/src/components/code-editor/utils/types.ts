/**
 * Type definitions for JavaScriptEditor
 *
 * @module code-editor/utils
 */

export type ValidationType = 'expression' | 'function' | 'script';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestion?: string;
  line?: number;
  column?: number;
}

export interface JavaScriptEditorProps {
  /** Current code value */
  value: string;

  /** Callback when code changes */
  onChange?: (value: string) => void;

  /** Callback when user saves (Ctrl+S or Save button) */
  onSave?: (value: string) => void;

  /** Validation type */
  validationType?: ValidationType;

  /** Disable the editor */
  disabled?: boolean;

  /** Width of the editor */
  width?: number | string;

  /** Height of the editor */
  height?: number | string;

  /** Placeholder text */
  placeholder?: string;

  /** Node ID for history tracking (optional) */
  nodeId?: string;

  /** Parameter name for history tracking (optional) */
  parameterName?: string;
}
