/**
 * UBA-003: FieldRenderer
 *
 * Factory component — dispatches to the correct field renderer based on `field.type`.
 * Unknown field types fall back to StringField with a console warning so forward-compat
 * schemas don't hard-crash the panel.
 */

import React from 'react';

import { Field } from '../../../models/UBA/types';
import { BooleanField } from './BooleanField';
import { MultiSelectField } from './MultiSelectField';
import { NumberField } from './NumberField';
import { SecretField } from './SecretField';
import { SelectField } from './SelectField';
import { StringField } from './StringField';
import { TextField } from './TextField';
import { UrlField } from './UrlField';

export interface FieldRendererProps {
  field: Field;
  /** Current value — the type depends on field.type */
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

export function FieldRenderer({ field, value, onChange, error, disabled }: FieldRendererProps) {
  switch (field.type) {
    case 'string':
      return (
        <StringField
          field={field}
          value={value as string | undefined}
          onChange={onChange}
          error={error}
          disabled={disabled}
        />
      );

    case 'text':
      return (
        <TextField
          field={field}
          value={value as string | undefined}
          onChange={onChange}
          error={error}
          disabled={disabled}
        />
      );

    case 'number':
      return (
        <NumberField
          field={field}
          value={value as number | undefined}
          onChange={onChange as (v: number) => void}
          error={error}
          disabled={disabled}
        />
      );

    case 'boolean':
      return (
        <BooleanField
          field={field}
          value={value as boolean | undefined}
          onChange={onChange as (v: boolean) => void}
          disabled={disabled}
        />
      );

    case 'secret':
      return (
        <SecretField
          field={field}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
          error={error}
          disabled={disabled}
        />
      );

    case 'url':
      return (
        <UrlField
          field={field}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
          error={error}
          disabled={disabled}
        />
      );

    case 'select':
      return (
        <SelectField
          field={field}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
          error={error}
          disabled={disabled}
        />
      );

    case 'multi_select':
      return (
        <MultiSelectField
          field={field}
          value={value as string[] | undefined}
          onChange={onChange as (v: string[]) => void}
          error={error}
          disabled={disabled}
        />
      );

    default: {
      // Forward-compat fallback: unknown field types render as plain text
      const unknownField = field as Field & { type: string };
      console.warn(
        `[UBA] Unknown field type "${unknownField.type}" for field "${unknownField.id}" — rendering as string`
      );
      return (
        <StringField
          field={{ ...unknownField, type: 'string' } as Parameters<typeof StringField>[0]['field']}
          value={value as string | undefined}
          onChange={onChange as (v: string) => void}
          error={error}
          disabled={disabled}
        />
      );
    }
  }
}
