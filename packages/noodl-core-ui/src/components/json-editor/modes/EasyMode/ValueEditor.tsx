/**
 * ValueEditor Component
 *
 * Type-aware inline editor for primitive JSON values.
 * Provides appropriate input controls for each type.
 *
 * @module json-editor/modes/EasyMode
 */

import React, { useState, useEffect, useRef } from 'react';

import { JSONValueType } from '../../utils/types';
import css from './ValueEditor.module.scss';

export interface ValueEditorProps {
  /** Current value */
  value: string | number | boolean | null;
  /** Value type */
  type: JSONValueType;
  /** Called when value is saved */
  onSave: (value: unknown) => void;
  /** Called when editing is cancelled */
  onCancel: () => void;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

/**
 * Inline editor for primitive values
 */
export function ValueEditor({ value, type, onSave, onCancel, autoFocus = true }: ValueEditorProps) {
  const [localValue, setLocalValue] = useState<string>(() => {
    if (type === 'null') return 'null';
    if (type === 'boolean') return value ? 'true' : 'false';
    return String(value ?? '');
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleSave = () => {
    // Convert string to appropriate type
    let parsedValue: unknown;

    if (type === 'null') {
      parsedValue = null;
    } else if (type === 'boolean') {
      parsedValue = localValue === 'true';
    } else if (type === 'number') {
      const num = Number(localValue);
      if (isNaN(num)) {
        // Invalid number, cancel
        onCancel();
        return;
      }
      parsedValue = num;
    } else {
      // String
      parsedValue = localValue;
    }

    onSave(parsedValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  // Boolean toggle
  if (type === 'boolean') {
    return (
      <div className={css['BooleanEditor']}>
        <label className={css['BooleanToggle']}>
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="checkbox"
            checked={localValue === 'true'}
            onChange={(e) => {
              const newValue = e.target.checked ? 'true' : 'false';
              setLocalValue(newValue);
              // Auto-save on toggle
              onSave(e.target.checked);
            }}
            autoFocus={autoFocus}
          />
          <span className={css['ToggleLabel']}>{localValue}</span>
        </label>
      </div>
    );
  }

  // Null (read-only, just show the value)
  if (type === 'null') {
    return (
      <div className={css['NullEditor']}>
        <span className={css['NullValue']}>null</span>
        <button onClick={onCancel} className={css['CloseButton']}>
          ✕
        </button>
      </div>
    );
  }

  // String and Number input
  return (
    <div className={css['InputEditor']}>
      <input
        ref={inputRef}
        type={type === 'number' ? 'number' : 'text'}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        className={css['Input']}
        placeholder={type === 'string' ? 'Enter text...' : 'Enter number...'}
      />
      <div className={css['ButtonGroup']}>
        <button onClick={handleSave} className={css['SaveButton']} title="Save (Enter)">
          ✓
        </button>
        <button onClick={onCancel} className={css['CancelButton']} title="Cancel (Esc)">
          ✕
        </button>
      </div>
    </div>
  );
}
