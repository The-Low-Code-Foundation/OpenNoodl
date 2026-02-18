/**
 * UBA-003/UBA-004: Condition evaluation utilities
 *
 * Evaluates `visible_when` and `depends_on` conditions from the UBA schema,
 * driving dynamic field/section visibility and dependency messaging.
 *
 * The `Condition` type uses an operator-based structure:
 *   { field: "section_id.field_id", operator: "=", value: "some_value" }
 *
 * Field paths support dot-notation for nested lookups (section.field).
 */

import { Condition } from './types';

// ─── Path utilities ───────────────────────────────────────────────────────────

/**
 * Reads a value from a nested object using dot-notation path.
 * Returns `undefined` if any segment is missing.
 *
 * @example getNestedValue({ auth: { type: 'bearer' } }, 'auth.type') // 'bearer'
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!obj || !path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && acc !== undefined && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Sets a value in a nested object using dot-notation path.
 * Creates intermediate objects as needed. Returns a new object (shallow copy at each level).
 */
export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.');
  const result = { ...obj };

  if (keys.length === 1) {
    result[keys[0]] = value;
    return result;
  }

  const [head, ...rest] = keys;
  const nested = (result[head] && typeof result[head] === 'object' ? result[head] : {}) as Record<string, unknown>;

  result[head] = setNestedValue(nested, rest.join('.'), value);
  return result;
}

// ─── isEmpty helper ───────────────────────────────────────────────────────────

/**
 * Returns true for null, undefined, empty string, empty array.
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// ─── Condition evaluation ─────────────────────────────────────────────────────

/**
 * Evaluates a single `Condition` object against the current form values.
 *
 * Operators:
 * - `=`          exact equality
 * - `!=`         inequality
 * - `in`         value is in the condition's value array
 * - `not_in`     value is NOT in the condition's value array
 * - `exists`     field is non-empty
 * - `not_exists` field is empty / absent
 *
 * Returns `true` if the condition is met (field should be visible/enabled).
 * Returns `true` if `condition` is undefined (no restriction).
 */
export function evaluateCondition(condition: Condition | undefined, values: Record<string, unknown>): boolean {
  if (!condition) return true;

  const fieldValue = getNestedValue(values, condition.field);

  switch (condition.operator) {
    case '=':
      return fieldValue === condition.value;

    case '!=':
      return fieldValue !== condition.value;

    case 'in': {
      const allowed = condition.value;
      if (!Array.isArray(allowed)) return false;
      return allowed.includes(fieldValue as string);
    }

    case 'not_in': {
      const disallowed = condition.value;
      if (!Array.isArray(disallowed)) return true;
      return !disallowed.includes(fieldValue as string);
    }

    case 'exists':
      return !isEmpty(fieldValue);

    case 'not_exists':
      return isEmpty(fieldValue);

    default:
      // Unknown operator — don't block visibility
      return true;
  }
}
