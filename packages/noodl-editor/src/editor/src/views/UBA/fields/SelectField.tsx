/**
 * UBA-003: SelectField
 * Native select dropdown. Renders all options from `field.options`.
 * Empty option is prepended unless a default is set.
 */

import React from 'react';

import { SelectField as SelectFieldType } from '../../../models/UBA/types';
import css from './fields.module.scss';
import { FieldWrapper } from './FieldWrapper';

/** Minimal chevron SVG */
const ChevronDown = () => (
  <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export interface SelectFieldProps {
  field: SelectFieldType;
  value: string | undefined;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function SelectField({ field, value, onChange, error, disabled }: SelectFieldProps) {
  const current = value ?? field.default ?? '';

  return (
    <FieldWrapper field={field} error={error}>
      <div className={css.selectWrapper}>
        <select
          id={field.id}
          value={current}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${css.selectInput}${error ? ` ${css.hasError}` : ''}`}
        >
          {!current && <option value="">-- Select --</option>}
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value} title={opt.description}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className={css.selectChevron}>
          <ChevronDown />
        </span>
      </div>
    </FieldWrapper>
  );
}
