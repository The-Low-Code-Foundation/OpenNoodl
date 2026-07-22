/**
 * UBA-003/UBA-004: Unit tests for Conditions.ts
 *
 * Tests:
 * - getNestedValue dot-path lookups
 * - setNestedValue immutable path writes
 * - isEmpty edge cases
 * - evaluateCondition — all 6 operators
 */


import { evaluateCondition, getNestedValue, isEmpty, setNestedValue } from '../../src/editor/src/models/UBA/Conditions';

// ─── getNestedValue ───────────────────────────────────────────────────────────

describe('getNestedValue', () => {
  it('returns top-level value', () => {
    expect(getNestedValue({ foo: 'bar' }, 'foo')).toBe('bar');
  });

  it('returns nested value via dot path', () => {
    expect(getNestedValue({ auth: { type: 'bearer' } }, 'auth.type')).toBe('bearer');
  });

  it('returns undefined for missing path', () => {
    expect(getNestedValue({ auth: {} }, 'auth.type')).toBeUndefined();
  });

  it('returns undefined for deeply missing path', () => {
    expect(getNestedValue({}, 'a.b.c')).toBeUndefined();
  });

  it('returns undefined for empty path', () => {
    expect(getNestedValue({ foo: 'bar' }, '')).toBeUndefined();
  });
});

// ─── setNestedValue ───────────────────────────────────────────────────────────

describe('setNestedValue', () => {
  it('sets top-level key', () => {
    const result = setNestedValue({}, 'foo', 'bar');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('sets nested key', () => {
    const result = setNestedValue({}, 'auth.type', 'bearer');
    expect(result).toEqual({ auth: { type: 'bearer' } });
  });

  it('merges with existing nested object', () => {
    const result = setNestedValue({ auth: { key: 'abc' } }, 'auth.type', 'bearer');
    expect(result).toEqual({ auth: { key: 'abc', type: 'bearer' } });
  });

  it('does not mutate the original', () => {
    const original = { foo: 'bar' };
    setNestedValue(original, 'foo', 'baz');
    expect(original.foo).toBe('bar');
  });
});

// ─── isEmpty ─────────────────────────────────────────────────────────────────

describe('isEmpty', () => {
  it.each([
    [null, true],
    [undefined, true],
    ['', true],
    ['  ', true],
    [[], true],
    ['hello', false],
    [0, false],
    [false, false],
    [['a'], false],
    [{}, false]
  ])('isEmpty(%o) === %s', (value, expected) => {
    expect(isEmpty(value)).toBe(expected);
  });
});

// ─── evaluateCondition ────────────────────────────────────────────────────────

describe('evaluateCondition', () => {
  const values = {
    'auth.type': 'bearer',
    'auth.token': 'abc123',
    'auth.enabled': true,
    'features.list': ['a', 'b'],
    'features.empty': []
  };

  it('returns true when condition is undefined', () => {
    expect(evaluateCondition(undefined, values)).toBe(true);
  });

  describe('operator "="', () => {
    it('returns true when field matches value', () => {
      expect(evaluateCondition({ field: 'auth.type', operator: '=', value: 'bearer' }, values)).toBe(true);
    });

    it('returns false when field does not match', () => {
      expect(evaluateCondition({ field: 'auth.type', operator: '=', value: 'api_key' }, values)).toBe(false);
    });
  });

  describe('operator "!="', () => {
    it('returns true when field differs', () => {
      expect(evaluateCondition({ field: 'auth.type', operator: '!=', value: 'api_key' }, values)).toBe(true);
    });

    it('returns false when field matches', () => {
      expect(evaluateCondition({ field: 'auth.type', operator: '!=', value: 'bearer' }, values)).toBe(false);
    });
  });

  describe('operator "in"', () => {
    it('returns true when value is in array', () => {
      expect(evaluateCondition({ field: 'auth.type', operator: 'in', value: ['bearer', 'api_key'] }, values)).toBe(
        true
      );
    });

    it('returns false when value is not in array', () => {
      expect(evaluateCondition({ field: 'auth.type', operator: 'in', value: ['basic', 'none'] }, values)).toBe(false);
    });

    it('returns false when condition value is not an array', () => {
      expect(evaluateCondition({ field: 'auth.type', operator: 'in', value: 'bearer' }, values)).toBe(false);
    });
  });

  describe('operator "not_in"', () => {
    it('returns true when value is not in array', () => {
      expect(evaluateCondition({ field: 'auth.type', operator: 'not_in', value: ['basic', 'none'] }, values)).toBe(
        true
      );
    });

    it('returns false when value is in the array', () => {
      expect(evaluateCondition({ field: 'auth.type', operator: 'not_in', value: ['bearer', 'api_key'] }, values)).toBe(
        false
      );
    });
  });

  describe('operator "exists"', () => {
    it('returns true when field has a value', () => {
      expect(evaluateCondition({ field: 'auth.token', operator: 'exists' }, values)).toBe(true);
    });

    it('returns false when field is missing', () => {
      expect(evaluateCondition({ field: 'auth.missing', operator: 'exists' }, values)).toBe(false);
    });

    it('returns false when field is empty array', () => {
      expect(evaluateCondition({ field: 'features.empty', operator: 'exists' }, values)).toBe(false);
    });
  });

  describe('operator "not_exists"', () => {
    it('returns true when field is missing', () => {
      expect(evaluateCondition({ field: 'auth.missing', operator: 'not_exists' }, values)).toBe(true);
    });

    it('returns false when field has a value', () => {
      expect(evaluateCondition({ field: 'auth.token', operator: 'not_exists' }, values)).toBe(false);
    });

    it('returns true when field is empty array', () => {
      expect(evaluateCondition({ field: 'features.empty', operator: 'not_exists' }, values)).toBe(true);
    });
  });
});
