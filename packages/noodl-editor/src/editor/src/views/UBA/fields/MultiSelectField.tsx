/**
 * UBA-003: MultiSelectField
 * A native <select> for picking additional items, rendered as a tag list.
 * The dropdown only shows unselected options; already-selected items appear
 * as removable tags above the dropdown.
 */

import React from 'react';

import { MultiSelectField as MultiSelectFieldType } from '../../../models/UBA/types';
import css from './fields.module.scss';
import { FieldWrapper } from './FieldWrapper';

/** Minimal X SVG */
const CloseIcon = () => (
  <svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export interface MultiSelectFieldProps {
  field: MultiSelectFieldType;
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  error?: string;
  disabled?: boolean;
}

export function MultiSelectField({ field, value, onChange, error, disabled }: MultiSelectFieldProps) {
  const selected = value ?? field.default ?? [];
  const atMax = field.max_selections !== undefined && selected.length >= field.max_selections;

  const available = field.options.filter((opt) => !selected.includes(opt.value));

  const handleAdd = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    if (!newVal || selected.includes(newVal)) return;
    onChange([...selected, newVal]);
    // Reset the select back to placeholder
    e.target.value = '';
  };

  const handleRemove = (val: string) => {
    onChange(selected.filter((v) => v !== val));
  };

  const getLabel = (val: string) => field.options.find((o) => o.value === val)?.label ?? val;

  return (
    <FieldWrapper field={field} error={error}>
      <div className={css.multiSelectContainer}>
        {selected.length > 0 && (
          <div className={css.selectedTags}>
            {selected.map((val) => (
              <span key={val} className={css.tag}>
                <span className={css.tagLabel}>{getLabel(val)}</span>
                {!disabled && (
                  <button
                    type="button"
                    className={css.tagRemove}
                    onClick={() => handleRemove(val)}
                    title={`Remove ${getLabel(val)}`}
                  >
                    <CloseIcon />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {!atMax && (
          <select
            id={field.id}
            onChange={handleAdd}
            disabled={disabled || available.length === 0}
            value=""
            className={`${css.multiSelectDropdown}${error ? ` ${css.hasError}` : ''}`}
          >
            <option value="">{available.length === 0 ? 'All options selected' : '+ Add...'}</option>
            {available.map((opt) => (
              <option key={opt.value} value={opt.value} title={opt.description}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {atMax && (
          <p className={css.maxWarning}>
            Maximum {field.max_selections} selection{field.max_selections === 1 ? '' : 's'} reached
          </p>
        )}
      </div>
    </FieldWrapper>
  );
}
