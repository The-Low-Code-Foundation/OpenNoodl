/**
 * RenameInput
 *
 * Inline input field for renaming components/folders.
 * Auto-focuses and selects text on mount.
 */

import React, { useCallback, useEffect, useRef } from 'react';

import css from '../ComponentsPanel.module.scss';

interface RenameInputProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  level: number;
}

export function RenameInput({ value, onChange, onConfirm, onCancel, level }: RenameInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus and select all on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      console.log('🔍 RenameInput keyDown:', e.key);
      if (e.key === 'Enter') {
        console.log('✅ Enter pressed - calling onConfirm');
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      } else if (e.key === 'Escape') {
        console.log('✅ Escape pressed - calling onCancel');
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    },
    [onConfirm, onCancel]
  );

  const handleBlur = useCallback(() => {
    console.log('🔍 RenameInput blur - calling onConfirm');
    onConfirm();
  }, [onConfirm]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    /* PNL-006: depth in, padding out — the same `--level` contract the rows use,
       so the field sits exactly where the row it replaces did. */
    <div className={css['RenameContainer']} style={{ '--level': String(level) } as React.CSSProperties}>
      <input
        ref={inputRef}
        type="text"
        className={css['RenameInput']}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
}
