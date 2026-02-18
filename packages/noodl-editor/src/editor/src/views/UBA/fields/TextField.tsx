/**
 * UBA-003: TextField
 * Multi-line textarea, optionally monospaced.
 */

import React from 'react';

import { TextField as TextFieldType } from '../../../models/UBA/types';
import css from './fields.module.scss';
import { FieldWrapper } from './FieldWrapper';

export interface TextFieldProps {
  field: TextFieldType;
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

export function TextField({ field, value, onChange, onBlur, error, disabled }: TextFieldProps) {
  const placeholder = field.placeholder ?? field.ui?.placeholder;
  const monospace = field.ui?.monospace;
  const rows = field.rows ?? 4;

  return (
    <FieldWrapper field={field} error={error}>
      <textarea
        id={field.id}
        value={value ?? field.default ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        maxLength={field.validation?.max_length}
        className={`${css.textArea}${error ? ` ${css.hasError}` : ''}${monospace ? ` ${css.monoInput}` : ''}`}
      />
    </FieldWrapper>
  );
}
