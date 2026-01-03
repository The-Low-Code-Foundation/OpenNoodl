/**
 * StringInputDialog
 *
 * Simple centered dialog for string input (sheet creation/renaming).
 * Uses CSS classes for proper Electron compatibility (inline styles don't work).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import css from './StringInputDialog.module.scss';

interface StringInputDialogProps {
  title: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function StringInputDialog({
  title,
  defaultValue = '',
  placeholder,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel
}: StringInputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  }, []);

  const handleConfirm = useCallback(() => {
    if (value.trim()) {
      onConfirm(value.trim());
    }
  }, [value, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleConfirm, onCancel]
  );

  return (
    <div className={css['Root']} onClick={onCancel}>
      <div className={css['Dialog']} onClick={(e) => e.stopPropagation()}>
        <h2 className={css['Title']}>{title}</h2>
        <input
          ref={inputRef}
          type="text"
          className={css['Input']}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className={css['Actions']}>
          <button className={css['ButtonCancel']} onClick={onCancel}>
            Cancel
          </button>
          <button className={css['ButtonConfirm']} onClick={handleConfirm} disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
