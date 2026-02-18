/**
 * UBA-003: UrlField
 * URL input with optional protocol restriction.
 * Validates on blur — shows an error if the URL is malformed or protocol not allowed.
 */

import React, { useState } from 'react';

import { UrlField as UrlFieldType } from '../../../models/UBA/types';
import css from './fields.module.scss';
import { FieldWrapper } from './FieldWrapper';

export interface UrlFieldProps {
  field: UrlFieldType;
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

function validateUrl(value: string, protocols?: string[]): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (protocols && protocols.length > 0) {
      const scheme = url.protocol.replace(':', '');
      if (!protocols.includes(scheme)) {
        return `URL must use one of: ${protocols.join(', ')}`;
      }
    }
    return null;
  } catch {
    return 'Please enter a valid URL (e.g. https://example.com)';
  }
}

export function UrlField({ field, value, onChange, onBlur, error, disabled }: UrlFieldProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const placeholder = field.placeholder ?? field.ui?.placeholder ?? 'https://';

  const handleBlur = () => {
    if (value) {
      setLocalError(validateUrl(value, field.protocols));
    } else {
      setLocalError(null);
    }
    onBlur?.();
  };

  const displayError = error ?? localError ?? undefined;

  return (
    <FieldWrapper field={field} error={displayError}>
      <input
        id={field.id}
        type="url"
        value={value ?? field.default ?? ''}
        onChange={(e) => {
          onChange(e.target.value);
          if (localError) setLocalError(null);
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`${css.textInput}${displayError ? ` ${css.hasError}` : ''}`}
        autoComplete="off"
      />
    </FieldWrapper>
  );
}
