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

import { ACL_COLUMN_TYPE, formatAclForEditing, parseAclInput } from './acl';
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

/** What an empty ACL cell offers as a starting point (SPR-001/F84). */
const ACL_PLACEHOLDER = '{\n  "*": { "read": true },\n  "<userObjectId>": { "read": true, "write": true }\n}';

/**
 * CellEditor component - type-aware inline editor
 */
export function CellEditor({ value, type, onSave, onCancel, error }: CellEditorProps) {
  const [editValue, setEditValue] = useState<string>(() => {
    if (type === ACL_COLUMN_TYPE) return formatAclForEditing(value);
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

        // SPR-001/F84. Deliberately NOT folded into the Object case above:
        // that one turns an empty field into `{}`, and for an ACL `{}` means
        // *nobody* while absent means *public* — clearing the field would
        // otherwise hide the row from everyone. Shape is checked here as well
        // as JSON validity, so `{"alice": 5}` is refused with the sentence the
        // backend would have used rather than saved and silently enforced.
        case ACL_COLUMN_TYPE: {
          const result = parseAclInput(editValue);
          if (!result.ok) {
            setJsonError(result.error);
            return;
          }
          finalValue = result.value;
          break;
        }

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

  /**
   * Keyboard commit.
   *
   * ⚠️ `handleSave` is in the dependency list, and it has to be. This was
   * declared ABOVE `handleSave` and memoised on `[type, onCancel]`, so it
   * captured the very first `handleSave` — the one closing over `editValue` as
   * it was at mount. Pressing Enter therefore saved the value the cell **started
   * with**, discarding everything typed, while `onBlur` (an inline arrow, so
   * re-created every render) saved correctly. Both paths report success, so the
   * only visible symptom was the typing vanishing.
   *
   * Found driving POL-014 criterion 3: an edit committed with Enter moved
   * `updatedAt` on the record and left `author` on its old value.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && type !== 'Object' && type !== 'Array' && type !== ACL_COLUMN_TYPE) {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [type, onCancel, handleSave]
  );

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

  // Object/Array/ACL - render textarea
  if (type === 'Object' || type === 'Array' || type === ACL_COLUMN_TYPE) {
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
          placeholder={type === ACL_COLUMN_TYPE ? ACL_PLACEHOLDER : undefined}
        />
        {/* SPR-001/F84 — the vocabulary, said where it is typed. The keys are
            not free text: `*`, a user objectId, or `role:<name>`. */}
        {type === ACL_COLUMN_TYPE && (
          <div className={css.Hint}>
            Keys: <code>*</code> (everyone), a user objectId, or <code>role:name</code>. Empty clears the ACL, which
            makes the row public; <code>{'{}'}</code> grants nobody anything.
          </div>
        )}
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
