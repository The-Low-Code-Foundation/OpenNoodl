/**
 * TUT-002 — a condition that can see data.
 *
 * The lesson vocabulary was entirely graph-structural, so a data tutorial could grade *"you wired
 * Create Record's `Do` to the Visual Function's signal output"* and could not grade *"you created a
 * record."* These specs grade the three verbs that close that gap, and — more importantly — the two
 * distinctions that make them safe:
 *
 * 🔴 **"zero rows" is not "could not read"**, and **"refused" is not "not done yet."** Both pairs
 * are invisible in the boolean the evaluator returns, and both would have a lesson congratulate a
 * learner whose backend never started, or leave one staring at a step that can never tick.
 */
import {
  LessonCondition,
  LessonEvalContext,
  databaseRefusal,
  evalConditionsWithContext,
  isCollectionCondition
} from '../../src/editor/src/views/lessons/lessonevalconditions';
import { compileConditions } from '../../src/editor/src/models/lessonformat';

/** A context with no graph in it — these verbs read only the database. */
function ctx(database?: LessonEvalContext['database']): LessonEvalContext {
  return {
    components: [],
    rootNode: undefined,
    getMetaData: () => undefined,
    viewerPath: undefined,
    activeComponentName: undefined,
    database
  };
}

const PUPPIES = { name: 'Puppies', columns: ['name', 'age'], rowCount: 3 };

function ok(...collections: { name: string; columns: string[]; rowCount?: number }[]) {
  return { status: 'ok' as const, collections };
}

function evalOne(cond: LessonCondition, database?: LessonEvalContext['database']): boolean {
  return evalConditionsWithContext([cond], ctx(database));
}

describe('AC1 — the three verbs compile 1:1 into the internal vocabulary', () => {
  it('collectionExists', () => {
    expect(compileConditions([{ collection: 'Puppies', collectionExists: true }], 'w')).toEqual([
      { collection: 'Puppies', collectionexists: true }
    ]);
  });

  it('hasColumns joins on commas, the same shape hasParams uses', () => {
    expect(compileConditions([{ collection: 'Puppies', hasColumns: ['name', 'age'] }], 'w')).toEqual([
      { collection: 'Puppies', collectionhascolumns: 'name,age' }
    ]);
  });

  it('rowCountAtLeast', () => {
    expect(compileConditions([{ collection: 'Puppies', rowCountAtLeast: 1 }], 'w')).toEqual([
      { collection: 'Puppies', collectionrowcountatleast: 1 }
    ]);
  });

  it('🔴 does not collide with the node verbs — `exists` still compiles to a NODE condition', () => {
    // `{ collection, exists }` would have been the natural spelling and is a trap: the dispatcher
    // matches `'exists' in d` and would build a node condition with no path.
    expect(compileConditions([{ node: 'Group', exists: true }], 'w')).toEqual([{ path: 'Group', exists: true }]);
  });

  it('refuses the shapes that would compile into a permanently-false condition', () => {
    expect(() => compileConditions([{ collection: '  ', collectionExists: true }], 'w')).toThrow(/must name a collection/);
    expect(() => compileConditions([{ collection: 'P', hasColumns: [] }], 'w')).toThrow(/non-empty array/);
    expect(() => compileConditions([{ collection: 'P', hasColumns: ['a,b'] }], 'w')).toThrow(/may not contain a comma/);
    expect(() => compileConditions([{ collection: 'P', rowCountAtLeast: -1 }], 'w')).toThrow(/non-negative whole number/);
    expect(() => compileConditions([{ collection: 'P', rowCountAtLeast: 1.5 }], 'w')).toThrow(/non-negative whole number/);
  });

  it('still refuses an unrecognised verb, and names the new three', () => {
    expect(() => compileConditions([{ nonsense: true } as never], 'w')).toThrow(/collectionExists, hasColumns, rowCountAtLeast/);
  });
});

describe('AC2 — the evaluator stays synchronous', () => {
  it('returns a boolean, not a promise, with a database condition in play', () => {
    const result = evalConditionsWithContext([{ collection: 'Puppies', collectionexists: true }], ctx(ok(PUPPIES)));

    expect(typeof result).toBe('boolean');
    expect(result).toBe(true);
    // The signature claim, stated so a future `async` shows up here rather than in a lesson.
    expect(result).not.toBeInstanceOf(Promise);
    expect((result as unknown as { then?: unknown }).then).toBeUndefined();
  });
});

describe('the verbs themselves', () => {
  it('collectionExists answers both directions against a readable snapshot', () => {
    expect(evalOne({ collection: 'Puppies', collectionexists: true }, ok(PUPPIES))).toBe(true);
    expect(evalOne({ collection: 'Kittens', collectionexists: true }, ok(PUPPIES))).toBe(false);
    // …and "you have not made it yet" is a legitimate step.
    expect(evalOne({ collection: 'Kittens', collectionexists: false }, ok(PUPPIES))).toBe(true);
    expect(evalOne({ collection: 'Puppies', collectionexists: false }, ok(PUPPIES))).toBe(false);
  });

  it('hasColumns requires every named column', () => {
    expect(evalOne({ collection: 'Puppies', collectionhascolumns: 'name' }, ok(PUPPIES))).toBe(true);
    expect(evalOne({ collection: 'Puppies', collectionhascolumns: 'name,age' }, ok(PUPPIES))).toBe(true);
    expect(evalOne({ collection: 'Puppies', collectionhascolumns: 'name,age,breed' }, ok(PUPPIES))).toBe(false);
  });

  it('rowCountAtLeast compares as a floor', () => {
    expect(evalOne({ collection: 'Puppies', collectionrowcountatleast: 3 }, ok(PUPPIES))).toBe(true);
    expect(evalOne({ collection: 'Puppies', collectionrowcountatleast: 4 }, ok(PUPPIES))).toBe(false);
  });

  it('🔴 compares collection AND column names case-insensitively — SQLite identifiers are', () => {
    // `planSchemaReconciliation` already paid for the other assumption: `ADD COLUMN age` against an
    // existing `Age` fails, and `SchemaManager.addColumn` swallows precisely that error.
    expect(evalOne({ collection: 'puppies', collectionexists: true }, ok(PUPPIES))).toBe(true);
    expect(evalOne({ collection: 'PUPPIES', collectionhascolumns: 'NAME,Age' }, ok(PUPPIES))).toBe(true);
  });
});

describe('🔴 zero rows is a real answer; a snapshot that could not count is not', () => {
  const uncounted = ok({ name: 'Puppies', columns: ['name'] });

  it('an empty collection genuinely satisfies rowCountAtLeast: 0', () => {
    expect(evalOne({ collection: 'Puppies', collectionrowcountatleast: 0 }, ok({ name: 'Puppies', columns: ['name'], rowCount: 0 }))).toBe(true);
  });

  it('but an UNCOUNTED collection does not — the two would otherwise read identically', () => {
    // Without this guard a lesson congratulates a learner whose backend failed to start, because
    // "at least zero" holds against anything.
    expect(evalOne({ collection: 'Puppies', collectionrowcountatleast: 0 }, uncounted)).toBe(false);
    expect(evalOne({ collection: 'Puppies', collectionrowcountatleast: 1 }, uncounted)).toBe(false);
  });

  it('🔴 and a rowCount that is not a NUMBER is unproven too — the arm the guard actually carries', () => {
    // `undefined >= 0` is already false by NaN semantics, so the absent case does not on its own
    // prove the guard does anything. A snapshot crossing a process boundary as JSON can carry
    // `"5"`, and `'5' >= 1` is **true** — the guard is what stops a string satisfying a row count.
    const stringy = { status: 'ok' as const, collections: [{ name: 'Puppies', columns: ['name'], rowCount: '5' as unknown as number }] };

    expect(evalOne({ collection: 'Puppies', collectionrowcountatleast: 1 }, stringy)).toBe(false);
    expect(evalOne({ collection: 'Puppies', collectionrowcountatleast: 0 }, stringy)).toBe(false);
  });

  it('an uncounted collection still answers the two verbs that do not need a count', () => {
    expect(evalOne({ collection: 'Puppies', collectionexists: true }, uncounted)).toBe(true);
    expect(evalOne({ collection: 'Puppies', collectionhascolumns: 'name' }, uncounted)).toBe(true);
  });
});

describe('AC4 — a refusal names the binding, and cannot read as "not done yet"', () => {
  const cond: LessonCondition = { collection: 'Puppies', collectionexists: true };

  it('🔴 the known-firing control: on a LOCAL binding the same condition fires', () => {
    // Without this arm, every assertion below is satisfied by a verb that never works at all —
    // "refused" and "never asked" would read identically, which is the thing AC4 forbids.
    expect(evalConditionsWithContext([cond], ctx(ok(PUPPIES)))).toBe(true);
    expect(databaseRefusal([cond], ctx(ok(PUPPIES)))).toBeUndefined();
  });

  it('a non-local binding is REFUSED BY NAME, and the refusal is not the boolean', () => {
    const refused = ctx({ status: 'refused', binding: 'Directus' });

    const message = databaseRefusal([cond], refused);
    expect(message).toContain('Directus');
    expect(message).toMatch(/built-in database/);
    // The boolean stays false — a grader that cannot see the database must never congratulate —
    // but the sentence is what the learner is shown instead of an unticked box.
    expect(evalConditionsWithContext([cond], refused)).toBe(false);
  });

  it('an unreadable built-in database is a THIRD answer, not the same as refused', () => {
    const down = ctx({ status: 'unavailable', reason: 'the backend is not running' });

    expect(databaseRefusal([cond], down)).toContain('not running');
    expect(databaseRefusal([cond], down)).not.toMatch(/bound to/);
    expect(evalConditionsWithContext([cond], down)).toBe(false);
  });

  it('🔴 an ABSENT snapshot is refused too, rather than read as "no collections"', () => {
    // An empty `{status:'ok', collections:[]}` and a missing snapshot must not be the same thing:
    // the first says the learner has not made it, the second says nobody looked.
    expect(databaseRefusal([cond], ctx())).toMatch(/nothing read it/);
    expect(evalConditionsWithContext([cond], ctx())).toBe(false);

    // …whereas a genuinely empty database IS an answer, and raises no refusal.
    expect(databaseRefusal([cond], ctx(ok()))).toBeUndefined();
    expect(evalConditionsWithContext([cond], ctx(ok()))).toBe(false);
  });

  it('says nothing about a step with no database condition on it', () => {
    const graphOnly: LessonCondition = { path: 'Group', exists: true };
    expect(databaseRefusal([graphOnly], ctx({ status: 'refused', binding: 'Directus' }))).toBeUndefined();
    expect(isCollectionCondition(graphOnly)).toBe(false);
    expect(isCollectionCondition({ collection: 'P', collectionrowcountatleast: 1 })).toBe(true);
  });
});

describe('the existing vocabulary is untouched', () => {
  it('still evaluates a graph condition with no database in the context', () => {
    expect(evalConditionsWithContext([{ path: 'Nope', exists: false }], ctx())).toBe(true);
  });

  it('still throws on a genuinely unknown internal condition', () => {
    expect(() => evalConditionsWithContext([{ mystery: 1 } as never], ctx())).toThrow(/Unknown lesson condition/);
  });
});
