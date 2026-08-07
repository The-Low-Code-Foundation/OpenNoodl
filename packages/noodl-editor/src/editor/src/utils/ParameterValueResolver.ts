/**
 * ParameterValueResolver
 *
 * Centralized utility for resolving parameter values from storage to their display/runtime values.
 * Handles the conversion of expression parameter objects to primitive values based on context.
 *
 * This is necessary because parameters can be stored as either:
 * 1. Primitive values (string, number, boolean)
 * 2. Expression parameter objects: { mode: 'expression', expression: '...', fallback: '...', version: 1 }
 *
 * Consumers need different values based on their context:
 * - Display (UI, canvas): Use fallback value
 * - Runtime: Use evaluated expression (handled separately by runtime)
 * - Serialization: Use raw value as-is
 *
 * @module noodl-editor/utils
 * @since TASK-006B
 */

import { isExpressionParameter, ExpressionParameter } from '@noodl-models/ExpressionParameter';

/**
 * Context in which a parameter value is being used
 */
export enum ValueContext {
  /**
   * Display context - for UI rendering (property panel, canvas)
   * Returns the fallback value from expression parameters
   */
  Display = 'display',

  /**
   * Runtime context - for runtime evaluation
   * Returns the fallback value (actual evaluation happens in runtime)
   */
  Runtime = 'runtime',

  /**
   * Serialization context - for saving/loading
   * Returns the raw value unchanged
   */
  Serialization = 'serialization'
}

/**
 * Type for primitive parameter values
 */
export type PrimitiveValue = string | number | boolean | undefined;

/**
 * ParameterValueResolver class
 *
 * Provides static methods to safely extract primitive values from parameters
 * that may be either primitives or expression parameter objects.
 */
export class ParameterValueResolver {
  /**
   * Resolves a parameter value to a primitive based on context.
   *
   * @param paramValue - The raw parameter value (could be primitive or expression object)
   * @param context - The context in which the value is being used
   * @returns A primitive value appropriate for the context
   *
   * @example
   * ```typescript
   * // Primitive value passes through
   * resolve('hello', ValueContext.Display) // => 'hello'
   *
   * // Expression parameter returns fallback
   * const expr = { mode: 'expression', expression: 'Variables.x', fallback: 'default', version: 1 };
   * resolve(expr, ValueContext.Display) // => 'default'
   * ```
   */
  static resolve(paramValue: unknown, context: ValueContext): PrimitiveValue | ExpressionParameter {
    // If not an expression parameter, return as-is (assuming it's a primitive)
    if (!isExpressionParameter(paramValue)) {
      return paramValue as PrimitiveValue;
    }

    // Handle expression parameters based on context
    switch (context) {
      case ValueContext.Display:
        // For display contexts (UI, canvas), use the fallback value
        return paramValue.fallback ?? '';

      case ValueContext.Runtime:
        // For runtime, return fallback (actual evaluation happens in node runtime)
        // This prevents display code from trying to evaluate expressions
        return paramValue.fallback ?? '';

      case ValueContext.Serialization:
        // For serialization, return the whole object unchanged
        return paramValue;

      default:
        // Default to fallback value for safety
        return paramValue.fallback ?? '';
    }
  }

  /**
   * Safely converts any parameter value to a string for display.
   * Always returns a string, never an object.
   *
   * @param paramValue - The raw parameter value
   * @returns A string representation safe for display
   *
   * @example
   * ```typescript
   * toString('hello') // => 'hello'
   * toString(42) // => '42'
   * toString(null) // => ''
   * toString(undefined) // => ''
   * toString({ mode: 'expression', expression: '', fallback: 'test', version: 1 }) // => 'test'
   * ```
   */
  static toString(paramValue: unknown): string {
    const resolved = this.resolve(paramValue, ValueContext.Display);

    // If resolved is still an object (shouldn't happen, but defensive)
    if (typeof resolved === 'object' && resolved !== null) {
      return '';
    }

    return String(resolved ?? '');
  }

  /**
   * Safely converts any parameter value to a number for display.
   * Returns undefined if the value cannot be converted to a valid number.
   *
   * @param paramValue - The raw parameter value
   * @returns A number, or undefined if conversion fails
   *
   * @example
   * ```typescript
   * toNumber(42) // => 42
   * toNumber('42') // => 42
   * toNumber('hello') // => undefined
   * toNumber(null) // => undefined
   * toNumber({ mode: 'expression', expression: '', fallback: 123, version: 1 }) // => 123
   * ```
   */
  static toNumber(paramValue: unknown): number | undefined {
    const resolved = this.resolve(paramValue, ValueContext.Display);

    // If resolved is still an object (shouldn't happen, but defensive)
    if (typeof resolved === 'object' && resolved !== null) {
      return undefined;
    }

    // An absent value is not zero — Number(null) is 0, which would silently turn
    // "no value" into a real 0. resolve() also maps a null/undefined expression
    // fallback to '', so the raw value has to be checked rather than `resolved`.
    const rawValue = isExpressionParameter(paramValue) ? paramValue.fallback : paramValue;
    if (rawValue === null || rawValue === undefined) {
      return undefined;
    }

    const num = Number(resolved);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Safely converts any parameter value to a boolean for display.
   * Uses JavaScript truthiness rules.
   *
   * @param paramValue - The raw parameter value
   * @returns A boolean value
   *
   * @example
   * ```typescript
   * toBoolean(true) // => true
   * toBoolean('hello') // => true
   * toBoolean('') // => false
   * toBoolean(0) // => false
   * toBoolean({ mode: 'expression', expression: '', fallback: true, version: 1 }) // => true
   * ```
   */
  static toBoolean(paramValue: unknown): boolean {
    const resolved = this.resolve(paramValue, ValueContext.Display);

    // If resolved is still an object (shouldn't happen, but defensive)
    if (typeof resolved === 'object' && resolved !== null) {
      return false;
    }

    return Boolean(resolved);
  }

  /**
   * Checks if a parameter value is an expression parameter.
   * Convenience method that delegates to the ExpressionParameter module.
   *
   * @param paramValue - The value to check
   * @returns True if the value is an expression parameter object
   */
  static isExpression(paramValue: unknown): paramValue is ExpressionParameter {
    return isExpressionParameter(paramValue);
  }
}
