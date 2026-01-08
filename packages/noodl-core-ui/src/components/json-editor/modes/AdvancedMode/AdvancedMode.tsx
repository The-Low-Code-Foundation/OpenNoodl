/**
 * Advanced Mode - Text Editor for Power Users
 *
 * A text-based JSON editor with syntax highlighting, validation,
 * and helpful error messages. For users who prefer direct editing.
 *
 * @module json-editor/modes
 */

import React, { useState, useEffect } from 'react';

import { validateJSON } from '../../utils/jsonValidator';
import css from './AdvancedMode.module.scss';

export interface AdvancedModeProps {
  /** Current JSON string value */
  value: string;
  /** Called when value changes */
  onChange?: (value: string) => void;
  /** Readonly mode */
  disabled?: boolean;
}

/**
 * Advanced text editor mode
 */
export function AdvancedMode({ value, onChange, disabled }: AdvancedModeProps) {
  const [localValue, setLocalValue] = useState(value);
  const [validationResult, setValidationResult] = useState(validateJSON(value));

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
    setValidationResult(validateJSON(value));
  }, [value]);

  // Handle text changes
  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    const result = validateJSON(newValue);
    setValidationResult(result);

    // Only propagate valid JSON changes
    if (result.valid && onChange) {
      onChange(newValue);
    }
  };

  // Format/pretty-print JSON
  const handleFormat = () => {
    if (validationResult.valid) {
      try {
        const parsed = JSON.parse(localValue);
        const formatted = JSON.stringify(parsed, null, 2);
        setLocalValue(formatted);
        if (onChange) {
          onChange(formatted);
        }
      } catch (e) {
        // Should not happen if validation passed
        console.error('Format error:', e);
      }
    }
  };

  return (
    <div className={css['Root']}>
      {/* Toolbar */}
      <div className={css['Toolbar']}>
        <div className={css['ToolbarLeft']}>
          {validationResult.valid ? (
            <span className={css['StatusValid']}>✓ Valid JSON</span>
          ) : (
            <span className={css['StatusInvalid']}>✗ Invalid JSON</span>
          )}
        </div>
        <div className={css['ToolbarRight']}>
          <button
            onClick={handleFormat}
            disabled={!validationResult.valid || disabled}
            className={css['FormatButton']}
            title="Format JSON (Ctrl+Shift+F)"
          >
            Format
          </button>
        </div>
      </div>

      {/* Text Editor */}
      <textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className={css['Editor']}
        placeholder='{\n  "key": "value"\n}'
        spellCheck={false}
      />

      {/* Validation Errors */}
      {!validationResult.valid && (
        <div className={css['ErrorPanel']}>
          <div className={css['ErrorHeader']}>
            <span className={css['ErrorIcon']}>⚠️</span>
            <span className={css['ErrorTitle']}>JSON Syntax Error</span>
          </div>
          <div className={css['ErrorMessage']}>{validationResult.error}</div>
          {validationResult.suggestion && (
            <div className={css['ErrorSuggestion']}>
              <strong>💡 Suggestion:</strong> {validationResult.suggestion}
            </div>
          )}
          {validationResult.line !== undefined && (
            <div className={css['ErrorLocation']}>
              Line {validationResult.line}
              {validationResult.column !== undefined && `, Column ${validationResult.column}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
