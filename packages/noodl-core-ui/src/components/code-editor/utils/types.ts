/**
 * Type definitions for JavaScriptEditor
 *
 * @module code-editor/utils
 */

import type { CodeHistoryProvider } from '../CodeHistory/types';

export type ValidationType = 'expression' | 'function' | 'script' | 'json';

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

  /** Callback when user closes the editor (Close button or Escape) */
  onClose?: () => void;

  /** Validation type */
  validationType?: ValidationType;

  /** Disable the editor */
  disabled?: boolean;

  /**
   * Width of the editor. A number or `px` string sets a resizable pixel width;
   * any other CSS length (`'100%'`, `'70vh'`) is used as written.
   */
  width?: number | string;

  /** Height of the editor. Same rules as {@link JavaScriptEditorProps.width}. */
  height?: number | string;

  /** Placeholder text */
  placeholder?: string;

  /**
   * Supplies past versions of this parameter for the History button. Omit it and the
   * button is not rendered at all.
   */
  historyProvider?: CodeHistoryProvider;
}
