/**
 * UBA-003: FieldWrapper
 *
 * Common shell for all UBA field renderers.
 * Renders: label, required indicator, description, children (the input),
 * error message, warning message, and an optional help link.
 */

import React from 'react';

import { BaseField } from '../../../models/UBA/types';
import css from './fields.module.scss';

export interface FieldWrapperProps {
  field: BaseField;
  error?: string;
  warning?: string;
  children: React.ReactNode;
}

export function FieldWrapper({ field, error, warning, children }: FieldWrapperProps) {
  return (
    <div className={css.fieldWrapper} data-field-id={field.id}>
      <label className={css.fieldLabel} htmlFor={field.id}>
        {field.name}
        {field.required && <span className={css.required}>*</span>}
      </label>

      {field.description && <p className={css.fieldDescription}>{field.description}</p>}

      {children}

      {error && <p className={css.fieldError}>{error}</p>}
      {warning && !error && <p className={css.fieldWarning}>{warning}</p>}

      {field.ui?.help_link && (
        <a href={field.ui.help_link} target="_blank" rel="noreferrer" className={css.helpLink}>
          Learn more ↗
        </a>
      )}
    </div>
  );
}
