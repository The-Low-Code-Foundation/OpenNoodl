/**
 * The runtime's filter boundary (BCN-003).
 *
 * The translation itself is tested in `@noodl/backend-contract`. What is tested
 * here is the part that could not move there: reading the schema out of
 * `CloudStore._collections`, resolving a `relatedTo` class from the model
 * store, and turning a refusal into `options.error(…)` rather than an exception.
 *
 * Plus the two widenings this task closed, which are the reason it exists —
 * both of them cases where a filter succeeded and returned rows it had been
 * asked to exclude.
 */

import NoodlRuntime = require('../noodl-runtime');
import CloudStoreImport = require('../src/api/cloudstore');
import Model = require('../src/model');
import { collectFilterParameters, convertFilterOp, convertVisualFilter, matchesQuery } from '../src/api/queryutils';

type CollectionCache = Record<
  string,
  { schema?: { properties?: Record<string, { type?: string; targetClass?: string }> } }
>;

const CloudStore = CloudStoreImport as unknown as { _collections: CollectionCache };

/**
 * Replace the module-global schema cache `queryutils` reads.
 *
 * `_collections` is a lazily-populated getter with no setter, so the contents
 * have to be swapped in place. That this is the only way to point the filter
 * path at a different schema — and that doing so affects every caller in the
 * process at once — is a fair summary of why the translators take the schema as
 * a parameter instead of reading it for themselves.
 */
function setCollections(collections: CollectionCache): void {
  (NoodlRuntime as unknown as { instance: unknown }).instance = {
    getMetaData: (key: string) =>
      key === 'dbCollections' ? Object.entries(collections).map(([name, c]) => ({ name, ...c })) : []
  };
  (CloudStoreImport as unknown as { invalidateCollections(): void }).invalidateCollections();
}

describe('convertFilterOp', () => {
  const errors: string[] = [];
  const options = () => ({ collectionName: 'Person', error: (e: string) => errors.push(e) });

  beforeEach(() => {
    errors.length = 0;
    setCollections({
      Person: {
        schema: {
          properties: {
            name: { type: 'String' },
            born: { type: 'Date' },
            team: { type: 'Pointer', targetClass: 'Team' }
          }
        }
      }
    });
  });

  it('translates the string operators that used to match every record', () => {
    // ⚠️ The headline defect. `convertFilterOp` had no branch for `contains`,
    // so it fell off the end of its if/else chain and returned `{}` — no
    // condition at all. "Name contains Ada" therefore returned the whole
    // collection, with no error and nothing in the app to see.
    expect(convertFilterOp({ name: { contains: 'Ada' } }, options())).toEqual({ name: { $regex: 'Ada' } });
    expect(errors).toEqual([]);

    expect(convertFilterOp({ name: { startsWith: 'Ad' } }, options())).toEqual({ name: { $regex: '^Ad' } });
    expect(convertFilterOp({ age: { between: [18, 65] } }, options())).toEqual({ age: { $gte: 18, $lte: 65 } });
  });

  it('escapes a value before it becomes a regular expression', () => {
    // Unescaped, "contains a.b" also matched "axb", and "contains C++" was a
    // pattern the backend rejected outright.
    expect(convertFilterOp({ name: { contains: 'a.b' } }, options())).toEqual({ name: { $regex: 'a\\.b' } });
  });

  it('refuses a leaf with two operators instead of dropping one of them', () => {
    // The chain took whichever operator it reached first, so this asked the
    // backend for `price > 1` and lost the upper bound.
    expect(convertFilterOp({ price: { greaterThan: 1, lessThan: 5 } }, options())).toEqual({});
    expect(errors[0]).toMatch(/only one can be applied/);
  });

  it('reports rather than throws, so a malformed filter does not take the node down', () => {
    expect(convertFilterOp({ a: { equalTo: 1 }, b: { equalTo: 2 } }, options())).toEqual({});
    expect(errors[0]).toMatch(/exactly one key/);
  });

  it('reads the pointer target class from the cached schema', () => {
    expect(convertFilterOp({ team: { pointsTo: 'T1' } }, options())).toEqual({
      team: { $eq: { __type: 'Pointer', objectId: 'T1', className: 'Team' } }
    });
  });

  it('says so when the schema needed for a pointer filter is not cached', () => {
    // This used to emit `className: undefined`, which the backend answers with
    // an empty result set and no error — a filter that returns nothing, for a
    // reason nobody could see.
    setCollections({});
    expect(convertFilterOp({ team: { pointsTo: 'T1' } }, options())).toEqual({});
    expect(errors[0]).toMatch(/needs the collection schema/);
  });

  it('wraps a date so a range filter is not compared as text', () => {
    const where = convertFilterOp({ born: { greaterThan: '1815-12-10T00:00:00.000Z' } }, options());
    expect(where.born.$gt.__type).toBe('Date');
  });

  it('resolves a relatedTo class from the model store, at any depth', () => {
    const model = Model.get('team-1');
    model._class = 'Team';
    expect(
      convertFilterOp({ and: [{ name: { equalTo: 'Ada' } }, { relatedTo: { id: 'team-1', key: 'members' } }] }, options())
    ).toEqual({
      $and: [
        { name: { $eq: 'Ada' } },
        { $relatedTo: { object: { __type: 'Pointer', objectId: 'team-1', className: 'Team' }, key: 'members' } }
      ]
    });
  });
});

describe('convertVisualFilter', () => {
  beforeEach(() => {
    setCollections({});
  });

  it('goes through the neutral model, so it gets the escaping the JSON path gets', () => {
    expect(
      convertVisualFilter(
        { combinator: 'and', rules: [{ property: 'name', operator: 'contain', input: 'term' }] },
        { queryParameters: { term: 'a.b' } }
      )
      // `contain` has always meant case-insensitive, and the old code built
      // `{$regex: value}` straight from the user's typing.
    ).toEqual({ name: { $regex: 'a\\.b', $options: 'i' } });
  });

  it('still drops a rule whose port has no value', () => {
    // An unconnected filter port means "do not filter by this". Every graph in
    // every project relies on it, so it stays a silent drop — the user's intent
    // is the missing value, rather than being expressed and then lost.
    expect(
      convertVisualFilter(
        { combinator: 'and', rules: [{ property: 'name', operator: 'contain', input: 'term' }] },
        { queryParameters: {} }
      )
    ).toBeUndefined();
  });

  it('reads the converged builder\'s saved shape too, because a deployed app never opens the editor', () => {
    // BCN-003b retired `QueryEditor`, so a Query Records node's `visualFilter`
    // now holds `{type, conditions}`. The editor rewrites the old shape on
    // load; a published app does not have an editor, so this reads both.
    expect(
      convertVisualFilter(
        {
          id: 'q',
          type: 'and',
          conditions: [
            {
              id: 'q-0',
              kind: 'field',
              field: 'name',
              operator: 'containsIgnoreCase',
              valueSource: 'connected',
              valuePortName: 'qp-term'
            }
          ]
        } as never,
        { queryParameters: { term: 'a.b' }, valuePortPrefix: 'qp-' }
      )
    ).toEqual({ name: { $regex: 'a\\.b', $options: 'i' } });
  });

  it('drops an unconnected port in the new shape as well as the old', () => {
    expect(
      convertVisualFilter(
        {
          id: 'q',
          type: 'and',
          conditions: [
            {
              id: 'q-0',
              kind: 'field',
              field: 'name',
              operator: 'containsIgnoreCase',
              value: 'whatever was last typed',
              valueSource: 'connected',
              valuePortName: 'qp-term'
            }
          ]
        } as never,
        { queryParameters: {}, valuePortPrefix: 'qp-' }
      )
    ).toBeUndefined();
  });
});

describe('collectFilterParameters', () => {
  it('reads both saved shapes, so a wired port is not silently withdrawn', () => {
    expect(
      collectFilterParameters(
        {
          combinator: 'and',
          rules: [
            { property: 'name', operator: 'contain', input: 'term' },
            { combinator: 'or', rules: [{ property: 'city', operator: 'equal to', input: 'term' }] },
            { property: 'age', operator: 'greater than', value: 18 }
          ]
        },
        'qp-'
      )
    ).toEqual(['term']);

    expect(
      collectFilterParameters(
        {
          id: 'q',
          type: 'and',
          conditions: [
            { id: 'a', field: 'name', operator: 'contains', valueSource: 'connected', valuePortName: 'qp-term' },
            {
              id: 'g',
              type: 'or',
              conditions: [
                { id: 'b', field: 'city', operator: 'equalTo', valueSource: 'connected', valuePortName: 'qp-term' }
              ]
            },
            { id: 'c', field: 'age', operator: 'greaterThan', value: 18 }
          ]
        } as never,
        'qp-'
      )
    ).toEqual(['term']);
  });
});

describe('matchesQuery, the local twin', () => {
  const record = (props: Record<string, unknown>) => {
    const model = Model.get('rec-' + Math.random());
    Object.entries(props).forEach(([k, v]) => model.set(k, v));
    return model;
  };

  it('evaluates every operator on a field, not just the first', () => {
    // `between` lowers to `{$gte, $lte}` on one field. The old if/else chain
    // checked one operator per field, so the lower bound was never applied
    // locally and an out-of-range record appeared in the node's results while
    // the backend correctly excluded it.
    const query = { age: { $gte: 18, $lte: 65 } };
    expect(matchesQuery(record({ age: 30 }), query)).toBeTruthy();
    expect(matchesQuery(record({ age: 70 }), query)).toBeFalsy();
    expect(matchesQuery(record({ age: 10 }), query)).toBeFalsy();
  });

  it('compares $lte against $lte', () => {
    // PLAT-003 §29.3: it compared against `$lt`, which is undefined on an
    // `$lte`-only condition — and every comparison with undefined is false, so
    // a `$lte` filter had never matched a local record.
    expect(matchesQuery(record({ age: 30 }), { age: { $lte: 65 } })).toBeTruthy();
  });

  it('reads $nin from $nin', () => {
    // PLAT-003 §29.3: it read `$in`, so a `$nin`-only condition threw.
    expect(matchesQuery(record({ tag: 'a' }), { tag: { $nin: ['b', 'c'] } })).toBeTruthy();
    expect(matchesQuery(record({ tag: 'b' }), { tag: { $nin: ['b', 'c'] } })).toBeFalsy();
  });

  it('honours $exists: false', () => {
    // The old branch tested `value !== undefined` whatever the operand was, so
    // "has no email" matched exactly the records that had one.
    expect(matchesQuery(record({ name: 'Ada' }), { email: { $exists: false } })).toBeTruthy();
    expect(matchesQuery(record({ email: 'a@b.c' }), { email: { $exists: false } })).toBeFalsy();
  });

  it('agrees with the translator on a lowered string filter', () => {
    // The point of the twin: what the backend was asked for and what a locally
    // created record is judged against have to be the same question.
    setCollections({});
    const where = convertFilterOp({ name: { startsWith: 'Ad' } }, { error: () => undefined });
    expect(matchesQuery(record({ name: 'Adam' }), where)).toBeTruthy();
    expect(matchesQuery(record({ name: 'Grace' }), where)).toBeFalsy();
  });
});
