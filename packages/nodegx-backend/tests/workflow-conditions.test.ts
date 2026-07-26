/**
 * WF-002 condition language — the shared evaluator behind `branch`, `switch`
 * and `for-each`'s filter.
 *
 * The property that matters most here is the LOUD one: a condition that cannot
 * be evaluated must throw, never quietly return false. A silently-false
 * condition is a branch that takes the wrong edge forever, which is precisely
 * the failure mode RUN-004's doctrine exists to prevent.
 */
import {
  CONDITION_OPS,
  ConditionError,
  evaluateCondition,
  getPath,
  resolveValue,
  validateCondition
} from '../src/workflow/steps/conditions';
import type { Condition } from '../src/workflow/steps/conditions';

const scope = {
  order: { total: 120, currency: 'GBP', tags: ['rush', 'gift'], customer: { name: 'Ada' } },
  previous: { items: [{ id: 1 }, { id: 2 }], status: 'paid' },
  empty: '',
  zero: 0,
  nothing: null
};

function evl(cond: Condition): boolean {
  return evaluateCondition(cond, scope);
}

describe('WF-002 conditions: path + value resolution', () => {
  it('walks objects and array indices', () => {
    expect(getPath(scope, 'order.total')).toBe(120);
    expect(getPath(scope, 'order.customer.name')).toBe('Ada');
    expect(getPath(scope, 'previous.items.1.id')).toBe(2);
    expect(getPath(scope, 'previous.items.-1.id')).toBe(2);
  });

  it('returns undefined for a missing segment rather than throwing', () => {
    expect(getPath(scope, 'order.nope.deeper')).toBeUndefined();
    expect(getPath(scope, 'previous.items.99')).toBeUndefined();
  });

  it('resolves $path, $literal and bare literals', () => {
    expect(resolveValue({ $path: 'order.total' }, scope)).toBe(120);
    expect(resolveValue({ $literal: { $path: 'not-a-path' } }, scope)).toEqual({ $path: 'not-a-path' });
    expect(resolveValue(42, scope)).toBe(42);
    expect(resolveValue('paid', scope)).toBe('paid');
  });
});

describe('WF-002 conditions: operators', () => {
  it('equality is deep, not reference', () => {
    expect(evl({ left: { $path: 'order.tags' }, op: 'eq', right: ['rush', 'gift'] })).toBe(true);
    expect(evl({ left: { $path: 'order.customer' }, op: 'eq', right: { name: 'Ada' } })).toBe(true);
    expect(evl({ left: { $path: 'order.total' }, op: 'neq', right: 121 })).toBe(true);
  });

  it('orders numbers, numeric strings and ISO dates', () => {
    expect(evl({ left: { $path: 'order.total' }, op: 'gt', right: 100 })).toBe(true);
    expect(evl({ left: '10', op: 'gt', right: '9' })).toBe(true); // numeric, not lexicographic
    expect(evl({ left: '2026-07-26', op: 'lt', right: '2026-07-27' })).toBe(true);
    expect(evl({ left: 'apple', op: 'lt', right: 'banana' })).toBe(true); // both plain strings
  });

  it('contains works over strings, arrays and object keys', () => {
    expect(evl({ left: { $path: 'order.currency' }, op: 'contains', right: 'BP' })).toBe(true);
    expect(evl({ left: { $path: 'order.tags' }, op: 'contains', right: 'rush' })).toBe(true);
    expect(evl({ left: { $path: 'order.customer' }, op: 'contains', right: 'name' })).toBe(true);
    expect(evl({ left: { $path: 'order.tags' }, op: 'notContains', right: 'slow' })).toBe(true);
  });

  it('supports string prefix/suffix/regex and set membership', () => {
    expect(evl({ left: { $path: 'previous.status' }, op: 'startsWith', right: 'pa' })).toBe(true);
    expect(evl({ left: { $path: 'previous.status' }, op: 'endsWith', right: 'id' })).toBe(true);
    expect(evl({ left: { $path: 'previous.status' }, op: 'matches', right: '^PAID$', flags: 'i' })).toBe(true);
    expect(evl({ left: { $path: 'previous.status' }, op: 'in', right: ['paid', 'refunded'] })).toBe(true);
    expect(evl({ left: { $path: 'previous.status' }, op: 'notIn', right: ['void'] })).toBe(true);
  });

  it('separates exists / truthy / empty, which are three different questions', () => {
    // 0 exists, is falsy, and is not empty. Conflating these is a classic bug.
    expect(evl({ left: { $path: 'zero' }, op: 'exists' })).toBe(true);
    expect(evl({ left: { $path: 'zero' }, op: 'falsy' })).toBe(true);
    expect(evl({ left: { $path: 'zero' }, op: 'empty' })).toBe(false);
    expect(evl({ left: { $path: 'empty' }, op: 'empty' })).toBe(true);
    expect(evl({ left: { $path: 'nothing' }, op: 'notExists' })).toBe(true);
    expect(evl({ left: { $path: 'order.tags' }, op: 'notEmpty' })).toBe(true);
  });

  it('composes with all / any / not', () => {
    expect(
      evl({
        all: [
          { left: { $path: 'order.total' }, op: 'gte', right: 100 },
          { any: [{ left: { $path: 'order.currency' }, op: 'eq', right: 'GBP' }, { left: 1, op: 'eq', right: 2 }] },
          { not: { left: { $path: 'previous.status' }, op: 'eq', right: 'void' } }
        ]
      })
    ).toBe(true);
  });
});

describe('WF-002 conditions: loud failure, never silent false', () => {
  it('throws when operands cannot be ordered', () => {
    expect(() => evl({ left: { $path: 'order.customer' }, op: 'gt', right: 5 })).toThrow(ConditionError);
    expect(() => evl({ left: { $path: 'nothing' }, op: 'lt', right: 5 })).toThrow(/Cannot order-compare/);
  });

  it('throws on a type mismatch rather than coercing silently', () => {
    expect(() => evl({ left: { $path: 'order.total' }, op: 'startsWith', right: '1' })).toThrow(/needs a string/);
    expect(() => evl({ left: 'x', op: 'in', right: 'not-an-array' } as never)).toThrow(/needs an array/);
  });

  it('throws on an unknown operator', () => {
    expect(() => evl({ left: 1, op: 'approximately' } as never)).toThrow(/Unknown condition operator/);
  });
});

describe('WF-002 conditions: write-time validation', () => {
  it('accepts every operator in a well-formed comparison', () => {
    for (const op of CONDITION_OPS) {
      expect(validateCondition({ left: { $path: 'a' }, op, right: 'x' }, 'c')).toEqual([]);
    }
  });

  it('rejects a missing operand, a bad operator and an invalid regex', () => {
    expect(validateCondition({ op: 'eq', right: 1 }, 'c')).toContain('c: a comparison needs a "left" value');
    expect(validateCondition({ left: 1, op: 'gt' }, 'c')[0]).toMatch(/needs a "right" value/);
    expect(validateCondition({ left: 1, op: 'nope' }, 'c')[0]).toMatch(/op must be one of/);
    expect(validateCondition({ left: 'a', op: 'matches', right: '([' }, 'c')[0]).toMatch(/invalid regex/);
  });

  it('recurses into combinators and rejects empty ones', () => {
    expect(validateCondition({ all: [] }, 'c')[0]).toMatch(/non-empty array/);
    expect(validateCondition({ any: [{ left: 1, op: 'bad' }] }, 'c')[0]).toMatch(/c\.any\[0\]/);
    expect(validateCondition({ not: { left: 1, op: 'bad' } }, 'c')[0]).toMatch(/c\.not/);
  });
});
