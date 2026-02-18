/**
 * UBA-003: SecretField
 * Password-masked text input with a show/hide visibility toggle.
 * Respects `no_paste` to prevent pasting (for high-security secrets).
 */

import React, { useState } from 'react';

import { SecretField as SecretFieldType } from '../../../models/UBA/types';
import css from './fields.module.scss';
import { FieldWrapper } from './FieldWrapper';

export interface SecretFieldProps {
  field: SecretFieldType;
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

/** Minimal eye / eye-off SVGs — no external icon dep required */
const EyeIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.25" />
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.25" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M2 2l12 12M6.5 6.6A3 3 0 0 0 9.4 9.5M4.1 4.2C2.7 5.1 1 8 1 8s2.5 5 7 5c1.3 0 2.5-.4 3.5-1M7 3.1C7.3 3 7.7 3 8 3c4.5 0 7 5 7 5s-.6 1.2-1.7 2.4"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
  </svg>
);

export function SecretField({ field, value, onChange, onBlur, error, disabled }: SecretFieldProps) {
  const [visible, setVisible] = useState(false);
  const placeholder = field.placeholder ?? field.ui?.placeholder ?? '••••••••••••';

  return (
    <FieldWrapper field={field} error={error}>
      <div className={css.secretWrapper}>
        <input
          id={field.id}
          type={visible ? 'text' : 'password'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="new-password"
          onPaste={field.no_paste ? (e) => e.preventDefault() : undefined}
          className={`${css.secretInput}${error ? ` ${css.hasError}` : ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className={css.visibilityToggle}
          title={visible ? 'Hide' : 'Show'}
          tabIndex={-1}
          disabled={disabled}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </FieldWrapper>
  );
}
