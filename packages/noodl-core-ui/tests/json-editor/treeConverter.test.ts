/**
 * ERG-003 criterion 3 — "the visual mode can produce every value the code mode
 * can". Easy mode's whole contract is `value -> tree -> value`, so that is what
 * these check: anything that survives the code editor has to survive a trip
 * through the tree unchanged.
 */

import { treeNodeToValue, valueToTreeNode } from '@noodl-core-ui/components/json-editor/utils/treeConverter';

function roundTrip(value: unknown): unknown {
  return treeNodeToValue(valueToTreeNode(value));
}

describe('valueToTreeNode / treeNodeToValue round trip', () => {
  const cases: [string, unknown][] = [
    ['an empty array', []],
    ['an empty object', {}],
    ['a flat string list', ['From', 'To', 'Subject']],
    ['a proplist', [{ id: 'melj', label: 'Options' }]],
    ['mixed primitives', [1, 'two', true, null]],
    ['a nested object', { headers: { Authorization: 'Bearer x' }, retries: 3 }],
    ['an array of objects', [{ a: 1 }, { a: 2 }]],
    ['deep nesting', { a: { b: { c: [1, { d: null }] } } }],
    ['a zero, a false and an empty string', { n: 0, b: false, s: '' }],
    ['keys that look falsy', { '0': 'zero', 'false': 'no' }]
  ];

  cases.forEach(([name, value]) => {
    it(`preserves ${name}`, () => {
      expect(roundTrip(value)).toEqual(value);
    });
  });

  it('preserves an empty-string key', () => {
    // Was dropped: `if (child.key)` treated "" as absent, so `{"": 1}` came back
    // `{}`. Legal JSON, and the property panel now round-trips stored values
    // through this converter, so losing it is data loss rather than tidiness.
    expect(roundTrip({ '': 1 })).toEqual({ '': 1 });
    expect(roundTrip({ '': 'a', b: 2 })).toEqual({ '': 'a', b: 2 });
  });

  it('preserves array order', () => {
    expect(roundTrip(['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('preserves object key order', () => {
    const value = { z: 1, a: 2, m: 3 };
    expect(Object.keys(roundTrip(value) as object)).toEqual(['z', 'a', 'm']);
  });
});
