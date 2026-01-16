/**
 * CellEditor
 *
 * Inline cell editor component with type-aware input controls.
 * Handles String, Number, Boolean, Date, Object, and Array types.
 *
 * @module panels/databrowser/CellEditor
 * @since 1.2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import css from './CellEditor.module.scss';

export interface CellEditorProps {
  /** Current value */
  value: unknown;
  /** Column type */
  type: string;
  /** Called when value saved */
  onSave: (value: unknown) => void;
  /** Called when editing cancelled */
  onCancel: () => void;
  /** Error message to display */
  error?: string | null;
}

/**
 * CellEditor component - type-aware inline editor
 */
export function CellEditor({ value, type, onSave, onCancel, error }: CellEditorProps) {
  const [editValue, setEditValue] = useState<string>(() => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  });
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Focus input on mount with delay to prevent immediate blur
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        if (inputRef.current instanceof HTMLInputElement) {
          inputRef.current.select();
        }
        setIsFocused(true);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && type !== 'Object' && type !== 'Array') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [type, onCancel]
  );

  // Handle save with type conversion
  const handleSave = useCallback(() => {
    let finalValue: unknown = editValue;

    try {
      switch (type) {
        case 'Number':
          if (editValue.trim() === '') {
            finalValue = null;
          } else {
            finalValue = parseFloat(editValue);
            if (isNaN(finalValue as number)) {
              setJsonError('Invalid number');
              return;
            }
          }
          break;

        case 'Boolean':
          // Boolean is handled by checkbox, just use editValue
          finalValue = editValue === 'true';
          break;

        case 'Date':
          if (editValue.trim() === '') {
            finalValue = null;
          } else {
            finalValue = new Date(editValue).toISOString();
          }
          break;

        case 'Object':
        case 'Array':
          if (editValue.trim() === '') {
            finalValue = type === 'Array' ? [] : {};
          } else {
            finalValue = JSON.parse(editValue);
          }
          break;

        default:
          // String - use as-is
          finalValue = editValue;
      }

      setJsonError(null);
      onSave(finalValue);
    } catch (err) {
      setJsonError('Invalid JSON');
    }
  }, [editValue, type, onSave]);

  // Boolean - render checkbox
  if (type === 'Boolean') {
    return (
      <div className={css.CellEditor}>
        <input
          type="checkbox"
          checked={value === true || editValue === 'true'}
          onChange={(e) => {
            setEditValue(e.target.checked ? 'true' : 'false');
            onSave(e.target.checked);
          }}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        />
        {error && <div className={css.Error}>{error}</div>}
      </div>
    );
  }

  // Date - render datetime input
  if (type === 'Date') {
    const dateValue = value ? new Date(value as string).toISOString().slice(0, 16) : '';
    return (
      <div className={css.CellEditor}>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="datetime-local"
          className={css.DateInput}
          value={editValue || dateValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => isFocused && handleSave()}
        />
        {(error || jsonError) && <div className={css.Error}>{error || jsonError}</div>}
      </div>
    );
  }

  // Object/Array - render textarea
  if (type === 'Object' || type === 'Array') {
    return (
      <div className={css.CellEditor}>
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className={css.JsonEditor}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            setJsonError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
          rows={5}
          spellCheck={false}
        />
        <div className={css.JsonActions}>
          <button className={css.SaveButton} onClick={handleSave}>
            Save
          </button>
          <button className={css.CancelButton} onClick={onCancel}>
            Cancel
          </button>
        </div>
        {(error || jsonError) && <div className={css.Error}>{error || jsonError}</div>}
      </div>
    );
  }

  // Number - render number input
  if (type === 'Number') {
    return (
      <div className={css.CellEditor}>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          className={css.Input}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => isFocused && handleSave()}
          step="any"
        />
        {(error || jsonError) && <div className={css.Error}>{error || jsonError}</div>}
      </div>
    );
  }

  // Default: String - render text input
  return (
    <div className={css.CellEditor}>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        className={css.Input}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => isFocused && handleSave()}
      />
      {(error || jsonError) && <div className={css.Error}>{error || jsonError}</div>}
    </div>
  );
}
