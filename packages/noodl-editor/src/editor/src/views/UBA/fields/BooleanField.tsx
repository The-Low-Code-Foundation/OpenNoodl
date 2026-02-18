/**
 * UBA-003: BooleanField
 * Toggle switch with an optional label beside it.
 * Uses CSS :has() for checked/disabled track styling — see fields.module.scss.
 */

import React from 'react';

import { BooleanField as BooleanFieldType } from '../../../models/UBA/types';
import css from './fields.module.scss';
import { FieldWrapper } from './FieldWrapper';

export interface BooleanFieldProps {
  field: BooleanFieldType;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function BooleanField({ field, value, onChange, disabled }: BooleanFieldProps) {
  const checked = value ?? field.default ?? false;

  return (
    <FieldWrapper field={field}>
      <label className={css.booleanWrapper}>
        <span className={css.toggleInput}>
          <input
            id={field.id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
          <span className={css.toggleTrack}>
            <span className={css.toggleThumb} />
          </span>
        </span>

        {field.toggle_label && <span className={css.toggleLabel}>{field.toggle_label}</span>}
      </label>
    </FieldWrapper>
  );
}
