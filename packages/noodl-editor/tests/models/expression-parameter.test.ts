/**
 * Expression Parameter Types Tests
 *
 * Tests type definitions and helper functions for expression-based parameters
 */

import {
  ExpressionParameter,
  isExpressionParameter,
  getParameterDisplayValue,
  getParameterActualValue,
  createExpressionParameter,
  toParameter
} from '../../src/editor/src/models/ExpressionParameter';

describe('Expression Parameter Types', () => {
  describe('isExpressionParameter', () => {
    it('identifies expression parameters', () => {
      const expr: ExpressionParameter = {
        mode: 'expression',
        expression: 'Variables.x + 1',
        fallback: 0
      };
      expect(isExpressionParameter(expr)).toBe(true);
    });

    it('identifies expression without fallback', () => {
      const expr: ExpressionParameter = {
        mode: 'expression',
        expression: 'Variables.x'
      };
      expect(isExpressionParameter(expr)).toBe(true);
    });

    it('rejects simple values', () => {
      expect(isExpressionParameter(42)).toBe(false);
      expect(isExpressionParameter('hello')).toBe(false);
      expect(isExpressionParameter(true)).toBe(false);
      expect(isExpressionParameter(null)).toBe(false);
      expect(isExpressionParameter(undefined)).toBe(false);
    });

    it('rejects objects without mode', () => {
      expect(isExpressionParameter({ expression: 'test' })).toBe(false);
    });

    it('rejects objects with wrong mode', () => {
      expect(isExpressionParameter({ mode: 'fixed', value: 42 })).toBe(false);
    });

    it('rejects objects without expression', () => {
      expect(isExpressionParameter({ mode: 'expression' })).toBe(false);
    });

    it('rejects objects with non-string expression', () => {
      expect(isExpressionParameter({ mode: 'expression', expression: 42 })).toBe(false);
    });
  });

  describe('getParameterDisplayValue', () => {
    it('returns expression string for expression parameters', () => {
      const expr: ExpressionParameter = {
        mode: 'expression',
        expression: 'Variables.x * 2',
        fallback: 0
      };
      expect(getParameterDisplayValue(expr)).toBe('Variables.x * 2');
    });

    it('returns expression even without fallback', () => {
      const expr: ExpressionParameter = {
        mode: 'expression',
        expression: 'Variables.count'
      };
      expect(getParameterDisplayValue(expr)).toBe('Variables.count');
    });

    it('returns value as-is for simple values', () => {
      expect(getParameterDisplayValue(42)).toBe(42);
      expect(getParameterDisplayValue('hello')).toBe('hello');
      expect(getParameterDisplayValue(true)).toBe(true);
      expect(getParameterDisplayValue(null)).toBe(null);
      expect(getParameterDisplayValue(undefined)).toBe(undefined);
    });

    it('returns value as-is for objects', () => {
      const obj = { a: 1, b: 2 };
      expect(getParameterDisplayValue(obj)).toBe(obj);
    });
  });

  describe('getParameterActualValue', () => {
    it('returns fallback for expression parameters', () => {
      const expr: ExpressionParameter = {
        mode: 'expression',
        expression: 'Variables.x * 2',
        fallback: 100
      };
      expect(getParameterActualValue(expr)).toBe(100);
    });

    it('returns undefined for expression without fallback', () => {
      const expr: ExpressionParameter = {
        mode: 'expression',
        expression: 'Variables.x'
      };
      expect(getParameterActualValue(expr)).toBeUndefined();
    });

    it('returns value as-is for simple values', () => {
      expect(getParameterActualValue(42)).toBe(42);
      expect(getParameterActualValue('hello')).toBe('hello');
      expect(getParameterActualValue(false)).toBe(false);
    });
  });

  describe('createExpressionParameter', () => {
    it('creates expression parameter with all fields', () => {
      const expr = createExpressionParameter('Variables.count', 0, 2);
      expect(expr.mode).toBe('expression');
      expect(expr.expression).toBe('Variables.count');
      expect(expr.fallback).toBe(0);
      expect(expr.version).toBe(2);
    });

    it('uses default version if not provided', () => {
      const expr = createExpressionParameter('Variables.x', 10);
      expect(expr.version).toBe(1);
    });

    it('allows undefined fallback', () => {
      const expr = createExpressionParameter('Variables.x');
      expect(expr.fallback).toBeUndefined();
      expect(expr.version).toBe(1);
    });

    it('allows null fallback', () => {
      const expr = createExpressionParameter('Variables.x', null);
      expect(expr.fallback).toBe(null);
    });

    it('allows zero as fallback', () => {
      const expr = createExpressionParameter('Variables.x', 0);
      expect(expr.fallback).toBe(0);
    });

    it('allows empty string as fallback', () => {
      const expr = createExpressionParameter('Variables.x', '');
      expect(expr.fallback).toBe('');
    });
  });

  describe('toParameter', () => {
    it('passes through expression parameters', () => {
      const expr: ExpressionParameter = {
        mode: 'expression',
        expression: 'Variables.x',
        fallback: 0
      };
      expect(toParameter(expr)).toBe(expr);
    });

    it('returns simple values as-is', () => {
      expect(toParameter(42)).toBe(42);
      expect(toParameter('hello')).toBe('hello');
      expect(toParameter(true)).toBe(true);
      expect(toParameter(null)).toBe(null);
      expect(toParameter(undefined)).toBe(undefined);
    });

    it('returns objects as-is', () => {
      const obj = { a: 1 };
      expect(toParameter(obj)).toBe(obj);
    });
  });

  describe('Serialization', () => {
    it('expression parameters serialize to JSON correctly', () => {
      const expr = createExpressionParameter('Variables.count', 10);
      const json = JSON.stringify(expr);
      const parsed = JSON.parse(json);

      expect(parsed.mode).toBe('expression');
      expect(parsed.expression).toBe('Variables.count');
      expect(parsed.fallback).toBe(10);
      expect(parsed.version).toBe(1);
    });

    it('deserialized expression parameters are recognized', () => {
      const json = '{"mode":"expression","expression":"Variables.x","fallback":0,"version":1}';
      const parsed = JSON.parse(json);

      expect(isExpressionParameter(parsed)).toBe(true);
      expect(parsed.expression).toBe('Variables.x');
      expect(parsed.fallback).toBe(0);
    });

    it('handles undefined fallback in serialization', () => {
      const expr = createExpressionParameter('Variables.x');
      const json = JSON.stringify(expr);
      const parsed = JSON.parse(json);

      expect(parsed.fallback).toBeUndefined();
      expect(isExpressionParameter(parsed)).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('simple values in parameters object work', () => {
      const params = {
        marginLeft: 16,
        color: '#ff0000',
        enabled: true
      };

      expect(isExpressionParameter(params.marginLeft)).toBe(false);
      expect(isExpressionParameter(params.color)).toBe(false);
      expect(isExpressionParameter(params.enabled)).toBe(false);
    });

    it('mixed parameters work', () => {
      const params = {
        marginLeft: createExpressionParameter('Variables.spacing', 16),
        marginRight: 8, // Simple value
        color: '#ff0000'
      };

      expect(isExpressionParameter(params.marginLeft)).toBe(true);
      expect(isExpressionParameter(params.marginRight)).toBe(false);
      expect(isExpressionParameter(params.color)).toBe(false);
    });

    it('old project parameters load correctly', () => {
      // Simulating loading old project
      const oldParams = {
        width: 200,
        height: 100,
        text: 'Hello'
      };

      // None should be expressions
      Object.values(oldParams).forEach((value) => {
        expect(isExpressionParameter(value)).toBe(false);
      });
    });

    it('new project with expressions loads correctly', () => {
      const newParams = {
        width: createExpressionParameter('Variables.width', 200),
        height: 100, // Mixed: some expression, some not
        text: 'Static text'
      };

      expect(isExpressionParameter(newParams.width)).toBe(true);
      expect(isExpressionParameter(newParams.height)).toBe(false);
      expect(isExpressionParameter(newParams.text)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles complex expressions', () => {
      const expr = createExpressionParameter('Variables.isAdmin ? "Admin Panel" : "User Panel"', 'User Panel');
      expect(expr.expression).toBe('Variables.isAdmin ? "Admin Panel" : "User Panel"');
    });

    it('handles multi-line expressions', () => {
      const multiLine = `Variables.items
        .filter(x => x.active)
        .length`;
      const expr = createExpressionParameter(multiLine, 0);
      expect(expr.expression).toBe(multiLine);
    });

    it('handles expressions with special characters', () => {
      const expr = createExpressionParameter('Variables["my-variable"]', null);
      expect(expr.expression).toBe('Variables["my-variable"]');
    });
  });
});
