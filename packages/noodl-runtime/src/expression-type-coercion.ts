/**
 * Expression Type Coercion
 *
 * Coerces expression evaluation results to match expected property types.
 * Ensures type safety when expressions are used for node properties.
 *
 * @module expression-type-coercion
 * @since 1.1.0
 */

'use strict';

/**
 * One entry of an input port's `enums`. Both forms are live in the standard library — the
 * bare string is the older one, `{ value, label }` the form the editor's dropdown needs.
 * Only `value` is compared here; `label` is presentation.
 */
type EnumOption = string | { value: string; label?: string };

/**
 * Coerce expression result to expected property type
 *
 * @example
 * coerceToType('42', 'number') // 42
 * coerceToType(true, 'string') // 'true'
 * coerceToType('#ff0000', 'color') // '#ff0000'
 */
export function coerceToType(
  value: unknown,
  expectedType: string,
  fallback?: unknown,
  enumOptions?: EnumOption[]
): unknown {
  // Handle undefined/null upfront
  if (value === undefined || value === null) {
    return fallback;
  }

  switch (expectedType) {
    case 'string':
      return String(value);

    case 'number': {
      const num = Number(value);
      // Check for NaN (includes invalid strings, NaN itself, etc.)
      return isNaN(num) ? fallback : num;
    }

    case 'boolean':
      return !!value;

    case 'color':
      return coerceToColor(value, fallback);

    case 'enum':
      return coerceToEnum(value, fallback, enumOptions);

    default:
      // Unknown types pass through as-is
      return value;
  }
}

/**
 * Coerce value to valid color string.
 *
 * Note what this does *not* accept: named CSS colours, `#RRGGBBAA`, `hsl()` and the
 * space-separated modern `rgb()` syntax all fall through to the fallback.
 */
function coerceToColor(value: unknown, fallback: unknown): unknown {
  const str = String(value);

  // Validate hex colors: #RGB or #RRGGBB (case insensitive)
  if (/^#[0-9A-Fa-f]{3}$/.test(str) || /^#[0-9A-Fa-f]{6}$/.test(str)) {
    return str;
  }

  // Validate rgb() or rgba() format
  if (/^rgba?\(/.test(str)) {
    return str;
  }

  // Invalid color format
  return fallback;
}

/** Coerce value to valid enum option. */
function coerceToEnum(value: unknown, fallback: unknown, enumOptions?: EnumOption[]): unknown {
  if (!enumOptions) {
    return fallback;
  }

  const enumVal = String(value);

  // Check if value matches any option
  const isValid = enumOptions.some((opt) => {
    if (typeof opt === 'string') {
      return opt === enumVal;
    }
    // Handle {value, label} format
    return opt.value === enumVal;
  });

  return isValid ? enumVal : fallback;
}

/**
 * Named exports, not `export =` (NOTES §29.1). `node.ts` imports `coerceToType` with ESM
 * named-import syntax, and `export =` in the imported file makes that `TS2497`. The rule
 * that comes out of it: a runtime module whose CommonJS shape is a plain namespace object
 * takes named exports; `export =` is for a module whose export *is* a single value.
 */

