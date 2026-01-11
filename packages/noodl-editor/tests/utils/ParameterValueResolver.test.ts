/**
 * Unit tests for ParameterValueResolver
 *
 * Tests the resolution of parameter values from storage (primitives or expression objects)
 * to display/runtime values based on context.
 *
 * @module noodl-editor/tests/utils
 */

import { describe, it, expect } from '@jest/globals';

import { createExpressionParameter, ExpressionParameter } from '../../src/editor/src/models/ExpressionParameter';
import { ParameterValueResolver, ValueContext } from '../../src/editor/src/utils/ParameterValueResolver';

describe('ParameterValueResolver', () => {
  describe('resolve()', () => {
    describe('with primitive values', () => {
      it('should return string values as-is', () => {
        expect(ParameterValueResolver.resolve('hello', ValueContext.Display)).toBe('hello');
        expect(ParameterValueResolver.resolve('', ValueContext.Display)).toBe('');
        expect(ParameterValueResolver.resolve('123', ValueContext.Display)).toBe('123');
      });

      it('should return number values as-is', () => {
        expect(ParameterValueResolver.resolve(42, ValueContext.Display)).toBe(42);
        expect(ParameterValueResolver.resolve(0, ValueContext.Display)).toBe(0);
        expect(ParameterValueResolver.resolve(-42.5, ValueContext.Display)).toBe(-42.5);
      });

      it('should return boolean values as-is', () => {
        expect(ParameterValueResolver.resolve(true, ValueContext.Display)).toBe(true);
        expect(ParameterValueResolver.resolve(false, ValueContext.Display)).toBe(false);
      });

      it('should return undefined as-is', () => {
        expect(ParameterValueResolver.resolve(undefined, ValueContext.Display)).toBe(undefined);
      });

      it('should handle null', () => {
        expect(ParameterValueResolver.resolve(null, ValueContext.Display)).toBe(null);
      });
    });

    describe('with expression parameters', () => {
      it('should extract fallback from expression parameter in Display context', () => {
        const exprParam = createExpressionParameter('Variables.x', 'default', 1);
        expect(ParameterValueResolver.resolve(exprParam, ValueContext.Display)).toBe('default');
      });

      it('should extract fallback from expression parameter in Runtime context', () => {
        const exprParam = createExpressionParameter('Variables.x', 'default', 1);
        expect(ParameterValueResolver.resolve(exprParam, ValueContext.Runtime)).toBe('default');
      });

      it('should return full object in Serialization context', () => {
        const exprParam = createExpressionParameter('Variables.x', 'default', 1);
        const result = ParameterValueResolver.resolve(exprParam, ValueContext.Serialization);
        expect(result).toBe(exprParam);
        expect((result as ExpressionParameter).mode).toBe('expression');
      });

      it('should handle expression parameter with undefined fallback', () => {
        const exprParam = createExpressionParameter('Variables.x', undefined, 1);
        expect(ParameterValueResolver.resolve(exprParam, ValueContext.Display)).toBe('');
      });

      it('should handle expression parameter with numeric fallback', () => {
        const exprParam = createExpressionParameter('Variables.count', 42, 1);
        expect(ParameterValueResolver.resolve(exprParam, ValueContext.Display)).toBe(42);
      });

      it('should handle expression parameter with boolean fallback', () => {
        const exprParam = createExpressionParameter('Variables.flag', true, 1);
        expect(ParameterValueResolver.resolve(exprParam, ValueContext.Display)).toBe(true);
      });

      it('should handle expression parameter with empty string fallback', () => {
        const exprParam = createExpressionParameter('Variables.x', '', 1);
        expect(ParameterValueResolver.resolve(exprParam, ValueContext.Display)).toBe('');
      });
    });

    describe('edge cases', () => {
      it('should handle objects that are not expression parameters', () => {
        const regularObj = { foo: 'bar' };
        // Should return as-is since it's not an expression parameter
        expect(ParameterValueResolver.resolve(regularObj, ValueContext.Display)).toBe(regularObj);
      });

      it('should default to fallback for unknown context', () => {
        const exprParam = createExpressionParameter('Variables.x', 'default', 1);
        // Cast to any to test invalid context
        expect(ParameterValueResolver.resolve(exprParam, 'invalid' as any)).toBe('default');
      });
    });
  });

  describe('toString()', () => {
    describe('with primitive values', () => {
      it('should convert string to string', () => {
        expect(ParameterValueResolver.toString('hello')).toBe('hello');
        expect(ParameterValueResolver.toString('')).toBe('');
      });

      it('should convert number to string', () => {
        expect(ParameterValueResolver.toString(42)).toBe('42');
        expect(ParameterValueResolver.toString(0)).toBe('0');
        expect(ParameterValueResolver.toString(-42.5)).toBe('-42.5');
      });

      it('should convert boolean to string', () => {
        expect(ParameterValueResolver.toString(true)).toBe('true');
        expect(ParameterValueResolver.toString(false)).toBe('false');
      });

      it('should convert undefined to empty string', () => {
        expect(ParameterValueResolver.toString(undefined)).toBe('');
      });

      it('should convert null to empty string', () => {
        expect(ParameterValueResolver.toString(null)).toBe('');
      });
    });

    describe('with expression parameters', () => {
      it('should extract fallback as string from expression parameter', () => {
        const exprParam = createExpressionParameter('Variables.x', 'test', 1);
        expect(ParameterValueResolver.toString(exprParam)).toBe('test');
      });

      it('should convert numeric fallback to string', () => {
        const exprParam = createExpressionParameter('Variables.count', 42, 1);
        expect(ParameterValueResolver.toString(exprParam)).toBe('42');
      });

      it('should convert boolean fallback to string', () => {
        const exprParam = createExpressionParameter('Variables.flag', true, 1);
        expect(ParameterValueResolver.toString(exprParam)).toBe('true');
      });

      it('should handle expression parameter with undefined fallback', () => {
        const exprParam = createExpressionParameter('Variables.x', undefined, 1);
        expect(ParameterValueResolver.toString(exprParam)).toBe('');
      });

      it('should handle expression parameter with null fallback', () => {
        const exprParam = createExpressionParameter('Variables.x', null, 1);
        expect(ParameterValueResolver.toString(exprParam)).toBe('');
      });
    });

    describe('edge cases', () => {
      it('should handle objects that are not expression parameters', () => {
        const regularObj = { foo: 'bar' };
        // Should return empty string for safety (defensive behavior)
        expect(ParameterValueResolver.toString(regularObj)).toBe('');
      });

      it('should handle arrays', () => {
        expect(ParameterValueResolver.toString([1, 2, 3])).toBe('');
      });
    });
  });

  describe('toNumber()', () => {
    describe('with primitive values', () => {
      it('should return number as-is', () => {
        expect(ParameterValueResolver.toNumber(42)).toBe(42);
        expect(ParameterValueResolver.toNumber(0)).toBe(0);
        expect(ParameterValueResolver.toNumber(-42.5)).toBe(-42.5);
      });

      it('should convert numeric string to number', () => {
        expect(ParameterValueResolver.toNumber('42')).toBe(42);
        expect(ParameterValueResolver.toNumber('0')).toBe(0);
        expect(ParameterValueResolver.toNumber('-42.5')).toBe(-42.5);
      });

      it('should return undefined for non-numeric string', () => {
        expect(ParameterValueResolver.toNumber('hello')).toBe(undefined);
        expect(ParameterValueResolver.toNumber('not a number')).toBe(undefined);
      });

      it('should return undefined for undefined', () => {
        expect(ParameterValueResolver.toNumber(undefined)).toBe(undefined);
      });

      it('should return undefined for null', () => {
        expect(ParameterValueResolver.toNumber(null)).toBe(undefined);
      });

      it('should convert boolean to number', () => {
        expect(ParameterValueResolver.toNumber(true)).toBe(1);
        expect(ParameterValueResolver.toNumber(false)).toBe(0);
      });
    });

    describe('with expression parameters', () => {
      it('should extract numeric fallback from expression parameter', () => {
        const exprParam = createExpressionParameter('Variables.count', 42, 1);
        expect(ParameterValueResolver.toNumber(exprParam)).toBe(42);
      });

      it('should convert string fallback to number', () => {
        const exprParam = createExpressionParameter('Variables.count', '42', 1);
        expect(ParameterValueResolver.toNumber(exprParam)).toBe(42);
      });

      it('should return undefined for non-numeric fallback', () => {
        const exprParam = createExpressionParameter('Variables.text', 'hello', 1);
        expect(ParameterValueResolver.toNumber(exprParam)).toBe(undefined);
      });

      it('should handle expression parameter with undefined fallback', () => {
        const exprParam = createExpressionParameter('Variables.x', undefined, 1);
        expect(ParameterValueResolver.toNumber(exprParam)).toBe(undefined);
      });

      it('should handle expression parameter with null fallback', () => {
        const exprParam = createExpressionParameter('Variables.x', null, 1);
        expect(ParameterValueResolver.toNumber(exprParam)).toBe(undefined);
      });
    });

    describe('edge cases', () => {
      it('should handle objects that are not expression parameters', () => {
        const regularObj = { foo: 'bar' };
        expect(ParameterValueResolver.toNumber(regularObj)).toBe(undefined);
      });

      it('should handle arrays', () => {
        expect(ParameterValueResolver.toNumber([1, 2, 3])).toBe(undefined);
      });

      it('should handle empty string', () => {
        expect(ParameterValueResolver.toNumber('')).toBe(0); // Empty string converts to 0
      });

      it('should handle whitespace string', () => {
        expect(ParameterValueResolver.toNumber('   ')).toBe(0); // Whitespace converts to 0
      });
    });
  });

  describe('toBoolean()', () => {
    describe('with primitive values', () => {
      it('should return boolean as-is', () => {
        expect(ParameterValueResolver.toBoolean(true)).toBe(true);
        expect(ParameterValueResolver.toBoolean(false)).toBe(false);
      });

      it('should convert truthy strings to true', () => {
        expect(ParameterValueResolver.toBoolean('hello')).toBe(true);
        expect(ParameterValueResolver.toBoolean('0')).toBe(true); // Non-empty string is truthy
        expect(ParameterValueResolver.toBoolean('false')).toBe(true); // Non-empty string is truthy
      });

      it('should convert empty string to false', () => {
        expect(ParameterValueResolver.toBoolean('')).toBe(false);
      });

      it('should convert numbers using truthiness', () => {
        expect(ParameterValueResolver.toBoolean(1)).toBe(true);
        expect(ParameterValueResolver.toBoolean(42)).toBe(true);
        expect(ParameterValueResolver.toBoolean(0)).toBe(false);
        expect(ParameterValueResolver.toBoolean(-1)).toBe(true);
      });

      it('should convert undefined to false', () => {
        expect(ParameterValueResolver.toBoolean(undefined)).toBe(false);
      });

      it('should convert null to false', () => {
        expect(ParameterValueResolver.toBoolean(null)).toBe(false);
      });
    });

    describe('with expression parameters', () => {
      it('should extract boolean fallback from expression parameter', () => {
        const exprParam = createExpressionParameter('Variables.flag', true, 1);
        expect(ParameterValueResolver.toBoolean(exprParam)).toBe(true);
      });

      it('should convert string fallback to boolean', () => {
        const exprParamTruthy = createExpressionParameter('Variables.text', 'hello', 1);
        expect(ParameterValueResolver.toBoolean(exprParamTruthy)).toBe(true);

        const exprParamFalsy = createExpressionParameter('Variables.text', '', 1);
        expect(ParameterValueResolver.toBoolean(exprParamFalsy)).toBe(false);
      });

      it('should convert numeric fallback to boolean', () => {
        const exprParamTruthy = createExpressionParameter('Variables.count', 42, 1);
        expect(ParameterValueResolver.toBoolean(exprParamTruthy)).toBe(true);

        const exprParamFalsy = createExpressionParameter('Variables.count', 0, 1);
        expect(ParameterValueResolver.toBoolean(exprParamFalsy)).toBe(false);
      });

      it('should handle expression parameter with undefined fallback', () => {
        const exprParam = createExpressionParameter('Variables.x', undefined, 1);
        expect(ParameterValueResolver.toBoolean(exprParam)).toBe(false);
      });

      it('should handle expression parameter with null fallback', () => {
        const exprParam = createExpressionParameter('Variables.x', null, 1);
        expect(ParameterValueResolver.toBoolean(exprParam)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle objects that are not expression parameters', () => {
        const regularObj = { foo: 'bar' };
        // Non-expression objects should return false (defensive behavior)
        expect(ParameterValueResolver.toBoolean(regularObj)).toBe(false);
      });

      it('should handle arrays', () => {
        expect(ParameterValueResolver.toBoolean([1, 2, 3])).toBe(false);
      });
    });
  });

  describe('isExpression()', () => {
    it('should return true for expression parameters', () => {
      const exprParam = createExpressionParameter('Variables.x', 'default', 1);
      expect(ParameterValueResolver.isExpression(exprParam)).toBe(true);
    });

    it('should return false for primitive values', () => {
      expect(ParameterValueResolver.isExpression('hello')).toBe(false);
      expect(ParameterValueResolver.isExpression(42)).toBe(false);
      expect(ParameterValueResolver.isExpression(true)).toBe(false);
      expect(ParameterValueResolver.isExpression(undefined)).toBe(false);
      expect(ParameterValueResolver.isExpression(null)).toBe(false);
    });

    it('should return false for regular objects', () => {
      const regularObj = { foo: 'bar' };
      expect(ParameterValueResolver.isExpression(regularObj)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(ParameterValueResolver.isExpression([1, 2, 3])).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle converting expression parameter through all type conversions', () => {
      const exprParam = createExpressionParameter('Variables.count', 42, 1);

      expect(ParameterValueResolver.toString(exprParam)).toBe('42');
      expect(ParameterValueResolver.toNumber(exprParam)).toBe(42);
      expect(ParameterValueResolver.toBoolean(exprParam)).toBe(true);
      expect(ParameterValueResolver.isExpression(exprParam)).toBe(true);
    });

    it('should handle canvas rendering scenario (text.split prevention)', () => {
      // This is the actual bug we're fixing - canvas tries to call .split() on a parameter
      const exprParam = createExpressionParameter('Variables.text', 'Hello\nWorld', 1);

      // Before fix: this would return the object, causing text.split() to crash
      // After fix: this returns a string that can be safely split
      const text = ParameterValueResolver.toString(exprParam);
      expect(typeof text).toBe('string');
      expect(() => text.split('\n')).not.toThrow();
      expect(text.split('\n')).toEqual(['Hello', 'World']);
    });

    it('should handle property panel display scenario', () => {
      // Property panel needs to show fallback value while user edits expression
      const exprParam = createExpressionParameter('2 + 2', '4', 1);

      const displayValue = ParameterValueResolver.resolve(exprParam, ValueContext.Display);
      expect(displayValue).toBe('4');
    });

    it('should handle serialization scenario', () => {
      // When saving, we need the full object preserved
      const exprParam = createExpressionParameter('Variables.x', 'default', 1);

      const serialized = ParameterValueResolver.resolve(exprParam, ValueContext.Serialization);
      expect(serialized).toBe(exprParam);
      expect((serialized as ExpressionParameter).expression).toBe('Variables.x');
    });
  });
});
