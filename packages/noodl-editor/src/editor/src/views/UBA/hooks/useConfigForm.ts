/**
 * UBA-004: useConfigForm
 *
 * Form state management for the UBA ConfigPanel.
 * Tracks field values, validation errors, and dirty state.
 * Values are keyed by dot-notation paths: "section_id.field_id"
 */

import { useCallback, useMemo, useState } from 'react';

import { getNestedValue, setNestedValue } from '../../../models/UBA/Conditions';
import { UBASchema } from '../../../models/UBA/types';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Flat map of dot-path → value */
export type FormValues = Record<string, unknown>;

/** Flat map of dot-path → error message */
export type FormErrors = Record<string, string>;

export interface ConfigFormState {
  /** Current flat-path values, e.g. { "auth.api_key": "abc", "connection.url": "https://..." } */
  values: FormValues;
  /** Validation errors keyed by the same flat paths */
  errors: FormErrors;
  /** True if values differ from initialValues */
  isDirty: boolean;
  /** Set a single field value (clears its error) */
  setValue: (path: string, value: unknown) => void;
  /** Programmatically set a field error (used by ConfigPanel after failed saves) */
  setFieldError: (path: string, error: string) => void;
  /** Bulk-set errors (used by form-level validation before save) */
  setErrors: (errors: FormErrors) => void;
  /** Reset to initial values and clear all errors */
  reset: () => void;
}

// ─── Initial value builder ────────────────────────────────────────────────────

/**
 * Flattens a UBASchema's default values and merges with provided values.
 * Priority: provided > schema defaults > empty
 *
 * Returns a flat-path map, e.g. { "auth.api_key": "", "connection.url": "" }
 */
function buildInitialValues(schema: UBASchema, provided: Record<string, unknown> = {}): FormValues {
  const values: FormValues = {};

  for (const section of schema.sections) {
    for (const field of section.fields) {
      const path = `${section.id}.${field.id}`;

      // Check provided (supports both flat-path and nested object)
      const providedFlat = provided[path];
      const providedNested = getNestedValue(provided as Record<string, unknown>, path);
      const providedValue = providedFlat !== undefined ? providedFlat : providedNested;

      if (providedValue !== undefined) {
        values[path] = providedValue;
      } else if ('default' in field && field.default !== undefined) {
        values[path] = field.default;
      } else {
        // Set typed empty values so controlled inputs don't flip uncontrolled→controlled
        switch (field.type) {
          case 'boolean':
            values[path] = false;
            break;
          case 'multi_select':
            values[path] = [];
            break;
          case 'number':
            values[path] = undefined;
            break;
          default:
            values[path] = '';
        }
      }
    }
  }

  return values;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConfigForm(schema: UBASchema, initialValues?: Record<string, unknown>): ConfigFormState {
  // Initial values computed once at mount — reset() handles subsequent re-init
  const initial = useMemo(() => buildInitialValues(schema, initialValues), []); // intentional mount-only

  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrorsState] = useState<FormErrors>({});

  const isDirty = useMemo(() => {
    for (const key of Object.keys(initial)) {
      if (JSON.stringify(values[key]) !== JSON.stringify(initial[key])) {
        return true;
      }
    }
    // Also catch new keys not in initial
    for (const key of Object.keys(values)) {
      if (!(key in initial) && values[key] !== undefined && values[key] !== '') {
        return true;
      }
    }
    return false;
  }, [values, initial]);

  const setValue = useCallback((path: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [path]: value }));
    // Clear error on change
    setErrorsState((prev) => {
      if (!prev[path]) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const setFieldError = useCallback((path: string, error: string) => {
    setErrorsState((prev) => ({ ...prev, [path]: error }));
  }, []);

  const setErrors = useCallback((newErrors: FormErrors) => {
    setErrorsState(newErrors);
  }, []);

  const reset = useCallback(() => {
    const fresh = buildInitialValues(schema, initialValues);
    setValues(fresh);
    setErrorsState({});
  }, [schema, initialValues]);

  return { values, errors, isDirty, setValue, setFieldError, setErrors, reset };
}

// ─── Helpers (used by ConfigPanel before save) ─────────────────────────────────

/**
 * Performs synchronous required-field validation.
 * Returns a flat-path → error map (empty = all valid).
 */
export function validateRequired(schema: UBASchema, values: FormValues): FormErrors {
  const errors: FormErrors = {};

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (!field.required) continue;
      const path = `${section.id}.${field.id}`;
      const value = values[path];
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        errors[path] = `${field.name} is required`;
      }
    }
  }

  return errors;
}

/**
 * Converts flat-path values map back to a nested object for sending to backends.
 * e.g. { "auth.api_key": "abc" } → { auth: { api_key: "abc" } }
 */
export function flatToNested(values: FormValues): Record<string, unknown> {
  let result: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(values)) {
    result = setNestedValue(result, path, value);
  }
  return result;
}
