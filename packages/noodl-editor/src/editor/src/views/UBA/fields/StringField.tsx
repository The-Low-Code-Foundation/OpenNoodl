/**
 * UBA-003: StringField
 * Single-line text input with optional max-length enforcement.
 */

import React from 'react';

import { StringField as StringFieldType } from '../../../models/UBA/types';
import css from './fields.module.scss';
import { FieldWrapper } from './FieldWrapper';

export interface StringFieldProps {
  field: StringFieldType;
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

export function StringField({ field, value, onChange, onBlur, error, disabled }: StringFieldProps) {
  const placeholder = field.placeholder ?? field.ui?.placeholder;
  const monospace = field.ui?.monospace;

  return (
    <FieldWrapper field={field} error={error}>
      <input
        id={field.id}
        type="text"
        value={value ?? field.default ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={field.validation?.max_length}
        className={`${css.textInput}${error ? ` ${css.hasError}` : ''}${monospace ? ` ${css.monoInput}` : ''}`}
        autoComplete="off"
      />
    </FieldWrapper>
  );
}
