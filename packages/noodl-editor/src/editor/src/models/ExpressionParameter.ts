/**
 * Expression Parameter Types
 *
 * Defines types and helper functions for expression-based property values.
 * Allows properties to be set to JavaScript expressions that evaluate at runtime.
 *
 * @module ExpressionParameter
 * @since 1.1.0
 */

/**
 * An expression parameter stores a JavaScript expression that evaluates at runtime
 */
export interface ExpressionParameter {
  /** Marker to identify expression parameters */
  mode: 'expression';

  /** The JavaScript expression to evaluate */
  expression: string;

  /** Fallback value if expression fails or is invalid */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fallback?: any;

  /** Expression system version for future migrations */
  version?: number;
}

/**
 * A parameter can be a simple value or an expression
 * Note: any is intentional - parameters can be any JSON-serializable value
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParameterValue = any | ExpressionParameter;

/**
 * Type guard to check if a parameter value is an expression
 *
 * @param value - The parameter value to check
 * @returns True if value is an ExpressionParameter
 *
 * @example
 * ```typescript
 * const param = node.getParameter('marginLeft');
 * if (isExpressionParameter(param)) {
 *   console.log('Expression:', param.expression);
 * } else {
 *   console.log('Fixed value:', param);
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isExpressionParameter(value: any): value is ExpressionParameter {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    value.mode === 'expression' &&
    typeof value.expression === 'string'
  );
}

/**
 * Get the display value for a parameter (for UI rendering)
 *
 * - For expression parameters: returns the expression string
 * - For simple values: returns the value as-is
 *
 * @param value - The parameter value
 * @returns Display value (expression string or simple value)
 *
 * @example
 * ```typescript
 * const expr = { mode: 'expression', expression: 'Variables.x * 2', fallback: 0 };
 * getParameterDisplayValue(expr); // Returns: 'Variables.x * 2'
 * getParameterDisplayValue(42);    // Returns: 42
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getParameterDisplayValue(value: ParameterValue): any {
  if (isExpressionParameter(value)) {
    return value.expression;
  }
  return value;
}

/**
 * Get the actual value for a parameter (unwraps expression fallback)
 *
 * - For expression parameters: returns the fallback value
 * - For simple values: returns the value as-is
 *
 * This is useful when you need a concrete value for initialization
 * before the expression can be evaluated.
 *
 * @param value - The parameter value
 * @returns Actual value (fallback or simple value)
 *
 * @example
 * ```typescript
 * const expr = { mode: 'expression', expression: 'Variables.x', fallback: 100 };
 * getParameterActualValue(expr); // Returns: 100
 * getParameterActualValue(42);    // Returns: 42
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getParameterActualValue(value: ParameterValue): any {
  if (isExpressionParameter(value)) {
    return value.fallback;
  }
  return value;
}

/**
 * Create an expression parameter
 *
 * @param expression - The JavaScript expression string
 * @param fallback - Optional fallback value if expression fails
 * @param version - Expression system version (default: 1)
 * @returns A new ExpressionParameter object
 *
 * @example
 * ```typescript
 * // Simple expression with fallback
 * const param = createExpressionParameter('Variables.count', 0);
 *
 * // Complex expression
 * const param = createExpressionParameter(
 *   'Variables.isAdmin ? "Admin" : "User"',
 *   'User'
 * );
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createExpressionParameter(
  expression: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fallback?: any,
  version: number = 1
): ExpressionParameter {
  return {
    mode: 'expression',
    expression,
    fallback,
    version
  };
}

/**
 * Convert a value to a parameter (for consistency)
 *
 * - Expression parameters are returned as-is
 * - Simple values are returned as-is
 *
 * This is mainly for type safety and consistency in parameter handling.
 *
 * @param value - The value to convert
 * @returns The value as a ParameterValue
 *
 * @example
 * ```typescript
 * const expr = createExpressionParameter('Variables.x');
 * toParameter(expr); // Returns: expr (unchanged)
 * toParameter(42);    // Returns: 42 (unchanged)
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toParameter(value: any): ParameterValue {
  return value;
}
