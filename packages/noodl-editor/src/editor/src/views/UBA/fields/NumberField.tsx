/**
 * UBA-003: NumberField
 * Numeric input with optional min / max / step constraints.
 * Strips leading zeros on blur; handles integer-only mode.
 */

import React, { useState } from 'react';

import { NumberField as NumberFieldType } from '../../../models/UBA/types';
import css from './fields.module.scss';
import { FieldWrapper } from './FieldWrapper';

export interface NumberFieldProps {
  field: NumberFieldType;
  value: number | undefined;
  onChange: (value: number) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
}

export function NumberField({ field, value, onChange, onBlur, error, disabled }: NumberFieldProps) {
  const placeholder = field.placeholder ?? field.ui?.placeholder;

  // Internal string state so the user can type partial numbers (e.g. "-" or "1.")
  const [raw, setRaw] = useState<string>(
    value !== undefined ? String(value) : field.default !== undefined ? String(field.default) : ''
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setRaw(text);

    const parsed = field.integer ? parseInt(text, 10) : parseFloat(text);
    if (!Number.isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    // Normalise display value
    const parsed = field.integer ? parseInt(raw, 10) : parseFloat(raw);
    if (Number.isNaN(parsed)) {
      setRaw('');
    } else {
      // Clamp if bounds present
      const clamped = Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, parsed));
      setRaw(String(clamped));
      onChange(clamped);
    }
    onBlur?.();
  };

  return (
    <FieldWrapper field={field} error={error}>
      <input
        id={field.id}
        type="number"
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        min={field.min}
        max={field.max}
        step={field.step ?? (field.integer ? 1 : 'any')}
        className={`${css.numberInput}${error ? ` ${css.hasError}` : ''}`}
      />
    </FieldWrapper>
  );
}
