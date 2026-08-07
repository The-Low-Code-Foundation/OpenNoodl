/**
 * Type Coercion Tests for Expression Parameters
 *
 * Tests type conversion from expression results to expected property types
 */

const { coerceToType } = require('../src/expression-type-coercion');

describe('Expression Type Coercion', () => {
  describe('String coercion', () => {
    it('converts number to string', () => {
      expect(coerceToType(42, 'string')).toBe('42');
    });

    it('converts boolean to string', () => {
      expect(coerceToType(true, 'string')).toBe('true');
      expect(coerceToType(false, 'string')).toBe('false');
    });

    it('converts object to string', () => {
      expect(coerceToType({ a: 1 }, 'string')).toBe('[object Object]');
    });

    it('converts array to string', () => {
      expect(coerceToType([1, 2, 3], 'string')).toBe('1,2,3');
    });

    it('returns empty string for undefined', () => {
      expect(coerceToType(undefined, 'string', 'fallback')).toBe('fallback');
    });

    it('returns empty string for null', () => {
      expect(coerceToType(null, 'string', 'fallback')).toBe('fallback');
    });

    it('keeps string as-is', () => {
      expect(coerceToType('hello', 'string')).toBe('hello');
    });
  });

  describe('Number coercion', () => {
    it('converts string number to number', () => {
      expect(coerceToType('42', 'number')).toBe(42);
    });

    it('converts string float to number', () => {
      expect(coerceToType('3.14', 'number')).toBe(3.14);
    });

    it('converts boolean to number', () => {
      expect(coerceToType(true, 'number')).toBe(1);
      expect(coerceToType(false, 'number')).toBe(0);
    });

    it('returns fallback for invalid string', () => {
      expect(coerceToType('not a number', 'number', 0)).toBe(0);
    });

    it('returns fallback for undefined', () => {
      expect(coerceToType(undefined, 'number', 42)).toBe(42);
    });

    it('returns fallback for null', () => {
      expect(coerceToType(null, 'number', 42)).toBe(42);
    });

    it('returns fallback for NaN', () => {
      expect(coerceToType(NaN, 'number', 0)).toBe(0);
    });

    it('keeps number as-is', () => {
      expect(coerceToType(123, 'number')).toBe(123);
    });

    it('converts negative numbers correctly', () => {
      expect(coerceToType('-10', 'number')).toBe(-10);
    });
  });

  describe('Boolean coercion', () => {
    it('converts truthy values to true', () => {
      expect(coerceToType(1, 'boolean')).toBe(true);
      expect(coerceToType('yes', 'boolean')).toBe(true);
      expect(coerceToType({}, 'boolean')).toBe(true);
      expect(coerceToType([], 'boolean')).toBe(true);
    });

    it('converts falsy values to false', () => {
      expect(coerceToType(0, 'boolean')).toBe(false);
      expect(coerceToType('', 'boolean')).toBe(false);
      expect(coerceToType(NaN, 'boolean')).toBe(false);
    });

    it('treats null and undefined as "no value" and yields the fallback', () => {
      // Policy (recorded by DEBT-003): null/undefined are handled uniformly
      // across all port types as an absent value, before type coercion runs.
      expect(coerceToType(null, 'boolean', false)).toBe(false);
      expect(coerceToType(undefined, 'boolean', true)).toBe(true);
      expect(coerceToType(null, 'boolean')).toBeUndefined();
    });

    it('keeps boolean as-is', () => {
      expect(coerceToType(true, 'boolean')).toBe(true);
      expect(coerceToType(false, 'boolean')).toBe(false);
    });
  });

  describe('Color coercion', () => {
    it('accepts valid hex colors', () => {
      expect(coerceToType('#ff0000', 'color')).toBe('#ff0000');
      expect(coerceToType('#FF0000', 'color')).toBe('#FF0000');
      expect(coerceToType('#abc123', 'color')).toBe('#abc123');
    });

    it('accepts 3-digit hex colors', () => {
      expect(coerceToType('#f00', 'color')).toBe('#f00');
      expect(coerceToType('#FFF', 'color')).toBe('#FFF');
    });

    it('accepts rgb() format', () => {
      expect(coerceToType('rgb(255, 0, 0)', 'color')).toBe('rgb(255, 0, 0)');
    });

    it('accepts rgba() format', () => {
      expect(coerceToType('rgba(255, 0, 0, 0.5)', 'color')).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('returns fallback for invalid hex', () => {
      expect(coerceToType('#gg0000', 'color', '#000000')).toBe('#000000');
      expect(coerceToType('not a color', 'color', '#000000')).toBe('#000000');
    });

    it('returns fallback for undefined', () => {
      expect(coerceToType(undefined, 'color', '#ffffff')).toBe('#ffffff');
    });

    it('returns fallback for null', () => {
      expect(coerceToType(null, 'color', '#ffffff')).toBe('#ffffff');
    });
  });

  describe('Enum coercion', () => {
    const enumOptions = ['small', 'medium', 'large'];
    const enumOptionsWithValues = [
      { value: 'sm', label: 'Small' },
      { value: 'md', label: 'Medium' },
      { value: 'lg', label: 'Large' }
    ];

    it('accepts valid enum value', () => {
      expect(coerceToType('medium', 'enum', 'small', enumOptions)).toBe('medium');
    });

    it('accepts valid enum value from object options', () => {
      expect(coerceToType('md', 'enum', 'sm', enumOptionsWithValues)).toBe('md');
    });

    it('returns fallback for invalid enum value', () => {
      expect(coerceToType('xlarge', 'enum', 'small', enumOptions)).toBe('small');
    });

    it('returns fallback for undefined', () => {
      expect(coerceToType(undefined, 'enum', 'medium', enumOptions)).toBe('medium');
    });

    it('returns fallback for null', () => {
      expect(coerceToType(null, 'enum', 'medium', enumOptions)).toBe('medium');
    });

    it('converts number to string for enum matching', () => {
      const numericEnum = ['1', '2', '3'];
      expect(coerceToType(2, 'enum', '1', numericEnum)).toBe('2');
    });

    it('returns fallback when enumOptions is not provided', () => {
      expect(coerceToType('value', 'enum', 'fallback')).toBe('fallback');
    });
  });

  describe('Unknown type (passthrough)', () => {
    it('returns value as-is for unknown types', () => {
      expect(coerceToType({ a: 1 }, 'object')).toEqual({ a: 1 });
      expect(coerceToType([1, 2, 3], 'array')).toEqual([1, 2, 3]);
      expect(coerceToType('test', 'custom')).toBe('test');
    });

    it('returns undefined for undefined value with unknown type', () => {
      expect(coerceToType(undefined, 'custom', 'fallback')).toBe('fallback');
    });
  });

  describe('Edge cases', () => {
    it('handles empty string as value', () => {
      expect(coerceToType('', 'string')).toBe('');
      expect(coerceToType('', 'number', 0)).toBe(0);
      expect(coerceToType('', 'boolean')).toBe(false);
    });

    it('handles zero as value', () => {
      expect(coerceToType(0, 'string')).toBe('0');
      expect(coerceToType(0, 'number')).toBe(0);
      expect(coerceToType(0, 'boolean')).toBe(false);
    });

    it('handles Infinity', () => {
      expect(coerceToType(Infinity, 'string')).toBe('Infinity');
      expect(coerceToType(Infinity, 'number')).toBe(Infinity);
      expect(coerceToType(Infinity, 'boolean')).toBe(true);
    });

    it('handles negative zero', () => {
      expect(coerceToType(-0, 'string')).toBe('0');
      expect(coerceToType(-0, 'number')).toBe(-0);
      expect(coerceToType(-0, 'boolean')).toBe(false);
    });
  });
});
