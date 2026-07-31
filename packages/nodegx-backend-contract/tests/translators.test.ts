/**
 * The translators.
 *
 * Two kinds of test here, and the first kind matters more.
 *
 * **The sweep.** `every backend × every operator` is walked, and the descriptor
 * cell is compared against what the translator actually does. That is the test
 * BCN-003's spec asks for when it says each translator must declare its
 * operator support — the declaration lives in the descriptor, so this is what
 * stops the declaration and the code becoming two opinions. It is also the only
 * test that can catch the failure the whole task is about: an operator that is
 * declared supported, is not implemented, and therefore *disappears* from the
 * query instead of erroring.
 *
 * **The shape tests.** Ordinary examples, kept short. The spec's own trap says
 * these are scaffolding rather than the deliverable — *"a shape test cannot
 * catch a wrong-rows bug"* — and the live equivalence pass is what settles
 * that. What they are good for is pinning the cases that have already been
 * wrong once: the RUN-003 dotted path, the quoting of a value containing a
 * quote, the unwrapping of a lone condition.
 */

import { BACKEND_TYPES, FILTER_OPERATORS, LOWERED_OPERATORS, type BackendType, type FilterOperator } from '../src';
import { descriptorFor } from '../src/descriptors';
import {
  FilterTranslationError,
  bindPocketBaseFilter,
  migrateSavedFilter,
  needsOperatorMigration,
  parseFilterNode,
  postgrestQueryString,
  savedFilterToNeutral,
  toDirectusFilter,
  toParseWhere,
  toPocketBaseFilter,
  toPostgrest,
  translateFilter,
  visualQueryToNeutral,
  type TranslateOptions
} from '../src/translators';
import type { Filter } from '../src/filter';

/**
 * A representative value for each operator, so the sweep can build a real
 * filter for every one of the thirty-one.
 */
const SAMPLE: Readonly<Record<FilterOperator, unknown>> = Object.freeze({
  equalTo: 'Ada',
  notEqualTo: 'Ada',
  lessThan: 10,
  greaterThan: 10,
  lessThanOrEqualTo: 10,
  greaterThanOrEqualTo: 10,
  containedIn: ['a', 'b'],
  notContainedIn: ['a', 'b'],
  exists: true,
  matchesRegex: '^Ada$',
  contains: 'da',
  notContains: 'da',
  containsIgnoreCase: 'da',
  startsWith: 'Ad',
  notStartsWith: 'Ad',
  startsWithIgnoreCase: 'Ad',
  endsWith: 'da',
  notEndsWith: 'da',
  endsWithIgnoreCase: 'da',
  between: [1, 5],
  notBetween: [1, 5],
  isEmpty: true,
  isNotEmpty: true,
  textSearch: 'lovelace',
  pointsTo: 'abc123',
  relatedTo: { id: 'abc123', key: 'members', className: 'Team' },
  idEqualTo: 'abc123',
  idContainedIn: ['abc123', 'def456'],
  nearSphere: { latitude: 51.5, longitude: -0.12, maxDistanceInKilometers: 5 },
  withinBox: [
    { latitude: 51, longitude: -1 },
    { latitude: 52, longitude: 0 }
  ],
  withinPolygon: [
    { latitude: 51, longitude: -1 },
    { latitude: 52, longitude: 0 },
    { latitude: 51.5, longitude: 1 }
  ]
});

/** `pointsTo` is the one operator that cannot translate without a schema. */
const SCHEMA = {
  collection: 'Person',
  properties: {
    team: { type: 'Pointer', targetClass: 'Team' },
    members: { type: 'Relation', targetClass: 'Person' },
    born: { type: 'Date' }
  }
};

function filterFor(operator: FilterOperator): Filter {
  if (operator === 'idEqualTo' || operator === 'idContainedIn' || operator === 'relatedTo') {
    return { [operator]: SAMPLE[operator] } as Filter;
  }
  const field = operator === 'pointsTo' ? 'team' : 'name';
  return { [field]: { [operator]: SAMPLE[operator] } } as Filter;
}

/** Every operator every backend declares usable — the sweep's positive half. */
function usableOperators(backend: BackendType): FilterOperator[] {
  const descriptor = descriptorFor(backend);
  return FILTER_OPERATORS.filter((operator) => {
    const cell = descriptor.filters[operator];
    return cell.state === 'supported' || cell.state === 'degraded';
  });
}

function translateSample(backend: BackendType, operator: FilterOperator): unknown {
  const options: TranslateOptions = { backend, schema: SCHEMA };
  return translateFilter(filterFor(operator), options);
}

/** Did this translation actually constrain anything? */
function isNonEmpty(result: unknown): boolean {
  if (result === null || result === undefined) return false;
  const record = result as Record<string, unknown>;
  if (typeof record.expression === 'string') return record.expression !== '';
  if (Array.isArray(record.params)) return record.params.length > 0;
  return Object.keys(record).length > 0;
}

describe('the declaration and the code are the same declaration', () => {
  for (const backend of BACKEND_TYPES) {
    describe(backend, () => {
      it('translates every operator it declares it can, and produces a real condition for each', () => {
        // The heart of the task. An operator that is declared supported but has
        // no branch in the translator used to fall off the end of an if/else
        // chain and contribute nothing — so the query ran, succeeded, and
        // returned every row in the collection. `convertFilterOp` did exactly
        // that for all eleven of the lowered string operators.
        const missing: string[] = [];
        for (const operator of usableOperators(backend)) {
          try {
            const result = translateSample(backend, operator);
            if (!isNonEmpty(result)) missing.push(`${operator}: produced no condition`);
          } catch (error) {
            missing.push(`${operator}: ${(error as Error).message}`);
          }
        }
        expect(missing).toEqual([]);
      });

      it('refuses every operator it declares it cannot, rather than dropping it', () => {
        const descriptor = descriptorFor(backend);
        const silent: string[] = [];
        for (const operator of FILTER_OPERATORS) {
          const cell = descriptor.filters[operator];
          // `conditional` is "unsupported until proven", so it must refuse too
          // when nothing has proven it.
          if (cell.state === 'supported' || cell.state === 'degraded') continue;
          try {
            translateSample(backend, operator);
            silent.push(`${operator}: translated without complaint`);
          } catch (error) {
            if (!(error instanceof FilterTranslationError)) {
              silent.push(`${operator}: threw ${(error as Error).name}, not FilterTranslationError`);
            }
          }
        }
        expect(silent).toEqual([]);
      });

      it("carries the descriptor's own sentence into the error a developer sees", () => {
        const descriptor = descriptorFor(backend);
        const refused = FILTER_OPERATORS.find((operator) => descriptor.filters[operator].state === 'unsupported');
        if (!refused) return;
        const cell = descriptor.filters[refused];
        expect.assertions(2);
        try {
          translateSample(backend, refused);
        } catch (error) {
          const failure = error as FilterTranslationError;
          expect(failure.reason).toBe(cell.state === 'supported' ? undefined : cell.reason);
          // The message shown at runtime contains the sentence the editor puts
          // under the greyed-out port. One string, two surfaces.
          expect(failure.message).toContain(cell.state === 'supported' ? '' : cell.reason);
        }
      });
    });
  }

  it('lowers the eleven lowerable operators everywhere the comparisons work, rather than gating them', () => {
    // `LOWERED_OPERATORS`' own rule: a user on our built-in backend must not
    // open the filter builder and find half the string operators greyed out.
    for (const backend of BACKEND_TYPES) {
      // `custom` is exempt: its shipped table is a floor for an API nobody has
      // seen, and the user declares the rest. Everywhere else, a backend that
      // can answer `equalTo` can be made to answer all eleven.
      if (backend === 'custom') continue;
      for (const operator of LOWERED_OPERATORS) {
        expect(usableOperators(backend)).toContain(operator);
      }
    }
  });

  it('settles conditional cells only when a probe says so', () => {
    // Supabase full-text search needs an index. Unproven, it refuses.
    expect(() => toPostgrest({ body: { textSearch: 'ada' } }, { backend: 'supabase' })).toThrow(
      FilterTranslationError
    );
    expect(
      postgrestQueryString(toPostgrest({ body: { textSearch: 'ada' } }, { backend: 'supabase', probed: ['textSearch'] }))
    ).toBe('body=fts.ada');
  });
});

describe('the neutral filter is read the same way for every dialect', () => {
  it('refuses a node with two keys', () => {
    expect(() => parseFilterNode({ a: { equalTo: 1 }, b: { equalTo: 2 } } as Filter)).toThrow(/exactly one key/);
  });

  it('refuses a leaf with two operators instead of silently taking the first', () => {
    // `convertFilterOp` walked an if/else chain and took the first match, so
    // `{price: {greaterThan: 1, lessThan: 5}}` became `price > 1` — the upper
    // bound gone and the query returning more rows than it was asked for.
    expect(() => parseFilterNode({ price: { greaterThan: 1, lessThan: 5 } } as Filter)).toThrow(/only one can be/);
  });

  it('keeps regex options as a modifier rather than reading them as a second operator', () => {
    expect(parseFilterNode({ name: { matchesRegex: '^A', options: 'i' } } as Filter)).toEqual({
      kind: 'condition',
      field: 'name',
      operator: 'matchesRegex',
      value: '^A',
      regexOptions: 'i'
    });
  });

  it('still accepts the legacy text/search spelling saved in user projects', () => {
    expect(parseFilterNode({ bio: { text: { search: 'ada' } } } as Filter)).toMatchObject({
      operator: 'textSearch',
      value: 'ada'
    });
  });

  it('unwraps a lone surviving child and drops empty groups', () => {
    expect(toParseWhere({ and: [{ name: { equalTo: 'Ada' } }] }, { backend: 'nodegx' })).toEqual({
      name: { $eq: 'Ada' }
    });
    expect(toParseWhere({ and: [{}, { name: { equalTo: 'Ada' } }] }, { backend: 'nodegx' })).toEqual({
      name: { $eq: 'Ada' }
    });
    expect(toParseWhere({ and: [] }, { backend: 'nodegx' })).toEqual({});
  });
});

describe('toParseWhere', () => {
  const nodegx: TranslateOptions = { backend: 'nodegx', schema: SCHEMA };

  it('lowers the string operators onto a regex, escaped', () => {
    // Unescaped, `a.b` matched `axb` — a "contains" filter returning rows it
    // was never asked for.
    expect(toParseWhere({ name: { contains: 'a.b' } }, nodegx)).toEqual({ name: { $regex: 'a\\.b' } });
    expect(toParseWhere({ name: { startsWith: 'Ad' } }, nodegx)).toEqual({ name: { $regex: '^Ad' } });
    expect(toParseWhere({ name: { endsWithIgnoreCase: 'da' } }, nodegx)).toEqual({
      name: { $regex: 'da$', $options: 'i' }
    });
  });

  it('negates with a lookahead, because Parse has no $not', () => {
    const where = toParseWhere({ name: { notContains: 'Ada' } }, nodegx) as { name: { $regex: string } };
    expect(new RegExp(where.name.$regex).test('Adam')).toBe(false);
    expect(new RegExp(where.name.$regex).test('Grace')).toBe(true);
  });

  it('lowers between to one field with two constraints, and notBetween to an or', () => {
    expect(toParseWhere({ age: { between: [18, 65] } }, nodegx)).toEqual({ age: { $gte: 18, $lte: 65 } });
    expect(toParseWhere({ age: { notBetween: [18, 65] } }, nodegx)).toEqual({
      $or: [{ age: { $lt: 18 } }, { age: { $gt: 65 } }]
    });
  });

  it('reads the target class from the schema it is given, not from a global cache', () => {
    expect(toParseWhere({ team: { pointsTo: 'T1' } }, nodegx)).toEqual({
      team: { $eq: { __type: 'Pointer', objectId: 'T1', className: 'Team' } }
    });
    // Without a schema the old code emitted `className: undefined`, which Parse
    // answers with an empty result set and no error.
    expect(() => toParseWhere({ team: { pointsTo: 'T1' } }, { backend: 'nodegx' })).toThrow(/needs the collection schema/);
  });

  it('reads all three nearSphere distances at the name the caller writes', () => {
    // The old code read `$maxDistanceInMiles` with the `$` and the other two
    // without, so at most one of the three could ever have arrived.
    const where = toParseWhere(
      { at: { nearSphere: { latitude: 1, longitude: 2, maxDistanceInMiles: 3 } } },
      { backend: 'parse' }
    ) as { at: Record<string, unknown> };
    expect(where.at.$maxDistanceInMiles).toBe(3);
  });

  it('wraps dates so a range filter does not compare them as text', () => {
    const where = toParseWhere({ born: { greaterThan: '1815-12-10T00:00:00.000Z' } }, nodegx) as {
      born: { $gt: { __type: string; iso: string } };
    };
    expect(where.born.$gt.__type).toBe('Date');
  });
});

describe('toDirectusFilter', () => {
  const directus: TranslateOptions = { backend: 'directus' };

  it('nests a dotted relation path — the RUN-003 403, by name', () => {
    // A flat `"author.name"` key is what live Directus rejected with a 403 in
    // RUN-003 slice 6. Every unit test passed; only a real fetch found it.
    expect(
      toDirectusFilter({ and: [{ status: { equalTo: 'published' } }, { 'author.name': { equalTo: 'Ada' } }] }, directus)
    ).toEqual({ _and: [{ status: { _eq: 'published' } }, { author: { name: { _eq: 'Ada' } } }] });
  });

  it('splits the boolean exists into Directus two nullary operators', () => {
    expect(toDirectusFilter({ archived: { exists: false } }, directus)).toEqual({ archived: { _null: true } });
    expect(toDirectusFilter({ archived: { exists: true } }, directus)).toEqual({ archived: { _nnull: true } });
  });

  it('keeps the literal-true quirk for the nullary operators', () => {
    expect(toDirectusFilter({ tags: { isEmpty: true } }, directus)).toEqual({ tags: { _empty: true } });
  });
});

describe('toPostgrest', () => {
  const supabase: TranslateOptions = { backend: 'supabase' };

  it('puts top-level conditions in separate parameters and or-groups in one', () => {
    expect(postgrestQueryString(toPostgrest({ and: [{ a: { equalTo: 1 } }, { b: { greaterThan: 2 } }] }, supabase))).toBe(
      'a=eq.1&b=gt.2'
    );
    expect(postgrestQueryString(toPostgrest({ or: [{ a: { equalTo: 1 } }, { b: { greaterThan: 2 } }] }, supabase))).toBe(
      'or=(a.eq.1,b.gt.2)'
    );
  });

  it('does NOT quote at the top level, and does inside a group', () => {
    // ⚠️ Both halves are measured against PostgREST 12.2 by the live
    // equivalence pass, and the first half inverts the obvious guess: at the
    // top level PostgREST does *not* strip surrounding quotes, so
    // `?city=eq."London"` matches nothing. An earlier draft quoted anything
    // carrying a reserved character, and a filter for a name containing a
    // quote and an `&&` returned zero rows from PostgREST and the right row
    // from the other four backends. Nothing needs quoting there anyway — the
    // only structural character is `&`, and percent-encoding handles it.
    expect(postgrestQueryString(toPostgrest({ name: { equalTo: 'Lovelace, Ada' } }, supabase))).toBe(
      'name=eq.Lovelace, Ada'
    );
    // Inside `or=(…)` the rules reverse: a bare comma is a PGRST100 parse
    // error, quoting is honoured, and a quote inside is backslash-escaped.
    expect(
      postgrestQueryString(
        toPostgrest({ or: [{ name: { equalTo: 'Lovelace, Ada' } }, { age: { equalTo: 1 } }] }, supabase)
      )
    ).toBe('or=(name.eq."Lovelace, Ada",age.eq.1)');
    expect(
      postgrestQueryString(toPostgrest({ or: [{ name: { equalTo: 'a"b' } }, { age: { equalTo: 1 } }] }, supabase))
    ).toBe('or=(name.eq."a\\"b",age.eq.1)');
  });

  it('reports the embed a dotted path needs, and refuses one inside an or', () => {
    const filter = toPostgrest({ 'author.name': { equalTo: 'Ada' } }, supabase);
    expect(filter.embeds).toEqual(['author']);
    // No spelling exists for this inside `or=(…)` — the dot is already the
    // separator. Refusing beats emitting something that parses and means
    // something else.
    expect(() => toPostgrest({ or: [{ 'author.name': { equalTo: 'Ada' } }, { a: { equalTo: 1 } }] }, supabase)).toThrow(
      /related record/
    );
  });

  it('lowers the string family onto like/ilike and escapes the wildcards', () => {
    // PostgREST's wildcard is `*`, which it rewrites to `%`, so both are
    // metacharacters and both are escaped out of the user's value. Unlike
    // Directus and PocketBase, Postgres *does* honour the backslash escape —
    // measured live: `bio=like.*100\\%*` returns "100% sure" and not
    // "1000 words", where the unescaped form returns both.
    expect(postgrestQueryString(toPostgrest({ name: { startsWith: '50%' } }, supabase))).toBe('name=like.50\\%*');
    expect(postgrestQueryString(toPostgrest({ name: { contains: 'a*b' } }, supabase))).toBe('name=like.*a\\*b*');
    expect(postgrestQueryString(toPostgrest({ name: { notContains: 'ada' } }, supabase))).toBe('name=not.like.*ada*');
  });

  it('expands between into two conditions, since PostgREST has no between', () => {
    expect(postgrestQueryString(toPostgrest({ age: { between: [18, 65] } }, supabase))).toBe('age=gte.18&age=lte.65');
  });
});

describe('toPocketBaseFilter', () => {
  const pocketbase: TranslateOptions = { backend: 'pocketbase' };

  it('never puts a user value in the expression', () => {
    // The success criterion, by name: a value containing `"` and `&&`. Naive
    // string-joining here would let a search box rewrite the query's logic and,
    // on a collection with per-user rules, read someone else's rows.
    const hostile = 'a" || 1=1 && "b';
    const filter = toPocketBaseFilter({ title: { equalTo: hostile } }, pocketbase);
    expect(filter.expression).toBe('title = {:p0}');
    expect(filter.expression).not.toContain('||');
    expect(filter.expression).not.toContain(hostile);
    expect(filter.params).toEqual({ p0: hostile });
    // And once bound, the value is quoted and its quotes escaped.
    expect(bindPocketBaseFilter(filter)).toBe('title = "a\\" || 1=1 && \\"b"');
  });

  it('numbers its parameters per translation, not per module', () => {
    const first = toPocketBaseFilter({ and: [{ a: { equalTo: 1 } }, { b: { equalTo: 2 } }] }, pocketbase);
    const second = toPocketBaseFilter({ a: { equalTo: 3 } }, pocketbase);
    expect(first.params).toEqual({ p0: 1, p1: 2 });
    expect(second.params).toEqual({ p0: 3 });
  });

  it('turns set membership into a disjunction, since PocketBase has no in', () => {
    const filter = toPocketBaseFilter({ status: { containedIn: ['a', 'b'] } }, pocketbase);
    expect(filter.expression).toBe('(status = {:p0} || status = {:p1})');
  });

  it('does not escape a wildcard, because PocketBase honours no escape', () => {
    // ⚠️ Measured, and deliberately the less tidy answer. PocketBase's `~` is
    // SQL LIKE with no reachable `ESCAPE` clause, so a backslash is matched
    // literally: escaping `100%` to `100\\%` returns *nothing* rather than the
    // right row. Both available behaviours are wrong; a superset that still
    // contains the right rows beats an empty result, and `_` is common enough
    // in real text (`user_id`) that escaping would break ordinary searches.
    // The `pocketbase` descriptor marks the family `degraded` and says so.
    const filter = toPocketBaseFilter({ title: { contains: '100%' } }, pocketbase);
    expect(filter.params).toEqual({ p0: '%100%%' });
  });
});

describe('the saved formats', () => {
  it('migrates Directus operator names, including the two that are not renames', () => {
    const saved = {
      id: 'g',
      type: 'and' as const,
      conditions: [
        { id: 'c1', field: 'status', operator: '_eq', value: 'published' },
        { id: 'c2', field: 'archived', operator: '_null', value: true },
        { id: 'c3', field: 'deleted', operator: '_nnull', value: true },
        { id: 'c4', field: 'tags', operator: '_empty', value: true }
      ]
    };
    expect(needsOperatorMigration(saved)).toBe(true);
    const migrated = migrateSavedFilter(saved);
    expect(migrated.conditions).toEqual([
      { id: 'c1', field: 'status', operator: 'equalTo', value: 'published' },
      // `_null` is nullary; `exists` is boolean-valued. A rename alone would
      // have inverted the meaning of every one of these.
      { id: 'c2', field: 'archived', operator: 'exists', value: false },
      { id: 'c3', field: 'deleted', operator: 'exists', value: true },
      { id: 'c4', field: 'tags', operator: 'isEmpty' }
    ]);
    expect(needsOperatorMigration(migrated)).toBe(false);
  });

  it('leaves an already-migrated filter untouched, so it does not dirty every project it reads', () => {
    const neutral = {
      id: 'g',
      type: 'and' as const,
      conditions: [{ id: 'c', field: 'status', operator: 'equalTo', value: 'published' }]
    };
    expect(needsOperatorMigration(neutral)).toBe(false);
    expect(migrateSavedFilter(neutral)).toEqual(neutral);
  });

  it('resolves a connected value from its port', () => {
    const saved = {
      id: 'g',
      type: 'and' as const,
      conditions: [
        {
          id: 'c',
          field: 'status',
          operator: 'equalTo',
          value: 'stale',
          valueSource: 'connected' as const,
          valuePortName: 'filter_status_c'
        }
      ]
    };
    expect(savedFilterToNeutral(saved, (port) => (port === 'filter_status_c' ? 'live' : undefined))).toEqual({
      status: { equalTo: 'live' }
    });
  });

  it('converts the Parse-side visual filter, keeping its optional-port behaviour', () => {
    expect(
      visualQueryToNeutral(
        { combinator: 'and', rules: [{ property: 'name', operator: 'contain', input: 'term' }] },
        { term: 'ada' }
      )
    ).toEqual({ name: { containsIgnoreCase: 'ada' } });

    // An unconnected filter port means "do not filter by this", and every
    // graph in every project relies on it.
    expect(
      visualQueryToNeutral({ combinator: 'and', rules: [{ property: 'name', operator: 'contain', input: 'term' }] }, {})
    ).toBeNull();
  });

  it('sends a pre-BCN-003 saved filter to exactly the same Directus payload as before', () => {
    // The migration's real acceptance criterion. Saved BYOB filters store
    // Directus operator names verbatim in project data; the decision was to
    // migrate rather than break. That is only true if a filter saved by the old
    // builder, migrated and re-translated, produces the payload the old
    // converter produced — otherwise "migrate" means "quietly change what the
    // user's app asks for".
    const savedByTheOldBuilder = {
      id: 'root',
      type: 'and' as const,
      conditions: [
        { id: 'c1', field: 'status', operator: '_eq', value: 'published' },
        { id: 'c2', field: 'author.name', operator: '_contains', value: 'Ada' },
        { id: 'c3', field: 'archived', operator: '_null', value: true },
        { id: 'c4', field: 'views', operator: '_between', value: [10, 100] },
        {
          id: 'g1',
          type: 'or' as const,
          conditions: [
            { id: 'c5', field: 'rating', operator: '_gte', value: 4 },
            { id: 'c6', field: 'tags', operator: '_nempty', value: true }
          ]
        }
      ]
    };

    const migrated = migrateSavedFilter(savedByTheOldBuilder);
    const neutral = savedFilterToNeutral(migrated);
    expect(toDirectusFilter(neutral, { backend: 'directus' })).toEqual({
      _and: [
        { status: { _eq: 'published' } },
        { author: { name: { _contains: 'Ada' } } },
        { archived: { _null: true } },
        { views: { _between: [10, 100] } },
        { _or: [{ rating: { _gte: 4 } }, { tags: { _nempty: true } }] }
      ]
    });
  });

  it('maps exist / not exist without needing a value', () => {
    expect(visualQueryToNeutral({ property: 'email', operator: 'exist' })).toEqual({ email: { exists: true } });
    expect(visualQueryToNeutral({ property: 'email', operator: 'not exist' })).toEqual({ email: { exists: false } });
  });
});
