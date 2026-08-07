/**
 * CWF-014 — the request contract, as a rule.
 *
 * The rule is pure, so it is testable without a backend, a graph or an HTTP
 * server — the same stance AIB-001 took with `nameListParameter`. Its
 * *consequences* (a real 400 off a real socket, and a graph that did not run)
 * are pinned end-to-end in `nodegx-backend/tests/cwf-014-typed-request-bodies.test.ts`;
 * this file is the table of what each declared type accepts and refuses.
 *
 * ⚠️ A validator with no rejection test is an unchecked claim, so every type
 * below has both halves: one value it takes and one it will not.
 */
import {
  applyRequestContract,
  contractIsEmpty,
  coerce,
  describeError,
  isCloudFunctionBadRequest,
  CloudFunctionBadRequestError,
  paramNames,
  requestParamSpecs,
  type RequestParamType
} from '../src/nodes/cloud/requestContract';

describe('CWF-014: what a Request node’s parameters declare', () => {
  it('a plain `params` string is what it has always been — every name, no type, nothing required', () => {
    expect(requestParamSpecs({ params: 'id,total' })).toEqual([
      { name: 'id', type: '*', required: false },
      { name: 'total', type: '*', required: false }
    ]);
  });

  it('and that contract asks nothing, so the enforcement is skipped entirely', () => {
    expect(contractIsEmpty(requestParamSpecs({ params: 'id,total' }))).toBe(true);
    expect(contractIsEmpty(requestParamSpecs({ params: 'id', 'ptype-id': 'number' }))).toBe(false);
    expect(contractIsEmpty(requestParamSpecs({ params: 'id', 'preq-id': true }))).toBe(false);
    expect(contractIsEmpty(requestParamSpecs({ params: 'id', 'pdef-id': '7' }))).toBe(false);
  });

  it('reads type, required and default off the sibling parameters', () => {
    expect(
      requestParamSpecs({
        params: 'total',
        'ptype-total': 'number',
        'preq-total': true,
        'pdef-total': '0'
      })
    ).toEqual([{ name: 'total', type: 'number', required: true, default: '0' }]);
  });

  it('survives a name with a space in it — `Customer Id` ships in a prefab today', () => {
    expect(requestParamSpecs({ params: 'Customer Id', 'ptype-Customer Id': 'string' })).toEqual([
      { name: 'Customer Id', type: 'string', required: false }
    ]);
  });

  it('degrades an unknown type to Any rather than refusing to serve', () => {
    expect(requestParamSpecs({ params: 'total', 'ptype-total': 'quaternion' })[0].type).toBe('*');
  });

  it('ignores a contract row whose name is no longer in the list', () => {
    expect(requestParamSpecs({ params: 'id', 'ptype-total': 'number', 'preq-total': true })).toEqual([
      { name: 'id', type: '*', required: false }
    ]);
  });

  it('splits the name list exactly as the port generators do', () => {
    expect(paramNames('a,,b')).toEqual(['a', 'b']);
    expect(paramNames('a,a')).toEqual(['a']);
    expect(paramNames('')).toEqual([]);
    expect(paramNames(undefined)).toEqual([]);
    // AIB-001's defensive read: a hand-edited or model-authored array is a name list too.
    expect(paramNames(['a', 'b'])).toEqual(['a', 'b']);
  });
});

describe('CWF-014: each declared type takes one value and refuses another', () => {
  const table: { type: RequestParamType; accepts: [unknown, unknown][]; refuses: unknown[] }[] = [
    {
      type: 'string',
      accepts: [
        ['hello', 'hello'],
        [42, '42'],
        [true, 'true'],
        [{ a: 1 }, '{"a":1}']
      ],
      refuses: [undefined]
    },
    {
      type: 'number',
      // The criterion by name: "42" arrives as 42 by the declared typecast.
      accepts: [
        [42, 42],
        ['42', 42],
        ['  7.5 ', 7.5],
        [true, 1]
      ],
      refuses: ['banana', '', '12abc', {}, [], Infinity]
    },
    {
      type: 'boolean',
      accepts: [
        [true, true],
        ['true', true],
        ['FALSE', false],
        [0, false]
      ],
      refuses: ['yes', 'banana', {}, []]
    },
    {
      type: 'object',
      accepts: [
        [{ a: 1 }, { a: 1 }],
        ['{"a":1}', { a: 1 }]
      ],
      refuses: [[1, 2], 'banana', '[1,2]', 7]
    },
    {
      type: 'array',
      accepts: [
        [[1, 2], [1, 2]],
        ['[1,2]', [1, 2]]
      ],
      refuses: [{ a: 1 }, 'banana', '{"a":1}', 7]
    },
    {
      type: 'date',
      accepts: [['2026-08-06T00:00:00.000Z', new Date('2026-08-06T00:00:00.000Z')]],
      refuses: ['banana', {}, [], true]
    }
  ];

  for (const row of table) {
    for (const [given, expected] of row.accepts) {
      it(`${row.type} accepts ${JSON.stringify(given)}`, () => {
        expect(coerce(row.type, given)).toEqual({ ok: true, value: expected });
      });
    }
    for (const given of row.refuses) {
      it(`${row.type} refuses ${JSON.stringify(given) ?? String(given)}`, () => {
        expect(coerce(row.type, given)).toEqual({ ok: false });
      });
    }
  }

  it('Any takes anything, which is what every parameter written before this task is', () => {
    for (const value of ['banana', 42, null, { a: 1 }, [1]]) {
      expect(coerce('*', value)).toEqual({ ok: true, value });
    }
  });

  it('an object typed as a string is JSON, not `[object Object]` — the declared outbound cast', () => {
    expect(coerce('string', [1, 2])).toEqual({ ok: true, value: '[1,2]' });
  });
});

describe('CWF-014: applying a contract to a body', () => {
  const typed = requestParamSpecs({
    params: 'total,note',
    'ptype-total': 'number',
    'preq-total': true
  });

  it('a missing required parameter is named, and nothing else is reported for it', () => {
    const { errors } = applyRequestContract(typed, { note: 'hi' });
    expect(errors).toEqual([{ name: 'total', code: 'missing', expected: 'number' }]);
    expect(describeError(errors[0])).toBe('"total" is required');
  });

  it('a wrong type is named with what was expected and what arrived — never the value', () => {
    const { errors } = applyRequestContract(typed, { total: 'banana' });
    expect(errors).toEqual([{ name: 'total', code: 'type', expected: 'number', received: 'string' }]);
    expect(describeError(errors[0])).toBe('"total" expects number, received string');
    expect(new CloudFunctionBadRequestError(errors).message).not.toContain('banana');
  });

  it('every bad field is reported at once, not the first one', () => {
    const both = requestParamSpecs({
      params: 'a,b,c',
      'ptype-a': 'number',
      'ptype-b': 'boolean',
      'preq-c': true
    });
    expect(applyRequestContract(both, { a: 'x', b: 'x' }).errors.map((e) => e.name)).toEqual(['a', 'b', 'c']);
  });

  it('a correct body arrives coerced, and undeclared keys pass through untouched', () => {
    const { values, errors } = applyRequestContract(typed, { total: '42', note: 'hi', extra: { deep: 1 } });
    expect(errors).toEqual([]);
    expect(values).toEqual({ total: 42, note: 'hi', extra: { deep: 1 } });
  });

  it('`null` is absent, not a type error — it is how a client serialises an empty field', () => {
    expect(applyRequestContract(typed, { total: null }).errors).toEqual([
      { name: 'total', code: 'missing', expected: 'number' }
    ]);
  });

  it('a default is applied when the caller omits the value, through the same coercion', () => {
    const specs = requestParamSpecs({ params: 'total', 'ptype-total': 'number', 'pdef-total': '7' });
    expect(applyRequestContract(specs, {}).values).toEqual({ total: 7 });
  });

  it('a default beats `required`: declaring a fallback is saying the caller need not supply it', () => {
    const specs = requestParamSpecs({
      params: 'total',
      'ptype-total': 'number',
      'preq-total': true,
      'pdef-total': '7'
    });
    const { values, errors } = applyRequestContract(specs, {});
    expect(errors).toEqual([]);
    expect(values).toEqual({ total: 7 });
  });

  it('an absent optional parameter stays absent rather than becoming `undefined`', () => {
    const specs = requestParamSpecs({ params: 'note', 'ptype-note': 'string' });
    expect(Object.prototype.hasOwnProperty.call(applyRequestContract(specs, {}).values, 'note')).toBe(false);
  });

  it('the refusal is recognisable by name, because the backend reaches it through a bundler alias', () => {
    const e = new CloudFunctionBadRequestError([{ name: 'total', code: 'missing', expected: 'number' }]);
    expect(isCloudFunctionBadRequest(e)).toBe(true);
    expect(isCloudFunctionBadRequest(new Error('something else'))).toBe(false);
    expect(e.statusCode).toBe(400);
  });
});
