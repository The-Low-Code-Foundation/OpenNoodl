/**
 * Type definitions for JavaScriptEditor
 *
 * @module code-editor/utils
 */

import type { CodeHistoryProvider } from '../CodeHistory/types';

/**
 * What the popout is editing.
 *
 * This one value picks the language, the validator **and** the label in the
 * toolbar, which is why it is not called `language`: the four JavaScript-family
 * members differ only in how the text is validated.
 *
 * The last three have no validator. They are here because the property panel
 * reaches this editor for ports that are not JavaScript at all — a CSS
 * Definition's `style`, a component's raw `styleCss`, Static Data's `csv`,
 * project settings' `headCode`. Those used to fall through to `expression`,
 * which titled the popout **EXPRESSION** and then reported every line of valid
 * CSS as a syntax error. An editor that misnames what it is holding and then
 * fails it is worse than one with no verdict at all.
 */
export type ValidationType = 'expression' | 'function' | 'script' | 'json' | 'text' | 'css' | 'html';

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

  /** Placeholder text. Omit it and the mode's own suggestion is used. */
  placeholder?: string;

  /**
   * Supplies past versions of this parameter for the History button. Omit it and the
   * button is not rendered at all.
   */
  historyProvider?: CodeHistoryProvider;
}
