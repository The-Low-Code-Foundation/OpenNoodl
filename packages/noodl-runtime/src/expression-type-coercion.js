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
 * Coerce expression result to expected property type
 *
 * @param {*} value - The value from expression evaluation
 * @param {string} expectedType - The expected type (string, number, boolean, color, enum, etc.)
 * @param {*} [fallback] - Fallback value if coercion fails
 * @param {Array} [enumOptions] - Valid options for enum type
 * @returns {*} Coerced value or fallback
 *
 * @example
 * coerceToType('42', 'number') // 42
 * coerceToType(true, 'string') // 'true'
 * coerceToType('#ff0000', 'color') // '#ff0000'
 */
function coerceToType(value, expectedType, fallback, enumOptions) {
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
 * Coerce value to valid color string
 *
 * @param {*} value - The value to coerce
 * @param {*} fallback - Fallback color
 * @returns {string} Valid color or fallback
 */
function coerceToColor(value, fallback) {
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

/**
 * Coerce value to valid enum option
 *
 * @param {*} value - The value to coerce
 * @param {*} fallback - Fallback enum value
 * @param {Array} enumOptions - Valid enum options (strings or {value, label} objects)
 * @returns {string} Valid enum value or fallback
 */
function coerceToEnum(value, fallback, enumOptions) {
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

module.exports = {
  coerceToType
};
